import Redis, { RedisOptions } from 'ioredis';

const redisUrl = process.env.REDIS_URL;

const redisOptions: RedisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

function createRedisClient() {
  if (redisUrl) {
    const isTLS = redisUrl.startsWith('rediss://');
    return new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      keepAlive: 10000,
      // Required for Upstash: explicit TLS with rejectUnauthorized false
      tls: isTLS ? { rejectUnauthorized: false } : undefined,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
  }
  return new Redis(redisOptions);
}

export const redisClient = createRedisClient();

redisClient.on('connect', () => {
  console.log('✅ [Redis] Connection established successfully.');
});

redisClient.on('error', (err: any) => {
  // Upstash periodically closes idle connections; ioredis reconnects automatically
  if (err.message?.includes('ECONNRESET') || err.code === 'ECONNRESET') {
    return;
  }
  console.error('❌ [Redis Error]:', err.message);
});

export default redisClient;
