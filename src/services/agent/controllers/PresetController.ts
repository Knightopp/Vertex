import { actionRegistry } from "../ActionRegistry";
import { useAgentStore } from "../../../stores/agent-store";
import { usePresetStore, Preset, PresetAction } from "../../../stores/preset-store";
import { actionExecutor } from "../ActionExecutor";

export class PresetController {
  init() {
    actionRegistry.register({
      id: "start_preset",
      name: "Start Preset",
      description: "Start a specific Vertex preset (e.g. Gaming, Productivity).",
      category: "VERTEX",
      parameters: [
        {
          name: "presetName",
          type: "string",
          description: "Name of the preset to start",
          required: true,
        }
      ],
      handler: async (params) => {
        const { presetName } = params;
        console.log(`[PresetController] Starting preset: ${presetName}`);
        
        const preset = usePresetStore.getState().getPreset(presetName);
        if (!preset) {
            throw new Error(`Preset "${presetName}" not found.`);
        }

        useAgentStore.getState().setActivePreset(preset.name);
        
        // Execute actions sequentially in the background
        this.executeWorkflow(preset.actions).catch(err => {
            console.error(`[PresetController] Error in preset ${preset.name} workflow:`, err);
        });
      }
    });

    actionRegistry.register({
      id: "stop_preset",
      name: "Stop Preset",
      description: "Stop the currently active preset.",
      category: "VERTEX",
      parameters: [],
      handler: async () => {
        console.log(`[PresetController] Stopping active preset...`);
        const activeName = useAgentStore.getState().activePreset;
        useAgentStore.getState().setActivePreset(null);
        
        if (activeName) {
            const preset = usePresetStore.getState().getPreset(activeName);
            if (preset && preset.exitActions.length > 0) {
                this.executeWorkflow(preset.exitActions).catch(err => {
                    console.error(`[PresetController] Error in preset ${preset.name} exit workflow:`, err);
                });
            }
        }
      }
    });
  }

  private async executeWorkflow(actions: PresetAction[]) {
      for (const action of actions) {
          if (action.delayMs && action.delayMs > 0) {
              await new Promise(resolve => setTimeout(resolve, action.delayMs));
          }

          // Skip if running is mostly relevant to `launch_app`. 
          // `AppController` already natively skips launching duplicates and focuses instead.
          // If skipIfRunning is true, we should instruct AppController to not even focus it?
          // Since our current parameter doesn't pass down `skipIfRunning` cleanly without modifying ActionExecutor,
          // we'll pass a special parameter flag if the action is `launch_app` and `skipIfRunning` is true.
          
          let parameters = { ...action.parameters };
          if (action.skipIfRunning && action.actionId === "launch_app") {
              parameters._skipIfRunning = true;
          }

          // Execute action
          try {
             await actionExecutor.execute(action.actionId, parameters);
          } catch (e) {
             console.error(`[PresetController] Action ${action.actionId} failed in workflow:`, e);
          }
      }
  }
}

export const presetController = new PresetController();
