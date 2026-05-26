import { Router } from 'express';
import { trackingRouter } from '../tracking/routes/tracking.routes.js';
import { reviewsRouter } from '../reviews/routes/reviews.routes.js';

const router: Router = Router();

router.use('/watch', trackingRouter);
router.use('/reviews', reviewsRouter);

export { router as activityRouter };
