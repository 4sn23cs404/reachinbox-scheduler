import redisClient from '../config/redis';
import prisma from '../config/database';

export interface RateLimitCheckResult {
  allowed: boolean;
  reason?: 'MIN_DELAY' | 'HOURLY_LIMIT_EXCEEDED';
  waitMs?: number;
  nextWindow?: Date;
  currentCount?: number;
}

export class RateLimiterService {
  /**
   * Generates a UTC hour key for atomic Redis counters (e.g., "2026-11-05-11")
   */
  private static getHourlyKey(senderId: string, date: Date = new Date()): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    const h = String(date.getUTCHours()).padStart(2, '0');
    return `rate:hourly:${senderId}:${y}-${m}-${d}-${h}`;
  }

  /**
   * Checks both minimum delay and hourly limits atomically in Redis.
   * If allowed, increments the hourly counter atomically.
   */
  static async checkAndAcquireSendSlot(
    senderId: string,
    hourlyLimit: number,
    minDelayMs: number = 2000
  ): Promise<RateLimitCheckResult> {
    const now = Date.now();
    const minDelayKey = `rate:min_delay:${senderId}`;
    const hourlyKey = this.getHourlyKey(senderId);

    // 1. Check Minimum Delay between emails for this sender
    const lastSentStr = await redisClient.get(minDelayKey);
    if (lastSentStr) {
      const lastSentTime = parseInt(lastSentStr, 10);
      const elapsed = now - lastSentTime;
      if (elapsed < minDelayMs) {
        const waitMs = minDelayMs - elapsed;
        return {
          allowed: false,
          reason: 'MIN_DELAY',
          waitMs,
        };
      }
    }

    // 2. Check Hourly Rate Limit
    // Atomic INCR: returns incremented count
    const currentCount = await redisClient.incr(hourlyKey);
    if (currentCount === 1) {
      // Set 2-hour TTL on new hourly keys so Redis automatically cleans up
      await redisClient.expire(hourlyKey, 7200);
    }

    if (currentCount > hourlyLimit) {
      // Revert the increment since the slot is not granted
      await redisClient.decr(hourlyKey);

      // Calculate the start of the next UTC hour window
      const nowUtc = new Date();
      const nextWindow = new Date(
        Date.UTC(
          nowUtc.getUTCFullYear(),
          nowUtc.getUTCMonth(),
          nowUtc.getUTCDate(),
          nowUtc.getUTCHours() + 1,
          0,
          0,
          0
        )
      );

      return {
        allowed: false,
        reason: 'HOURLY_LIMIT_EXCEEDED',
        nextWindow,
        currentCount: currentCount - 1,
      };
    }

    return {
      allowed: true,
      currentCount,
    };
  }

  /**
   * Updates the sender's last sent timestamp atomically upon successful SMTP delivery.
   */
  static async recordSendSuccess(senderId: string): Promise<void> {
    const minDelayKey = `rate:min_delay:${senderId}`;
    // Key expires in 60 seconds (well beyond min delay) to save Redis memory
    await redisClient.set(minDelayKey, Date.now().toString(), 'EX', 60);
  }

  /**
   * Records a rate-limit breach in PostgreSQL and triggers notifications.
   */
  static async recordRateLimitEvent(
    senderId: string,
    userId: string,
    campaignId: string,
    hourlyLimit: number,
    currentCount: number,
    nextWindow: Date
  ) {
    try {
      // Check if an event was already created for this sender in the current hour to avoid spamming
      const existing = await prisma.rateLimitEvent.findFirst({
        where: {
          senderId,
          createdAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000),
          },
        },
      });

      if (!existing) {
        return await prisma.rateLimitEvent.create({
          data: {
            senderId,
            userId,
            campaignId,
            hourlyLimit,
            currentCount,
            nextAvailableWindow: nextWindow,
            slackNotificationSent: false,
          },
        });
      }
      return existing;
    } catch (err: any) {
      console.error('Failed to log rate limit event to DB:', err.message);
      return null;
    }
  }
}
