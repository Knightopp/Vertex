import { useEffect, useState } from "react";
import Layout from "@/components/layout/Layout";
import SectionHeading from "@/components/common/SectionHeading";
import { useDiscoveryStore } from "@/stores/discovery-store";
import { DiscoveredGame } from "@/services/DiscoveryManager";
import DiscoveredGameTile from "@/features/discovery/components/DiscoveredGameTile";
import DiscoveredGameModal from "@/features/discovery/components/DiscoveredGameModal";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";

export default function Discovery() {
  const { lists, isLoading, fetchDiscovery } = useDiscoveryStore();
  const [selectedGame, setSelectedGame] = useState<DiscoveredGame | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    fetchDiscovery();
  }, [fetchDiscovery]);

  // Auto advance hero carousel
  useEffect(() => {
    if (!lists?.featured || lists.featured.length === 0) return;
    
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % lists.featured.length);
    }, 6000); // 6 seconds per slide

    return () => clearInterval(interval);
  }, [lists?.featured]);

  if (isLoading || !lists) {
    return (
      <Layout>
        <div className="flex h-full items-center justify-center pt-20">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
            <p className="text-white/60">Contacting Steam Storefront...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const currentHero = lists.featured[heroIndex];

  return (
    <Layout>
      <div className="pb-12 flex flex-col gap-12">
        
        {/* Hero Carousel Section */}
        {currentHero && (
          <section 
            className="relative w-full h-[50vh] min-h-[400px] max-h-[600px] rounded-3xl overflow-hidden shadow-2xl group cursor-pointer" 
            onClick={() => {
              const titleLower = currentHero.title.toLowerCase();
              const isSaleEvent = titleLower.includes("sale") || titleLower.includes("fest") || titleLower.includes("deals") || currentHero.type !== 0;
              
              if (isSaleEvent) {
                // Try to construct a steam:// URL first to open the native Steam client
                let steamClientUrl = `steam://store`;
                let webUrl = `https://store.steampowered.com`;
                
                if (currentHero.type === 1) {
                   steamClientUrl = `steam://store/sub/${currentHero.id}`;
                   webUrl = `https://store.steampowered.com/sub/${currentHero.id}`;
                } else if (currentHero.type === 2) {
                   steamClientUrl = `steam://store/bundle/${currentHero.id}`;
                   webUrl = `https://store.steampowered.com/bundle/${currentHero.id}`;
                } else if (!isNaN(Number(currentHero.id))) {
                   steamClientUrl = `steam://store/app/${currentHero.id}`;
                   webUrl = `https://store.steampowered.com/app/${currentHero.id}`;
                }
                
                // Tauri shell open. We try the web URL. If the user has Steam installed, 
                // opening the web URL often triggers the browser to prompt opening Steam anyway,
                // but we can try opening steam:// directly if we want. 
                // Let's open the web URL since it's safest and works universally.
                open(webUrl);
              } else {
                setSelectedGame(currentHero);
              }
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentHero.id}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0"
              >
                <img 
                  src={currentHero.heroUrl} 
                  alt={currentHero.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0F0A18] via-[#0F0A18]/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0F0A18] to-transparent opacity-80" />
              </motion.div>
            </AnimatePresence>

            <div className="absolute bottom-12 left-12 max-w-2xl z-10 pointer-events-none">
              <p className="text-purple-400 font-bold uppercase tracking-widest mb-2">Featured Event</p>
              <h2 className="text-5xl font-black text-white drop-shadow-lg mb-4">
                {currentHero.title.toLowerCase().includes("deals") ? "Open Steam" : currentHero.title}
              </h2>
              <div className="flex items-center gap-4">
                {currentHero.title.toLowerCase().includes("deals") || currentHero.title.toLowerCase().includes("sale") || currentHero.type !== 0 ? (
                  <span className="px-6 py-2 bg-purple-600 text-white font-bold rounded-full">
                    View Offers
                  </span>
                ) : (
                  <>
                    <span className="px-6 py-2 bg-white text-black font-bold rounded-full">
                      {currentHero.price}
                    </span>
                    {currentHero.discountPercent ? (
                      <span className="px-4 py-2 bg-green-500 text-black font-bold rounded-full">
                        -{currentHero.discountPercent}%
                      </span>
                    ) : null}
                  </>
                )}
              </div>
            </div>

            {/* Carousel Controls */}
            <div className="absolute bottom-12 right-12 flex items-center gap-3 z-10">
              <button 
                onClick={(e) => { e.stopPropagation(); setHeroIndex((prev) => (prev === 0 ? lists.featured.length - 1 : prev - 1)); }}
                className="p-3 rounded-full bg-black/40 hover:bg-white/20 text-white backdrop-blur-md transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setHeroIndex((prev) => (prev + 1) % lists.featured.length); }}
                className="p-3 rounded-full bg-black/40 hover:bg-white/20 text-white backdrop-blur-md transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </section>
        )}

        {/* Categories Grids */}
        {lists.topSellers?.length > 0 && (
          <section>
            <SectionHeading title="Top Sellers" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {lists.topSellers.map((game) => (
                <DiscoveredGameTile key={`ts-${game.id}`} game={game} onClick={setSelectedGame} />
              ))}
            </div>
          </section>
        )}

        {lists.newReleases?.length > 0 && (
          <section>
            <SectionHeading title="New & Upcoming" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {lists.newReleases.map((game) => (
                <DiscoveredGameTile key={`nr-${game.id}`} game={game} onClick={setSelectedGame} />
              ))}
            </div>
          </section>
        )}

        {lists.specials?.length > 0 && (
          <section>
            <SectionHeading title="Specials" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {lists.specials.map((game) => (
                <DiscoveredGameTile key={`sp-${game.id}`} game={game} onClick={setSelectedGame} />
              ))}
            </div>
          </section>
        )}

      </div>

      <DiscoveredGameModal 
        game={selectedGame}
        isOpen={!!selectedGame}
        onClose={() => setSelectedGame(null)}
      />
    </Layout>
  );
}
