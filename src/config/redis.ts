import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    if (times > 5) {
      logger.fatal('❌ Redis: max reconnection attempts reached. Exiting.');
      process.exit(1);
    }
    const delay = Math.min(times * 200, 2000);
    logger.warn({ attempt: times, delayMs: delay }, '🔄 Redis reconnecting...');
    return delay;
  },
  lazyConnect: true,
});

redis.on('connect', () => {
  logger.info('✅ Redis connected successfully');
});

redis.on('error', (error: Error) => {
  logger.error({ error: error.message }, '❌ Redis connection error');
});

redis.on('close', () => {
  logger.info('🔌 Redis connection closed');
});

//Connects to Redis and verifies the connection is healthy.
export async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
    await redis.ping();
  } catch (error) {
    logger.fatal({ error }, '❌ Failed to connect to Redis');
    process.exit(1);
  }
}

//Gracefully disconnects from Redis.
export async function disconnectRedis(): Promise<void> {
  await redis.quit();
}

export { redis };
