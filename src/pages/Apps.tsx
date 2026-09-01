import { useEffect, useState, useMemo } from "react";
import Layout from "@/components/layout/Layout";
import SectionHeading from "@/components/common/SectionHeading";
import GameTile from "@/features/library/components/GameTile";
import GameDetailModal from "@/features/library/components/GameDetailModal";
import { useLibraryStore } from "@/stores/library-store";
import { useSettingsStore } from "@/stores/settings-store";
import { libraryManager, type LibraryEntryWithRelations } from "@/services/LibraryManager";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Ban, Eye, RotateCw, Plus, Trash2, CheckCircle2, ShieldAlert, Cpu } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Apps() {
  const { entries, fetchLibrary } = useLibraryStore();
  const { settings, updateSettings } = useSettingsStore();
  const [selected, setSelected] = useState<LibraryEntryWithRelations | null>(null);
  const [activeTab, setActiveTab] = useState<"tracked" | "excluded">("tracked");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"playtime" | "recent" | "name">("playtime");
  const [newExclusionInput, setNewExclusionInput] = useState("");
  const [isCleaning, setIsCleaning] = useState(false);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  // Clean deduplicated applications list
  const applications = useMemo(() => {
    return entries.filter((entry) => entry.type === "application" && !entry.deletedAt);
  }, [entries]);

  const filteredApps = useMemo(() => {
    let list = applications.filter((app) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        app.title.toLowerCase().includes(q) ||
        (app.executableName && app.executableName.toLowerCase().includes(q))
      );
    });

    if (sortBy === "playtime") {
      list.sort((a, b) => (b.playtimeTotal || 0) - (a.playtimeTotal || 0));
    } else if (sortBy === "recent") {
      list.sort((a, b) => {
        const timeA = a.lastPlayedAt ? new Date(a.lastPlayedAt).getTime() : 0;
        const timeB = b.lastPlayedAt ? new Date(b.lastPlayedAt).getTime() : 0;
        return timeB - timeA;
      });
    } else if (sortBy === "name") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }

    return list;
  }, [applications, searchQuery, sortBy]);

  const excludedList = useMemo(() => {
    return settings.excludedApps || [];
  }, [settings.excludedApps]);

  const handleExcludeApp = async (e: React.MouseEvent, entry: LibraryEntryWithRelations) => {
    e.stopPropagation();
    try {
      await libraryManager.excludeApp(entry.id);
      await fetchLibrary();
      toast.success(`Excluded "${entry.title}". Vertex will never track this app.`);
    } catch (err: any) {
      toast.error(`Failed to exclude app: ${err.toString()}`);
    }
  };

  const handleUnexclude = async (nameOrExe: string) => {
    try {
      await libraryManager.unexcludeApp(nameOrExe);
      toast.success(`Removed "${nameOrExe}" from exclusions.`);
    } catch (err: any) {
      toast.error(`Failed to un-exclude: ${err.toString()}`);
    }
  };

  const handleAddManualExclusion = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newExclusionInput.trim().toLowerCase();
    if (!clean) return;

    const current = [...(settings.excludedApps || [])];
    if (current.some(x => x.toLowerCase() === clean)) {
      toast.info("This application is already excluded.");
      return;
    }

    current.push(clean);
    await updateSettings({ excludedApps: current });
    await libraryManager.cleanupDuplicateEntries();
    await fetchLibrary();
    setNewExclusionInput("");
    toast.success(`Added "${clean}" to exclusion list.`);
  };

  const handleCleanDuplicates = async () => {
    setIsCleaning(true);
    try {
      const merged = await libraryManager.cleanupDuplicateEntries();
      await fetchLibrary();
      if (merged > 0) {
        toast.success(`Cleaned and merged ${merged} duplicate app entries!`);
      } else {
        toast.info("No duplicates found. Your library is clean!");
      }
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <Layout>
      <div className="pt-2 pb-12 flex flex-col gap-8 h-full">
        
        {/* Header & Description */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <SectionHeading title="Applications" />
            <p className="text-white/50 text-sm mt-1">
              Track your installed software, tools, and background applications.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleCleanDuplicates}
              disabled={isCleaning}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-xl text-sm font-medium border border-white/10 transition-colors shrink-0"
              title="Clean duplicate app cards"
            >
              <RotateCw className={cn("w-4 h-4", isCleaning && "animate-spin")} />
              {isCleaning ? "Cleaning..." : "Clean Duplicates"}
            </button>
          </div>
        </div>

        {/* Navigation Tabs & Search Controls */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setActiveTab("tracked")}
              className={cn(
                "px-5 py-2 rounded-lg text-sm font-bold transition-all",
                activeTab === "tracked" 
                  ? "bg-white text-black shadow-md shadow-white/10" 
                  : "text-white/50 hover:text-white"
              )}
            >
              Tracked Apps ({applications.length})
            </button>
            <button
              onClick={() => setActiveTab("excluded")}
              className={cn(
                "px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5",
                activeTab === "excluded" 
                  ? "bg-white text-black shadow-md shadow-white/10" 
                  : "text-white/50 hover:text-white"
              )}
            >
              <Ban className="w-3.5 h-3.5" />
              Excluded ({excludedList.length})
            </button>
          </div>

          {activeTab === "tracked" && (
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  placeholder="Search applications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/40"
                />
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white/40"
              >
                <option value="playtime" className="bg-[#111] text-white">Most Used</option>
                <option value="recent" className="bg-[#111] text-white">Recently Used</option>
                <option value="name" className="bg-[#111] text-white">Alphabetical</option>
              </select>
            </div>
          )}
        </div>

        {/* Tab 1: Tracked Applications Grid */}
        {activeTab === "tracked" && (
          <div>
            {filteredApps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-28 text-center rounded-3xl border border-dashed border-white/10 bg-black/20">
                <Cpu className="w-12 h-12 text-white/20 mb-3" />
                <h3 className="text-lg font-bold text-white mb-1">
                  {searchQuery ? `No apps matching "${searchQuery}"` : "No applications tracked yet"}
                </h3>
                <p className="text-white/40 text-sm max-w-md">
                  {searchQuery ? "Try clearing your search." : "Launch any desktop program while Vertex is running and it will automatically be detected and organized here."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {filteredApps.map((entry) => (
                  <div key={entry.id} className="relative group">
                    <GameTile 
                      entry={entry} 
                      onClick={setSelected} 
                    />
                    
                    {/* Quick Exclude Button */}
                    <button
                      onClick={(e) => handleExcludeApp(e, entry)}
                      title="Exclude app (Never track)"
                      className="absolute top-3 right-3 z-30 p-2 bg-black/70 hover:bg-red-500/90 border border-white/10 hover:border-red-500 rounded-full text-white/70 hover:text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all shadow-xl hover:scale-110"
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Excluded Applications Panel */}
        {activeTab === "excluded" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-6 max-w-4xl"
          >
            <div className="p-6 rounded-2xl bg-black/20 border border-white/5 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-6 h-6 text-white/70 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-bold text-white">Excluded Process Filter</h3>
                  <p className="text-sm text-white/50 mt-1">
                    Applications and processes listed here will be ignored by Vertex. They will never appear in your library or be automatically reopened on boot.
                  </p>
                </div>
              </div>

              {/* Manual Exclude Input */}
              <form onSubmit={handleAddManualExclusion} className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  placeholder="e.g. wallpaper64.exe or MyApp"
                  value={newExclusionInput}
                  onChange={(e) => setNewExclusionInput(e.target.value)}
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/50"
                />
                <button
                  type="submit"
                  disabled={!newExclusionInput.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white text-black font-bold text-sm rounded-xl hover:bg-white/90 disabled:opacity-40 transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  Add Exclusion
                </button>
              </form>
            </div>

            {/* List of Excluded Apps */}
            <div className="flex flex-col gap-2">
              {excludedList.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-dashed border-white/10 bg-black/10">
                  <p className="text-white/40 text-sm">No applications are currently excluded.</p>
                </div>
              ) : (
                excludedList.map((excludedName) => (
                  <div
                    key={excludedName}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-black/30 border border-white/5 hover:bg-black/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Ban className="w-4 h-4 text-red-400 shrink-0" />
                      <span className="font-mono text-sm text-white/90">{excludedName}</span>
                    </div>

                    <button
                      onClick={() => handleUnexclude(excludedName)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-white/70 hover:text-white transition-colors"
                      title="Allow Vertex to track this app again"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Restore Tracking
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}

      </div>

      <GameDetailModal 
        entry={selected} 
        isOpen={!!selected} 
        onClose={() => setSelected(null)} 
      />
    </Layout>
  );
}
