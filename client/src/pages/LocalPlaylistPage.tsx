import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Search, Trash2 } from 'lucide-react';
import { DetailHeader } from '../components/DetailHeader';
import { PlayAllButtons } from '../components/PlayAllButtons';
import { TrackList } from '../components/TrackList';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { api } from '../lib/api';
import { formatTotalDuration, relativeDate } from '../lib/format';
import { toast } from '../stores/toast';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function LocalPlaylistPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const playlist = useQuery({
    queryKey: ['local-playlist', id],
    queryFn: () => api.localPlaylist(id),
    enabled: Boolean(id),
  });
  useDocumentTitle(playlist.data?.name);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['local-playlist', id] });
    void queryClient.invalidateQueries({ queryKey: ['playlists'] });
    void queryClient.invalidateQueries({ queryKey: ['stats'] });
  };

  const removeTrack = useMutation({
    mutationFn: (itemId: number) => api.removePlaylistTrack(id, itemId),
    onSuccess: invalidate,
    onError: (error: Error) => toast(error.message, 'error'),
  });

  const rename = useMutation({
    mutationFn: (name: string) => api.updatePlaylist(id, { name }),
    onSuccess: () => {
      invalidate();
      toast('Playlist renamed', 'success');
    },
    onError: (error: Error) => toast(error.message, 'error'),
  });

  const remove = useMutation({
    mutationFn: () => api.deletePlaylist(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['playlists'] });
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast('Playlist deleted', 'success');
      navigate('/library');
    },
    onError: (error: Error) => toast(error.message, 'error'),
  });

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
  const total = data.tracks.reduce((sum, track) => sum + track.duration, 0);

  const handleRename = () => {
    const name = window.prompt('Playlist name', data.name)?.trim();
    if (name && name !== data.name) rename.mutate(name);
  };

  const handleDelete = () => {
    if (window.confirm(`Delete “${data.name}”? This cannot be undone.`)) remove.mutate();
  };

  return (
    <div className="page detail-page">
      <DetailHeader
        eyebrow="Local playlist"
        title={data.name}
        subtitle={<span>{data.description || 'Your personal collection'}</span>}
        meta={`${data.trackCount} tracks${total > 0 ? ` · ${formatTotalDuration(total)}` : ''} · updated ${relativeDate(data.updatedAt)}`}
        image={data.tracks[0]?.thumbnail}
        imageAlt={data.name}
        actions={
          <>
            <PlayAllButtons tracks={data.tracks} />
            <button className="button" onClick={handleRename} disabled={rename.isPending}>
              <Pencil size={16} />
              Rename
            </button>
            <button className="button danger" onClick={handleDelete} disabled={remove.isPending}>
              <Trash2 size={16} />
              Delete
            </button>
          </>
        }
      />

      <section className="content-section">
        <div className="section-head">
          <h2>Tracks</h2>
          <span className="muted">{data.trackCount} tracks</span>
        </div>
        {data.tracks.length > 0 ? (
          <TrackList
            tracks={data.tracks}
            showAlbum
            onRemove={(index) => {
              const track = data.tracks[index];
              if (track) removeTrack.mutate(track.itemId);
            }}
          />
        ) : (
          <EmptyState
            title="This playlist is empty"
            message="Add songs from search, an album, or any track menu."
            action={
              <Link to="/search" className="button">
                <Search size={16} />
                Find music
              </Link>
            }
          />
        )}
      </section>
    </div>
  );
}
