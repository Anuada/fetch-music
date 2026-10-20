import type {
  AlbumDetail,
  ArtistDetail,
  CollectionDetail,
  DownloadJob,
  HistoryEntry,
  LibraryStats,
  Playlist,
  PlaylistDetail,
  PlaylistWithTracks,
  SearchFilter,
  SearchResult,
  Shelf,
  Track,
  TrackDetail,
} from '../types';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Keep the generic message.
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function json(method: string, body: unknown): RequestInit {
  return { method, body: JSON.stringify(body) };
}

const prefetched = new Map<string, number>();

function prefetchStream(videoId: string): void {
  const last = prefetched.get(videoId);
  if (last && Date.now() - last < 5 * 60_000) return;
  prefetched.set(videoId, Date.now());
  void fetch(`/api/stream/${encodeURIComponent(videoId)}/prefetch`).then(
    (response) => {
      if (!response.ok) prefetched.delete(videoId);
    },
    () => prefetched.delete(videoId),
  );
}

export const api = {
  home: () => request<{ sections: Shelf[] }>('/api/home'),

  search: (query: string, filter: SearchFilter) => {
    const params = new URLSearchParams({ q: query, type: filter });
    return request<SearchResult>(`/api/search?${params.toString()}`);
  },

  suggestions: (query: string) =>
    request<{ suggestions: string[] }>(`/api/suggestions?q=${encodeURIComponent(query)}`).then(
      (result) => result.suggestions,
    ),

  album: (id: string) => request<AlbumDetail>(`/api/album/${encodeURIComponent(id)}`),
  artist: (id: string) => request<ArtistDetail>(`/api/artist/${encodeURIComponent(id)}`),
  playlist: (id: string) => request<PlaylistDetail>(`/api/playlist/${encodeURIComponent(id)}`),
  track: (id: string) => request<TrackDetail>(`/api/track/${encodeURIComponent(id)}`),

  playlists: () => request<{ playlists: Playlist[] }>('/api/library/playlists'),
  localPlaylist: (id: string) =>
    request<PlaylistWithTracks>(`/api/library/playlists/${encodeURIComponent(id)}`),
  createPlaylist: (name: string, description = '') =>
    request<Playlist>('/api/library/playlists', json('POST', { name, description })),
  updatePlaylist: (id: string, changes: { name?: string; description?: string }) =>
    request<Playlist>(`/api/library/playlists/${encodeURIComponent(id)}`, json('PATCH', changes)),
  deletePlaylist: (id: string) =>
    request<void>(`/api/library/playlists/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  addPlaylistTrack: (playlistId: string, track: Track) =>
    request<PlaylistWithTracks>(
      `/api/library/playlists/${encodeURIComponent(playlistId)}/tracks`,
      json('POST', track),
    ),
  removePlaylistTrack: (playlistId: string, itemId: number) =>
    request<PlaylistWithTracks>(
      `/api/library/playlists/${encodeURIComponent(playlistId)}/tracks/${itemId}`,
      { method: 'DELETE' },
    ),

  history: (limit = 100) =>
    request<{ history: HistoryEntry[] }>(`/api/library/history?limit=${limit}`),
  recordHistory: (track: Track, position: number) =>
    request<void>('/api/library/history', json('POST', { track, position })),
  clearHistory: () => request<void>('/api/library/history', { method: 'DELETE' }),
  stats: () => request<LibraryStats>('/api/library/stats'),

  downloads: () => request<{ downloads: DownloadJob[] }>('/api/downloads'),
  startDownload: (track: Track, format: 'mp3' | 'm4a' = 'mp3') =>
    request<DownloadJob>('/api/downloads', json('POST', { track, format })),
  cancelDownload: (id: string) =>
    request<DownloadJob>(`/api/downloads/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),
  retryDownload: (id: string) =>
    request<DownloadJob>(`/api/downloads/${encodeURIComponent(id)}/retry`, { method: 'POST' }),
  deleteDownload: (id: string) =>
    request<void>(`/api/downloads/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  downloadFileUrl: (id: string) => `/api/downloads/${encodeURIComponent(id)}/file`,
  streamUrl: (videoId: string) => `/api/stream/${encodeURIComponent(videoId)}`,
  prefetchStream,
};

export type { CollectionDetail };
