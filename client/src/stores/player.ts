import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Track } from '../types';

export type RepeatMode = 'off' | 'all' | 'one';

interface PlayerState {
  queue: Track[];
  currentIndex: number;
  isPlaying: boolean;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  playQueue: (tracks: Track[], startIndex?: number) => void;
  play: (track: Track) => void;
  enqueue: (track: Track, playNext?: boolean) => void;
  toggle: () => void;
  setPlaying: (playing: boolean) => void;
  next: (automatic?: boolean) => void;
  previous: () => void;
  jumpTo: (index: number) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
}

function clampIndex(index: number, length: number): number {
  if (length === 0) return 0;
  return Math.min(Math.max(0, index), length - 1);
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      queue: [],
      currentIndex: 0,
      isPlaying: false,
      volume: 0.8,
      muted: false,
      shuffle: false,
      repeat: 'off',

      playQueue: (tracks, startIndex = 0) => {
        const queue = tracks.filter((track) => track.kind === 'track');
        if (queue.length === 0) return;
        set({ queue, currentIndex: clampIndex(startIndex, queue.length), isPlaying: true });
      },

      play: (track) => {
        const state = get();
        const existing = state.queue.findIndex((item) => item.id === track.id);
        if (existing >= 0) {
          set({ currentIndex: existing, isPlaying: true });
          return;
        }
        const queue = [...state.queue];
        const index = state.queue.length;
        queue.push(track);
        set({ queue, currentIndex: index, isPlaying: true });
      },

      enqueue: (track, playNext = false) => {
        const state = get();
        if (state.queue.length === 0) {
          set({ queue: [track], currentIndex: 0, isPlaying: true });
          return;
        }
        const queue = [...state.queue];
        queue.splice(playNext ? state.currentIndex + 1 : queue.length, 0, track);
        set({ queue });
      },

      toggle: () => {
        const state = get();
        if (state.queue.length === 0) return;
        set({ isPlaying: !state.isPlaying });
      },

      setPlaying: (isPlaying) => set({ isPlaying }),

      next: (automatic = false) => {
        const state = get();
        if (state.queue.length === 0) return;
        if (state.shuffle && state.queue.length > 1) {
          let index = state.currentIndex;
          while (index === state.currentIndex) index = Math.floor(Math.random() * state.queue.length);
          set({ currentIndex: index, isPlaying: true });
          return;
        }
        if (state.currentIndex < state.queue.length - 1) {
          set({ currentIndex: state.currentIndex + 1, isPlaying: true });
          return;
        }
        if (state.repeat === 'all') {
          set({ currentIndex: 0, isPlaying: true });
          return;
        }
        if (automatic) set({ isPlaying: false });
      },

      previous: () => {
        const state = get();
        if (state.queue.length === 0) return;
        if (state.currentIndex > 0) {
          set({ currentIndex: state.currentIndex - 1, isPlaying: true });
        } else if (state.repeat === 'all') {
          set({ currentIndex: state.queue.length - 1, isPlaying: true });
        }
      },

      jumpTo: (index) => {
        const state = get();
        if (index < 0 || index >= state.queue.length) return;
        set({ currentIndex: index, isPlaying: true });
      },

      removeFromQueue: (index) => {
        const state = get();
        const queue = state.queue.filter((_, itemIndex) => itemIndex !== index);
        if (queue.length === 0) {
          set({ queue: [], currentIndex: 0, isPlaying: false });
          return;
        }
        let currentIndex = state.currentIndex;
        if (index < currentIndex) currentIndex -= 1;
        if (index === currentIndex) currentIndex = Math.min(index, queue.length - 1);
        set({ queue, currentIndex, isPlaying: state.isPlaying });
      },

      clearQueue: () => set({ queue: [], currentIndex: 0, isPlaying: false }),

      setVolume: (volume) => {
        const nextVolume = Math.min(1, Math.max(0, volume));
        set({ volume: nextVolume, muted: nextVolume === 0 ? get().muted : false });
      },

      toggleMute: () => set((state) => ({ muted: !state.muted })),

      toggleShuffle: () => set((state) => ({ shuffle: !state.shuffle })),

      cycleRepeat: () =>
        set((state) => ({
          repeat: state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off',
        })),
    }),
    {
      name: 'newpipe-music-player',
      partialize: (state) => ({
        queue: state.queue,
        currentIndex: state.currentIndex,
        volume: state.volume,
        muted: state.muted,
        shuffle: state.shuffle,
        repeat: state.repeat,
      }),
    },
  ),
);

export function useCurrentTrack(): Track | undefined {
  return usePlayerStore((state) => state.queue[state.currentIndex]);
}
