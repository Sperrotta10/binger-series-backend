import { Router } from 'express';
import { authenticate } from '../../../middlewares/authenticate.js';
import {
  watchEpisode,
  unwatchEpisode,
  getMyStats,
  createReview,
  updateReview,
  deleteReview,
  toggleWatchlist,
  updateWatchLog,
  getUserWatchLog,
  getSeriesReviews,
} from '../controllers/activity.controller.js';

const router: Router = Router();

// Public routes
router.get('/reviews/series/:seriesId', getSeriesReviews);

// All routes below require authentication
router.use(authenticate);

// Watch Log
router.get('/watchlog', getUserWatchLog);
router.post('/watch', watchEpisode);
router.delete('/watch/:logId', unwatchEpisode);
router.put('/watch/:logId', updateWatchLog);

// Stats
router.get('/stats/me', getMyStats);

// Reviews
router.post('/reviews', createReview);
router.put('/reviews/:reviewId', updateReview);
router.delete('/reviews/:reviewId', deleteReview);

// Watchlist
router.post('/watchlist/toggle', toggleWatchlist);

export { router as activityRouter };
