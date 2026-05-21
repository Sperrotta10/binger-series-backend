import { PrismaClient } from '@prisma/client';
import { env } from './env.js';
import { logger } from './logger.js';

const prisma = new PrismaClient({
  datasourceUrl: env.DATABASE_URL,
  log:
    env.NODE_ENV === 'development'
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' },
        ]
      : [{ emit: 'event', level: 'error' }],
});

// Log queries in development for debugging
if (env.NODE_ENV === 'development') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma.$on('query', (e: any) => {
    logger.debug({ query: e.query, duration: `${e.duration}ms` }, 'Prisma Query');
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
prisma.$on('error', (e: any) => {
  logger.error({ target: e.target, message: e.message }, 'Prisma Error');
});

// Connects to PostgreSQL and verifies the connection is healthy.
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    // Verify connection with a simple query
    await prisma.$queryRaw`SELECT 1`;
    logger.info('✅ PostgreSQL connected successfully');
  } catch (error) {
    logger.fatal({ error }, '❌ Failed to connect to PostgreSQL');
    process.exit(1);
  }
}

//Gracefully disconnects from PostgreSQL.
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('🔌 PostgreSQL disconnected');
}

export { prisma };
