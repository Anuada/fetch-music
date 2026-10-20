import { Router } from 'express';
import { asyncRoute } from '../lib/http.js';
import { parseOrThrow, videoIdSchema, videoQualitySchema } from '../lib/validation.js';
import { prefetchAudio, proxyAudio, proxyVideo } from '../services/audio.js';

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
  '/stream/:videoId/video',
  asyncRoute(async (req, res) => {
    const videoId = parseOrThrow(videoIdSchema, req.params.videoId);
    const quality = parseOrThrow(videoQualitySchema, req.query.q ?? '720p');
    await proxyVideo(req, res, videoId, quality);
  }),
);

streamRouter.all(
  '/stream/:videoId',
  asyncRoute(async (req, res) => {
    const videoId = parseOrThrow(videoIdSchema, req.params.videoId);
    await proxyAudio(req, res, videoId);
  }),
);
