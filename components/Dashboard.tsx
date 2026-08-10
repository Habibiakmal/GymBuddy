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
  Sparkles,
  CheckCircle2,
  Droplets,
  Activity,
  HeartPulse,
  User,
  ArrowRight,
  ArrowLeft,
  X,
  Check,
  Clock,
  Coffee,
  Bell,
  Globe,
  Layers,
  CheckSquare
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
  isHydration?: boolean;
  volumeMl?: number;
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
  workoutSchedule?: any[];
}

interface DashboardProps {
  user: UserProfileData;
  language?: "EN" | "ID";
  onLogout: () => void;
  onBackToHome: () => void;
  onResetData?: () => void;
}

interface WorkoutExercise {
  id: string;
  name: string;
  targetSets: number;
  completedSets: number;
  setsState: boolean[];
  targetReps: string;
  status: "not_started" | "in_progress" | "completed";
}

interface DaySchedule {
  day: string;
  focus: string;
  exercises: WorkoutExercise[];
}

type FeelState = "bad" | "sick" | "not_great" | "okay" | "good" | "great";

// Helper function to check if a single item name is liquid / drink
const isLiquidName = (name: string): boolean => {
  if (!name) return false;
  const lower = name.toLowerCase();
  const liquidKeywords = [
    "air", "water", "mineral", "kopi", "coffee", "teh", "tea",
    "susu", "milk", "jus", "juice", "shake", "drink", "minum",
    "smoothie", "beverage", "soda", "cola", "boba", "latte",
    "espresso", "cappuccino", "syrup", "sirup", "infused",
    "hydrat", "pocari", "gatorade", "le minerale", "aqua", "es teh",
    "es kopi", "yakult", "matcha"
  ];
  return liquidKeywords.some((kw) => lower.includes(kw));
};

// Smart Combo Item Splitting Logic
const splitAndCategorizeComboText = (
  rawName: string,
  totalCal: number = 0,
  totalProt: number = 0,
  totalCarb: number = 0,
  totalFat: number = 0
): { foods: MealItem[]; drinks: MealItem[] } => {
  if (!rawName) return { foods: [], drinks: [] };

  // Split by +, &, " dan ", " with ", ","
  const parts = rawName
    .split(/\+|\s+&\s+|\s+dan\s+|\s+with\s+|,/i)
    .map((p) => p.trim())
    .filter(Boolean);

  const solidParts: string[] = [];
  const liquidParts: string[] = [];

  for (const part of parts) {
    if (isLiquidName(part)) {
      liquidParts.push(part);
    } else {
      solidParts.push(part);
    }
  }

  const foods: MealItem[] = [];
  const drinks: MealItem[] = [];

  const nowIso = new Date().toISOString();

  // If combo contains BOTH solids and liquids (e.g. "Nasi Ayam McD + Kopi")
  if (solidParts.length > 0 && liquidParts.length > 0) {
    // Solid foods get main meal calories/macros
    const solidName = solidParts.join(" + ");
    foods.push({
      id: `m-food-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      foodName: solidName,
      calories: totalCal > 0 ? Math.max(100, totalCal - 50) : 450,
      protein: totalProt > 0 ? totalProt : 25,
      carbs: totalCarb > 0 ? totalCarb : 45,
      fat: totalFat > 0 ? totalFat : 12,
      isHydration: false,
      timestamp: nowIso
    });

    // Liquids get hydration volume & minimal calories
    const drinkName = liquidParts.join(" + ");
    drinks.push({
      id: `m-drink-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      foodName: drinkName,
      calories: 50,
      protein: 1,
      carbs: 5,
      fat: 0,
      isHydration: true,
      volumeMl: 250,
      timestamp: nowIso
    });
  } else if (liquidParts.length > 0) {
    // Only liquids
    drinks.push({
      id: `m-drink-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      foodName: rawName,
      calories: totalCal || 50,
      protein: totalProt || 1,
      carbs: totalCarb || 5,
      fat: totalFat || 0,
      isHydration: true,
      volumeMl: 250,
      timestamp: nowIso
    });
  } else {
    // Only solid foods
    foods.push({
      id: `m-food-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      foodName: rawName,
      calories: totalCal || 350,
      protein: totalProt || 20,
      carbs: totalCarb || 35,
      fat: totalFat || 10,
      isHydration: false,
      timestamp: nowIso
    });
  }

  return { foods, drinks };
};

// Language Dictionary
const translations = {
  ID: {
    memberDashboard: "MEMBER DASHBOARD",
    welcome: "Halo",
    landingPage: "Halaman Utama",
    removeAccount: "Hapus Akun",
    logout: "Keluar",
    currentStreak: "Current Streak",
    longestStreak: "Longest Streak",
    activeDaysConsecutive: "hari berturut-turut",
    recordStreakDays: "hari rekor terpanjang",
    targetGoals: "Target Goals",
    mainGoalTitle: "Goal Utama",
    currentWeightLabel: "BB Saat Ini",
    targetWeightLabel: "Target BB",
    remainingLabel: "Sisa",
    dailyTargetLabel: "Target Nutrisi Harian",
    caloriesLabel: "Kalori",
    proteinLabel: "Protein",
    carbsLabel: "Karbohidrat",
    fatLabel: "Lemak",
    howDoYouFeel: "How do you feel today?",
    feelSubtext: "Ini bukan diagnosis medis. Hanya digunakan sebagai daily wellbeing dan readiness check.",
    feelBad: "Feeling Bad",
    sick: "Sick",
    notGreat: "Not Great",
    okay: "Okay",
    good: "Good",
    great: "Great",
    weeklyWorkoutSchedule: "Jadwal Workout Mingguan",
    todaysFocus: "Fokus Hari Ini",
    viewFullWeeklySchedule: "Lihat Seluruh Jadwal (Senin - Minggu)",
    viewTodayOnly: "Kembali ke Jadwal Hari Ini",
    setsCompleted: "set selesai",
    setUnit: "Set",
    statusNotStarted: "Belum Mulai",
    statusInProgress: "Sedang Berlangsung",
    statusCompleted: "Selesai",
    clickForDetails: "Klik untuk detail & checklist set",
    foodMeals: "Food Meals",
    addFoodBtn: "Tambah Makanan",
    noMealsLogged: "Belum ada makanan padat tercatat hari ini.",
    waterHydration: "Water / Hydration",
    addDrinkBtn: "Tambah Minuman",
    hydrationTarget: "Target Hidrasi Harian",
    quickAdd250: "+250 ml Air",
    quickAdd500: "+500 ml Air",
    noDrinksLogged: "Belum ada minuman tercatat hari ini.",
    coachRecommendation: "Rekomendasi Coach",
    autoReminderTitle: "Pengingat Latihan Harian",
    autoReminderPrompt: "Ayo latihan hari ini! 💪 Mau diingetin jam berapa buat gym atau makan?",
    setReminderBtn: "Atur Pengingat",
    remindLater: "Nanti Saja",
    reminderSetMsg: "Pengingat telah diatur untuk pukul",
    workoutDetailTitle: "Detail Workout & Set Completion",
    targetRepsLabel: "Target Repetisi / Durasi",
    setChecklistLabel: "Checklist Completion Per Set",
    closeModal: "Tutup",
    addMealModalTitle: "Tambah Log Makanan / Minuman",
    foodNameLabel: "Nama Makanan / Combo (misal: 'Nasi Ayam McD + Kopi')",
    volumeLabel: "Volume (ml)",
    caloriesInputLabel: "Kalori (kcal)",
    proteinInputLabel: "Protein (g)",
    carbsInputLabel: "Karbo (g)",
    fatInputLabel: "Lemak (g)",
    saveEntry: "Simpan Log",
    updateWeightTitle: "Update Berat Badan",
    weightInputLabel: "Berat Badan Baru (kg)",
    saveWeight: "Simpan BB Baru"
  },
  EN: {
    memberDashboard: "MEMBER DASHBOARD",
    welcome: "Welcome Back",
    landingPage: "Landing Page",
    removeAccount: "Remove Account",
    logout: "Log Out",
    currentStreak: "Current Streak",
    longestStreak: "Longest Streak",
    activeDaysConsecutive: "consecutive days",
    recordStreakDays: "all-time record days",
    targetGoals: "Target Goals",
    mainGoalTitle: "Main Goal",
    currentWeightLabel: "Current Weight",
    targetWeightLabel: "Target Weight",
    remainingLabel: "Remaining",
    dailyTargetLabel: "Daily Nutrition Target",
    caloriesLabel: "Calories",
    proteinLabel: "Protein",
    carbsLabel: "Carbohydrates",
    fatLabel: "Fat",
    howDoYouFeel: "How do you feel today?",
    feelSubtext: "This is not a medical diagnosis. Used only for daily wellbeing and readiness check.",
    feelBad: "Feeling Bad",
    sick: "Sick",
    notGreat: "Not Great",
    okay: "Okay",
    good: "Good",
    great: "Great",
    weeklyWorkoutSchedule: "Weekly Workout Schedule",
    todaysFocus: "Today's Focus",
    viewFullWeeklySchedule: "View Full Schedule (Mon - Sun)",
    viewTodayOnly: "Back to Today's Workout",
    setsCompleted: "sets completed",
    setUnit: "Set",
    statusNotStarted: "Not Started",
    statusInProgress: "In Progress",
    statusCompleted: "Completed",
    clickForDetails: "Click for details & set checklist",
    foodMeals: "Food Meals",
    addFoodBtn: "Add Food",
    noMealsLogged: "No solid meals logged for today.",
    waterHydration: "Water / Hydration",
    addDrinkBtn: "Add Drink",
    hydrationTarget: "Daily Hydration Target",
    quickAdd250: "+250 ml Water",
    quickAdd500: "+500 ml Water",
    noDrinksLogged: "No drinks logged for today.",
    coachRecommendation: "Coach Recommendation",
    autoReminderTitle: "Daily Workout Reminder",
    autoReminderPrompt: "Let's train today! 💪 What time would you like a reminder for gym or meals?",
    setReminderBtn: "Set Reminder",
    remindLater: "Later",
    reminderSetMsg: "Reminder scheduled for",
    workoutDetailTitle: "Workout Detail & Set Completion",
    targetRepsLabel: "Target Reps / Duration",
    setChecklistLabel: "Per-Set Completion Checklist",
    closeModal: "Close",
    addMealModalTitle: "Add Food / Combo Item Log",
    foodNameLabel: "Item Name / Combo (e.g. 'Chicken Rice + Coffee')",
    volumeLabel: "Volume (ml)",
    caloriesInputLabel: "Calories (kcal)",
    proteinInputLabel: "Protein (g)",
    carbsInputLabel: "Carbs (g)",
    fatInputLabel: "Fat (g)",
    saveEntry: "Save Log",
    updateWeightTitle: "Update Body Weight",
    weightInputLabel: "New Weight (kg)",
    saveWeight: "Save New Weight"
  }
};

