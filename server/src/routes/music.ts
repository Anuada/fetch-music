import { Router } from 'express';
import { asyncRoute } from '../lib/http.js';
import { collectionIdSchema, parseOrThrow, videoIdSchema } from '../lib/validation.js';
import { getAlbum, getArtist, getHome, getPlaylist, getTrackDetail } from '../services/youtube.js';

export const musicRouter = Router();

musicRouter.get(
  '/home',
  asyncRoute(async (_req, res) => {
    res.json({ sections: await getHome() });
  }),
);

musicRouter.get(
  '/album/:id',
  asyncRoute(async (req, res) => {
    const id = parseOrThrow(collectionIdSchema, req.params.id);
    res.json(await getAlbum(id));
  }),
);

musicRouter.get(
  '/artist/:id',
  asyncRoute(async (req, res) => {
    const id = parseOrThrow(collectionIdSchema, req.params.id);
    res.json(await getArtist(id));
  }),
);

musicRouter.get(
  '/playlist/:id',
  asyncRoute(async (req, res) => {
    const id = parseOrThrow(collectionIdSchema, req.params.id);
    res.json(await getPlaylist(id));
  }),
);

musicRouter.get(
  '/track/:videoId',
  asyncRoute(async (req, res) => {
    const videoId = parseOrThrow(videoIdSchema, req.params.videoId);
    res.json(await getTrackDetail(videoId));
  }),
);
