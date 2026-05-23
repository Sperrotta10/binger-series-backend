import { z } from 'zod';

export const watchEpisodeSchema = z.object({
  episode_id: z.string().uuid(),
  watched_at: z.string().datetime().optional(),
});

export const updateWatchLogSchema = z.object({
  watched_at: z.string().datetime().optional(),
  is_rewatch: z.boolean().optional(),
});

export const reviewSchema = z.object({
  series_id: z.string().uuid(),
  season_id: z.string().uuid().nullable().optional(),
  rating: z.number().min(0.5).max(5.0).multipleOf(0.5, 'Rating must be a multiple of 0.5'),
  content: z.string().max(2000).optional(),
  contains_spoilers: z.boolean().default(false),
});

export const updateReviewSchema = reviewSchema.partial();

export const watchlistToggleSchema = z.object({
  series_id: z.string().uuid(),
});

export const idParamSchema = z.string().uuid('Invalid ID format');
