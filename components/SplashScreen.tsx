import React, { useEffect } from "react";
import { motion } from "motion/react";
import GymBuddyLogo from "./Logo";

interface SplashScreenProps {
  onFinish?: () => void;
  durationMs?: number;
}

export default function SplashScreen({
  onFinish,
  durationMs = 1200,
}: SplashScreenProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onFinish) onFinish();
    }, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, onFinish]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="fixed inset-0 z-[99999] bg-black flex flex-col items-center justify-center select-none"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-col items-center gap-5 text-center"
      >
        {/* Large Iconic Logo */}
        <GymBuddyLogo size={96} transparentBg={true} />

        {/* Clean Brand Name */}
        <h1 className="text-3xl sm:text-4xl font-['Archivo_Black'] tracking-tight text-white uppercase">
          GymBuddy
        </h1>
      </motion.div>
    </motion.div>
  );
}
