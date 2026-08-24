/**
 * Tauri IPC wrapper for Rust backend commands.
 * Provides typed, async functions for all Rust commands.
 *
 * These functions call into the Rust backend via Tauri's IPC bridge.
 * In development (browser mode), they fall back to mock implementations.
 */

// ─────────────────────────────────────────────
// Types matching Rust structs
// ─────────────────────────────────────────────

export interface ProcessInfo {
  pid: number;
  name: string;
  exePath: string | null;
  windowTitle: string;
  productName: string | null;
  fileDescription: string | null;
  companyName: string | null;
  hash: string | null;
}

export interface ActiveWindow {
  pid: number;
  isIdle: boolean;
}

// ─────────────────────────────────────────────
// IPC Helper
// ─────────────────────────────────────────────

/**
 * Check if we're running inside Tauri (native window) vs. a regular browser.
 * When developing with `pnpm dev` (no Tauri), window.__TAURI_INTERNALS__ is undefined.
 */
export function isTauriEnvironment(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Safely invoke a Tauri command. Returns the result or null if not in Tauri.
 */
async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!isTauriEnvironment()) {
    console.warn(`[IPC] Not in Tauri environment, skipping command: ${command}`);
    return null;
  }

  // Dynamic import to avoid bundling issues when not in Tauri
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

// ─────────────────────────────────────────────
// Process Commands
// ─────────────────────────────────────────────

/** Get all currently running processes on the system. */
export async function getRunningProcesses(): Promise<ProcessInfo[]> {
  const result = await invokeCommand<ProcessInfo[]>("get_running_processes");
  return result ?? [];
}

/** Check if a specific process is still running by PID. */
export async function getProcessByPid(pid: number): Promise<ProcessInfo | null> {
  return invokeCommand<ProcessInfo>("get_process_by_pid", { pid });
}

export async function getProcessIcon(exePath: string, hash: string): Promise<Uint8Array | null> {
  const bytes = await invokeCommand<number[]>("get_process_icon", { exePath, hash });
  return bytes ? new Uint8Array(bytes) : null;
}

export async function getActiveWindow(): Promise<ActiveWindow | null> {
  return invokeCommand<ActiveWindow>("get_active_window");
}

export async function focusWindow(pid: number): Promise<void> {
  await invokeCommand("focus_window", { pid });
}

export async function minimizeWindow(pid: number): Promise<void> {
  await invokeCommand("minimize_window", { pid });
}

export async function maximizeWindow(pid: number): Promise<void> {
  await invokeCommand("maximize_window", { pid });
}

export async function restoreWindow(pid: number): Promise<void> {
  await invokeCommand("restore_window", { pid });
}

export async function moveWindow(pid: number, x: number, y: number, width: number, height: number): Promise<void> {
  await invokeCommand("move_window", { pid, x, y, width, height });
}

export async function closeWindow(pid: number): Promise<void> {
  await invokeCommand("close_window", { pid });
}

export async function forceCloseProcess(pid: number): Promise<void> {
  await invokeCommand("force_close_process", { pid });
}

// ─────────────────────────────────────────────
// System Commands
// ─────────────────────────────────────────────

/** Get milliseconds since the user's last input (keyboard/mouse). */
export async function getIdleDurationMs(): Promise<number> {
  const result = await invokeCommand<number>("get_idle_duration_ms");
  return result ?? 0;
}

export async function lockPc(): Promise<void> {
  await invokeCommand("lock_pc");
}

export async function setVolume(level: number): Promise<void> {
  await invokeCommand("set_volume", { level });
}

export async function muteVolume(): Promise<void> {
  await invokeCommand("mute_volume");
}

export async function takeScreenshot(): Promise<string | null> {
  return invokeCommand<string>("take_screenshot");
}

export async function startRecording(): Promise<string | null> {
  return invokeCommand<string>("start_recording");
}

export async function stopRecording(): Promise<void> {
  await invokeCommand("stop_recording");
}
