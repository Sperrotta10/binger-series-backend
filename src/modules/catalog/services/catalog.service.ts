import { redis } from '../../../config/redis.js';
import { AppError } from '../../../middlewares/errorHandler.js';
import { HttpStatus } from '../../../constants/httpStatus.js';
import { ErrorCodes } from '../../../constants/errorCodes.js';
import { CatalogRepository } from '../repositories/catalog.repository.js';
import { env } from '../../../config/env.js';
import { optimizeImageUrl, optimizeBackdropUrl } from '../utils/image.util.js';

// Asynchronously triggers the Ingestion Worker module using internal endpoints
function triggerIngestion(apiId: string) {
  const triggerUrl = `${env.CORS_ORIGIN}/api/v1/ingestion/trigger`;
  const secretToken = env.INTERNAL_SECRET;

  fetch(triggerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': secretToken,
    },
    body: JSON.stringify({
      external_source: 'tvmaze',
      external_id: parseInt(apiId, 10),
      series_title: `Show #${apiId}`,
    }),
  }).catch((err) => {
    // Fail silently in catalog context
    console.error(`Failed to trigger ingestion for apiId ${apiId}:`, err.message);
  });
}

export interface SeriesDetailBase {
  id: string;
  title: string;
  summary: string;
  premiered: string | null;
  status: string;
  genres: string[];
  rating_average: number;
  poster_url: string;
  backdrop_url: string;
  total_seasons: number;
}

