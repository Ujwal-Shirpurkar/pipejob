import type { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import logger from '../logger';
import { redis } from '../redis';

const WINDOW_MS = 24 * 60 * 60 * 1000;
const REDIS_KEY = 'rate_limiter:applications';

async function getTimestamps(): Promise<number[]> {
  const raw = await redis.lrange(REDIS_KEY, 0, -1);
  return raw.map(Number);
}

async function pruneOld(): Promise<void> {
  const cutoff = Date.now() - WINDOW_MS;
  const timestamps = await getTimestamps();
  const fresh = timestamps.filter((t) => t >= cutoff);
  const pipeline = redis.pipeline();
  pipeline.del(REDIS_KEY);
  if (fresh.length > 0) {
    pipeline.rpush(REDIS_KEY, ...fresh.map(String));
    pipeline.pexpire(REDIS_KEY, WINDOW_MS);
  }
  await pipeline.exec();
}

export async function checkDailyLimit(): Promise<boolean> {
  await pruneOld();
  const timestamps = await getTimestamps();
  return timestamps.length < config.rateLimits.maxApplicationsPerDay;
}

export async function recordApplication(): Promise<void> {
  await redis.rpush(REDIS_KEY, String(Date.now()));
  await redis.pexpire(REDIS_KEY, WINDOW_MS);
}

export async function applicationRateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  await pruneOld();
  const timestamps = await getTimestamps();

  if (timestamps.length >= config.rateLimits.maxApplicationsPerDay) {
    const oldest = timestamps[0];
    const retryAfter = Math.ceil((oldest + WINDOW_MS - Date.now()) / 1000);
    logger.warn({ action: 'rate_limit_hit', count: timestamps.length, retryAfter });
    res.status(429).json({
      error: 'Daily application limit reached',
      retryAfter,
      limit: config.rateLimits.maxApplicationsPerDay,
    });
    return;
  }

  next();
}
