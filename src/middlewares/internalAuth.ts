import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { AppError } from './errorHandler.js';
import { HttpStatus } from '../constants/httpStatus.js';

export function internalAuth(req: Request, _res: Response, next: NextFunction): void {
  const secret = req.headers['x-internal-secret'];

  if (!secret || secret !== env.INTERNAL_SECRET) {
    throw new AppError('Unauthorized internal request', HttpStatus.UNAUTHORIZED);
  }

  next();
}
