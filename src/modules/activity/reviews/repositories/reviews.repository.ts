import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database.js';
import {
  CreateSeriesReviewData,
  CreateSeasonReviewData,
  CreateEpisodeReviewData,
  UpdateReviewData,
} from '../types/reviews.types.js';

export class ReviewsRepository {
  // Checks
  static async findEpisodeProgress(userId: string, episodeId: string) {
    return prisma.userEpisodeProgress.findUnique({
      where: { userId_episodeId: { userId, episodeId } },
    });
  }

  static async findExistingSeriesReview(userId: string, seriesId: string) {
    return prisma.review.findFirst({
      where: { userId, seriesId, seasonId: null, episodeId: null },
    });
  }

  static async findExistingSeasonReview(userId: string, seriesId: string, seasonId: string) {
    return prisma.review.findFirst({
      where: { userId, seriesId, seasonId, episodeId: null },
    });
  }

  static async findExistingEpisodeReview(
    userId: string,
    seriesId: string,
    seasonId: string,
    episodeId: string,
  ) {
    return prisma.review.findFirst({
      where: { userId, seriesId, seasonId, episodeId },
    });
  }

  // Creates
  static async createSeriesReview(data: CreateSeriesReviewData) {
    return prisma.review.create({ data });
  }

  static async createSeasonReview(data: CreateSeasonReviewData) {
    return prisma.review.create({ data });
  }

  static async createEpisodeReview(data: CreateEpisodeReviewData) {
    return prisma.review.create({ data });
  }

  // Shared
  static async findReviewById(reviewId: string) {
    return prisma.review.findUnique({
      where: { id: reviewId },
    });
  }

  static async updateReview(reviewId: string, data: UpdateReviewData) {
    return prisma.review.update({
      where: { id: reviewId },
      data,
    });
  }

  static async deleteReview(reviewId: string) {
    return prisma.review.delete({
      where: { id: reviewId },
    });
  }

  // Queries
  static async countReviews(where: Prisma.ReviewWhereInput) {
    return prisma.review.count({ where });
  }

  static async findReviews(where: Prisma.ReviewWhereInput, page: number, limit: number) {
    const skip = (page - 1) * limit;
    return prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });
  }
}
