import { Request, Response } from 'express';
import { SchedulerService } from '../services/scheduler.service';
import { parseRecipientsFile } from '../utils/emailParser';
import prisma from '../config/database';
import { z } from 'zod';

const scheduleCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Email body is required'),
  senderId: z.string().min(1, 'Sender ID is required'),
  startTime: z.string().or(z.date()),
  delayBetweenEmails: z.coerce.number().min(0).optional(),
  hourlyLimit: z.coerce.number().min(1).optional(),
  recipients: z.array(z.string()).optional(),
});

export class CampaignController {
  /**
   * POST /api/campaigns/parse-recipients
   * Preview and validation endpoint for uploaded CSV or TXT lead files
   */
  static async parseRecipients(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'BadRequest', message: 'No file uploaded.' });
        return;
      }

      const parseResult = parseRecipientsFile(req.file.buffer, req.file.originalname);
      res.status(200).json(parseResult);
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * POST /api/campaigns
   * Create and schedule a campaign
   */
  static async createCampaign(req: Request, res: Response): Promise<void> {
    try {
      let recipientList: string[] = [];

      // If a file was uploaded in the multipart request
      if (req.file) {
        const parsed = parseRecipientsFile(req.file.buffer, req.file.originalname);
        recipientList = parsed.validEmails;
      } else if (req.body.recipients) {
        if (typeof req.body.recipients === 'string') {
          try {
            recipientList = JSON.parse(req.body.recipients);
          } catch {
            recipientList = req.body.recipients.split(',').map((e: string) => e.trim());
          }
        } else if (Array.isArray(req.body.recipients)) {
          recipientList = req.body.recipients;
        }
      }

      const validated = scheduleCampaignSchema.parse({
        ...req.body,
        recipients: recipientList,
      });

      if (!recipientList || recipientList.length === 0) {
        res.status(400).json({
          error: 'BadRequest',
          message: 'No valid recipient email addresses provided.',
        });
        return;
      }

      const result = await SchedulerService.scheduleCampaign(req.user!.id, {
        name: validated.name,
        subject: validated.subject,
        body: validated.body,
        senderId: validated.senderId,
        recipients: recipientList,
        startTime: new Date(validated.startTime),
        delayBetweenEmails: validated.delayBetweenEmails,
        hourlyLimit: validated.hourlyLimit,
      });

      res.status(201).json({
        success: true,
        message: `Successfully scheduled ${result.totalScheduled} emails for campaign "${result.campaign.name}".`,
        data: result,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'ValidationError', details: error.errors });
        return;
      }
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * GET /api/campaigns
   * List campaigns for current user
   */
  static async listCampaigns(req: Request, res: Response): Promise<void> {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
      const skip = (page - 1) * limit;

      const [campaigns, total] = await Promise.all([
        prisma.campaign.findMany({
          where: { userId: req.user!.id },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            _count: {
              select: { emails: true },
            },
          },
        }),
        prisma.campaign.count({ where: { userId: req.user!.id } }),
      ]);

      res.status(200).json({
        campaigns,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * GET /api/campaigns/:id
   * Get single campaign details and email metrics
   */
  static async getCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const campaign = await prisma.campaign.findFirst({
        where: { id, userId: req.user!.id },
        include: {
          emails: {
            take: 20,
            orderBy: { scheduledAt: 'asc' },
          },
        },
      });

      if (!campaign) {
        res.status(404).json({ error: 'NotFound', message: 'Campaign not found' });
        return;
      }

      res.status(200).json({ campaign });
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * POST /api/campaigns/:id/cancel
   * Cancel scheduled campaign
   */
  static async cancelCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await SchedulerService.cancelCampaign(req.user!.id, id);
      res.status(200).json({
        success: true,
        message: `Campaign cancelled. ${result.cancelledCount} pending emails unscheduled.`,
      });
    } catch (error: any) {
      res.status(400).json({ error: 'BadRequest', message: error.message });
    }
  }
}
