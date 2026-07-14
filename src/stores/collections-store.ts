import { create } from "zustand";
import { collectionsManager, CollectionWithEntries } from "../services/CollectionsManager";
import { eventBus } from "../services/EventBus";

interface CollectionsState {
  collections: CollectionWithEntries[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchCollections: () => Promise<void>;
}

export const useCollectionsStore = create<CollectionsState>()((set, get) => {
  
  // Re-fetch collections when updated
  eventBus.on("collections:updated", () => get().fetchCollections());

  return {
    collections: [],
    isLoading: true,
    error: null,

    fetchCollections: async () => {
      try {
        const collections = await collectionsManager.getAllCollections();
        set({ collections, isLoading: false, error: null });
      } catch (error) {
        console.error("[useCollectionsStore] Failed to fetch collections:", error);
        set({ 
          error: error instanceof Error ? error.message : "Failed to load collections",
          isLoading: false 
        });
      }
    },
  };
});
