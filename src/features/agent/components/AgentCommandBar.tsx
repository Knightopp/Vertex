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
  const [isVisible, setIsVisible] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<ParsedCommand[]>([]);

  useEffect(() => {
    setIsVisible(true);

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        await hideCommandBar();
      }
    };

    // Also hide when window loses focus (user clicks away)
    const handleBlur = async () => {
      await hideCommandBar();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleBlur);
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

  const handleSelect = async (command: ParsedCommand) => {
    await actionExecutor.execute(command.actionId, command.parameters);
    await hideCommandBar();
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-start pt-10 bg-transparent select-none px-4">
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="w-full max-w-[600px] rounded-2xl border border-white/10 bg-[#09090B]/90 backdrop-blur-2xl shadow-2xl overflow-hidden"
          >
            <Command 
              shouldFilter={false} // We handle fuzzy matching via fuse.js
              className="flex flex-col w-full h-full bg-transparent text-white"
            >
              <div className="flex items-center px-4 border-b border-white/5" style={{ WebkitAppRegion: "drag" } as any}>
                <Terminal className="w-5 h-5 text-white/50 mr-3 shrink-0" />
                <Command.Input
                  autoFocus
                  placeholder="What do you want to do?"
                  value={inputValue}
                  onValueChange={setInputValue}
                  className="w-full bg-transparent border-none py-5 text-lg font-medium text-white placeholder:text-white/30 focus:outline-none focus:ring-0"
                  style={{ WebkitAppRegion: "no-drag" } as any}
                />
              </div>

              <Command.List className="max-h-[300px] overflow-y-auto p-2 custom-scrollbar" style={{ WebkitAppRegion: "no-drag" } as any}>
                {!inputValue && (
                  <div className="py-8 text-center text-white/30 text-sm">
                    Start typing to search commands, applications, and presets...
                  </div>
                )}
                
                {inputValue && suggestions.length === 0 && (
                  <Command.Empty className="py-8 text-center text-white/40 text-sm">
                    No matching commands found.
                  </Command.Empty>
                )}

                {suggestions.map((command, idx) => (
                  <Command.Item
                    key={`${command.actionId}-${idx}`}
                    onSelect={() => handleSelect(command)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 text-sm text-white/80 rounded-xl cursor-default select-none",
                      "aria-selected:bg-white/10 aria-selected:text-white data-[selected='true']:bg-white/10 data-[selected='true']:text-white"
                    )}
                  >
                    <div className="text-white/50">
                      {getIconForAction(command.actionId)}
                    </div>
                    <span className="font-medium">{command.title}</span>
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
