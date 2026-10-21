import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const rootDir = path.resolve(here, '../..');
export const serverDir = path.join(rootDir, 'server');

function resolveDataDir(): string {
  const fallback = path.join(rootDir, 'data');
  const requested = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : fallback;
  try {
    fs.mkdirSync(requested, { recursive: true });
    fs.accessSync(requested, fs.constants.W_OK);
    return requested;
  } catch (error) {
    console.warn(
      `Warning: DATA_DIR "${requested}" is not writable (${(error as Error).message}). Falling back to "${fallback}".`,
    );
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

export const dataDir = resolveDataDir();
export const downloadsDir = path.join(dataDir, 'downloads');
export const dbPath = path.join(dataDir, 'library.db');
export const binDir = path.join(serverDir, 'bin');
export const clientDist = path.join(rootDir, 'client', 'dist');
export const port = Number(process.env.PORT ?? 8787);
export const host = process.env.HOST ?? '0.0.0.0';

export const ytDlpPath = path.join(binDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
export const ffmpegPath = path.join(binDir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
