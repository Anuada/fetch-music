import { MediaCard } from './MediaCard';
import { TrackCard } from './TrackCard';
import type { Shelf as ShelfType } from '../types';

export function Shelf({ shelf }: { shelf: ShelfType }) {
  if (!shelf.items.length) return null;
  return (
    <section className="shelf">
      <div className="shelf-head">
        <h2>{shelf.title || 'Recommended'}</h2>
      </div>
      <div className="shelf-row">
        {shelf.items.map((item) =>
          item.kind === 'track' ? (
            <TrackCard key={`track-${item.id}`} track={item} />
          ) : (
            <MediaCard key={`${item.kind}-${item.id}`} item={item} />
          ),
        )}
      </div>
    </section>
  );
}
