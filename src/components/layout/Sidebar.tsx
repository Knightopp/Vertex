import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HomeIcon, StatsIcon, LibraryIcon } from "@/components/icons";
import { Heart, Settings as SettingsIcon } from "lucide-react";
import type { ReactNode } from "react";
import { AddEntryModal } from "@/features/library/components/AddEntryModal";

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

export default function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen shrink-0 overflow-hidden bg-[#111111] sm:flex sm:w-[90px] sm:flex-col sm:items-center sm:gap-10 sm:py-10 border-r border-white/5">
      {/* Brand Logo */}
      <div className="mb-6 mt-4 flex w-full items-center justify-center">
        <img src="/images/vertex_v_logo.png" alt="Vertex" className="w-[64px] h-auto object-contain drop-shadow-xl hover:scale-110 transition-transform" />
      </div>

      {navItems.map((item) => (
        <Tooltip key={item.to} delayDuration={300}>
          <TooltipTrigger asChild>
            <NavLink
              to={item.to}
              aria-label={item.label}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "relative flex h-12 w-full items-center justify-center transition-all duration-200",
                  isActive ? "text-white" : "text-white/40 hover:text-white/80",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {/* Wrap icon to center it since the a-tag is now full width */}
                  <div className="flex h-10 w-10 items-center justify-center">
                    {item.icon}
                  </div>
                </>
              )}
            </NavLink>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={12}>
            {item.label}
          </TooltipContent>
        </Tooltip>
      ))}

      {/* Manual Entry Button */}
      <div className="mt-auto mb-4 w-full">
        <AddEntryModal />
      </div>
    </aside>
  );
}
