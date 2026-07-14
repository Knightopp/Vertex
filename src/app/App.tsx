import "@/styles/global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "@/pages/Index";
import Stats from "@/pages/Stats";
import Discovery from "@/pages/Discovery";
import Apps from "@/pages/Apps";
import Collections from "@/pages/Collections";
import Settings from "@/pages/Settings";
import Wishlist from "@/pages/Wishlist";
import NotFound from "@/pages/NotFound";
import OAuthRedirect from "@/pages/OAuthRedirect";
import { UpdateManager } from "@/components/layout/UpdateManager";
import { WhatsNewModal } from "@/components/layout/WhatsNewModal";
import { useSettingsStore } from "@/stores/settings-store";
import { processManager } from "@/services/ProcessManager";
import { sessionManager } from "@/services/SessionManager";
import { syncManager } from "@/services/SyncManager";
import { libraryManager } from "@/services/LibraryManager";

import React, { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import Auth from "@/pages/Auth";

const queryClient = new QueryClient();

// Run a one-time migration to fix sync bugs and deduplicate library
try {
  const library = JSON.parse(localStorage.getItem("vazorism_library") || "[]");
  let modified = false;
  
  const steamIdsSeen = new Map<string, any>();
  const exePathsSeen = new Map<string, any>();
  const deduplicatedLibrary: any[] = [];

  library.forEach((entry: any) => {
    // 1. Fix incorrect application type from cloud sync
    if (entry.type === "application" && (entry.provider === "steam" || (!entry.executablePath && entry.playtimeTotal > 0))) {
      entry.type = "game";
      modified = true;
    }

    // 2. Deduplicate Steam Games
    let steamId = null;
    if (entry.metadata?.steamAppId) steamId = entry.metadata.steamAppId.toString();
    else if (entry.provider === "steam" && entry.providerGameId) steamId = entry.providerGameId.toString();

    // 3. Deduplicate Local Apps/Games
    let exePath = entry.executablePath ? entry.executablePath.toLowerCase() : null;

    let isDuplicate = false;
    let existingEntry = null;

    if (steamId && steamIdsSeen.has(steamId)) {
      isDuplicate = true;
      existingEntry = steamIdsSeen.get(steamId);
    } else if (exePath && exePathsSeen.has(exePath)) {
      isDuplicate = true;
      existingEntry = exePathsSeen.get(exePath);
    }

    if (isDuplicate && existingEntry) {
      modified = true;
      // Merge playtimes and sessions into the existing entry, keep the one that was kept
      existingEntry.playtimeTotal = Math.max(existingEntry.playtimeTotal || 0, entry.playtimeTotal || 0);
      if (entry.sessions && entry.sessions.length > 0) {
        existingEntry.sessions = [...(existingEntry.sessions || []), ...entry.sessions];
      }
      if (entry.executablePath && !existingEntry.executablePath) {
        existingEntry.executablePath = entry.executablePath;
      }
    } else {
      deduplicatedLibrary.push(entry);
      if (steamId) steamIdsSeen.set(steamId, entry);
      if (exePath) exePathsSeen.set(exePath, entry);
    }
  });

  if (modified) {
    localStorage.setItem("vazorism_library", JSON.stringify(deduplicatedLibrary));
  }
} catch (e) {
  console.error("Failed to run library type migration", e);
}

// Initialize global app settings on startup
useSettingsStore.getState().initialize();
useAuthStore.getState().initialize();

import { type } from '@tauri-apps/plugin-os';
import { getCurrentWindow } from '@tauri-apps/api/window';

if (type() !== "android" && type() !== "ios") {
  sessionManager.init();
} else {
  // Mobile specific initialization
  const setMobileImmersive = async () => {
    try {
      await getCurrentWindow().setFullscreen(true);
    } catch (e) {
      console.error("Failed to set fullscreen on mobile", e);
    }
  };
  setMobileImmersive();
}

syncManager.init();

import SetupProfile from "@/components/auth/SetupProfile";

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, isLoading } = useAuthStore();

  useEffect(() => {
    if (session && profile?.setup_complete) {
      libraryManager.autoEnrichMissingGames();
      
      // Only run process polling on PC
      if (type() !== "android" && type() !== "ios") {
        processManager.startPolling();
      }
    }
  }, [session, profile?.setup_complete]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#09090B]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  if (!profile?.setup_complete) {
    return <SetupProfile />;
  }

  return (
    <>
      {children}
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <UpdateManager />
      <WhatsNewModal />
      <Sonner />
      <AuthGuard>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/apps" element={<Apps />} />
            <Route path="/discovery" element={<Discovery />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/library" element={<Collections />} />
            <Route path="/auth/redirect" element={<OAuthRedirect />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthGuard>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
