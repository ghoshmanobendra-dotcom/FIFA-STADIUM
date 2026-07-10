/**
 * Server entry point. Starts the HTTP listener and wires up graceful shutdown.
 */
import { createApp } from './app.js';
import config from './config.js';
import logger from './utils/logger.js';

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info('StadiumIQ 2026 server started', {
    port: config.port,
    env: config.env,
    aiMode: config.ai.enabled ? 'model' : 'offline',
  });
});

/** Close the server cleanly on termination signals. */
function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully`);
  server.close(() => process.exit(0));
  // Force-exit if connections do not drain in time.
  setTimeout(() => process.exit(1), 10_000).unref();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(signal));
}

export default server;
