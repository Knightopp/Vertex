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
        if (parameters.appName) details = `Launched ${parameters.appName}`;
        else if (parameters.url) details = `Opened ${parameters.url}`;
        else details += ` (${JSON.stringify(parameters)})`;
      }

      useHistoryStore.getState().addEntry({
        actionId,
        details,
        status: "success",
      });

      // Show native OS notification if available
      try {
        if ("Notification" in window) {
          if (Notification.permission === "granted") {
            new Notification("Vertex Agent", { body: `✓ ${details}` });
          } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then((perm) => {
              if (perm === "granted") {
                new Notification("Vertex Agent", { body: `✓ ${details}` });
              }
            });
          }
        }
      } catch (notifErr) {
        console.warn("[ActionExecutor] Could not trigger native notification:", notifErr);
      }
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

      try {
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Vertex Agent Error", { body: `✗ ${details}` });
        }
      } catch (_) {}
    }
  }
}

export const actionExecutor = new ActionExecutor();

