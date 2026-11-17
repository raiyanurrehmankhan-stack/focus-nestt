// FocusNest API entry point: Express + Socket.IO on one HTTP server.
import http from 'node:http';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { createApp } from './app.js';
import { attachSockets } from './sockets/index.js';
import { seedReferenceData } from './seed/data.js';
import { stopSweeper } from './services/breakScheduler.js';
import { rescheduleRunning } from './services/timerService.js';

async function main() {
  await connectDB();
  await seedReferenceData();
  const app = createApp();
  const server = http.createServer(app);
  const io = attachSockets(server);
  await rescheduleRunning();

  server.listen(env.port, () => console.log(`[api] FocusNest API listening on :${env.port} (${env.nodeEnv})`));

  const shutdown = async (signal) => {
    console.log(`[api] ${signal} received, shutting down…`);
    stopSweeper();
    io.close();
    server.close(async () => {
      await disconnectDB().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[api] Failed to start:', err);
  process.exit(1);
});
