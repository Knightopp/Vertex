# System Architecture
## Vazorism v0.1.0

---

## 1. Overview

Vazorism is built on a **Tauri 2.x** architecture: a Rust backend providing native OS access and a React/TypeScript frontend for the UI. Communication between layers happens through Tauri's IPC command system.

```
┌──────────────────────────────────────────────────────────┐
│                    Windows OS                             │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Processes    │  │ File System  │  │ User Input     │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬────────┘  │
│         │                │                   │           │
│  ┌──────┴────────────────┴───────────────────┴────────┐  │
│  │              Tauri Rust Backend                     │  │
│  │  ┌─────────────────────────────────────────────┐   │  │
│  │  │  Native Services (Rust)                     │   │  │
│  │  │  • ProcessMonitor   • IdleDetector          │   │  │
│  │  │  • FileSystemWatcher • WindowManager        │   │  │
│  │  │  • NativeNotifications                      │   │  │
│  │  └──────────────────────┬──────────────────────┘   │  │
│  │                         │ IPC Commands              │  │
│  │  ┌──────────────────────┴──────────────────────┐   │  │
│  │  │  Tauri Command Layer                        │   │  │
│  │  │  • process_* commands                       │   │  │
│  │  │  • idle_* commands                          │   │  │
│  │  │  • fs_* commands                            │   │  │
│  │  │  • window_* commands                        │   │  │
│  │  └──────────────────────┬──────────────────────┘   │  │
│  └─────────────────────────┼──────────────────────────┘  │
│                            │ IPC Bridge                   │
│  ┌─────────────────────────┼──────────────────────────┐  │
│  │         WebView2 (React/TypeScript Frontend)       │  │
│  │  ┌──────────────────────┴──────────────────────┐   │  │
│  │  │  TypeScript Service Layer                   │   │  │
│  │  │  • ProcessManager    • LibraryManager       │   │  │
│  │  │  • MetadataManager   • CacheManager         │   │  │
│  │  │  • ImageManager      • SessionManager       │   │  │
│  │  │  • StatisticsManager • SettingsManager      │   │  │
│  │  │  • DiscoveryManager  • NotificationManager  │   │  │
│  │  └──────────────────────┬──────────────────────┘   │  │
│  │                         │                          │   │
│  │  ┌──────────────────────┴──────────────────────┐   │  │
│  │  │  State Layer (Zustand + TanStack Query)     │   │  │
│  │  └──────────────────────┬──────────────────────┘   │  │
│  │                         │                          │   │
│  │  ┌──────────────────────┴──────────────────────┐   │  │
│  │  │  UI Layer (React Components)                │   │  │
│  │  │  • Layout Shell  • Feature Pages            │   │  │
│  │  │  • Common Components  • Icons               │   │  │
│  │  └─────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  SQLite Database (via Prisma)                      │  │
│  │  Location: %APPDATA%/vazorism/vazorism.db           │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Image Cache (File System)                         │  │
│  │  Location: %APPDATA%/vazorism/images/               │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Desktop Shell | Tauri | 2.x | Native window, IPC, OS APIs |
| Backend Language | Rust | stable | Process monitoring, idle detection, filesystem |
| Frontend Framework | React | 18.x | Component-based UI |
| Language | TypeScript | 5.x | Type safety |
| Styling | Tailwind CSS | 3.x | Utility-first CSS |
| Animation | Framer Motion | 12.x | UI animations |
| State (Client) | Zustand | 5.x | Global UI state |
| State (Async) | TanStack Query | 5.x | Server state & caching |
| Database | SQLite | 3.x | Local persistence |
| ORM | Prisma | 6.x | Schema management, type-safe queries |
| Build Tool | Vite | 8.x | Fast HMR, ES modules |

---

## 3. Rust ↔ TypeScript Boundary

### 3.1 Design Principle
> **Rust does what only Rust can do. TypeScript does everything else.**

| Responsibility | Layer | Reason |
|---------------|-------|--------|
| Process enumeration | Rust | Requires Windows API (`CreateToolhelp32Snapshot`) |
| Idle detection | Rust | Requires `GetLastInputInfo` Win32 API |
| File system watching | Rust | `notify` crate is more efficient than polling |
| Window management | Rust | Tauri window APIs |
| Native notifications | Rust | OS-level notification system |
| System tray | Rust | Tauri tray API |
| Database queries | TypeScript | Prisma client runs in the frontend process |
| Business logic | TypeScript | Metadata fetching, session management, statistics |
| API calls | TypeScript | HTTP requests via `fetch` |
| UI rendering | TypeScript | React components |
| State management | TypeScript | Zustand stores |
| Event coordination | TypeScript | Event bus connecting services |

### 3.2 IPC Command Design

```rust
// Rust side — src-tauri/src/commands/process.rs
#[tauri::command]
async fn get_running_processes() -> Result<Vec<ProcessInfo>, String> {
    // Windows API calls
}

