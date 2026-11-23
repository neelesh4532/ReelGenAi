import 'dotenv/config';
import { Worker, UnrecoverableError } from 'bullmq';
import mongoose from 'mongoose';
import { logger } from './config/logger.js';
import { connectDB } from './config/db.js';
import { assertEncryptionKey } from './services/crypto.js';
import { createConnection } from './queue/connection.js';
import { RENDER_QUEUE, PUBLISH_QUEUE } from './queue/constants.js';
import { renderProject } from './services/pipeline.js';
import { publishProject } from './services/publishProject.js';
import { isRetryable } from './services/retry.js';
import { isRetryablePublish } from './services/publisher.js';

assertEncryptionKey(); // publishing needs to decrypt the Instagram token

await connectDB().catch((err) => {
  logger.error({ err: err.message }, 'Worker could not connect to MongoDB');
  process.exit(1);
});

const renderWorker = new Worker(
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
      if (!isRetryable(err)) throw new UnrecoverableError(err.message);
      throw err;
    }
  },
  { connection: createConnection('worker'), concurrency: 1 }
);

const publishWorker = new Worker(
  PUBLISH_QUEUE,
  async (job) => {
    const { projectId, userId } = job.data;
    const attempt = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? 1;
    logger.info({ jobId: job.id, projectId, attempt, maxAttempts }, 'Publish started');

    const shouldRetry = (err) => isRetryablePublish(err) && attempt < maxAttempts;

    try {
      return await publishProject(projectId, {
        userId,
        shouldRetry,
        onProgress: (p) => job.updateProgress(p).catch(() => {}),
      });
    } catch (err) {
      if (!isRetryablePublish(err)) throw new UnrecoverableError(err.message);
      throw err;
    }
  },
  { connection: createConnection('worker'), concurrency: 1 }
);

for (const [name, worker] of [['Render', renderWorker], ['Publish', publishWorker]]) {
  worker.on('completed', (job) => logger.info({ jobId: job.id }, `${name} completed`));
  worker.on('failed', (job, err) =>
    logger.error({ jobId: job?.id, attemptsMade: job?.attemptsMade, err: err.message }, `${name} attempt failed in queue`)
  );
  worker.on('error', (err) => logger.error({ err: err.message }, `${name} worker error`));
}

logger.info('Render and publish workers ready');

async function shutdown(signal) {
  logger.info(`${signal} received, finishing the current jobs and closing`);
  await Promise.all([renderWorker.close(), publishWorker.close()]);
  await mongoose.disconnect();
  process.exit(0);
}
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));