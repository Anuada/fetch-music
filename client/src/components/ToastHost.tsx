import { useEffect } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useToastStore, type ToastKind } from '../stores/toast';

const icons: Record<ToastKind, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  error: XCircle,
};

function ToastItem({ id, message, kind }: { id: number; message: string; kind: ToastKind }) {
  const remove = useToastStore((state) => state.remove);
  const Icon = icons[kind];

  useEffect(() => {
    const timer = window.setTimeout(() => remove(id), 4000);
    return () => window.clearTimeout(timer);
  }, [id, remove]);

  return (
    <div className={`toast toast-${kind}`} role="status">
      <Icon size={18} />
      <span>{message}</span>
      <button className="icon-button" onClick={() => remove(id)} aria-label="Dismiss notification">
        <X size={15} />
      </button>
    </div>
  );
}

export function ToastHost() {
  const toasts = useToastStore((state) => state.toasts);
  return (
    <div className="toast-host">
      {toasts.map((item) => (
        <ToastItem key={item.id} {...item} />
      ))}
    </div>
  );
}
