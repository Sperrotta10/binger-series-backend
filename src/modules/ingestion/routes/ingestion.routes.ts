import { Router } from 'express';
import { internalAuth } from '../../../middlewares/internalAuth.js';
import { triggerIngestion, dailySync } from '../controllers/ingestion.controller.js';

const router: Router = Router();

// Endpoint for internal API triggers
router.post('/trigger', internalAuth, triggerIngestion);

// Endpoint for cron triggers
router.post('/cron/daily-sync', internalAuth, dailySync);

export { router as ingestionRouter };
