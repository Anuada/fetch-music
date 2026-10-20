import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Trash2 } from 'lucide-react';
import { TrackList } from '../components/TrackList';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';
import { toast } from '../stores/toast';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type { HistoryEntry } from '../types';

function dayLabel(value: string): string {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return formatDate(value);
}

function groupHistory(history: HistoryEntry[]): Array<[string, HistoryEntry[]]> {
  const groups = new Map<string, HistoryEntry[]>();
  for (const entry of history) {
    const label = dayLabel(entry.playedAt);
    const group = groups.get(label) ?? [];
    group.push(entry);
    groups.set(label, group);
  }
  return [...groups.entries()];
}

export function HistoryPage() {
  useDocumentTitle('History');
  const queryClient = useQueryClient();
  const history = useQuery({ queryKey: ['history', 200], queryFn: () => api.history(200) });

  const clear = useMutation({
    mutationFn: api.clearHistory,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['history'] });
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast('Listening history cleared', 'success');
    },
    onError: (error: Error) => toast(error.message, 'error'),
  });

  return (
    <div className="page">
      <header className="page-heading split">
        <div>
          <p className="eyebrow">Listening history</p>
          <h1>Recently played</h1>
          <p className="muted">Tracks you play on this device, newest first.</p>
        </div>
        {history.data && history.data.history.length > 0 ? (
          <button
            className="button"
            onClick={() => {
              if (window.confirm('Clear all listening history?')) clear.mutate();
            }}
            disabled={clear.isPending}
          >
            <Trash2 size={16} />
            Clear history
          </button>
        ) : null}
      </header>

      {history.isLoading ? <LoadingState label="Loading history…" /> : null}
      {history.isError ? (
        <ErrorState
          message={history.error instanceof Error ? history.error.message : 'Could not load history.'}
          onRetry={() => void history.refetch()}
        />
      ) : null}

      {history.data?.history.length === 0 ? (
        <EmptyState
          title="Nothing played yet"
          message="Tracks you listen to will show up here."
          action={
            <Link to="/search" className="button">
              <Search size={16} />
              Find music
            </Link>
          }
        />
      ) : null}

      {history.data && history.data.history.length > 0 ? (
        <div className="history-groups">
          {groupHistory(history.data.history).map(([label, tracks]) => (
            <section className="content-section" key={label}>
              <div className="section-head">
                <h2>{label}</h2>
                <span className="muted">{tracks.length} tracks</span>
              </div>
              <TrackList tracks={tracks} showAlbum />
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
