import { listen } from "@tauri-apps/api/event";
import { isTauriEnvironment, trimMemory } from "../lib/tauri-ipc";
import { eventBus } from "./EventBus";

export class TrayManager {
  private isTrayMode: boolean = false;
  private initialized: boolean = false;
  private listeners: ((inTray: boolean) => void)[] = [];

  init() {
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;

    if (isTauriEnvironment()) {
      listen<boolean>("app:tray-mode", (event) => {
        this.setTrayMode(event.payload);
      }).catch(console.error);
    }

    // Also monitor visibility changes as a defensive fallback
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && !this.isTrayMode) {
        // Document hidden (minimized to tray or taskbar)
        this.setTrayMode(true);
      } else if (!document.hidden && this.isTrayMode) {
        this.setTrayMode(false);
      }
    });
  }

  get isInTray(): boolean {
    return this.isTrayMode;
  }

  setTrayMode(inTray: boolean) {
    if (this.isTrayMode === inTray) return;
    this.isTrayMode = inTray;

    console.log(
      `[TrayManager] App mode switched: ${
        inTray ? "TRAY (Ultra-Low Resource Background Mode)" : "ACTIVE (Interactive UI Mode)"
      }`
    );

    if (inTray) {
      // Force purge memory working set in Windows
      trimMemory().catch(() => {});
    }

    eventBus.emit("tray:mode_changed", { inTray });
    this.listeners.forEach((fn) => fn(inTray));
  }

  onTrayChange(callback: (inTray: boolean) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }
}

export const trayManager = new TrayManager();
