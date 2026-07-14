import { GameMetadata, GameSearchResult, MetadataProvider } from "./types";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

export class SteamProvider implements MetadataProvider {
  name = "steam";
  priority = 3; // Lower than IGDB and RAWG, acts as a fallback or for PC specific games

  async isAvailable(): Promise<boolean> {
    return true; // Steam API is public and doesn't require an API key
  }

  async search(query: string): Promise<GameSearchResult[]> {
    try {
      const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=english&cc=US`;
      const response = await tauriFetch(url);
      
      if (!response.ok) {
        throw new Error(`Steam API responded with ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.items || !Array.isArray(data.items)) {
        return [];
      }

      return data.items.map((item: any, index: number) => {
        // Calculate a simple confidence score
        // Exact match = 1.0, otherwise degrades based on position in results
        const exactMatch = item.name.toLowerCase() === query.toLowerCase();
        const confidence = exactMatch ? 1.0 : Math.max(0.1, 0.9 - (index * 0.1));

        return {
          providerId: item.id.toString(),
          providerName: this.name,
          title: item.name,
          confidence,
        };
      });
    } catch (error) {
      console.error("[SteamProvider] Search failed:", error);
      return [];
    }
  }

  async getMetadata(providerId: string): Promise<GameMetadata | null> {
    try {
      const url = `https://store.steampowered.com/api/appdetails?appids=${providerId}`;
      const response = await tauriFetch(url);
      
      if (!response.ok) {
        throw new Error(`Steam API responded with ${response.status}`);
      }

      const data = await response.json();
      const appData = data[providerId];
      
      if (!appData || !appData.success) {
        return null;
      }

      const game = appData.data;

      // Extract genres
      const genres = game.genres ? game.genres.map((g: any) => g.description) : [];

      // Extract platforms
      const platforms = [];
      if (game.platforms?.windows) platforms.push("PC");
      if (game.platforms?.mac) platforms.push("Mac");
      if (game.platforms?.linux) platforms.push("Linux");

      // Extract screenshots
      const screenshots = game.screenshots 
        ? game.screenshots.map((s: any) => s.path_full)
        : [];

      const coverUrl = `https://steamcdn-a.akamaihd.net/steam/apps/${providerId}/library_600x900_2x.jpg`;
      let isValidCover = false;
      try {
        const coverCheck = await tauriFetch(coverUrl, { method: "HEAD" });
        isValidCover = coverCheck.ok;
      } catch (e) {
        // Ignore fetch errors and assume false
      }

      return {
        title: game.name,
        description: game.short_description || game.about_the_game,
        developer: game.developers ? game.developers[0] : undefined,
        publisher: game.publishers ? game.publishers[0] : undefined,
        releaseDate: game.release_date?.date,
        genres,
        platforms,
        metacriticScore: game.metacritic?.score,
        // Use the official vertical capsule for perfect grid aspect ratio
        coverUrl: isValidCover ? coverUrl : undefined,
        heroUrl: game.header_image || game.background_raw || game.background,
        screenshotUrls: screenshots,
        providerIds: {
          steam: parseInt(providerId, 10),
        }
      };
    } catch (error) {
      console.error(`[SteamProvider] Failed to fetch metadata for ${providerId}:`, error);
      return null;
    }
  }
}

export const steamProvider = new SteamProvider();
