import { createServer } from 'node:http';
import { createApp } from './app.js';
import { connectToDatabase } from './config/database.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

const app = createApp();
const server = createServer(app);

await connectToDatabase();
server.listen(env.PORT, () => {
  logger.info('Talent Hub API listening', { port: env.PORT, environment: env.NODE_ENV });
});

async function shutdown(signal: string): Promise<void> {
  logger.info('Shutting down API', { signal });
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
