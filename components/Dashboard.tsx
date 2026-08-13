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
  Search,
  MessageSquare,
  BarChart2,
  CheckSquare,
  RotateCcw
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
  createdAt?: string;
  registerDate?: string;
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

// Helper function to check if item name is liquid / drink
const isLiquidName = (name: string): boolean => {
  if (!name) return false;
  const lower = name.toLowerCase();

  const solidExceptions = [
    "pancong", "roti", "martabak", "cake", "kue", "pancake", "waffle",
    "biskuit", "sereal", "cereal", "ice cream", "es krim", "keju", "pudding",
    "puding", "bubur", "bolu", "donat", "pie", "tart", "saus", "sauce",
    "selai", "topping", "crepe", "churros", "pisang"
  ];

  if (solidExceptions.some((se) => lower.includes(se))) {
    return false;
  }

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

// Extract volume in ml from a food name string (e.g. "Air Mineral 600ml" → 600)
const extractVolumeMlFromName = (name: string): number => {
  if (!name) return 250;
  const mlMatch = name.match(/(\d+(?:[.,]\d+)?)\s*ml/i);
  if (mlMatch) return parseFloat(mlMatch[1].replace(',', '.'));
  const lMatch = name.match(/(\d+(?:[.,]\d+)?)\s*(?:l|liter|litre)\b/i);
  if (lMatch) return parseFloat(lMatch[1].replace(',', '.')) * 1000;
  return 250;
};

// Smart Combo Item Splitting Logic (e.g. "Nasi Ayam McD + Kopi" or "Susu Bear Brand + Kopi Hitam")
const splitAndCategorizeComboText = (
  rawName: string,
  totalCal: number = 0,
  totalProt: number = 0,
  totalCarb: number = 0,
  totalFat: number = 0
): { foods: MealItem[]; drinks: MealItem[] } => {
  if (!rawName) return { foods: [], drinks: [] };

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

  if (solidParts.length > 0) {
    const solidName = solidParts.join(" + ");
    foods.push({
      id: `m-food-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      foodName: solidName,
      calories: totalCal > 0 && liquidParts.length > 0 ? Math.max(100, totalCal - (liquidParts.length * 50)) : (totalCal || 450),
      protein: totalProt > 0 ? totalProt : 25,
      carbs: totalCarb > 0 ? totalCarb : 45,
      fat: totalFat > 0 ? totalFat : 12,
      isHydration: false,
      timestamp: nowIso
    });
  }

  if (liquidParts.length > 0) {
    const perDrinkCal = Math.round((totalCal > 0 && solidParts.length === 0 ? totalCal : (liquidParts.length * 50)) / liquidParts.length);
    const perDrinkProt = Math.round((totalProt || 0) / liquidParts.length);
    const perDrinkCarb = Math.round((totalCarb || 0) / liquidParts.length);
    const perDrinkFat = Math.round((totalFat || 0) / liquidParts.length);

    liquidParts.forEach((part, idx) => {
      drinks.push({
        id: `m-drink-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        foodName: part,
        calories: perDrinkCal,
        protein: perDrinkProt,
        carbs: perDrinkCarb,
        fat: perDrinkFat,
        isHydration: true,
        volumeMl: extractVolumeMlFromName(part),
        timestamp: nowIso
      });
    });
  }

  return { foods, drinks };
};

// Automatic Sanitizer to split any stored combo logs
const sanitizeAndSplitComboLogs = (rawLogs: MealItem[]): MealItem[] => {
  if (!Array.isArray(rawLogs)) return [];
  const result: MealItem[] = [];

  for (const item of rawLogs) {
    if (!item.foodName) continue;
    const { foods, drinks } = splitAndCategorizeComboText(
      item.foodName,
      item.calories,
      item.protein,
      item.carbs,
      item.fat
    );

    if (foods.length > 0 || drinks.length > 0) {
      if (foods.length > 0) result.push(...foods);
      if (drinks.length > 0) result.push(...drinks);
    } else {
      if (isLiquidName(item.foodName) || item.isHydration) {
        result.push({
          ...item,
          isHydration: true,
          volumeMl: Number(item.volumeMl) || extractVolumeMlFromName(item.foodName)
        });
      } else {
        result.push(item);
      }
    }
  }

  return result;
};

