import { Router } from 'express';
import { asyncRoute } from '../lib/http.js';
import { clearYoutubeCache } from '../services/youtube.js';
import { clearStreamCache } from '../services/audio.js';

export const systemRouter = Router();

systemRouter.post(
  '/system/clear-cache',
  asyncRoute(async (_req, res) => {
    clearYoutubeCache();
    clearStreamCache();
    res.json({ ok: true, message: 'Caches cleared' });
  }),
);

systemRouter.get(
  '/system/health',
  asyncRoute(async (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  }),
);