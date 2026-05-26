import { Request, Response } from 'express';
import { catchAsync } from '../../../../utils/catchAsync.js';
import { TrackingService } from '../services/tracking.service.js';
import {
  watchEpisodeSchema,
  updateWatchLogSchema,
  watchlistToggleSchema,
  idParamSchema,
  paginationQuerySchema,
} from '../schemas/tracking.schema.js';

export const watchEpisode = catchAsync(async (req: Request, res: Response) => {
  const { episode_id, watched_at } = watchEpisodeSchema.parse(req.body);
  const userId = req.user!.id; // Route is protected

  const data = await TrackingService.watchEpisode(userId, episode_id, watched_at);

  return res.status(201).json({
    status: 'success',
    message: 'Episode successfully logged in your diary',
    data,
  });
});

export const unwatchEpisode = catchAsync(async (req: Request, res: Response) => {
  const logId = idParamSchema.parse(req.params.logId);
  const userId = req.user!.id;

  await TrackingService.unwatchEpisode(userId, logId);

  return res.status(200).json({
    status: 'success',
    message: 'Diary log entry removed successfully.',
  });
});

export const getUserWatchLog = catchAsync(async (req: Request, res: Response) => {
  const { page, limit } = paginationQuerySchema.parse(req.query);
  const userId = req.user!.id;

  const result = await TrackingService.getUserWatchLog(userId, page, limit);

  return res.status(200).json({
    status: 'success',
    ...result,
  });
});

export const getMyStats = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const data = await TrackingService.getUserStats(userId);

  return res.status(200).json({
    status: 'success',
    data,
  });
});

export const toggleWatchlist = catchAsync(async (req: Request, res: Response) => {
  const { series_id } = watchlistToggleSchema.parse(req.body);
  const userId = req.user!.id;

  const data = await TrackingService.toggleWatchlist(userId, series_id);

  return res.status(200).json({
    status: 'success',
    data,
  });
});

export const getUserWatchlist = catchAsync(async (req: Request, res: Response) => {
  const { page, limit } = paginationQuerySchema.parse(req.query);
  const userId = req.user!.id;

  const result = await TrackingService.getUserWatchlist(userId, page, limit);

  return res.status(200).json({
    status: 'success',
    ...result,
  });
});

export const removeFromWatchlist = catchAsync(async (req: Request, res: Response) => {
  const seriesId = idParamSchema.parse(req.params.seriesId);
  const userId = req.user!.id;

  await TrackingService.removeFromWatchlist(userId, seriesId);

  return res.status(200).json({
    status: 'success',
    message: 'Series removed from watchlist successfully.',
  });
});

export const updateWatchLog = catchAsync(async (req: Request, res: Response) => {
  const logId = idParamSchema.parse(req.params.logId);
  const { watched_at, is_rewatch } = updateWatchLogSchema.parse(req.body);
  const userId = req.user!.id;

  const data = await TrackingService.updateWatchLog(userId, logId, watched_at, is_rewatch);

  return res.status(200).json({
    status: 'success',
    message: 'Diary entry updated successfully',
    data,
  });
});
