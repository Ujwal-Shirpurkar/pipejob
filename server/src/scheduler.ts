import cron from 'node-cron';
import { config, isLlmConfigured } from './config';
import { isRunActive, startAgentRun } from './agent/orchestrator';
import { loadPreferences } from './profile';
import logger from './logger';

/**
 * Autopilot: runs the agent on a schedule (e.g. "0 8 * * 1-5" = weekdays at 08:00).
 * The agent still only researches and shortlists; results wait in the review queue.
 */
export function startScheduler(): void {
  const expression = config.autopilotCron;
  if (!expression) return;
  if (!cron.validate(expression)) {
    logger.error({ action: 'autopilot', error: `Invalid AUTOPILOT_CRON expression: ${expression}` });
    return;
  }
  cron.schedule(expression, () => {
    if (!isLlmConfigured() || isRunActive()) {
      logger.info({ action: 'autopilot_skip', reason: isRunActive() ? 'run in progress' : 'LLM not configured' });
      return;
    }
    const run = startAgentRun(loadPreferences().autopilotGoal, 'autopilot');
    logger.info({ action: 'autopilot_start', runId: run.id });
  });
  logger.info({ action: 'autopilot_scheduled', cron: expression });
}
