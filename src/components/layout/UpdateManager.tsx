import { useEffect } from "react";
import { useAppStore } from "@/stores/app-store";

export function UpdateManager() {
  const { checkForUpdates } = useAppStore();

  useEffect(() => {
    // Initial check
    checkForUpdates();
    
    // Check every 6 hours
    const interval = setInterval(() => checkForUpdates(), 6 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkForUpdates]);

  return null;
}
