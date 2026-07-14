import { eventBus } from "./EventBus";

import { useAuthStore } from "../stores/auth-store";

const COLLECTIONS_STORAGE_KEY = "vazorism_collections";

export type CollectionWithEntries = any; // Simplified for localStorage mock

function getKey() {
  const userId = useAuthStore.getState().user?.id;
  return userId ? `${COLLECTIONS_STORAGE_KEY}_${userId}` : COLLECTIONS_STORAGE_KEY;
}

function getLocalCollections(): Record<string, any> {
  const key = getKey();
  const raw = localStorage.getItem(key);
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalCollections(data: Record<string, any>) {
  localStorage.setItem(getKey(), JSON.stringify(data));
}

export class CollectionsManager {
  async migrateLegacyCollections(): Promise<boolean> {
    const raw = localStorage.getItem(COLLECTIONS_STORAGE_KEY);
    if (!raw) return false;
    try {
      const legacyData = JSON.parse(raw);
      if (Object.keys(legacyData).length === 0) return false;
      
      const currentData = getLocalCollections();
      
      // Simple merge: we'll just merge arrays for entries, or take legacy if missing
      for (const [colId, col] of Object.entries(legacyData)) {
         if (!currentData[colId]) {
            currentData[colId] = col;
         } else {
            // merge entries
            const existingEntries = new Set((currentData[colId] as any).entries.map((e: any) => e.entryId));
            const newEntries = ((col as any).entries || []).filter((e: any) => !existingEntries.has(e.entryId));
            (currentData[colId] as any).entries.push(...newEntries);
         }
      }
      saveLocalCollections(currentData);
      return true;
    } catch {
      return false;
    }
  }
  /** Return the built-in collection that contains every detected/added game. */
  async ensureGamesOwnedCollection(): Promise<any> {
    const existing = (await this.getAllCollections()).find((collection) => collection.name === "Games Owned");
    return existing ?? this.createCollection("Games Owned", "Games detected or added to Tracker");
  }

  async addToGamesOwned(entryId: string): Promise<void> {
    const collection = await this.ensureGamesOwnedCollection();
    if (collection) await this.addGameToCollection(collection.id, entryId);
  }
  /**
   * Fetch all collections with their nested entries
   */
  async getAllCollections(): Promise<CollectionWithEntries[]> {
    try {
      const collections = getLocalCollections();
      return Object.values(collections).sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
    } catch (error) {
      console.error("[CollectionsManager] Failed to fetch collections:", error);
      return [];
    }
  }

  /**
   * Create a new collection
   */
  async createCollection(name: string, description?: string): Promise<any | null> {
    try {
      const collections = getLocalCollections();
      const id = "col_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
      
      const newCollection = {
        id,
        name,
        description,
        sortOrder: Object.keys(collections).length,
        entries: []
      };
      
      collections[id] = newCollection;
      saveLocalCollections(collections);
      
      eventBus.emit("collections:updated", { collectionId: id, action: "created" });
      return newCollection;
    } catch (error) {
      console.error("[CollectionsManager] Failed to create collection:", error);
      return null;
    }
  }

  /**
   * Delete a collection
   */
  async deleteCollection(id: string): Promise<boolean> {
    try {
      const collections = getLocalCollections();
      if (collections[id]) {
        delete collections[id];
        saveLocalCollections(collections);
        eventBus.emit("collections:updated", { collectionId: id, action: "deleted" });
        return true;
      }
      return false;
    } catch (error) {
      console.error("[CollectionsManager] Failed to delete collection:", error);
      return false;
    }
  }

  /**
   * Add a game to a collection
   */
  async addGameToCollection(collectionId: string, entryId: string): Promise<boolean> {
    try {
      const collections = getLocalCollections();
      if (!collections[collectionId]) return false;
      
      const exists = collections[collectionId].entries.find((e: any) => e.entryId === entryId);
      if (exists) {
        console.warn(`[CollectionsManager] Game ${entryId} may already be in collection ${collectionId}`);
        return false;
      }

      collections[collectionId].entries.push({
        collectionId,
        entryId,
        sortOrder: collections[collectionId].entries.length
      });
      
      saveLocalCollections(collections);
      eventBus.emit("collections:updated", { collectionId, action: "updated" });
      return true;
    } catch (error) {
      console.warn(`[CollectionsManager] Failed to add game ${entryId} to collection ${collectionId}`);
      return false;
    }
  }

  /**
   * Remove a game from a collection
   */
  async removeGameFromCollection(collectionId: string, entryId: string): Promise<boolean> {
    try {
      const collections = getLocalCollections();
      if (!collections[collectionId]) return false;
      
      collections[collectionId].entries = collections[collectionId].entries.filter((e: any) => e.entryId !== entryId);
      
      saveLocalCollections(collections);
      eventBus.emit("collections:updated", { collectionId, action: "updated" });
      return true;
    } catch (error) {
      console.error("[CollectionsManager] Failed to remove game from collection:", error);
      return false;
    }
  }

  /**
   * Reorder entries in a collection manually
   */
  async reorderCollectionEntries(collectionId: string, orderedEntryIds: string[]): Promise<boolean> {
    try {
      const collections = getLocalCollections();
      if (!collections[collectionId]) return false;
      
      const currentEntries = collections[collectionId].entries;
      const newEntries = orderedEntryIds.map((id, index) => {
        const existing = currentEntries.find((e: any) => e.entryId === id);
        return {
          ...existing,
          sortOrder: index
        };
      });

      collections[collectionId].entries = newEntries;
      saveLocalCollections(collections);
      eventBus.emit("collections:updated", { collectionId, action: "updated" });
      return true;
    } catch (error) {
      console.error("[CollectionsManager] Failed to reorder collection:", error);
      return false;
    }
  }
}

export const collectionsManager = new CollectionsManager();
