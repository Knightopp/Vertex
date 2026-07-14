# Software Requirements Specification
## Vazorism v0.1.0

---

## 1. Product Overview

### 1.1 Purpose
Vazorism is a personal, offline-first desktop application for Windows that automatically discovers, tracks, and catalogs games and applications. It combines the library management of Steam/Playnite, the activity tracking of ActivityWatch, and the review/logging experience of Backloggd/Letterboxd into a single unified interface.

### 1.2 Scope
- **Single user** — no authentication, no cloud accounts, no multiplayer
- **Local-only** — all data stored on the user's machine via SQLite
- **Windows-only** — leverages Windows APIs for process detection and idle monitoring
- **Offline-first** — full functionality without internet after initial metadata fetch

### 1.3 Target Platform
| Attribute | Value |
|-----------|-------|
| OS | Windows 10/11 (64-bit) |
| Runtime | Tauri 2.x (Rust backend + WebView2 frontend) |
| Min RAM | 4 GB |
| Min Disk | 500 MB (excluding image cache) |
| Display | 1280×720 minimum |

---

## 2. Functional Requirements

### 2.1 Auto Discovery (FR-DISC)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-DISC-01 | The system SHALL automatically detect when a new executable process starts on the host machine. | P0 |
| FR-DISC-02 | The system SHALL check the detected executable against the local database. | P0 |
| FR-DISC-03 | If the executable is NOT in the database, the system SHALL create a new library entry and begin metadata fetching. | P0 |
| FR-DISC-04 | If the executable IS in the database, the system SHALL start a new tracking session. | P0 |
| FR-DISC-05 | The system SHALL allow the user to exclude specific executables or directories from detection. | P1 |
| FR-DISC-06 | The system SHALL distinguish between games and general desktop applications. | P1 |
| FR-DISC-07 | The system SHALL detect installed games from known launcher directories (Steam, Epic, GOG). | P2 |

### 2.2 Playtime Tracking (FR-TRACK)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-TRACK-01 | The system SHALL track elapsed time while a monitored process is running. | P0 |
| FR-TRACK-02 | The system SHALL implement idle detection with a configurable timeout (default: 5 minutes). | P0 |
| FR-TRACK-03 | The system SHALL pause the timer when the user is idle. | P0 |
| FR-TRACK-04 | The system SHALL resume the timer automatically when user input returns. | P0 |
| FR-TRACK-05 | Each session SHALL record: start time, end time, effective playtime, idle time. | P0 |
| FR-TRACK-06 | The system SHALL calculate: average session length, longest session, daily/weekly/monthly/lifetime totals. | P0 |
| FR-TRACK-07 | The system SHALL persist session data immediately (crash-resilient). | P0 |

### 2.3 Metadata Management (FR-META)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-META-01 | The system SHALL fetch metadata using a provider chain: IGDB → RAWG → Steam Store → PCGamingWiki → Executable Metadata. | P0 |
| FR-META-02 | Metadata SHALL include: title, description, genres, developer, publisher, release date, platforms, rating. | P0 |
| FR-META-03 | The system SHALL download and cache cover art, hero images, logos, and screenshots. | P0 |
| FR-META-04 | The system SHALL allow manual metadata editing and override. | P1 |
| FR-META-05 | The system SHALL silently refresh metadata in the background when newer versions are available. | P1 |
| FR-META-06 | Provider failures SHALL NOT block the user interface. | P0 |
| FR-META-07 | Providers SHALL be interchangeable without modifying application logic. | P0 |

### 2.4 Library Management (FR-LIB)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-LIB-01 | The system SHALL display all tracked games and applications in a browsable library. | P0 |
| FR-LIB-02 | The system SHALL support sorting by: name, playtime, last played, date added, rating. | P0 |
| FR-LIB-03 | The system SHALL support filtering by: genre, tag, collection, status, platform. | P0 |
| FR-LIB-04 | The system SHALL support user-created collections (playlists). | P1 |
| FR-LIB-05 | The system SHALL support tagging entries with custom tags. | P1 |
| FR-LIB-06 | The system SHALL support marking entries as: Playing, Completed, Backlog, Dropped, Wishlist. | P1 |
| FR-LIB-07 | The system SHALL support search across all library entries with fuzzy matching. | P0 |

### 2.5 Reviews & Notes (FR-REV)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-REV-01 | The system SHALL allow the user to write a personal review for any library entry. | P1 |
| FR-REV-02 | The system SHALL allow the user to rate entries on a configurable scale (default: 1-10). | P1 |
| FR-REV-03 | The system SHALL allow the user to write private notes for any library entry. | P1 |
| FR-REV-04 | Reviews and notes SHALL be stored permanently in the local database. | P0 |

