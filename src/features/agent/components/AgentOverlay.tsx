import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { actionExecutor } from "@/services/agent/ActionExecutor";
import { usePresetStore, Preset } from "@/stores/preset-store";
import { useAuthStore } from "@/stores/auth-store";
import { Gamepad2, Cpu, Video, BookOpen, Settings } from "lucide-react";

const iconMap: Record<string, React.ReactNode> = {
  Gamepad2: <Gamepad2 className="w-5 h-5" />,
  Cpu: <Cpu className="w-5 h-5" />,
  Video: <Video className="w-5 h-5" />,
  BookOpen: <BookOpen className="w-5 h-5" />,
};

export const AgentOverlay: React.FC = () => {
  const { presets } = usePresetStore();
  const { profile, user } = useAuthStore();
  const [isVisible, setIsVisible] = React.useState(false);

  const userName = profile?.username || user?.user_metadata?.full_name || "Vazor";

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  useEffect(() => {
    // When the component mounts, we assume the window is shown, so trigger entrance
    setIsVisible(true);

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        await hideOverlay();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const hideOverlay = async () => {
    setIsVisible(false);
    // Give animation time to play before hiding window
    setTimeout(async () => {
      const win = getCurrentWindow();
      await win.hide();
    }, 200); // 200ms matches Framer exit duration
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
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-[500px] rounded-2xl border border-white/10 bg-[#09090B]/80 backdrop-blur-xl shadow-2xl p-6"
            style={{ WebkitAppRegion: "drag" } as any} // Allow dragging by the background
          >
            <div className="text-center mb-6">
              <h2 className="text-white/70 text-lg font-medium">{getGreeting()}, {userName}.</h2>
              <h1 className="text-white text-2xl font-semibold mt-1">What are we doing today?</h1>
            </div>

            <div className="grid grid-cols-2 gap-3" style={{ WebkitAppRegion: "no-drag" } as any}>
              {presets.map((preset: Preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetClick(preset.name)}
                  className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors text-left group"
                >
                  <div className="p-2 rounded-lg bg-white/10 text-white/70 group-hover:text-white transition-colors">
                    {iconMap[preset.icon] || <Settings className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-white font-medium text-sm">{preset.name}</h3>
                    <p className="text-white/50 text-xs truncate max-w-[150px]">{preset.description}</p>
                  </div>
                </button>
              ))}
            </div>
            
            <div className="mt-4 text-center">
              <p className="text-white/30 text-[10px]">Press Esc to dismiss</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AgentOverlay;
