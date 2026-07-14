# Changelog
## Vazorism

---

## [0.1.0] — 2026-07-09

### Phase 1: UI Refactor (Builder.io → Production-Ready)

#### Added
- **Icon system** (`src/components/icons/index.tsx`) — 8 typed SVG components: HomeIcon, StatsIcon, TasksIcon, LibraryIcon, MoreIcon, SearchIcon, NotificationIcon, HamburgerIcon
- **ErrorBoundary** (`src/components/common/ErrorBoundary.tsx`) — React error boundary preventing white-screen crashes
- **SectionHeading** (`src/components/common/SectionHeading.tsx`) — Reusable section header extracted from Index page
- **Sidebar tooltips** — Each nav icon now shows a label tooltip on hover (300ms delay)
- **Sidebar active indicator** — 3px accent-colored bar on the left edge of the active navigation item
- **GameTile animations** — Framer Motion hover (scale 1.04) and tap (scale 0.98) with spring physics
- **GameTile data props** — `title`, `coverImage`, `playtime`, `onClick` typed props with fallback placeholder
- **Custom scrollbar** — 6px width, muted color, rounded corners
- **Selection styling** — Primary color at 30% opacity
- **Meta tags** — Description, theme-color for Vazorism branding
- **Zustand** — Added as state management dependency
- **Strict TypeScript** — All 6 strict flags enabled

#### Changed
- **Project renamed** from `fusion-starter` to `vazorism`
- **Folder structure** — `client/` → `src/` with feature-based organization
- **Background image** — Moved from Builder.io CDN to local `public/images/background.webp`
- **Sonner toast** — Replaced `next-themes` dependency with hardcoded dark theme
- **Layout** — Wrapped in ErrorBoundary
- **Header** — Inline SVGs replaced with icon components, search input accessibility improved
- **Sidebar** — Inline SVGs replaced with icon components, added tooltips
- **GameTile** — Moved from `components/layout/` to `features/library/components/`
- **CSS** — Removed broken `.dark` theme, removed unused sidebar variables, added overscroll-behavior

#### Removed
- **Server infrastructure** — `server/` directory (Express, CORS, routes)
- **Deployment config** — Netlify, Docker, Builder.io config files
- **25 unused shadcn components** — accordion, alert-dialog, sidebar (shadcn), etc.
- **13 npm packages** — Three.js, Express, serverless-http, next-themes, input-otp, etc.
- **`.dark` CSS theme** — Was shadcn defaults that would break Vazorism's aesthetic
