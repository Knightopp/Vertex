import { create } from "zustand";
import { AppSettings, settingsManager } from "../services/SettingsManager";
import { invoke } from "@tauri-apps/api/core";

interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;
  error: string | null;
  tutorialCompleted: boolean;

  // Actions
  initialize: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  completeTutorial: () => void;
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  settings: settingsManager.getSettings(),
  isLoading: true,
  error: null,

  initialize: async () => {
    try {
      set({ isLoading: true, error: null });
      await settingsManager.init();
      const settings = settingsManager.getSettings();
      set({ settings, isLoading: false });

      // Apply initial autostart state via our custom rust command which wraps paths in quotes correctly
      await invoke("set_autostart", { enable: settings.autoStart }).catch(console.warn);
    } catch (error) {
      console.error("[useSettingsStore] Failed to initialize settings:", error);
      set({ 
        error: error instanceof Error ? error.message : "Failed to load settings",
        isLoading: false 
      });
    }
  },

  updateSettings: async (partial: Partial<AppSettings>) => {
    try {
      // Optimistic update
      set((state) => ({
        settings: { ...state.settings, ...partial },
        error: null
      }));

      // Apply autostart change immediately if present
      if (partial.autoStart !== undefined) {
        await invoke("set_autostart", { enable: partial.autoStart }).catch(console.warn);
      }

      // Persist via manager
      await settingsManager.update(partial);
      
      // Ensure we have the exact manager state if there were any normalizations
      set({ settings: settingsManager.getSettings() });
    } catch (error) {
      console.error("[useSettingsStore] Failed to update settings:", error);
      // Revert to manager's current state on failure
      set({ 
        settings: settingsManager.getSettings(),
        error: error instanceof Error ? error.message : "Failed to update settings"
      });
    }
  },

  completeTutorial: async () => {
    const state = useSettingsStore.getState();
    await state.updateSettings({ tutorialCompleted: true });
  },
}));
