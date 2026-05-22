import { Worker, Job } from 'bullmq';
import { env } from '../../../config/env.js';
import { logger } from '../../../config/logger.js';
import { INGESTION_QUEUE_NAME } from './queue.service.js';
import { ProcessorService } from './processor.service.js';
import { Redis } from 'ioredis';

const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const ingestionWorker = new Worker(
  INGESTION_QUEUE_NAME,
  async (job: Job) => {
    logger.info(`[Worker] Processing job ${job.id} for externalId ${job.data.externalId}`);

    try {
      if (job.name === 'import-series') {
        await ProcessorService.processSeriesImport(job.data.externalId);
      } else {
        logger.warn(`[Worker] Unknown job name: ${job.name}`);
      }
    } catch (error) {
      logger.error({ error }, `[Worker] Job ${job.id} failed`);
      throw error;
    }
  },
  {
    connection,
    concurrency: 5, // Process up to 5 jobs concurrently
  },
);

ingestionWorker.on('completed', (job) => {
  logger.info(`[Worker] Job ${job.id} completed successfully`);
});

ingestionWorker.on('failed', (job, err) => {
  logger.error(`[Worker] Job ${job?.id} failed with error: ${err.message}`);
});
