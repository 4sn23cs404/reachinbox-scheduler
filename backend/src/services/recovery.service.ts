import prisma from '../config/database';
import { emailQueue, addEmailJob } from '../queues/email.queue';
import { EmailStatus } from '@prisma/client';
import { EmailJobData } from '../queues/queue.types';

export class RecoveryService {
  /**
   * Reconciles database email state with BullMQ queue on application startup.
   * Ensures zero dropped jobs across server restarts without duplicating sent emails.
   */
  static async reconcileScheduledEmails(): Promise<{
    reconciledCount: number;
    recoveredProcessingCount: number;
  }> {
    console.log('🔄 [Recovery Service] Starting queue reconciliation...');

    let reconciledCount = 0;
    let recoveredProcessingCount = 0;

    try {
      // 1. Recover uncompleted "processing" emails from previous abrupt crash/restart
      const stuckProcessing = await prisma.email.findMany({
        where: {
          status: EmailStatus.processing,
        },
        include: {
          campaign: true,
        },
      });

      for (const email of stuckProcessing) {
        // Reset status back to scheduled
        await prisma.email.update({
          where: { id: email.id },
          data: { status: EmailStatus.scheduled },
        });

        // Ensure job is enqueued in BullMQ
        const job = await emailQueue.getJob(email.bullJobId || `email:${email.id}`);
        if (!job) {
          const jobData: EmailJobData = {
            emailId: email.id,
            campaignId: email.campaignId,
            userId: email.userId,
            senderId: email.senderId,
            recipientEmail: email.recipientEmail,
            subject: email.subject,
            body: email.body,
            scheduledAt: email.scheduledAt.toISOString(),
            delayBetweenEmails: email.campaign.delayBetweenEmails,
            hourlyLimit: email.campaign.hourlyLimit,
          };
          await addEmailJob(jobData, new Date());
          recoveredProcessingCount++;
        }
      }

      // 2. Inspect all "scheduled" emails and recover any genuinely missing queue jobs
      const scheduledEmails = await prisma.email.findMany({
        where: {
          status: EmailStatus.scheduled,
        },
        include: {
          campaign: true,
        },
      });

      for (const email of scheduledEmails) {
        const expectedJobId = email.bullJobId || `email:${email.id}`;
        const existingJob = await emailQueue.getJob(expectedJobId);

        if (!existingJob) {
          console.log(
            `⚠️ [Recovery Service] Missing job detected for email ${email.id}. Re-enqueuing with stable ID ${expectedJobId}...`
          );

          const jobData: EmailJobData = {
            emailId: email.id,
            campaignId: email.campaignId,
            userId: email.userId,
            senderId: email.senderId,
            recipientEmail: email.recipientEmail,
            subject: email.subject,
            body: email.body,
            scheduledAt: email.scheduledAt.toISOString(),
            delayBetweenEmails: email.campaign.delayBetweenEmails,
            hourlyLimit: email.campaign.hourlyLimit,
          };

          await addEmailJob(jobData, email.scheduledAt);
          reconciledCount++;
        }
      }

      console.log(
        `✅ [Recovery Service] Reconciliation finished: ${reconciledCount} missing jobs recovered, ${recoveredProcessingCount} stuck processing jobs restored.`
      );

      return { reconciledCount, recoveredProcessingCount };
    } catch (error: any) {
      console.error('❌ [Recovery Service] Failed to reconcile queue:', error.message);
      return { reconciledCount: 0, recoveredProcessingCount: 0 };
    }
  }
}
