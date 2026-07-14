import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { LibraryEntryWithRelations } from "@/services/LibraryManager";
import { imageManager } from "@/services/ImageManager";
import { useTrackingStore } from "@/stores/tracking-store";
import { useCollectionsStore } from "@/stores/collections-store";
import { collectionsManager } from "@/services/CollectionsManager";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { AppWindow, FolderPlus, Gamepad2, Trash2, Image as ImageIcon, Clock, Activity, ArrowRight } from "lucide-react";
import { libraryManager } from "@/services/LibraryManager";

interface GameTileProps {
  /** The library entry containing all game data */
  entry?: LibraryEntryWithRelations;
  /** Click handler */
  onClick?: (entry: LibraryEntryWithRelations) => void;
  /** Additional CSS classes for external sizing */
  className?: string;
  /** Overlay properties for View All link */
  viewAllOverlay?: { to: string; label: string };
}

/**
 * Game tile component for library grid and carousel displays.
 * Shows a layered card with cover image and optional metadata.
 * Falls back to the Figma placeholder style when no data is provided.
 */
import { getProcessIcon } from "@/lib/tauri-ipc";
import { useState, useEffect } from "react";

export default function GameTile({
  entry,
  onClick,
  className,
  viewAllOverlay,
}: GameTileProps) {
  // Check if this specific game is currently being played
  const activeSessions = useTrackingStore((state) => state.activeSessions);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const isActive = entry ? !!activeSessions[entry.id] : false;
  const [iconSrc, setIconSrc] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    let objectUrl = "";
    if (entry && !entry.images.some(i => i.type === "cover") && entry.executablePath && entry.metadata?.hash) {
      getProcessIcon(entry.executablePath, entry.metadata.hash).then(bytes => {
        if (bytes && Array.isArray(bytes) && bytes.length > 0) {
           objectUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "image/png" }));
           setIconSrc(objectUrl);
        }
      });
    }
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [entry?.id]);

  const currentTotal = (entry?.playtimeTotal || 0) + (activeSessions[entry?.id || ""]?.effectiveSeconds || 0);

  const formatTime = (seconds: number) => {
    if (!seconds) return "00:00:00";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const playtimeText = formatTime(currentTotal);
  
  // Calculate progress based on timeToBeat (which is in seconds) or fallback to 10 hours if not set but playtime exists
  const targetSeconds = entry?.timeToBeat && entry.timeToBeat > 0 ? entry.timeToBeat : Math.max(currentTotal, 36000);
  const progressPercent = targetSeconds > 0 ? Math.min(100, (currentTotal / targetSeconds) * 100) : 0;

  // Find cover image
  const coverImageDb = entry?.images.find((img) => img.type === "cover");
  const defaultCoverUrl = imageManager.resolveImagePath(coverImageDb?.localPath || coverImageDb?.remoteUrl || undefined);
  
  const title = entry?.title || entry?.executableName || "Unknown Game";
  
  // Auto-inject our beautifully generated custom covers
  const coverUrl = defaultCoverUrl;

  useEffect(() => {
    setImageError(false);
  }, [coverUrl]);

  const { collections } = useCollectionsStore();

  const handleAddToCollection = async (collectionId: string) => {
    if (!entry) return;
    try {
      await collectionsManager.addGameToCollection(collectionId, entry.id);
      toast.success(`Added to collection`);
    } catch (e) {
      toast.error("Failed to add to collection");
    }
  };

  const handleRemoveFromCollection = async (collectionId: string) => {
    if (!entry) return;
    try {
      await collectionsManager.removeGameFromCollection(collectionId, entry.id);
      toast.success(`Removed from collection`);
    } catch (e) {
      toast.error("Failed to remove from collection");
    }
  };

  const handleAddAsGame = async () => {
    if (!entry) return;
    try {
      await libraryManager.convertToGame(entry.id);
      toast.success("Added as game and fetching Steam details");
    } catch {
      toast.error("Could not find game details. The app was still added as a game.");
      await libraryManager.updateEntry(entry.id, { type: "game" });
    }
  };
  
  const handleSetStatus = async (status: string) => {
    if (!entry) return;
    await libraryManager.updateEntry(entry.id, { status });
    toast.success(`Status updated to ${status}`);
  };

  const getPlaytimeDisplay = () => {
    if (isActive) return playtimeText;
    if (currentTotal > 0) {
      if (entry?.status && entry.status !== 'unplayed') {
        return `${playtimeText} • ${entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}`;
      }
      return playtimeText;
    }
    if (entry?.status && entry.status !== 'unplayed') {
      return entry.status.charAt(0).toUpperCase() + entry.status.slice(1);
    }
    return "Never played";
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <motion.button
          onClick={() => entry && onClick?.(entry)}
          whileHover={{ scale: 1.03, y: -4 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className={cn(
            "group relative w-full overflow-hidden rounded-2xl text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 shadow-lg transition-shadow hover:shadow-2xl hover:shadow-purple-500/20",
            "aspect-[2/3]",
            className,
            isActive && "ring-2 ring-white shadow-white/30"
          )}
          aria-label={title}
        >
          {/* Background container mimicking the Figma placeholders */}
          <div className="absolute inset-0 flex flex-col bg-[#311C46]">
            <div className="flex-1" />
            <div className="h-[30%] w-full bg-[#655A7B]" />
          </div>

          {(!coverUrl || imageError) && !iconSrc && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#2a1b38] to-[#1a1125] p-4 text-center pb-16">
              {entry?.type === 'application' ? (
                <AppWindow className="h-14 w-14 text-white/20" />
              ) : (
                <Gamepad2 className="h-14 w-14 text-white/20" />
              )}
            </div>
          )}

          {(!coverUrl || imageError) && iconSrc && (
            <div className="absolute inset-0 flex items-center justify-center pb-14">
              <img src={iconSrc} alt="App Icon" className="w-24 h-24 drop-shadow-2xl" />
            </div>
          )}

          {/* Actual cover image (when provided) */}
          {coverUrl && !imageError && (
            <div className="absolute inset-0">
              <img
                src={coverUrl}
                alt={title}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                loading="lazy"
                onError={(e) => {
                  const hero = entry?.images.find(i => i.type === 'hero');
                  const heroUrl = imageManager.resolveImagePath(hero?.localPath || hero?.remoteUrl);
                  
                  if (heroUrl && e.currentTarget.src !== heroUrl) {
                    e.currentTarget.src = heroUrl;
                  } else {
                    setImageError(true);
                  }
                }}
              />
              {/* Gradient overlay for text readability */}
              <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#0F0A18] via-[#0F0A18]/60 to-transparent opacity-90 transition-opacity group-hover:opacity-100" />
            </div>
          )}

          {/* Metadata overlay */}
          {entry && (
            <div className="absolute inset-x-0 bottom-0 p-4 transform transition-transform duration-300">
              
              {/* Progress Bar */}
              {currentTotal > 0 && (
                <div className="mb-2 w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white rounded-full transition-all duration-1000"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}

              <p className="truncate text-base font-bold text-white drop-shadow-md">
                {title}
              </p>
              
              <div className="mt-1 flex items-center justify-between">
                <p className="text-xs font-medium text-white/70">
                  {getPlaytimeDisplay()}
                </p>

                {isActive && (
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                    </span>
                    <span className="text-[10px] font-bold tracking-wider text-white uppercase">
                      Playing
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* View All Overlay */}
          {viewAllOverlay && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = viewAllOverlay.to;
              }}
              className="absolute top-0 right-0 h-full w-12 hover:w-1/2 bg-black/60 hover:bg-black/80 backdrop-blur-sm border-l border-white/20 z-20 flex flex-col items-center justify-center transition-all duration-300 group/viewall cursor-pointer"
            >
              <div className="flex flex-col items-center gap-2 opacity-60 group-hover/viewall:opacity-100">
                <div className="p-2 rounded-full bg-white/10 group-hover/viewall:bg-white/30 transition-all group-hover/viewall:scale-110">
                  <ArrowRight className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-[10px] tracking-widest uppercase text-white whitespace-nowrap overflow-hidden opacity-0 w-0 group-hover/viewall:opacity-100 group-hover/viewall:w-auto transition-all duration-300">
                  {viewAllOverlay.label}
                </span>
              </div>
            </div>
          )}
        </motion.button>
      </ContextMenuTrigger>
    {entry && (
      <ContextMenuContent className="w-52 sm:w-64 max-h-[50vh] overflow-y-auto hide-scrollbar bg-[#1A1125] text-white border-white/10 rounded-xl shadow-2xl">
        {entry.type === "application" && <>
          <ContextMenuItem 
            onClick={async () => {
              if (!entry) return;
              toast.info(`Fetching covers for ${entry.title}...`);
              await libraryManager.enrichApplication(entry.id);
              toast.success("Updated application metadata!");
            }} 
            className="focus:bg-white/10 focus:text-white"
          >
            <AppWindow className="mr-2 h-4 w-4" /> Refresh Cover
          </ContextMenuItem>
          <ContextMenuItem onClick={handleAddAsGame} className="focus:bg-white/10 focus:text-white">
            <Gamepad2 className="mr-2 h-4 w-4" /> Add as game
          </ContextMenuItem>
          <ContextMenuSeparator className="bg-white/10" />
        </>}
        
        {entry.type === "game" && (
          <ContextMenuSub>
            <ContextMenuSubTrigger className="flex items-center focus:bg-white/10 focus:text-white data-[state=open]:bg-white/10 data-[state=open]:text-white">
              <Activity className="w-4 h-4 mr-2" />
              Set Status
            </ContextMenuSubTrigger>
            <ContextMenuSubContent sideOffset={isMobile ? -180 : 0} className="w-40 sm:w-48 max-h-[40vh] overflow-y-auto hide-scrollbar bg-[#1A1125] text-white border-white/10 rounded-xl shadow-2xl">
              {["unplayed", "playing", "completed", "dropped", "paused", "backlog"].map(s => (
                <ContextMenuItem 
                  key={s} 
                  onClick={() => handleSetStatus(s)}
                  className="focus:bg-white/10 focus:text-white capitalize"
                >
                  {s} {entry.status === s && " ✓"}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        
        <ContextMenuItem 
          onClick={async () => {
            if (!entry) return;
            const input = window.prompt("Add manual playtime (in hours, e.g. 10.5):");
            if (input && !isNaN(Number(input))) {
              const secondsToAdd = Math.floor(Number(input) * 3600);
              await libraryManager.updateEntry(entry.id, {
                playtimeTotal: entry.playtimeTotal + secondsToAdd
              });
              toast.success(`Added ${input} hours of playtime!`);
            }
          }} 
          className="focus:bg-white/10 focus:text-white"
        >
          <Clock className="mr-2 h-4 w-4" /> Add Playtime
        </ContextMenuItem>

        <ContextMenuItem 
          onClick={async () => {
            if (!entry) return;
            const url = window.prompt("Enter image URL for custom cover:");
            if (url) {
              await libraryManager.updateEntry(entry.id, {
                images: [{ type: "cover", remoteUrl: url, isPrimary: true }]
              });
              toast.success("Custom cover applied!");
            }
          }} 
          className="focus:bg-white/10 focus:text-white"
        >
          <ImageIcon className="mr-2 h-4 w-4" /> Set Custom Cover
        </ContextMenuItem>
        <ContextMenuSeparator className="bg-white/10" />
        <ContextMenuSub>
          <ContextMenuSubTrigger className="flex items-center focus:bg-white/10 focus:text-white data-[state=open]:bg-white/10 data-[state=open]:text-white">
            <FolderPlus className="w-4 h-4 mr-2" />
            Add to Collection
          </ContextMenuSubTrigger>
          <ContextMenuSubContent sideOffset={isMobile ? -180 : 0} className="w-40 sm:w-48 max-h-[40vh] overflow-y-auto hide-scrollbar bg-[#1A1125] text-white border-white/10 rounded-xl shadow-2xl">
            {collections.length === 0 && (
              <div className="px-2 py-1.5 text-sm text-white/40">No collections</div>
            )}
            {collections.map(c => {
              const isInCollection = c.entries.some(e => e.entryId === entry.id);
              if (isInCollection) return null;
              return (
                <ContextMenuItem 
                  key={c.id} 
                  onClick={() => handleAddToCollection(c.id)}
                  className="focus:bg-white/10 focus:text-white"
                >
                  {c.name}
                </ContextMenuItem>
              );
            })}
          </ContextMenuSubContent>
        </ContextMenuSub>
        
        {collections.some(c => c.entries.some(e => e.entryId === entry.id)) && (
          <>
            <ContextMenuSeparator className="bg-white/10" />
            <ContextMenuSub>
              <ContextMenuSubTrigger className="flex items-center text-red-400 focus:bg-red-400/10 focus:text-red-400 data-[state=open]:bg-red-400/10 data-[state=open]:text-red-400">
                <Trash2 className="w-4 h-4 mr-2" />
                Remove from Collection
              </ContextMenuSubTrigger>
              <ContextMenuSubContent sideOffset={isMobile ? -180 : 0} className="w-40 sm:w-48 max-h-[40vh] overflow-y-auto hide-scrollbar bg-[#1A1125] text-white border-white/10 rounded-xl shadow-2xl">
                {collections.filter(c => c.entries.some(e => e.entryId === entry.id)).map(c => (
                  <ContextMenuItem 
                    key={c.id} 
                    onClick={() => handleRemoveFromCollection(c.id)}
                    className="text-red-400 focus:bg-red-400/10 focus:text-red-400"
                  >
                    {c.name}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        )}
        <ContextMenuSeparator className="bg-white/10" />
        <ContextMenuItem 
          onClick={async () => {
            if (!entry) return;
            await libraryManager.deleteEntry(entry.id);
            toast.success(`Removed ${entry.title} from library`);
          }} 
          className="text-red-500 focus:bg-red-500/10 focus:text-red-500"
        >
          <Trash2 className="mr-2 h-4 w-4" /> Remove from Library
        </ContextMenuItem>
      </ContextMenuContent>
    )}
    </ContextMenu>
  );
}
