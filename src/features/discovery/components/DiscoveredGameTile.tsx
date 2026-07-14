import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { DiscoveredGame } from "@/services/DiscoveryManager";
import { Heart } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { libraryManager } from "@/services/LibraryManager";
import { useLibraryStore } from "@/stores/library-store";

interface DiscoveredGameTileProps {
  game: DiscoveredGame;
  onClick?: (game: DiscoveredGame) => void;
  className?: string;
}

export default function DiscoveredGameTile({
  game,
  onClick,
  className,
}: DiscoveredGameTileProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { entries } = useLibraryStore();
  
  // Check if game is in wishlist
  const inWishlist = entries.some(e => e.title === game.title && e.status === "wishlist");

  const handleWishlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!inWishlist) {
      await libraryManager.addToWishlist({
        title: game.title,
        coverUrl: game.coverUrl,
        steamAppId: parseInt(game.id) || undefined,
        price: game.price
      });
      
      toast.success(`Added ${game.title} to your Wishlist!`, {
        icon: <Heart className="w-4 h-4 text-pink-500 fill-pink-500" />
      });
    } else {
      await libraryManager.removeFromWishlist(game.title);
      toast.success(`Removed ${game.title} from your Wishlist.`);
    }
  };

  return (
    <motion.div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick?.(game)}
      whileHover={{ scale: 1.05, y: -6 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "group relative w-full overflow-hidden rounded-2xl text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 shadow-lg transition-shadow hover:shadow-2xl hover:shadow-purple-500/30",
        "aspect-[2/3]", // Standard cover ratio
        className
      )}
      aria-label={game.title}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick?.(game);
        }
      }}
    >
      <div className="absolute inset-0 bg-[#311C46]" />

      {game.coverUrl && (
        <div className="absolute inset-0">
          <img
            src={game.coverUrl}
            alt={game.title}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
            loading="lazy"
            onError={(e) => {
              // Fallback to heroUrl (header_image) if cover (library_600x900) is 404
              if (game.heroUrl && e.currentTarget.src !== game.heroUrl) {
                e.currentTarget.src = game.heroUrl;
              } else {
                e.currentTarget.style.display = 'none';
              }
            }}
          />
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#0F0A18] via-[#0F0A18]/60 to-transparent opacity-90 transition-opacity group-hover:opacity-100" />
        </div>
      )}

      {/* Wishlist Button - Top Right */}
      <AnimatePresence>
        {(isHovered || inWishlist) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className="absolute top-3 right-3 z-20"
          >
            <button
              onClick={handleWishlist}
              className={cn(
                "p-2.5 rounded-full backdrop-blur-md transition-all shadow-xl hover:scale-110",
                inWishlist 
                  ? "bg-pink-500/20 text-pink-500 border border-pink-500/50" 
                  : "bg-black/40 text-white hover:bg-pink-500/80 hover:border-pink-500 border border-white/10"
              )}
            >
              <Heart className={cn("w-5 h-5", inWishlist && "fill-current")} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute inset-x-0 bottom-0 p-4 transform transition-transform duration-300">
        <p className="truncate text-base font-bold text-white drop-shadow-md">
          {game.title}
        </p>
        
        <div className="mt-1 flex items-center justify-between">
          <p className="text-sm font-bold text-white/90">
            {game.price}
          </p>

          {game.discountPercent ? (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400">
              -{game.discountPercent}%
            </span>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
