import { create } from "zustand";
import { libraryManager, LibraryEntryWithRelations } from "../services/LibraryManager";
import { eventBus } from "../services/EventBus";

interface LibraryState {
  entries: LibraryEntryWithRelations[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchLibrary: () => Promise<void>;
  getEntryById: (id: string) => LibraryEntryWithRelations | undefined;
}

export const useLibraryStore = create<LibraryState>()((set, get) => {
  
  // Auto-refresh the store whenever the library is updated (CRUD operations)
  // or when metadata/images arrive
  eventBus.on("library:updated", () => get().fetchLibrary());
  eventBus.on("metadata:updated", () => get().fetchLibrary());

  return {
    entries: [],
    isLoading: true,
    error: null,

    fetchLibrary: async () => {
      try {
        set({ isLoading: true, error: null });
        const entries = await libraryManager.getAllEntries();
        // Filter out soft-deleted entries
        const activeEntries = entries.filter((e) => !e.deletedAt);
        set({ entries: activeEntries, isLoading: false });
      } catch (error) {
        console.error("[useLibraryStore] Failed to fetch library:", error);
        set({ 
          error: error instanceof Error ? error.message : "Failed to load library",
          isLoading: false 
        });
      }
    },

    getEntryById: (id: string) => {
      return get().entries.find((e) => e.id === id);
    },
  };
});
