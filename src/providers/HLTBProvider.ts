const CORS_PROXY = "https://corsproxy.io/?";
const HLTB_URL = "https://howlongtobeat.com/api/search";
const HLTB_REFERER = "https://howlongtobeat.com/";

export interface HLTBResponse {
  color: string;
  count: number;
  data: HLTBGame[];
}

export interface HLTBGame {
  game_id: number;
  game_name: string;
  game_name_date: number;
  profile_dev: string;
  profile_pub: string;
  release_world: number;
  comp_main: number;
  comp_plus: number;
  comp_100: number;
  comp_all: number;
  comp_main_count: number;
  comp_plus_count: number;
  comp_100_count: number;
  comp_all_count: number;
  invested_co: number;
  invested_mp: number;
  invested_co_count: number;
  invested_mp_count: number;
}

class HLTBProvider {
  async getGamePlaytime(gameName: string): Promise<number | null> {
    try {
      const payload = {
        searchType: "games",
        searchTerms: gameName.split(" "),
        searchPage: 1,
        size: 20,
        searchOptions: {
          games: {
            userId: 0,
            platform: "",
            sortCategory: "popular",
            rangeCategory: "main",
            rangeTime: { min: null, max: null },
            gameplay: { perspective: "", flow: "", genre: "" },
            modifier: ""
          },
          users: { sortCategory: "postcount" },
          lists: { sortCategory: "follows" },
          filter: "",
          sort: 0,
          randomizer: 0
        }
      };

      const res = await fetch(`${CORS_PROXY}${encodeURIComponent(HLTB_URL)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "origin": "https://howlongtobeat.com",
          "referer": "https://howlongtobeat.com/"
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) return null;
      
      const json: HLTBResponse = await res.json();
      if (!json.data || json.data.length === 0) return null;

      const normalizedQuery = gameName.toLowerCase().replace(/[^a-z0-9]/g, "");
      const match = json.data.find(g => g.game_name.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedQuery) || json.data[0];

      // HLTB stores times in seconds or hours? Actually, HLTB api returns `comp_main` in seconds! 
      // For example, a 10 hour game might return 36000.
      if (match && match.comp_main > 0) {
        return match.comp_main; // This is seconds
      }
      
      return null;
    } catch (e) {
      console.error("HLTB fetch error:", e);
      return null;
    }
  }
}

export const hltbProvider = new HLTBProvider();
