import { Request, Response } from 'express';
import { catchAsync } from '../../../utils/catchAsync.js';
import { ActivityService } from '../services/activity.service.js';
import {
  watchEpisodeSchema,
  updateWatchLogSchema,
  reviewSchema,
  updateReviewSchema,
  watchlistToggleSchema,
  idParamSchema,
} from '../schemas/activity.schema.js';

export const watchEpisode = catchAsync(async (req: Request, res: Response) => {
  const { episode_id, watched_at } = watchEpisodeSchema.parse(req.body);
  const userId = req.user!.id; // Route is protected

  const data = await ActivityService.watchEpisode(userId, episode_id, watched_at);

  return res.status(201).json({
    status: 'success',
    message: 'Episode successfully logged in your diary',
    data,
  });
});

export const unwatchEpisode = catchAsync(async (req: Request, res: Response) => {
  const logId = idParamSchema.parse(req.params.logId);
  const userId = req.user!.id;

  await ActivityService.unwatchEpisode(userId, logId);

  return res.status(200).json({
    status: 'success',
    message: 'Diary log entry removed successfully.',
  });
});

export const getMyStats = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const data = await ActivityService.getUserStats(userId);

  return res.status(200).json({
    status: 'success',
    data,
  });
});

export const createReview = catchAsync(async (req: Request, res: Response) => {
  const data = reviewSchema.parse(req.body);
  const userId = req.user!.id;

  const review = await ActivityService.createReview(userId, data);

  return res.status(201).json({
    status: 'success',
    message: 'Review published successfully',
    data: review,
  });
});

export const updateReview = catchAsync(async (req: Request, res: Response) => {
  const reviewId = idParamSchema.parse(req.params.reviewId);
  const data = updateReviewSchema.parse(req.body);
  const userId = req.user!.id;

  const review = await ActivityService.updateReview(userId, reviewId, data);

  return res.status(200).json({
    status: 'success',
    message: 'Review updated successfully',
    data: review,
  });
});

export const deleteReview = catchAsync(async (req: Request, res: Response) => {
  const reviewId = idParamSchema.parse(req.params.reviewId);
  const userId = req.user!.id;

  await ActivityService.deleteReview(userId, reviewId);

  return res.status(200).json({
    status: 'success',
    message: 'Review deleted successfully. Show metrics are being updated in background.',
  });
});

export const toggleWatchlist = catchAsync(async (req: Request, res: Response) => {
  const { series_id } = watchlistToggleSchema.parse(req.body);
  const userId = req.user!.id;

  const data = await ActivityService.toggleWatchlist(userId, series_id);

  return res.status(200).json({
    status: 'success',
    data,
  });
});

export const updateWatchLog = catchAsync(async (req: Request, res: Response) => {
  const logId = idParamSchema.parse(req.params.logId);
  const { watched_at, is_rewatch } = updateWatchLogSchema.parse(req.body);
  const userId = req.user!.id;

  const data = await ActivityService.updateWatchLog(userId, logId, watched_at, is_rewatch);

  return res.status(200).json({
    status: 'success',
    message: 'Diary entry updated successfully',
    data,
  });
});
