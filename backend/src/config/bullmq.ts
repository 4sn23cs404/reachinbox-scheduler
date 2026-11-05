import { ConnectionOptions } from 'bullmq';

export const bullmqConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

export const EMAIL_QUEUE_NAME = 'reachinbox-email-queue';
