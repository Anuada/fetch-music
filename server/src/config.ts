import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const rootDir = path.resolve(here, '../..');
export const serverDir = path.join(rootDir, 'server');
export const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(rootDir, 'data');
export const downloadsDir = path.join(dataDir, 'downloads');
export const dbPath = path.join(dataDir, 'library.db');
export const binDir = path.join(serverDir, 'bin');
export const clientDist = path.join(rootDir, 'client', 'dist');
export const port = Number(process.env.PORT ?? 8787);
export const host = process.env.HOST ?? '127.0.0.1';

export const ytDlpPath = path.join(binDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
export const ffmpegPath = path.join(binDir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
