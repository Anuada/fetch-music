import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DetailHeader } from '../components/DetailHeader';
import { PlayAllButtons } from '../components/PlayAllButtons';
import { Shelf } from '../components/Shelf';
import { TrackList } from '../components/TrackList';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { api } from '../lib/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function ArtistPage() {
  const { id = '' } = useParams();
  const artist = useQuery({
    queryKey: ['artist', id],
    queryFn: () => api.artist(id),
    enabled: Boolean(id),
  });
  useDocumentTitle(artist.data?.title);

  if (artist.isLoading) return <LoadingState label="Loading artist…" />;
  if (artist.isError) {
    return (
      <ErrorState
        message={artist.error instanceof Error ? artist.error.message : 'Could not load this artist.'}
        onRetry={() => void artist.refetch()}
      />
    );
  }
  if (!artist.data) return null;

  const data = artist.data;
  const cardSections = data.sections.filter((shelf) =>
    shelf.items.some((item) => item.kind !== 'track'),
  );

  return (
    <div className="page detail-page">
      <DetailHeader
        eyebrow="Artist"
        title={data.title}
        subtitle={<span>{data.subscriberText || 'YouTube Music artist'}</span>}
        meta={data.tracks.length > 0 ? `${data.tracks.length} top tracks` : undefined}
        image={data.thumbnail}
        imageAlt={data.title}
        actions={<PlayAllButtons tracks={data.tracks} />}
      />

      {data.tracks.length > 0 ? (
        <section className="content-section">
          <div className="section-head">
            <h2>Popular tracks</h2>
            <span className="muted">Top songs on YouTube Music</span>
          </div>
          <TrackList tracks={data.tracks.slice(0, 10)} />
        </section>
      ) : (
        <EmptyState title="No top tracks" message="Check back later for popular songs." />
      )}

      {cardSections.map((shelf, index) => (
        <Shelf key={`${shelf.title}-${index}`} shelf={shelf} />
      ))}

      {data.description ? (
        <section className="content-section bio-section">
          <h2>About {data.title}</h2>
          <p className="description expanded">{data.description}</p>
        </section>
      ) : null}
    </div>
  );
}
