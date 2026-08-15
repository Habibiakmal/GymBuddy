import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import GymBuddyLogo from "./Logo";
import { Sparkles } from "lucide-react";

interface SplashScreenProps {
  onFinish?: () => void;
  durationMs?: number;
}

export default function SplashScreen({
  onFinish,
  durationMs = 1800,
}: SplashScreenProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / durationMs) * 100));
      setProgress(pct);

      if (elapsed >= durationMs) {
        clearInterval(interval);
        setTimeout(() => {
          if (onFinish) onFinish();
        }, 200);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [durationMs, onFinish]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.03 }}
      transition={{ duration: 0.45, ease: "easeInOut" }}
      className="fixed inset-0 z-[9999] bg-[#0A0D14] flex flex-col items-center justify-between p-8 select-none overflow-hidden"
    >
      {/* Top spacing */}
      <div className="w-full flex justify-between items-center opacity-0">
        <span>top</span>
      </div>

      {/* Center Branding Content */}
      <div className="flex flex-col items-center text-center space-y-6 max-w-xs">
        {/* Animated Glowing Logo Icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 20,
            delay: 0.1,
          }}
          className="relative"
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute -inset-4 bg-[#D4FF00]/15 rounded-full blur-xl animate-pulse" />

          <div className="relative w-20 h-20 rounded-3xl bg-[#121722] border border-white/[0.08] flex items-center justify-center shadow-[0_8px_30px_rgba(0,0,0,0.8)]">
            <GymBuddyLogo className="h-10 text-white" />
          </div>
        </motion.div>

        {/* Title & Tagline */}
        <motion.div
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="space-y-1.5"
        >
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center justify-center gap-1.5">
            <span>GymBuddy</span>
            <span className="w-2 h-2 rounded-full bg-[#D4FF00] inline-block shadow-[0_0_8px_#D4FF00]" />
          </h1>
          <p className="text-xs text-neutral-400 font-semibold tracking-wide">
            Your Personal AI Fitness Coach
          </p>
        </motion.div>
      </div>

      {/* Bottom Loading Progress Indicator */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="w-full max-w-[200px] flex flex-col items-center space-y-3 pb-6"
      >
        {/* Sleek Minimalist Progress Track */}
        <div className="w-full h-1 bg-[#18202E] rounded-full overflow-hidden border border-white/[0.04]">
          <div
            className="h-full bg-[#D4FF00] rounded-full transition-all duration-75 shadow-[0_0_10px_#D4FF00]"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-500">
          <Sparkles size={12} className="text-[#D4FF00] animate-pulse" />
          <span>Memuat Data Latihan...</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
