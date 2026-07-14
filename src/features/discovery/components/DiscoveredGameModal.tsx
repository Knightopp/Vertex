import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DiscoveredGame } from "@/services/DiscoveryManager";
import { libraryManager } from "@/services/LibraryManager";
import { X, Plus, Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface DiscoveredGameModalProps {
  game: DiscoveredGame | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function DiscoveredGameModal({ game, isOpen, onClose }: DiscoveredGameModalProps) {
  if (!game) return null;

  const handleAddToLibrary = async () => {
    try {
      const entry = await libraryManager.createEntry({
        title: game.title, 
        executableName: game.title,
        type: "game"
      });
      
      // We already have the high-quality artwork from the Discovery feed!
      // Save it directly so we don't lose it if Steam's AppDetails API blocks us (e.g. M-rated age gates)
      const { steamProvider } = await import('@/providers/SteamProvider');
      const metadata = await steamProvider.getMetadata(game.id);
      
      await libraryManager.updateEntry(entry.id, {
        metadata: metadata ? {
          description: metadata.description,
          developer: metadata.developer,
          publisher: metadata.publisher,
          genres: metadata.genres,
          steamAppId: parseInt(game.id),
          source: "steam"
        } : { steamAppId: parseInt(game.id) },
        genres: metadata?.genres?.map((name) => ({ genre: { name } })),
        images: [
          ...(game.coverUrl ? [{ type: "cover", remoteUrl: game.coverUrl, isPrimary: true }] : []),
          ...(game.heroUrl ? [{ type: "hero", remoteUrl: game.heroUrl }] : [])
        ]
      });

      toast.success(`${game.title} added to your library!`);
      onClose();
    } catch (e) {
      toast.error("Failed to add game to library");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden border-0 bg-[#0F0A18]/90 backdrop-blur-3xl shadow-2xl rounded-3xl">
        <DialogTitle className="sr-only">{game.title} Details</DialogTitle>
        
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
              className="relative min-h-[500px] flex flex-col"
            >
              <button 
                onClick={onClose}
                className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/40 text-white/70 hover:text-white hover:bg-black/60 transition-colors backdrop-blur-md"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Hero Image */}
              <div className="absolute inset-0 z-0">
                {game.heroUrl && (
                  <img 
                    src={game.heroUrl} 
                    alt="Hero" 
                    className="w-full h-full object-cover opacity-40"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0F0A18] via-[#0F0A18]/80 to-transparent" />
              </div>
              
              {/* Content */}
              <div className="relative z-10 flex-1 flex flex-col justify-end p-8 mt-48">
                <div className="flex items-end gap-6">
                  {game.coverUrl && (
                    <div className="w-40 rounded-xl overflow-hidden shadow-2xl border border-white/10 shrink-0 hidden sm:block">
                      <img src={game.coverUrl} alt="Cover" className="w-full aspect-[2/3] object-cover" />
                    </div>
                  )}
                  
                  <div className="flex-1 pb-2">
                    <h1 className="text-4xl sm:text-5xl font-black text-white drop-shadow-lg leading-tight tracking-tight mb-2">
                      {game.title}
                    </h1>
                    
                    <div className="flex items-center gap-4 mb-6">
                      <p className="text-2xl font-bold text-white">
                        {game.price}
                      </p>
                      {game.originalPrice && (
                        <p className="text-white/50 line-through">
                          {game.originalPrice}
                        </p>
                      )}
                      {game.discountPercent ? (
                        <span className="px-2 py-1 rounded text-xs font-bold bg-green-500 text-black">
                          -{game.discountPercent}%
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-4">
                      <button 
                        onClick={handleAddToLibrary}
                        className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white font-bold rounded-full hover:bg-purple-500 hover:scale-105 transition-all shadow-lg shadow-purple-900/20"
                      >
                        <Plus className="w-5 h-5" />
                        Add to Library
                      </button>
                      
                      <button className="flex items-center gap-2 px-6 py-3 bg-white/10 text-white font-bold rounded-full hover:bg-white/20 hover:scale-105 transition-all backdrop-blur-md">
                        <Heart className="w-5 h-5" />
                        Wishlist
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
