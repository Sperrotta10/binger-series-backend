import { QueueService } from '../modules/ingestion/services/queue.service.js';

async function test() {
  console.log('Testing ingestion queue...');
  try {
    const jobId = await QueueService.enqueueSeriesImport({
      external_id: 1,
      external_source: 'tvmaze',
    });
    console.log('Job enqueued with ID:', jobId);
    console.log('Waiting for worker to process...');
    // wait a bit for worker to process
    await new Promise((res) => setTimeout(res, 5000));
    console.log('Test finished.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

test();
