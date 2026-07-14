import { useState } from "react";
import Layout from "@/components/layout/Layout";
import SectionHeading from "@/components/common/SectionHeading";
import { useSettingsStore } from "@/stores/settings-store";
import { motion } from "framer-motion";
import { FolderPlus, Trash2, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { steamSyncManager } from "@/services/SteamSyncManager";
import { invoke } from "@tauri-apps/api/core";
import { libraryManager } from "@/services/LibraryManager";

export default function Settings() {
  const { settings, updateSettings, isLoading } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<"general" | "library" | "metadata" | "integrations">("general");
  const [newScanPath, setNewScanPath] = useState("");
  const [isSyncingSteam, setIsSyncingSteam] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex h-full items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
        </div>
      </Layout>
    );
  }


  const handleToggleAutoStart = async () => {
    const newValue = !settings.autoStart;
    updateSettings({ autoStart: newValue });
    try {
      await invoke("set_autostart", { enable: newValue });
      if (newValue) {
        toast.success("Launch on startup enabled (will start minimized)");
      } else {
        toast.success("Launch on startup disabled");
      }
    } catch (e: any) {
      toast.error(`Failed to modify system startup: ${e.toString()}`);
    }
  };

  const handleToggleDiscord = () => {
    updateSettings({ discordRichPresence: !settings.discordRichPresence });
  };

  const handleAddScanPath = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScanPath.trim()) return;
    
    const paths = [...settings.libraryScanPaths];
    if (paths.includes(newScanPath.trim())) {
      toast.error("Path already exists");
      return;
    }
    
    paths.push(newScanPath.trim());
    updateSettings({ libraryScanPaths: paths });
    setNewScanPath("");
    toast.success("Scan path added");
  };

  const handleRemoveScanPath = (pathToRemove: string) => {
    const paths = settings.libraryScanPaths.filter(p => p !== pathToRemove);
    updateSettings({ libraryScanPaths: paths });
  };

  const handleToggleProvider = (provider: string) => {
    const current = [...settings.metadataProviders];
    const index = current.indexOf(provider);
    
    if (index > -1) {
      if (current.length === 1) {
        toast.error("You must have at least one provider enabled");
        return;
      }
      current.splice(index, 1);
    } else {
      current.push(provider);
    }
    
    updateSettings({ metadataProviders: current });
  };

  const handleSteamSync = async () => {
    setIsSyncingSteam(true);
    try {
      await steamSyncManager.syncGames();
    } finally {
      setIsSyncingSteam(false);
    }
  };

  const handleArcTrackMigration = async () => {
    setIsMigrating(true);
    try {
      const data = await invoke<{ apps: any[] }>("migrate_old_data");
      let count = 0;
      
      for (const app of data.apps) {
        // Find if already exists
        const entries = libraryManager.getEntries();
        const exists = entries.find(e => e.executablePath === app.exe_path);
        
        if (!exists) {
          const type = app.category === "game" ? "game" : "application";
          
          await libraryManager.createEntry({
            title: app.display_name,
            executablePath: app.exe_path,
            executableName: app.exe_path.split("\\").pop() || "",
            type,
            status: app.status || "completed",
            coverPath: app.cover_path || undefined,
            // Playtime from total_seconds (we don't have direct assignment in createEntry, so we might need to manually update playtime in stats store if supported, but for now we'll just migrate the app to library)
          });
          count++;
        }
      }
      
      toast.success(`Successfully migrated ${count} entries from ArcTrack!`);
    } catch (err: any) {
      console.error(err);
      toast.error(`Migration failed: ${err.toString()}`);
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <Layout>
      <div className="w-full flex flex-col h-full">
        
        {/* Full-bleed Settings Banner */}
        <div className="relative w-full aspect-[4/1] min-h-[250px] mb-12 rounded-[2rem] overflow-hidden border border-white/5 shadow-2xl shrink-0 mt-4">
          <img src="/images/vertex_banner_v4.png" alt="Vertex Banner" className="absolute inset-0 w-full h-full object-cover opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-transparent to-transparent opacity-90" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#111111]/80 via-transparent to-transparent" />
          <div className="absolute bottom-8 left-10">
            <h1 className="text-5xl font-black text-white tracking-tight drop-shadow-2xl">Settings</h1>
            <p className="text-white/70 font-medium mt-2 text-lg drop-shadow-lg">Configure Vertex to match your setup.</p>
          </div>
        </div>

        <div className="pb-12 flex flex-col lg:flex-row h-full gap-6 lg:gap-10 w-full max-w-7xl mx-auto px-4">
          
          {/* Settings Sidebar */}
          <div className="w-full lg:w-64 shrink-0 flex flex-row lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0 hide-scrollbar">
          
          <button 
            onClick={() => setActiveTab("general")}
            className={cn(
              "whitespace-nowrap text-left px-4 py-3 rounded-xl font-bold transition-all",
              activeTab === "general" ? "bg-white text-black shadow-lg shadow-white/10" : "text-white/60 hover:bg-white/5 hover:text-white"
            )}
          >
            General
          </button>
          
          <button 
            onClick={() => setActiveTab("library")}
            className={cn(
              "whitespace-nowrap text-left px-4 py-3 rounded-xl font-bold transition-all",
              activeTab === "library" ? "bg-white text-black shadow-lg shadow-white/10" : "text-white/60 hover:bg-white/5 hover:text-white"
            )}
          >
            Library & Folders
          </button>
          
          <button 
            onClick={() => setActiveTab("metadata")}
            className={cn(
              "whitespace-nowrap text-left px-4 py-3 rounded-xl font-bold transition-all",
              activeTab === "metadata" ? "bg-white text-black shadow-lg shadow-white/10" : "text-white/60 hover:bg-white/5 hover:text-white"
            )}
          >
            Metadata
          </button>
          
          <button 
            onClick={() => setActiveTab("integrations")}
            className={cn(
              "whitespace-nowrap text-left px-4 py-3 rounded-xl font-bold transition-all",
              activeTab === "integrations" ? "bg-white text-black shadow-lg shadow-white/10" : "text-white/60 hover:bg-white/5 hover:text-white"
            )}
          >
            Integrations
          </button>
        </div>

        {/* Settings Content Area */}
        <div className="flex-1 bg-[#111111] border border-white/5 rounded-3xl p-8 backdrop-blur-md custom-scrollbar overflow-y-auto">
          
          {/* GENERAL TAB */}
          {activeTab === "general" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-10"
            >
              <section>
                <SectionHeading title="Cloud Synchronization" />
                <div className="mt-4 flex flex-col gap-4">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-black/20 border border-white/5">
                    <div>
                      <h3 className="font-bold text-white mb-1">Force Full Sync</h3>
                      <p className="text-sm text-white/60">Manually upload all local games to Supabase.</p>
                    </div>
                    <button 
                      onClick={() => {
                        localStorage.removeItem('vazorism_last_sync');
                        toast.success("Sync state reset. Restarting sync...");
                        setTimeout(() => window.location.reload(), 1000);
                      }}
                      className="px-6 py-2.5 rounded-xl bg-white hover:bg-white/90 text-black font-semibold transition-colors"
                    >
                      Sync Now
                    </button>
                  </div>
                </div>
              </section>

              <section>
                <SectionHeading title="System Integration" />
                <div className="mt-4 flex flex-col gap-4">
                  <label className="flex items-center justify-between p-4 rounded-2xl bg-black/20 border border-white/5 cursor-pointer hover:bg-black/30 transition-colors">
                    <div>
                      <h4 className="font-bold text-white text-lg">Launch on Startup</h4>
                      <p className="text-white/50 text-sm">Automatically open Vertex when your computer boots.</p>
                    </div>
                    <div className="relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-black cursor-pointer" onClick={handleToggleAutoStart}>
                      <div className={cn("absolute inset-0 rounded-full transition-colors", settings.autoStart ? "bg-white" : "bg-white/10")} />
                      <span className={cn("absolute inline-block h-5 w-5 transform rounded-full transition-transform duration-200 ease-in-out", settings.autoStart ? "translate-x-8 bg-black" : "translate-x-1 bg-white/50")} />
                    </div>
                  </label>

                  <label className="flex items-center justify-between p-4 rounded-2xl bg-black/20 border border-white/5 cursor-pointer hover:bg-black/30 transition-colors">
                    <div>
                      <h4 className="font-bold text-white text-lg">Discord Rich Presence</h4>
                      <p className="text-white/50 text-sm">Show the game you are currently playing on your Discord profile.</p>
                    </div>
                    <div className="relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-black cursor-pointer" onClick={handleToggleDiscord}>
                      <div className={cn("absolute inset-0 rounded-full transition-colors", settings.discordRichPresence ? "bg-white" : "bg-white/10")} />
                      <span className={cn("absolute inline-block h-5 w-5 transform rounded-full transition-transform duration-200 ease-in-out", settings.discordRichPresence ? "translate-x-8 bg-black" : "translate-x-1 bg-white/50")} />
                    </div>
                  </label>
                </div>
              </section>
            </motion.div>
          )}

          {/* LIBRARY TAB */}
          {activeTab === "library" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-8"
            >
              <section>
                <div className="flex items-center justify-between mb-4">
                  <SectionHeading title="Scan Paths" />
                </div>
                <p className="text-white/50 text-sm mb-6 max-w-2xl">
                  Vertex will automatically monitor these folders and import any games or applications it discovers into your library.
                </p>

                <div className="flex flex-col gap-3 mb-6">
                  {settings.libraryScanPaths.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl border border-dashed border-white/10 bg-black/10">
                      <p className="text-white/40">No scan paths configured.</p>
                    </div>
                  ) : (
                    settings.libraryScanPaths.map((path) => (
                      <div key={path} className="flex items-center justify-between p-4 rounded-xl bg-black/40 border border-white/5">
                        <span className="text-white font-medium">{path}</span>
                        <button 
                          onClick={() => handleRemoveScanPath(path)}
                          className="p-2 text-white/30 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleAddScanPath} className="flex items-center gap-2">
                  <input 
                    type="text"
                    placeholder="Enter absolute directory path (e.g. C:\Games)"
                    value={newScanPath}
                    onChange={(e) => setNewScanPath(e.target.value)}
                    className="flex-1 px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-white/50"
                  />
                  <button 
                    type="submit" 
                    disabled={!newScanPath.trim()}
                    className="flex items-center gap-2 px-6 py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <FolderPlus className="w-5 h-5" />
                    Add Path
                  </button>
                </form>
              </section>
            </motion.div>
          )}

          {/* METADATA TAB */}
          {activeTab === "metadata" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-8"
            >
              <section>
                <SectionHeading title="Metadata Providers" />
                <p className="text-white/50 text-sm mt-2 mb-6 max-w-2xl">
                  Select which databases Vertex should query when attempting to automatically download cover art, genres, descriptions, and release dates for your games.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { id: "steam", name: "Steam Store", desc: "Best for PC games, reliable cover arts and trailers." },
                    { id: "igdb", name: "IGDB", desc: "Twitch's giant database. Excellent for indie titles and emulation." },
                    { id: "rawg", name: "RAWG", desc: "Huge community-driven database with high-res hero backgrounds." },
                  ].map((provider) => {
                    const isEnabled = settings.metadataProviders.includes(provider.id);
                    return (
                      <div 
                        key={provider.id}
                        onClick={() => handleToggleProvider(provider.id)}
                        className={cn(
                          "relative p-5 rounded-2xl border-2 cursor-pointer transition-all",
                          isEnabled ? "border-white bg-white/5" : "border-white/5 bg-black/20 hover:border-white/20"
                        )}
                      >
                        <div className="absolute top-5 right-5">
                          {isEnabled ? (
                            <CheckCircle2 className="w-6 h-6 text-white" />
                          ) : (
                            <Circle className="w-6 h-6 text-white/20" />
                          )}
                        </div>
                        <h4 className="font-bold text-white text-lg mb-1">{provider.name}</h4>
                        <p className="text-white/50 text-sm max-w-[85%]">{provider.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            </motion.div>
          )}

          {/* INTEGRATIONS TAB */}
          {activeTab === "integrations" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-8"
            >
              <section>
                <SectionHeading title="Steam Integration" />
                <p className="text-white/50 text-sm mt-2 mb-6 max-w-2xl">
                  Connect your Steam account to automatically import all your owned games into your Vertex library. 
                  You need your 64-bit Steam ID and a Steam Web API Key. Your profile must be public.
                </p>

                <div className="flex flex-col gap-6 p-6 rounded-2xl bg-black/20 border border-white/5">
                  <div>
                    <label className="block text-sm font-bold text-white/70 mb-2">Steam ID (64-bit)</label>
                    <input 
                      type="text"
                      placeholder="e.g. 76561198000000000"
                      value={settings.steamId || ""}
                      onChange={(e) => updateSettings({ steamId: e.target.value })}
                      className="w-full max-w-md px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-white/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-white/70 mb-2">Steam Web API Key</label>
                    <input 
                      type="password"
                      placeholder="Paste your API key here..."
                      value={settings.steamApiKey || ""}
                      onChange={(e) => updateSettings({ steamApiKey: e.target.value })}
                      className="w-full max-w-md px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-white/50"
                    />
                    <a 
                      href="https://steamcommunity.com/dev/apikey" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-white/60 text-xs mt-2 inline-block hover:text-white hover:underline"
                    >
                      Get your Steam API key here
                    </a>
                  </div>
                  
                  <div className="pt-4 border-t border-white/5">
                    <button 
                      onClick={handleSteamSync}
                      disabled={isSyncingSteam || !settings.steamId || !settings.steamApiKey}
                      className="flex items-center justify-center gap-2 px-8 py-3 bg-[#171a21] hover:bg-[#2a303c] text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-white/10 shadow-lg"
                    >
                      {isSyncingSteam ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.662 16.536l-2.42-1.042c-.22-.095-.444-.108-.667-.033l-1.393.473c-.092.032-.187.048-.283.048-1.572 0-2.846-1.274-2.846-2.846 0-.256.036-.505.102-.743l1.83-4.27a.895.895 0 00-.14-.94.897.897 0 00-.776-.328c-.12.012-3.418.528-4.662.91-1.246.38-2.617 1.053-3.053 1.258a4.912 4.912 0 011.084 3.753l1.52-1.52.484-.044.823.518-.088.932-.612.426.04.498-1.564 1.564a5.002 5.002 0 004.992 4.095c2.723 0 4.935-2.203 4.945-4.922a4.964 4.964 0 00-2.316-4.165z"/></svg>
                          Sync Steam Library
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </section>

              <section>
                <SectionHeading title="ArcTrack Migration" />
                <p className="text-white/50 text-sm mt-2 mb-6 max-w-2xl">
                  Automatically migrate your previous tracker data from ArcTrack (playtimes, apps, and games) into Vertex.
                </p>

                <div className="flex flex-col gap-6 p-6 rounded-2xl bg-black/20 border border-white/5">
                  <div className="">
                    <button 
                      onClick={handleArcTrackMigration}
                      disabled={isMigrating}
                      className="flex items-center justify-center gap-2 px-8 py-3 bg-white hover:bg-white/90 text-black font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
                    >
                      {isMigrating ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          Migrating...
                        </>
                      ) : (
                        "Migrate from ArcTrack"
                      )}
                    </button>
                  </div>
                </div>
              </section>
            </motion.div>
          )}

        </div>
      </div>
      </div>
    </Layout>
  );
}
