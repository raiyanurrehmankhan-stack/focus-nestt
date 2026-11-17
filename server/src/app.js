import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { privateRouter, publicRouter } from './routes/index.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind Render/Railway load balancers (needed for rate limiting by IP)

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({
    origin(origin, cb) {
      // Allow same-origin/server-to-server requests (no Origin header) and configured origins.
      if (!origin || env.corsOrigins.includes(origin) || env.corsOrigins.includes('*')) return cb(null, true);
      return cb(Object.assign(new Error('Origin not allowed by CORS'), { status: 403 }));
    },
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
