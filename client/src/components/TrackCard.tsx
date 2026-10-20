import { Pause, Play } from 'lucide-react';
import { Artwork } from './Artwork';
import { api } from '../lib/api';
import { usePlayerStore } from '../stores/player';
import type { Track } from '../types';

export function TrackCard({ track }: { track: Track }) {
  const current = usePlayerStore((state) => state.queue[state.currentIndex]);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const play = usePlayerStore((state) => state.play);
  const toggle = usePlayerStore((state) => state.toggle);
  const active = current?.id === track.id;

  const handleClick = () => {
    if (active) toggle();
    else play(track);
  };

  return (
    <button
      className={`track-card ${active ? 'active' : ''}`}
      onPointerEnter={() => api.prefetchStream(track.id)}
      onPointerDown={() => api.prefetchStream(track.id)}
      onFocus={() => api.prefetchStream(track.id)}
      onClick={handleClick}
      title={active && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
    >
      <div className="track-card-art">
        <Artwork src={track.thumbnail} alt={track.title} />
        <span className="track-card-play" aria-hidden="true">
          {active && isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
        </span>
      </div>
      <p className="media-card-title">{track.title}</p>
      <p className="media-card-subtitle">{track.artist}</p>
    </button>
  );
}
