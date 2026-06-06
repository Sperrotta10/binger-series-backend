import { Request, Response, NextFunction } from 'express';
import { QueueService } from '../services/queue.service.js';
import { triggerIngestionSchema } from '../schemas/ingestion.schemas.js';
import { HttpStatus } from '../../../constants/httpStatus.js';
import { ApiResponse } from '../../../utils/apiResponse.js';
import { AppError } from '../../../middlewares/errorHandler.js';

export const triggerIngestion = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const payload = triggerIngestionSchema.parse(_req.body);
    const jobId = await QueueService.enqueueSeriesImport(payload);

    ApiResponse.success(
      res,
      {
        job_id: jobId,
        status: 'queued',
        timestamp: Date.now(),
      },
      'Import job successfully enqueued',
      HttpStatus.ACCEPTED,
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Job already in progress') {
      return next(new AppError('Job already in progress', HttpStatus.CONFLICT));
    }
    next(error);
  }
};

export const dailySync = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const affectedShowsCount = await QueueService.runDailySync();

    ApiResponse.success(
      res,
      { affected_shows_found: affectedShowsCount },
      'Daily catalog synchronization triggered',
      HttpStatus.OK,
    );
  } catch (error) {
    next(error);
  }
};
