import { PrismaClient } from "@prisma/client";
import { eventBus } from "./EventBus";
import { jobQueue } from "./JobQueue";
import { MetadataProvider, GameMetadata } from "../providers/types";
import { steamProvider } from "../providers/SteamProvider";

const prisma = new PrismaClient();

export class MetadataManager {
  private providers: MetadataProvider[] = [];

  init(): void {
    // Register available providers (add IGDB and RAWG here later)
    this.providers = [steamProvider].sort((a, b) => a.priority - b.priority);

    // Register job handler
    jobQueue.registerHandler<{ entryId: string; title: string }>({
      type: "metadata_fetch",
      maxConcurrent: 3,
      handler: async (job) => {
        await this.processMetadataFetch(job.payload.entryId, job.payload.title);
      },
    });

    // Automatically queue fetch when a new game is detected
    eventBus.on("game:detected", (payload) => {
      if (payload.isNew) {
        this.fetchMetadata(payload.entryId, payload.executablePath); // Using path/name as fallback title for search
      }
    });
  }

  /**
   * Queue a metadata fetch job
   */
  fetchMetadata(entryId: string, title: string): string {
    return jobQueue.enqueue("metadata_fetch", { entryId, title });
  }

  private async processMetadataFetch(entryId: string, queryTitle: string): Promise<void> {
    let combinedMetadata: Partial<GameMetadata> = {};
    let matchedProvider = "";

    // Fallback extraction (e.g., parsing "EldenRing.exe" -> "Elden Ring")
    const cleanTitle = queryTitle.split("\\").pop()?.replace(".exe", "") || queryTitle;

    // Try providers in priority order
    for (const provider of this.providers) {
      const isAvailable = await provider.isAvailable();
      if (!isAvailable) continue;

      try {
        const searchResults = await provider.search(cleanTitle);
        // Take the highest confidence match
        const bestMatch = searchResults.sort((a, b) => b.confidence - a.confidence)[0];

        if (bestMatch && bestMatch.confidence > 0.5) {
          const data = await provider.getMetadata(bestMatch.providerId);
          if (data) {
            // Merge metadata (assuming higher priority provider overwrites lower)
            // But we break early to prioritize speed unless we want to combine
            // For now, first successful fetch wins
            combinedMetadata = data;
            matchedProvider = provider.name;
            break;
          }
        }
      } catch (error) {
        console.warn(`[MetadataManager] Provider ${provider.name} failed:`, error);
      }
    }

    if (Object.keys(combinedMetadata).length === 0) {
      console.log(`[MetadataManager] No metadata found for ${cleanTitle}`);
      return;
    }

    // Persist to database
    try {
      await prisma.metadata.upsert({
        where: { entryId },
        update: {
          description: combinedMetadata.description,
          developer: combinedMetadata.developer,
          publisher: combinedMetadata.publisher,
          releaseDate: combinedMetadata.releaseDate ? new Date(combinedMetadata.releaseDate) : undefined,
          platforms: JSON.stringify(combinedMetadata.platforms || []),
          steamAppId: combinedMetadata.providerIds?.steam,
          source: matchedProvider,
          fetchedAt: new Date(),
        },
        create: {
          entryId,
          description: combinedMetadata.description,
          developer: combinedMetadata.developer,
          publisher: combinedMetadata.publisher,
          releaseDate: combinedMetadata.releaseDate ? new Date(combinedMetadata.releaseDate) : undefined,
          platforms: JSON.stringify(combinedMetadata.platforms || []),
          steamAppId: combinedMetadata.providerIds?.steam,
          source: matchedProvider,
        },
      });

      // Also update genres
      if (combinedMetadata.genres && combinedMetadata.genres.length > 0) {
        for (const genreName of combinedMetadata.genres) {
          const genre = await prisma.genre.upsert({
            where: { name: genreName },
            update: {},
            create: { name: genreName, slug: genreName.toLowerCase().replace(/[^a-z0-9]+/g, "-") },
          });

          await prisma.entryGenre.upsert({
            where: { entryId_genreId: { entryId, genreId: genre.id } },
            update: {},
            create: { entryId, genreId: genre.id },
          });
        }
      }

      // Update the main library entry with the properly formatted title if it was a generic exe name
      await prisma.libraryEntry.update({
        where: { id: entryId },
        data: { title: combinedMetadata.title },
      });

      // Emit event
      eventBus.emit("metadata:updated", { entryId, source: matchedProvider });

      // The ImageManager will listen to this event and queue image downloads
      // We pass the URLs through a separate event or store since ImageManager needs them
      // Alternatively, we could just fire "images:queued"
      if (combinedMetadata.coverUrl) {
        jobQueue.enqueue("image_download", {
          entryId,
          type: "cover",
          url: combinedMetadata.coverUrl
        });
      }
      if (combinedMetadata.heroUrl) {
        jobQueue.enqueue("image_download", {
          entryId,
          type: "hero",
          url: combinedMetadata.heroUrl
        });
      }

    } catch (error) {
      console.error(`[MetadataManager] Failed to save metadata for ${entryId}:`, error);
      throw error;
    }
  }
}

export const metadataManager = new MetadataManager();
