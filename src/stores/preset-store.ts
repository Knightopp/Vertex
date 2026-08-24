import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PresetAction {
  id: string; // uuid
  actionId: string;
  parameters: Record<string, any>;
  delayMs?: number;
  skipIfRunning?: boolean;
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  icon: string;
  actions: PresetAction[];
  exitActions: PresetAction[];
}

interface PresetState {
  presets: Preset[];
  getPreset: (id: string) => Preset | undefined;
  addPreset: (preset: Preset) => void;
  updatePreset: (id: string, updates: Partial<Preset>) => void;
  removePreset: (id: string) => void;
}

export const usePresetStore = create<PresetState>()(
  persist(
    (set, get) => ({
      presets: [
        {
          id: "Gaming",
          name: "Gaming",
          description: "Optimize for maximum performance",
          icon: "Gamepad2",
          actions: [
            { id: "g1", actionId: "launch_app", parameters: { appName: "Discord" } },
            { id: "g2", actionId: "launch_app", parameters: { appName: "Steam" }, delayMs: 1000 },
            { id: "g3", actionId: "set_volume", parameters: { level: 40 } },
          ],
          exitActions: []
        },
        {
          id: "Editing",
          name: "Editing",
          description: "Start Adobe suite and block distractions",
          icon: "Video",
          actions: [
            { id: "e1", actionId: "launch_app", parameters: { appName: "After Effects" } },
            { id: "e2", actionId: "launch_app", parameters: { appName: "Photoshop" }, delayMs: 2000 },
            { id: "e3", actionId: "set_volume", parameters: { level: 30 } },
          ],
          exitActions: []
        },
        {
          id: "Study",
          name: "Study",
          description: "Focus mode, block games",
          icon: "BookOpen",
          actions: [
            { id: "s1", actionId: "launch_app", parameters: { appName: "VS Code" } },
            { id: "s2", actionId: "open_website", parameters: { url: "https://google.com/drive" } },
          ],
          exitActions: []
        }
      ],
      getPreset: (id: string) => get().presets.find((p) => p.id === id || p.name === id),
      addPreset: (preset) => set((state) => ({ presets: [...state.presets, preset] })),
      updatePreset: (id, updates) => set((state) => ({
        presets: state.presets.map((p) => p.id === id ? { ...p, ...updates } : p)
      })),
      removePreset: (id) => set((state) => ({
        presets: state.presets.filter((p) => p.id !== id)
      })),
    }),
    {
      name: "vertex-presets-v2", // bumped version to avoid conflict with old potential state
    }
  )
);
