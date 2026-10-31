import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { Project } from '../src/models/Project.js';
import { renderProject } from '../src/services/pipeline.js';

await connectDB();

try {
  let id = process.argv[2];

  if (!id || id === '--latest') {
    const latest = await Project.findOne({ 'script.scenes.0': { $exists: true } })
      .sort({ createdAt: -1 })
      .select('_id topic');
    if (!latest) throw new Error('No project with a script found. Create one with POST /api/scripts first.');
    id = String(latest._id);
    console.log(`Using latest project: "${latest.topic}" (${id})`);
  }

  const t0 = Date.now();
  const result = await renderProject(id, {
    onProgress: (p) => console.log(`[${String(p.percent).padStart(3)}%] ${p.stage}`),
  });
  console.log(`Rendered in ${Math.round((Date.now() - t0) / 1000)}s -> ${result.videoFile} (${result.durationSec.toFixed(1)}s)`);
} finally {
  await mongoose.disconnect();
}