import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import { Artwork } from './Artwork';
import type { Card } from '../types';

const paths: Record<Card['kind'], string> = {
  album: '/album',
  artist: '/artist',
  playlist: '/playlist',
  podcast: '/podcast',
};

export function MediaCard({ item }: { item: Card }) {
  return (
    <Link
      to={`${paths[item.kind]}/${encodeURIComponent(item.id)}`}
      className={`media-card ${item.kind}`}
      title={`${item.title} — ${item.subtitle}`}
    >
      <div className="media-card-art">
        <Artwork src={item.thumbnail} alt={item.title} />
        <span className="media-card-play" aria-hidden="true">
          <Play size={18} fill="currentColor" />
        </span>
      </div>
      <p className="media-card-title">{item.title}</p>
      <p className="media-card-subtitle">{item.subtitle}</p>
    </Link>
  );
}
