import { getIdleDurationMs } from "../lib/tauri-ipc";
import { libraryManager, UsageSession } from "./LibraryManager";
import { eventBus, Unsubscribe } from "./EventBus";

const IDLE_THRESHOLD_MS = 300000;
type ActiveSession = UsageSession & { lastTickAt: number; timerId?: number; processCount: number };

export class SessionManager {
  private activeSessions = new Map<string, ActiveSession>(); // Keyed by entryId
  private processMap = new Map<number, string>(); // Maps processId -> entryId
  private unsubscribes: Unsubscribe[] = [];
  private initialized = false;

  init() {
    if (this.initialized) return;
    this.initialized = true;
    this.unsubscribes = [
      eventBus.on("game:detected", (payload) => this.start(payload.entryId, payload.processId)),
      eventBus.on("app:detected", (payload) => this.start(payload.entryId, payload.processId)),
      eventBus.on("process:terminated", (payload) => this.stop(payload.processId)),
    ];
  }

  private async start(entryId: string, processId: number) {
    if (this.processMap.has(processId)) return; // This exact process is already tracked
    
    this.processMap.set(processId, entryId);

    const existingSession = this.activeSessions.get(entryId);
    if (existingSession) {
      existingSession.processCount++;
      return;
    }

    const now = new Date();
    const session: ActiveSession = { 
      id: crypto.randomUUID(), 
      entryId, 
      processId, 
      startedAt: now.toISOString(), 
      durationSeconds: 0, 
      effectiveSeconds: 0, 
      idleSeconds: 0, 
      isActive: true, 
      lastTickAt: Date.now(),
      processCount: 1 
    };
    
    this.activeSessions.set(entryId, session);
    await libraryManager.addSession(entryId, session);
    session.timerId = window.setInterval(() => void this.tick(session), 1000);
    eventBus.emit("session:started", { sessionId: session.id, entryId, startedAt: now });
  }

  private async tick(session: ActiveSession) {
    const now = Date.now(); 
    const elapsed = Math.floor((now - session.lastTickAt) / 1000);
    if (elapsed <= 0) return;
    session.lastTickAt = now;
    
    const idle = await getIdleDurationMs();
    if (idle >= IDLE_THRESHOLD_MS) {
      session.idleSeconds += elapsed; 
    } else {
      session.effectiveSeconds += elapsed;
    }
  }

  private async stop(processId: number) {
    const entryId = this.processMap.get(processId);
    if (!entryId) return;
    
    this.processMap.delete(processId);
    const session = this.activeSessions.get(entryId); 
    if (!session) return;
    
    session.processCount--;
    if (session.processCount > 0) return; // Keep running if other processes exist

    if (session.timerId) window.clearInterval(session.timerId);
    this.activeSessions.delete(entryId);
    
    await this.tick(session);
    
    const endedAt = new Date();
    const finished: UsageSession = { 
      ...session, 
      endedAt: endedAt.toISOString(), 
      durationSeconds: Math.max(0, Math.floor((endedAt.getTime() - new Date(session.startedAt).getTime()) / 1000)), 
      isActive: false 
    };
    
    // Clean up internal properties before saving
    const { lastTickAt, timerId, processCount, ...sessionToSave } = finished as any;
    
    await libraryManager.finishSession(session.entryId, sessionToSave);
    eventBus.emit("session:ended", { 
      sessionId: sessionToSave.id, 
      entryId: sessionToSave.entryId, 
      effectiveSeconds: sessionToSave.effectiveSeconds, 
      idleSeconds: sessionToSave.idleSeconds 
    });
  }

  destroy() { 
    this.unsubscribes.forEach((unsubscribe) => unsubscribe()); 
    this.unsubscribes = []; 
    this.initialized = false; 
    
    for (const session of this.activeSessions.values()) {
      if (session.timerId) window.clearInterval(session.timerId);
    }
    this.activeSessions.clear();
    this.processMap.clear();
  }
}
export const sessionManager = new SessionManager();
