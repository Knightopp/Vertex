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
  const [isVisible, setIsVisible] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<ParsedCommand[]>([]);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        await hideCommandBar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    // Delay blur handler so the OS focus handoff doesn't immediately close the window
    let blurTimer: ReturnType<typeof setTimeout>;
    const handleBlur = () => {
      blurTimer = setTimeout(async () => {
        await hideCommandBar();
      }, 100);
    };
    const handleFocus = () => {
      clearTimeout(blurTimer);
    };

    const blurSetupTimer = setTimeout(() => {
      window.addEventListener("blur", handleBlur);
      window.addEventListener("focus", handleFocus);
    }, 300);

    return () => {
      clearTimeout(blurSetupTimer);
      clearTimeout(blurTimer);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
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
    setIsVisible(false);
    setTimeout(async () => {
      if (embedded) {
        onClose?.();
      } else {
        const win = getCurrentWindow();
        await win.hide();
      }
      // Reset state for next open
      setInputValue("");
      setIsVisible(true);
    }, 150);
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

  return (
    <div className="w-full h-full flex flex-col items-center justify-start pt-6 bg-transparent select-none px-4">
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="w-full max-w-[620px] rounded-2xl border border-white/15 bg-[#0e0e14]/95 backdrop-blur-2xl shadow-2xl overflow-hidden ring-1 ring-white/10"
          >
            <Command 
              shouldFilter={false}
              className="flex flex-col w-full h-full bg-transparent text-white"
            >
              <div className="flex items-center px-4 py-1 border-b border-white/10 bg-white/[0.02]" style={{ WebkitAppRegion: "drag" } as any}>
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 mr-3 shrink-0">
                  <Terminal className="w-4 h-4" />
                </div>
                <Command.Input
                  autoFocus
                  placeholder="Type a command (e.g. 'open steam', 'take screenshot')..."
                  value={inputValue}
                  onValueChange={setInputValue}
                  className="w-full bg-transparent border-none py-4 text-base font-medium text-white placeholder:text-white/40 focus:outline-none focus:ring-0"
                  style={{ WebkitAppRegion: "no-drag" } as any}
                />
                {inputValue && (
                  <button
                    onClick={() => setInputValue("")}
                    className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white/60 transition"
                    style={{ WebkitAppRegion: "no-drag" } as any}
                  >
                    Clear
                  </button>
                )}
              </div>

              <Command.List className="max-h-[300px] overflow-y-auto p-2 custom-scrollbar" style={{ WebkitAppRegion: "no-drag" } as any}>
                {!inputValue && (
                  <div className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider uppercase text-white/40">
                    Quick Actions
                  </div>
                )}
                
                {inputValue && suggestions.length === 0 && (
                  <Command.Empty className="py-8 text-center text-white/40 text-sm">
                    No matching commands found for "{inputValue}"
                  </Command.Empty>
                )}

                {displayedCommands.map((command, idx) => (
                  <Command.Item
                    key={`${command.actionId}-${idx}`}
                    onSelect={() => handleSelect(command)}
                    className={cn(
                      "flex items-center gap-3 px-3.5 py-2.5 my-0.5 text-sm text-white/90 rounded-xl cursor-pointer select-none transition-colors",
                      "hover:bg-white/10 aria-selected:bg-purple-600/20 aria-selected:text-white aria-selected:ring-1 aria-selected:ring-purple-500/30"
                    )}
                  >
                    <div className="p-1.5 rounded-lg bg-white/5 text-white/70">
                      {getIconForAction(command.actionId)}
                    </div>
                    <span className="font-medium flex-1">{command.title}</span>
                    <span className="text-xs text-white/30 font-mono capitalize">
                      {command.actionId.replace(/_/g, " ")}
                    </span>
                  </Command.Item>
                ))}
              </Command.List>
            </Command>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AgentCommandBar;
