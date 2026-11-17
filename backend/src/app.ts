import * as Sentry from '@sentry/node';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, corsOrigins } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { HttpError } from './utils/http.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import athletesRouter from './routes/athletes.js';
import connectionsRouter from './routes/connections.js';
import postsRouter from './routes/posts.js';
import peTeacherRouter from './routes/peTeacher.js';
import { sendSuccess } from './utils/http.js';

if (env.SENTRY_DSN) Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV });

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new HttpError(403, 'CORS_ORIGIN_DENIED', 'This origin is not allowed.'));
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.get('/health', (_req, res) => sendSuccess(res, { status: 'ok' }));
  app.use('/api', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/athletes', athletesRouter);
  app.use('/api/connections', connectionsRouter);
  app.use('/api/posts', postsRouter);
  app.use('/api/pe-teacher', peTeacherRouter);
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' },
    });
  });
  app.use(errorHandler);
  return app;
}
