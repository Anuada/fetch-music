import { Router } from 'express';
import { asyncRoute } from '../lib/http.js';
import { parseOrThrow, videoIdSchema } from '../lib/validation.js';
import { prefetchAudio, proxyAudio } from '../services/audio.js';

export const streamRouter = Router();

streamRouter.get(
  '/stream/:videoId/prefetch',
  asyncRoute(async (req, res) => {
    const videoId = parseOrThrow(videoIdSchema, req.params.videoId);
    await prefetchAudio(videoId);
    res.status(204).end();
  }),
);

streamRouter.all(
  '/stream/:videoId',
  asyncRoute(async (req, res) => {
    const videoId = parseOrThrow(videoIdSchema, req.params.videoId);
    await proxyAudio(req, res, videoId);
  }),
);
