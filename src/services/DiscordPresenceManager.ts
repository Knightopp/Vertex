import { invoke } from "@tauri-apps/api/core";
import { settingsManager } from "./SettingsManager";
import { gameArtworkProvider } from "./GameArtworkProvider";
import { PresenceFormatter } from "./PresenceFormatter";

export interface DiscordButtonConfig {
  label: String;
  url: String;
}

export type PresenceStateMode = "idle" | "tracking" | "statistics" | "settings" | "disabled";

export interface DiscordActivityPayload {
  details?: string;
  state?: string;
  timestamps?: {
    start?: number;
    end?: number;
  };
  assets?: {
    large_image?: string;
    large_text?: string;
    small_image?: string;
    small_text?: string;
  };
  buttons?: DiscordButtonConfig[];
}

const IS_DEV = import.meta.env.DEV;

// Fallback asset keys uploaded to the Discord Developer Portal
const FALLBACK_LARGE_IMAGE_URL = "vertex-logo-v2";
const FALLBACK_SMALL_IMAGE_URL = "vertex-app-icon-v2";

export class DiscordPresenceManager {
  private isInitialized = false;
  private isEnabled = true;
  private currentMode: PresenceStateMode = "idle";
  private currentTrackedGame: any = null;
  private sessionStartTime: number | null = null;
  private lastPayloadJson: string | null = null;
  private buttons: DiscordButtonConfig[] = [
    { label: "Website", url: "https://github.com/Knightopp/Vertex" },
    { label: "GitHub", url: "https://github.com/Knightopp/Vertex" },
  ];

  /**
   * Initializes the Discord Presence Manager.
   * Loads user settings and sets up initial presence if enabled.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (IS_DEV) {
      console.log("[Discord] Initializing...");
    }

    const settings = settingsManager.getSettings();
    this.isEnabled = settings.discordRichPresence !== false;
    this.isInitialized = true;

    if (this.isEnabled) {
      await this.updateIdle();
    }
  }

  /**
   * Shuts down the Discord Presence Manager, clearing presence and disconnecting from IPC.
   */
  async shutdown(): Promise<void> {
    this.lastPayloadJson = null;
    this.currentMode = "disabled";
    if (IS_DEV) {
      console.log("[Discord] Disconnected");
    }
    try {
      await invoke("clear_discord_presence");
    } catch (error) {
      // Ignore cleanup errors if Discord is closed
    }
  }

  /**
   * Updates presence to Idle state ("Browsing Library").
   */
  async updateIdle(): Promise<void> {
    if (!this.checkEnabled("idle")) return;

    this.currentMode = "idle";
    this.currentTrackedGame = null;
    this.sessionStartTime = null;

    const payload: DiscordActivityPayload = {
      details: "Browsing Library",
      state: "Ready to Play",
      assets: {
        large_image: FALLBACK_LARGE_IMAGE_URL,
        large_text: "Vertex",
      },
      buttons: this.buttons,
    };

    await this.sendActivity(payload);
  }

  /**
   * Updates presence to Tracking state for a given game or application.
   */
  async updateTracking(game: any, sessionStart?: number | Date): Promise<void> {
    if (!game) {
      await this.updateIdle();
      return;
    }

    if (!this.checkEnabled("tracking")) return;

    this.currentMode = "tracking";
    this.currentTrackedGame = game;

    let startTimeMs: number;
    if (typeof sessionStart === "number") {
      startTimeMs = sessionStart;
    } else if (sessionStart instanceof Date) {
      startTimeMs = sessionStart.getTime();
    } else {
      startTimeMs = Date.now();
    }

    this.sessionStartTime = startTimeMs;

    const gameTitle = game.title || game.name || "Unknown Application";
    const entryType = game.type || "game"; // "game" or "application"
    
    const details = PresenceFormatter.getDetails(gameTitle, entryType);
    const state = PresenceFormatter.getState(entryType);
    const cleanedTitle = PresenceFormatter.cleanDisplayName(gameTitle);
    
    const artworkUrl = await gameArtworkProvider.resolveArtwork(game);
    const startUnixSeconds = Math.floor(startTimeMs / 1000);

    const payload: DiscordActivityPayload = {
      details,
      state,
      timestamps: {
        start: startUnixSeconds,
      },
      buttons: this.buttons,
    };

    if (artworkUrl) {
      // External Asset supported
      payload.assets = {
        large_image: artworkUrl,
        large_text: cleanedTitle,
        small_image: FALLBACK_LARGE_IMAGE_URL,
        small_text: "Vertex Game Tracker",
      };
    } else {
      // Fallback to standard Vertex branding
      payload.assets = {
        large_image: FALLBACK_LARGE_IMAGE_URL,
        large_text: cleanedTitle,
        small_image: FALLBACK_SMALL_IMAGE_URL,
        small_text: "Vertex Game Tracker",
      };
    }

    await this.sendActivity(payload);
  }

