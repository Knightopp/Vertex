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

  // Use jsDelivr CDN for dashboard-icons which serves direct PNG logos without redirects, preventing Discord media proxy failures.
  private static readonly POPULAR_APP_ICONS: Record<string, string> = {
    // Communication
    "discord": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/discord.png",
    "slack": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/slack.png",
    "telegram": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/telegram.png",
    "telegram desktop": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/telegram.png",
    "whatsapp": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/whatsapp.png",
    "zoom": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/zoom.png",
    "microsoft teams": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/microsoft-teams.png",
    "teams": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/microsoft-teams.png",
    "signal": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/signal.png",
    // Browsers
    "google chrome": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/chrome.png",
    "chrome": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/chrome.png",
    "firefox": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/firefox.png",
    "mozilla firefox": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/firefox.png",
    "brave browser": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/brave.png",
    "brave": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/brave.png",
    "microsoft edge": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/microsoft-edge.png",
    "opera": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/opera.png",
    "opera gx": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/opera.png",
    // Development
    "visual studio code": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/visual-studio-code.png",
    "vscode": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/visual-studio-code.png",
    "code": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/visual-studio-code.png",
    "visual studio": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/visual-studio.png",
    "antigravity ide": "https://raw.githubusercontent.com/Knightopp/Vertex/main/public/images/vertex_logo_transparent.png",
    "antigravity": "https://raw.githubusercontent.com/Knightopp/Vertex/main/public/images/vertex_logo_transparent.png",
    "intellij idea": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/intellij-idea.png",
    "pycharm": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/pycharm.png",
    "webstorm": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/webstorm.png",
    "sublime text": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/sublime-text.png",
    "notepad++": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/notepad-plus-plus.png",
    "github desktop": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/github.png",
    "windows terminal": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/windows-terminal.png",
    "postman": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/postman.png",
    // Creative
    "photoshop": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/photoshop.png",
    "adobe photoshop": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/photoshop.png",
    "adobe premiere pro": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/premiere-pro.png",
    "premiere pro": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/premiere-pro.png",
    "adobe after effects": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/after-effects.png",
    "after effects": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/after-effects.png",
    "adobe illustrator": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/illustrator.png",
    "illustrator": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/illustrator.png",
    "figma": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/figma.png",
    "blender": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/blender.png",
    "obs studio": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/obs-studio.png",
    "obs": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/obs-studio.png",
    "davinci resolve": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/davinci-resolve.png",
    "audacity": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/audacity.png",
    "gimp": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/gimp.png",
    // Gaming platforms
    "steam": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/steam.png",
    "epic games launcher": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/epic-games.png",
    "battle.net": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/battlenet.png",
    "ea app": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/ea.png",
    "origin": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/origin.png",
    "gog galaxy": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/gog.png",
    // Media & Entertainment
    "spotify": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/spotify.png",
    "vlc": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/vlc.png",
    "vlc media player": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/vlc.png",
    "itunes": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/itunes.png",
    // Productivity
    "notion": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/notion.png",
    "obsidian": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/obsidian.png",
    "todoist": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/todoist.png",
    "1password": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/1password.png",
    "bitwarden": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/bitwarden.png",
    "file explorer": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/files.png",
    // 3D / Game Dev
    "unity": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/unity.png",
    "unreal engine": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/unreal-engine.png",
    "godot": "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/godot.png",
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
