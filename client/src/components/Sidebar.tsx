import { Link, NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AudioLines,
  Download,
  History,
  House,
  Library,
  ListMusic,
  Search,
} from 'lucide-react';
import { api } from '../lib/api';

const navItems = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/search', label: 'Search', icon: Search, end: false },
  { to: '/library', label: 'Library', icon: Library, end: false },
  { to: '/history', label: 'History', icon: History, end: false },
  { to: '/downloads', label: 'Downloads', icon: Download, end: false },
];

export function Sidebar() {
  const playlists = useQuery({ queryKey: ['playlists'], queryFn: api.playlists });

  return (
    <aside className="sidebar">
      <Link to="/" className="brand">
        <span className="brand-mark">
          <AudioLines size={22} />
        </span>
        <span className="brand-copy">
          NewPipe
          <strong>Music</strong>
        </span>
      </Link>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Icon size={19} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-playlists">
        <div className="sidebar-label">
          <span>Your playlists</span>
          <Link to="/library" className="text-button">
            New
          </Link>
        </div>
        {playlists.isLoading ? <div className="sidebar-hint">Loading…</div> : null}
        {playlists.data?.playlists.length === 0 ? (
          <div className="sidebar-hint">Playlists you create appear here.</div>
        ) : null}
        {playlists.data?.playlists.slice(0, 8).map((playlist) => (
          <NavLink
            key={playlist.id}
            to={`/library/playlist/${playlist.id}`}
            className={({ isActive }) => `sidebar-playlist ${isActive ? 'active' : ''}`}
          >
            <span className="sidebar-playlist-icon">
              <ListMusic size={15} />
            </span>
            <span className="sidebar-playlist-copy">
              <span>{playlist.name}</span>
              <small>{playlist.trackCount} tracks</small>
            </span>
          </NavLink>
        ))}
      </div>

      <div className="sidebar-foot">
        <span className="status-dot" />
        <span>Local library</span>
      </div>
    </aside>
  );
}
