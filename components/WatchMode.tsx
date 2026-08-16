import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Watch,
  Play,
  Pause,
  RotateCcw,
  Check,
  Flame,
  Heart,
  Droplet,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Bell,
  Sparkles,
  Info,
  X,
  Volume2
} from "lucide-react";
import { notificationService } from "../services/notificationService";

interface WatchModeProps {
  user: any;
  onExit: () => void;
}

export default function WatchMode({ user, onExit }: WatchModeProps) {
  // Active Exercise State
  const defaultExercises = [
    { name: "Flat Barbell Bench Press", targetSets: 4, completedSets: 0, reps: "8-10 reps", coachCue: "Tancepin kaki, busungin dada!" },
    { name: "Incline Dumbbell Press", targetSets: 4, completedSets: 0, reps: "10-12 reps", coachCue: "Dorong pake dada atas!" },
    { name: "Lat Pulldown Machine", targetSets: 4, completedSets: 0, reps: "10-12 reps", coachCue: "Tarik pake siku ke bawah!" },
    { name: "Cable Tricep Pushdown", targetSets: 3, completedSets: 0, reps: "12-15 reps", coachCue: "Kunci siku di pinggang!" }
  ];

  const [exercises, setExercises] = useState(defaultExercises);
  const [activeExIndex, setActiveExIndex] = useState(0);

  // Rest Timer State
  const [restSeconds, setRestSeconds] = useState(60);
  const [initialRest, setInitialRest] = useState(60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Live Metrics
  const [waterCount, setWaterCount] = useState(1250);
  const [caloriesBurned, setCaloriesBurned] = useState(245);
  const [heartRate, setHeartRate] = useState(128);

  // Modals & Tools
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);

  const currentEx = exercises[activeExIndex] || exercises[0];

  // Timer Interval
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && restSeconds > 0) {
      interval = setInterval(() => {
        setRestSeconds((prev) => prev - 1);
      }, 1000);
    } else if (restSeconds === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      notificationService.playAlertSound("timer");
      notificationService.triggerHaptic([300, 100, 300, 100, 400]);
      notificationService.sendNotification({
        title: "⏱️ Istirahat Selesai!",
        body: `Waktu istirahat habis untuk ${currentEx.name}. Siap set berikutnya! 🔥`,
        vibrate: [300, 100, 300]
      });
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, restSeconds, currentEx.name]);

  // Simulate gentle Heart Rate variation during workout
  useEffect(() => {
    const hrInterval = setInterval(() => {
      setHeartRate((prev) => {
        const delta = Math.floor(Math.random() * 5) - 2;
        return Math.min(165, Math.max(115, prev + delta));
      });
    }, 3000);
    return () => clearInterval(hrInterval);
  }, []);

  // Complete Set Handler
  const handleCompleteSet = () => {
    notificationService.triggerHaptic([100, 50, 150]);
    notificationService.playAlertSound("complete");

    setExercises((prev) => {
      const updated = [...prev];
      const ex = { ...updated[activeExIndex] };
      if (ex.completedSets < ex.targetSets) {
        ex.completedSets += 1;
        setCaloriesBurned((c) => c + 15);
      }
      updated[activeExIndex] = ex;
      return updated;
    });

    // Auto-start rest timer
    setRestSeconds(initialRest);
    setIsTimerRunning(true);
  };

  const handleToggleTimer = () => {
    notificationService.triggerHaptic([50]);
    setIsTimerRunning(!isTimerRunning);
  };

  const handleResetTimer = (seconds: number) => {
    notificationService.triggerHaptic([50]);
    setInitialRest(seconds);
    setRestSeconds(seconds);
    setIsTimerRunning(false);
  };

  const handleAddWater = () => {
    notificationService.triggerHaptic([80]);
    setWaterCount((w) => w + 250);
  };

  const handleEnableNotification = async () => {
    const granted = await notificationService.requestPermission();
    setNotifEnabled(granted);
    if (granted) {
      notificationService.sendTestNotification();
    }
  };

  const progressPercent = ((initialRest - restSeconds) / initialRest) * 100;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-2 sm:p-4 select-none font-sans">
      {/* Outer Watch Casing Container */}
      <div className="w-full max-w-[340px] bg-[#0c0f14] border-2 border-neutral-800 rounded-[44px] p-4 shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col justify-between relative overflow-hidden ring-4 ring-neutral-900/80">
        
        {/* Watch Top Header Bar */}
        <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2.5 pt-1 px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D4FF00] animate-pulse" />
            <span className="font-['Archivo_Black'] text-xs tracking-wider text-[#D4FF00]">
              WATCH MODE
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGuideModal(true)}
              className="p-1 rounded-full bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              title="Panduan Buka di Apple Watch"
            >
              <Info size={13} />
            </button>
            <button
              onClick={onExit}
              className="px-2 py-0.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-[10px] font-extrabold text-neutral-300 transition-colors cursor-pointer"
            >
              Keluar
            </button>
          </div>
        </div>

        {/* Live Metrics Pill (Heart Rate & Calories) */}
        <div className="grid grid-cols-3 gap-1.5 my-2.5 px-0.5">
          <div className="bg-[#141923] border border-neutral-800/60 rounded-xl p-1.5 flex flex-col items-center">
            <span className="flex items-center gap-1 text-[10px] text-red-400 font-bold">
              <Heart size={10} className="animate-pulse fill-red-400" /> BPM
            </span>
            <span className="text-xs font-black text-white">{heartRate}</span>
          </div>
          <div className="bg-[#141923] border border-neutral-800/60 rounded-xl p-1.5 flex flex-col items-center">
            <span className="flex items-center gap-1 text-[10px] text-amber-400 font-bold">
              <Flame size={10} className="fill-amber-400" /> KCAL
            </span>
            <span className="text-xs font-black text-white">{caloriesBurned}</span>
          </div>
          <button
            onClick={handleAddWater}
            className="bg-[#141923] border border-neutral-800/60 rounded-xl p-1.5 flex flex-col items-center hover:border-cyan-500/40 active:scale-95 transition-all cursor-pointer"
          >
            <span className="flex items-center gap-1 text-[10px] text-cyan-400 font-bold">
              <Droplet size={10} className="fill-cyan-400" /> +250ml
            </span>
            <span className="text-xs font-black text-white">{waterCount}ml</span>
          </button>
        </div>

        {/* Current Active Exercise Card */}
        <div className="bg-gradient-to-b from-[#141924] to-[#0f131a] border border-[#D4FF00]/20 rounded-2xl p-3 my-1 relative shadow-inner">
          <div className="flex items-center justify-between mb-1">
            <button
              onClick={() => setActiveExIndex((prev) => (prev > 0 ? prev - 1 : exercises.length - 1))}
              className="p-1 rounded-lg bg-neutral-800/70 hover:bg-neutral-700 text-neutral-300 cursor-pointer"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[10px] font-black text-[#D4FF00] uppercase tracking-wider">
              Latihan {activeExIndex + 1}/{exercises.length}
            </span>
            <button
              onClick={() => setActiveExIndex((prev) => (prev < exercises.length - 1 ? prev + 1 : 0))}
              className="p-1 rounded-lg bg-neutral-800/70 hover:bg-neutral-700 text-neutral-300 cursor-pointer"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <h3 className="font-['Archivo_Black'] text-sm text-white text-center truncate">
            {currentEx.name}
          </h3>
          <p className="text-[11px] text-neutral-400 text-center font-semibold mt-0.5">
            Target: {currentEx.reps}
          </p>

          {/* Sets Visual Indicators */}
          <div className="flex items-center justify-center gap-1.5 mt-2">
            {Array.from({ length: currentEx.targetSets }).map((_, idx) => {
              const isDone = idx < currentEx.completedSets;
              return (
                <div
                  key={idx}
                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black transition-all ${
                    isDone
                      ? "bg-[#D4FF00] text-black shadow-xs"
                      : "bg-neutral-800/80 text-neutral-500 border border-neutral-700"
                  }`}
                >
                  {isDone ? <Check size={12} strokeWidth={3} /> : idx + 1}
                </div>
              );
            })}
          </div>

          {/* Coach Quick Cue */}
          <div className="mt-2 pt-2 border-t border-white/[0.06] text-center">
            <p className="text-[10px] text-neutral-300 font-medium italic truncate">
              "{currentEx.coachCue}"
            </p>
          </div>
        </div>

        {/* Big Action Button: COMPLETE SET */}
        <div className="my-2">
          <button
            onClick={handleCompleteSet}
            disabled={currentEx.completedSets >= currentEx.targetSets}
            className={`w-full py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 transition-all ${
              currentEx.completedSets >= currentEx.targetSets
                ? "bg-emerald-500 text-black cursor-default opacity-90"
                : "bg-[#D4FF00] hover:bg-[#c4ec00] text-black"
            }`}
          >
            {currentEx.completedSets >= currentEx.targetSets ? (
              <>
                <Check size={16} strokeWidth={3} />
                <span>SEMUA SET SELESAI! 🎉</span>
              </>
            ) : (
              <>
                <Check size={16} strokeWidth={3} />
                <span>CENTANG SET {currentEx.completedSets + 1} SELESAI</span>
              </>
            )}
          </button>
        </div>

        {/* Live Circular Rest Timer */}
        <div className="bg-[#121620] border border-neutral-800 rounded-2xl p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* Mini Progress Ring */}
            <div className="relative w-11 h-11 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  className="stroke-neutral-800"
                  strokeWidth="3"
                  fill="none"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  className="stroke-[#D4FF00] transition-all duration-300"
                  strokeWidth="3"
                  strokeDasharray="94.2"
                  strokeDashoffset={94.2 - (94.2 * progressPercent) / 100}
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
              <span className="absolute font-black text-xs text-white">
                {restSeconds}s
              </span>
            </div>

            <div>
              <span className="text-[10px] font-black text-[#D4FF00] uppercase block">
                Rest Timer
              </span>
              <span className="text-[10px] text-neutral-400 font-semibold">
                {isTimerRunning ? "Hitung mundur..." : "Siap mulai"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleToggleTimer}
              className={`p-2 rounded-xl text-xs font-black flex items-center justify-center cursor-pointer transition-all ${
                isTimerRunning
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-[#D4FF00] text-black"
              }`}
            >
              {isTimerRunning ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
            </button>
            <button
              onClick={() => handleResetTimer(60)}
              className="px-2 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-bold cursor-pointer"
            >
              60s
            </button>
            <button
              onClick={() => handleResetTimer(90)}
              className="px-2 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-bold cursor-pointer"
            >
              90s
            </button>
          </div>
        </div>

        {/* Notification Trigger Bar */}
        <div className="mt-2.5 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[10px]">
          <span className="text-neutral-400 font-medium flex items-center gap-1">
            <Bell size={11} className="text-[#D4FF00]" /> Notif & Haptic:
          </span>
          <button
            onClick={handleEnableNotification}
            className="px-2 py-0.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-[#D4FF00] font-extrabold cursor-pointer"
          >
            {notifEnabled ? "Aktif ✓" : "Tes Notifikasi"}
          </button>
        </div>
      </div>

      {/* Guide Modal: How to open on Apple Watch */}
      <AnimatePresence>
        {showGuideModal && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111620] border border-neutral-800 rounded-3xl p-5 max-w-sm w-full space-y-3 text-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                <div className="flex items-center gap-2">
                  <Watch size={18} className="text-[#D4FF00]" />
                  <h3 className="font-['Archivo_Black'] text-sm text-white">Buka di Apple Watch</h3>
                </div>
                <button
                  onClick={() => setShowGuideModal(false)}
                  className="p-1 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2 text-xs text-neutral-300 leading-relaxed font-medium">
                <div className="p-2.5 rounded-xl bg-[#161C28] border border-neutral-800 space-y-1">
                  <span className="font-bold text-[#D4FF00] block">Cara Buka Layar Jam:</span>
                  <p>1. Kirim link web GymBuddy ke iMessage / Notes di iPhone.</p>
                  <p>2. Di Apple Watch, buka pesan tersebut & tap link webnya.</p>
                  <p>3. Tampilan Watch Mode ini otomatis menyesuaikan layar jam tanganmu!</p>
                </div>

                <div className="p-2.5 rounded-xl bg-[#161C28] border border-neutral-800 space-y-1">
                  <span className="font-bold text-[#D4FF00] block">Getaran & Rest Timer:</span>
                  <p>Saat menekan tombol set selesai di HP atau jam, Apple Watch akan bergetar saat 60s istirahat selesai.</p>
                </div>
              </div>

              <button
                onClick={() => setShowGuideModal(false)}
                className="w-full py-2.5 rounded-xl text-xs font-black bg-[#D4FF00] text-black hover:bg-[#c4ec00] transition-all cursor-pointer"
              >
                Saya Mengerti
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
