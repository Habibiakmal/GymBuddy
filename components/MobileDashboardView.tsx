import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Home,
  BarChart2,
  Dumbbell,
  User,
  Flame,
  Activity,
  Zap,
  ChevronRight,
  Clock,
  RotateCw,
  Search,
  Droplets,
  Plus,
  Trash2,
  Camera,
  Play,
  ArrowLeft,
  Sparkles,
  Utensils,
  TrendingUp,
  Scale,
  MessageSquare,
  Globe,
  LogOut,
  X,
  Check
} from "lucide-react";

export interface MobileDashboardProps {
  user: any;
  lang: "ID" | "EN";
  onToggleLanguage: () => void;
  // Navigation & Tab state
  activeTab: "home" | "workouts" | "progress" | "profile";
  setActiveTab: (tab: "home" | "workouts" | "progress" | "profile") => void;
  // Nutrition & Meals
  todayMeals: any[];
  totalCaloriesConsumed: number;
  targetCalories: number;
  caloriesRemaining: number;
  isOverCal: boolean;
  calPercent: number;
  totalProtein: number;
  targetProtein: number;
  totalCarbs: number;
  targetCarbs: number;
  totalFat: number;
  targetFat: number;
  totalFiber: number;
  targetFiber: number;
  onOpenScanModal: () => void;
  onDeleteMeal: (mealId: string) => void;
  // Hydration
  waterCups: number;
  targetWaterCups: number;
  onQuickWater: (amountMl: number) => void;
  // Workout
  activeWorkoutPlan: any;
  selectedDayName: string;
  totalCompletedSetsOverall: number;
  totalTargetSetsOverall: number;
  overallWorkoutPercent: number;
  onOpenWorkoutExecution: () => void;
  onOpenShortenWorkout: () => void;
  onOpenWatchMode: () => void;
  // Weight & Transformation
  weight: number;
  targetWeight: number;
  startWeight: number;
  weeklyProgress: any[];
  onOpenUpdateWeight: () => void;
  // Coach & Mood
  coachName: string;
  isMaxPersona: boolean;
  feelState: string;
  onSelectFeel: (feel: any) => void;
  coachRecommendation: string;
  // Date
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  onOpenCalendar: () => void;
  // App Lifecycle
  onLogout?: () => void;
  onBackToHome?: () => void;
}

