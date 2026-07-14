import { useAuthStore } from "@/stores/auth-store";
import { motion } from "framer-motion";
import { Gamepad2, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";

export default function Auth() {
  const { signInWithDiscord, signInWithGoogle } = useAuthStore();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  // Reset loading state when the window regains focus (user came back from browser)
  useEffect(() => {
    const handleFocus = () => setIsLoading(null);
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const handleDiscord = async () => {
    setIsLoading("discord");
    await signInWithDiscord();
    // Fallback reset in case focus event doesn't fire
    setTimeout(() => setIsLoading(null), 5000);
  };

  const handleGoogle = async () => {
    setIsLoading("google");
    await signInWithGoogle();
    setTimeout(() => setIsLoading(null), 5000);
  };

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center relative overflow-hidden bg-[#05010D]">
      {/* Dynamic Background */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center opacity-60 blur-[4px] scale-105"
        style={{ backgroundImage: `url('/images/vertex_banner_v3.png')` }}
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent via-[#05010D]/60 to-[#05010D] opacity-100" />

      <motion.div 
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="z-10 flex w-full max-w-[480px] flex-col items-center justify-center p-10 rounded-[2rem] bg-[#111111] border border-white/10 shadow-2xl relative overflow-hidden"
      >
        <div className="w-full mb-10 flex justify-center">
          <img src="/images/vertex_logo_transparent.png" alt="Vertex" className="w-64 object-contain drop-shadow-2xl opacity-90" />
        </div>
        
        <p className="mb-10 text-center text-sm font-medium text-[#B3B3B3] leading-relaxed max-w-[280px]">
          Connect your account to access your ultimate gaming library.
        </p>

        <div className="flex w-full flex-col gap-4 relative z-10">
          <button
            onClick={handleDiscord}
            disabled={isLoading !== null}
            className="group relative flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#5865F2] px-6 font-bold text-white transition-all hover:bg-[#4752C4] hover:scale-[1.02] hover:shadow-[0_0_30px_-5px_rgba(88,101,242,0.5)] disabled:opacity-70 disabled:cursor-wait disabled:hover:scale-100 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            {isLoading === "discord" ? (
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                <span>Waiting for browser...</span>
              </div>
            ) : (
              <>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
                </svg>
                <span>Continue with Discord</span>
              </>
            )}
          </button>

          <button
            onClick={handleGoogle}
            disabled={isLoading !== null}
            className="group relative flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-white px-6 font-bold text-black transition-all hover:bg-gray-100 hover:scale-[1.02] hover:shadow-[0_0_30px_-5px_rgba(255,255,255,0.4)] disabled:opacity-70 disabled:cursor-wait disabled:hover:scale-100 overflow-hidden"
          >
            {isLoading === "google" ? (
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                <span>Waiting for browser...</span>
              </div>
            ) : (
              <>
                <svg className="h-6 w-6" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
