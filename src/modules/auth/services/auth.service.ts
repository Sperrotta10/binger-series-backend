import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { AuthRepository } from '../repositories/auth.repository.js';
import { AppError } from '../../../middlewares/errorHandler.js';
import { HttpStatus } from '../../../constants/httpStatus.js';
import { ErrorCodes } from '../../../constants/errorCodes.js';
import { generateTokens, verifyRefreshToken } from '../../../utils/jwt.js';
import { redis } from '../../../config/redis.js';
import type {
  RegisterInput,
  LoginInput,
  RefreshInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  UpdateProfileInput,
} from '../schemas/auth.schema.js';

// Refresh token TTL in seconds (30 days)
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60;

export class AuthService {
  // ── POST /register ──────────────────────────────────────────

  static async registerUser(input: RegisterInput) {
    // 1. Duplicate check
    const existingUser = await AuthRepository.findUserByEmail(input.email);
    if (existingUser) {
      throw new AppError(
        'Email already registered',
        HttpStatus.CONFLICT,
        ErrorCodes.ACCOUNT_EXISTS,
      );
    }

    // 2. Generate unique username from name
    let baseUsername = input.name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .substring(0, 15);

    if (!baseUsername) {
      baseUsername = 'user';
    }

    let username = baseUsername;
    let counter = 1;
    let usernameExists = true;
    while (usernameExists) {
      const existing = await AuthRepository.findUserByUsername(username);
      if (existing) {
        const suffix = counter.toString();
        username = `${baseUsername.substring(0, 15 - suffix.length)}${suffix}`;
        counter++;
      } else {
        usernameExists = false;
      }
    }

    // 3. Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(input.password, salt);

    // 4. Persist (UTC dates rule)
    const now = new Date();
    const user = await AuthRepository.createUser({
      email: input.email,
      passwordHash,
      displayName: input.name,
      username,
      createdAt: now,
      updatedAt: now,
    });

    // 5. Generate session tokens & store refresh in Redis
    const tokens = generateTokens(user.id, user.username);
    await redis.set(`rt:${user.id}`, tokens.refreshToken, 'EX', REFRESH_TOKEN_TTL);

    return { user, tokens };
  }

  // ── POST /login ─────────────────────────────────────────────

