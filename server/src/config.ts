import dotenv from 'dotenv';
import { z } from 'zod';
import type { AgentConfig } from './types/config';

dotenv.config({ quiet: true });

const envSchema = z.object({
  // Optional at boot: the dashboard, tracker and portal scanner work without it.
  // Every LLM-backed feature checks `isLlmConfigured()` and returns a clear error.
  ANTHROPIC_API_KEY: z.string().optional(),
  CLAUDE_MODEL: z.string().default('claude-opus-5'),
  AGENT_EFFORT: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).default('medium'),
  EVAL_EFFORT: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).default('medium'),
  AGENT_MAX_TURNS: z.coerce.number().int().positive().default(30),
  AGENT_MAX_EVALUATIONS: z.coerce.number().int().positive().default(12),
  AGENT_MAX_TAILORED: z.coerce.number().int().positive().default(3),

  MASTER_CV_PATH: z.string().default('../master-cv.json'),
  PREFERENCES_PATH: z.string().default('../preferences.json'),
  PORTALS_PATH: z.string().default('../portals.json'),
  OUTPUT_DIR: z.string().default('./outputs'),
  LOG_DIR: z.string().default('./logs'),
  DB_PATH: z.string().default('./data/applications.sqlite'),

  TELEGRAM_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  WEBHOOK_SECRET: z.string().optional(),

  MAX_JOBS_PER_SEARCH: z.coerce.number().int().positive().default(40),
  // A self-imposed budget: a few well-researched applications beat volume.
  MAX_APPLICATIONS_PER_DAY: z.coerce.number().int().positive().default(5),

  AUTOPILOT_CRON: z.string().optional(),

  PORT: z.coerce.number().default(3001),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

const env = parsed.data;

export const config: AgentConfig = {
  anthropicApiKey: env.ANTHROPIC_API_KEY || undefined,
  model: env.CLAUDE_MODEL,
  agentEffort: env.AGENT_EFFORT,
  evalEffort: env.EVAL_EFFORT,
  agentLimits: {
    maxTurns: env.AGENT_MAX_TURNS,
    maxEvaluations: env.AGENT_MAX_EVALUATIONS,
    maxTailored: env.AGENT_MAX_TAILORED,
  },
  masterCVPath: env.MASTER_CV_PATH,
  preferencesPath: env.PREFERENCES_PATH,
  portalsPath: env.PORTALS_PATH,
  outputDir: env.OUTPUT_DIR,
  logDir: env.LOG_DIR,
  dbPath: env.DB_PATH,
  telegramToken: env.TELEGRAM_TOKEN,
  telegramChatId: env.TELEGRAM_CHAT_ID,
  webhookSecret: env.WEBHOOK_SECRET,
  autopilotCron: env.AUTOPILOT_CRON,
  clientUrl: env.CLIENT_URL,
  limits: {
    maxJobsPerSearch: env.MAX_JOBS_PER_SEARCH,
    maxApplicationsPerDay: env.MAX_APPLICATIONS_PER_DAY,
  },
};

export const PORT = env.PORT;
export const NODE_ENV = env.NODE_ENV;

export function isLlmConfigured(): boolean {
  return Boolean(config.anthropicApiKey);
}
