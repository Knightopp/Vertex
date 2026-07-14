import { create } from "zustand";
import { discoveryManager, DiscoveryLists } from "../services/DiscoveryManager";

interface DiscoveryState {
  lists: DiscoveryLists | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchDiscovery: () => Promise<void>;
}

export const useDiscoveryStore = create<DiscoveryState>()((set, get) => ({
  lists: null,
  isLoading: true,
  error: null,

  fetchDiscovery: async () => {
    // If we already have data, don't set loading state to avoid flickers
    if (!get().lists) {
      set({ isLoading: true, error: null });
    }
    
    try {
      const lists = await discoveryManager.getTrendingGames();
      set({ lists, isLoading: false });
    } catch (error) {
      console.error("[useDiscoveryStore] Failed to fetch discovery:", error);
      set({ 
        error: error instanceof Error ? error.message : "Failed to load discovery data",
        isLoading: false 
      });
    }
  },
}));
