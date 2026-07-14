# Event System
## Vazorism · Internal Event Bus Design

---

## 1. Overview

The Event Bus is the central nervous system of Vazorism. Services communicate by publishing and subscribing to typed events rather than directly calling each other. This keeps services decoupled and testable.

### Design Principles
- **Strongly typed** — Every event has a defined payload type
- **Synchronous dispatch** — Events are dispatched synchronously on the main thread; handlers can spawn async work
- **No circular dependencies** — Services subscribe to events, never import each other
- **Unsubscription** — All subscriptions return a cleanup function

---

## 2. Implementation

```typescript
// src/services/EventBus.ts

type EventMap = {
  // Process detection
  "game:detected":       { entryId: string; processId: number; executablePath: string; isNew: boolean };
  "app:detected":        { entryId: string; processId: number; executablePath: string; isNew: boolean };
  "process:terminated":  { entryId: string; processId: number };

  // Session lifecycle
  "session:started":     { sessionId: string; entryId: string; startedAt: Date };
  "session:ended":       { sessionId: string; entryId: string; effectiveSeconds: number; idleSeconds: number };
  "session:idle:start":  { sessionId: string; entryId: string };
  "session:idle:end":    { sessionId: string; entryId: string; idleDurationMs: number };

  // Data updates
  "metadata:updated":    { entryId: string; source: string };
  "library:updated":     { entryId: string; action: "created" | "updated" | "deleted" };
  "images:downloaded":   { entryId: string; imageType: string; localPath: string };

  // Discovery
  "trending:updated":    { category: string; count: number };

  // Cache
  "cache:updated":       { key: string; action: "set" | "invalidated" | "expired" };
  "cache:cleanup":       { freedBytes: number; deletedCount: number };

  // Connectivity
  "internet:connected":    {};
  "internet:disconnected": {};

  // Background jobs
  "job:started":         { jobId: string; type: string };
  "job:completed":       { jobId: string; type: string };
  "job:failed":          { jobId: string; type: string; error: string };
};

type EventHandler<T> = (payload: T) => void;
type Unsubscribe = () => void;

class EventBus {
  private handlers = new Map<string, Set<EventHandler<unknown>>>();

  on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): Unsubscribe {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    const handlerSet = this.handlers.get(event)!;
    handlerSet.add(handler as EventHandler<unknown>);

    return () => {
      handlerSet.delete(handler as EventHandler<unknown>);
    };
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const handlerSet = this.handlers.get(event);
    if (!handlerSet) return;

    for (const handler of handlerSet) {
      try {
        handler(payload);
      } catch (error) {
        console.error(`[EventBus] Error in handler for "${event}":`, error);
      }
    }
  }

  removeAllListeners(event?: keyof EventMap): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }
}

// Singleton instance
export const eventBus = new EventBus();
```

---

## 3. Event Flow Diagrams

### 3.1 New Game Discovery

```
Rust ProcessMonitor
  │ (detects new executable)
  ▼
ProcessManager
  ├── Checks database: not found → creates stub
  ├── emit("game:detected", { isNew: true })
  │
  ├──▶ LibraryManager.onGameDetected()
  │       └── Persists LibraryEntry to DB
  │       └── emit("library:updated", { action: "created" })
  │
  ├──▶ MetadataManager.onGameDetected()
  │       └── Enqueues metadata_fetch job
  │       └── (async) Provider chain runs
  │       └── emit("metadata:updated", { source: "igdb" })
  │
  ├──▶ SessionManager.onGameDetected()
  │       └── Creates new Session record
  │       └── emit("session:started")
  │
  └──▶ NotificationManager.onGameDetected()
          └── Shows toast: "New game detected: {title}"
```

### 3.2 Process Termination

```
Rust ProcessMonitor
  │ (detects process exit)
  ▼
ProcessManager
  ├── emit("process:terminated", { processId })
  │
  ├──▶ SessionManager.onProcessTerminated()
  │       └── Closes active session
  │       └── Calculates effective/idle time
  │       └── emit("session:ended")
  │
  └──▶ StatisticsManager.onSessionEnded()
          └── Recalculates lifetime/daily/weekly stats
```

### 3.3 Internet Connectivity Change

```
ConnectivityChecker (periodic ping)
  │
  ├── (was offline, now online)
  │   └── emit("internet:connected")
  │       ├──▶ DiscoveryManager.refresh()
  │       ├──▶ MetadataManager.retryFailedFetches()
  │       └──▶ ImageManager.retryFailedDownloads()
  │
  └── (was online, now offline)
      └── emit("internet:disconnected")
          └──▶ UI shows offline indicator
```

---

## 4. Subscription Registration

Services register their subscriptions during initialization:

```typescript
// Example: MetadataManager subscribing to events
class MetadataManager {
  private unsubscribes: Unsubscribe[] = [];

  init(): void {
    this.unsubscribes.push(
      eventBus.on("game:detected", (payload) => this.onGameDetected(payload)),
      eventBus.on("app:detected", (payload) => this.onAppDetected(payload)),
      eventBus.on("internet:connected", () => this.retryFailedFetches()),
    );
  }

  destroy(): void {
    this.unsubscribes.forEach((unsub) => unsub());
    this.unsubscribes = [];
  }

  private async onGameDetected(payload: EventMap["game:detected"]): Promise<void> {
    if (!payload.isNew) return;
    // Fetch metadata...
  }
}
```

---

## 5. React Integration

Zustand stores subscribe to events and update state, which triggers React re-renders:

```typescript
// src/stores/library-store.ts
import { eventBus } from "@/services/EventBus";

export const useLibraryStore = create<LibraryState>()((set) => {
  // Subscribe to events
  eventBus.on("library:updated", ({ entryId, action }) => {
    // Refetch or update the store
  });

  return {
    entries: [],
    // ... state and actions
  };
});
```
