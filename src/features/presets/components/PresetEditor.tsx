import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Edit2, Play, Settings, ArrowRight } from "lucide-react";
import { usePresetStore, Preset, PresetAction } from "../../../stores/preset-store";
import { actionRegistry } from "../../../services/agent/ActionRegistry";
import { useAgentStore } from "../../../stores/agent-store";
import SectionHeading from "../../../components/common/SectionHeading";
import { cn } from "../../../lib/utils";

export default function PresetEditor() {
  const { isRunning } = useAgentStore(); // Force re-render when Agent initializes
  const { presets, addPreset, updatePreset, removePreset } = usePresetStore();
  const [selectedId, setSelectedId] = useState<string | null>(presets[0]?.id || null);

  const selectedPreset = presets.find(p => p.id === selectedId);

  const handleCreatePreset = () => {
    const newId = crypto.randomUUID();
    addPreset({
      id: newId,
      name: "New Workflow",
      description: "A custom workflow",
      icon: "Settings",
      actions: [],
      exitActions: [],
    });
    setSelectedId(newId);
  };

  const addAction = (type: "start" | "exit") => {
    if (!selectedPreset) return;
    const newAction: PresetAction = {
      id: crypto.randomUUID(),
      actionId: "launch_app",
      parameters: { appName: "" }
    };
    if (type === "start") {
      updatePreset(selectedPreset.id, { actions: [...selectedPreset.actions, newAction] });
    } else {
      updatePreset(selectedPreset.id, { exitActions: [...selectedPreset.exitActions, newAction] });
    }
  };

  const removeAction = (actionId: string, type: "start" | "exit") => {
    if (!selectedPreset) return;
    if (type === "start") {
      updatePreset(selectedPreset.id, { actions: selectedPreset.actions.filter(a => a.id !== actionId) });
    } else {
      updatePreset(selectedPreset.id, { exitActions: selectedPreset.exitActions.filter(a => a.id !== actionId) });
    }
  };

  const updateAction = (actionId: string, type: "start" | "exit", updates: Partial<PresetAction>) => {
    if (!selectedPreset) return;
    const list = type === "start" ? selectedPreset.actions : selectedPreset.exitActions;
    const updated = list.map(a => a.id === actionId ? { ...a, ...updates } : a);
    
    if (type === "start") {
      updatePreset(selectedPreset.id, { actions: updated });
    } else {
      updatePreset(selectedPreset.id, { exitActions: updated });
    }
  };

  const renderActionList = (actions: PresetAction[], type: "start" | "exit") => {
    const availableActions = actionRegistry.getAllActions().filter(a => a.id !== "start_preset" && a.id !== "stop_preset");

    return (
      <div className="flex flex-col gap-3">
        {actions.length === 0 && (
          <div className="text-white/40 text-sm italic py-2">No actions configured.</div>
        )}
        {actions.map((action, index) => {
          const actionDef = availableActions.find(a => a.id === action.actionId);
          return (
            <div key={action.id} className="p-4 rounded-xl bg-black/40 border border-white/5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-white/10 text-white/70 flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </span>
                  <select
                    className="bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none flex-1 max-w-[250px]"
                    value={action.actionId}
                    onChange={(e) => {
                      const newId = e.target.value;
                      const newDef = availableActions.find(a => a.id === newId);
                      // Reset parameters based on new def
                      const newParams: Record<string, any> = {};
                      newDef?.parameters.forEach(p => {
                        newParams[p.name] = p.type === 'number' ? 0 : '';
                      });
                      updateAction(action.id, type, { actionId: newId, parameters: newParams });
                    }}
                  >
                    {availableActions.length === 0 && (
                      <option disabled value="">No actions registered...</option>
                    )}
                    {availableActions.map(def => (
                      <option key={def.id} value={def.id} className="bg-[#111111] text-white">
                        {def.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => removeAction(action.id, type)}
                  className="text-white/30 hover:text-red-400 p-1 rounded-md transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Parameter Editor */}
              {actionDef && actionDef.parameters.length > 0 && (
                <div className="pl-9 flex flex-col gap-2">
                  {actionDef.parameters.map(param => (
                    <div key={param.name} className="flex items-center gap-3">
                      <span className="text-white/50 text-xs w-20">{param.name}</span>
                      <input
                        type={param.type === 'number' ? 'number' : 'text'}
                        value={action.parameters[param.name] ?? ''}
                        onChange={(e) => {
                          const val = param.type === 'number' ? Number(e.target.value) : e.target.value;
                          updateAction(action.id, type, {
                            parameters: { ...action.parameters, [param.name]: val }
                          });
                        }}
                        placeholder={`Enter ${param.name}...`}
                        className="flex-1 bg-black/40 border border-white/10 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/30"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Delay and Options */}
              <div className="pl-9 flex items-center gap-4 mt-2">
                <label className="flex items-center gap-2 text-xs text-white/50">
                  <span>Delay (ms):</span>
                  <input
                    type="number"
                    value={action.delayMs || 0}
                    onChange={(e) => updateAction(action.id, type, { delayMs: Number(e.target.value) })}
                    className="w-20 bg-black/40 border border-white/10 rounded-md px-2 py-1 focus:outline-none"
                  />
                </label>
                {action.actionId === 'launch_app' && (
                  <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!action.skipIfRunning}
                      onChange={(e) => updateAction(action.id, type, { skipIfRunning: e.target.checked })}
                      className="rounded border-white/20 bg-black/40"
                    />
                    Skip if running (bypass focus)
                  </label>
                )}
              </div>
            </div>
          );
        })}
        <button
          onClick={() => addAction(type)}
          className="self-start flex items-center gap-2 px-4 py-2 mt-2 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Action
        </button>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-[800px] gap-6"
    >
      {/* Left Pane - Preset List */}
      <div className="w-1/3 flex flex-col gap-4 border-r border-white/10 pr-6">
        <div className="flex items-center justify-between">
          <SectionHeading title="Workflows" />
          <button 
            onClick={handleCreatePreset}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex flex-col gap-2 overflow-y-auto hide-scrollbar">
          {presets.map(preset => (
            <button
              key={preset.id}
              onClick={() => setSelectedId(preset.id)}
              className={cn(
                "flex items-center gap-3 p-4 rounded-xl transition-all text-left",
                selectedId === preset.id 
                  ? "bg-white text-black" 
                  : "bg-black/20 text-white hover:bg-white/10"
              )}
            >
              <div className="flex-1 overflow-hidden">
                <h4 className="font-bold truncate">{preset.name}</h4>
                <p className={cn("text-xs truncate", selectedId === preset.id ? "text-black/60" : "text-white/50")}>
                  {preset.actions.length} actions
                </p>
              </div>
              {selectedId === preset.id && <ArrowRight className="w-5 h-5 opacity-50" />}
            </button>
          ))}
        </div>
      </div>

      {/* Right Pane - Preset Editor */}
      <div className="flex-1 flex flex-col overflow-y-auto hide-scrollbar">
        {selectedPreset ? (
          <div className="flex flex-col gap-8 pb-10">
            {/* Header Details */}
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-3 w-full max-w-md">
                <input
                  type="text"
                  value={selectedPreset.name}
                  onChange={(e) => updatePreset(selectedPreset.id, { name: e.target.value })}
                  className="bg-transparent border-b border-transparent hover:border-white/20 focus:border-white text-3xl font-bold text-white focus:outline-none transition-colors px-0 py-1"
                />
                <input
                  type="text"
                  value={selectedPreset.description}
                  onChange={(e) => updatePreset(selectedPreset.id, { description: e.target.value })}
                  placeholder="Workflow description..."
                  className="bg-transparent border-b border-transparent hover:border-white/20 focus:border-white text-white/50 focus:text-white focus:outline-none transition-colors px-0 py-1"
                />
              </div>
              <button
                onClick={() => {
                  if (window.confirm("Delete this workflow?")) {
                    removePreset(selectedPreset.id);
                    setSelectedId(null);
                  }
                }}
                className="p-3 text-red-400/70 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            {/* Start Workflow */}
            <section>
              <h3 className="flex items-center gap-2 font-bold text-lg text-white mb-4">
                <Play className="w-5 h-5 text-green-400" /> Start Workflow
              </h3>
              <p className="text-sm text-white/50 mb-4">These actions run sequentially when you activate the preset.</p>
              {renderActionList(selectedPreset.actions, "start")}
            </section>

            {/* Exit Workflow */}
            <section>
              <h3 className="flex items-center gap-2 font-bold text-lg text-white mb-4">
                <Settings className="w-5 h-5 text-purple-400" /> Stop Workflow
              </h3>
              <p className="text-sm text-white/50 mb-4">Optional actions to run when you deactivate the preset.</p>
              {renderActionList(selectedPreset.exitActions, "exit")}
            </section>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-white/30">
            <Settings className="w-16 h-16 mb-4 opacity-20" />
            <p>Select a workflow to edit</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
