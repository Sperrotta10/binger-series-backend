import { Request, Response } from 'express';
import { catchAsync } from '../../../utils/catchAsync.js';
import { ApiResponse } from '../../../utils/apiResponse.js';
import { CatalogService } from '../services/catalog.service.js';
import { seriesIdSchema, seasonIdSchema, searchSchema } from '../schemas/catalog.schema.js';
import { QueueService } from '../../ingestion/services/queue.service.js';
import { z } from 'zod/v4';

export const getSeriesDetail = catchAsync(async (req: Request, res: Response) => {
  const id = seriesIdSchema.parse(req.params.id);
  const userId = req.user?.id;
  const hostUrl = `${req.protocol}://${req.get('host')}`;

  const data = await CatalogService.getSeriesDetail(id, userId, hostUrl);

  return ApiResponse.success(res, data);
});

export const getSeriesSeasons = catchAsync(async (req: Request, res: Response) => {
  const id = seriesIdSchema.parse(req.params.id);

  const data = await CatalogService.getSeriesSeasons(id);

  return ApiResponse.success(res, data);
});

export const getSeasonEpisodes = catchAsync(async (req: Request, res: Response) => {
  const seasonId = seasonIdSchema.parse(req.params.seasonId);

  const data = await CatalogService.getSeasonEpisodes(seasonId);

  return ApiResponse.success(res, data);
});

export const searchSeries = catchAsync(async (req: Request, res: Response) => {
  const { q, genre, year } = searchSchema.parse(req.query);
  const hostUrl = `${req.protocol}://${req.get('host')}`;

  const results = await CatalogService.searchSeries(q, genre, year, hostUrl);

  return res.status(200).json({
    status: 'success',
    results_count: results.length,
    data: results,
  });
});

// ─── HYBRID SEARCH ───────────────────────────────────────────────────────────
// GET /api/v1/catalog/hybrid-search?q=...
// Returns merged local DB + TVmaze results with isImported flag.
export const hybridSearch = catchAsync(async (req: Request, res: Response) => {
  const { q, genre, year } = searchSchema.parse(req.query);
  const hostUrl = `${req.protocol}://${req.get('host')}`;

  const results = await CatalogService.hybridSearch(q, genre, year, hostUrl);

  return res.status(200).json({
    status: 'success',
    results_count: results.length,
    data: results,
  });
});

// ─── JIT IMPORT ──────────────────────────────────────────────────────────────
// POST /api/v1/catalog/jit-import
// Public-facing endpoint called when a user clicks an unimported TVmaze result.
const jitImportSchema = z.object({
  tvmaze_id: z.number().int().positive(),
  series_title: z.string().optional(),
});

export const jitImport = catchAsync(async (req: Request, res: Response) => {
  const { tvmaze_id, series_title } = jitImportSchema.parse(req.body);

  let jobId: string | null = null;
  try {
    jobId = await QueueService.enqueueSeriesImport({
      external_source: 'tvmaze',
      external_id: tvmaze_id,
      series_title: series_title ?? `TVmaze #${tvmaze_id}`,
    });
  } catch (err) {
    // If a job is already running for this show, return 202 with that info
    if (err instanceof Error && err.message === 'Job already in progress') {
      return res.status(202).json({ status: 'success', message: 'Job already in progress', data: { job_id: null, status: 'duplicate' } });
    }
    throw err;
  }

  return res.status(202).json({
    status: 'success',
    message: 'Import enqueued',
    data: { job_id: jobId, status: 'queued' },
  });
});

// ─── DASHBOARD BOOTSTRAP ─────────────────────────────────────────────────────
// POST /api/v1/catalog/bootstrap
// Silently enqueues top TVmaze shows when the local DB is empty.
export const bootstrapDashboard = catchAsync(async (_req: Request, res: Response) => {
  const result = await CatalogService.bootstrapDashboard();

  return res.status(202).json({
    status: 'success',
    message: result.enqueued > 0
      ? `Dashboard bootstrap triggered: ${result.enqueued} shows enqueued`
      : 'Dashboard already has content — no bootstrap needed',
    data: result,
  });
});

export const getTrendingSeries = catchAsync(async (req: Request, res: Response) => {
  const hostUrl = `${req.protocol}://${req.get('host')}`;

  const data = await CatalogService.getTrendingSeries(hostUrl);

  return res.status(200).json({
    status: 'success',
    timeframe: 'weekly',
    data,
  });
});
