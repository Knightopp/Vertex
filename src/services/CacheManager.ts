import { eventBus } from "./EventBus";
import { jobQueue } from "./JobQueue";

const CACHE_STORAGE_KEY = "vazorism_cache";

function getLocalCache(): Record<string, any> {
  try {
    const data = localStorage.getItem(CACHE_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function saveLocalCache(data: Record<string, any>) {
  localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(data));
}

export class CacheManager {
  private cleanupInterval: number | null = null;
  private unsubscribes: (() => void)[] = [];

  async init(): Promise<void> {
    jobQueue.registerHandler({
      type: "cache_cleanup",
      maxConcurrent: 1,
      handler: async () => {
        await this.runCleanup();
      },
    });

    this.cleanupInterval = window.setInterval(() => {
      jobQueue.enqueue("cache_cleanup", {}, "low");
    }, 900 * 1000);

    this.unsubscribes.push(
      eventBus.on("trending:updated", () => this.invalidate("discovery:trending"))
    );
  }

  destroy(): void {
    if (this.cleanupInterval) {
      window.clearInterval(this.cleanupInterval);
    }
    this.unsubscribes.forEach((unsub) => unsub());
    this.unsubscribes = [];
  }

  async setDiscoveryCache(category: string, data: any, ttlSeconds: number): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + ttlSeconds);

      const cache = getLocalCache();
      cache[category] = {
        data: JSON.stringify(data),
        expiresAt: expiresAt.toISOString()
      };
      saveLocalCache(cache);

      eventBus.emit("cache:updated", { key: `discovery:${category}`, action: "set" });
    } catch (error) {
      console.error(`[CacheManager] Failed to set cache for ${category}:`, error);
    }
  }

  async getDiscoveryCache<T>(category: string): Promise<T | null> {
    try {
      const cache = getLocalCache();
      const record = cache[category];
      if (!record) return null;

      if (new Date(record.expiresAt) < new Date()) {
        delete cache[category];
        saveLocalCache(cache);
        eventBus.emit("cache:updated", { key: `discovery:${category}`, action: "expired" });
        return null;
      }

      return JSON.parse(record.data) as T;
    } catch (error) {
      console.error(`[CacheManager] Failed to get cache for ${category}:`, error);
      return null;
    }
  }

  async invalidate(key: string): Promise<void> {
    if (key.startsWith("discovery:")) {
      const category = key.split(":")[1];
      try {
        const cache = getLocalCache();
        delete cache[category];
        saveLocalCache(cache);
        eventBus.emit("cache:updated", { key, action: "invalidated" });
      } catch (error) {
        console.error(`[CacheManager] Failed to invalidate cache for ${key}:`, error);
      }
    }
  }

  private async runCleanup(): Promise<void> {
    try {
      const cache = getLocalCache();
      let deletedCount = 0;
      const now = new Date();

      for (const category in cache) {
        if (new Date(cache[category].expiresAt) < now) {
          delete cache[category];
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        saveLocalCache(cache);
      }
      
      const freedBytes = 0; 

      if (deletedCount > 0 || freedBytes > 0) {
        eventBus.emit("cache:cleanup", {
          freedBytes,
          deletedCount,
        });
      }
    } catch (error) {
      console.error("[CacheManager] Cleanup failed:", error);
      throw error;
    }
  }
}

export const cacheManager = new CacheManager();
