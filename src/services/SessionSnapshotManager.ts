import { libraryManager, LibraryEntryWithRelations } from "./LibraryManager";
import { settingsManager } from "./SettingsManager";
import { invoke } from "@tauri-apps/api/core";
import { eventBus } from "./EventBus";

export interface SessionAppSnapshot {
  id: string;
  title: string;
  executablePath?: string;
  steamAppId?: number;
  type: "game" | "application";
  coverUrl?: string;
  playtimeSeconds: number;
  isPrimary: boolean;
  category: "Primary Activity" | "Companion";
}

export interface SessionSnapshot {
  timestamp: string;
  dateFormatted: string;
  durationMinutes: number;
  primaryTitle: string;
  apps: SessionAppSnapshot[];
}

const SNAPSHOT_STORAGE_KEY = "vazorism_last_session_snapshot";

export class SessionSnapshotManager {
  private updateTimer: number | null = null;

  init() {
    // Periodically update the latest session snapshot every 30 seconds
    if (typeof window !== "undefined") {
      this.updateTimer = window.setInterval(() => {
        this.captureCurrentSession();
      }, 30000);

      // Also capture on window beforeunload
      window.addEventListener("beforeunload", () => {
        this.captureCurrentSession();
      });

      // Capture whenever a process or session state updates
      eventBus.on("game:detected", () => this.captureCurrentSession());
      eventBus.on("app:detected", () => this.captureCurrentSession());
    }
  }

  destroy() {
    if (this.updateTimer) {
      window.clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /** Captures the current running / recently active session block */
  async captureCurrentSession(): Promise<void> {
    try {
      const entries = await libraryManager.getAllEntries();
      const settings = settingsManager.getSettings();
      const excluded = (settings.excludedApps || []).map(x => x.toLowerCase().trim());

      // Filter out excluded apps
      const validEntries = entries.filter(e => {
        const titleLower = e.title.toLowerCase();
        const exeLower = (e.executableName || "").toLowerCase();
        const isExcluded = excluded.some(ex => 
          (ex && titleLower.includes(ex)) || 
          (ex && exeLower === ex)
        );
        return !isExcluded;
      });

      // Find running entries or entries with recent sessions
      const runningGames = validEntries.filter(e => e.type === "game" && e.isRunning);
      const runningApps = validEntries.filter(e => e.type === "application" && e.isRunning);

      // If nothing is actively running right now, find the most recently played game/app within the last 4 hours
      let candidateEntries: LibraryEntryWithRelations[] = [...runningGames, ...runningApps];

      if (candidateEntries.length === 0) {
        const now = Date.now();
        const recent = validEntries.filter(e => {
          if (!e.lastPlayedAt) return false;
          const diffHours = (now - new Date(e.lastPlayedAt).getTime()) / (1000 * 60 * 60);
          return diffHours <= 4;
        });
        candidateEntries = recent;
      }

      if (candidateEntries.length === 0) {
        return; // No active session to snapshot
      }

      // Determine Primary Activity (prefer games, then app with highest total playtime or running status)
      candidateEntries.sort((a, b) => {
        if (a.type === "game" && b.type !== "game") return -1;
        if (b.type === "game" && a.type !== "game") return 1;
        if (a.isRunning && !b.isRunning) return -1;
        if (b.isRunning && !a.isRunning) return 1;
        return (b.playtimeTotal || 0) - (a.playtimeTotal || 0);
      });

      const primary = candidateEntries[0];
      const companions = candidateEntries.slice(1, 3); // Max 2 companion apps to avoid opening too many

      const appsToSave: SessionAppSnapshot[] = [];

      const formatCover = (e: LibraryEntryWithRelations) => {
        const cover = e.images?.find(i => i.type === "cover" || i.type === "hero");
        return cover?.localPath || cover?.remoteUrl || undefined;
      };

      appsToSave.push({
        id: primary.id,
        title: primary.title,
        executablePath: primary.executablePath,
        steamAppId: primary.metadata?.steamAppId,
        type: primary.type,
        coverUrl: formatCover(primary),
        playtimeSeconds: primary.playtimeTotal || 0,
        isPrimary: true,
        category: "Primary Activity"
      });

      for (const comp of companions) {
        appsToSave.push({
          id: comp.id,
          title: comp.title,
          executablePath: comp.executablePath,
          steamAppId: comp.metadata?.steamAppId,
          type: comp.type,
          coverUrl: formatCover(comp),
          playtimeSeconds: comp.playtimeTotal || 0,
          isPrimary: false,
          category: "Companion"
        });
      }

      const snapshot: SessionSnapshot = {
        timestamp: new Date().toISOString(),
        dateFormatted: new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
        durationMinutes: Math.round(primary.playtimeTotal / 60),
        primaryTitle: primary.title,
        apps: appsToSave
      };

      localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
    } catch (e) {
      console.warn("[SessionSnapshotManager] Failed to capture session snapshot:", e);
    }
  }

  /** Retrieves the last stored session snapshot if recent and valid */
  getLastSessionSnapshot(): SessionSnapshot | null {
    try {
      const raw = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
      if (!raw) return null;
      const snapshot: SessionSnapshot = JSON.parse(raw);
      if (!snapshot || !Array.isArray(snapshot.apps) || snapshot.apps.length === 0) {
        return null;
      }

      // Expire snapshots older than 48 hours
      const diffHours = (Date.now() - new Date(snapshot.timestamp).getTime()) / (1000 * 60 * 60);
      if (diffHours > 48) {
        this.clearSnapshot();
        return null;
      }

      return snapshot;
    } catch {
      return null;
    }
  }

  /** Clears the stored session snapshot */
  clearSnapshot(): void {
    localStorage.removeItem(SNAPSHOT_STORAGE_KEY);
  }

  /** Resumes selected apps from the snapshot */
  async resumeSession(selectedAppIds: string[]): Promise<number> {
    const snapshot = this.getLastSessionSnapshot();
    if (!snapshot) return 0;

    let launchedCount = 0;
    const toLaunch = snapshot.apps.filter(app => selectedAppIds.includes(app.id));

    for (const app of toLaunch) {
      try {
        if (app.steamAppId) {
          await invoke("launch_game", { pathOrUrl: `steam://rungameid/${app.steamAppId}` });
          launchedCount++;
        } else if (app.executablePath) {
          await invoke("launch_game", { pathOrUrl: app.executablePath });
          launchedCount++;
        } else {
          // Fallback to name
          await invoke("launch_game", { pathOrUrl: app.title });
          launchedCount++;
        }
      } catch (err) {
        console.warn(`[SessionSnapshotManager] Failed to launch ${app.title}:`, err);
      }
    }

    this.clearSnapshot();
    return launchedCount;
  }
}

export const sessionSnapshotManager = new SessionSnapshotManager();
sessionSnapshotManager.init();
