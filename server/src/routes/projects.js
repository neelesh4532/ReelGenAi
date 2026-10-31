import { Router } from 'express';
import mongoose from 'mongoose';
import { Project } from '../models/Project.js';
import { AppError } from '../middleware/errorHandler.js';
import { enqueueRender, getRenderJob } from '../queue/renderQueue.js';

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
router.post('/:id/render', async (req, res, next) => {
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
    const project = await ownedProject(req, 'status renderError videoDurationSec renderedAt');

    let job = null;
    try {
      const j = await getRenderJob(project._id);
      if (j) job = { state: await j.getState(), progress: j.progress };
    } catch {
      // queue unavailable: fall back to the database status only
    }

    res.json({
      status: project.status,
      renderError: project.renderError,
      videoDurationSec: project.videoDurationSec,
      renderedAt: project.renderedAt,
      job,
    });
  } catch (err) {
    next(err);
  }
});

export default router;