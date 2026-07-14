import { supabase } from "@/lib/supabase";
import { libraryManager, LibraryEntryWithRelations } from "./LibraryManager";
import { useAuthStore } from "@/stores/auth-store";
import { eventBus } from "./EventBus";

export interface SyncOperation {
  operationId: string;
  entityType: "library_game" | "collection" | "portable_setting";
  operationType: "upsert" | "delete";
  payload: any;
  retryCount: number;
  createdAt: string;
}

const SYNC_QUEUE_KEY = "vazorism_sync_queue";
const LAST_SYNC_KEY = "vazorism_last_sync";

function getQueueKey() {
  const userId = useAuthStore.getState().user?.id;
  return userId ? `${SYNC_QUEUE_KEY}_${userId}` : SYNC_QUEUE_KEY;
}

function getSyncKey() {
  const userId = useAuthStore.getState().user?.id;
  return userId ? `${LAST_SYNC_KEY}_${userId}` : LAST_SYNC_KEY;
}

function getSyncQueue(): SyncOperation[] {
  const key = getQueueKey();
  let raw = localStorage.getItem(key);
  if (!raw && key !== SYNC_QUEUE_KEY) {
    raw = localStorage.getItem(SYNC_QUEUE_KEY);
    if (raw) localStorage.setItem(key, raw);
  }
  try { return JSON.parse(raw || "[]"); } catch { return []; }
}
function saveSyncQueue(queue: SyncOperation[]) {
  localStorage.setItem(getQueueKey(), JSON.stringify(queue));
}
function getLastSyncTime(): string {
  const key = getSyncKey();
  let raw = localStorage.getItem(key);
  if (!raw && key !== LAST_SYNC_KEY) {
    raw = localStorage.getItem(LAST_SYNC_KEY);
    if (raw) localStorage.setItem(key, raw);
  }
  return raw || new Date(0).toISOString();
}
function setLastSyncTime(time: string) {
  localStorage.setItem(getSyncKey(), time);
}

export class SyncManager {
  private isSyncing = false;
  private syncInterval: NodeJS.Timeout | null = null;

  init() {
    // Listen for online events
    window.addEventListener("online", () => {
      console.log("[SyncManager] Back online, triggering sync...");
      this.triggerSync();
    });

    // Start background sync every 30 seconds
    this.syncInterval = setInterval(() => this.triggerSync(), 30000);

    // Initial sync
    setTimeout(() => {
      // If this is the very first sync, or if we need to force-sync to populate the new sessions column
      if (getLastSyncTime() === new Date(0).toISOString() || !localStorage.getItem("vazorism_force_sync_sessions_v2")) {
        const localGames = libraryManager.getEntries();
        for (const game of localGames) {
          // Check if it's already in the queue to avoid duplicates
          const queue = getSyncQueue();
          if (!queue.find(op => op.entityType === "library_game" && op.payload.id === game.id)) {
            this.enqueueOperation("library_game", "upsert", game);
          }
        }
        localStorage.setItem("vazorism_force_sync_sessions_v2", "true");
      }
      this.triggerSync();
    }, 2000); // Small delay on boot
  }

  destroy() {
    if (this.syncInterval) clearInterval(this.syncInterval);
  }

  enqueueOperation(entityType: SyncOperation["entityType"], operationType: SyncOperation["operationType"], payload: any) {
    // Only sync games, ignore applications
    if (entityType === "library_game" && payload.type === "application") {
      return;
    }

    const queue = getSyncQueue();
    queue.push({
      operationId: crypto.randomUUID(),
      entityType,
      operationType,
      payload,
      retryCount: 0,
      createdAt: new Date().toISOString()
    });
    saveSyncQueue(queue);
    
    // Attempt to sync immediately if online
    if (navigator.onLine) {
      this.triggerSync();
    }
  }

  private syncDebounce: NodeJS.Timeout | null = null;

