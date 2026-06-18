/**
 * CognitionWeb — Logger
 *
 * Structured logging using Winston with console and file transports.
 * Provides colorized console output for development and JSON file
 * output for post-run analysis.
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/** Custom format for console output with colors and context */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, tool, iteration, ...meta }) => {
    let prefix = `${timestamp} ${level}`;

    if (iteration !== undefined) {
      prefix += ` [iter:${iteration}]`;
    }
    if (tool) {
      prefix += ` [${tool}]`;
    }

    const metaStr = Object.keys(meta).length > 0
      ? `\n  ${JSON.stringify(meta, null, 2).replace(/\n/g, '\n  ')}`
      : '';

    return `${prefix}: ${message}${metaStr}`;
  })
);

/** JSON format for file output (machine-readable) */
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

/**
 * Application logger instance.
 * 
 * Usage:
 *   logger.info('Navigating to URL', { tool: 'navigate_to_url', url: '...' });
 *   logger.error('Failed to click', { tool: 'click_on_screen', error: '...' });
 */
const logger = winston.createLogger({
  level: 'debug',
  transports: [
    // Console: colorized, human-readable
    new winston.transports.Console({
      format: consoleFormat,
      level: 'info',
    }),
    // File: JSON format, all levels including debug
    new winston.transports.File({
      filename: path.join(logsDir, 'agent.log'),
      format: fileFormat,
      level: 'debug',
    }),
    // Separate error log
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      format: fileFormat,
      level: 'error',
    }),
  ],
});

export default logger;
