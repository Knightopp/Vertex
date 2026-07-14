import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { HomeIcon, StatsIcon, LibraryIcon } from "@/components/icons";
import { Heart, Settings as SettingsIcon } from "lucide-react";
import type { ReactNode } from "react";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const navItems: NavItem[] = [
  { to: "/", label: "Home", icon: <HomeIcon /> },
  { to: "/stats", label: "Stats", icon: <StatsIcon /> },
  { to: "/library", label: "Collections", icon: <LibraryIcon /> },
  { to: "/wishlist", label: "Wishlist", icon: <Heart className="w-5 h-5 text-current" /> },
  { to: "/settings", label: "Settings", icon: <SettingsIcon className="w-5 h-5 text-current" /> },
];

export default function BottomNav() {
  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-white/10 bg-[#111111]/95 backdrop-blur-lg sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)", height: "calc(4rem + env(safe-area-inset-bottom))" }}
    >
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-200",
              isActive ? "text-white" : "text-white/40 hover:text-white/80"
            )
          }
        >
          {({ isActive }) => (
            <>
              <div className="flex h-6 w-6 items-center justify-center">
                {item.icon}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
