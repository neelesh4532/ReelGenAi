import 'dotenv/config';
import { Worker } from 'bullmq';
import mongoose from 'mongoose';
import { logger } from './config/logger.js';
import { connectDB } from './config/db.js';
import { createConnection } from './queue/connection.js';
import { RENDER_QUEUE } from './queue/constants.js';
import { renderProject } from './services/pipeline.js';

await connectDB().catch((err) => {
  logger.error({ err: err.message }, 'Worker could not connect to MongoDB');
  process.exit(1);
});

const worker = new Worker(
  RENDER_QUEUE,
  async (job) => {
    const { projectId, userId } = job.data;
    logger.info({ jobId: job.id, projectId }, 'Render started');
    return renderProject(projectId, {
      userId,
      onProgress: (p) => job.updateProgress(p).catch(() => {}),
    });
  },
  // One render at a time: FFmpeg is CPU-heavy and TTS has rate limits
  { connection: createConnection('worker'), concurrency: 1 }
);

worker.on('completed', (job, result) =>
  logger.info({ jobId: job.id, durationSec: result.durationSec }, 'Render completed')
);
worker.on('failed', (job, err) =>
  logger.error({ jobId: job?.id, err: err.message }, 'Render failed')
);
worker.on('error', (err) => logger.error({ err: err.message }, 'Worker error'));

logger.info('Render worker ready');

async function shutdown(signal) {
  logger.info(`${signal} received, finishing the current job and closing`);
  await worker.close(); // waits for the running job to finish
  await mongoose.disconnect();
  process.exit(0);
}
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));