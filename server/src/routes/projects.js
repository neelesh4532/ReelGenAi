import { Router } from 'express';
import mongoose from 'mongoose';
import { Project } from '../models/Project.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

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
    if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Project not found', 404);
    const project = await Project.findOne({ _id: req.params.id, user: req.user.id });
    if (!project) throw new AppError('Project not found', 404);
    res.json({ project });
  } catch (err) {
    next(err);
  }
});

export default router;