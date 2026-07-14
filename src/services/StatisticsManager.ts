import { libraryManager } from "./LibraryManager";

export interface GenreStat {
  name: string;
  playtimeSeconds: number;
  count: number;
}

export interface ActivityStat {
  date: string; // YYYY-MM-DD
  playtimeSeconds: number;
}

export interface GlobalStats {
  totalGamesTracked: number;
  totalPlaytimeSeconds: number;
  averageSessionSeconds: number;
  playtimeByGenre: GenreStat[];
  activityLast30Days: ActivityStat[];
}

export class StatisticsManager {
  async getGlobalStats(): Promise<GlobalStats> {
    try {
      const allEntries = await libraryManager.getAllEntries();
      const entries = allEntries.filter(e => e.type === "game");
      
      const totalGamesTracked = entries.length;

      const totalPlaytimeSeconds = entries.reduce((acc, game) => acc + (game.playtimeTotal || 0), 0);
      
      const sessions = entries.flatMap((entry) => entry.sessions || []).filter((session) => !session.isActive);
      const averageSessionSeconds = sessions.length
        ? Math.round(sessions.reduce((sum, session) => sum + (session.effectiveSeconds + session.idleSeconds), 0) / sessions.length)
        : 0;

      const genrePlaytimeMap = new Map<string, number>();
      const genreCountMap = new Map<string, number>();

      for (const entry of entries) {
        const rawGenres = entry.metadata?.genres || (Array.isArray(entry.genres) ? entry.genres : []);

        if (!rawGenres || rawGenres.length === 0) {
          const val = genrePlaytimeMap.get("Uncategorized") || 0;
          genrePlaytimeMap.set("Uncategorized", val + (entry.playtimeTotal || 0));
          genreCountMap.set("Uncategorized", (genreCountMap.get("Uncategorized") || 0) + 1);
          continue;
        }

        const timePerGenre = Math.round((entry.playtimeTotal || 0) / rawGenres.length);
        
        for (const g of rawGenres) {
          let genreName = typeof g === 'string' ? g : (g?.genre?.name || g?.name || "Unknown");
          if (!genreName || genreName === "Unknown") continue;
          
          // Clean up genre names (trim spaces and ensure consistent casing)
          genreName = genreName.trim();
          genreName = genreName.charAt(0).toUpperCase() + genreName.slice(1);
          
          const val = genrePlaytimeMap.get(genreName) || 0;
          genrePlaytimeMap.set(genreName, val + timePerGenre);
          genreCountMap.set(genreName, (genreCountMap.get(genreName) || 0) + 1);
        }
      }

      const playtimeByGenre: GenreStat[] = Array.from(genreCountMap.entries())
        .map(([name, count]) => ({ name, count, playtimeSeconds: genrePlaytimeMap.get(name) || 0 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const activityMap = new Map<string, number>();
      
      for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        activityMap.set(dateStr, 0);
      }

      for (const session of entries.flatMap((entry) => entry.sessions || [])) {
        const day = session.startedAt.slice(0, 10);
        if (activityMap.has(day)) {
          activityMap.set(day, (activityMap.get(day) || 0) + (session.effectiveSeconds + session.idleSeconds));
        }
      }

      const activityLast30Days: ActivityStat[] = Array.from(activityMap.entries())
        .map(([date, playtimeSeconds]) => ({ date, playtimeSeconds }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        totalGamesTracked,
        totalPlaytimeSeconds,
        averageSessionSeconds,
        playtimeByGenre,
        activityLast30Days,
      };

    } catch (error) {
      console.error("[StatisticsManager] Failed to fetch stats:", error);
      throw error;
    }
  }
}

export const statisticsManager = new StatisticsManager();
