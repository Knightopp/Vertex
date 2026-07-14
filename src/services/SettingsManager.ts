// EventBus could be used here if needed in the future

export type AppSettings = {
  accentColor: string;
  libraryScanPaths: string[];
  autoStart: boolean;
  discordRichPresence: boolean;
  metadataProviders: string[];
  steamId?: string;
  steamApiKey?: string;
  pinnedGamesOrder: string[];
  favoriteGamesOrder: string[];
  tutorialCompleted: boolean;
};

const DEFAULT_SETTINGS: AppSettings = {
  accentColor: "#8b5cf6", // Violet 500
  libraryScanPaths: [],
  autoStart: true,
  discordRichPresence: true,
  metadataProviders: ["igdb", "rawg", "steam"],
  steamId: "",
  steamApiKey: "",
  pinnedGamesOrder: [],
  favoriteGamesOrder: [],
  tutorialCompleted: false,
};

import { useAuthStore } from "../stores/auth-store";

const SETTINGS_KEY = "vazorism_settings";

function getSettingsKey() {
  const userId = useAuthStore.getState().user?.id;
  return userId ? `${SETTINGS_KEY}_${userId}` : SETTINGS_KEY;
}

export class SettingsManager {
  private cache: AppSettings | null = null;
  private unsubscribes: (() => void)[] = [];

  async init(): Promise<void> {
    await this.loadFromDb();
  }

  destroy(): void {
    this.unsubscribes.forEach((unsub) => unsub());
    this.unsubscribes = [];
  }

  getSettings(): AppSettings {
    if (!this.cache) {
      console.warn("[SettingsManager] Settings accessed before initialization, returning defaults.");
      return DEFAULT_SETTINGS;
    }
    return this.cache;
  }

  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    const settings = this.getSettings();
    return settings[key];
  }

  async update(partialSettings: Partial<AppSettings>): Promise<void> {
    const current = this.getSettings();
    const updated = { ...current, ...partialSettings };
    this.cache = updated;

    try {
      localStorage.setItem(getSettingsKey(), JSON.stringify(updated));
    } catch (error) {
      console.error("[SettingsManager] Failed to save settings to LocalStorage:", error);
      this.cache = current;
      throw error;
    }
  }

  private async loadFromDb(): Promise<void> {
    try {
      const key = getSettingsKey();
      let data = localStorage.getItem(key);
      if (!data && key !== SETTINGS_KEY) {
        data = localStorage.getItem(SETTINGS_KEY);
        if (data) localStorage.setItem(key, data);
      }
      if (data) {
        this.cache = { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
      } else {
        this.cache = { ...DEFAULT_SETTINGS };
      }
    } catch (error) {
      console.error("[SettingsManager] Failed to load settings:", error);
      this.cache = DEFAULT_SETTINGS;
    }
  }
}

export const settingsManager = new SettingsManager();
