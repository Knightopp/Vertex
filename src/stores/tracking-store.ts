import { create } from "zustand";
import { eventBus } from "../services/EventBus";

export interface ActiveUISession {
  sessionId: string;
  entryId: string;
  startedAt: Date;
  effectiveSeconds: number;
  isIdle: boolean;
}

interface TrackingState {
  activeSessions: Record<string, ActiveUISession>; // Keyed by entryId
  
  // Actions to be called by event listeners
  addSession: (session: ActiveUISession) => void;
  removeSession: (entryId: string) => void;
  updateSessionTime: (entryId: string, effectiveSeconds: number) => void;
  setSessionIdle: (entryId: string, isIdle: boolean) => void;
}

export const useTrackingStore = create<TrackingState>()((set) => {
  eventBus.on("session:started", ({ sessionId, entryId, startedAt }) => {
    set((state) => ({ activeSessions: { ...state.activeSessions, [entryId]: { sessionId, entryId, startedAt, effectiveSeconds: 0, isIdle: false } } }));
  });
  eventBus.on("session:ended", ({ entryId }) => set((state) => {
    const activeSessions = { ...state.activeSessions }; delete activeSessions[entryId]; return { activeSessions };
  }));
  // Subscribe to EventBus to keep Zustand state in sync
  
  eventBus.on("session:started", (payload) => {
    set((state) => ({
      activeSessions: {
        ...state.activeSessions,
        [payload.entryId]: {
          sessionId: payload.sessionId,
          entryId: payload.entryId,
          startedAt: payload.startedAt,
          effectiveSeconds: 0,
          isIdle: false,
        }
      }
    }));
  });

  eventBus.on("session:ended", (payload) => {
    set((state) => {
      const next = { ...state.activeSessions };
      delete next[payload.entryId];
      return { activeSessions: next };
    });
  });

  eventBus.on("session:idle:start", (payload) => {
    set((state) => {
      const session = state.activeSessions[payload.entryId];
      if (!session) return state;
      return {
        activeSessions: {
          ...state.activeSessions,
          [payload.entryId]: { ...session, isIdle: true }
        }
      };
    });
  });

  eventBus.on("session:idle:end", (payload) => {
    set((state) => {
      const session = state.activeSessions[payload.entryId];
      if (!session) return state;
      return {
        activeSessions: {
          ...state.activeSessions,
          [payload.entryId]: { ...session, isIdle: false }
        }
      };
    });
  });

  // We need a timer in the UI store to increment the active session time 
  // so the UI components re-render every second.
  // We can just set up a setInterval here.
  if (typeof window !== "undefined") {
    window.setInterval(() => {
      set((state) => {
        let changed = false;
        const nextSessions = { ...state.activeSessions };
        
        for (const [entryId, session] of Object.entries(nextSessions)) {
          nextSessions[entryId] = {
            ...session,
            effectiveSeconds: session.effectiveSeconds + 1
          };
          changed = true;
        }
        
        return changed ? { activeSessions: nextSessions } : state;
      });
    }, 1000);
  }

  return {
    activeSessions: {},
    
    addSession: (session) => set((state) => ({
      activeSessions: { ...state.activeSessions, [session.entryId]: session }
    })),
    
    removeSession: (entryId) => set((state) => {
      const next = { ...state.activeSessions };
      delete next[entryId];
      return { activeSessions: next };
    }),

    updateSessionTime: (entryId, effectiveSeconds) => set((state) => {
      const session = state.activeSessions[entryId];
      if (!session) return state;
      return {
        activeSessions: {
          ...state.activeSessions,
          [entryId]: { ...session, effectiveSeconds }
        }
      };
    }),

    setSessionIdle: (entryId, isIdle) => set((state) => {
      const session = state.activeSessions[entryId];
      if (!session) return state;
      return {
        activeSessions: {
          ...state.activeSessions,
          [entryId]: { ...session, isIdle }
        }
      };
    })
  };
});
