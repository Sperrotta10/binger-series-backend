import { ReviewsRepository } from '../repositories/reviews.repository.js';
import { AppError } from '../../../../middlewares/errorHandler.js';
import { HttpStatus } from '../../../../constants/httpStatus.js';
import { ErrorCodes } from '../../../../constants/errorCodes.js';
import { Prisma } from '@prisma/client';
import {
  CreateSeriesReviewInput,
  CreateSeasonReviewInput,
  CreateEpisodeReviewInput,
  UpdateReviewInput,
} from '../types/reviews.types.js';

export class ReviewsService {
  static async createSeriesReview(userId: string, data: CreateSeriesReviewInput) {
    const existing = await ReviewsRepository.findExistingSeriesReview(userId, data.series_id);
    if (existing) {
      throw new AppError(
        'You already have a review for this series.',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.BAD_REQUEST,
      );
    }
    const review = await ReviewsRepository.createSeriesReview({
      userId,
      seriesId: data.series_id,
      rating: data.rating,
      content: data.content,
      containsSpoilers: data.contains_spoilers,
      scope: data.scope ?? 'SHOW',
    });
    return review;
  }

  static async createSeasonReview(userId: string, data: CreateSeasonReviewInput) {
    const existing = await ReviewsRepository.findExistingSeasonReview(
      userId,
      data.series_id,
      data.season_id,
    );
    if (existing) {
      throw new AppError(
        'You already have a review for this season.',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.BAD_REQUEST,
      );
    }
    const review = await ReviewsRepository.createSeasonReview({
      userId,
      seriesId: data.series_id,
      seasonId: data.season_id,
      seasonNumber: data.season_number,
      rating: data.rating,
      content: data.content,
      containsSpoilers: data.contains_spoilers,
      scope: data.scope ?? 'SEASON',
    });
    return review;
  }

  static async createEpisodeReview(userId: string, data: CreateEpisodeReviewInput) {
    const existing = await ReviewsRepository.findExistingEpisodeReview(
      userId,
      data.series_id,
      data.season_id,
      data.episode_id,
    );
    if (existing) {
      throw new AppError(
        'You already have a review for this episode.',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.BAD_REQUEST,
      );
    }

    const progress = await ReviewsRepository.findEpisodeProgress(userId, data.episode_id);

    const review = await ReviewsRepository.createEpisodeReview({
      userId,
      seriesId: data.series_id,
      seasonId: data.season_id,
      episodeId: data.episode_id,
      seasonNumber: data.season_number,
      episodeNumber: data.episode_number,
      episodeProgressId: progress ? progress.id : null,
      rating: data.rating,
      content: data.content,
      containsSpoilers: data.contains_spoilers,
      scope: data.scope ?? 'EPISODE',
    });
    return review;
  }

  static async updateReview(userId: string, reviewId: string, data: UpdateReviewInput) {
    const existing = await ReviewsRepository.findReviewById(reviewId);
    if (!existing)
      throw new AppError('Review not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    if (existing.userId !== userId)
      throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);

    return await ReviewsRepository.updateReview(reviewId, {
      rating: data.rating,
      content: data.content,
      containsSpoilers: data.contains_spoilers,
    });
  }

  static async deleteReview(userId: string, reviewId: string) {
    const existing = await ReviewsRepository.findReviewById(reviewId);
    if (!existing)
      throw new AppError('Review not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    if (existing.userId !== userId)
      throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);

    await ReviewsRepository.deleteReview(reviewId);
    return true;
  }

  static async getReviews(where: Prisma.ReviewWhereInput, page: number, limit: number) {
    const total = await ReviewsRepository.countReviews(where);
    const reviews = await ReviewsRepository.findReviews(where, page, limit);

    return {
      data: reviews.map((review) => ({
        review_id: review.id,
        user: {
          id: review.user.id,
          username: review.user.username,
          profile_image: review.user.avatarUrl,
        },
        rating: Number(review.rating),
        content: review.content,
        contains_spoilers: review.containsSpoilers,
        scope: review.scope,
        season_number: review.seasonNumber,
        episode_number: review.episodeNumber,
        created_at: review.createdAt,
        updated_at: review.updatedAt,
      })),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }
}
