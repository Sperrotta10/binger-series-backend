import { z } from 'zod';

export const watchEpisodeSchema = z.object({
  episode_id: z.string().uuid(),
  watched_at: z.string().datetime().optional(),
});

export const updateWatchLogSchema = z.object({
  watched_at: z.string().datetime().optional(),
  is_rewatch: z.boolean().optional(),
});

export const watchlistToggleSchema = z.object({
  series_id: z.string().uuid(),
});

export const idParamSchema = z.string().uuid('Invalid ID format');

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});
