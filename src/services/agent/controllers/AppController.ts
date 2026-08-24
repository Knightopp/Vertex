import { actionRegistry } from "../ActionRegistry";
import { open } from "@tauri-apps/plugin-shell";
import { invoke } from "@tauri-apps/api/core";
import { availableMonitors } from "@tauri-apps/api/window";
import { libraryManager } from "../../LibraryManager";
import { getRunningProcesses, focusWindow, closeWindow, forceCloseProcess, maximizeWindow, restoreWindow, moveWindow } from "../../../lib/tauri-ipc";

export class AppController {
  init() {
    actionRegistry.register({
      id: "launch_app",
      name: "Launch Application",
      description: "Launch or focus a specific application.",
      category: "APPLICATION",
      parameters: [
        {
          name: "appName",
          type: "string",
          description: "The name of the application to launch",
          required: true,
        }
      ],
      handler: async (params) => {
        const { appName } = params;
        
        // 1. Resolve application from Library
        const entries = await libraryManager.getAllEntries();
        const entry = entries.find(e => e.title.toLowerCase() === String(appName).toLowerCase() || e.executableName?.toLowerCase() === String(appName).toLowerCase());
        
        if (!entry) {
            throw new Error(`Application "${appName}" not found in library.`);
        }
        
        if (!entry.executablePath) {
            throw new Error(`Application "${appName}" has no executable path configured.`);
        }

        // 2. Check if already running
        const running = await getRunningProcesses();
        const runningInstance = running.find(r => r.exePath?.toLowerCase() === entry.executablePath?.toLowerCase());
        
        if (runningInstance) {
            if (params._skipIfRunning) {
                console.log(`[AppController] ${appName} is already running (PID: ${runningInstance.pid}). skipIfRunning is true, bypassing focus.`);
                return;
            }
            console.log(`[AppController] ${appName} is already running (PID: ${runningInstance.pid}). Focusing window...`);
            await focusWindow(runningInstance.pid);
        } else {
            console.log(`[AppController] Launching app: ${appName} (${entry.executablePath})`);
            await invoke("launch_game", { pathOrUrl: entry.executablePath });
        }
      }
    });

    actionRegistry.register({
      id: "close_app",
      name: "Close Application",
      description: "Close a specific application safely.",
      category: "APPLICATION",
      parameters: [
        {
          name: "appName",
          type: "string",
          description: "The name of the application to close",
          required: true,
        }
      ],
      handler: async (params) => {
        const { appName } = params;
        const entries = await libraryManager.getAllEntries();
        const entry = entries.find(e => e.title.toLowerCase() === String(appName).toLowerCase());
        
        if (!entry || !entry.executablePath) throw new Error(`Application "${appName}" not found.`);
        
        const running = await getRunningProcesses();
        const runningInstance = running.find(r => r.exePath?.toLowerCase() === entry.executablePath?.toLowerCase());
        
        if (!runningInstance) throw new Error(`Application "${appName}" is not currently running.`);
        
        console.log(`[AppController] Safely closing app: ${appName} (PID: ${runningInstance.pid})`);
        await closeWindow(runningInstance.pid);
      }
    });

    actionRegistry.register({
      id: "force_close_app",
      name: "Force Close Application",
      description: "Force close an application.",
      category: "APPLICATION",
      requiresConfirmation: true,
      parameters: [
        {
          name: "appName",
          type: "string",
          description: "The name of the application to force close",
          required: true,
        }
      ],
      handler: async (params) => {
        const { appName } = params;
        const entries = await libraryManager.getAllEntries();
        const entry = entries.find(e => e.title.toLowerCase() === String(appName).toLowerCase());
        
        if (!entry || !entry.executablePath) throw new Error(`Application "${appName}" not found.`);
        
        const running = await getRunningProcesses();
        const runningInstance = running.find(r => r.exePath?.toLowerCase() === entry.executablePath?.toLowerCase());
        
        if (!runningInstance) throw new Error(`Application "${appName}" is not currently running.`);
        
        console.log(`[AppController] Force closing app: ${appName} (PID: ${runningInstance.pid})`);
        await forceCloseProcess(runningInstance.pid);
      }
    });

    actionRegistry.register({
      id: "open_website",
      name: "Open Website",
      description: "Opens a website in the default browser.",
      category: "APPLICATION",
      parameters: [
        {
          name: "url",
          type: "string",
          description: "The URL or name of the website to open",
          required: true,
        }
      ],
      handler: async (params) => {
        let url = params.url;
        if (!url.startsWith("http")) {
            url = `https://${url}`;
        }
        console.log(`[AppController] Opening website: ${url}`);
        await open(url);
      }
    });

    actionRegistry.register({
      id: "open_folder",
      name: "Open Folder",
      description: "Opens a folder in the file explorer.",
      category: "APPLICATION",
      parameters: [
        {
          name: "path",
          type: "string",
          description: "The path of the folder to open",
          required: true,
        }
      ],
      handler: async (params) => {
        console.log(`[AppController] Opening folder: ${params.path}`);
        await open(params.path);
      }
    });

    actionRegistry.register({
      id: "apply_window_layout",
      name: "Apply Window Layout",
      description: "Moves or resizes an application to a specific monitor layout.",
      category: "APPLICATION",
      parameters: [
        {
          name: "appName",
          type: "string",
          description: "The name of the application",
          required: true,
        },
        {
          name: "monitor",
          type: "number",
          description: "Monitor index (1 for Primary, 2 for Secondary, etc.)",
          required: true,
        },
        {
          name: "layout",
          type: "string",
          description: "Layout type (maximized, left_half, right_half, top_half, bottom_half)",
          required: true,
        }
      ],
      handler: async (params) => {
        const { appName, monitor, layout } = params;
        
        // 1. Resolve application
        const entries = await libraryManager.getAllEntries();
        const entry = entries.find(e => e.title.toLowerCase() === String(appName).toLowerCase() || e.executableName?.toLowerCase() === String(appName).toLowerCase());
        
        if (!entry || !entry.executablePath) throw new Error(`Application "${appName}" not found or lacks executable path.`);
        
        // 2. Check if running
        const running = await getRunningProcesses();
        const runningInstance = running.find(r => r.exePath?.toLowerCase() === entry.executablePath?.toLowerCase());
        
        if (!runningInstance) throw new Error(`Application "${appName}" is not currently running. It must be running to apply layout.`);

        // 3. Resolve monitor
        const monitors = await availableMonitors();
        if (monitors.length === 0) throw new Error("No monitors detected.");
        
        const monitorIdx = Math.max(0, Number(monitor) - 1);
        const targetMonitor = monitors[monitorIdx] || monitors[0]; // fallback to primary if out of bounds
        
        const { x, y } = targetMonitor.position;
        const { width, height } = targetMonitor.size;

        console.log(`[AppController] Applying layout "${layout}" for ${appName} on Monitor ${monitorIdx + 1}`);

        // 4. Apply layout
        if (layout === "maximized") {
            // First move it to the target monitor so it maximizes on the correct screen
            await restoreWindow(runningInstance.pid);
            await moveWindow(runningInstance.pid, x + width / 4, y + height / 4, width / 2, height / 2);
            await maximizeWindow(runningInstance.pid);
        } else {
            await restoreWindow(runningInstance.pid);
            let targetX = x;
            let targetY = y;
            let targetW = width;
            let targetH = height;

            if (layout === "left_half") {
                targetW = width / 2;
            } else if (layout === "right_half") {
                targetX = x + width / 2;
                targetW = width / 2;
            } else if (layout === "top_half") {
                targetH = height / 2;
            } else if (layout === "bottom_half") {
                targetY = y + height / 2;
                targetH = height / 2;
            }

            // MoveWindow takes integer coordinates
            await moveWindow(runningInstance.pid, Math.floor(targetX), Math.floor(targetY), Math.floor(targetW), Math.floor(targetH));
        }
      }
    });
  }
}

export const appController = new AppController();
