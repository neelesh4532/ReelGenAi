import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import pinoHttp from 'pino-http';
import { logger } from './config/logger.js';
import { connectDB } from './config/db.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import ideasRouter from './routes/ideas.js';
import scriptsRouter from './routes/scripts.js';
import projectsRouter from './routes/projects.js';
import authRouter from './routes/auth.js';
import { requireAuth } from './middleware/auth.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(pinoHttp({ logger }));
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://127.0.0.1:5500' }));
app.use(express.json({ limit: '100kb' }));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

app.use('/api/auth', authRouter);
app.use('/api/ideas', ideasRouter);
app.use('/api/scripts', requireAuth, scriptsRouter);
app.use('/api/projects', requireAuth, projectsRouter);

app.use(notFound);
app.use(errorHandler);

async function start() {
  await connectDB();
  app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
}

start().catch((err) => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set and at least 32 characters');
  }
  logger.error(err, 'Failed to start server');
  process.exit(1);
});