import fs from 'node:fs';
import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { promisify } from 'node:util';
import { Readable } from 'node:stream';
import type { Request, Response } from 'express';
import { binDir, downloadsDir, ffmpegPath, ytDlpPath } from '../config.js';
import { HttpError } from '../lib/http.js';
import { resolveAudioStream } from './youtube.js';

const execFileAsync = promisify(execFile);

interface AudioSource {
  url: string;
  expires: number;
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

const sourceCache = new Map<string, AudioSource>();
const pending = new Map<string, Promise<AudioSource>>();

export function binariesAvailable(): boolean {
  return fs.existsSync(ytDlpPath) && fs.existsSync(ffmpegPath);
}

export function assertBinaries(): void {
  if (!binariesAvailable()) {
    throw new HttpError(503, 'yt-dlp or ffmpeg is missing. Run npm run setup:bin.');
  }
}

async function resolveWithYtDlp(videoId: string): Promise<string> {
  if (!fs.existsSync(ytDlpPath)) {
    throw new HttpError(502, 'Could not resolve this track and yt-dlp is not installed.');
  }
  const { stdout } = await execFileAsync(
    ytDlpPath,
    [
      '--no-warnings',
      '--no-playlist',
      '--no-check-certificates',
      '-f',
      'bestaudio[ext=m4a]/bestaudio/best',
      '--get-url',
      `https://www.youtube.com/watch?v=${videoId}`,
    ],
    { timeout: 45_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
  );
  const url = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith('https://'));
  if (!url) throw new HttpError(502, 'yt-dlp did not return an audio URL');
  return url;
}

async function resolveAudioSource(videoId: string, force = false): Promise<AudioSource> {
  const hit = sourceCache.get(videoId);
  if (!force && hit && hit.expires > Date.now()) return hit;
  const existing = pending.get(videoId);
  if (existing) return existing;

  const task = (async () => {
    let source: AudioSource;
    try {
      const stream = await resolveAudioStream(videoId);
      source = { url: stream.url, expires: stream.expires };
    } catch {
      source = { url: await resolveWithYtDlp(videoId), expires: Date.now() + 25 * 60_000 };
    }
    sourceCache.set(videoId, source);
    return source;
  })();

  pending.set(videoId, task);
  try {
    return await task;
  } finally {
    pending.delete(videoId);
  }
}

export async function prefetchAudio(videoId: string): Promise<void> {
  await resolveAudioSource(videoId);
}

export async function proxyAudio(req: Request, res: Response, videoId: string): Promise<void> {
  let source = await resolveAudioSource(videoId);
  const controller = new AbortController();
  res.on('close', () => controller.abort());

  const requestUpstream = async (audio: AudioSource, bounded = false) => {
    const headers: Record<string, string> = {
      'user-agent': USER_AGENT,
      accept: '*/*',
      'accept-encoding': 'identity',
    };
    if (bounded) headers.range = 'bytes=0-1048575';
    else if (req.headers.range) headers.range = req.headers.range;
    else headers.range = 'bytes=0-';
    return fetch(audio.url, {
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      headers,
      redirect: 'follow',
      signal: controller.signal,
    });
  };

  let upstream = await requestUpstream(source);
  if (upstream.status === 403 || upstream.status === 410) {
    source = await resolveAudioSource(videoId, true);
    upstream = await requestUpstream(source);
    if (upstream.status === 403 || upstream.status === 410) {
      upstream = await requestUpstream(source, true);
    }
  }

  if (!upstream.ok && upstream.status !== 206) {
    throw new HttpError(502, `Audio source responded with ${upstream.status}`);
  }

  const contentRange = upstream.headers.get('content-range') ?? '';
  const fullRange = /^bytes 0-(\d+)\/(\d+)$/.exec(contentRange);
  const fullResponse =
    !req.headers.range &&
    upstream.status === 206 &&
    !!fullRange &&
    Number(fullRange[1]) === Number(fullRange[2]) - 1;
  res.status(fullResponse ? 200 : upstream.status);
  const copyHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag'];
  for (const name of copyHeaders) {
    if (fullResponse && name === 'content-range') continue;
    const value = upstream.headers.get(name);
    if (value) res.setHeader(name, value);
  }
  res.setHeader('cache-control', 'private, max-age=3600');

  if (req.method === 'HEAD' || !upstream.body) {
    res.end();
    return;
  }

  Readable.fromWeb(upstream.body as any)
    .on('error', () => {
      if (!res.headersSent) res.status(502);
      res.end();
    })
    .pipe(res);
}

export interface DownloadProcess {
  child: ChildProcessWithoutNullStreams;
  id: string;
  outputTemplate: string;
}

export function spawnDownload(
  id: string,
  videoId: string,
  format: 'mp3' | 'm4a',
): DownloadProcess {
  assertBinaries();
  fs.mkdirSync(downloadsDir, { recursive: true });
  const outputTemplate = `${id}.%(ext)s`;
  const child = spawn(
    ytDlpPath,
    [
      '--no-warnings',
      '--no-playlist',
      '--newline',
      '--no-mtime',
      '--ffmpeg-location',
      binDir,
      '--extract-audio',
      '--audio-format',
      format,
      '--audio-quality',
      '0',
      '--embed-thumbnail',
      '--add-metadata',
      '--output',
      `${id}.%(ext)s`,
      `https://www.youtube.com/watch?v=${videoId}`,
    ],
    { cwd: downloadsDir, windowsHide: true },
  );
  return { child, id, outputTemplate };
}
