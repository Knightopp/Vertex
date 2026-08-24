import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Command } from "cmdk";
import { actionExecutor } from "@/services/agent/ActionExecutor";
import { commandParser, ParsedCommand } from "@/services/agent/CommandParser";
import { Terminal, Globe, Folder, PlayCircle, StopCircle, VolumeX, Lock, MonitorUp } from "lucide-react";
import { cn } from "@/lib/utils";

// Note: To map generic actionIds to icons
const getIconForAction = (actionId: string) => {
  if (actionId === 'launch_app') return <MonitorUp className="w-4 h-4" />;
  if (actionId === 'start_preset') return <PlayCircle className="w-4 h-4" />;
  if (actionId === 'stop_preset') return <StopCircle className="w-4 h-4" />;
  if (actionId === 'open_website') return <Globe className="w-4 h-4" />;
  if (actionId === 'open_folder') return <Folder className="w-4 h-4" />;
  if (actionId === 'mute') return <VolumeX className="w-4 h-4" />;
  if (actionId === 'lock_pc') return <Lock className="w-4 h-4" />;
  return <Terminal className="w-4 h-4" />;
};

interface AgentCommandBarProps {
  embedded?: boolean;
  onClose?: () => void;
}

export const AgentCommandBar: React.FC<AgentCommandBarProps> = ({ embedded, onClose }) => {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<ParsedCommand[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus input on mount and whenever window gets focus
    inputRef.current?.focus();

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        await hideCommandBar();
      }
    };

    const handleWindowFocus = () => {
      inputRef.current?.focus();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, []);

  useEffect(() => {
    if (inputValue.trim()) {
      setSuggestions(commandParser.parse(inputValue));
    } else {
      setSuggestions([]);
    }
  }, [inputValue]);

  const hideCommandBar = async () => {
    if (embedded) {
      onClose?.();
    } else {
      try {
        const win = getCurrentWindow();
        await win.hide();
      } catch (e) {
        console.error(e);
      }
    }
    setInputValue("");
  };

  const defaultQuickActions: ParsedCommand[] = [
    {
      actionId: "take_screenshot",
      title: "Take Screenshot",
      confidence: 1,
      parameters: {},
    },
    {
      actionId: "mute",
      title: "Toggle Mute",
      confidence: 1,
      parameters: {},
    },
    {
      actionId: "lock_pc",
      title: "Lock PC",
      confidence: 1,
      parameters: {},
    },
    {
      actionId: "open_website",
      title: "Open YouTube",
      confidence: 1,
      parameters: { url: "https://www.youtube.com" },
    },
    {
      actionId: "launch_app",
      title: "Open Steam",
      confidence: 1,
      parameters: { appName: "Steam" },
    },
  ];

  const displayedCommands = inputValue.trim() ? suggestions : defaultQuickActions;

  const [executingTitle, setExecutingTitle] = useState<string | null>(null);

  const handleSelect = async (command: ParsedCommand) => {
    // Hide the command bar immediately on single click
    await hideCommandBar();
    
    try {
      await actionExecutor.execute(command.actionId, command.parameters);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="w-full h-full p-2 bg-transparent select-none flex flex-col">
      <div className="w-full h-full rounded-2xl border border-white/20 bg-[#161622] shadow-2xl overflow-hidden flex flex-col ring-1 ring-white/10">
        <Command 
          shouldFilter={false}
          className="flex flex-col w-full h-full bg-[#161622] text-white"
        >
          {/* Header Search Input */}
          <div className="flex items-center px-4 py-2.5 border-b border-white/10 bg-[#1a1a28] shrink-0" style={{ WebkitAppRegion: "drag" } as any}>
            <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400 mr-3 shrink-0">
              <Terminal className="w-4 h-4" />
            </div>
            <input
              ref={inputRef}
              autoFocus
              placeholder="Type a command (e.g. 'open steam', 'take screenshot')..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && displayedCommands.length > 0) {
                  await handleSelect(displayedCommands[0]);
                }
              }}
              className="w-full bg-transparent border-none py-1.5 text-sm font-medium text-white placeholder:text-white/40 focus:outline-none focus:ring-0"
              style={{ WebkitAppRegion: "no-drag" } as any}
            />
            {inputValue && (
              <button
                onMouseDown={(e) => { e.preventDefault(); setInputValue(""); }}
                className="text-xs px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white/70 transition shrink-0"
                style={{ WebkitAppRegion: "no-drag" } as any}
              >
                Clear
              </button>
            )}
          </div>

          {/* Action List */}
          <Command.List className="flex-1 overflow-y-auto p-2 custom-scrollbar bg-[#161622]" style={{ WebkitAppRegion: "no-drag" } as any}>
            {!inputValue && (
              <div className="px-3 pt-1 pb-1 text-[10px] font-bold tracking-wider uppercase text-purple-400">
                Suggested Actions
              </div>
            )}
            
            {inputValue && suggestions.length === 0 && (
              <div className="py-8 text-center text-white/40 text-sm">
                No matching commands found for "{inputValue}"
              </div>
            )}

            {displayedCommands.map((command, idx) => (
              <div
                key={`${command.actionId}-${idx}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(command);
                }}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 my-1 text-sm text-white/90 rounded-xl cursor-pointer select-none transition-all",
                  "bg-white/[0.02] hover:bg-purple-600/30 hover:text-white active:scale-[0.98] hover:ring-1 hover:ring-purple-500/50"
                )}
              >
                <div className="p-1.5 rounded-lg bg-white/10 text-white/80 shrink-0">
                  {getIconForAction(command.actionId)}
                </div>
                <span className="font-medium flex-1 truncate">{command.title}</span>
                <span className="text-[11px] text-white/40 font-mono px-2 py-0.5 rounded bg-white/5 shrink-0">
                  Enter ↵
                </span>
              </div>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  );
};

export default AgentCommandBar;