  /**
   * Updates presence to Statistics page state.
   */
  async updateStatistics(): Promise<void> {
    if (!this.checkEnabled("statistics")) return;

    // Do not override active game tracking
    if (this.currentMode === "tracking" && this.currentTrackedGame) return;

    this.currentMode = "statistics";

    const payload: DiscordActivityPayload = {
      details: "Viewing Statistics",
      state: "Analyzing Playtime",
      assets: {
        large_image: FALLBACK_LARGE_IMAGE_URL,
        large_text: "Vertex",
      },
      buttons: this.buttons,
    };

    await this.sendActivity(payload);
  }

  /**
   * Updates presence to Settings page state.
   */
  async updateSettings(): Promise<void> {
    if (!this.checkEnabled("settings")) return;

    // Do not override active game tracking
    if (this.currentMode === "tracking" && this.currentTrackedGame) return;

    this.currentMode = "settings";

    const payload: DiscordActivityPayload = {
      details: "Customizing Vertex",
      state: "Settings",
      assets: {
        large_image: FALLBACK_LARGE_IMAGE_URL,
        large_text: "Vertex",
      },
      buttons: this.buttons,
    };

    await this.sendActivity(payload);
  }

  /**
   * Enables or disables Discord Rich Presence.
   */
  async setEnabled(enabled: boolean): Promise<void> {
    this.isEnabled = enabled;

    if (!enabled) {
      await this.shutdown();
    } else {
      this.currentMode = "idle";
      await this.updateIdle();
    }
  }

  /**
   * Configure custom buttons for Rich Presence.
   */
  setButtons(buttons: DiscordButtonConfig[]): void {
    this.buttons = buttons;
    this.refreshCurrentState();
  }

  /**
   * Re-sends current state to Discord (useful on reconnection).
   */
  async refreshCurrentState(): Promise<void> {
    if (!this.isEnabled) return;

    if (this.currentMode === "tracking" && this.currentTrackedGame) {
      await this.updateTracking(this.currentTrackedGame, this.sessionStartTime || Date.now());
    } else if (this.currentMode === "statistics") {
      await this.updateStatistics();
    } else if (this.currentMode === "settings") {
      await this.updateSettings();
    } else {
      await this.updateIdle();
    }
  }

  private checkEnabled(_targetMode: PresenceStateMode): boolean {
    const settings = settingsManager.getSettings();
    this.isEnabled = settings.discordRichPresence !== false;

    if (!this.isEnabled) {
      if (this.currentMode !== "disabled") {
        this.shutdown();
      }
      return false;
    }
    return true;
  }

  private async sendActivity(payload: DiscordActivityPayload): Promise<void> {
    const payloadJson = JSON.stringify(payload);

    // Skip sending duplicate payload to avoid spamming Discord IPC
    if (payloadJson === this.lastPayloadJson) {
      return;
    }

    this.lastPayloadJson = payloadJson;

    if (IS_DEV) {
      console.log("[Discord] Updating Rich Presence...");
      console.log("[Discord] Activity payload:", payload);
    }

    try {
      await invoke("update_discord_presence", { activity: payload });
      if (IS_DEV) {
        console.log("[Discord] Activity updated successfully");
      }
    } catch (error) {
      if (IS_DEV) {
        console.log(`[Discord] Connection failed: ${error}`);
      }
    }
  }
}

export const discordPresenceManager = new DiscordPresenceManager();
