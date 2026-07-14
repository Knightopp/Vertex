import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { Bell } from "lucide-react";
import { useState, useEffect } from "react";
import { libraryManager } from "@/services/LibraryManager";
import { toast } from "sonner";
import { useAppStore } from "@/stores/app-store";

import { GlobalSearch } from "./GlobalSearch";

const navLinks = [
  { to: "/", label: "Library" },
  { to: "/apps", label: "Applications" },
  { to: "/discovery", label: "Discovery" },
];

export default function Header() {
  const { user, profile, signOut } = useAuthStore();
  const { updateAvailable, installUpdate, dismissUpdate } = useAppStore();
  const [showLegacyNotification, setShowLegacyNotification] = useState(false);

  useEffect(() => {
    if (user && libraryManager.hasLegacyData() && !libraryManager.hasMigratedLegacyData()) {
      setShowLegacyNotification(true);
    } else {
      setShowLegacyNotification(false);
    }
  }, [user]);

  const handleMigrateLegacy = async () => {
    const success = await libraryManager.migrateLegacyData();
    if (success) {
      toast.success("Legacy library data migrated successfully!");
      setShowLegacyNotification(false);
      window.location.reload();
    } else {
      toast.error("Failed to migrate legacy data.");
    }
  };

  const handleDismissNotification = () => {
    localStorage.setItem(`vazorism_migrated_legacy_${user?.id}`, "true");
    setShowLegacyNotification(false);
  };

  return (
    <header 
      className="relative z-50 shrink-0 flex flex-wrap w-full items-center justify-between gap-y-4 gap-x-4 px-6 pb-6 sm:px-10 lg:pb-8"
      style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top))" }}
    >
      {/* Left: Navigation */}
      <nav className="flex shrink-0 items-center gap-4 sm:gap-10 overflow-x-auto hide-scrollbar order-1">
        {navLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={({ isActive }) =>
              cn(
                "relative flex flex-col items-center gap-2 text-lg font-medium transition-colors hover:text-white",
                isActive ? "text-white" : "text-white/50"
              )
            }
          >
            {({ isActive }) => (
              <>
                {/* Active indicator above the text matching Figma */}
                <span 
                  className={cn(
                    "absolute -top-3 h-1 w-6 rounded-full bg-white transition-opacity", 
                    isActive ? "opacity-100" : "opacity-0"
                  )} 
                />
                {link.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Center: Search Bar */}
      <div className="flex flex-1 basis-full md:basis-auto justify-center md:px-4 relative z-50 order-3 md:order-2">
        <GlobalSearch />
      </div>

      {/* Right: Profile & Notifications */}
      <div className="flex shrink-0 items-center justify-end gap-4 sm:gap-6 relative order-2 md:order-3">
        <div className="group relative">
          <button
            aria-label="Notifications"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 transition-transform hover:scale-110 hover:bg-white/10 text-white/70 hover:text-white relative"
          >
            <Bell className="w-5 h-5" />
            {(showLegacyNotification || updateAvailable) && (
              <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            )}
          </button>
          
          <div className="absolute right-0 top-full pt-2 w-80 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none group-hover:pointer-events-auto z-50">
            <div className="rounded-xl bg-[#111111] border border-white/10 shadow-2xl overflow-hidden flex flex-col">
              <div className="p-4 border-b border-white/10 bg-white/5">
                <p className="text-sm font-bold text-white">Notifications</p>
              </div>
              
              <div className="flex flex-col max-h-[300px] overflow-y-auto custom-scrollbar">
                {updateAvailable && (
                  <div className="p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold uppercase tracking-wider">Update</span>
                      <p className="text-sm font-bold text-white">Vertex v{updateAvailable.version}</p>
                    </div>
                    <p className="text-xs text-white/60 mb-3 leading-relaxed">
                      A new version is available! Install now to get the latest features and bug fixes.
                    </p>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => installUpdate()}
                        className="px-3 py-1.5 bg-white text-black text-xs font-bold rounded-lg hover:bg-white/90 transition-colors"
                      >
                        Install Update
                      </button>
                      <button 
                        onClick={() => dismissUpdate()}
                        className="px-3 py-1.5 bg-white/10 text-white text-xs font-medium rounded-lg hover:bg-white/20 transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
                
                {showLegacyNotification && (
                  <div className="p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                    <p className="text-sm font-bold text-white mb-1">Found Device Library</p>
                    <p className="text-xs text-white/60 mb-3 leading-relaxed">
                      Vertex detected an existing library of games saved locally on this device. Would you like to import them into this account?
                    </p>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={handleMigrateLegacy}
                        className="px-3 py-1.5 bg-white text-black text-xs font-bold rounded-lg hover:bg-white/90 transition-colors"
                      >
                        Import Games
                      </button>
                      <button 
                        onClick={handleDismissNotification}
                        className="px-3 py-1.5 bg-white/10 text-white text-xs font-medium rounded-lg hover:bg-white/20 transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
                
                {!showLegacyNotification && !updateAvailable && (
                  <div className="p-6 text-center">
                    <p className="text-sm text-white/40">No new notifications</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="group relative">
          <button
            aria-label="Profile Menu"
            className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 transition-transform hover:scale-110 shadow-lg shadow-black/50 text-white font-bold border-2 border-transparent group-hover:border-white/20"
          >
            {profile?.avatar_url || user?.user_metadata?.avatar_url ? (
              <img src={profile?.avatar_url || user?.user_metadata?.avatar_url} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              (profile?.username?.[0] || user?.email?.[0] || "V").toUpperCase()
            )}
          </button>
          
          <div className="absolute right-0 top-full pt-2 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none group-hover:pointer-events-auto z-50">
            <div className="rounded-xl bg-[#111111] border border-white/10 shadow-2xl overflow-hidden">
              <div className="p-4 border-b border-white/10">
                <p className="text-sm font-bold text-white truncate">
                  {profile?.username || user?.user_metadata?.full_name || user?.email || "Player"}
                </p>
              </div>
              <div className="p-2">
                <button
                  onClick={() => signOut()}
                  className="w-full text-left px-3 py-2 text-sm text-red-400 font-medium rounded-lg hover:bg-white/5 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
