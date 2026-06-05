import { z } from 'zod/v4';

export const toggleFollowSchema = z.object({
  target_user_id: z.string().uuid({ message: 'target_user_id must be a valid UUID' }),
});

export const reviewIdParamSchema = z.string().uuid({ message: 'Review ID must be a valid UUID' });

export const feedPaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
