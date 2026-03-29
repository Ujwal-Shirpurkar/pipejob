export interface AgentConfig {
  anthropicApiKey: string;
  masterCVPath: string;
  outputDir: string;
  logDir: string;
  dbPath: string;
  telegramToken?: string;
  telegramChatId?: string;
  googleSheetId?: string;
  rateLimits: {
    scrapeDelayMs: [number, number];
    maxJobsPerRun: number;
    maxApplicationsPerDay: number;
  };
}