// 7-Day Weekly Workout Schedule Personalizer
function getPersonalizedWeeklySchedule(user: UserProfileData): DaySchedule[] {
  const goal = user?.goal || "lose";

  if (goal === "gain") {
    return [
      { day: "Senin", focus: "Upper Body Hypertrophy (Chest & Shoulders)", exercises: [
        { id: "w-mon-1", name: "Incline Barbell Bench Press", targetSets: 4, completedSets: 0, setsState: [false, false, false, false], targetReps: "4 Set x 8-10 Reps", status: "not_started" },
        { id: "w-mon-2", name: "Dumbbell Shoulder Press", targetSets: 4, completedSets: 0, setsState: [false, false, false, false], targetReps: "4 Set x 10 Reps", status: "not_started" },
        { id: "w-mon-3", name: "Tricep Dips / Pushdown", targetSets: 3, completedSets: 0, setsState: [false, false, false], targetReps: "3 Set x 12 Reps", status: "not_started" }
      ]},
      { day: "Selasa", focus: "Punggung & Bicep (Pull Day)", exercises: [
        { id: "w-tue-1", name: "Wide-Grip Lat Pulldown", targetSets: 4, completedSets: 0, setsState: [false, false, false, false], targetReps: "4 Set x 10-12 Reps", status: "not_started" },
        { id: "w-tue-2", name: "Seated Cable Row", targetSets: 4, completedSets: 0, setsState: [false, false, false, false], targetReps: "4 Set x 10 Reps", status: "not_started" },
        { id: "w-tue-3", name: "Barbell Bicep Curls", targetSets: 3, completedSets: 0, setsState: [false, false, false], targetReps: "3 Set x 12 Reps", status: "not_started" }
      ]},
      { day: "Rabu", focus: "Leg Mass & Core (Leg Day)", exercises: [
        { id: "w-wed-1", name: "Barbell Back Squat", targetSets: 4, completedSets: 0, setsState: [false, false, false, false], targetReps: "4 Set x 8 Reps", status: "not_started" },
        { id: "w-wed-2", name: "Leg Press & Romanian Deadlift", targetSets: 4, completedSets: 0, setsState: [false, false, false, false], targetReps: "4 Set x 10 Reps", status: "not_started" },
        { id: "w-wed-3", name: "Hanging Leg Raise", targetSets: 3, completedSets: 0, setsState: [false, false, false], targetReps: "3 Set x 15 Reps", status: "not_started" }
      ]},
      { day: "Kamis", focus: "Active Recovery & Mobility", exercises: [
        { id: "w-thu-1", name: "Full Body Dynamic Stretching", targetSets: 2, completedSets: 0, setsState: [false, false], targetReps: "15 Menit Mobilitas", status: "not_started" },
        { id: "w-thu-2", name: "Foam Rolling & Walk", targetSets: 1, completedSets: 0, setsState: [false], targetReps: "20 Menit Jalan Santai", status: "not_started" }
      ]},
      { day: "Jumat", focus: "Chest & Arms Hypertrophy", exercises: [
        { id: "w-fri-1", name: "Flat Dumbbell Press", targetSets: 4, completedSets: 0, setsState: [false, false, false, false], targetReps: "4 Set x 10 Reps", status: "not_started" },
        { id: "w-fri-2", name: "Cable Chest Fly", targetSets: 3, completedSets: 0, setsState: [false, false, false], targetReps: "3 Set x 12 Reps", status: "not_started" },
        { id: "w-fri-3", name: "Preacher Bicep Curls", targetSets: 3, completedSets: 0, setsState: [false, false, false], targetReps: "3 Set x 12 Reps", status: "not_started" }
      ]},
      { day: "Sabtu", focus: "Delts 3D & Core Focus", exercises: [
        { id: "w-sat-1", name: "Lateral Raise & Reverse Fly", targetSets: 4, completedSets: 0, setsState: [false, false, false, false], targetReps: "4 Set x 15 Reps", status: "not_started" },
        { id: "w-sat-2", name: "Ab Wheel Rollout", targetSets: 3, completedSets: 0, setsState: [false, false, false], targetReps: "3 Set x 12 Reps", status: "not_started" }
      ]},
      { day: "Minggu", focus: "Rest & Protein Synthesis", exercises: [
        { id: "w-sun-1", name: "Istirahat Total & Tidur Berkualitas", targetSets: 1, completedSets: 0, setsState: [false], targetReps: "Recovery 8 Jam Tidur", status: "not_started" }
      ]}
    ];
  } else if (goal === "lose") {
    return [
      { day: "Senin", focus: "Fat Loss HIIT & Push Day", exercises: [
        { id: "w-mon-1", name: "Push Up (Chest & Core)", targetSets: 3, completedSets: 0, setsState: [false, false, false], targetReps: "3 Set x 12-15 Reps", status: "not_started" },
        { id: "w-mon-2", name: "Dumbbell Shoulder Press", targetSets: 3, completedSets: 0, setsState: [false, false, false], targetReps: "3 Set x 12 Reps", status: "not_started" },
        { id: "w-mon-3", name: "Jumping Jacks & Mountain Climbers", targetSets: 3, completedSets: 0, setsState: [false, false, false], targetReps: "3 Set x 45 Detik", status: "not_started" }
      ]},
      { day: "Selasa", focus: "Upper Body & Core Deficit", exercises: [
        { id: "w-tue-1", name: "Lat Pulldown / Bodyweight Row", targetSets: 3, completedSets: 0, setsState: [false, false, false], targetReps: "3 Set x 12 Reps", status: "not_started" },
        { id: "w-tue-2", name: "Plank & Core Hold", targetSets: 3, completedSets: 0, setsState: [false, false, false], targetReps: "3 Set x 45 Detik", status: "not_started" },
        { id: "w-tue-3", name: "Treadmill Incline Walk", targetSets: 1, completedSets: 0, setsState: [false], targetReps: "30 Menit Speed 4.5", status: "not_started" }
      ]},
      { day: "Rabu", focus: "Lower Body Fat Crusher", exercises: [
        { id: "w-wed-1", name: "Goblet Bodyweight Squat", targetSets: 4, completedSets: 0, setsState: [false, false, false, false], targetReps: "4 Set x 15 Reps", status: "not_started" },
        { id: "w-wed-2", name: "Walking Lunges", targetSets: 3, completedSets: 0, setsState: [false, false, false], targetReps: "3 Set x 12 Reps", status: "not_started" },
        { id: "w-wed-3", name: "Kettlebell Swing", targetSets: 3, completedSets: 0, setsState: [false, false, false], targetReps: "3 Set x 20 Reps", status: "not_started" }
      ]},
      { day: "Kamis", focus: "Zone 2 Cardio Fat Burn", exercises: [
        { id: "w-thu-1", name: "Stationary Bike / Incline Walk", targetSets: 1, completedSets: 0, setsState: [false], targetReps: "45 Menit Zona 2", status: "not_started" },
        { id: "w-thu-2", name: "Full Body Mobility Stretch", targetSets: 1, completedSets: 0, setsState: [false], targetReps: "15 Menit Stretching", status: "not_started" }
      ]},
      { day: "Jumat", focus: "Full Body Calorie Burner", exercises: [
        { id: "w-fri-1", name: "Burpees & Squat Jumps", targetSets: 3, completedSets: 0, setsState: [false, false, false], targetReps: "3 Set x 10-12 Reps", status: "not_started" },
        { id: "w-fri-2", name: "Dumbbell Thruster", targetSets: 3, completedSets: 0, setsState: [false, false, false], targetReps: "3 Set x 12 Reps", status: "not_started" },
        { id: "w-fri-3", name: "Bicycle Crunches", targetSets: 3, completedSets: 0, setsState: [false, false, false], targetReps: "3 Set x 20 Reps", status: "not_started" }
      ]},
      { day: "Sabtu", focus: "Core & Incline Walking", exercises: [
        { id: "w-sat-1", name: "Incline Treadmill Walk", targetSets: 1, completedSets: 0, setsState: [false], targetReps: "40 Menit Speed 4.5", status: "not_started" },
        { id: "w-sat-2", name: "Russian Twists & Plank", targetSets: 3, completedSets: 0, setsState: [false, false, false], targetReps: "3 Set x 20 Reps", status: "not_started" }
      ]},
      { day: "Minggu", focus: "Rest & Active Recovery", exercises: [
        { id: "w-sun-1", name: "Jalan Santai & Hydration Recovery", targetSets: 1, completedSets: 0, setsState: [false], targetReps: "Recovery & Hidrasi", status: "not_started" }
      ]}
    ];
  } else {
    return [
      { day: "Senin", focus: "Stamina & Mobilitas", exercises: [
        { id: "w-mon-1", name: "Jogging & Dynamic Stretching", targetSets: 1, completedSets: 0, setsState: [false], targetReps: "25 Menit", status: "not_started" },
        { id: "w-mon-2", name: "Bodyweight Push Up", targetSets: 3, completedSets: 0, setsState: [false, false, false], targetReps: "3 Set x 10 Reps", status: "not_started" }
      ]},
      { day: "Selasa", focus: "Latihan Otot Dasar", exercises: [
        { id: "w-tue-1", name: "Bodyweight Squat", targetSets: 3, completedSets: 0, setsState: [false, false, false], targetReps: "3 Set x 12 Reps", status: "not_started" },
        { id: "w-tue-2", name: "Plank Hold", targetSets: 3, completedSets: 0, setsState: [false, false, false], targetReps: "3 Set x 45 Detik", status: "not_started" }
      ]},
      { day: "Rabu", focus: "Pemulihan Aktif", exercises: [
        { id: "w-wed-1", name: "Jalan Santai 5,000 Langkah", targetSets: 1, completedSets: 0, setsState: [false], targetReps: "5,000 Langkah", status: "not_started" }
      ]},
      { day: "Kamis", focus: "Yoga & Postur", exercises: [
        { id: "w-thu-1", name: "Yoga & Core Balance", targetSets: 1, completedSets: 0, setsState: [false], targetReps: "30 Menit", status: "not_started" }
      ]},
      { day: "Jumat", focus: "Full Body Conditioning", exercises: [
        { id: "w-fri-1", name: "Bodyweight Circuit", targetSets: 3, completedSets: 0, setsState: [false, false, false], targetReps: "3 Set Circuit", status: "not_started" }
      ]},
      { day: "Sabtu", focus: "Kardio Bebas", exercises: [
        { id: "w-sat-1", name: "Berenang / Sepeda Santai", targetSets: 1, completedSets: 0, setsState: [false], targetReps: "40 Menit", status: "not_started" }
      ]},
      { day: "Minggu", focus: "Istirahat Total", exercises: [
        { id: "w-sun-1", name: "Full Body Mobility & Rest", targetSets: 1, completedSets: 0, setsState: [false], targetReps: "Recovery", status: "not_started" }
      ]}
    ];
  }
}

