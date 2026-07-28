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

  private static readonly POPULAR_APP_ICONS: Record<string, string> = {
    "discord": "https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a69f118df70ad7828d4_icon_clyde_blurple_RGB.png",
    "visual studio code": "https://raw.githubusercontent.com/microsoft/vscode-icons/master/icons/stable/vscode.png",
    "vscode": "https://raw.githubusercontent.com/microsoft/vscode-icons/master/icons/stable/vscode.png",
    "photoshop": "https://raw.githubusercontent.com/adobe-photoshop/photoshop-brand-assets/master/photoshop_icon.png",
    "adobe photoshop": "https://raw.githubusercontent.com/adobe-photoshop/photoshop-brand-assets/master/photoshop_icon.png",
    "steam": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Steam_icon_logo.svg/512px-Steam_icon_logo.svg.png",
    "google chrome": "https://upload.wikimedia.org/wikipedia/commons/e/e1/Google_Chrome_icon_%28February_2022%29.png",
    "chrome": "https://upload.wikimedia.org/wikipedia/commons/e/e1/Google_Chrome_icon_%28February_2022%29.png",
    "firefox": "https://upload.wikimedia.org/wikipedia/commons/a/a0/Firefox_logo%2C_2019.png",
    "brave browser": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Brave_icon_sans_brand.svg/512px-Brave_icon_sans_brand.svg.png",
    "brave": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Brave_icon_sans_brand.svg/512px-Brave_icon_sans_brand.svg.png",
    "spotify": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/512px-Spotify_logo_without_text.svg.png",
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
