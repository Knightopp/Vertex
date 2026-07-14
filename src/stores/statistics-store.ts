import { create } from "zustand";
import { statisticsManager, GlobalStats } from "../services/StatisticsManager";
import { eventBus } from "../services/EventBus";

interface StatisticsState {
  stats: GlobalStats | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchStats: () => Promise<void>;
}

export const useStatisticsStore = create<StatisticsState>()((set, get) => {
  
  // Refresh stats whenever a session ends or library updates
  eventBus.on("session:ended", () => get().fetchStats());
  eventBus.on("library:updated", () => get().fetchStats());

  return {
    stats: null,
    isLoading: true,
    error: null,

    fetchStats: async () => {
      try {
        set({ isLoading: true, error: null });
        const stats = await statisticsManager.getGlobalStats();
        set({ stats, isLoading: false });
      } catch (error) {
        console.error("[useStatisticsStore] Failed to fetch stats:", error);
        set({ 
          error: error instanceof Error ? error.message : "Failed to load statistics",
          isLoading: false 
        });
      }
    },
  };
});
