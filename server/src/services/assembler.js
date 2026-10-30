import path from 'node:path';
import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { runFfmpeg, getDuration } from './ffmpeg.js';
import { buildAss } from './captions.js';

const PAD_SEC = 0.35;
const BASE_FILTER =
  'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,format=yuv420p';

async function renderSegment({ clipFile, audioFile, audioSec, captionName, segDir, outFile }) {
  const duration = (audioSec + PAD_SEC).toFixed(2);
  const filter = captionName ? `${BASE_FILTER},subtitles=${captionName}` : BASE_FILTER;

  await runFfmpeg(
    [
      '-stream_loop', '-1', '-i', path.resolve(clipFile),
      '-i', path.resolve(audioFile),
      '-vf', filter,
      '-af', 'apad',
      '-map', '0:v:0', '-map', '1:a:0',
      '-t', duration,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2',
      '-movflags', '+faststart',
      path.resolve(outFile),
    ],
    { cwd: segDir, timeoutMs: 180000 } // run inside segDir so the caption file name stays simple
  );
}

async function findMusic() {
  const dir = path.resolve(process.env.MUSIC_DIR || 'storage/music');
  try {
    const files = (await readdir(dir)).filter((f) => /\.(mp3|m4a|wav)$/i.test(f));
    return files.length ? path.join(dir, files[0]) : null;
  } catch {
    return null;
  }
}

async function addMusic(videoFile, musicFile, outFile, volume = 0.1) {
  const total = await getDuration(videoFile);
  const fadeOutAt = Math.max(total - 1.5, 0).toFixed(2);

  await runFfmpeg(
    [
      '-i', videoFile,
      '-stream_loop', '-1', '-i', musicFile, // loop the track if it is shorter than the reel
      '-filter_complex',
      `[1:a]volume=${volume},afade=t=in:st=0:d=1.5,afade=t=out:st=${fadeOutAt}:d=1.5[m];` +
        `[0:a][m]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]`,
      '-map', '0:v', '-map', '[a]',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
      '-t', total.toFixed(2),
      '-movflags', '+faststart',
      outFile,
    ],
    { timeoutMs: 180000 }
  );
}

// scenes: [{ clipFile, audioFile, audioSec, narration }]
export async function assembleReel(scenes, outFile, workDir, { captions = true, music = true } = {}) {
  const segDir = path.resolve(workDir, 'segments');
  await mkdir(segDir, { recursive: true });
  await mkdir(path.dirname(path.resolve(outFile)), { recursive: true });

  const names = [];
  for (const [i, scene] of scenes.entries()) {
    const n = String(i + 1).padStart(2, '0');
    const segName = `seg-${n}.mp4`;

    let captionName;
    if (captions && scene.narration) {
      captionName = `cap-${n}.ass`;
      await writeFile(path.join(segDir, captionName), buildAss(scene.narration, scene.audioSec));
    }

    await renderSegment({ ...scene, captionName, segDir, outFile: path.join(segDir, segName) });
    names.push(segName);
  }

  const musicFile = music ? await findMusic() : null;
  if (music && !musicFile) console.warn('No music file found, rendering without background music');

  const joined = musicFile ? path.resolve(workDir, 'joined.mp4') : path.resolve(outFile);
  const listFile = path.join(segDir, 'list.txt');
  await writeFile(listFile, names.map((n) => `file '${n}'`).join('\n'));

  await runFfmpeg(
    ['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-movflags', '+faststart', joined],
    { timeoutMs: 180000 }
  );

  if (musicFile) await addMusic(joined, musicFile, path.resolve(outFile));
  return outFile;
}