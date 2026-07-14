import { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, X } from "lucide-react";

export function WhatsNewModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [version, setVersion] = useState("");

  useEffect(() => {
    async function checkVersion() {
      try {
        const currentVersion = await getVersion();
        const savedVersion = localStorage.getItem("vazorism_last_version");

        if (!savedVersion || savedVersion !== currentVersion) {
          // Version is new, show modal
          setVersion(currentVersion);
          setIsOpen(true);
          localStorage.setItem("vazorism_last_version", currentVersion);
        }
      } catch (e) {
        console.error("Failed to check version for release notes:", e);
      }
    }
    
    checkVersion();
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[500px] bg-[#111111] border-white/10 text-white shadow-2xl overflow-hidden p-0">
        <div className="absolute top-0 right-0 p-4 z-10">
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-full bg-black/20 hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-white/50 hover:text-white" />
          </button>
        </div>
        
        <div className="relative w-full h-40 bg-gradient-to-br from-purple-600/30 to-blue-600/30 flex items-center justify-center border-b border-white/5">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
          <div className="text-center z-10">
            <div className="inline-flex items-center justify-center p-3 bg-white/10 rounded-2xl backdrop-blur-md mb-3 border border-white/20">
              <Sparkles className="w-8 h-8 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
            </div>
            <DialogTitle className="text-2xl font-black tracking-tight">
              Welcome to v{version}!
            </DialogTitle>
          </div>
        </div>

        <div className="p-6">
          <p className="text-white/70 mb-6">
            We've made some great improvements to Vertex. Here is what's new in this release:
          </p>

          <div className="space-y-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400"></span>
                System Tray Support
              </h3>
              <p className="text-sm text-white/60 mt-1">
                Vertex now minimizes to the system tray instead of fully closing, allowing it to silently track your games in the background.
              </p>
            </div>

            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                Integrated Notifications
              </h3>
              <p className="text-sm text-white/60 mt-1">
                App updates are now elegantly integrated directly into the notification bell icon, keeping your experience distraction-free.
              </p>
            </div>

            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                Manual Update Check
              </h3>
              <p className="text-sm text-white/60 mt-1">
                You can now see your current version and manually check for updates directly from the Settings page.
              </p>
            </div>
          </div>

          <button 
            onClick={() => setIsOpen(false)}
            className="w-full mt-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-white/90 transition-all active:scale-95"
          >
            Awesome, let's play!
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
