import { Link } from 'react-router-dom';
import { Trash2, Volume2, RotateCcw } from 'lucide-react';
import { Artwork } from './Artwork';
import { AddToPlaylistButton } from './AddToPlaylistButton';
import { DownloadButton } from './DownloadButton';
import { api } from '../lib/api';
import { formatDuration } from '../lib/format';
import { usePlayerStore } from '../stores/player';
import { useHistoryStore } from '../stores/history';
import type { Track } from '../types';

interface TrackListProps {
  tracks: Track[];
  onPlay?: (index: number) => void;
  showAlbum?: boolean;
  onRemove?: (index: number) => void;
}

export function TrackList({ tracks, onPlay, showAlbum = false, onRemove }: TrackListProps) {
  const playQueue = usePlayerStore((state) => state.playQueue);
  const current = usePlayerStore((state) => state.queue[state.currentIndex]);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const toggle = usePlayerStore((state) => state.toggle);
  const getEpisodeProgress = useHistoryStore((state) => state.getEpisodeProgress);

  const playAt = (index: number) => {
    if (onPlay) onPlay(index);
    else playQueue(tracks, index);
  };

  return (
    <div className="track-list" role="list">
      {tracks.map((track, index) => {
        const active = current?.id === track.id;
        const episodeProgress = track.type === 'episode' ? getEpisodeProgress(track.id) : 0;
        const showProgress = episodeProgress > 0 && episodeProgress < track.duration;
        return (
          <div
            key={`${track.id}-${index}`}
            className={`track-row ${active ? 'active' : ''} ${showProgress ? 'has-progress' : ''}`}
            role="button"
            tabIndex={0}
            onPointerEnter={() => api.prefetchStream(track.id)}
            onPointerDown={() => api.prefetchStream(track.id)}
            onFocus={() => api.prefetchStream(track.id)}
            onClick={() => {
              if (active) toggle();
              else playAt(index);
            }}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                if (active) toggle();
                else playAt(index);
              }
            }}
            aria-label={`Play ${track.title} by ${track.artist}`}
          >
            <div className="track-index">
              {active ? <Volume2 size={16} className={isPlaying ? 'pulse' : ''} /> : index + 1}
            </div>
            <Artwork src={track.thumbnail} alt={track.title} className="track-thumb" />
            <div className="track-main">
              <Link
                to={`/track/${encodeURIComponent(track.id)}`}
                className="track-title"
                onClick={(event) => event.stopPropagation()}
              >
                {track.title}
              </Link>
              <span className="track-artist">{track.artist}</span>
              {showProgress && (
                <div className="episode-progress">
                  <RotateCcw size={12} />
                  <span>Continue from {formatDuration(episodeProgress)}</span>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${(episodeProgress / track.duration) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            {showAlbum ? <div className="track-album">{track.album ?? '—'}</div> : null}
            <div className="track-actions">
              <AddToPlaylistButton track={track} />
              <DownloadButton track={track} />
              {onRemove ? (
                <button
                  className="icon-button"
                  title="Remove from playlist"
                  aria-label={`Remove ${track.title}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove(index);
                  }}
                >
                  <Trash2 size={17} />
                </button>
              ) : null}
            </div>
            <div className="track-duration">{formatDuration(track.duration)}</div>
          </div>
        );
      })}
    </div>
  );
}
