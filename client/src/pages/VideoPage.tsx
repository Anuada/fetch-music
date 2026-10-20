import { useEffect, useRef, useState, type CSSProperties, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Maximize2, Minimize2, Settings, Volume2, VolumeX, RotateCcw, AlertCircle } from 'lucide-react';
import { DetailHeader } from '../components/DetailHeader';
import { DownloadButton } from '../components/DownloadButton';
import { ErrorState, LoadingState } from '../components/States';
import { api } from '../lib/api';
import { formatDuration } from '../lib/format';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { toast } from '../stores/toast';

const VIDEO_QUALITIES = ['1080p', '720p', '480p', '360p'] as const;
type VideoQuality = (typeof VIDEO_QUALITIES)[number];

const STORAGE_KEY = 'video-playback-position';

function savePosition(videoId: string, time: number): void {
  try {
    const data = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
    data[videoId] = { time, timestamp: Date.now() };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function getSavedPosition(videoId: string): number | null {
  try {
    const data = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
    const entry = data[videoId];
    if (entry && Date.now() - entry.timestamp < 24 * 60 * 60 * 1000) {
      return entry.time;
    }
  } catch {
    // ignore
  }
  return null;
}

function clearSavedPosition(videoId: string): void {
  try {
    const data = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
    delete data[videoId];
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function VideoPage() {
  const { id = '' } = useParams();
  const trackQuery = useQuery({
    queryKey: ['track', id],
    queryFn: () => api.track(id),
    enabled: Boolean(id),
    retry: 1,
  });
  useDocumentTitle(trackQuery.data?.track.title);

  const [quality, setQuality] = useState<VideoQuality>('720p');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackError, setPlaybackError] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [retryingQuality, setRetryingQuality] = useState(false);
  const [currentQualityIndex, setCurrentQualityIndex] = useState(VIDEO_QUALITIES.indexOf('720p'));

  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef(0);
  const durationRef = useRef(0);
  const isSeekingRef = useRef(false);
  const wasPlayingRef = useRef(false);

  const track = trackQuery.data?.track;

  const handleSeekStart = useCallback(() => {
    isSeekingRef.current = true;
  }, []);

  const handleSeekEnd = useCallback((value: number) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = value;
      progressRef.current = value;
    }
    isSeekingRef.current = false;
  }, []);

  const setVideoSource = useCallback(async (videoId: string, newQuality: VideoQuality, resumeTime?: number) => {
    const video = videoRef.current;
    if (!video) return false;

    wasPlayingRef.current = !video.paused;
    if (wasPlayingRef.current) video.pause();

    const targetTime = resumeTime ?? progressRef.current;
    setPlaybackError('');
    setWaiting(true);

    try {
      const newUrl = api.videoStreamUrl(videoId, newQuality);
      video.src = newUrl;
      video.load();

      await new Promise<void>((resolve, reject) => {
        const onLoaded = () => {
          video.removeEventListener('loadedmetadata', onLoaded);
          video.removeEventListener('error', onError);
          resolve();
        };
        const onError = () => {
          video.removeEventListener('loadedmetadata', onLoaded);
          video.removeEventListener('error', onError);
          reject(new Error('Failed to load video'));
        };
        video.addEventListener('loadedmetadata', onLoaded);
        video.addEventListener('error', onError);
      });

      if (targetTime > 0 && targetTime < (durationRef.current || video.duration || 0)) {
        video.currentTime = targetTime;
        progressRef.current = targetTime;
      }

      if (wasPlayingRef.current) {
        await video.play().catch(() => {
          setPlaybackError('Playback blocked. Press play to start.');
        });
      }
      setWaiting(false);
      return true;
    } catch (err) {
      setWaiting(false);
      setPlaybackError('Failed to switch quality. Try another.');
      console.error('Quality switch failed:', err);
      return false;
    }
  }, []);

  const tryNextQuality = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !track) return false;

    const nextIndex = currentQualityIndex + 1;
    if (nextIndex >= VIDEO_QUALITIES.length) {
      setPlaybackError('No playable quality available.');
      toast('Unable to play video at any quality', 'error');
      return false;
    }

    const nextQuality = VIDEO_QUALITIES[nextIndex];
    setRetryingQuality(true);
    toast(`Switching to ${nextQuality}...`, 'info');

    const success = await setVideoSource(track.id, nextQuality);
    if (success) {
      setQuality(nextQuality);
      setCurrentQualityIndex(nextIndex);
      setRetryingQuality(false);
      return true;
    }

    setRetryingQuality(false);
    return tryNextQuality();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id, currentQualityIndex, setVideoSource]);

  useEffect(() => {
    if (!track) return;
    const video = videoRef.current;
    if (!video) return;

    const savedTime = getSavedPosition(track.id);

    setPlaybackError('');
    setWaiting(true);
    setCurrentQualityIndex(VIDEO_QUALITIES.indexOf('720p'));

    video.src = api.videoStreamUrl(track.id, quality);
    video.load();

    video.addEventListener('loadedmetadata', () => {
      if (savedTime !== null && savedTime < (video.duration || 0)) {
        video.currentTime = savedTime;
        progressRef.current = savedTime;
      }
      if (wasPlayingRef.current) {
        video.play().catch(() => {
          setPlaybackError('Playback blocked. Press play to start.');
        });
      }
      setWaiting(false);
    }, { once: true });

    video.addEventListener('error', () => {
      setWaiting(false);
      if (!retryingQuality) {
        tryNextQuality();
      }
    }, { once: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id, quality, tryNextQuality, retryingQuality]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = muted ? 0 : volume;
    video.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    if (!track) return;
    const timer = window.setTimeout(() => {
      void api.recordHistory({ ...track, type: 'video' }, progressRef.current).catch(() => undefined);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [track?.id, track]);

  const handleEnded = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    clearSavedPosition(track?.id || '');
    video.play();
  };

  const handleTimeUpdate = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    if (isSeekingRef.current) return;
    progressRef.current = event.currentTarget.currentTime;
    durationRef.current = event.currentTarget.duration || track?.duration || 0;
    savePosition(track?.id || '', progressRef.current);
  };

  const handleLoadedMetadata = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    durationRef.current = event.currentTarget.duration || track?.duration || 0;
    setWaiting(false);
  };

  const handleWaiting = () => setWaiting(true);
  const handlePlaying = () => {
    setWaiting(false);
    setPlaybackError('');
  };

  const handleError = () => {
    const video = videoRef.current;
    if (!video) return;
    setWaiting(false);

    const error = video.error;
    if (error && (error.code === MediaError.MEDIA_ERR_NETWORK || error.code === MediaError.MEDIA_ERR_DECODE)) {
      if (!retryingQuality) {
        tryNextQuality();
      } else {
        setPlaybackError('This video could not be played. Try another quality.');
      }
    } else {
      setPlaybackError('This video could not be played. Try another quality.');
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => setPlaybackError('Playback failed'));
    } else {
      video.pause();
    }
  };

  const toggleFullscreen = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (!isFullscreen) {
      try {
        await video.requestFullscreen();
        setIsFullscreen(true);
      } catch {
        // Fullscreen not available
      }
    } else {
      try {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } catch {
        // Ignore
      }
    }
  };

  const handleFullscreenChange = () => {
    setIsFullscreen(document.fullscreenElement === videoRef.current);
  };

  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const shownDuration = durationRef.current || track?.duration || 0;
  const progressStyle = {
    '--progress': `${shownDuration > 0 ? Math.min(100, (progressRef.current / shownDuration) * 100) : 0}%`,
  } as CSSProperties;

  const handleQualityChange = async (newQuality: VideoQuality) => {
    if (!track || newQuality === quality) return;
    const newIndex = VIDEO_QUALITIES.indexOf(newQuality);
    setRetryingQuality(true);
    const success = await setVideoSource(track.id, newQuality);
    if (success) {
      setQuality(newQuality);
      setCurrentQualityIndex(newIndex);
    }
    setRetryingQuality(false);
    setShowQualityMenu(false);
  };

  if (trackQuery.isLoading) return <LoadingState label="Loading video…" />;
  if (trackQuery.isError) {
    return (
      <ErrorState
        message={trackQuery.error instanceof Error ? trackQuery.error.message : 'Could not load this video.'}
        onRetry={() => void trackQuery.refetch()}
      />
    );
  }
  if (!track) return null;

  return (
    <div className="page detail-page video-page">
      <DetailHeader
        eyebrow="Video"
        title={track.title}
        subtitle={<span>{track.artist}</span>}
        meta={`${formatDuration(track.duration)}${track.album ? ` · ${track.album}` : ''}`}
        image={track.thumbnail}
        imageAlt={track.title}
        actions={
          <>
            <DownloadButton track={track} />
          </>
        }
      />

      <section className="content-section video-section">
        <div className="video-container">
          <video
            ref={videoRef}
            className="video-player"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onWaiting={handleWaiting}
            onPlaying={handlePlaying}
            onEnded={handleEnded}
            onError={handleError}
            playsInline
          />
          {(playbackError || waiting) && (
            <div className="video-error-overlay">
              {waiting && !playbackError && <span className="mini-spinner" />}
              {playbackError && (
                <>
                  <AlertCircle size={24} className="error-icon" />
                  <p>{playbackError}</p>
                  <button className="button primary" onClick={togglePlay}>
                    Retry
                  </button>
                </>
              )}
            </div>
          )}
          {!isFullscreen && (
            <div className="video-controls">
              <div className="video-progress">
                <span>{formatDuration(progressRef.current)}</span>
                <input
                  type="range"
                  min={0}
                  max={shownDuration || 0}
                  step={1}
                  value={Math.min(progressRef.current, shownDuration || 0)}
                  onMouseDown={handleSeekStart}
                  onMouseUp={(e) => handleSeekEnd(Number((e.target as HTMLInputElement).value))}
                  onTouchEnd={(e) => handleSeekEnd(Number((e.target as HTMLInputElement).value))}
                  onChange={(event) => {
                    const value = Number((event.target as HTMLInputElement).value);
                    progressRef.current = value;
                  }}
                  style={progressStyle}
                  aria-label="Seek"
                />
                <span>{formatDuration(shownDuration)}</span>
              </div>
              <div className="video-controls-row">
                <button className="icon-button" onClick={togglePlay} aria-label={videoRef.current?.paused ? 'Play' : 'Pause'}>
                  {waiting ? <span className="mini-spinner" /> : videoRef.current?.paused ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                  )}
                </button>
                <div className="volume-control">
                  <button className="icon-button" onClick={() => setMuted(!muted)} aria-label={muted ? 'Unmute' : 'Mute'}>
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
                <div className="quality-selector">
                  <button
                    className="icon-button"
                    onClick={() => setShowQualityMenu(!showQualityMenu)}
                    aria-label="Video quality"
                    aria-expanded={showQualityMenu}
                    disabled={retryingQuality}
                  >
                    <Settings size={18} />
                    <span className="quality-label">{quality} {retryingQuality && <RotateCcw size={14} className="spin" />}</span>
                  </button>
                  {showQualityMenu && (
                    <div className="quality-menu">
                      {VIDEO_QUALITIES.map((q) => (
                        <button
                          key={q}
                          className={`quality-option ${quality === q ? 'active' : ''} ${VIDEO_QUALITIES.indexOf(q) < currentQualityIndex ? 'unavailable' : ''}`}
                          onClick={() => handleQualityChange(q)}
                          disabled={VIDEO_QUALITIES.indexOf(q) < currentQualityIndex || retryingQuality}
                        >
                          {q} {VIDEO_QUALITIES.indexOf(q) < currentQualityIndex && '(failed)'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  className="icon-button"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="video-info">
          <h2>{track.title}</h2>
          <p className="muted">{track.artist}</p>
          {track.album && <p className="muted">{track.album}</p>}
        </div>
      </section>
    </div>
  );
}