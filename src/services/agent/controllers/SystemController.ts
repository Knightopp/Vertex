import { actionRegistry } from "../ActionRegistry";
import { lockPc, setVolume, muteVolume, takeScreenshot, startRecording, stopRecording } from "../../../lib/tauri-ipc";

export class SystemController {
  init() {
    const takeScreenshotHandler = async () => {
      console.log(`[SystemController] Taking screenshot...`);
      const path = await takeScreenshot();
      console.log(`[SystemController] Screenshot saved to ${path}`);
      return path;
    };

    actionRegistry.register({
      id: "take_screenshot",
      name: "Take Screenshot",
      description: "Capture the current screen.",
      category: "SYSTEM",
      parameters: [],
      handler: takeScreenshotHandler
    });

    actionRegistry.register({
      id: "screenshot",
      name: "Take Screenshot",
      description: "Capture the current screen.",
      category: "SYSTEM",
      parameters: [],
      handler: takeScreenshotHandler
    });

    actionRegistry.register({
      id: "volume_up",
      name: "Volume Up",
      description: "Increase system volume.",
      category: "SYSTEM",
      parameters: [],
      handler: async () => {
        console.log(`[SystemController] Volume up (Use Set Volume for now)`);
        // We lack a native getVolume to do relative increments currently
      }
    });

    actionRegistry.register({
      id: "mute",
      name: "Mute System Volume",
      description: "Mutes the system volume.",
      category: "SYSTEM",
      parameters: [],
      handler: async () => {
        console.log(`[SystemController] Muting system volume...`);
        await muteVolume();
      }
    });

    actionRegistry.register({
      id: "lock_pc",
      name: "Lock PC",
      description: "Locks the computer.",
      category: "SYSTEM",
      requiresConfirmation: true,
      parameters: [],
      handler: async () => {
        console.log(`[SystemController] Locking PC...`);
        await lockPc();
      }
    });

    actionRegistry.register({
      id: "start_recording",
      name: "Start Recording",
      description: "Starts screen recording.",
      category: "SYSTEM",
      parameters: [],
      handler: async () => {
        console.log(`[SystemController] Starting recording...`);
        await startRecording();
      }
    });

    actionRegistry.register({
      id: "stop_recording",
      name: "Stop Recording",
      description: "Stops screen recording.",
      category: "SYSTEM",
      parameters: [],
      handler: async () => {
        console.log(`[SystemController] Stopping recording...`);
        await stopRecording();
      }
    });

    actionRegistry.register({
      id: "set_volume",
      name: "Set Volume",
      description: "Sets system volume to a specific level.",
      category: "SYSTEM",
      parameters: [
        {
          name: "level",
          type: "number",
          description: "Volume level (0-100)",
          required: true,
        }
      ],
      handler: async (params) => {
        console.log(`[SystemController] Setting volume to ${params.level}...`);
        await setVolume(Number(params.level));
      }
    });
  }
}

export const systemController = new SystemController();
