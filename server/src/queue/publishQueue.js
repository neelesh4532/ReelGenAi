import { Queue } from 'bullmq';
import { createConnection } from './connection.js';
import { logger } from '../config/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { PUBLISH_QUEUE, publishJobIdFor } from './constants.js';

const ACTIVE_STATES = ['waiting', 'active', 'delayed', 'prioritized', 'waiting-children'];

export const publishQueue = new Queue(PUBLISH_QUEUE, {
  connection: createConnection('api'),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60000 }, // 1 minute, then 2
    removeOnComplete: { age: 3600, count: 100 },
    removeOnFail: { age: 24 * 3600, count: 200 },
  },
});

publishQueue.on('error', (err) => logger.error({ err: err.message }, 'Publish queue error'));

function withTimeout(promise, ms = 5000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Queue timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export const getPublishJob = (projectId) =>
  withTimeout(publishQueue.getJob(publishJobIdFor(projectId)));

// delayMs > 0 schedules the post. expectedVideoUrl makes the job refuse to post a different video later.
export async function enqueuePublish(projectId, userId, { delayMs = 0, expectedVideoUrl } = {}) {
  const existing = await getPublishJob(projectId);

  if (existing) {
    const state = await existing.getState();
    if (ACTIVE_STATES.includes(state)) return { job: existing, alreadyActive: true };
    await existing.remove(); // finished or failed jobs keep their id until removed
  }

  const job = await withTimeout(
    publishQueue.add(
      'publish-reel',
      { projectId: String(projectId), userId: String(userId), expectedVideoUrl },
      { jobId: publishJobIdFor(projectId), ...(delayMs > 0 ? { delay: delayMs } : {}) }
    )
  );
  return { job, alreadyActive: false };
}

// Removes a scheduled (or waiting) job. A job that is already running cannot be cancelled.
export async function cancelPublish(projectId) {
  const job = await getPublishJob(projectId);
  if (!job) return false;
  if ((await job.getState()) === 'active') {
    throw new AppError('Publishing has already started and cannot be cancelled', 409);
  }
  await job.remove();
  return true;
}