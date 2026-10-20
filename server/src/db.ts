import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { dbPath, downloadsDir } from './config.js';
import type {
  DownloadJob,
  DownloadRecord,
  HistoryEntry,
  Playlist,
  PlaylistWithTracks,
  Track,
} from './types.js';

fs.mkdirSync(downloadsDir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    album TEXT,
    duration INTEGER NOT NULL DEFAULT 0,
    thumbnail TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'song',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS playlist_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    added_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist
    ON playlist_items(playlist_id, position);

  CREATE TABLE IF NOT EXISTS history (
    track_id TEXT PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
    played_at TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS downloads (
    id TEXT PRIMARY KEY,
    video_id TEXT NOT NULL,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    thumbnail TEXT NOT NULL DEFAULT '',
    format TEXT NOT NULL DEFAULT 'mp3',
    status TEXT NOT NULL DEFAULT 'queued',
    progress REAL NOT NULL DEFAULT 0,
    speed TEXT NOT NULL DEFAULT '',
    eta TEXT NOT NULL DEFAULT '',
    error TEXT,
    file_name TEXT,
    file_path TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_downloads_created ON downloads(created_at DESC);
`);

interface TrackRow {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  duration: number;
  thumbnail: string;
  type: string;
}

interface PlaylistRow {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  track_count: number;
}

interface PlaylistItemRow extends TrackRow {
  item_id: number;
}

interface HistoryRow extends TrackRow {
  played_at: string;
  position: number;
}

interface DownloadRow {
  id: string;
  video_id: string;
  title: string;
  artist: string;
  thumbnail: string;
  format: string;
  status: string;
  progress: number;
  speed: string;
  eta: string;
  error: string | null;
  file_name: string | null;
  file_path: string | null;
  created_at: string;
  completed_at: string | null;
}

function toTrack(row: TrackRow): Track {
  return {
    kind: 'track',
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album ?? undefined,
    duration: row.duration,
    thumbnail: row.thumbnail,
    type: row.type === 'video' || row.type === 'episode' ? row.type : 'song',
  };
}

function toPlaylist(row: PlaylistRow): Playlist {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    trackCount: row.track_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDownload(row: DownloadRow): DownloadRecord {
  return {
    id: row.id,
    videoId: row.video_id,
    title: row.title,
    artist: row.artist,
    thumbnail: row.thumbnail,
    format: row.format === 'm4a' ? 'm4a' : 'mp3',
    status: row.status as DownloadRecord['status'],
    progress: row.progress,
    speed: row.speed,
    eta: row.eta,
    error: row.error,
    fileName: row.file_name,
    filePath: row.file_path,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

const upsertTrackStmt = db.prepare(`
  INSERT INTO tracks (id, title, artist, album, duration, thumbnail, type, updated_at)
  VALUES (@id, @title, @artist, @album, @duration, @thumbnail, @type, @updatedAt)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    artist = excluded.artist,
    album = COALESCE(excluded.album, tracks.album),
    duration = CASE WHEN excluded.duration > 0 THEN excluded.duration ELSE tracks.duration END,
    thumbnail = CASE WHEN excluded.thumbnail <> '' THEN excluded.thumbnail ELSE tracks.thumbnail END,
    type = excluded.type,
    updated_at = excluded.updated_at
`);

export function saveTrack(track: Track): void {
  upsertTrackStmt.run({
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album ?? null,
    duration: Math.max(0, Math.round(track.duration || 0)),
    thumbnail: track.thumbnail,
    type: track.type,
    updatedAt: new Date().toISOString(),
  });
}

export function getTrack(id: string): Track | undefined {
  const row = db.prepare('SELECT * FROM tracks WHERE id = ?').get(id) as TrackRow | undefined;
  return row ? toTrack(row) : undefined;
}

export function listPlaylists(): Playlist[] {
  const rows = db
    .prepare(
      `SELECT p.*, COUNT(i.id) AS track_count
       FROM playlists p
       LEFT JOIN playlist_items i ON i.playlist_id = p.id
       GROUP BY p.id
       ORDER BY p.updated_at DESC`,
    )
    .all() as PlaylistRow[];
  return rows.map(toPlaylist);
}

export function getPlaylistRow(id: string): Playlist | undefined {
  const row = db
    .prepare(
      `SELECT p.*, COUNT(i.id) AS track_count
       FROM playlists p
       LEFT JOIN playlist_items i ON i.playlist_id = p.id
       WHERE p.id = ?
       GROUP BY p.id`,
    )
    .get(id) as PlaylistRow | undefined;
  return row ? toPlaylist(row) : undefined;
}

export function getPlaylistWithTracks(id: string): PlaylistWithTracks | undefined {
  const playlist = getPlaylistRow(id);
  if (!playlist) return undefined;
  const rows = db
    .prepare(
      `SELECT t.*, i.id AS item_id
       FROM playlist_items i
       JOIN tracks t ON t.id = i.track_id
       WHERE i.playlist_id = ?
       ORDER BY i.position ASC, i.id ASC`,
    )
    .all(id) as PlaylistItemRow[];
  return {
    ...playlist,
    tracks: rows.map((row) => ({ ...toTrack(row), itemId: row.item_id })),
  };
}

export function createPlaylist(name: string, description = ''): Playlist {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO playlists (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, name, description, now, now);
  return { id, name, description, trackCount: 0, createdAt: now, updatedAt: now };
}

export function updatePlaylist(
  id: string,
  changes: { name?: string; description?: string },
): Playlist | undefined {
  const existing = getPlaylistRow(id);
  if (!existing) return undefined;
  const name = changes.name?.trim() || existing.name;
  const description = changes.description ?? existing.description;
  db.prepare('UPDATE playlists SET name = ?, description = ?, updated_at = ? WHERE id = ?').run(
    name,
    description,
    new Date().toISOString(),
    id,
  );
  return getPlaylistRow(id);
}

export function deletePlaylist(id: string): boolean {
  return db.prepare('DELETE FROM playlists WHERE id = ?').run(id).changes > 0;
}

export function addTrackToPlaylist(playlistId: string, track: Track): PlaylistWithTracks | undefined {
  const playlist = getPlaylistRow(playlistId);
  if (!playlist) return undefined;
  saveTrack(track);
  const next = db
    .prepare('SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM playlist_items WHERE playlist_id = ?')
    .get(playlistId) as { pos: number };
  db.prepare(
    'INSERT INTO playlist_items (playlist_id, track_id, position, added_at) VALUES (?, ?, ?, ?)',
  ).run(playlistId, track.id, next.pos, new Date().toISOString());
  db.prepare('UPDATE playlists SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), playlistId);
  return getPlaylistWithTracks(playlistId);
}

export function removePlaylistItem(playlistId: string, itemId: number): PlaylistWithTracks | undefined {
  db.prepare('DELETE FROM playlist_items WHERE id = ? AND playlist_id = ?').run(itemId, playlistId);
  db.prepare('UPDATE playlists SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), playlistId);
  return getPlaylistWithTracks(playlistId);
}

export function recordHistory(track: Track, position = 0): void {
  saveTrack(track);
  db.prepare(
    `INSERT INTO history (track_id, played_at, position) VALUES (?, ?, ?)
     ON CONFLICT(track_id) DO UPDATE SET played_at = excluded.played_at, position = excluded.position`,
  ).run(track.id, new Date().toISOString(), Math.max(0, Math.round(position)));
}

export function listHistory(limit = 100): HistoryEntry[] {
  const rows = db
    .prepare(
      `SELECT t.*, h.played_at, h.position
       FROM history h
       JOIN tracks t ON t.id = h.track_id
       ORDER BY h.played_at DESC
       LIMIT ?`,
    )
    .all(limit) as HistoryRow[];
  return rows.map((row) => ({ ...toTrack(row), playedAt: row.played_at, position: row.position }));
}

export function clearHistory(): void {
  db.prepare('DELETE FROM history').run();
}

export function insertDownload(job: DownloadJob): void {
  db.prepare(
    `INSERT INTO downloads
     (id, video_id, title, artist, thumbnail, format, status, progress, speed, eta, error, file_name, file_path, created_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    job.id,
    job.videoId,
    job.title,
    job.artist,
    job.thumbnail,
    job.format,
    job.status,
    job.progress,
    job.speed,
    job.eta,
    job.error,
    job.fileName,
    null,
    job.createdAt,
    job.completedAt,
  );
}

const downloadFields: Record<string, string> = {
  status: 'status',
  progress: 'progress',
  speed: 'speed',
  eta: 'eta',
  error: 'error',
  fileName: 'file_name',
  filePath: 'file_path',
  completedAt: 'completed_at',
};

export function updateDownload(
  id: string,
  changes: Partial<Pick<DownloadRecord, 'status' | 'progress' | 'speed' | 'eta' | 'error' | 'fileName' | 'filePath' | 'completedAt'>>,
): void {
  const entries = Object.entries(changes).filter(([key]) => key in downloadFields);
  if (entries.length === 0) return;
  const assignments = entries.map(([key]) => `${downloadFields[key]} = ?`).join(', ');
  db.prepare(`UPDATE downloads SET ${assignments} WHERE id = ?`).run(
    ...entries.map(([, value]) => value),
    id,
  );
}

export function getDownload(id: string): DownloadRecord | undefined {
  const row = db.prepare('SELECT * FROM downloads WHERE id = ?').get(id) as DownloadRow | undefined;
  return row ? toDownload(row) : undefined;
}

export function listDownloads(): DownloadRecord[] {
  const rows = db
    .prepare('SELECT * FROM downloads ORDER BY created_at DESC')
    .all() as DownloadRow[];
  return rows.map(toDownload);
}

export function deleteDownload(id: string): DownloadRecord | undefined {
  const record = getDownload(id);
  if (!record) return undefined;
  db.prepare('DELETE FROM downloads WHERE id = ?').run(id);
  if (record.filePath) {
    try {
      fs.rmSync(path.resolve(record.filePath), { force: true });
    } catch {
      // The database row is more important than a stale file.
    }
  }
  return record;
}

export function failInterruptedDownloads(): void {
  db.prepare(
    `UPDATE downloads
     SET status = 'failed', error = 'Interrupted by app restart', speed = '', eta = ''
     WHERE status IN ('queued', 'downloading')`,
  ).run();
}

export function getStats(): { tracks: number; playlists: number; downloads: number; history: number } {
  const count = (table: string) =>
    (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
  return {
    tracks: count('tracks'),
    playlists: count('playlists'),
    downloads: count("downloads WHERE status = 'completed'"),
    history: count('history'),
  };
}

export { db, downloadsDir };
