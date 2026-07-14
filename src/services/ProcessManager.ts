import { getRunningProcesses, getActiveWindow, ProcessInfo } from "../lib/tauri-ipc";
import { eventBus } from "./EventBus";
import { libraryManager } from "./LibraryManager";
import { gameDetector } from "./GameDetector";

export class ProcessManager {
  private pollingInterval: number | null = null;
  private knownProcesses = new Map<number, ProcessInfo>();
  private activeLibraryExecutables = new Set<string>();

  async startPolling(intervalMs: number = 3000): Promise<void> {
    if (this.pollingInterval) return;

    // 0. Wipe all ghost running states on startup to fix stuck games
    try {
      const entries = await libraryManager.getAllEntries();
      for (const entry of entries) {
        if (entry.isRunning) {
          await libraryManager.updateEntry(entry.id, { isRunning: false }, true);
        }
      }
    } catch (e) {
      console.error("[ProcessManager] Failed to wipe ghost states", e);
    }

    this.poll();
    this.pollingInterval = window.setInterval(() => this.poll(), intervalMs);
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      window.clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private async poll(): Promise<void> {
    try {
      const currentProcesses = await getRunningProcesses();
      const currentPids = new Set(currentProcesses.map((p) => p.pid));

      // 1. Process Terminations
      for (const [pid, processInfo] of this.knownProcesses.entries()) {
        if (!currentPids.has(pid)) {
          this.handleProcessTerminated(processInfo);
          this.knownProcesses.delete(pid);
        }
      }

      // 2. New Processes
      for (const processInfo of currentProcesses) {
        if (!this.knownProcesses.has(processInfo.pid)) {
          this.knownProcesses.set(processInfo.pid, processInfo);
          await this.handleNewProcess(processInfo);
        }
      }

      // 3. Foreground State
      const activeWindow = await getActiveWindow();
      // Inform the LibraryManager of the currently active app so it can update "Playing" vs "Running in Background"
      if (activeWindow) {
         eventBus.emit("process:active_window_changed", activeWindow);
      }

    } catch (error) {
      console.error("[ProcessManager] Polling error:", error);
    }
  }

  private async handleNewProcess(process: ProcessInfo): Promise<void> {
    try {
      if (!process.exePath || !process.hash) return; // Hash must be present from Rust

      // Deduplicate: See if we already have this in Library via Hash or Path
      const entries = await libraryManager.getAllEntries();
      let libraryEntry = entries.find(e => 
        (e.metadata?.hash && process.hash && e.metadata.hash === process.hash) || 
        (e.executablePath && process.exePath && e.executablePath.toLowerCase() === process.exePath.toLowerCase())
      );

      if (!libraryEntry) {
        // Prevent adding new unknown apps/games when offline since metadata detection will fail
        if (!navigator.onLine) {
           console.log(`[ProcessManager] Offline mode: ignoring unknown process ${process.name}`);
           return;
        }

        // Unknown Process - Run heuristic Game Detector
        const detection = await gameDetector.evaluate(process);

        // Before creating a new entry, let's see if the detected officialTitle OR steamAppId matches an existing game
        // that doesn't have an executable path yet (e.g., synced from Steam or manually added via wishlist)!
        libraryEntry = entries.find(e => {
           if (e.type !== "game") return false;
           // If it matches via Steam ID
           if (detection.steamAppId && e.metadata?.steamAppId === detection.steamAppId) return true;
           // Or if it strictly matches the normalized title (and it's a bare entry with no exe yet)
           if (e.title.toLowerCase() === detection.officialTitle.toLowerCase() && !e.executablePath) return true;
           return false;
        });

        if (libraryEntry) {
           // We found an existing synced game! Just bind the executable path to it!
           await libraryManager.updateEntry(libraryEntry.id, {
              executablePath: process.exePath,
              executableName: process.name,
              metadata: {
                  ...libraryEntry.metadata,
                  hash: process.hash,
              }
           });
           console.log(`[ProcessManager] Bound process to existing synced game: ${libraryEntry.title}`);
        } else {
          libraryEntry = await libraryManager.createEntry({
            title: detection.officialTitle,
            type: detection.isGame ? "game" : "application",
            executablePath: process.exePath,
            executableName: process.name,
            coverPath: detection.coverUrl,
          });

          // Store the exact hash
          await libraryManager.updateEntry(libraryEntry.id, {
             metadata: {
                hash: process.hash,
                steamAppId: detection.steamAppId,
                confidence: detection.confidence,
             }
          });
          
          if (!detection.isGame) {
             await libraryManager.enrichApplication(libraryEntry.id);
          } else {
             // Auto-fetch full game metadata from Steam/IGDB
             await libraryManager.convertToGame(libraryEntry.id);
          }
          
          console.log(`[ProcessManager] Auto-added ${libraryEntry.type}: ${libraryEntry.title} (Confidence: ${detection.confidence})`);
        }
      }

      if (libraryEntry) {
        this.activeLibraryExecutables.add(libraryEntry.id);
        await libraryManager.setRunning(libraryEntry.id, true);
        
        eventBus.emit(libraryEntry.type === "application" ? "app:detected" : "game:detected", {
          entryId: libraryEntry.id,
          processId: process.pid,
          executablePath: process.exePath,
        });
      }
    } catch (error) {
      console.error(`[ProcessManager] Error handling new process ${process.name}:`, error);
    }
  }

  private async handleProcessTerminated(process: ProcessInfo): Promise<void> {
    try {
      const entries = await libraryManager.getAllEntries();
      let libraryEntry = entries.find(e => 
        (e.metadata?.hash && process.hash && e.metadata.hash === process.hash) || 
        (e.executablePath && process.exePath && e.executablePath.toLowerCase() === process.exePath.toLowerCase())
      );

      if (libraryEntry && this.activeLibraryExecutables.has(libraryEntry.id)) {
        this.activeLibraryExecutables.delete(libraryEntry.id);
        await libraryManager.setRunning(libraryEntry.id, false);
        eventBus.emit("process:terminated", {
          entryId: libraryEntry.id,
          processId: process.pid,
        });
      }
    } catch (error) {
      console.error(`[ProcessManager] Error handling terminated process ${process.name}:`, error);
    }
  }
}

export const processManager = new ProcessManager();
