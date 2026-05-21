import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { env } from './config/env.js';
import { requestLogger } from './middlewares/requestLogger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFoundHandler } from './middlewares/notFound.js';
import { ApiResponse } from './utils/apiResponse.js';

const app: Express = express();

// 1. Core Middlewares
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// 2. Health Check Route
app.get('/api/v1/health', (_req: Request, res: Response) => {
  return ApiResponse.success(
    res,
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: env.NODE_ENV,
    },
    'Server is healthy',
  );
});

// 3. API Routes Mount Point (Modules will be added here in future sprints)
// app.use('/api/v1/auth', authRouter);
// app.use('/api/v1/catalog', catalogRouter);

// 4. Error & 404 Handlers (Must be at the very end)
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
