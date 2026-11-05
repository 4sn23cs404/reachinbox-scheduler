import { Worker, Job } from 'bullmq';
import { bullmqConnection, EMAIL_QUEUE_NAME } from '../config/bullmq';
import { EmailJobData, EmailJobResult } from './queue.types';
import prisma from '../config/database';
import { EmailService } from '../services/email.service';
import { RateLimiterService } from '../services/rateLimiter.service';
import { SearchService } from '../services/search.service';
import { SlackService } from '../services/slack.service';
import { addEmailJob } from './email.queue';
import { EmailStatus } from '@prisma/client';

const concurrency = Number(process.env.WORKER_CONCURRENCY) || 5;

export const emailWorker = new Worker<EmailJobData, EmailJobResult>(
  EMAIL_QUEUE_NAME,
  async (job: Job<EmailJobData>): Promise<EmailJobResult> => {
    const {
      emailId,
      campaignId,
      userId,
      recipientEmail,
      subject,
      body,
      senderId,
      hourlyLimit,
      delayBetweenEmails,
    } = job.data;

    console.log(
      `[Worker] Processing Job ${job.id} for recipient: ${recipientEmail} (Email ID: ${emailId})`
    );

    // 1. Idempotency Check: Fetch latest status from PostgreSQL
    const emailRecord = await prisma.email.findUnique({
      where: { id: emailId },
      include: {
        campaign: { select: { name: true } },
        sender: { select: { email: true } },
      },
    });

    if (!emailRecord) {
      console.warn(`[Worker] Email ${emailId} no longer exists in DB. Skipping.`);
      return { success: false, emailId, error: 'Email record not found' };
    }

    if (emailRecord.status === EmailStatus.sent) {
      console.log(`[Worker] Email ${emailId} already marked as SENT. Skipping duplicate.`);
      return {
        success: true,
        emailId,
        etherealPreviewUrl: emailRecord.etherealPreviewUrl || undefined,
      };
    }

    if (emailRecord.status === EmailStatus.cancelled) {
      console.log(`[Worker] Email ${emailId} was cancelled. Skipping.`);
      return { success: false, emailId, error: 'Campaign was cancelled' };
    }

    // 2. Distributed Rate Limiting & Minimum Delay Coordination
    const rateCheck = await RateLimiterService.checkAndAcquireSendSlot(
      senderId,
      hourlyLimit || Number(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER) || 100,
      delayBetweenEmails || Number(process.env.MIN_DELAY_BETWEEN_EMAILS_MS) || 2000
    );

    if (!rateCheck.allowed) {
      if (rateCheck.reason === 'MIN_DELAY' && rateCheck.waitMs) {
        console.log(
          `⏱️ [Worker] Minimum delay active for sender ${senderId}. Waiting ${rateCheck.waitMs}ms before sending...`
        );
        // Pause for the remaining fraction of the minimum delay
        await new Promise((resolve) => setTimeout(resolve, rateCheck.waitMs));
      } else if (rateCheck.reason === 'HOURLY_LIMIT_EXCEEDED' && rateCheck.nextWindow) {
        console.warn(
          `⚠️ [Worker Rate Limit] Sender ${senderId} reached hourly limit. Rescheduling to ${rateCheck.nextWindow.toISOString()}...`
        );

        // Record rate limit breach event in database
        const event = await RateLimiterService.recordRateLimitEvent(
          senderId,
          userId,
          campaignId,
          hourlyLimit,
          rateCheck.currentCount || hourlyLimit,
          rateCheck.nextWindow
        );

        // Send real Slack notification if Slack is integrated
        if (event && !event.slackNotificationSent) {
          const remainingEmails = await prisma.email.count({
            where: { campaignId, status: EmailStatus.scheduled },
          });

          const slackSent = await SlackService.sendRateLimitNotification({
            userId,
            senderEmail: emailRecord.sender.email,
            campaignName: emailRecord.campaign.name,
            hourlyLimit,
            currentCount: rateCheck.currentCount || hourlyLimit,
            nextAvailableWindow: rateCheck.nextWindow,
            remainingEmails,
          });

          if (slackSent) {
            await prisma.rateLimitEvent.update({
              where: { id: event.id },
              data: { slackNotificationSent: true },
            });
          }
        }

        // Update database scheduled timestamp
        await prisma.email.update({
          where: { id: emailId },
          data: {
            scheduledAt: rateCheck.nextWindow,
            status: EmailStatus.scheduled,
          },
        });

        // Reschedule job in BullMQ for next available window
        await addEmailJob(job.data, rateCheck.nextWindow);

        return {
          success: false,
          emailId,
          rescheduled: true,
          rescheduledFor: rateCheck.nextWindow.toISOString(),
        };
      }
    }

    // 3. Mark as processing in DB
    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: EmailStatus.processing,
        deliveryAttempts: { increment: 1 },
      },
    });

    try {
      // 4. Deliver via Nodemailer / Ethereal SMTP
      const result = await EmailService.sendMail({
        emailId,
        senderId,
        recipientEmail,
        subject,
        body,
      });

      // 5. Update atomic last-sent timestamp for minimum delay coordination
      await RateLimiterService.recordSendSuccess(senderId);

      // 6. Update Email record to SENT in database
      await prisma.$transaction([
        prisma.email.update({
          where: { id: emailId },
          data: {
            status: EmailStatus.sent,
            sentAt: new Date(),
            etherealPreviewUrl: result.etherealPreviewUrl || null,
            errorMessage: null,
          },
        }),
        prisma.campaign.update({
          where: { id: campaignId },
          data: { sentCount: { increment: 1 } },
        }),
        prisma.emailDeliveryAttempt.create({
          data: {
            emailId,
            attemptNum: (emailRecord.deliveryAttempts || 0) + 1,
            status: 'SUCCESS',
            response: `Message ID: ${result.messageId} | Preview: ${result.etherealPreviewUrl || 'N/A'}`,
          },
        }),
      ]);

      // 7. Update status in Elasticsearch
      SearchService.updateEmailStatus(emailId, {
        status: 'sent',
        sentAt: new Date(),
        etherealPreviewUrl: result.etherealPreviewUrl,
      }).catch((e) => console.warn('Non-blocking ES status update warning:', e.message));

      console.log(
        `✅ [Worker] Sent email ${emailId} to ${recipientEmail}. Preview: ${result.etherealPreviewUrl}`
      );

      return {
        success: true,
        emailId,
        messageId: result.messageId,
        etherealPreviewUrl: result.etherealPreviewUrl,
      };
    } catch (sendError: any) {
      console.error(
        `❌ [Worker] Delivery failed for ${emailId} to ${recipientEmail}:`,
        sendError.message
      );

      const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts || 3);

      await prisma.$transaction([
        prisma.email.update({
          where: { id: emailId },
          data: {
            status: isFinalAttempt ? EmailStatus.failed : EmailStatus.scheduled,
            errorMessage: sendError.message,
          },
        }),
        ...(isFinalAttempt
          ? [
              prisma.campaign.update({
                where: { id: campaignId },
                data: { failedCount: { increment: 1 } },
              }),
            ]
          : []),
        prisma.emailDeliveryAttempt.create({
          data: {
            emailId,
            attemptNum: (emailRecord.deliveryAttempts || 0) + 1,
            status: isFinalAttempt ? 'FAILED' : 'RETRYING',
            response: sendError.message,
          },
        }),
      ]);

      // Update failure in Elasticsearch
      SearchService.updateEmailStatus(emailId, {
        status: isFinalAttempt ? 'failed' : 'scheduled',
        errorMessage: sendError.message,
      }).catch((e) => console.warn('Non-blocking ES status update warning:', e.message));

      throw sendError;
    }
  },
  {
    connection: bullmqConnection,
    concurrency,
  }
);

emailWorker.on('completed', (job) => {
  console.log(`🎉 [Worker Event] Job ${job.id} completed successfully.`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`💥 [Worker Event] Job ${job?.id} failed with error: ${err.message}`);
});
