import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FolderDown, RotateCcw, Trash2, X } from 'lucide-react';
import { Artwork } from '../components/Artwork';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { api } from '../lib/api';
import { formatDate, pluralize } from '../lib/format';
import { toast } from '../stores/toast';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type { DownloadJob, DownloadStatus } from '../types';

type Filter = 'all' | 'active' | 'completed' | 'failed';

const statusLabels: Record<DownloadStatus, string> = {
  queued: 'Queued',
  downloading: 'Downloading',
  completed: 'Ready',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export function DownloadsPage() {
  useDocumentTitle('Downloads');
  const queryClient = useQueryClient();
  const initial = useQuery({
    queryKey: ['downloads'],
    queryFn: api.downloads,
    refetchOnWindowFocus: false,
  });
  const [jobs, setJobs] = useState<Record<string, DownloadJob>>({});
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    if (!initial.data) return;
    setJobs(Object.fromEntries(initial.data.downloads.map((job) => [job.id, job])));
  }, [initial.data]);

  useEffect(() => {
    const source = new EventSource('/api/downloads/events');
    const onUpdate = (event: MessageEvent<string>) => {
      try {
        const job = JSON.parse(event.data) as DownloadJob;
        setJobs((current) => ({ ...current, [job.id]: job }));
      } catch {
        // Ignore malformed events.
      }
    };
    source.addEventListener('update', onUpdate as EventListener);
    return () => {
      source.removeEventListener('update', onUpdate as EventListener);
      source.close();
    };
  }, []);

  const invalidateStats = () => void queryClient.invalidateQueries({ queryKey: ['stats'] });

  const cancel = useMutation({
    mutationFn: api.cancelDownload,
    onSuccess: (job) => setJobs((current) => ({ ...current, [job.id]: job })),
    onError: (error: Error) => toast(error.message, 'error'),
  });

  const retry = useMutation({
    mutationFn: api.retryDownload,
    onSuccess: (job) => {
      setJobs((current) => ({ ...current, [job.id]: job }));
      toast('Download queued again', 'info');
    },
    onError: (error: Error) => toast(error.message, 'error'),
  });

  const remove = useMutation({
    mutationFn: api.deleteDownload,
    onSuccess: (_data, id) => {
      setJobs((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      invalidateStats();
      toast('Download removed', 'success');
    },
    onError: (error: Error) => toast(error.message, 'error'),
  });

  const all = useMemo(
    () => Object.values(jobs).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [jobs],
  );
  const active = all.filter((job) => job.status === 'queued' || job.status === 'downloading');
  const completed = all.filter((job) => job.status === 'completed');
  const failed = all.filter((job) => job.status === 'failed' || job.status === 'cancelled');
  const visible = filter === 'active' ? active : filter === 'completed' ? completed : filter === 'failed' ? failed : all;

  return (
    <div className="page downloads-page">
      <header className="page-heading split">
        <div>
          <p className="eyebrow">Offline audio</p>
          <h1>Downloads</h1>
          <p className="muted">
            {active.length > 0
              ? `${pluralize(active.length, 'download')} in progress`
              : 'Audio is saved to the local data/downloads folder.'}
          </p>
        </div>
        <Link to="/search" className="button">
          <Download size={16} />
          Find something to download
        </Link>
      </header>

      <div className="filter-row">
        <FilterButton label="All" count={all.length} active={filter === 'all'} onClick={() => setFilter('all')} />
        <FilterButton
          label="Active"
          count={active.length}
          active={filter === 'active'}
          onClick={() => setFilter('active')}
        />
        <FilterButton
          label="Completed"
          count={completed.length}
          active={filter === 'completed'}
          onClick={() => setFilter('completed')}
        />
        <FilterButton
          label="Failed"
          count={failed.length}
          active={filter === 'failed'}
          onClick={() => setFilter('failed')}
        />
      </div>

      {initial.isLoading ? <LoadingState label="Loading downloads…" /> : null}
      {initial.isError ? (
        <ErrorState
          message={initial.error instanceof Error ? initial.error.message : 'Could not load downloads.'}
          onRetry={() => void initial.refetch()}
        />
      ) : null}

      {!initial.isLoading && all.length === 0 ? (
        <EmptyState
          icon={FolderDown}
          title="No downloads yet"
          message="Use the download button on any track to keep it offline."
          action={
            <Link to="/search" className="button">
              Browse music
            </Link>
          }
        />
      ) : null}

      {visible.length > 0 ? (
        <div className="download-list">
          {visible.map((job) => (
            <div className={`download-row status-${job.status}`} key={job.id}>
              <Artwork src={job.thumbnail} alt={job.title} className="download-art" />
              <div className="download-main">
                <div className="download-title-row">
                  <Link to={`/track/${encodeURIComponent(job.videoId)}`} className="download-title">
                    {job.title}
                  </Link>
                  <span className={`status-chip ${job.status}`}>{statusLabels[job.status]}</span>
                </div>
                <p className="download-subtitle">
                  {job.artist} · {job.format.toUpperCase()}
                  {job.completedAt ? ` · ${formatDate(job.completedAt)}` : ''}
                </p>

                {job.status === 'downloading' || job.status === 'queued' ? (
                  <div className="download-progress">
                    <div className="progress-track">
                      <span style={{ width: `${Math.max(2, job.progress)}%` }} />
                    </div>
                    <span>
                      {job.progress.toFixed(1)}%
                      {job.speed ? ` · ${job.speed}` : ''}
                      {job.eta ? ` · ETA ${job.eta}` : ''}
                    </span>
                  </div>
                ) : null}

                {job.error ? <p className="download-error">{job.error}</p> : null}
              </div>

              <div className="download-actions">
                {job.status === 'completed' ? (
                  <a className="button small" href={api.downloadFileUrl(job.id)} download>
                    <Download size={15} />
                    Save file
                  </a>
                ) : null}
                {job.status === 'queued' || job.status === 'downloading' ? (
                  <button
                    className="icon-button"
                    title="Cancel download"
                    onClick={() => cancel.mutate(job.id)}
                  >
                    <X size={17} />
                  </button>
                ) : null}
                {job.status === 'failed' || job.status === 'cancelled' ? (
                  <button
                    className="icon-button"
                    title="Retry download"
                    onClick={() => retry.mutate(job.id)}
                  >
                    <RotateCcw size={17} />
                  </button>
                ) : null}
                <button
                  className="icon-button"
                  title="Delete download"
                  onClick={() => {
                    if (window.confirm(`Remove “${job.title}” and its file?`)) remove.mutate(job.id);
                  }}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!initial.isLoading && all.length > 0 && visible.length === 0 ? (
        <EmptyState
          title={filter === 'active' ? 'No active downloads' : 'Nothing here'}
          message={filter === 'active' ? 'Queue a track to see progress here.' : 'Try another filter.'}
        />
      ) : null}
    </div>
  );
}

function FilterButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`chip ${active ? 'active' : ''}`} onClick={onClick}>
      {label}
      <span className="chip-count">{count}</span>
    </button>
  );
}
