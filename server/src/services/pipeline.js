import path from 'node:path';
import { rm } from 'node:fs/promises';
import mongoose from 'mongoose';
import { Project } from '../models/Project.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../config/logger.js';
import { generateNarration } from './narration.js';
import { fetchFootage } from './footage.js';
import { assembleReel } from './assembler.js';
import { getDuration } from './ffmpeg.js';

// Run from the server/ folder, like the other services
const STORAGE_ROOT = path.resolve('storage', 'projects');
const STALE_MS = 15 * 60 * 1000; // a "rendering" project older than this is treated as crashed

export async function renderProject(projectId, { userId, onProgress = () => {} } = {}) {
  if (!mongoose.isValidObjectId(projectId)) throw new AppError('Project not found', 404);

  const owner = userId ? { user: userId } : {};

  // Atomically claim the project so two renders can never run on it at once
  const project = await Project.findOneAndUpdate(
    {
      _id: projectId,
      ...owner,
      'script.scenes.0': { $exists: true },
      $or: [
        { status: { $ne: 'rendering' } },
        { updatedAt: { $lt: new Date(Date.now() - STALE_MS) } },
      ],
    },
    { $set: { status: 'rendering' }, $unset: { renderError: 1 } },
    { returnDocument: 'after' }
  );

  if (!project) {
    const existing = await Project.findOne({ _id: projectId, ...owner }).select('script');
    if (!existing) throw new AppError('Project not found', 404);
    if (!existing.script?.scenes?.length) throw new AppError('Project has no script yet', 400);
    throw new AppError('Project is already rendering', 409);
  }

  const dir = path.join(STORAGE_ROOT, String(project._id));

  try {
    await rm(dir, { recursive: true, force: true }); // clean up any earlier attempt
    const script = project.script;

    onProgress({ stage: 'narration', percent: 5 });
    const audio = await generateNarration(script, path.join(dir, 'audio'));

    onProgress({ stage: 'footage', percent: 45 });
    const footage = await fetchFootage(script, path.join(dir, 'footage'), {
      durations: audio.map((a) => a.audioSec),
    });

    onProgress({ stage: 'assembling', percent: 60 });
    const scenes = audio.map((a, i) => ({
      clipFile: footage[i].file,
      audioFile: a.audioFile,
      audioSec: a.audioSec,
      narration: script.scenes[i].narration,
    }));
    const outFile = path.join(dir, 'reel.mp4');
    await assembleReel(scenes, outFile, dir);

    const durationSec = await getDuration(outFile);
    const videoPath = path.join(String(project._id), 'reel.mp4'); // relative to storage/projects

    await Project.updateOne(
      { _id: project._id },
      {
        $set: {
          status: 'rendered',
          videoPath,
          videoDurationSec: durationSec,
          renderedAt: new Date(),
          credits: footage.map((f) => ({
            scene: f.index + 1,
            provider: f.provider,
            author: f.author,
            source: f.pageUrl,
          })),
        },
      }
    );

    onProgress({ stage: 'done', percent: 100 });
    return { projectId: String(project._id), videoFile: outFile, durationSec };
  } catch (err) {
    logger.error({ err, projectId: String(project._id) }, 'Render failed');
    await Project.updateOne(
      { _id: project._id },
      { $set: { status: 'failed', renderError: String(err.message).slice(0, 500) } }
    );
    throw err;
  }
}