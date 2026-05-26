import { prisma } from '../../../config/database.js';
import {
  CreateProgressData,
  UpdateProgressData,
  CreateReviewData,
  UpdateReviewData,
} from '../types/activity.types.js';

export class ActivityRepository {
  static async findEpisodeDetails(episodeId: string) {
    return prisma.episode.findUnique({
      where: { id: episodeId },
      select: {
        id: true,
        seasonId: true,
        runtime: true,
        season: {
          select: { seriesId: true },
        },
      },
    });
  }

  static async findProgressByUserAndEpisode(userId: string, episodeId: string) {
    return prisma.userEpisodeProgress.findUnique({
      where: {
        userId_episodeId: { userId, episodeId },
      },
    });
  }

  static async createProgress(data: CreateProgressData) {
    return prisma.userEpisodeProgress.create({ data });
  }

  static async updateProgress(progressId: string, data: UpdateProgressData) {
    return prisma.userEpisodeProgress.update({
      where: { id: progressId },
      data,
    });
  }

  static async findProgressByIdWithRuntime(logId: string) {
    return prisma.userEpisodeProgress.findUnique({
      where: { id: logId },
      include: { episode: { select: { runtime: true } } },
    });
  }

  static async findProgressById(logId: string) {
    return prisma.userEpisodeProgress.findUnique({
      where: { id: logId },
    });
  }

  static async deleteProgress(logId: string) {
    return prisma.userEpisodeProgress.delete({
      where: { id: logId },
    });
  }

  static async findWatchlistEntry(userId: string, seriesId: string) {
    return prisma.watchlist.findUnique({
      where: {
        userId_seriesId: { userId, seriesId },
      },
    });
  }

  static async createWatchlistEntry(userId: string, seriesId: string) {
    return prisma.watchlist.create({
      data: { userId, seriesId },
    });
  }

  static async deleteWatchlistEntry(userId: string, seriesId: string) {
    return prisma.watchlist.delete({
      where: { userId_seriesId: { userId, seriesId } },
    });
  }

  static async createReview(data: CreateReviewData) {
    return prisma.review.create({ data });
  }

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

  static async countUserWatchLog(userId: string) {
    return prisma.userEpisodeProgress.count({
      where: { userId },
    });
  }

  static async findUserWatchLog(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    return prisma.userEpisodeProgress.findMany({
      where: { userId },
      orderBy: { watchedAt: 'desc' },
      skip,
      take: limit,
      include: {
        episode: {
          select: {
            title: true,
            episodeNumber: true,
            season: {
              select: {
                seasonNumber: true,
                series: {
                  select: { title: true },
                },
              },
            },
          },
        },
      },
    });
  }

  static async countReviewsBySeries(seriesId: string) {
    return prisma.review.count({
      where: { seriesId },
    });
  }

  static async findReviewsBySeries(seriesId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    return prisma.review.findMany({
      where: { seriesId },
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
