import { Request, Response } from 'express';
import { catchAsync } from '../../../utils/catchAsync.js';
import { ApiResponse } from '../../../utils/apiResponse.js';
import { CatalogService } from '../services/catalog.service.js';
import { seriesIdSchema, seasonIdSchema, searchSchema } from '../schemas/catalog.schema.js';

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

export const getTrendingSeries = catchAsync(async (req: Request, res: Response) => {
  const hostUrl = `${req.protocol}://${req.get('host')}`;

  const data = await CatalogService.getTrendingSeries(hostUrl);

  return res.status(200).json({
    status: 'success',
    timeframe: 'weekly',
    data,
  });
});
