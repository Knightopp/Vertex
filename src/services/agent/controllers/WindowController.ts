import { actionRegistry } from "../ActionRegistry";

export class WindowController {
  init() {
    actionRegistry.register({
      id: "minimize_window",
      name: "Minimize Window",
      description: "Minimize the currently active window.",
      category: "WINDOW",
      parameters: [],
      handler: async () => {
        console.log(`[WindowController] Minimizing active window...`);
        // TODO: Implement window management in Part 2
      }
    });
  }
}

export const windowController = new WindowController();
