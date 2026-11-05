import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Official Google OAuth 2.0 endpoints
router.get('/google', AuthController.googleLogin);
router.get('/google/callback', AuthController.googleCallback);

// Session verification and profile
router.post('/demo-login', AuthController.demoLogin);
router.get('/me', requireAuth, AuthController.getMe);
router.post('/logout', requireAuth, AuthController.logout);

export default router;
