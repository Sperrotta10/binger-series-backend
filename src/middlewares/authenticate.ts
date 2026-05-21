import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AccessTokenPayload } from '../utils/jwt.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { HttpStatus } from '../constants/httpStatus.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { redis } from '../config/redis.js';

// Extend Express Request to include authenticated user data
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    ApiResponse.error(
      res,
      'Access token is required',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    // Check if token is blacklisted (from logout)
    const isBlacklisted = await redis.get(`bl:${token}`);
    if (isBlacklisted) {
      ApiResponse.error(
        res,
        'Token has been revoked',
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.TOKEN_INVALID,
      );
      return;
    }

    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    ApiResponse.error(
      res,
      'Invalid or expired access token',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.TOKEN_EXPIRED,
    );
  }
};
