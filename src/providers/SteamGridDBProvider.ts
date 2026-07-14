import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

const API_KEY = "288f82310829b3ea5e4b2256d88dfe0a";
const BASE_URL = "https://www.steamgriddb.com/api/v2";

export interface SGDBGame {
  id: number;
  name: string;
  types: string[];
  verified: boolean;
}

export interface SGDBGrid {
  id: number;
  url: string;
  thumb: string;
  style: string;
  author: {
    name: string;
  };
}

class SteamGridDBProvider {
  private async fetch<T>(endpoint: string): Promise<T | null> {
    try {
      const url = `${BASE_URL}${endpoint}`;
      const response = await tauriFetch(url, {
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Accept": "application/json"
        }
      });
      if (!response.ok) return null;
      const json = await response.json();
      return json.data as T;
    } catch (e) {
      console.error("SteamGridDB fetch error:", e);
      return null;
    }
  }

  async searchGame(query: string): Promise<SGDBGame | null> {
    // We use autocomplete because it's highly tolerant of generic names like "Discord" or "VS Code"
    const data = await this.fetch<SGDBGame[]>(`/search/autocomplete/${encodeURIComponent(query)}`);
    if (!data || data.length === 0) return null;
    // Prefer exactly matched alphanumeric, otherwise take the first
    const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9]/g, "");
    const match = data.find(g => g.name.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedQuery) || data[0];
    return match;
  }

  async getCoverUrl(gameId: number): Promise<string | null> {
    // 600x900 is standard Steam poster ratio
    const data = await this.fetch<SGDBGrid[]>(`/grids/game/${gameId}?dimensions=600x900,342x482&styles=alternate,blurred,white_logo,material,no_logo`);
    if (!data || data.length === 0) return null;
    // SteamGridDB orders by upvotes generally, so we just take the first result
    return data[0].url;
  }
  
  async getHeroUrl(gameId: number): Promise<string | null> {
    const data = await this.fetch<SGDBGrid[]>(`/heroes/game/${gameId}?styles=alternate,blurred,material`);
    if (!data || data.length === 0) return null;
    return data[0].url;
  }

  async getLogoUrl(gameId: number): Promise<string | null> {
    const data = await this.fetch<SGDBGrid[]>(`/logos/game/${gameId}`);
    if (!data || data.length === 0) return null;
    return data[0].url;
  }
}

export const steamGridDB = new SteamGridDBProvider();
