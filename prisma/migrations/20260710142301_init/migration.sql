-- CreateTable
CREATE TABLE "library_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'game',
    "status" TEXT NOT NULL DEFAULT 'unplayed',
    "executablePath" TEXT,
    "executableName" TEXT,
    "rating" REAL,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "playtimeTotal" INTEGER NOT NULL DEFAULT 0,
    "lastPlayedAt" DATETIME,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "metadata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "description" TEXT,
    "developer" TEXT,
    "publisher" TEXT,
    "releaseDate" DATETIME,
    "platforms" TEXT,
    "igdbId" INTEGER,
    "rawgId" INTEGER,
    "steamAppId" INTEGER,
    "igdbRating" REAL,
    "rawgRating" REAL,
    "metacriticScore" INTEGER,
    "source" TEXT,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "metadata_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "library_entries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "effectiveSeconds" INTEGER NOT NULL DEFAULT 0,
    "idleSeconds" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "processId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "sessions_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "library_entries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "images" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "localPath" TEXT NOT NULL,
    "remoteUrl" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "sizeBytes" INTEGER,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "images_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "library_entries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "rating" REAL,
    "startedDate" DATETIME,
    "finishedDate" DATETIME,
    "playedOn" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "reviews_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "library_entries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "notes_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "library_entries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "entry_tags" (
    "entryId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("entryId", "tagId"),
    CONSTRAINT "entry_tags_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "library_entries" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "entry_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "genres" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "entry_genres" (
    "entryId" TEXT NOT NULL,
    "genreId" TEXT NOT NULL,

    PRIMARY KEY ("entryId", "genreId"),
    CONSTRAINT "entry_genres_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "library_entries" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "entry_genres_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "genres" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "collections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverImagePath" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "collection_entries" (
    "collectionId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("collectionId", "entryId"),
    CONSTRAINT "collection_entries_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "collection_entries_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "library_entries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "discovery_cache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "library_entries_title_idx" ON "library_entries"("title");

-- CreateIndex
CREATE INDEX "library_entries_type_idx" ON "library_entries"("type");

-- CreateIndex
CREATE INDEX "library_entries_status_idx" ON "library_entries"("status");

-- CreateIndex
CREATE INDEX "library_entries_lastPlayedAt_idx" ON "library_entries"("lastPlayedAt");

-- CreateIndex
CREATE INDEX "library_entries_playtimeTotal_idx" ON "library_entries"("playtimeTotal");

-- CreateIndex
CREATE INDEX "library_entries_executableName_idx" ON "library_entries"("executableName");

-- CreateIndex
CREATE UNIQUE INDEX "metadata_entryId_key" ON "metadata"("entryId");

-- CreateIndex
CREATE INDEX "metadata_igdbId_idx" ON "metadata"("igdbId");

-- CreateIndex
CREATE INDEX "metadata_rawgId_idx" ON "metadata"("rawgId");

-- CreateIndex
CREATE INDEX "metadata_steamAppId_idx" ON "metadata"("steamAppId");

-- CreateIndex
CREATE INDEX "sessions_entryId_idx" ON "sessions"("entryId");

-- CreateIndex
CREATE INDEX "sessions_startedAt_idx" ON "sessions"("startedAt");

-- CreateIndex
CREATE INDEX "sessions_isActive_idx" ON "sessions"("isActive");

-- CreateIndex
CREATE INDEX "images_entryId_idx" ON "images"("entryId");

-- CreateIndex
CREATE INDEX "images_type_idx" ON "images"("type");

-- CreateIndex
CREATE UNIQUE INDEX "images_entryId_type_isPrimary_key" ON "images"("entryId", "type", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_entryId_key" ON "reviews"("entryId");

-- CreateIndex
CREATE INDEX "notes_entryId_idx" ON "notes"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "genres_name_key" ON "genres"("name");

-- CreateIndex
CREATE UNIQUE INDEX "genres_slug_key" ON "genres"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "discovery_cache_category_key" ON "discovery_cache"("category");

-- CreateIndex
CREATE INDEX "discovery_cache_category_idx" ON "discovery_cache"("category");

-- CreateIndex
CREATE INDEX "discovery_cache_expiresAt_idx" ON "discovery_cache"("expiresAt");