export default function MobileDashboardView({
  user,
  lang,
  onToggleLanguage,
  activeTab,
  setActiveTab,
  todayMeals,
  totalCaloriesConsumed,
  targetCalories,
  caloriesRemaining,
  isOverCal,
  calPercent,
  totalProtein,
  targetProtein,
  totalCarbs,
  targetCarbs,
  totalFat,
  targetFat,
  totalFiber,
  targetFiber,
  onOpenScanModal,
  onDeleteMeal,
  waterCups,
  targetWaterCups,
  onQuickWater,
  activeWorkoutPlan,
  selectedDayName,
  totalCompletedSetsOverall,
  totalTargetSetsOverall,
  overallWorkoutPercent,
  onOpenWorkoutExecution,
  onOpenShortenWorkout,
  onOpenWatchMode,
  weight,
  targetWeight,
  startWeight,
  weeklyProgress,
  onOpenUpdateWeight,
  coachName,
  isMaxPersona,
  feelState,
  onSelectFeel,
  coachRecommendation,
  selectedDate,
  onSelectDate,
  onOpenCalendar,
  onLogout,
  onBackToHome
}: MobileDashboardProps) {
  const isEN = lang === "EN";
  const [workoutCategory, setWorkoutCategory] = useState<string>("Full Body");
  const [workoutSearch, setWorkoutSearch] = useState<string>("");
  const [showMealDrawer, setShowMealDrawer] = useState<boolean>(false);

  // Generate 7-day strip around selectedDate or today
  const dateStrip = useMemo(() => {
    const today = new Date();
    const days = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dayNum = d.getDate();
      const dateKey = d.toISOString().split("T")[0];
      const isToday = i === 0;
      const monthShort = d.toLocaleString(isEN ? "en-US" : "id-ID", { month: "short" });
      days.push({
        dayNum,
        dateKey,
        isToday,
        label: isToday ? (isEN ? `Today, ${dayNum} ${monthShort}` : `Hari ini, ${dayNum} ${monthShort}`) : `${dayNum}`,
        isSelected: dateKey === selectedDate
      });
    }
    return days;
  }, [selectedDate, isEN]);

  // Curated workout programs matching reference image
  const workoutPrograms = useMemo(() => {
    const all = [
      {
        id: "legs-program",
        title: "Legs Program",
        duration: "15 min",
        reps: "4 reps",
        category: "Legs",
        desc: isEN ? "Engage your core with this quick lower-body power session." : "Fokus pada kekuatan paha, glutes, dan kestabilan kaki.",
        image: "/workouts/legs_program.jpg"
      },
      {
        id: "core-crusher",
        title: "Core Crusher",
        duration: "25 min",
        reps: "2 reps",
        category: "Abs",
        desc: isEN ? "Dynamic routines for a toned midsection and abdominal strength." : "Latihan intensif otot perut dan pinggang untuk postur optimal.",
        image: "/workouts/core_crusher.jpg"
      },
      {
        id: "shoulder-shaper",
        title: "Shoulder Shaper",
        duration: "18 min",
        reps: "5 reps",
        category: "Upper Body",
        desc: isEN ? "Exercises focusing on shoulder definition and posture support." : "Membentuk bahu bidang dan kekuatan otot dorong atas.",
        image: "/workouts/shoulder_shaper.jpg"
      },
      {
        id: "full-body-burn",
        title: activeWorkoutPlan?.focus || "Full Body Power",
        duration: `${activeWorkoutPlan?.targetDuration || 30} min`,
        reps: `${activeWorkoutPlan?.exercises?.length || 4} gerakan`,
        category: "Full Body",
        desc: isEN ? "Coach-curated personalized session for overall hypertrophy & fat burn." : "Program harian pilihan Coach untuk pembakaran lemak & otot optimal.",
        image: "/workouts/legs_program.jpg"
      }
    ];

    if (!workoutSearch.trim() && workoutCategory === "Full Body") {
      return all;
    }

    return all.filter((p) => {
      const matchCat = workoutCategory === "Full Body" || p.category === workoutCategory;
      const matchSearch = !workoutSearch.trim() || p.title.toLowerCase().includes(workoutSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [workoutCategory, workoutSearch, isEN, activeWorkoutPlan]);

  const userName = user?.name || "Member";
  const cappedCalPercent = Math.min(100, Math.max(0, calPercent || 0));

  // Weekly steps mock / historical values
  const weeklyStepsData = [
    { day: "Mon", val: 32, label: "2,400" },
    { day: "Tue", val: 45, label: "2,900" },
    { day: "Wed", val: 55, label: "3,100" },
    { day: "Thu", val: 68, label: "3,400" },
    { day: "Fri", val: 60, label: "3,250" },
    { day: "Sat", val: 78, label: "3,600" },
    { day: "Sun", val: 70, label: "3,500" },
    { day: "Mon", val: 82, label: "3,750" },
    { day: "Tue", val: 100, isPeak: true, label: "3,902" },
    { day: "Wed", val: 65, label: "3,300" },
    { day: "Thu", val: 75, label: "3,550" },
    { day: "Fri", val: 50, label: "3,000" }
  ];

  return (
    <div className="w-full min-h-screen bg-[#0D0E12] text-white font-['Inter',sans-serif] pb-32 selection:bg-[#D4F638] selection:text-black antialiased">
      {/* ===================================================================== */}
      {/* SCREEN 1: HOME (BERANDA) */}
      {/* ===================================================================== */}
      {activeTab === "home" && (
        <div className="px-5 pt-7 space-y-6">
          {/* Top Bar / Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#8E929E] tracking-tight uppercase">
                {isEN ? "Keep Moving Today!" : "Keep Moving Today!"}
              </p>
              <h1 className="text-2xl font-black text-white tracking-tight mt-0.5">
                Hi, {userName}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onToggleLanguage}
                className="px-2.5 py-1 rounded-full bg-[#181A20] border border-white/[0.08] text-[11px] font-bold text-neutral-300 hover:text-white transition-colors cursor-pointer"
              >
                {lang}
              </button>

              <button
                onClick={() => setActiveTab("profile")}
                className="w-10 h-10 rounded-full bg-[#181A20] border border-white/[0.1] flex items-center justify-center text-sm font-extrabold text-[#D4F638] cursor-pointer shadow-md hover:border-[#D4F638]/50 transition-colors"
              >
                {userName.charAt(0).toUpperCase()}
              </button>
            </div>
          </div>

          {/* 1. Daily Goal Progress Card */}
          <div className="bg-[#181A20] border border-white/[0.08] rounded-[24px] p-5 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7)] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">
                  {isEN ? `You're ${cappedCalPercent}% to your daily goal` : `Target harianmu tercapai ${cappedCalPercent}%`}
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
                onClick={onOpenScanModal}
                className="w-9 h-9 rounded-full bg-[#D4F638] text-black flex items-center justify-center shadow-[0_0_15px_rgba(212,246,56,0.4)] cursor-pointer shrink-0"
                title={isEN ? "Scan Food AI" : "Scan Makanan AI"}
              >
                <Zap size={18} fill="currentColor" />
              </motion.button>
            </div>

            {/* Custom Progress Bar with Embedded Pill */}
            <div className="w-full h-8 bg-[#252833] rounded-full p-1 relative flex items-center justify-between overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(12, cappedCalPercent)}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full bg-[#D4F638] rounded-full flex items-center justify-center px-3 shadow-[0_0_15px_rgba(212,246,56,0.35)] shrink-0"
              >
                <span className="text-[11px] font-black text-black tracking-tight whitespace-nowrap">
                  {cappedCalPercent}%
                </span>
              </motion.div>

              <span className="text-[11px] font-semibold text-[#8E929E] pr-3 select-none">
                {totalCaloriesConsumed.toLocaleString()}/{targetCalories.toLocaleString()}
              </span>
            </div>
          </div>

          {/* 2. Recent Reports (Steps Bar Chart) */}
          <div className="space-y-3">
            <h2 className="text-base font-bold text-white tracking-tight">
              {isEN ? "Recent Reports" : "Laporan Terkini"}
            </h2>

            <div className="bg-[#181A20] border border-white/[0.08] rounded-[24px] p-5 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7)] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#D4F638]/20 flex items-center justify-center text-[#D4F638]">
                    <Activity size={14} />
                  </div>
                  <span className="text-xs font-semibold text-[#8E929E]">
                    {isEN ? "Steps" : "Langkah & Aktivitas"}
                  </span>
                </div>
              </div>

              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-black text-white tracking-tight">
                  3,789
                </span>
                <span className="text-xs font-semibold text-[#8E929E]">
                  Steps
                </span>
                <span className="text-sm font-bold text-neutral-300 ml-auto">
                  2.1 km
                </span>
              </div>

              {/* Weekly Vertical Bars with Floating Tooltip on Peak */}
              <div className="pt-6 pb-1">
                <div className="relative flex items-end justify-between h-28 gap-1.5 px-1">
                  {weeklyStepsData.map((b, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full relative group">
                      {b.isPeak && (
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#0D0E12] border border-white/[0.1] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap z-10 flex flex-col items-center">
                          <span>3,902</span>
                          <span className="w-1.5 h-1.5 bg-[#0D0E12] border-r border-b border-white/[0.1] rotate-45 -mt-1" />
                        </div>
                      )}

                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${b.val}%` }}
                        transition={{ duration: 0.6, delay: idx * 0.03 }}
                        className={`w-full rounded-full transition-all ${
                          b.isPeak
                            ? "bg-[#D4F638] shadow-[0_0_12px_rgba(212,246,56,0.6)]"
                            : "bg-[#283818] hover:bg-[#3b5321]"
                        }`}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between mt-2.5 px-1">
                  {weeklyStepsData.map((b, idx) => (
                    <span key={idx} className="flex-1 text-center text-[9px] font-bold text-[#6E7280]">
                      {b.day.charAt(0)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Daily Activity (Dual Metric Cards) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white tracking-tight">
                {isEN ? "Daily Activity" : "Aktivitas Harian"}
              </h2>
              <button
                onClick={() => setActiveTab("progress")}
                className="text-xs font-bold text-[#D4F638] hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <span>Analytics</span>
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              {/* Card 1: Active Calories */}
              <div className="bg-[#181A20] border border-white/[0.08] rounded-[22px] p-4 flex flex-col justify-between h-28 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#8E929E]">
                    {isEN ? "Active Calories" : "Kalori Aktif"}
                  </span>
                  <Flame size={16} className="text-[#D4F638]" />
                </div>
                <div>
                  <span className="text-xl font-black text-white tracking-tight">
                    {totalCaloriesConsumed >= 1000 ? `${(totalCaloriesConsumed / 1000).toFixed(1)}k` : totalCaloriesConsumed}
                  </span>
                  <span className="text-xs font-bold text-[#8E929E] ml-1">Cal</span>
                </div>
              </div>

              {/* Card 2: Total Distance / Time */}
              <div className="bg-[#181A20] border border-white/[0.08] rounded-[22px] p-4 flex flex-col justify-between h-28 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#8E929E]">
                    {isEN ? "Total Distance" : "Total Latihan"}
                  </span>
                  <Activity size={16} className="text-[#D4F638]" />
                </div>
                <div>
                  <span className="text-xl font-black text-white tracking-tight">
                    {(activeWorkoutPlan?.targetDuration * 0.07).toFixed(1)}
                  </span>
                  <span className="text-xs font-bold text-[#8E929E] ml-1">km</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Today's Workout Program Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white tracking-tight">
                {isEN ? "Today's Workout" : "Latihan Hari Ini"}
              </h2>
              <button
                onClick={() => setActiveTab("workouts")}
                className="text-xs font-bold text-[#D4F638] hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <span>{isEN ? "View All" : "Lihat Semua"}</span>
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="relative rounded-[24px] overflow-hidden bg-[#181A20] border border-white/[0.08] shadow-lg group">
              <div className="h-44 w-full relative">
                <img
                  src="/workouts/legs_program.jpg"
                  alt="Today's Workout"
                  className="w-full h-full object-cover object-center brightness-85 group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#181A20] via-black/40 to-transparent" />

                {/* Pill Badges */}
                <div className="absolute top-3.5 left-3.5 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/[0.1] text-[11px] font-bold text-white flex items-center gap-1.5">
                    <Clock size={12} className="text-[#D4F638]" />
                    <span>{activeWorkoutPlan?.targetDuration || 15} min</span>
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/[0.1] text-[11px] font-bold text-white flex items-center gap-1.5">
                    <RotateCw size={12} className="text-[#D4F638]" />
                    <span>{activeWorkoutPlan?.exercises?.length || 4} reps</span>
                  </span>
                </div>
              </div>

              <div className="p-4.5 -mt-3 relative z-10 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-white tracking-tight">
                    {activeWorkoutPlan?.focus || "Legs Program"}
                  </h3>
                  <button
                    onClick={onOpenWorkoutExecution}
                    className="px-3.5 py-1.5 rounded-full bg-[#D4F638] text-black font-extrabold text-xs flex items-center gap-1.5 shadow-[0_0_12px_rgba(212,246,56,0.3)] hover:scale-105 transition-transform cursor-pointer"
                  >
                    <Play size={12} fill="currentColor" />
                    <span>{isEN ? "Start" : "Mulai"}</span>
                  </button>
                </div>
                <p className="text-xs text-[#8E929E] leading-relaxed">
                  {isEN ? "Engage your core with this quick power workout session." : "Latihan terpandu fokus kekuatan dan ketahanan optimal."}
                </p>
              </div>
            </div>
          </div>

          {/* 5. Hydration & Quick Food Meal Logs (Preserving 100% Core Features) */}
          <div className="grid grid-cols-2 gap-3.5">
            {/* Quick Hydration Card */}
            <div className="bg-[#181A20] border border-white/[0.08] rounded-[22px] p-4 flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#8E929E]">
                  {isEN ? "Water" : "Air Minum"}
                </span>
                <Droplets size={16} className="text-sky-400" />
              </div>
              <div>
                <span className="text-lg font-black text-white">
                  {waterCups} / {targetWaterCups}
                </span>
                <span className="text-[11px] font-bold text-[#8E929E] ml-1">{isEN ? "cups" : "gelas"}</span>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  onClick={() => onQuickWater(250)}
                  className="flex-1 py-1 bg-[#252833] hover:bg-[#323644] text-[10px] font-extrabold rounded-lg text-neutral-200 transition-colors cursor-pointer text-center"
                >
                  +250ml
                </button>
                <button
                  onClick={() => onQuickWater(500)}
                  className="flex-1 py-1 bg-[#252833] hover:bg-[#323644] text-[10px] font-extrabold rounded-lg text-neutral-200 transition-colors cursor-pointer text-center"
                >
                  +500ml
                </button>
              </div>
            </div>

            {/* Quick Meal Drawer Trigger Card */}
            <div
              onClick={() => setShowMealDrawer(!showMealDrawer)}
              className="bg-[#181A20] border border-white/[0.08] rounded-[22px] p-4 flex flex-col justify-between space-y-2 cursor-pointer hover:border-white/[0.15] transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#8E929E]">
                  {isEN ? "Today's Meals" : "Menu Hari Ini"}
                </span>
                <Utensils size={16} className="text-amber-400" />
              </div>
              <div>
                <span className="text-lg font-black text-white">
                  {todayMeals.filter((m) => !m.isHydration).length}
                </span>
                <span className="text-[11px] font-bold text-[#8E929E] ml-1">{isEN ? "meals logged" : "menu tercatat"}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold text-[#D4F638]">
                <span>{showMealDrawer ? (isEN ? "Close" : "Tutup") : (isEN ? "View Log" : "Buka Menu")}</span>
                <ChevronRight size={12} className={showMealDrawer ? "rotate-90 transition-transform" : ""} />
              </div>
            </div>
          </div>

          {/* Expandable Food Meals Drawer */}
          <AnimatePresence>
            {showMealDrawer && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden bg-[#181A20] border border-white/[0.08] rounded-[22px] p-4 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                  <span className="text-xs font-extrabold text-white">
                    {isEN ? "Logged Food Items" : "Daftar Makanan Tercatat"}
                  </span>
                  <button
                    onClick={onOpenScanModal}
                    className="text-[11px] font-bold text-[#D4F638] flex items-center gap-1 cursor-pointer"
                  >
                    <Camera size={12} />
                    <span>{isEN ? "Scan Food" : "Scan Foto"}</span>
                  </button>
                </div>

                {todayMeals.filter((m) => !m.isHydration).length === 0 ? (
                  <p className="text-xs text-neutral-400 py-2 text-center">
                    {isEN ? "No food logged yet today." : "Belum ada makanan dicatat hari ini."}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {todayMeals.filter((m) => !m.isHydration).map((meal) => (
                      <div
                        key={meal.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-[#20222a] border border-white/[0.04] text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-white truncate">{meal.foodName}</p>
                          <p className="text-[10px] text-neutral-400">
                            {meal.calories} kcal • P:{meal.protein}g C:{meal.carbs}g F:{meal.fat}g
                          </p>
                        </div>
                        <button
                          onClick={() => onDeleteMeal(meal.id)}
                          className="text-neutral-500 hover:text-rose-400 p-1 cursor-pointer shrink-0"
                          title="Hapus"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Coach Advice Banner */}
          <div className="bg-[#181A20] border border-white/[0.08] rounded-[22px] p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#D4F638] text-black font-black flex items-center justify-center text-sm shrink-0">
              {isMaxPersona ? "🏋️" : "✨"}
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#D4F638]">
                {coachName} • Daily Focus
              </span>
              <p className="text-xs text-neutral-300 leading-relaxed font-medium">
                {coachRecommendation || (isEN ? "Stay consistent with your protein and keep moving today!" : "Jaga konsistensi nutrisi dan tuntaskan menu workout hari ini!")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SCREEN 2: ANALYTICS (PROGRES & ANALISIS) */}
      {/* ===================================================================== */}
      {activeTab === "progress" && (
        <div className="px-5 pt-7 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-black text-white tracking-tight">
              {isEN ? "Analytics" : "Analytics"}
            </h1>
            <button
              onClick={onOpenCalendar}
              className="px-3 py-1.5 rounded-full bg-[#181A20] border border-white/[0.08] text-xs font-bold text-neutral-300 hover:text-white transition-colors cursor-pointer"
            >
              {isEN ? "Calendar" : "Kalender"}
            </button>
          </div>

          {/* Horizontal Date Picker Strip (Exact reference style) */}
          <div className="flex items-center justify-between gap-1 overflow-x-auto py-1 no-scrollbar">
            {dateStrip.map((item, idx) => (
              <button
                key={idx}
                onClick={() => onSelectDate(item.dateKey)}
                className={`transition-all cursor-pointer shrink-0 ${
                  item.isSelected
                    ? "px-4 py-2 rounded-full bg-white text-black font-black text-xs shadow-lg"
                    : "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-[#8E929E] hover:text-white"
                }`}
              >
                {item.isSelected ? item.label : item.dayNum}
              </button>
            ))}
          </div>

          {/* Dual Stat Cards (Top) */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="bg-[#181A20] border border-white/[0.08] rounded-[22px] p-4 flex flex-col justify-between h-28 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#8E929E]">
                  {isEN ? "Active Calories" : "Kalori Aktif"}
                </span>
                <Flame size={16} className="text-[#D4F638]" />
              </div>
              <div>
                <span className="text-xl font-black text-white tracking-tight">
                  {totalCaloriesConsumed >= 1000 ? `${(totalCaloriesConsumed / 1000).toFixed(1)}k` : totalCaloriesConsumed}
                </span>
                <span className="text-xs font-bold text-[#8E929E] ml-1">Cal</span>
              </div>
            </div>

            <div className="bg-[#181A20] border border-white/[0.08] rounded-[22px] p-4 flex flex-col justify-between h-28 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#8E929E]">
                  {isEN ? "Total Distance" : "Total Latihan"}
                </span>
                <Activity size={16} className="text-[#D4F638]" />
              </div>
              <div>
                <span className="text-xl font-black text-white tracking-tight">
                  {(activeWorkoutPlan?.targetDuration * 0.07).toFixed(1)}
                </span>
                <span className="text-xs font-bold text-[#8E929E] ml-1">km</span>
              </div>
            </div>
          </div>

          {/* Steps Activity Bar Chart Card */}
          <div className="bg-[#181A20] border border-white/[0.08] rounded-[24px] p-5 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#D4F638]/20 flex items-center justify-center text-[#D4F638]">
                  <Activity size={14} />
                </div>
                <span className="text-xs font-semibold text-[#8E929E]">
                  {isEN ? "Steps Activity" : "Aktivitas Langkah"}
                </span>
              </div>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-black text-white tracking-tight">3,789</span>
              <span className="text-xs font-semibold text-[#8E929E]">Steps</span>
              <span className="text-sm font-bold text-neutral-300 ml-auto">2.1 km</span>
            </div>

            <div className="pt-6 pb-1">
              <div className="relative flex items-end justify-between h-24 gap-1.5 px-1">
                {weeklyStepsData.map((b, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full relative">
                    {b.isPeak && (
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#0D0E12] border border-white/[0.1] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap z-10 flex flex-col items-center">
                        <span>3,902</span>
                        <span className="w-1.5 h-1.5 bg-[#0D0E12] border-r border-b border-white/[0.1] rotate-45 -mt-1" />
                      </div>
                    )}
                    <div
                      style={{ height: `${b.val}%` }}
                      className={`w-full rounded-full ${
                        b.isPeak ? "bg-[#D4F638] shadow-[0_0_12px_rgba(212,246,56,0.6)]" : "bg-[#283818]"
                      }`}
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mt-2.5 px-1">
                {weeklyStepsData.map((b, idx) => (
                  <span key={idx} className="flex-1 text-center text-[9px] font-bold text-[#6E7280]">
                    {b.day.charAt(0)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Heart Rate / Burn Intensity Curved Line Chart Card (Exact reference) */}
          <div className="bg-[#181A20] border border-white/[0.08] rounded-[24px] p-5 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[#D4F638] text-base">📈</span>
                <span className="text-xs font-semibold text-[#8E929E]">
                  {isEN ? "Heart Rate" : "Denyut Jantung / Intensitas"}
                </span>
              </div>
            </div>

            <div>
              <span className="text-2xl font-black text-white tracking-tight">123</span>
              <span className="text-xs font-bold text-[#8E929E] ml-1.5">Bpm</span>
            </div>

            {/* Smooth SVG Bezier Curved Line Chart */}
            <div className="pt-2">
              <div className="w-full h-24 relative">
                <svg viewBox="0 0 300 90" className="w-full h-full overflow-visible">
                  <defs>
                    <linearGradient id="neonGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D4F638" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#D4F638" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Gradient Area Fill */}
                  <path
                    d="M 10,75 Q 50,75 80,60 T 150,25 T 200,60 T 250,55 T 290,70 L 290,90 L 10,90 Z"
                    fill="url(#neonGradient)"
                  />

                  {/* Neon Line Path */}
                  <path
                    d="M 10,75 Q 50,75 80,60 T 150,25 T 200,60 T 250,55 T 290,70"
                    fill="none"
                    stroke="#D4F638"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />

                  {/* Vertical guide line at peak */}
                  <line
                    x1="150"
                    y1="25"
                    x2="150"
                    y2="85"
                    stroke="rgba(212,246,56,0.3)"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />

                  {/* Glowing peak dot */}
                  <circle
                    cx="150"
                    cy="25"
                    r="4.5"
                    fill="#D4F638"
                    className="shadow-[0_0_10px_rgba(212,246,56,0.8)]"
                  />
                  <circle cx="150" cy="25" r="8" fill="#D4F638" opacity="0.3" />
                </svg>
              </div>

              <div className="flex items-center justify-between text-[10px] font-bold text-[#6E7280] mt-1 px-1">
                <span>08:00</span>
                <span>12:00</span>
                <span>16:00</span>
                <span>20:00</span>
              </div>
            </div>
          </div>

          {/* Macro Distribution (Preserving Full Nutrition Engine Data) */}
          <div className="bg-[#181A20] border border-white/[0.08] rounded-[24px] p-5 space-y-4">
            <h3 className="text-sm font-extrabold text-white">
              {isEN ? "Daily Macro Nutrition" : "Target Makronutrisi Harian"}
            </h3>

            <div className="space-y-3">
              {/* Protein */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-white">Protein</span>
                  <span className="text-neutral-300">{totalProtein}g / {targetProtein}g</span>
                </div>
                <div className="w-full h-2 bg-[#252833] rounded-full overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, Math.round((totalProtein / (targetProtein || 1)) * 100))}%` }}
                    className="h-full bg-[#D4F638] rounded-full"
                  />
                </div>
              </div>

              {/* Carbs */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-white">{isEN ? "Carbs" : "Karbohidrat"}</span>
                  <span className="text-neutral-300">{totalCarbs}g / {targetCarbs}g</span>
                </div>
                <div className="w-full h-2 bg-[#252833] rounded-full overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, Math.round((totalCarbs / (targetCarbs || 1)) * 100))}%` }}
                    className="h-full bg-amber-400 rounded-full"
                  />
                </div>
              </div>

              {/* Fat */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-white">{isEN ? "Fat" : "Lemak"}</span>
                  <span className="text-neutral-300">{totalFat}g / {targetFat}g</span>
                </div>
                <div className="w-full h-2 bg-[#252833] rounded-full overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, Math.round((totalFat / (targetFat || 1)) * 100))}%` }}
                    className="h-full bg-rose-400 rounded-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Weight Tracker Card */}
          <div className="bg-[#181A20] border border-white/[0.08] rounded-[24px] p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#8E929E]">
                {isEN ? "Current Weight" : "Berat Badan Saat Ini"}
              </p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-black text-white">{weight}</span>
                <span className="text-xs font-bold text-neutral-400">kg</span>
                <span className="text-xs font-semibold text-neutral-400 ml-2">
                  (Target: {targetWeight} kg)
                </span>
              </div>
            </div>

            <button
              onClick={onOpenUpdateWeight}
              className="px-3.5 py-2 rounded-full bg-[#D4F638] text-black font-extrabold text-xs cursor-pointer shadow-sm"
            >
              {isEN ? "Log Weight" : "Update BB"}
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SCREEN 3: WORKOUTS (LATIHAN & PROGRAM) */}
      {/* ===================================================================== */}
      {activeTab === "workouts" && (
        <div className="px-5 pt-7 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab("home")}
              className="w-9 h-9 rounded-full bg-[#181A20] border border-white/[0.08] flex items-center justify-center text-white cursor-pointer hover:border-white/[0.2]"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-2xl font-black text-white tracking-tight">
              {isEN ? "Workouts" : "Workouts"}
            </h1>
          </div>

          {/* Pill Search Bar */}
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8E929E]" />
            <input
              type="text"
              value={workoutSearch}
              onChange={(e) => setWorkoutSearch(e.target.value)}
              placeholder={isEN ? "Search Workouts" : "Cari Latihan atau Gerakan..."}
              className="w-full bg-[#181A20] border border-white/[0.08] rounded-full pl-11 pr-4 py-3 text-xs sm:text-sm font-semibold text-white placeholder-[#8E929E] focus:outline-hidden focus:border-[#D4F638] transition-colors"
            />
          </div>

          {/* Category Filter Chips (Horizontal Scroll) */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {["Full Body", "Abs", "Legs", "Glutes", "Upper Body"].map((cat) => {
              const isActive = workoutCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setWorkoutCategory(cat)}
                  className={`px-4 py-2 rounded-full text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
                    isActive
                      ? "bg-white text-black shadow-md"
                      : "bg-[#181A20] border border-white/[0.08] text-[#8E929E] hover:text-white"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Workout Program Cards (Cinematic dark cards) */}
          <div className="space-y-4">
            {workoutPrograms.map((program) => (
              <div
                key={program.id}
                onClick={onOpenWorkoutExecution}
                className="relative rounded-[24px] overflow-hidden bg-[#181A20] border border-white/[0.08] shadow-lg group cursor-pointer"
              >
                <div className="h-44 w-full relative">
                  <img
                    src={program.image}
                    alt={program.title}
                    className="w-full h-full object-cover object-center brightness-85 group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#181A20] via-black/40 to-transparent" />

                  {/* Glass Tags */}
                  <div className="absolute top-3.5 left-3.5 flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/[0.1] text-[11px] font-bold text-white flex items-center gap-1.5">
                      <Clock size={12} className="text-[#D4F638]" />
                      <span>{program.duration}</span>
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/[0.1] text-[11px] font-bold text-white flex items-center gap-1.5">
                      <RotateCw size={12} className="text-[#D4F638]" />
                      <span>{program.reps}</span>
                    </span>
                  </div>
                </div>

                <div className="p-4.5 -mt-3 relative z-10 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-white tracking-tight">
                      {program.title}
                    </h3>
                    <div className="w-8 h-8 rounded-full bg-[#D4F638] text-black flex items-center justify-center shadow-xs">
                      <Play size={14} fill="currentColor" />
                    </div>
                  </div>
                  <p className="text-xs text-[#8E929E] leading-relaxed">
                    {program.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Adjust Duration & Watch Sync */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={onOpenShortenWorkout}
              className="flex-1 py-2.5 px-3 rounded-xl bg-[#181A20] border border-white/[0.08] text-xs font-bold text-neutral-300 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Clock size={14} className="text-[#D4F638]" />
              <span>{isEN ? "Adjust Time" : "Ubah Durasi"}</span>
            </button>

            <button
              onClick={onOpenWatchMode}
              className="flex-1 py-2.5 px-3 rounded-xl bg-[#181A20] border border-white/[0.08] text-xs font-bold text-neutral-300 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Activity size={14} className="text-[#D4F638]" />
              <span>Apple Watch</span>
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SCREEN 4: PROFILE & SETTINGS */}
      {/* ===================================================================== */}
      {activeTab === "profile" && (
        <div className="px-5 pt-7 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-black text-white tracking-tight">
              {isEN ? "My Profile" : "Profil Saya"}
            </h1>
            <button
              onClick={onToggleLanguage}
              className="px-3 py-1.5 rounded-full bg-[#181A20] border border-white/[0.08] text-xs font-bold text-neutral-300 hover:text-white transition-colors cursor-pointer"
            >
              {lang}
            </button>
          </div>

          {/* User Card */}
          <div className="bg-[#181A20] border border-white/[0.08] rounded-[24px] p-5 flex items-center gap-4 shadow-md">
            <div className="w-14 h-14 rounded-full bg-[#D4F638] text-black font-black flex items-center justify-center text-xl shrink-0 shadow-lg">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-black text-white truncate">{userName}</h2>
              <p className="text-xs font-semibold text-[#8E929E] truncate">{user?.phone || "-"}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2 h-2 rounded-full bg-[#D4F638]" />
                <span className="text-[11px] font-bold text-[#D4F638]">
                  {coachName} Active
                </span>
              </div>
            </div>
          </div>

          {/* Quick Settings & App Management */}
          <div className="bg-[#181A20] border border-white/[0.08] rounded-[24px] p-4 space-y-2">
            <button
              onClick={onOpenUpdateWeight}
              className="w-full p-3 rounded-xl hover:bg-[#222530] text-left flex items-center justify-between transition-colors cursor-pointer text-xs font-bold text-white"
            >
              <div className="flex items-center gap-2.5">
                <Scale size={16} className="text-[#D4F638]" />
                <span>{isEN ? "Update Body Weight" : "Perbarui Berat Badan"}</span>
              </div>
              <ChevronRight size={14} className="text-neutral-500" />
            </button>

            <button
              onClick={onOpenCalendar}
              className="w-full p-3 rounded-xl hover:bg-[#222530] text-left flex items-center justify-between transition-colors cursor-pointer text-xs font-bold text-white"
            >
              <div className="flex items-center gap-2.5">
                <Clock size={16} className="text-[#D4F638]" />
                <span>{isEN ? "Calendar History" : "Riwayat Kalender"}</span>
              </div>
              <ChevronRight size={14} className="text-neutral-500" />
            </button>

            {onBackToHome && (
              <button
                onClick={onBackToHome}
                className="w-full p-3 rounded-xl hover:bg-[#222530] text-left flex items-center justify-between transition-colors cursor-pointer text-xs font-bold text-white"
              >
                <div className="flex items-center gap-2.5">
                  <ArrowLeft size={16} className="text-sky-400" />
                  <span>{isEN ? "Landing Page" : "Halaman Utama"}</span>
                </div>
                <ChevronRight size={14} className="text-neutral-500" />
              </button>
            )}

            {onLogout && (
              <button
                onClick={onLogout}
                className="w-full p-3 rounded-xl hover:bg-rose-500/10 text-left flex items-center justify-between transition-colors cursor-pointer text-xs font-bold text-rose-400"
              >
                <div className="flex items-center gap-2.5">
                  <LogOut size={16} />
                  <span>{isEN ? "Log Out" : "Keluar Akun"}</span>
                </div>
                <ChevronRight size={14} className="text-neutral-500" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* FLOATING ISLAND BOTTOM NAVIGATION BAR (Exact reference style) */}
      {/* ===================================================================== */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#121316]/95 backdrop-blur-2xl border border-white/[0.12] rounded-full p-1.5 flex items-center shadow-[0_12px_40px_rgba(0,0,0,0.85)] gap-1">
        {/* Tab: Home */}
        <button
          onClick={() => setActiveTab("home")}
          className={`flex items-center gap-2 py-2 px-3.5 rounded-full transition-all cursor-pointer ${
            activeTab === "home"
              ? "bg-[#D4F638] text-black font-black text-xs shadow-[0_0_15px_rgba(212,246,56,0.35)]"
              : "text-[#8E929E] hover:text-white"
          }`}
        >
          <Home size={18} className={activeTab === "home" ? "stroke-[2.5]" : ""} />
          {activeTab === "home" && <span>Home</span>}
        </button>

        {/* Tab: Analytics / Progress */}
        <button
          onClick={() => setActiveTab("progress")}
          className={`flex items-center gap-2 py-2 px-3.5 rounded-full transition-all cursor-pointer ${
            activeTab === "progress"
              ? "bg-[#D4F638] text-black font-black text-xs shadow-[0_0_15px_rgba(212,246,56,0.35)]"
              : "text-[#8E929E] hover:text-white"
          }`}
        >
          <BarChart2 size={18} className={activeTab === "progress" ? "stroke-[2.5]" : ""} />
          {activeTab === "progress" && <span>Analytics</span>}
        </button>

        {/* Tab: Workouts */}
        <button
          onClick={() => setActiveTab("workouts")}
          className={`flex items-center gap-2 py-2 px-3.5 rounded-full transition-all cursor-pointer ${
            activeTab === "workouts"
              ? "bg-[#D4F638] text-black font-black text-xs shadow-[0_0_15px_rgba(212,246,56,0.35)]"
              : "text-[#8E929E] hover:text-white"
          }`}
        >
          <Dumbbell size={18} className={activeTab === "workouts" ? "stroke-[2.5]" : ""} />
          {activeTab === "workouts" && <span>Workouts</span>}
        </button>

        {/* Tab: Profile */}
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 py-2 px-3.5 rounded-full transition-all cursor-pointer ${
            activeTab === "profile"
              ? "bg-[#D4F638] text-black font-black text-xs shadow-[0_0_15px_rgba(212,246,56,0.35)]"
              : "text-[#8E929E] hover:text-white"
          }`}
        >
          <User size={18} className={activeTab === "profile" ? "stroke-[2.5]" : ""} />
          {activeTab === "profile" && <span>Profile</span>}
        </button>
      </nav>
    </div>
  );
}
