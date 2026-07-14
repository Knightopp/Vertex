import { useEffect, useState } from "react";
import Layout from "@/components/layout/Layout";
import SectionHeading from "@/components/common/SectionHeading";
import { useCollectionsStore } from "@/stores/collections-store";
import { useLibraryStore } from "@/stores/library-store";
import GameTile from "@/features/library/components/GameTile";
import GameDetailModal from "@/features/library/components/GameDetailModal";
import { LibraryEntryWithRelations } from "@/services/LibraryManager";
import { collectionsManager } from "@/services/CollectionsManager";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Folder, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { imageManager } from "@/services/ImageManager";
import { SortableGrid } from "@/components/common/SortableGrid";

export default function Collections() {
  const { collections, fetchCollections } = useCollectionsStore();
  const { entries, fetchLibrary } = useLibraryStore();
  
  const [selectedGame, setSelectedGame] = useState<LibraryEntryWithRelations | null>(null);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);

  // New collection state
  const [isCreating, setIsCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");

  const searchParams = new URLSearchParams(window.location.search);
  const initialCollection = searchParams.get("collection");

  useEffect(() => {
    fetchCollections();
    fetchLibrary();
  }, [fetchCollections, fetchLibrary]);

  useEffect(() => {
    if (selectedGame) {
      const updated = entries.find(e => e.id === selectedGame.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedGame)) {
        setSelectedGame(updated);
      }
    }
  }, [entries, selectedGame]);

  useEffect(() => {
    if (initialCollection) {
      setActiveCollectionId(initialCollection);
    }
  }, [initialCollection]);

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;

    const col = await collectionsManager.createCollection(newCollectionName.trim());
    if (col) {
      toast.success("Collection created!");
      setNewCollectionName("");
      setIsCreating(false);
    } else {
      toast.error("Failed to create collection");
    }
  };

  const handleDeleteCollection = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete the collection "${name}"?`)) {
      const success = await collectionsManager.deleteCollection(id);
      if (success) {
        toast.success("Collection deleted");
        if (activeCollectionId === id) setActiveCollectionId(null);
      } else {
        toast.error("Failed to delete collection");
      }
    }
  };

  const activeCollection = collections.find(c => c.id === activeCollectionId);

  // Smart Collections based on status
  const favoriteGames = entries.filter(e => e.favorite);
  const completedGames = entries.filter(e => e.status === "completed");
  const playingGames = entries.filter(e => e.status === "playing");
  const droppedGames = entries.filter(e => e.status === "dropped");
  const pausedGames = entries.filter(e => e.status === "paused" || e.status === "backlog");

  const smartCollections = [
    { id: "smart_all", name: "All Games", entries: entries.filter(e => e.type === "game" && e.status !== "wishlist").map(e => ({ entryId: e.id, entry: e })), isSmart: true },
    { id: "smart_favorites", name: "Favorites", entries: favoriteGames.map(e => ({ entryId: e.id, entry: e })), isSmart: true },
    { id: "smart_playing", name: "Playing", entries: playingGames.map(e => ({ entryId: e.id, entry: e })), isSmart: true },
    { id: "smart_completed", name: "Completed", entries: completedGames.map(e => ({ entryId: e.id, entry: e })), isSmart: true },
    { id: "smart_paused", name: "Paused (Backlog)", entries: pausedGames.map(e => ({ entryId: e.id, entry: e })), isSmart: true },
    { id: "smart_dropped", name: "Dropped", entries: droppedGames.map(e => ({ entryId: e.id, entry: e })), isSmart: true },
  ].filter(c => c.entries.length > 0); // Only show if they have games

  const allCollections = [...smartCollections, ...collections];

  const activeSmartCollection = smartCollections.find(c => c.id === activeCollectionId);

  // Resolve the actual library entries for the active collection
  const activeCollectionGames = activeSmartCollection
    ? activeSmartCollection.entries.map(e => e.entry as LibraryEntryWithRelations)
    : activeCollection?.entries
      ?.map((e: any) => entries.find((en) => en.id === e.entryId))
      .filter((en: any) => {
        if (!en) return false;
        if (activeCollection?.name === "Games Owned" && en.status === "wishlist") return false;
        return true;
      }) as LibraryEntryWithRelations[] | undefined || [];

  return (
    <Layout>
      <div className="pt-2 pb-12 flex flex-col gap-12 h-full">
        <AnimatePresence mode="wait">
          {!activeCollectionId ? (
            // COLLECTIONS OVERVIEW
            <motion.div
              key="overview"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col gap-8"
            >
              <div className="flex items-center justify-between">
                <SectionHeading title="Your Collections" />
                
                {!isCreating ? (
                  <button 
                    onClick={() => setIsCreating(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-white hover:bg-white/90 rounded-full font-bold text-black shadow-lg transition-transform hover:scale-105"
                  >
                    <Plus className="w-5 h-5" />
                    New Collection
                  </button>
                ) : (
                  <form onSubmit={handleCreateCollection} className="flex items-center gap-2">
                    <input 
                      autoFocus
                      type="text"
                      placeholder="Collection Name"
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      className="px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-white/50"
                    />
                    <button type="submit" className="px-4 py-3 bg-white text-black font-bold rounded-xl hover:bg-white/90">
                      Create
                    </button>
                    <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20">
                      Cancel
                    </button>
                  </form>
                )}
              </div>

              {allCollections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-center border border-dashed border-white/10 rounded-3xl bg-white/5">
                  <Folder className="w-16 h-16 text-white/20 mb-4" />
                  <h3 className="text-xl font-bold text-white/70 mb-2">No Collections Yet</h3>
                  <p className="text-white/40 max-w-md">Create your first collection to start organizing your library into custom playlists.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {allCollections.map((col) => {
                    // Filter out any dangling references (IDs in collection that don't exist in library) or wishlist games in Games Owned
                    const validEntries = (col as any).isSmart 
                      ? col.entries 
                      : col.entries.filter((ce: any) => {
                          const en = entries.find(lib => lib.id === ce.entryId);
                          if (!en) return false;
                          if (col.name === "Games Owned" && en.status === "wishlist") return false;
                          return true;
                        });

                    // Extract up to 3 cover images for a stacked card effect
                    const covers = validEntries
                      .map((e: any) => {
                        const libEntry = (col as any).isSmart ? e.entry : entries.find(lib => lib.id === e.entryId);
                        return libEntry?.images?.find((i: any) => i.type === "cover");
                      })
                      .filter(Boolean)
                      .slice(0, 3)
                      .map((img: any) => imageManager.resolveImagePath(img.localPath || img.remoteUrl || undefined));

                    return (
                      <div 
                        key={col.id}
                        className="group relative rounded-3xl bg-[#111111] p-4 cursor-pointer hover:bg-[#18181B] transition-colors border border-white/10 shadow-xl hover:shadow-white/5"
                        onClick={() => setActiveCollectionId(col.id)}
                      >
                        {!(col as any).isSmart && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteCollection(col.id, col.name); }}
                            className="absolute top-4 right-4 z-10 p-2 bg-black/40 text-white/50 hover:text-red-400 hover:bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-all backdrop-blur-md"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        
                        {/* Stacked Covers Visual */}
                        <div className="relative h-48 mb-4 flex items-center justify-center">
                          {covers.length > 0 ? (
                            <div className="relative w-32 h-full">
                              {covers.map((url: string, i: number) => (
                                <div 
                                  key={i} 
                                  className="absolute inset-y-0 shadow-2xl rounded-lg overflow-hidden border border-white/10 transition-transform group-hover:-translate-y-2"
                                  style={{
                                    left: `${i * 20}px`,
                                    zIndex: 10 - i,
                                    transform: `scale(${1 - i * 0.1}) rotate(${i * 5}deg)`,
                                    transformOrigin: "bottom left"
                                  }}
                                >
                                  <img src={url} alt="" className="w-full h-full object-cover" />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="w-full h-full rounded-xl bg-black/20 border border-dashed border-white/10 flex items-center justify-center">
                              <Folder className="w-8 h-8 text-white/10" />
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-bold text-white truncate">{col.name}</h3>
                          {(col as any).isSmart && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-white/70 border border-white/20">SMART</span>}
                        </div>
                        <p className="text-sm text-white/50">{validEntries.length} Games</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ) : (
            // SINGLE COLLECTION VIEW
            <motion.div
              key="collection"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-8 h-full"
            >
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setActiveCollectionId(null)}
                  className="p-3 bg-white/5 hover:bg-white/10 text-white rounded-full transition-colors"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                  <h1 className="text-3xl font-black text-white flex items-center gap-3">
                    {activeCollection?.name || activeSmartCollection?.name}
                    {activeSmartCollection && <span className="px-2 py-1 rounded text-sm font-bold bg-white/10 text-white/70 border border-white/20">SMART</span>}
                  </h1>
                  <p className="text-white/50">{activeCollectionGames.length} Games</p>
                </div>
              </div>

              {activeCollectionGames.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <p className="text-white/40 mb-2">This collection is empty.</p>
                  <p className="text-sm text-white/30 max-w-sm">
                    Go to the Library or Discovery page, click on a game, and use the Add to Collection button in the details modal.
                  </p>
                </div>
              ) : activeCollection && !activeSmartCollection ? (
                <SortableGrid
                  items={activeCollectionGames}
                  keyExtractor={(item) => item.id}
                  onReorder={async (newOrder) => {
                    await collectionsManager.reorderCollectionEntries(
                      activeCollection.id, 
                      newOrder.map(g => g.id)
                    );
                    fetchCollections(); // Re-fetch to apply sort order to local state
                  }}
                  renderItem={(item) => <GameTile entry={item} onClick={setSelectedGame} />}
                />
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {activeCollectionGames.map((entry) => (
                    <GameTile key={entry.id} entry={entry} onClick={setSelectedGame} />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <GameDetailModal 
        entry={selectedGame}
        isOpen={!!selectedGame}
        onClose={() => setSelectedGame(null)}
      />
    </Layout>
  );
}
