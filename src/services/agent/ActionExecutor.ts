import { actionRegistry } from "./ActionRegistry";
import { useHistoryStore } from "../../stores/history-store";
import { ask } from "@tauri-apps/plugin-dialog";

export class ActionExecutor {
  async execute(actionId: string, parameters: Record<string, any>): Promise<void> {
    const action = actionRegistry.getAction(actionId);
    if (!action) {
      console.error(`[ActionExecutor] Action ${actionId} not found.`);
      return;
    }

    if (action.requiresConfirmation) {
      const confirmed = await ask(`Are you sure you want to execute: ${action.name}?`, {
        title: "Vertex Agent Confirmation",
        kind: "warning",
      });

      if (!confirmed) {
        console.log(`[ActionExecutor] Action ${actionId} cancelled by user.`);
        return;
      }
    }

    await this.performExecution(actionId, parameters);
  }

  private async performExecution(actionId: string, parameters: Record<string, any>): Promise<void> {
    const action = actionRegistry.getAction(actionId);
    if (!action) return;

    // Log start (we'll actually just log the completion to keep it lightweight as requested)
    
    try {
      await action.handler(parameters);
      
      let details = action.name;
      if (parameters && Object.keys(parameters).length > 0) {
        details += ` (${JSON.stringify(parameters)})`;
      }

      useHistoryStore.getState().addEntry({
        actionId,
        details,
        status: "success",
      });
    } catch (error) {
      console.error(`[ActionExecutor] Error executing ${actionId}:`, error);
      
      let details = action.name;
      if (parameters && Object.keys(parameters).length > 0) {
        details += ` (${JSON.stringify(parameters)})`;
      }
      details += ` - Failed: ${error instanceof Error ? error.message : "Unknown error"}`;

      useHistoryStore.getState().addEntry({
        actionId,
        details,
        status: "error",
      });
    }
  }
}

export const actionExecutor = new ActionExecutor();

