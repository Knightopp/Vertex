import { appController } from "./controllers/AppController";
import { systemController } from "./controllers/SystemController";
import { windowController } from "./controllers/WindowController";
import { presetController } from "./controllers/PresetController";
import { shortcutController } from "./controllers/ShortcutController";
import { commandParser } from "./CommandParser";
import { actionExecutor } from "./ActionExecutor";
import { useAgentStore } from "../../stores/agent-store";
import { useSettingsStore } from "../../stores/settings-store";

export class AgentCore {
  private initialized = false;

  async init() {
    if (this.initialized) return;

    // Check if agent is enabled in settings
    const { settings } = useSettingsStore.getState();
    if (!settings.agentEnabled) {
      console.log("[AgentCore] Agent is disabled in settings. Skipping initialization.");
      return;
    }

    console.log("[AgentCore] Initializing Vertex Agent...");

    // Initialize all controllers (registers actions)
    appController.init();
    systemController.init();
    windowController.init();
    presetController.init();
    await shortcutController.init();

    useAgentStore.getState().setRunning(true);
    this.initialized = true;

    console.log("[AgentCore] Vertex Agent initialized successfully.");
  }

  /**
   * Process a natural language command from the user.
   */
  async processCommand(text: string) {
    if (!this.initialized) {
      console.warn("[AgentCore] Cannot process command, Agent is not initialized.");
      return;
    }

    const parsed = commandParser.parse(text);
    if (!parsed || parsed.length === 0) {
      console.warn(`[AgentCore] Could not parse command: "${text}"`);
      return;
    }

    const bestMatch = parsed[0];
    console.log(`[AgentCore] Parsed command:`, bestMatch);
    await actionExecutor.execute(bestMatch.actionId, bestMatch.parameters);
  }
}

export const agentCore = new AgentCore();