export default function Dashboard({
  user: initialUser,
  language: initialLang = "ID",
  onLogout,
  onBackToHome,
  onResetData
}: DashboardProps) {
  // Language Persistence
  const [lang, setLang] = useState<"ID" | "EN">(() => {
    try {
      const stored = localStorage.getItem("gymbuddy_lang");
      return stored === "EN" || stored === "ID" ? stored : initialLang;
    } catch (e) {
      return initialLang;
    }
  });

  const t = translations[lang];

  const toggleLanguage = () => {
    const nextLang = lang === "ID" ? "EN" : "ID";
    setLang(nextLang);
    try {
      localStorage.setItem("gymbuddy_lang", nextLang);
    } catch (e) {}
  };

  // Helper date string YYYY-MM-DD
  const formatDateKey = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(formatDateKey(new Date()));
  const [liveUser, setLiveUser] = useState<UserProfileData>(initialUser);
  const [allLogs, setAllLogs] = useState<MealItem[]>([]);
  const [showFullWeeklyOverview, setShowFullWeeklyOverview] = useState(false);

  // Feel State per date
  const [feelState, setFeelState] = useState<FeelState>(() => {
    try {
      const stored = localStorage.getItem(`gymbuddy_feel_${initialUser.phone || "user"}_${selectedDate}`);
      return (stored as FeelState) || "good";
    } catch (e) {
      return "good";
    }
  });

  // Auto Reminder Trigger State
  const [showAutoReminderModal, setShowAutoReminderModal] = useState(false);
  const [selectedReminderTime, setSelectedReminderTime] = useState("17:00");
  const [reminderNotificationMsg, setReminderNotificationMsg] = useState<string | null>(null);

  // Weekly Schedule Data
  const weeklySchedule = getPersonalizedWeeklySchedule(initialUser);

  // Map selected date to Day of Week (Senin, Selasa, etc.)
  const getDayNameFromDateStr = (dateStr: string) => {
    const parts = dateStr.split("-");
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const dayIdx = d.getDay(); // 0 is Sunday, 1 is Monday
    const idDays = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    return idDays[dayIdx];
  };

  const selectedDayName = getDayNameFromDateStr(selectedDate);
  const todayScheduleObj = weeklySchedule.find((s) => s.day === selectedDayName) || weeklySchedule[0];

  // Exercises State per date
  const [exercises, setExercises] = useState<WorkoutExercise[]>(() => {
    try {
      const stored = localStorage.getItem(`gymbuddy_exercises_${initialUser.phone || "user"}_${selectedDate}`);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return todayScheduleObj.exercises;
  });

  const [activeWorkoutDetail, setActiveWorkoutDetail] = useState<WorkoutExercise | null>(null);

  // Modals State
  const [showAddFoodModal, setShowAddFoodModal] = useState(false);
  const [showAddDrinkModal, setShowAddDrinkModal] = useState(false);
  const [showUpdateWeightModal, setShowUpdateWeightModal] = useState(false);

  // Log Inputs State
  const [itemNameInput, setItemNameInput] = useState("");
  const [itemCalInput, setItemCalInput] = useState("");
  const [itemProteinInput, setItemProteinInput] = useState("");
  const [itemCarbsInput, setItemCarbsInput] = useState("");
  const [itemFatInput, setItemFatInput] = useState("");
  const [itemVolumeInput, setItemVolumeInput] = useState("250");

  const [newWeightInput, setNewWeightInput] = useState(String(initialUser.weight || 70));

  const normalizePhone = (phone: string): string => {
    if (!phone) return "";
    let cleaned = String(phone).replace(/[^\d]/g, "");
    if (cleaned.startsWith("62")) {
      cleaned = "0" + cleaned.substring(2);
    } else if (cleaned.startsWith("8")) {
      cleaned = "0" + cleaned;
    }
    return cleaned;
  };

  const activeUser = liveUser || initialUser;
  const weight = Number(activeUser.weight) || 70;
  const startWeight = Number(activeUser.startWeight) || weight;

  let goalTitle = activeUser.goalTitle;
  if (!goalTitle) {
    if (activeUser.goal === "lose") goalTitle = lang === "EN" ? "Weight Loss" : "Menurunkan Berat Badan";
    else if (activeUser.goal === "gain") goalTitle = lang === "EN" ? "Muscle Gain" : "Menaikkan Berat Badan & Massa Otot";
    else goalTitle = lang === "EN" ? "Healthy & Fit Lifestyle" : "Gaya Hidup Sehat & Fit";
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
  const remainingKg = Math.max(0, Number(Math.abs(weight - targetWeight).toFixed(1)));

  // BMR & TDEE
  const height = Number(activeUser.height) || 165;
  const age = Number(activeUser.age) || 25;
  const isMale = (activeUser.gender || "pria").toLowerCase() === "pria" || (activeUser.gender || "").toLowerCase() === "male";
  const bmrCalc = Math.round(10 * weight + 6.25 * height - 5 * age + (isMale ? 5 : -161));
  const tdeeCalc = Math.round(bmrCalc * 1.4);

  const targetCalories = activeUser.targetCalories || (activeUser.goal === "lose" ? Math.max(1200, tdeeCalc - 500) : activeUser.goal === "gain" ? tdeeCalc + 400 : tdeeCalc);
  const targetProtein = activeUser.proteinGrams || (activeUser.goal === "lose" ? Math.round(weight * 2.0) : activeUser.goal === "gain" ? Math.round(weight * 2.2) : Math.round(weight * 1.8));
  const targetFat = activeUser.fatGrams || Math.round((targetCalories * 0.25) / 9);
  const targetCarbs = activeUser.carbGrams || Math.round((targetCalories - (targetProtein * 4 + targetFat * 9)) / 4);

  const isMaxPersona = (activeUser.persona || "max").toLowerCase() === "max";
  const coachName = isMaxPersona ? "Coach Max" : "Coach Mia";

  // Date Ribbon (7 Days)
  const getRecentDates = () => {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      dates.push({
        dateStr: formatDateKey(d),
        dayName: d.toLocaleDateString(lang === "EN" ? "en-US" : "id-ID", { weekday: "short" }),
        dayNum: d.getDate(),
        isToday: formatDateKey(d) === formatDateKey(new Date())
      });
    }
    return dates;
  };

  const recentDates = getRecentDates();

  // Filtered Food Meals vs Hydration Logs
  const foodMeals = allLogs.filter((item) => !isLiquidName(item.foodName) && !item.isHydration);
  const hydrationLogs = allLogs.filter((item) => isLiquidName(item.foodName) || item.isHydration);

  // Totals
  const totalCaloriesConsumed = foodMeals.reduce((sum, item) => sum + (Number(item.calories) || 0), 0);
  const totalProteinConsumed = foodMeals.reduce((sum, item) => sum + (Number(item.protein) || 0), 0);
  const totalCarbsConsumed = foodMeals.reduce((sum, item) => sum + (Number(item.carbs) || 0), 0);
  const totalFatConsumed = foodMeals.reduce((sum, item) => sum + (Number(item.fat) || 0), 0);

  const totalHydrationMl = hydrationLogs.reduce((sum, item) => sum + (Number(item.volumeMl) || 250), 0);
  const totalWaterCups = Math.floor(totalHydrationMl / 250);

  // Workout Set Calculations
  const totalTargetSetsOverall = exercises.reduce((sum, ex) => sum + ex.targetSets, 0);
  const totalCompletedSetsOverall = exercises.reduce((sum, ex) => sum + ex.completedSets, 0);
  const overallWorkoutPercent = totalTargetSetsOverall > 0 ? Math.round((totalCompletedSetsOverall / totalTargetSetsOverall) * 100) : 0;
  const isTodayWorkoutFinished = overallWorkoutPercent === 100 && totalTargetSetsOverall > 0;

  // Streak Calculation
  const calculateStreaks = () => {
    let current = 0;
    let longest = 0;
    const phone = activeUser.phone || "user";
    const today = new Date();

    let tempLongest = 0;
    let isCountingCurrent = true;

    for (let i = 0; i < 30; i++) {
      const d = new Date(today.getTime() - i * 86400000);
      const dKey = formatDateKey(d);

      let hasActivity = false;
      try {
        const storedEx = localStorage.getItem(`gymbuddy_exercises_${phone}_${dKey}`);
        if (storedEx) {
          const parsedEx: WorkoutExercise[] = JSON.parse(storedEx);
          if (parsedEx.some((e) => e.completedSets > 0)) hasActivity = true;
        }
        const storedMeals = localStorage.getItem(`gymbuddy_meals_${phone}_${dKey}`);
        if (storedMeals && JSON.parse(storedMeals).length > 0) hasActivity = true;
      } catch (e) {}

      if (hasActivity) {
        tempLongest++;
        if (tempLongest > longest) longest = tempLongest;
        if (isCountingCurrent) current++;
      } else {
        if (i === 0) continue;
        else isCountingCurrent = false;
      }
    }

    return { currentStreak: Math.max(current, totalCompletedSetsOverall > 0 || allLogs.length > 0 ? 1 : 0), longestStreak: Math.max(longest, current, 1) };
  };

  const { currentStreak, longestStreak } = calculateStreaks();

  // Fetch Meals
  const fetchLogsForDate = async (dateStr: string) => {
    const normPhone = normalizePhone(activeUser.phone || "085156919826");
    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "";

    try {
      const res = await fetch(`${API_BASE_URL}/api/user/${normPhone}/meals?date=${dateStr}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.logs)) {
          setAllLogs(data.logs);
          try {
            localStorage.setItem(`gymbuddy_meals_${normPhone}_${dateStr}`, JSON.stringify(data.logs));
          } catch (e) {}
          return;
        }
      }
    } catch (e) {}

    try {
      const localData = localStorage.getItem(`gymbuddy_meals_${normPhone}_${dateStr}`);
      if (localData) {
        setAllLogs(JSON.parse(localData));
      } else {
        setAllLogs([]);
      }
    } catch (e) {
      setAllLogs([]);
    }
  };

  useEffect(() => {
    fetchLogsForDate(selectedDate);

    // Restore feel state for selected date
    try {
      const storedFeel = localStorage.getItem(`gymbuddy_feel_${activeUser.phone || "user"}_${selectedDate}`);
      if (storedFeel) setFeelState(storedFeel as FeelState);
    } catch (e) {}

    // Restore day exercises for selected date
    try {
      const storedEx = localStorage.getItem(`gymbuddy_exercises_${activeUser.phone || "user"}_${selectedDate}`);
      if (storedEx) {
        setExercises(JSON.parse(storedEx));
      } else {
        setExercises(todayScheduleObj.exercises);
      }
    } catch (e) {
      setExercises(todayScheduleObj.exercises);
    }
  }, [selectedDate, activeUser.phone]);

  const saveExercisesState = (updatedEx: WorkoutExercise[]) => {
    setExercises(updatedEx);
    try {
      localStorage.setItem(`gymbuddy_exercises_${activeUser.phone || "user"}_${selectedDate}`, JSON.stringify(updatedEx));
    } catch (e) {}
  };

  // Toggle Set Checkbox
  const handleToggleSet = (exerciseId: string, setIndex: number) => {
    const updated = exercises.map((ex) => {
      if (ex.id === exerciseId) {
        const newSetsState = [...ex.setsState];
        newSetsState[setIndex] = !newSetsState[setIndex];
        const completedCount = newSetsState.filter(Boolean).length;
        let newStatus: "not_started" | "in_progress" | "completed" = "not_started";
        if (completedCount === ex.targetSets) newStatus = "completed";
        else if (completedCount > 0) newStatus = "in_progress";

        return {
          ...ex,
          setsState: newSetsState,
          completedSets: completedCount,
          status: newStatus
        };
      }
      return ex;
    });

    saveExercisesState(updated);

    if (activeWorkoutDetail && activeWorkoutDetail.id === exerciseId) {
      const activeUpd = updated.find((e) => e.id === exerciseId);
      if (activeUpd) setActiveWorkoutDetail(activeUpd);
    }
  };

  // Feel State Selection
  const handleSelectFeel = (state: FeelState) => {
    setFeelState(state);
    try {
      localStorage.setItem(`gymbuddy_feel_${activeUser.phone || "user"}_${selectedDate}`, state);
    } catch (e) {}

    if ((state === "good" || state === "great") && !isTodayWorkoutFinished) {
      const reminderFlagKey = `gymbuddy_reminder_dismissed_${activeUser.phone || "user"}_${selectedDate}`;
      try {
        const alreadyPrompted = localStorage.getItem(reminderFlagKey);
        if (!alreadyPrompted) setShowAutoReminderModal(true);
      } catch (e) {
        setShowAutoReminderModal(true);
      }
    }
  };

  const handleSetReminderTime = () => {
    const reminderFlagKey = `gymbuddy_reminder_dismissed_${activeUser.phone || "user"}_${selectedDate}`;
    try {
      localStorage.setItem(reminderFlagKey, "true");
    } catch (e) {}
    setShowAutoReminderModal(false);
    setReminderNotificationMsg(`${t.reminderSetMsg} ${selectedReminderTime}`);
    setTimeout(() => setReminderNotificationMsg(null), 4000);
  };

  const handleDismissReminder = () => {
    const reminderFlagKey = `gymbuddy_reminder_dismissed_${activeUser.phone || "user"}_${selectedDate}`;
    try {
      localStorage.setItem(reminderFlagKey, "true");
    } catch (e) {}
    setShowAutoReminderModal(false);
  };

  // Smart Add Food / Drink (Handles Combo Splitting e.g. "Nasi Ayam McD + Kopi")
  const handleSaveLogItem = async () => {
    if (!itemNameInput.trim()) return;

    const normPhone = normalizePhone(activeUser.phone || "085156919826");
    const { foods, drinks } = splitAndCategorizeComboText(
      itemNameInput,
      Number(itemCalInput) || 0,
      Number(itemProteinInput) || 0,
      Number(itemCarbsInput) || 0,
      Number(itemFatInput) || 0
    );

    const newItems = [...foods, ...drinks];
    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "";

    for (const item of newItems) {
      try {
        await fetch(`${API_BASE_URL}/api/user/${normPhone}/meals`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...item, date: selectedDate })
        });
      } catch (e) {}
    }

    const updated = [...allLogs, ...newItems];
    setAllLogs(updated);
    try {
      localStorage.setItem(`gymbuddy_meals_${normPhone}_${selectedDate}`, JSON.stringify(updated));
    } catch (e) {}

    setItemNameInput("");
    setItemCalInput("");
    setItemProteinInput("");
    setItemCarbsInput("");
    setItemFatInput("");
    setShowAddFoodModal(false);
    setShowAddDrinkModal(false);
  };

  // Quick Add Water
  const handleQuickAddWater = (ml: number) => {
    const normPhone = normalizePhone(activeUser.phone || "085156919826");
    const newItem: MealItem = {
      id: `m-drink-${Date.now()}`,
      foodName: `Air Putih ${ml} ml`,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      isHydration: true,
      volumeMl: ml,
      timestamp: new Date().toISOString()
    };

    const updated = [...allLogs, newItem];
    setAllLogs(updated);
    try {
      localStorage.setItem(`gymbuddy_meals_${normPhone}_${selectedDate}`, JSON.stringify(updated));
    } catch (e) {}

    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "";
    try {
      fetch(`${API_BASE_URL}/api/user/${normPhone}/meals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newItem, date: selectedDate })
      });
    } catch (e) {}
  };

  // Delete Log Item
  const handleDeleteLogItem = async (id: string) => {
    const normPhone = normalizePhone(activeUser.phone || "085156919826");
    const updated = allLogs.filter((item) => item.id !== id);
    setAllLogs(updated);
    try {
      localStorage.setItem(`gymbuddy_meals_${normPhone}_${selectedDate}`, JSON.stringify(updated));
    } catch (e) {}

    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "";
    try {
      await fetch(`${API_BASE_URL}/api/user/${normPhone}/meals/${id}?date=${selectedDate}`, {
        method: "DELETE"
      });
    } catch (e) {}
  };

  // Delete Account
  const handleDeleteAccount = async () => {
    if (!window.confirm(lang === "EN" ? "Are you sure you want to delete all account data?" : "Apakah Anda yakin ingin menghapus akun dan semua data harian Anda?")) return;
    const normPhone = normalizePhone(activeUser.phone || "085156919826");
    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "";
    try {
      await fetch(`${API_BASE_URL}/api/user/${normPhone}`, { method: "DELETE" });
    } catch (e) {}
    try {
      localStorage.clear();
    } catch (e) {}
    if (onResetData) onResetData();
    else onLogout();
  };

  // Coach Dynamic Recommendation text
  const getCoachFeelingRecommendation = () => {
    if (feelState === "sick" || feelState === "bad") {
      return lang === "EN"
        ? "You don't seem to be in your best condition today. Rest up and focus on recovery. Your goals can be resumed once you feel better."
        : "Kamu kelihatannya sedang tidak dalam kondisi terbaik hari ini. Istirahat dulu dan fokus recovery. Goal kamu bisa dilanjutkan saat kondisi sudah lebih baik.";
    } else if (feelState === "not_great" || feelState === "okay") {
      return lang === "EN"
        ? "No need to push too hard today. Let's do a light workout so you keep moving and stay on track with your goals."
        : "Tidak perlu memaksakan diri hari ini. Yuk lakukan latihan ringan supaya kamu tetap bergerak dan tetap on track dengan goal kamu.";
    } else {
      return lang === "EN"
        ? "You look fit and energetic today. Let me help you complete your planned workout and keep up the momentum!"
        : "Kamu kelihatan fit hari ini. Yuk selesaikan latihan kamu dan lanjutkan momentum!";
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0F1D] text-white font-['Inter'] selection:bg-[#D4FF00] selection:text-black pb-24">
      {/* Toast Notification */}
      <AnimatePresence>
        {reminderNotificationMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#121827] text-white px-5 py-3 rounded-full text-sm font-semibold shadow-2xl flex items-center gap-2 border border-neutral-700"
          >
            <Bell size={16} className="text-[#D4FF00]" />
            <span>{reminderNotificationMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Navigation Header (Matching Landing Page) */}
      <header className="sticky top-0 z-40 bg-[#0A0F1D]/90 backdrop-blur-md border-b border-neutral-800/80 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GymBuddyLogo size={32} showText textClassName="text-lg sm:text-xl text-white font-extrabold tracking-tight" />
          <span className="hidden md:inline-block px-2.5 py-0.5 rounded-full bg-[#D4FF00]/10 text-[#D4FF00] text-xs font-bold border border-[#D4FF00]/20">
            {t.memberDashboard}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Language Switcher ID | EN */}
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-300 hover:text-white transition-all text-xs font-extrabold cursor-pointer"
          >
            <Globe size={14} className="text-neutral-400" />
            <span className={lang === "ID" ? "text-[#D4FF00] font-black underline" : "text-neutral-500"}>ID</span>
            <span className="text-neutral-700">|</span>
            <span className={lang === "EN" ? "text-[#D4FF00] font-black underline" : "text-neutral-500"}>EN</span>
          </button>

          <button
            onClick={onBackToHome}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <ArrowLeft size={14} />
            <span>{t.landingPage}</span>
          </button>

          <a
            href={`https://wa.me/${(import.meta as any).env?.VITE_WHATSAPP_BOT_NUMBER || "14155238886"}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-1.5 rounded-full bg-[#25D366] text-black font-extrabold text-xs flex items-center gap-1.5 hover:bg-[#20bd5a] transition-all shadow-md"
          >
            <span>WhatsApp AI</span>
          </a>

          <button
            onClick={handleDeleteAccount}
            className="px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all text-xs font-bold flex items-center gap-1 cursor-pointer"
            title={t.removeAccount}
          >
            <Trash2 size={13} />
            <span className="hidden sm:inline">{t.removeAccount}</span>
          </button>

          <button
            onClick={onLogout}
            className="p-2 rounded-full text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors cursor-pointer"
            title={t.logout}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main Content (Strict 9-Step Hierarchy Layout with Landing Page Styling) */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* STEP 1: USER NAME HEADER & GREETING */}
        <div className="bg-[#121827] border border-neutral-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#D4FF00] text-black font-black flex items-center justify-center text-2xl shadow-lg shadow-[#D4FF00]/10">
              {activeUser.name ? activeUser.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white tracking-tight">
                  {t.welcome}, {activeUser.name || "Member"}!
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-neutral-800 text-[#D4FF00] text-xs font-bold border border-neutral-700">
                  {coachName}
                </span>
              </div>
              <p className="text-sm text-neutral-400 font-medium">
                {goalTitle} • {weight} kg → {targetWeight} kg
              </p>
            </div>
          </div>

          {/* Date Selector Ribbon */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {recentDates.map((d) => {
              const isSel = d.dateStr === selectedDate;
              return (
                <button
                  key={d.dateStr}
                  onClick={() => setSelectedDate(d.dateStr)}
                  className={`flex flex-col items-center justify-center w-12 h-14 rounded-2xl font-bold text-xs transition-all cursor-pointer border ${
                    isSel
                      ? "bg-[#D4FF00] text-black border-[#D4FF00] font-black shadow-md shadow-[#D4FF00]/20 scale-105"
                      : "bg-neutral-900/80 text-neutral-400 border-neutral-800 hover:bg-neutral-800 hover:text-white"
                  }`}
                >
                  <span className="text-[10px] uppercase font-semibold opacity-80">{d.dayName}</span>
                  <span className="text-base font-black">{d.dayNum}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 2: CURRENT STREAK & LONGEST STREAK */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Current Streak */}
          <div className="bg-[#121827] border border-neutral-800 rounded-3xl p-5 shadow-xl flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[#D4FF00] text-xs font-extrabold uppercase tracking-wider">
                <Flame size={16} className="fill-[#D4FF00]" />
                <span>{t.currentStreak}</span>
              </div>
              <div className="text-3xl font-black text-white tracking-tight">
                {currentStreak} <span className="text-lg font-bold text-neutral-400">{t.activeDaysConsecutive}</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#D4FF00]/10 border border-[#D4FF00]/20 text-[#D4FF00] flex items-center justify-center font-black text-xl">
              🔥
            </div>
          </div>

          {/* Longest Streak */}
          <div className="bg-[#121827] border border-neutral-800 rounded-3xl p-5 shadow-xl flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-extrabold uppercase tracking-wider">
                <Award size={16} />
                <span>{t.longestStreak}</span>
              </div>
              <div className="text-3xl font-black text-white tracking-tight">
                {longestStreak} <span className="text-lg font-bold text-neutral-400">{t.recordStreakDays}</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-black text-xl">
              🏆
            </div>
          </div>
        </div>

        {/* STEP 3: TARGET GOALS */}
        <div className="bg-[#121827] border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target size={18} className="text-[#D4FF00]" />
              <h2 className="text-lg font-extrabold text-white tracking-tight">{t.targetGoals}</h2>
            </div>
            <button
              onClick={() => setShowUpdateWeightModal(true)}
              className="text-xs font-extrabold text-[#D4FF00] hover:underline cursor-pointer"
            >
              {t.updateWeightTitle}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4 space-y-1">
              <span className="text-xs font-bold text-neutral-400 uppercase">{t.mainGoalTitle}</span>
              <p className="text-base font-extrabold text-white">{goalTitle}</p>
            </div>
            <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4 space-y-1">
              <span className="text-xs font-bold text-neutral-400 uppercase">{t.currentWeightLabel} → {t.targetWeightLabel}</span>
              <p className="text-base font-extrabold text-white">{weight} kg → {targetWeight} kg ({t.remainingLabel} {remainingKg} kg)</p>
            </div>
            <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4 space-y-1">
              <span className="text-xs font-bold text-neutral-400 uppercase">{t.dailyTargetLabel}</span>
              <p className="text-base font-extrabold text-white">{targetCalories} kcal / {targetProtein}g P</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs font-extrabold text-neutral-400">
              <span>Goal Overall Progress</span>
              <span className="text-[#D4FF00]">{progressPercent}%</span>
            </div>
            <div className="w-full h-2.5 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
              <div className="h-full bg-[#D4FF00] rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
            </div>
          </div>
        </div>

        {/* STEP 4: HOW DO YOU FEEL TODAY? */}
        <div className="bg-[#121827] border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div>
            <h2 className="text-lg font-extrabold text-white tracking-tight">{t.howDoYouFeel}</h2>
            <p className="text-xs text-neutral-400 font-medium mt-0.5">{t.feelSubtext}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 pt-1">
            {[
              { id: "bad", label: t.feelBad, icon: "😫", border: "hover:border-red-500/50", activeBg: "bg-red-500/10 border-red-500 text-red-400" },
              { id: "sick", label: t.sick, icon: "🤒", border: "hover:border-red-500/50", activeBg: "bg-red-500/10 border-red-500 text-red-400" },
              { id: "not_great", label: t.notGreat, icon: "🙁", border: "hover:border-amber-500/50", activeBg: "bg-amber-500/10 border-amber-500 text-amber-400" },
              { id: "okay", label: t.okay, icon: "😐", border: "hover:border-neutral-500", activeBg: "bg-neutral-800 border-neutral-600 text-white" },
              { id: "good", label: t.good, icon: "🙂", border: "hover:border-[#D4FF00]/50", activeBg: "bg-[#D4FF00]/10 border-[#D4FF00] text-[#D4FF00]" },
              { id: "great", label: t.great, icon: "🔥", border: "hover:border-[#D4FF00]/50", activeBg: "bg-[#D4FF00]/20 border-[#D4FF00] text-[#D4FF00]" }
            ].map((st) => {
              const isSelected = feelState === st.id;
              return (
                <button
                  key={st.id}
                  onClick={() => handleSelectFeel(st.id as FeelState)}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all cursor-pointer font-bold text-xs gap-1.5 ${
                    isSelected
                      ? `${st.activeBg} font-black shadow-md`
                      : `bg-neutral-900/60 border-neutral-800 text-neutral-300 ${st.border}`
                  }`}
                >
                  <span className="text-xl">{st.icon}</span>
                  <span className="leading-tight">{st.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 5 & STEP 6: WEEKLY WORKOUT SCHEDULE & WORKOUT PROGRESS */}
        <div className="bg-[#121827] border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Dumbbell size={20} className="text-[#D4FF00]" />
              <div>
                <h2 className="text-lg font-extrabold text-white tracking-tight">{t.weeklyWorkoutSchedule}</h2>
                <p className="text-xs text-neutral-400 font-medium">
                  {t.todaysFocus}: <span className="text-[#D4FF00] font-bold">{selectedDayName} • {todayScheduleObj.focus}</span>
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowFullWeeklyOverview(!showFullWeeklyOverview)}
              className="px-3.5 py-1.5 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-300 text-xs font-bold hover:text-white hover:border-neutral-500 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Layers size={14} className="text-[#D4FF00]" />
              <span>{showFullWeeklyOverview ? t.viewTodayOnly : t.viewFullWeeklySchedule}</span>
            </button>
          </div>

          {/* Daily Set Progress Bar */}
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-xs font-extrabold text-neutral-400">
              <span>{t.todaysFocus} Progress</span>
              <span className="text-[#D4FF00]">
                {totalCompletedSetsOverall} / {totalTargetSetsOverall} {t.setsCompleted} ({overallWorkoutPercent}%)
              </span>
            </div>
            <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
              <div className="h-full bg-[#D4FF00] rounded-full transition-all duration-300" style={{ width: `${overallWorkoutPercent}%` }}></div>
            </div>
          </div>

          {/* View Mode 1: Day Specific Workout Routine Cards */}
          {!showFullWeeklyOverview ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
              {exercises.map((ex) => {
                const percent = ex.targetSets > 0 ? Math.round((ex.completedSets / ex.targetSets) * 100) : 0;
                const isDone = percent === 100;

                return (
                  <div
                    key={ex.id}
                    className={`border rounded-2xl p-4 transition-all space-y-3 cursor-pointer ${
                      isDone
                        ? "bg-[#D4FF00]/10 border-[#D4FF00]/40 text-white"
                        : ex.completedSets > 0
                        ? "bg-amber-500/10 border-amber-500/30 text-white"
                        : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700"
                    }`}
                    onClick={() => setActiveWorkoutDetail(ex)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-black text-sm text-white">{ex.name}</h3>
                        <p className="text-xs text-neutral-400 font-medium">{ex.targetReps}</p>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                          isDone
                            ? "bg-[#D4FF00]/20 text-[#D4FF00] border-[#D4FF00]/40"
                            : ex.completedSets > 0
                            ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                            : "bg-neutral-800 text-neutral-400 border-neutral-700"
                        }`}
                      >
                        {isDone ? t.statusCompleted : ex.completedSets > 0 ? t.statusInProgress : t.statusNotStarted}
                      </span>
                    </div>

                    {/* Interactive Set Checkboxes */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {ex.setsState.map((isSetDone, setIdx) => (
                          <button
                            key={setIdx}
                            onClick={() => handleToggleSet(ex.id, setIdx)}
                            className={`px-2.5 py-1 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer border ${
                              isSetDone
                                ? "bg-[#D4FF00] text-black border-[#D4FF00] shadow-sm"
                                : "bg-neutral-900 text-neutral-300 border-neutral-700 hover:border-neutral-500"
                            }`}
                          >
                            <span>Set {setIdx + 1}</span>
                            {isSetDone && <Check size={12} strokeWidth={3} />}
                          </button>
                        ))}
                      </div>
                      <div className="text-xs font-black text-neutral-300">
                        {ex.completedSets} / {ex.targetSets} {t.setUnit} ({percent}%)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* View Mode 2: Full 7-Day Weekly Schedule Grid Overview */
            <div className="space-y-3 pt-2">
              {weeklySchedule.map((daySch) => {
                const isSelectedDay = daySch.day === selectedDayName;
                return (
                  <div
                    key={daySch.day}
                    className={`border rounded-2xl p-4 transition-all space-y-2 ${
                      isSelectedDay
                        ? "bg-[#D4FF00]/5 border-[#D4FF00]/40"
                        : "bg-neutral-900/60 border-neutral-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-xl font-black text-xs uppercase ${isSelectedDay ? "bg-[#D4FF00] text-black" : "bg-neutral-800 text-neutral-300"}`}>
                          {daySch.day}
                        </span>
                        <h4 className="font-extrabold text-sm text-white">{daySch.focus}</h4>
                      </div>
                      <span className="text-xs text-neutral-400 font-medium">
                        {daySch.exercises.length} Gerakan
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                      {daySch.exercises.map((exItem) => (
                        <div key={exItem.id} className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-2.5 text-xs space-y-0.5">
                          <p className="font-extrabold text-white">{exItem.name}</p>
                          <p className="text-[11px] text-neutral-400 font-medium">{exItem.targetReps}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* STEP 7: FOOD MEALS */}
        <div className="bg-[#121827] border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame size={18} className="text-amber-500" />
              <h2 className="text-lg font-extrabold text-white tracking-tight">{t.foodMeals}</h2>
            </div>
            <button
              onClick={() => setShowAddFoodModal(true)}
              className="px-4 py-2 rounded-full bg-[#D4FF00] text-black font-extrabold text-xs flex items-center gap-1 hover:bg-[#c4ec00] transition-all shadow-md cursor-pointer"
            >
              <Plus size={14} />
              <span>{t.addFoodBtn}</span>
            </button>
          </div>

          {/* Meals Macro Totals */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 text-center">
            <div>
              <span className="text-[10px] font-bold text-neutral-400 uppercase">{t.caloriesLabel}</span>
              <p className="text-base font-black text-white">{totalCaloriesConsumed} / {targetCalories} kcal</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-neutral-400 uppercase">{t.proteinLabel}</span>
              <p className="text-base font-black text-white">{totalProteinConsumed} / {targetProtein}g</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-neutral-400 uppercase">{t.carbsLabel}</span>
              <p className="text-base font-black text-white">{totalCarbsConsumed} / {targetCarbs}g</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-neutral-400 uppercase">{t.fatLabel}</span>
              <p className="text-base font-black text-white">{totalFatConsumed} / {targetFat}g</p>
            </div>
          </div>

          {/* Solid Food Items List */}
          {foodMeals.length === 0 ? (
            <div className="text-center py-6 text-neutral-500 text-sm font-medium border border-dashed border-neutral-800 rounded-2xl">
              {t.noMealsLogged}
            </div>
          ) : (
            <div className="divide-y divide-neutral-800/80 border border-neutral-800 rounded-2xl overflow-hidden bg-neutral-900/40">
              {foodMeals.map((item) => (
                <div key={item.id} className="p-3.5 flex items-center justify-between hover:bg-neutral-900/80 transition-colors">
                  <div>
                    <h4 className="font-extrabold text-sm text-white">{item.foodName}</h4>
                    <p className="text-xs text-neutral-400 font-medium">
                      {item.calories} kcal • P: {item.protein}g | C: {item.carbs}g | F: {item.fat}g
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteLogItem(item.id)}
                    className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="Hapus"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* STEP 8: WATER / HYDRATION */}
        <div className="bg-[#121827] border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Droplets size={18} className="text-blue-400" />
              <h2 className="text-lg font-extrabold text-white tracking-tight">{t.waterHydration}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleQuickAddWater(250)}
                className="px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-extrabold text-xs hover:bg-blue-500/20 cursor-pointer"
              >
                {t.quickAdd250}
              </button>
              <button
                onClick={() => handleQuickAddWater(500)}
                className="px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-extrabold text-xs hover:bg-blue-500/20 cursor-pointer"
              >
                {t.quickAdd500}
              </button>
              <button
                onClick={() => setShowAddDrinkModal(true)}
                className="px-4 py-2 rounded-full bg-[#D4FF00] text-black font-extrabold text-xs flex items-center gap-1 hover:bg-[#c4ec00] transition-all shadow-md cursor-pointer"
              >
                <Plus size={14} />
                <span>{t.addDrinkBtn}</span>
              </button>
            </div>
          </div>

          {/* Hydration Bar Summary */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-blue-400 uppercase">{t.hydrationTarget}</span>
              <p className="text-xl font-black text-white">{totalHydrationMl} ml / 2,500 ml ({totalWaterCups} Gelas)</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-blue-500 text-white font-bold flex items-center justify-center text-lg shadow-md">
              💧
            </div>
          </div>

          {/* Liquids Item List */}
          {hydrationLogs.length === 0 ? (
            <div className="text-center py-6 text-neutral-500 text-sm font-medium border border-dashed border-neutral-800 rounded-2xl">
              {t.noDrinksLogged}
            </div>
          ) : (
            <div className="divide-y divide-neutral-800/80 border border-neutral-800 rounded-2xl overflow-hidden bg-neutral-900/40">
              {hydrationLogs.map((item) => (
                <div key={item.id} className="p-3.5 flex items-center justify-between hover:bg-neutral-900/80 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <Coffee size={16} className="text-blue-400" />
                    <div>
                      <h4 className="font-extrabold text-sm text-white">{item.foodName}</h4>
                      <p className="text-xs text-neutral-400 font-medium">
                        {item.volumeMl || 250} ml • {item.calories || 0} kcal
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteLogItem(item.id)}
                    className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="Hapus"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* STEP 9: REKOMENDASI MAX / MIA */}
        <div className="bg-[#121827] border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-[#D4FF00]" />
            <h2 className="text-lg font-extrabold text-white tracking-tight">{t.coachRecommendation} ({coachName})</h2>
          </div>

          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-[#D4FF00] text-black font-black flex items-center justify-center text-sm shrink-0 shadow-md">
              {isMaxPersona ? "M" : "N"}
            </div>
            <div className="space-y-1">
              <h4 className="font-extrabold text-sm text-white">{coachName} Advice</h4>
              <p className="text-sm text-neutral-300 font-medium leading-relaxed">{getCoachFeelingRecommendation()}</p>
            </div>
          </div>
        </div>

      </main>

      {/* AUTO REMINDER MODAL */}
      <AnimatePresence>
        {showAutoReminderModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#121827] border border-neutral-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2 text-white font-black text-base">
                  <Bell size={18} className="text-[#D4FF00]" />
                  <h3>{t.autoReminderTitle}</h3>
                </div>
                <button onClick={handleDismissReminder} className="text-neutral-400 hover:text-white cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <p className="text-sm font-semibold text-neutral-200 leading-relaxed">
                {t.autoReminderPrompt}
              </p>

              <div className="space-y-2">
                <label className="text-xs font-extrabold text-neutral-400 uppercase">Pilih Jam Pengingat:</label>
                <div className="grid grid-cols-4 gap-2">
                  {["16:00", "17:00", "19:00", "20:00"].map((timeStr) => (
                    <button
                      key={timeStr}
                      onClick={() => setSelectedReminderTime(timeStr)}
                      className={`py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                        selectedReminderTime === timeStr
                          ? "bg-[#D4FF00] text-black border-[#D4FF00]"
                          : "bg-neutral-900 text-neutral-300 border-neutral-800 hover:bg-neutral-800"
                      }`}
                    >
                      {timeStr}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  onClick={handleDismissReminder}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-400 hover:bg-neutral-800 cursor-pointer"
                >
                  {t.remindLater}
                </button>
                <button
                  onClick={handleSetReminderTime}
                  className="px-5 py-2 rounded-xl text-xs font-black bg-[#D4FF00] text-black hover:bg-[#c4ec00] transition-all cursor-pointer shadow-md"
                >
                  {t.setReminderBtn}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* WORKOUT DETAIL MODAL */}
      <AnimatePresence>
        {activeWorkoutDetail && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#121827] border border-neutral-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div>
                  <h3 className="font-black text-lg text-white">{activeWorkoutDetail.name}</h3>
                  <p className="text-xs text-neutral-400 font-medium">{t.workoutDetailTitle}</p>
                </div>
                <button onClick={() => setActiveWorkoutDetail(null)} className="text-neutral-400 hover:text-white cursor-pointer">
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 text-center">
                <div>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase">{t.targetRepsLabel}</span>
                  <p className="text-sm font-extrabold text-white">{activeWorkoutDetail.targetReps}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase">Progress Set</span>
                  <p className="text-sm font-extrabold text-[#D4FF00]">
                    {activeWorkoutDetail.completedSets} / {activeWorkoutDetail.targetSets} (
                    {Math.round((activeWorkoutDetail.completedSets / activeWorkoutDetail.targetSets) * 100)}%)
                  </p>
                </div>
              </div>

              {/* Set Checkboxes */}
              <div className="space-y-2">
                <span className="text-xs font-black text-neutral-300 uppercase">{t.setChecklistLabel}:</span>
                <div className="space-y-2">
                  {activeWorkoutDetail.setsState.map((isDone, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleToggleSet(activeWorkoutDetail.id, idx)}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                        isDone
                          ? "bg-[#D4FF00]/10 border-[#D4FF00]/40 text-[#D4FF00]"
                          : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700"
                      }`}
                    >
                      <div className="flex items-center gap-3 font-extrabold text-sm">
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${isDone ? "bg-[#D4FF00] border-[#D4FF00] text-black" : "bg-neutral-950 border-neutral-700"}`}>
                          {isDone && <Check size={14} strokeWidth={3} />}
                        </div>
                        <span>Set {idx + 1}</span>
                      </div>
                      <span className="text-xs font-bold">{isDone ? "Selesai" : "Belum Selesai"}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setActiveWorkoutDetail(null)}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-[#D4FF00] text-black hover:bg-[#c4ec00] transition-all cursor-pointer shadow-md"
                >
                  {t.closeModal}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD LOG MODAL (Intelligently splits "Nasi Ayam McD + Kopi" into Food & Drink) */}
      <AnimatePresence>
        {(showAddFoodModal || showAddDrinkModal) && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#121827] border border-neutral-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <h3 className="font-black text-base text-white">{t.addMealModalTitle}</h3>
                <button
                  onClick={() => {
                    setShowAddFoodModal(false);
                    setShowAddDrinkModal(false);
                  }}
                  className="text-neutral-400 hover:text-white cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-neutral-300">{t.foodNameLabel}</label>
                  <input
                    type="text"
                    value={itemNameInput}
                    onChange={(e) => setItemNameInput(e.target.value)}
                    placeholder="misal: Nasi Ayam McD + Kopi"
                    className="w-full mt-1 px-3.5 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-sm font-semibold text-white focus:outline-none focus:border-[#D4FF00]"
                  />
                  <p className="text-[11px] text-neutral-500 mt-1">
                    *Input combo seperti <span className="text-[#D4FF00]">"Nasi Ayam McD + Kopi"</span> akan otomatis dipisah ke Food Meals & Water Hydration.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-bold text-neutral-300">{t.caloriesInputLabel}</label>
                    <input
                      type="number"
                      value={itemCalInput}
                      onChange={(e) => setItemCalInput(e.target.value)}
                      placeholder="450"
                      className="w-full mt-1 px-3.5 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-sm font-semibold text-white focus:outline-none focus:border-[#D4FF00]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-neutral-300">{t.proteinInputLabel}</label>
                    <input
                      type="number"
                      value={itemProteinInput}
                      onChange={(e) => setItemProteinInput(e.target.value)}
                      placeholder="25"
                      className="w-full mt-1 px-3.5 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-sm font-semibold text-white focus:outline-none focus:border-[#D4FF00]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-neutral-300">{t.carbsInputLabel}</label>
                    <input
                      type="number"
                      value={itemCarbsInput}
                      onChange={(e) => setItemCarbsInput(e.target.value)}
                      placeholder="40"
                      className="w-full mt-1 px-3.5 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-sm font-semibold text-white focus:outline-none focus:border-[#D4FF00]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-neutral-300">{t.fatInputLabel}</label>
                    <input
                      type="number"
                      value={itemFatInput}
                      onChange={(e) => setItemFatInput(e.target.value)}
                      placeholder="12"
                      className="w-full mt-1 px-3.5 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-sm font-semibold text-white focus:outline-none focus:border-[#D4FF00]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  onClick={() => {
                    setShowAddFoodModal(false);
                    setShowAddDrinkModal(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-400 hover:bg-neutral-800 cursor-pointer"
                >
                  {t.closeModal}
                </button>
                <button
                  onClick={handleSaveLogItem}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-[#D4FF00] text-black hover:bg-[#c4ec00] cursor-pointer shadow-md"
                >
                  {t.saveEntry}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* UPDATE WEIGHT MODAL */}
      <AnimatePresence>
        {showUpdateWeightModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#121827] border border-neutral-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <h3 className="font-black text-base text-white">{t.updateWeightTitle}</h3>
                <button onClick={() => setShowUpdateWeightModal(false)} className="text-neutral-400 hover:text-white cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-300">{t.weightInputLabel}</label>
                <input
                  type="number"
                  step="0.1"
                  value={newWeightInput}
                  onChange={(e) => setNewWeightInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-base font-black text-white focus:outline-none focus:border-[#D4FF00]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  onClick={() => setShowUpdateWeightModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-400 hover:bg-neutral-800 cursor-pointer"
                >
                  {t.closeModal}
                </button>
                <button
                  onClick={() => {
                    const w = Number(newWeightInput);
                    if (w > 30 && w < 300) {
                      setLiveUser((prev) => ({ ...prev, weight: w }));
                    }
                    setShowUpdateWeightModal(false);
                  }}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-[#D4FF00] text-black hover:bg-[#c4ec00] cursor-pointer shadow-md"
                >
                  {t.saveWeight}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
