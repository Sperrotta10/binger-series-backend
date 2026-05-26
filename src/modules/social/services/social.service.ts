import { redis } from '../../../config/redis.js';
import { AppError } from '../../../middlewares/errorHandler.js';
import { HttpStatus } from '../../../constants/httpStatus.js';
import { ErrorCodes } from '../../../constants/errorCodes.js';
import { logger } from '../../../config/logger.js';
import { SocialRepository } from '../repositories/social.repository.js';
import {
  FeedPagination,
  ListItemPayload,
  ListPayload,
  ToggleResponse,
} from '../types/social.types.js';

export class SocialService {
  // Follow or Unfollow a user (toggle)
  static async toggleFollow(followerId: string, followingId: string): Promise<ToggleResponse> {
    if (followerId === followingId) {
      throw new AppError(
        'You cannot follow yourself',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.BAD_REQUEST,
      );
    }

    const targetUser = await SocialRepository.findUserById(followingId);
    if (!targetUser) {
      throw new AppError('Target user not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    const existingFollow = await SocialRepository.findFollow(followerId, followingId);

    if (existingFollow) {
      // Unfollow
      await SocialRepository.deleteFollow(followerId, followingId);

      // Background redis counters update
      redis.decr(`user:social:${followerId}:following_count`).catch((err) => {
        logger.error({ err, followerId }, 'Failed to decrement following_count in Redis');
      });
      redis.decr(`user:social:${followingId}:followers_count`).catch((err) => {
        logger.error({ err, followingId }, 'Failed to decrement followers_count in Redis');
      });

      return { action: 'unfollowed', target_user_id: followingId };
    } else {
      // Follow
      await SocialRepository.createFollow(followerId, followingId);

      // Background redis counters update
      redis.incr(`user:social:${followerId}:following_count`).catch((err) => {
        logger.error({ err, followerId }, 'Failed to increment following_count in Redis');
      });
      redis.incr(`user:social:${followingId}:followers_count`).catch((err) => {
        logger.error({ err, followingId }, 'Failed to increment followers_count in Redis');
      });

      return { action: 'followed', target_user_id: followingId };
    }
  }

  // Like or Unlike a review (toggle)
  static async toggleLikeReview(userId: string, reviewId: string): Promise<ToggleResponse> {
    const review = await SocialRepository.findReviewById(reviewId);
    if (!review) {
      throw new AppError('Review not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    const existingLike = await SocialRepository.findLike(userId, reviewId);

    if (existingLike) {
      // Unlike
      await SocialRepository.deleteLike(userId, reviewId);

      redis.decr(`review:${reviewId}:likes`).catch((err) => {
        logger.error({ err, reviewId }, 'Failed to decrement review likes in Redis');
      });

      return { action: 'unliked', review_id: reviewId };
    } else {
      // Like
      await SocialRepository.createLike(userId, reviewId);

      redis
        .incr(`review:${reviewId}:likes`)
        .then(async (likes) => {
          if (likes >= 50) {
            await redis.sadd('community:popular_reviews', reviewId);
          }
        })
        .catch((err) => {
          logger.error({ err, reviewId }, 'Failed to increment review likes in Redis');
        });

      return { action: 'liked', review_id: reviewId };
    }
  }

  /**
   * Get activity feed — Hybrid strategy:
   * - Active users: LRANGE from Redis list (fan-out on write)
   * - Passive users: paginated query from PostgreSQL (fan-out on read)
   */
  static async getFeed(userId: string, pagination: FeedPagination) {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    // 1. Try Redis cache first (active users — fan-out on write)
    const redisKey = `user:feed:${userId}`;
    const cachedIds = await redis.lrange(redisKey, offset, offset + limit - 1);

    if (cachedIds && cachedIds.length > 0) {
      const [watchLogs, reviews] = await Promise.all([
        SocialRepository.findWatchLogsByIds(cachedIds),
        SocialRepository.findReviewsByIds(cachedIds),
      ]);

      const mixedFeed = this._formatMixedFeed(watchLogs, reviews, cachedIds);
      return {
        pagination: { current_page: page, has_next_page: cachedIds.length === limit },
        data: mixedFeed,
      };
    }

    // 2. Fallback: PostgreSQL query (passive users — fan-out on read)
    const followingIds = await SocialRepository.findFollowingIds(userId);

    if (followingIds.length === 0) {
      return {
        pagination: { current_page: page, has_next_page: false },
        data: [],
      };
    }

    // Fetch enough records to sort and paginate manually
    const take = limit * page;
    const [watchLogsDb, reviewsDb] = await Promise.all([
      SocialRepository.findWatchLogsByUserIds(followingIds, take),
      SocialRepository.findReviewsByUserIds(followingIds, take),
    ]);

    const allFormatted = this._formatDbFeed(watchLogsDb, reviewsDb);

    // Global chronological sort
    allFormatted.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    const paginatedFeed = allFormatted.slice(offset, offset + limit);
    const hasNextPage = allFormatted.length > offset + limit;

    return {
      pagination: { current_page: page, has_next_page: hasNextPage },
      data: paginatedFeed,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static _formatMixedFeed(watchLogs: any[], reviews: any[], orderedIds: string[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const logMap = new Map<string, any>(watchLogs.map((l) => [l.id, l]));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reviewMap = new Map<string, any>(reviews.map((r) => [r.id, r]));

    const result = [];
    for (const id of orderedIds) {
      if (logMap.has(id)) {
        result.push(this._formatWatchLog(logMap.get(id)));
      } else if (reviewMap.has(id)) {
        result.push(this._formatReview(reviewMap.get(id)));
      }
    }
    return result;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static _formatDbFeed(watchLogsDb: any[], reviewsDb: any[]) {
    return [
      ...watchLogsDb.map((l) => this._formatWatchLog(l)),
      ...reviewsDb.map((r) => this._formatReview(r)),
    ];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static _formatWatchLog(l: any) {
    return {
      activity_type: 'watch_log',
      id: l.id,
      user: {
        id: l.user.id,
        username: l.user.username,
        avatar_url: l.user.avatarUrl,
      },
      series: {
        id: l.series.id,
        title: l.series.title,
      },
      episode: {
        season_number: l.episode?.season?.seasonNumber ?? 1,
        episode_number: l.episode?.episodeNumber ?? 1,
        title: l.episode?.title ?? 'Unknown',
      },
      is_rewatch: l.rewatchCount > 0,
      created_at: l.createdAt.toISOString(),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static _formatReview(r: any) {
    return {
      activity_type: 'review',
      id: r.id,
      user: {
        id: r.user.id,
        username: r.user.username,
        avatar_url: r.user.avatarUrl,
      },
      series: {
        id: r.series.id,
        title: r.series.title,
      },
      rating: r.rating ? Number(r.rating) : null,
      content: r.content,
      contains_spoilers: r.containsSpoilers,
      likes_count: 0,
      created_at: r.createdAt.toISOString(),
    };
  }

  // Create a new custom list
  static async createList(userId: string, payload: ListPayload) {
    const list = await SocialRepository.createList(userId, payload);

    return {
      list_id: list.id,
      name: list.name,
      is_private: list.isPrivate,
      items_count: 0,
    };
  }

  // Bulk replace all items in a list (atomic transaction — supports Drag & Drop reordering)
  static async updateListItems(userId: string, listId: string, items: ListItemPayload[]) {
    const list = await SocialRepository.findListById(listId);

    if (!list) {
      throw new AppError('List not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    if (list.userId !== userId) {
      throw new AppError(
        'You do not have permission to modify this list',
        HttpStatus.FORBIDDEN,
        ErrorCodes.FORBIDDEN,
      );
    }

    await SocialRepository.updateListItemsTransaction(listId, items);

    return {
      message: 'List items updated and reordered successfully.',
    };
  }
}
