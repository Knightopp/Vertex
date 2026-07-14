import { useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { toast } from "sonner";

export function UpdateManager() {
  useEffect(() => {
    async function checkForUpdates() {
      try {
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
            duration: Number.POSITIVE_INFINITY, // Keep it visible until dismissed or clicked
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
