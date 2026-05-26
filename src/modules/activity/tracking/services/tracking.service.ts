import { UpdateProgressData } from '../types/tracking.types.js';
import { TrackingRepository } from '../repositories/tracking.repository.js';
import { redis } from '../../../../config/redis.js';
import { AppError } from '../../../../middlewares/errorHandler.js';
import { HttpStatus } from '../../../../constants/httpStatus.js';
import { ErrorCodes } from '../../../../constants/errorCodes.js';
import { logger } from '../../../../config/logger.js';

export class TrackingService {
  static async watchEpisode(userId: string, episodeId: string, watchedAtInput?: string) {
    const episode = await TrackingRepository.findEpisodeDetails(episodeId);

    if (!episode) {
      throw new AppError('Episode not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    const watchedAt = watchedAtInput ? new Date(watchedAtInput) : new Date();

    const existingProgress = await TrackingRepository.findProgressByUserAndEpisode(
      userId,
      episodeId,
    );

    let progress;
    const isRewatch = !!existingProgress;

    if (existingProgress) {
      progress = await TrackingRepository.updateProgress(existingProgress.id, {
        rewatchCount: { increment: 1 },
        watchedAt,
      });
    } else {
      progress = await TrackingRepository.createProgress({
        userId,
        episodeId,
        seasonId: episode.seasonId,
        seriesId: episode.season.seriesId,
        watchedAt,
        isWatched: true,
      });
    }

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

  static async unwatchEpisode(userId: string, logId: string) {
    const progress = await TrackingRepository.findProgressByIdWithRuntime(logId);

    if (!progress) {
      throw new AppError('Watch log not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    if (progress.userId !== userId) {
      throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }

    await TrackingRepository.deleteProgress(logId);

    this._decrementWatchStats(userId, progress.episode.runtime, progress.watchedAt).catch((err) => {
      logger.error({ err, userId }, 'Failed to decrement user watch stats in background');
    });

    return true;
  }

  static async getUserStats(userId: string) {
    const totalMinutes = await redis.get(`user:stats:${userId}:total_minutes`);
    const dailyCountsStr = await redis.hgetall(`user:stats:${userId}:daily_counts`);
    const currentStreak = await redis.get(`user:streak:${userId}`);

    const todayStr = new Date().toISOString().split('T')[0];
    const todayCount = dailyCountsStr[todayStr] ? parseInt(dailyCountsStr[todayStr], 10) : 0;

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

  static async toggleWatchlist(userId: string, seriesId: string) {
    const existing = await TrackingRepository.findWatchlistEntry(userId, seriesId);

    if (existing) {
      await TrackingRepository.deleteWatchlistEntry(userId, seriesId);
      return { action: 'removed', series_id: seriesId };
    } else {
      await TrackingRepository.createWatchlistEntry(userId, seriesId);
      return { action: 'added', series_id: seriesId };
    }
  }

  static async getUserWatchlist(userId: string, page: number, limit: number) {
    const total = await TrackingRepository.countUserWatchlist(userId);
    const watchlist = await TrackingRepository.findUserWatchlist(userId, page, limit);

    return {
      data: watchlist.map((item) => ({
        series: item.series,
        added_at: item.createdAt,
      })),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  static async removeFromWatchlist(userId: string, seriesId: string) {
    const existing = await TrackingRepository.findWatchlistEntry(userId, seriesId);
    if (!existing) {
      throw new AppError('Series not found in watchlist', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }
    await TrackingRepository.deleteWatchlistEntry(userId, seriesId);
    return { action: 'removed', series_id: seriesId };
  }

  static async getUserWatchLog(userId: string, page: number, limit: number) {
    const total = await TrackingRepository.countUserWatchLog(userId);
    const logs = await TrackingRepository.findUserWatchLog(userId, page, limit);

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

  static async updateWatchLog(
    userId: string,
    logId: string,
    watchedAtInput?: string,
    isRewatch?: boolean,
  ) {
    const progress = await TrackingRepository.findProgressById(logId);

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

    const updated = await TrackingRepository.updateProgress(logId, updates);

    return {
      log_id: updated.id,
      is_rewatch: updated.rewatchCount > 0,
      watched_at: updated.watchedAt,
    };
  }

  private static async _updateWatchStats(userId: string, runtime: number, watchedAt: Date) {
    const dateStr = watchedAt.toISOString().split('T')[0];
    const yesterday = new Date(watchedAt);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const pipeline = redis.pipeline();
    pipeline.incrby(`user:stats:${userId}:total_minutes`, runtime);
    pipeline.hincrby(`user:stats:${userId}:daily_counts`, dateStr, 1);
    await pipeline.exec();

    const todayCountStr = await redis.hget(`user:stats:${userId}:daily_counts`, dateStr);
    const todayCount = parseInt(todayCountStr || '0', 10);

    if (todayCount === 1) {
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
