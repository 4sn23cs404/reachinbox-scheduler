import { Router } from 'express';
import { EmailController } from '../controllers/email.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

import { SearchController } from '../controllers/search.controller';

router.get('/stats', EmailController.getStats);
router.get('/search', SearchController.searchEmails);
router.get('/scheduled', EmailController.listScheduled);
router.get('/sent', EmailController.listSent);
router.get('/:id', EmailController.getEmail);
router.post('/:id/retry', EmailController.retryEmail);

export default router;