#[tauri::command]
async fn get_idle_duration() -> Result<u64, String> {
    // Returns milliseconds since last input
}
```

```typescript
// TypeScript side — src/services/ProcessManager.ts
import { invoke } from "@tauri-apps/api/core";

interface ProcessInfo {
  pid: number;
  name: string;
  path: string;
}

export async function getRunningProcesses(): Promise<ProcessInfo[]> {
  return invoke<ProcessInfo[]>("get_running_processes");
}
```

---

## 4. Service Architecture

### 4.1 Service Overview

Each manager owns a single domain and communicates through the Event Bus.

```
┌────────────────────────────────────────────────────┐
│                   Event Bus                         │
│  GameDetected | SessionStarted | MetadataUpdated   │
│  AppDetected  | SessionEnded   | LibraryUpdated    │
│  TrendingUpdated | CacheUpdated | InternetStatus   │
└─────┬──────┬──────┬──────┬──────┬──────┬───────────┘
      │      │      │      │      │      │
┌─────┴┐ ┌───┴──┐ ┌─┴────┐ ┌┴─────┐ ┌───┴──┐ ┌──────┐
│Proc  │ │Lib   │ │Meta  │ │Sess  │ │Cache │ │Image │
│Mgr   │ │Mgr   │ │Mgr   │ │Mgr   │ │Mgr   │ │Mgr   │
└──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│Stats │ │Disc  │ │Sett  │ │Notif │
│Mgr   │ │Mgr   │ │Mgr   │ │Mgr   │
└──────┘ └──────┘ └──────┘ └──────┘
```

### 4.2 Service Definitions

| Service | Responsibility | Input Events | Output Events |
|---------|---------------|--------------|---------------|
| **ProcessManager** | Polls running processes, detects new/terminated executables | — (timer-driven) | `GameDetected`, `AppDetected`, `ProcessTerminated` |
| **LibraryManager** | CRUD for library entries, collections, tags, status | `GameDetected`, `AppDetected` | `LibraryUpdated` |
| **MetadataManager** | Fetches metadata from provider chain, updates entries | `GameDetected`, `AppDetected` | `MetadataUpdated` |
| **SessionManager** | Creates/closes tracking sessions, manages idle state | `GameDetected`, `ProcessTerminated` | `SessionStarted`, `SessionEnded` |
| **CacheManager** | Manages cache storage, TTL, invalidation | `MetadataUpdated`, `TrendingUpdated` | `CacheUpdated` |
| **ImageManager** | Downloads, caches, and serves images | `MetadataUpdated` | — |
| **StatisticsManager** | Computes aggregated stats from sessions | `SessionEnded` | — |
| **DiscoveryManager** | Fetches trending/new/upcoming content | — (timer-driven) | `TrendingUpdated` |
| **SettingsManager** | Reads/writes user preferences | — | — |
| **NotificationManager** | Shows toast/native notifications | Any event | — |

### 4.3 Service Lifecycle

```
App Start
  ├── SettingsManager.init()           → Load user preferences
  ├── CacheManager.init()              → Open cache database
  ├── LibraryManager.init()            → Load library from DB
  ├── ProcessManager.startPolling()    → Begin process detection loop
  ├── SessionManager.init()            → Recover any interrupted sessions
  ├── DiscoveryManager.init()          → Load cached discovery content
  └── StatisticsManager.init()         → Pre-compute statistics

