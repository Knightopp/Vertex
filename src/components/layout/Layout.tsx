import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import Header from "./Header";
import ErrorBoundary from "@/components/common/ErrorBoundary";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <ErrorBoundary>
      {/* Root wrapper using native page scroll */}
      <div className="relative flex h-screen w-full flex-col overflow-hidden bg-background text-foreground selection:bg-primary/30">
        {/* Background layer */}
        <div className="pointer-events-none absolute inset-0 z-0 bg-[#09090B]">
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-5"
            style={{ backgroundImage: `url('/images/vertex_banner_v4.png')` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#09090B] opacity-80" />
        </div>

        {/* Content Layer */}
        <div className="relative z-10 flex h-full w-full">
          <Sidebar />

          {/* Main Column */}
          <div className="flex min-w-0 flex-1 flex-col h-full">
            <Header />
            {/* Added extra padding bottom for mobile bottom nav */}
            <main className="flex-1 overflow-y-auto px-4 pb-24 sm:pb-16 sm:px-8 lg:px-10 custom-scrollbar">
              {children}
            </main>
          </div>
        </div>
        
        {/* Mobile Navigation */}
        <BottomNav />
      </div>
    </ErrorBoundary>
  );
}
