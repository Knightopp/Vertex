# Cache Strategy
## Vazorism · Offline-First Caching Architecture

---

## 1. Cache Layers

Vazorism uses a multi-layer caching strategy to ensure the app feels instant and works fully offline.

```
┌─────────────────────────────────────────┐
│  Layer 1: In-Memory (Zustand + TanStack)│  ← Fastest, lost on restart
├─────────────────────────────────────────┤
│  Layer 2: SQLite Database (Prisma)      │  ← Persistent, structured
├─────────────────────────────────────────┤
│  Layer 3: File System (Image Cache)     │  ← Persistent, binary
├─────────────────────────────────────────┤
│  Layer 4: Network (API Providers)       │  ← Slowest, requires internet
└─────────────────────────────────────────┘
```

---

## 2. Cache Categories

### 2.1 Permanent Data (Never Expires)

This data is always persisted locally and is NEVER automatically deleted.

| Data | Storage | Reason |
|------|---------|--------|
| Library entries | SQLite | User's personal library |
| Sessions & playtime | SQLite | Historical tracking data |
| Reviews & notes | SQLite | User-authored content |
| Ratings | SQLite | User preferences |
| Collections & tags | SQLite | User organization |
| Settings | SQLite | User configuration |

### 2.2 Metadata Cache (Long TTL)

Metadata is fetched once and refreshed infrequently.

| Data | Storage | TTL | Refresh Policy |
|------|---------|-----|----------------|
| Game metadata | SQLite `metadata` table | 30 days | Background refresh when entry is viewed |
| Genre data | SQLite `genres` table | Never expires | Updated when metadata is fetched |
| Provider IDs (IGDB, RAWG, Steam) | SQLite `metadata` table | Never expires | Permanent mapping |

### 2.3 Image Cache (Persistent, Size-Limited)

| Image Type | Storage | TTL | Size Limit |
|------------|---------|-----|------------|
| Cover art | File system `images/covers/` | Never auto-expires | Part of global limit |
| Hero images | File system `images/heroes/` | Never auto-expires | Part of global limit |
| Logos | File system `images/logos/` | Never auto-expires | Part of global limit |
| Screenshots | File system `images/screenshots/` | 90 days | Part of global limit |
| **Global limit** | — | — | **10 GB** (configurable) |

### 2.4 Discovery Cache (Short TTL)

| Data | Storage | TTL | Behavior When Expired |
|------|---------|-----|-----------------------|
| Trending | SQLite `discovery_cache` | 1 hour | Show stale + refresh in background |
| New Releases | SQLite `discovery_cache` | 6 hours | Show stale + refresh in background |
| Upcoming | SQLite `discovery_cache` | 24 hours | Show stale + refresh in background |
| Top Rated | SQLite `discovery_cache` | 24 hours | Show stale + refresh in background |
| Deals | SQLite `discovery_cache` | 30 minutes | Show stale + refresh in background |

### 2.5 TanStack Query Cache (In-Memory)

| Query Key | staleTime | gcTime | Refetch Policy |
|-----------|-----------|--------|----------------|
| `["library"]` | `Infinity` | `Infinity` | Manual invalidation only |
| `["library", id]` | `Infinity` | 30 min | Manual invalidation |
| `["sessions", entryId]` | 5 min | 30 min | On window focus |
| `["statistics"]` | 5 min | 30 min | On window focus |
| `["discovery", category]` | Based on TTL | 1 hour | On mount + timer |

---

## 3. Cache Operations

### 3.1 Read Path (Stale-While-Revalidate)

```
User requests data
  │
  ▼
Check TanStack Query cache (memory)
  ├── Fresh? → Return immediately
  ├── Stale? → Return stale + trigger background refetch
  └── Miss? → Check SQLite
                ├── Hit? → Return + populate memory cache
                └── Miss? → Fetch from network
                              ├── Success? → Store in SQLite + memory
                              └── Failure? → Return error / empty state
```

### 3.2 Write Path

```
New data arrives (API response / user action)
  │
  ├── Write to SQLite (persistent)
  ├── Update TanStack Query cache (memory)
  ├── Emit event (EventBus)
  └── UI re-renders via Zustand/Query subscription
```

### 3.3 Image Load Path

```
Component requests image (entryId, type)
  │
  ▼
Check local file system
  ├── Exists? → Return local path (file://)
  │   └── If metadata.fetchedAt > 30 days:
  │       └── Background: check for newer version → download if found
  │
  └── Not found?
      ├── Return placeholder
      └── Enqueue image_download job
          └── On complete: update Image record → UI re-renders
```

---

## 4. Cache Invalidation

| Trigger | Action |
|---------|--------|
| User edits metadata manually | Invalidate `["library", id]` query |
| Metadata provider returns new data | Update SQLite + invalidate query |
| Session ends | Invalidate `["sessions", entryId]` and `["statistics"]` |
| Discovery TTL expires | Background refetch, update cache |
| User changes settings | Invalidate `["settings"]` |
| Image cache exceeds size limit | LRU eviction of screenshots first, then oldest covers |

---

## 5. Cache Cleanup

CacheManager runs periodic cleanup:

| Task | Frequency | Action |
|------|-----------|--------|
| Expire discovery cache | Every 15 minutes | Delete rows where `expiresAt < now()` |
| Image cache size check | Every hour | If total > limit, evict LRU screenshots |
| Remove orphaned images | Daily | Delete image files with no matching DB record |
| Compact SQLite | Weekly | Run `VACUUM` on the database |

---

## 6. Offline Behavior

| State | UI Behavior |
|-------|-------------|
| **Online** | Normal operation. Background refreshes active. |
| **Offline** | All cached data shown. Discovery sections show stale data with "Last updated X ago" badge. No error states. |
| **Back Online** | `internet:connected` event triggers: discovery refresh, retry failed metadata fetches, retry failed image downloads. |

### Connectivity Detection

```typescript
// Simple connectivity check — ping a reliable endpoint
async function checkConnectivity(): Promise<boolean> {
  try {
    const response = await fetch("https://clients3.google.com/generate_204", {
      method: "HEAD",
      mode: "no-cors",
      cache: "no-store",
    });
    return response.ok || response.type === "opaque";
  } catch {
    return false;
  }
}
```

Checked every 30 seconds when the app has focus, every 5 minutes when minimized.
