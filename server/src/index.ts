import { config, isLlmConfigured, PORT } from './config';
import { initDb } from './db/database';
import { seedCompaniesIfEmpty } from './db/companies';
import { GERMAN_TECH_COMPANIES } from './db/companySeed';
import { failOrphanedRuns } from './db/agentRuns';
import { createApp } from './app';
import { startScheduler } from './scheduler';
import { closePdfBrowser } from './services/tailoring/pdf';
import logger from './logger';

initDb(config.dbPath);
seedCompaniesIfEmpty(GERMAN_TECH_COMPANIES);
const orphaned = failOrphanedRuns();
if (orphaned) logger.warn({ action: 'orphaned_runs', count: orphaned });

const server = createApp().listen(PORT, () => {
  logger.info({ action: 'server_start', port: PORT, model: config.model, llmConfigured: isLlmConfigured() });
  console.log(`PipeJob API running on http://localhost:${PORT}`);
  if (!isLlmConfigured()) {
    console.warn('ANTHROPIC_API_KEY is not set — tracking and portal search work, AI features are disabled.');
  }
});

startScheduler();

async function shutdown() {
  server.close();
  await closePdfBrowser();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
