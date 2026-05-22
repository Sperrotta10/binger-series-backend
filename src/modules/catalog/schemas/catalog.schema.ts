import { z } from 'zod/v4';

export const seriesIdSchema = z.string().refine(
  (val) => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    const isNumeric = /^\d+$/.test(val);
    return isUuid || isNumeric;
  },
  {
    message: 'Series ID must be a valid UUID or a numeric TVmaze ID',
  },
);

export const seasonIdSchema = z.string().refine(
  (val) => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    const isNumeric = /^\d+$/.test(val);
    return isUuid || isNumeric;
  },
  {
    message: 'Season ID must be a valid UUID or numeric ID',
  },
);

export const searchSchema = z.object({
  q: z
    .string({
      message: 'Search query parameter q is required',
    })
    .trim()
    .min(1, 'Search query parameter q cannot be empty'),
  genre: z.string().trim().optional(),
  year: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'Year must be a 4-digit number')
    .optional(),
});

export type SearchInput = z.infer<typeof searchSchema>;