// Comprehensive Translations Dictionary
const translations = {
  ID: {
    memberDashboard: "MEMBER DASHBOARD",
    welcomeBack: "Selamat datang kembali",
    welcome: "Halo",
    landingPage: "Home",
    removeAccount: "Hapus Akun",
    logout: "Keluar",
    currentStreak: "Streak Saat Ini",
    longestStreak: "Rekor Streak Terpanjang",
    activeDaysConsecutive: "hari berturut-turut",
    recordStreakDays: "hari rekor terpanjang",
    targetGoals: "Target Goals Utama",
    mainGoalTitle: "Goal Utama",
    currentWeightLabel: "BB Saat Ini",
    targetWeightLabel: "Target BB",
    remainingLabel: "Sisa",
    dailyTargetLabel: "Target Nutrisi Harian",
    caloriesLabel: "Kalori",
    proteinLabel: "Protein",
    carbsLabel: "Karbohidrat",
    fatLabel: "Lemak",
    overallGoalProgress: "Progress Goal Keseluruhan",
    howDoYouFeel: "Bagaimana perasaanmu hari ini?",
    feelSubtext: "Ini bukan diagnosis medis. Hanya digunakan sebagai daily wellbeing dan readiness check.",
    feelBad: "Sangat Buruk",
    sick: "Sakit",
    notGreat: "Kurang Baik",
    okay: "Biasa Saja",
    good: "Baik",
    great: "Sangat Baik",
    weeklyWorkoutSchedule: "Jadwal Workout Mingguan",
    todaysFocus: "Fokus Latihan",
    viewFullWeeklySchedule: "Lihat Seluruh Jadwal (Senin - Minggu)",
    viewTodayOnly: "Kembali ke Jadwal Hari Ini",
    todaysFocusProgress: "Progress Latihan Hari Ini",
    setsCompleted: "set selesai",
    setUnit: "Set",
    statusNotStarted: "Belum Mulai",
    statusInProgress: "Sedang Berlangsung",
    statusCompleted: "Selesai",
    clickForDetails: "Klik untuk detail & checklist set",
    exerciseCount: "Gerakan",
    foodMeals: "Makanan (Food Meals)",
    addFoodBtn: "Tambah Makanan",
    noMealsLogged: "Belum ada makanan padat tercatat hari ini.",
    waterHydration: "Air & Hidrasi (Water / Hydration)",
    addDrinkBtn: "Tambah Minuman",
    hydrationTarget: "Target Hidrasi Harian",
    quickAdd250: "+250 ml Air",
    quickAdd500: "+500 ml Air",
    noDrinksLogged: "Belum ada minuman tercatat hari ini.",
    coachRecommendation: "Rekomendasi Coach",
    coachAdviceTitle: "Saran Coach",
    autoReminderTitle: "Pengingat Latihan Harian",
    autoReminderPrompt: "Ayo latihan hari ini! 💪 Mau diingetin jam berapa buat gym atau makan?",
    selectReminderTime: "Pilih Jam Pengingat:",
    setReminderBtn: "Atur Pengingat",
    remindLater: "Nanti Saja",
    reminderSetMsg: "Pengingat telah diatur untuk pukul",
    workoutDetailTitle: "Detail Workout & Completion Set",
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
    comboHelpText: "*Input combo seperti 'Nasi Ayam McD + Kopi' akan otomatis dipisah ke Makanan & Hidrasi.",
    saveEntry: "Simpan Log",
    updateWeightTitle: "Update Berat Badan",
    weightInputLabel: "Berat Badan Baru (kg)",
    saveWeight: "Simpan BB Baru",
    delete: "Hapus",
    setDone: "Selesai",
    setNotDone: "Belum Selesai",
    pickDateTooltip: "Buka Kalender Pemilih Tanggal",
    calendarModalTitle: "Kalender Pemilih Tanggal",
    calendarSubtext: "Pilih tanggal sejak kamu terdaftar di GymBuddy",
    todayBtn: "Hari Ini",
    historicalLogNotice: "Menampilkan log histori tanggal"
  },
  EN: {
    memberDashboard: "MEMBER DASHBOARD",
    welcomeBack: "Welcome back",
    welcome: "Hello",
    landingPage: "Home",
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
    overallGoalProgress: "Overall Goal Progress",
    howDoYouFeel: "How do you feel today?",
    feelSubtext: "This is not a medical diagnosis. Used only for daily wellbeing and readiness check.",
    feelBad: "Feeling Bad",
    sick: "Sick",
    notGreat: "Not Great",
    okay: "Okay",
    good: "Good",
    great: "Great",
    weeklyWorkoutSchedule: "Weekly Workout Schedule",
    todaysFocus: "Workout Focus",
    viewFullWeeklySchedule: "View Full Schedule (Mon - Sun)",
    viewTodayOnly: "Back to Today's Workout",
    todaysFocusProgress: "Today's Workout Progress",
    setsCompleted: "sets completed",
    setUnit: "Set",
    statusNotStarted: "Not Started",
    statusInProgress: "In Progress",
    statusCompleted: "Completed",
    clickForDetails: "Click for details & set checklist",
    exerciseCount: "Exercises",
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
    coachAdviceTitle: "Coach Advice",
    autoReminderTitle: "Daily Workout Reminder",
    autoReminderPrompt: "Let's train today! 💪 What time would you like a reminder for gym or meals?",
    selectReminderTime: "Select Reminder Time:",
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
    comboHelpText: "*Combo items like 'Chicken Rice + Coffee' will automatically split into Food Meals & Water Hydration.",
    saveEntry: "Save Log",
    updateWeightTitle: "Update Body Weight",
    weightInputLabel: "New Weight (kg)",
    saveWeight: "Save New Weight",
    delete: "Delete",
    setDone: "Completed",
    setNotDone: "Not Completed",
    pickDateTooltip: "Open Date Picker Calendar",
    calendarModalTitle: "Date Picker Calendar",
    calendarSubtext: "Select any date since your registration at GymBuddy",
    todayBtn: "Today",
    historicalLogNotice: "Showing historical log for"
  }
};

