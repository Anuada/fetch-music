import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DetailHeader } from '../components/DetailHeader';
import { PlayAllButtons } from '../components/PlayAllButtons';
import { TrackList } from '../components/TrackList';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { api } from '../lib/api';
import { formatDuration } from '../lib/format';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { usePlayerStore } from '../stores/player';

export function PodcastPage() {
  const { id = '' } = useParams();
  const podcast = useQuery({
    queryKey: ['podcast', id],
    queryFn: () => api.podcast(id),
    enabled: Boolean(id),
    retry: 1,
  });
  useDocumentTitle(podcast.data?.title);

  const playQueue = usePlayerStore((state) => state.playQueue);

  if (podcast.isLoading) return <LoadingState label="Loading podcast…" />;
  if (podcast.isError) {
    return (
      <ErrorState
        message={podcast.error instanceof Error ? podcast.error.message : 'Could not load this podcast.'}
        onRetry={() => void podcast.refetch()}
      />
    );
  }
  if (!podcast.data) return null;

  const data = podcast.data;
  const totalEpisodes = data.episodes.length;
  const totalDuration = data.episodes.reduce((sum, ep) => sum + ep.duration, 0);
  const meta = `${totalEpisodes} episodes · ${formatDuration(totalDuration)}`;

  return (
    <div className="page detail-page podcast-page">
      <DetailHeader
        eyebrow="Podcast"
        title={data.title}
        subtitle={<span>{data.author}</span>}
        meta={meta}
        image={data.thumbnail}
        imageAlt={data.title}
        actions={
          <PlayAllButtons tracks={data.episodes} />
        }
        description={data.description}
      />

      <section className="content-section">
        <div className="section-head">
          <h2>Episodes</h2>
          <span className="muted">{totalEpisodes} episodes</span>
        </div>
        {data.episodes.length > 0 ? (
          <TrackList
            tracks={data.episodes}
            showAlbum
            onPlay={(index) => playQueue(data.episodes, index)}
          />
        ) : (
          <EmptyState title="No episodes found" message="This podcast has no episodes." />
        )}
      </section>
    </div>
  );
}