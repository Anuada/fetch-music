import type { ReactNode } from 'react';
import { AlertCircle, Loader2, Music2, type LucideIcon } from 'lucide-react';

export function LoadingState({ label = 'Loading music…' }: { label?: string }) {
  return (
    <div className="state-panel">
      <Loader2 className="spin" size={28} />
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-panel">
      <AlertCircle size={30} />
      <h2>Something went wrong</h2>
      <p>{message}</p>
      {onRetry ? (
        <button className="button" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}

export function EmptyState({ title, message, icon: Icon = Music2, action }: EmptyStateProps) {
  return (
    <div className="state-panel">
      <div className="state-icon">
        <Icon size={30} />
      </div>
      <h2>{title}</h2>
      {message ? <p>{message}</p> : null}
      {action}
    </div>
  );
}

export function SkeletonShelf() {
  return (
    <div className="skeleton-shelf">
      <div className="skeleton skeleton-title" />
      <div className="skeleton-row">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="skeleton-card" key={index}>
            <div className="skeleton skeleton-art" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line short" />
          </div>
        ))}
      </div>
    </div>
  );
}
