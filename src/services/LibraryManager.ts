import { steamProvider } from "../providers/SteamProvider";
import { steamGridDB } from "../providers/SteamGridDBProvider";
import { hltbProvider } from "../providers/HLTBProvider";
import { eventBus } from "./EventBus";
import { collectionsManager } from "./CollectionsManager";

export type EntryType = "game" | "application";
export type EntryStatus = "unplayed" | "playing" | "completed" | "backlog" | "dropped" | "wishlist" | "paused";

export interface UsageSession {
  id: string;
  entryId: string;
  processId: number;
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  effectiveSeconds: number;
  idleSeconds: number;
  isActive: boolean;
}

export interface LibraryEntryWithRelations {
  id: string;
  provider: string;
  providerGameId: string;
  title: string;
  executablePath?: string;
  installDirectory?: string;
  executableName?: string;
  type: EntryType;
  status: string;
  statusBeforeRunning?: string;
  isRunning?: boolean;
  playtimeTotal: number;
  lastPlayedAt?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  metadata?: any;
  timeToBeat?: number; // Total seconds
  images: Array<{ type: string; localPath?: string; remoteUrl?: string; isPrimary?: boolean }>;
  sessions: UsageSession[];
  genres?: any[];
  review?: any;
  favorite?: boolean;
  hidden?: boolean;
  [key: string]: any;
}

export type NewEntry = {
  title: string;
  provider?: string;
  providerGameId?: string;
  executablePath?: string;
  executableName?: string;
  installDirectory?: string;
  type?: EntryType;
  status?: EntryStatus;
  coverPath?: string;
};

import { useAuthStore } from "../stores/auth-store";

const LOCAL_STORAGE_KEY = "vazorism_library";

function getKey() {
  const userId = useAuthStore.getState().user?.id;
  return userId ? `${LOCAL_STORAGE_KEY}_${userId}` : LOCAL_STORAGE_KEY;
}

function getLocalData(): LibraryEntryWithRelations[] {
  const key = getKey();
  const raw = localStorage.getItem(key);
  try { return JSON.parse(raw || "[]"); } catch { return []; }
}

function saveLocalData(data: LibraryEntryWithRelations[]) { 
  localStorage.setItem(getKey(), JSON.stringify(data)); 
}

