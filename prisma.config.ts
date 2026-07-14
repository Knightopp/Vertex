import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7.x configuration.
 * The database URL is configured here instead of in schema.prisma.
 * Database file lives in the prisma/ directory during development.
 * In production (Tauri), the path will be set to %APPDATA%/vazorism/.
 */
export default defineConfig({
  earlyAccess: true,
  datasource: {
    url: "file:" + path.join(__dirname, "prisma", "vazorism.db"),
  },
});
