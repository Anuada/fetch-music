import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { AlbumPage } from './pages/AlbumPage';
import { ArtistPage } from './pages/ArtistPage';
import { PlaylistPage } from './pages/PlaylistPage';
import { TrackPage } from './pages/TrackPage';
import { PodcastPage } from './pages/PodcastPage';
import { VideoPage } from './pages/VideoPage';
import { LibraryPage } from './pages/LibraryPage';
import { LocalPlaylistPage } from './pages/LocalPlaylistPage';
import { HistoryPage } from './pages/HistoryPage';
import { DownloadsPage } from './pages/DownloadsPage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="album/:id" element={<AlbumPage />} />
        <Route path="artist/:id" element={<ArtistPage />} />
        <Route path="playlist/:id" element={<PlaylistPage />} />
        <Route path="track/:id" element={<TrackPage />} />
        <Route path="podcast/:id" element={<PodcastPage />} />
        <Route path="video/:id" element={<VideoPage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="library/playlist/:id" element={<LocalPlaylistPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="downloads" element={<DownloadsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
