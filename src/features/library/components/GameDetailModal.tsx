import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { LibraryEntryWithRelations, libraryManager } from "@/services/LibraryManager";
import { imageManager } from "@/services/ImageManager";
import { format } from "date-fns";
import { X, Play, Clock, Calendar, Building2, Star, Edit3, Check, Trash2, FolderPlus, Tag, Heart, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTrackingStore } from "@/stores/tracking-store";
import { toast } from "sonner";
import { useCollectionsStore } from "@/stores/collections-store";
import { collectionsManager } from "@/services/CollectionsManager";

interface GameDetailModalProps {
  entry: LibraryEntryWithRelations | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function GameDetailModal({ entry, isOpen, onClose }: GameDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "review">("overview");
  
  // Review State
  const [isEditingReview, setIsEditingReview] = useState(false);
  const [reviewContent, setReviewContent] = useState("");
  const [reviewRating, setReviewRating] = useState<number>(0);
  
  // Collections State
  const { collections } = useCollectionsStore();
  const [showCollections, setShowCollections] = useState(false);
  const [showStatus, setShowStatus] = useState(false);

  const activeSessions = useTrackingStore((state) => state.activeSessions);
  const [imageError, setImageError] = useState(false);

  // Sync entry review data when opened
  useEffect(() => {
    if (entry && isOpen) {
      setActiveTab("overview");
      setIsEditingReview(false);
      setShowCollections(false);
      if (entry.review) {
        setReviewContent(entry.review.content);
        setReviewRating(entry.review.rating || 0);
      } else {
        setReviewContent("");
        setReviewRating(0);
      }
    }
  }, [entry, isOpen]);

  const [isFavorite, setIsFavorite] = useState(entry?.favorite || false);
  
  useEffect(() => {
    if (entry) setIsFavorite(entry.favorite || false);
    setImageError(false);
  }, [entry]);

  if (!entry) return null;

  const activeSession = activeSessions[entry.id];
  const isActive = !!activeSession;

  // Format playtime
  const totalSeconds = entry.playtimeTotal + (activeSession?.effectiveSeconds || 0);
  const playtimeStr = totalSeconds > 0 
    ? `${(totalSeconds / 3600).toFixed(1)} hrs` 
    : "Never played";

  // Find images safely
  const heroImageDb = (entry.images || []).find((img) => img.type === "hero");
  const coverImageDb = (entry.images || []).find((img) => img.type === "cover");
  
  const heroUrl = imageManager.resolveImagePath(heroImageDb?.localPath || heroImageDb?.remoteUrl || undefined);
  const coverUrl = imageManager.resolveImagePath(coverImageDb?.localPath || coverImageDb?.remoteUrl || undefined);

  const title = entry.title || entry.executableName || "Unknown Game";
  
  const finalCoverUrl = coverUrl;
  const finalHeroUrl = heroUrl;
  
  let releaseDate = null;
  try {
    if (entry.metadata?.releaseDate) {
      releaseDate = format(new Date(entry.metadata.releaseDate), "MMMM d, yyyy");
    }
  } catch (e) {
    releaseDate = entry.metadata.releaseDate; // Fallback to raw string if format fails
  }

  // Review Handlers
  const handleSaveReview = async () => {
    try {
      await libraryManager.upsertReview(entry.id, reviewContent, reviewRating || undefined);
      toast.success("Review saved!");
      setIsEditingReview(false);
      
      // Mutate local state for instant feedback (normally we'd wait for the eventbus to refresh useLibraryStore)
      if (!entry.review) {
        entry.review = { content: reviewContent, rating: reviewRating } as any;
      } else {
        entry.review.content = reviewContent;
        entry.review.rating = reviewRating;
      }
      entry.rating = reviewRating;

    } catch (e) {
      toast.error("Failed to save review");
    }
  };

  const handleDeleteReview = async () => {
    try {
      await libraryManager.deleteReview(entry.id);
      toast.success("Review deleted");
      setReviewContent("");
      setReviewRating(0);
      setIsEditingReview(false);
      entry.review = null;
      entry.rating = null;
    } catch (e) {
      toast.error("Failed to delete review");
    }
  };

  // Collections Handlers
  const handleToggleCollection = async (collectionId: string, isInCollection: boolean) => {
    if (isInCollection) {
      await collectionsManager.removeGameFromCollection(collectionId, entry.id);
      toast.success(`Removed from collection`);
    } else {
      await collectionsManager.addGameToCollection(collectionId, entry.id);
      toast.success(`Added to collection`);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await libraryManager.updateEntry(entry.id, { status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
      entry.status = newStatus; // Optimistic update
      setShowStatus(false);
    } catch (e) {
      toast.error("Failed to update status");
    }
  };

  const handleToggleFavorite = async () => {
    const newFavState = await libraryManager.toggleFavorite(entry.id);
    entry.favorite = newFavState;
    setIsFavorite(newFavState);
    toast.success(newFavState ? "Added to favorites!" : "Removed from favorites");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent hideClose className="max-w-4xl p-0 overflow-hidden border-0 bg-[#0F0A18]/90 backdrop-blur-3xl shadow-2xl rounded-3xl">
        <DialogTitle className="sr-only">{title} Details</DialogTitle>
        
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative h-[85vh] max-h-[850px] flex flex-col"
            >
              {/* Top Right Actions */}
              <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
                <button 
                  onClick={async () => {
                    toast.info("Refreshing game info...");
                    try {
                      const updated = await libraryManager.convertToGame(entry.id);
                      if (updated && updated.metadata?.steamAppId) {
                        toast.success("Game info updated!");
                      } else {
                        toast.error("Could not find additional info on Steam.");
                      }
                    } catch (e) {
                      toast.error("Failed to refresh game.");
                    }
                  }}
                  className="p-2 rounded-full bg-black/40 text-white/70 hover:text-white hover:bg-black/60 transition-colors backdrop-blur-md"
                  title="Reload Metadata"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
                <button 
                  onClick={async () => {
                    if (window.confirm("Are you sure you want to remove this game from your library?")) {
                      await libraryManager.deleteEntry(entry.id);
                      toast.success("Game removed from library");
                      onClose();
                    }
                  }}
                  className="p-2 rounded-full bg-black/40 text-red-400/70 hover:text-red-400 hover:bg-black/60 transition-colors backdrop-blur-md"
                  title="Remove from Library"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={onClose}
                  className="p-2 rounded-full bg-black/40 text-white/70 hover:text-white hover:bg-black/60 transition-colors backdrop-blur-md"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Hero Header Section */}
              <div className="relative h-2/5 min-h-[250px] shrink-0 w-full overflow-hidden">
                {finalHeroUrl ? (
                  <img 
                    src={finalHeroUrl} 
                    alt="Hero" 
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : finalCoverUrl ? (
                  <div className="absolute inset-0 w-full h-full overflow-hidden bg-[#0F0A18]">
                    <img 
                      src={finalCoverUrl} 
                      alt="Hero Fallback" 
                      className="absolute inset-0 w-[120%] h-[120%] -left-[10%] -top-[10%] object-cover blur-xl opacity-60 scale-110"
                    />
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#311C46] to-[#0F0A18]" />
                )}
                
                {/* Grandient mask to fade into content */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0F0A18] via-[#0F0A18]/80 to-transparent" />
                
                {/* Header Content */}
                <div className="absolute bottom-0 left-0 w-full p-8 pb-4 flex items-end gap-6">
                  {/* Cover Art Thumbnail */}
                  {finalCoverUrl && (
                    <div className="w-28 rounded-xl overflow-hidden shadow-2xl border border-white/10 shrink-0 hidden sm:block">
                      <img 
                        src={finalCoverUrl} 
                        alt="Cover" 
                        className="w-full aspect-[2/3] object-cover" 
                        onError={() => setImageError(true)}
                      />
                    </div>
                  )}
                  
                  <div className="flex-1 pb-2">
                    <h1 className="text-4xl sm:text-5xl font-black text-white drop-shadow-lg leading-tight tracking-tight">
                      {title}
                    </h1>
                    
                      <div className="mt-4 flex flex-wrap items-center gap-3 relative">
                        <button 
                          onClick={async () => {
                            try {
                              const { invoke } = await import('@tauri-apps/api/core');
                              
                              if (entry.metadata?.steamAppId) {
                                toast.info("Launching via Steam...");
                                await invoke("launch_game", { pathOrUrl: `steam://rungameid/${entry.metadata.steamAppId}` });
                              } else if (entry.executablePath) {
                                toast.info("Launching local game...");
                                await invoke("launch_game", { pathOrUrl: entry.executablePath });
                              } else {
                                // Missing executable path, trigger file picker
                                toast.info("Please select the game's executable file (.exe)");
                                const { open } = await import('@tauri-apps/plugin-dialog');
                                const selected = await open({
                                  multiple: false,
                                  filters: [{ name: 'Executables', extensions: ['exe', 'bat', 'cmd'] }]
                                });
                                
                                if (selected && typeof selected === 'string') {
                                  await libraryManager.updateEntry(entry.id, { executablePath: selected });
                                  toast.success("Game path saved! Launching...");
                                  await invoke("launch_game", { pathOrUrl: selected });
                                  
                                  // Optimistic update for current session
                                  entry.executablePath = selected;
                                }
                              }
                            } catch (e) {
                              toast.error(`Failed to launch game: ${e}`);
                            }
                          }}
                          className="flex items-center gap-2 px-6 py-3 bg-white text-black font-bold rounded-full hover:bg-white/90 hover:scale-105 transition-all shadow-lg shadow-white/10"
                        >
                          <Play className="w-5 h-5 fill-current" />
                          Play Now
                        </button>
                        
                        {entry.metadata?.steamAppId && (
                          <button 
                            onClick={async () => {
                              try {
                                const { invoke } = await import('@tauri-apps/api/core');
                                await invoke("launch_game", { pathOrUrl: `steam://store/${entry.metadata!.steamAppId}` });
                              } catch (e) {
                                toast.error(`Could not open Steam: ${e}`);
                              }
                            }}
                            className="flex items-center gap-2 px-6 py-3 bg-[#171a21] text-white font-bold rounded-full hover:bg-[#2a475e] transition-all shadow-lg shadow-[#171a21]/50 border border-white/5"
                          >
                            <img src="https://upload.wikimedia.org/wikipedia/commons/8/83/Steam_icon_logo.svg" alt="Steam" className="w-5 h-5" />
                            Open in Steam
                          </button>
                        )}
                        
                        {entry.type === "game" && (!entry.metadata?.steamAppId || !heroUrl || !entry.metadata?.description) && (
                          <button 
                            onClick={async () => {
                              toast.info("Fetching game info... Please wait.");
                              try {
                                const updated = await libraryManager.convertToGame(entry.id);
                                if (updated && updated.metadata?.steamAppId) {
                                  toast.success("Game info updated!");
                                } else {
                                  toast.error("Could not find additional info on Steam.");
                                }
                              } catch (e) {
                                toast.error("Could not identify game automatically.");
                              }
                            }}
                            className="flex items-center gap-2 px-6 py-3 bg-purple-600/20 text-purple-300 font-bold rounded-full hover:bg-purple-600/40 transition-all border border-purple-500/30"
                          >
                            <Building2 className="w-5 h-5" />
                            {!entry.metadata?.steamAppId ? "Identify Game to Unlock Artwork" : "Refresh Missing Info"}
                          </button>
                        )}

                        <button 
                          onClick={handleToggleFavorite}
                          className={`flex items-center gap-2 px-4 py-3 bg-white/10 text-white font-bold rounded-full hover:bg-white/20 transition-all backdrop-blur-md ${isFavorite ? "text-pink-500 bg-pink-500/10 border border-pink-500/50" : ""}`}
                          title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                        >
                          <Heart className={`w-5 h-5 ${isFavorite ? "fill-current" : ""}`} />
                        </button>

                      {/* Collections Dropdown Trigger */}
                      <div className="relative">
                        <button 
                          onClick={() => setShowCollections(!showCollections)}
                          className="flex items-center gap-2 px-4 py-3 bg-white/10 text-white font-bold rounded-full hover:bg-white/20 transition-all backdrop-blur-md"
                          title="Add to Collection"
                        >
                          <FolderPlus className="w-5 h-5" />
                        </button>
                        
                        {/* Collections Popover */}
                        {showCollections && (
                          <div className="absolute top-full mt-2 left-0 w-56 bg-[#2D213F] border border-white/10 rounded-xl shadow-2xl z-50 p-2 py-3 max-h-64 overflow-y-auto custom-scrollbar">
                            <p className="text-xs font-bold text-white/50 uppercase tracking-widest px-3 mb-2">Add to Collection</p>
                            {!Array.isArray(collections) || collections.length === 0 ? (
                              <p className="text-sm text-white/40 px-3 py-2">No collections yet.</p>
                            ) : (
                              collections.map((col) => {
                                const isInCollection = Array.isArray(col.entries) && col.entries.some(e => e.entryId === entry.id);
                                return (
                                  <button
                                    key={col.id}
                                    onClick={() => handleToggleCollection(col.id, isInCollection)}
                                    className="w-full text-left flex items-center justify-between px-3 py-2 hover:bg-white/10 rounded-lg text-sm text-white transition-colors"
                                  >
                                    <span className="truncate">{col.name}</span>
                                    {isInCollection && <Check className="w-4 h-4 text-green-400 shrink-0" />}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>

                      {/* Status Dropdown Trigger */}
                      <div className="relative">
                        <button 
                          onClick={() => setShowStatus(!showStatus)}
                          className="flex items-center gap-2 px-4 py-3 bg-white/10 text-white font-bold rounded-full hover:bg-white/20 transition-all backdrop-blur-md"
                          title="Change Status"
                        >
                          <Tag className="w-5 h-5" />
                        </button>
                        
                        {/* Status Popover */}
                        {showStatus && (
                          <div className="absolute top-full mt-2 left-0 w-48 bg-[#2D213F] border border-white/10 rounded-xl shadow-2xl z-50 p-2 py-3">
                            <p className="text-xs font-bold text-white/50 uppercase tracking-widest px-3 mb-2">Status</p>
                            {["playing", "completed", "backlog", "dropped", "paused", "wishlist", "unplayed"].map((s) => (
                              <button
                                key={s}
                                onClick={() => handleStatusChange(s)}
                                className="w-full text-left flex items-center justify-between px-3 py-2 hover:bg-white/10 rounded-lg text-sm text-white transition-colors capitalize"
                              >
                                {s}
                                {entry.status === s && <Check className="w-4 h-4 text-green-400 shrink-0" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex px-8 border-b border-white/10">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`px-6 py-4 font-bold transition-colors ${activeTab === "overview" ? "text-white border-b-2 border-white" : "text-white/50 hover:text-white/80"}`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab("review")}
                  className={`px-6 py-4 font-bold transition-colors ${activeTab === "review" ? "text-white border-b-2 border-white" : "text-white/50 hover:text-white/80"}`}
                >
                  Review & Notes
                </button>
              </div>

              {/* Scrollable Content Section */}
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                
                {/* OVERVIEW TAB */}
                {activeTab === "overview" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Left Column (Main Info) */}
                    <div className="md:col-span-2 space-y-8">
                      {entry.metadata?.description && (
                        <section>
                          <h3 className="text-lg font-semibold text-white/90 mb-3">About</h3>
                          <p className="text-white/70 leading-relaxed text-sm sm:text-base">
                            {entry.metadata.description}
                          </p>
                        </section>
                      )}

                      {Array.isArray(entry.genres) && entry.genres.length > 0 && (
                        <section>
                          <h3 className="text-lg font-semibold text-white/90 mb-3">Genres</h3>
                          <div className="flex flex-wrap gap-2">
                            {entry.genres.map((g, idx) => {
                              const genreName = typeof g === 'string' ? g : (g?.genre?.name || g?.name || "Unknown");
                              return (
                                <span 
                                  key={idx}
                                  className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-sm text-white/80"
                                >
                                  {genreName}
                                </span>
                              );
                            })}
                          </div>
                        </section>
                      )}
                    </div>

                    {/* Right Column (Sidebar Stats) */}
                    <div className="space-y-6">
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/5 relative overflow-hidden">
                        {isActive && (
                          <div className="absolute top-0 right-0 p-3">
                            <span className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-3 text-white/60 mb-2">
                          <Clock className="w-5 h-5" />
                          <span className="font-medium">Playtime</span>
                        </div>
                        <p className="text-3xl font-bold text-white">{playtimeStr}</p>
                        {isActive && (
                          <p className="text-xs text-green-400 mt-1 font-medium tracking-wide uppercase">Currently Playing</p>
                        )}
                      </div>

                      <div className="space-y-4 pt-4 border-t border-white/10">
                        {releaseDate && (
                          <div>
                            <div className="flex items-center gap-2 text-white/50 text-sm mb-1">
                              <Calendar className="w-4 h-4" />
                              <span>Release Date</span>
                            </div>
                            <p className="text-white/90 font-medium">{releaseDate}</p>
                          </div>
                        )}
                        {entry.metadata?.developer && (
                          <div>
                            <div className="flex items-center gap-2 text-white/50 text-sm mb-1">
                              <Building2 className="w-4 h-4" />
                              <span>Developer</span>
                            </div>
                            <p className="text-white/90 font-medium">{entry.metadata.developer}</p>
                          </div>
                        )}
                        {entry.metadata?.publisher && (
                          <div>
                            <div className="flex items-center gap-2 text-white/50 text-sm mb-1">
                              <Building2 className="w-4 h-4" />
                              <span>Publisher</span>
                            </div>
                            <p className="text-white/90 font-medium">{entry.metadata.publisher}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* REVIEW TAB */}
                {activeTab === "review" && (
                  <div className="flex flex-col h-full animate-in fade-in duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold text-white">Your Review</h3>
                      {!isEditingReview ? (
                        <button 
                          onClick={() => setIsEditingReview(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm font-bold text-white"
                        >
                          <Edit3 className="w-4 h-4" />
                          {entry.review ? "Edit Review" : "Write Review"}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          {entry.review && (
                            <button 
                              onClick={handleDeleteReview}
                              className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                              title="Delete Review"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                          <button 
                            onClick={() => setIsEditingReview(false)}
                            className="px-4 py-2 hover:bg-white/10 rounded-lg transition-colors text-sm font-bold text-white/70"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={handleSaveReview}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors text-sm font-bold text-white shadow-lg shadow-purple-500/20"
                          >
                            Save Review
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditingReview ? (
                      <div className="flex-1 flex flex-col gap-6">
                        {/* Interactive Star Rating */}
                        <div>
                          <p className="text-sm font-bold text-white/50 mb-2">Rating</p>
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                onClick={() => setReviewRating(star)}
                                className={`transition-transform hover:scale-110 focus:outline-none ${reviewRating >= star ? "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" : "text-white/20 hover:text-white/40"}`}
                              >
                                <Star className="w-8 h-8 fill-current" />
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Markdown Textarea */}
                        <div className="flex-1 min-h-[200px] flex flex-col">
                          <p className="text-sm font-bold text-white/50 mb-2">Review Content (Markdown)</p>
                          <textarea
                            value={reviewContent}
                            onChange={(e) => setReviewContent(e.target.value)}
                            placeholder="Write your thoughts here..."
                            className="flex-1 w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 resize-none custom-scrollbar"
                          />
                        </div>
                      </div>
                    ) : (
                      // Read-Only Review State
                      <div className="flex-1">
                        {entry.review ? (
                          <div className="space-y-6">
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star 
                                  key={star} 
                                  className={`w-6 h-6 ${entry.review!.rating! >= star ? "text-yellow-400 fill-current drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" : "text-white/10 fill-current"}`} 
                                />
                              ))}
                            </div>
                            <div className="prose prose-invert prose-purple max-w-none">
                              {/* Extremely simple markdown rendering fallback. Normally use a library like react-markdown */}
                              {(entry.review.content || "").split('\n').map((line, i) => (
                                <p key={i} className="text-white/80 leading-relaxed min-h-[1rem]">{line}</p>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-center p-12 bg-white/5 rounded-2xl border border-dashed border-white/10">
                            <Star className="w-12 h-12 text-white/20 mb-4" />
                            <h4 className="text-lg font-bold text-white/70 mb-2">No Review Yet</h4>
                            <p className="text-sm text-white/40 max-w-sm mb-6">
                              You haven't rated or reviewed {title} yet. Add your thoughts to track your opinions over time.
                            </p>
                            <button 
                              onClick={() => setIsEditingReview(true)}
                              className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-sm font-bold text-white"
                            >
                              Write a Review
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
