export type TrackKind = 'song' | 'video';

export interface Track {
  kind: 'track';
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  thumbnail: string;
  type: TrackKind;
}

export type CardKind = 'album' | 'artist' | 'playlist';

export interface Card {
  kind: CardKind;
  id: string;
  title: string;
  subtitle: string;
  thumbnail: string;
  year?: string;
  itemCount?: number;
}

export type MediaItem = Track | Card;

export interface Shelf {
  title: string;
  items: MediaItem[];
}

export interface SearchResult {
  query: string;
  filter: SearchFilter;
  tracks: Track[];
  cards: Card[];
}

export type SearchFilter = 'song' | 'video' | 'album' | 'artist' | 'playlist';

export interface AlbumDetail {
  kind: 'album';
  id: string;
  title: string;
  artist: string;
  year?: string;
  description: string;
  thumbnail: string;
  trackCount: number;
  durationText: string;
  tracks: Track[];
}

export interface ArtistDetail {
  kind: 'artist';
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  subscriberText: string;
  tracks: Track[];
  sections: Shelf[];
}

export interface PlaylistDetail {
  kind: 'playlist';
  id: string;
  title: string;
  author: string;
  description: string;
  thumbnail: string;
  trackCountText: string;
  tracks: Track[];
}

export type CollectionDetail = AlbumDetail | ArtistDetail | PlaylistDetail;

export interface TrackDetail {
  track: Track;
  lyrics: string | null;
  related: Shelf[];
  upNext: Track[];
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  trackCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistWithTracks extends Playlist {
  tracks: Array<Track & { itemId: number }>;
}

export interface HistoryEntry extends Track {
  playedAt: string;
  position: number;
}

export type DownloadStatus = 'queued' | 'downloading' | 'completed' | 'failed' | 'cancelled';

export interface DownloadJob {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
  format: 'mp3' | 'm4a';
  status: DownloadStatus;
  progress: number;
  speed: string;
  eta: string;
  error: string | null;
  fileName: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface DownloadRecord extends DownloadJob {
  filePath: string | null;
}
