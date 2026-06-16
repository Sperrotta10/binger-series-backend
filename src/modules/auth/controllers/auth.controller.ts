import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { catchAsync } from '../../../utils/catchAsync.js';
import { ApiResponse } from '../../../utils/apiResponse.js';
import { HttpStatus } from '../../../constants/httpStatus.js';
import { ErrorCodes } from '../../../constants/errorCodes.js';
import { AppError } from '../../../middlewares/errorHandler.js';
import { env } from '../../../config/index.js';
import { AuthService } from '../services/auth.service.js';
import {
  registerSchema,
  loginSchema,
  googleOauthSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '../schemas/auth.schema.js';

const formatUserResponse = (user: {
  id: string;
  email: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
  bio?: string | null;
  createdAt?: Date;
}) => ({
  id: user.id,
  email: user.email,
  username: user.username,
  fullName: user.fullName,
  avatar_url: user.avatarUrl,
});

const setRefreshTokenCookie = (res: Response, token: string) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

const clearRefreshTokenCookie = (res: Response) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
};

export const register = catchAsync(async (req: Request, res: Response) => {
  const input = registerSchema.parse(req.body);
  const { user, tokens } = await AuthService.registerUser(input);

  setRefreshTokenCookie(res, tokens.refreshToken);

  return ApiResponse.success(
    res,
    { user: formatUserResponse(user), tokens: { accessToken: tokens.accessToken } },
    'User registered successfully',
    HttpStatus.CREATED,
  );
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);
  const { user, tokens } = await AuthService.loginUser(input);

  setRefreshTokenCookie(res, tokens.refreshToken);

  return ApiResponse.success(res, { user: formatUserResponse(user), tokens: { accessToken: tokens.accessToken } });
});

const googleClient = new OAuth2Client();

export const googleOauth = catchAsync(async (req: Request, res: Response) => {
  const { idToken } = googleOauthSchema.parse(req.body);

  // Verify token with Google
  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({ idToken });
  } catch {
    throw new AppError(
      'Failed to verify Google token',
      HttpStatus.UNPROCESSABLE_ENTITY,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email) {
    throw new AppError(
      'Invalid Google token payload',
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  const { user, tokens, isNewUser } = await AuthService.googleOauth({
    sub: payload.sub,
    email: payload.email,
    name: payload.name ?? payload.email.split('@')[0],
    picture: payload.picture,
  });

  setRefreshTokenCookie(res, tokens.refreshToken);

  const statusCode = isNewUser ? HttpStatus.CREATED : HttpStatus.OK;
  return ApiResponse.success(
    res,
    { user: formatUserResponse(user), tokens: { accessToken: tokens.accessToken } },
    undefined,
    statusCode,
  );
});

export const refresh = catchAsync(async (req: Request, res: Response) => {
  // Try to get token from cookie first, fallback to body
  const tokenFromCookie = req.cookies?.refreshToken;
  const input = refreshSchema.parse({ refreshToken: tokenFromCookie || req.body.refreshToken });
  const { tokens } = await AuthService.refreshTokens(input);

  setRefreshTokenCookie(res, tokens.refreshToken);

  return ApiResponse.success(res, { tokens: { accessToken: tokens.accessToken } });
});

export const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const input = forgotPasswordSchema.parse(req.body);
  const data = await AuthService.forgotPassword(input);

  if (env.NODE_ENV === 'development') {
    return ApiResponse.success(
      res,
      { rawToken: data?.rawToken },
      'If the email exists, a password reset link has been sent.',
    );
  }

  // Always return success to prevent user enumeration
  return ApiResponse.success(
    res,
    undefined,
    'If the email exists, a password reset link has been sent.',
  );
});

export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const input = resetPasswordSchema.parse(req.body);
  await AuthService.resetPassword(input);

  return ApiResponse.success(
    res,
    undefined,
    'Password updated successfully. All concurrent sessions have been revoked.',
  );
});

export const logout = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const accessToken = req.headers.authorization!.split(' ')[1];

  await AuthService.logoutUser(userId, accessToken);

  clearRefreshTokenCookie(res);

  return ApiResponse.success(res, undefined, 'Session revoked successfully.');
});

export const getProfile = catchAsync(async (req: Request, res: Response) => {
  const user = await AuthService.getProfile(req.user!.id);

  return ApiResponse.success(res, {
    user: {
      ...formatUserResponse(user),
      biography: user.bio,
      created_at: user.createdAt.toISOString(),
    },
  });
});

export const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const input = updateProfileSchema.parse(req.body);
  const user = await AuthService.updateProfile(req.user!.id, input);

  return ApiResponse.success(
    res,
    {
      user: {
        ...formatUserResponse(user),
        biography: user.bio,
      },
    },
    'Profile updated successfully',
  );
});
