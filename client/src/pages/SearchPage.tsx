import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { MediaCard } from '../components/MediaCard';
import { TrackList } from '../components/TrackList';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { api } from '../lib/api';
import type { SearchFilter } from '../types';

const filters: Array<{ value: SearchFilter; label: string }> = [
  { value: 'song', label: 'Songs' },
  { value: 'video', label: 'Videos' },
  { value: 'album', label: 'Albums' },
  { value: 'artist', label: 'Artists' },
  { value: 'playlist', label: 'Playlists' },
];

const ideas = ['Oasis', 'Taylor Swift', 'Daft Punk', 'Lo-fi beats', 'The Weeknd', 'Coldplay'];

function isFilter(value: string | null): value is SearchFilter {
  return filters.some((item) => item.value === value);
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q')?.trim() ?? '';
  const filter = isFilter(params.get('type')) ? (params.get('type') as SearchFilter) : 'song';
  const [input, setInput] = useState(query);
  const [focused, setFocused] = useState(false);
  const debounced = useDebouncedValue(input, 240);

  useEffect(() => {
    setInput(query);
  }, [query]);

  const suggestions = useQuery({
    queryKey: ['suggestions', debounced],
    queryFn: () => api.suggestions(debounced),
    enabled: focused && debounced.trim().length > 1,
    staleTime: 5 * 60_000,
  });

  const search = useQuery({
    queryKey: ['search', query, filter],
    queryFn: () => api.search(query, filter),
    enabled: query.length > 0,
    placeholderData: keepPreviousData,
  });

  const applySearch = (value: string, nextFilter = filter) => {
    const next = new URLSearchParams();
    if (value.trim()) next.set('q', value.trim());
    next.set('type', nextFilter);
    setParams(next);
    setFocused(false);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    applySearch(input);
  };

  const changeFilter = (nextFilter: SearchFilter) => {
    if (!query) {
      applySearch(input, nextFilter);
      return;
    }
    const next = new URLSearchParams(params);
    next.set('type', nextFilter);
    setParams(next);
  };

  const showCards = filter === 'album' || filter === 'artist' || filter === 'playlist';

  return (
    <div className="page search-page">
      <header className="page-heading">
        <p className="eyebrow">Search</p>
        <h1>Find your next favourite</h1>
      </header>

      <form className="search-form" onSubmit={submit}>
        <Search size={20} />
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          placeholder="Songs, albums, artists, playlists…"
          aria-label="Search music"
          autoFocus
        />
        {input ? (
          <button type="button" className="text-button" onClick={() => setInput('')}>
            Clear
          </button>
        ) : null}
        <button className="button primary" type="submit">
          Search
        </button>

        {focused && suggestions.data && suggestions.data.length > 0 ? (
          <div className="suggestion-box">
            {suggestions.data.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="suggestion-row"
                onMouseDown={(event) => {
                  event.preventDefault();
                  setInput(suggestion);
                  applySearch(suggestion);
                }}
              >
                <Search size={15} />
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
      </form>

      <div className="filter-row">
        {filters.map((item) => (
          <button
            key={item.value}
            className={`chip ${filter === item.value ? 'active' : ''}`}
            onClick={() => changeFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {!query ? (
        <div className="search-discovery">
          <h2>Try a search</h2>
          <div className="idea-row">
            {ideas.map((idea) => (
              <button key={idea} className="chip idea" onClick={() => applySearch(idea)}>
                {idea}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {search.isFetching && !search.data ? <LoadingState label="Searching YouTube Music…" /> : null}
      {search.isError ? (
        <ErrorState
          message={search.error instanceof Error ? search.error.message : 'Search failed.'}
          onRetry={() => void search.refetch()}
        />
      ) : null}

      {search.data && query ? (
        <section className="search-results">
          <div className="results-head">
            <h2>
              {showCards
                ? filters.find((item) => item.value === filter)?.label
                : filter === 'video'
                  ? 'Videos'
                  : 'Songs'}
            </h2>
            <span className="muted">
              {showCards
                ? `${search.data.cards.length} results for “${query}”`
                : `${search.data.tracks.length} results for “${query}”`}
              {search.isFetching ? ' · updating…' : ''}
            </span>
          </div>

          {showCards ? (
            search.data.cards.length > 0 ? (
              <div className="card-grid">
                {search.data.cards.map((card) => (
                  <MediaCard key={`${card.kind}-${card.id}`} item={card} />
                ))}
              </div>
            ) : (
              <EmptyState title="No results" message="Try a different spelling or filter." />
            )
          ) : search.data.tracks.length > 0 ? (
            <TrackList tracks={search.data.tracks} showAlbum />
          ) : (
            <EmptyState title="No results" message="Try a different spelling or filter." />
          )}
        </section>
      ) : null}
    </div>
  );
}
