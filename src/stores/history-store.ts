import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ActionHistoryEntry {
  id: string;
  timestamp: number;
  actionId: string;
  details: string;
  status: "success" | "error";
}

interface HistoryState {
  entries: ActionHistoryEntry[];
  addEntry: (entry: Omit<ActionHistoryEntry, "id" | "timestamp">) => void;
  clearHistory: () => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      entries: [],
      addEntry: (entry) => set((state) => ({
        entries: [
          {
            ...entry,
            id: crypto.randomUUID(),
            timestamp: Date.now(),
          },
          ...state.entries,
        ].slice(0, 100) // Keep history bounded to 100 items
      })),
      clearHistory: () => set({ entries: [] }),
    }),
    {
      name: "vertex-agent-history",
    }
  )
);
