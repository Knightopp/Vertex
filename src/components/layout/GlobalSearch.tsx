import { useState, useEffect, useRef } from "react";
import { SearchIcon } from "@/components/icons";
import { steamProvider } from "@/providers/SteamProvider";
import type { GameSearchResult } from "@/providers/types";
import { useDebounce } from "@/hooks/use-debounce";
import { Loader2, Gamepad2 } from "lucide-react";
import { libraryManager } from "@/services/LibraryManager";
import { toast } from "sonner";
import { eventBus } from "@/services/EventBus";

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GameSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  
  const debouncedQuery = useDebounce(query, 500);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    async function doSearch() {
      setIsSearching(true);
      try {
        const hits = await steamProvider.search(debouncedQuery);
        setResults(hits);
      } catch (e) {
        console.error("Search failed:", e);
      } finally {
        setIsSearching(false);
      }
    }

    doSearch();
  }, [debouncedQuery]);

  const handleAddGame = async (game: GameSearchResult, status: "backlog" | "wishlist") => {
    try {
      const entryId = await libraryManager.createEntry({
        title: game.title,
        executableName: "", // Dummy exec since it's an online add
        executablePath: "",
        type: "game",
        status: status,
        coverPath: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${game.providerId}/library_600x900_2x.jpg`,
      });

      // Update metadata to force Steam app ID
      await libraryManager.updateEntry(entryId.id, {
        metadata: {
          steamAppId: Number(game.providerId),
          description: "", // Steam provider will enrich later
          developer: "",
          publisher: "",
        }
      });
      
      // Trigger metadata enrichment manually or via event bus
      eventBus.emit("metadata:updated", { entryId: entryId.id, source: "steam" });
      
      toast.success(`Added ${game.title} to ${status}`);
      setShowDropdown(false);
      setQuery("");
    } catch (e) {
      toast.error(`Failed to add ${game.title}`);
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full max-w-[340px]">
      <div className="flex w-full items-center gap-3 rounded-full bg-white/5 px-5 py-2.5 transition-colors focus-within:bg-white/10 border border-white/5 relative z-50">
        <SearchIcon size={18} className="shrink-0 text-white/40" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Search games to add..."
          aria-label="Search games"
          className="w-full bg-transparent text-sm font-medium tracking-wide text-white placeholder:text-white/30 focus:outline-none"
        />
        {isSearching && <Loader2 className="w-4 h-4 animate-spin text-white/50" />}
      </div>

      {showDropdown && (query.trim().length > 0) && (
        <div className="absolute top-full mt-2 w-full bg-[#111111] border border-white/10 rounded-2xl shadow-2xl z-40 overflow-hidden flex flex-col max-h-[400px]">
          {isSearching && results.length === 0 ? (
            <div className="p-8 text-center text-white/50 text-sm">Searching Steam database...</div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-white/50 text-sm">No results found for "{query}"</div>
          ) : (
            <div className="overflow-y-auto custom-scrollbar">
              {results.map((result) => (
                <div key={result.providerId} className="flex items-center gap-3 p-3 border-b border-white/5 hover:bg-white/5 transition-colors group">
                  <div className="w-12 h-[34px] shrink-0 rounded overflow-hidden bg-white/5 flex items-center justify-center border border-white/10">
                    {!imgErrors[result.providerId] ? (
                      <img 
                        src={`https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${result.providerId}/capsule_sm_120.jpg`} 
                        alt={result.title}
                        className="w-full h-full object-cover"
                        onError={() => setImgErrors(prev => ({...prev, [result.providerId]: true}))}
                      />
                    ) : (
                      <Gamepad2 className="w-4 h-4 text-white/20" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{result.title}</p>
                    <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleAddGame(result, "backlog")}
                        className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white"
                      >
                        Library
                      </button>
                      <button 
                        onClick={() => handleAddGame(result, "wishlist")}
                        className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-purple-500/20 hover:bg-purple-500/40 text-purple-300"
                      >
                        Wishlist
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