export class LibraryManager {
  hasLegacyData(): boolean {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      // Only return true if there are actually games inside
      return Array.isArray(data) && data.length > 0;
    } catch {
      return false;
    }
  }

  async migrateLegacyData(): Promise<boolean> {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return false;
    try {
      const legacyData: LibraryEntryWithRelations[] = JSON.parse(raw);
      if (!Array.isArray(legacyData) || legacyData.length === 0) return false;
      
      const currentData = getLocalData();
      
      // Merge, avoiding duplicates by ID
      const existingIds = new Set(currentData.map(e => e.id));
      const gamesToMigrate = legacyData.filter(e => e.type === "game" && !existingIds.has(e.id));
      
      if (gamesToMigrate.length === 0) return false;

      const newData = [...currentData, ...gamesToMigrate];
      saveLocalData(newData);
      
      // Also migrate collections at the same time to prevent dangling references
      await collectionsManager.migrateLegacyCollections();
      
      // Optionally clear the old data so it doesn't prompt again, or just leave it for other accounts.
      // We'll leave it but maybe mark it? Actually the simplest way to stop the notification 
      // without deleting it for other accounts is to store a flag in the user's settings or localstorage
      localStorage.setItem(`vazorism_migrated_legacy_${useAuthStore.getState().user?.id}`, "true");
      
      return true;
    } catch {
      return false;
    }
  }

  hasMigratedLegacyData(): boolean {
    return localStorage.getItem(`vazorism_migrated_legacy_${useAuthStore.getState().user?.id}`) === "true";
  }

  async getAllEntries() { return getLocalData().filter((entry) => !entry.deletedAt); }
  getEntries() { return getLocalData().filter((entry) => !entry.deletedAt); }
  async getEntry(id: string) { return this.getEntries().find((entry) => entry.id === id) || null; }

  async createEntry(data: NewEntry, skipSync = false): Promise<LibraryEntryWithRelations> {
    const entries = getLocalData();
    const now = new Date().toISOString();
    const entry: LibraryEntryWithRelations = {
      id: crypto.randomUUID(), title: data.title, executablePath: data.executablePath, executableName: data.executableName,
      provider: data.provider ?? "local",
      providerGameId: data.providerGameId ?? crypto.randomUUID(),
      installDirectory: data.installDirectory,
      type: data.type ?? "application", status: data.status ?? "unplayed", playtimeTotal: 0, createdAt: now, updatedAt: now,
      favorite: false, hidden: false,
      images: data.coverPath ? [{ type: "cover", remoteUrl: data.coverPath, isPrimary: true }] : [], sessions: [],
    };
    entries.push(entry); saveLocalData(entries);
    eventBus.emit("library:updated", { entryId: entry.id, action: "created" });
    
    if (!skipSync) {
      // Need dynamic import to avoid circular dependency
      import('./SyncManager').then(({ syncManager }) => {
        syncManager.enqueueOperation("library_game", "upsert", entry);
      });
    }
    return entry;
  }

  async updateEntry(id: string, data: Partial<LibraryEntryWithRelations>, skipSync = false) {
    const entries = getLocalData(); const index = entries.findIndex((entry) => entry.id === id);
    if (index < 0) return null;
    entries[index] = { ...entries[index], ...data, updatedAt: new Date().toISOString() };
    saveLocalData(entries); eventBus.emit("library:updated", { entryId: id, action: "updated" });

    if (!skipSync) {
      import('./SyncManager').then(({ syncManager }) => {
        syncManager.enqueueOperation("library_game", "upsert", entries[index]);
      });
    }

    return entries[index];
  }

  async setRunning(id: string, running: boolean) {
    const entry = await this.getEntry(id); if (!entry) return null;
    const updates: Partial<LibraryEntryWithRelations> = { isRunning: running };
    if (entry.type === "game") {
      if (running && entry.status !== "playing") { updates.statusBeforeRunning = entry.status; updates.status = "playing"; }
      if (!running && entry.status === "playing") { updates.status = entry.statusBeforeRunning ?? "unplayed"; updates.statusBeforeRunning = undefined; }
    }
    return this.updateEntry(id, updates);
  }

  async addSession(entryId: string, session: UsageSession) {
    const entry = await this.getEntry(entryId); if (!entry) return null;
    return this.updateEntry(entryId, { sessions: [...entry.sessions, session] });
  }

  async finishSession(entryId: string, session: UsageSession) {
    const entry = await this.getEntry(entryId); if (!entry) return null;
    const sessions = entry.sessions.map((item) => item.id === session.id ? session : item);
    return this.updateEntry(entryId, { sessions, playtimeTotal: entry.playtimeTotal + (session.effectiveSeconds + session.idleSeconds), lastPlayedAt: session.endedAt });
  }

  async convertToGame(id: string) {
    const entry = await this.getEntry(id); if (!entry) return null;
    const query = entry.title.replace(/\.exe$/i, "").replace(/[_-]+/g, " ");
    const matches = await steamProvider.search(query);
    const best = matches.find((match) => match.title.toLowerCase() === query.toLowerCase()) ?? matches[0];
    
    let timeToBeat: number | undefined;
    if (best) {
        timeToBeat = await hltbProvider.getGamePlaytime(best.title) || undefined;
    } else {
        timeToBeat = await hltbProvider.getGamePlaytime(query) || undefined;
    }

    if (!best) {
      const updated = await this.updateEntry(id, { type: "game", timeToBeat });
      if (updated) await collectionsManager.addToGamesOwned(id);
      return updated;
    }
    
    const metadata = await steamProvider.getMetadata(best.providerId);
    
    // Also try SteamGridDB for high-quality images if Steam ones are missing
    let sgdbCoverUrl: string | undefined;
    let sgdbHeroUrl: string | undefined;
    
    if (!metadata?.coverUrl || !metadata?.heroUrl) {
      try {
        const sgdbMatch = await steamGridDB.searchGame(best.title);
        if (sgdbMatch) {
          if (!metadata?.coverUrl) {
            sgdbCoverUrl = await steamGridDB.getCoverUrl(sgdbMatch.id) || undefined;
          }
          if (!metadata?.heroUrl) {
            sgdbHeroUrl = await steamGridDB.getHeroUrl(sgdbMatch.id) || undefined;
          }
        }
      } catch (e) {
        // Ignore SteamGridDB errors
      }
    }

    const finalCoverUrl = metadata?.coverUrl || sgdbCoverUrl;
    const finalHeroUrl = metadata?.heroUrl || sgdbHeroUrl;

    const imagesToSave = [];
    if (finalCoverUrl) imagesToSave.push({ type: "cover", remoteUrl: finalCoverUrl, isPrimary: true });
    if (finalHeroUrl) imagesToSave.push({ type: "hero", remoteUrl: finalHeroUrl });

    const updated = await this.updateEntry(id, {
      type: "game", title: metadata?.title ?? best.title,
      timeToBeat,
      metadata: metadata ? { description: metadata.description, developer: metadata.developer, publisher: metadata.publisher, genres: metadata.genres, steamAppId: metadata.providerIds.steam, source: "steam" } : undefined,
      genres: metadata?.genres.map((name) => ({ genre: { name } })),
      images: imagesToSave.length > 0 ? imagesToSave : entry.images,
    });
    
    // Only automatically add to Games Owned if it's not a wishlist item
    if (updated && updated.status !== "wishlist") {
      await collectionsManager.addToGamesOwned(id);
    }
    
    return updated;
  }

  async autoEnrichMissingGames() {
    const entries = await this.getAllEntries();
    // A game is missing full data if it doesn't have the 'source' flag set by a successful convertToGame, AND we haven't already tried and failed.
    const missing = entries.filter(e => e.type === "game" && (!e.metadata?.source) && (!e.metadata?.enrichAttempted));
    
    if (missing.length > 0) {
      console.log(`[LibraryManager] Auto-enriching ${missing.length} missing games in background...`);
      import("sonner").then(({ toast }) => {
        toast.info(`Fetching high-res artwork for ${missing.length} games...`);
      });
      
      const CONCURRENCY = 10;
      for (let i = 0; i < missing.length; i += CONCURRENCY) {
        const batch = missing.slice(i, i + CONCURRENCY);
        
        await Promise.all(batch.map(async (game) => {
          try {
            console.log(`[LibraryManager] Fetching metadata for ${game.title}...`);
            const updated = await this.convertToGame(game.id);
            // If convertToGame returned something without source (meaning it failed to find metadata), 
            // we mark it as attempted so we don't spam the API on every startup
            if (!updated || !updated.metadata?.source) {
                const current = await this.getEntry(game.id);
                if (current) {
                    await this.updateEntry(game.id, {
                        metadata: { ...(current.metadata || {}), enrichAttempted: true }
                    });
                }
            }
          } catch (e) {
            console.error(`Failed to auto-enrich ${game.title}`, e);
            const current = await this.getEntry(game.id);
            if (current) {
                await this.updateEntry(game.id, { metadata: { ...(current.metadata || {}), enrichAttempted: true } });
            }
          }
        }));
        
        // Tiny sleep between batches to prevent severe rate-limiting
        if (i + CONCURRENCY < missing.length) {
          await new Promise(r => setTimeout(r, 300));
        }
      }
      import("sonner").then(({ toast }) => toast.success(`Artwork fetch complete!`));
    }
  }

  /** Enrich an application only when Steam has an exact software/title match, fallback to SteamGridDB */
  async enrichApplication(id: string) {
    const entry = await this.getEntry(id); if (!entry) return null;
    const query = entry.title.replace(/\.exe$/i, "").replace(/[_-]+/g, " ");
    
    // First try SteamGridDB for high-quality application posters (VS Code, Discord, etc.)
    const sgdbMatch = await steamGridDB.searchGame(query);
    if (sgdbMatch) {
      const coverUrl = await steamGridDB.getCoverUrl(sgdbMatch.id);
      if (coverUrl) {
        return this.updateEntry(id, {
          title: sgdbMatch.name,
          images: [{ type: "cover", remoteUrl: coverUrl, isPrimary: true }]
        });
      }
    }

    const normalized = query.toLowerCase().replace(/[^a-z0-9]/g, "");
    const match = (await steamProvider.search(query)).find((item) => item.title.toLowerCase().replace(/[^a-z0-9]/g, "") === normalized);
    if (!match) return entry;
    const metadata = await steamProvider.getMetadata(match.providerId);
    if (!metadata) return entry;
    return this.updateEntry(id, {
      title: metadata.title,
      metadata: { description: metadata.description, developer: metadata.developer, publisher: metadata.publisher, genres: metadata.genres, steamAppId: metadata.providerIds.steam, source: "steam" },
      images: metadata.coverUrl ? [{ type: "cover", remoteUrl: metadata.coverUrl, isPrimary: true }] : entry.images,
    });
  }

  /** Normalize title for deduplication and canonical matching */
  normalizeCanonicalTitle(title: string): string {
    return (title || "")
      .replace(/\s*\((?:Program|Home Edition|64-bit|32-bit|x64|x86)\)/gi, "")
      .replace(/\.exe$/i, "")
      .replace(/[_-]+/g, " ")
      .trim();
  }

  /** Merges duplicate applications/games and purges excluded entries */
  async cleanupDuplicateEntries(): Promise<number> {
    const rawEntries = getLocalData();
    const activeEntries = rawEntries.filter(e => !e.deletedAt);
    const { settingsManager } = await import("./SettingsManager");
    const excluded = (settingsManager.getSettings().excludedApps || []).map(x => x.toLowerCase().trim());

    let changed = false;
    let mergedCount = 0;

    // 1. Purge any active entries matching excluded apps
    for (const entry of activeEntries) {
      const titleLower = entry.title.toLowerCase();
      const exeLower = (entry.executableName || "").toLowerCase();
      const pathLower = (entry.executablePath || "").toLowerCase();

      const isExcluded = excluded.some(ex => 
        (ex && titleLower.includes(ex)) || 
        (ex && exeLower === ex) || 
        (ex && pathLower.endsWith(ex)) ||
        (ex && pathLower.includes(ex))
      );

      if (isExcluded) {
        entry.deletedAt = new Date().toISOString();
        changed = true;
      }
    }

    // 2. Group active remaining entries by canonical key
    const remaining = activeEntries.filter(e => !e.deletedAt);
    const groups = new Map<string, LibraryEntryWithRelations[]>();

    for (const entry of remaining) {
      const canonical = this.normalizeCanonicalTitle(entry.title).toLowerCase();
      const key = `${entry.type}_${canonical}`;
      const group = groups.get(key) || [];
      group.push(entry);
      groups.set(key, group);
    }

    for (const [key, group] of groups.entries()) {
      if (group.length > 1) {
        // Sort to find the best representative entry
        // Priority: has image > higher playtime > has valid executablePath > newest
        group.sort((a, b) => {
          const aHasCover = a.images && a.images.length > 0 ? 1 : 0;
          const bHasCover = b.images && b.images.length > 0 ? 1 : 0;
          if (bHasCover !== aHasCover) return bHasCover - aHasCover;
          if (b.playtimeTotal !== a.playtimeTotal) return b.playtimeTotal - a.playtimeTotal;
          const aHasExe = a.executablePath ? 1 : 0;
          const bHasExe = b.executablePath ? 1 : 0;
          if (bHasExe !== aHasExe) return bHasExe - aHasExe;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });

        const primary = group[0];
        const duplicates = group.slice(1);

        let combinedPlaytime = primary.playtimeTotal;
        const allSessions = [...(primary.sessions || [])];
        const now = new Date().toISOString();

        for (const dup of duplicates) {
          combinedPlaytime += dup.playtimeTotal || 0;
          if (dup.sessions) {
            allSessions.push(...dup.sessions);
          }
          dup.deletedAt = now;
          mergedCount++;
        }

        primary.playtimeTotal = combinedPlaytime;
        primary.sessions = allSessions;
        primary.title = this.normalizeCanonicalTitle(primary.title);
        primary.updatedAt = now;
        changed = true;
      }
    }

    if (changed) {
      saveLocalData(rawEntries);
      eventBus.emit("library:updated", { action: "deduplicated" });
      console.log(`[LibraryManager] Deduplication complete. Merged ${mergedCount} duplicate entries.`);
    }

    return mergedCount;
  }

  async excludeApp(id: string): Promise<boolean> {
    const entry = await this.getEntry(id);
    if (!entry) return false;

    const { settingsManager } = await import("./SettingsManager");
    const settings = settingsManager.getSettings();
    const currentExcluded = [...(settings.excludedApps || [])];

    const candidates = [
      entry.executableName,
      entry.title,
      entry.executablePath ? entry.executablePath.split("\\").pop() : null
    ].filter(Boolean) as string[];

    for (const c of candidates) {
      const lower = c.toLowerCase().trim();
      if (!currentExcluded.some(ex => ex.toLowerCase() === lower)) {
        currentExcluded.push(lower);
      }
    }

    await settingsManager.update({ excludedApps: currentExcluded });
    await this.deleteEntry(id);
    return true;
  }

  async unexcludeApp(nameOrExe: string): Promise<boolean> {
    const { settingsManager } = await import("./SettingsManager");
    const settings = settingsManager.getSettings();
    const lower = nameOrExe.toLowerCase().trim();
    const updated = (settings.excludedApps || []).filter(ex => ex.toLowerCase() !== lower);
    await settingsManager.update({ excludedApps: updated });
    return true;
  }

  async deleteEntry(id: string) { return !!(await this.updateEntry(id, { deletedAt: new Date().toISOString() })); }
  async upsertReview(entryId: string, content: string, rating?: number) { return !!(await this.updateEntry(entryId, { rating, review: { content, rating } })); }
  async deleteReview(entryId: string) { return !!(await this.updateEntry(entryId, { rating: undefined, review: undefined })); }
  async toggleFavorite(id: string) { const entry = await this.getEntry(id); if (!entry) return false; await this.updateEntry(id, { favorite: !entry.favorite }); return !entry.favorite; }
  async addToWishlist(game: { title: string; coverUrl?: string; steamAppId?: number; price?: string }) { return this.createEntry({ title: game.title, type: "game", status: "wishlist", coverPath: game.coverUrl }); }
  async removeFromWishlist(id: string) { const item = this.getEntries().find((entry) => entry.id === id && entry.status === "wishlist"); return item ? this.deleteEntry(item.id) : false; }
}
export const libraryManager = new LibraryManager();
