import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { runFfmpeg } from './ffmpeg.js';

const PAD_SEC = 0.35; // short pause after each line so speech never feels cut off

// Fill 1080x1920: scale until the frame is covered, then crop the overflow
const VIDEO_FILTER =
  'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,format=yuv420p';

export async function renderSegment({ clipFile, audioFile, audioSec, outFile }) {
  const duration = (audioSec + PAD_SEC).toFixed(2);

  await runFfmpeg(
    [
      '-stream_loop', '-1', '-i', clipFile, // loop the clip if it is shorter than the narration
      '-i', audioFile,
      '-vf', VIDEO_FILTER,
      '-af', 'apad',                        // pad the audio with silence up to the duration
      '-map', '0:v:0', '-map', '1:a:0',     // video from the clip, sound from the narration only
      '-t', duration,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2',
      '-movflags', '+faststart',
      outFile,
    ],
    { timeoutMs: 180000 }
  );

  return outFile;
}

// scenes: [{ clipFile, audioFile, audioSec }]
export async function assembleReel(scenes, outFile, workDir) {
  const segDir = path.join(workDir, 'segments');
  await mkdir(segDir, { recursive: true });
  await mkdir(path.dirname(outFile), { recursive: true });

  const names = [];
  for (const [i, scene] of scenes.entries()) {
    const name = `seg-${String(i + 1).padStart(2, '0')}.mp4`;
    await renderSegment({ ...scene, outFile: path.join(segDir, name) });
    names.push(name);
  }

  // Every segment has identical codec settings, so joining needs no re-encoding
  const listFile = path.join(segDir, 'list.txt');
  await writeFile(listFile, names.map((n) => `file '${n}'`).join('\n'));

  await runFfmpeg(
    ['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-movflags', '+faststart', outFile],
    { timeoutMs: 180000 }
  );

  return outFile;
}