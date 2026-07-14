import { useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { type } from "@tauri-apps/plugin-os";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";

// UPDATE THESE WITH YOUR ACTUAL GITHUB INFO LATER
const GITHUB_USERNAME = "Knightopp";
const GITHUB_REPO = "Vertex";

export function UpdateManager() {
  useEffect(() => {
    async function checkForUpdates() {
      try {
        // --- ANDROID MANUAL UPDATE CHECK ---
        if (type() === 'android') {
          const currentVersion = await getVersion();
          const res = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/releases/latest`);
          
          if (!res.ok) return; // Silent fail if repo doesn't exist yet
          
          const data = await res.json();
          const latestVersion = data.tag_name?.replace('v', '');
          
          // Basic string comparison (assuming versions like 1.2.1)
          if (latestVersion && latestVersion !== currentVersion) {
            const apkAsset = data.assets?.find((a: any) => a.name.endsWith('.apk'));
            const downloadUrl = apkAsset ? apkAsset.browser_download_url : data.html_url;
            
            toast.info(`Vertex v${latestVersion} is available!`, {
              description: "Click to download the latest Android update.",
              action: {
                label: "Download",
                onClick: async () => {
                  await openUrl(downloadUrl);
                }
              },
              duration: Number.POSITIVE_INFINITY, // Keep it visible
            });
          }
          return;
        }

        // --- DESKTOP AUTO-UPDATER ---
        const update = await check();
        if (update) {
          console.log(`found update ${update.version} from ${update.date} with notes ${update.body}`);
          
          toast.info(`Vertex v${update.version} is available!`, {
            description: "Click to download and install this update.",
            action: {
              label: "Install",
              onClick: async () => {
                let downloaded = 0;
                let contentLength = 0;
                const toastId = toast.loading("Downloading update...");
                
                try {
                  await update.downloadAndInstall((event) => {
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
            duration: Number.POSITIVE_INFINITY,
          });
        }
      } catch (e) {
        console.error("Failed to check for updates:", e);
      }
    }
    
    checkForUpdates();
    
    // Check every 6 hours
    const interval = setInterval(checkForUpdates, 6 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return null;
}
