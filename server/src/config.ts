import dotenv from 'dotenv';
import { z } from 'zod';
import type { AgentConfig } from './types/config';

dotenv.config();

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),
  MASTER_CV_PATH: z.string().default('../master-cv.json'),
  OUTPUT_DIR: z.string().default('./outputs'),
  LOG_DIR: z.string().default('./logs'),
  DB_PATH: z.string().default('./data/applications.sqlite'),
  TELEGRAM_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  GOOGLE_SHEET_ID: z.string().optional(),
  SCRAPE_DELAY_MIN_MS: z.coerce.number().default(2000),
  SCRAPE_DELAY_MAX_MS: z.coerce.number().default(6000),
  MAX_JOBS_PER_RUN: z.coerce.number().default(20),
  MAX_APPLICATIONS_PER_DAY: z.coerce.number().default(5),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

export const config: AgentConfig = {
  anthropicApiKey: env.ANTHROPIC_API_KEY,
  masterCVPath: env.MASTER_CV_PATH,
  outputDir: env.OUTPUT_DIR,
  logDir: env.LOG_DIR,
  dbPath: env.DB_PATH,
  telegramToken: env.TELEGRAM_TOKEN,
  telegramChatId: env.TELEGRAM_CHAT_ID,
  googleSheetId: env.GOOGLE_SHEET_ID,
  rateLimits: {
    scrapeDelayMs: [env.SCRAPE_DELAY_MIN_MS, env.SCRAPE_DELAY_MAX_MS],
    maxJobsPerRun: env.MAX_JOBS_PER_RUN,
    maxApplicationsPerDay: env.MAX_APPLICATIONS_PER_DAY,
  },
};

export const PORT = env.PORT;
export const NODE_ENV = env.NODE_ENV;
