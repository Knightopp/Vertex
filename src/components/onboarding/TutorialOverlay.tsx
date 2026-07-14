import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSettingsStore } from "@/stores/settings-store";
import { ChevronRight, ChevronLeft, Cloud, Gamepad2, Sparkles, X, AlertTriangle } from "lucide-react";

const slides = [
  {
    id: "welcome",
    title: "Welcome to Vertex",
    description: "Your dark-first, offline-ready gaming sanctuary. Track your playtime, organize collections, and dive into your games.",
    icon: <Gamepad2 className="w-16 h-16 text-purple-500" />,
    color: "from-purple-500/20 to-purple-500/5",
    accent: "bg-purple-500",
  },
  {
    id: "sync",
    title: "Instant Cloud Sync",
    description: "Connect Steam in Settings to instantly pull in your library. Every playtime hour, review, and favorite is synced automatically across all your devices.",
    icon: <Cloud className="w-16 h-16 text-blue-500" />,
    color: "from-blue-500/20 to-blue-500/5",
    accent: "bg-blue-500",
  },
  {
    id: "metadata",
    title: "Smart Metadata",
    description: "Add any local .exe file, then hit the Steam 'Enrich' button. Vertex automatically fetches HD covers, banners, and playtime data for you.",
    icon: <Sparkles className="w-16 h-16 text-pink-500" />,
    color: "from-pink-500/20 to-pink-500/5",
    accent: "bg-pink-500",
  }
];

export default function TutorialOverlay() {
  const { settings, completeTutorial } = useSettingsStore();
  const [slideIndex, setSlideIndex] = useState(0);
  const [showSkipWarning, setShowSkipWarning] = useState(false);

  // If the tutorial is already completed, render nothing
  if (settings.tutorialCompleted) return null;

  const currentSlide = slides[slideIndex];
  const isLastSlide = slideIndex === slides.length - 1;

  const handleNext = () => {
    if (isLastSlide) {
      completeTutorial();
    } else {
      setSlideIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (slideIndex > 0) {
      setSlideIndex((prev) => prev - 1);
    }
  };

  const handleSkipRequest = () => {
    setShowSkipWarning(true);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md overflow-hidden">
      
      {/* Dynamic Background Gradient */}
      <motion.div 
        className={`absolute inset-0 bg-gradient-to-br ${currentSlide.color} transition-colors duration-1000 opacity-50`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
      />

      {/* Main Glass Modal */}
      <motion.div 
        className="relative w-full max-w-2xl bg-[#0F0A15]/90 border border-white/10 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl mx-4"
        initial={{ y: 50, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
      >
        {/* Skip Button (Top Right) */}
        {!showSkipWarning && (
          <button 
            onClick={handleSkipRequest}
            className="absolute top-4 right-4 z-10 p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Content Area */}
        <div className="relative h-[400px]">
          <AnimatePresence mode="wait">
            <motion.div 
              key={currentSlide.id}
              className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 sm:p-12"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-8 p-6 rounded-full bg-white/5 border border-white/10 shadow-lg">
                {currentSlide.icon}
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4 tracking-tight">
                {currentSlide.title}
              </h2>
              <p className="text-base sm:text-lg text-white/60 leading-relaxed max-w-lg">
                {currentSlide.description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between p-6 bg-black/40 border-t border-white/5">
          {/* Progress Dots */}
          <div className="flex gap-2">
            {slides.map((_, idx) => (
              <div 
                key={idx} 
                className={`h-2 rounded-full transition-all duration-300 ${idx === slideIndex ? `w-8 ${currentSlide.accent}` : 'w-2 bg-white/10'}`}
              />
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <button 
              onClick={handleBack}
              disabled={slideIndex === 0}
              className="p-3 text-white/50 hover:text-white disabled:opacity-0 transition-all rounded-full hover:bg-white/5"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <button 
              onClick={handleNext}
              className={`flex items-center gap-2 px-8 py-3 rounded-full font-bold text-white transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 ${currentSlide.accent} hover:brightness-110`}
            >
              {isLastSlide ? "Get Started" : "Next"}
              {!isLastSlide && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Skip Warning Overlay */}
      <AnimatePresence>
        {showSkipWarning && (
          <motion.div 
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="bg-[#150E1D] border border-red-500/30 rounded-2xl p-8 max-w-sm text-center shadow-2xl"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Are you sure?</h3>
              <p className="text-white/60 text-sm mb-8">
                Vertex has some powerful hidden features. Skipping this quick tour might leave you slightly confused later!
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => setShowSkipWarning(false)}
                  className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition-colors"
                >
                  Nevermind, show me
                </button>
                <button 
                  onClick={() => {
                    setShowSkipWarning(false);
                    completeTutorial();
                  }}
                  className="w-full py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl font-medium transition-colors"
                >
                  Yes, skip tutorial
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
