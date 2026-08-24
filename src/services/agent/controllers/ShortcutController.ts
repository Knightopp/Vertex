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
            console.log("[ShortcutController] Shortcut Triggered! Trying to open window...");
            const store = useAgentStore.getState();
            store.setCommandInterfaceOpen(!store.isCommandInterfaceOpen);
            
            try {
              const mainWindow = await WebviewWindow.getByLabel('main');
              if (mainWindow) {
                const isVisible = await mainWindow.isVisible();
                if (!isVisible) {
                  await mainWindow.show();
                }
                await mainWindow.setFocus();
                
                // If the store is now false, the user just closed it with the shortcut
                // If it's true, they just opened it. 
                // We might want to handle minimizing when closed, but for now just focus.
              } else {
                console.warn("[ShortcutController] main window not found!");
              }
            } catch (e) {
              console.error("[ShortcutController] Failed to toggle main window", e);
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
