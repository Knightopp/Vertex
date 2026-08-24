import { register, unregisterAll, isRegistered } from "@tauri-apps/plugin-global-shortcut";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useAgentStore } from "../../../stores/agent-store";
import { useSettingsStore } from "../../../stores/settings-store";

export class ShortcutController {
  async init() {
    // Initial registration based on current settings
    await this.registerShortcut();

    // Subscribe to settings changes to update shortcut
    useSettingsStore.subscribe((state, prevState) => {
      const newShortcut = state.settings.agentGlobalShortcut;
      const oldShortcut = prevState.settings.agentGlobalShortcut;
      if (newShortcut !== oldShortcut) {
        this.registerShortcut().catch(console.error);
      }
    });
  }

  async registerShortcut() {
    try {
      const { settings } = useSettingsStore.getState();
      if (!settings.agentEnabled) {
        await unregisterAll();
        return;
      }

      const shortcut = settings.agentGlobalShortcut;
      if (!shortcut) return;

      await unregisterAll();
      
      const alreadyRegistered = await isRegistered(shortcut);
      if (!alreadyRegistered) {
        await register(shortcut, async (event) => {
          if (event.state === "Pressed") {
            const store = useAgentStore.getState();
            store.setCommandInterfaceOpen(!store.isCommandInterfaceOpen);
            
            try {
              const commandWindow = await WebviewWindow.getByLabel('agent-command-bar');
              if (commandWindow) {
                const isVisible = await commandWindow.isVisible();
                if (isVisible) {
                  await commandWindow.hide();
                } else {
                  await commandWindow.show();
                  await commandWindow.setFocus();
                  await commandWindow.setAlwaysOnTop(true);
                }
              } else {
                console.warn("[ShortcutController] agent-command-bar window not found!");
              }
            } catch (e) {
              console.error("[ShortcutController] Failed to toggle agent command bar window", e);
            }
          }
        });
        console.log(`[ShortcutController] Registered global shortcut: ${shortcut}`);
      }
    } catch (error) {
      console.error("[ShortcutController] Failed to register global shortcut:", error);
    }
  }
}

export const shortcutController = new ShortcutController();
