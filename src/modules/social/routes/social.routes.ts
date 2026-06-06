import { Router } from 'express';
import { authenticate } from '../../../middlewares/authenticate.js';
import { toggleFollow, toggleLike, getFeed } from '../controllers/social.controller.js';

const router: Router = Router();

// All social endpoints require authentication
router.use(authenticate);

router.post('/follow/toggle', toggleFollow);
router.post('/reviews/:reviewId/like/toggle', toggleLike);
router.get('/feed', getFeed);

export { router as socialRouter };
