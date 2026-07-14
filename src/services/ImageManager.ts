import { jobQueue } from "./JobQueue";
import { eventBus } from "./EventBus";

interface ImageDownloadPayload {
  entryId: string;
  type: "cover" | "hero" | "logo" | "screenshot";
  url: string;
}

export class ImageManager {
  init(): void {
    jobQueue.registerHandler<ImageDownloadPayload>({
      type: "image_download",
      maxConcurrent: 5,
      handler: async (job) => {
        await this.processImageDownload(job.payload);
      },
    });
  }

  private async processImageDownload(payload: ImageDownloadPayload): Promise<void> {
    const { entryId, type, url } = payload;

    try {
      // In a full production Tauri app with @tauri-apps/plugin-fs, we would:
      // 1. fetch(url) and get the ArrayBuffer
      // 2. generate a local path (e.g., %APPDATA%/vazorism/images/covers/{entryId}.jpg)
      // 3. write the binary data to the disk
      // 4. store the local path in the database
      
      // For Phase 6 (without the FS plugin), we will simulate this by storing
      // the remote URL directly in the `localPath` field as a fallback so the UI can render it.
      // We will mark it as "web://" to let the UI know it's not a local file.
      
      const localPath = `web://${url}`;

      // Library data is currently browser-local; callers retain the remote URL
      // on the entry and this event lets the UI refresh without bundling Prisma.
      eventBus.emit("images:downloaded", {
        entryId,
        imageType: type,
        localPath
      });

    } catch (error) {
      console.error(`[ImageManager] Failed to process image ${type} for ${entryId}:`, error);
      throw error;
    }
  }

  /**
   * Helper function for the UI to resolve the image path
   * e.g., converts "web://https://..." into "https://..."
   * or "asset://localhost/..." for Tauri local files
   */
  resolveImagePath(path: string | undefined): string | undefined {
    if (!path) return undefined;
    if (path.startsWith("web://")) {
      return path.substring(6);
    }
    // Return Tauri asset protocol for local files
    return path; 
  }
}

export const imageManager = new ImageManager();
