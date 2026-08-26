import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { actionExecutor } from "@/services/agent/ActionExecutor";
import { usePresetStore, Preset } from "@/stores/preset-store";
import { useAuthStore } from "@/stores/auth-store";
import { Gamepad2, Cpu, Video, BookOpen, Settings, Zap } from "lucide-react";

const iconMap: Record<string, React.ReactNode> = {
  Gamepad2: <Gamepad2 className="w-4 h-4" />,
  Cpu:      <Cpu      className="w-4 h-4" />,
  Video:    <Video    className="w-4 h-4" />,
  BookOpen: <BookOpen className="w-4 h-4" />,
};

export const AgentOverlay: React.FC = () => {
  const { presets } = usePresetStore();
  const { profile, user } = useAuthStore();
  const [isVisible, setIsVisible] = React.useState(false);

  const userName = profile?.username || user?.user_metadata?.full_name || "there";

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  useEffect(() => {
    setIsVisible(true);

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "Escape") await hideOverlay();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const hideOverlay = async () => {
    setIsVisible(false);
    setTimeout(async () => {
      try {
        await getCurrentWindow().hide();
      } catch (_) {}
    }, 180);
  };

  const handlePresetClick = async (presetName: string) => {
    await actionExecutor.execute("start_preset", { presetName });
    await hideOverlay();
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-transparent select-none p-4">
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-full max-w-[440px] rounded-2xl border border-white/10 bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_32px_80px_rgba(0,0,0,0.9)] overflow-hidden"
            style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-white/6">
              <p className="text-white/35 text-xs font-medium uppercase tracking-widest mb-1">
                Vertex Agent
              </p>
              <h1 className="text-white text-xl font-semibold leading-snug">
                {getGreeting()}, {userName}.
              </h1>
              <p className="text-white/30 text-sm mt-0.5">What are we doing today?</p>
            </div>

            {/* Presets grid */}
            {presets.length > 0 && (
              <div
                className="p-4 grid grid-cols-2 gap-2"
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              >
                {presets.map((preset: Preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetClick(preset.name)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-white/8 bg-white/3 hover:bg-white hover:text-black hover:border-white transition-all duration-150 text-left group"
                  >
                    <div className="p-1.5 rounded-lg bg-white/8 text-white/50 group-hover:bg-black/10 group-hover:text-black transition-colors shrink-0">
                      {iconMap[preset.icon] ?? <Settings className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white group-hover:text-black text-sm font-semibold truncate transition-colors">
                        {preset.name}
                      </p>
                      {preset.description && (
                        <p className="text-white/35 group-hover:text-black/50 text-xs truncate transition-colors">
                          {preset.description}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Empty state */}
            {presets.length === 0 && (
              <div
                className="px-6 py-8 flex flex-col items-center gap-2 text-center"
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              >
                <Zap className="w-6 h-6 text-white/20" />
                <p className="text-sm text-white/30">No presets configured yet.</p>
                <p className="text-xs text-white/20">Go to Settings → Agent to create one.</p>
              </div>
            )}

            {/* Footer */}
            <div className="px-6 py-3 border-t border-white/6 flex items-center justify-between">
              <span className="text-[10px] font-mono text-white/20">Press Esc to dismiss</span>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse" />
                <span className="text-[10px] font-mono text-white/20">Active</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AgentOverlay;
