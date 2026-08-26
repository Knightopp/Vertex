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
  private installedAppsCache: Array<{ name: string; path: string }> = [];

  constructor() {
    this.refreshInstalledApps();
  }

  async refreshInstalledApps() {
    try {
      const { getInstalledApps } = await import('../../lib/tauri-ipc');
      const apps = await getInstalledApps();
      // Sanitize app names to remove weird non-printable or unicode chars
      // that can cause fuzzy-match garbage (e.g. from registry weirdness)
      this.installedAppsCache = apps.map(app => ({
        ...app,
        name: app.name.replace(/[^\x20-\x7E]/g, '').trim()
      })).filter(app => app.name.length > 0);
    } catch (_) {}
  }

  private commonApps = [
    { name: "Spotify", searchTerms: ["spotify", "open spotify", "play spotify", "music", "songs"] },
    { name: "Discord", searchTerms: ["discord", "open discord", "dc", "chat"] },
    { name: "Steam", searchTerms: ["steam", "open steam", "valve"] },
    { name: "Epic Games", searchTerms: ["epic", "epic games", "open epic"] },
    { name: "Visual Studio Code", searchTerms: ["vscode", "vs code", "code", "open code"] },
    { name: "Chrome", searchTerms: ["chrome", "google chrome", "browser", "open chrome"] },
    { name: "Notepad", searchTerms: ["notepad", "notes", "open notepad"] },
    { name: "Calculator", searchTerms: ["calc", "calculator", "open calc"] },
    { name: "Task Manager", searchTerms: ["taskmgr", "task manager", "tasks"] },
    { name: "Settings", searchTerms: ["settings", "windows settings", "control panel"] },
  ];

  private websiteAliases: Array<{ alias: string; name: string; url: string }> = [
    { alias: "youtube", name: "YouTube", url: "https://www.youtube.com" },
    { alias: "yt", name: "YouTube", url: "https://www.youtube.com" },
    { alias: "github", name: "GitHub", url: "https://github.com" },
    { alias: "gh", name: "GitHub", url: "https://github.com" },
    { alias: "reddit", name: "Reddit", url: "https://www.reddit.com" },
    { alias: "twitter", name: "Twitter", url: "https://twitter.com" },
    { alias: "x", name: "X", url: "https://x.com" },
    { alias: "twitch", name: "Twitch", url: "https://www.twitch.tv" },
    { alias: "netflix", name: "Netflix", url: "https://www.netflix.com" },
    { alias: "chatgpt", name: "ChatGPT", url: "https://chatgpt.com" },
    { alias: "google", name: "Google", url: "https://www.google.com" }
  ];

  /**
   * Deterministic parser with fuzzy matching support via Fuse.js.
   */
  parse(text: string): ParsedCommand[] {
    const lowerText = text.trim().toLowerCase();
    if (!lowerText) return [];

    const templates = this.buildCorpus();
    
    // Exact/Regex matchers for dynamic commands
    const dynamicResults: ParsedCommand[] = [];
    
    // 0. Quick keyboard power shortcuts
    if (lowerText === 'sh' || lowerText === 'qwe' || lowerText === 'shutdown' || lowerText === 'shut down') {
      return [{
        title: "Shutdown PC",
        actionId: "shutdown",
        parameters: {},
        originalText: text,
        score: -2
      }];
    }
    if (lowerText === 'sl' || lowerText === 'sleep') {
      return [{
        title: "Sleep PC",
        actionId: "sleep",
        parameters: {},
        originalText: text,
        score: -2
      }];
    }
    if (lowerText === 'close all' || lowerText === 'close all apps' || lowerText === 'close all app' || lowerText === 'kill all' || lowerText === 'quit all' || lowerText === 'close everything') {
      return [{
        title: "Close All Applications",
        actionId: "close_all_apps",
        parameters: {},
        originalText: text,
        score: -2
      }];
    }

    // 1. Dynamic "Close <app>" matcher
    const closeAppMatch = lowerText.match(/^(?:close|kill|quit|exit|stop)\s+(.+)$/i);
    if (closeAppMatch) {
      const targetApp = closeAppMatch[1].trim();
      
      const exceptMatch = targetApp.match(/^(?:all|everything|all apps)\s+(?:except|but)\s+(.+)$/i);
      if (exceptMatch) {
        const exceptApp = exceptMatch[1].trim();
        const capitalized = exceptApp.charAt(0).toUpperCase() + exceptApp.slice(1);
        dynamicResults.push({
          title: `Close All Except ${capitalized}`,
          actionId: "close_all_apps",
          parameters: { exceptApp: capitalized },
          originalText: text,
          score: -1.6
        });
      } else if (targetApp === "all" || targetApp === "all apps" || targetApp === "all app" || targetApp === "everything") {
        dynamicResults.push({
          title: "Close All Applications",
          actionId: "close_all_apps",
          parameters: {},
          originalText: text,
          score: -1.5
        });
      } else {
        const capitalized = targetApp.charAt(0).toUpperCase() + targetApp.slice(1);
        dynamicResults.push({
          title: `Close ${capitalized}`,
          actionId: 'close_app',
          parameters: { appName: capitalized },
          originalText: text,
          score: -0.9
        });
      }
    }

    // 2. Custom URL or domain (e.g. "hello.com", "open reddit.com/r/gaming", "https://xyz.org")
    const cleanUrlQuery = lowerText.replace(/^(?:open|go\s+to|visit|launch)\s+/i, '').trim();
    const urlPattern = /^(?:https?:\/\/)?([a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\/[^\s]*)?)$/i;
    const urlMatch = cleanUrlQuery.match(urlPattern);

    if (urlMatch && !closeAppMatch) {
      const rawDomain = urlMatch[1];
      const targetUrl = cleanUrlQuery.startsWith('http://') || cleanUrlQuery.startsWith('https://') 
        ? cleanUrlQuery 
        : `https://${rawDomain}`;
      
      dynamicResults.push({
        title: `Open ${rawDomain}`,
        actionId: 'open_website',
        parameters: { url: targetUrl },
        originalText: text,
        score: -1 // Top priority
      });
    }

    // 3. Dynamic volume matcher
    const volMatch = lowerText.match(/^v(?:olume)?\s+(\d+)$/);
    if (volMatch) {
      dynamicResults.push({
        title: `Set Volume to ${volMatch[1]}%`,
        actionId: 'set_volume',
        parameters: { level: parseInt(volMatch[1], 10) },
        originalText: text,
        score: -0.5
      });
    }

    // 3.5 "Show" command for info
    if (lowerText.startsWith("show") || lowerText === "info" || lowerText === "time" || lowerText === "battery" || lowerText === "now playing") {
      dynamicResults.push({
        title: "Show System Info (All)",
        actionId: 'show_info',
        parameters: { type: 'all' },
        originalText: text,
        score: -1.2
      });
      dynamicResults.push({
        title: "Show Battery",
        actionId: 'show_info',
        parameters: { type: 'battery' },
        originalText: text,
        score: -1.1
      });
      dynamicResults.push({
        title: "Show Time",
        actionId: 'show_info',
        parameters: { type: 'time' },
        originalText: text,
        score: -1.1
      });
      dynamicResults.push({
        title: "Show Now Playing",
        actionId: 'show_info',
        parameters: { type: 'music' },
        originalText: text,
        score: -1.1
      });
    }

    // 4. Dynamic "Open <app>" fallback if user types an app name
    const openAppMatch = lowerText.match(/^(?:open|launch|start)\s+(.+)$/i);
    if (openAppMatch && !urlMatch && !closeAppMatch) {
      const targetApp = openAppMatch[1].trim();
      const capitalized = targetApp.charAt(0).toUpperCase() + targetApp.slice(1);
      dynamicResults.push({
        title: `Launch ${capitalized}`,
        actionId: 'launch_app',
        parameters: { appName: capitalized },
        originalText: text,
        score: 0.1
      });
    }

    // Setup Fuse.js for fuzzy matching against library, installed apps, presets, and system actions
    const fuse = new Fuse(templates, {
      keys: ['searchTerms'],
      threshold: 0.38,
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

    return combined.slice(0, 10);
  }

  private buildCorpus(): CommandTemplate[] {
    const templates: CommandTemplate[] = [];

    // 1. Library Apps & Games from Vertex
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
    }

    // 2. Installed Windows Applications (Scanned from Start Menu)
    for (const app of this.installedAppsCache) {
      templates.push({
        title: `Open ${app.name}`,
        actionId: 'launch_app',
        parameters: { appName: app.name, path: app.path },
        searchTerms: [`open ${app.name.toLowerCase()}`, `launch ${app.name.toLowerCase()}`, app.name.toLowerCase()]
      });
      templates.push({
        title: `Close ${app.name}`,
        actionId: 'close_app',
        parameters: { appName: app.name },
        searchTerms: [`close ${app.name.toLowerCase()}`, `kill ${app.name.toLowerCase()}`, `quit ${app.name.toLowerCase()}`]
      });
    }

    // 3. Common Desktop Applications
    for (const app of this.commonApps) {
      templates.push({
        title: `Open ${app.name}`,
        actionId: 'launch_app',
        parameters: { appName: app.name },
        searchTerms: app.searchTerms
      });
      templates.push({
        title: `Close ${app.name}`,
        actionId: 'close_app',
        parameters: { appName: app.name },
        searchTerms: [
          `close ${app.name.toLowerCase()}`,
          `kill ${app.name.toLowerCase()}`,
          `quit ${app.name.toLowerCase()}`,
          `exit ${app.name.toLowerCase()}`,
          `stop ${app.name.toLowerCase()}`
        ]
      });
    }

    // 4. Presets
    const presets = usePresetStore.getState().presets;
    for (const preset of presets) {
      templates.push({
        title: `Start ${preset.name} Preset`,
        actionId: 'start_preset',
        parameters: { presetName: preset.name },
        searchTerms: [`start ${preset.name}`, `preset ${preset.name}`, preset.name]
      });
    }

    // 5. Websites & Web Apps (YouTube, Twitch, Netflix, etc.)
    for (const site of this.websiteAliases) {
      templates.push({
        title: `Open ${site.name}`,
        actionId: 'open_website',
        parameters: { url: site.url },
        searchTerms: [`open ${site.alias}`, `open ${site.name}`, site.alias, site.name, `go to ${site.name}`]
      });
      templates.push({
        title: `Close ${site.name}`,
        actionId: 'close_app',
        parameters: { appName: site.name },
        searchTerms: [`close ${site.alias}`, `close ${site.name}`, `kill ${site.name}`, `quit ${site.name}`]
      });
    }

    // 6. Image & Photo Viewer actions
    templates.push({
      title: "Close Photos / Images",
      actionId: "close_app",
      parameters: { appName: "Photos" },
      searchTerms: [
        "close images",
        "close image",
        "close photos",
        "close photo",
        "close picture",
        "close pictures",
        "kill photos",
        "kill images",
        "quit photos"
      ]
    });

    // 7. System / Power / Window Commands
    templates.push(
      {
        title: "Take Screenshot",
        actionId: "take_screenshot",
        parameters: {},
        searchTerms: ["screenshot", "take screenshot", "capture screen", "prtscr", "snip"]
      },
      {
        title: "Close All Applications",
        actionId: "close_all_apps",
        parameters: {},
        searchTerms: ["close all", "close all apps", "kill all", "quit all", "close everything", "exit all", "close windows"]
      },
      {
        title: "Shutdown PC",
        actionId: "shutdown",
        parameters: {},
        searchTerms: ["sh", "qwe", "shutdown", "shut down", "turn off", "power off", "shutdown pc", "turn off pc"]
      },
      {
        title: "Sleep PC",
        actionId: "sleep",
        parameters: {},
        searchTerms: ["sl", "sleep", "sleep pc", "standby", "suspend"]
      },
      {
        title: "Lock PC",
        actionId: "lock_pc",
        parameters: {},
        searchTerms: ["lock", "lock pc", "lock computer", "lock screen"]
      },
      {
        title: "Toggle Mute",
        actionId: "mute",
        parameters: {},
        searchTerms: ["mute", "silence", "quiet", "toggle mute", "sound", "volume"]
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
        title: "Show System Info",
        actionId: "show_info",
        parameters: {},
        searchTerms: ["show", "info", "time", "battery", "now playing", "music playing"]
      }
    );

    return templates;
  }
}

export const commandParser = new CommandParser();