App Running
  ├── ProcessManager polls every 3-5 seconds
  ├── Event Bus distributes events to subscribers
  ├── Background jobs run in Web Workers or setTimeout chains
  └── UI reacts to Zustand store changes

App Shutdown
  ├── SessionManager.closeAllSessions()  → Persist active sessions
  ├── CacheManager.flush()               → Write pending cache
  └── ProcessManager.stopPolling()       → Cleanup
```

---

## 5. Data Flow

### 5.1 Game Discovery Flow

```
Process Detected (Rust)
  │
  ▼
ProcessManager.onNewProcess()
  │
  ├── Check exclusion list → if excluded, ignore
  │
  ├── Check database → if exists, emit GameDetected(existing)
  │
  └── If new:
      ├── Create stub entry in LibraryManager
      ├── Emit GameDetected(new)
      │
      ▼
  MetadataManager.onGameDetected()
      ├── Try IGDB → success? → update entry, emit MetadataUpdated
      ├── Try RAWG → success? → update entry, emit MetadataUpdated
      ├── Try Steam → success? → update entry, emit MetadataUpdated
      ├── Try PCGamingWiki → success? → merge data
      └── Fallback: use executable metadata (name, icon)
      │
      ▼
  ImageManager.onMetadataUpdated()
      ├── Download cover art → save to cache
      ├── Download hero image → save to cache
      └── Download logo → save to cache
```

### 5.2 Session Tracking Flow

```
GameDetected (process is running)
  │
  ▼
SessionManager.startSession(gameId, processId)
  ├── Create session record (start_time = now)
  ├── Start idle detection polling
  ├── Emit SessionStarted
  │
  ▼
Idle Detection Loop (every 1 second)
  ├── Call Rust: get_idle_duration()
  ├── If idle > threshold:
  │   ├── Pause effective time counter
  │   └── Accumulate idle time
  ├── If activity returns after idle:
  │   └── Resume effective time counter
  │
  ▼
Process Terminates
  │
  ▼
SessionManager.endSession(processId)
  ├── Calculate effective_playtime = total_time - idle_time
  ├── Update session record (end_time = now)
  ├── Persist to database
  ├── Emit SessionEnded
  │
  ▼
StatisticsManager.onSessionEnded()
  └── Recalculate aggregated statistics
```

---

## 6. Frontend Architecture

### 6.1 Component Hierarchy

```
App
├── Providers (QueryClient, TooltipProvider, Toasters)
├── BrowserRouter
│   └── Routes
│       ├── / → Index (Home page)
│       ├── /apps → AppsPage
│       ├── /wishlist → WishlistPage
│       ├── /stats → StatsPage
│       ├── /tasks → TasksPage
│       ├── /library → LibraryPage
│       ├── /library/:id → GameDetailPage
│       ├── /settings → SettingsPage
│       └── * → NotFound
└── Layout (wraps all pages)
    ├── Sidebar (icon nav, tooltips, active indicator)
    ├── Header (nav tabs, search, profile)
    └── <main>{children}</main>
```

### 6.2 State Architecture

```
┌────────────────────────────────────────────────┐
│              Zustand Stores                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ library  │  │ session  │  │ settings │     │
│  │ Store    │  │ Store    │  │ Store    │     │
│  └──────────┘  └──────────┘  └──────────┘     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ ui       │  │ discovery│  │ search   │     │
│  │ Store    │  │ Store    │  │ Store    │     │
│  └──────────┘  └──────────┘  └──────────┘     │
└───────────────────┬────────────────────────────┘
                    │ Components subscribe
