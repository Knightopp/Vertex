import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// https://vitejs.dev/config/
export default defineConfig({
  // Prevent Vite from obscuring Rust errors
  clearScreen: false,
  server: {
    host: "::",
    port: 8080,
    // Tauri expects a fixed port; fail if 8080 is taken
    strictPort: true,
    watch: {
      // Exclude Rust build artifacts from file watching.
      // Without this, Vite crashes with EBUSY on Windows when
      // cargo compiles .exe files in src-tauri/target/.
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    outDir: "dist",
    // Tauri uses Chromium on Windows via WebView2 and
    // doesn't require browser-compatible output
    target: "esnext",
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
