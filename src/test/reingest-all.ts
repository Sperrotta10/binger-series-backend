import { prisma } from '../config/database.js';
import { QueueService } from '../modules/ingestion/services/queue.service.js';

async function reingestAll() {
  console.log('Starting full database reingestion to apply new mappings...');
  try {
    const seriesList = await prisma.series.findMany({
      where: { apiId: { not: null } },
    });

    console.log(`Found ${seriesList.length} series to re-ingest.`);

    for (const series of seriesList) {
      if (series.apiId) {
        try {
          const jobId = await QueueService.enqueueSeriesImport({
            external_id: parseInt(series.apiId, 10),
            external_source: series.apiSource,
          });
          console.log(
            `Enqueued Series "${series.title}" (TVmaze ID: ${series.apiId}) - Job ID: ${jobId}`,
          );
        } catch (e: any) {
          if (e.message === 'Job already in progress') {
            console.log(`Series "${series.title}" is already queued/processing.`);
          } else {
            console.error(`Failed to enqueue "${series.title}":`, e);
          }
        }
      }
    }

    console.log('\nAll existing series have been enqueued for re-ingestion!');
    console.log('The background worker (pnpm run dev) will process them shortly.');
    process.exit(0);
  } catch (err) {
    console.error('Error during reingestion script:', err);
    process.exit(1);
  }
}

reingestAll();
