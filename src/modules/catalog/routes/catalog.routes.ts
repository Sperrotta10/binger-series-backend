import { Router } from 'express';
import { optionalAuthenticate } from '../../../middlewares/authenticate.js';
import {
  getSeriesDetail,
  getSeriesSeasons,
  getSeasonEpisodes,
  searchSeries,
  getTrendingSeries,
} from '../controllers/catalog.controller.js';

const router: Router = Router();

router.get('/series/:id', optionalAuthenticate, getSeriesDetail);
router.get('/series/:id/seasons', optionalAuthenticate, getSeriesSeasons);
router.get('/seasons/:seasonId/episodes', optionalAuthenticate, getSeasonEpisodes);
router.get('/search', optionalAuthenticate, searchSeries);
router.get('/trending', optionalAuthenticate, getTrendingSeries);

export { router as catalogRouter };
