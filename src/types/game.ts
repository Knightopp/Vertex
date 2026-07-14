// ─────────────────────────────────────────────
// Vazorism Core Types
// Mirror of the Prisma schema for frontend usage
// ─────────────────────────────────────────────

/** Entry type discriminator */
export const EntryType = {
  Game: "game",
  Application: "application",
} as const;
export type EntryType = (typeof EntryType)[keyof typeof EntryType];

/** User-assigned status for a library entry */
export const EntryStatus = {
  Unplayed: "unplayed",
  Playing: "playing",
  Completed: "completed",
  Backlog: "backlog",
  Dropped: "dropped",
  Wishlist: "wishlist",
} as const;
export type EntryStatus = (typeof EntryStatus)[keyof typeof EntryStatus];

/** Image categories */
export const ImageType = {
  Cover: "cover",
  Hero: "hero",
  Logo: "logo",
  Screenshot: "screenshot",
  Icon: "icon",
} as const;
export type ImageType = (typeof ImageType)[keyof typeof ImageType];

/** Discovery content categories */
export const DiscoveryCategory = {
  Trending: "trending",
  NewReleases: "new_releases",
  Upcoming: "upcoming",
  TopRated: "top_rated",
  Deals: "deals",
} as const;
export type DiscoveryCategory = (typeof DiscoveryCategory)[keyof typeof DiscoveryCategory];

// ─────────────────────────────────────────────
// Entity interfaces
// ─────────────────────────────────────────────

export interface LibraryEntry {
  id: string;
  title: string;
  type: EntryType;
  status: EntryStatus;
  executablePath: string | null;
  executableName: string | null;
  rating: number | null;
  favorite: boolean;
  hidden: boolean;
  playtimeTotal: number;
  lastPlayedAt: string | null;
  addedAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface GameMetadata {
  id: string;
  entryId: string;
  description: string | null;
  developer: string | null;
  publisher: string | null;
  releaseDate: string | null;
  platforms: string[] | null;
  igdbId: number | null;
  rawgId: number | null;
  steamAppId: number | null;
  igdbRating: number | null;
  rawgRating: number | null;
  metacriticScore: number | null;
  source: string | null;
  fetchedAt: string;
}

export interface Session {
  id: string;
  entryId: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  effectiveSeconds: number;
  idleSeconds: number;
  isActive: boolean;
  processId: number | null;
}

export interface GameImage {
  id: string;
  entryId: string;
  type: ImageType;
  localPath: string;
  remoteUrl: string | null;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  isPrimary: boolean;
}

export interface Review {
  id: string;
  entryId: string;
  content: string;
  rating: number | null;
  startedDate: string | null;
  finishedDate: string | null;
  playedOn: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  entryId: string;
  content: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
}

export interface Genre {
  id: string;
  name: string;
  slug: string;
}

export interface Collection {
  id: string;
  name: string;
  description: string | null;
  coverImagePath: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────
// Composite types (with relations)
// ─────────────────────────────────────────────

/** Full library entry with all related data */
export interface LibraryEntryFull extends LibraryEntry {
  metadata: GameMetadata | null;
  sessions: Session[];
  images: GameImage[];
  review: Review | null;
  notes: Note[];
  tags: Tag[];
  genres: Genre[];
  collections: Collection[];
}

/** Summary view for library grid cards */
export interface LibraryEntrySummary {
  id: string;
  title: string;
  type: EntryType;
  status: EntryStatus;
  coverImagePath: string | null;
  playtimeTotal: number;
  lastPlayedAt: string | null;
  rating: number | null;
  favorite: boolean;
  genres: string[];
}
