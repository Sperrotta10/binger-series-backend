import { z } from 'zod/v4';

export const listIdParamSchema = z.string().uuid({ message: 'List ID must be a valid UUID' });

export const listsPaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const createListSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(1000).optional(),
  is_private: z.boolean().optional().default(false),
});

export const updateListSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).optional(),
  description: z.string().max(1000).optional(),
  is_private: z.boolean().optional(),
});

export const updateListItemsSchema = z.object({
  items: z.array(
    z.object({
      series_id: z.string().uuid({ message: 'series_id must be a valid UUID' }),
      position: z.number().int().min(1),
    }),
  ),
});
