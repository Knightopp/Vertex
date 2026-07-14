import { useEffect, useMemo } from "react";
import Layout from "@/components/layout/Layout";
import SectionHeading from "@/components/common/SectionHeading";
import { useStatisticsStore } from "@/stores/statistics-store";
import { useLibraryStore } from "@/stores/library-store";
import { useCollectionsStore } from "@/stores/collections-store";
import { useTrackingStore } from "@/stores/tracking-store";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts";
import { Clock, Gamepad2, Timer } from "lucide-react";

const formatPlaytime = (seconds: number) => {
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1)} hrs`;
};

// Monochrome shades for charts
const COLORS = ['#ffffff', '#f4f4f5', '#e4e4e7', '#d4d4d8', '#a1a1aa', '#71717a', '#52525b', '#3f3f46', '#27272a'];

const formatMinutesTooltip = (value: number) => {
  if (value < 1) return [`${Math.round(value * 60)} secs`, 'Playtime'];
  if (value < 60) return [`${Math.round(value)} mins`, 'Playtime'];
  const h = Math.floor(value / 60);
  const m = Math.round(value % 60);
  return [`${h}h ${m}m`, 'Playtime'];
};

const formatMinutesAxis = (val: number) => {
  if (val < 1 && val > 0) return `${Math.round(val * 60)}s`;
  if (val < 60) return `${Math.round(val)}m`;
  return `${(val / 60).toFixed(1)}h`;
};

export default function Stats() {
  const { stats, isLoading, fetchStats } = useStatisticsStore();
  const { entries, fetchLibrary } = useLibraryStore();
  const { collections, fetchCollections } = useCollectionsStore();
  const { activeSessions } = useTrackingStore();

  useEffect(() => {
    fetchStats();
    fetchLibrary();
    fetchCollections();
  }, [fetchStats, fetchLibrary, fetchCollections]);

  const collectionStats = useMemo(() => {
    const statuses = ["playing", "completed", "backlog", "dropped", "paused", "unplayed", "wishlist"];
    const statusData = statuses.map(status => {
      const filtered = entries.filter(e => e.status === status);
      return {
        name: status.charAt(0).toUpperCase() + status.slice(1),
        count: filtered.length
      };
    }).filter(s => s.count > 0);

    const customData = collections.map(col => {
      const colEntries = entries.filter(e => col.entries.some(ce => ce.entryId === e.id));
      return {
        name: col.name,
        count: colEntries.length
      };
    }).filter(s => s.count > 0);

    return [...statusData, ...customData];
  }, [entries, collections]);

  const formattedActivity = useMemo(() => {
    if (!stats) return [];

    const todayStr = new Date().toISOString().split('T')[0];
    let liveSecondsToday = 0;
    
    // Only include live time from games, not background applications
    for (const session of Object.values(activeSessions)) {
      if (!session) continue;
      const entry = entries.find(e => e.id === session.entryId);
      if (entry && entry.type === "game") {
        const sessionDay = new Date(session.startedAt).toISOString().split('T')[0];
        if (sessionDay === todayStr) {
          liveSecondsToday += session.effectiveSeconds + (session.idleSeconds || 0);
        }
      }
    }

    return stats.activityLast30Days.map(stat => {
      const d = new Date(stat.date);
      let totalSeconds = stat.playtimeSeconds;
      
      if (stat.date === todayStr) {
        totalSeconds += liveSecondsToday;
      }

      return {
        name: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        minutes: totalSeconds / 60
      };
    });
  }, [stats, activeSessions]);

  const formattedGenres = useMemo(() => {
    if (!stats) return [];
    return stats.playtimeByGenre.map(stat => ({
      name: stat.name,
      count: stat.count,
      minutes: stat.playtimeSeconds / 60
    }));
  }, [stats]);

  if (isLoading || !stats) {
    return (
      <Layout>
        <div className="flex h-full items-center justify-center pt-20">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
            <p className="text-white/60">Crunching numbers...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="pt-2 pb-12 flex flex-col gap-12">
        {/* Top Summary Cards */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-6 rounded-3xl bg-[#111111] border border-white/5 shadow-xl relative overflow-hidden"
            >
              <div className="absolute -right-6 -top-6 text-white/5">
                <Clock className="w-32 h-32" />
              </div>
              <p className="text-white/60 font-medium mb-1 relative z-10">Total Playtime</p>
              <p className="text-4xl font-black text-white relative z-10">{formatPlaytime(stats.totalPlaytimeSeconds)}</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-6 rounded-3xl bg-[#111111] border border-white/5 shadow-xl relative overflow-hidden"
            >
              <div className="absolute -right-6 -top-6 text-white/5">
                <Gamepad2 className="w-32 h-32" />
              </div>
              <p className="text-white/60 font-medium mb-1 relative z-10">Tracked Games</p>
              <p className="text-4xl font-black text-white relative z-10">{stats.totalGamesTracked}</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-6 rounded-3xl bg-[#111111] border border-white/5 shadow-xl relative overflow-hidden"
            >
              <div className="absolute -right-6 -top-6 text-white/5">
                <Timer className="w-32 h-32" />
              </div>
              <p className="text-white/60 font-medium mb-1 relative z-10">Avg Session</p>
              <p className="text-4xl font-black text-white relative z-10">{formatPlaytime(stats.averageSessionSeconds)}</p>
            </motion.div>
          </div>
        </section>

        <div className="flex flex-col xl:flex-row gap-12">
          {/* Main Chart Area */}
          <section className="flex-1">
            <div className="flex flex-col mb-6">
              <SectionHeading title="30-Day Activity" />
              <p className="text-sm text-white/40 mt-[-1rem]">Records live playtime natively tracked by Vertex. Past Steam activity cannot be reconstructed.</p>
            </div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="h-[400px] w-full p-6 rounded-3xl bg-[#111111] border border-white/5 shadow-2xl"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formattedActivity} margin={{ top: 20, right: 40, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffffff" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="rgba(255,255,255,0.3)"
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                    tickMargin={10}
                    padding={{ right: 30, left: 20 }}
                  />
                  <YAxis 
                    stroke="rgba(255,255,255,0.3)"
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                    tickFormatter={formatMinutesAxis}
                    width={45}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value: any) => formatMinutesTooltip(value as number)}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="minutes" 
                    name="Playtime"
                    stroke="#ffffff" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorHours)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          </section>

          {/* Right Column */}
          <section className="w-full xl:w-[400px]">
            <SectionHeading title="Library DNA" />
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="h-[400px] w-full p-6 rounded-3xl bg-[#111111] border border-white/5 shadow-2xl"
            >
              {formattedGenres.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={formattedGenres} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                    <PolarGrid stroke="rgba(255,255,255,0.1)" />
                    <PolarAngleAxis 
                      dataKey="name" 
                      tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 500 }} 
                    />
                    <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                    <Radar
                      name="Games Owned"
                      dataKey="count"
                      stroke="#ffffff"
                      strokeWidth={2}
                      fill="#ffffff"
                      fillOpacity={0.4}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value: any) => [`${value} Games`, 'Library DNA']}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="text-white/40">Not enough data to determine favorite genres.</p>
                </div>
              )}
            </motion.div>
          </section>
        </div>

        <div className="flex flex-col xl:flex-row gap-12">
          {/* Collection / Status Breakdown */}
          <section className="flex-1">
            <SectionHeading title="Collection & Status Breakdown" />
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="h-[400px] w-full p-6 rounded-3xl bg-[#111111] border border-white/5 shadow-2xl"
            >
              {collectionStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={collectionStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke="rgba(255,255,255,0.3)"
                      tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 500 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="rgba(255,255,255,0.3)"
                      tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      contentStyle={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="count" name="Total Games" radius={[4, 4, 0, 0]} barSize={40}>
                      {collectionStats.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="text-white/40">No collection data to display.</p>
                </div>
              )}
            </motion.div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
