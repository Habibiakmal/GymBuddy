import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import GymBuddyLogo from "./Logo";
import {
  Flame,
  Dumbbell,
  Target,
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Award,
  ChevronLeft,
  ChevronRight,
  LogOut,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Droplets,
  Activity,
  HeartPulse,
  User,
  ArrowRight,
  ArrowLeft,
  X
} from "lucide-react";

interface MealItem {
  id: string;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  timestamp?: string;
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
}

interface UserProfileData {
  name: string;
  phone: string;
  goal: string;
  goalTitle: string;
  weight: number;
  startWeight: number;
  targetWeight: number;
  height: number;
  age: number;
  gender: string;
  persona: string;
  tdee?: number;
  targetCalories?: number;
  proteinGrams?: number;
  carbGrams?: number;
  fatGrams?: number;
  fiberGrams?: number;
}

interface DashboardProps {
  user: UserProfileData;
  language?: "EN" | "ID";
  onLogout: () => void;
  onBackToHome: () => void;
  onResetData?: () => void;
}

export default function Dashboard({
  user: initialUser,
  language = "ID",
  onLogout,
  onBackToHome,
  onResetData
}: DashboardProps) {
  const isEN = language === "EN";

  // Helper date string YYYY-MM-DD (local time)
  const formatDateKey = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(formatDateKey(new Date()));
  const [meals, setMeals] = useState<MealItem[]>([]);
  const [loadingMeals, setLoadingMeals] = useState(false);
  const [showAddMealModal, setShowAddMealModal] = useState(false);

  // Live User State
  const [liveUser, setLiveUser] = useState<UserProfileData>(initialUser);
  const [streak, setStreak] = useState<number>(0);
  const [waterCups, setWaterCups] = useState<number>(0);

  // New Meal Form State
  const [newFoodName, setNewFoodName] = useState("");
  const [newCalories, setNewCalories] = useState("");
  const [newProtein, setNewProtein] = useState("");
  const [newCarbs, setNewCarbs] = useState("");
  const [newFat, setNewFat] = useState("");
  const [newMealType, setNewMealType] = useState<"breakfast" | "lunch" | "dinner" | "snack">("lunch");

  // AI Calorie Auto Estimator State inside Modal
  const [aiText, setAiText] = useState("");
  const [analyzingAi, setAnalyzingAi] = useState(false);

  // Weight Update Form State
  const [showUpdateWeightModal, setShowUpdateWeightModal] = useState(false);
  const [newWeightInput, setNewWeightInput] = useState(String(initialUser.weight || 78.5));
  const [weightHistory, setWeightHistory] = useState<any[]>([]);

  // Live Workout Logs State
  const [workoutLogs, setWorkoutLogs] = useState<any[]>([]);


  // Interactive Workout Checklist State
  const [workoutChecked, setWorkoutChecked] = useState<Record<number, boolean>>(() => {
    try {
      const stored = localStorage.getItem(`gymbuddy_workout_${initialUser.phone || "user"}_${selectedDate}`);
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  });

  const normalizePhone = (phone: string): string => {
    if (!phone) return "";
    let cleaned = String(phone).replace(/[^\d]/g, '');
    if (cleaned.startsWith('62')) {
      cleaned = '0' + cleaned.substring(2);
    } else if (cleaned.startsWith('8')) {
      cleaned = '0' + cleaned;
    }
    return cleaned;
  };

  // Calculations & Personalization
  const activeUser = liveUser || initialUser;
  const weight = Number(activeUser.weight) || 70;
  const startWeight = Number(activeUser.startWeight) || weight;

  let goalTitle = activeUser.goalTitle;
  if (!goalTitle) {
    if (activeUser.goal === "lose") goalTitle = "Menurunkan Berat Badan";
    else if (activeUser.goal === "gain") goalTitle = "Menaikkan Berat Badan";
    else goalTitle = "Gaya Hidup Sehat & Fit";
  }

  let targetWeight = activeUser.targetWeight;
  if (targetWeight === undefined || targetWeight === null) {
    if (activeUser.goal === "lose") targetWeight = Math.max(40, startWeight - 7);
    else if (activeUser.goal === "gain") targetWeight = startWeight + 5;
    else targetWeight = startWeight;
  }

  const totalWeightToChange = Math.abs(startWeight - targetWeight) || 1;
  const currentChanged = Math.abs(startWeight - weight);
  const progressPercent = Math.min(100, Math.max(0, Math.round((currentChanged / totalWeightToChange) * 100)));
  const remainingKg = Math.max(0, Number((Math.abs(weight - targetWeight)).toFixed(1)));

  // Dynamic BMR & TDEE Calculation with exact activity level
  const height = Number(activeUser.height) || 165;
  const age = Number(activeUser.age) || 25;
  const isMale = (activeUser.gender || "pria").toLowerCase() === "pria";
  const bmrCalc = Math.round((10 * weight) + (6.25 * height) - (5 * age) + (isMale ? 5 : -161));

  const activityMap: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725
  };
  const activityMultiplier = activityMap[activeUser.persona] || activityMap["moderate"];
  const tdeeCalc = Math.round(bmrCalc * activityMultiplier);

  const isHealthGoal = activeUser.goal === "health" || activeUser.goal === "maintain";
  const isLoseGoal = activeUser.goal === "lose";

  const targetCalories = activeUser.targetCalories || (isLoseGoal ? Math.max(1200, tdeeCalc - 500) : (activeUser.goal === "gain" ? tdeeCalc + 400 : tdeeCalc));
  const targetProtein = activeUser.proteinGrams || (isLoseGoal ? Math.round(weight * 2.0) : (activeUser.goal === "gain" ? Math.round(weight * 2.2) : Math.round(weight * 1.8)));
  const targetFat = activeUser.fatGrams || Math.round((targetCalories * 0.25) / 9);
  const targetCarbs = activeUser.carbGrams || Math.round((targetCalories - (targetProtein * 4 + targetFat * 9)) / 4);
  const targetFiber = activeUser.fiberGrams || Math.max(20, Math.min(38, Math.round(targetCalories / 75)));

  const workoutSchedule = isHealthGoal ? [
    { day: "Senin • Kebugaran & Kardio Ringan", title: "Jogging & Dynamic Stretching (25 Min)", desc: "Menjaga stamina jantung & mobilitas tubuh" },
    { day: "Selasa • Latihan Otot Dasar", title: "Full Body Bodyweight Workout", desc: "Push Up 3 set, Bodyweight Squat 3 set, Plank 60s" },
    { day: "Rabu • Pemulihan Aktif", title: "Jalan Santai 5,000 Langkah & Meditasi", desc: "Melancarkan sirkulasi darah & kurangi stres" },
    { day: "Kamis • Mobilitas & Postur", title: "Yoga & Core Balance", desc: "Menjaga kebugaran sendi & postur tubuh harian" }
  ] : isLoseGoal ? [
    { day: "Senin • Fat Burning HIIT", title: "Jumping Jacks, Burpees & Mountain Climber", desc: "4 Set Interval untuk pembakaran kalori maksimal" },
    { day: "Selasa • Upper Body & Core", title: "Push Up, Dumbbell Row & Crunch", desc: "Menjaga massa otot saat dalam kondisi defisit kalori" },
    { day: "Rabu • Lower Body & Deficit Cardio", title: "Squat, Lunge & Incline Walk (30 Min)", desc: "Fokus pembakaran kalori tubuh bagian bawah" },
    { day: "Kamis • Zone 2 Cardio Recovery", title: "Jalan Cepat / Sepeda (45 Min)", desc: "Menjaga zona pembakaran lemak tanpa lelah berlebih" }
  ] : [
    { day: "Senin • Heavy Push Day", title: "Bench Press, Military Press & Dips", desc: "4 Set X 8-10 Reps untuk hipertrofi otot dada/bahu" },
    { day: "Selasa • Heavy Pull Day", title: "Pull Up, Barbell Row & Bicep Curl", desc: "4 Set X 8-10 Reps untuk pembentukan otot punggung" },
    { day: "Rabu • Heavy Leg Day", title: "Barbell Squat, Romanian Deadlift & Leg Press", desc: "4 Set X 8-10 Reps untuk pertumbuhan otot kaki" },
    { day: "Kamis • Active Recovery", title: "Stretching & Light Walk (30 Min)", desc: "Pemulihan jaringan otot secara optimal" }
  ];

  // Generate 7 Days Ribbon Tabs
  const getRecentDates = () => {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      dates.push({
        dateStr: formatDateKey(d),
        dayName: d.toLocaleDateString(isEN ? "en-US" : "id-ID", { weekday: "short" }),
        dayNum: d.getDate(),
        isToday: formatDateKey(d) === formatDateKey(new Date())
      });
    }
    return dates;
  };

  const recentDates = getRecentDates();

  // Fetch Live Profile from Server API
  const fetchUserProfile = async () => {
    const normPhone = normalizePhone(activeUser.phone || "085156919826");
    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "";
    try {
      const res = await fetch(`${API_BASE_URL}/api/user/${normPhone}`);
      if (res.ok) {
        const data = await res.json();
        if (data && (data.user || data.profile || data.name)) {
          const fresh = data.user || data.profile || data;
          setLiveUser((prev) => ({ ...prev, ...fresh, ...data }));
          if (data.streak !== undefined) setStreak(data.streak);
          if (data.waterCups !== undefined) setWaterCups(data.waterCups);
        }
      }
    } catch (e) {}
  };

  // API Fetch Meals for Selected Date
  const fetchMealsForDate = async (dateStr: string) => {
    setLoadingMeals(true);
    const normPhone = normalizePhone(activeUser.phone || "085156919826");
    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "";

    try {
      const res = await fetch(`${API_BASE_URL}/api/user/${normPhone}/meals?date=${dateStr}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.logs)) {
          setMeals(data.logs);
          try {
            localStorage.setItem(`gymbuddy_meals_${normPhone}_${dateStr}`, JSON.stringify(data.logs));
          } catch (e) {}
          setLoadingMeals(false);
          return;
        }
      }
    } catch (e) {
      console.log("Fetch meals API fallback to local storage...", e);
    }

    try {
      const localData = localStorage.getItem(`gymbuddy_meals_${normPhone}_${dateStr}`);
      if (localData) {
        setMeals(JSON.parse(localData));
      } else {
        setMeals([]);
      }
    } catch (e) {
      setMeals([]);
    }
    setLoadingMeals(false);
  };

  // Fetch Progress History
  const fetchProgress = async () => {
    const normPhone = normalizePhone(activeUser.phone || "085156919826");
    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "";
    try {
      const res = await fetch(`${API_BASE_URL}/api/user/${normPhone}/progress`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.history)) {
          setWeightHistory(data.history);
          return;
        }
      }
    } catch (e) {}

    const curW = Number(activeUser.weight) || 70;
    setWeightHistory([
      { week: 0, weight: curW, changeFromStart: 0, date: "Hari Ini", notes: "Baseline Registrasi Awal" }
    ]);
  };

  // Fetch Water Intake
  const fetchWaterIntake = async (dateStr: string) => {
    const normPhone = normalizePhone(activeUser.phone || "085156919826");
    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "";
    try {
      const res = await fetch(`${API_BASE_URL}/api/user/${normPhone}/water?date=${dateStr}`);
      if (res.ok) {
        const data = await res.json();
        if (data.cups !== undefined) {
          setWaterCups(data.cups);
        }
      }
    } catch (e) {}
  };

  // Fetch Workout Logs for Date
  const fetchWorkoutLogsForDate = async (dateStr: string) => {
    const normPhone = normalizePhone(activeUser.phone || "085156919826");
    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "";
    try {
      const res = await fetch(`${API_BASE_URL}/api/user/${normPhone}/workouts?date=${dateStr}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.logs)) {
          setWorkoutLogs(data.logs);
          return;
        }
      }
    } catch (e) {}
  };

  const handleDeleteWorkout = async (workoutId: string) => {
    const normPhone = normalizePhone(activeUser.phone || "085156919826");
    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "";
    try {
      await fetch(`${API_BASE_URL}/api/user/${normPhone}/workouts/${workoutId}?date=${selectedDate}`, {
        method: "DELETE"
      });
    } catch (e) {}
    setWorkoutLogs(prev => prev.filter(w => w.id !== workoutId));
  };

  // Handle Update Water Cups
  const handleUpdateWaterCups = async (newCups: number) => {
    const validCups = Math.max(0, newCups);
    setWaterCups(validCups);
    const normPhone = normalizePhone(activeUser.phone || "085156919826");
    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "";
    try {
      await fetch(`${API_BASE_URL}/api/user/${normPhone}/water`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cups: validCups, date: selectedDate })
      });
    } catch (e) {}
  };

  // AI Calorie Auto-Estimator inside Modal
  const handleAnalyzeAiFood = async () => {
    if (!aiText.trim()) return;
    setAnalyzingAi(true);
    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "";
    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/analyze-food`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: aiText })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setNewFoodName(data.foodName || aiText);
          setNewCalories(String(data.calories || 250));
          setNewProtein(String(data.protein || 15));
          setNewCarbs(String(data.carbs || 30));
          setNewFat(String(data.fat || 8));
          if (data.mealType) setNewMealType(data.mealType);
        }
      }
    } catch (e) {
      console.error("AI food analyze error:", e);
    }
    setAnalyzingAi(false);
  };

  // Toggle Workout Checklist State
  const toggleWorkoutChecked = (idx: number) => {
    setWorkoutChecked((prev) => {
      const updated = { ...prev, [idx]: !prev[idx] };
      try {
        localStorage.setItem(`gymbuddy_workout_${activeUser.phone || "user"}_${selectedDate}`, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  useEffect(() => {
    fetchUserProfile();
    fetchMealsForDate(selectedDate);
    fetchProgress();
    fetchWaterIntake(selectedDate);
    fetchWorkoutLogsForDate(selectedDate);

    const handleFocus = () => {
      fetchUserProfile();
      fetchMealsForDate(selectedDate);
      fetchProgress();
      fetchWaterIntake(selectedDate);
      fetchWorkoutLogsForDate(selectedDate);
    };

    window.addEventListener("focus", handleFocus);
    const interval = setInterval(() => {
      fetchUserProfile();
      fetchMealsForDate(selectedDate);
      fetchProgress();
      fetchWaterIntake(selectedDate);
      fetchWorkoutLogsForDate(selectedDate);
    }, 3000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
    };
  }, [selectedDate, activeUser.phone]);

  // Totals for selected date
  const totalConsumedCalories = meals.reduce((sum, m) => sum + (Number(m.calories) || 0), 0);
  const totalConsumedProtein = meals.reduce((sum, m) => sum + (Number(m.protein) || 0), 0);
  const totalConsumedCarbs = meals.reduce((sum, m) => sum + (Number(m.carbs) || 0), 0);
  const totalConsumedFat = meals.reduce((sum, m) => sum + (Number(m.fat) || 0), 0);
  const totalConsumedFiber = meals.reduce((sum, m) => sum + (Number(m.fiber) || 0), 0);

  const remainingCalories = Math.max(0, targetCalories - totalConsumedCalories);

  // Handle Add Meal
  const handleAddMealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFoodName.trim()) return;

    const normPhone = normalizePhone(activeUser.phone || "085156919826");
    const newMealObj: MealItem = {
      id: `m-${Date.now()}`,
      foodName: newFoodName,
      calories: Number(newCalories) || 0,
      protein: Number(newProtein) || 0,
      carbs: Number(newCarbs) || 0,
      fat: Number(newFat) || 0,
      mealType: newMealType,
      timestamp: new Date().toISOString()
    };

    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "";

    try {
      await fetch(`${API_BASE_URL}/api/user/${normPhone}/meals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newMealObj,
          date: selectedDate
        })
      });
    } catch (e) {}

    const updated = [...meals, newMealObj];
    setMeals(updated);
    try {
      localStorage.setItem(`gymbuddy_meals_${normPhone}_${selectedDate}`, JSON.stringify(updated));
    } catch (e) {}

    // Reset Form
    setNewFoodName("");
    setNewCalories("");
    setNewProtein("");
    setNewCarbs("");
    setNewFat("");
    setAiText("");
    setShowAddMealModal(false);
  };

  // Handle Delete Meal
  const handleDeleteMeal = async (mealId: string) => {
    const normPhone = normalizePhone(activeUser.phone || "085156919826");
    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "";
    try {
      await fetch(`${API_BASE_URL}/api/user/${normPhone}/meals/${mealId}?date=${selectedDate}`, {
        method: "DELETE"
      });
    } catch (e) {}

    const updated = meals.filter((m) => m.id !== mealId);
    setMeals(updated);
    try {
      localStorage.setItem(`gymbuddy_meals_${normPhone}_${selectedDate}`, JSON.stringify(updated));
    } catch (e) {}
  };

  return (
    <div className="min-h-screen bg-[#0E131F] text-white font-sans selection:bg-[#D4FF00] selection:text-black pb-20">
      {/* Top Navigation Header */}
      <header className="sticky top-0 z-40 bg-[#161C28]/90 backdrop-blur-md border-b border-neutral-800 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <GymBuddyLogo size={32} showText textClassName="text-lg sm:text-xl text-white" />
          <span className="hidden md:inline-block px-2.5 py-0.5 rounded-full bg-[#D4FF00]/10 text-[#D4FF00] text-xs font-bold border border-[#D4FF00]/20">
            MEMBER DASHBOARD
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onBackToHome}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <ArrowLeft size={14} />
            <span>{isEN ? "Landing Page" : "Halaman Utama"}</span>
          </button>
          <a
            href={`https://wa.me/${(import.meta as any).env?.VITE_WHATSAPP_BOT_NUMBER || "14155238886"}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 rounded-full bg-[#25D366] text-black font-extrabold text-xs flex items-center gap-1.5 hover:bg-[#20bd5a] transition-all shadow-sm"
          >
            <span>WhatsApp AI Coach</span>
          </a>
          {onResetData && (
            <button
              onClick={() => {
                if (window.confirm(isEN ? "Are you sure you want to delete all data and re-register?" : "Apakah Anda yakin ingin menghapus semua data dan melakukan registrasi ulang?")) {
                  onResetData();
                }
              }}
              className="px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              title={isEN ? "Delete All Data & Re-register" : "Hapus Data & Registrasi Ulang"}
            >
              <Trash2 size={14} />
              <span className="hidden lg:inline">{isEN ? "Reset & Re-register" : "Hapus Data & Registrasi Ulang"}</span>
            </button>
          )}
          <button
            onClick={onLogout}
            className="p-2 rounded-full text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors cursor-pointer"
            title={isEN ? "Log Out" : "Keluar"}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main Dashboard Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* User Welcome Banner Card */}
        <div className="bg-gradient-to-r from-[#182130] via-[#1B263B] to-[#141B29] border border-neutral-800 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#D4FF00]/5 rounded-full filter blur-3xl pointer-events-none"></div>

          <div className="space-y-2 z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#D4FF00] text-black font-extrabold flex items-center justify-center text-xl shadow-lg shadow-[#D4FF00]/20">
                {activeUser.name ? activeUser.name.charAt(0).toUpperCase() : "U"}
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-['Archivo_Black'] tracking-tight text-white">
                  {isEN ? `Welcome Back, ${activeUser.name}!` : `Halo, ${activeUser.name}!`}
                </h1>
                <p className="text-xs sm:text-sm text-neutral-400 font-medium">
                  {activeUser.phone ? `WhatsApp: ${activeUser.phone}` : "Akun Terverifikasi"} • Coach Persona: <span className="text-[#D4FF00] font-bold uppercase">{(activeUser.persona === "mia" || activeUser.persona === "nikita") ? "Coach Mia" : "Coach Max"}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 z-10 w-full md:w-auto">
            <div className="bg-[#111622] border border-neutral-800 rounded-2xl px-4 py-2.5 flex items-center gap-3 flex-1 sm:flex-none">
              <Flame className="w-6 h-6 text-[#D4FF00]" />
              <div>
                <div className="text-xs text-neutral-400 font-semibold">{isEN ? "Active Streak" : "Streak Aktif"}</div>
                <div className="text-base font-extrabold text-white">{streak} Hari 🔥</div>
              </div>
            </div>
            <div className="bg-[#111622] border border-neutral-800 rounded-2xl px-4 py-2.5 flex items-center gap-3 flex-1 sm:flex-none">
              <Target className="w-6 h-6 text-[#D4FF00]" />
              <div>
                <div className="text-xs text-neutral-400 font-semibold">{isEN ? "Target Goal" : "Target Utama"}</div>
                <div className="text-base font-extrabold text-[#D4FF00]">{goalTitle}</div>
              </div>
            </div>
          </div>
        </div>

        {/* DATE SELECTOR RIBBON */}
        <div className="bg-[#161C28] border border-neutral-800 rounded-2xl p-3 flex items-center justify-between gap-2 overflow-x-auto hide-scrollbar">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-[#D4FF00] ml-2 shrink-0" />
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider shrink-0 mr-2">
              {isEN ? "Log Date:" : "Jurnal Tanggal:"}
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
            {recentDates.map((item) => (
              <button
                key={item.dateStr}
                onClick={() => setSelectedDate(item.dateStr)}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold flex flex-col items-center transition-all cursor-pointer shrink-0 ${
                  selectedDate === item.dateStr
                    ? "bg-[#D4FF00] text-black shadow-lg shadow-[#D4FF00]/20"
                    : "bg-[#1C2433] text-neutral-400 hover:text-white hover:bg-[#232D40]"
                }`}
              >
                <span className="text-[10px] uppercase font-semibold opacity-80">{item.dayName}</span>
                <span className="text-sm font-black">{item.dayNum}</span>
              </button>
            ))}
          </div>

          <div className="shrink-0 flex items-center gap-2 ml-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-[#1C2433] text-white text-xs font-bold px-3 py-2 rounded-xl border border-neutral-700 focus:outline-none focus:border-[#D4FF00]"
            />
          </div>
        </div>

        {/* SECTION 1: MACRO & CALORIE PROGRESS SUMMARY */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main Calorie Progress Card */}
          <div className="lg:col-span-7 bg-[#161C28] border border-neutral-800 rounded-3xl p-6 flex flex-col justify-between space-y-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Flame className="w-5 h-5 text-[#D4FF00]" />
                  <span>{isEN ? "Daily Calorie Balance" : "Asupan Kalori Harian"}</span>
                </h2>
                <p className="text-xs text-neutral-400">
                  {selectedDate === formatDateKey(new Date()) ? (isEN ? "Today's Consumption" : "Konsumsi Hari Ini") : selectedDate}
                </p>
              </div>
              <button
                onClick={() => setShowAddMealModal(true)}
                className="px-3.5 py-2 rounded-xl bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-[#D4FF00]/10"
              >
                <Plus size={16} />
                <span>{isEN ? "Add Meal" : "Catat Makanan"}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-[#111622] border border-neutral-800 rounded-2xl p-5">
              <div>
                <div className="text-xs text-neutral-400 font-semibold mb-1">{isEN ? "Target Calories" : "Target Harian"}</div>
                <div className="text-xl sm:text-2xl font-black text-white">{targetCalories} <span className="text-xs font-normal text-neutral-500">kcal</span></div>
              </div>
              <div>
                <div className="text-xs text-neutral-400 font-semibold mb-1">{isEN ? "Consumed" : "Sudah Dimakan"}</div>
                <div className="text-xl sm:text-2xl font-black text-[#D4FF00]">{totalConsumedCalories} <span className="text-xs font-normal text-neutral-500">kcal</span></div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <div className="text-xs text-neutral-400 font-semibold mb-1">{isEN ? "Remaining" : "Sisa Kalori"}</div>
                <div className="text-xl sm:text-2xl font-black text-emerald-400">{remainingCalories} <span className="text-xs font-normal text-neutral-500">kcal</span></div>
              </div>
            </div>

            {/* Calorie Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-neutral-400">Target Progress</span>
                <span className="text-[#D4FF00]">{Math.min(100, Math.round((totalConsumedCalories / targetCalories) * 100))}%</span>
              </div>
              <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-[#D4FF00] to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (totalConsumedCalories / targetCalories) * 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Macro Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="bg-[#111622] border border-neutral-800/80 rounded-2xl p-3 text-center">
                <div className="text-[11px] font-bold text-neutral-400 uppercase mb-1">Protein</div>
                <div className="text-base sm:text-lg font-black text-white">{totalConsumedProtein}g <span className="text-[10px] text-neutral-500 font-normal">/ {targetProtein}g</span></div>
                <div className="w-full h-1.5 bg-neutral-800 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min(100, (totalConsumedProtein / targetProtein) * 100)}%` }}></div>
                </div>
              </div>

              <div className="bg-[#111622] border border-neutral-800/80 rounded-2xl p-3 text-center">
                <div className="text-[11px] font-bold text-neutral-400 uppercase mb-1">Karbo</div>
                <div className="text-base sm:text-lg font-black text-white">{totalConsumedCarbs}g <span className="text-[10px] text-neutral-500 font-normal">/ {targetCarbs}g</span></div>
                <div className="w-full h-1.5 bg-neutral-800 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.min(100, (totalConsumedCarbs / targetCarbs) * 100)}%` }}></div>
                </div>
              </div>

              <div className="bg-[#111622] border border-neutral-800/80 rounded-2xl p-3 text-center">
                <div className="text-[11px] font-bold text-neutral-400 uppercase mb-1">Lemak</div>
                <div className="text-base sm:text-lg font-black text-white">{totalConsumedFat}g <span className="text-[10px] text-neutral-500 font-normal">/ {targetFat}g</span></div>
                <div className="w-full h-1.5 bg-neutral-800 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-rose-400 rounded-full" style={{ width: `${Math.min(100, (totalConsumedFat / targetFat) * 100)}%` }}></div>
                </div>
              </div>

              <div className="bg-[#111622] border border-neutral-800/80 rounded-2xl p-3 text-center">
                <div className="text-[11px] font-bold text-neutral-400 uppercase mb-1">Serat</div>
                <div className="text-base sm:text-lg font-black text-white">{totalConsumedFiber}g <span className="text-[10px] text-neutral-500 font-normal">/ {targetFiber}g</span></div>
                <div className="w-full h-1.5 bg-neutral-800 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.min(100, (totalConsumedFiber / targetFiber) * 100)}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Goal-Specific Card */}
          {isHealthGoal ? (
            /* Health & Vitality Card for Gaya Hidup Sehat & Fit */
            <div className="lg:col-span-5 bg-[#161C28] border border-neutral-800 rounded-3xl p-6 flex flex-col justify-between space-y-5 shadow-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <HeartPulse className="w-5 h-5 text-[#D4FF00]" />
                  <span>{isEN ? "Daily Vitality & Health" : "Keseimbangan Sehat & Fit"}</span>
                </h2>
                <span className="text-xs font-extrabold text-[#D4FF00] bg-[#D4FF00]/10 border border-[#D4FF00]/20 px-2.5 py-1 rounded-full">
                  Target Kesehatan Optimal
                </span>
              </div>

              <div className="bg-[#111622] border border-neutral-800 rounded-2xl p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-[#161C28] border border-neutral-800 p-3 rounded-xl">
                    <div className="text-[11px] text-neutral-400 font-semibold">{isEN ? "Hydration Goal" : "Target Hidrasi"}</div>
                    <div className="text-base font-extrabold text-[#D4FF00]">{waterCups} / 12 Gelas</div>
                  </div>
                  <div className="bg-[#161C28] border border-neutral-800 p-3 rounded-xl">
                    <div className="text-[11px] text-neutral-400 font-semibold">{isEN ? "Active Streak" : "Konsistensi Harian"}</div>
                    <div className="text-base font-extrabold text-white">{streak} Hari 🔥</div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-neutral-400">{isEN ? "Energy Balance Status:" : "Status Keseimbangan Energi:"}</span>
                    <span className="text-emerald-400">TDEE Balanced ({targetCalories} kcal)</span>
                  </div>
                  <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden p-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-[#D4FF00] to-emerald-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (totalConsumedCalories / targetCalories) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Quick Water Intake Tracker */}
              <div className="bg-[#111622] border border-neutral-800 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
                    <Droplets className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{isEN ? "Water Hydration" : "Konsumsi Air Putih"}</div>
                    <div className="text-xs text-neutral-400">{(waterCups * 0.25).toFixed(1)} Liter / 3.0 L Target</div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleUpdateWaterCups(waterCups - 1)}
                    className="w-7 h-7 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-bold flex items-center justify-center text-xs cursor-pointer"
                  >
                    -
                  </button>
                  <span className="text-xs font-extrabold text-white px-2">{waterCups} Gelas</span>
                  <button
                    onClick={() => handleUpdateWaterCups(waterCups + 1)}
                    className="w-7 h-7 bg-[#D4FF00] text-black hover:bg-[#c4ec00] rounded-lg font-bold flex items-center justify-center text-xs cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Goal Progress Tracker Card for Lose / Gain */
            <div className="lg:col-span-5 bg-[#161C28] border border-neutral-800 rounded-3xl p-6 flex flex-col justify-between space-y-5 shadow-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-[#D4FF00]" />
                  <span>{isEN ? "Weight Goal Progress" : "Progres Target BB"}</span>
                </h2>
                <span className="text-xs font-extrabold text-[#D4FF00] bg-[#D4FF00]/10 border border-[#D4FF00]/20 px-2.5 py-1 rounded-full">
                  {progressPercent}% Complete
                </span>
              </div>

              <div className="bg-[#111622] border border-neutral-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between text-center">
                  <div>
                    <div className="text-[11px] text-neutral-400 font-semibold">{isEN ? "Start Weight" : "BB Awal"}</div>
                    <div className="text-lg font-extrabold text-neutral-300">{startWeight} kg</div>
                  </div>
                  <div className="px-3 py-1 bg-[#D4FF00]/10 rounded-xl border border-[#D4FF00]/20 text-[#D4FF00] text-xs font-black">
                    {isLoseGoal ? `-${(startWeight - weight).toFixed(1)} kg` : `+${(weight - startWeight).toFixed(1)} kg`}
                  </div>
                  <div>
                    <div className="text-[11px] text-neutral-400 font-semibold">{isEN ? "Target Weight" : "Target Akhir"}</div>
                    <div className="text-lg font-extrabold text-[#D4FF00]">{targetWeight} kg</div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-neutral-400">{isEN ? "Current Weight:" : "BB Saat Ini:"} <strong className="text-white">{weight} kg</strong></span>
                    <span className="text-emerald-400">{remainingKg} kg {isEN ? "remaining" : "lagi"}</span>
                  </div>
                  <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden p-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-[#D4FF00] to-emerald-400 rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Quick Water Intake Tracker */}
              <div className="bg-[#111622] border border-neutral-800 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
                    <Droplets className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{isEN ? "Water Hydration" : "Konsumsi Air Putih"}</div>
                    <div className="text-xs text-neutral-400">{(waterCups * 0.25).toFixed(1)} Liter / 3.0 L Target</div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleUpdateWaterCups(waterCups - 1)}
                    className="w-7 h-7 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-bold flex items-center justify-center text-xs cursor-pointer"
                  >
                    -
                  </button>
                  <span className="text-xs font-extrabold text-white px-2">{waterCups} Gelas</span>
                  <button
                    onClick={() => handleUpdateWaterCups(waterCups + 1)}
                    className="w-7 h-7 bg-[#D4FF00] text-black hover:bg-[#c4ec00] rounded-lg font-bold flex items-center justify-center text-xs cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: MEAL LOG JOURNAL FOR SELECTED DATE */}
        <div className="bg-[#161C28] border border-neutral-800 rounded-3xl p-6 space-y-5 shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-[#D4FF00]" />
                <span>{isEN ? `Meal Journal (${selectedDate})` : `Jurnal Makanan (${selectedDate})`}</span>
              </h2>
              <p className="text-xs text-neutral-400">
                {isEN ? "All recorded food intake for this date" : "Daftar makanan yang tercatat pada tanggal ini"}
              </p>
            </div>

            <button
              onClick={() => setShowAddMealModal(true)}
              className="px-4 py-2 bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
            >
              <Plus size={16} />
              <span>{isEN ? "Add Food Item" : "Tambah Menu Makanan"}</span>
            </button>
          </div>

          {loadingMeals ? (
            <div className="text-center py-12 text-neutral-400 text-sm animate-pulse">
              Memuat data jurnal makanan...
            </div>
          ) : meals.length === 0 ? (
            <div className="bg-[#111622] border border-dashed border-neutral-800 rounded-2xl p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center mx-auto">
                <Flame size={24} />
              </div>
              <p className="text-sm font-semibold text-neutral-300">
                {isEN ? "No meals recorded for this date yet." : "Belum ada catatan makanan pada tanggal ini."}
              </p>
              <button
                onClick={() => setShowAddMealModal(true)}
                className="px-4 py-2 bg-[#1C2433] hover:bg-[#232D40] text-[#D4FF00] font-bold text-xs rounded-xl inline-flex items-center gap-1 border border-[#D4FF00]/20"
              >
                <Plus size={14} />
                <span>Catat Makanan Pertama</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {meals.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#111622] border border-neutral-800 hover:border-neutral-700 rounded-2xl p-4 flex items-center justify-between gap-4 transition-all"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#D4FF00]/10 border border-[#D4FF00]/20 text-[#D4FF00] flex items-center justify-center shrink-0 font-bold text-xs uppercase">
                      {item.mealType ? item.mealType.charAt(0) : "M"}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white truncate">{item.foodName}</h3>
                      <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
                        <span className="text-[#D4FF00] font-extrabold">{item.calories} kcal</span>
                        <span>• P:{item.protein}g</span>
                        <span>• K:{item.carbs}g</span>
                        <span>• L:{item.fat}g</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteMeal(item.id)}
                    className="p-2 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer shrink-0"
                    title="Hapus"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 3: PERSONALIZED WORKOUT SCHEDULE & METRICS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Workout Schedule with Interactive Checkboxes */}
          <div className="lg:col-span-8 bg-[#161C28] border border-neutral-800 rounded-3xl p-6 space-y-4 shadow-lg">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-[#D4FF00]" />
              <span>{isEN ? "Personalized Weekly Training Schedule" : "Jadwal Latihan Mingguan (Custom Plan)"}</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {workoutSchedule.map((item, idx) => {
                const isChecked = !!workoutChecked[idx];
                return (
                  <div
                    key={idx}
                    onClick={() => toggleWorkoutChecked(idx)}
                    className={`border rounded-2xl p-4 flex items-center justify-between transition-all cursor-pointer ${
                      isChecked
                        ? "bg-[#D4FF00]/10 border-[#D4FF00]/40"
                        : "bg-[#111622] border-neutral-800 hover:border-neutral-700"
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-[#D4FF00]">{item.day}</div>
                      <div className="text-sm font-extrabold text-white mt-0.5">{item.title}</div>
                      <div className="text-[11px] text-neutral-400 mt-1">{item.desc}</div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                      isChecked
                        ? "bg-[#D4FF00] text-black border-[#D4FF00]"
                        : "border-neutral-700 text-transparent"
                    }`}>
                      ✓
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Log Latihan Hari Ini (WhatsApp & Dashboard API) */}
            {workoutLogs.length > 0 && (
              <div className="pt-4 border-t border-neutral-800 space-y-3">
                <div className="text-xs font-bold text-[#D4FF00] flex items-center gap-1.5">
                  <CheckCircle2 size={14} />
                  <span>Catatan Latihan Selesai ({workoutLogs.length}):</span>
                </div>
                <div className="space-y-2">
                  {workoutLogs.map((w: any) => (
                    <div key={w.id} className="bg-[#111622] border border-neutral-800 rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-extrabold text-white">{w.title}</div>
                        <div className="text-[11px] text-neutral-400">⏱️ {w.durationMinutes || 45} min • 🔥 ~{w.caloriesBurned || 250} kcal</div>
                        {w.notes && <div className="text-[10px] text-neutral-500 italic mt-0.5">{w.notes}</div>}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteWorkout(w.id); }}
                        className="text-neutral-500 hover:text-red-400 p-1 cursor-pointer"
                        title="Hapus Log Latihan"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Health & BMR Calculator Summary */}
          <div className="lg:col-span-4 bg-[#161C28] border border-neutral-800 rounded-3xl p-6 space-y-4 shadow-lg flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-3">
                <Activity className="w-5 h-5 text-[#D4FF00]" />
                <span>{isEN ? "BMR & TDEE Metrics" : "Metrik BMR & TDEE"}</span>
              </h2>

              <div className="space-y-3">
                <div className="bg-[#111622] border border-neutral-800 rounded-2xl p-3.5 flex justify-between items-center">
                  <span className="text-xs text-neutral-400 font-semibold">BMR (Basal Metabolic):</span>
                  <span className="text-sm font-black text-white">{bmrCalc.toLocaleString()} kcal</span>
                </div>
                <div className="bg-[#111622] border border-neutral-800 rounded-2xl p-3.5 flex justify-between items-center">
                  <span className="text-xs text-neutral-400 font-semibold">TDEE (Daily Energy):</span>
                  <span className="text-sm font-black text-[#D4FF00]">{tdeeCalc.toLocaleString()} kcal</span>
                </div>
                <div className="bg-[#111622] border border-neutral-800 rounded-2xl p-3.5 flex justify-between items-center">
                  <span className="text-xs text-neutral-400 font-semibold">
                    {isLoseGoal ? "Calorie Deficit Goal:" : (activeUser.goal === "gain" ? "Calorie Surplus Goal:" : "Maintenance Goal:")}
                  </span>
                  <span className="text-sm font-black text-emerald-400">
                    {isLoseGoal ? "-500 kcal / hari" : (activeUser.goal === "gain" ? "+400 kcal / hari" : "Sebatas TDEE Harian")}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-[#182130] border border-[#D4FF00]/20 rounded-2xl p-4 text-center space-y-2">
              <div className="text-xs font-extrabold text-[#D4FF00] uppercase tracking-wider">
                Personal WhatsApp AI Assistant
              </div>
              <p className="text-xs text-neutral-300">
                Lakukan foto makanan atau ketik menu langsung di WhatsApp untuk autolink ke jurnal ini.
              </p>
            </div>
          </div>
        </div>

      </main>

      {/* ADD MEAL MODAL WITH AI AUTO ESTIMATOR FOR LAYMEN USERS */}
      <AnimatePresence>
        {showAddMealModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#161C28] border border-neutral-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-[#D4FF00]" />
                  <span>Catat Makanan ({selectedDate})</span>
                </h3>
                <button
                  onClick={() => setShowAddMealModal(false)}
                  className="p-1.5 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800"
                >
                  <X size={18} />
                </button>
              </div>

              {/* AI Auto Estimator Box */}
              <div className="bg-[#111622] border border-[#D4FF00]/30 rounded-2xl p-4 space-y-2">
                <label className="text-xs font-extrabold text-[#D4FF00] flex items-center gap-1.5">
                  <Sparkles size={14} />
                  <span>Hitung Kalori Otomatis dengan AI</span>
                </label>
                <p className="text-[11px] text-neutral-400">
                  Cukup ketik nama makanan dalam bahasa biasa (tanpa perlu tahu angka kalori):
                </p>
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Contoh: 'nasi padang dada ayam' / 'wings 4 pcs & telur'"
                    value={aiText}
                    onChange={(e) => setAiText(e.target.value)}
                    className="flex-1 bg-[#161C28] border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4FF00]"
                  />
                  <button
                    type="button"
                    disabled={analyzingAi || !aiText.trim()}
                    onClick={handleAnalyzeAiFood}
                    className="px-3.5 py-2 bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-extrabold text-xs rounded-xl disabled:opacity-50 flex items-center gap-1 shrink-0 cursor-pointer shadow-sm"
                  >
                    {analyzingAi ? "Analyzing..." : "Hitung AI ✨"}
                  </button>
                </div>
              </div>

              <div className="text-center text-xs font-bold text-neutral-500 uppercase tracking-wider">
                — atau isi manual —
              </div>

              <form onSubmit={handleAddMealSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-neutral-300 mb-1 block">Nama Makanan / Minuman</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Dada Ayam Panggang 150g"
                    value={newFoodName}
                    onChange={(e) => setNewFoodName(e.target.value)}
                    className="w-full bg-[#111622] border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4FF00]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-neutral-300 mb-1 block">Kalori (kcal)</label>
                    <input
                      type="number"
                      required
                      placeholder="350"
                      value={newCalories}
                      onChange={(e) => setNewCalories(e.target.value)}
                      className="w-full bg-[#111622] border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4FF00]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-300 mb-1 block">Kategori</label>
                    <select
                      value={newMealType}
                      onChange={(e: any) => setNewMealType(e.target.value)}
                      className="w-full bg-[#111622] border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4FF00]"
                    >
                      <option value="breakfast">Sarapan</option>
                      <option value="lunch">Makan Siang</option>
                      <option value="dinner">Makan Malam</option>
                      <option value="snack">Camilan</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-neutral-400 mb-1 block">Protein (g)</label>
                    <input
                      type="number"
                      placeholder="30"
                      value={newProtein}
                      onChange={(e) => setNewProtein(e.target.value)}
                      className="w-full bg-[#111622] border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D4FF00]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-neutral-400 mb-1 block">Karbo (g)</label>
                    <input
                      type="number"
                      placeholder="40"
                      value={newCarbs}
                      onChange={(e) => setNewCarbs(e.target.value)}
                      className="w-full bg-[#111622] border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D4FF00]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-neutral-400 mb-1 block">Lemak (g)</label>
                    <input
                      type="number"
                      placeholder="10"
                      value={newFat}
                      onChange={(e) => setNewFat(e.target.value)}
                      className="w-full bg-[#111622] border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D4FF00]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-extrabold rounded-xl text-sm transition-all cursor-pointer mt-2"
                >
                  Simpan Makanan
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
