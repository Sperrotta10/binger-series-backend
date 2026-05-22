import { z } from 'zod/v4';
import dotenv from 'dotenv';
import { expand } from 'dotenv-expand';

// Load .env file before validation
const myEnv = dotenv.config();
expand(myEnv);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Database
  DATABASE_URL: z.url('DATABASE_URL must be a valid connection string'),

  // Redis
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // JWT Secrets
  ACCESS_TOKEN_SECRET: z.string().min(16, 'ACCESS_TOKEN_SECRET must be at least 16 characters'),
  REFRESH_TOKEN_SECRET: z.string().min(16, 'REFRESH_TOKEN_SECRET must be at least 16 characters'),
  ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(900), // 15 minutes in seconds
  REFRESH_TOKEN_TTL: z.coerce.number().int().positive().default(2592000), // 30 days in seconds

  // CORS
  CORS_ORIGIN: z.string().min(1, 'CORS_ORIGIN is required'),

  // SMTP Mail Configuration
  SMTP_HOST: z.string().min(1, 'SMTP_HOST is required'),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().min(1, 'SMTP_USER is required'),
  SMTP_PASS: z.string().min(1, 'SMTP_PASS is required'),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = z.prettifyError(result.error);
    console.error('❌ Invalid environment variables:\n', formatted);
    process.exit(1);
  }

  return result.data;
}

export const env = validateEnv();
