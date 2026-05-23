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
} from '../controllers/activity.controller.js';

const router: Router = Router();

// All routes in the activity module require authentication
router.use(authenticate);

// Watch Log
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
