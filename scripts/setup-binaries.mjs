import { createWriteStream, existsSync, mkdirSync, copyFileSync, chmodSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const binDir = join(root, 'server', 'bin');
const require = createRequire(join(root, 'package.json'));
mkdirSync(binDir, { recursive: true });

const isWindows = process.platform === 'win32';
const ytDlpPath = join(binDir, isWindows ? 'yt-dlp.exe' : 'yt-dlp');

async function downloadYtDlp() {
  if (existsSync(ytDlpPath)) {
    console.log(`yt-dlp already present at ${ytDlpPath}`);
    return;
  }
  const asset = isWindows ? 'yt-dlp.exe' : process.platform === 'darwin' ? 'yt-dlp_macos' : 'yt-dlp_linux';
  const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`;
  console.log(`Downloading ${asset}...`);
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download yt-dlp: HTTP ${response.status}`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(ytDlpPath));
  if (!isWindows) chmodSync(ytDlpPath, 0o755);
  console.log(`Saved ${ytDlpPath}`);
}

function copyFfmpeg() {
  const packages = [
    ['ffmpeg-static', isWindows ? 'ffmpeg.exe' : 'ffmpeg'],
    ['ffprobe-static', isWindows ? 'ffprobe.exe' : 'ffprobe'],
  ];
  for (const [pkg, name] of packages) {
    let source;
    try {
      const loaded = require(pkg);
      source = pkg === 'ffmpeg-static' ? loaded : loaded.path;
    } catch (error) {
      console.warn(`${pkg} is not installed (${error.message}); ${name} will be skipped.`);
      continue;
    }
    if (!source || !existsSync(source)) {
      console.warn(`${pkg} binary not found; ${name} will be skipped.`);
      continue;
    }
    const target = join(binDir, name);
    copyFileSync(source, target);
    if (!isWindows) chmodSync(target, 0o755);
    console.log(`Copied ${name}`);
  }
}

await downloadYtDlp();
copyFfmpeg();
console.log('Binary setup complete.');
