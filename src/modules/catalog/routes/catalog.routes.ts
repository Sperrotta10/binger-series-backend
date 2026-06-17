import { Router } from 'express';
import { optionalAuthenticate } from '../../../middlewares/authenticate.js';
import {
  getSeriesDetail,
  getSeriesSeasons,
  getSeasonEpisodes,
  searchSeries,
  hybridSearch,
  jitImport,
  bootstrapDashboard,
  getTrendingSeries,
} from '../controllers/catalog.controller.js';

const router: Router = Router();

router.get('/series/:id', optionalAuthenticate, getSeriesDetail);
router.get('/series/:id/seasons', optionalAuthenticate, getSeriesSeasons);
router.get('/seasons/:seasonId/episodes', optionalAuthenticate, getSeasonEpisodes);
router.get('/search', optionalAuthenticate, searchSeries);
router.get('/hybrid-search', optionalAuthenticate, hybridSearch);
router.post('/jit-import', optionalAuthenticate, jitImport);
router.post('/bootstrap', bootstrapDashboard);
router.get('/trending', optionalAuthenticate, getTrendingSeries);

export { router as catalogRouter };
