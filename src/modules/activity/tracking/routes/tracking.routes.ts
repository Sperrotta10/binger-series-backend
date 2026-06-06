import { Router } from 'express';
import { authenticate } from '../../../../middlewares/authenticate.js';
import {
  watchEpisode,
  unwatchEpisode,
  getMyStats,
  toggleWatchlist,
  getUserWatchlist,
  removeFromWatchlist,
  updateWatchLog,
  getUserWatchLog,
} from '../controllers/tracking.controller.js';

const router: Router = Router();

router.use(authenticate);

// Watch Log
router.get('/log', getUserWatchLog);
router.post('/', watchEpisode);
router.delete('/:logId', unwatchEpisode);
router.put('/:logId', updateWatchLog);

// Stats
router.get('/stats', getMyStats);

// Watchlist
router.get('/watchlist', getUserWatchlist);
router.post('/watchlist', toggleWatchlist);
router.delete('/watchlist/:seriesId', removeFromWatchlist);

export { router as trackingRouter };
