import { z } from 'zod';
import type { Track } from '../types.js';
import { HttpError } from './http.js';

export const videoIdSchema = z.string().regex(/^[A-Za-z0-9_-]{11}$/, 'Invalid video id');
export const collectionIdSchema = z.string().min(6).max(160).regex(/^[A-Za-z0-9_-]+$/, 'Invalid id');

export const searchFilterSchema = z.enum([
  'all',
  'song',
  'video',
  'album',
  'artist',
  'playlist',
  'podcast',
  'episode',
]);

/** Opaque browse params token used by YouTube Music for mood/genre categories. */
export const categoryIdSchema = z
  .string()
  .min(4)
  .max(200)
  .regex(/^[A-Za-z0-9_%=-]+$/, 'Invalid category id');

export const podcastIdSchema = z.string().min(6).max(160).regex(/^[A-Za-z0-9_-]+$/, 'Invalid podcast id');

export const videoQualitySchema = z.enum(['360p', '480p', '720p', '1080p']);

export const trackSchema = z.object({
  kind: z.literal('track').optional(),
  id: videoIdSchema,
  title: z.string().trim().min(1).max(300),
  artist: z.string().trim().max(300).default('Unknown artist'),
  album: z.string().trim().max(300).optional(),
  duration: z.coerce.number().min(0).max(86_400).default(0),
  thumbnail: z.string().max(2000).default(''),
  type: z.enum(['song', 'video', 'episode']).default('song'),
});

export const downloadSchema = z.object({
  track: trackSchema,
  format: z.enum(['mp3', 'm4a']).default('mp3'),
});

export const playlistCreateSchema = z.object({
  name: z.string().trim().min(1, 'Playlist name is required').max(120),
  description: z.string().trim().max(1000).default(''),
});

export const playlistUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).optional(),
});

export const historySchema = z.object({
  track: trackSchema,
  position: z.coerce.number().min(0).max(86_400_000).default(0),
});

export const idParamSchema = z.object({ id: z.string().min(1).max(160) });

export function parseOrThrow<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join(', ');
    throw new HttpError(400, message || 'Invalid request');
  }
  return result.data;
}

export function normalizeTrack(input: z.infer<typeof trackSchema>): Track {
  return {
    kind: 'track',
    id: input.id,
    title: input.title,
    artist: input.artist || 'Unknown artist',
    album: input.album || undefined,
    duration: Math.round(input.duration),
    thumbnail: input.thumbnail,
    type: input.type,
  };
}
