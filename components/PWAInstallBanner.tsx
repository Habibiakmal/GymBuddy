import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Download, X, Smartphone, Share2, PlusSquare, Check } from "lucide-react";

interface PWAInstallBannerProps {
  language?: "EN" | "ID";
}

export default function PWAInstallBanner({ language = "ID" }: PWAInstallBannerProps) {
  const isEN = language === "EN";
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // 1. Check if already installed / running in standalone PWA mode
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes("android-app://");

    setIsStandalone(Boolean(isStandaloneMode));

    // 2. Detect iOS devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isAppleDevice);

    // 3. Check dismiss state in localStorage (dismiss for 3 days)
    const dismissedAt = localStorage.getItem("gymbuddy_pwa_dismissed");
    if (dismissedAt) {
      const diffDays = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (diffDays < 3) {
        setIsDismissed(true);
      }
    }

    // 4. Capture beforeinstallprompt for Android / Chrome
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsDismissed(true);
      }
      setDeferredPrompt(null);
    } else {
      // Fallback for browsers that don't support beforeinstallprompt
      setShowIOSModal(true);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem("gymbuddy_pwa_dismissed", String(Date.now()));
  };

  // Don't show if already in standalone app mode or user dismissed recently
  if (isStandalone || isDismissed) {
    return null;
  }

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          className="relative bg-gradient-to-r from-[#182332] via-[#111620] to-[#1F2B14] border border-[#D4FF00]/40 rounded-2xl p-4 sm:p-5 shadow-[0_4px_25px_rgba(0,0,0,0.5)] overflow-hidden"
        >
          {/* Subtle glow background */}
          <div className="absolute -right-8 -top-8 w-24 h-24 bg-[#D4FF00]/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-black border border-[#D4FF00]/40 flex items-center justify-center shrink-0 shadow-md">
                <img src="/logo.svg" alt="GymBuddy Logo" className="w-7 h-7" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-['Archivo_Black'] text-white tracking-wide">
                    {isEN ? "Install GymBuddy App" : "Pasang Aplikasi GymBuddy"}
                  </h4>
                  <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-[#D4FF00] text-black">
                    PWA
                  </span>
                </div>
                <p className="text-xs text-neutral-300 font-medium mt-0.5">
                  {isEN
                    ? "Faster access, fullscreen experience & offline ready on your phone."
                    : "Akses instan dari layar HP, tampilan fullscreen tanpa bilah browser & lebih hemat kuota."}
                </p>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="text-neutral-500 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              title={isEN ? "Dismiss" : "Tutup"}
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex items-center gap-2.5 mt-3.5 pt-3 border-t border-neutral-800/80">
            <button
              onClick={handleInstallClick}
              className="flex-1 py-2.5 px-4 bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 cursor-pointer"
            >
              <Download size={15} className="stroke-[2.5]" />
              <span>{isEN ? "Install App to Home Screen" : "Pasang ke Layar Utama HP"}</span>
            </button>

            <button
              onClick={handleDismiss}
              className="py-2.5 px-4 bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              {isEN ? "Later" : "Nanti"}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* iOS / General Safari Add to Home Screen Instructions Modal */}
      <AnimatePresence>
        {showIOSModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111620] border border-neutral-800 rounded-3xl p-6 max-w-sm w-full space-y-5 shadow-2xl relative"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-black border border-[#D4FF00]/40 flex items-center justify-center">
                    <img src="/logo.svg" alt="GymBuddy Logo" className="w-5 h-5" />
                  </div>
                  <h3 className="font-['Archivo_Black'] text-white text-base">
                    {isEN ? "Install on iPhone / Safari" : "Cara Pasang di iPhone / iPad"}
                  </h3>
                </div>
                <button
                  onClick={() => setShowIOSModal(false)}
                  className="text-neutral-400 hover:text-white p-1 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3.5 text-xs text-neutral-300">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-[#161C28] border border-neutral-800">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center shrink-0 text-blue-400">
                    <Share2 size={15} />
                  </div>
                  <div>
                    <div className="font-bold text-white mb-0.5">
                      {isEN ? "1. Tap the Share button" : "1. Ketuk tombol Bagikan / Share"}
                    </div>
                    <div className="text-neutral-400">
                      {isEN
                        ? "Located at the bottom toolbar of Safari (box with upward arrow)."
                        : "Di bilah menu bawah browser Safari (ikon kotak dengan panah ke atas)."}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-[#161C28] border border-neutral-800">
                  <div className="w-7 h-7 rounded-lg bg-[#D4FF00]/20 border border-[#D4FF00]/40 flex items-center justify-center shrink-0 text-[#D4FF00]">
                    <PlusSquare size={15} />
                  </div>
                  <div>
                    <div className="font-bold text-white mb-0.5">
                      {isEN ? "2. Select 'Add to Home Screen'" : "2. Pilih 'Tambahkan ke Layar Utama'"}
                    </div>
                    <div className="text-neutral-400">
                      {isEN
                        ? "Scroll down the menu and tap 'Add to Home Screen'."
                        : "Gulir menu ke bawah lalu ketuk 'Add to Home Screen'."}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-[#161C28] border border-neutral-800">
                  <div className="w-7 h-7 rounded-lg bg-[#25D366]/20 border border-[#25D366]/40 flex items-center justify-center shrink-0 text-[#25D366]">
                    <Check size={15} strokeWidth={3} />
                  </div>
                  <div>
                    <div className="font-bold text-white mb-0.5">
                      {isEN ? "3. Tap 'Add' in top right" : "3. Ketuk 'Tambah' di pojok kanan atas"}
                    </div>
                    <div className="text-neutral-400">
                      {isEN
                        ? "GymBuddy will appear on your home screen like a native app!"
                        : "GymBuddy akan langsung terpasang di home screen HP kamu!"}
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSModal(false)}
                className="w-full py-3 bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-md"
              >
                {isEN ? "Got it!" : "Saya Mengerti"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
