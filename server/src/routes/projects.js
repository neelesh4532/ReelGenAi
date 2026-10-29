import { Router } from 'express';
import { Project } from '../models/Project.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const projects = await Project.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .select('topic tone status createdAt');
    res.json({ projects });
  } catch (err) {
    next(err);
  }
});

export default router;