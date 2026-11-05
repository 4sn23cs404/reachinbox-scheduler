import { Router } from 'express';
import { SlackController } from '../controllers/slack.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// OAuth callback is initiated by Slack's server redirect
router.get('/callback', SlackController.callback);

// Protected routes
router.use(requireAuth);
router.get('/connect', SlackController.connect);
router.get('/status', SlackController.getStatus);
router.post('/disconnect', SlackController.disconnect);
router.post('/test', SlackController.testNotification);

export default router;
