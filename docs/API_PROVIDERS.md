# API Providers
## Vazorism · Metadata Provider Chain Design

---

## 1. Provider Interface

All metadata providers implement a common interface. This makes them interchangeable and allows new providers to be added without changing application logic.

```typescript
// src/providers/types.ts

export interface GameSearchResult {
  providerId: string;          // Provider-specific ID
  providerName: string;        // "igdb" | "rawg" | "steam" | "pcgamingwiki"
  title: string;
  releaseDate?: string;
  confidence: number;          // 0-1 match confidence
}

export interface GameMetadata {
  title: string;
  description?: string;
  developer?: string;
  publisher?: string;
  releaseDate?: string;
  genres: string[];
  platforms: string[];
  rating?: number;
  metacriticScore?: number;
  coverUrl?: string;
  heroUrl?: string;
  logoUrl?: string;
  screenshotUrls: string[];
  providerIds: {
    igdb?: number;
    rawg?: number;
    steam?: number;
  };
}

export interface MetadataProvider {
  name: string;
  priority: number;           // Lower = higher priority

  /** Search for a game by name */
  search(query: string): Promise<GameSearchResult[]>;

  /** Fetch full metadata by provider-specific ID */
  getMetadata(providerId: string): Promise<GameMetadata | null>;

  /** Check if this provider is available (has valid credentials, reachable) */
  isAvailable(): Promise<boolean>;
}
```

---

## 2. Provider Chain

The MetadataManager tries providers in priority order. If one fails, it falls through to the next.

```
Query: "Elden Ring"
  │
  ▼
1. IGDB (priority: 1)
   ├── Available? → Search → Found with confidence 0.95
   ├── Fetch full metadata → Success ✅
   └── Return metadata (source: "igdb")
   │
   └── Failed? (rate limit, network error, no result)
       │
       ▼
2. RAWG (priority: 2)
   ├── Search → Found → Fetch metadata
   └── Return metadata (source: "rawg")
   │
   └── Failed?
       │
       ▼
3. Steam Store (priority: 3)
   ├── Search by name → Found app ID → Fetch store page data
   └── Return metadata (source: "steam")
   │
   └── Failed?
       │
       ▼
4. PCGamingWiki (priority: 4)
   ├── Search → Found → Scrape article for technical details
   └── Return partial metadata (source: "pcgamingwiki")
   │
   └── Failed?
       │
       ▼
5. Executable Metadata (priority: 5)
   ├── Read file version info from .exe
   ├── Extract: ProductName, CompanyName, FileDescription
   └── Return minimal metadata (source: "executable")
```

---

## 3. Provider Details

### 3.1 IGDB (via Twitch)

| Attribute | Value |
|-----------|-------|
| API Endpoint | `https://api.igdb.com/v4/` |
| Auth | OAuth2 Client Credentials (Twitch Developer) |
| Rate Limit | 4 requests/second |
| Data Quality | ★★★★★ Best for games |
| Covers | Yes (cover, screenshot, artwork) |
| Limitations | Games only (no general applications) |

**Auth Flow:**
```
POST https://id.twitch.tv/oauth2/token
  ?client_id={TWITCH_CLIENT_ID}
  &client_secret={TWITCH_CLIENT_SECRET}
  &grant_type=client_credentials

→ { access_token: "...", expires_in: 5000000 }
```

**Search Request:**
```
POST https://api.igdb.com/v4/games
Headers: Client-ID, Authorization: Bearer {token}
Body: search "Elden Ring"; fields name,summary,cover.*,genres.*,...; limit 5;
```

### 3.2 RAWG

| Attribute | Value |
|-----------|-------|
| API Endpoint | `https://api.rawg.io/api/` |
| Auth | API Key (query parameter) |
| Rate Limit | 20 requests/second |
| Data Quality | ★★★★ Good for games |
| Covers | Yes (background_image) |
| Limitations | Games only, some data behind paywall |

**Search Request:**
```
GET https://api.rawg.io/api/games?key={API_KEY}&search=Elden+Ring&page_size=5
```

### 3.3 Steam Store

| Attribute | Value |
|-----------|-------|
| API Endpoint | `https://store.steampowered.com/api/` |
| Auth | None (public) |
| Rate Limit | ~10 requests/minute (unofficial, will throttle) |
| Data Quality | ★★★ Good for Steam games |
| Covers | Yes (header_image, capsule_image) |
| Limitations | Only Steam games, no third-party metadata |

**Search Request:**
```
GET https://store.steampowered.com/api/storesearch/?term=Elden+Ring&l=english&cc=US
```

**Details Request:**
```
GET https://store.steampowered.com/api/appdetails?appids=1245620
```

### 3.4 PCGamingWiki

| Attribute | Value |
|-----------|-------|
| API Endpoint | `https://www.pcgamingwiki.com/w/api.php` |
| Auth | None (public MediaWiki API) |
| Rate Limit | Respectful usage (no official limit) |
| Data Quality | ★★★ Excellent for technical details |
| Covers | Limited |
| Limitations | Primarily technical (settings, ports, fixes). Not all games covered. |

**Usage:** Supplementary data source. Used to enrich metadata from primary providers with:
- System requirements
- Known issues / fixes
- Port quality information
- Availability across stores

---

## 4. Rate Limiting

Each provider has its own rate limiter:

```typescript
class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number; // tokens per second
  private lastRefill: number;

  constructor(maxTokens: number, refillRate: number) {
    this.tokens = maxTokens;
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens <= 0) {
      const waitMs = (1 / this.refillRate) * 1000;
      await new Promise((r) => setTimeout(r, waitMs));
      this.refill();
    }
    this.tokens--;
  }
}
```

| Provider | Max Tokens | Refill Rate |
|----------|:----------:|:-----------:|
| IGDB | 4 | 4/sec |
| RAWG | 20 | 20/sec |
| Steam | 10 | 10/min |
| PCGamingWiki | 5 | 5/sec |

---

## 5. Credential Storage

API credentials are stored in Tauri's secure configuration, NOT in frontend code.

```json
// src-tauri/tauri.conf.json (or secure storage)
{
  "apiKeys": {
    "twitch_client_id": "...",
    "twitch_client_secret": "...",
    "rawg_api_key": "..."
  }
}
```

Access via Tauri IPC:
```typescript
const clientId = await invoke<string>("get_api_key", { provider: "twitch_client_id" });
```

---

## 6. Metadata Merging

When multiple providers return data for the same game, MetadataManager merges them with priority:

```
Field Resolution Priority:
  title        → IGDB > RAWG > Steam > executable
  description  → IGDB > RAWG > Steam
  genres       → IGDB > RAWG (union of both)
  developer    → IGDB > RAWG > Steam
  publisher    → IGDB > RAWG > Steam
  releaseDate  → IGDB > RAWG > Steam
  rating       → IGDB rating stored separately from RAWG rating
  coverUrl     → IGDB > Steam > RAWG
  heroUrl      → Steam > RAWG > IGDB
  screenshots  → IGDB + RAWG + Steam (all combined)
```

---

## 7. Adding a New Provider

To add a new metadata provider:

1. Create `src/providers/NewProvider.ts` implementing `MetadataProvider`
2. Register it in the provider chain with a priority number
3. Add rate limiter configuration
4. Add credential storage if needed
5. No changes needed to MetadataManager or any other service
