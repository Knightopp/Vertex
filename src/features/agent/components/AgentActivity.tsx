import { useHistoryStore } from "@/stores/history-store";
import { useAgentStore } from "@/stores/agent-store";
import { usePresetStore } from "@/stores/preset-store";
import { Activity, CheckCircle2, XCircle, Clock, Disc3 } from "lucide-react";
import SectionHeading from "@/components/common/SectionHeading";

export default function AgentActivity() {
  const { entries } = useHistoryStore();
  const { activePreset, activeRecording, activeTrackingSession } = useAgentStore();
  const { getPreset } = usePresetStore();

  const recentActions = entries.slice(0, 5); // display only latest 5 for dashboard
  const preset = activePreset ? getPreset(activePreset) : null;

  return (
    <section className="flex flex-col gap-4">
      <SectionHeading title="Agent Activity" />
      
      <div className="flex flex-col gap-4 bg-[#111111] border border-white/5 rounded-3xl p-6 backdrop-blur-md">
        
        {/* Context Status Row */}
        <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-white/5">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-sm">
            <span className="w-2 h-2 rounded-full bg-white/30" />
            <span className="text-white/70 font-medium">Context:</span>
            {preset ? (
              <span className="text-white font-bold">{preset.name}</span>
            ) : (
              <span className="text-white/40 italic">Idle</span>
            )}
          </div>
          
          {activeRecording && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 font-medium">
              <Disc3 className="w-4 h-4 animate-spin-slow" />
              Recording Active
            </div>
          )}

          {activeTrackingSession && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-400 font-medium">
              <Activity className="w-4 h-4" />
              Tracking Session
            </div>
          )}
        </div>

        {/* History Stream */}
        <div className="flex flex-col gap-3 mt-2">
          {recentActions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-white/30">
              <Clock className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No recent activity.</p>
            </div>
          ) : (
            recentActions.map((action) => (
              <div key={action.id} className="flex items-start gap-3 p-3 rounded-xl bg-black/20 hover:bg-white/5 transition-colors group">
                <div className="mt-0.5">
                  {action.status === "success" ? (
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-white truncate">{action.actionId.replace(/_/g, ' ')}</h4>
                    <span className="text-[10px] text-white/30 whitespace-nowrap">
                      {new Date(action.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  {action.details && (
                    <p className="text-xs text-white/50 truncate mt-0.5 font-mono">{action.details}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