### 2.6 Statistics (FR-STAT)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-STAT-01 | The system SHALL display playtime statistics with daily, weekly, monthly, and yearly breakdowns. | P0 |
| FR-STAT-02 | The system SHALL visualize statistics using charts (bar, line, pie). | P1 |
| FR-STAT-03 | The system SHALL show top played games, genre distribution, and session patterns. | P1 |
| FR-STAT-04 | The system SHALL calculate streaks and activity heatmaps. | P2 |

### 2.7 Discovery (FR-DISC-ONLINE)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-DISC-ONLINE-01 | The system SHALL display Trending, New Releases, Upcoming, and Top Rated sections. | P1 |
| FR-DISC-ONLINE-02 | Discovery content SHALL be cached locally with timestamps. | P1 |
| FR-DISC-ONLINE-03 | When offline, the system SHALL display the last cached version. | P0 |
| FR-DISC-ONLINE-04 | When internet returns, the system SHALL refresh automatically. | P1 |
| FR-DISC-ONLINE-05 | The system SHALL support a Deals section aggregating game deals. | P2 |

### 2.8 Settings (FR-SET)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-SET-01 | The system SHALL provide a settings page for all configurable options. | P0 |
| FR-SET-02 | Configurable options SHALL include: idle timeout, excluded paths, metadata providers, image quality, cache limits. | P0 |
| FR-SET-03 | Settings SHALL be persisted in the local database. | P0 |
| FR-SET-04 | The system SHALL support import/export of settings. | P2 |

---

## 3. Non-Functional Requirements

### 3.1 Performance (NFR-PERF)

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-PERF-01 | Application cold start | < 2 seconds to interactive UI |
| NFR-PERF-02 | Library page render (1000 entries) | < 500ms |
| NFR-PERF-03 | Search response time | < 100ms |
| NFR-PERF-04 | Process detection latency | < 3 seconds from launch |
| NFR-PERF-05 | Memory usage (idle) | < 150 MB |
| NFR-PERF-06 | Memory usage (active tracking) | < 250 MB |
| NFR-PERF-07 | Background CPU usage | < 2% when idle |

### 3.2 Reliability (NFR-REL)

| ID | Requirement |
|----|-------------|
| NFR-REL-01 | Session data SHALL survive application crashes (write-ahead logging). |
| NFR-REL-02 | Database corruption SHALL be recoverable via automatic backup/restore. |
| NFR-REL-03 | Network failures SHALL NOT cause application errors or data loss. |

### 3.3 Usability (NFR-USE)

| ID | Requirement |
|----|-------------|
| NFR-USE-01 | The UI SHALL be keyboard-navigable. |
| NFR-USE-02 | All interactive elements SHALL have focus indicators. |
| NFR-USE-03 | Loading states SHALL be shown for all async operations. |
| NFR-USE-04 | The application SHALL minimize to system tray and continue tracking. |

### 3.4 Security (NFR-SEC)

| ID | Requirement |
|----|-------------|
| NFR-SEC-01 | API keys SHALL be stored in Tauri's secure configuration, not in frontend code. |
| NFR-SEC-02 | The application SHALL NOT transmit personal usage data to any server. |
| NFR-SEC-03 | Database files SHALL be stored in the user's AppData directory. |

---

## 4. Data Requirements

### 4.1 Permanent Data (always local)
- Game/Application entries with metadata
- Playtime sessions and statistics
- User reviews, ratings, and notes
- Collections and tags
- Cover art, hero images, logos (image cache)
- User settings and preferences

### 4.2 Cached Data (refreshable)
- Trending games
- New releases
- Upcoming releases
- Top rated lists
- Game deals

### 4.3 Data Volume Estimates
| Entity | Expected Volume |
|--------|----------------|
| Library entries | 100-2,000 |
| Sessions | 10,000-100,000 |
| Images | 5,000-20,000 files (2-10 GB) |
| Database size | 50-200 MB |

---

## 5. External Interface Requirements

### 5.1 API Providers
| Provider | Data | Auth |
|----------|------|------|
| IGDB (via Twitch) | Metadata, images, ratings | Client ID + Secret |
| RAWG | Metadata, screenshots | API Key |
| Steam Store | Metadata, pricing, reviews | None (public) |
| PCGamingWiki | Technical details, fixes | None (public) |

### 5.2 Windows APIs
| API | Purpose |
|-----|---------|
| Windows Process API | Process enumeration and monitoring |
| `GetLastInputInfo` | Idle detection |
| Shell notifications | System tray integration |
| File system watcher | Launcher directory scanning |

---

## 6. Constraints

| Constraint | Impact |
|------------|--------|
| Single-user only | No auth system, no user management |
| No cloud sync | All data local, no server infrastructure |
| Windows only | Can use Windows-specific APIs freely |
| Offline-first | Every feature must work without internet after initial setup |
| Local images | All images cached locally, no CDN dependency at runtime |
