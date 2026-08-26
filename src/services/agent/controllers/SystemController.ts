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
      parameters: [
        {
          name: "exceptApp",
          type: "string",
          description: "Optional app name to spare from closing",
          required: false,
        }
      ],
      handler: async (params) => {
        const exceptApp = params?.exceptApp ? String(params.exceptApp).toLowerCase().trim() : null;
        console.log(`[SystemController] Closing all user application windows... (Except: ${exceptApp || 'none'})`);
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
        const isExcepted = (name: string, title: string) => {
          if (!exceptApp) return false;
          return name.toLowerCase().includes(exceptApp) || title.toLowerCase().includes(exceptApp);
        };

        // Pass 1: graceful close
        const running1 = await getRunningProcesses();
        const targets1 = running1.filter((p) => !isSystem(p.name) && !isVertex(p.windowTitle) && !isExcepted(p.name, p.windowTitle));
        console.log(`[SystemController] Pass 1: graceful close for ${targets1.length} process(es)...`);
        await Promise.allSettled(targets1.map((p) => closeWindow(p.pid)));

        // Wait 600ms for apps to finish closing (faster UX)
        await new Promise((r) => setTimeout(r, 600));

        // Pass 2: force-kill anything still alive
        const running2 = await getRunningProcesses();
        const targets2 = running2.filter((p) => !isSystem(p.name) && !isVertex(p.windowTitle) && !isExcepted(p.name, p.windowTitle));
        if (targets2.length > 0) {
          console.log(`[SystemController] Pass 2: force-kill ${targets2.length} stubborn process(es)...`);
          await Promise.allSettled(targets2.map((p) => forceCloseProcess(p.pid)));
        }
        console.log(`[SystemController] Close all complete.`);
      }
    });

    actionRegistry.register({
      id: "show_info",
      name: "Show Info",
      description: "Shows time, battery, and music information.",
      category: "SYSTEM",
      parameters: [],
      handler: async () => {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        let batteryStr = "";
        try {
          if ('getBattery' in navigator) {
            const battery: any = await (navigator as any).getBattery();
            batteryStr = `Battery: ${Math.round(battery.level * 100)}%${battery.charging ? ' (Charging)' : ''}`;
          }
        } catch (_) {}

        let musicStr = "";
        try {
          const { getNowPlaying } = await import("../../../lib/tauri-ipc");
          const nowPlaying = await getNowPlaying();
          if (nowPlaying) {
            musicStr = `🎵 Now Playing: ${nowPlaying}`;
          } else {
            musicStr = "No music playing";
          }
        } catch (_) {}

        const body = [time, batteryStr, musicStr].filter(Boolean).join("\n");
        
        try {
          new Notification("System Info", { body, silent: true });
        } catch (_) {}
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
