export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface AgentConfig {
  anthropicApiKey?: string;
  model: string;
  agentEffort: Effort;
  evalEffort: Effort;
  agentLimits: {
    maxTurns: number;
    maxEvaluations: number;
    maxTailored: number;
  };
  masterCVPath: string;
  preferencesPath: string;
  portalsPath: string;
  outputDir: string;
  logDir: string;
  dbPath: string;
  telegramToken?: string;
  telegramChatId?: string;
  webhookSecret?: string;
  autopilotCron?: string;
  clientUrl: string;
  limits: {
    maxJobsPerSearch: number;
    maxApplicationsPerDay: number;
  };
}
