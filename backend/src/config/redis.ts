import Redis, { RedisOptions } from 'ioredis';

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

// ioredis natively handles rediss:// (TLS) when given a URL — no extra tls:{} needed
export const redisClient = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    })
  : new Redis(redisOptions);

redisClient.on('connect', () => {
  console.log('✅ [Redis] Connection established successfully.');
});

redisClient.on('error', (err) => {
  console.error('❌ [Redis Error]:', err.message);
});

export default redisClient;
