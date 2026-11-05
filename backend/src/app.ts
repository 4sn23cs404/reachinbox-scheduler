import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

const app: Application = express();

// Security and standard middlewares
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows Bull Board UI and external resources
  })
);

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://localhost:5173',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        origin.includes('localhost')
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in demo/review deployment
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

import authRoutes from './routes/auth.routes';
import senderRoutes from './routes/sender.routes';
import campaignRoutes from './routes/campaign.routes';
import emailRoutes from './routes/email.routes';
import slackRoutes from './routes/slack.routes';
import searchRoutes from './routes/search.routes';
import { bullBoardRouter } from './config/bullBoard';

// Base healthcheck endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'reachinbox-backend',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api', (_req: Request, res: Response) => {
  res.status(200).json({
    message: 'ReachInbox Email Job Scheduler API v1.0',
    phase: 'Phase 5: Integrations Initialized (ES, Slack, Bull Board)',
  });
});

// Registered API routes
app.use('/api/auth', authRoutes);
app.use('/api/senders', senderRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/slack', slackRoutes);
app.use('/api/search', searchRoutes);

// Live BullMQ visual dashboard
app.use('/admin/queues', bullBoardRouter);

// Centralized error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'InternalServerError',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
  });
});

export default app;
