import { prisma } from '../../../config/database.js';
import { ListItemPayload, ListPayload } from '../types/social.types.js';

export class SocialRepository {
  static async findUserById(userId: string) {
    return prisma.user.findUnique({ where: { id: userId } });
  }

  static async findFollow(followerId: string, followingId: string) {
    return prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });
  }

  static async createFollow(followerId: string, followingId: string) {
    return prisma.follow.create({
      data: { followerId, followingId },
    });
  }

  static async deleteFollow(followerId: string, followingId: string) {
    return prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });
  }

  static async findReviewById(reviewId: string) {
    return prisma.review.findUnique({ where: { id: reviewId } });
  }

  static async findLike(userId: string, reviewId: string) {
    return prisma.like.findUnique({
      where: {
        userId_reviewId: {
          userId,
          reviewId,
        },
      },
    });
  }

  static async createLike(userId: string, reviewId: string) {
    return prisma.like.create({
      data: { userId, reviewId },
    });
  }

  static async deleteLike(userId: string, reviewId: string) {
    return prisma.like.delete({
      where: {
        userId_reviewId: {
          userId,
          reviewId,
        },
      },
    });
  }

  static async findFollowingIds(userId: string) {
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    return following.map((f) => f.followingId);
  }

  static async findWatchLogsByIds(ids: string[]) {
    return prisma.userEpisodeProgress.findMany({
      where: { id: { in: ids } },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        series: { select: { id: true, title: true } },
        episode: {
          select: {
            seasonId: true,
            episodeNumber: true,
            title: true,
            season: { select: { seasonNumber: true } },
          },
        },
      },
    });
  }

  static async findReviewsByIds(ids: string[]) {
    return prisma.review.findMany({
      where: { id: { in: ids } },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        series: { select: { id: true, title: true } },
      },
    });
  }

  static async findWatchLogsByUserIds(userIds: string[], take: number) {
    return prisma.userEpisodeProgress.findMany({
      where: { userId: { in: userIds } },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        series: { select: { id: true, title: true } },
        episode: {
          select: {
            seasonId: true,
            episodeNumber: true,
            title: true,
            season: { select: { seasonNumber: true } },
          },
        },
      },
    });
  }

  static async findReviewsByUserIds(userIds: string[], take: number) {
    return prisma.review.findMany({
      where: { userId: { in: userIds } },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        series: { select: { id: true, title: true } },
      },
    });
  }

  static async createList(userId: string, payload: ListPayload) {
    return prisma.list.create({
      data: {
        userId,
        name: payload.name,
        description: payload.description,
        isPrivate: payload.is_private,
      },
    });
  }

  static async findListById(listId: string) {
    return prisma.list.findUnique({ where: { id: listId } });
  }

  static async updateListItemsTransaction(listId: string, items: ListItemPayload[]) {
    return prisma.$transaction(async (tx) => {
      await tx.listItem.deleteMany({
        where: { listId },
      });

      if (items && items.length > 0) {
        const insertData = items.map((item) => ({
          listId,
          seriesId: item.series_id,
          position: item.position,
        }));
        await tx.listItem.createMany({
          data: insertData,
        });
      }
    });
  }
}
