import { Download, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../stores/toast';
import type { Track } from '../types';

interface DownloadButtonProps {
  track: Track;
  format?: 'mp3' | 'm4a';
  className?: string;
  showLabel?: boolean;
}

export function DownloadButton({
  track,
  format = 'mp3',
  className = '',
  showLabel = false,
}: DownloadButtonProps) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => api.startDownload(track, format),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['downloads'] });
      toast(`Downloading ${track.title} as ${format.toUpperCase()}`, 'success');
    },
    onError: (error: Error) => toast(error.message, 'error'),
  });

  return (
    <button
      className={`icon-button ${className}`.trim()}
      title={`Download ${format.toUpperCase()}`}
      aria-label={`Download ${format.toUpperCase()}`}
      disabled={mutation.isPending}
      onClick={(event) => {
        event.stopPropagation();
        mutation.mutate();
      }}
    >
      {mutation.isPending ? <Loader2 className="spin" size={17} /> : <Download size={17} />}
      {showLabel ? <span>Download</span> : null}
    </button>
  );
}
