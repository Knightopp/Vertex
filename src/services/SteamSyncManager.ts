import { settingsManager } from "./SettingsManager";
import { libraryManager } from "./LibraryManager";
import { toast } from "sonner";

export class SteamSyncManager {
  async syncGames(): Promise<void> {
    const steamId = settingsManager.get("steamId");
    const steamApiKey = settingsManager.get("steamApiKey");

    if (!steamId || !steamApiKey) {
      toast.error("Steam ID or API Key is missing. Please configure them in Settings.");
      return;
    }

    toast.info("Starting Steam Library Sync...");

    try {
      const steamUrl = `http://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${steamApiKey}&steamid=${steamId}&include_appinfo=1`;
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(steamUrl)}`;
      
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.response || !data.response.games) {
        toast.error("Invalid response from Steam API. Check your ID and API Key.");
        return;
      }

      const games = data.response.games;
      let newGamesAdded = 0;

      const existingEntries = await libraryManager.getAllEntries();
      const existingAppIds = new Set(existingEntries.map(e => {
        if (e.metadata?.steamAppId) return e.metadata.steamAppId.toString();
        if (e.provider === "steam" && e.providerGameId) return e.providerGameId.toString();
        return null;
      }).filter(Boolean));

      for (const game of games) {
        if (!existingAppIds.has(game.appid.toString())) {
          // Add game to library
          const entry = await libraryManager.createEntry({
            title: game.name,
            type: "game",
            provider: "steam",
            providerGameId: game.appid.toString(),
          });

          if (entry) {
            // Immediately update metadata with steamAppId so MetadataManager knows exactly what to fetch
            await libraryManager.updateEntry(entry.id, {
              metadata: { steamAppId: game.appid }
            });
            newGamesAdded++;
          }
        }
      }

      if (newGamesAdded > 0) {
        toast.success(`Successfully imported ${newGamesAdded} new games from Steam!`);
      } else {
        toast.success("Steam library is up to date. No new games found.");
      }

    } catch (error) {
      console.error("[SteamSyncManager] Sync failed:", error);
      toast.error("Failed to sync with Steam. Ensure your profile is public.");
    }
  }
}

export const steamSyncManager = new SteamSyncManager();
