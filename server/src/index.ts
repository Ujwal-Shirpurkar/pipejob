import express from 'express';
import cors from 'cors';
import type { Request, Response, NextFunction } from 'express';
import { initDb } from './db/schema';
import { config, PORT } from './config';
import logger from './logger';
import { connectRedis } from './redis';
import jobsRouter from './routes/jobs';
import cvRouter from './routes/cv';

const app = express();

app.use(cors());
app.use(express.json());

// Initialise database
initDb(config.dbPath);

// Routes
app.use('/api/jobs', jobsRouter);
app.use('/api/cv', cvRouter);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// Global error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ action: 'unhandled_error', error: err.message, stack: err.stack });
  res.status(500).json({ error: err.message });
});

connectRedis()
  .then(() => {
    app.listen(PORT, () => {
      logger.info({ action: 'server_start', port: PORT });
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    logger.error({ action: 'redis_connect_failed', error: err.message });
    process.exit(1);
  });
