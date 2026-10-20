import { useState } from 'react';
import { ListPlus, Loader2, Plus, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../stores/toast';
import type { Track } from '../types';

interface AddToPlaylistProps {
  track: Track;
  className?: string;
  showLabel?: boolean;
}

export function AddToPlaylistButton({ track, className = '', showLabel = false }: AddToPlaylistProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const queryClient = useQueryClient();
  const playlists = useQuery({ queryKey: ['playlists'], queryFn: api.playlists, enabled: open });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['playlists'] });
  };

  const add = useMutation({
    mutationFn: (playlistId: string) => api.addPlaylistTrack(playlistId, track),
    onSuccess: (playlist) => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ['local-playlist', playlist.id] });
      toast(`Added to ${playlist.name}`, 'success');
      setOpen(false);
    },
    onError: (error: Error) => toast(error.message, 'error'),
  });

  const createAndAdd = useMutation({
    mutationFn: async () => {
      const playlist = await api.createPlaylist(name.trim());
      return api.addPlaylistTrack(playlist.id, track);
    },
    onSuccess: (playlist) => {
      invalidate();
      toast(`Added to ${playlist.name}`, 'success');
      setName('');
      setOpen(false);
    },
    onError: (error: Error) => toast(error.message, 'error'),
  });

  const busy = add.isPending || createAndAdd.isPending;

  return (
    <>
      <button
        className={`icon-button ${className}`.trim()}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        title="Add to playlist"
        aria-label="Add to playlist"
      >
        <ListPlus size={17} />
        {showLabel ? <span>Add to playlist</span> : null}
      </button>

      {open ? (
        <div
          className="modal-backdrop"
          onClick={(event) => {
            event.stopPropagation();
            setOpen(false);
          }}
        >
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <p className="eyebrow">Add to playlist</p>
                <h2>{track.title}</h2>
              </div>
              <button className="icon-button" onClick={() => setOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="modal-list">
              {playlists.isLoading ? (
                <div className="modal-loading">
                  <Loader2 className="spin" size={20} /> Loading playlists…
                </div>
              ) : null}
              {playlists.data?.playlists.length === 0 ? (
                <p className="muted">No playlists yet. Create one below.</p>
              ) : null}
              {playlists.data?.playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  className="modal-row"
                  disabled={busy}
                  onClick={() => add.mutate(playlist.id)}
                >
                  <span>
                    <strong>{playlist.name}</strong>
                    <small>{playlist.trackCount} tracks</small>
                  </span>
                  <Plus size={17} />
                </button>
              ))}
            </div>

            <form
              className="modal-create"
              onSubmit={(event) => {
                event.preventDefault();
                if (name.trim()) createAndAdd.mutate();
              }}
            >
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="New playlist name"
                maxLength={120}
              />
              <button className="button primary" type="submit" disabled={!name.trim() || busy}>
                {busy ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
                Create
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
