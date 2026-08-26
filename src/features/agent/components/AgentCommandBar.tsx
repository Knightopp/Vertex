import React, { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { actionExecutor } from "@/services/agent/ActionExecutor";
import { commandParser, ParsedCommand } from "@/services/agent/CommandParser";
import {
  Terminal, Globe, Folder, PlayCircle, StopCircle,
  VolumeX, Lock, MonitorUp, Power, Moon, XCircle, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

const getIconForAction = (actionId: string) => {
  const cls = "w-3.5 h-3.5";
  if (actionId === "launch_app")    return <MonitorUp className={cls} />;
  if (actionId === "start_preset")  return <PlayCircle className={cls} />;
  if (actionId === "stop_preset")   return <StopCircle className={cls} />;
  if (actionId === "open_website")  return <Globe className={cls} />;
  if (actionId === "open_folder")   return <Folder className={cls} />;
  if (actionId === "mute")          return <VolumeX className={cls} />;
  if (actionId === "lock_pc")       return <Lock className={cls} />;
  if (actionId === "shutdown")      return <Power className={cls} />;
  if (actionId === "sleep")         return <Moon className={cls} />;
  if (actionId === "close_all_apps")return <XCircle className={cls} />;
  return <Terminal className={cls} />;
};

interface AgentCommandBarProps {
  embedded?: boolean;
  onClose?: () => void;
}

export const AgentCommandBar: React.FC<AgentCommandBarProps> = ({ embedded, onClose }) => {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<ParsedCommand[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Focus on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  // Re-focus when the window receives focus (for the floating window mode)
  useEffect(() => {
    const handleFocus = () => inputRef.current?.focus();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  // Global Escape key
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "Escape") await hideCommandBar();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Parse suggestions whenever input changes
  useEffect(() => {
    if (inputValue.trim()) {
      setSuggestions(commandParser.parse(inputValue));
    } else {
      setSuggestions([]);
    }
    setSelectedIndex(0);
  }, [inputValue]);

  // Scroll selected item into view
  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedIndex]);

  const hideCommandBar = async () => {
    if (embedded) {
      onClose?.();
    } else {
      try {
        await getCurrentWindow().hide();
      } catch (e) {
        console.error(e);
      }
    }
    setInputValue("");
  };

  const defaultQuickActions: ParsedCommand[] = [
    { actionId: "launch_app",    title: "Open Spotify",            parameters: { appName: "Spotify" },          originalText: "open spotify" },
    { actionId: "close_app",     title: "Close Spotify",           parameters: { appName: "Spotify" },          originalText: "close spotify" },
    { actionId: "open_website",  title: "Open YouTube",            parameters: { url: "https://www.youtube.com" }, originalText: "open youtube" },
    { actionId: "close_app",     title: "Close YouTube",           parameters: { appName: "YouTube" },          originalText: "close youtube" },
    { actionId: "close_app",     title: "Close Photos / Images",   parameters: { appName: "Photos" },           originalText: "close photos" },
    { actionId: "close_all_apps",title: "Close All Applications",  parameters: {},                               originalText: "close all" },
    { actionId: "take_screenshot",title: "Take Screenshot",        parameters: {},                               originalText: "screenshot" },
    { actionId: "mute",          title: "Toggle Mute",             parameters: {},                               originalText: "mute" },
    { actionId: "lock_pc",       title: "Lock PC",                 parameters: {},                               originalText: "lock" },
    { actionId: "shutdown",      title: "Shutdown PC",             parameters: {},                               originalText: "shutdown" },
  ];

  const displayedCommands = inputValue.trim() ? suggestions : defaultQuickActions;

  const handleSelect = async (command: ParsedCommand) => {
    await hideCommandBar();
    try {
      await actionExecutor.execute(command.actionId, command.parameters);
    } catch (e) {
      console.error(e);
    }
  };

  // Arrow-key / Enter navigation — captured on the input element
  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    const count = displayedCommands.length;
    if (count === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % count);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + count) % count);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = displayedCommands[selectedIndex] ?? displayedCommands[0];
      if (target) await handleSelect(target);
    }
  };

  return (
    <div
      className="w-full h-full flex flex-col bg-black border border-white/10 rounded-2xl overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_24px_64px_rgba(0,0,0,0.8)] select-none"
    >
      {/* ── Search bar ─────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-white/8 shrink-0"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <Search className="w-4 h-4 text-white/30 shrink-0" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties} />
        <input
          ref={inputRef}
          autoFocus
          spellCheck={false}
          placeholder="Type a command…"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent border-none text-sm font-medium text-white placeholder:text-white/25 focus:outline-none focus:ring-0 caret-white"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        />
        {inputValue && (
          <button
            onMouseDown={(e) => { e.preventDefault(); setInputValue(""); }}
            className="text-[11px] px-2 py-0.5 rounded bg-white/8 hover:bg-white/15 text-white/40 hover:text-white/70 transition shrink-0 font-mono"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            esc
          </button>
        )}
      </div>

      {/* ── Section label ──────────────────────────────────── */}
      {!inputValue && (
        <div className="px-4 pt-3 pb-1">
          <span className="text-[10px] font-semibold tracking-widest uppercase text-white/20">
            Quick Actions
          </span>
        </div>
      )}

      {/* ── Command list ───────────────────────────────────── */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto p-2 space-y-0.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        {inputValue && suggestions.length === 0 && (
          <div className="py-10 text-center text-white/25 text-sm">
            No commands found for &ldquo;{inputValue}&rdquo;
          </div>
        )}

        {displayedCommands.map((command, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <div
              key={`${command.actionId}-${idx}`}
              ref={(el) => { itemRefs.current[idx] = el; }}
              onMouseEnter={() => setSelectedIndex(idx)}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(command); }}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-100",
                isSelected
                  ? "bg-white text-black"
                  : "text-white/70 hover:bg-white/6 hover:text-white"
              )}
            >
              {/* Icon */}
              <div
                className={cn(
                  "p-1.5 rounded-lg shrink-0 transition-colors",
                  isSelected ? "bg-black/10 text-black" : "bg-white/8 text-white/50"
                )}
              >
                {getIconForAction(command.actionId)}
              </div>

              {/* Label */}
              <span className="flex-1 text-sm font-medium truncate">
                {command.title}
              </span>

              {/* Hint */}
              <kbd
                className={cn(
                  "text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 transition-colors",
                  isSelected
                    ? "border-black/20 bg-black/10 text-black/60"
                    : "border-white/10 bg-white/4 text-white/25"
                )}
              >
                ↵
              </kbd>
            </div>
          );
        })}
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div className="px-4 py-2 border-t border-white/6 flex items-center gap-4 shrink-0">
        <span className="text-[10px] text-white/20 font-mono">↑↓ navigate</span>
        <span className="text-[10px] text-white/20 font-mono">↵ select</span>
        <span className="text-[10px] text-white/20 font-mono ml-auto">esc close</span>
      </div>
    </div>
  );
};

export default AgentCommandBar;
