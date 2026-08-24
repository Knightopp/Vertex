import { create } from "zustand";

export interface ActionHistoryItem {
  id: string;
  actionId: string;
  timestamp: number;
  status: "success" | "error" | "pending";
  target?: string;
  parameters?: Record<string, any>;
  error?: string;
}

export interface ConfirmationRequest {
  id: string;
  actionId: string;
  prompt: string;
  onConfirm: () => void;
  onCancel: () => void;
}

interface AgentState {
  isRunning: boolean;
  isCommandInterfaceOpen: boolean;
  activePreset: string | null;
  activeRecording: boolean;
  activeTrackingSession: string | null;
  recentActions: ActionHistoryItem[];
  pendingConfirmation: ConfirmationRequest | null;

  // Actions
  setRunning: (running: boolean) => void;
  setCommandInterfaceOpen: (open: boolean) => void;
  setActivePreset: (preset: string | null) => void;
  setActiveRecording: (recording: boolean) => void;
  setActiveTrackingSession: (session: string | null) => void;
  addActionToHistory: (action: Omit<ActionHistoryItem, "id" | "timestamp">) => void;
  updateActionInHistory: (id: string, update: Partial<ActionHistoryItem>) => void;
  requestConfirmation: (request: Omit<ConfirmationRequest, "id">) => void;
  clearConfirmation: () => void;
}

export const useAgentStore = create<AgentState>()((set) => ({
  isRunning: false,
  isCommandInterfaceOpen: false,
  activePreset: null,
  activeRecording: false,
  activeTrackingSession: null,
  recentActions: [],
  pendingConfirmation: null,

  setRunning: (isRunning) => set({ isRunning }),
  setCommandInterfaceOpen: (isCommandInterfaceOpen) => set({ isCommandInterfaceOpen }),
  setActivePreset: (activePreset) => set({ activePreset }),
  setActiveRecording: (activeRecording) => set({ activeRecording }),
  setActiveTrackingSession: (activeTrackingSession) => set({ activeTrackingSession }),
  
  addActionToHistory: (action) => set((state) => {
    const newItem: ActionHistoryItem = {
      ...action,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    return {
      recentActions: [newItem, ...state.recentActions].slice(0, 50), // Keep last 50
    };
  }),

  updateActionInHistory: (id, update) => set((state) => ({
    recentActions: state.recentActions.map((item) =>
      item.id === id ? { ...item, ...update } : item
    ),
  })),

  requestConfirmation: (request) => set({
    pendingConfirmation: {
      ...request,
      id: crypto.randomUUID(),
    }
  }),

  clearConfirmation: () => set({ pendingConfirmation: null }),
}));
