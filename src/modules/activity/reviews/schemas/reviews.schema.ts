import { z } from 'zod';

const baseReviewSchema = z.object({
  rating: z.number().min(0.5).max(5.0).multipleOf(0.5, 'Rating must be a multiple of 0.5'),
  content: z.string().max(2000).optional(),
  contains_spoilers: z.boolean().default(false),
});

export const seriesReviewSchema = baseReviewSchema.extend({
  series_id: z.string().uuid(),
});

export const seasonReviewSchema = baseReviewSchema.extend({
  series_id: z.string().uuid(),
  season_id: z.string().uuid(),
});

export const episodeReviewSchema = baseReviewSchema.extend({
  series_id: z.string().uuid(),
  season_id: z.string().uuid(),
  episode_id: z.string().uuid(),
});

export const updateReviewSchema = baseReviewSchema.partial();

export const idParamSchema = z.string().uuid('Invalid ID format');

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});
