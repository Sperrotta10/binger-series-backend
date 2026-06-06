import { logger } from '../../../config/logger.js';
import { AppError } from '../../../middlewares/errorHandler.js';
import { HttpStatus } from '../../../constants/httpStatus.js';
import { env } from '@config/env.js';

const TVMAZE_BASE_URL = env.API_URL_SERIES;

// Helper to pause execution for a given number of milliseconds
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Fetches data from TVmaze API with exponential backoff and 429 (Too Many Requests) handling.
export async function fetchFromTvmaze<T>(endpoint: string, retries = 5): Promise<T> {
  const url = `${TVMAZE_BASE_URL}${endpoint}`;
  let attempt = 0;

  while (attempt < retries) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return (await response.json()) as T;
      }

      if (response.status === 429) {
        // Rate limited
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterMs = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : 10000; // Default 10s if not present

        logger.warn(
          `[TVmaze] Rate limit hit. Waiting ${retryAfterMs}ms before retrying (Attempt ${attempt + 1}/${retries})...`,
        );
        await delay(retryAfterMs);
      } else if (response.status === 404) {
        throw new AppError(`Not found on TVmaze: ${url}`, HttpStatus.NOT_FOUND);
      } else {
        // Other errors (500, 502, 503)
        throw new Error(`TVmaze API error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error; // Don't retry 404s
      }

      attempt++;
      if (attempt >= retries) {
        logger.error({ error }, `[TVmaze] Failed to fetch ${url} after ${retries} attempts.`);
        throw new AppError(
          `Failed to fetch from TVmaze after ${retries} attempts`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Exponential backoff for network or 5xx errors: 5s, 25s, 125s...
      const backoffDelay = Math.pow(5, attempt) * 1000;
      logger.warn(
        { error },
        `[TVmaze] Network/Server error fetching ${url}. Retrying in ${backoffDelay}ms...`,
      );
      await delay(backoffDelay);
    }
  }

  throw new AppError('Unexpected error in fetchFromTvmaze', HttpStatus.INTERNAL_SERVER_ERROR);
}
