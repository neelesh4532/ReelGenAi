import { spawn } from 'node:child_process';

export function runFfmpeg(args, { timeoutMs = 120000, cwd } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], {
      windowsHide: true,
      cwd,
    });
    
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d; });

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('FFmpeg timed out'));
    }, timeoutMs);

    proc.on('error', (err) => { clearTimeout(timer); reject(err); });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
    });
  });
}

export function getDuration(file) {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
      { windowsHide: true }
    );

    let out = '';
    let err = '';
    proc.stdout.on('data', (d) => { out += d; });
    proc.stderr.on('data', (d) => { err += d; });
    proc.on('error', reject);
    proc.on('close', (code) =>
      code === 0 ? resolve(parseFloat(out)) : reject(new Error(err.slice(-300)))
    );
  });
}
export function getVideoSize(file) {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'ffprobe',
      ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height',
       '-of', 'csv=p=0:s=x', file],
      { windowsHide: true }
    );

    let out = '';
    let err = '';
    proc.stdout.on('data', (d) => { out += d; });
    proc.stderr.on('data', (d) => { err += d; });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(err.slice(-300)));
      const [width, height] = out.trim().split('x').map(Number);
      resolve({ width, height });
    });
  });
}
