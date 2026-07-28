/**
 * GameArtworkProvider
 * Abstract provider for resolving and caching game artwork for external integrations.
 */

export interface ArtworkResolutionOptions {
  entryId?: string;
  title?: string;
  coverPath?: string | null;
  coverImagePath?: string | null;
  coverUrl?: string | null;
  metadata?: {
    steamAppId?: number | null;
    igdbId?: number | null;
    rawgId?: number | null;
  } | null;
  images?: Array<{
    type?: string;
    remoteUrl?: string | null;
    localPath?: string | null;
    isPrimary?: boolean;
  }>;
}

export class GameArtworkProvider {
  private cache = new Map<string, string>();

  // Use Clearbit CDN which serves clean square PNG brand logos and allows hotlinking/Discord media proxying.
  private static readonly POPULAR_APP_ICONS: Record<string, string> = {
    "discord": "https://logo.clearbit.com/discord.com",
    "visual studio code": "https://logo.clearbit.com/visualstudio.com",
    "vscode": "https://logo.clearbit.com/visualstudio.com",
    "photoshop": "https://logo.clearbit.com/adobe.com",
    "adobe photoshop": "https://logo.clearbit.com/adobe.com",
    "steam": "https://logo.clearbit.com/steampowered.com",
    "google chrome": "https://logo.clearbit.com/google.com",
    "chrome": "https://logo.clearbit.com/google.com",
    "firefox": "https://logo.clearbit.com/mozilla.org",
    "brave browser": "https://logo.clearbit.com/brave.com",
    "brave": "https://logo.clearbit.com/brave.com",
    "spotify": "https://logo.clearbit.com/spotify.com",
    "antigravity ide": "https://raw.githubusercontent.com/Knightopp/Vertex/main/public/images/vertex_logo_transparent.png",
    "antigravity": "https://raw.githubusercontent.com/Knightopp/Vertex/main/public/images/vertex_logo_transparent.png",
  };

  /**
   * Resolves a public/valid artwork URL for the specified game object or parameter set.
   * Returns null if no valid dynamic HTTP/HTTPS URL can be resolved.
   */
  async resolveArtwork(game: ArtworkResolutionOptions | any): Promise<string | null> {
    if (!game) return null;

    const cacheKey = this.getCacheKey(game);
    if (cacheKey && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    let resolvedUrl: string | null = null;

    try {
      // 0. Check popular app icons mapping
      const titleLower = (game.title || game.name || "").toLowerCase().trim();
      const exeNameLower = (game.executableName || "").toLowerCase().trim().replace(/\.exe$/i, "");
      
      if (GameArtworkProvider.POPULAR_APP_ICONS[titleLower]) {
        resolvedUrl = GameArtworkProvider.POPULAR_APP_ICONS[titleLower];
      } else if (GameArtworkProvider.POPULAR_APP_ICONS[exeNameLower]) {
        resolvedUrl = GameArtworkProvider.POPULAR_APP_ICONS[exeNameLower];
      }

      // 1. Direct coverUrl / coverPath if it is an HTTP/HTTPS URL
      if (!resolvedUrl) {
        const candidateUrls = [
          game.coverUrl,
          game.coverPath,
          game.coverImagePath,
          game.remoteUrl,
        ];

        for (const candidate of candidateUrls) {
          if (candidate && (candidate.startsWith("http://") || candidate.startsWith("https://"))) {
            resolvedUrl = candidate;
            break;
          }
        }
      }

      // 2. Check images array if available
      if (!resolvedUrl && Array.isArray(game.images)) {
        const primaryImage = game.images.find((img: any) => img?.isPrimary && img?.remoteUrl) ||
          game.images.find((img: any) => img?.remoteUrl);
        if (primaryImage?.remoteUrl && (primaryImage.remoteUrl.startsWith("http://") || primaryImage.remoteUrl.startsWith("https://"))) {
          resolvedUrl = primaryImage.remoteUrl;
        }
      }

      // 3. Construct Steam header URL if steamAppId is present
      if (!resolvedUrl && game.metadata?.steamAppId) {
        resolvedUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.metadata.steamAppId}/header.jpg`;
      } else if (!resolvedUrl && typeof game.steamAppId === "number") {
        resolvedUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.steamAppId}/header.jpg`;
      }

      // 4. Cache if found
      if (resolvedUrl && cacheKey) {
        this.cache.set(cacheKey, resolvedUrl);
      }
    } catch (error) {
      console.warn("[GameArtworkProvider] Error resolving artwork:", error);
    }

    return resolvedUrl;
  }

  /**
   * Retrieves previously cached artwork URL for a given cache key.
   */
  getCachedArtwork(key: string): string | null {
    return this.cache.get(key) || null;
  }

  /**
   * Manually prime cache with an artwork URL.
   */
  setCachedArtwork(key: string, url: string): void {
    this.cache.set(key, url);
  }

  /**
   * Clears internal artwork cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  private getCacheKey(game: any): string | null {
    if (game.id) return game.id;
    if (game.entryId) return game.entryId;
    if (game.title) return game.title.toLowerCase().trim();
    if (game.metadata?.steamAppId) return `steam_${game.metadata.steamAppId}`;
    return null;
  }
}

export const gameArtworkProvider = new GameArtworkProvider();
