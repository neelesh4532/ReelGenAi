import 'dotenv/config';
import { Worker, UnrecoverableError } from 'bullmq';
import mongoose from 'mongoose';
import { logger } from './config/logger.js';
import { connectDB } from './config/db.js';
import { createConnection } from './queue/connection.js';
import { RENDER_QUEUE } from './queue/constants.js';
import { renderProject } from './services/pipeline.js';
import { isRetryable } from './services/retry.js';

await connectDB().catch((err) => {
  logger.error({ err: err.message }, 'Worker could not connect to MongoDB');
  process.exit(1);
});

const worker = new Worker(
  RENDER_QUEUE,
  async (job) => {
    const { projectId, userId } = job.data;
    const attempt = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? 1;
    logger.info({ jobId: job.id, projectId, attempt, maxAttempts }, 'Render started');

    const shouldRetry = (err) => isRetryable(err) && attempt < maxAttempts;

    // Development only: SIMULATE_FAILURES=2 makes the first two attempts fail on purpose
    const simulate =
      process.env.NODE_ENV !== 'production' &&
      Number(process.env.SIMULATE_FAILURES || 0) > job.attemptsMade;

    try {
      return await renderProject(projectId, {
        userId,
        force: true,
        shouldRetry,
        debugFail: simulate,
        onProgress: (p) => job.updateProgress(p).catch(() => {}),
      });
    } catch (err) {
      // Permanent problems must not be retried
      if (!isRetryable(err)) throw new UnrecoverableError(err.message);
      throw err;
    }
  },
  // One render at a time: FFmpeg is CPU-heavy and TTS has rate limits
  { connection: createConnection('worker'), concurrency: 1 }
);

worker.on('completed', (job, result) =>
  logger.info({ jobId: job.id, durationSec: result.durationSec }, 'Render completed')
);
worker.on('failed', (job, err) =>
  logger.error(
    { jobId: job?.id, attemptsMade: job?.attemptsMade, err: err.message },
    'Render attempt failed in queue'
  )
);
worker.on('error', (err) => logger.error({ err: err.message }, 'Worker error'));

logger.info('Render worker ready');

async function shutdown(signal) {
  logger.info(`${signal} received, finishing the current job and closing`);
  await worker.close();
  await mongoose.disconnect();
  process.exit(0);
}
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));