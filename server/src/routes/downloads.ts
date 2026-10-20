import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { getDownload as getDownloadRow } from '../db.js';
import { asyncRoute, HttpError, notFound } from '../lib/http.js';
import { downloadSchema, idParamSchema, normalizeTrack, parseOrThrow } from '../lib/validation.js';
import { downloadManager } from '../services/downloadManager.js';
import type { DownloadJob } from '../types.js';

export const downloadsRouter = Router();

downloadsRouter.get(
  '/downloads',
  asyncRoute(async (_req, res) => {
    res.json({ downloads: downloadManager.list() });
  }),
);

downloadsRouter.get(
  '/downloads/events',
  asyncRoute(async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const send = (job: DownloadJob) => {
      res.write(`event: update\ndata: ${JSON.stringify(job)}\n\n`);
    };
    for (const job of downloadManager.list()) send(job);

    const listener = (job: DownloadJob) => send(job);
    downloadManager.on('update', listener);
    const heartbeat = setInterval(() => res.write(': keepalive\n\n'), 20_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      downloadManager.off('update', listener);
      res.end();
    });
  }),
);

downloadsRouter.post(
  '/downloads',
  asyncRoute(async (req, res) => {
    const body = parseOrThrow(downloadSchema, req.body);
    const job = downloadManager.start(normalizeTrack(body.track), body.format);
    res.status(202).json(job);
  }),
);

downloadsRouter.post(
  '/downloads/:id/cancel',
  asyncRoute(async (req, res) => {
    const { id } = parseOrThrow(idParamSchema, req.params);
    const job = downloadManager.cancel(id);
    if (!job) throw notFound('Download not found');
    res.json(job);
  }),
);

downloadsRouter.post(
  '/downloads/:id/retry',
  asyncRoute(async (req, res) => {
    const { id } = parseOrThrow(idParamSchema, req.params);
    const job = downloadManager.retry(id);
    if (!job) throw new HttpError(409, 'Only failed or cancelled downloads can be retried');
    res.json(job);
  }),
);

downloadsRouter.get(
  '/downloads/:id/file',
  asyncRoute(async (req, res) => {
    const { id } = parseOrThrow(idParamSchema, req.params);
    const record = getDownloadRow(id);
    if (!record || record.status !== 'completed' || !record.filePath) {
      throw notFound('Downloaded file not found');
    }
    const filePath = path.resolve(record.filePath);
    if (!fs.existsSync(filePath)) throw notFound('Downloaded file is missing from disk');
    res.download(filePath, record.fileName ?? path.basename(filePath));
  }),
);

downloadsRouter.delete(
  '/downloads/:id',
  asyncRoute(async (req, res) => {
    const { id } = parseOrThrow(idParamSchema, req.params);
    if (!downloadManager.remove(id)) throw notFound('Download not found');
    res.status(204).end();
  }),
);
