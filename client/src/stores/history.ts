import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HistoryEntry } from '../types';

interface HistoryState {
  entries: HistoryEntry[];
  addEntry: (entry: HistoryEntry) => void;
  getEpisodeProgress: (episodeId: string) => number;
  clearHistory: () => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      entries: [],

      addEntry: (entry) => {
        const state = get();
        const existing = state.entries.findIndex(
          (e) => e.id === entry.id && e.episodeProgress !== undefined
        );
        let newEntries: HistoryEntry[];
        if (existing >= 0) {
          newEntries = [...state.entries];
          newEntries[existing] = entry;
        } else {
          newEntries = [entry, ...state.entries].slice(0, 200);
        }
        set({ entries: newEntries });
      },

      getEpisodeProgress: (episodeId: string) => {
        const state = get();
        const entry = state.entries.find((e) => e.id === episodeId);
        return entry?.episodeProgress ?? 0;
      },

      clearHistory: () => set({ entries: [] }),
    }),
    {
      name: 'newpipe-music-history',
    },
  ),
);