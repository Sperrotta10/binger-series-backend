import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import { env } from './config/env.js';
import { requestLogger } from './middlewares/requestLogger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFoundHandler } from './middlewares/notFound.js';
import { ApiResponse } from './utils/apiResponse.js';
import { authRouter } from './modules/auth/routes/auth.routes.js';
import { catalogRouter } from './modules/catalog/routes/catalog.routes.js';
import { ingestionRouter } from './modules/ingestion/routes/ingestion.routes.js';
import { activityRouter } from './modules/activity/routes/activity.routes.js';
import { socialRouter } from './modules/social/routes/social.routes.js';
import { listsRouter } from './modules/list/routes/lists.routes.js';

const app: Express = express();

// 1. Core Middlewares
app.use(helmet());
const allowedOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  }),
);
app.use(compression());
app.use(cookieParser());
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
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/catalog', catalogRouter);
app.use('/api/v1/ingestion', ingestionRouter);
app.use('/api/v1/activity', activityRouter);
app.use('/api/v1/social', socialRouter);
app.use('/api/v1/lists', listsRouter);

// 4. Error & 404 Handlers (Must be at the very end)
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
