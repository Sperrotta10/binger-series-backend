import { Queue, JobsOptions } from 'bullmq';
import { env } from '../../../config/env.js';
import { logger } from '../../../config/logger.js';
import { TriggerIngestionPayload } from '../schemas/ingestion.schemas.js';
import { Redis } from 'ioredis';
import { prisma } from '../../../config/database.js';
import { fetchFromTvmaze } from '../utils/tvmaze.client.js';

const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const INGESTION_QUEUE_NAME = 'ingestion-series-import';

export const ingestionQueue = new Queue(INGESTION_QUEUE_NAME, {
  connection,
});

export class QueueService {
  // Enqueues a job for importing a series.
  static async enqueueSeriesImport(payload: TriggerIngestionPayload): Promise<string> {
    // Idempotency Check: look for active/waiting/delayed jobs with the same externalId
    const existingJobs = await ingestionQueue.getJobs(['waiting', 'active', 'delayed']);
    const duplicate = existingJobs.find((job) => job.data.externalId === payload.external_id);

    if (duplicate) {
      logger.warn(
        `Job already existing for externalId=${payload.external_id} (jobId=${duplicate.id})`,
      );
      throw new Error('Job already in progress');
    }

    // Enqueue the job with retry policy
    const jobOptions: JobsOptions = {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: false,
    };

    const job = await ingestionQueue.add(
      'import-series',
      {
        externalSource: payload.external_source,
        externalId: payload.external_id,
        targetTables: ['series', 'seasons', 'episodes'],
      },
      jobOptions,
    );

    logger.info(`Ingestion job enqueued - externalId=${payload.external_id}, jobId=${job.id}`);

    return job.id as string;
  }

  // Runs the daily synchronization logic.
  // Finds running shows and enqueues updates.
  static async runDailySync(): Promise<number> {
    // 1. Get running series from database
    const activeSeries = await prisma.series.findMany({
      where: { status: 'Running', apiId: { not: null } },
      select: { id: true, apiId: true, title: true, updatedAt: true },
    });

    if (activeSeries.length === 0) {
      logger.info('[DailySync] No active series found to sync.');
      return 0;
    }

    // 2. Fetch updates from TVmaze
    // Returns object mapping TVmaze IDs to UNIX timestamps
    const updates = await fetchFromTvmaze<Record<string, number>>('/updates/shows');

    let enqueuedCount = 0;

    // 3. Compare timestamps and enqueue updates
    for (const series of activeSeries) {
      if (!series.apiId) continue;

      const tvmazeUpdatedTimestamp = updates[series.apiId];
      if (!tvmazeUpdatedTimestamp) continue;

      // TVmaze timestamps are in seconds, convert to JS Date
      const tvmazeUpdatedAt = new Date(tvmazeUpdatedTimestamp * 1000);

      // If TVmaze has a newer timestamp than our local database
      if (tvmazeUpdatedAt > series.updatedAt) {
        try {
          await this.enqueueSeriesImport({
            external_source: 'tvmaze',
            external_id: parseInt(series.apiId, 10),
            series_title: series.title,
          });
          enqueuedCount++;
        } catch (error) {
          // If error is "Job already in progress", that's fine, we skip.
          if (error instanceof Error && error.message !== 'Job already in progress') {
            logger.error({ error }, `[DailySync] Failed to enqueue update for ${series.title}`);
          }
        }
      }
    }

    logger.info(`[DailySync] Finished checking updates. Enqueued ${enqueuedCount} shows.`);
    return enqueuedCount;
  }
}