  static async loginUser(input: LoginInput) {
    // 1. Find user
    const user = await AuthRepository.findUserByEmail(input.email);

    // Security: generic error for both "not found" and "wrong password"
    if (!user) {
      throw new AppError(
        'Invalid credentials',
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.INVALID_CREDENTIALS,
      );
    }

    // 2. Check if user registered via OAuth only (no password)
    if (!user.passwordHash) {
      throw new AppError(
        'This account uses Google Sign-In',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    // 3. Verify password
    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) {
      throw new AppError(
        'Invalid credentials',
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.INVALID_CREDENTIALS,
      );
    }

    // 4. Generate session tokens & store refresh in Redis
    const tokens = generateTokens(user.id, user.username);
    await redis.set(`rt:${user.id}`, tokens.refreshToken, 'EX', REFRESH_TOKEN_TTL);

    return { user, tokens };
  }

  // ── POST /oauth/google ──────────────────────────────────────

  static async googleOauth(googlePayload: {
    sub: string;
    email: string;
    name: string;
    picture?: string;
  }) {
    const now = new Date();

    // Case A: Already a Google user
    const oauthAccount = await AuthRepository.findOauthAccount('google', googlePayload.sub);
    if (oauthAccount) {
      const user = await AuthRepository.findUserById(oauthAccount.userId);
      if (!user) {
        throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
      }
      const tokens = generateTokens(user.id, user.username);
      await redis.set(`rt:${user.id}`, tokens.refreshToken, 'EX', REFRESH_TOKEN_TTL);
      return { user, tokens, isNewUser: false };
    }

    // Case B: Existing traditional user with same email
    const existingUser = await AuthRepository.findUserByEmail(googlePayload.email);
    if (existingUser) {
      await AuthRepository.createOauthAccount({
        userId: existingUser.id,
        provider: 'google',
        providerUserId: googlePayload.sub,
        createdAt: now,
      });
      const tokens = generateTokens(existingUser.id, existingUser.username);
      await redis.set(`rt:${existingUser.id}`, tokens.refreshToken, 'EX', REFRESH_TOKEN_TTL);
      return { user: existingUser, tokens, isNewUser: false };
    }

    // Case C: Brand new user
    let baseUsername = googlePayload.name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .substring(0, 15);

    if (!baseUsername) {
      baseUsername = 'user';
    }

    let username = baseUsername;
    let counter = 1;
    let usernameExists = true;
    while (usernameExists) {
      const existing = await AuthRepository.findUserByUsername(username);
      if (existing) {
        const suffix = counter.toString();
        username = `${baseUsername.substring(0, 15 - suffix.length)}${suffix}`;
        counter++;
      } else {
        usernameExists = false;
      }
    }

    const newUser = await AuthRepository.createUser({
      email: googlePayload.email,
      passwordHash: null,
      displayName: googlePayload.name,
      username,
      avatarUrl: googlePayload.picture ?? null,
      createdAt: now,
      updatedAt: now,
    });

    await AuthRepository.createOauthAccount({
      userId: newUser.id,
      provider: 'google',
      providerUserId: googlePayload.sub,
      createdAt: now,
    });

    const tokens = generateTokens(newUser.id, newUser.username);
    await redis.set(`rt:${newUser.id}`, tokens.refreshToken, 'EX', REFRESH_TOKEN_TTL);

    return { user: newUser, tokens, isNewUser: true };
  }

  // ── POST /refresh ───────────────────────────────────────────

  static async refreshTokens(input: RefreshInput) {
    // 1. Verify signature & expiration
    let payload;
    try {
      payload = verifyRefreshToken(input.refreshToken);
    } catch {
      throw new AppError(
        'Invalid or expired refresh token',
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.TOKEN_EXPIRED,
      );
    }

    // 2. Check revocation in Redis
    const storedToken = await redis.get(`rt:${payload.id}`);
    if (!storedToken || storedToken !== input.refreshToken) {
      throw new AppError(
        'Refresh token revoked or already used',
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.TOKEN_INVALID,
      );
    }

    // 3. Verify user exists
    const user = await AuthRepository.findUserById(payload.id);
    if (!user) {
      throw new AppError('User not found', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }

    // 4. Rotate tokens
    const tokens = generateTokens(user.id, user.username);
    await redis.set(`rt:${user.id}`, tokens.refreshToken, 'EX', REFRESH_TOKEN_TTL);

    return { tokens };
  }

  // ── POST /forgot-password ───────────────────────────────────

  static async forgotPassword(input: ForgotPasswordInput) {
    // Always return success to prevent user enumeration
    const user = await AuthRepository.findUserByEmail(input.email);
    if (!user) return;

    // Generate cryptographic token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

    await AuthRepository.createPasswordReset({
      userId: user.id,
      tokenHash,
      expiresAt,
      createdAt: now,
    });

    // TODO: Send email with rawToken via email service in a future sprint
    // For now, return the token in dev mode for testing
    return { rawToken };
  }

  // ── POST /reset-password ────────────────────────────────────

  static async resetPassword(input: ResetPasswordInput) {
    // 1. Hash the incoming token and look it up
    const tokenHash = crypto.createHash('sha256').update(input.token).digest('hex');

    const resetRecord = await AuthRepository.findValidPasswordReset(tokenHash);
    if (!resetRecord) {
      throw new AppError(
        'Reset token is invalid or has expired',
        HttpStatus.GONE,
        ErrorCodes.TOKEN_EXPIRED,
      );
    }

    // 2. Hash the new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(input.newPassword, salt);

    const now = new Date();

    // 3. Update password
    await AuthRepository.updateUserPassword(resetRecord.userId, passwordHash, now);

    // 4. Mark token as used
    await AuthRepository.markPasswordResetUsed(resetRecord.id, now);

    // 5. Invalidate all active sessions (revoke refresh token)
    await redis.del(`rt:${resetRecord.userId}`);
  }

  // ── POST /logout ────────────────────────────────────────────

  static async logoutUser(userId: string, accessToken: string) {
    // 1. Delete refresh token from Redis
    await redis.del(`rt:${userId}`);

    // 2. Blacklist current access token until it expires (15 min)
    await redis.set(`bl:${accessToken}`, '1', 'EX', 15 * 60);
  }

  // ── GET /profile/me ─────────────────────────────────────────

  static async getProfile(userId: string) {
    const user = await AuthRepository.findUserById(userId);
    if (!user) {
      throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }
    return user;
  }

  // ── PATCH /profile/update ────────────────────────────────────

  static async updateProfile(userId: string, input: UpdateProfileInput) {
    // Check username uniqueness if being updated
    if (input.username) {
      const existing = await AuthRepository.findUserByUsername(input.username);
      if (existing && existing.id !== userId) {
        throw new AppError('Username is already taken', HttpStatus.CONFLICT, ErrorCodes.CONFLICT);
      }
    }

    const now = new Date();

    const user = await AuthRepository.updateUserProfile(userId, {
      ...(input.username && { username: input.username }),
      ...(input.name && { displayName: input.name }),
      ...(input.biography !== undefined && { bio: input.biography }),
      ...(input.avatar_url !== undefined && { avatarUrl: input.avatar_url }),
      updatedAt: now,
    });

    return user;
  }
}
