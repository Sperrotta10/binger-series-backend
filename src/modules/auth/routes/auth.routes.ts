import { Router } from 'express';
import { authenticate } from '../../../middlewares/authenticate.js';
import {
  register,
  login,
  googleOauth,
  refresh,
  forgotPassword,
  resetPassword,
  logout,
  getProfile,
  updateProfile,
} from '../controllers/auth.controller.js';

const router: Router = Router();

// Public routes (no authentication required)
router.post('/register', register);
router.post('/login', login);
router.post('/oauth/google', googleOauth);
router.post('/refresh', refresh);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes (authentication required)
router.post('/logout', authenticate, logout);
router.get('/profile/me', authenticate, getProfile);
router.patch('/profile/update', authenticate, updateProfile);

export { router as authRouter };
