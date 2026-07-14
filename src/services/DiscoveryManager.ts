import { cacheManager } from "./CacheManager";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

export interface DiscoveredGame {
  id: string; // provider ID
  title: string;
  coverUrl: string;
  heroUrl?: string;
  price?: string;
  originalPrice?: string;
  discountPercent?: number;
  type?: number;
}

export interface DiscoveryLists {
  topSellers: DiscoveredGame[];
  newReleases: DiscoveredGame[];
  specials: DiscoveredGame[];
  featured: DiscoveredGame[]; // Hero carousel
}

export class DiscoveryManager {
  private readonly CACHE_KEY = "steam_featured_v8";
  private readonly CACHE_TTL_SECONDS = 3600; // 1 hour

  async getTrendingGames(): Promise<DiscoveryLists> {
    try {
      // 1. Check cache
      const cached = await cacheManager.getDiscoveryCache<DiscoveryLists>(this.CACHE_KEY);
      if (cached) {
        return cached;
      }

      // 2. Fetch fresh data from Steam API
      // Using native Tauri HTTP fetch to bypass browser CORS constraints safely
      const targetUrl = "https://store.steampowered.com/api/featuredcategories?l=english&cc=in";
      const response = await tauriFetch(targetUrl);
      
      if (!response.ok) {
        throw new Error(`Steam API responded with ${response.status}`);
      }

      const data = await response.json();

      // 3. Shape data
      const parseList = (items: any[]): DiscoveredGame[] => {
        if (!items || !Array.isArray(items)) return [];
        
        const seen = new Set<string>();
        const uniqueItems = items.filter((item) => {
          const idStr = item.id.toString();
          if (seen.has(idStr)) return false;
          seen.add(idStr);
          return true;
        });

        return uniqueItems.slice(0, 15).map((item) => ({
          id: item.id.toString(),
          title: item.name,
          coverUrl: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${item.id}/library_600x900_2x.jpg`,
          heroUrl: item.large_capsule_image || item.header_image,
          price: item.final_price ? `₹${(item.final_price / 100).toFixed(0)}` : "Free",
          originalPrice: item.original_price ? `₹${(item.original_price / 100).toFixed(0)}` : undefined,
          discountPercent: item.discount_percent,
          type: item.type,
        }));
      };

      const lists: DiscoveryLists = {
        topSellers: parseList(data.top_sellers?.items),
        newReleases: parseList(data.coming_soon?.items || data.new_releases?.items),
        specials: parseList(data.specials?.items),
        featured: parseList(data.specials?.items).slice(0, 5), 
      };

      // (Removed CheapShark fallback to ensure exact accurate regional INR pricing from Steam)

      // 4. Save to cache
      await cacheManager.setDiscoveryCache(this.CACHE_KEY, lists, this.CACHE_TTL_SECONDS);

      return lists;

    } catch (error) {
      console.error("[DiscoveryManager] Failed to fetch trending games:", error);
      // Fallback to static trending list if Steam API / proxy is unreachable due to CORS/Rate-limiting
      return {
        topSellers: [
          {
            id: "1086940",
            title: "Baldur's Gate 3",
            coverUrl: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1086940/library_600x900_2x.jpg",
            price: "₹4,999"
          },
          {
            id: "553850",
            title: "HELLDIVERS™ 2",
            coverUrl: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/553850/library_600x900_2x.jpg",
            price: "₹3,299"
          },
          {
            id: "1091500",
            title: "Cyberpunk 2077",
            coverUrl: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/library_600x900_2x.jpg",
            price: "₹4,999"
          },
          {
            id: "1172470",
            title: "Apex Legends",
            coverUrl: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1172470/library_600x900_2x.jpg",
            price: "Free"
          },
          {
            id: "730",
            title: "Counter-Strike 2",
            coverUrl: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/730/library_600x900_2x.jpg",
            price: "Free"
          },
          {
            id: "1623730",
            title: "Palworld",
            coverUrl: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1623730/library_600x900_2x.jpg",
            price: "₹1,300"
          }
        ],
        newReleases: [],
        specials: [],
        featured: []
      };
    }
  }
}

export const discoveryManager = new DiscoveryManager();
