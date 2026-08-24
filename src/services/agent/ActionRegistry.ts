export type ActionCategory = "SYSTEM" | "APPLICATION" | "WINDOW" | "WEB" | "VERTEX" | "FILES";

export interface ActionParameter {
  name: string;
  type: "string" | "number" | "boolean";
  description: string;
  required: boolean;
}

export interface Action {
  id: string;
  name: string;
  description: string;
  category: ActionCategory;
  parameters: ActionParameter[];
  requiresConfirmation?: boolean;
  handler: (params: Record<string, any>) => Promise<void>;
}

class ActionRegistry {
  private actions: Map<string, Action> = new Map();

  register(action: Action) {
    if (this.actions.has(action.id)) {
      console.warn(`[ActionRegistry] Action with id ${action.id} is already registered.`);
      return;
    }
    this.actions.set(action.id, action);
  }

  unregister(actionId: string) {
    this.actions.delete(actionId);
  }

  getAction(actionId: string): Action | undefined {
    return this.actions.get(actionId);
  }

  getAllActions(): Action[] {
    return Array.from(this.actions.values());
  }
}

export const actionRegistry = new ActionRegistry();
