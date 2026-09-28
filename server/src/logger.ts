import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { config } from './config';

const logDir = config.logDir;
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const { combine, timestamp, json, colorize, printf, errors } = winston.format;

const consoleFormat = combine(
  colorize(),
  timestamp(),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, ...meta }) => {
    const metaKeys = Object.keys(meta).filter((key) => meta[key] !== undefined);
    const metaText = metaKeys.length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${ts} ${level}: ${typeof message === 'string' ? message : JSON.stringify(message)}${metaText}`;
  })
);

const transports: winston.transport[] = [
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    format: combine(timestamp(), json()),
  }),
  new winston.transports.File({
    filename: path.join(logDir, 'app.log'),
    format: combine(timestamp(), json()),
  }),
];

if (process.env.NODE_ENV !== 'production' && !process.env.VITEST) {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

const logger = winston.createLogger({
  level: 'info',
  transports,
});

export default logger;
