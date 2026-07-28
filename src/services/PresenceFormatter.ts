/**
 * PresenceFormatter
 * Helper responsible for cleaning process names and formatting Rich Presence strings
 * for games and applications.
 */

export class PresenceFormatter {
  private static readonly KNOWN_MAPPINGS: Record<string, string> = {
    "discord": "Discord",
    "code": "Visual Studio Code",
    "photoshop": "Adobe Photoshop",
    "steam": "Steam",
    "spotify": "Spotify",
    "chrome": "Google Chrome",
    "firefox": "Firefox",
    "devenv": "Visual Studio",
    "vazorism": "Vertex",
    "vertex": "Vertex",
  };

  /**
   * Cleans process names, removes executable extensions, and maps known applications
   * to their clean display names.
   */
  static cleanDisplayName(name: string): string {
    if (!name) return "";

    let cleaned = name.trim();

    // Remove file extensions (.exe, .msi, etc.)
    cleaned = cleaned.replace(/\.(exe|msi|bat|lnk|app)$/i, "");

    // Remove labels like (Program) or (Game) or [Program]
    cleaned = cleaned.replace(/\s*[\(\[][^)]*?(program|game|exe)[^)]*?[\)\]]/i, "");

    // Remove any trailing (Program) or (Game) directly
    cleaned = cleaned.replace(/\s*\(Program\)/i, "");
    cleaned = cleaned.replace(/\s*\(Game\)/i, "");

    // Check lowercase key in mappings
    const key = cleaned.toLowerCase();
    if (this.KNOWN_MAPPINGS[key]) {
      return this.KNOWN_MAPPINGS[key];
    }

    return cleaned;
  }

  /**
   * Generates the details string for the Rich Presence payload.
   */
  static getDetails(name: string, type: "game" | "application"): string {
    const cleanName = this.cleanDisplayName(name);
    if (type === "game") {
      return `Playing ${cleanName}`;
    } else {
      return `Using ${cleanName}`;
    }
  }

  /**
   * Generates the state string for the Rich Presence payload.
   */
  static getState(type: "game" | "application"): string {
    return type === "game" ? "Session" : "Active";
  }
}
