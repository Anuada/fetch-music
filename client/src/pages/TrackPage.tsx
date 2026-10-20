import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ListMusic, Play, Sparkles, Monitor } from 'lucide-react';
import { AddToPlaylistButton } from '../components/AddToPlaylistButton';
import { DetailHeader } from '../components/DetailHeader';
import { DownloadButton } from '../components/DownloadButton';
import { Shelf } from '../components/Shelf';
import { TrackList } from '../components/TrackList';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { api } from '../lib/api';
import { formatDuration } from '../lib/format';
import { usePlayerStore } from '../stores/player';
import { toast } from '../stores/toast';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function TrackPage() {
  const { id = '' } = useParams();
  const detail = useQuery({
    queryKey: ['track', id],
    queryFn: () => api.track(id),
    enabled: Boolean(id),
    retry: 1,
  });
  useDocumentTitle(detail.data?.track.title);
  const playQueue = usePlayerStore((state) => state.playQueue);
  const enqueue = usePlayerStore((state) => state.enqueue);

  if (detail.isLoading) return <LoadingState label="Loading track…" />;
  if (detail.isError) {
    return (
      <ErrorState
        message={detail.error instanceof Error ? detail.error.message : 'Could not load this track.'}
        onRetry={() => void detail.refetch()}
      />
    );
  }
  if (!detail.data) return null;

  const { track, lyrics, related, upNext } = detail.data;
  const queue = [...upNext];

  return (
    <div className="page detail-page track-page">
      <DetailHeader
        eyebrow={track.type === 'video' ? 'Video' : 'Song'}
        title={track.title}
        subtitle={<span>{track.artist}</span>}
        meta={`${formatDuration(track.duration)}${track.album ? ` · ${track.album}` : ''}`}
        image={track.thumbnail}
        imageAlt={track.title}
        actions={
          <>
            <button
              className="button primary"
              onClick={() => {
                if (queue.length > 0) playQueue([track, ...queue], 0);
                else playQueue([track], 0);
              }}
            >
              <Play size={18} fill="currentColor" />
              Play
            </button>
            <button
              className="button"
              onClick={() => {
                enqueue(track, true);
                toast('Added to play next', 'success');
              }}
            >
              <ListMusic size={17} />
              Play next
            </button>
<AddToPlaylistButton track={track} />
            <DownloadButton track={track} />
            {track.type === 'video' && (
              <Link to={`/video/${encodeURIComponent(track.id)}`} className="button">
                <Monitor size={17} />
                Watch video
              </Link>
            )}
          </>
        }
      />

      <div className="track-columns">
        <div className="track-primary">
          {lyrics ? (
            <section className="content-section lyrics-section">
              <div className="section-head">
                <h2>Lyrics</h2>
                <span className="muted">YouTube Music</span>
              </div>
              <p className="lyrics">{lyrics}</p>
            </section>
          ) : (
            <section className="content-section">
              <div className="section-head">
                <h2>Lyrics</h2>
              </div>
              <p className="muted">No lyrics available for this track.</p>
            </section>
          )}

          {related.map((shelf, index) => (
            <Shelf key={`${shelf.title}-${index}`} shelf={shelf} />
          ))}
        </div>

        <aside className="track-aside">
          <section className="content-section">
            <div className="section-head">
              <h2>Up next</h2>
              <span className="muted">{upNext.length} tracks</span>
            </div>
            {upNext.length > 0 ? (
              <TrackList
                tracks={upNext.slice(0, 12)}
                onPlay={(index) => playQueue(upNext, index)}
              />
            ) : (
              <EmptyState
                icon={Sparkles}
                title="No queue suggestions"
                message="Start radio from this track by playing it."
                action={
                  <Link to="/search" className="button">
                    Find more music
                  </Link>
                }
              />
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