┌───────────────────┴────────────────────────────┐
│           TanStack Query Cache                  │
│  • Library entries (staleTime: Infinity)        │
│  • Metadata (staleTime: 24h)                    │
│  • Discovery (staleTime: 1h)                    │
│  • Statistics (staleTime: 5min)                 │
└────────────────────────────────────────────────┘
```

---

## 7. Background Job Architecture

### 7.1 Job Queue Design

Long-running work is dispatched to a job queue that processes tasks asynchronously:

```typescript
interface BackgroundJob {
  id: string;
  type: JobType;
  priority: "high" | "normal" | "low";
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  payload: unknown;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

type JobType =
  | "metadata_fetch"
  | "image_download"
  | "statistics_compute"
  | "cache_cleanup"
  | "discovery_refresh"
  | "search_index";
```

### 7.2 Concurrency Limits

| Job Type | Max Concurrent | Reason |
|----------|:-------------:|--------|
| `metadata_fetch` | 3 | API rate limits |
| `image_download` | 5 | Network bandwidth |
| `statistics_compute` | 1 | CPU-intensive |
| `cache_cleanup` | 1 | Disk I/O |
| `discovery_refresh` | 2 | API rate limits |
| `search_index` | 1 | CPU-intensive |

### 7.3 Cancellation

Jobs that are no longer needed (e.g., user navigated away) can be cancelled:

```typescript
const jobId = jobQueue.enqueue({ type: "metadata_fetch", payload: { gameId } });

// Later, if no longer needed:
jobQueue.cancel(jobId);
```

---

## 8. Folder Structure (Target)

```
vazorism/
├── src-tauri/                    # Tauri Rust backend
│   ├── src/
│   │   ├── main.rs               # Tauri entry point
│   │   ├── commands/             # IPC command handlers
│   │   │   ├── mod.rs
│   │   │   ├── process.rs        # get_running_processes, kill_process
│   │   │   ├── idle.rs           # get_idle_duration
│   │   │   └── window.rs         # window management commands
│   │   └── lib.rs
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── icons/                    # App icons
│
├── src/                          # React/TypeScript frontend
│   ├── app/
│   │   ├── App.tsx               # Root component + routing
│   │   └── providers.tsx         # Provider composition
│   │
│   ├── components/
│   │   ├── common/               # Shared components
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── SectionHeading.tsx
│   │   │   └── LoadingSkeleton.tsx
│   │   ├── icons/                # SVG icon components
│   │   │   └── index.tsx
│   │   ├── layout/               # Shell components
│   │   │   ├── Layout.tsx
│   │   │   ├── Header.tsx
│   │   │   └── Sidebar.tsx
│   │   └── ui/                   # shadcn/ui primitives
│   │
│   ├── features/                 # Feature modules
│   │   ├── library/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── store.ts
│   │   ├── tracking/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── store.ts
│   │   ├── stats/
│   │   │   ├── components/
│   │   │   └── hooks/
│   │   ├── discovery/
│   │   │   ├── components/
│   │   │   └── hooks/
│   │   └── settings/
│   │       ├── components/
│   │       └── store.ts
│   │
│   ├── services/                 # Service layer
│   │   ├── ProcessManager.ts
│   │   ├── LibraryManager.ts
│   │   ├── MetadataManager.ts
│   │   ├── SessionManager.ts
│   │   ├── CacheManager.ts
│   │   ├── ImageManager.ts
│   │   ├── StatisticsManager.ts
│   │   ├── DiscoveryManager.ts
│   │   ├── SettingsManager.ts
│   │   ├── NotificationManager.ts
│   │   ├── EventBus.ts
│   │   └── JobQueue.ts
│   │
│   ├── providers/                # Metadata API providers
│   │   ├── types.ts              # Provider interface
│   │   ├── IGDBProvider.ts
│   │   ├── RAWGProvider.ts
│   │   ├── SteamProvider.ts
│   │   └── PCGamingWikiProvider.ts
│   │
│   ├── hooks/                    # Global hooks
│   ├── stores/                   # Zustand stores
│   ├── types/                    # TypeScript type definitions
│   ├── lib/                      # Utilities
│   ├── styles/                   # Global CSS
│   └── pages/                    # Route pages
│
├── prisma/
│   └── schema.prisma             # Database schema
│
├── docs/                         # Project documentation
├── public/                       # Static assets
├── index.html
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── vite.config.ts
```
