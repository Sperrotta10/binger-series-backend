import { QueueService } from '../modules/ingestion/services/queue.service.js';
import '../modules/ingestion/services/worker.service.js';
import { ingestionWorker } from '../modules/ingestion/services/worker.service.js';

async function test() {
  console.log('Testing ingestion worker...');
  try {
    const externalId = 3; // Bitten
    // Listen for completion
    ingestionWorker.on('completed', (job) => {
      if (job.data.externalId === externalId) {
        console.log(`Test passed! Job ${job.id} completed successfully.`);
        setTimeout(() => process.exit(0), 1000);
      }
    });

    ingestionWorker.on('failed', (job, err) => {
      if (job?.data.externalId === externalId) {
        console.error(`Test failed! Job ${job?.id} failed with error:`, err);
        setTimeout(() => process.exit(1), 1000);
      }
    });

    const jobId = await QueueService.enqueueSeriesImport({
      external_id: externalId,
      external_source: 'tvmaze',
    });
    console.log('Job enqueued with ID:', jobId);
    console.log('Waiting for worker to process...');
  } catch (err) {
    console.error('Error starting test:', err);
    process.exit(1);
  }
}

test();
