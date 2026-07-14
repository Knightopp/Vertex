export type EventMap = {
  // Process detection
  "game:detected": { entryId: string; processId: number; executablePath: string; isNew: boolean };
  "app:detected": { entryId: string; processId: number; executablePath: string; isNew: boolean };
  "process:terminated": { entryId: string; processId: number };

  // Session lifecycle
  "session:started": { sessionId: string; entryId: string; startedAt: Date };
  "session:ended": { sessionId: string; entryId: string; effectiveSeconds: number; idleSeconds: number };
  "session:idle:start": { sessionId: string; entryId: string };
  "session:idle:end": { sessionId: string; entryId: string; idleDurationMs: number };

  // Data updates
  "metadata:updated": { entryId: string; source: string };
  "library:updated": { entryId: string; action: "created" | "updated" | "deleted" };
  "collections:updated": { collectionId: string; action: "created" | "updated" | "deleted" };
  "images:downloaded": { entryId: string; imageType: string; localPath: string };

  // Discovery
  "trending:updated": { category: string; count: number };

  // Cache
  "cache:updated": { key: string; action: "set" | "invalidated" | "expired" };
  "cache:cleanup": { freedBytes: number; deletedCount: number };

  // Connectivity
  "internet:connected": Record<string, never>;
  "internet:disconnected": Record<string, never>;

  // Background jobs
  "job:started": { jobId: string; type: string };
  "job:completed": { jobId: string; type: string };
  "job:failed": { jobId: string; type: string; error: string };
};

export type EventHandler<T> = (payload: T) => void;
export type Unsubscribe = () => void;

class EventBus {
  private handlers = new Map<keyof EventMap, Set<EventHandler<any>>>();

  /**
   * Subscribe to an event
   * @param event The event name
   * @param handler The callback function
   * @returns A function to unsubscribe
   */
  on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): Unsubscribe {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    const handlerSet = this.handlers.get(event)!;
    handlerSet.add(handler as EventHandler<any>);

    return () => {
      handlerSet.delete(handler as EventHandler<any>);
      // Clean up empty sets to prevent memory leaks
      if (handlerSet.size === 0) {
        this.handlers.delete(event);
      }
    };
  }

  /**
   * Emit an event to all subscribers
   * @param event The event name
   * @param payload The strongly-typed payload for the event
   */
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const handlerSet = this.handlers.get(event);
    if (!handlerSet) return;

    // Use Array.from to prevent issues if handlers unsubscribe during iteration
    for (const handler of Array.from(handlerSet)) {
      try {
        handler(payload);
      } catch (error) {
        console.error(`[EventBus] Error in handler for "${event}":`, error);
      }
    }
  }

  /**
   * Remove all listeners for a specific event or all events
   * @param event Optional event name. If omitted, clears all listeners.
   */
  removeAllListeners(event?: keyof EventMap): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }
}

// Export a singleton instance to be used across the app
export const eventBus = new EventBus();
