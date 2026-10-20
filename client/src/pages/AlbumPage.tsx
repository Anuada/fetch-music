import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DetailHeader } from '../components/DetailHeader';
import { PlayAllButtons } from '../components/PlayAllButtons';
import { TrackList } from '../components/TrackList';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { api } from '../lib/api';
import { formatTotalDuration } from '../lib/format';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function AlbumPage() {
  const { id = '' } = useParams();
  const album = useQuery({ queryKey: ['album', id], queryFn: () => api.album(id), enabled: Boolean(id) });
  useDocumentTitle(album.data?.title);

  if (album.isLoading) return <LoadingState label="Loading album…" />;
  if (album.isError) {
    return (
      <ErrorState
        message={album.error instanceof Error ? album.error.message : 'Could not load this album.'}
        onRetry={() => void album.refetch()}
      />
    );
  }
  if (!album.data) return null;

  const data = album.data;
  const total = data.tracks.reduce((sum, track) => sum + track.duration, 0);
  const meta = data.durationText || `${data.trackCount} tracks · ${formatTotalDuration(total)}`;

  return (
    <div className="page detail-page">
      <DetailHeader
        eyebrow={`Album${data.year ? ` · ${data.year}` : ''}`}
        title={data.title}
        subtitle={<span>{data.artist}</span>}
        meta={meta}
        image={data.thumbnail}
        imageAlt={data.title}
        actions={<PlayAllButtons tracks={data.tracks} />}
        description={data.description}
      />

      <section className="content-section">
        <div className="section-head">
          <h2>Tracks</h2>
          <span className="muted">{data.trackCount} tracks</span>
        </div>
        {data.tracks.length > 0 ? (
          <TrackList tracks={data.tracks} />
        ) : (
          <EmptyState title="No tracks found" message="This album has no playable tracks." />
        )}
      </section>
    </div>
  );
}
