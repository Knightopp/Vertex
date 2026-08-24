import Fuse from 'fuse.js';
import { libraryManager } from '../LibraryManager';
import { usePresetStore } from '../../stores/preset-store';

export interface ParsedCommand {
  title: string;
  actionId: string;
  parameters: Record<string, any>;
  originalText: string;
  score?: number;
}

interface CommandTemplate {
  title: string;
  actionId: string;
  parameters: Record<string, any>;
  searchTerms: string[];
}

export class CommandParser {
  private websiteAliases: Record<string, string> = {
    yt: "YouTube",
    youtube: "YouTube",
    dc: "Discord",
    discord: "Discord",
    ps: "Photoshop",
    ae: "After Effects",
    github: "GitHub",
    gh: "GitHub",
    reddit: "Reddit",
    twitter: "Twitter",
    x: "X"
  };

  /**
   * Deterministic parser with fuzzy matching support via Fuse.js.
   */
  parse(text: string): ParsedCommand[] {
    const lowerText = text.trim().toLowerCase();
    if (!lowerText) return [];

    const templates = this.buildCorpus();
    
    // Exact/Regex matchers for dynamic commands (e.g. "volume 50")
    const dynamicResults: ParsedCommand[] = [];
    
    const volMatch = lowerText.match(/^v(?:olume)?\s+(\d+)$/);
    if (volMatch) {
      dynamicResults.push({
        title: `Set Volume to ${volMatch[1]}%`,
        actionId: 'set_volume',
        parameters: { level: parseInt(volMatch[1], 10) },
        originalText: text,
        score: 0 // perfect score
      });
    }

    // Setup Fuse.js for fuzzy matching
    const fuse = new Fuse(templates, {
      keys: ['searchTerms'],
      threshold: 0.4,
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });

    const fuzzyResults = fuse.search(lowerText).map(result => ({
      title: result.item.title,
      actionId: result.item.actionId,
      parameters: result.item.parameters,
      originalText: text,
      score: result.score || 0
    }));

    // Combine and sort
    const combined = [...dynamicResults, ...fuzzyResults];
    combined.sort((a, b) => (a.score || 0) - (b.score || 0));

    return combined.slice(0, 10); // Return top 10 suggestions
  }

  private buildCorpus(): CommandTemplate[] {
    const templates: CommandTemplate[] = [];

    // 1. Library Apps
    const apps = libraryManager.getEntries();
    for (const app of apps) {
      templates.push({
        title: `Open ${app.title}`,
        actionId: 'launch_app',
        parameters: { appName: app.title, entryId: app.id },
        searchTerms: [`open ${app.title}`, `launch ${app.title}`, app.title, `start ${app.title}`]
      });
      templates.push({
        title: `Close ${app.title}`,
        actionId: 'close_app',
        parameters: { appName: app.title, entryId: app.id },
        searchTerms: [`close ${app.title}`, `kill ${app.title}`, `quit ${app.title}`]
      });
      templates.push({
        title: `Force Close ${app.title}`,
        actionId: 'force_close_app',
        parameters: { appName: app.title, entryId: app.id },
        searchTerms: [`force close ${app.title}`, `force quit ${app.title}`]
      });
    }

    // 2. Presets
    const presets = usePresetStore.getState().presets;
    for (const preset of presets) {
      templates.push({
        title: `Start ${preset.name} Preset`,
        actionId: 'start_preset',
        parameters: { presetName: preset.name },
        searchTerms: [`start ${preset.name}`, `preset ${preset.name}`, preset.name]
      });
      templates.push({
        title: `Stop ${preset.name} Preset`,
        actionId: 'stop_preset',
        parameters: { presetName: preset.name },
        searchTerms: [`stop ${preset.name}`, `end ${preset.name}`]
      });
    }

    // 3. Websites / Aliases
    for (const [alias, name] of Object.entries(this.websiteAliases)) {
      templates.push({
        title: `Open ${name}`,
        actionId: 'open_website',
        parameters: { url: name.toLowerCase() },
        searchTerms: [`open ${alias}`, `open ${name}`, alias, name, `go to ${name}`]
      });
    }

    // 4. System / Static Commands
    templates.push(
      {
        title: "Take Screenshot",
        actionId: "screenshot",
        parameters: {},
        searchTerms: ["screenshot", "take screenshot", "capture screen", "prtscr"]
      },
      {
        title: "Start Recording",
        actionId: "start_recording",
        parameters: {},
        searchTerms: ["start recording", "record screen", "capture video"]
      },
      {
        title: "Stop Recording",
        actionId: "stop_recording",
        parameters: {},
        searchTerms: ["stop recording", "end recording", "save video"]
      },
      {
        title: "Mute System Volume",
        actionId: "mute",
        parameters: {},
        searchTerms: ["mute", "silence", "quiet", "mute volume"]
      },
      {
        title: "Lock PC",
        actionId: "lock_pc",
        parameters: {},
        searchTerms: ["lock pc", "lock computer", "lock screen", "sleep"]
      },
      {
        title: "Open Vertex Dashboard",
        actionId: "open_vertex",
        parameters: {},
        searchTerms: ["open vertex", "vertex", "dashboard", "home"]
      }
    );

    return templates;
  }
}

export const commandParser = new CommandParser();
