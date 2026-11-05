import { Router } from 'express';
import { SenderController } from '../controllers/sender.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', SenderController.listSenders);
router.post('/', SenderController.createSender);
router.patch('/:id', SenderController.updateSender);
router.delete('/:id', SenderController.deleteSender);

export default router;
