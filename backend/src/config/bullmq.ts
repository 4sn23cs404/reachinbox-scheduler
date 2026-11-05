import { ConnectionOptions } from 'bullmq';

const redisUrl = process.env.REDIS_URL;
const isTLS = redisUrl?.startsWith('rediss://');

export const bullmqConnection: ConnectionOptions = redisUrl
  ? ({
      url: redisUrl,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      tls: isTLS ? { rejectUnauthorized: false } : undefined,
      keepAlive: 10000,
    } as unknown as ConnectionOptions)
  : {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };

export const EMAIL_QUEUE_NAME = 'reachinbox-email-queue';
