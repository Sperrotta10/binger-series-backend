import { pinoHttp } from 'pino-http';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export const requestLogger = pinoHttp({
  logger,
  autoLogging: env.NODE_ENV !== 'test',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customLogLevel: (_req: any, res: any, err: any) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customSuccessMessage: (req: any, res: any) => {
    return `${req.method} ${req.url} completed with status ${res.statusCode}`;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customErrorMessage: (req: any, res: any, err: any) => {
    return `${req.method} ${req.url} failed with status ${res.statusCode}: ${err.message}`;
  },
});
