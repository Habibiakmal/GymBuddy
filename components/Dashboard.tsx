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
  RotateCcw,
  RefreshCw,
  Home,
  Camera,
  Upload,
  Sliders,
  ShieldCheck
} from "lucide-react";
import PWAInstallBanner from "./PWAInstallBanner";

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
  const lower = name.toLowerCase().trim();

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
    "es kopi", "yakult", "matcha", "americano", "macchiato",
    "mocha", "affogato", "flat white", "long black", "ristretto", "cold brew",
    "chai", "thai tea", "teh pucuk", "teh botol", "teh kotak", "oat milk",
    "almond milk", "soya", "soy milk", "dancow", "ultra milk", "indomilk",
    "cleo", "vit", "ades", "coke", "pepsi", "sprite", "fanta", "7up",
    "root beer", "big cola", "dr pepper", "minuman", "cairan", "liquid",
    "wedang", "jamu", "hydro", "isoplus", "you1000", "c1000", "milku",
    "milo", "ovaltine", "nutrisari", "beer", "bir", "wine", "whiskey",
    "vodka", "soju", "rum", "cocktail", "mocktail", "whey", "creatine",
    // Popular Indonesian/cafe coffee drinks
    "montblanc", "mont blanc", "vietnam", "robusta", "liberica", "arabica",
    "v60", "drip", "pour over", "aeropress", "chemex", "cold drip",
    "brown sugar", "caramel", "hazelnut", "vanilla latte", "pistachio",
    "aren", "gula aren", "kopi aren", "kopi tubruk", "kopi susu",
    "es jeruk", "es lemon", "lemonade", "lemon tea", "fruit tea",
    "minuman dingin", "minuman panas", "hot drink", "iced", "es ",
    "wedang jahe", "jahe", "bandrek", "bajigur", "sekoteng",
    "cincau", "es cincau", "dawet", "es dawet", "cendol",
    "infused water", "detox", "green tea", "ocha", "hojicha",
    "protein shake", "mass gainer", "pre-workout", "bcaa",
    "electrolyte", "energy drink", "red bull", "monster", "kratingdaeng"
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

