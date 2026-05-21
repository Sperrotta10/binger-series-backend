import { Request, Response } from 'express';
import { ApiResponse } from '../utils/apiResponse.js';
import { HttpStatus } from '../constants/httpStatus.js';
import { ErrorCodes } from '../constants/errorCodes.js';

export const notFoundHandler = (req: Request, res: Response) => {
  return ApiResponse.error(
    res,
    `Route ${req.method} ${req.originalUrl} not found`,
    HttpStatus.NOT_FOUND,
    ErrorCodes.NOT_FOUND,
  );
};
