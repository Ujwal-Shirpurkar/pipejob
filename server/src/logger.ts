import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { config } from './config';

const logDir = config.logDir;
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const { combine, timestamp, json, colorize, simple } = winston.format;

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

if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: combine(colorize(), simple()),
    })
  );
}

const logger = winston.createLogger({
  level: 'info',
  transports,
});

export default logger;
