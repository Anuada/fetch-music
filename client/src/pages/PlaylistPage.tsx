import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DetailHeader } from '../components/DetailHeader';
import { PlayAllButtons } from '../components/PlayAllButtons';
import { TrackList } from '../components/TrackList';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { api } from '../lib/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function PlaylistPage() {
  const { id = '' } = useParams();
  const playlist = useQuery({
    queryKey: ['playlist', id],
    queryFn: () => api.playlist(id),
    enabled: Boolean(id),
  });
  useDocumentTitle(playlist.data?.title);

  if (playlist.isLoading) return <LoadingState label="Loading playlist…" />;
  if (playlist.isError) {
    return (
      <ErrorState
        message={playlist.error instanceof Error ? playlist.error.message : 'Could not load this playlist.'}
        onRetry={() => void playlist.refetch()}
      />
    );
  }
  if (!playlist.data) return null;

  const data = playlist.data;

  return (
    <div className="page detail-page">
      <DetailHeader
        eyebrow="Playlist"
        title={data.title}
        subtitle={<span>{data.author}</span>}
        meta={data.trackCountText || `${data.tracks.length} tracks`}
        image={data.thumbnail}
        imageAlt={data.title}
        actions={<PlayAllButtons tracks={data.tracks} />}
        description={data.description}
      />

      <section className="content-section">
        <div className="section-head">
          <h2>Tracks</h2>
          <span className="muted">{data.tracks.length} tracks</span>
        </div>
        {data.tracks.length > 0 ? (
          <TrackList tracks={data.tracks} showAlbum />
        ) : (
          <EmptyState title="No tracks found" message="This playlist has no playable tracks." />
        )}
      </section>
    </div>
  );
}
