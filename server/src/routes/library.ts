import { Router } from 'express';
import {
  addTrackToPlaylist,
  clearHistory,
  createPlaylist,
  deletePlaylist,
  getPlaylistWithTracks,
  getStats,
  listHistory,
  listPlaylists,
  recordHistory,
  removePlaylistItem,
  updatePlaylist,
} from '../db.js';
import { asyncRoute, HttpError, notFound } from '../lib/http.js';
import {
  historySchema,
  idParamSchema,
  normalizeTrack,
  parseOrThrow,
  playlistCreateSchema,
  playlistUpdateSchema,
  trackSchema,
} from '../lib/validation.js';

export const libraryRouter = Router();

libraryRouter.get(
  '/library/playlists',
  asyncRoute(async (_req, res) => {
    res.json({ playlists: listPlaylists() });
  }),
);

libraryRouter.post(
  '/library/playlists',
  asyncRoute(async (req, res) => {
    const body = parseOrThrow(playlistCreateSchema, req.body);
    res.status(201).json(createPlaylist(body.name, body.description));
  }),
);

libraryRouter.get(
  '/library/playlists/:id',
  asyncRoute(async (req, res) => {
    const { id } = parseOrThrow(idParamSchema, req.params);
    const playlist = getPlaylistWithTracks(id);
    if (!playlist) throw notFound('Playlist not found');
    res.json(playlist);
  }),
);

libraryRouter.patch(
  '/library/playlists/:id',
  asyncRoute(async (req, res) => {
    const { id } = parseOrThrow(idParamSchema, req.params);
    const body = parseOrThrow(playlistUpdateSchema, req.body);
    const playlist = updatePlaylist(id, body);
    if (!playlist) throw notFound('Playlist not found');
    res.json(playlist);
  }),
);

libraryRouter.delete(
  '/library/playlists/:id',
  asyncRoute(async (req, res) => {
    const { id } = parseOrThrow(idParamSchema, req.params);
    if (!deletePlaylist(id)) throw notFound('Playlist not found');
    res.status(204).end();
  }),
);

libraryRouter.post(
  '/library/playlists/:id/tracks',
  asyncRoute(async (req, res) => {
    const { id } = parseOrThrow(idParamSchema, req.params);
    const body = parseOrThrow(trackSchema, req.body);
    const playlist = addTrackToPlaylist(id, normalizeTrack(body));
    if (!playlist) throw notFound('Playlist not found');
    res.status(201).json(playlist);
  }),
);

libraryRouter.delete(
  '/library/playlists/:id/tracks/:itemId',
  asyncRoute(async (req, res) => {
    const { id } = parseOrThrow(idParamSchema, req.params);
    const itemId = Number.parseInt(String(req.params.itemId), 10);
    if (!Number.isInteger(itemId) || itemId <= 0) throw new HttpError(400, 'Invalid item id');
    const playlist = removePlaylistItem(id, itemId);
    if (!playlist) throw notFound('Playlist not found');
    res.json(playlist);
  }),
);

libraryRouter.get(
  '/library/history',
  asyncRoute(async (req, res) => {
    const limit = Math.min(200, Math.max(1, Number.parseInt(String(req.query.limit ?? '100'), 10) || 100));
    res.json({ history: listHistory(limit) });
  }),
);

libraryRouter.post(
  '/library/history',
  asyncRoute(async (req, res) => {
    const body = parseOrThrow(historySchema, req.body);
    try {
      recordHistory(normalizeTrack(body.track), body.position);
    } catch (error) {
      console.error('[history] failed to record play:', error);
    }
    res.status(204).end();
  }),
);

libraryRouter.delete(
  '/library/history',
  asyncRoute(async (_req, res) => {
    clearHistory();
    res.status(204).end();
  }),
);

libraryRouter.get(
  '/library/stats',
  asyncRoute(async (_req, res) => {
    res.json(getStats());
  }),
);
