import { Router } from 'express';
import { scriptRequestSchema } from '../schemas/script.js';
import { generateScript } from '../services/scriptService.js';
import { Project } from '../models/Project.js';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const parsed = scriptRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      });
    }

    const script = await generateScript(parsed.data);
    const totalSeconds = script.scenes.reduce((sum, s) => sum + s.durationSec, 0);

    const project = await Project.create({
      ...parsed.data,
      user: req.user.id,
      script,
      status: 'scripted',
    });

    res.json({ projectId: project._id, script, totalSeconds });
  } catch (err) {
    next(err);
  }
});

export default router;