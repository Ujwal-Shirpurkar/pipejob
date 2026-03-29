import Redis from 'ioredis';
import logger from './logger';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

export const redis = new Redis(REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: null,
});

redis.on('connect', () => logger.info({ action: 'redis_connect', url: REDIS_URL }));
redis.on('error', (err) => logger.error({ action: 'redis_error', error: err.message }));

export async function connectRedis(): Promise<void> {
  await redis.connect();
}
