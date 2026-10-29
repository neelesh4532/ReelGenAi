import { runFfmpeg, getDuration } from '../src/services/ffmpeg.js';

await runFfmpeg([
  '-loop', '1', '-i', 'storage/bg.png',
  '-i', 'storage/tone.mp3',
  '-c:v', 'libx264', '-tune', 'stillimage',
  '-c:a', 'aac', '-pix_fmt', 'yuv420p', '-r', '30',
  '-shortest', 'storage/demo.mp4',
]);

console.log('Created storage/demo.mp4, duration:', await getDuration('storage/demo.mp4'), 'seconds');