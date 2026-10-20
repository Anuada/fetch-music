import { useEffect, useState } from 'react';
import { Music2 } from 'lucide-react';

interface ArtworkProps {
  src?: string;
  alt: string;
  className?: string;
}

export function Artwork({ src, alt, className = '' }: ArtworkProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <div className={`artwork ${className}`.trim()}>
      {src && !failed ? (
        <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <Music2 className="artwork-fallback" aria-hidden="true" />
      )}
    </div>
  );
}
