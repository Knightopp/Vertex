import { actionRegistry } from "../ActionRegistry";
import { open } from "@tauri-apps/plugin-shell";
import { invoke } from "@tauri-apps/api/core";
import { availableMonitors } from "@tauri-apps/api/window";
import { libraryManager } from "../../LibraryManager";
import { getRunningProcesses, focusWindow, forceCloseProcess, maximizeWindow, restoreWindow, moveWindow } from "../../../lib/tauri-ipc";

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
        const { appName, path } = params;

        // 0. If direct executable / shortcut path is provided from installed apps scan
        if (path) {
          console.log(`[AppController] Launching installed app directly via path: ${path}`);
          await invoke("launch_game", { pathOrUrl: path });
          return;
        }
        
        // 1. Resolve application from Library
        const entries = await libraryManager.getAllEntries();
        const entry = entries.find(e => e.title.toLowerCase() === String(appName).toLowerCase() || e.executableName?.toLowerCase() === String(appName).toLowerCase());
        
        if (!entry) {
          const lower = String(appName).toLowerCase().trim();
          try {
            if (lower === "spotify") {
              await invoke("launch_game", { pathOrUrl: "spotify:" });
              return;
            } else if (lower === "discord") {
              await invoke("launch_game", { pathOrUrl: "discord:" });
              return;
            } else if (lower === "steam") {
              await invoke("launch_game", { pathOrUrl: "steam://open/main" });
              return;
            } else if (lower === "epic" || lower === "epic games") {
              await invoke("launch_game", { pathOrUrl: "com.epicgames.launcher://" });
              return;
            } else if (lower === "calc" || lower === "calculator") {
              await invoke("launch_game", { pathOrUrl: "calc" });
              return;
            } else if (lower === "notepad") {
              await invoke("launch_game", { pathOrUrl: "notepad" });
              return;
            } else if (lower === "chrome" || lower === "google chrome") {
              await invoke("launch_game", { pathOrUrl: "chrome" });
              return;
            } else {
              await invoke("launch_game", { pathOrUrl: appName });
              return;
            }
          } catch (fallbackErr) {
            console.warn(`[AppController] Could not launch "${appName}" directly:`, fallbackErr);
            throw new Error(`Application "${appName}" not found in library.`);
          }
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

function findMatchingProcesses(
  appName: string,
  running: import("../../../lib/tauri-ipc").ProcessInfo[],
  entries: any[] = []
): import("../../../lib/tauri-ipc").ProcessInfo[] {
  const query = String(appName).trim().toLowerCase();
  if (!query) return [];

  // Filter out Vertex itself
  const validRunning = running.filter(r => {
    const name = r.name.toLowerCase();
    const title = r.windowTitle.toLowerCase();
    return name !== "vertex.exe" && name !== "vazorism.exe" && !title.includes("vertex") && !title.includes("vazorism");
  });

  // 1. YouTube specific alias: match any window with "youtube" in title
  if (query === "youtube" || query === "yt") {
    const ytWindows = validRunning.filter(r => r.windowTitle.toLowerCase().includes("youtube"));
    if (ytWindows.length > 0) return ytWindows;
  }

  // 2. Images / Photos specific alias: match Photos app, Paint, or windows displaying image files
  if (query === "images" || query === "image" || query === "photos" || query === "photo" || query === "picture" || query === "pictures") {
    const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".ico", ".tiff", ".raw"];
    const imageProcesses = validRunning.filter(r => {
      const name = r.name.toLowerCase();
      const title = r.windowTitle.toLowerCase();
      // Direct photo app names
      const isPhotoApp = name.includes("photo") || name === "mspaint.exe" || name.includes("imageglass") || name.includes("irfanview") || name === "microsoft.photos.exe";
      // UWP Photos runs inside ApplicationFrameHost — match by window title
      const isUwpPhotoHost = name === "applicationframehost.exe" && (title.includes("photos") || title.includes("photo"));
      const hasPhotoTitle = title.includes("photos") || title.includes("photo") || title.includes("image viewer") || title.includes("paint");
      const hasImageExt = imageExtensions.some(ext => title.includes(ext));
      return isPhotoApp || isUwpPhotoHost || hasPhotoTitle || hasImageExt;
    });
    if (imageProcesses.length > 0) return imageProcesses;
  }

  // 3. Known app aliases mapping
  const aliasMap: Record<string, string[]> = {
    spotify: ["spotify.exe", "spotify"],
    discord: ["discord.exe", "discord"],
    steam: ["steam.exe", "steam"],
    chrome: ["chrome.exe", "google chrome"],
    edge: ["msedge.exe", "microsoft edge", "edge"],
    notepad: ["notepad.exe", "notepad"],
    calc: ["calculatorapp.exe", "calc.exe", "calculator"],
    calculator: ["calculatorapp.exe", "calc.exe", "calculator"],
    vscode: ["code.exe", "visual studio code"],
    code: ["code.exe", "visual studio code"],
  };

  const aliases = aliasMap[query];
  if (aliases) {
    const matched = validRunning.filter(r => {
      const name = r.name.toLowerCase();
      const title = r.windowTitle.toLowerCase();
      const prod = (r.productName || "").toLowerCase();
      return aliases.some(a => name.includes(a) || title.includes(a) || prod.includes(a));
    });
    if (matched.length > 0) return matched;
  }

  // 4. Library Entry matching
  const entry = entries.find(e =>
    e.title.toLowerCase() === query ||
    e.executableName?.toLowerCase() === query ||
    e.title.toLowerCase().includes(query)
  );
  if (entry && entry.executablePath) {
    const entryExe = entry.executablePath.toLowerCase();
    const matched = validRunning.filter(r => r.exePath?.toLowerCase() === entryExe || (r.name && entryExe.endsWith(r.name.toLowerCase())));
    if (matched.length > 0) return matched;
  }

  // 5. General matching across all running processes
  const matched = validRunning.filter(r => {
    const name = r.name.toLowerCase();
    const title = r.windowTitle.toLowerCase();
    const prod = (r.productName || "").toLowerCase();
    const desc = (r.fileDescription || "").toLowerCase();
    return (
      name.includes(query) ||
      title.includes(query) ||
      prod.includes(query) ||
      desc.includes(query)
    );
  });

  return matched;
}

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
        const lower = String(appName).trim().toLowerCase();

        // Map of known app names → their executable names for direct kill
        const knownExeMap: Record<string, string[]> = {
          spotify:     ["spotify"],
          discord:     ["discord"],
          steam:       ["steam"],
          chrome:      ["chrome"],
          "google chrome": ["chrome"],
          edge:        ["msedge"],
          firefox:     ["firefox"],
          notepad:     ["notepad"],
          calculator:  ["calculatorapp", "calc"],
          calc:        ["calculatorapp", "calc"],
          vlc:         ["vlc"],
          vscode:      ["code"],
          code:        ["code"],
          "visual studio code": ["code"],
          photos:      ["microsoft.photos"],
          images:      ["microsoft.photos"],
          image:       ["microsoft.photos"],
          pictures:    ["microsoft.photos"],
          photo:       ["microsoft.photos"],
          paint:       ["mspaint"],
          youtube:     ["chrome", "msedge", "firefox"], // browser tabs — close the browser
        };

        const exeNames = knownExeMap[lower];

        if (exeNames) {
          // Primary: kill directly by exe name — works even with no visible window
          const { killByName } = await import("../../../lib/tauri-ipc");
          let killed = false;
          for (const exe of exeNames) {
            try {
              await killByName(exe);
              killed = true;
              console.log(`[AppController] Killed "${exe}.exe" via killByName`);
              break;
            } catch (_) {
              // try next
            }
          }
          if (killed) return;
        }

        // Fallback: process-list matching for anything else
        const entries = await libraryManager.getAllEntries();
        const { getRunningProcesses, closeWindow, killByName: killByNameFallback } = await import("../../../lib/tauri-ipc");
        const running = await getRunningProcesses();
        const targets = findMatchingProcesses(appName, running, entries);

        if (targets.length === 0) {
          // Last resort: try killing by the raw appName as an exe name
          try {
            await killByNameFallback(lower);
            return;
          } catch (_) {}
          throw new Error(`No running application or window matching "${appName}" was found.`);
        }

        console.log(`[AppController] Closing ${targets.length} instance(s) of "${appName}"`);
        for (const target of targets) {
          try {
            await closeWindow(target.pid);
          } catch (err) {
            console.warn(`[AppController] Failed to close PID ${target.pid}:`, err);
          }
        }
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
        const running = await getRunningProcesses();
        
        const targets = findMatchingProcesses(appName, running, entries);
        
        if (targets.length === 0) {
          throw new Error(`No running application or window matching "${appName}" was found.`);
        }
        
        console.log(`[AppController] Force closing ${targets.length} instance(s) of "${appName}"`);
        for (const target of targets) {
          try {
            await forceCloseProcess(target.pid);
          } catch (err) {
            console.warn(`[AppController] Failed to force close PID ${target.pid}:`, err);
          }
        }
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
        let url = String(params.url).trim();
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
          url = `https://${url}`;
        }
        console.log(`[AppController] Opening website: ${url}`);
        await invoke("launch_game", { pathOrUrl: url });
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
