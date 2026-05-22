import { PrismaClient } from '@prisma/client';
import { logger } from '../../../config/logger.js';
import { fetchFromTvmaze } from '../utils/tvmaze.client.js';
import {
  mapTvmazeShowToPrisma,
  mapTvmazeSeasonToPrisma,
  mapTvmazeEpisodeToPrisma,
} from '../utils/mapper.js';
import { TvmazeShow, TvmazeSeason, TvmazeEpisode } from '../types/tvmaze.types.js';

const prisma = new PrismaClient();

export class ProcessorService {
  // Processes the import of a single series by its TVmaze ID.
  // Downloads data and persists it in a database transaction.
  static async processSeriesImport(externalId: number): Promise<void> {
    logger.info(`[ProcessorService] Starting import for TVmaze ID ${externalId}`);

    // 1. Fetch data from TVmaze
    const endpoint = `/shows/${externalId}?embed[]=seasons&embed[]=episodes`;
    const tvmazeData = await fetchFromTvmaze<TvmazeShow>(endpoint);

    // 2. Map data
    const seriesData = mapTvmazeShowToPrisma(tvmazeData);
    const seasonsData: TvmazeSeason[] = tvmazeData._embedded?.seasons || [];
    const episodesData: TvmazeEpisode[] = tvmazeData._embedded?.episodes || [];

    // 3. Database Transaction
    await prisma.$transaction(async (tx) => {
      // 3a. Upsert Series
      const series = await tx.series.upsert({
        where: { apiId: seriesData.apiId },
        create: seriesData,
        update: seriesData,
      });

      // 3b. Upsert Seasons
      const seasonIdMap = new Map<number, string>(); // TVmaze Season ID -> Internal Season ID

      for (const s of seasonsData) {
        const mappedSeason = mapTvmazeSeasonToPrisma(s, series.id);

        const upsertedSeason = await tx.season.upsert({
          where: {
            seriesId_seasonNumber: {
              seriesId: series.id,
              seasonNumber: mappedSeason.seasonNumber,
            },
          },
          create: mappedSeason,
          update: mappedSeason,
        });

        seasonIdMap.set(s.id, upsertedSeason.id);
      }

      // 3c. Upsert Episodes
      for (const e of episodesData) {
        const internalSeasonId = seasonIdMap.get(e.season);
        if (!internalSeasonId) {
          logger.warn(
            `[ProcessorService] Skipping episode ${e.id} because season ${e.season} is missing.`,
          );
          continue;
        }

        const mappedEpisode = mapTvmazeEpisodeToPrisma(e, internalSeasonId);

        await tx.episode.upsert({
          where: {
            seasonId_episodeNumber: {
              seasonId: internalSeasonId,
              episodeNumber: mappedEpisode.episodeNumber,
            },
          },
          create: mappedEpisode,
          update: mappedEpisode,
        });
      }
    });

    logger.info(`[ProcessorService] Successfully imported TVmaze ID ${externalId}`);
  }
}
