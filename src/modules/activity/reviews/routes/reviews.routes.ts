import { Router } from 'express';
import { authenticate } from '../../../../middlewares/authenticate.js';
import {
  createSeriesReview,
  createSeasonReview,
  createEpisodeReview,
  updateReview,
  deleteReview,
  getSeriesReviews,
  getSeasonReviews,
  getEpisodeReviews,
} from '../controllers/reviews.controller.js';

const router: Router = Router();

// Public routes
router.get('/series/:seriesId', getSeriesReviews);
router.get('/series/:seriesId/seasons/:seasonId', getSeasonReviews);
router.get('/series/:seriesId/seasons/:seasonId/episodes/:episodeId', getEpisodeReviews);

// Protected routes
router.use(authenticate);

router.post('/series', createSeriesReview);
router.post('/seasons', createSeasonReview);
router.post('/episodes', createEpisodeReview);

router.put('/:reviewId', updateReview);
router.delete('/:reviewId', deleteReview);

export { router as reviewsRouter };
