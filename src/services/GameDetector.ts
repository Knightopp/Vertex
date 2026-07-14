import { ProcessInfo } from "../lib/tauri-ipc";
import { steamProvider } from "../providers/SteamProvider";

export interface DetectionResult {
  isGame: boolean;
  confidence: number;
  officialTitle: string;
  steamAppId?: number;
  coverUrl?: string;
}

const GAME_PUBLISHERS = ["electronic arts", "ea", "ubisoft", "valve", "bethesda", "cd projekt", "rockstar", "blizzard", "activision", "riot", "square enix", "capcom", "sega", "bandai", "konami"];
const GAME_FOLDERS = ["steamapps\\common", "epic games", "origin games", "ubisoft game launcher", "battle.net", "gog galaxy", "xboxgames"];
const UNREAL_ENGINES = ["shipping.exe", "startprotectedgame.exe", "eaclauncher.exe", "launcher.exe"];
const UNITY_FILES = ["unityplayer.dll"];

export class GameDetector {
  /**
   * Evaluates a process and returns a confidence score (0-100)
   * on whether it's a game.
   */
  async evaluate(process: ProcessInfo): Promise<DetectionResult> {
    let confidence = 0;
    const pathLower = (process.exePath || "").toLowerCase();
    
    let resolvedTitle = process.productName || process.fileDescription || process.name.replace(".exe", "");

    // 1. Check known launchers/paths (+30)
    if (GAME_FOLDERS.some(folder => pathLower.includes(folder))) {
      confidence += 30;
    }

    // 2. Check Publisher (+20)
    if (process.companyName) {
      const company = process.companyName.toLowerCase();
      if (GAME_PUBLISHERS.some(p => company.includes(p))) {
        confidence += 20;
      }
    }

    // 3. Heuristic Pathing (Unreal Engine / Unity)
    // If it's a generic exe like 'game-win64-shipping.exe', look at the parent folder
    const exeName = process.name.toLowerCase();
    if (UNREAL_ENGINES.some(e => exeName.includes(e)) || exeName === "game.exe") {
      const parts = pathLower.split("\\");
      if (parts.length > 2) {
        // e.g., D:\Games\Elden Ring\Game\start.exe -> Elden Ring
        let folderName = parts[parts.length - 2];
        if (folderName.toLowerCase() === "game" || folderName.toLowerCase() === "binaries") {
            folderName = parts[parts.length - 3] || folderName;
        }
        resolvedTitle = folderName;
        confidence += 20; // High confidence it's a cracked/portable game
      }
    }

    // 4. Window Title (+10)
    if (process.windowTitle && process.windowTitle.toLowerCase() !== resolvedTitle.toLowerCase()) {
      // Sometimes the window title is exactly the game name
      confidence += 10;
    }

    // 5. Online Database Lookup (+30)
    // We try Steam first.
    let steamAppId: number | undefined;
    let coverUrl: string | undefined;
    let officialTitle = resolvedTitle;
    
    try {
      const matches = await steamProvider.search(resolvedTitle);
      const normalizedTitle = resolvedTitle.toLowerCase().replace(/[^a-z0-9]/g, "");
      // Only accept exact alphanumeric matches to prevent false positives
      const match = matches.find(m => m.title.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedTitle);
      
      if (match) {
        confidence += 30;
        officialTitle = match.title;
        
        const metadata = await steamProvider.getMetadata(match.providerId);
        if (metadata) {
            steamAppId = metadata.providerIds.steam;
            coverUrl = metadata.coverUrl;
        }
      }
    } catch (e) {
      console.error("[GameDetector] Failed to reach Steam API", e);
    }
    
    // Future expansions: IGDB -> RAWG -> PCGamingWiki could be cascaded here.
    
    return {
      isGame: confidence >= 80,
      confidence,
      officialTitle,
      steamAppId,
      coverUrl
    };
  }
}

export const gameDetector = new GameDetector();
