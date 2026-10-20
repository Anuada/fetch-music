import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { downloadsDir } from '../config.js';
import {
  deleteDownload as deleteDownloadRow,
  failInterruptedDownloads,
  getDownload as getDownloadRow,
  insertDownload,
  listDownloads as listDownloadRows,
  updateDownload as updateDownloadRow,
} from '../db.js';
import type { DownloadJob, DownloadRecord, Track } from '../types.js';
import { spawnDownload } from './audio.js';

function publicJob(record: DownloadRecord): DownloadJob {
  const { filePath: _filePath, ...job } = record;
  return job;
}

function safeName(value: string): string {
  return value
    .replace(/[<>:"/\\|?*]/g, '')
    .split('')
    .filter((character) => character.charCodeAt(0) > 31)
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
}

class DownloadManager extends EventEmitter {
  private jobs = new Map<string, DownloadRecord>();
  private queue: string[] = [];
  private active: { id: string; child: ReturnType<typeof spawnDownload>['child'] } | null = null;

  constructor() {
    super();
    failInterruptedDownloads();
    for (const record of listDownloadRows()) this.jobs.set(record.id, record);
  }

  list(): DownloadJob[] {
    return [...this.jobs.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(publicJob);
  }

  get(id: string): DownloadJob | undefined {
    const record = this.jobs.get(id) ?? getDownloadRow(id);
    return record ? publicJob(record) : undefined;
  }

  start(track: Track, format: 'mp3' | 'm4a'): DownloadJob {
    const existing = [...this.jobs.values()].find(
      (job) =>
        job.videoId === track.id &&
        job.format === format &&
        (job.status === 'queued' || job.status === 'downloading'),
    );
    if (existing) return publicJob(existing);

    const now = new Date().toISOString();
    const record: DownloadRecord = {
      id: randomUUID(),
      videoId: track.id,
      title: track.title,
      artist: track.artist,
      thumbnail: track.thumbnail,
      format,
      status: 'queued',
      progress: 0,
      speed: '',
      eta: '',
      error: null,
      fileName: `${safeName(`${track.artist} - ${track.title}`) || track.id}.${format}`,
      filePath: null,
      createdAt: now,
      completedAt: null,
    };
    insertDownload(record);
    this.jobs.set(record.id, record);
    this.queue.push(record.id);
    this.emit('update', publicJob(record));
    this.startNext();
    return publicJob(record);
  }

  cancel(id: string): DownloadJob | undefined {
    const record = this.jobs.get(id);
    if (!record) return undefined;
    if (record.status !== 'queued' && record.status !== 'downloading') return publicJob(record);

    this.queue = this.queue.filter((queued) => queued !== id);
    record.status = 'cancelled';
    record.speed = '';
    record.eta = '';
    this.persist(id, { status: 'cancelled', speed: '', eta: '' });
    this.emit('update', publicJob(record));

    if (this.active?.id === id) {
      this.active.child.kill();
    }
    return publicJob(record);
  }

  retry(id: string): DownloadJob | undefined {
    const record = this.jobs.get(id);
    if (!record || (record.status !== 'failed' && record.status !== 'cancelled')) return undefined;
    record.status = 'queued';
    record.progress = 0;
    record.speed = '';
    record.eta = '';
    record.error = null;
    record.completedAt = null;
    this.persist(id, {
      status: 'queued',
      progress: 0,
      speed: '',
      eta: '',
      error: null,
      completedAt: null,
    });
    this.queue.push(id);
    this.emit('update', publicJob(record));
    this.startNext();
    return publicJob(record);
  }

  remove(id: string): boolean {
    const record = this.jobs.get(id);
    if (!record) return false;
    if (record.status === 'queued' || record.status === 'downloading') this.cancel(id);
    this.jobs.delete(id);
    this.queue = this.queue.filter((queued) => queued !== id);
    deleteDownloadRow(id);
    return true;
  }

  private persist(
    id: string,
    changes: Parameters<typeof updateDownloadRow>[1],
  ): void {
    updateDownloadRow(id, changes);
  }

  private startNext(): void {
    if (this.active) return;
    const id = this.queue.shift();
    if (!id) return;
    const record = this.jobs.get(id);
    if (!record || record.status !== 'queued') {
      this.startNext();
      return;
    }

    let destination = '';
    let stderr = '';
    let finished = false;

    const finish = (code: number | null) => {
      if (finished) return;
      finished = true;
      this.active = null;
      const job = this.jobs.get(id);
      if (!job) {
        this.startNext();
        return;
      }
      if (job.status === 'cancelled') {
        this.startNext();
        return;
      }

      if (code === 0) {
        const file = this.findOutput(id, job.format, destination);
        if (!file) {
          job.status = 'failed';
          job.error = 'Download finished but no audio file was found.';
          this.persist(id, { status: 'failed', error: job.error, speed: '', eta: '' });
        } else {
          job.status = 'completed';
          job.progress = 100;
          job.speed = '';
          job.eta = '';
          job.error = null;
          job.filePath = file;
          job.completedAt = new Date().toISOString();
          this.persist(id, {
            status: 'completed',
            progress: 100,
            speed: '',
            eta: '',
            error: null,
            filePath: file,
            completedAt: job.completedAt,
          });
        }
      } else {
        const message = stderr.trim().split(/\r?\n/).filter(Boolean).slice(-1)[0] ?? '';
        job.status = 'failed';
        job.error = message || `yt-dlp exited with code ${code ?? 'unknown'}`;
        this.persist(id, { status: 'failed', error: job.error, speed: '', eta: '' });
      }
      this.emit('update', publicJob(job));
      this.startNext();
    };

    try {
      const process = spawnDownload(id, record.videoId, record.format);
      this.active = { id, child: process.child };
      record.status = 'downloading';
      this.persist(id, { status: 'downloading' });
      this.emit('update', publicJob(record));

      process.child.stdout.setEncoding('utf8');
      process.child.stderr.setEncoding('utf8');

      process.child.stdout.on('data', (chunk: string) => {
        for (const line of chunk.split(/\r?\n/)) {
          if (!line) continue;
          const percent = line.match(/\[download\]\s+([\d.]+)%/);
          if (percent) {
            const job = this.jobs.get(id);
            if (!job || job.status !== 'downloading') continue;
            job.progress = Math.max(0, Math.min(99.9, Number(percent[1])));
            job.speed = line.match(/\bat\s+([^\s]+\/s)/)?.[1] ?? job.speed;
            job.eta = line.match(/ETA\s+([\d:]+)/)?.[1] ?? job.eta;
            this.persist(id, { progress: job.progress, speed: job.speed, eta: job.eta });
            this.emit('update', publicJob(job));
          }
          if (line.includes('Destination:')) {
            destination = line.split('Destination:').slice(1).join('Destination:').trim();
          }
        }
      });

      process.child.stderr.on('data', (chunk: string) => {
        stderr = (stderr + chunk).slice(-16_000);
      });

      process.child.on('error', (error) => {
        stderr = `${stderr}\n${error.message}`;
        finish(1);
      });

      process.child.on('close', (code) => finish(code));
    } catch (error) {
      record.status = 'failed';
      record.error = error instanceof Error ? error.message : 'Could not start yt-dlp';
      this.persist(id, { status: 'failed', error: record.error, speed: '', eta: '' });
      this.emit('update', publicJob(record));
      this.active = null;
      this.startNext();
    }
  }

  private findOutput(id: string, format: string, destination: string): string | null {
    if (destination) {
      const candidate = path.isAbsolute(destination) ? destination : path.join(downloadsDir, destination);
      if (fs.existsSync(candidate)) return candidate;
    }
    try {
      const files = fs
        .readdirSync(downloadsDir)
        .filter((name) => name.startsWith(`${id}.`) && !name.endsWith('.part'));
      const preferred = files.find((name) => name.endsWith(`.${format}`)) ?? files[0];
      return preferred ? path.join(downloadsDir, preferred) : null;
    } catch {
      return null;
    }
  }

  shutdown(): void {
    if (this.active) this.active.child.kill();
  }
}

export const downloadManager = new DownloadManager();
