import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import GymBuddyLogo from "./Logo";
import { Zap, Flame, Sparkles } from "lucide-react";

interface SplashScreenProps {
  onFinish?: () => void;
  durationMs?: number;
}

export default function SplashScreen({
  onFinish,
  durationMs = 2000,
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
        }, 150);
      }
    }, 25);

    return () => clearInterval(interval);
  }, [durationMs, onFinish]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05, filter: "blur(12px)" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[99999] bg-[#070A10] flex flex-col items-center justify-between p-6 sm:p-10 select-none overflow-hidden"
    >
      {/* 1. CINEMATIC ATMOSPHERIC BACKGROUND */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Dynamic Glowing Mesh Orbs */}
        <div className="absolute -top-24 -left-24 w-[420px] h-[420px] bg-[#D4FF00]/15 rounded-full blur-[110px] animate-pulse" />
        <div className="absolute top-1/3 -right-24 w-[380px] h-[380px] bg-[#25D366]/12 rounded-full blur-[100px]" />
        <div className="absolute -bottom-24 left-1/4 w-[450px] h-[450px] bg-[#00D2FF]/10 rounded-full blur-[120px]" />

        {/* High-tech Grid Lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-80" />
      </div>

      {/* Top Header Placeholder */}
      <div className="w-full flex items-center justify-between opacity-0">
        <span>top</span>
      </div>

      {/* 2. CENTER HERO LOGO & 3D GLASS EMBLEM */}
      <div className="relative z-10 flex flex-col items-center text-center space-y-7 max-w-sm">
        {/* Animated Radial Pulse Rings */}
        <div className="relative flex items-center justify-center">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.35, 0.1, 0.35] }}
            transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut" }}
            className="absolute w-44 h-44 rounded-full border border-[#D4FF00]/30 shadow-[0_0_30px_rgba(212,255,0,0.15)] pointer-events-none"
          />
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: [1, 1.5, 1], opacity: [0.25, 0.05, 0.25] }}
            transition={{ repeat: Infinity, duration: 2.8, delay: 0.4, ease: "easeInOut" }}
            className="absolute w-56 h-56 rounded-full border border-[#25D366]/20 pointer-events-none"
          />

          {/* Elevated Glassmorphic Card */}
          <motion.div
            initial={{ scale: 0.75, opacity: 0, y: 25 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{
              type: "spring",
              stiffness: 240,
              damping: 18,
              delay: 0.1,
            }}
            className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-b from-[#182333]/90 via-[#101724]/90 to-[#0A0F18]/90 border border-white/20 backdrop-blur-2xl flex items-center justify-center shadow-[0_15px_50px_rgba(0,0,0,0.9),0_0_60px_rgba(212,255,0,0.25)]"
          >
            {/* Specular Inner Glare */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
            
            {/* GymBuddy Athletic Emblem */}
            <div className="relative z-10 scale-125 sm:scale-135 drop-shadow-[0_4px_12px_rgba(212,255,0,0.4)]">
              <GymBuddyLogo size={64} transparentBg={true} />
            </div>
          </motion.div>
        </div>

        {/* Dynamic Brand Title & Badge */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="space-y-2.5"
        >
          <div className="flex items-center justify-center gap-1.5">
            <h1 className="text-3xl sm:text-4xl font-['Archivo_Black'] tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-neutral-100 to-[#D4FF00] uppercase drop-shadow-md">
              GymBuddy
            </h1>
            <span className="w-2.5 h-2.5 rounded-full bg-[#D4FF00] inline-block shadow-[0_0_15px_#D4FF00] -mt-2 animate-pulse" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#121A28] border border-white/10 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-widest text-neutral-300 shadow-inner">
            <Sparkles size={12} className="text-[#D4FF00]" />
            <span>AI Nutrition & Workout Coach</span>
          </div>
        </motion.div>
      </div>

      {/* 3. HIGH-TECH LOADING CAPSULE */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.35 }}
        className="relative z-10 w-full max-w-xs flex flex-col items-center space-y-3 pb-4"
      >
        {/* Glowing Dual-Tone Laser Track */}
        <div className="w-full h-2 bg-[#101724] rounded-full overflow-hidden border border-white/10 shadow-inner p-0.5">
          <div
            className="h-full bg-gradient-to-r from-[#00D2FF] via-[#25D366] to-[#D4FF00] rounded-full transition-all duration-75 shadow-[0_0_18px_#D4FF00]"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Status Line */}
        <div className="flex items-center justify-between w-full px-1 text-[10px] font-extrabold tracking-wider text-neutral-400 uppercase">
          <span className="flex items-center gap-1.5 text-neutral-300">
            <span className="w-2 h-2 rounded-full bg-[#D4FF00] animate-ping inline-block" />
            <span>Menyiapkan Program Latihan...</span>
          </span>
          <span className="font-mono text-[#D4FF00] text-xs font-black">{progress}%</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
