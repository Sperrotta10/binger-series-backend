import { Request, Response } from 'express';
import { catchAsync } from '../../../../utils/catchAsync.js';
import { ReviewsService } from '../services/reviews.service.js';
import {
  seriesReviewSchema,
  seasonReviewSchema,
  episodeReviewSchema,
  updateReviewSchema,
  idParamSchema,
  paginationQuerySchema,
} from '../schemas/reviews.schema.js';

export const createSeriesReview = catchAsync(async (req: Request, res: Response) => {
  const data = seriesReviewSchema.parse(req.body);
  const userId = req.user!.id;

  const review = await ReviewsService.createSeriesReview(userId, data);

  return res.status(201).json({
    status: 'success',
    message: 'Series review published successfully',
    data: review,
  });
});

export const createSeasonReview = catchAsync(async (req: Request, res: Response) => {
  const data = seasonReviewSchema.parse(req.body);
  const userId = req.user!.id;

  const review = await ReviewsService.createSeasonReview(userId, data);

  return res.status(201).json({
    status: 'success',
    message: 'Season review published successfully',
    data: review,
  });
});

export const createEpisodeReview = catchAsync(async (req: Request, res: Response) => {
  const data = episodeReviewSchema.parse(req.body);
  const userId = req.user!.id;

  const review = await ReviewsService.createEpisodeReview(userId, data);

  return res.status(201).json({
    status: 'success',
    message: 'Episode review published successfully',
    data: review,
  });
});

export const updateReview = catchAsync(async (req: Request, res: Response) => {
  const reviewId = idParamSchema.parse(req.params.reviewId);
  const data = updateReviewSchema.parse(req.body);
  const userId = req.user!.id;

  const review = await ReviewsService.updateReview(userId, reviewId, data);

  return res.status(200).json({
    status: 'success',
    message: 'Review updated successfully',
    data: review,
  });
});

export const deleteReview = catchAsync(async (req: Request, res: Response) => {
  const reviewId = idParamSchema.parse(req.params.reviewId);
  const userId = req.user!.id;

  await ReviewsService.deleteReview(userId, reviewId);

  return res.status(200).json({
    status: 'success',
    message: 'Review deleted successfully.',
  });
});

export const getSeriesReviews = catchAsync(async (req: Request, res: Response) => {
  const seriesId = idParamSchema.parse(req.params.seriesId);
  const { page, limit } = paginationQuerySchema.parse(req.query);

  const result = await ReviewsService.getReviews(
    { seriesId, seasonId: null, episodeId: null },
    page,
    limit,
  );

  return res.status(200).json({
    status: 'success',
    ...result,
  });
});

export const getSeasonReviews = catchAsync(async (req: Request, res: Response) => {
  const seriesId = idParamSchema.parse(req.params.seriesId);
  const seasonId = idParamSchema.parse(req.params.seasonId);
  const { page, limit } = paginationQuerySchema.parse(req.query);

  const result = await ReviewsService.getReviews(
    { seriesId, seasonId, episodeId: null },
    page,
    limit,
  );

  return res.status(200).json({
    status: 'success',
    ...result,
  });
});

export const getEpisodeReviews = catchAsync(async (req: Request, res: Response) => {
  const seriesId = idParamSchema.parse(req.params.seriesId);
  const seasonId = idParamSchema.parse(req.params.seasonId);
  const episodeId = idParamSchema.parse(req.params.episodeId);
  const { page, limit } = paginationQuerySchema.parse(req.query);

  const result = await ReviewsService.getReviews({ seriesId, seasonId, episodeId }, page, limit);

  return res.status(200).json({
    status: 'success',
    ...result,
  });
});
