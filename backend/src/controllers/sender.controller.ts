import { Request, Response } from 'express';
import { SenderService } from '../services/sender.service';
import { z } from 'zod';

const createSenderSchema = z.object({
  email: z.string().email('Invalid sender email format'),
  displayName: z.string().min(1, 'Display name is required'),
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export class SenderController {
  static async listSenders(req: Request, res: Response): Promise<void> {
    try {
      const senders = await SenderService.getSendersByUser(req.user!.id);
      res.status(200).json({ senders });
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  static async createSender(req: Request, res: Response): Promise<void> {
    try {
      const validated = createSenderSchema.parse(req.body);
      const sender = await SenderService.createSender(req.user!.id, validated);
      res.status(201).json({ sender });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'ValidationError', details: error.errors });
        return;
      }
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  static async updateSender(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updated = await SenderService.updateSender(req.user!.id, id, req.body);
      res.status(200).json({ sender: updated });
    } catch (error: any) {
      res.status(400).json({ error: 'BadRequest', message: error.message });
    }
  }

  static async deleteSender(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await SenderService.deleteSender(req.user!.id, id);
      res.status(200).json({ success: true, message: 'Sender deactivated successfully.' });
    } catch (error: any) {
      res.status(400).json({ error: 'BadRequest', message: error.message });
    }
  }
}
