import { create } from 'zustand';
import { check } from "@tauri-apps/plugin-updater";
import { type } from "@tauri-apps/plugin-os";
import { getVersion } from "@tauri-apps/api/app";
import { toast } from "sonner";
import { relaunch } from "@tauri-apps/plugin-process";
import { openUrl } from "@tauri-apps/plugin-opener";

// UPDATE THESE WITH YOUR ACTUAL GITHUB INFO LATER
const GITHUB_USERNAME = "Knightopp";
const GITHUB_REPO = "Vertex";

export interface UpdateInfo {
  version: string;
  body?: string;
  isAndroid: boolean;
  downloadUrl?: string;
  updateData?: any; // The Tauri Update object
}

interface AppState {
  updateAvailable: UpdateInfo | null;
  isCheckingUpdate: boolean;
  checkForUpdates: (manual?: boolean) => Promise<void>;
  installUpdate: () => Promise<void>;
  dismissUpdate: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  updateAvailable: null,
  isCheckingUpdate: false,
  
  checkForUpdates: async (manual = false) => {
    set({ isCheckingUpdate: true });
    try {
      if (type() === 'android') {
        const currentVersion = await getVersion();
        const res = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/releases/latest`);
        
        if (!res.ok) {
          if (manual) toast.error("Could not check for updates.");
          return;
        }
        
        const data = await res.json();
        const latestVersion = data.tag_name?.replace('v', '');
        
        if (latestVersion && latestVersion !== currentVersion) {
          const apkAsset = data.assets?.find((a: any) => a.name.endsWith('.apk'));
          const downloadUrl = apkAsset ? apkAsset.browser_download_url : data.html_url;
          
          set({ updateAvailable: { version: latestVersion, body: data.body, isAndroid: true, downloadUrl } });
          if (manual) toast.success(`Update v${latestVersion} found! Check your notifications.`);
        } else {
          if (manual) toast.info("You are on the latest version.");
        }
      } else {
        // Desktop
        const update = await check();
        if (update) {
          set({ updateAvailable: { version: update.version, body: update.body, isAndroid: false, updateData: update } });
          if (manual) toast.success(`Update v${update.version} found! Check your notifications.`);
        } else {
          if (manual) toast.info("You are on the latest version.");
        }
      }
    } catch (e) {
      console.error("Update check failed:", e);
      if (manual) toast.error("Failed to check for updates.");
    } finally {
      set({ isCheckingUpdate: false });
    }
  },

  installUpdate: async () => {
    const { updateAvailable } = get();
    if (!updateAvailable) return;

    if (updateAvailable.isAndroid && updateAvailable.downloadUrl) {
      await openUrl(updateAvailable.downloadUrl);
      return;
    }

    if (!updateAvailable.isAndroid && updateAvailable.updateData) {
      let downloaded = 0;
      let contentLength = 0;
      const toastId = toast.loading("Downloading update...");
      
      try {
        await updateAvailable.updateData.downloadAndInstall((event: any) => {
          switch (event.event) {
            case "Started":
              contentLength = event.data.contentLength || 0;
              break;
            case "Progress":
              downloaded += event.data.chunkLength;
              const percent = contentLength ? Math.round((downloaded / contentLength) * 100) : 0;
              toast.loading(`Downloading update... ${percent}%`, { id: toastId });
              break;
            case "Finished":
              toast.success("Update installed!", { id: toastId });
              break;
          }
        });
        
        toast.success("Update installed successfully. Restarting...", { id: toastId });
        setTimeout(async () => {
          await relaunch();
        }, 1500);
      } catch (e) {
        console.error("Update failed:", e);
        toast.error("Failed to install update.", { id: toastId });
      }
    }
  },

  dismissUpdate: () => set({ updateAvailable: null })
}));
