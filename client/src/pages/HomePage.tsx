import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Search } from 'lucide-react';
import { Shelf } from '../components/Shelf';
import { ErrorState, LoadingState, SkeletonShelf } from '../components/States';
import { api } from '../lib/api';
import { greeting } from '../lib/format';

export function HomePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const home = useQuery({ queryKey: ['home'], queryFn: api.home, staleTime: 10 * 60_000 });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    navigate(value ? `/search?q=${encodeURIComponent(value)}&type=song` : '/search');
  };

  return (
    <div className="page home-page">
      <section className="home-hero">
        <div className="hero-copy">
          <p className="eyebrow">{greeting()}</p>
          <h1>Music for every moment.</h1>
          <p className="hero-text">
            Search YouTube Music, build a local library, and keep your favourite tracks offline.
          </p>
          <form className="hero-search" onSubmit={submit}>
            <Search size={19} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search songs, albums, artists…"
              aria-label="Search music"
            />
            <button type="submit" aria-label="Search">
              <ArrowRight size={18} />
            </button>
          </form>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-ring ring-one" />
          <div className="hero-ring ring-two" />
          <div className="hero-disc">
            <span />
          </div>
        </div>
      </section>

      {home.isLoading ? (
        <>
          <SkeletonShelf />
          <SkeletonShelf />
          <SkeletonShelf />
        </>
      ) : null}

      {home.isError ? (
        <ErrorState
          message={home.error instanceof Error ? home.error.message : 'Could not load the home feed.'}
          onRetry={() => void home.refetch()}
        />
      ) : null}

      {home.isSuccess && home.data.sections.length === 0 ? (
        <LoadingState label="No recommendations right now. Try searching for something." />
      ) : null}

      {home.data?.sections.map((shelf, index) => (
        <Shelf key={`${shelf.title}-${index}`} shelf={shelf} />
      ))}
    </div>
  );
}
