import prisma from '../config/database';
import { emailQueue, removeEmailJob } from '../queues/email.queue';
import { EmailJobData } from '../queues/queue.types';
import { CampaignStatus, EmailStatus } from '@prisma/client';
import { SearchService } from './search.service';
import crypto from 'crypto';

export interface ScheduleCampaignInput {
  name: string;
  subject: string;
  body: string;
  senderId: string;
  recipients: string[];
  startTime: Date;
  delayBetweenEmails?: number; // ms, default 2000
  hourlyLimit?: number; // default 100
}

export class SchedulerService {
  /**
   * Schedules a new campaign and all recipient emails with BullMQ delayed jobs.
   */
  static async scheduleCampaign(userId: string, input: ScheduleCampaignInput) {
    const {
      name,
      subject,
      body,
      senderId,
      recipients,
      startTime,
      delayBetweenEmails = Number(process.env.MIN_DELAY_BETWEEN_EMAILS_MS) || 2000,
      hourlyLimit = Number(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER) || 100,
    } = input;

    if (!recipients || recipients.length === 0) {
      throw new Error('At least one valid recipient is required to schedule a campaign.');
    }

    // 1. Verify sender exists and belongs to the user
    const sender = await prisma.emailSender.findFirst({
      where: { id: senderId, userId, isActive: true },
    });

    if (!sender) {
      throw new Error('Selected email sender does not exist or is inactive.');
    }

    // 2. Pre-calculate timestamps considering delay and hourly limits
    const now = Date.now();
    let currentScheduleTime = Math.max(new Date(startTime).getTime(), now);

    let currentWindowStart = new Date(currentScheduleTime);
    currentWindowStart.setUTCMinutes(0, 0, 0); // Round down to start of hour
    let emailsSentInWindow = 0;

    const emailSchedulePlan: { recipient: string; scheduledAt: Date }[] = [];

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i].trim().toLowerCase();

      // Check if we hit the hourly limit
      if (emailsSentInWindow >= hourlyLimit) {
        // Push currentScheduleTime to the start of the next hour
        const nextHour = new Date(currentWindowStart.getTime() + 60 * 60 * 1000);
        currentScheduleTime = nextHour.getTime();
        currentWindowStart = nextHour;
        emailsSentInWindow = 0;
      }

      const scheduledAt = new Date(currentScheduleTime);
      emailSchedulePlan.push({ recipient, scheduledAt });

      emailsSentInWindow++;
      currentScheduleTime += delayBetweenEmails;
    }

    // 3. Database Transaction: Create Campaign and Email records
    const campaign = await prisma.$transaction(async (tx) => {
      const newCampaign = await tx.campaign.create({
        data: {
          userId,
          name,
          subject,
          body,
          startTime: new Date(startTime),
          delayBetweenEmails,
          hourlyLimit,
          status: CampaignStatus.SCHEDULED,
          totalEmails: emailSchedulePlan.length,
          sentCount: 0,
          failedCount: 0,
        },
      });

      const emailRecords = emailSchedulePlan.map((plan, index) => {
        const emailId = crypto.randomUUID();
        const idempotencyKey = `camp_${newCampaign.id}_${plan.recipient}_${index}`;
        const bullJobId = `email:${emailId}`;

        return {
          id: emailId,
          campaignId: newCampaign.id,
          userId,
          senderId,
          recipientEmail: plan.recipient,
          subject,
          body,
          scheduledAt: plan.scheduledAt,
          status: EmailStatus.scheduled,
          idempotencyKey,
          bullJobId,
        };
      });

      await tx.email.createMany({
        data: emailRecords,
      });

      return { newCampaign, emailRecords };
    });

    // 4. Enqueue jobs into BullMQ using bulk insertion in 1 single network roundtrip!
    const bulkJobs = campaign.emailRecords.map((record) => {
      const targetTime = record.scheduledAt.getTime();
      const delayMs = Math.max(0, targetTime - Date.now());

      const jobData: EmailJobData = {
        emailId: record.id,
        campaignId: campaign.newCampaign.id,
        userId,
        senderId,
        recipientEmail: record.recipientEmail,
        subject: record.subject,
        body: record.body,
        scheduledAt: record.scheduledAt.toISOString(),
        delayBetweenEmails,
        hourlyLimit,
      };

      return {
        name: 'send-email',
        data: jobData,
        opts: {
          jobId: record.bullJobId,
          delay: delayMs,
        },
      };
    });

    try {
      await emailQueue.addBulk(bulkJobs);
    } catch (err: any) {
      console.error('⚠️ BullMQ addBulk warning:', err.message);
      // Outbox recovery pattern handles re-enqueueing if needed
    }

    // Non-blocking asynchronous search indexing
    for (const record of campaign.emailRecords) {
      SearchService.indexEmail({
        id: record.id,
        emailId: record.id,
        userId,
        campaignId: campaign.newCampaign.id,
        campaignName: campaign.newCampaign.name,
        senderId,
        senderEmail: sender.email,
        recipientEmail: record.recipientEmail,
        subject: record.subject,
        body: record.body,
        status: 'scheduled',
        scheduledAt: record.scheduledAt.toISOString(),
        createdAt: record.scheduledAt.toISOString(),
      }).catch((e) => console.warn('Non-blocking ES index warning:', e.message));
    }

    return {
      campaign: campaign.newCampaign,
      totalScheduled: campaign.emailRecords.length,
      firstScheduledAt: emailSchedulePlan[0]?.scheduledAt,
      lastScheduledAt: emailSchedulePlan[emailSchedulePlan.length - 1]?.scheduledAt,
      enqueuedJobCount: bulkJobs.length,
    };
  }

  /**
   * Cancels a scheduled or in-progress campaign and removes pending BullMQ jobs.
   */
  static async cancelCampaign(userId: string, campaignId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
      include: {
        emails: {
          where: { status: EmailStatus.scheduled },
        },
      },
    });

    if (!campaign) {
      throw new Error('Campaign not found or unauthorized.');
    }

    // Cancel pending email jobs in BullMQ
    for (const email of campaign.emails) {
      if (email.bullJobId) {
        await removeEmailJob(email.bullJobId);
      }
    }

    // Update statuses in DB
    await prisma.$transaction([
      prisma.email.updateMany({
        where: { campaignId, status: EmailStatus.scheduled },
        data: { status: EmailStatus.cancelled },
      }),
      prisma.campaign.update({
        where: { id: campaignId },
        data: { status: CampaignStatus.CANCELLED },
      }),
    ]);

    return { success: true, cancelledCount: campaign.emails.length };
  }
}
