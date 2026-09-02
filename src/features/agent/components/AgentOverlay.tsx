import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { actionExecutor } from "@/services/agent/ActionExecutor";
import { usePresetStore, Preset } from "@/stores/preset-store";
import { useAuthStore } from "@/stores/auth-store";
import { Gamepad2, Cpu, Video, BookOpen, Settings, Zap, Play, CheckSquare, Square, X, RotateCcw, LayoutDashboard } from "lucide-react";
import { sessionSnapshotManager, SessionSnapshot } from "@/services/SessionSnapshotManager";
import { toast } from "sonner";

const iconMap: Record<string, React.ReactNode> = {
  Gamepad2: <Gamepad2 className="w-4 h-4" />,
  Cpu:      <Cpu      className="w-4 h-4" />,
  Video:    <Video    className="w-4 h-4" />,
  BookOpen: <BookOpen className="w-4 h-4" />,
};

export const AgentOverlay: React.FC = () => {
  const { presets } = usePresetStore();
  const { profile, user } = useAuthStore();
  const [isVisible, setIsVisible] = useState(false);
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);
  const [isResuming, setIsResuming] = useState(false);

  const userName = profile?.username || user?.user_metadata?.full_name || "Player";

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  useEffect(() => {
    try {
      getCurrentWindow().center().catch(() => {});
    } catch (_) {}
    setIsVisible(true);
    const last = sessionSnapshotManager.getLastSessionSnapshot();
    if (last && last.apps.length > 0) {
      setSnapshot(last);
      // Pre-select all apps from last session
      setSelectedAppIds(last.apps.map(a => a.id));
    }

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

  const openDashboard = async () => {
    try {
      const { getAllWebviewWindows } = await import("@tauri-apps/api/webviewWindow");
      const windows = await getAllWebviewWindows();
      const mainWin = windows.find(w => w.label === "main");
      if (mainWin) {
        await mainWin.show();
        await mainWin.unminimize();
        await mainWin.setFocus();
      }
    } catch (_) {}
    await hideOverlay();
  };

  const handleToggleApp = (id: string) => {
    setSelectedAppIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleResumeSession = async () => {
    if (selectedAppIds.length === 0) {
      toast.error("Please select at least one app to resume");
      return;
    }
    setIsResuming(true);
    try {
      const count = await sessionSnapshotManager.resumeSession(selectedAppIds);
      toast.success(`Resumed ${count} application(s)`);
      await hideOverlay();
    } catch (e: any) {
      toast.error(`Failed to resume: ${e.toString()}`);
    } finally {
      setIsResuming(false);
    }
  };

  const handleDismissSession = () => {
    sessionSnapshotManager.clearSnapshot();
    setSnapshot(null);
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
            className="w-full max-w-[480px] rounded-2xl border border-white/10 bg-[#0c0c0e] shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_32px_80px_rgba(0,0,0,0.95)] overflow-hidden"
            style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-white/5 flex items-start justify-between">
              <div>
                <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-1">
                  Vertex Welcome
                </p>
                <h1 className="text-white text-2xl font-bold leading-snug tracking-tight">
                  {getGreeting()}, {userName}.
                </h1>
                <p className="text-white/40 text-sm mt-0.5">
                  {snapshot ? "Pick up where you left off?" : "What are we doing today?"}
                </p>
              </div>

              <div className="flex items-center gap-1.5" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
                <button
                  onClick={openDashboard}
                  title="Open Full Dashboard"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Open App</span>
                </button>
                <button
                  onClick={hideOverlay}
                  title="Dismiss (Esc)"
                  className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Smart Session Resume Card */}
            {snapshot && (
              <div 
                className="p-5 bg-gradient-to-b from-white/5 to-transparent border-b border-white/5"
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-white" />
                    <span className="text-sm font-bold text-white">Previous Session</span>
                    <span className="text-xs text-white/40">({snapshot.dateFormatted})</span>
                  </div>
                  <button
                    onClick={handleDismissSession}
                    className="text-xs text-white/40 hover:text-white transition-colors"
                  >
                    Start Fresh
                  </button>
                </div>

                <div className="flex flex-col gap-2 mb-4">
                  {snapshot.apps.map(app => {
                    const isChecked = selectedAppIds.includes(app.id);
                    return (
                      <div
                        key={app.id}
                        onClick={() => handleToggleApp(app.id)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isChecked 
                            ? "bg-white/10 border-white/20 text-white" 
                            : "bg-black/30 border-white/5 text-white/40 hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-white shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-white/30 shrink-0" />
                          )}
                          
                          {app.coverUrl && (
                            <img src={app.coverUrl} alt="" className="w-6 h-8 object-cover rounded-md border border-white/10 shrink-0" />
                          )}

                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate leading-tight">
                              {app.title}
                            </p>
                            <span className="text-[10px] text-white/40 uppercase tracking-wider">
                              {app.category}
                            </span>
                          </div>
                        </div>

                        {app.type === "game" ? (
                          <Gamepad2 className="w-4 h-4 text-white/40 shrink-0 ml-2" />
                        ) : (
                          <Cpu className="w-4 h-4 text-white/40 shrink-0 ml-2" />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleResumeSession}
                    disabled={isResuming || selectedAppIds.length === 0}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-white text-black font-bold text-sm rounded-xl hover:bg-white/90 disabled:opacity-50 transition-all shadow-lg shadow-white/10"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    {isResuming ? "Resuming..." : `Resume Selected (${selectedAppIds.length})`}
                  </button>
                  <button
                    onClick={handleDismissSession}
                    className="py-2.5 px-4 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Presets Title if snapshot present */}

            {/* Presets grid */}

            {/* Empty state (only if no snapshot) */}
            {!snapshot && (
              <div
                className="px-6 py-8 flex flex-col items-center gap-2 text-center"
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              >
                <Zap className="w-6 h-6 text-white/20" />
                <p className="text-sm text-white/40">No active session.</p>
                <p className="text-xs text-white/20">Open the dashboard to get started.</p>
              </div>
            )}

            {/* Footer */}
            <div className="px-6 py-3 border-t border-white/5 flex items-center justify-between bg-black/40">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-white/30">Press Esc to dismiss</span>
                <span className="text-white/10">•</span>
                <button 
                  onClick={openDashboard} 
                  className="text-[10px] font-mono text-white/40 hover:text-white underline underline-offset-2 transition-colors"
                  style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                >
                  Open Dashboard
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
                <span className="text-[10px] font-mono text-white/40 font-medium">Ready</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AgentOverlay;
