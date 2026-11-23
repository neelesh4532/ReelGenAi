import { Router } from 'express';
import mongoose from 'mongoose';
import { Project } from '../models/Project.js';
import { AppError } from '../middleware/errorHandler.js';
import { enqueueRender, getRenderJob } from '../queue/renderQueue.js';
import { validate } from '../middleware/validate.js';
import { scriptSchema } from '../schemas/script.js';
import { InstagramAccount } from '../models/InstagramAccount.js';
import { enqueuePublish, cancelPublish, getPublishJob } from '../queue/publishQueue.js';
import { parseSchedule } from '../services/schedule.js';
import {renderLimiter, publishLimiter } from '../middleware/rateLimits.js';

const router = Router();

// Loads a project only if it belongs to the logged-in user
async function ownedProject(req, select) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Project not found', 404);
  const query = Project.findOne({ _id: req.params.id, user: req.user.id });
  if (select) query.select(select);
  const project = await query;
  if (!project) throw new AppError('Project not found', 404);
  return project;
}

router.get('/', async (req, res, next) => {
  try {
    const projects = await Project.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('topic tone status createdAt');
    res.json({ projects });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json({ project: await ownedProject(req) });
  } catch (err) {
    next(err);
  }
});

// Starts a render in the background and returns immediately
router.post('/:id/render', renderLimiter, async (req, res, next) => {
  try {
    const project = await ownedProject(req, 'status script.scenes');
    if (!project.script?.scenes?.length) throw new AppError('Project has no script yet', 400);

    let result;
    try {
      result = await enqueueRender(project._id, req.user.id);
    } catch {
      throw new AppError('Render queue is unavailable, try again shortly', 503);
    }
    if (result.alreadyActive) throw new AppError('Render already in progress', 409);

    // Do not overwrite "rendering" if the worker has already picked the job up
    await Project.updateOne(
      { _id: project._id, status: { $ne: 'rendering' } },
      { $set: { status: 'queued' }, $unset: { renderError: 1 } }
    );

    res.status(202).json({ projectId: project._id, jobId: result.job.id, status: 'queued' });
  } catch (err) {
    next(err);
  }
});

// Combines the database status with live job progress from the queue
router.get('/:id/status', async (req, res, next) => {
  try {
    const project = await ownedProject(
      req,
      'status renderError videoDurationSec renderedAt videoUrl publishState publishError scheduledFor igMediaId igPermalink publishedAt publishedVideoUrl'
    );

    let job = null;
    try {
      const j = await getRenderJob(project._id);
      if (j) {
        job = {
          state: await j.getState(),
          progress: j.progress,
          attemptsMade: j.attemptsMade,
          maxAttempts: j.opts.attempts,
          failedReason: j.failedReason,
        };
      }
    } catch {
      // queue unavailable: fall back to the database status only
    }

    // A scheduled or queued post whose job no longer exists (for example after the queue was reset)
    // must not look pending forever
    let publishState = project.publishState;
    let publishError = project.publishError;
    try {
      const publishJob = await getPublishJob(project._id);
      if (!publishJob && ['scheduled', 'queued'].includes(publishState)) {
        publishState = 'failed';
        publishError = 'The scheduled post was lost (the queue was reset). Please schedule it again.';
      }
    } catch {
      // queue unavailable: show the stored state
    }

    res.json({
      status: project.status,
      renderError: project.renderError,
      videoDurationSec: project.videoDurationSec,
      renderedAt: project.renderedAt,
      videoUrl: project.videoUrl,
      job,
      publishState,
      publishError,
      scheduledFor: project.scheduledFor,
      igPermalink: project.igPermalink,
      publishedAt: project.publishedAt,
      publishedCurrent: Boolean(project.igMediaId && project.publishedVideoUrl === project.videoUrl),
    });
  } catch (err) {
    next(err);
  }
});

// Publishes now, or at the time given in { scheduledFor } (ISO date)
router.post('/:id/publish', publishLimiter, async (req, res, next) => {
  try {
    const project = await ownedProject(req, 'status videoUrl igMediaId publishedVideoUrl');
    if (project.status !== 'rendered' || !project.videoUrl) {
      throw new AppError('Render the video first (cloud storage must be on)', 409);
    }
    if (project.igMediaId && project.publishedVideoUrl === project.videoUrl) {
      throw new AppError('This video is already published', 409);
    }
    if (!(await InstagramAccount.exists({ user: req.user.id }))) {
      throw new AppError('Connect Instagram first', 409);
    }

    const schedule = parseSchedule(req.body?.scheduledFor);

    let result;
    try {
      result = await enqueuePublish(project._id, req.user.id, {
        delayMs: schedule?.delayMs ?? 0,
        expectedVideoUrl: project.videoUrl,
      });
    } catch {
      throw new AppError('Publish queue is unavailable, try again shortly', 503);
    }
    if (result.alreadyActive) {
      throw new AppError('A post is already scheduled or in progress for this project. Cancel it first.', 409);
    }

    await Project.updateOne(
      { _id: project._id, publishState: { $ne: 'publishing' } },
      schedule
        ? { $set: { publishState: 'scheduled', scheduledFor: schedule.date }, $unset: { publishError: 1 } }
        : { $set: { publishState: 'queued' }, $unset: { publishError: 1, scheduledFor: 1 } }
    );

    res.status(202).json({
      projectId: project._id,
      publishState: schedule ? 'scheduled' : 'queued',
      scheduledFor: schedule?.date ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// Cancels a scheduled post
router.delete('/:id/publish', async (req, res, next) => {
  try {
    const project = await ownedProject(req, '_id');

    try {
      await cancelPublish(project._id);
    } catch (err) {
      if (err.status) throw err; // for example 409: already publishing
      throw new AppError('Publish queue is unavailable, try again shortly', 503);
    }

    await Project.updateOne(
      { _id: project._id, publishState: { $in: ['scheduled', 'queued'] } },
      { $unset: { publishState: 1, scheduledFor: 1, publishError: 1 } }
    );
    res.json({ cancelled: true });
  } catch (err) {
    next(err);
  }
});

export default router;

// Queues a publish job; the worker talks to Instagram
router.post('/:id/publish', async (req, res, next) => {
  try {
    const project = await ownedProject(req, 'status videoUrl igMediaId publishedVideoUrl');
    if (project.status !== 'rendered' || !project.videoUrl) {
      throw new AppError('Render the video first (cloud storage must be on)', 409);
    }
    if (project.igMediaId && project.publishedVideoUrl === project.videoUrl) {
      throw new AppError('This video is already published', 409);
    }
    if (!(await InstagramAccount.exists({ user: req.user.id }))) {
      throw new AppError('Connect Instagram first', 409);
    }

    let result;
    try {
      result = await enqueuePublish(project._id, req.user.id);
    } catch {
      throw new AppError('Publish queue is unavailable, try again shortly', 503);
    }
    if (result.alreadyActive) throw new AppError('Publishing is already in progress', 409);

    await Project.updateOne(
      { _id: project._id, publishState: { $ne: 'publishing' } },
      { $set: { publishState: 'queued' }, $unset: { publishError: 1 } }
    );
    res.status(202).json({ projectId: project._id, publishState: 'queued' });
  } catch (err) {
    next(err);
  }
});