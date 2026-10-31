import { Queue } from 'bullmq';
import { createConnection } from './connection.js';
import { logger } from '../config/logger.js';
import { RENDER_QUEUE, jobIdFor } from './constants.js';

const ACTIVE_STATES = ['waiting', 'active', 'delayed', 'prioritized', 'waiting-children'];

export const renderQueue = new Queue(RENDER_QUEUE, {
  connection: createConnection('api'),
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 3600, count: 100 },
    removeOnFail: { age: 24 * 3600, count: 200 },
  },
});

renderQueue.on('error', (err) => logger.error({ err: err.message }, 'Render queue error'));

// Never let an API request hang because Redis is unreachable
function withTimeout(promise, ms = 5000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Queue timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function getRenderJob(projectId) {
  return withTimeout(renderQueue.getJob(jobIdFor(projectId)));
}

export async function enqueueRender(projectId, userId) {
  const existing = await getRenderJob(projectId);

  if (existing) {
    const state = await existing.getState();
    if (ACTIVE_STATES.includes(state)) return { job: existing, alreadyActive: true };
    await existing.remove(); // finished or failed jobs keep their id until removed
  }

  const job = await withTimeout(
    renderQueue.add(
      'render-project',
      { projectId: String(projectId), userId: String(userId) },
      { jobId: jobIdFor(projectId) }
    )
  );
  return { job, alreadyActive: false };
}