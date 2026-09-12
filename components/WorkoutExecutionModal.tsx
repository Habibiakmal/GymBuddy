import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  AlertTriangle,
  Flame,
  Clock,
  Sparkles,
  Volume2,
  HelpCircle,
  Plus,
  SkipForward,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Award
} from "lucide-react";
import {
  WorkoutPlan,
  WorkoutSessionState,
  ExerciseItemPlan,
  PerceivedDifficulty,
  BodyArea,
  CompletedWorkoutActivity,
  createCompletedWorkoutRecord,
  initializeSessionState,
  transitionWorkoutSession,
  calculateNextWorkoutAdaptation,
  calculateRecoveryContext,
  MEDICAL_SAFETY_DISCLAIMER
} from "../services/workoutEngine";
import { GymBuddyNotificationService } from "../services/notificationService";

export interface WorkoutCompletionSummary {
  sessionId: string;
  completedSets: number;
  totalSets: number;
  actualDurationSeconds: number;
  difficulty: PerceivedDifficulty;
  nextAdaptation: any;
  activityRecord?: CompletedWorkoutActivity;
}

interface WorkoutExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: WorkoutPlan;
  persona?: "max" | "mia";
  userPhone?: string;
  onWorkoutCompleted?: (summary: WorkoutCompletionSummary) => void;
}

const STORAGE_SESSION_KEY = "gymbuddy_active_session_state";

