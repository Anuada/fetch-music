import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, History, ListMusic, Music2, Plus, Sparkles } from 'lucide-react';
import { TrackList } from '../components/TrackList';
import { EmptyState, LoadingState } from '../components/States';
import { api } from '../lib/api';
import { pluralize, relativeDate } from '../lib/format';
import { toast } from '../stores/toast';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function LibraryPage() {
  useDocumentTitle('Your library');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  const playlists = useQuery({ queryKey: ['playlists'], queryFn: api.playlists });
  const stats = useQuery({ queryKey: ['stats'], queryFn: api.stats });
  const history = useQuery({ queryKey: ['history', 6], queryFn: () => api.history(6) });

  const create = useMutation({
    mutationFn: () => api.createPlaylist(name.trim()),
    onSuccess: (playlist) => {
      void queryClient.invalidateQueries({ queryKey: ['playlists'] });
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
      setName('');
      toast('Playlist created', 'success');
      navigate(`/library/playlist/${playlist.id}`);
    },
    onError: (error: Error) => toast(error.message, 'error'),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) create.mutate();
  };

  return (
    <div className="page library-page">
      <header className="page-heading split">
        <div>
          <p className="eyebrow">Your library</p>
          <h1>Saved for later</h1>
          <p className="muted">Local playlists, listening history and offline audio.</p>
        </div>
        <form className="create-playlist" onSubmit={submit}>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New playlist name"
            maxLength={120}
            aria-label="New playlist name"
          />
          <button className="button primary" type="submit" disabled={!name.trim() || create.isPending}>
            <Plus size={17} />
            Create
          </button>
        </form>
      </header>

      <section className="stat-grid">
        <StatCard icon={Music2} label="Tracks" value={stats.data?.tracks} />
        <StatCard icon={ListMusic} label="Playlists" value={stats.data?.playlists} />
        <StatCard icon={Download} label="Downloads" value={stats.data?.downloads} />
        <StatCard icon={History} label="In history" value={stats.data?.history} />
      </section>

      <section className="content-section">
        <div className="section-head">
          <h2>Playlists</h2>
          <span className="muted">{playlists.data?.playlists.length ?? 0} saved</span>
        </div>

        {playlists.isLoading ? <LoadingState label="Loading playlists…" /> : null}

        {playlists.data?.playlists.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="Your library is waiting"
            message="Create a playlist above, then add tracks from search or any album."
            action={
              <Link to="/search" className="button">
                Find music
              </Link>
            }
          />
        ) : null}

        <div className="playlist-grid">
          {playlists.data?.playlists.map((playlist) => (
            <Link
              key={playlist.id}
              to={`/library/playlist/${playlist.id}`}
              className="playlist-card"
            >
              <div className="playlist-cover">
                <ListMusic size={34} />
              </div>
              <div className="playlist-card-copy">
                <h3>{playlist.name}</h3>
                <p>{pluralize(playlist.trackCount, 'track')}</p>
                <small>Updated {relativeDate(playlist.updatedAt)}</small>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {history.data && history.data.history.length > 0 ? (
        <section className="content-section">
          <div className="section-head">
            <h2>Recently played</h2>
            <Link to="/history" className="text-button">
              See all
            </Link>
          </div>
          <TrackList tracks={history.data.history} />
        </section>
      ) : null}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Music2;
  label: string;
  value?: number;
}) {
  return (
    <div className="stat-card">
      <span className="stat-icon">
        <Icon size={19} />
      </span>
      <div>
        <strong>{value ?? '—'}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
