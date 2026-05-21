import { Response } from 'express';
import { HttpStatusCode, HttpStatus } from '../constants/httpStatus.js';

interface SuccessResponse<T> {
  status: 'success';
  message?: string;
  data?: T;
}

interface ErrorResponse {
  status: 'error';
  message: string;
  code?: string;
  errors?: unknown;
}

export class ApiResponse {
  static success<T>(
    res: Response,
    data?: T,
    message?: string,
    statusCode: HttpStatusCode = HttpStatus.OK,
  ) {
    const payload: SuccessResponse<T> = { status: 'success' };

    if (message) payload.message = message;
    if (data !== undefined) payload.data = data;

    return res.status(statusCode).json(payload);
  }

  static error(
    res: Response,
    message: string,
    statusCode: HttpStatusCode = HttpStatus.INTERNAL_SERVER_ERROR,
    code?: string,
    errors?: unknown,
  ) {
    const payload: ErrorResponse = { status: 'error', message };

    if (code) payload.code = code;
    if (errors) payload.errors = errors;

    return res.status(statusCode).json(payload);
  }
}