export class CatalogService {
  static async getSeriesDetail(id: string, userId: string | undefined, hostUrl: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const isNumeric = /^\d+$/.test(id);

    if (!isUuid && !isNumeric) {
      throw new AppError(
        'Invalid series ID format',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    let baseData: SeriesDetailBase | null = null;

    // 1. If it's a UUID, check Redis cache first
    if (isUuid) {
      try {
        const cached = await redis.get(`series:detail:${id}`);
        if (cached) {
          baseData = JSON.parse(cached);
        }
      } catch (err) {
        console.error('Redis read error in getSeriesDetail:', err);
      }
    }

    // 2. If Cache Miss or numeric TVmaze ID, query the database
    if (!baseData) {
      let series = null;
      if (isUuid) {
        series = await CatalogRepository.findSeriesById(id);
      } else {
        series = await CatalogRepository.findSeriesByApiId(id);
      }

      // Edge logic: Series not registered locally
      if (!series) {
        if (isNumeric) {
          // Asynchronously trigger ingestion for this TVmaze show
          triggerIngestion(id);
        }
        throw new AppError('Series not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
      }

      // If we queried by TVmaze ID, we might have baseData in cache under its local UUID. Let's check:
      if (!isUuid) {
        try {
          const cached = await redis.get(`series:detail:${series.id}`);
          if (cached) {
            baseData = JSON.parse(cached);
          }
        } catch (err) {
          console.error('Redis read error in getSeriesDetail:', err);
        }
      }

      // Construct and cache if still not loaded
      if (!baseData) {
        const totalSeasons = series.seasons.length;
        const ratingSum = series.reviews.reduce(
          (sum, r) => sum + (r.rating ? Number(r.rating) : 0),
          0,
        );
        const ratingAverage = series.reviews.length
          ? Number((ratingSum / series.reviews.length).toFixed(1))
          : 0.0;

        baseData = {
          id: series.id,
          title: series.title,
          summary: series.overview || '',
          premiered: series.firstAirDate ? series.firstAirDate.toISOString().split('T')[0] : null,
          status: series.status || 'Unknown',
          genres: series.genres || [],
          rating_average: ratingAverage,
          poster_url: optimizeImageUrl(series.posterUrl, 'original', hostUrl),
          backdrop_url: optimizeBackdropUrl(series.backdropUrl, hostUrl),
          total_seasons: totalSeasons,
        };

        try {
          await redis.set(`series:detail:${series.id}`, JSON.stringify(baseData), 'EX', 86400); // 24 hours TTL
        } catch (err) {
          console.error('Redis write error in getSeriesDetail:', err);
        }
      }
    }

    // 3. Inject user-specific dynamic data (watchlist status)
    let inWatchlist = false;
    if (userId) {
      const watchlistEntry = await CatalogRepository.findWatchlistEntry(userId, baseData.id);
      inWatchlist = !!watchlistEntry;
    }

    return {
      ...baseData,
      in_watchlist: inWatchlist,
    };
  }

  static async getSeriesSeasons(seriesId: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seriesId);
    let resolvedSeriesId = seriesId;

    if (!isUuid) {
      // If it is a TVmaze ID, we first find the local series
      if (/^\d+$/.test(seriesId)) {
        const series = await CatalogRepository.findSeriesByApiId(seriesId);
        if (!series) {
          throw new AppError('Series not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
        }
        resolvedSeriesId = series.id;
      } else {
        throw new AppError(
          'Invalid series ID format',
          HttpStatus.BAD_REQUEST,
          ErrorCodes.VALIDATION_ERROR,
        );
      }
    } else {
      // Validate that the series actually exists
      const series = await CatalogRepository.findSeriesById(seriesId);
      if (!series) {
        throw new AppError('Series not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
      }
    }

    const seasons = await CatalogRepository.findSeasonsBySeriesId(resolvedSeriesId);

    return seasons.map((s) => ({
      id: s.id,
      number: s.seasonNumber,
      episode_count: s.episodeCount ?? s.episodes.length,
      premiere_date: s.airDate ? s.airDate.toISOString().split('T')[0] : null,
    }));
  }

  static async getSeasonEpisodes(seasonId: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seasonId);
    if (!isUuid) {
      throw new AppError(
        'Invalid season ID format',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    const episodes = await CatalogRepository.findEpisodesBySeasonId(seasonId);

    return episodes.map((e) => ({
      id: e.id,
      number: e.episodeNumber,
      title: e.title,
      runtime: e.runtime,
      airdate: e.airDate ? e.airDate.toISOString().split('T')[0] : null,
      summary: e.overview || '',
    }));
  }

  static async searchSeries(
    q: string,
    genre: string | undefined,
    year: string | undefined,
    hostUrl: string,
  ) {
    if (!q || q.trim() === '') {
      throw new AppError(
        'Search query parameter q is required',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    const normalizedQ = q.toLowerCase().trim();
    const normalizedGenre = genre ? genre.toLowerCase().trim() : '';
    const normalizedYear = year ? year.trim() : '';

    // Cache key: search:q:query:g:genre:y:year
    const cacheKey = `search:q:${normalizedQ}:g:${normalizedGenre}:y:${normalizedYear}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.error('Redis read error in searchSeries:', err);
    }

    const parsedYear = normalizedYear ? parseInt(normalizedYear, 10) : undefined;
    const results = await CatalogRepository.searchSeries(q, genre, parsedYear);

    const mappedResults = results.map((series) => {
      const ratingSum = series.reviews.reduce(
        (sum, r) => sum + (r.rating ? Number(r.rating) : 0),
        0,
      );
      const ratingAverage = series.reviews.length
        ? Number((ratingSum / series.reviews.length).toFixed(1))
        : 0.0;

      return {
        id: series.id,
        title: series.title,
        premiered: series.firstAirDate ? series.firstAirDate.toISOString().split('T')[0] : null,
        poster_url: optimizeImageUrl(series.posterUrl, 'medium', hostUrl),
        rating_average: ratingAverage,
      };
    });

    try {
      await redis.set(cacheKey, JSON.stringify(mappedResults), 'EX', 1800); // 30 minutes cache TTL
    } catch (err) {
      console.error('Redis write error in searchSeries:', err);
    }

    return mappedResults;
  }

  static async getTrendingSeries(hostUrl: string) {
    let trendingIdsWithScores: string[] = [];
    try {
      // Fetch top 20 IDs with view counts from Redis
      trendingIdsWithScores = await redis.zrevrange('series:popular:week', 0, 19, 'WITHSCORES');
    } catch (err) {
      console.error('Redis zrevrange error in getTrendingSeries:', err);
    }

    const trending: { id: string; views: number }[] = [];
    for (let i = 0; i < trendingIdsWithScores.length; i += 2) {
      trending.push({
        id: trendingIdsWithScores[i],
        views: parseInt(trendingIdsWithScores[i + 1], 10) || 0,
      });
    }

    const ids = trending.map((t) => t.id);
    let seriesList: Awaited<ReturnType<typeof CatalogRepository.findManyByIds>> = [];
    if (ids.length > 0) {
      seriesList = await CatalogRepository.findManyByIds(ids);
    }

    const seriesMap = new Map(seriesList.map((s) => [s.id, s]));
    const orderedData = trending
      .map((t) => {
        const series = seriesMap.get(t.id);
        if (!series) return null;
        const ratingSum = series.reviews.reduce(
          (sum, r) => sum + (r.rating ? Number(r.rating) : 0),
          0,
        );
        const ratingAverage = series.reviews.length
          ? Number((ratingSum / series.reviews.length).toFixed(1))
          : 0.0;

        return {
          id: series.id,
          title: series.title,
          poster_url: optimizeImageUrl(series.posterUrl, 'medium', hostUrl),
          rating_average: ratingAverage,
          weekly_views_count: t.views,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    // Fallback: If Redis is empty or contains fewer than 20 items, fill the rest with latest series from DB
    if (orderedData.length < 20) {
      const excludedIds = orderedData.map((d) => d.id);
      const fallbackCount = 20 - orderedData.length;
      const fallbackSeries = await CatalogRepository.findLatestSeries(excludedIds, fallbackCount);

      for (const series of fallbackSeries) {
        const ratingSum = series.reviews.reduce(
          (sum, r) => sum + (r.rating ? Number(r.rating) : 0),
          0,
        );
        const ratingAverage = series.reviews.length
          ? Number((ratingSum / series.reviews.length).toFixed(1))
          : 0.0;

        orderedData.push({
          id: series.id,
          title: series.title,
          poster_url: optimizeImageUrl(series.posterUrl, 'medium', hostUrl),
          rating_average: ratingAverage,
          weekly_views_count: 0,
        });
      }
    }

    return orderedData;
  }
}
