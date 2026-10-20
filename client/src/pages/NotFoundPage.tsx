import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '../components/States';

export function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="This page wandered off"
      message="The link may be broken, or the page may have moved."
      action={
        <Link to="/" className="button primary">
          Back to home
        </Link>
      }
    />
  );
}
