import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  ListMusic,
  Monitor,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  RotateCcw,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AddToPlaylistButton } from './AddToPlaylistButton';
import { Artwork } from './Artwork';
import { DownloadButton } from './DownloadButton';
import { api } from '../lib/api';
import { formatDuration } from '../lib/format';
import { usePlayerStore } from '../stores/player';
import { useHistoryStore } from '../stores/history';
import { toast } from '../stores/toast';

export function PlayerBar() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queueOpen, setQueueOpen] = useState(false);
  const [playbackError, setPlaybackError] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  const queue = usePlayerStore((state) => state.queue);
  const currentIndex = usePlayerStore((state) => state.currentIndex);
  const current = queue[currentIndex];
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const volume = usePlayerStore((state) => state.volume);
  const muted = usePlayerStore((state) => state.muted);
  const shuffle = usePlayerStore((state) => state.shuffle);
  const repeat = usePlayerStore((state) => state.repeat);
  const toggle = usePlayerStore((state) => state.toggle);
  const next = usePlayerStore((state) => state.next);
  const previous = usePlayerStore((state) => state.previous);
  const jumpTo = usePlayerStore((state) => state.jumpTo);
  const removeFromQueue = usePlayerStore((state) => state.removeFromQueue);
  const clearQueue = usePlayerStore((state) => state.clearQueue);
  const setVolume = usePlayerStore((state) => state.setVolume);
  const toggleMute = usePlayerStore((state) => state.toggleMute);
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle);
  const cycleRepeat = usePlayerStore((state) => state.cycleRepeat);
  const addHistoryEntry = useHistoryStore((state) => state.addEntry);

  const currentId = current?.id;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const state = usePlayerStore.getState();
    const track = state.queue[state.currentIndex];
    if (!track) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      return;
    }
    setPlaybackError('');
    setWaiting(true);
    audio.src = api.streamUrl(track.id);
    audio.load();
    if (state.isPlaying) {
      void audio.play().catch(() => {
        setPlaybackError('Playback is blocked. Press play to start.');
        usePlayerStore.getState().setPlaying(false);
      });
    }
  }, [currentId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentId) return;
    if (isPlaying) {
      void audio.play().catch(() => {
        setPlaybackError('This track could not be played.');
        usePlayerStore.getState().setPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, currentId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    if (!current) return;
    const timer = window.setTimeout(() => {
      void api.recordHistory(current, progress).catch(() => undefined);
      if (current.type === 'episode') {
        addHistoryEntry({ ...current, playedAt: new Date().toISOString(), position: progress, episodeProgress: progress });
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [currentId, current, progress, addHistoryEntry]);

  useEffect(() => {
    if (!currentId) return;
    api.prefetchStream(currentId);
    const nextTrack = queue[(currentIndex + 1) % queue.length];
    if (!nextTrack || nextTrack.id === currentId) return;
    const timer = window.setTimeout(() => api.prefetchStream(nextTrack.id), 1500);
    return () => window.clearTimeout(timer);
  }, [currentId, currentIndex, queue]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      const audio = audioRef.current;
      if (event.code === 'Space') {
        event.preventDefault();
        toggle();
      } else if (event.code === 'ArrowRight' && audio) {
        audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
      } else if (event.code === 'ArrowLeft' && audio) {
        audio.currentTime = Math.max(0, audio.currentTime - 5);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  if (!current) {
    return (
      <div className="player-bar player-empty">
        <div className="player-empty-copy">
          <Music2 size={20} />
          <span>Choose a track to start listening</span>
        </div>
      </div>
    );
  }

  const shownDuration = duration || current.duration || 0;
  const progressStyle = {
    '--progress': `${shownDuration > 0 ? Math.min(100, (progress / shownDuration) * 100) : 0}%`,
  } as CSSProperties;

  const handleEnded = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (repeat === 'one') {
      audio.currentTime = 0;
      void audio.play();
    } else {
      next(true);
    }
  };

  const handlePrevious = () => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    previous();
  };

  return (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration || current.duration || 0);
          setWaiting(false);
        }}
        onDurationChange={(event) => setDuration(event.currentTarget.duration || current.duration || 0)}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => {
          setWaiting(false);
          setPlaybackError('');
        }}
        onEnded={handleEnded}
        onError={() => {
          setWaiting(false);
          setPlaybackError('This track could not be played. Try another result.');
          toast('Unable to play this track', 'error');
        }}
      />

      <div className={`player-bar ${queueOpen ? 'queue-open' : ''}`}>
        <div className="player-track">
          <Link to={`/track/${encodeURIComponent(current.id)}`} className="player-art-link">
            <Artwork src={current.thumbnail} alt={current.title} className="player-art" />
          </Link>
          <div className="player-track-copy">
            <Link to={`/track/${encodeURIComponent(current.id)}`} className="player-title">
              {current.title}
            </Link>
            <span className="player-artist">{current.artist}</span>
            {playbackError ? <span className="player-error">{playbackError}</span> : null}
          </div>
        </div>

        <div className="player-center">
          <div className="player-controls">
            <button
              className={`icon-button ${shuffle ? 'active' : ''}`}
              onClick={toggleShuffle}
              title="Shuffle"
              aria-label="Toggle shuffle"
            >
              <Shuffle size={17} />
            </button>
            <button className="icon-button" onClick={handlePrevious} title="Previous" aria-label="Previous track">
              <SkipBack size={19} fill="currentColor" />
            </button>
            <button
              className="play-button"
              onClick={toggle}
              title={isPlaying ? 'Pause' : 'Play'}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {waiting ? (
                <span className="mini-spinner" />
              ) : isPlaying ? (
                <Pause size={19} fill="currentColor" />
              ) : (
                <Play size={19} fill="currentColor" />
              )}
            </button>
            <button className="icon-button" onClick={() => next()} title="Next" aria-label="Next track">
              <SkipForward size={19} fill="currentColor" />
            </button>
            <button
              className={`icon-button ${repeat !== 'off' ? 'active' : ''}`}
              onClick={cycleRepeat}
              title={`Repeat: ${repeat}`}
              aria-label={`Repeat mode ${repeat}`}
            >
              {repeat === 'one' ? <Repeat1 size={17} /> : <Repeat size={17} />}
            </button>
          </div>
          <div className="player-progress">
            <span>{formatDuration(progress)}</span>
            <input
              type="range"
              min={0}
              max={shownDuration || 0}
              step={1}
              value={Math.min(progress, shownDuration || 0)}
              onChange={(event) => {
                const value = Number(event.target.value);
                setProgress(value);
                if (audioRef.current) audioRef.current.currentTime = value;
              }}
              style={progressStyle}
              aria-label="Seek"
            />
            <span>{formatDuration(shownDuration)}</span>
          </div>
        </div>

        <div className="player-side">
          <AddToPlaylistButton track={current} />
          <DownloadButton track={current} />
          {current.type === 'video' && (
            <button
              className="icon-button"
              onClick={() => window.open(`/video/${encodeURIComponent(current.id)}`, '_blank')}
              title="Play video"
              aria-label="Play video"
            >
              <Monitor size={18} />
            </button>
          )}
          <button
            className={`icon-button ${queueOpen ? 'active' : ''}`}
            onClick={() => setQueueOpen((value) => !value)}
            title="Queue"
            aria-label="Toggle queue"
          >
            <ListMusic size={18} />
          </button>
          <div className="volume-control">
            <button className="icon-button" onClick={toggleMute} title="Mute" aria-label="Mute">
              {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(event) => setVolume(Number(event.target.value))}
              aria-label="Volume"
            />
          </div>
        </div>
      </div>

      {queueOpen ? (
        <aside className="queue-panel" aria-label="Play queue">
          <div className="queue-head">
            <div>
              <p className="eyebrow">Up next</p>
              <h2>{queue.length} tracks</h2>
            </div>
            <div className="queue-head-actions">
              <button
                className="icon-button"
                onClick={async () => {
                  setClearingCache(true);
                  try {
                    await api.clearCache();
                    toast('Caches cleared', 'success');
                  } catch {
                    toast('Failed to clear caches', 'error');
                  } finally {
                    setClearingCache(false);
                  }
                }}
                title="Clear server caches (search, streams)"
                aria-label="Clear server caches"
                disabled={clearingCache}
              >
                <RotateCcw size={17} className={clearingCache ? 'spin' : ''} />
              </button>
              <button className="icon-button" onClick={clearQueue} title="Clear queue" aria-label="Clear queue">
                <Trash2 size={17} />
              </button>
              <button className="icon-button" onClick={() => setQueueOpen(false)} title="Close queue" aria-label="Close queue">
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="queue-list">
            {queue.map((track, index) => (
              <div
                key={`${track.id}-${index}`}
                className={`queue-row ${index === currentIndex ? 'active' : ''}`}
                onClick={() => jumpTo(index)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') jumpTo(index);
                }}
              >
                <span className="queue-number">{index + 1}</span>
                <Artwork src={track.thumbnail} alt={track.title} className="queue-art" />
                <div className="queue-copy">
                  <span className="queue-title">{track.title}</span>
                  <span className="queue-artist">{track.artist}</span>
                </div>
                <button
                  className="icon-button"
                  title="Remove from queue"
                  aria-label={`Remove ${track.title} from queue`}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeFromQueue(index);
                  }}
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        </aside>
      ) : null}
    </>
  );
}
