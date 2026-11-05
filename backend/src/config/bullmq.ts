import { ConnectionOptions } from 'bullmq';

function getBullMQConnection(): ConnectionOptions {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const isTLS = redisUrl.startsWith('rediss://');
    return {
      ...(isTLS ? { tls: {} } : {}),
    } as unknown as ConnectionOptions & { url: string };
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

// BullMQ accepts a full URL string directly for connection
export const bullmqConnection: ConnectionOptions = process.env.REDIS_URL
  ? ({
      url: process.env.REDIS_URL,
      ...(process.env.REDIS_URL.startsWith('rediss://') ? { tls: {} } : {}),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    } as unknown as ConnectionOptions)
  : {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };

export const EMAIL_QUEUE_NAME = 'reachinbox-email-queue';
