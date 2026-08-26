import { actionRegistry } from "../ActionRegistry";
import { lockPc, shutdownPc, sleepPc, setVolume, muteVolume, takeScreenshot, startRecording, stopRecording } from "../../../lib/tauri-ipc";

export class SystemController {
  init() {
    const takeScreenshotHandler = async () => {
      console.log(`[SystemController] Taking screenshot...`);
      const path = await takeScreenshot();
      console.log(`[SystemController] Screenshot saved to ${path}`);
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
      parameters: [],
      handler: async () => {
        console.log(`[SystemController] Locking PC...`);
        await lockPc();
      }
    });

    actionRegistry.register({
      id: "shutdown",
      name: "Shutdown PC",
      description: "Turns off the computer.",
      category: "SYSTEM",
      parameters: [],
      handler: async () => {
        console.log(`[SystemController] Shutting down PC...`);
        await shutdownPc();
      }
    });

    actionRegistry.register({
      id: "sleep",
      name: "Sleep PC",
      description: "Puts the computer into sleep mode.",
      category: "SYSTEM",
      parameters: [],
      handler: async () => {
        console.log(`[SystemController] Putting PC to sleep...`);
        await sleepPc();
      }
    });

    actionRegistry.register({
      id: "close_all_apps",
      name: "Close All Applications",
      description: "Closes all open user application windows.",
      category: "SYSTEM",
      parameters: [],
      handler: async () => {
        console.log(`[SystemController] Closing all user application windows...`);
        const { getRunningProcesses, closeWindow, forceCloseProcess } = await import("../../../lib/tauri-ipc");

        // Processes that must never be touched
        const SYSTEM_EXCLUSIONS = new Set([
          "explorer.exe", "vertex.exe", "vazorism.exe",
          "applicationframehost.exe", "sihost.exe", "dwm.exe",
          "svchost.exe", "csrss.exe", "winlogon.exe", "lsass.exe",
          "smss.exe", "wininit.exe", "services.exe", "taskhostw.exe",
          "runtimebroker.exe", "searchindexer.exe", "searchhost.exe",
          "startmenuexperiencehost.exe", "shellexperiencehost.exe",
          "systemsettings.exe", "textinputhost.exe", "ctfmon.exe",
          "fontdrvhost.exe", "spoolsv.exe",
        ]);

        const isSystem = (name: string) => SYSTEM_EXCLUSIONS.has(name.toLowerCase());
        const isVertex = (title: string) =>
          title.toLowerCase().includes("vertex") || title.toLowerCase().includes("vazorism");

        // Pass 1: graceful close
        const running1 = await getRunningProcesses();
        const targets1 = running1.filter((p) => !isSystem(p.name) && !isVertex(p.windowTitle));
        console.log(`[SystemController] Pass 1: graceful close for ${targets1.length} process(es)...`);
        await Promise.allSettled(targets1.map((p) => closeWindow(p.pid)));

        // Wait 1.5 s for apps to finish closing
        await new Promise((r) => setTimeout(r, 1500));

        // Pass 2: force-kill anything still alive
        const running2 = await getRunningProcesses();
        const targets2 = running2.filter((p) => !isSystem(p.name) && !isVertex(p.windowTitle));
        if (targets2.length > 0) {
          console.log(`[SystemController] Pass 2: force-kill ${targets2.length} stubborn process(es)...`);
          await Promise.allSettled(targets2.map((p) => forceCloseProcess(p.pid)));
        }
        console.log(`[SystemController] Close all complete.`);
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
