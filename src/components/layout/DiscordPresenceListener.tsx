import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { discordPresenceManager } from "@/services/DiscordPresenceManager";
import { eventBus } from "@/services/EventBus";
import { libraryManager } from "@/services/LibraryManager";
import { useTrackingStore } from "@/stores/tracking-store";

export function DiscordPresenceListener() {
  const location = useLocation();

  useEffect(() => {
    // Initialize Discord Rich Presence on boot
    discordPresenceManager.initialize().catch((err) => {
      console.warn("[DiscordPresenceListener] Failed to initialize Discord presence:", err);
    });
  }, []);

  // Listen to session lifecycle events from EventBus
  useEffect(() => {
    const unsubStarted = eventBus.on("session:started", async (payload) => {
      try {
        const entry = await libraryManager.getEntry(payload.entryId);
        if (entry) {
          await discordPresenceManager.updateTracking(entry, payload.startedAt);
        }
      } catch (err) {
        console.warn("[DiscordPresenceListener] Failed to update presence for started session:", err);
      }
    });

    const unsubEnded = eventBus.on("session:ended", async () => {
      // Check if any other session is still active
      const activeSessions = useTrackingStore.getState().activeSessions;
      const remainingEntryIds = Object.keys(activeSessions);

      if (remainingEntryIds.length > 0) {
        const lastEntryId = remainingEntryIds[remainingEntryIds.length - 1];
        const lastSession = activeSessions[lastEntryId];
        const entry = await libraryManager.getEntry(lastEntryId);
        if (entry) {
          await discordPresenceManager.updateTracking(entry, lastSession.startedAt);
          return;
        }
      }

      // No active session remaining: return to route-based presence
      updatePresenceForRoute(location.pathname);
    });

    return () => {
      unsubStarted();
      unsubEnded();
    };
  }, [location.pathname]);

  // Listen to route navigation changes
  useEffect(() => {
    const activeSessions = useTrackingStore.getState().activeSessions;
    // Only update route presence if there is no active game tracking session
    if (Object.keys(activeSessions).length === 0) {
      updatePresenceForRoute(location.pathname);
    }
  }, [location.pathname]);

  return null;
}

function updatePresenceForRoute(pathname: string) {
  if (pathname === "/stats") {
    discordPresenceManager.updateStatistics();
  } else if (pathname === "/settings") {
    discordPresenceManager.updateSettings();
  } else {
    discordPresenceManager.updateIdle();
  }
}
