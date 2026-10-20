import { Router } from 'express';
import { asyncRoute, HttpError } from '../lib/http.js';
import { parseOrThrow, searchFilterSchema } from '../lib/validation.js';
import { getSuggestions, searchMusic } from '../services/youtube.js';

export const searchRouter = Router();

searchRouter.get(
  '/search',
  asyncRoute(async (req, res) => {
    const query = String(req.query.q ?? '').trim();
    if (!query) {
      res.json({ query: '', filter: 'song', tracks: [], cards: [] });
      return;
    }
    if (query.length > 200) throw new HttpError(400, 'Search query is too long');
    const filter = parseOrThrow(searchFilterSchema, req.query.type ?? 'song');
    res.json(await searchMusic(query, filter));
  }),
);

searchRouter.get(
  '/suggestions',
  asyncRoute(async (req, res) => {
    const query = String(req.query.q ?? '').trim();
    if (!query) {
      res.json({ suggestions: [] });
      return;
    }
    res.json({ suggestions: await getSuggestions(query.slice(0, 200)) });
  }),
);
