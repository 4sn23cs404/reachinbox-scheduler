import { Router } from 'express';
import { CampaignController } from '../controllers/campaign.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { uploadRecipientsFile } from '../middleware/upload.middleware';

const router = Router();

router.use(requireAuth);

router.post(
  '/parse-recipients',
  uploadRecipientsFile.single('file'),
  CampaignController.parseRecipients
);

router.post(
  '/',
  uploadRecipientsFile.single('file'),
  CampaignController.createCampaign
);

router.get('/', CampaignController.listCampaigns);
router.get('/:id', CampaignController.getCampaign);
router.post('/:id/cancel', CampaignController.cancelCampaign);

export default router;
