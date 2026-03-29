import type { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import logger from '../logger';

const WINDOW_MS = 24 * 60 * 60 * 1000;

const applicationTimestamps: number[] = [];

function pruneOld(): void {
  const cutoff = Date.now() - WINDOW_MS;
  while (applicationTimestamps.length > 0 && applicationTimestamps[0] < cutoff) {
    applicationTimestamps.shift();
  }
}

export function checkDailyLimit(): boolean {
  pruneOld();
  return applicationTimestamps.length < config.rateLimits.maxApplicationsPerDay;
}

export function recordApplication(): void {
  applicationTimestamps.push(Date.now());
}

export function applicationRateLimiter(req: Request, res: Response, next: NextFunction): void {
  pruneOld();

  if (applicationTimestamps.length >= config.rateLimits.maxApplicationsPerDay) {
    const oldest = applicationTimestamps[0];
    const retryAfter = Math.ceil((oldest + WINDOW_MS - Date.now()) / 1000);
    logger.warn({ action: 'rate_limit_hit', count: applicationTimestamps.length, retryAfter });
    res.status(429).json({
      error: 'Daily application limit reached',
      retryAfter,
      limit: config.rateLimits.maxApplicationsPerDay,
    });
    return;
  }

  next();
}
