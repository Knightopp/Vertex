import { useEffect, useState, useMemo } from "react";
import Layout from "@/components/layout/Layout";
import GameTile from "@/features/library/components/GameTile";
import GameDetailModal from "@/features/library/components/GameDetailModal";
import DiscoveredGameTile from "@/features/discovery/components/DiscoveredGameTile";
import DiscoveredGameModal from "@/features/discovery/components/DiscoveredGameModal";
import SectionHeading from "@/components/common/SectionHeading";
import { useLibraryStore } from "@/stores/library-store";
import { useDiscoveryStore } from "@/stores/discovery-store";
import { LibraryEntryWithRelations } from "@/services/LibraryManager";
import { DiscoveredGame } from "@/services/DiscoveryManager";
import { useSettingsStore } from "@/stores/settings-store";
import { SortableGrid } from "@/components/common/SortableGrid";
import { NavLink } from "react-router-dom";
import { ArrowRight, Play, Clock } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import { useTrackingStore } from "@/stores/tracking-store";

const formatSessionTime = (seconds: number) => {
  if (!seconds) return "00:00:00";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function Index() {
  const { entries, fetchLibrary } = useLibraryStore();
  const { lists, fetchDiscovery } = useDiscoveryStore();
  const { settings, updateSettings } = useSettingsStore();
  const { activeSessions } = useTrackingStore();
  const [selectedGame, setSelectedGame] = useState<LibraryEntryWithRelations | null>(null);
  const [selectedDiscoveredGame, setSelectedDiscoveredGame] = useState<DiscoveredGame | null>(null);

  // Derived slices for the dashboard
  const libraryGames = entries.filter(e => e.type === "game" && e.status !== "wishlist");

  useEffect(() => {
    fetchLibrary();
    fetchDiscovery();
  }, [fetchLibrary, fetchDiscovery]);

  useEffect(() => {
    if (selectedGame) {
      const updated = libraryGames.find(e => e.id === selectedGame.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedGame)) {
        setSelectedGame(updated);
      }
    }
  }, [libraryGames, selectedGame]);

  const playingNow = libraryGames
    .filter((entry) => entry.type === "game" && entry.isRunning)
    .sort((a, b) => {
      const sessionA = activeSessions[a.id];
      const sessionB = activeSessions[b.id];
      const timeA = sessionA ? new Date(sessionA.startedAt).getTime() : 0;
      const timeB = sessionB ? new Date(sessionB.startedAt).getTime() : 0;
      return timeB - timeA;
    });

  let recentlyPlayed = [...libraryGames]
    .sort((a, b) => {
      const sessionA = activeSessions[a.id];
      const sessionB = activeSessions[b.id];
      const timeA = a.isRunning ? (sessionA ? new Date(sessionA.startedAt).getTime() : Date.now()) : (a.lastPlayedAt ? new Date(a.lastPlayedAt).getTime() : 0);
      const timeB = b.isRunning ? (sessionB ? new Date(sessionB.startedAt).getTime() : Date.now()) : (b.lastPlayedAt ? new Date(b.lastPlayedAt).getTime() : 0);
      return timeB - timeA;
    })
    .slice(0, 5);

  // Apply custom manual sorting order for Recently Played (Pinned Favorites)
  // Removed: Recently Played should be strictly chronological.

  // Highly Anticipated uses the coming_soon list from Steam API
  const anticipatedGames = lists?.newReleases.slice(0, 5) || [];

  // Trending uses actual global top sellers from Steam API
  let trending = lists?.topSellers.slice(0, 6) || [];
  if (trending.length > 0 && trending.length < 6 && lists?.specials) {
    // Pad with specials if top_sellers is mysteriously short
    const uniqueSpecials = lists.specials.filter(s => !trending.some(t => t.id === s.id));
    trending = [...trending, ...uniqueSpecials].slice(0, 6);
  }

  const featuredGame = lists?.featured?.[0] || lists?.specials?.[0] || trending?.[0] || anticipatedGames?.[0];

  // Dynamically compute top genres based on user's actual library
  const topGenres = useMemo(() => {
    const defaultGenres = ["Action", "RPG", "Adventure", "Strategy", "Shooter", "Indie"];
    const counts: Record<string, number> = {};
    
    // Initialize defaults to 0 so we always have a clean grid
    defaultGenres.forEach(g => counts[g] = 0);

    entries
      .filter(e => e.status !== "wishlist")
      .forEach(game => {
        const rawGenres = game.metadata?.genres || (Array.isArray(game.genres) ? game.genres : []);
        const genres: string[] = rawGenres.map((g: any) => typeof g === 'string' ? g : (g?.genre?.name || g?.name));
        
        genres.forEach(g => {
          if (!g) return;
          counts[g] = (counts[g] || 0) + 1;
        });
      });

    // Sort by count descending, then alphabetically
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6);
  }, [entries]);

  let favorites = libraryGames.filter(e => e.favorite);
  
  // Apply custom manual sorting order for Favorites
  if (settings.favoriteGamesOrder && settings.favoriteGamesOrder.length > 0) {
    const pinnedFavs = settings.favoriteGamesOrder.map(id => favorites.find(g => g.id === id)).filter(Boolean) as LibraryEntryWithRelations[];
    const unpinnedFavs = favorites.filter(g => !settings.favoriteGamesOrder.includes(g.id));
    favorites = [...pinnedFavs, ...unpinnedFavs];
  }

  const favoritesToShow = favorites.slice(0, 5);

  const handleFavoritesReorder = async (newOrder: LibraryEntryWithRelations[]) => {
    await updateSettings({ favoriteGamesOrder: newOrder.map(g => g.id) });
  };

  // Helper to handle empty states gracefully
  const renderGrid = (items: LibraryEntryWithRelations[], limit: number, viewAllOverlay?: { to: string; label: string }) => {
    if (items.length === 0) {
      return (
        <div className="flex h-40 w-full items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5">
          <p className="text-sm text-white/40">No games found.</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((entry, index) => (
          <GameTile 
            key={entry.id} 
            entry={entry} 
            onClick={setSelectedGame} 
            viewAllOverlay={(index === items.length - 1 && viewAllOverlay) ? viewAllOverlay : undefined}
          />
        ))}
        {/* Fill remainder with empty tiles if we want the grid structure strictly maintained */}
        {Array.from({ length: Math.max(0, limit - items.length) }).map((_, i) => (
          <div key={`empty-${i}`} className="hidden xl:block opacity-20 pointer-events-none">
            <GameTile />
          </div>
        ))}
      </div>
    );
  };

  return (
    <Layout>
      <div className="pt-2">
        <div className="flex flex-col gap-12 xl:flex-row xl:gap-16">
          {/* Left Column */}
          <div className="flex min-w-0 flex-1 flex-col gap-12">
            <section>
              <SectionHeading title="Recently Played" showFilter />
              {recentlyPlayed.length > 0 ? (
                renderGrid(recentlyPlayed, 5, { to: "/library?collection=smart_all", label: "View All" })
              ) : (
                renderGrid([], 5)
              )}
            </section>

            <section>
              <SectionHeading title="Favorites" />
              {favoritesToShow.length > 0 ? (
                <SortableGrid
                  items={favoritesToShow}
                  keyExtractor={(item) => item.id}
                  onReorder={handleFavoritesReorder}
                  renderItem={(item, index) => (
                    <GameTile 
                      entry={item} 
                      onClick={setSelectedGame} 
                      viewAllOverlay={(index === favoritesToShow.length - 1) ? { to: "/library?collection=smart_favorites", label: "View All" } : undefined}
                    />
                  )}
                />
              ) : (
                <div className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 bg-white/5">
                  <p className="text-sm text-white/40">You haven't favorited any games yet.</p>
                  <p className="text-xs text-white/30">Click the heart icon in a game's details to add it here.</p>
                </div>
              )}
            </section>

            <section>
              <SectionHeading title="Top Genres" />
              <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-3">
                {topGenres.map(([genre, count]) => (
                  <button
                    key={genre as string}
                    className="flex flex-col items-center justify-center h-14 w-full rounded-2xl bg-[#111111] border border-white/10 shadow-md transition-all hover:scale-105 hover:bg-white hover:text-black font-semibold text-white/90 group"
                  >
                    <span>{genre as string}</span>
                    <span className="text-xs text-white/50 group-hover:text-black/50 font-medium">
                      {count} {count === 1 ? 'Game' : 'Games'}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <SectionHeading title="Top Wishlisted" />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {anticipatedGames.length > 0 ? (
                  anticipatedGames.map((game) => (
                    <DiscoveredGameTile key={game.id} game={game} onClick={setSelectedDiscoveredGame} />
                  ))
                ) : (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="opacity-20 pointer-events-none"><GameTile /></div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Right Column */}
          <div className="flex min-w-0 flex-col gap-12 xl:w-[360px] 2xl:w-[400px] xl:sticky xl:top-2 h-fit">
            
            {playingNow.length > 0 && (
              <section className="flex flex-col gap-4">
                <SectionHeading title="Now Playing" />
                <div className="flex flex-col gap-4">
                  {playingNow.map(game => {
                    const session = activeSessions[game.id];
                    const coverImage = game.images?.find((img) => img.type === "cover")?.localPath || game.images?.find((img) => img.type === "cover")?.remoteUrl;
                    const bannerImage = game.images?.find((img) => img.type === "banner")?.localPath || game.images?.find((img) => img.type === "banner")?.remoteUrl;
                    
                    return (
                      <div 
                        key={game.id}
                        onClick={() => setSelectedGame(game)}
                        className="relative w-full rounded-2xl overflow-hidden border border-white/30 shadow-[0_0_30px_rgba(255,255,255,0.1)] cursor-pointer group bg-[#111111] transition-all hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(255,255,255,0.2)]"
                      >
                        <div className="absolute inset-0 bg-cover bg-center opacity-40 blur-xl scale-110 transition-transform duration-700 group-hover:scale-125" style={{ backgroundImage: `url('${bannerImage || coverImage}')` }} />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/80 to-transparent" />
                        
                        {/* Animated gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-white/10 mix-blend-overlay" />

                        <div className="relative z-10 p-6 flex items-center gap-5">
                          {coverImage ? (
                            <img src={coverImage} alt={game.title} className="w-16 h-24 object-cover rounded-xl shadow-2xl border border-white/10" />
                          ) : (
                            <div className="w-16 h-24 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                              <Play className="w-8 h-8 text-white/20" />
                            </div>
                          )}
                          <div className="flex flex-col flex-1 min-w-0">
                            <h4 className="text-white font-black text-2xl leading-tight truncate drop-shadow-xl mb-1">{game.title}</h4>
                            
                            <div className="flex flex-wrap items-center gap-3 mt-1">
                              <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/10 border border-white/20 backdrop-blur-md">
                                <span className="w-2 h-2 rounded-full bg-white animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                                <span className="text-xs font-black text-white uppercase tracking-widest drop-shadow-md">Active</span>
                              </div>
                              
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 backdrop-blur-md">
                                <Clock className="w-3.5 h-3.5 text-white/70" />
                                <span className="text-sm font-bold font-mono tracking-wider text-white">
                                  {session ? formatSessionTime(game.playtimeTotal + session.effectiveSeconds) : "Last Played"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <section>
              <SectionHeading title="Trending Now" showFilter />
              <div className="grid grid-cols-3 gap-4">
                {trending.length > 0 ? (
                  trending.map((game) => (
                    <DiscoveredGameTile key={game.id} game={game} onClick={setSelectedDiscoveredGame} />
                  ))
                ) : (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="opacity-20 pointer-events-none"><GameTile /></div>
                  ))
                )}
              </div>
            </section>
            
            {/* Seasonal Event / Major Sale Banner */}
            <section className="flex flex-col mt-auto pt-8">
              <div 
                className="h-[300px] w-full rounded-2xl bg-[#111111] shadow-xl p-8 flex flex-col justify-end relative overflow-hidden group cursor-pointer border border-white/10"
                onClick={() => open("https://store.steampowered.com/search/?specials=1")}
              >
                <img 
                  src="https://images.unsplash.com/photo-1605810230434-7631ac76ec81?q=80&w=800" 
                  alt="Summer Sale" 
                  className="absolute inset-0 w-full h-full object-cover opacity-60 transition-transform duration-1000 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/80 to-transparent transition-colors group-hover:via-[#09090B]/60" />
                <div className="relative z-10">
                  <p className="text-xs font-bold text-white/70 uppercase tracking-widest mb-2 drop-shadow-lg">
                    Special Event
                  </p>
                  <h3 className="text-3xl font-black text-white leading-tight drop-shadow-xl mb-1">Summer Sale</h3>
                  <p className="text-sm text-white/60 mb-4 font-medium">Up to 90% off on thousands of games across the store.</p>
                  <div className="flex items-center gap-4">
                    <button className="px-6 py-2 bg-white text-black font-bold rounded-full hover:bg-white/90 transition-transform group-hover:scale-105 shadow-xl">
                      Open Steam
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <GameDetailModal 
        entry={selectedGame}
        isOpen={!!selectedGame}
        onClose={() => setSelectedGame(null)}
      />
      <DiscoveredGameModal 
        game={selectedDiscoveredGame}
        isOpen={!!selectedDiscoveredGame}
        onClose={() => setSelectedDiscoveredGame(null)}
      />
    </Layout>
  );
}
