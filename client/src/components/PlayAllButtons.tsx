import { Play, Shuffle } from 'lucide-react';
import { usePlayerStore } from '../stores/player';
import type { Track } from '../types';

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export function PlayAllButtons({ tracks }: { tracks: Track[] }) {
  const playQueue = usePlayerStore((state) => state.playQueue);

  return (
    <>
      <button
        className="button primary"
        disabled={tracks.length === 0}
        onClick={() => playQueue(tracks, 0)}
      >
        <Play size={18} fill="currentColor" />
        Play all
      </button>
      <button
        className="button"
        disabled={tracks.length === 0}
        onClick={() => playQueue(shuffled(tracks), 0)}
      >
        <Shuffle size={18} />
        Shuffle
      </button>
    </>
  );
}
