import Layout from "@/components/layout/Layout";
import SectionHeading from "@/components/common/SectionHeading";
import { useLibraryStore } from "@/stores/library-store";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Search, ShoppingCart, Trash2 } from "lucide-react";
import GameTile from "@/features/library/components/GameTile";
import GameDetailModal from "@/features/library/components/GameDetailModal";
import { LibraryEntryWithRelations } from "@/services/LibraryManager";
import { useState, useMemo } from "react";
import { libraryManager } from "@/services/LibraryManager";
import { toast } from "sonner";

export default function Wishlist() {
  const { entries } = useLibraryStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGame, setSelectedGame] = useState<LibraryEntryWithRelations | null>(null);

  const wishlistEntries = useMemo(() => {
    return entries.filter(e => e.status === "wishlist");
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return wishlistEntries.filter(entry => 
      entry.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [wishlistEntries, searchQuery]);

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-end justify-between">
          <div>
            <SectionHeading title="My Wishlist" />
            <p className="text-white/50 text-sm mt-2">{wishlistEntries.length} games you're keeping an eye on.</p>
          </div>
          
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Search wishlist..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#111111] border border-white/5 rounded-full py-2 pl-10 pr-4 text-sm text-white placeholder-white/40 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
            />
          </div>
        </div>

        {wishlistEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-24 h-24 rounded-full bg-pink-500/10 flex items-center justify-center mb-6">
              <Heart className="w-10 h-10 text-pink-500" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Your wishlist is empty</h3>
            <p className="text-white/60 max-w-md">
              Discover new games on the Home page and click the heart icon to save them here for later.
            </p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-white/40">No games found matching "{searchQuery}"</p>
          </div>
        ) : (
          <motion.div 
            layout
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6"
          >
            <AnimatePresence>
              {filteredEntries.map((entry) => (
                <motion.div
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  className="relative group"
                >
                  <GameTile entry={entry} onClick={() => setSelectedGame(entry)} />
                  
                  {/* Remove from Wishlist Button */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      libraryManager.removeFromWishlist(entry.id);
                      toast.success(`Removed ${entry.title} from Wishlist`);
                    }}
                    title="Remove from Wishlist"
                    className="absolute top-3 right-3 z-30 p-2 bg-black/60 hover:bg-red-500/90 border border-white/10 hover:border-red-500 rounded-full text-white/70 hover:text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all shadow-xl hover:scale-110"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* Price Tag Overlay (if available in metadata description temporarily) */}
                  {entry.metadata?.description && entry.metadata.description.startsWith("Price:") && (
                    <div className="absolute top-3 left-3 z-20 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-xs font-bold text-green-400 border border-white/10 shadow-lg flex items-center gap-1">
                      <ShoppingCart className="w-3 h-3" />
                      {entry.metadata.description.replace("Price: ", "")}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      <GameDetailModal 
        entry={selectedGame}
        isOpen={!!selectedGame}
        onClose={() => setSelectedGame(null)}
      />
    </Layout>
  );
}