  async triggerSync() {
    if (!navigator.onLine) return;
    
    // Debounce to allow bulk enqueues to finish before pulling the queue snapshot
    if (this.syncDebounce) clearTimeout(this.syncDebounce);
    
    this.syncDebounce = setTimeout(async () => {
      if (this.isSyncing) return; // If already running, let the current run finish (interval will catch the rest)
      
      const user = useAuthStore.getState().user;
      if (!user) return; // Must be logged in

      this.isSyncing = true;
      try {
        await this.syncPush(user.id);
        await this.syncPull(user.id);
      } catch (error) {
        console.error("[SyncManager] Sync failed:", error);
      } finally {
        this.isSyncing = false;
      }
    }, 100);
  }

  private async syncPush(userId: string) {
    let queue = getSyncQueue();
    if (queue.length === 0) return;

    console.log(`[SyncManager] Pushing ${queue.length} operations...`);
    const successfulIds = new Set<string>();

    for (const op of queue) {
      try {
        if (op.entityType === "library_game" && op.operationType === "upsert") {
          // If the entry was soft-deleted locally, delete it from the cloud
          if (op.payload.deletedAt) {
            const { data, error } = await supabase.from("library_games").delete()
              .eq("user_id", userId)
              .eq("provider", op.payload.provider || "local")
              .eq("provider_game_id", op.payload.providerGameId || op.payload.id)
              .select();
            
            if (error) throw error;
            if (!data || data.length === 0) {
              console.warn(`[SyncManager] Delete operation matched 0 rows in Supabase for game ID: ${op.payload.id}`);
              import("sonner").then(({ toast }) => {
                toast.error(`Could not find ${op.payload.title} in cloud to delete. It might be out of sync.`);
              });
            } else {
              import("sonner").then(({ toast }) => {
                toast.success(`Successfully deleted ${op.payload.title} from cloud.`);
              });
            }
          } else {
            const coverImage = op.payload.images?.find((img: any) => img.type === "cover");
            const heroImage = op.payload.images?.find((img: any) => img.type === "hero");
            const iconImage = op.payload.images?.find((img: any) => img.type === "icon");

            const { error } = await supabase.from("library_games").upsert({
              user_id: userId,
              provider: op.payload.provider || "local",
              provider_game_id: op.payload.providerGameId || op.payload.id,
              title: op.payload.title,
              playtime_total: op.payload.playtimeTotal || 0,
              last_played_at: op.payload.lastPlayedAt,
              favorite: op.payload.favorite || false,
              hidden: op.payload.hidden || false,
              status: op.payload.status || "unplayed",
              cover_url: coverImage?.remoteUrl,
              banner_url: heroImage?.remoteUrl,
              icon_url: iconImage?.remoteUrl,
              sessions: op.payload.sessions || [],
              updated_at: new Date().toISOString()
            }, { onConflict: "user_id,provider,provider_game_id" });

            if (error) throw error;
          }
        }
        
        // Mark as successful
        successfulIds.add(op.operationId);
      } catch (e: any) {
        console.error(`[SyncManager] Operation ${op.operationId} failed:`, e);
        // Only toast on the first retry to avoid spamming
        if (op.retryCount === 0) {
          import("sonner").then(({ toast }) => {
            toast.error(`Sync failed for ${op.payload.title}: ${e.message || "Unknown error"}`);
          });
        }
        op.retryCount++;
      }
    }

    if (successfulIds.size > 0) {
      import("sonner").then(({ toast }) => {
        toast.success(`Successfully synchronized ${successfulIds.size} items to cloud.`);
      });
    }

    // Remove successful operations from queue by re-reading to avoid async race condition
    const currentQueue = getSyncQueue();
    const updatedQueue = currentQueue.filter(op => !successfulIds.has(op.operationId));
    saveSyncQueue(updatedQueue);
  }