// 7-Day Weekly Workout Schedule Personalizer
function getPersonalizedWeeklySchedule(user: UserProfileData): DaySchedule[] {
  const goal = user?.goal || "lose";

  if (goal === "gain") {
    return [
      { day: "Senin", focus: "Upper Body Hypertrophy", exercises: [
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
      { day: "Minggu", focus: "Rest & Recovery", exercises: [
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

  // Date Key YYYY-MM-DD
  const formatDateKey = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const todayDateStr = formatDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayDateStr);
  const [liveUser, setLiveUser] = useState<UserProfileData>(initialUser);
  const [allLogs, setAllLogs] = useState<MealItem[]>([]);
  const [showFullWeeklyOverview, setShowFullWeeklyOverview] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  const activeUser = liveUser || initialUser;

  // Determine User Registration Date as Min Date Constraint
  const getUserRegisterDateStr = (): string => {
    if (activeUser.createdAt) return activeUser.createdAt.substring(0, 10);
    if (activeUser.registerDate) return activeUser.registerDate.substring(0, 10);

    const phoneKey = activeUser.phone || "user";
    try {
      const stored = localStorage.getItem(`gymbuddy_user_registered_at_${phoneKey}`);
      if (stored) return stored;

      // Default registration date to 14 days ago
      const defaultDate = new Date(Date.now() - 14 * 86400000);
      const defaultStr = formatDateKey(defaultDate);
      localStorage.setItem(`gymbuddy_user_registered_at_${phoneKey}`, defaultStr);
      return defaultStr;
    } catch (e) {
      return formatDateKey(new Date(Date.now() - 14 * 86400000));
    }
  };

  const minDateStr = getUserRegisterDateStr();

  // Calendar Modal Navigation Month/Year State
  const [calYear, setCalYear] = useState<number>(() => new Date(selectedDate).getFullYear());
  const [calMonth, setCalMonth] = useState<number>(() => new Date(selectedDate).getMonth());

  // Feel State per date
  const [feelState, setFeelState] = useState<FeelState>(() => {
    try {
      const stored = localStorage.getItem(`gymbuddy_feel_${initialUser.phone || "user"}_${selectedDate}`);
      return (stored as FeelState) || "good";
    } catch (e) {
      return "good";
    }
  });

  // Auto Reminder Modal State
  const [showAutoReminderModal, setShowAutoReminderModal] = useState(false);
  const [selectedReminderTime, setSelectedReminderTime] = useState("17:00");
  const [reminderNotificationMsg, setReminderNotificationMsg] = useState<string | null>(null);

  // Coach Mood Popup State
  const [showCoachMoodPopup, setShowCoachMoodPopup] = useState(false);
  const [coachMoodData, setCoachMoodData] = useState<{ icon: string; title: string; message: string; tips: string[]; color: string } | null>(null);

  // Weekly Schedule
  const weeklySchedule = getPersonalizedWeeklySchedule(initialUser);

  const getDayNameFromDateStr = (dateStr: string) => {
    const parts = dateStr.split("-");
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const dayIdx = d.getDay();
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

  // Modals
  const [showAddFoodModal, setShowAddFoodModal] = useState(false);
  const [showAddDrinkModal, setShowAddDrinkModal] = useState(false);
  const [showUpdateWeightModal, setShowUpdateWeightModal] = useState(false);

  // Form Inputs
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
    if (cleaned.startsWith("62")) cleaned = "0" + cleaned.substring(2);
    else if (cleaned.startsWith("8")) cleaned = "0" + cleaned;
    return cleaned;
  };

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

  // Calorie & TDEE Calculations
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

  // STATIC 7-DAY RIBBON STRIP ENDING AT TODAY (NEVER SHIFTS POSITION WHEN CLICKING)
  const getStaticRibbonDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      dates.push({
        dateStr: formatDateKey(d),
        dayName: d.toLocaleDateString(lang === "EN" ? "en-US" : "id-ID", { weekday: "short" }),
        dayNum: d.getDate(),
        isToday: formatDateKey(d) === formatDateKey(new Date())
      });
    }
    return dates;
  };

  const ribbonDates = getStaticRibbonDates();
  const isSelectedDateInRibbon = ribbonDates.some((d) => d.dateStr === selectedDate);

  // Solid Foods vs Hydration
  const foodMeals = allLogs.filter((item) => !isLiquidName(item.foodName) && !item.isHydration);
  const hydrationLogs = allLogs.filter((item) => isLiquidName(item.foodName) || item.isHydration);

  // Totals
  const totalCaloriesConsumed = foodMeals.reduce((sum, item) => sum + (Number(item.calories) || 0), 0);
  const totalProteinConsumed = foodMeals.reduce((sum, item) => sum + (Number(item.protein) || 0), 0);
  const totalCarbsConsumed = foodMeals.reduce((sum, item) => sum + (Number(item.carbs) || 0), 0);
  const totalFatConsumed = foodMeals.reduce((sum, item) => sum + (Number(item.fat) || 0), 0);

  const totalHydrationMl = hydrationLogs.reduce((sum, item) => sum + (Number(item.volumeMl) || extractVolumeMlFromName(item.foodName)), 0);
  const totalWaterCups = Math.floor(totalHydrationMl / 250);

  // Sets Calculations
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

  // Fetch & Auto-Split Combo Logs
  const fetchLogsForDate = async (dateStr: string) => {
    const normPhone = normalizePhone(activeUser.phone || "085156919826");
    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-zfft.onrender.com";

    let rawLogs: MealItem[] = [];

    const tryFetchMeals = async (baseUrl: string) => {
      try {
        const res = await fetch(`${baseUrl}/api/user/${normPhone}/meals?date=${dateStr}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.logs)) {
            return data.logs;
          }
        }
      } catch (e) {}
      return null;
    };

    rawLogs = (await tryFetchMeals("")) || (await tryFetchMeals((import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-zfft.onrender.com")) || [];

    if (rawLogs.length === 0) {
      try {
        const localData = localStorage.getItem(`gymbuddy_meals_${normPhone}_${dateStr}`);
        if (localData) rawLogs = JSON.parse(localData);
      } catch (e) {}
    }

    const sanitized = sanitizeAndSplitComboLogs(rawLogs);
    setAllLogs(sanitized);

    try {
      localStorage.setItem(`gymbuddy_meals_${normPhone}_${dateStr}`, JSON.stringify(sanitized));
    } catch (e) {}
  };

  useEffect(() => {
    fetchLogsForDate(selectedDate);

    try {
      const storedFeel = localStorage.getItem(`gymbuddy_feel_${activeUser.phone || "user"}_${selectedDate}`);
      if (storedFeel) setFeelState(storedFeel as FeelState);
    } catch (e) {}

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

  const handleSelectFeel = (state: FeelState) => {
    setFeelState(state);
    try {
      localStorage.setItem(`gymbuddy_feel_${activeUser.phone || "user"}_${selectedDate}`, state);
    } catch (e) {}

    // Coach mood popup messages
    const coachMessages: Record<string, { icon: string; title: string; message: string; tips: string[]; color: string }> = {
      great: {
        icon: "🔥",
        title: "Lo lagi di puncak!",
        message: "Keren! Hari ini dijaga ya fitnya, menu latihan hari ini udah gue siapin. Jangan lupa buat log makanan lo biar gue bantu tracking!",
        tips: ["Kejar target workout hari ini 💪", "Log semua makanan ke GymBuddy", "Minum air minimal 2L hari ini"],
        color: "#C4F82A",
      },
      good: {
        icon: "🙂",
        title: "Solid! Hari yang bagus!",
        message: "Energi lo oke, cukup untuk workout produktif hari ini. Gas latihan sesuai jadwal, jangan skip!",
        tips: ["Lakukan latihan sesuai jadwal hari ini", "Fokus ke form yang benar", "Catat nutrisi lo hari ini"],
        color: "#4ade80",
      },
      okay: {
        icon: "😐",
        title: "Masih bisa digas!",
        message: "Kondisi lo lumayan. Coba warmup dulu 10 menit, biasanya langsung lebih semangat. Jangan skip workout ya!",
        tips: ["Mulai dengan warmup ringan 10 menit", "Kurangi intensitas jika perlu, tapi tetap latihan", "Makan makanan bergizi untuk boost energi"],
        color: "#facc15",
      },
      not_great: {
        icon: "🙁",
        title: "Istirahat dulu boleh...",
        message: "Kalau badan kurang fit, jangan dipaksain berat. Coba olahraga ringan kayak jalan kaki atau stretching aja dulu.",
        tips: ["Jalan santai 20-30 menit", "Full body stretching 15 menit", "Makan makanan bersih, hindari gorengan & gula", "Tidur cukup malam ini"],
        color: "#fb923c",
      },
      sick: {
        icon: "🤒",
        title: "Prioritas: Sembuh dulu!",
        message: "Kalau lagi sakit, tubuh lo butuh energi buat sembuh, bukan buat latihan berat. Rest is progress juga!",
        tips: ["❌ Skip gym dulu hari ini", "Istirahat total & tidur yang cukup", "Makan makanan bergizi: sop, buah, sayur", "Minum air & elektrolit yang cukup", "Konsultasi dokter jika butuh"],
        color: "#f87171",
      },
      bad: {
        icon: "😫",
        title: "Yuk recharge dulu!",
        message: "Lo lagi di titik terendah. Itu wajar. Yang penting hari ini: makan bersih, istirahat, dan jangan stress soal workout.",
        tips: ["❌ Jangan paksa latihan hari ini", "Istirahat penuh & tidur berkualitas", "Makan makanan ringan yang bergizi", "Minum air putih yang cukup", "Besok lo pasti lebih kuat! 💪"],
        color: "#a78bfa",
      },
    };

    const moodData = coachMessages[state];
    if (moodData) {
      setCoachMoodData(moodData);
      setShowCoachMoodPopup(true);
    }

    if ((state === "good" || state === "great") && !isTodayWorkoutFinished) {
      const reminderFlagKey = `gymbuddy_reminder_dismissed_${activeUser.phone || "user"}_${selectedDate}`;
      try {
        const alreadyPrompted = localStorage.getItem(reminderFlagKey);
        if (!alreadyPrompted) {
          setTimeout(() => setShowAutoReminderModal(true), 2200);
        }
      } catch (e) {
        setTimeout(() => setShowAutoReminderModal(true), 2200);
      }
    }
  };

  const handleSetReminderTime = async () => {
    const normPhone = normalizePhone(activeUser.phone || "085156919826");
    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-zfft.onrender.com";
    try {
      await fetch(`${API_BASE_URL}/api/user/${normPhone}/reminder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminderTime: selectedReminderTime, reminderEnabled: true })
      });
    } catch (e) {}

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

  // Combo Splitting Handler for new entries
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
    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-zfft.onrender.com";

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

    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-zfft.onrender.com";
    try {
      fetch(`${API_BASE_URL}/api/user/${normPhone}/meals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newItem, date: selectedDate })
      });
    } catch (e) {}
  };

  const handleDeleteLogItem = async (id: string) => {
    const normPhone = normalizePhone(activeUser.phone || "085156919826");
    const updated = allLogs.filter((item) => item.id !== id);
    setAllLogs(updated);
    try {
      localStorage.setItem(`gymbuddy_meals_${normPhone}_${selectedDate}`, JSON.stringify(updated));
    } catch (e) {}

    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-zfft.onrender.com";
    try {
      await fetch(`${API_BASE_URL}/api/user/${normPhone}/meals/${id}?date=${selectedDate}`, {
        method: "DELETE"
      });
    } catch (e) {}
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm(lang === "EN" ? "Are you sure you want to delete all account data?" : "Apakah Anda yakin ingin menghapus akun dan semua data harian Anda?")) return;
    const normPhone = normalizePhone(activeUser.phone || "085156919826");
    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-zfft.onrender.com";
    try {
      await fetch(`${API_BASE_URL}/api/user/${normPhone}`, { method: "DELETE" });
    } catch (e) {}
    try {
      localStorage.clear();
    } catch (e) {}
    if (onResetData) onResetData();
    else onLogout();
  };

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

  // Month Grid Helper for Modal Calendar
  const daysInCalMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDayOfCalMonth = new Date(calYear, calMonth, 1).getDay(); // 0 = Sun
  const calMonthTitle = new Date(calYear, calMonth, 1).toLocaleDateString(lang === "EN" ? "en-US" : "id-ID", {
    month: "long",
    year: "numeric"
  });

  const handlePrevCalMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(calYear - 1);
    } else {
      setCalMonth(calMonth - 1);
    }
  };

  const handleNextCalMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(calYear + 1);
    } else {
      setCalMonth(calMonth + 1);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F4F8] text-slate-900 font-['Inter'] p-3 sm:p-5 md:p-6 flex flex-col md:flex-row gap-5 selection:bg-[#C4F82A] selection:text-black">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {reminderNotificationMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#181B26] text-white px-5 py-3 rounded-full text-sm font-semibold shadow-xl flex items-center gap-2 border border-slate-700"
          >
            <Bell size={16} className="text-[#C4F82A]" />
            <span>{reminderNotificationMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLOATING DARK CHARCOAL SIDEBAR PANEL */}
      <aside className="w-full md:w-72 bg-[#181B26] text-white p-6 flex flex-col justify-between shrink-0 rounded-3xl border border-slate-800 shadow-xl md:min-h-[92vh]">
        <div className="space-y-6">
          {/* GymBuddy Logo & App Title */}
          <div className="flex items-center justify-between">
            <GymBuddyLogo size={32} showText textClassName="text-xl text-white font-extrabold tracking-tight" />
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-black text-slate-300 hover:text-white cursor-pointer"
            >
              <Globe size={12} className="text-slate-400" />
              <span className={lang === "ID" ? "text-[#C4F82A] font-bold" : "text-slate-500"}>ID</span>
              <span className="text-slate-600">|</span>
              <span className={lang === "EN" ? "text-[#C4F82A] font-bold" : "text-slate-500"}>EN</span>
            </button>
          </div>

          {/* User Profile Card */}
          <div className="bg-[#212534] border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#C4F82A] text-black font-black flex items-center justify-center text-lg shadow-sm">
              {activeUser.name ? activeUser.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="overflow-hidden">
              <h3 className="font-extrabold text-sm text-white truncate">{activeUser.name || "Member"}</h3>
              <span className="text-xs font-semibold text-[#C4F82A] block">{coachName} Member</span>
            </div>
          </div>

          {/* Navigation Pill List */}
          <nav className="space-y-2">
            <button className="w-full px-4 py-3 rounded-2xl bg-[#C4F82A] text-black font-black text-sm flex items-center justify-between transition-all cursor-pointer shadow-md">
              <div className="flex items-center gap-3">
                <BarChart2 size={18} />
                <span>Dashboard</span>
              </div>
              <ChevronRight size={16} />
            </button>

            <button
              onClick={onBackToHome}
              className="w-full px-4 py-3 rounded-2xl text-slate-400 hover:text-white hover:bg-[#212534] font-bold text-sm flex items-center gap-3 transition-all cursor-pointer"
            >
              <ArrowLeft size={18} />
              <span>{t.landingPage}</span>
            </button>

            <a
              href={`https://wa.me/${(import.meta as any).env?.VITE_WHATSAPP_BOT_NUMBER || "14155238886"}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full px-4 py-3 rounded-2xl bg-[#25D366]/15 border border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366] hover:text-black font-extrabold text-sm flex items-center gap-3 transition-all cursor-pointer"
            >
              <MessageSquare size={18} />
              <span>WhatsApp AI Coach</span>
            </a>
          </nav>
        </div>

        {/* Sidebar Bottom CTA & Account Actions */}
        <div className="pt-6 space-y-3">
          <div className="bg-gradient-to-br from-[#212534] to-[#181B26] border border-slate-800 rounded-2xl p-4 space-y-2 text-center">
            <span className="text-xs font-bold text-slate-400 uppercase">{t.mainGoalTitle}</span>
            <p className="text-sm font-extrabold text-white">{goalTitle}</p>
            <div className="pt-1 flex justify-center">
              <button
                onClick={() => setShowUpdateWeightModal(true)}
                className="px-3 py-1 rounded-full bg-[#C4F82A] text-black text-xs font-extrabold hover:bg-[#b2e61a] transition-all cursor-pointer"
              >
                {t.updateWeightTitle}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handleDeleteAccount}
              className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
            >
              <Trash2 size={13} />
              <span>{t.removeAccount}</span>
            </button>

            <button
              onClick={onLogout}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title={t.logout}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* RIGHT MAIN CONTENT CONTAINER */}
      <main className="flex-1 bg-[#0F141C] border border-neutral-800/80 rounded-3xl p-5 sm:p-6 md:p-8 space-y-6 overflow-y-auto shadow-sm text-white">
        
        {/* STEP 1: TOP GREETING HEADER & DATE STRIP */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {t.welcomeBack}, {activeUser.name || "Member"} 👋
              </h1>
              {selectedDate !== todayDateStr && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-extrabold text-[11px] border border-amber-500/40">
                  {t.historicalLogNotice} {selectedDate}
                </span>
              )}
            </div>
            <p className="text-sm text-neutral-400 font-semibold mt-0.5">
              {selectedDayName}, {selectedDate} • {todayScheduleObj.focus}
            </p>
          </div>

          {/* Date Navigation Ribbon without Scrollbars + Calendar Modal Opener */}
          <div className="flex items-center gap-2 w-full lg:w-auto shrink-0">
            
            {/* If selected date is outside the 7-day ribbon, show a badge with shortcut to reset */}
            {!isSelectedDateInRibbon && (
              <button
                onClick={() => setSelectedDate(todayDateStr)}
                className="px-3 py-2 rounded-xl bg-amber-500 text-white font-extrabold text-xs flex items-center gap-1 hover:bg-amber-600 transition-all cursor-pointer shadow-xs shrink-0"
              >
                <RotateCcw size={13} />
                <span>{t.todayBtn}</span>
              </button>
            )}

            {/* Static 7-Day Date Ribbon */}
            <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden shrink-0">
              {ribbonDates.map((d) => {
                const isSel = d.dateStr === selectedDate;
                return (
                  <button
                    key={d.dateStr}
                    type="button"
                    onClick={() => setSelectedDate(d.dateStr)}
                    className={`flex flex-col items-center justify-center w-11 h-13 rounded-xl font-bold text-xs transition-all cursor-pointer border shrink-0 ${
                      isSel
                        ? "bg-[#C4F82A] text-black border-[#C4F82A] font-black shadow-sm scale-105"
                        : "bg-[#161B26] text-neutral-300 border-neutral-800 hover:bg-neutral-800 hover:text-white"
                    }`}
                  >
                    <span className="text-[10px] uppercase opacity-70 font-semibold">{d.dayName}</span>
                    <span className="text-sm font-black">{d.dayNum}</span>
                  </button>
                );
              })}
            </div>

            {/* Beautiful Calendar Modal Launcher Button */}
            <button
              type="button"
              onClick={() => {
                const selD = new Date(selectedDate);
                if (!isNaN(selD.getTime())) {
                  setCalYear(selD.getFullYear());
                  setCalMonth(selD.getMonth());
                }
                setShowCalendarModal(true);
              }}
              className="flex items-center justify-center w-11 h-13 rounded-xl font-bold text-xs bg-[#161B26] text-white hover:bg-neutral-800 transition-all cursor-pointer shadow-xs shrink-0 border border-neutral-800"
              title={t.pickDateTooltip}
            >
              <CalendarIcon size={18} className="text-[#C4F82A]" />
            </button>
          </div>
        </div>

        {/* STEP 2: SUMMARY RIBBON STAT CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Current Streak */}
          <div className="bg-[#161B26] border border-neutral-800/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">{t.currentStreak}</span>
              <p className="text-2xl font-black text-white">{currentStreak} <span className="text-xs font-bold text-neutral-400">{t.activeDaysConsecutive}</span></p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-lg border border-amber-500/30">
              🔥
            </div>
          </div>

          {/* Longest Streak */}
          <div className="bg-[#161B26] border border-neutral-800/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{t.longestStreak}</span>
              <p className="text-2xl font-black text-white">{longestStreak} <span className="text-xs font-bold text-neutral-400">{t.recordStreakDays}</span></p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-lg border border-indigo-500/30">
              🏆
            </div>
          </div>

          {/* Calorie Goal */}
          <div className="bg-[#161B26] border border-neutral-800/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{t.caloriesLabel}</span>
              <p className="text-2xl font-black text-white">{totalCaloriesConsumed} <span className="text-xs font-bold text-neutral-400">/ {targetCalories} kcal</span></p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-lg border border-emerald-500/30">
              🥗
            </div>
          </div>

          {/* Water Intake */}
          <div className="bg-[#161B26] border border-neutral-800/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Hydration</span>
              <p className="text-2xl font-black text-white">{totalHydrationMl} <span className="text-xs font-bold text-neutral-400">/ 2,500 ml</span></p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center text-lg border border-blue-500/30">
              💧
            </div>
          </div>
        </div>

        {/* STEP 3: TARGET GOALS OVERVIEW */}
        <div className="bg-[#161B26] border border-neutral-800/80 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target size={18} className="text-[#C4F82A]" />
              <h2 className="text-base font-extrabold text-white">{t.targetGoals}</h2>
            </div>
            <span className="text-xs font-extrabold text-[#C4F82A] bg-[#C4F82A]/10 border border-[#C4F82A]/30 px-3 py-1 rounded-full">
              {progressPercent}% Complete
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="bg-[#10141D] border border-neutral-800 rounded-xl p-3 space-y-0.5">
              <span className="text-[10px] font-bold text-neutral-400 uppercase">{t.mainGoalTitle}</span>
              <p className="text-sm font-extrabold text-white">{goalTitle}</p>
            </div>
            <div className="bg-[#10141D] border border-neutral-800 rounded-xl p-3 space-y-0.5">
              <span className="text-[10px] font-bold text-neutral-400 uppercase">{t.currentWeightLabel} → {t.targetWeightLabel}</span>
              <p className="text-sm font-extrabold text-white">{weight} kg → {targetWeight} kg ({t.remainingLabel} {remainingKg} kg)</p>
            </div>
            <div className="bg-[#10141D] border border-neutral-800 rounded-xl p-3 space-y-0.5">
              <span className="text-[10px] font-bold text-neutral-400 uppercase">{t.dailyTargetLabel}</span>
              <p className="text-sm font-extrabold text-white">{targetCalories} kcal / {targetProtein}g P</p>
            </div>
          </div>

          <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
            <div className="h-full bg-[#C4F82A] rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>

        {/* STEP 4: HOW DO YOU FEEL TODAY? (INTERACTIVE SLIDER) */}
        {(() => {
          const feelOptions = [
            { id: "bad", label: t.feelBad, icon: "😫" },
            { id: "sick", label: t.sick, icon: "🤒" },
            { id: "not_great", label: t.notGreat, icon: "🙁" },
            { id: "okay", label: t.okay, icon: "😐" },
            { id: "good", label: t.good, icon: "🙂" },
            { id: "great", label: t.great, icon: "🔥" }
          ];
          const currentIndex = Math.max(0, feelOptions.findIndex((opt) => opt.id === feelState));
          const currentOpt = feelOptions[currentIndex] || feelOptions[4];

          return (
            <div className="bg-[#161B26] border border-neutral-800/80 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-white">{t.howDoYouFeel}</h2>
                  <p className="text-xs text-neutral-400 font-medium">{t.feelSubtext}</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#10141D] border border-neutral-700/80">
                  <span className="text-xl">{currentOpt.icon}</span>
                  <span className="text-xs font-black uppercase text-[#C4F82A] tracking-wide">{currentOpt.label}</span>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={1}
                  value={currentIndex}
                  onChange={(e) => {
                    const idx = parseInt(e.target.value, 10);
                    if (feelOptions[idx]) {
                      handleSelectFeel(feelOptions[idx].id as FeelState);
                    }
                  }}
                  className="w-full h-3 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[#C4F82A]"
                />

                <div className="flex justify-between px-1 text-[11px] font-bold text-neutral-400">
                  {feelOptions.map((opt, i) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectFeel(opt.id as FeelState)}
                      className={`flex flex-col items-center gap-0.5 cursor-pointer transition-all ${i === currentIndex ? "text-[#C4F82A] font-extrabold scale-110" : "hover:text-white"}`}
                    >
                      <span className="text-lg">{opt.icon}</span>
                      <span className="text-[10px] hidden sm:inline">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* STEP 5 & 6: WEEKLY WORKOUT SCHEDULE & WORKOUT PROGRESS */}
        <div className="bg-[#161B26] border border-neutral-800/80 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Dumbbell size={18} className="text-[#C4F82A]" />
              <div>
                <h2 className="text-base font-extrabold text-white">{t.weeklyWorkoutSchedule}</h2>
                <p className="text-xs text-neutral-400 font-medium">
                  {t.todaysFocus}: <span className="text-white font-bold">{selectedDayName} • {todayScheduleObj.focus}</span>
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowFullWeeklyOverview(!showFullWeeklyOverview)}
              className="px-3.5 py-1.5 rounded-full bg-[#10141D] border border-neutral-700/80 text-neutral-300 font-bold text-xs hover:bg-neutral-800 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Layers size={14} />
              <span>{showFullWeeklyOverview ? t.viewTodayOnly : t.viewFullWeeklySchedule}</span>
            </button>
          </div>

          <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
            <div className="h-full bg-[#C4F82A] rounded-full transition-all duration-300" style={{ width: `${overallWorkoutPercent}%` }}></div>
          </div>

          {!showFullWeeklyOverview ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {exercises.map((ex) => {
                const percent = ex.targetSets > 0 ? Math.round((ex.completedSets / ex.targetSets) * 100) : 0;
                const isDone = percent === 100;

                return (
                  <div
                    key={ex.id}
                    className={`border rounded-xl p-4 transition-all space-y-3 cursor-pointer ${
                      isDone
                        ? "bg-emerald-500/10 border-emerald-500/40 text-white"
                        : ex.completedSets > 0
                        ? "bg-amber-500/10 border-amber-500/40 text-white"
                        : "bg-[#10141D] border-neutral-800 hover:border-neutral-700"
                    }`}
                    onClick={() => setActiveWorkoutDetail(ex)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-extrabold text-sm text-white">{ex.name}</h3>
                        <p className="text-xs text-neutral-400 font-medium">{ex.targetReps}</p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                          isDone
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : ex.completedSets > 0
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                            : "bg-neutral-800 text-neutral-400 border-neutral-700"
                        }`}
                      >
                        {isDone ? t.statusCompleted : ex.completedSets > 0 ? t.statusInProgress : t.statusNotStarted}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {ex.setsState.map((isSetDone, setIdx) => (
                          <button
                            key={setIdx}
                            onClick={() => handleToggleSet(ex.id, setIdx)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer border ${
                              isSetDone
                                ? "bg-[#C4F82A] text-black border-[#C4F82A] shadow-xs"
                                : "bg-[#1A202C] text-neutral-300 border-neutral-700 hover:bg-neutral-800"
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
            <div className="space-y-3 pt-1">
              {weeklySchedule.map((daySch) => {
                const isSelectedDay = daySch.day === selectedDayName;
                return (
                  <div
                    key={daySch.day}
                    className={`border rounded-xl p-3.5 transition-all space-y-2 ${
                      isSelectedDay ? "bg-[#10141D] text-white border-[#C4F82A]/50" : "bg-[#10141D] border-neutral-800 text-neutral-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-lg font-black text-xs uppercase ${isSelectedDay ? "bg-[#C4F82A] text-black" : "bg-neutral-800 text-neutral-300"}`}>
                          {daySch.day}
                        </span>
                        <h4 className="font-extrabold text-sm">{daySch.focus}</h4>
                      </div>
                      <span className="text-xs font-medium opacity-75">{daySch.exercises.length} {t.exerciseCount}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      {daySch.exercises.map((exItem) => (
                        <div key={exItem.id} className={`p-2 rounded-lg text-xs border ${isSelectedDay ? "bg-slate-800 border-slate-700 text-slate-100" : "bg-slate-50 border-slate-200 text-slate-800"}`}>
                          <p className="font-extrabold">{exItem.name}</p>
                          <p className="text-[11px] opacity-75 font-medium">{exItem.targetReps}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* STEP 7: FOOD MEALS WITH NUTRITION PROGRESS BARS */}
        <div className="bg-[#161B26] border border-neutral-800/80 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame size={18} className="text-amber-400" />
              <h2 className="text-base font-extrabold text-white">{t.foodMeals}</h2>
            </div>
            <button
              onClick={() => setShowAddFoodModal(true)}
              className="px-3.5 py-1.5 rounded-full bg-[#C4F82A] text-black font-extrabold text-xs flex items-center gap-1 hover:bg-[#b2e61a] transition-all cursor-pointer shadow-xs"
            >
              <Plus size={14} />
              <span>{t.addFoodBtn}</span>
            </button>
          </div>

          {/* VISUAL MACRO PROGRESS BARS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Calories Bar */}
            <div className="bg-[#10141D] border border-neutral-800 rounded-xl p-3.5 space-y-2 shadow-xs">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-neutral-300">{t.caloriesLabel}</span>
                <span className="font-black text-amber-400">
                  {Math.min(100, Math.round((totalCaloriesConsumed / targetCalories) * 100))}%
                </span>
              </div>
              <div className="text-sm font-black text-white">
                {totalCaloriesConsumed} <span className="text-xs font-bold text-neutral-400">/ {targetCalories} kcal</span>
              </div>
              <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden border border-neutral-700/60">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round((totalCaloriesConsumed / targetCalories) * 100))}%` }}
                ></div>
              </div>
            </div>

            {/* Protein Bar */}
            <div className="bg-[#10141D] border border-neutral-800 rounded-xl p-3.5 space-y-2 shadow-xs">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-neutral-300">{t.proteinLabel}</span>
                <span className="font-black text-indigo-400">
                  {Math.min(100, Math.round((totalProteinConsumed / targetProtein) * 100))}%
                </span>
              </div>
              <div className="text-sm font-black text-white">
                {totalProteinConsumed} <span className="text-xs font-bold text-neutral-400">/ {targetProtein} g</span>
              </div>
              <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden border border-neutral-700/60">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round((totalProteinConsumed / targetProtein) * 100))}%` }}
                ></div>
              </div>
            </div>

            {/* Carbs Bar */}
            <div className="bg-[#10141D] border border-neutral-800 rounded-xl p-3.5 space-y-2 shadow-xs">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-neutral-300">{t.carbsLabel}</span>
                <span className="font-black text-emerald-400">
                  {Math.min(100, Math.round((totalCarbsConsumed / targetCarbs) * 100))}%
                </span>
              </div>
              <div className="text-sm font-black text-white">
                {totalCarbsConsumed} <span className="text-xs font-bold text-neutral-400">/ {targetCarbs} g</span>
              </div>
              <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden border border-neutral-700/60">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round((totalCarbsConsumed / targetCarbs) * 100))}%` }}
                ></div>
              </div>
            </div>

            {/* Fat Bar */}
            <div className="bg-[#10141D] border border-neutral-800 rounded-xl p-3.5 space-y-2 shadow-xs">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-neutral-300">{t.fatLabel}</span>
                <span className="font-black text-rose-400">
                  {Math.min(100, Math.round((totalFatConsumed / targetFat) * 100))}%
                </span>
              </div>
              <div className="text-sm font-black text-white">
                {totalFatConsumed} <span className="text-xs font-bold text-neutral-400">/ {targetFat} g</span>
              </div>
              <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden border border-neutral-700/60">
                <div
                  className="h-full bg-rose-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round((totalFatConsumed / targetFat) * 100))}%` }}
                ></div>
              </div>
            </div>
          </div>

          {foodMeals.length === 0 ? (
            <div className="text-center py-6 text-neutral-400 text-xs font-medium border border-dashed border-neutral-800 rounded-xl bg-[#10141D]">
              {t.noMealsLogged}
            </div>
          ) : (
            <div className="divide-y divide-neutral-800 border border-neutral-800 rounded-xl overflow-hidden bg-[#10141D]">
              {foodMeals.map((item) => (
                <div key={item.id} className="p-3 flex items-center justify-between hover:bg-neutral-800/60 transition-colors">
                  <div>
                    <h4 className="font-extrabold text-sm text-white">{item.foodName}</h4>
                    <p className="text-xs text-neutral-400 font-medium">
                      {item.calories} kcal • P: {item.protein}g | C: {item.carbs}g | F: {item.fat}g
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteLogItem(item.id)}
                    className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
                    title={t.delete}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* STEP 8: WATER / HYDRATION */}
        <div className="bg-[#161B26] border border-neutral-800/80 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Droplets size={18} className="text-blue-400" />
              <h2 className="text-base font-extrabold text-white">{t.waterHydration}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleQuickAddWater(250)}
                className="px-2.5 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 font-extrabold text-xs hover:bg-blue-500/30 cursor-pointer"
              >
                {t.quickAdd250}
              </button>
              <button
                onClick={() => handleQuickAddWater(500)}
                className="px-2.5 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 font-extrabold text-xs hover:bg-blue-500/30 cursor-pointer"
              >
                {t.quickAdd500}
              </button>
              <button
                onClick={() => setShowAddDrinkModal(true)}
                className="px-3.5 py-1.5 rounded-full bg-[#C4F82A] text-black font-extrabold text-xs flex items-center gap-1 hover:bg-[#b2e61a] transition-all cursor-pointer shadow-xs"
              >
                <Plus size={14} />
                <span>{t.addDrinkBtn}</span>
              </button>
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-blue-400 uppercase">{t.hydrationTarget}</span>
              <p className="text-lg font-black text-white">{totalHydrationMl} ml / 2,500 ml ({totalWaterCups} Gelas)</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-300 font-bold flex items-center justify-center text-base shadow-xs">
              💧
            </div>
          </div>

          {hydrationLogs.length === 0 ? (
            <div className="text-center py-6 text-neutral-400 text-xs font-medium border border-dashed border-neutral-800 rounded-xl bg-[#10141D]">
              {t.noDrinksLogged}
            </div>
          ) : (
            <div className="divide-y divide-neutral-800 border border-neutral-800 rounded-xl overflow-hidden bg-[#10141D]">
              {hydrationLogs.map((item) => (
                <div key={item.id} className="p-3 flex items-center justify-between hover:bg-neutral-800/60 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <Coffee size={16} className="text-blue-400" />
                    <div>
                      <h4 className="font-extrabold text-sm text-white">{item.foodName}</h4>
                      <p className="text-xs text-neutral-400 font-medium">
                        {item.volumeMl || extractVolumeMlFromName(item.foodName)} ml • {item.calories || 0} kcal
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteLogItem(item.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    title={t.delete}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* STEP 9: REKOMENDASI MAX / MIA */}
        <div className="bg-[#161B26] border border-neutral-800/80 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-[#C4F82A]" />
            <h2 className="text-base font-extrabold text-white">{t.coachRecommendation} ({coachName})</h2>
          </div>

          <div className="bg-[#10141D] border border-neutral-800 rounded-xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#C4F82A] text-black font-black flex items-center justify-center text-sm shrink-0 shadow-xs">
              {isMaxPersona ? "M" : "N"}
            </div>
            <div className="space-y-0.5">
              <h4 className="font-extrabold text-sm text-white">{coachName} {t.coachAdviceTitle}</h4>
              <p className="text-sm text-neutral-300 font-medium leading-relaxed">{getCoachFeelingRecommendation()}</p>
            </div>
          </div>
        </div>

      </main>

      {/* BEAUTIFUL MONTH CALENDAR PICKER MODAL */}
      <AnimatePresence>
        {showCalendarModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#161B26] border border-neutral-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 text-white"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div>
                  <h3 className="font-black text-lg text-white">{t.calendarModalTitle}</h3>
                  <p className="text-xs text-neutral-400 font-medium">{t.calendarSubtext}</p>
                </div>
                <button onClick={() => setShowCalendarModal(false)} className="text-neutral-400 hover:text-white cursor-pointer p-1">
                  <X size={20} />
                </button>
              </div>

              {/* Month Navigation Controls */}
              <div className="flex items-center justify-between bg-[#10141D] rounded-2xl p-3 border border-neutral-800">
                <button
                  type="button"
                  onClick={handlePrevCalMonth}
                  className="p-1.5 rounded-xl bg-[#1D2332] text-white border border-neutral-700 hover:bg-neutral-800 cursor-pointer transition-all"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="font-black text-sm text-white capitalize">{calMonthTitle}</span>
                <button
                  type="button"
                  onClick={handleNextCalMonth}
                  className="p-1.5 rounded-xl bg-[#1D2332] text-white border border-neutral-700 hover:bg-neutral-800 cursor-pointer transition-all"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* 7-Day Day Names Header */}
              <div className="grid grid-cols-7 gap-1 text-center font-black text-xs text-slate-400 uppercase">
                {lang === "EN"
                  ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
                  : ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]}
              </div>

              {/* Month Grid Days */}
              <div className="grid grid-cols-7 gap-1.5">
                {/* Empty slots before day 1 */}
                {Array.from({ length: firstDayOfCalMonth }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="h-10" />
                ))}

                {/* Days of the month */}
                {Array.from({ length: daysInCalMonth }).map((_, dayIdx) => {
                  const dayNum = dayIdx + 1;
                  const monthStr = String(calMonth + 1).padStart(2, "0");
                  const dayStr = String(dayNum).padStart(2, "0");
                  const dateStr = `${calYear}-${monthStr}-${dayStr}`;

                  const isSelected = dateStr === selectedDate;
                  const isToday = dateStr === todayDateStr;
                  const isDisabled = dateStr < minDateStr || dateStr > todayDateStr;

                  return (
                    <button
                      key={dateStr}
                      disabled={isDisabled}
                      onClick={() => {
                        setSelectedDate(dateStr);
                        setShowCalendarModal(false);
                      }}
                      className={`h-10 rounded-xl font-extrabold text-xs transition-all flex flex-col items-center justify-center cursor-pointer border ${
                        isSelected
                          ? "bg-[#181B26] text-[#C4F82A] border-[#181B26] shadow-md scale-105 font-black"
                          : isToday
                          ? "bg-[#C4F82A]/20 text-slate-900 border-[#99C700] font-black"
                          : isDisabled
                          ? "bg-slate-50 text-slate-300 border-transparent cursor-not-allowed"
                          : "bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-200/70"
                      }`}
                    >
                      <span>{dayNum}</span>
                      {isToday && <span className="w-1 h-1 rounded-full bg-slate-900 mt-0.5"></span>}
                    </button>
                  );
                })}
              </div>

              {/* Modal Footer Shortcuts */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    setSelectedDate(todayDateStr);
                    setShowCalendarModal(false);
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-[#C4F82A] text-black hover:bg-[#b2e61a] cursor-pointer"
                >
                  {t.todayBtn}
                </button>
                <button
                  onClick={() => setShowCalendarModal(false)}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {t.closeModal}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AUTO REMINDER MODAL */}
      <AnimatePresence>
        {/* COACH MOOD POPUP */}
        {showCoachMoodPopup && coachMoodData && (
          <div
            className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowCoachMoodPopup(false)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Card */}
            <div
              className="relative w-full max-w-sm bg-[#161B26] border rounded-3xl p-6 shadow-2xl animate-[slideUp_0.35s_cubic-bezier(.16,1,.3,1)]"
              style={{ borderColor: coachMoodData.color + "55" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Glow */}
              <div
                className="absolute -top-8 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full blur-3xl opacity-25 pointer-events-none"
                style={{ background: coachMoodData.color }}
              />

              {/* Coach Avatar + Badge */}
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: coachMoodData.color + "22", border: `1.5px solid ${coachMoodData.color}55` }}
                >
                  🏋️
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: coachMoodData.color }}>GymBuddy Coach</p>
                  <h3 className="text-base font-extrabold text-white leading-tight">{coachMoodData.icon} {coachMoodData.title}</h3>
                </div>
              </div>

              {/* Message */}
              <p className="text-sm text-neutral-300 leading-relaxed mb-4 font-medium">
                {coachMoodData.message}
              </p>

              {/* Tips */}
              <div className="bg-[#10141D] rounded-2xl p-4 space-y-2 mb-5">
                {coachMoodData.tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-xs mt-0.5" style={{ color: coachMoodData!.color }}>›</span>
                    <span className="text-xs text-neutral-300 font-medium">{tip}</span>
                  </div>
                ))}
              </div>

              {/* CTA Button */}
              <button
                onClick={() => setShowCoachMoodPopup(false)}
                className="w-full py-3 rounded-2xl font-extrabold text-sm transition-all active:scale-95"
                style={{ background: coachMoodData.color, color: "#0d0f14" }}
              >
                Siap, Coach! 💪
              </button>
            </div>
          </div>
        )}

        {showAutoReminderModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-slate-900 font-black text-base">
                  <Bell size={18} className="text-emerald-600" />
                  <h3>{t.autoReminderTitle}</h3>
                </div>
                <button onClick={handleDismissReminder} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <p className="text-sm font-semibold text-slate-800 leading-relaxed">
                {t.autoReminderPrompt}
              </p>

              <div className="space-y-2">
                <label className="text-xs font-extrabold text-slate-600 uppercase">{t.selectReminderTime}</label>
                <div className="grid grid-cols-4 gap-2">
                  {["16:00", "17:00", "19:00", "20:00"].map((timeStr) => (
                    <button
                      key={timeStr}
                      onClick={() => setSelectedReminderTime(timeStr)}
                      className={`py-2 rounded-lg text-xs font-extrabold border transition-all cursor-pointer ${
                        selectedReminderTime === timeStr
                          ? "bg-[#181B26] text-[#C4F82A] border-[#181B26]"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {timeStr}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={handleDismissReminder}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {t.remindLater}
                </button>
                <button
                  onClick={handleSetReminderTime}
                  className="px-5 py-2 rounded-xl text-xs font-black bg-[#181B26] text-white hover:bg-slate-800 cursor-pointer shadow-xs"
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
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg w-full shadow-xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-black text-lg text-slate-900">{activeWorkoutDetail.name}</h3>
                  <p className="text-xs text-slate-500 font-medium">{t.workoutDetailTitle}</p>
                </div>
                <button onClick={() => setActiveWorkoutDetail(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-3.5 text-center">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{t.targetRepsLabel}</span>
                  <p className="text-sm font-extrabold text-slate-900">{activeWorkoutDetail.targetReps}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Progress Set</span>
                  <p className="text-sm font-extrabold text-slate-900">
                    {activeWorkoutDetail.completedSets} / {activeWorkoutDetail.targetSets} (
                    {Math.round((activeWorkoutDetail.completedSets / activeWorkoutDetail.targetSets) * 100)}%)
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-black text-slate-700 uppercase">{t.setChecklistLabel}:</span>
                <div className="space-y-2">
                  {activeWorkoutDetail.setsState.map((isDone, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleToggleSet(activeWorkoutDetail.id, idx)}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isDone
                          ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-bold"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-3 font-extrabold text-sm">
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${isDone ? "bg-[#181B26] border-[#181B26] text-[#C4F82A]" : "bg-white border-slate-300"}`}>
                          {isDone && <Check size={14} strokeWidth={3} />}
                        </div>
                        <span>Set {idx + 1}</span>
                      </div>
                      <span className="text-xs font-bold">{isDone ? t.setDone : t.setNotDone}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setActiveWorkoutDetail(null)}
                  className="px-5 py-2 rounded-xl text-xs font-black bg-[#181B26] text-white hover:bg-slate-800 cursor-pointer shadow-xs"
                >
                  {t.closeModal}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD LOG MODAL */}
      <AnimatePresence>
        {(showAddFoodModal || showAddDrinkModal) && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-black text-base text-slate-900">{t.addMealModalTitle}</h3>
                <button
                  onClick={() => {
                    setShowAddFoodModal(false);
                    setShowAddDrinkModal(false);
                  }}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">{t.foodNameLabel}</label>
                  <input
                    type="text"
                    value={itemNameInput}
                    onChange={(e) => setItemNameInput(e.target.value)}
                    placeholder="misal: Nasi Ayam McD + Kopi"
                    className="w-full mt-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-slate-900"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    {t.comboHelpText}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-700">{t.caloriesInputLabel}</label>
                    <input
                      type="number"
                      value={itemCalInput}
                      onChange={(e) => setItemCalInput(e.target.value)}
                      placeholder="450"
                      className="w-full mt-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700">{t.proteinInputLabel}</label>
                    <input
                      type="number"
                      value={itemProteinInput}
                      onChange={(e) => setItemProteinInput(e.target.value)}
                      placeholder="25"
                      className="w-full mt-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700">{t.carbsInputLabel}</label>
                    <input
                      type="number"
                      value={itemCarbsInput}
                      onChange={(e) => setItemCarbsInput(e.target.value)}
                      placeholder="40"
                      className="w-full mt-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700">{t.fatInputLabel}</label>
                    <input
                      type="number"
                      value={itemFatInput}
                      onChange={(e) => setItemFatInput(e.target.value)}
                      placeholder="12"
                      className="w-full mt-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    setShowAddFoodModal(false);
                    setShowAddDrinkModal(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {t.closeModal}
                </button>
                <button
                  onClick={handleSaveLogItem}
                  className="px-5 py-2 rounded-xl text-xs font-black bg-[#181B26] text-[#C4F82A] hover:bg-slate-800 cursor-pointer shadow-xs"
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
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-black text-base text-slate-900">{t.updateWeightTitle}</h3>
                <button onClick={() => setShowUpdateWeightModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">{t.weightInputLabel}</label>
                <input
                  type="number"
                  step="0.1"
                  value={newWeightInput}
                  onChange={(e) => setNewWeightInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-black focus:outline-none focus:border-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setShowUpdateWeightModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
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
                  className="px-5 py-2 rounded-xl text-xs font-black bg-[#181B26] text-[#C4F82A] hover:bg-slate-800 cursor-pointer shadow-xs"
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
