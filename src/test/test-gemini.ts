import { GeminiService } from '../modules/ingestion/services/gemini.service.js';

async function test() {
  try {
    const res = await GeminiService.generateSeasonOverview('Breaking Bad', 1);
    console.log('Result:', res);
  } catch (err) {
    console.error('Error:', err);
  }
}
test();
