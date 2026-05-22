import { z } from 'zod';

export const triggerIngestionSchema = z.object({
  external_source: z.string().default('tvmaze'),
  external_id: z.number().int().positive(),
  series_title: z.string().optional(),
});

export type TriggerIngestionPayload = z.infer<typeof triggerIngestionSchema>;
