import {
  UpdateProgressData,
  CreateReviewInput,
  UpdateReviewInput,
} from '../types/activity.types.js';
import { ActivityRepository } from '../repositories/activity.repository.js';
import { redis } from '../../../config/redis.js';
import { AppError } from '../../../middlewares/errorHandler.js';
import { HttpStatus } from '../../../constants/httpStatus.js';
import { ErrorCodes } from '../../../constants/errorCodes.js';
import { logger } from '../../../config/logger.js';

export class ActivityService {
  // Logs an episode as watched, creating or updating the progress, and updates user stats.
  static async watchEpisode(userId: string, episodeId: string, watchedAtInput?: string) {
    const episode = await ActivityRepository.findEpisodeDetails(episodeId);

    if (!episode) {
      throw new AppError('Episode not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    const watchedAt = watchedAtInput ? new Date(watchedAtInput) : new Date();

    // Check if progress already exists to determine if it's a rewatch
    const existingProgress = await ActivityRepository.findProgressByUserAndEpisode(
      userId,
      episodeId,
    );

    let progress;
    const isRewatch = !!existingProgress;

    if (existingProgress) {
      progress = await ActivityRepository.updateProgress(existingProgress.id, {
        rewatchCount: { increment: 1 },
        watchedAt,
      });
    } else {
      progress = await ActivityRepository.createProgress({
        userId,
        episodeId,
        seasonId: episode.seasonId,
        seriesId: episode.season.seriesId,
        watchedAt,
        isWatched: true,
      });
    }

    // Update Redis stats in background
    this._updateWatchStats(userId, episode.runtime, watchedAt).catch((err) => {
      logger.error({ err, userId }, 'Failed to update user watch stats in background');
    });

    return {
      log_id: progress.id,
      episode_id: progress.episodeId,
      is_rewatch: isRewatch,
      watched_at: progress.watchedAt,
    };
  }

  // Deletes a watch log (progress) and decrements stats.
  static async unwatchEpisode(userId: string, logId: string) {
    const progress = await ActivityRepository.findProgressByIdWithRuntime(logId);

    if (!progress) {
      throw new AppError('Watch log not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    if (progress.userId !== userId) {
      throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }

    await ActivityRepository.deleteProgress(logId);

    // Decrement stats in background
    this._decrementWatchStats(userId, progress.episode.runtime, progress.watchedAt).catch((err) => {
      logger.error({ err, userId }, 'Failed to decrement user watch stats in background');
    });

    return true;
  }

  // Gets user stats from Redis
  static async getUserStats(userId: string) {
    const totalMinutes = await redis.get(`user:stats:${userId}:total_minutes`);
    const dailyCountsStr = await redis.hgetall(`user:stats:${userId}:daily_counts`);
    const currentStreak = await redis.get(`user:streak:${userId}`);

    const todayStr = new Date().toISOString().split('T')[0];
    const todayCount = dailyCountsStr[todayStr] ? parseInt(dailyCountsStr[todayStr], 10) : 0;

    // Sum all values in dailyCounts to get total episodes
    let totalEpisodes = 0;
    for (const count of Object.values(dailyCountsStr)) {
      totalEpisodes += parseInt(count, 10);
    }

    return {
      user_id: userId,
      total_minutes_watched: totalMinutes ? parseInt(totalMinutes, 10) : 0,
      total_episodes_count: totalEpisodes,
      current_streak_days: currentStreak ? parseInt(currentStreak, 10) : 0,
      episodes_watched_today: todayCount,
    };
  }

  // Toggles a series in the user's watchlist
  static async toggleWatchlist(userId: string, seriesId: string) {
    const existing = await ActivityRepository.findWatchlistEntry(userId, seriesId);

    if (existing) {
      await ActivityRepository.deleteWatchlistEntry(userId, seriesId);
      return { action: 'removed', series_id: seriesId };
    } else {
      await ActivityRepository.createWatchlistEntry(userId, seriesId);
      return { action: 'added', series_id: seriesId };
    }
  }

  // --- Watch Log and Reviews additions ---

  static async getUserWatchLog(userId: string, page: number, limit: number) {
    const total = await ActivityRepository.countUserWatchLog(userId);
    const logs = await ActivityRepository.findUserWatchLog(userId, page, limit);

    return {
      data: logs.map((log) => ({
        log_id: log.id,
        episode_id: log.episodeId,
        series_title: log.episode.season.series.title,
        season_number: log.episode.season.seasonNumber,
        episode_number: log.episode.episodeNumber,
        episode_title: log.episode.title,
        watched_at: log.watchedAt,
        is_rewatch: log.rewatchCount > 0,
        rewatch_count: log.rewatchCount,
      })),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  static async getSeriesReviews(seriesId: string, page: number, limit: number) {
    const total = await ActivityRepository.countReviewsBySeries(seriesId);
    const reviews = await ActivityRepository.findReviewsBySeries(seriesId, page, limit);

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

  static async updateWatchLog(
    userId: string,
    logId: string,
    watchedAtInput?: string,
    isRewatch?: boolean,
  ) {
    const progress = await ActivityRepository.findProgressById(logId);

    if (!progress) {
      throw new AppError('Watch log not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }
    if (progress.userId !== userId) {
      throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }

    const updates: UpdateProgressData = {};
    if (watchedAtInput) updates.watchedAt = new Date(watchedAtInput);
    if (isRewatch !== undefined)
      updates.rewatchCount = isRewatch ? Math.max(progress.rewatchCount, 1) : 0;

    const updated = await ActivityRepository.updateProgress(logId, updates);

    return {
      log_id: updated.id,
      is_rewatch: updated.rewatchCount > 0,
      watched_at: updated.watchedAt,
    };
  }

  static async createReview(userId: string, data: CreateReviewInput) {
    const review = await ActivityRepository.createReview({
      userId,
      seriesId: data.series_id,
      seasonId: data.season_id,
      rating: data.rating,
      content: data.content,
      containsSpoilers: data.contains_spoilers,
    });

    return {
      review_id: review.id,
      rating: Number(review.rating),
      contains_spoilers: review.containsSpoilers,
      created_at: review.createdAt,
    };
  }

  static async updateReview(userId: string, reviewId: string, data: UpdateReviewInput) {
    const existing = await ActivityRepository.findReviewById(reviewId);
    if (!existing)
      throw new AppError('Review not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    if (existing.userId !== userId)
      throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);

    const review = await ActivityRepository.updateReview(reviewId, {
      rating: data.rating,
      content: data.content,
      containsSpoilers: data.contains_spoilers,
    });

    return {
      review_id: review.id,
      rating: Number(review.rating),
      contains_spoilers: review.containsSpoilers,
      updated_at: review.updatedAt,
    };
  }

  static async deleteReview(userId: string, reviewId: string) {
    const existing = await ActivityRepository.findReviewById(reviewId);
    if (!existing)
      throw new AppError('Review not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    if (existing.userId !== userId)
      throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);

    await ActivityRepository.deleteReview(reviewId);
    return true;
  }

  // --- Background Stats Helpers ---

  private static async _updateWatchStats(userId: string, runtime: number, watchedAt: Date) {
    const dateStr = watchedAt.toISOString().split('T')[0];
    const yesterday = new Date(watchedAt);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Pipeline for atomic updates
    const pipeline = redis.pipeline();
    pipeline.incrby(`user:stats:${userId}:total_minutes`, runtime);
    pipeline.hincrby(`user:stats:${userId}:daily_counts`, dateStr, 1);
    await pipeline.exec();

    // Streak calculation
    const todayCountStr = await redis.hget(`user:stats:${userId}:daily_counts`, dateStr);
    const todayCount = parseInt(todayCountStr || '0', 10);

    if (todayCount === 1) {
      // First episode today! Check if watched yesterday to continue streak
      const yesterdayCountStr = await redis.hget(`user:stats:${userId}:daily_counts`, yesterdayStr);
      const yesterdayCount = parseInt(yesterdayCountStr || '0', 10);

      if (yesterdayCount > 0) {
        await redis.incr(`user:streak:${userId}`);
      } else {
        await redis.set(`user:streak:${userId}`, 1);
      }
    }
  }

  private static async _decrementWatchStats(userId: string, runtime: number, watchedAt: Date) {
    const dateStr = watchedAt.toISOString().split('T')[0];

    const pipeline = redis.pipeline();
    pipeline.decrby(`user:stats:${userId}:total_minutes`, runtime);
    pipeline.hincrby(`user:stats:${userId}:daily_counts`, dateStr, -1);
    await pipeline.exec();
  }
}
