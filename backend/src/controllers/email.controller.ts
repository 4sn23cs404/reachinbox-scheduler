import { Request, Response } from 'express';
import prisma from '../config/database';
import { EmailStatus } from '@prisma/client';
import { addEmailJob } from '../queues/email.queue';
import { getQueueStatistics } from '../queues/email.queue';

export class EmailController {
  /**
   * GET /api/emails/stats
   * Aggregated statistics for the user dashboard
   */
  static async getStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const [
        totalCampaigns,
        totalScheduled,
        totalSent,
        totalFailed,
        totalProcessing,
        queueStats,
      ] = await Promise.all([
        prisma.campaign.count({ where: { userId } }),
        prisma.email.count({ where: { userId, status: EmailStatus.scheduled } }),
        prisma.email.count({ where: { userId, status: EmailStatus.sent } }),
        prisma.email.count({ where: { userId, status: EmailStatus.failed } }),
        prisma.email.count({ where: { userId, status: EmailStatus.processing } }),
        getQueueStatistics(),
      ]);

      res.status(200).json({
        totalCampaigns,
        totalScheduled,
        totalSent,
        totalFailed,
        pendingEmails: totalScheduled + totalProcessing,
        activeQueueJobs: queueStats.active,
        queueStats,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * GET /api/emails/scheduled
   * Lists scheduled emails for current user with pagination and search
   */
  static async listScheduled(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
      const skip = (page - 1) * limit;
      const search = (req.query.search as string) || '';

      const where: any = {
        userId,
        status: { in: [EmailStatus.scheduled, EmailStatus.processing] },
      };

      if (search) {
        where.OR = [
          { recipientEmail: { contains: search, mode: 'insensitive' } },
          { subject: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [emails, total] = await Promise.all([
        prisma.email.findMany({
          where,
          orderBy: { scheduledAt: 'asc' },
          skip,
          take: limit,
          include: {
            campaign: { select: { id: true, name: true } },
            sender: { select: { id: true, email: true, displayName: true } },
          },
        }),
        prisma.email.count({ where }),
      ]);

      res.status(200).json({
        emails,
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
   * GET /api/emails/sent
   * Lists sent or failed emails with delivery results and Ethereal preview links
   */
  static async listSent(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
      const skip = (page - 1) * limit;
      const statusFilter = req.query.status as string;
      const search = (req.query.search as string) || '';

      const where: any = {
        userId,
        status: statusFilter
          ? (statusFilter as EmailStatus)
          : { in: [EmailStatus.sent, EmailStatus.failed, EmailStatus.cancelled] },
      };

      if (search) {
        where.OR = [
          { recipientEmail: { contains: search, mode: 'insensitive' } },
          { subject: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [emails, total] = await Promise.all([
        prisma.email.findMany({
          where,
          orderBy: { sentAt: 'desc' },
          skip,
          take: limit,
          include: {
            campaign: { select: { id: true, name: true } },
            sender: { select: { id: true, email: true, displayName: true } },
            attempts: { orderBy: { attemptedAt: 'desc' }, take: 5 },
          },
        }),
        prisma.email.count({ where }),
      ]);

      res.status(200).json({
        emails,
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
   * GET /api/emails/:id
   */
  static async getEmail(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const email = await prisma.email.findFirst({
        where: { id, userId: req.user!.id },
        include: {
          campaign: true,
          sender: true,
          attempts: { orderBy: { attemptedAt: 'desc' } },
        },
      });

      if (!email) {
        res.status(404).json({ error: 'NotFound', message: 'Email not found.' });
        return;
      }

      res.status(200).json({ email });
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  /**
   * POST /api/emails/:id/retry
   * Re-enqueues a failed or cancelled email
   */
  static async retryEmail(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const email = await prisma.email.findFirst({
        where: { id, userId: req.user!.id },
        include: { campaign: true },
      });

      if (!email) {
        res.status(404).json({ error: 'NotFound', message: 'Email not found.' });
        return;
      }

      if (email.status === EmailStatus.sent) {
        res.status(400).json({
          error: 'BadRequest',
          message: 'Cannot retry an email that was already sent successfully.',
        });
        return;
      }

      const updated = await prisma.email.update({
        where: { id },
        data: {
          status: EmailStatus.scheduled,
          errorMessage: null,
          scheduledAt: new Date(),
        },
      });

      await addEmailJob(
        {
          emailId: updated.id,
          campaignId: updated.campaignId,
          userId: updated.userId,
          senderId: updated.senderId,
          recipientEmail: updated.recipientEmail,
          subject: updated.subject,
          body: updated.body,
          scheduledAt: updated.scheduledAt.toISOString(),
          delayBetweenEmails: email.campaign.delayBetweenEmails,
          hourlyLimit: email.campaign.hourlyLimit,
        },
        new Date()
      );

      res.status(200).json({
        success: true,
        message: 'Email re-enqueued for delivery.',
        email: updated,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }
}
