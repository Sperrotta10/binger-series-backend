import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod/v4';
import { logger } from '../config/logger.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { HttpStatus, HttpStatusCode } from '../constants/httpStatus.js';
import { ErrorCodes } from '../constants/errorCodes.js';

// Custom Error Class to throw operational errors from services
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errorCode?: string;

  constructor(message: string, statusCode: number, errorCode?: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction) => {
  // 1. Zod Validation Errors
  if (err instanceof ZodError) {
    const formattedErrors = err.issues.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    logger.warn({ path: req.path, errors: formattedErrors }, 'Validation error');
    return ApiResponse.error(
      res,
      'Validation failed',
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
      formattedErrors,
    );
  }

  // 2. Custom App Operational Errors
  if (err instanceof AppError && err.isOperational) {
    logger.warn(
      { path: req.path, statusCode: err.statusCode, message: err.message },
      'Operational error',
    );
    return ApiResponse.error(res, err.message, err.statusCode as HttpStatusCode, err.errorCode);
  }

  // 3. Prisma Errors (Simplified generic catch, can be expanded later)
  if (err.name === 'PrismaClientKnownRequestError') {
    logger.error({ err }, 'Database error');
    return ApiResponse.error(
      res,
      'Database operation failed',
      HttpStatus.BAD_REQUEST,
      ErrorCodes.CONFLICT,
    );
  }

  // 4. Unexpected Programming Errors
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled Exception');
  return ApiResponse.error(
    res,
    'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
    ErrorCodes.INTERNAL_ERROR,
  );
};