export default function WorkoutExecutionModal({
  isOpen,
  onClose,
  plan,
  persona = "max",
  userPhone,
  onWorkoutCompleted
}: WorkoutExecutionModalProps) {
  const isCompletingRef = useRef(false);

  // Session State
  const [session, setSession] = useState<WorkoutSessionState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SESSION_KEY);
      if (saved) {
        const parsed: WorkoutSessionState = JSON.parse(saved);
        if (parsed.planId === plan.id && parsed.status !== "WORKOUT_COMPLETED" && parsed.status !== "ABANDONED") {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Failed to read saved session state:", e);
    }
    return initializeSessionState(plan);
  });

  // Flat list of exercises in plan (main exercises + cardio if present)
  const allExercises: ExerciseItemPlan[] = plan.cardio
    ? [...plan.mainExercises, plan.cardio]
    : plan.mainExercises;

  // Local UI state
  const [restSecondsRemaining, setRestSecondsRemaining] = useState<number>(45);
  const [showPainModal, setShowPainModal] = useState<boolean>(false);
  const [painBodyArea, setPainBodyArea] = useState<BodyArea>("knee");
  const [painNote, setPainNote] = useState<string>("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<PerceivedDifficulty>("good");
  const [showGifModal, setShowGifModal] = useState<boolean>(false);
  const [sessionDurationSeconds, setSessionDurationSeconds] = useState<number>(session.actualDurationSeconds || 0);

  // Sound / haptics service
  const notificationService = useRef(GymBuddyNotificationService.getInstance()).current;

  // Timer Ref for workout duration
  useEffect(() => {
    let interval: any = null;
    if (isOpen && session.status !== "PAUSED" && session.status !== "WORKOUT_COMPLETED" && session.status !== "ABANDONED") {
      interval = setInterval(() => {
        setSessionDurationSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen, session.status]);

  // Rest Countdown Timer
  useEffect(() => {
    let restInterval: any = null;
    if (session.status === "REST" && restSecondsRemaining > 0) {
      restInterval = setInterval(() => {
        setRestSecondsRemaining(prev => {
          if (prev <= 1) {
            notificationService.playAlertSound("complete");
            notificationService.triggerHaptic([200, 100, 200]);
            // Auto transition to NEXT_SET or SET_ACTIVE
            handleAction({ type: "SKIP_REST" });
            return 0;
          }
          if (prev === 4) {
            notificationService.playAlertSound("timer");
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (restInterval) clearInterval(restInterval);
    };
  }, [session.status, restSecondsRemaining]);

  // Persist session changes to localStorage
  useEffect(() => {
    try {
      const stateToSave = {
        ...session,
        actualDurationSeconds: sessionDurationSeconds
      };
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      console.warn("Error saving workout session to storage:", e);
    }
  }, [session, sessionDurationSeconds]);

  if (!isOpen) return null;

  // Dispatch state machine actions
  const handleAction = (action: any) => {
    setSession(prev => {
      const next = transitionWorkoutSession(prev, action);

      if (action.type === "COMPLETE_SET") {
        notificationService.playAlertSound("timer");
        notificationService.triggerHaptic([100, 50, 100]);
        // Set initial rest timer from current exercise restSeconds
        const currentEx = allExercises[prev.activeExerciseIndex];
        const rest = currentEx?.restSeconds || 45;
        setRestSecondsRemaining(rest);
      }

      return next;
    });
  };

  const handleStartWorkout = () => {
    handleAction({ type: "START_WORKOUT" });
  };

  const handleCompleteSet = () => {
    handleAction({ type: "COMPLETE_SET" });
  };

  const handleSkipRest = () => {
    handleAction({ type: "SKIP_REST" });
  };

  const handleAddRest = (seconds: number) => {
    setRestSecondsRemaining(prev => prev + seconds);
    handleAction({ type: "ADD_REST_TIME", seconds });
  };

  const handlePauseResume = () => {
    if (session.status === "PAUSED") {
      handleAction({ type: "RESUME_WORKOUT" });
    } else {
      handleAction({ type: "PAUSE_WORKOUT" });
    }
  };

  const handleSkipExercise = () => {
    handleAction({ type: "SKIP_EXERCISE", reason: "Dilewati oleh user" });
  };

  const handleReportPainSubmit = () => {
    handleAction({
      type: "REPORT_PAIN",
      bodyArea: painBodyArea,
      note: painNote || "Ketidaknyamanan saat repetisi gerakan"
    });
    setShowPainModal(false);
    setPainNote("");
  };

  const handleFinishWorkout = () => {
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;

    handleAction({
      type: "FINISH_WORKOUT",
      overallDifficulty: selectedDifficulty,
      feedbackNote: ""
    });

    const recovery = calculateRecoveryContext([], plan.date);
    const adaptation = calculateNextWorkoutAdaptation(
      {
        ...session,
        overallDifficulty: selectedDifficulty
      },
      recovery
    );

    const normPhone = userPhone ? userPhone.replace(/\D/g, "") : "anonymous";
    const activityRecord = createCompletedWorkoutRecord(
      session,
      plan,
      sessionDurationSeconds,
      selectedDifficulty,
      adaptation,
      userPhone
    );

    if (onWorkoutCompleted) {
      onWorkoutCompleted({
        sessionId: session.sessionId,
        completedSets: session.completedSets,
        totalSets: session.totalSets,
        actualDurationSeconds: sessionDurationSeconds,
        difficulty: selectedDifficulty,
        nextAdaptation: adaptation,
        activityRecord
      });
    }

    try {
      localStorage.removeItem(STORAGE_SESSION_KEY);
      // Persist to user-scoped and global completed history
      const historyKey = `gymbuddy_completed_workouts_${normPhone}`;
      const fallbackKey = "gymbuddy_completed_workouts";
      const existingHistory: CompletedWorkoutActivity[] = JSON.parse(
        localStorage.getItem(historyKey) || localStorage.getItem(fallbackKey) || "[]"
      );
      const filtered = Array.isArray(existingHistory)
        ? existingHistory.filter(
            h =>
              h.activityId !== activityRecord.activityId &&
              !(h.date === activityRecord.date && h.workoutId === activityRecord.workoutId)
          )
        : [];
      filtered.unshift(activityRecord);
      localStorage.setItem(historyKey, JSON.stringify(filtered.slice(0, 50)));
      localStorage.setItem(fallbackKey, JSON.stringify(filtered.slice(0, 50)));

      // Also persist to backend API
      const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-253242815083.asia-southeast2.run.app";
      fetch(`${API_BASE_URL}/api/user/${normPhone}/workout-history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activity: activityRecord })
      }).catch(e => console.warn("Failed to sync completed workout to backend:", e));
    } catch (e) {
      console.warn("Failed to persist completed workout to history:", e);
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const currentExercise = allExercises[session.activeExerciseIndex] || allExercises[0];
  const currentSetNumber = session.activeSetIndex + 1;
  const currentExerciseTargetSets = currentExercise?.targetSets || 1;
  const progressPercent = session.totalSets > 0 ? Math.round((session.completedSets / session.totalSets) * 100) : 0;

  // Coach cue
  const coachCue = persona === "mia" ? currentExercise?.coachCue?.mia : currentExercise?.coachCue?.max;

  // ─── RENDERING VIEWS ────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative w-full max-w-lg bg-[#111620] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[95vh]"
      >
        {/* Top Navigation Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800 bg-[#0d121a]">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D4FF00] animate-pulse" />
            <span className="text-xs font-semibold tracking-wider uppercase text-[#D4FF00]">
              LIVE WORKOUT COACH
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Total Duration Clock */}
            <div className="flex items-center gap-1.5 text-xs text-neutral-300 font-mono bg-neutral-800/60 px-2.5 py-1 rounded-md border border-neutral-700/50">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              <span>{formatTimer(sessionDurationSeconds)}</span>
            </div>

            {/* Pause / Resume Button */}
            {session.status !== "SCHEDULED" && session.status !== "WORKOUT_COMPLETED" && (
              <button
                onClick={handlePauseResume}
                className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition"
                title={session.status === "PAUSED" ? "Lanjutkan Sesi" : "Jeda Sesi"}
              >
                {session.status === "PAUSED" ? (
                  <Play className="w-4 h-4 text-[#D4FF00]" />
                ) : (
                  <Pause className="w-4 h-4 text-neutral-300" />
                )}
              </button>
            )}

            {/* Close / Leave Later Button */}
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition"
              title="Tutup & Simpan Progress"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Workout Progress Bar */}
        <div className="w-full bg-neutral-900 h-1.5">
          <div
            className="h-full bg-[#D4FF00] transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* ─── STATE 1: READY / SCHEDULED ───────────────────────────────────── */}
        {session.status === "SCHEDULED" && (
          <div className="p-6 text-center space-y-6">
            <div className="inline-flex p-3.5 rounded-full bg-[#D4FF00]/10 border border-[#D4FF00]/30 text-[#D4FF00] mx-auto">
              <Flame className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {plan.focus}
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 max-w-sm mx-auto">
                {plan.rationale}
              </p>
            </div>

            {/* Quick Session Stats */}
            <div className="grid grid-cols-3 gap-2 py-3 border-y border-neutral-800/80 bg-neutral-900/40 rounded-xl px-2">
              <div className="text-center">
                <span className="text-[11px] text-neutral-500 uppercase block font-medium">Target</span>
                <span className="text-sm font-bold text-white">{plan.targetDuration} Menit</span>
              </div>
              <div className="text-center border-x border-neutral-800/80">
                <span className="text-[11px] text-neutral-500 uppercase block font-medium">Gerakan</span>
                <span className="text-sm font-bold text-white">{plan.totalExercises} Variasi</span>
              </div>
              <div className="text-center">
                <span className="text-[11px] text-neutral-500 uppercase block font-medium">Total Set</span>
                <span className="text-sm font-bold text-[#D4FF00]">{plan.totalSets} Set</span>
              </div>
            </div>

            {/* Coach Voice intro */}
            <div className="p-3.5 rounded-xl bg-[#182130] border border-neutral-800 text-left flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-[#D4FF00] shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <span className="font-semibold text-white block">
                  Pesan Coach {persona === "mia" ? "Mia" : "Max"}:
                </span>
                <p className="text-neutral-300 leading-relaxed">
                  {plan.coachInsight || "Fokus pada kendali repetisi dan rasakan kontraksi otot target. Mari mulai!"}
                </p>
              </div>
            </div>

            <button
              onClick={handleStartWorkout}
              className="w-full py-4 px-6 rounded-xl bg-[#D4FF00] hover:bg-[#c2eb00] text-black font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-[#D4FF00]/10 transition transform active:scale-98 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>MULAI SESI LATIHAN</span>
            </button>
          </div>
        )}

        {/* ─── STATE 2: ACTIVE SET (DO MODE) ────────────────────────────────── */}
        {(session.status === "SET_ACTIVE" || session.status === "IN_PROGRESS" || session.status === "EXERCISE_ACTIVE" || session.status === "PAUSED") && (
          <div className="p-5 sm:p-6 space-y-5 flex-1 flex flex-col justify-between">
            {/* Exercise Header & Metadata */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>Latihan {session.activeExerciseIndex + 1} dari {allExercises.length}</span>
                <span className="text-[#D4FF00] font-medium uppercase tracking-wide">
                  {currentExercise.bodyArea.replace("_", " ")}
                </span>
              </div>

              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {currentExercise.name}
                  </h3>
                  {currentExercise.indonesianName && (
                    <p className="text-xs text-neutral-400">
                      {currentExercise.indonesianName}
                    </p>
                  )}
                </div>

                {currentExercise.gifUrl && (
                  <button
                    onClick={() => setShowGifModal(true)}
                    className="shrink-0 text-xs text-[#D4FF00] border border-[#D4FF00]/40 hover:bg-[#D4FF00]/10 px-2.5 py-1 rounded-lg transition flex items-center gap-1"
                  >
                    <span>Form Demo</span>
                  </button>
                )}
              </div>
            </div>

            {/* Set Progression Dots Indicator */}
            <div className="flex items-center justify-center gap-2 py-1">
              {Array.from({ length: currentExerciseTargetSets }).map((_, idx) => {
                const isCompleted = idx < session.activeSetIndex;
                const isCurrent = idx === session.activeSetIndex;
                return (
                  <div
                    key={idx}
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      isCompleted
                        ? "w-8 bg-[#D4FF00]"
                        : isCurrent
                        ? "w-8 bg-white"
                        : "w-2.5 bg-neutral-800"
                    }`}
                  />
                );
              })}
            </div>

            {/* Giant Target Display: ONE set / ONE exercise at a time */}
            <div className="py-6 px-4 rounded-2xl bg-gradient-to-b from-[#182130] to-[#131a26] border border-neutral-800/80 text-center space-y-1 shadow-inner relative overflow-hidden">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                SET {currentSetNumber} DARI {currentExerciseTargetSets}
              </span>
              <div className="text-3xl sm:text-4xl font-extrabold text-[#D4FF00] font-mono tracking-tight">
                {currentExercise.targetReps.replace(/^\d+\s*sets?\s*[x×]\s*/i, "").toUpperCase()}
              </div>
              <span className="text-[11px] text-neutral-400 block">
                Target Beban / Repetisi Optimal
              </span>

              {session.status === "PAUSED" && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center">
                  <span className="text-sm font-bold text-white uppercase tracking-widest px-4 py-1.5 rounded-full border border-yellow-500/50 bg-yellow-500/10 text-yellow-400">
                    Sesi Dijeda (Paused)
                  </span>
                </div>
              )}
            </div>

            {/* Tips Teknik Box */}
            <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800 text-left flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-[#D4FF00] shrink-0 mt-0.5" />
              <p className="text-xs text-neutral-300 leading-relaxed">
                <span className="font-semibold text-white">Tips Teknik: </span>
                {coachCue}
              </p>
            </div>

            {/* Primary Action Button: COMPLETE SET */}
            <div className="space-y-2 pt-2">
              <button
                onClick={handleCompleteSet}
                disabled={session.status === "PAUSED"}
                className="w-full py-4 px-6 rounded-xl bg-[#D4FF00] hover:bg-[#c2eb00] disabled:opacity-50 disabled:cursor-not-allowed text-black font-extrabold text-base flex items-center justify-center gap-2 shadow-lg shadow-[#D4FF00]/15 transition transform active:scale-98 cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                <span>SELESAIKAN SET {currentSetNumber}</span>
              </button>

              {/* Auxiliary Controls: Skip Set, Report Pain, Skip Exercise */}
              <div className="flex items-center justify-between text-xs text-neutral-400 px-1 pt-1">
                <button
                  onClick={() => setShowPainModal(true)}
                  className="hover:text-red-400 transition flex items-center gap-1 text-[11px]"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  <span>Ada Nyeri / Sakit?</span>
                </button>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSkipExercise}
                    className="hover:text-neutral-200 transition text-[11px]"
                  >
                    Lewati Latihan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── STATE 3: REST PERIOD ─────────────────────────────────────────── */}
        {session.status === "REST" && (
          <div className="p-6 text-center space-y-6 flex-1 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                WAKTU ISTIRAHAT
              </span>
              <h3 className="text-lg font-bold text-white">
                Tarik Napas & Minum Air
              </h3>
            </div>

            {/* Rest Countdown Circle Display */}
            <div className="relative w-44 h-44 mx-auto flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="88"
                  cy="88"
                  r="76"
                  stroke="#222730"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="88"
                  cy="88"
                  r="76"
                  stroke="#D4FF00"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={477}
                  strokeDashoffset={477 - (477 * restSecondsRemaining) / (currentExercise.restSeconds || 45)}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-extrabold text-white font-mono">
                  {restSecondsRemaining}s
                </span>
                <span className="text-[11px] text-neutral-400 uppercase tracking-wider">
                  Detik Tersisa
                </span>
              </div>
            </div>

            {/* Upcoming Next Set Info */}
            <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 text-xs text-neutral-400 flex items-center justify-between">
              <span>Berikutnya:</span>
              <span className="text-white font-medium">
                Set {session.activeSetIndex + 1} • {currentExercise.name}
              </span>
            </div>

            {/* Rest Controls: +30s & Skip Rest */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => handleAddRest(30)}
                className="py-3 px-4 rounded-xl bg-neutral-800/80 hover:bg-neutral-800 text-neutral-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-neutral-700/50 transition cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#D4FF00]" />
                <span>+30 Detik</span>
              </button>

              <button
                onClick={handleSkipRest}
                className="py-3 px-4 rounded-xl bg-[#D4FF00] hover:bg-[#c2eb00] text-black text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <span>Lewati Istirahat</span>
                <SkipForward className="w-4 h-4 fill-current" />
              </button>
            </div>
          </div>
        )}

        {/* ─── STATE 4: WORKOUT COMPLETED / SUMMARY ─────────────────────────── */}
        {session.status === "WORKOUT_COMPLETED" && (
          <div className="p-6 text-center space-y-5 flex-1 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-2 pt-2">
              <div className="inline-flex p-3.5 rounded-full bg-[#D4FF00]/15 border border-[#D4FF00]/40 text-[#D4FF00] mx-auto">
                <Award className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Latihan Selesai! Luar Biasa!
              </h2>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Kamu telah menyelesaikan sesi latihan hari ini dengan dedikasi tinggi.
              </p>
            </div>

            {/* Performance Metric Cards */}
            <div className="grid grid-cols-3 gap-2.5 bg-neutral-900/60 p-3 rounded-xl border border-neutral-800">
              <div className="text-center">
                <span className="text-[11px] text-neutral-500 uppercase block font-medium">Durasi</span>
                <span className="text-base font-extrabold text-white">
                  {Math.round(sessionDurationSeconds / 60)} Menit
                </span>
              </div>
              <div className="text-center border-x border-neutral-800">
                <span className="text-[11px] text-neutral-500 uppercase block font-medium">Set Tuntas</span>
                <span className="text-base font-extrabold text-[#D4FF00]">
                  {session.completedSets} / {session.totalSets}
                </span>
              </div>
              <div className="text-center">
                <span className="text-[11px] text-neutral-500 uppercase block font-medium">Kepatuhan</span>
                <span className="text-base font-extrabold text-white">
                  {progressPercent}%
                </span>
              </div>
            </div>

            {/* Post-Workout Perceived Difficulty Selector (Section 17) */}
            <div className="space-y-2 text-left">
              <label className="text-xs font-semibold text-neutral-300 block">
                Bagaimana intensitas latihan tadi untukmu?
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { key: "easy" as PerceivedDifficulty, label: "Mudah", desc: "Ringan" },
                  { key: "good" as PerceivedDifficulty, label: "Pas", desc: "Tantangan pas" },
                  { key: "hard" as PerceivedDifficulty, label: "Berat", desc: "Melelahkan" },
                  { key: "very_hard" as PerceivedDifficulty, label: "Sangat Berat", desc: "Maksimal" }
                ].map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSelectedDifficulty(opt.key)}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                      selectedDifficulty === opt.key
                        ? "bg-[#182130] border-[#D4FF00] text-white"
                        : "bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                    }`}
                  >
                    <span className="text-xs font-bold block">{opt.label}</span>
                    <span className="text-[10px] text-neutral-500 block">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* AI Adaptation Rationale Preview (Section 21 & 22) */}
            <div className="p-3.5 rounded-xl bg-[#182130] border border-neutral-800 text-left space-y-1.5">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#D4FF00]" />
                <span className="text-xs font-bold text-white">
                  Adaptasi Sesi Berikutnya:
                </span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                {selectedDifficulty === "easy" && session.completedSets >= session.totalSets
                  ? "Karena sesi tadi terasa mudah dan seluruh set tuntas, sesi berikutnya akan dinaikkan repetisinya secara terukur (+1–2 reps)."
                  : selectedDifficulty === "very_hard"
                  ? "Karena intensitas tadi terasa sangat berat, sesi berikutnya akan disesuaikan agar kamu bisa fokus pada kualitas form tanpa kelelahan berlebih."
                  : "Konsistensimu sangat baik! Ritme dan intensitas saat ini akan dipertahankan untuk membangun pondasi kekuatan bertahap."}
              </p>
            </div>

            <button
              onClick={handleFinishWorkout}
              className="w-full py-4 px-6 rounded-xl bg-[#D4FF00] hover:bg-[#c2eb00] text-black font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-[#D4FF00]/15 transition cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5 fill-current" />
              <span>SIMPAN RIWAYAT & SELESAI</span>
            </button>
          </div>
        )}

        {/* ─── MODAL: INJURY & PAIN REPORT (Section 7) ───────────────────────── */}
        <AnimatePresence>
          {showPainModal && (
            <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm p-4 flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#111620] border border-red-500/40 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-red-500/10 text-red-400 shrink-0">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Laporkan Rasa Nyeri / Sakit
                    </h4>
                    <p className="text-xs text-neutral-400">
                      Keamanan adalah prioritas nomor 1. Gerakan ini akan langsung dihentikan dan dimodifikasi.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-neutral-300 font-medium block">
                    Area tubuh yang terasa tidak nyaman:
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { key: "knee" as BodyArea, label: "Lutut" },
                      { key: "shoulder" as BodyArea, label: "Bahu" },
                      { key: "back" as BodyArea, label: "Punggung" },
                      { key: "wrist" as BodyArea, label: "Pergelangan" },
                      { key: "hip" as BodyArea, label: "Pinggul" },
                      { key: "neck" as BodyArea, label: "Leher" }
                    ].map(area => (
                      <button
                        key={area.key}
                        type="button"
                        onClick={() => setPainBodyArea(area.key)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition ${
                          painBodyArea === area.key
                            ? "bg-red-500/20 border-red-500 text-red-300 font-bold"
                            : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                        }`}
                      >
                        {area.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-red-950/30 border border-red-900/50 text-[11px] text-red-300/90 leading-relaxed">
                  {MEDICAL_SAFETY_DISCLAIMER}
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowPainModal(false)}
                    className="px-3 py-1.5 rounded-lg text-xs text-neutral-400 hover:text-white transition"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleReportPainSubmit}
                    className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow"
                  >
                    Hentikan Gerakan Ini
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ─── MODAL: FORM DEMO / GIF ────────────────────────────────────────── */}
        <AnimatePresence>
          {showGifModal && currentExercise.gifUrl && (
            <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm p-4 flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#111620] border border-neutral-800 rounded-xl p-4 max-w-sm w-full space-y-3 text-center"
              >
                <div className="flex items-center justify-between pb-1 border-b border-neutral-800">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    {currentExercise.name} Form Demo
                  </h4>
                  <button
                    onClick={() => setShowGifModal(false)}
                    className="text-neutral-400 hover:text-white p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="rounded-lg overflow-hidden border border-neutral-800 bg-black flex items-center justify-center min-h-[220px]">
                  <img
                    src={currentExercise.gifUrl}
                    alt={currentExercise.name}
                    className="w-full h-auto max-h-[280px] object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                </div>

                <p className="text-[11px] text-neutral-400 text-left">
                  Perhatikan posisi punggung lurus dan kendalikan tempo repetisi secara mulus.
                </p>

                <button
                  onClick={() => setShowGifModal(false)}
                  className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-white rounded-lg transition"
                >
                  Kembali ke Sesi
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
