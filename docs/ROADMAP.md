# Implementation Roadmap
## Vazorism · Phased Development Plan

---

## Phase Overview

| Phase | Name | Status | Goal |
|:-----:|------|:------:|------|
| 0 | Project Audit | ✅ Done | Analyze Builder.io export |
| 1 | UI Refactor | ✅ Done | Clean, restructure, strict TS |
| 2 | Documentation | ✅ Done | SRS, Architecture, DB, APIs |
| 3 | Tauri + Database | 🔲 Next | Initialize Tauri, Prisma schema, SQLite |
| 4 | Core Services | 🔲 | EventBus, SettingsManager, CacheManager |
| 5 | Process Tracking | 🔲 | ProcessManager (Rust), SessionManager, idle detection |
| 6 | Library & Metadata | 🔲 | LibraryManager, MetadataManager, ImageManager, provider chain |
| 7 | Library UI | 🔲 | Library page, game detail page, search, filters |
| 8 | Statistics | 🔲 | StatisticsManager, stats page with charts |
| 9 | Discovery | 🔲 | DiscoveryManager, trending/new releases UI |
| 10 | Reviews & Collections | 🔲 | Reviews, notes, ratings, collections, tags |
| 11 | Settings & Polish | 🔲 | Settings page, system tray, auto-start, notifications |
| 12 | Performance & Testing | 🔲 | Virtualization, lazy loading, test coverage |

---

## Phase 3: Tauri + Database Setup

**Goal:** Establish the Tauri desktop shell and database layer.

- [ ] Initialize Tauri in the project (`pnpm tauri init`)
- [ ] Configure `tauri.conf.json` (window size, title, permissions)
- [ ] Create Prisma schema from DATABASE.md
- [ ] Run initial migration
- [ ] Verify app launches as a native window
- [ ] Create database utility functions (connection, migrations on startup)

**Deliverable:** App opens as a native Windows window with an empty SQLite database.

---

## Phase 4: Core Services

**Goal:** Build the foundational service infrastructure.

- [ ] Implement `EventBus` (typed pub/sub)
- [ ] Implement `SettingsManager` (read/write settings from DB)
- [ ] Implement `CacheManager` (TTL, invalidation, cleanup)
- [ ] Implement `JobQueue` (background task runner with concurrency limits)
- [ ] Create Zustand stores: `useSettingsStore`, `useUIStore`
- [ ] Set up TanStack Query defaults (staleTime, gcTime)

**Deliverable:** Service layer is functional. Settings page can read/write preferences.

---

## Phase 5: Process Tracking

**Goal:** Detect running processes and track playtime with idle detection.

- [ ] Write Rust commands: `get_running_processes`, `get_idle_duration`
- [ ] Implement `ProcessManager` (polling loop, new process detection, exclusion list)
- [ ] Implement `SessionManager` (start/end sessions, idle state machine)
- [ ] Implement idle detection flow (pause/resume timer)
- [ ] Persist sessions to SQLite with crash recovery
- [ ] System tray integration (minimize to tray, continue tracking)

**Deliverable:** Launch any .exe → Vazorism detects it, tracks time, handles idle → close .exe → session saved to DB.

---

## Phase 6: Library & Metadata

**Goal:** Auto-populate the library with metadata and images.

- [ ] Implement `MetadataProvider` interface
- [ ] Implement `IGDBProvider` (auth, search, fetch)
- [ ] Implement `RAWGProvider` (search, fetch)
- [ ] Implement `SteamProvider` (search, fetch)
- [ ] Implement `MetadataManager` (provider chain, fallback, merge)
- [ ] Implement `ImageManager` (download, cache, serve)
- [ ] Implement `LibraryManager` (CRUD, status, favorites)
- [ ] Wire up: process detected → metadata fetch → image download

**Deliverable:** New games are automatically added to the library with covers, descriptions, and genres.

---

## Phase 7: Library UI

**Goal:** Build the library browsing experience.

- [ ] Library page: grid view of all entries with covers
- [ ] Game detail page: metadata, sessions, images, review, notes
- [ ] Search functionality (global search bar in header)
- [ ] Sort: name, playtime, last played, date added, rating
- [ ] Filter: genre, tag, status, type (game/app)
- [ ] Virtualized grid for performance with 1000+ entries
- [ ] Loading skeletons for async content

**Deliverable:** Full library browsing experience comparable to Steam/Playnite.

---

## Phase 8: Statistics

**Goal:** Visualize playtime data.

- [ ] Implement `StatisticsManager` (aggregation queries)
- [ ] Stats page with daily/weekly/monthly/yearly breakdowns
- [ ] Charts: playtime bar chart, genre pie chart, session timeline
- [ ] Top played games ranking
- [ ] Activity heatmap (GitHub-style)
- [ ] Average session duration trends

**Deliverable:** Rich statistics dashboard with interactive charts.

---

## Phase 9: Discovery

**Goal:** Show trending, new, and upcoming content.

- [ ] Implement `DiscoveryManager` (fetch and cache discovery content)
- [ ] Home page: populate "Trending Now", "New Releases", "Top Genres" with real data
- [ ] Add "Upcoming" section
- [ ] Offline behavior: show cached content with timestamp
- [ ] Auto-refresh on connectivity return

**Deliverable:** Home page shows live discovery content, works offline with cached data.

---

## Phase 10: Reviews & Collections

**Goal:** Personal cataloging features.

- [ ] Review writing and editing UI
- [ ] Star/numeric rating system
- [ ] Personal notes (multiple per entry, pinnable)
- [ ] Collection creation and management
- [ ] Tag system (create, assign, filter by)
- [ ] Status management (playing, completed, backlog, dropped, wishlist)

**Deliverable:** Full Letterboxd/Backloggd-like personal cataloging.

---

## Phase 11: Settings & Polish

**Goal:** Configuration and premium feel.

- [ ] Settings page with all configurable options
- [ ] System tray with right-click menu
- [ ] Auto-start with Windows option
- [ ] Native notifications for session milestones
- [ ] Window state persistence (position, size)
- [ ] Keyboard shortcuts (Ctrl+K search, Esc close dialogs)
- [ ] Loading and empty state designs
- [ ] Error state designs

**Deliverable:** Fully polished desktop application.

---

## Phase 12: Performance & Testing

**Goal:** Production readiness.

- [ ] Virtualized lists/grids (react-virtual or similar)
- [ ] Lazy route loading (React.lazy + Suspense)
- [ ] Image loading optimization (blur placeholders, progressive)
- [ ] Unit tests for all services
- [ ] Integration tests for critical flows
- [ ] Build optimization (bundle analysis, tree-shaking audit)
- [ ] Memory profiling
- [ ] Startup time optimization

**Deliverable:** Production-quality performance and test coverage.
