import { app } from './app.js';
import {
  env,
  connectDatabase,
  disconnectDatabase,
  connectRedis,
  disconnectRedis,
  logger,
  prisma,
  redis,
} from './config/index.js';

const PORT = env.PORT;

async function bootstrap() {
  try {
    // 1. Initialize Infrastructure
    await connectDatabase();
    await connectRedis();

    // Enhance Health Check with DB & Redis status
    app.get('/api/v1/health/full', async (_req, res) => {
      let dbStatus = 'down';
      let redisStatus = 'down';

      try {
        await prisma.$queryRaw`SELECT 1`;
        dbStatus = 'up';
      } catch {
        // Ignored
      }

      try {
        const ping = await redis.ping();
        if (ping === 'PONG') redisStatus = 'up';
      } catch {
        // Ignored
      }

      const isHealthy = dbStatus === 'up' && redisStatus === 'up';

      res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        services: {
          api: 'up',
          database: dbStatus,
          redis: redisStatus,
        },
      });
    });

    // 2. Start HTTP Server
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server running in ${env.NODE_ENV} mode on port ${PORT}`);
      logger.info(`👉 Health check: http://localhost:${PORT}/api/v1/health`);
    });

    // 3. Graceful Shutdown Handler
    const gracefulShutdown = async (signal: string) => {
      logger.info(`\n${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed');
        await disconnectDatabase();
        await disconnectRedis();
        logger.info('Graceful shutdown completed');
        process.exit(0);
      });

      // Force close after 10s
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    logger.fatal({ error }, 'Failed to start server');
    process.exit(1);
  }
}

bootstrap();
