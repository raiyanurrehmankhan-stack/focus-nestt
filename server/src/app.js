import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { corsOriginOption } from './utils/origins.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { privateRouter, publicRouter } from './routes/index.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind Render/Railway load balancers (needed for rate limiting by IP)

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({
    // Same matcher as Socket.IO (server/src/utils/origins.js); requests with
    // no Origin header (same-origin, server-to-server) are allowed.
    origin: corsOriginOption(env.isOriginAllowed),
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id'],
    maxAge: 600,
  }));
  app.use(express.json({ limit: '200kb' }));

  app.get('/api/health', (_req, res) => {
    const dbOk = mongoose.connection.readyState === 1;
    res.status(dbOk ? 200 : 503).json({ ok: dbOk, db: dbOk ? 'connected' : 'disconnected', time: new Date().toISOString() });
  });

  app.use('/api', apiLimiter, publicRouter, privateRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