// Smart Combo Item Splitting Logic (e.g. "Nasi Ayam McD + Kopi" or "rice bowl + americano")
const splitAndCategorizeComboText = (
  rawName: string,
  totalCal: number = 0,
  totalProt: number = 0,
  totalCarb: number = 0,
  totalFat: number = 0,
  isExplicitDrink: boolean = false
): { foods: MealItem[]; drinks: MealItem[] } => {
  if (!rawName) return { foods: [], drinks: [] };

  const parts = rawName
    .split(/\+|\s+&\s+|\s+dan\s+|\s+with\s+|,/i)
    .map((p) => p.trim())
    .filter(Boolean);

  const solidParts: string[] = [];
  const liquidParts: string[] = [];

  for (const part of parts) {
    if (isLiquidName(part) || isExplicitDrink) {
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
      calories: totalCal > 0 && liquidParts.length > 0 ? Math.max(50, totalCal - (liquidParts.length * 20)) : (totalCal || 450),
      protein: totalProt > 0 ? totalProt : 25,
      carbs: totalCarb > 0 ? totalCarb : 45,
      fat: totalFat > 0 ? totalFat : 12,
      isHydration: false,
      timestamp: nowIso
    });
  }

  if (liquidParts.length > 0) {
    const perDrinkCal = Math.round((totalCal > 0 && solidParts.length === 0 ? totalCal : (liquidParts.length * 15)) / liquidParts.length);
    const perDrinkProt = Math.round((totalProt || 0) / (liquidParts.length + (solidParts.length > 0 ? 3 : 1)));
    const perDrinkCarb = Math.round((totalCarb || 0) / (liquidParts.length + (solidParts.length > 0 ? 3 : 1)));
    const perDrinkFat = Math.round((totalFat || 0) / (liquidParts.length + (solidParts.length > 0 ? 3 : 1)));

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
      item.fat,
      Boolean(item.isHydration)
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
    historicalLogNotice: "Menampilkan log histori tanggal",
    syncWhatsApp: "Sinkronkan WhatsApp",
    syncing: "Menyinkronkan...",
    syncedJustNow: "Tersinkronisasi Realtime"
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
    viewFullWeeklySchedule: "View Full Weekly Schedule (Mon - Sun)",
    viewTodayOnly: "Back to Today's Schedule",
    todaysFocusProgress: "Today's Workout Progress",
    setsCompleted: "sets completed",
    setUnit: "Sets",
    statusNotStarted: "Not Started",
    statusInProgress: "In Progress",
    statusCompleted: "Completed",
    clickForDetails: "Click for details & set checklist",
    exerciseCount: "Exercises",
    foodMeals: "Food Meals",
    addFoodBtn: "Add Food",
    noMealsLogged: "No solid food logged today.",
    waterHydration: "Water & Hydration",
    addDrinkBtn: "Add Drink",
    hydrationTarget: "Daily Hydration Target",
    quickAdd250: "+250 ml Water",
    quickAdd500: "+500 ml Water",
    noDrinksLogged: "No drinks logged today.",
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
    historicalLogNotice: "Showing historical log for",
    syncWhatsApp: "Sync WhatsApp",
    syncing: "Syncing...",
    syncedJustNow: "Synced in Realtime"
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

  // 5-Tab Mobile Navigation State
  const [activeTab, setActiveTab] = useState<"home" | "workouts" | "progress" | "profile">("home");
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanImage, setScanImage] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanMealType, setScanMealType] = useState<"breakfast" | "lunch" | "dinner" | "snack">("lunch");
  const [scanResult, setScanResult] = useState<{
    foodName: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    portion: string;
  } | null>(null);

  const handlePhotoSelected = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setScanImage(base64);
      setScanLoading(true);
      setScanResult(null);

      // AI Meal Vision Scanner
      setTimeout(() => {
        const lowerName = (file.name || "").toLowerCase();
        let recognizedFood = {
          foodName: "Nasi Ayam Bakar & Sayur Lalapan",
          calories: 520,
          protein: 38,
          carbs: 58,
          fat: 14,
          portion: "1 Porsi Sedang (~350g)"
        };

        if (lowerName.includes("telur") || lowerName.includes("egg")) {
          recognizedFood = {
            foodName: "Omelet Telur 3 Butir & Roti Gandum",
            calories: 340,
            protein: 24,
            carbs: 22,
            fat: 16,
            portion: "1 Porsi (~200g)"
          };
        } else if (lowerName.includes("kopi") || lowerName.includes("coffee") || lowerName.includes("latte")) {
          recognizedFood = {
            foodName: "Iced Oat Latte Tanpa Gula",
            calories: 130,
            protein: 4,
            carbs: 18,
            fat: 5,
            portion: "1 Cup Reguler (350ml)"
          };
        } else if (lowerName.includes("salad") || lowerName.includes("sayur")) {
          recognizedFood = {
            foodName: "Salad Ayam Dada Panggang Dressing Olive",
            calories: 310,
            protein: 32,
            carbs: 15,
            fat: 12,
            portion: "1 Bowl (~280g)"
          };
        } else if (lowerName.includes("steak") || lowerName.includes("daging") || lowerName.includes("beef")) {
          recognizedFood = {
            foodName: "Sirloin Steak 200g & Kentang Panggang",
            calories: 580,
            protein: 46,
            carbs: 35,
            fat: 26,
            portion: "1 Porsi (200g meat + potato)"
          };
        }

        setScanResult(recognizedFood);
        setScanLoading(false);
      }, 1400);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveScannedMeal = () => {
    if (!scanResult) return;
    const newMeal: MealItem = {
      id: Date.now().toString(),
      foodName: scanResult.foodName,
      calories: scanResult.calories,
      protein: scanResult.protein,
      carbs: scanResult.carbs,
      fat: scanResult.fat,
      mealType: scanMealType,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    const updated = [newMeal, ...allLogs];
    setAllLogs(updated);
    const normPhone = (activeUser.phone || "user").replace(/\D/g, "");
    const localKey = `gymbuddy_meals_${normPhone}_${selectedDate}`;
    try {
      localStorage.setItem(localKey, JSON.stringify(updated));
    } catch (e) {}

    // Async server sync
    const syncToServer = async () => {
      try {
        await fetch(`/api/user/${normPhone}/meals`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...newMeal, date: selectedDate })
        });
      } catch (e) {}
    };
    syncToServer();

    setShowScanModal(false);
    setScanImage(null);
    setScanResult(null);
  };

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
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [showManualInputs, setShowManualInputs] = useState(false);
  const [aiPreview, setAiPreview] = useState<any>(null);
  const [aiConfirmStep, setAiConfirmStep] = useState(false); // Feature 1: two-step confirm
  const [coachTip, setCoachTip] = useState<string | null>(null); // Coach next-step bubble
  const [showCoachTip, setShowCoachTip] = useState(false);

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

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Fetch & Auto-Split Combo Logs with Stale-While-Revalidate & Server Priority
  const fetchLogsForDate = async (dateStr: string, silent = false) => {
    const normPhone = normalizePhone(activeUser.phone || "085156919826");
    const localKey = `gymbuddy_meals_${normPhone}_${dateStr}`;

    // 1. Immediate Display from local cache (fast initial render, no flicker)
    try {
      const localData = localStorage.getItem(localKey);
      if (localData !== null) {
        const parsed = JSON.parse(localData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sanitizedLocal = sanitizeAndSplitComboLogs(parsed);
          setAllLogs(sanitizedLocal);
        }
      }
    } catch (e) {}

    if (!silent) setIsSyncing(true);

    // 2. Query Server for latest WhatsApp logs & database entries
    const tryFetchMeals = async (baseUrl: string) => {
      try {
        const res = await fetch(`${baseUrl}/api/user/${normPhone}/meals?date=${dateStr}`, {
          headers: { "Cache-Control": "no-cache" }
        });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data && data.success && Array.isArray(data.logs)) {
            return data.logs as MealItem[];
          }
        }
      } catch (e) {}
      return null;
    };

    try {
      const primaryUrl = (import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-zfft.onrender.com";
      const serverLogs = (await tryFetchMeals("")) || (await tryFetchMeals(primaryUrl));

      if (serverLogs !== null && Array.isArray(serverLogs)) {
        // Authoritative server data received (includes all WhatsApp entries)
        const sanitized = sanitizeAndSplitComboLogs(serverLogs);
        setAllLogs(sanitized);
        try {
          localStorage.setItem(localKey, JSON.stringify(serverLogs));
        } catch (e) {}
      }

      // Also refresh live user profile in background (for streaks, live target, & weight sync)
      try {
        const userRes = await fetch(`/api/user/${normPhone}`).catch(() => null);
        let uData = userRes && userRes.ok ? await userRes.json().catch(() => null) : null;
        if (!uData) {
          const remUserRes = await fetch(`${primaryUrl}/api/user/${normPhone}`).catch(() => null);
          if (remUserRes && remUserRes.ok) {
            uData = await remUserRes.json().catch(() => null);
          }
        }
        if (uData && (uData.name || uData.user || uData.profile)) {
          const p = uData.profile || uData.user || uData;
          setLiveUser((prev) => ({ ...prev, ...p, streak: uData.streak ?? prev.streak ?? 1 }));
        }
      } catch (e) {}

      setLastSyncTime(new Date());
    } catch (err) {
      console.warn("[Dashboard] Sync note:", err);
    } finally {
      if (!silent) setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchLogsForDate(selectedDate, false);

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

    // Auto-poll WhatsApp updates every 8 seconds silently
    const intervalId = setInterval(() => {
      fetchLogsForDate(selectedDate, true);
    }, 8000);

    // Auto-sync when window / browser tab gains focus or visibility
    const handleFocus = () => {
      fetchLogsForDate(selectedDate, false);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchLogsForDate(selectedDate, false);
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
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

  // AI Food Text Analysis Helper
  const handleAnalyzeAiFoodText = async (textToAnalyze?: string) => {
    const queryText = (textToAnalyze || itemNameInput).trim();
    if (!queryText) return null;

    setIsAnalyzingAi(true);
    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-zfft.onrender.com";

    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/analyze-food`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: queryText })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setItemCalInput(String(data.calories || 0));
          setItemProteinInput(String(data.protein || 0));
          setItemCarbsInput(String(data.carbs || 0));
          setItemFatInput(String(data.fat || 0));
          setAiPreview(data);
          setIsAnalyzingAi(false);
          return data;
        }
      }
    } catch (e) {
      console.error("Error analyzing food with AI:", e);
    }
    setIsAnalyzingAi(false);
    return null;
  };

  // Step 1: AI Analysis & Preview — does NOT save yet, just fills form + shows confirm panel
  const handleAnalyzeAndPreview = async () => {
    if (!itemNameInput.trim()) return;
    setIsAnalyzingAi(true);
    setAiConfirmStep(false);

    let cal = Number(itemCalInput) || 0;
    let prot = Number(itemProteinInput) || 0;
    let carb = Number(itemCarbsInput) || 0;
    let fat = Number(itemFatInput) || 0;

    // If user didn't fill macros manually, use AI
    if (cal === 0 && prot === 0 && carb === 0 && fat === 0) {
      const aiRes = await handleAnalyzeAiFoodText(itemNameInput);
      if (aiRes) {
        cal = Number(aiRes.calories) || 0;
        prot = Number(aiRes.protein) || 0;
        carb = Number(aiRes.carbs) || 0;
        fat = Number(aiRes.fat) || 0;
      }
    }

    setIsAnalyzingAi(false);
    setAiConfirmStep(true); // Show confirmation panel
  };

  // Step 2: User confirmed — actually save to log
  const handleConfirmSave = async () => {
    if (!itemNameInput.trim()) return;

    const normPhone = normalizePhone(activeUser.phone || "085156919826");
    const cal = Number(itemCalInput) || 0;
    const prot = Number(itemProteinInput) || 0;
    const carb = Number(itemCarbsInput) || 0;
    const fat = Number(itemFatInput) || 0;

    const { foods, drinks } = splitAndCategorizeComboText(
      itemNameInput,
      cal,
      prot,
      carb,
      fat
    );

    const newItems = [...foods, ...drinks];

    // CRITICAL: Update localStorage IMMEDIATELY before the server call.
    const updated = [...allLogs, ...newItems];
    setAllLogs(updated);
    const localKey = `gymbuddy_meals_${normPhone}_${selectedDate}`;
    try {
      localStorage.setItem(localKey, JSON.stringify(updated));
    } catch (e) {}

    // Fire-and-forget server sync (non-critical, localStorage is authoritative)
    const syncToServer = async (baseUrl: string) => {
      for (const item of newItems) {
        try {
          await fetch(`${baseUrl}/api/user/${normPhone}/meals`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...item, date: selectedDate })
          });
        } catch (e) {}
      }
    };
    syncToServer("");
    syncToServer((import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-zfft.onrender.com");

    // Reset all form state
    setItemNameInput("");
    setItemCalInput("");
    setItemProteinInput("");
    setItemCarbsInput("");
    setItemFatInput("");
    setAiPreview(null);
    setAiConfirmStep(false);
    setShowManualInputs(false);
    setShowAddFoodModal(false);
    setShowAddDrinkModal(false);

    // ── Fetch Coach Next-Step Advice (non-blocking) ─────────────────────────
    const totalCal = [...allLogs, ...newItems].filter(i => !isLiquidName(i.foodName) && !i.isHydration).reduce((s, i) => s + (Number(i.calories) || 0), 0);
    const totalProt = [...allLogs, ...newItems].filter(i => !isLiquidName(i.foodName) && !i.isHydration).reduce((s, i) => s + (Number(i.protein) || 0), 0);
    const totalCarb = [...allLogs, ...newItems].filter(i => !isLiquidName(i.foodName) && !i.isHydration).reduce((s, i) => s + (Number(i.carbs) || 0), 0);
    const totalFat  = [...allLogs, ...newItems].filter(i => !isLiquidName(i.foodName) && !i.isHydration).reduce((s, i) => s + (Number(i.fat) || 0), 0);
    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-zfft.onrender.com";
    try {
      const tipRes = await fetch(`${API_BASE_URL}/api/ai/next-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normPhone,
          calories: totalCal,
          protein: totalProt,
          carbs: totalCarb,
          fat: totalFat,
          targetCalories,
          targetProtein,
          targetCarbs,
          targetFat,
          goal: activeUser.goal || "maintain",
          persona: activeUser.persona || "max",
          name: activeUser.name || "Member",
          mealName: itemNameInput || foods[0]?.foodName || "Makanan"
        })
      });
      if (tipRes.ok) {
        const tipData = await tipRes.json();
        if (tipData.success && tipData.advice) {
          // Strip WhatsApp bold markers for web display
          const cleanAdvice = (tipData.advice as string)
            .replace(/\*\*?(.*?)\*\*?/g, "$1")
            .replace(/━+/g, "")
            .replace(/🎯 \*?SARAN [A-Z ]+\*?\n*/i, "")
            .trim();
          setCoachTip(cleanAdvice);
          setShowCoachTip(true);
          // Auto-hide after 12 seconds
          setTimeout(() => setShowCoachTip(false), 12000);
        }
      }
    } catch (tipErr) {
      // Silently ignore — coach tip is non-critical
    }
    // ── End Coach Next-Step ────────────────────────────────────────────────
  };

  // Legacy: kept for backward compatibility but now calls handleAnalyzeAndPreview
  const handleSaveLogItem = handleAnalyzeAndPreview;

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

    // Immediately persist deletion to localStorage — this is the source of truth.
    const localKey = `gymbuddy_meals_${normPhone}_${selectedDate}`;
    try {
      localStorage.setItem(localKey, JSON.stringify(updated));
    } catch (e) {}

    // Sync deletion to both local and remote servers
    const deleteFromServer = async (baseUrl: string) => {
      try {
        // 1. Delete the specific meal by ID
        await fetch(`${baseUrl}/api/user/${normPhone}/meals/${id}?date=${selectedDate}`, {
          method: "DELETE"
        });
        // 2. Full synchronization: update the entire day's log list on server
        await fetch(`${baseUrl}/api/user/${normPhone}/meals?date=${selectedDate}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meals: updated, date: selectedDate })
        });
        // 3. If all items were removed, explicitly call bulk DELETE endpoint as well
        if (updated.length === 0) {
          await fetch(`${baseUrl}/api/user/${normPhone}/meals?date=${selectedDate}`, {
            method: "DELETE"
          });
        }
      } catch (e) {}
    };
    deleteFromServer(""); // local server
    deleteFromServer((import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-zfft.onrender.com"); // remote server
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
    <div className="min-h-screen bg-[#0A0D14] text-white font-['Inter'] p-0 sm:p-4 lg:p-6 flex flex-col lg:flex-row gap-5 selection:bg-[#D4FF00] selection:text-black">
      
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

      {/* FLOATING SIDEBAR PANEL (DESKTOP ONLY - NEVER ON MOBILE) */}
      <aside className="hidden lg:flex w-72 bg-[#121722] text-white p-6 flex-col justify-between shrink-0 rounded-3xl border border-white/[0.06] shadow-xl min-h-[92vh]">
        <div className="space-y-6">
          {/* GymBuddy Logo & App Title */}
          <div className="flex items-center justify-between">
            <GymBuddyLogo size={32} showText textClassName="text-xl text-white font-extrabold tracking-tight" />
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#18202E] border border-white/[0.08] text-xs font-black text-slate-300 hover:text-white cursor-pointer"
            >
              <Globe size={12} className="text-slate-400" />
              <span className={lang === "ID" ? "text-[#D4FF00] font-bold" : "text-slate-500"}>ID</span>
              <span className="text-slate-600">|</span>
              <span className={lang === "EN" ? "text-[#D4FF00] font-bold" : "text-slate-500"}>EN</span>
            </button>
          </div>

          {/* User Profile Card */}
          <div className="bg-[#18202E] border border-white/[0.06] rounded-2xl p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#D4FF00] text-black font-black flex items-center justify-center text-lg shadow-sm">
              {activeUser.name ? activeUser.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="overflow-hidden">
              <h3 className="font-extrabold text-sm text-white truncate">{activeUser.name || "Member"}</h3>
              <span className="text-xs font-semibold text-[#D4FF00] block">{coachName} Member</span>
            </div>
          </div>

          {/* Navigation Pill List */}
          <nav className="space-y-2">
            <button className="w-full px-4 py-3 rounded-2xl bg-[#D4FF00] text-black font-black text-sm flex items-center justify-between transition-all cursor-pointer shadow-md">
              <div className="flex items-center gap-3">
                <BarChart2 size={18} />
                <span>Dashboard</span>
              </div>
              <ChevronRight size={16} />
            </button>

            <button
              onClick={onBackToHome}
              className="w-full px-4 py-3 rounded-2xl text-slate-400 hover:text-white hover:bg-[#18202E] font-bold text-sm flex items-center gap-3 transition-all cursor-pointer"
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
          <div className="bg-[#18202E] border border-white/[0.06] rounded-2xl p-4 space-y-2 text-center">
            <span className="text-xs font-bold text-slate-400 uppercase">{t.mainGoalTitle}</span>
            <p className="text-sm font-extrabold text-white">{goalTitle}</p>
            <div className="pt-1 flex justify-center">
              <button
                onClick={() => setShowUpdateWeightModal(true)}
                className="px-3 py-1 rounded-full bg-[#D4FF00] text-black text-xs font-extrabold hover:bg-[#c4ec00] transition-all cursor-pointer"
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
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#18202E] transition-colors cursor-pointer"
              title={t.logout}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* RIGHT MAIN CONTENT CONTAINER */}
      <main className="flex-1 bg-[#0A0D14] sm:bg-[#0F141C] border-0 sm:border sm:border-white/[0.06] rounded-none sm:rounded-3xl p-4 sm:p-6 md:p-8 space-y-5 overflow-y-auto shadow-sm text-white pb-24 lg:pb-8">
        
        {/* PWA INSTALL BANNER (Non-intrusive, auto hides when installed/dismissed) */}
        {/* ========================================================================= */}
        {/* TAB 1: HOME (DASHBOARD RINGKASAN) */}
        {/* ========================================================================= */}
        {activeTab === "home" && (
          <div className="space-y-5">
            {/* STEP 1: TOP GREETING HEADER & DATE STRIP */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#121722] border border-white/[0.06] rounded-2xl p-4 sm:p-5 shadow-xs">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#D4FF00] text-black font-black flex items-center justify-center text-lg shadow-sm shrink-0">
                  {activeUser.name ? activeUser.name.charAt(0).toUpperCase() : "U"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      {activeUser.name || "Member"}
                    </h1>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-extrabold text-[11px] flex items-center gap-1">
                      🔥 {currentStreak} {t.activeDaysConsecutive}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 font-medium mt-0.5">
                    {selectedDayName}, {selectedDate} • {todayScheduleObj.focus}
                  </p>
                </div>
              </div>

              {/* Action Buttons: Calendar & Sync */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
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
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-[#18202E] text-neutral-200 border border-white/[0.08] hover:border-[#D4FF00]/40 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <CalendarIcon size={15} className="text-[#D4FF00]" />
                  <span>Kalender</span>
                </button>

                <button
                  type="button"
                  onClick={() => fetchLogsForDate(selectedDate, false)}
                  disabled={isSyncing}
                  className={`px-3 py-2 rounded-xl text-xs font-bold bg-[#18202E] text-neutral-200 border border-white/[0.08] hover:border-[#D4FF00]/40 flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSyncing ? "opacity-75" : ""
                  }`}
                  title={t.syncWhatsApp || "Sync WhatsApp"}
                >
                  <RefreshCw size={14} className={`text-[#D4FF00] ${isSyncing ? "animate-spin" : ""}`} />
                  <span>{isSyncing ? "Syncing..." : "Sync WA"}</span>
                </button>
              </div>
            </div>

            {/* 7-DAY DATE NAVIGATION CAROUSEL */}
            <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-1">
              {!isSelectedDateInRibbon && (
                <button
                  onClick={() => setSelectedDate(todayDateStr)}
                  className="px-3.5 py-3 rounded-2xl bg-amber-500 text-black font-extrabold text-xs flex items-center gap-1 shrink-0 shadow-sm"
                >
                  <RotateCcw size={13} />
                  <span>Hari Ini</span>
                </button>
              )}

              {ribbonDates.map((d) => {
                const isSel = d.dateStr === selectedDate;
                return (
                  <button
                    key={d.dateStr}
                    type="button"
                    onClick={() => setSelectedDate(d.dateStr)}
                    className={`flex flex-col items-center justify-center flex-1 min-w-[50px] py-2.5 rounded-2xl font-bold text-xs transition-all cursor-pointer border ${
                      isSel
                        ? "bg-[#D4FF00] text-black border-[#D4FF00] font-black shadow-sm scale-102"
                        : "bg-[#121722] text-neutral-400 border-white/[0.06] hover:bg-[#18202E] hover:text-white"
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold opacity-80">{d.dayName}</span>
                    <span className="text-sm font-black mt-0.5">{d.dayNum}</span>
                  </button>
                );
              })}
            </div>

            {/* STEP 2: DYNAMIC HERO ACTIVITY & MACRO GAUGE CARD */}
            <div className="bg-gradient-to-br from-[#151D2C] to-[#0D131F] border border-white/[0.08] rounded-3xl p-5 sm:p-6 shadow-lg relative overflow-hidden">
              {/* Subtle ambient light glow in background */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4FF00]/5 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#00D2FF]/5 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                {/* Circular Activity Gauge */}
                <div className="flex items-center gap-5 w-full md:w-auto">
                  <div className="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                      {/* Background track */}
                      <circle
                        cx="60"
                        cy="60"
                        r="48"
                        className="stroke-[#1C2638]"
                        strokeWidth="10"
                        fill="transparent"
                      />
                      {/* Animated Progress Ring */}
                      <circle
                        cx="60"
                        cy="60"
                        r="48"
                        stroke="url(#calorieGlowGrad)"
                        strokeWidth="10"
                        strokeDasharray={2 * Math.PI * 48}
                        strokeDashoffset={2 * Math.PI * 48 * (1 - Math.min(1, totalCaloriesConsumed / (targetCalories || 2000)))}
                        strokeLinecap="round"
                        fill="transparent"
                        className="transition-all duration-700 ease-out"
                      />
                      <defs>
                        <linearGradient id="calorieGlowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#25D366" />
                          <stop offset="100%" stopColor="#D4FF00" />
                        </linearGradient>
                      </defs>
                    </svg>

                    {/* Inside Circle Content */}
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <Flame size={18} className="text-[#D4FF00] animate-pulse" />
                      <span className="text-xl sm:text-2xl font-black text-white leading-none mt-1">
                        {Math.max(0, targetCalories - totalCaloriesConsumed)}
                      </span>
                      <span className="text-[9px] text-neutral-400 font-extrabold uppercase tracking-wider mt-0.5">
                        kcal sisa
                      </span>
                    </div>
                  </div>

                  {/* Ring Summary Text */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-400">
                      Target Harian
                    </span>
                    <h3 className="text-lg font-black text-white">
                      {totalCaloriesConsumed} <span className="text-neutral-400 text-xs font-semibold">/ {targetCalories} kcal</span>
                    </h3>
                    <p className="text-xs text-neutral-400 font-medium">
                      {totalCaloriesConsumed >= targetCalories ? "🎯 Target kalori harian tercapai!" : "🔥 Energi siap untuk aktivitas & gym"}
                    </p>
                  </div>
                </div>

                {/* Macro Progress Breakdown Bars */}
                <div className="w-full md:w-64 space-y-3.5 pt-2 md:pt-0 border-t md:border-t-0 md:border-l border-white/[0.06] md:pl-6">
                  {/* Protein */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-neutral-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#D4FF00]" />
                        <span>Protein</span>
                      </span>
                      <span className="text-white font-mono">{totalProteinConsumed} <span className="text-neutral-500 font-normal">/ {targetProtein}g</span></span>
                    </div>
                    <div className="w-full h-2 bg-[#1A2333] rounded-full overflow-hidden p-0.5 border border-white/[0.04]">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-[#D4FF00] rounded-full transition-all duration-500 shadow-[0_0_8px_#D4FF00]"
                        style={{ width: `${Math.min(100, Math.round((totalProteinConsumed / (targetProtein || 1)) * 100))}%` }}
                      />
                    </div>
                  </div>

                  {/* Air Minum */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-neutral-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#00D2FF]" />
                        <span>Air Minum</span>
                      </span>
                      <span className="text-white font-mono">{totalHydrationMl} <span className="text-neutral-500 font-normal">/ 2500ml</span></span>
                    </div>
                    <div className="w-full h-2 bg-[#1A2333] rounded-full overflow-hidden p-0.5 border border-white/[0.04]">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-[#00D2FF] rounded-full transition-all duration-500 shadow-[0_0_8px_#00D2FF]"
                        style={{ width: `${Math.min(100, Math.round((totalHydrationMl / 2500) * 100))}%` }}
                      />
                    </div>
                  </div>

                  {/* Body Goal */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-neutral-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span>Target Berat</span>
                      </span>
                      <span className="text-[#D4FF00] font-mono">{weight} kg <span className="text-neutral-500 font-normal">➔ {targetWeight}kg</span></span>
                    </div>
                    <div className="w-full h-2 bg-[#1A2333] rounded-full overflow-hidden p-0.5 border border-white/[0.04]">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* TODAY'S WORKOUT CARD */}
            <div className="bg-[#121722] border border-white/[0.06] rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#18202E] border border-white/[0.08] flex items-center justify-center text-[#D4FF00] shrink-0">
                  <Dumbbell size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-[#D4FF00] text-black">
                      Latihan Hari Ini
                    </span>
                    <span className="text-xs text-neutral-400 font-semibold">{selectedDayName}</span>
                  </div>
                  <h3 className="text-base font-extrabold text-white mt-1">{todayScheduleObj.focus}</h3>
                  <p className="text-xs text-neutral-400 font-medium">{exercises.length} Menu Gerakan • {overallWorkoutPercent}% Selesai</p>
                </div>
              </div>

              <button
                onClick={() => setActiveTab("workouts")}
                className="w-full sm:w-auto px-4 py-2.5 bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <span>Buka Menu Latihan</span>
                <ArrowRight size={14} />
              </button>
            </div>

            {/* FOOD MEALS LIST */}
            <div className="bg-[#121722] border border-white/[0.06] rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame size={18} className="text-amber-400" />
                  <h2 className="text-base font-extrabold text-white">{t.foodMeals}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowScanModal(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#18202E] border border-white/[0.08] text-[#D4FF00] hover:bg-[#D4FF00] hover:text-black font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Camera size={14} />
                    <span>Scan Foto</span>
                  </button>
                  <button
                    onClick={() => setShowAddFoodModal(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#D4FF00] text-black font-extrabold text-xs flex items-center gap-1 hover:bg-[#c4ec00] transition-all cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Tambah</span>
                  </button>
                </div>
              </div>

              {foodMeals.length === 0 ? (
                <div className="text-center py-6 text-neutral-400 text-xs font-medium border border-dashed border-white/[0.08] rounded-xl bg-[#0E131F]">
                  {t.noMealsLogged}
                </div>
              ) : (
                <div className="divide-y divide-white/[0.06] border border-white/[0.06] rounded-xl overflow-hidden bg-[#0E131F]">
                  {foodMeals.map((item) => (
                    <div key={item.id} className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                      <div>
                        <h4 className="font-extrabold text-sm text-white">{item.foodName}</h4>
                        <p className="text-xs text-neutral-400 font-medium mt-0.5">
                          {item.calories} kcal • P: {item.protein}g | C: {item.carbs}g | F: {item.fat}g
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteLogItem(item.id)}
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                        title={t.delete}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* WATER & HYDRATION TRACKER */}
            <div className="bg-[#121722] border border-white/[0.06] rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Droplets size={18} className="text-blue-400" />
                  <h2 className="text-base font-extrabold text-white">{t.waterHydration}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleQuickAddWater(250)}
                    className="px-3 py-1.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300 font-extrabold text-xs hover:bg-blue-500/25 cursor-pointer"
                  >
                    +250 ml
                  </button>
                  <button
                    onClick={() => handleQuickAddWater(500)}
                    className="px-3 py-1.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300 font-extrabold text-xs hover:bg-blue-500/25 cursor-pointer"
                  >
                    +500 ml
                  </button>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-blue-400 uppercase">Target Hidrasi Harian</span>
                  <p className="text-base font-black text-white">{totalHydrationMl} ml / 2,500 ml ({totalWaterCups} Gelas)</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-300 font-bold flex items-center justify-center text-sm">
                  💧
                </div>
              </div>
            </div>

            {/* MOOD & COACH RECOMMENDATION */}
            <div className="bg-[#121722] border border-white/[0.06] rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-[#D4FF00]" />
                <h2 className="text-base font-extrabold text-white">Saran {coachName} Hari Ini</h2>
              </div>

              <div className="bg-[#0E131F] border border-white/[0.06] rounded-xl p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#D4FF00] text-black font-black flex items-center justify-center text-sm shrink-0">
                  {isMaxPersona ? "🏋️" : "✨"}
                </div>
                <div className="space-y-0.5">
                  <h4 className="font-extrabold text-sm text-white">{coachName}</h4>
                  <p className="text-xs text-neutral-300 font-medium leading-relaxed">{getCoachFeelingRecommendation()}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: WORKOUTS (JADWAL & SESI LATIHAN) */}
        {/* ========================================================================= */}
        {activeTab === "workouts" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between bg-[#121722] border border-white/[0.06] rounded-2xl p-4 sm:p-5">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <Dumbbell size={22} className="text-[#D4FF00]" />
                  <span>Jadwal & Latihan Gym</span>
                </h1>
                <p className="text-xs text-neutral-400 font-semibold mt-0.5">
                  {selectedDayName} • {todayScheduleObj.focus} ({overallWorkoutPercent}% Selesai)
                </p>
              </div>

              <button
                onClick={() => setShowFullWeeklyOverview(!showFullWeeklyOverview)}
                className="px-3 py-1.5 rounded-xl bg-[#18202E] border border-white/[0.08] text-neutral-300 font-bold text-xs hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Layers size={14} />
                <span>{showFullWeeklyOverview ? "Lihat Hari Ini" : "Jadwal 7 Hari"}</span>
              </button>
            </div>

            {!showFullWeeklyOverview ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exercises.map((ex) => {
                  const percent = ex.targetSets > 0 ? Math.round((ex.completedSets / ex.targetSets) * 100) : 0;
                  const isDone = percent === 100;

                  return (
                    <div
                      key={ex.id}
                      className={`border rounded-2xl p-4 sm:p-5 transition-all space-y-3.5 ${
                        isDone
                          ? "bg-emerald-500/10 border-emerald-500/30 text-white"
                          : ex.completedSets > 0
                          ? "bg-amber-500/10 border-amber-500/30 text-white"
                          : "bg-[#121722] border-white/[0.06] hover:border-white/[0.12]"
                      }`}
                      onClick={() => setActiveWorkoutDetail(ex)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-extrabold text-base text-white">{ex.name}</h3>
                          <p className="text-xs text-neutral-400 font-semibold mt-0.5">{ex.targetReps} • {ex.targetSets} Sets</p>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
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

                      <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {ex.setsState.map((isSetDone, setIdx) => (
                            <button
                              key={setIdx}
                              onClick={() => handleToggleSet(ex.id, setIdx)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer border ${
                                isSetDone
                                  ? "bg-[#D4FF00] text-black border-[#D4FF00] shadow-xs"
                                  : "bg-[#18202E] text-neutral-300 border-white/[0.08] hover:bg-neutral-800"
                              }`}
                            >
                              <span>Set {setIdx + 1}</span>
                              {isSetDone && <Check size={12} strokeWidth={3} />}
                            </button>
                          ))}
                        </div>
                        <div className="text-xs font-black text-neutral-300">
                          {ex.completedSets} / {ex.targetSets} ({percent}%)
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4">
                {weeklySchedule.map((daySch) => {
                  const isSelectedDay = daySch.day === selectedDayName;
                  return (
                    <div
                      key={daySch.day}
                      className={`border rounded-2xl p-4 sm:p-5 transition-all space-y-3 ${
                        isSelectedDay ? "bg-[#121722] text-white border-[#D4FF00]/40" : "bg-[#121722] border-white/[0.06] text-neutral-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className={`px-3 py-1 rounded-xl font-black text-xs uppercase ${isSelectedDay ? "bg-[#D4FF00] text-black" : "bg-neutral-800 text-neutral-300"}`}>
                            {daySch.day}
                          </span>
                          <h4 className="font-extrabold text-base text-white">{daySch.focus}</h4>
                        </div>
                        <span className="text-xs font-semibold text-neutral-400">{daySch.exercises.length} Menu Gerakan</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                        {daySch.exercises.map((exItem) => (
                          <div key={exItem.id} className="p-3 rounded-xl text-xs border bg-[#0E131F] border-white/[0.06] text-neutral-200">
                            <p className="font-extrabold text-white text-sm">{exItem.name}</p>
                            <p className="text-[11px] text-neutral-400 font-medium mt-0.5">{exItem.targetReps}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: PROGRESS (PROYEKSI & HISTORI PROGRES) */}
        {/* ========================================================================= */}
        {activeTab === "progress" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between bg-[#121722] border border-white/[0.06] rounded-2xl p-4 sm:p-5">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <TrendingUp size={22} className="text-[#D4FF00]" />
                  <span>Progres Berat Badan</span>
                </h1>
                <p className="text-xs text-neutral-400 font-semibold mt-0.5">
                  Target: {goalTitle} ({weight} kg ➔ {targetWeight} kg)
                </p>
              </div>

              <button
                onClick={() => setShowUpdateWeightModal(true)}
                className="px-4 py-2 bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-sm"
              >
                <span>Perbarui Berat</span>
              </button>
            </div>

            {/* WEIGHT PROJECTION GRAPH */}
            <div className="bg-[#121722] border border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-base text-white">Kurva Proyeksi Target</h3>
                <span className="text-xs font-black text-[#D4FF00] bg-[#D4FF00]/10 border border-[#D4FF00]/30 px-3 py-1 rounded-full">
                  Target: {targetWeight} kg
                </span>
              </div>

              <div className="bg-[#0E131F] border border-white/[0.06] rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between text-xs text-neutral-400 font-bold border-b border-white/[0.06] pb-2">
                  <span>Awal: {startWeight || weight} kg</span>
                  <span>Estimasi: ~12 Minggu</span>
                  <span className="text-[#D4FF00]">Target: {targetWeight} kg</span>
                </div>

                <div className="h-44 sm:h-52 w-full relative flex items-center justify-center pt-2">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 500 160">
                    <defs>
                      <linearGradient id="curveGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#D4FF00" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#25D366" stopOpacity="1" />
                      </linearGradient>
                      <linearGradient id="areaFill" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#D4FF00" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#D4FF00" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    <line x1="0" y1="40" x2="500" y2="40" stroke="#1E2638" strokeDasharray="4 4" strokeWidth="1" />
                    <line x1="0" y1="80" x2="500" y2="80" stroke="#1E2638" strokeDasharray="4 4" strokeWidth="1" />
                    <line x1="0" y1="120" x2="500" y2="120" stroke="#1E2638" strokeDasharray="4 4" strokeWidth="1" />

                    {targetWeight < weight ? (
                      <path d="M 30 50 Q 250 80, 470 120 L 470 150 L 30 150 Z" fill="url(#areaFill)" />
                    ) : targetWeight > weight ? (
                      <path d="M 30 120 Q 250 80, 470 50 L 470 150 L 30 150 Z" fill="url(#areaFill)" />
                    ) : (
                      <path d="M 30 80 L 470 80 L 470 150 L 30 150 Z" fill="url(#areaFill)" />
                    )}

                    {targetWeight < weight ? (
                      <path d="M 30 50 Q 250 80, 470 120" fill="none" stroke="url(#curveGlow)" strokeWidth="4" strokeLinecap="round" />
                    ) : targetWeight > weight ? (
                      <path d="M 30 120 Q 250 80, 470 50" fill="none" stroke="url(#curveGlow)" strokeWidth="4" strokeLinecap="round" />
                    ) : (
                      <path d="M 30 80 L 470 80" fill="none" stroke="url(#curveGlow)" strokeWidth="4" strokeLinecap="round" />
                    )}

                    <circle cx="30" cy={targetWeight < weight ? 50 : targetWeight > weight ? 120 : 80} r="6" fill="#111620" stroke="#D4FF00" strokeWidth="3" />
                    <text x="30" y={targetWeight < weight ? 35 : targetWeight > weight ? 140 : 65} fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">
                      {weight} kg (Sekarang)
                    </text>

                    <circle cx="470" cy={targetWeight < weight ? 120 : targetWeight > weight ? 50 : 80} r="7" fill="#D4FF00" stroke="#111620" strokeWidth="2" />
                    <text x="470" y={targetWeight < weight ? 142 : targetWeight > weight ? 38 : 65} fill="#D4FF00" fontSize="12" fontWeight="900" textAnchor="middle">
                      {targetWeight} kg (Target)
                    </text>
                  </svg>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#0E131F] border border-white/[0.06] rounded-xl p-4 text-center space-y-1">
                  <span className="text-xs text-neutral-400 font-bold uppercase">Berat Awal</span>
                  <p className="text-lg font-black text-white">{startWeight || weight} kg</p>
                </div>
                <div className="bg-[#0E131F] border border-white/[0.06] rounded-xl p-4 text-center space-y-1">
                  <span className="text-xs text-neutral-400 font-bold uppercase">Saat Ini</span>
                  <p className="text-lg font-black text-[#D4FF00]">{weight} kg</p>
                </div>
                <div className="bg-[#0E131F] border border-white/[0.06] rounded-xl p-4 text-center space-y-1">
                  <span className="text-xs text-neutral-400 font-bold uppercase">Sisa</span>
                  <p className="text-lg font-black text-white">{remainingKg} kg</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: PROFILE & SETTINGS (PROFIL & PENGATURAN) */}
        {/* ========================================================================= */}
        {activeTab === "profile" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between bg-[#121722] border border-white/[0.06] rounded-2xl p-4 sm:p-5">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <User size={22} className="text-[#D4FF00]" />
                  <span>Profil & Pengaturan</span>
                </h1>
                <p className="text-xs text-neutral-400 font-semibold mt-0.5">
                  {activeUser.name || "Member"} • {activeUser.phone || "-"}
                </p>
              </div>

              <button
                onClick={toggleLanguage}
                className="px-3.5 py-1.5 bg-[#18202E] border border-white/[0.08] rounded-xl text-xs font-bold text-neutral-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
              >
                <Globe size={14} className="text-[#D4FF00]" />
                <span>{lang}</span>
              </button>
            </div>

            {/* Coach Persona Card */}
            <div className="bg-[#121722] border border-white/[0.06] rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#D4FF00] text-black font-black flex items-center justify-center text-xl shadow-sm">
                    {isMaxPersona ? "🏋️" : "✨"}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-white">{coachName}</h3>
                    <p className="text-xs text-[#D4FF00] font-bold">{isMaxPersona ? "Pelatih Gym" : "Nutritionist"}</p>
                  </div>
                </div>

                <a
                  href={`https://wa.me/${(import.meta as any).env?.VITE_WHATSAPP_BOT_NUMBER || "14155238886"}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-[#25D366] hover:bg-[#1ebd59] text-black font-extrabold text-xs rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <MessageSquare size={15} />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>

            {/* Biometrics */}
            <div className="bg-[#121722] border border-white/[0.06] rounded-2xl p-5 shadow-xs space-y-3">
              <h3 className="font-extrabold text-sm text-white">Data Fisik & Target Harian</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#0E131F] border border-white/[0.06] rounded-xl p-3.5 space-y-0.5">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase">Berat Badan</span>
                  <p className="text-base font-black text-white">{weight} kg</p>
                </div>
                <div className="bg-[#0E131F] border border-white/[0.06] rounded-xl p-3.5 space-y-0.5">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase">Tinggi Badan</span>
                  <p className="text-base font-black text-white">{activeUser.height || 170} cm</p>
                </div>
                <div className="bg-[#0E131F] border border-white/[0.06] rounded-xl p-3.5 space-y-0.5">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase">Target Kalori</span>
                  <p className="text-base font-black text-white">{targetCalories} kcal</p>
                </div>
                <div className="bg-[#0E131F] border border-white/[0.06] rounded-xl p-3.5 space-y-0.5">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase">Target Protein</span>
                  <p className="text-base font-black text-white">{targetProtein} g</p>
                </div>
              </div>
            </div>

            {/* Quick Links & Landing Page */}
            <div className="bg-[#121722] border border-white/[0.06] rounded-2xl p-4 shadow-xs">
              <button
                onClick={onBackToHome}
                className="w-full py-3 px-4 rounded-xl bg-[#18202E] hover:bg-[#202b3d] text-white font-bold text-xs flex items-center justify-between transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <ArrowLeft size={16} className="text-[#D4FF00]" />
                  <span>Kembali ke Halaman Depan (Landing Page)</span>
                </div>
                <ChevronRight size={16} className="text-neutral-500" />
              </button>
            </div>

            {/* Account Settings & Logout */}
            <div className="bg-[#121722] border border-white/[0.06] rounded-2xl p-5 shadow-xs flex items-center justify-between">
              <button
                onClick={handleDeleteAccount}
                className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={15} />
                <span>{t.removeAccount}</span>
              </button>

              <button
                onClick={onLogout}
                className="px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-extrabold text-xs flex items-center gap-2 cursor-pointer transition-all"
              >
                <LogOut size={15} />
                <span>{t.logout}</span>
              </button>
            </div>
          </div>
        )}

      </main>

      {/* ========================================================================= */}
      {/* AI MEAL CAMERA & PHOTO SCANNER MODAL (BOTTOM DRAWER) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showScanModal && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className="bg-[#111620] border border-neutral-800 rounded-t-3xl sm:rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 text-white max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-black border border-[#D4FF00]/40 flex items-center justify-center text-[#D4FF00]">
                    <Camera size={18} />
                  </div>
                  <div>
                    <h3 className="font-['Archivo_Black'] text-white text-base">
                      Scan Foto Makanan AI
                    </h3>
                    <p className="text-xs text-neutral-400 font-medium">
                      Foto makanan untuk hitung kalori & nutrisi otomatis
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowScanModal(false);
                    setScanImage(null);
                    setScanResult(null);
                  }}
                  className="text-neutral-400 hover:text-white p-1 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Photo Upload / Capture Zone */}
              {!scanImage ? (
                <div className="border-2 border-dashed border-neutral-700 hover:border-[#D4FF00] rounded-2xl p-8 text-center space-y-4 bg-[#161C28]/60 transition-all">
                  <div className="w-16 h-16 rounded-full bg-[#D4FF00]/10 border border-[#D4FF00]/30 flex items-center justify-center mx-auto text-[#D4FF00]">
                    <Camera size={30} />
                  </div>
                  <div>
                    <p className="font-extrabold text-white text-sm">
                      Ambil Foto atau Pilih dari Galeri
                    </p>
                    <p className="text-xs text-neutral-400 font-medium mt-1">
                      Mendukung Nasi Padang, Ayam, Kopi, Salad, dll.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-extrabold text-xs transition-all cursor-pointer shadow-md active:scale-98">
                    <Upload size={16} />
                    <span>Buka Kamera / Pilih Foto</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handlePhotoSelected(f);
                      }}
                    />
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Photo Preview */}
                  <div className="relative rounded-2xl overflow-hidden border border-neutral-800 max-h-56 bg-black flex items-center justify-center">
                    <img src={scanImage} alt="Scanned Meal" className="w-full h-full object-cover max-h-56" />
                    {scanLoading && (
                      <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center space-y-2">
                        <div className="w-full h-1 bg-gradient-to-r from-transparent via-[#D4FF00] to-transparent animate-pulse absolute top-1/2 -translate-y-1/2 shadow-[0_0_15px_#D4FF00]" />
                        <Sparkles size={24} className="text-[#D4FF00] animate-spin" />
                        <span className="text-xs font-black text-[#D4FF00] bg-black/80 px-3 py-1 rounded-full border border-[#D4FF00]/40">
                          Menganalisis Kalori & Nutrisi via AI...
                        </span>
                      </div>
                    )}
                  </div>

                  {/* AI Results */}
                  {scanResult && !scanLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-[#161C28] border border-[#D4FF00]/40 rounded-2xl p-4 space-y-3 shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-black uppercase text-[#D4FF00] tracking-wider">
                            ✨ AI Detection Result
                          </span>
                          <h4 className="font-extrabold text-base text-white">{scanResult.foodName}</h4>
                          <p className="text-xs text-neutral-400 font-medium">{scanResult.portion}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-black text-[#D4FF00]">{scanResult.calories}</span>
                          <span className="text-xs text-neutral-400 block font-bold">kcal</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-neutral-800 text-xs font-bold">
                        <div className="bg-white/5 rounded-xl p-2">
                          <span className="block text-[10px] text-neutral-400 font-semibold">Protein</span>
                          <span className="text-indigo-400 font-black">{scanResult.protein}g</span>
                        </div>
                        <div className="bg-white/5 rounded-xl p-2">
                          <span className="block text-[10px] text-neutral-400 font-semibold">Karbo</span>
                          <span className="text-emerald-400 font-black">{scanResult.carbs}g</span>
                        </div>
                        <div className="bg-white/5 rounded-xl p-2">
                          <span className="block text-[10px] text-neutral-400 font-semibold">Lemak</span>
                          <span className="text-rose-400 font-black">{scanResult.fat}g</span>
                        </div>
                      </div>

                      {/* Meal Type Selection */}
                      <div className="pt-2">
                        <label className="text-[11px] font-bold text-neutral-400 block mb-1.5">Waktu Makan:</label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {(["breakfast", "lunch", "dinner", "snack"] as const).map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setScanMealType(m)}
                              className={`py-1.5 rounded-xl text-[11px] font-bold capitalize transition-all cursor-pointer border ${
                                scanMealType === m
                                  ? "bg-[#D4FF00] text-black border-[#D4FF00]"
                                  : "bg-[#10141D] text-neutral-400 border-neutral-800 hover:text-white"
                              }`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={handleSaveScannedMeal}
                        className="w-full py-3 bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-98"
                      >
                        <Check size={16} strokeWidth={3} />
                        <span>Simpan ke Jurnal Makan Hari Ini</span>
                      </button>
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* CLEAN DOCKED 5-TAB MOBILE NAVIGATION BAR (MOBILE ONLY) */}
      {/* ========================================================================= */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#0C101A]/95 backdrop-blur-2xl border-t border-white/[0.08] px-4 py-2 flex items-center justify-around shadow-[0_-8px_30px_rgba(0,0,0,0.7)] lg:hidden">
        {/* Tab 1: Home */}
        <button
          onClick={() => setActiveTab("home")}
          className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === "home" ? "text-[#D4FF00]" : "text-neutral-400 hover:text-white"
          }`}
        >
          <Home size={20} className={activeTab === "home" ? "stroke-[2.5]" : ""} />
          <span className="text-[10px] font-extrabold tracking-tight">Home</span>
        </button>

        {/* Tab 2: Workouts */}
        <button
          onClick={() => setActiveTab("workouts")}
          className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === "workouts" ? "text-[#D4FF00]" : "text-neutral-400 hover:text-white"
          }`}
        >
          <Dumbbell size={20} className={activeTab === "workouts" ? "stroke-[2.5]" : ""} />
          <span className="text-[10px] font-extrabold tracking-tight">Latihan</span>
        </button>

        {/* Center Elevate Button: Scan */}
        <div className="-mt-7">
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => setShowScanModal(true)}
            className="w-13 h-13 rounded-full bg-[#D4FF00] text-black flex flex-col items-center justify-center shadow-[0_4px_20px_rgba(212,255,0,0.4)] border-3 border-[#0C101A] cursor-pointer"
            title="Scan Foto Makanan AI"
          >
            <Camera size={20} className="stroke-[2.5]" />
          </motion.button>
        </div>

        {/* Tab 4: Progress */}
        <button
          onClick={() => setActiveTab("progress")}
          className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === "progress" ? "text-[#D4FF00]" : "text-neutral-400 hover:text-white"
          }`}
        >
          <TrendingUp size={20} className={activeTab === "progress" ? "stroke-[2.5]" : ""} />
          <span className="text-[10px] font-extrabold tracking-tight">Progres</span>
        </button>

        {/* Tab 5: Profile */}
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === "profile" ? "text-[#D4FF00]" : "text-neutral-400 hover:text-white"
          }`}
        >
          <User size={20} className={activeTab === "profile" ? "stroke-[2.5]" : ""} />
          <span className="text-[10px] font-extrabold tracking-tight">Profil</span>
        </button>
      </nav>

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

      {/* ADD LOG MODAL (AI AUTO-DETECTION) */}
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
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#181B26] to-slate-800 flex items-center justify-center text-[#C4F82A]">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-slate-900">
                      {showAddDrinkModal
                        ? (lang === "EN" ? "Log Drink / Hydration" : "Tambah Log Minuman")
                        : (lang === "EN" ? "AI Smart Food Log" : "Tambah Makanan AI")}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {lang === "EN" ? "AI auto-detects calories & macros" : "AI otomatis menghitung kalori & nutrisi"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowAddFoodModal(false);
                    setShowAddDrinkModal(false);
                    setAiPreview(null);
                    setShowManualInputs(false);
                  }}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>{t.foodNameLabel}</span>
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                      <Sparkles size={10} /> Auto AI Detection
                    </span>
                  </label>
                  <div className="relative mt-1">
                    <input
                      type="text"
                      value={itemNameInput}
                      onChange={(e) => setItemNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !isAnalyzingAi) {
                          handleSaveLogItem();
                        }
                      }}
                      placeholder={showAddDrinkModal ? "misal: Air Putih 500ml, Kopi Susu, Jus Alpukat" : "misal: Nasi Padang Rendang + Teh Obeng"}
                      className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white transition-all shadow-xs"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5 flex items-start gap-1">
                    <span>💡</span>
                    <span>{t.comboHelpText}</span>
                  </p>
                </div>

                {/* AI Loading State */}
                {isAnalyzingAi && (
                  <div className="p-3.5 bg-slate-900 text-white rounded-xl flex items-center justify-center gap-3 animate-pulse">
                    <Sparkles className="animate-spin text-[#C4F82A]" size={18} />
                    <span className="text-xs font-bold text-slate-100">
                      {lang === "EN" ? "AI is calculating calories & macros..." : "🤖 AI sedang mendeteksi kalori & nutrisi..."}
                    </span>
                  </div>
                )}

                {/* AI Preview Result */}
                {aiPreview && !isAnalyzingAi && (
                  <div className="p-3.5 bg-[#C4F82A]/15 border border-[#C4F82A]/40 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900 flex items-center gap-1">
                        <Sparkles size={12} className="text-slate-800" /> Output Nutrisi AI:
                      </span>
                      <span className="text-xs font-black text-[#181B26] bg-[#C4F82A] px-2 py-0.5 rounded-md">
                        {itemCalInput} kcal
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-bold text-slate-700 pt-1">
                      <div className="bg-white/80 rounded-lg p-1 border border-slate-200/50">
                        <span className="block text-[10px] text-slate-400 font-semibold">Protein</span>
                        <span>{itemProteinInput}g</span>
                      </div>
                      <div className="bg-white/80 rounded-lg p-1 border border-slate-200/50">
                        <span className="block text-[10px] text-slate-400 font-semibold">Karbo</span>
                        <span>{itemCarbsInput}g</span>
                      </div>
                      <div className="bg-white/80 rounded-lg p-1 border border-slate-200/50">
                        <span className="block text-[10px] text-slate-400 font-semibold">Lemak</span>
                        <span>{itemFatInput}g</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Optional Manual Inputs Toggle */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowManualInputs(!showManualInputs)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                  >
                    <span>{showManualInputs ? "▲ Sembunyikan Input Manual" : "▼ Edit Nutrisi Manual (Opsional)"}</span>
                  </button>

                  {showManualInputs && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 mt-2"
                    >
                      <div>
                        <label className="text-[11px] font-bold text-slate-700">{t.caloriesInputLabel}</label>
                        <input
                          type="number"
                          value={itemCalInput}
                          onChange={(e) => setItemCalInput(e.target.value)}
                          placeholder="450"
                          className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-slate-900"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700">{t.proteinInputLabel}</label>
                        <input
                          type="number"
                          value={itemProteinInput}
                          onChange={(e) => setItemProteinInput(e.target.value)}
                          placeholder="25"
                          className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-slate-900"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700">{t.carbsInputLabel}</label>
                        <input
                          type="number"
                          value={itemCarbsInput}
                          onChange={(e) => setItemCarbsInput(e.target.value)}
                          placeholder="40"
                          className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-slate-900"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700">{t.fatInputLabel}</label>
                        <input
                          type="number"
                          value={itemFatInput}
                          onChange={(e) => setItemFatInput(e.target.value)}
                          placeholder="12"
                          className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-slate-900"
                        />
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* ── Feature 1: Confirmation Panel ─────────────────────── */}
                {aiConfirmStep && !isAnalyzingAi && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-1 p-4 bg-[#181B26] rounded-2xl space-y-3 border border-[#C4F82A]/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-[#C4F82A] flex items-center gap-1.5">
                        <Sparkles size={12} /> Hasil Deteksi AI — Konfirmasi?
                      </span>
                      <span className="text-[11px] font-black text-white bg-[#C4F82A]/20 border border-[#C4F82A]/30 px-2 py-0.5 rounded-lg">
                        {itemCalInput} kcal
                      </span>
                    </div>

                    {/* Macro summary row */}
                    <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] font-bold">
                      <div className="bg-white/10 rounded-xl py-2">
                        <span className="block text-[10px] text-white/50 font-semibold">Protein</span>
                        <span className="text-white">{itemProteinInput}g</span>
                      </div>
                      <div className="bg-white/10 rounded-xl py-2">
                        <span className="block text-[10px] text-white/50 font-semibold">Karbo</span>
                        <span className="text-white">{itemCarbsInput}g</span>
                      </div>
                      <div className="bg-white/10 rounded-xl py-2">
                        <span className="block text-[10px] text-white/50 font-semibold">Lemak</span>
                        <span className="text-white">{itemFatInput}g</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-white/50 text-center">
                      Nutrisi salah? Gunakan <em>"Edit Nutrisi Manual"</em> di atas lalu simpan.
                    </p>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setAiConfirmStep(false);
                          setShowManualInputs(true);
                        }}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-white/20 text-white/70 hover:bg-white/10 cursor-pointer transition-colors"
                      >
                        ✏️ Edit Nutrisi
                      </button>
                      <button
                        onClick={handleConfirmSave}
                        className="flex-1 py-2.5 rounded-xl text-xs font-black bg-[#C4F82A] text-[#181B26] hover:bg-[#d8ff45] cursor-pointer transition-colors shadow-sm"
                      >
                        ✅ Simpan ke Log
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        setAiConfirmStep(false);
                        setAiPreview(null);
                        setItemNameInput("");
                        setItemCalInput("");
                        setItemProteinInput("");
                        setItemCarbsInput("");
                        setItemFatInput("");
                      }}
                      className="w-full py-2 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors"
                    >
                      ❌ Batal
                    </button>
                  </motion.div>
                )}
                {/* ── End Feature 1 ─────────────────────────────────────── */}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => {
                    setShowAddFoodModal(false);
                    setShowAddDrinkModal(false);
                    setAiPreview(null);
                    setAiConfirmStep(false);
                    setShowManualInputs(false);
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {t.closeModal}
                </button>
                {!aiConfirmStep && (
                  <button
                    onClick={handleAnalyzeAndPreview}
                    disabled={isAnalyzingAi || !itemNameInput.trim()}
                    className="px-5 py-2.5 rounded-xl text-xs font-black bg-[#181B26] text-[#C4F82A] hover:bg-slate-800 disabled:opacity-50 cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    {isAnalyzingAi ? (
                      <>
                        <Sparkles size={14} className="animate-spin" />
                        <span>Mendeteksi...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        <span>{lang === "EN" ? "AI Detect Nutrition" : "Deteksi Nutrisi AI"}</span>
                      </>
                    )}
                  </button>
                )}
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

      {/* ── Coach Next-Step Bubble ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showCoachTip && coachTip && (
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 260 }}
            className="fixed bottom-6 left-4 right-4 z-50 max-w-md mx-auto"
          >
            <div className="bg-[#181B26] border border-[#C4F82A]/30 rounded-2xl shadow-2xl p-4 flex gap-3 items-start">
              {/* Coach avatar badge */}
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#C4F82A]/15 border border-[#C4F82A]/30 flex items-center justify-center text-lg">
                {isMaxPersona ? "🏋️" : "✨"}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black text-[#C4F82A] mb-1 flex items-center gap-1.5">
                  <Sparkles size={10} />
                  {coachName} — Saran Selanjutnya
                </p>
                <p className="text-[12.5px] text-white/85 leading-relaxed font-medium">
                  {coachTip}
                </p>
              </div>

              <button
                onClick={() => setShowCoachTip(false)}
                className="flex-shrink-0 text-white/30 hover:text-white/70 transition-colors cursor-pointer mt-0.5"
              >
                <X size={16} />
              </button>
            </div>

            {/* Progress bar showing auto-dismiss */}
            <motion.div
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 12, ease: "linear" }}
              className="h-0.5 bg-[#C4F82A]/50 rounded-full mt-1 mx-1"
            />
          </motion.div>
        )}
      </AnimatePresence>
      {/* ── End Coach Bubble ────────────────────────────────────────────────── */}

    </div>
  );
}
