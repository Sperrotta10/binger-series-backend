import { Prisma } from '@prisma/client';
import { prisma } from '../../../config/database.js';

export class CatalogRepository {
  static async findSeriesById(id: string) {
    return prisma.series.findUnique({
      where: { id },
      include: {
        seasons: {
          include: {
            episodes: true,
          },
        },
        reviews: {
          select: {
            rating: true,
          },
        },
      },
    });
  }

  static async findSeriesByApiId(apiId: string) {
    return prisma.series.findUnique({
      where: { apiId },
      include: {
        seasons: {
          include: {
            episodes: true,
          },
        },
        reviews: {
          select: {
            rating: true,
          },
        },
      },
    });
  }

  static async findWatchlistEntry(userId: string, seriesId: string) {
    return prisma.watchlist.findUnique({
      where: {
        userId_seriesId: {
          userId,
          seriesId,
        },
      },
    });
  }

  static async findSeasonsBySeriesId(seriesId: string) {
    return prisma.season.findMany({
      where: { seriesId },
      orderBy: { seasonNumber: 'asc' },
      include: {
        episodes: {
          select: {
            id: true,
          },
        },
      },
    });
  }

  static async findEpisodesBySeasonId(seasonId: string) {
    return prisma.episode.findMany({
      where: { seasonId },
      orderBy: { episodeNumber: 'asc' },
    });
  }

  static async searchSeries(q: string, genre?: string, year?: number) {
    const where: Prisma.SeriesWhereInput = {
      title: {
        contains: q,
        mode: 'insensitive',
      },
    };

    if (genre) {
      // Capitalize first letter of the genre (e.g. "drama" -> "Drama")
      const formattedGenre = genre.charAt(0).toUpperCase() + genre.slice(1).toLowerCase();
      where.genres = {
        has: formattedGenre,
      };
    }

    if (year) {
      where.firstAirDate = {
        gte: new Date(Date.UTC(year, 0, 1)),
        lte: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
      };
    }

    return prisma.series.findMany({
      where,
      include: {
        reviews: {
          select: {
            rating: true,
          },
        },
      },
    });
  }

  static async findManyByIds(ids: string[]) {
    return prisma.series.findMany({
      where: { id: { in: ids } },
      include: {
        reviews: { select: { rating: true } },
      },
    });
  }

  static async findManyByApiIds(apiIds: string[]) {
    return prisma.series.findMany({
      where: { apiId: { in: apiIds } },
      include: {
        reviews: { select: { rating: true } },
      },
    });
  }

  static async countSeries() {
    return prisma.series.count();
  }

  static async findLatestSeries(excludedIds: string[], take: number) {
    return prisma.series.findMany({
      where: { id: { notIn: excludedIds } },
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        reviews: { select: { rating: true } },
      },
    });
  }
}
