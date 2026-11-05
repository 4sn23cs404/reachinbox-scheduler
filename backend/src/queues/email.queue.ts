import { Queue, JobsOptions } from 'bullmq';
import { bullmqConnection, EMAIL_QUEUE_NAME } from '../config/bullmq';
import { EmailJobData, QueueStatistics } from './queue.types';

export const emailQueue = new Queue<EmailJobData, any, string>(EMAIL_QUEUE_NAME, {
  connection: bullmqConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s, 10s, 20s
    },
    removeOnComplete: {
      count: 500, // Keep last 500 completed for inspection in Bull Board
    },
    removeOnFail: {
      count: 1000, // Keep last 1000 failed jobs for debugging
    },
  },
});

/**
 * Adds an email job with an exact delay based on target scheduled time.
 * Uses deterministic job ID to guarantee idempotency.
 */
export async function addEmailJob(
  jobData: EmailJobData,
  scheduledTime: Date,
  options?: Partial<JobsOptions>
) {
  const now = Date.now();
  const targetTime = scheduledTime.getTime();
  const delayMs = Math.max(0, targetTime - now);

  const jobId = `email:${jobData.emailId}`;

  return await emailQueue.add(
    'send-email',
    jobData,
    {
      jobId, // Deterministic ID ensures no duplicate jobs exist for the same email
      delay: delayMs,
      ...options,
    }
  );
}

/**
 * Removes a job by its deterministic job ID or BullMQ internal ID
 */
export async function removeEmailJob(jobId: string): Promise<boolean> {
  try {
    const job = await emailQueue.getJob(jobId);
    if (job) {
      await job.remove();
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Failed to remove job ${jobId}:`, error);
    return false;
  }
}

/**
 * Retrieves real-time counts from BullMQ
 */
export async function getQueueStatistics(): Promise<QueueStatistics> {
  const [waiting, active, delayed, completed, failed, isPaused] = await Promise.all([
    emailQueue.getWaitingCount(),
    emailQueue.getActiveCount(),
    emailQueue.getDelayedCount(),
    emailQueue.getCompletedCount(),
    emailQueue.getFailedCount(),
    emailQueue.isPaused(),
  ]);

  return {
    waiting,
    active,
    delayed,
    completed,
    failed,
    paused: isPaused ? 1 : 0,
  };
}
