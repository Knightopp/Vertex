# Coding Standards
## Vazorism Engineering Guide

---

## 1. TypeScript

### 1.1 Strict Mode
All strict flags are enabled. No exceptions.

```json
{
  "strict": true,
  "strictNullChecks": true,
  "noImplicitAny": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noFallthroughCasesInSwitch": true
}
```

### 1.2 Type Annotations
- **Explicit return types** on all exported functions
- **Interface over type** for object shapes (extensible)
- **Avoid `any`** — use `unknown` + type guards when the type is genuinely unknown
- **Avoid `as` assertions** — prefer type narrowing
- **Use `satisfies`** for configuration objects

```typescript
// ✅ Good
export function getGame(id: string): Game | null { ... }

// ❌ Bad
export function getGame(id) { ... }
```

### 1.3 Enums
Prefer `as const` objects over TypeScript enums for tree-shaking:

```typescript
// ✅ Good
export const GameStatus = {
  Playing: "playing",
  Completed: "completed",
  Backlog: "backlog",
  Dropped: "dropped",
  Wishlist: "wishlist",
} as const;
export type GameStatus = (typeof GameStatus)[keyof typeof GameStatus];

// ❌ Bad
enum GameStatus { Playing, Completed, Backlog }
```

### 1.4 Nullability
- Use `| null` for intentional absence
- Use `| undefined` for optional properties
- Never use `!` non-null assertion except at the React root (`getElementById("root")!`)

---

## 2. React

### 2.1 Component Structure
```typescript
// 1. Imports (external → internal → types → styles)
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Game } from "@/types/game";

// 2. Types/Interfaces
interface GameCardProps {
  game: Game;
  onSelect: (id: string) => void;
}

// 3. Component
export default function GameCard({ game, onSelect }: GameCardProps) {
  // Hooks first
  const [isHovered, setIsHovered] = useState(false);

  // Handlers
  const handleClick = () => onSelect(game.id);

  // Render
  return ( ... );
}
```

### 2.2 Rules
- **One component per file** (except small helper components used only by the parent)
- **Named exports** for components used in multiple places
- **Default exports** for page-level components
- **Prefer function components** — no class components (except ErrorBoundary)
- **Avoid inline styles** — use Tailwind classes
- **Avoid prop drilling** — use Zustand stores or context for deeply shared state

### 2.3 Hooks
- Custom hooks go in `src/hooks/`
- Hook files start with `use-` prefix: `use-library.ts`
- Always specify dependency arrays explicitly
- Avoid `useEffect` for derived state — use `useMemo` instead

### 2.4 State Management
| Scope | Tool |
|-------|------|
| Local component state | `useState` / `useReducer` |
| Shared UI state | Zustand store |
| Server/async state | TanStack Query |
| Form state | `react-hook-form` |

---

## 3. File Organization

### 3.1 Naming Conventions
| Entity | Convention | Example |
|--------|-----------|---------|
| Components | PascalCase | `GameCard.tsx` |
| Hooks | camelCase with `use-` prefix | `use-library.ts` |
| Utilities | camelCase | `format-time.ts` |
| Types | PascalCase | `game.ts` (exports `Game`, `GameSession`) |
| Stores | camelCase with `-store` suffix | `library-store.ts` |
| Services | PascalCase with `Service` suffix | `MetadataService.ts` |
| Constants | SCREAMING_SNAKE_CASE | `export const MAX_IDLE_TIMEOUT = 30;` |

### 3.2 Import Order
1. React / external libraries
2. Internal aliases (`@/components/...`, `@/lib/...`)
3. Relative imports (`./`, `../`)
4. Type-only imports (`import type { ... }`)
5. Style imports

### 3.3 File Size Limits
- Components: < 200 lines (extract sub-components if larger)
- Services: < 300 lines (split into focused modules)
- Stores: < 150 lines
- Utilities: < 100 lines per file

---

## 4. Styling

### 4.1 Tailwind CSS
- Use design tokens (CSS variables) over hardcoded values
- Prefer semantic class names from the design system (`bg-card`, `text-muted-foreground`)
- Use `cn()` utility for conditional classes
- Responsive: design for desktop first, add `sm:` / `lg:` for edge cases

### 4.2 Animations
- Use Framer Motion for complex animations
- Use Tailwind `transition-*` utilities for simple hover/focus effects
- Target 60fps — avoid animating layout-triggering properties (width, height)
- Prefer `transform` and `opacity` animations

---

## 5. Error Handling

### 5.1 Service Layer
```typescript
// Return Result types instead of throwing
type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function fetchMetadata(id: string): Promise<Result<GameMetadata>> {
  try {
    const data = await provider.fetch(id);
    return { ok: true, data };
  } catch (e) {
    console.error("[MetadataService]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
```

### 5.2 Logging
- Use structured log prefixes: `[ServiceName]` or `[FeatureName]`
- Log levels: `console.error` for failures, `console.warn` for degradation, `console.info` for lifecycle events
- Never log sensitive data (API keys, file paths with user names)

---

## 6. Testing

### 6.1 Unit Tests
- Use Vitest
- Test file co-located: `utils.ts` → `utils.spec.ts`
- Test business logic, not UI rendering
- Mock external dependencies (Tauri IPC, APIs)

### 6.2 Naming
```typescript
describe("MetadataService", () => {
  it("should return cached metadata when available", () => { ... });
  it("should fall through to next provider on failure", () => { ... });
});
```

---

## 7. Git Conventions

### 7.1 Commit Messages
```
feat: add playtime tracking with idle detection
fix: prevent session loss on unexpected shutdown
refactor: extract icon system from inline SVGs
docs: add database schema documentation
chore: update dependencies
```

### 7.2 Branch Naming
```
feature/playtime-tracking
fix/session-persistence
refactor/service-layer
```