  private async syncPull(userId: string) {
    const lastSync = getLastSyncTime();
    
    // Fetch only games updated since last sync
    const { data: cloudGames, error } = await supabase
      .from("library_games")
      .select("*")
      .eq("user_id", userId)
      .gt("updated_at", lastSync);

    if (error) {
      console.error("[SyncManager] Pull failed:", error);
      return;
    }

    if (!cloudGames || cloudGames.length === 0) {
      setLastSyncTime(new Date().toISOString());
      return;
    }

    console.log(`[SyncManager] Pulling ${cloudGames.length} updated games...`);
    let requiresUiUpdate = false;
    const allLocalEntries = libraryManager.getEntries();

    for (const cloudGame of cloudGames) {
      // Reconstruct images array from cloud data
      const cloudImages = [];
      if (cloudGame.cover_url) cloudImages.push({ type: "cover", remoteUrl: cloudGame.cover_url, isPrimary: true });
      if (cloudGame.banner_url) cloudImages.push({ type: "hero", remoteUrl: cloudGame.banner_url });
      if (cloudGame.icon_url) cloudImages.push({ type: "icon", remoteUrl: cloudGame.icon_url });

      // Find matching local game by provider and providerGameId
      const localMatch = allLocalEntries.find(
        (e) => e.provider === cloudGame.provider && e.providerGameId === cloudGame.provider_game_id
      );

      if (localMatch) {
        // Conflict resolution: Math.max for playtime
        const resolvedPlaytime = Math.max(localMatch.playtimeTotal || 0, cloudGame.playtime_total || 0);
        
        // Merge sessions to prevent data loss across devices
        let mergedSessions = localMatch.sessions || [];
        if (cloudGame.sessions && Array.isArray(cloudGame.sessions)) {
          const sessionMap = new Map();
          (localMatch.sessions || []).forEach((s: any) => sessionMap.set(s.id, s));
          cloudGame.sessions.forEach((s: any) => sessionMap.set(s.id, s));
          mergedSessions = Array.from(sessionMap.values());
        }
        
        // Use updated_at timestamp for other portable fields (if cloud is newer)
        const localUpdatedAt = new Date(localMatch.updatedAt).getTime();
        const cloudUpdatedAt = new Date(cloudGame.updated_at).getTime();
        
        if (cloudUpdatedAt > localUpdatedAt) {
          // Never overwrite PC-specific data (executablePath, installDirectory)
          await libraryManager.updateEntry(localMatch.id, {
            title: cloudGame.title, // Only update if it changed
            playtimeTotal: resolvedPlaytime,
            lastPlayedAt: cloudGame.last_played_at || localMatch.lastPlayedAt,
            favorite: cloudGame.favorite,
            hidden: cloudGame.hidden,
            status: cloudGame.status,
            updatedAt: cloudGame.updated_at,
            images: cloudImages.length > 0 ? cloudImages : localMatch.images,
            sessions: mergedSessions
          }, true); // We'll add true flag so libraryManager doesn't trigger a recursive sync
          requiresUiUpdate = true;
        } else if (localMatch.playtimeTotal < resolvedPlaytime || mergedSessions.length > (localMatch.sessions?.length || 0)) {
           await libraryManager.updateEntry(localMatch.id, {
            playtimeTotal: resolvedPlaytime,
            sessions: mergedSessions
          }, true);
          requiresUiUpdate = true;
        }

      } else {
        // Game doesn't exist locally at all, create it without local paths
        const newEntry = await libraryManager.createEntry({
          title: cloudGame.title,
          provider: cloudGame.provider,
          providerGameId: cloudGame.provider_game_id,
          status: cloudGame.status,
          type: "game",
          coverPath: cloudGame.cover_url
        }, true);

        if (newEntry) {
          await libraryManager.updateEntry(newEntry.id, {
            playtimeTotal: cloudGame.playtime_total || 0,
            lastPlayedAt: cloudGame.last_played_at,
            favorite: cloudGame.favorite,
            hidden: cloudGame.hidden,
            updatedAt: cloudGame.updated_at,
            images: cloudImages.length > 0 ? cloudImages : newEntry.images,
            sessions: cloudGame.sessions || []
          }, true);
          requiresUiUpdate = true;
        }
      }
    }

    setLastSyncTime(new Date().toISOString());
    
    if (requiresUiUpdate) {
      eventBus.emit("library:updated", { action: "sync" });
    }
  }
}

export const syncManager = new SyncManager();
