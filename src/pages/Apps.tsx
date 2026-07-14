import { useEffect, useState } from "react";
import Layout from "@/components/layout/Layout";
import SectionHeading from "@/components/common/SectionHeading";
import GameTile from "@/features/library/components/GameTile";
import GameDetailModal from "@/features/library/components/GameDetailModal";
import { useLibraryStore } from "@/stores/library-store";
import type { LibraryEntryWithRelations } from "@/services/LibraryManager";

export default function Apps() {
  const { entries, fetchLibrary } = useLibraryStore();
  const [selected, setSelected] = useState<LibraryEntryWithRelations | null>(null);
  useEffect(() => { void fetchLibrary(); }, [fetchLibrary]);
  const apps = entries.filter((entry) => entry.type === "application");
  return <Layout><section className="pt-2"><SectionHeading title="Applications" />
    <p className="mb-6 text-sm text-white/50">Every detected program is tracked here. Right-click an app to add it as a game.</p>
    {apps.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{apps.map((entry) => <GameTile key={entry.id} entry={entry} onClick={setSelected} />)}</div> : <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-white/40">Launch an app while Tracker is running to see it here.</div>}
    <GameDetailModal entry={selected} isOpen={!!selected} onClose={() => setSelected(null)} />
  </section></Layout>;
}
