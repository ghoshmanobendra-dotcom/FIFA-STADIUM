/**
 * Minimal, dependency-free structured logger.
 *
 * Emits single-line JSON in production (friendly to log aggregators) and a
 * compact human-readable format elsewhere. Silent during tests to keep output
 * clean. No external logging library keeps the dependency surface — and the
 * repository size — small.
 */
import config from '../config.js';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

function emit(level, message, meta) {
  if (config.isTest) return;
  const entry = { ts: new Date().toISOString(), level, message, ...meta };
  const line = config.isProduction
    ? JSON.stringify(entry)
    : `${entry.ts} [${level.toUpperCase()}] ${message}` +
      (meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '');
  const stream = LEVELS[level] <= LEVELS.warn ? process.stderr : process.stdout;
  stream.write(line + '\n');
}

const logger = {
  error: (msg, meta = {}) => emit('error', msg, meta),
  warn: (msg, meta = {}) => emit('warn', msg, meta),
  info: (msg, meta = {}) => emit('info', msg, meta),
  debug: (msg, meta = {}) => emit('debug', msg, meta),
};

export default logger;
