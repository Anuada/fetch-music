import { useState, type ReactNode } from 'react';
import { Artwork } from './Artwork';

interface DetailHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  meta?: string;
  image?: string;
  imageAlt: string;
  actions?: ReactNode;
  description?: string;
}

export function DetailHeader({
  eyebrow,
  title,
  subtitle,
  meta,
  image,
  imageAlt,
  actions,
  description,
}: DetailHeaderProps) {
  return (
    <section className="detail-header">
      <Artwork src={image} alt={imageAlt} className="detail-art" />
      <div className="detail-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {subtitle ? <div className="detail-subtitle">{subtitle}</div> : null}
        {meta ? <p className="detail-meta">{meta}</p> : null}
        {actions ? <div className="detail-actions">{actions}</div> : null}
        {description ? <ExpandableText text={description} /> : null}
      </div>
    </section>
  );
}

function ExpandableText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 360;

  return (
    <div className="expandable">
      <p className={expanded ? 'description expanded' : 'description'}>{text}</p>
      {isLong ? (
        <button className="text-button" onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </div>
  );
}
