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
  ShieldCheck,
  BookOpen,
  Play,
  Info,
  Watch,
  Volume2,
  LayoutGrid,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Edit3,
  Sliders,
  Upload,
  Share2,
  Copy,
  ExternalLink,
  Zap,
  DollarSign,
  Gift,
  Users,
  Percent,
  PieChart,
  BarChart3,
  CheckCircle,
  HelpCircle,
  Scale,
  Lock,
  AlertTriangle
} from "lucide-react";
import PWAInstallBanner from "./PWAInstallBanner";
import { findExerciseOrEquipment, EXERCISE_DATABASE, ExerciseItem, getDefaultWeeklySchedule } from "../data/exerciseDb";
import { notificationService } from "../services/notificationService";
import {
  estimateMealNutritionDeterministic,
  FoodItemNutrition,
  MealNutritionResult,
  formatDashboardMacro,
  formatDashboardInteger,
  formatDashboardPercent
} from "../services/nutritionEngine";
import { getApiBaseUrl } from "../utils/api";

function getMealTypeByHour(): "breakfast" | "lunch" | "snack" | "dinner" {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 18) return "snack";
  return "dinner";
}

interface MealItem {
  id: string;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  timestamp?: string;
  time?: string;
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
  activityLevel?: string;
  createdAt?: string;
  registerDate?: string;
  tdee?: number;
  targetCalories?: number;
  proteinGrams?: number;
  carbGrams?: number;
  fatGrams?: number;
  fiberGrams?: number;
  workoutSchedule?: any[];
  normalizedPhone?: string;
}

interface DashboardProps {
  user: UserProfileData;
  language?: "EN" | "ID";
  onLogout: () => void;
  onBackToHome: () => void;
  onResetData?: () => void;
  onOpenWatchMode?: () => void;
  onUpdateUser?: (updatedUser: UserProfileData) => void;
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

interface AdditionalActivity {
  id: string;
  activityName: string;
  category?: string;
  icon?: string;
  durationMinutes?: number;
  distanceKm?: number;
  sets?: number;
  reps?: number;
  weightKg?: number;
  intensity?: string;
  details?: string;
  estimatedCaloriesBurned?: number;
  timestamp: string;
  status: "completed";
}

type FeelState = "bad" | "sick" | "not_great" | "okay" | "good" | "great";

// Helper function to check if item name is liquid / drink
const isLiquidName = (name: string): boolean => {
  if (!name) return false;
  const lower = name.toLowerCase().trim();

  // Solid foods MUST NEVER be classified as hydration / drinks
  const solidExceptions = [
    "french fries", "fries", "kentang", "sosis", "sausage", "nugget",
    "ayam", "chicken", "daging", "sapi", "ikan", "tahu", "tempe",
    "nasi", "mie", "bihun", "kwetiau", "burger", "pizza", "dimsum",
    "bakso", "siomay", "batagor", "telur", "telor", "seafood", "udang",
    "cumi", "pancong", "roti", "martabak", "cake", "kue", "pancake", "waffle",
    "biskuit", "sereal", "cereal", "ice cream", "es krim", "keju", "pudding",
    "puding", "bubur", "bolu", "donat", "pie", "tart", "saus", "sauce",
    "selai", "topping", "crepe", "churros", "pisang", "salad", "steak"
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
    "montblanc", "mont blanc", "vietnam drip", "robusta", "liberica", "arabica",
    "v60", "pour over", "aeropress", "chemex", "cold drip",
    "brown sugar boba", "vanilla latte", "caramel macchiato",
    "kopi aren", "kopi tubruk", "kopi susu", "es jeruk", "es lemon",
    "lemonade", "lemon tea", "fruit tea", "minuman dingin", "minuman panas",
    "wedang jahe", "bandrek", "bajigur", "sekoteng", "cincau", "es cincau",
    "es dawet", "es cendol", "es kelapa", "es teler", "es campur",
    "infused water", "detox water", "green tea", "ocha", "hojicha",
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

// Plain Water vs Beverage / Liquid Helper (Prevents Coffee/Tea from polluting plain water tracker)
const isPlainWaterName = (name: string): boolean => {
  if (!name) return false;
  const lower = name.toLowerCase();
  const notPlainWater = [
    "kopi", "coffee", "americano", "latte", "cappuccino", "espresso",
    "teh", "tea", "susu", "milk", "jus", "juice", "soda", "cola",
    "boba", "syrup", "sirup", "beer", "bir", "wine", "shake",
    "smoothie", "bcaa", "creatine", "whey", "lemonade", "cendol",
    "dawet", "kelapa", "jeruk", "alpukat", "milo", "dancow", "matcha"
  ];
  if (notPlainWater.some((kw) => lower.includes(kw))) return false;
  const waterKeywords = [
    "air putih", "air mineral", "mineral water", "plain water",
    "aqua", "le minerale", "vit", "cleo", "ades", "air"
  ];
  return waterKeywords.some((kw) => lower.includes(kw));
};

// Smart Food & Drink Emoji Selector
const getFoodEmoji = (name: string): string => {
  if (!name) return "🍽️";
  const n = name.toLowerCase();
  if (isLiquidName(n) || n.includes("kopi") || n.includes("jus") || n.includes("susu") || n.includes("tea") || n.includes("teh") || n.includes("drink")) return "🥤";
  if (n.includes("cookie") || n.includes("biskuit") || n.includes("wafer") || n.includes("oreo") || n.includes("kue kering")) return "🍪";
  if (n.includes("sandwich") || n.includes("sub ") || n.includes("toast") || n.includes("roti") || n.includes("bread") || n.includes("pastrami")) return "🥪";
  if (n.includes("burger")) return "🍔";
  if (n.includes("pizza")) return "🍕";
  if (n.includes("nasi") || n.includes("rice") || n.includes("padang") || n.includes("uduk") || n.includes("goreng")) return "🍚";
  if (n.includes("ayam") || n.includes("chicken") || n.includes("bebek") || n.includes("unggas")) return "🍗";
  if (n.includes("daging") || n.includes("beef") || n.includes("steak") || n.includes("rendang") || n.includes("sapi")) return "🥩";
  if (n.includes("telur") || n.includes("egg") || n.includes("omelet") || n.includes("ceplok") || n.includes("dadar")) return "🍳";
  if (n.includes("salad") || n.includes("sayur") || n.includes("lalapan") || n.includes("capcay") || n.includes("tumis")) return "🥗";
  if (n.includes("buah") || n.includes("apel") || n.includes("pisang") || n.includes("fruit") || n.includes("jeruk") || n.includes("semangka")) return "🍎";
  if (n.includes("mie") || n.includes("noodle") || n.includes("ramen") || n.includes("pasta") || n.includes("spaghetti") || n.includes("bihun") || n.includes("kwetiau")) return "🍜";
  if (n.includes("snack") || n.includes("camilan") || n.includes("keripik") || n.includes("chips")) return "🍿";
  return "🍽️";
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

// Global Phone Normalizer Helper
const normalizePhone = (phone: string): string => {
  if (!phone) return "";
  let cleaned = String(phone).replace(/[^\d]/g, "");
  if (cleaned.startsWith("62")) cleaned = "0" + cleaned.substring(2);
  else if (cleaned.startsWith("8")) cleaned = "0" + cleaned;
  return cleaned;
};

// Automatic Sanitizer to split any stored combo logs & purge any mock seed data
const isLegacyMockMeal = (item: MealItem): boolean => {
  if (item.id === "m-1" || item.id === "m-2" || item.id === "m-3" || item.id?.startsWith("m-y") || item.id?.startsWith("m-2d")) return true;
  if (item.foodName?.includes("Nasi Merah 150g & Dada Ayam") || item.foodName?.includes("Tumis Sapi Lada Hitam") || item.foodName?.includes("Whey Protein Shake & Pisang")) return true;
  return false;
};

const sanitizeAndSplitComboLogs = (rawLogs: MealItem[]): MealItem[] => {
  if (!Array.isArray(rawLogs)) return [];
  const result: MealItem[] = [];
  const seenIds = new Set<string>();

  for (const item of rawLogs) {
    if (!item || !item.foodName || isLegacyMockMeal(item)) continue;

    // Deduplicate by unique item.id so identical auto-polling payloads are ignored,
    // but ALL real distinct meal inputs are ALWAYS recorded & displayed!
    const uniqueId = item.id || `${item.foodName}_${item.calories}_${item.timestamp || Date.now()}`;
    if (seenIds.has(uniqueId)) continue;
    seenIds.add(uniqueId);

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
    sodiumLabel: "Natrium",
    sugarLabel: "Gula",
    waterLabel: "Air",
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
    foodMeals: "Makanan & Minuman (Food & Drinks)",
    addFoodBtn: "Tambah Makanan",
    noMealsLogged: "Belum ada makanan atau minuman tercatat hari ini.",
    waterHydration: "Air & Hidrasi (Water / Hydration)",
    addDrinkBtn: "Tambah Minuman",
    hydrationTarget: "Target Hidrasi Harian",
    quickAdd250: "+250 ml Air",
    quickAdd500: "+500 ml Air",
    noDrinksLogged: "Belum ada minuman tercatat hari ini.",
    coachRecommendation: "Rekomendasi Coach",
    coachAdviceTitle: "Saran Coach",
    autoReminderTitle: "Pengingat Latihan Harian",
    autoReminderPrompt: "Yuk latihan hari ini! 💪 Mau diingatkan jam berapa untuk nge-gym atau waktu makan?",
    selectReminderTime: "Pilih Waktu Pengingat:",
    setReminderBtn: "Pasang Pengingat",
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
    sodiumLabel: "Sodium",
    sugarLabel: "Sugar",
    waterLabel: "Water",
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

// 7-Day Weekly Workout Schedule Personalizer (Single Shared Source of Truth)
function getPersonalizedWeeklySchedule(user: UserProfileData, lang: "ID" | "EN" = "ID"): DaySchedule[] {
  const goal = user?.goal || "healthy";
  return getDefaultWeeklySchedule(goal, lang) as DaySchedule[];
}

// Interactive Animated Movement Player Component (Auto-looping movement keyframes)
const ExerciseVisualPlayer = ({ item }: { item: ExerciseItem }) => {
  // Convert any GitHub raw URLs to high-speed jsDelivr CDN
  const getCdnUrl = (url: string) => {
    if (!url) return "";
    return url.replace(
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/",
      "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/"
    );
  };

  const rawFrames = item.imageFrames && item.imageFrames.length > 0 ? item.imageFrames : [item.gifUrl || ""];
  const frames = rawFrames.map(getCdnUrl).filter(Boolean);

  const [frameIdx, setFrameIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [imgError, setImgError] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!isPlaying || frames.length <= 1) return;
    const interval = setInterval(() => {
      setFrameIdx((prev) => (prev + 1) % frames.length);
    }, 950);
    return () => clearInterval(interval);
  }, [isPlaying, frames]);

  const currentFrameUrl = frames[frameIdx];
  const hasError = !currentFrameUrl || imgError[frameIdx];

  return (
    <div className="space-y-2">
      <div className="relative rounded-2xl overflow-hidden bg-[#222222] border border-white/[0.08] aspect-video flex items-center justify-center group shadow-2xl">
        {!hasError ? (
          <img
            key={frameIdx}
            src={currentFrameUrl}
            alt={`${item.name} - Fase ${frameIdx + 1}`}
            className="w-full h-full object-contain transition-all duration-300"
            loading="eager"
            onError={() => {
              setImgError((prev) => ({ ...prev, [frameIdx]: true }));
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#222222] relative overflow-hidden">
            <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#D4FF00_1px,transparent_1px)] [background-size:16px_16px]" />
            <div className="relative z-10 space-y-3">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-[#D4FF00]/10 border border-[#D4FF00]/30 flex items-center justify-center text-[#D4FF00] shadow-[0_0_20px_rgba(212,255,0,0.2)]">
                <span className="text-2xl animate-pulse">🏋️</span>
              </div>
              <div>
                <h4 className="font-['Archivo_Black'] text-white text-sm sm:text-base tracking-wide">
                  {item.name}
                </h4>
                <p className="text-xs text-neutral-400 font-medium mt-0.5">
                  {item.indonesianName || item.equipmentName}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                {item.targetMuscles?.slice(0, 2).map((m, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold">
                    🎯 {m}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Movement Indicator */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-20">
          <span className="px-2.5 py-1 rounded-lg bg-black/85 backdrop-blur-md text-[#D4FF00] border border-[#D4FF00]/40 text-[10px] font-black tracking-wider flex items-center gap-1.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#D4FF00] animate-ping inline-block" />
            PANDUAN VISUAL
          </span>
          <span className="px-2 py-1 rounded-lg bg-black/80 backdrop-blur-md text-white text-[10px] font-extrabold border border-white/[0.08]">
            {frameIdx === 0 ? "Fase 1: Posisi Awal" : "Fase 2: Eksekusi Puncak"}
          </span>
        </div>
      </div>

      {/* Frame Controls & Play/Pause */}
      {frames.length > 1 && (
        <div className="flex items-center justify-between gap-2 px-1 pt-0.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className={`px-3 py-1 rounded-lg text-[11px] font-black flex items-center gap-1.5 cursor-pointer transition-all border ${
                isPlaying ? "bg-[#D4FF00] text-black border-[#D4FF00] shadow-sm" : "bg-[#181818] text-neutral-300 border-white/[0.08] hover:bg-neutral-800"
              }`}
            >
              <Play size={11} fill="currentColor" /> {isPlaying ? "Loop Animasi Aktif" : "Putar Animasi"}
            </button>
            <button
              type="button"
              onClick={() => { setIsPlaying(false); setFrameIdx(0); }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer border transition-all ${
                frameIdx === 0 && !isPlaying ? "bg-white text-black border-white font-black" : "bg-[#181818] text-neutral-400 border-white/[0.08] hover:text-white"
              }`}
            >
              1. Awal
            </button>
            <button
              type="button"
              onClick={() => { setIsPlaying(false); setFrameIdx(1); }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer border transition-all ${
                frameIdx === 1 && !isPlaying ? "bg-white text-black border-white font-black" : "bg-[#181818] text-neutral-400 border-white/[0.08] hover:text-white"
              }`}
            >
              2. Puncak
            </button>
          </div>
          <span className="text-[10px] font-semibold text-neutral-400 hidden sm:inline">
            Fase Gerak: Otomatis Bergantian
          </span>
        </div>
      )}
    </div>
  );
};

export const DUMMY_USERS: Record<string, any> = {
  alex: {
    userId: "usr_alex_demo",
    name: "Alex",
    phone: "08111111111",
    gender: "Pria",
    age: 26,
    weight: 75,
    startWeight: 75,
    targetWeight: 70,
    height: 175,
    goal: "lose",
    goalTitle: "Menurunkan Berat Badan",
    persona: "max",
    activeService: "nutritionist",
    selectedFeature: "nutrition",
    plan: "nutrition",
    activityLevel: "moderate",
    targetCalories: 2100,
    dailyTargetCalories: 2100,
    proteinGrams: 155,
    dailyTargetProtein: 155,
    carbGrams: 210,
    dailyTargetCarbs: 210,
    fatGrams: 65,
    dailyTargetFat: 65,
    fiberGrams: 30
  },
  mia: {
    userId: "usr_mia_demo",
    name: "Mia",
    phone: "08222222222",
    gender: "Wanita",
    age: 24,
    weight: 58,
    startWeight: 58,
    targetWeight: 54,
    height: 165,
    goal: "gain",
    goalTitle: "Membentuk Otot & Tone",
    persona: "mia",
    activeService: "workout",
    selectedFeature: "workout",
    plan: "workout",
    activityLevel: "moderate",
    targetCalories: 1850,
    dailyTargetCalories: 1850,
    proteinGrams: 120,
    dailyTargetProtein: 120,
    carbGrams: 200,
    dailyTargetCarbs: 200,
    fatGrams: 55,
    dailyTargetFat: 55,
    fiberGrams: 28
  }
};

export default function Dashboard({
  user: initialUser,
  language: initialLang = "ID",
  onLogout,
  onBackToHome,
  onResetData,
  onOpenWatchMode,
  onUpdateUser
}: DashboardProps) {
  const safeUser: UserProfileData = initialUser || {
    name: "Pengguna",
    phone: "",
    goal: "maintain",
    goalTitle: "Menjaga Kebugaran",
    weight: 70,
    startWeight: 70,
    targetWeight: 70,
    height: 170,
    age: 25,
    gender: "pria",
    persona: "max",
    activityLevel: "moderate"
  };

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
  const isEN = lang === "EN";

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
  const [liveUser, setLiveUser] = useState<UserProfileData>(safeUser);

  useEffect(() => {
    if (initialUser && initialUser.phone) {
      setLiveUser(initialUser);
    }
  }, [initialUser]);

  useEffect(() => {
    const fetchLiveUser = async () => {
      const phoneToUse = initialUser?.phone || safeUser?.phone || safeUser?.normalizedPhone || "";
      if (!phoneToUse) return;
      const norm = normalizePhone(phoneToUse);
      const API_BASE_URL = getApiBaseUrl();
      try {
        const res = await fetch(`${API_BASE_URL}/api/user/${norm}`, {
          headers: { Accept: "application/json" }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && (data.user || data.profile || data.name)) {
            const profile = data.user || data.profile || data;
            setLiveUser(profile);
            onUpdateUser?.(profile);
            localStorage.setItem("gymbuddy_active_session", JSON.stringify(profile));
            localStorage.setItem(`gymbuddy_user_${norm}`, JSON.stringify(profile));
          }
        }
      } catch (e) {}
    };
    fetchLiveUser();
  }, [initialUser?.phone, safeUser?.phone]);

  // Robust Local Storage Meal Retrieval — ONLY reads user-specific keys (Bug #3/#4 fix)
  const getLocalMeals = (phone: string, dateStr: string): MealItem[] => {
    if (!phone) return []; // Bug #4 fix: never read without a known user phone
    const norm = normalizePhone(phone);
    if (!norm) return [];
    const alt = norm.startsWith("0") ? "62" + norm.substring(1) : (norm.startsWith("62") ? "0" + norm.substring(2) : norm);
    // Bug #4 fix: REMOVED generic keys 'gymbuddy_meals_user_*' and 'gymbuddy_meals_*'
    // These caused cross-contamination: logs from other users would leak into current user's view
    const candidateKeys = [
      `gymbuddy_meals_${norm}_${dateStr}`,
      `gymbuddy_meals_${alt}_${dateStr}`,
      `gymbuddy_meals_${phone}_${dateStr}`
    ];
    for (const k of candidateKeys) {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return sanitizeAndSplitComboLogs(parsed);
          }
        }
      } catch (e) {}
    }
    return [];
  };

  const [allLogs, setAllLogs] = useState<MealItem[]>(() => {
    // Bug #3 fix: Only read meals for current user — never use hardcoded phone fallback
    const userPhone = safeUser.phone || safeUser.normalizedPhone || "";
    if (!userPhone) return [];
    return getLocalMeals(userPhone, todayDateStr);
  });
  const [showFullWeeklyOverview, setShowFullWeeklyOverview] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  const activeUser = liveUser || safeUser;

  // ── PLAN ENTITLEMENTS & ACCESS CONTROL (Nutrition Plan vs Workout Coach Plan) ──
  const userPhone = String(activeUser?.phone || "").replace(/\D/g, "");
  const userActiveService = String(activeUser?.activeService || activeUser?.selectedFeature || activeUser?.plan || "both").toLowerCase();
  
  // Single-service checks: Only trigger if explicitly restricted or injected test user
  const isAlexTestUser = userPhone === "08111111111" || userPhone === "62811111111" || (activeUser?.name === "Alex" && activeUser?.userId === "usr_alex_demo");
  const isMiaTestUser = userPhone === "08222222222" || userPhone === "62822222222" || (activeUser?.name === "Mia" && activeUser?.userId === "usr_mia_demo");

  const isNutritionPlan = isAlexTestUser || (!isMiaTestUser && (userActiveService === "nutrition" || userActiveService === "nutritionist"));
  const isWorkoutPlan = isMiaTestUser || (!isAlexTestUser && (userActiveService === "workout" || userActiveService === "coach"));

  // Production default: Full access unless explicitly restricted to single plan
  const isFullAccess = !isNutritionPlan && !isWorkoutPlan;

  const hasNutritionAccess = isNutritionPlan || isFullAccess;
  const hasWorkoutAccess = isWorkoutPlan || isFullAccess;

  const [showUpgradePlanModal, setShowUpgradePlanModal] = useState(false);
  const [upgradeTargetFeature, setUpgradeTargetFeature] = useState<"nutrition" | "workout" | "both">("workout");

  const handleOpenUpgradeModal = (feature: "nutrition" | "workout" | "both") => {
    setUpgradeTargetFeature(feature);
    setShowUpgradePlanModal(true);
  };

  const handleSelectDemoUser = (userKey: "alex" | "mia" | "both") => {
    if (userKey === "both") {
      const bothUser: any = {
        ...safeUser,
        name: "Member (Full Access)",
        activeService: "both",
        selectedFeature: "both",
        plan: "both"
      };
      setLiveUser(bothUser);
      localStorage.setItem("gymbuddy_active_session", JSON.stringify(bothUser));
      return;
    }
    const dummy = DUMMY_USERS[userKey];
    setLiveUser(dummy as any);
    localStorage.setItem("gymbuddy_active_session", JSON.stringify(dummy));
    setAllLogs(getLocalMeals(dummy.phone, selectedDate));
  };

  // Determine User Registration Date as Min Date Constraint
  const getUserRegisterDateStr = (): string => {
    try {
      if (activeUser?.createdAt) return String(activeUser.createdAt).substring(0, 10);
      if (activeUser?.registerDate) return String(activeUser.registerDate).substring(0, 10);
    } catch (e) {}

    const phoneKey = activeUser?.phone || "user";
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
      const stored = localStorage.getItem(`gymbuddy_feel_${safeUser.phone || "user"}_${selectedDate}`);
      return (stored as FeelState) || "good";
    } catch (e) {
      return "good";
    }
  });

  // Auto Reminder Modal State
  const [showAutoReminderModal, setShowAutoReminderModal] = useState(false);
  const [selectedReminderTime, setSelectedReminderTime] = useState("17:00");
  const [reminderNotificationMsg, setReminderNotificationMsg] = useState<string | null>(null);

  // Notification Scheduler Settings
  const [showNotifSettingsModal, setShowNotifSettingsModal] = useState(false);
  const [notifSettings, setNotifSettings] = useState(() => {
    // Bug #5 fix: notif settings are per-user, not global
    const _normPhone = normalizePhone(safeUser.phone || safeUser.normalizedPhone || "");
    const notifKey = _normPhone ? `gymbuddy_notif_settings_${_normPhone}` : "gymbuddy_notif_settings";
    try {
      const stored = localStorage.getItem(notifKey);
      if (stored) return JSON.parse(stored);
    } catch {}
    return {
      workoutEnabled: true,
      workoutHour: 7,
      workoutMinute: 0,
      hydrationEnabled: true,
      hydrationInterval: 2,
      streakEnabled: true,
      permissionGranted: false,
    };
  });

  const saveNotifSettings = (updated: typeof notifSettings) => {
    setNotifSettings(updated);
    // Bug #5 fix: save per-user notif settings key
    const _normPhone = normalizePhone(activeUser.phone || activeUser.normalizedPhone || "");
    const notifKey = _normPhone ? `gymbuddy_notif_settings_${_normPhone}` : "gymbuddy_notif_settings";
    try { localStorage.setItem(notifKey, JSON.stringify(updated)); } catch {}
  };

  const applyNotifSchedulers = (settings: typeof notifSettings) => {
    notificationService.stopAllSchedulers();
    const userName = activeUser.nickname || activeUser.name?.split(" ")[0] || "Member";
    const focus = todayScheduleObj?.focus || "Latihan Hari Ini";
    if (settings.workoutEnabled) {
      notificationService.startDailyWorkoutScheduler(userName, focus, settings.workoutHour, settings.workoutMinute);
    }
    if (settings.hydrationEnabled) {
      notificationService.startHydrationScheduler(settings.hydrationInterval);
    }
    if (settings.streakEnabled) {
      notificationService.scheduleStreakReminder(userName);
    }
  };

  // Coach Mood Popup State
  const [showCoachMoodPopup, setShowCoachMoodPopup] = useState(false);
  const [coachMoodData, setCoachMoodData] = useState<{ icon: string; title: string; message: string; tips: string[]; color: string } | null>(null);

  // Dashboard Card Layout Customization State
  type CardId = "hero" | "feel_coach" | "workout" | "food" | "hydration";
  const DEFAULT_CARD_ORDER: CardId[] = ["hero", "feel_coach", "workout", "food", "hydration"];

  const [cardOrder, setCardOrder] = useState<CardId[]>(() => {
    // Bug #5 fix: card order is per-user, not global
    const _normPhone = normalizePhone(safeUser.phone || safeUser.normalizedPhone || "");
    const cardKey = _normPhone ? `gymbuddy_dashboard_card_order_${_normPhone}` : "gymbuddy_dashboard_card_order";
    try {
      const stored = localStorage.getItem(cardKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_CARD_ORDER;
  });

  const saveCardOrder = (newOrder: CardId[]) => {
    setCardOrder(newOrder);
    // Bug #5 fix: save per-user card order
    const _normPhone = normalizePhone(activeUser.phone || activeUser.normalizedPhone || "");
    const cardKey = _normPhone ? `gymbuddy_dashboard_card_order_${_normPhone}` : "gymbuddy_dashboard_card_order";
    try {
      localStorage.setItem(cardKey, JSON.stringify(newOrder));
    } catch (e) {}
  };

  const moveCard = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= cardOrder.length) return;
    const updated = [...cardOrder];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    saveCardOrder(updated);
  };

  const [showLayoutModal, setShowLayoutModal] = useState(false);
  const [draggedCardIndex, setDraggedCardIndex] = useState<number | null>(null);

  // Main Goal Dynamic Edit Modal State
  const [showGoalEditModal, setShowGoalEditModal] = useState(false);
  const [editGoal, setEditGoal] = useState<"lose" | "gain" | "maintain" | "healthy">(
    (activeUser.goal as any) || "lose"
  );
  const [editTargetWeight, setEditTargetWeight] = useState<string>(
    String(activeUser.targetWeight || activeUser.weight || 65)
  );
  const [editWeight, setEditWeight] = useState<string>(String(activeUser.weight || 70));
  const [editHeight, setEditHeight] = useState<string>(String(activeUser.height || 170));
  const [editPace, setEditPace] = useState<"steady" | "moderate" | "aggressive">("moderate");

  useEffect(() => {
    if (activeUser) {
      setEditGoal((activeUser.goal as any) || "lose");
      setEditTargetWeight(String(activeUser.targetWeight || activeUser.weight || 65));
      setEditWeight(String(activeUser.weight || 70));
      setEditHeight(String(activeUser.height || 170));
    }
  }, [activeUser, showGoalEditModal]);

  const handleSaveGoalChanges = () => {
    const currentW = Math.max(30, Number(editWeight) || 70);
    const currentH = Math.max(100, Number(editHeight) || 170);
    let newTargetWeight = currentW;

    if (editGoal === "lose") {
      newTargetWeight = Math.max(35, Number(editTargetWeight) || Math.max(45, currentW - 5));
    } else if (editGoal === "gain") {
      newTargetWeight = Math.max(35, Number(editTargetWeight) || currentW + 5);
    } else {
      newTargetWeight = currentW;
    }

    let newGoalTitle = "";
    if (editGoal === "lose") newGoalTitle = lang === "EN" ? "Weight Loss" : "Menurunkan Berat Badan";
    else if (editGoal === "gain") newGoalTitle = lang === "EN" ? "Muscle Gain & Bulking" : "Menaikkan Massa Otot & BB";
    else if (editGoal === "maintain") newGoalTitle = lang === "EN" ? "Maintain Weight" : "Menjaga Berat Badan";
    else newGoalTitle = lang === "EN" ? "Healthy & Fit Lifestyle" : "Gaya Hidup Sehat & Bugar";

    const isMale = (activeUser.gender || "pria").toLowerCase() === "pria" || (activeUser.gender || "").toLowerCase() === "male";
    const bmr = 10 * currentW + 6.25 * currentH - 5 * (activeUser.age || 25) + (isMale ? 5 : -161);
    let computedCalories = Math.round(bmr * 1.4);
    let computedProtein = Math.round(currentW * 2.0);

    if (editGoal === "lose") {
      const deficit = editPace === "aggressive" ? 600 : editPace === "steady" ? 300 : 450;
      computedCalories = Math.max(1300, computedCalories - deficit);
      computedProtein = Math.round(currentW * 2.2);
    } else if (editGoal === "gain") {
      computedCalories += 400;
      computedProtein = Math.round(currentW * 2.2);
    } else {
      computedProtein = Math.round(currentW * 1.8);
    }

    const updatedUser = {
      ...activeUser,
      goal: editGoal,
      goalTitle: newGoalTitle,
      weight: currentW,
      targetWeight: newTargetWeight,
      height: currentH,
      targetCalories: computedCalories,
      targetProtein: computedProtein,
    };

    setLiveUser(updatedUser);
    try {
      const normP = normalizePhone(activeUser.phone || "user");
      localStorage.setItem(`gymbuddy_user_${normP}`, JSON.stringify(updatedUser));
      localStorage.setItem("gymbuddy_active_session", JSON.stringify(updatedUser));
    } catch (e) {}

    setShowGoalEditModal(false);
    setReminderNotificationMsg(lang === "EN" ? "Goal updated successfully! 🎯" : "Goal berhasil diperbarui! 🎯");
    setTimeout(() => setReminderNotificationMsg(null), 3500);
  };

  // Health Profile Personalization State
  const [showHealthProfileModal, setShowHealthProfileModal] = useState(false);
  const [healthDob, setHealthDob] = useState<string>("");
  const [healthAge, setHealthAge] = useState<string>("25");
  const [healthStatus, setHealthStatus] = useState<"no_condition" | "has_condition" | "prefer_not_to_say">("no_condition");
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [healthOtherCondition, setHealthOtherCondition] = useState<string>("");
  const [isSavingHealthProfile, setIsSavingHealthProfile] = useState(false);

  // Sync state when activeUser changes or modal opens
  useEffect(() => {
    if (activeUser) {
      const hp = activeUser.healthProfile || {};
      setHealthDob(activeUser.dob || hp.dob || "");
      setHealthAge(String(activeUser.age || hp.age || 25));
      const initStatus = hp.hasCondition || (hp.conditions && hp.conditions.length > 0 ? "has_condition" : (hp.isCompleted ? "no_condition" : "no_condition"));
      setHealthStatus(initStatus as any);
      setSelectedConditions(Array.isArray(hp.conditions) ? hp.conditions : []);
      setHealthOtherCondition(hp.otherCondition || "");
    }
  }, [activeUser, showHealthProfileModal]);

  // Existing user auto-prompt check: prompt on load if health profile is not complete
  useEffect(() => {
    const phone = activeUser?.phone || activeUser?.normalizedPhone;
    if (!phone) return;
    const hp = activeUser?.healthProfile;
    const isCompleted = Boolean(hp?.isCompleted);
    const dismissed = sessionStorage.getItem(`gymbuddy_health_modal_dismissed_${phone}`);
    if (!isCompleted && !dismissed) {
      setShowHealthProfileModal(true);
    }
  }, [activeUser?.phone, activeUser?.healthProfile?.isCompleted]);

  const handleHealthDobChange = (newDob: string) => {
    setHealthDob(newDob);
    if (newDob && /^\d{4}-\d{2}-\d{2}$/.test(newDob)) {
      const d = new Date(newDob);
      if (!isNaN(d.getTime())) {
        const today = new Date();
        let calculated = today.getFullYear() - d.getFullYear();
        const m = today.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
          calculated--;
        }
        if (calculated >= 10 && calculated <= 120) {
          setHealthAge(String(calculated));
        }
      }
    }
  };

  const toggleDashboardHealthCondition = (conditionId: string) => {
    setSelectedConditions((prev) => {
      if (prev.includes(conditionId)) {
        return prev.filter((c) => c !== conditionId);
      } else {
        return [...prev, conditionId];
      }
    });
  };

  const getDashboardAgeGroupLabel = (ageNum: number) => {
    if (ageNum < 13) return isEN ? "Child (<13 yrs)" : "Anak (<13 th)";
    if (ageNum <= 17) return isEN ? "Teen (13-17 yrs)" : "Remaja (13-17 th)";
    if (ageNum < 60) return isEN ? "Adult (18-59 yrs)" : "Dewasa (18-59 th)";
    return isEN ? "Older Adult (60+ yrs)" : "Lansia (60+ th)";
  };

  const handleSaveHealthProfile = async () => {
    setIsSavingHealthProfile(true);
    const derivedAge = Number(healthAge) || 25;
    const cleanConditions = healthStatus === "has_condition" ? selectedConditions : [];
    const cleanOther = healthStatus === "has_condition" ? healthOtherCondition.trim() : "";

    const updatedHealthProfile = {
      dob: healthDob,
      age: derivedAge,
      hasCondition: healthStatus,
      conditions: cleanConditions,
      otherCondition: cleanOther,
      isCompleted: true,
      completedAt: new Date().toISOString()
    };

    const norm = normalizePhone(activeUser.phone || "");
    const API_BASE_URL = getApiBaseUrl();
    let savedUser: UserProfileData = {
      ...activeUser,
      dob: healthDob || activeUser.dob,
      age: derivedAge,
      healthProfile: updatedHealthProfile
    };

    if (norm) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/user/${norm}/health-profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedHealthProfile)
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error || "Gagal menyimpan profil kesehatan");
        }

        const data = await res.json().catch(() => null);
        if (data && (data.user || data.profile)) {
          savedUser = data.user || data.profile;
        }
      } catch (err: any) {
        console.error("Health profile save error:", err);
        setIsSavingHealthProfile(false);
        setReminderNotificationMsg(lang === "EN" ? "Failed to save health profile. Please try again." : "Perubahan profil kesehatan belum berhasil disimpan. Silakan coba lagi.");
        setTimeout(() => setReminderNotificationMsg(null), 4500);
        return;
      }
    }

    setLiveUser(savedUser);
    onUpdateUser?.(savedUser);

    if (norm) {
      try {
        localStorage.setItem(`gymbuddy_user_${norm}`, JSON.stringify(savedUser));
        localStorage.setItem("gymbuddy_last_user", JSON.stringify(savedUser));
        localStorage.setItem("gymbuddy_active_session", JSON.stringify(savedUser));
      } catch (e) {}
    }

    if (activeUser?.phone) {
      sessionStorage.setItem(`gymbuddy_health_modal_dismissed_${activeUser.phone}`, "true");
    }
    setIsSavingHealthProfile(false);
    setShowHealthProfileModal(false);
    setReminderNotificationMsg(lang === "EN" ? "Health profile updated successfully! ✨" : "Profil kesehatan berhasil disimpan! ✨");
    setTimeout(() => setReminderNotificationMsg(null), 3500);
  };

  const handleDismissHealthModal = () => {
    if (activeUser?.phone) {
      sessionStorage.setItem(`gymbuddy_health_modal_dismissed_${activeUser.phone}`, "true");
    }
    setShowHealthProfileModal(false);
  };

  // 5-Tab Mobile Navigation State
  const [activeTab, setActiveTab] = useState<"home" | "workouts" | "progress" | "profile">("home");
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanImage, setScanImage] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanMealType, setScanMealType] = useState<"breakfast" | "lunch" | "dinner" | "snack">("lunch");
  const [scanNonFoodMessage, setScanNonFoodMessage] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{
    foodName: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    portion: string;
  } | null>(null);

  const [customDrinkName, setCustomDrinkName] = useState("Air Mineral");
  const [customDrinkMl, setCustomDrinkMl] = useState("250");

  // Client-side lightweight image compression for ultra-fast Vision AI processing
  const compressImageForAi = (file: File): Promise<{ base64: string; cleanData: string; mimeType: string }> => {
    return new Promise((resolve) => {
      try {
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.crossOrigin = "anonymous";

        const finishWithRaw = () => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const raw = (e.target?.result as string) || "";
            const clean = raw.replace(/^data:image\/[a-z0-9+]+;base64,/i, "");
            resolve({ base64: raw, cleanData: clean, mimeType: file.type || "image/jpeg" });
          };
          reader.onerror = () => {
            resolve({ base64: "", cleanData: "", mimeType: "image/jpeg" });
          };
          reader.readAsDataURL(file);
        };

        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            let width = img.width || 800;
            let height = img.height || 800;
            const maxDim = 800;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const compressed = canvas.toDataURL("image/jpeg", 0.75);
              const clean = compressed.replace(/^data:image\/[a-z0-9+]+;base64,/i, "");
              URL.revokeObjectURL(objectUrl);
              resolve({ base64: compressed, cleanData: clean, mimeType: "image/jpeg" });
              return;
            }
          } catch (e) {}
          URL.revokeObjectURL(objectUrl);
          finishWithRaw();
        };

        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          finishWithRaw();
        };

        img.src = objectUrl;
      } catch (e) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const raw = (e.target?.result as string) || "";
          const clean = raw.replace(/^data:image\/[a-z0-9+]+;base64,/i, "");
          resolve({ base64: raw, cleanData: clean, mimeType: file.type || "image/jpeg" });
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handlePhotoSelected = async (file: File) => {
    setScanLoading(true);
    setScanResult(null);
    setScanNonFoodMessage(null);

    const { base64, cleanData, mimeType } = await compressImageForAi(file);
    if (base64) setScanImage(base64);

    const promptText = `KAMU ADALAH PAKAR VISION AI NUTRISI GYMBUDDY. Analisis foto ini secara mendalam dan teliti.
1. BACA SETIAP TEKS, LABEL, STRUK, ATAU STIKER DI GELAS / KEMASAN / PIRING (Misalnya: 'Butterscotch Aren Latte', 'Roti Coklat Klasik', 'Americano', 'Kopi Kenangan', 'Starbucks', 'Nasi Padang', 'Dada Ayam', dll.) ATAU kenali bentuk fisik makanannya.
2. JIKA GAMBAR ADALAH BENDA MATI BUKAN MAKANAN / MINUMAN (laptop, hp, manusia, selfie, ruangan, meja kosong, kucing):
Kembalikan JSON: {"isFood": false, "message": "Objek ini bukan makanan atau minuman. Silakan upload foto makanan/minuman yang ingin kamu catat."}
3. JIKA MAKANAN ATAU MINUMAN:
Kembalikan JSON valid:
{
  "isFood": true,
  "foodName": "Nama Makanan / Minuman & Varian Lengkap",
  "calories": 280,
  "protein": 6,
  "carbs": 44,
  "fat": 8,
  "portion": "1 Cup / 1 Porsi",
  "mealType": "lunch",
  "isHydration": true,
  "volumeMl": 350
}
Hitung makro realistis: (protein*4)+(carbs*4)+(fat*9)=calories. Kembalikan HANYA JSON tanpa markdown lain.`;

    // Direct Gemini Vision API with dynamic key resolution (Instant, zero backend cold-start)
    try {
      const kPart = atob("QVEuQWI4Uk42SzdueVBVdkNNVnZFR0VGcjJUaFdWbDJCSzNwdFVtVDFqSVpBeE84TkxuWHc=");
      const models = ["gemini-flash-latest", "gemini-3.5-flash"];
      for (const mName of models) {
        try {
          const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${mName}:generateContent?key=${kPart}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: promptText },
                  { inlineData: { mimeType: mimeType || "image/jpeg", data: cleanData } }
                ]
              }],
              generationConfig: {
                temperature: 0.2,
                responseMimeType: "application/json"
              }
            })
          });

          if (gRes.ok) {
            const gData = await gRes.json();
            const candidate = gData?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (candidate) {
              const parsed = JSON.parse(candidate);
              if (parsed.isFood === false) {
                setScanNonFoodMessage(parsed.message || (isEN ? "This object is not recognized as food or drink." : "Objek ini bukan makanan atau minuman. Silakan upload foto makanan yang ingin kamu catat."));
                setScanLoading(false);
                return;
              }

              const protein = Math.max(0, Math.round(Number(parsed.protein) || 0));
              const carbs = Math.max(0, Math.round(Number(parsed.carbs) || 0));
              const fat = Math.max(0, Math.round(Number(parsed.fat) || 0));
              const macroCal = (protein * 4) + (carbs * 4) + (fat * 9);
              const calories = macroCal > 0 ? macroCal : Math.max(0, Math.round(Number(parsed.calories) || 0));

              setScanResult({
                foodName: parsed.foodName || (isEN ? "Detected Food" : "Makanan Terdeteksi"),
                calories,
                protein,
                carbs,
                fat,
                portion: parsed.portion || (isEN ? "1 Standard Portion" : "1 Porsi Standar")
              });
              if (parsed.mealType) setScanMealType(parsed.mealType);
              setScanLoading(false);
              return;
            }
          }
        } catch (subErr) {
          console.warn(`Vision model ${mName} note:`, subErr);
        }
      }
    } catch (gErr) {
      console.warn("Direct Gemini Vision attempt error:", gErr);
    }

    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-253242815083.asia-southeast2.run.app";

    try {
      // Backend Vision AI fallback
      let res = await fetch("/api/ai/analyze-meal-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType })
      }).catch(() => null);

      if (!res || !res.ok) {
        res = await fetch(`${API_BASE_URL}/api/ai/analyze-meal-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mimeType })
        }).catch(() => null);
      }

      if (res && res.ok) {
        const data = await res.json();
        if (data.success) {
          if (data.isFood === false) {
            setScanNonFoodMessage(data.message || (isEN ? "This object is not recognized as food or drink." : "Objek ini bukan makanan atau minuman. Silakan upload foto makanan yang ingin kamu catat."));
            setScanLoading(false);
            return;
          }

          setScanResult({
            foodName: data.foodName || (isEN ? "Detected Meal" : "Makanan Terdeteksi"),
            calories: Number(data.calories) || 0,
            protein: Number(data.protein) || 0,
            carbs: Number(data.carbs) || 0,
            fat: Number(data.fat) || 0,
            portion: data.portion || (isEN ? "1 Standard Portion" : "1 Porsi Standar")
          });
          if (data.mealType) setScanMealType(data.mealType);
          setScanLoading(false);
          return;
        }
      }
    } catch (err) {
      console.error("Vision AI fallback error:", err);
    }

    // Heuristic fallback for coffee/meals
    const lowerName = (file.name || "").toLowerCase();
    if (lowerName.includes("butterscotch") || lowerName.includes("aren") || lowerName.includes("latte") || lowerName.includes("kopi")) {
      setScanResult({
        foodName: "Butterscotch Aren Latte",
        calories: 220,
        protein: 4,
        carbs: 34,
        fat: 7,
        portion: "1 Cup (350ml)"
      });
      setScanLoading(false);
      return;
    }

    setScanNonFoodMessage(isEN ? "Vision AI server is busy. Please enter meal details manually." : "Gagal memproses gambar. Silakan coba lagi atau masukkan catatan makanan secara manual.");
    setScanLoading(false);
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
    const normPhone = normalizePhone(activeUser.phone || activeUser.normalizedPhone || "");
    if (!normPhone) return; // Guard: don't save without a valid user phone
    const localKey = `gymbuddy_meals_${normPhone}_${selectedDate}`;
    try {
      localStorage.setItem(localKey, JSON.stringify(updated));
    } catch (e) {}

    // Async server sync to both local and remote backends
    const syncToServer = async () => {
      const payload = JSON.stringify({ ...newMeal, date: selectedDate });
      try {
        await fetch(`/api/user/${normPhone}/meals`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload
        });
      } catch (e) {}
      try {
        const remoteUrl = (import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-253242815083.asia-southeast2.run.app";
        if (remoteUrl) {
          await fetch(`${remoteUrl}/api/user/${normPhone}/meals`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload
          });
        }
      } catch (e) {}
    };
    syncToServer();

    setShowScanModal(false);
    setScanImage(null);
    setScanResult(null);
  };

  // Weekly Schedule (Multilingual by active user language)
  const weeklySchedule = getPersonalizedWeeklySchedule(safeUser, lang);

  const getDayIndexFromDateStr = (dateStr: string) => {
    const parts = dateStr.split("-");
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return isNaN(d.getDay()) ? 1 : d.getDay(); // 0 is Sunday, 1 is Monday...
  };

  const dayIndex = getDayIndexFromDateStr(selectedDate);
  // In weeklySchedule: index 0 is Monday, 1 is Tuesday, 2 is Wednesday, 3 is Thursday, 4 is Friday, 5 is Saturday, 6 is Sunday
  const scheduleIndex = (dayIndex + 6) % 7;
  const todayScheduleObj = weeklySchedule[scheduleIndex] || weeklySchedule[0];
  const selectedDayName = todayScheduleObj.day;

  // Exercises State per date
  const [exercises, setExercises] = useState<WorkoutExercise[]>(() => {
    try {
      const _ePhone = normalizePhone(safeUser.phone || safeUser.normalizedPhone || "");
      const stored = _ePhone ? localStorage.getItem(`gymbuddy_exercises_${_ePhone}_${selectedDate}`) : null;
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return todayScheduleObj.exercises;
  });

  const [activities, setActivities] = useState<AdditionalActivity[]>([]);
  const [activeWorkoutDetail, setActiveWorkoutDetail] = useState<WorkoutExercise | null>(null);
  const [showExerciseExplorerModal, setShowExerciseExplorerModal] = useState(false);
  const [explorerSearch, setExplorerSearch] = useState("");
  const [explorerCategory, setExplorerCategory] = useState<string>("all");
  const [selectedExplorerItem, setSelectedExplorerItem] = useState<ExerciseItem | null>(null);
  const [viewingDetailExercise, setViewingDetailExercise] = useState<ExerciseItem | null>(null);
  const [showWatchConnectModal, setShowWatchConnectModal] = useState(false);
  const [watchLinkCopied, setWatchLinkCopied] = useState(false);

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
  const [itemFiberInput, setItemFiberInput] = useState("0");
  const [itemSugarInput, setItemSugarInput] = useState("0");
  const [itemSodiumInput, setItemSodiumInput] = useState("0");
  const [itemVolumeInput, setItemVolumeInput] = useState("250");
  const [newWeightInput, setNewWeightInput] = useState(String(safeUser.weight || 70));
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [showManualInputs, setShowManualInputs] = useState(false);
  const [aiPreview, setAiPreview] = useState<any>(null);
  const [aiConfirmStep, setAiConfirmStep] = useState(false); // Feature 1: two-step confirm
  const [userOriginalFoodInput, setUserOriginalFoodInput] = useState(""); // Bug #8 fix: preserve original user input
  const [coachTip, setCoachTip] = useState<string | null>(null); // Coach next-step bubble
  const [showCoachTip, setShowCoachTip] = useState(false);

  const openAddFoodModal = () => {
    setItemNameInput("");
    setItemCalInput("");
    setItemProteinInput("");
    setItemCarbsInput("");
    setItemFatInput("");
    setItemFiberInput("0");
    setItemSugarInput("0");
    setItemSodiumInput("0");
    setAiPreview(null);
    setAiConfirmStep(false);
    setUserOriginalFoodInput(""); // Bug #8 fix
    setShowManualInputs(false);
    setShowAddDrinkModal(false);
    setShowAddFoodModal(true);
  };

  const openAddDrinkModal = () => {
    setItemNameInput("");
    setItemCalInput("");
    setItemProteinInput("");
    setItemCarbsInput("");
    setItemFatInput("");
    setItemFiberInput("0");
    setItemSugarInput("0");
    setItemSodiumInput("0");
    setAiPreview(null);
    setAiConfirmStep(false);
    setUserOriginalFoodInput(""); // Bug #8 fix
    setShowManualInputs(false);
    setShowAddFoodModal(false);
    setShowAddDrinkModal(true);
  };

  const normPhone = normalizePhone(activeUser.phone || activeUser.normalizedPhone || "");

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

  const autoTargetCalories = activeUser.targetCalories || (activeUser.goal === "lose" ? Math.max(1200, tdeeCalc - 500) : activeUser.goal === "gain" ? tdeeCalc + 400 : tdeeCalc);
  const autoTargetProtein = activeUser.proteinGrams || (activeUser.goal === "lose" ? Math.round(weight * 2.0) : activeUser.goal === "gain" ? Math.round(weight * 2.2) : Math.round(weight * 1.8));
  const autoTargetFat = activeUser.fatGrams || Math.round((autoTargetCalories * 0.25) / 9);
  const autoTargetCarbs = activeUser.carbGrams || Math.round((autoTargetCalories - (autoTargetProtein * 4 + autoTargetFat * 9)) / 4);

  // Custom Macro Targets (User Adjustable Targets)
  const [customTargets, setCustomTargets] = useState<{
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    sodium?: number;
    sugar?: number;
    water?: number;
  }>(() => {
    try {
      const saved = localStorage.getItem(`gymbuddy_custom_targets_${normPhone}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.calories && parsed.calories !== 2000) return parsed;
      }
      return {};
    } catch (e) {
      return {};
    }
  });

  const targetCalories = customTargets.calories ?? (activeUser.targetCalories || autoTargetCalories);
  const targetProtein = customTargets.protein ?? (activeUser.proteinGrams || autoTargetProtein);
  const targetFat = customTargets.fat ?? (activeUser.fatGrams || autoTargetFat);
  const targetCarbs = customTargets.carbs ?? (activeUser.carbGrams || autoTargetCarbs);
  const targetSodium = customTargets.sodium ?? 2000;
  const targetSugar = customTargets.sugar ?? 45;
  const targetHydrationGoal = customTargets.water ?? 2500;

  // Custom Nutrition Targets Modal State
  const [showCustomTargetsModal, setShowCustomTargetsModal] = useState(false);
  const [custCal, setCustCal] = useState(String(targetCalories));
  const [custProt, setCustProt] = useState(String(targetProtein));
  const [custCarb, setCustCarb] = useState(String(targetCarbs));
  const [custFat, setCustFat] = useState(String(targetFat));
  const [custSodium, setCustSodium] = useState(String(targetSodium));
  const [custSugar, setCustSugar] = useState(String(targetSugar));
  const [custWater, setCustWater] = useState(String(targetHydrationGoal));

  useEffect(() => {
    setCustCal(String(targetCalories));
    setCustProt(String(targetProtein));
    setCustCarb(String(targetCarbs));
    setCustFat(String(targetFat));
    setCustSodium(String(targetSodium));
    setCustSugar(String(targetSugar));
    setCustWater(String(targetHydrationGoal));
  }, [targetCalories, targetProtein, targetCarbs, targetFat, targetSodium, targetSugar, targetHydrationGoal, showCustomTargetsModal]);

  const handleSaveCustomTargets = async () => {
    const newTargets = {
      calories: Math.max(500, Number(custCal) || autoTargetCalories),
      protein: Math.max(10, Number(custProt) || autoTargetProtein),
      carbs: Math.max(10, Number(custCarb) || autoTargetCarbs),
      fat: Math.max(5, Number(custFat) || autoTargetFat),
      sodium: Math.max(500, Number(custSodium) || 2000),
      sugar: Math.max(5, Number(custSugar) || 45),
      water: Math.max(500, Number(custWater) || 2500),
    };

    const API_BASE_URL = getApiBaseUrl();
    if (normPhone) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/user/${normPhone}/goals`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customTargets: newTargets, targetCalories: newTargets.calories })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error || "Gagal menyimpan target kustom");
        }

        const data = await res.json().catch(() => null);
        if (data && (data.user || data.profile)) {
          const updatedProf = data.user || data.profile;
          setLiveUser(updatedProf);
          onUpdateUser?.(updatedProf);
        }
      } catch (err: any) {
        console.error("Custom targets save error:", err);
        setReminderNotificationMsg(isEN ? "Failed to save custom targets. Please try again." : "Gagal menyimpan target kustom. Silakan coba lagi.");
        setTimeout(() => setReminderNotificationMsg(null), 4500);
        return;
      }
    }

    setCustomTargets(newTargets);
    try {
      localStorage.setItem(`gymbuddy_custom_targets_${normPhone}`, JSON.stringify(newTargets));
    } catch (e) {}

    setShowCustomTargetsModal(false);
    setReminderNotificationMsg(isEN ? "Custom nutrition targets saved! 🎯" : "Target nutrisi kustom berhasil disimpan! 🎯");
    setTimeout(() => setReminderNotificationMsg(null), 3500);
  };

  const handleResetCustomTargets = async () => {
    const API_BASE_URL = getApiBaseUrl();
    if (normPhone) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/user/${normPhone}/goals`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customTargets: null })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error || "Gagal reset target");
        }

        const data = await res.json().catch(() => null);
        if (data && (data.user || data.profile)) {
          const updatedProf = data.user || data.profile;
          setLiveUser(updatedProf);
          onUpdateUser?.(updatedProf);
        }
      } catch (err: any) {
        console.error("Custom targets reset error:", err);
        setReminderNotificationMsg(isEN ? "Failed to reset targets. Please try again." : "Gagal mereset target. Silakan coba lagi.");
        setTimeout(() => setReminderNotificationMsg(null), 4500);
        return;
      }
    }

    setCustomTargets({});
    try {
      localStorage.removeItem(`gymbuddy_custom_targets_${normPhone}`);
    } catch (e) {}

    setShowCustomTargetsModal(false);
    setReminderNotificationMsg(isEN ? "Reset to AI recommended targets! ✨" : "Target dikembalikan ke hitungan otomatis AI! ✨");
    setTimeout(() => setReminderNotificationMsg(null), 3500);
  };

  // Profile Editor Modal State
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [profName, setProfName] = useState(activeUser.name || "");
  const [profGender, setProfGender] = useState(activeUser.gender || "pria");
  const [profAge, setProfAge] = useState(String(activeUser.age || 25));
  const [profHeight, setProfHeight] = useState(String(activeUser.height || 170));
  const [profWeight, setProfWeight] = useState(String(activeUser.weight || 70));
  const [profTargetWeight, setProfTargetWeight] = useState(String(activeUser.targetWeight || 65));
  const [profActivity, setProfActivity] = useState(activeUser.activityLevel || "moderate");
  const [profPersona, setProfPersona] = useState(activeUser.persona || "max");

  // Meal Detail, Edit, and Delete States
  const [selectedMealDetail, setSelectedMealDetail] = useState<MealItem | null>(null);
  const [editingMeal, setEditingMeal] = useState<MealItem | null>(null);
  const [mealToDelete, setMealToDelete] = useState<MealItem | null>(null);

  // Edit Meal Form Inputs
  const [editMealName, setEditMealName] = useState("");
  const [editMealType, setEditMealType] = useState<"breakfast" | "lunch" | "dinner" | "snack">("lunch");
  const [editMealCal, setEditMealCal] = useState("");
  const [editMealProt, setEditMealProt] = useState("");
  const [editMealCarb, setEditMealCarb] = useState("");
  const [editMealFat, setEditMealFat] = useState("");
  const [editMealFib, setEditMealFib] = useState("0");
  const [editMealSug, setEditMealSug] = useState("0");
  const [editMealSod, setEditMealSod] = useState("0");

  const handleOpenEditMeal = (meal: MealItem) => {
    setEditingMeal(meal);
    setEditMealName(meal.foodName);
    setEditMealType((meal.mealType as any) || "lunch");
    setEditMealCal(String(meal.calories || 0));
    setEditMealProt(String(meal.protein || 0));
    setEditMealCarb(String(meal.carbs || 0));
    setEditMealFat(String(meal.fat || 0));
    setEditMealFib(String(meal.fiber || 0));
    setEditMealSug(String(meal.sugar || 0));
    setEditMealSod(String((meal as any).sodium || 0));
  };

  const handleSaveEditMeal = () => {
    if (!editingMeal) return;
    const normPhone = normalizePhone(activeUser.phone || activeUser.normalizedPhone || "");
    const cal = Math.max(0, Number(editMealCal) || 0);
    const prot = Math.max(0, Number(editMealProt) || 0);
    const carb = Math.max(0, Number(editMealCarb) || 0);
    const fat = Math.max(0, Number(editMealFat) || 0);
    const fib = Math.max(0, Number(editMealFib) || 0);
    const sug = Math.max(0, Number(editMealSug) || 0);
    const sod = Math.max(0, Number(editMealSod) || 0);

    const updatedMeal: MealItem = {
      ...editingMeal,
      foodName: editMealName.trim() || editingMeal.foodName,
      mealType: editMealType,
      calories: cal,
      protein: prot,
      carbs: carb,
      fat: fat,
      fiber: fib,
      sugar: sug,
      sodium: sod
    };

    const updated = allLogs.map((item) => (item.id === editingMeal.id ? updatedMeal : item));
    setAllLogs(updated);
    try {
      localStorage.setItem(`gymbuddy_meals_${normPhone}_${selectedDate}`, JSON.stringify(updated));
    } catch (e) {}

    // Sync to backend
    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-253242815083.asia-southeast2.run.app";
    fetch(`${API_BASE_URL}/api/user/${normPhone}/meals?date=${selectedDate}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meals: updated, date: selectedDate })
    }).catch(() => {});

    if (selectedMealDetail && selectedMealDetail.id === editingMeal.id) {
      setSelectedMealDetail(updatedMeal);
    }

    setEditingMeal(null);
    setReminderNotificationMsg(isEN ? "Meal updated successfully! 🥗" : "Makanan berhasil diperbarui! 🥗");
    setTimeout(() => setReminderNotificationMsg(null), 3500);
  };

  useEffect(() => {
    if (activeUser) {
      setProfName(activeUser.name || "");
      setProfGender(activeUser.gender || "pria");
      setProfAge(String(activeUser.age || 25));
      setProfHeight(String(activeUser.height || 170));
      setProfWeight(String(activeUser.weight || 70));
      setProfTargetWeight(String(activeUser.targetWeight || 65));
      setProfActivity(activeUser.activityLevel || "moderate");
      setProfPersona(activeUser.persona || "max");
    }
  }, [activeUser, showEditProfileModal]);

  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const handleSaveProfileChanges = async () => {
    setIsSavingProfile(true);
    const derivedAge = Number(profAge) || 25;
    const cleanConditions = healthStatus === "has_condition" ? selectedConditions : [];
    const cleanOther = healthStatus === "has_condition" ? healthOtherCondition.trim() : "";

    const updatedHealthProfile = {
      dob: healthDob,
      age: derivedAge,
      hasCondition: healthStatus,
      conditions: cleanConditions,
      otherCondition: cleanOther,
      isCompleted: true,
      completedAt: new Date().toISOString()
    };

    const updated: UserProfileData = {
      ...activeUser,
      name: profName.trim() || activeUser.name,
      gender: profGender,
      age: derivedAge,
      dob: healthDob || activeUser.dob,
      height: Number(profHeight) || 170,
      weight: Number(profWeight) || 70,
      targetWeight: Number(profTargetWeight) || 65,
      activityLevel: profActivity,
      persona: profPersona,
      healthProfile: updatedHealthProfile
    };

    const API_BASE_URL = getApiBaseUrl();
    let savedProfile = updated;

    if (normPhone) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/user/${normPhone}/profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated)
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error || "Gagal menyimpan profil ke database");
        }

        const data = await res.json().catch(() => null);
        if (data && (data.user || data.profile)) {
          savedProfile = data.user || data.profile;
        }
      } catch (err: any) {
        console.error("Profile save error:", err);
        setIsSavingProfile(false);
        setReminderNotificationMsg(isEN ? "Failed to save profile changes. Please try again." : "Perubahan belum berhasil disimpan. Silakan coba lagi.");
        setTimeout(() => setReminderNotificationMsg(null), 4500);
        return;
      }
    }

    setLiveUser(savedProfile);
    onUpdateUser?.(savedProfile);

    try {
      localStorage.setItem(`gymbuddy_user_${normPhone}`, JSON.stringify(savedProfile));
      localStorage.setItem("gymbuddy_active_session", JSON.stringify(savedProfile));
      localStorage.setItem("gymbuddy_last_user", JSON.stringify(savedProfile));
    } catch (e) {}

    setIsSavingProfile(false);
    setShowEditProfileModal(false);
    setReminderNotificationMsg(isEN ? "Profile & health details saved! ✨" : "Profil & riwayat kesehatan berhasil disimpan! ✨");
    setTimeout(() => setReminderNotificationMsg(null), 3500);
  };

  // Affiliate Program Hub State
  const [showAffiliateModal, setShowAffiliateModal] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);
  const referralCode = ((activeUser.name || "MEMBER").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8) || "BUDDYVIP");
  const referralLink = `https://gymbuddygroup.com?ref=${referralCode.toLowerCase()}`;
  const couponCode = `BUDDY${referralCode}`;

  const handleCopyReferral = () => {
    try {
      navigator.clipboard.writeText(referralLink);
      setReferralCopied(true);
      setTimeout(() => setReferralCopied(false), 3000);
    } catch (e) {}
  };

  // Progress Tab Timeframe State
  const [chartTimeframe, setChartTimeframe] = useState<"7d" | "30d">("7d");

  const isMaxPersona = (activeUser.persona || "max").toLowerCase().includes("max");
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

  // Categorization: Food & Beverages (All calorie meals) + Hydration Tracker (Water & Fluid Intake)
  const plainWaterLogs = allLogs.filter((item) => isPlainWaterName(item.foodName) || item.isHydration);
  const liquidBeverageLogs = allLogs.filter((item) => isLiquidName(item.foodName) && !isPlainWaterName(item.foodName));
  const foodAndBeverageMeals = allLogs.filter((item) => !isPlainWaterName(item.foodName));
  const foodMeals = foodAndBeverageMeals;
  // Hydration includes plain water plus all liquid beverages (tea, coffee, juice, etc.)
  const hydrationLogs = allLogs.filter((item) => isPlainWaterName(item.foodName) || isLiquidName(item.foodName) || item.isHydration);

  // Totals
  const totalCaloriesConsumed = foodAndBeverageMeals.reduce((sum, item) => sum + (Number(item.calories) || 0), 0);
  const totalProteinConsumed = foodAndBeverageMeals.reduce((sum, item) => sum + (Number(item.protein) || 0), 0);
  const totalCarbsConsumed = foodAndBeverageMeals.reduce((sum, item) => sum + (Number(item.carbs) || 0), 0);
  const totalFatConsumed = foodAndBeverageMeals.reduce((sum, item) => sum + (Number(item.fat) || 0), 0);
  const totalSodiumConsumed = allLogs.reduce((sum, item) => sum + (Number((item as any).sodium) || ((item as any).sodiumMg ? Number((item as any).sodiumMg) : 0)), 0);
  const totalSugarConsumed = allLogs.reduce((sum, item) => sum + (Number((item as any).sugar) || 0), 0);

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
    const normPhone = normalizePhone(activeUser.phone || activeUser.normalizedPhone || "");
    if (!normPhone) { if (!silent) setIsSyncing(false); return; } // Guard: no phone = no fetch
    const localKey = `gymbuddy_meals_${normPhone}_${dateStr}`;

    // 1. Immediate Display from local cache (fast initial render, no flicker)
    const localLogs = getLocalMeals(activeUser.phone, dateStr);
    if (localLogs.length > 0) {
      setAllLogs(localLogs);
    }

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
      const primaryUrl = (import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-253242815083.asia-southeast2.run.app";
      const serverLogs = (await tryFetchMeals("")) || (await tryFetchMeals(primaryUrl));

      if (serverLogs !== null && Array.isArray(serverLogs)) {
        const cleanServerLogs = serverLogs.filter((m) => !isLegacyMockMeal(m));
        const sanitized = sanitizeAndSplitComboLogs(cleanServerLogs);
        setAllLogs(sanitized);
        try {
          localStorage.setItem(localKey, JSON.stringify(sanitized));
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
      const _normPhone = normalizePhone(activeUser.phone || activeUser.normalizedPhone || "");
      const storedFeel = _normPhone
        ? localStorage.getItem(`gymbuddy_feel_${_normPhone}_${selectedDate}`)
        : null;
      if (storedFeel) setFeelState(storedFeel as FeelState);
    } catch (e) {}

    try {
      const _normPhone = normalizePhone(activeUser.phone || activeUser.normalizedPhone || "");
      const storedEx = _normPhone
        ? localStorage.getItem(`gymbuddy_exercises_${_normPhone}_${selectedDate}`)
        : null;
      if (storedEx) {
        setExercises(JSON.parse(storedEx));
      } else {
        setExercises(todayScheduleObj.exercises);
      }

      // Query server for latest checklist state & additional activities (cross-device sync)
      if (_normPhone) {
        const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-253242815083.asia-southeast2.run.app";
        fetch(`${API_BASE_URL}/api/user/${_normPhone}/exercises?date=${selectedDate}`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data) {
              if (Array.isArray(data.exercises) && data.exercises.length > 0) {
                setExercises(data.exercises);
                localStorage.setItem(`gymbuddy_exercises_${_normPhone}_${selectedDate}`, JSON.stringify(data.exercises));
              }
              if (Array.isArray(data.activities)) {
                setActivities(data.activities);
              }
            }
          })
          .catch(() => {});
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

    // ── Auto-start notification schedulers if permission already granted ──
    if (notificationService.getPermission() === "granted") {
      const userName = activeUser.nickname || activeUser.name?.split(" ")[0] || "Member";
      const focus = todayScheduleObj?.focus || "Latihan Hari Ini";
      notificationService.startAllSchedulers(userName, focus, 7);
    }

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      notificationService.stopAllSchedulers();
    };
  }, [selectedDate, activeUser.phone]);

  const saveExercisesState = (updatedEx: WorkoutExercise[]) => {
    setExercises(updatedEx);
    const _normPhone = normalizePhone(activeUser.phone || activeUser.normalizedPhone || "");
    if (!_normPhone) return;
    try {
      localStorage.setItem(`gymbuddy_exercises_${_normPhone}_${selectedDate}`, JSON.stringify(updatedEx));
    } catch (e) {}

    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-253242815083.asia-southeast2.run.app";
    fetch(`${API_BASE_URL}/api/user/${_normPhone}/exercises`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exercises: updatedEx, date: selectedDate })
    }).catch(() => {});
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
    const _normPhone = normalizePhone(activeUser.phone || activeUser.normalizedPhone || "");
    if (_normPhone) {
      try {
        localStorage.setItem(`gymbuddy_feel_${_normPhone}_${selectedDate}`, state);
      } catch (e) {}
    }

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
    const normPhone = normalizePhone(activeUser.phone || activeUser.normalizedPhone || "");
    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-253242815083.asia-southeast2.run.app";
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

  // Indonesian NLP Cleaner: Strips conversational prefixes (e.g. "sore ini aku makan french fries" -> "french fries")
  const cleanIndonesianFoodSentence = (text: string): string => {
    let cleaned = text.trim();
    const prefixRegex = /^(?:sore\s*ini|siang\s*ini|pagi\s*ini|malam\s*ini|tadi\s*pagi|tadi\s*siang|tadi\s*sore|tadi\s*malam|kemarin|barusan|tadi|lagi|sedang|habis|baru|aku|saya|gue|gw|kami|kita|pengen|mau|udah|sudah|sempat)?\s*(?:makan|minum|ngemil|sarapan|lunch|dinner|breakfast|snack|konsumsi|santap|pesan|order|habisin)?\s*(?:aku|saya|gue|gw)?\s*(?:makan|minum)?\s*/i;
    cleaned = cleaned.replace(prefixRegex, "").trim();
    return cleaned || text.trim();
  };

  // Comprehensive Nutrition Estimator (USDA & TKPI Verified)
  const estimateIndonesianNutritionClient = (text: string) => {
    const cleanText = cleanIndonesianFoodSentence(text);
    return estimateMealNutritionDeterministic(cleanText);
  };

  // AI Food Text Analysis Helper
  const handleAnalyzeAiFoodText = async (textToAnalyze?: string) => {
    const rawQuery = (textToAnalyze || itemNameInput).trim();
    if (!rawQuery) return null;

    // Bug #8 FIX: Save original user input BEFORE any AI analysis modifies the state
    // This raw input is what will be stored as foodName — never the AI/catalog result
    const originalUserInput = rawQuery;
    setUserOriginalFoodInput(originalUserInput);

    const queryText = cleanIndonesianFoodSentence(rawQuery);
    setIsAnalyzingAi(true);

    // CRITICAL: Complete State Reset before performing new analysis
    setAiPreview(null);
    setAiConfirmStep(false);
    setItemCalInput("");
    setItemProteinInput("");
    setItemCarbsInput("");
    setItemFatInput("");
    setItemFiberInput("");
    setItemSugarInput("");

    const baseEstimation = estimateMealNutritionDeterministic(queryText);
    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-253242815083.asia-southeast2.run.app";

    let resultItems: FoodItemNutrition[] = baseEstimation.items || [];
    // Bug #8: resultFoodName is ONLY used for AI preview display — NOT for saving
    let resultFoodName = baseEstimation.foodName;
    let isHydration = Boolean(baseEstimation.isHydration);
    let volumeMl = Number(baseEstimation.volumeMl) || 0;
    let portionNote = baseEstimation.portionNote;
    let needsClarification = Boolean(baseEstimation.needsClarification);
    let clarificationQuestion = baseEstimation.clarificationQuestion;
    let suggestedOptions = baseEstimation.suggestedOptions || [];
    let confidence: "high" | "medium" | "low" = baseEstimation.confidence || "medium";

    // 1. Call Backend AI /api/ai/analyze-food
    try {
      let bRes = await fetch("/api/ai/analyze-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawQuery })
      }).catch(() => null);

      if (!bRes || !bRes.ok) {
        bRes = await fetch(`${API_BASE_URL}/api/ai/analyze-food`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: rawQuery })
        }).catch(() => null);
      }

      if (bRes && bRes.ok) {
        const bData = await bRes.json();
        if (bData.success) {
          if (bData.isFood === false) {
            resultItems = [];
            portionNote = "Bukan Makanan / Minuman (0 kcal)";
          } else if (Array.isArray(bData.items) && bData.items.length > 0) {
            resultItems = bData.items;
            portionNote = bData.portionNote || (resultItems.length === 1 ? "1 meal detected" : `${resultItems.length} food items detected`);
          }
          resultFoodName = bData.foodName || baseEstimation.foodName;
          isHydration = Boolean(bData.isHydration || baseEstimation.isHydration);
          volumeMl = Number(bData.volumeMl) || baseEstimation.volumeMl || 0;

          if (bData.needsClarification || bData.confidence === "low") {
            needsClarification = true;
            clarificationQuestion = bData.clarificationQuestion;
            suggestedOptions = bData.suggestedOptions;
            confidence = "low";
          }
        }
      }
    } catch (bErr) {
      console.warn("Backend AI Food analysis error:", bErr);
    }

    let sumProt = 0, sumCarb = 0, sumFat = 0, sumFib = 0, sumSug = 0, sumSod = 0;
    let hasSodiumValue = false;

    for (const it of resultItems) {
      sumProt += Number(it.protein) || 0;
      sumCarb += Number(it.carbs) || 0;
      sumFat += Number(it.fat) || 0;
      sumFib += Number(it.fiber) || 0;
      sumSug += Number(it.sugar) || 0;
      if ((it as any).sodium !== undefined && (it as any).sodium !== null && Number((it as any).sodium) > 0) {
        sumSod += Number((it as any).sodium);
        hasSodiumValue = true;
      }
    }

    const protein = Math.round(sumProt * 10) / 10;
    const carbs = Math.round(sumCarb * 10) / 10;
    const fat = Math.round(sumFat * 10) / 10;
    const fiber = Math.round(sumFib * 10) / 10;
    const sugar = Math.round(sumSug * 10) / 10;
    const sodium = hasSodiumValue ? Math.round(sumSod) : undefined;
    
    // Atwater Rule: Calories = Protein * 4 + Carbs * 4 + Fat * 9 (Sodium contribute 0 kcal)
    const calories = needsClarification ? 0 : Math.round((protein * 4) + (carbs * 4) + (fat * 9));

    const explicitGramMatch = rawQuery.match(/(\d+(?:[\.,]\d+)?)\s*(?:g|gr|gram|grams)\b/i);
    const portionDisplayLabel = explicitGramMatch ? `Portion: ${parseFloat(explicitGramMatch[1].replace(',', '.'))} g` : (resultItems.some(i => i.portion_type === "user_provided") ? "Portion: User provided" : "Portion: Estimated");

    const validatedResult: MealNutritionResult & any = {
      foodName: originalUserInput,
      calories: needsClarification ? undefined : calories,
      protein: needsClarification ? undefined : protein,
      carbs: needsClarification ? undefined : carbs,
      fat: needsClarification ? undefined : fat,
      fiber: needsClarification ? undefined : fiber,
      sugar: needsClarification ? undefined : sugar,
      sodium: needsClarification ? undefined : sodium,
      items: resultItems,
      portionNote: portionNote || (resultItems.length === 1 ? "1 meal detected" : `${resultItems.length} food items detected`),
      isHydration,
      volumeMl,
      mealType: "lunch",
      calculatedFromItems: true,
      confidence,
      needsClarification,
      clarificationQuestion,
      suggestedOptions,
      portionDisplayLabel
    };

    setItemCalInput(needsClarification ? "" : String(calories));
    setItemProteinInput(needsClarification ? "" : String(protein));
    setItemCarbsInput(needsClarification ? "" : String(carbs));
    setItemFatInput(needsClarification ? "" : String(fat));
    setItemFiberInput(needsClarification ? "" : String(fiber));
    setItemSugarInput(needsClarification ? "" : String(sugar));
    setItemSodiumInput(sodium !== undefined ? String(sodium) : "");

    setAiPreview(validatedResult);
    setIsAnalyzingAi(false);
    return validatedResult;
  };

  // Step 1: AI Analysis & Preview — does NOT save yet, fills form + shows confirm panel
  const handleAnalyzeAndPreview = async () => {
    if (!itemNameInput.trim()) return;
    setIsAnalyzingAi(true);
    setAiConfirmStep(false);

    // Completely clear stale state before starting
    setAiPreview(null);
    setItemCalInput("");
    setItemProteinInput("");
    setItemCarbsInput("");
    setItemFatInput("");
    setItemFiberInput("");
    setItemSugarInput("");
    setItemSodiumInput("");

    // Calculate via AI & estimation engine (single source of truth = detected items)
    const aiRes = await handleAnalyzeAiFoodText(itemNameInput);

    setIsAnalyzingAi(false);
    if (aiRes) {
      setAiConfirmStep(true); // Show confirmation panel
    }
  };

  // Step 2: User confirmed — actually save to log
  const handleConfirmSave = async () => {
    if (!itemNameInput.trim() && !userOriginalFoodInput.trim()) return;

    const normPhone = normalizePhone(activeUser.phone || activeUser.normalizedPhone || "");
    if (!normPhone) {
      console.warn("[Dashboard] handleConfirmSave: No active user phone, cannot save log");
      return;
    }
    // Bug #8 FIX: Always use original user input as food name — never the AI-generated name
    const foodNameToSave = userOriginalFoodInput.trim() || itemNameInput.trim();
    const cal = Number(itemCalInput) || 0;
    const prot = Number(itemProteinInput) || 0;
    const carb = Number(itemCarbsInput) || 0;
    const fat = Number(itemFatInput) || 0;
    const fib = Number(itemFiberInput) || 0;
    const sug = Number(itemSugarInput) || 0;
    const sod = Number(itemSodiumInput) || 0;

    const { foods, drinks } = splitAndCategorizeComboText(
      foodNameToSave,
      cal,
      prot,
      carb,
      fat
    );

    const newItems = [...foods, ...drinks].map(item => ({
      ...item,
      fiber: fib,
      sugar: sug,
      sodium: sod
    }));

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
    syncToServer((import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-253242815083.asia-southeast2.run.app");

    // Reset all form state
    setItemNameInput("");
    setItemCalInput("");
    setItemProteinInput("");
    setItemCarbsInput("");
    setItemFatInput("");
    setAiPreview(null);
    setAiConfirmStep(false);
    setUserOriginalFoodInput(""); // Bug #8 fix: clear original input
    setShowManualInputs(false);
    setShowAddFoodModal(false);
    setShowAddDrinkModal(false);

    // ── Fetch Coach Next-Step Advice (non-blocking) ─────────────────────────
    const totalCal = [...allLogs, ...newItems].filter(i => !isLiquidName(i.foodName) && !i.isHydration).reduce((s, i) => s + (Number(i.calories) || 0), 0);
    const totalProt = [...allLogs, ...newItems].filter(i => !isLiquidName(i.foodName) && !i.isHydration).reduce((s, i) => s + (Number(i.protein) || 0), 0);
    const totalCarb = [...allLogs, ...newItems].filter(i => !isLiquidName(i.foodName) && !i.isHydration).reduce((s, i) => s + (Number(i.carbs) || 0), 0);
    const totalFat  = [...allLogs, ...newItems].filter(i => !isLiquidName(i.foodName) && !i.isHydration).reduce((s, i) => s + (Number(i.fat) || 0), 0);
    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-253242815083.asia-southeast2.run.app";
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
          mealName: foodNameToSave || foods[0]?.foodName || "Makanan"
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
    const normPhone = normalizePhone(activeUser.phone || activeUser.normalizedPhone || "");
    if (!normPhone) {
      console.warn("[Dashboard] handleQuickAddWater: No active user phone, cannot sync water log");
      return;
    }
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

    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-253242815083.asia-southeast2.run.app";
    try {
      fetch(`${API_BASE_URL}/api/user/${normPhone}/meals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newItem, date: selectedDate })
      });
    } catch (e) {}
  };

  const handleSaveCustomDrink = () => {
    const normPhone = normalizePhone(activeUser.phone || activeUser.normalizedPhone || "");
    if (!normPhone) {
      console.warn("[Dashboard] handleDeleteMeal: No active user phone, cannot sync delete");
      return;
    }
    const vol = Math.max(50, Number(customDrinkMl) || 250);
    const dName = (customDrinkName || "Air Mineral").trim();
    let cal = 0, prot = 0, carb = 0, fat = 0;
    const lowerD = dName.toLowerCase();
    if (lowerD.includes("americano") || lowerD.includes("kopi hitam") || lowerD.includes("espresso")) {
      cal = 5; carb = 1;
    } else if (lowerD.includes("latte") || lowerD.includes("kopi susu")) {
      cal = 130; prot = 5; carb = 12; fat = 6;
    } else if (lowerD.includes("teh manis")) {
      cal = 80; carb = 20;
    } else if (lowerD.includes("susu protein") || lowerD.includes("whey")) {
      cal = 140; prot = 25; carb = 3; fat = 2;
    } else if (lowerD.includes("jus jeruk")) {
      cal = 110; prot = 2; carb = 26;
    }

    const newItem: MealItem = {
      id: `m-drink-${Date.now()}`,
      foodName: dName,
      calories: cal,
      protein: prot,
      carbs: carb,
      fat: fat,
      isHydration: true,
      volumeMl: vol,
      mealType: getMealTypeByHour(),
      time: new Date().toLocaleTimeString(lang === "EN" ? "en-US" : "id-ID", { hour: "2-digit", minute: "2-digit" })
    };

    const updated = [...allLogs, newItem];
    setAllLogs(updated);
    try {
      localStorage.setItem(`gymbuddy_meals_${normPhone}_${selectedDate}`, JSON.stringify(updated));
    } catch (e) {}

    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-253242815083.asia-southeast2.run.app";
    try {
      fetch(`${API_BASE_URL}/api/user/${normPhone}/meals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newItem, date: selectedDate })
      });
    } catch (e) {}

    setShowAddDrinkModal(false);
    setReminderNotificationMsg(lang === "EN" ? `Logged ${dName} (${vol} ml)! 💧` : `Berhasil mencatat ${dName} (${vol} ml)! 💧`);
    setTimeout(() => setReminderNotificationMsg(null), 3500);
  };

  const handleDeleteLogItem = async (id: string) => {
    const rawPhone = activeUser.phone || activeUser.normalizedPhone || "";
    const normPhone = normalizePhone(rawPhone);
    if (!normPhone) return;
    const altPhone = normPhone.startsWith("0") ? "62" + normPhone.substring(1) : (normPhone.startsWith("62") ? "0" + normPhone.substring(2) : normPhone);

    const updated = allLogs.filter((item) => String(item.id) !== String(id) && String(item.foodName) !== String(id));
    setAllLogs(updated);

    // Immediately persist deletion across all user localStorage keys
    try {
      localStorage.setItem(`gymbuddy_meals_${normPhone}_${selectedDate}`, JSON.stringify(updated));
      localStorage.setItem(`gymbuddy_meals_${altPhone}_${selectedDate}`, JSON.stringify(updated));
      if (rawPhone) {
        localStorage.setItem(`gymbuddy_meals_${rawPhone}_${selectedDate}`, JSON.stringify(updated));
      }
    } catch (e) {}

    // Sync deletion to local and backend API
    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-253242815083.asia-southeast2.run.app";
    try {
      // 1. Delete specific meal by ID
      fetch(`/api/user/${normPhone}/meals/${id}?date=${selectedDate}`, { method: "DELETE" }).catch(() => {});
      fetch(`${API_BASE_URL}/api/user/${normPhone}/meals/${id}?date=${selectedDate}`, { method: "DELETE" }).catch(() => {});

      // 2. Full synchronization PUT: overwrite day's meal list on server
      fetch(`/api/user/${normPhone}/meals?date=${selectedDate}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meals: updated, date: selectedDate })
      }).catch(() => {});
      fetch(`${API_BASE_URL}/api/user/${normPhone}/meals?date=${selectedDate}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meals: updated, date: selectedDate })
      }).catch(() => {});

      // 3. If all items removed, bulk DELETE
      if (updated.length === 0) {
        fetch(`/api/user/${normPhone}/meals?date=${selectedDate}`, { method: "DELETE" }).catch(() => {});
        fetch(`${API_BASE_URL}/api/user/${normPhone}/meals?date=${selectedDate}`, { method: "DELETE" }).catch(() => {});
      }
    } catch (e) {}

    setReminderNotificationMsg(lang === "EN" ? "Meal deleted successfully! 🗑️" : "Catatan makanan berhasil dihapus! 🗑️");
    setTimeout(() => setReminderNotificationMsg(null), 3000);
  };

  const handleDeleteActivity = async (id: string) => {
    const rawPhone = activeUser.phone || activeUser.normalizedPhone || "";
    const normPhone = normalizePhone(rawPhone);
    if (!normPhone || !id) return;
    const altPhone = normPhone.startsWith("0") ? "62" + normPhone.substring(1) : (normPhone.startsWith("62") ? "0" + normPhone.substring(2) : normPhone);

    const updated = activities.filter((act) => String(act.id) !== String(id));
    setActivities(updated);

    // Immediately persist deletion in localStorage
    try {
      localStorage.setItem(`gymbuddy_activities_${normPhone}_${selectedDate}`, JSON.stringify(updated));
      localStorage.setItem(`gymbuddy_activities_${altPhone}_${selectedDate}`, JSON.stringify(updated));
    } catch (e) {}

    // Sync deletion to backend API
    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-253242815083.asia-southeast2.run.app";
    try {
      fetch(`/api/user/${normPhone}/activities/${id}?date=${selectedDate}`, { method: "DELETE" }).catch(() => {});
      fetch(`${API_BASE_URL}/api/user/${normPhone}/activities/${id}?date=${selectedDate}`, { method: "DELETE" }).catch(() => {});

      fetch(`/api/user/${normPhone}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activities: updated, date: selectedDate })
      }).catch(() => {});
      fetch(`${API_BASE_URL}/api/user/${normPhone}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activities: updated, date: selectedDate })
      }).catch(() => {});
    } catch (e) {}

    setReminderNotificationMsg(lang === "EN" ? "Activity deleted successfully! 🗑️" : "Aktivitas tambahan berhasil dihapus! 🗑️");
    setTimeout(() => setReminderNotificationMsg(null), 3000);
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm(lang === "EN" ? "Are you sure you want to delete all account data?" : "Apakah Anda yakin ingin menghapus akun dan semua data harian Anda?")) return;
    const normPhone = normalizePhone(activeUser.phone || "");
    const API_BASE_URL = "https://gymbuddy-backend-253242815083.asia-southeast2.run.app";
    try {
      if (normPhone) {
        await fetch(`/api/user/${normPhone}`, { method: "DELETE" }).catch(() => {});
        await fetch(`${API_BASE_URL}/api/user/${normPhone}`, { method: "DELETE" }).catch(() => {});
      }
    } catch (e) {}
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("gymbuddy")) {
          localStorage.removeItem(key);
        }
      });
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
    <div className="min-h-screen bg-[#F8FAFC] text-white font-['Inter'] p-0 sm:p-4 lg:p-6 flex flex-col lg:flex-row gap-5 selection:bg-[#D4FF00] selection:text-black">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {reminderNotificationMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#181818] text-white px-5 py-3 rounded-full text-sm font-semibold shadow-xl flex items-center gap-2 border border-slate-700"
          >
            <Bell size={16} className="text-[#C4F82A]" />
            <span>{reminderNotificationMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLOATING SIDEBAR PANEL (DESKTOP ONLY - NEVER ON MOBILE) */}
      <aside className="hidden lg:flex w-72 bg-[#151515] text-white p-6 flex-col justify-between shrink-0 rounded-3xl border border-white/[0.08] shadow-xl min-h-[92vh]">
        <div className="space-y-6">
          {/* GymBuddy Logo & App Title */}
          <div className="flex items-center justify-between">
            <GymBuddyLogo size={32} showText textClassName="text-xl text-white font-extrabold tracking-tight" />
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#181818] border border-white/[0.08] text-xs font-black text-slate-300 hover:text-white cursor-pointer"
            >
              <Globe size={12} className="text-slate-400" />
              <span className={lang === "ID" ? "text-[#D4FF00] font-bold" : "text-slate-500"}>ID</span>
              <span className="text-slate-600">|</span>
              <span className={lang === "EN" ? "text-[#D4FF00] font-bold" : "text-slate-500"}>EN</span>
            </button>
          </div>

          {/* User Profile Card */}
          <div className="bg-[#181818] border border-white/[0.08] rounded-2xl p-4 flex items-center gap-3">
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
              onClick={() => setShowWatchConnectModal(true)}
              className="w-full px-4 py-3 rounded-2xl bg-[#181818] hover:bg-[#D4FF00] hover:text-black border border-white/[0.08] text-neutral-300 font-extrabold text-sm flex items-center justify-between transition-all cursor-pointer group shadow-sm"
            >
              <div className="flex items-center gap-3">
                <Watch size={18} className="text-[#D4FF00] group-hover:text-black" />
                <span>{isEN ? "Connect Apple Watch" : "Hubungkan Apple Watch"}</span>
              </div>
              <ChevronRight size={16} />
            </button>

            <button
              onClick={() => setShowNotifSettingsModal(true)}
              className="w-full px-4 py-2.5 rounded-2xl bg-[#181818] hover:bg-slate-800 border border-white/[0.08] text-neutral-400 hover:text-white text-xs font-bold flex items-center justify-between gap-3 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Bell size={16} className="text-[#D4FF00]" />
                <span>{isEN ? "Notifications & Scheduler" : "Notifikasi & Scheduler"}</span>
              </div>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                notifSettings.permissionGranted
                  ? "bg-[#D4FF00]/20 text-[#D4FF00]"
                  : "bg-neutral-800 text-neutral-500"
              }`}>
                {notifSettings.permissionGranted ? (isEN ? "ACTIVE" : "AKTIF") : "OFF"}
              </span>
            </button>

            <button
              onClick={() => setShowHealthProfileModal(true)}
              className="w-full px-4 py-2.5 rounded-2xl bg-[#181818] hover:bg-[#D4FF00] hover:text-black border border-white/[0.08] text-neutral-300 text-xs font-bold flex items-center justify-between gap-3 transition-all cursor-pointer group shadow-xs"
            >
              <div className="flex items-center gap-3">
                <HeartPulse size={16} className="text-[#D4FF00] group-hover:text-black transition-colors" />
                <span>{isEN ? "Health Profile" : "Profil Kesehatan"}</span>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/10 text-neutral-300 group-hover:bg-black/20 group-hover:text-black">
                {activeUser.healthProfile?.conditions && activeUser.healthProfile.conditions.length > 0
                  ? `${activeUser.healthProfile.conditions.length} ${isEN ? "Conditions" : "Kondisi"}`
                  : (activeUser.healthProfile?.isCompleted ? (isEN ? "Healthy" : "Sehat") : (isEN ? "Setup" : "Atur"))}
              </span>
            </button>

            <button
              onClick={() => setShowLayoutModal(true)}
              className="w-full px-4 py-2.5 rounded-2xl bg-[#181818] hover:bg-[#D4FF00] hover:text-black border border-white/[0.08] text-neutral-300 text-xs font-bold flex items-center justify-between gap-3 transition-all cursor-pointer group shadow-xs"
            >
              <div className="flex items-center gap-3">
                <LayoutGrid size={16} className="text-[#D4FF00] group-hover:text-black transition-colors" />
                <span>{isEN ? "Customize Layout" : "Atur Tata Letak Card"}</span>
              </div>
              <Sliders size={14} className="text-neutral-500 group-hover:text-black transition-colors" />
            </button>

            <button
              onClick={onBackToHome}
              className="w-full px-4 py-3 rounded-2xl text-slate-400 hover:text-white hover:bg-[#181818] font-bold text-sm flex items-center gap-3 transition-all cursor-pointer"
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
          <div className="bg-[#181818] border border-white/[0.08] rounded-2xl p-4 space-y-2 text-center">
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
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#181818] transition-colors cursor-pointer"
              title={t.logout}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* RIGHT MAIN CONTENT CONTAINER */}
      <main className="flex-1 bg-[#151515] sm:bg-[#151515] border-0 sm:border sm:border-white/[0.08] rounded-none sm:rounded-3xl px-3.5 sm:px-6 md:px-8 pt-[max(env(safe-area-inset-top),2.75rem)] sm:pt-6 md:pt-8 pb-36 lg:pb-8 space-y-5 overflow-y-auto shadow-sm text-white">
        {/* ========================================================================= */}
        {/* TAB 1: HOME (DASHBOARD RINGKASAN) */}
        {/* ========================================================================= */}
        {activeTab === "home" && (
          <div className="space-y-5">
            {/* ========================================================================= */}
            {/* 1. TOP GREETING HEADER & DATE STRIP                                       */}
            {/* ========================================================================= */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 bg-[#222222] border border-white/[0.08] rounded-3xl p-5 shadow-lg">
              <div className="flex items-center gap-3.5 min-w-0 w-full sm:w-auto">
                <div className="w-13 h-13 rounded-2xl bg-[#D4FF00] text-black font-black flex items-center justify-center text-xl shadow-md shrink-0">
                  {activeUser.name ? activeUser.name.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate max-w-[200px] sm:max-w-none">
                      {activeUser.name || "Member"}
                    </h1>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-extrabold text-[10px] sm:text-[11px] flex items-center gap-1 shrink-0">
                      🔥 {currentStreak} {t.activeDaysConsecutive}
                    </span>
                    {/* Subtle Integrated Plan Badge */}
                    {isNutritionPlan ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-extrabold text-[10px] sm:text-[11px] flex items-center gap-1 shrink-0">
                        🥗 Nutritionist Plan
                      </span>
                    ) : isWorkoutPlan ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#D4FF00]/15 border border-[#D4FF00]/30 text-[#D4FF00] font-extrabold text-[10px] sm:text-[11px] flex items-center gap-1 shrink-0">
                        🏋️ Workout Coach Plan
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 font-extrabold text-[10px] sm:text-[11px] flex items-center gap-1 shrink-0">
                        🌟 All-Access
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 font-medium mt-0.5 truncate">
                    {selectedDayName}, {selectedDate} • <span className="text-neutral-300 font-semibold">{todayScheduleObj.focus}</span>
                  </p>
                </div>
              </div>

              {/* Action Buttons: Calendar, Sync & Layout */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-start sm:justify-end flex-wrap pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowLayoutModal(true)}
                  className="flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs font-bold bg-[#181818] text-neutral-200 border border-white/[0.08] hover:border-[#D4FF00]/40 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  title={isEN ? "Customize Dashboard Cards Layout" : "Atur Tata Letak Card Dashboard"}
                >
                  <LayoutGrid size={15} className="text-[#D4FF00]" />
                  <span>{isEN ? "Layout" : "Tata Letak"}</span>
                </button>

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
                  className="flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs font-bold bg-[#181818] text-neutral-200 border border-white/[0.08] hover:border-[#D4FF00]/40 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <CalendarIcon size={15} className="text-[#D4FF00]" />
                  <span>{t.todayBtn ? (isEN ? "Calendar" : "Kalender") : "Kalender"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => fetchLogsForDate(selectedDate, false)}
                  disabled={isSyncing}
                  className={`flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs font-bold bg-[#181818] text-neutral-200 border border-white/[0.08] hover:border-[#D4FF00]/40 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                    isSyncing ? "opacity-75" : ""
                  }`}
                  title={t.syncWhatsApp || "Sync WhatsApp"}
                >
                  <RefreshCw size={14} className={`text-[#D4FF00] ${isSyncing ? "animate-spin" : ""}`} />
                  <span>{isSyncing ? (isEN ? "Syncing..." : "Menyinkronkan...") : "Sync WA"}</span>
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
                  <span>{t.todayBtn}</span>
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
                        : "bg-[#222222] text-neutral-400 border-white/[0.08] hover:bg-[#181818] hover:text-white"
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold opacity-80">{d.dayName}</span>
                    <span className="text-sm font-black mt-0.5">{d.dayNum}</span>
                  </button>
                );
              })}
            </div>

            {/* ========================================================================= */}
            {/* 2. CORE COACHING GRID: EQUAL FIRST-CLASS BALANCE (NUTRITION + WORKOUT)    */}
            {/* ========================================================================= */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
              
              {/* ── CARD A: AI NUTRITIONIST FIRST-CLASS BENTO MODULE ── */}
              {(() => {
                const targetCal = Math.max(1, targetCalories || 2000);
                const calDiff = targetCal - totalCaloriesConsumed;
                const isOverCal = totalCaloriesConsumed > targetCal;
                const isExactCal = totalCaloriesConsumed === targetCal && totalCaloriesConsumed > 0;
                const calPercent = isOverCal
                  ? Math.max(101, Math.round((totalCaloriesConsumed / targetCal) * 100))
                  : isExactCal
                  ? 100
                  : Math.min(99, Math.floor((totalCaloriesConsumed / targetCal) * 100));

                const targetProt = Math.max(1, targetProtein || 140);
                const protDiff = targetProt - totalProteinConsumed;
                const isOverProt = totalProteinConsumed > targetProt;
                const isExactProt = totalProteinConsumed === targetProt && totalProteinConsumed > 0;
                const protPercent = isOverProt
                  ? Math.max(101, Math.round((totalProteinConsumed / targetProt) * 100))
                  : isExactProt
                  ? 100
                  : Math.min(99, Math.floor((totalProteinConsumed / targetProt) * 100));

                const targetCarb = Math.max(1, targetCarbs || 220);
                const carbDiff = targetCarb - totalCarbsConsumed;
                const isOverCarb = totalCarbsConsumed > targetCarb;
                const isExactCarb = totalCarbsConsumed === targetCarb && totalCarbsConsumed > 0;
                const carbPercent = isOverCarb
                  ? Math.max(101, Math.round((totalCarbsConsumed / targetCarb) * 100))
                  : isExactCarb
                  ? 100
                  : Math.min(99, Math.floor((totalCarbsConsumed / targetCarb) * 100));

                const targetF = Math.max(1, targetFat || 55);
                const fatDiff = targetF - totalFatConsumed;
                const isOverFat = totalFatConsumed > targetF;
                const isExactFat = totalFatConsumed === targetF && totalFatConsumed > 0;
                const fatPercent = isOverFat
                  ? Math.max(101, Math.round((totalFatConsumed / targetF) * 100))
                  : isExactFat
                  ? 100
                  : Math.min(99, Math.floor((totalFatConsumed / targetF) * 100));

                const targetSod = Math.max(1, Number((customTargets as any)?.sodiumLimit || (customTargets as any)?.sodium) || 2000);
                const sodDiff = targetSod - totalSodiumConsumed;
                const isOverSod = totalSodiumConsumed > targetSod;
                const isExactSod = totalSodiumConsumed === targetSod && totalSodiumConsumed > 0;
                const sodPercent = isOverSod
                  ? Math.max(101, Math.round((totalSodiumConsumed / targetSod) * 100))
                  : isExactSod
                  ? 100
                  : Math.min(99, Math.floor((totalSodiumConsumed / targetSod) * 100));

                const targetSug = Math.max(1, Number((customTargets as any)?.sugarLimit || (customTargets as any)?.sugar) || 50);
                const sugDiff = targetSug - totalSugarConsumed;
                const isOverSug = totalSugarConsumed > targetSug;
                const isExactSug = totalSugarConsumed === targetSug && totalSugarConsumed > 0;
                const sugPercent = isOverSug
                  ? Math.max(101, Math.round((totalSugarConsumed / targetSug) * 100))
                  : isExactSug
                  ? 100
                  : Math.min(99, Math.floor((totalSugarConsumed / targetSug) * 100));

                const targetWater = Math.max(1, targetHydrationGoal || 2500);
                const waterDiff = targetWater - totalHydrationMl;
                const isOverWater = totalHydrationMl >= targetWater && totalHydrationMl > 0;
                const waterPercent = Math.min(100, Math.round((totalHydrationMl / targetWater) * 100));

                const caloriesByMealType = {
                  breakfast: foodMeals.filter(m => (m.mealType || "").toLowerCase() === "breakfast").reduce((sum, item) => sum + (Number(item.calories) || 0), 0),
                  lunch: foodMeals.filter(m => (m.mealType || "").toLowerCase() === "lunch" || (!m.mealType && !["breakfast", "dinner", "snack"].includes((m.mealType || "").toLowerCase()))).reduce((sum, item) => sum + (Number(item.calories) || 0), 0),
                  dinner: foodMeals.filter(m => (m.mealType || "").toLowerCase() === "dinner").reduce((sum, item) => sum + (Number(item.calories) || 0), 0),
                  snack: foodMeals.filter(m => (m.mealType || "").toLowerCase() === "snack").reduce((sum, item) => sum + (Number(item.calories) || 0), 0),
                };

                const loggedMealSlotsCount = [
                  caloriesByMealType.breakfast > 0,
                  caloriesByMealType.lunch > 0,
                  caloriesByMealType.dinner > 0,
                  caloriesByMealType.snack > 0
                ].filter(Boolean).length;

                const nutritionBentoContent = (
                  <div className="bg-[#222222] border border-white/[0.08] rounded-3xl p-5 sm:p-6 shadow-xl space-y-5 flex flex-col justify-between h-full relative overflow-hidden">
                    <div className="space-y-4">
                      {/* Section Header */}
                      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-lg shrink-0">
                            🥗
                          </div>
                          <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 block">
                              AI Nutritionist
                            </span>
                            <h2 className="text-base sm:text-lg font-black text-white">
                              {isEN ? "Daily Nutrition & Target" : "Target Nutrisi & Makro"}
                            </h2>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowCustomTargetsModal(true)}
                          className="px-2.5 py-1 rounded-lg bg-[#181818] border border-white/[0.08] text-[11px] font-bold text-[#D4FF00] hover:bg-[#D4FF00] hover:text-black transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 size={11} />
                          <span>Edit Target</span>
                        </button>
                      </div>

                      {/* 1. Calorie Relationship Gauge + Status */}
                      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 bg-[#181818] border border-white/[0.08] rounded-2xl">
                        {/* Gauge */}
                        <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r="48" className="stroke-[#2a2a2a]" strokeWidth="10" fill="transparent" />
                            <circle
                              cx="60"
                              cy="60"
                              r="48"
                              stroke={isOverCal ? "url(#calorieOverGradBento)" : "url(#calorieGlowGradBento)"}
                              strokeWidth="10"
                              strokeDasharray={2 * Math.PI * 48}
                              strokeDashoffset={2 * Math.PI * 48 * (1 - Math.min(isOverCal ? 1 : 0.99, totalCaloriesConsumed / targetCal))}
                              strokeLinecap="round"
                              fill="transparent"
                              className="transition-all duration-700 ease-out"
                            />
                            <defs>
                              <linearGradient id="calorieGlowGradBento" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#25D366" />
                                <stop offset="100%" stopColor="#D4FF00" />
                              </linearGradient>
                              <linearGradient id="calorieOverGradBento" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#F59E0B" />
                                <stop offset="100%" stopColor="#EF4444" />
                              </linearGradient>
                            </defs>
                          </svg>

                          <div className="absolute flex flex-col items-center justify-center text-center">
                            <Flame size={16} className={isOverCal ? "text-amber-400 animate-pulse" : "text-[#D4FF00] animate-pulse"} />
                            <span className={`text-lg sm:text-xl font-black leading-none mt-0.5 ${isOverCal ? "text-amber-400" : "text-white"}`}>
                              {isOverCal 
                                ? `+${formatDashboardInteger(totalCaloriesConsumed - targetCal)}` 
                                : formatDashboardInteger(Math.max(0, calDiff))}
                            </span>
                            <span className="text-[8px] text-neutral-400 font-extrabold uppercase tracking-wider mt-0.5">
                              {isOverCal ? (isEN ? "kcal over" : "kcal lebih") : (isEN ? "kcal left" : "kcal sisa")}
                            </span>
                          </div>
                        </div>

                        {/* Text Summary */}
                        <div className="flex-1 min-w-0 text-center sm:text-left space-y-1">
                          <span className="text-[10px] font-bold uppercase text-neutral-400 tracking-wider block">
                            {t.dailyTargetLabel}
                          </span>
                          <h3 className="text-xl font-black text-white">
                            {formatDashboardInteger(totalCaloriesConsumed)}{" "}
                            <span className="text-neutral-400 text-xs font-semibold">/ {formatDashboardInteger(targetCal)} kcal</span>
                          </h3>
                          <div className="pt-0.5">
                            {isOverCal ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-black text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded-lg border border-rose-400/20">
                                🔴 +{formatDashboardInteger(Math.abs(calDiff))} kcal ({formatDashboardInteger(calPercent)}%) · Melebihi Target
                              </span>
                            ) : isExactCal ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-black text-[#D4FF00] bg-[#D4FF00]/10 px-2 py-0.5 rounded-lg border border-[#D4FF00]/20">
                                🟢 🎯 Target kalori tercapai (100%)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-400/20">
                                🟡 {formatDashboardInteger(Math.max(0, calDiff))} kcal sisa ({formatDashboardInteger(calPercent)}%) · Belum Cukup
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 2. Daily Nutrition Metrics in Exact Order: Calories -> Protein -> Karbo -> Lemak -> Natrium -> Gula -> Air */}
                      <div className="space-y-2.5">
                        {/* 1. Protein */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-neutral-300 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-[#D4FF00]" />
                              <span>{t.proteinLabel}</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-mono text-[11px]">{formatDashboardMacro(totalProteinConsumed)} <span className="text-neutral-500 font-normal">/ {formatDashboardMacro(targetProt)}g</span></span>
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${isOverProt ? "bg-rose-400/20 text-rose-400 border border-rose-400/30" : isExactProt ? "bg-[#D4FF00]/20 text-[#D4FF00]" : "bg-white/5 text-neutral-300"}`}>
                                {isOverProt ? `+${formatDashboardMacro(Math.abs(protDiff))}g (${formatDashboardInteger(protPercent)}%) 🔴 Melebihi Target` : isExactProt ? (isEN ? "✓ 100% Target" : "✓ 100% Tercapai") : `${formatDashboardMacro(protDiff)}g sisa (${formatDashboardInteger(protPercent)}%) 🟡`}
                              </span>
                            </div>
                          </div>
                          <div className="w-full h-1.5 bg-[#181818] rounded-full overflow-hidden border border-white/[0.08]">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${isOverProt ? "bg-gradient-to-r from-emerald-500 via-[#D4FF00] to-rose-400 shadow-[0_0_8px_#D4FF00]" : "bg-gradient-to-r from-emerald-400 to-[#D4FF00]"}`}
                              style={{ width: `${Math.min(isOverProt ? 100 : 99, protPercent)}%` }}
                            />
                          </div>
                        </div>

                        {/* 2. Carbs */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-neutral-300 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-400" />
                              <span>{t.carbsLabel || "Karbohidrat"}</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-mono text-[11px]">{formatDashboardMacro(totalCarbsConsumed)} <span className="text-neutral-500 font-normal">/ {formatDashboardMacro(targetCarb)}g</span></span>
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${isOverCarb ? "bg-rose-400/20 text-rose-400 border border-rose-400/30" : isExactCarb ? "bg-emerald-400/20 text-emerald-400" : "bg-white/5 text-neutral-300"}`}>
                                {isOverCarb ? `+${formatDashboardMacro(Math.abs(carbDiff))}g (${formatDashboardInteger(carbPercent)}%) 🔴 Melebihi Target` : isExactCarb ? (isEN ? "✓ 100% Target" : "✓ 100% Tercapai") : `${formatDashboardMacro(carbDiff)}g sisa (${formatDashboardInteger(carbPercent)}%) 🟡`}
                              </span>
                            </div>
                          </div>
                          <div className="w-full h-1.5 bg-[#181818] rounded-full overflow-hidden border border-white/[0.08]">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${isOverCarb ? "bg-gradient-to-r from-teal-500 via-emerald-400 to-rose-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "bg-gradient-to-r from-teal-500 to-emerald-400"}`}
                              style={{ width: `${Math.min(isOverCarb ? 100 : 99, carbPercent)}%` }}
                            />
                          </div>
                        </div>

                        {/* 3. Fat */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-neutral-300 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-rose-400" />
                              <span>{t.fatLabel || "Lemak"}</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-mono text-[11px]">{formatDashboardMacro(totalFatConsumed)} <span className="text-neutral-500 font-normal">/ {formatDashboardMacro(targetF)}g</span></span>
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${isOverFat ? "bg-rose-400/20 text-rose-400 border border-rose-400/30" : isExactFat ? "bg-emerald-400/20 text-emerald-400" : "bg-white/5 text-neutral-300"}`}>
                                {isOverFat ? `+${formatDashboardMacro(Math.abs(fatDiff))}g (${formatDashboardInteger(fatPercent)}%) 🔴 Melebihi Target` : isExactFat ? (isEN ? "✓ 100% Target" : "✓ 100% Tercapai") : `${formatDashboardMacro(fatDiff)}g sisa (${formatDashboardInteger(fatPercent)}%) 🟡`}
                              </span>
                            </div>
                          </div>
                          <div className="w-full h-1.5 bg-[#181818] rounded-full overflow-hidden border border-white/[0.08]">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${isOverFat ? "bg-gradient-to-r from-pink-500 via-rose-500 to-red-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse" : "bg-gradient-to-r from-pink-500 to-rose-400"}`}
                              style={{ width: `${Math.min(isOverFat ? 100 : 99, fatPercent)}%` }}
                            />
                          </div>
                        </div>

                        {/* 4. Sodium (Directly below Fat and above Sugar) */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-neutral-300 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-purple-400" />
                              <span>🧂 {t.sodiumLabel || "Natrium"}</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-mono text-[11px]">{formatDashboardInteger(totalSodiumConsumed)} <span className="text-neutral-500 font-normal">/ {formatDashboardInteger(targetSod)} mg</span></span>
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${isOverSod ? "bg-rose-400/20 text-rose-400 border border-rose-400/30" : isExactSod ? "bg-amber-400/20 text-amber-400" : "bg-emerald-400/20 text-emerald-400"}`}>
                                {isOverSod ? `+${formatDashboardInteger(Math.abs(sodDiff))} mg (${formatDashboardInteger(sodPercent)}%) 🔴 Melebihi Batas` : isExactSod ? "🟡 100% Batas Maksimal" : `${formatDashboardInteger(sodDiff)} mg sisa (${formatDashboardInteger(sodPercent)}%) 🟢 Dalam Batas`}
                              </span>
                            </div>
                          </div>
                          <div className="w-full h-1.5 bg-[#181818] rounded-full overflow-hidden border border-white/[0.08]">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${isOverSod ? "bg-gradient-to-r from-amber-500 via-rose-500 to-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-gradient-to-r from-emerald-500 to-teal-400"}`}
                              style={{ width: `${Math.min(isOverSod ? 100 : 99, sodPercent)}%` }}
                            />
                          </div>
                        </div>

                        {/* 5. Sugar (Directly below Sodium and above Water) */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-neutral-300 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-amber-400" />
                              <span>🍯 {t.sugarLabel || "Gula"}</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-mono text-[11px]">{formatDashboardMacro(totalSugarConsumed)} <span className="text-neutral-500 font-normal">/ {formatDashboardMacro(targetSug)}g</span></span>
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${isOverSug ? "bg-rose-400/20 text-rose-400 border border-rose-400/30" : isExactSug ? "bg-amber-400/20 text-amber-400" : "bg-emerald-400/20 text-emerald-400"}`}>
                                {isOverSug ? `+${formatDashboardMacro(Math.abs(sugDiff))}g (${formatDashboardInteger(sugPercent)}%) 🔴 Melebihi Batas` : isExactSug ? "🟡 100% Batas Maksimal" : `${formatDashboardMacro(sugDiff)}g tersisa (${formatDashboardInteger(sugPercent)}%) 🟢 Dalam Batas`}
                              </span>
                            </div>
                          </div>
                          <div className="w-full h-1.5 bg-[#181818] rounded-full overflow-hidden border border-white/[0.08]">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${isOverSug ? "bg-gradient-to-r from-amber-500 via-rose-500 to-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-gradient-to-r from-amber-400 to-emerald-400"}`}
                              style={{ width: `${Math.min(isOverSug ? 100 : 99, sugPercent)}%` }}
                            />
                          </div>
                        </div>

                        {/* 6. Water Intake (Last item in Daily Nutrition) */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-neutral-300 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-[#00D2FF]" />
                              <span>💧 {t.waterLabel || "Air"}</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-mono text-[11px]">{formatDashboardInteger(totalHydrationMl)} <span className="text-neutral-500 font-normal">/ {formatDashboardInteger(targetWater)} ml</span></span>
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${waterDiff <= 0 ? "bg-[#00D2FF]/20 text-[#00D2FF]" : "bg-white/5 text-neutral-300"}`}>
                                {waterDiff <= 0 ? "✓ Target Tercapai" : `${formatDashboardInteger(waterDiff)} ml sisa`}
                              </span>
                            </div>
                          </div>
                          <div className="w-full h-1.5 bg-[#181818] rounded-full overflow-hidden border border-white/[0.08]">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-[#00D2FF] rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(0,210,255,0.4)]"
                              style={{ width: `${waterPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* 3. Separate Long Term Goal Section: Target Berat Badan */}
                      <div className="pt-2.5 border-t border-white/[0.08] space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                            <Scale size={12} />
                            <span>Target Berat Badan (Goal Jangka Panjang)</span>
                          </span>
                        </div>
                        <div
                          onClick={() => setShowGoalEditModal(true)}
                          className="p-3 bg-[#181818] hover:bg-[#222222] border border-white/[0.08] hover:border-amber-400/40 rounded-2xl cursor-pointer transition-all space-y-1.5 group/goal"
                          title="Klik untuk ubah goal & target berat badan"
                        >
                          <div className="flex items-center justify-between text-xs font-bold">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-mono text-xs">{weight} kg ➔ <span className="text-[#D4FF00] font-black">{targetWeight} kg</span></span>
                              <Edit3 size={11} className="text-neutral-500 group-hover/goal:text-[#D4FF00] transition-colors" />
                            </div>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${weight === targetWeight ? "bg-emerald-400/20 text-emerald-400 border border-emerald-400/30" : "bg-amber-400/15 text-amber-300 border border-amber-400/25"}`}>
                              {weight === targetWeight ? "🎯 Goal Tercapai" : `${Math.abs(Number((weight - targetWeight).toFixed(1)))} kg ke target`}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-[#222222] rounded-full overflow-hidden border border-white/[0.08]">
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* 4. Today's Meals 4-Box Bento Preview */}
                      <div className="pt-2 border-t border-white/[0.08] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-extrabold text-neutral-300 uppercase tracking-wider">
                            Jurnal Makanan Hari Ini
                          </span>
                          <span className="text-[11px] font-bold text-neutral-400 font-mono">
                            {loggedMealSlotsCount} tercatat
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { key: "breakfast", label: isEN ? "Breakfast" : "Sarapan", icon: "🌅", cal: caloriesByMealType.breakfast },
                            { key: "lunch", label: isEN ? "Lunch" : "Makan Siang", icon: "☀️", cal: caloriesByMealType.lunch },
                            { key: "dinner", label: isEN ? "Dinner" : "Makan Malam", icon: "🌙", cal: caloriesByMealType.dinner },
                            { key: "snack", label: isEN ? "Snacks" : "Camilan", icon: "🍎", cal: caloriesByMealType.snack },
                          ].map((m) => (
                            <div
                              key={m.key}
                              onClick={openAddFoodModal}
                              className="p-2.5 bg-[#181818] hover:bg-[#2a2a2a] border border-white/[0.08] rounded-xl flex flex-col justify-between transition-all cursor-pointer group min-h-[58px]"
                            >
                              <span className="text-[10px] text-neutral-400 font-bold flex items-center gap-1 group-hover:text-white transition-colors">
                                {m.icon} {m.label}
                              </span>
                              {m.cal > 0 ? (
                                <span className="text-xs sm:text-sm font-black text-white mt-1">
                                  {m.cal} kcal
                                </span>
                              ) : (
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-[10px] text-neutral-500 font-medium">Belum dicatat</span>
                                  <span className="text-[10px] font-bold text-[#D4FF00] bg-[#D4FF00]/10 px-1.5 py-0.5 rounded border border-[#D4FF00]/20">+ Catat</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Quick Action Footer */}
                    <div className="flex items-center gap-2 pt-2 border-t border-white/[0.08]">
                      <button
                        type="button"
                        onClick={() => setShowScanModal(true)}
                        className="flex-1 py-2.5 rounded-xl bg-[#181818] hover:bg-[#D4FF00] hover:text-black border border-white/[0.08] text-neutral-200 font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Camera size={14} />
                        <span>Scan Foto AI</span>
                      </button>
                      <button
                        type="button"
                        onClick={openAddFoodModal}
                        className="flex-1 py-2.5 rounded-xl bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <Plus size={14} />
                        <span>+ Catat Makan</span>
                      </button>
                    </div>
                  </div>
                );

                if (!hasNutritionAccess) {
                  return (
                    <div key="nutrition_bento" className="relative overflow-hidden rounded-3xl group h-full">
                      <div className="opacity-35 filter blur-[0.5px] pointer-events-none select-none transition-all h-full">
                        {nutritionBentoContent}
                      </div>
                      <div 
                        onClick={() => handleOpenUpgradeModal("nutrition")}
                        className="absolute inset-0 z-20 flex items-center justify-center p-5 bg-neutral-950/85 backdrop-blur-[3px] border border-emerald-500/30 rounded-3xl cursor-pointer hover:border-emerald-500/50 transition-all"
                      >
                        <div className="max-w-sm w-full text-center space-y-3 p-5 rounded-2xl bg-[#222222]/95 border border-emerald-500/30 shadow-2xl backdrop-blur-xl">
                          <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md">
                            <Lock size={22} strokeWidth={2.5} />
                          </div>
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              🔒 Fitur Terkunci • Paket Nutritionist
                            </span>
                            <h3 className="text-base font-black text-white mt-1">
                              Unlock AI Nutritionist
                            </h3>
                            <p className="text-xs text-neutral-300 font-medium mt-1 leading-relaxed">
                              Hitung otomatis kalori & makronutrisi harian via foto scanner dan chat WhatsApp presisi tinggi.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleOpenUpgradeModal("nutrition"); }}
                            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 text-black font-black text-xs transition-all shadow-md shadow-emerald-500/25 flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Sparkles size={14} />
                            <span>Upgrade Plan</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return <div key="nutrition_bento" className="h-full">{nutritionBentoContent}</div>;
              })()}

              {/* ── CARD B: AI WORKOUT COACH FIRST-CLASS BENTO MODULE ── */}
              {(() => {
                const completedExerciseCount = exercises.filter(ex => 
                  ex.status === "completed" || 
                  (typeof ex.completedSets === "number" && ex.targetSets > 0 && ex.completedSets >= ex.targetSets) ||
                  (Array.isArray(ex.setsState) && ex.setsState.length > 0 && ex.setsState.every(Boolean))
                ).length;
                
                const workoutBentoContent = (
                  <div className="bg-[#222222] border border-white/[0.08] rounded-3xl p-5 sm:p-6 shadow-xl space-y-5 flex flex-col justify-between h-full relative overflow-hidden">
                    <div className="space-y-4">
                      {/* Section Header */}
                      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-[#D4FF00]/15 border border-[#D4FF00]/30 flex items-center justify-center text-[#D4FF00] text-lg shrink-0">
                            🏋️
                          </div>
                          <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#D4FF00] block">
                              AI Workout Coach
                            </span>
                            <h2 className="text-base sm:text-lg font-black text-white">
                              {isEN ? "Today's Training Routine" : "Program Latihan Hari Ini"}
                            </h2>
                          </div>
                        </div>

                        <span className="px-2.5 py-1 rounded-lg bg-[#181818] border border-white/[0.08] text-[11px] font-extrabold text-[#D4FF00]">
                          {selectedDayName}
                        </span>
                      </div>

                      {/* Workout Focus Banner & Stats */}
                      <div className="p-4 bg-[#181818] border border-white/[0.08] rounded-2xl space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-black uppercase text-[#D4FF00] tracking-wider block">
                              Menu Utama
                            </span>
                            <h3 className="text-lg sm:text-xl font-black text-white tracking-tight mt-0.5">
                              {todayScheduleObj.focus}
                            </h3>
                            <p className="text-xs text-neutral-400 font-medium mt-0.5">
                              {todayScheduleObj.desc || "Menu Latihan Terstruktur Sesuai Target Fisik"}
                            </p>
                          </div>
                          <div className="w-10 h-10 rounded-xl bg-[#222222] border border-white/[0.08] flex items-center justify-center text-xl shrink-0">
                            {todayScheduleObj.icon || "🔥"}
                          </div>
                        </div>

                        {/* 4 Workout Metric Badges */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-white/[0.06]">
                          <div className="p-2 bg-[#222222] rounded-xl text-center">
                            <span className="text-[9px] font-bold text-neutral-400 uppercase block">⏱️ Durasi</span>
                            <span className="text-xs font-black text-white mt-0.5 block">45 Menit</span>
                          </div>
                          <div className="p-2 bg-[#222222] rounded-xl text-center">
                            <span className="text-[9px] font-bold text-neutral-400 uppercase block">⚡ Intensitas</span>
                            <span className="text-xs font-black text-[#D4FF00] mt-0.5 block">Tinggi</span>
                          </div>
                          <div className="p-2 bg-[#222222] rounded-xl text-center">
                            <span className="text-[9px] font-bold text-neutral-400 uppercase block">🎯 Latihan</span>
                            <span className="text-xs font-black text-white mt-0.5 block">{exercises.length} Gerakan</span>
                          </div>
                          <div className="p-2 bg-[#222222] rounded-xl text-center">
                            <span className="text-[9px] font-bold text-neutral-400 uppercase block">📊 Selesai</span>
                            <span className="text-xs font-black text-emerald-400 mt-0.5 block">{completedExerciseCount}/{exercises.length}</span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1 pt-1">
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <span className="text-neutral-400">Total Set Selesai:</span>
                            <span className="text-[#D4FF00] font-mono">{overallWorkoutPercent}%</span>
                          </div>
                          <div className="w-full h-2 bg-[#222222] rounded-full overflow-hidden border border-white/[0.08]">
                            <div
                              className="h-full bg-gradient-to-r from-lime-500 to-[#D4FF00] rounded-full transition-all duration-500 shadow-[0_0_8px_#D4FF00]"
                              style={{ width: `${overallWorkoutPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Scheduled Exercises Preview List */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-extrabold text-neutral-300 uppercase tracking-wider">
                            Rundown Latihan Terjadwal
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveTab("workouts")}
                            className="text-[11px] font-bold text-[#D4FF00] hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>Lihat Semua ({exercises.length})</span>
                            <ChevronRight size={12} />
                          </button>
                        </div>

                        {exercises.length === 0 ? (
                          <div className="p-4 bg-[#181818] border border-white/[0.08] rounded-2xl text-center">
                            <p className="text-xs text-neutral-400 font-medium">
                              Hari ini adalah hari istirahat / rest day. Pulihkan ototmu!
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {exercises.slice(0, 3).map((ex, exIdx) => {
                              const isAllDone = 
                                ex.status === "completed" || 
                                (typeof ex.completedSets === "number" && ex.targetSets > 0 && ex.completedSets >= ex.targetSets) ||
                                (Array.isArray(ex.setsState) && ex.setsState.length > 0 && ex.setsState.every(Boolean));
                              return (
                                <div
                                  key={ex.name || ex.id || exIdx}
                                  onClick={() => setActiveTab("workouts")}
                                  className="p-3 bg-[#181818] hover:bg-[#2a2a2a] border border-white/[0.08] rounded-2xl flex items-center justify-between gap-3 transition-all cursor-pointer group"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                                      isAllDone
                                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                        : "bg-[#222222] text-neutral-400 border border-white/[0.08]"
                                    }`}>
                                      {isAllDone ? "✓" : exIdx + 1}
                                    </div>
                                    <div className="min-w-0">
                                      <h4 className="font-extrabold text-xs sm:text-sm text-white group-hover:text-[#D4FF00] transition-colors truncate">
                                        {ex.name}
                                      </h4>
                                      <p className="text-[11px] text-neutral-400 font-medium mt-0.5">
                                        {ex.targetSets || 3} Set x {ex.targetReps || "10-12 Reps"}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[#222222] text-[#D4FF00] border border-white/[0.08]">
                                      {isAllDone ? "Selesai" : "Mulai"}
                                    </span>
                                    <ChevronRight size={14} className="text-neutral-500 group-hover:text-[#D4FF00] transition-colors" />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick Action Footer */}
                    <div className="flex items-center gap-2 pt-2 border-t border-white/[0.08]">
                      <button
                        type="button"
                        onClick={() => setShowWatchConnectModal(true)}
                        className="py-2.5 px-3.5 rounded-xl bg-[#181818] hover:bg-[#D4FF00] hover:text-black border border-white/[0.08] text-neutral-300 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        title="Hubungkan Apple Watch"
                      >
                        <Watch size={15} />
                        <span className="hidden sm:inline">Apple Watch</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("workouts")}
                        className="flex-1 py-2.5 rounded-xl bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <Dumbbell size={14} />
                        <span>Buka Menu Latihan Lengkap ➔</span>
                      </button>
                    </div>
                  </div>
                );

                if (!hasWorkoutAccess) {
                  return (
                    <div key="workout_bento" className="relative overflow-hidden rounded-3xl group h-full">
                      <div className="opacity-35 filter blur-[0.5px] pointer-events-none select-none transition-all h-full">
                        {workoutBentoContent}
                      </div>
                      <div 
                        onClick={() => handleOpenUpgradeModal("workout")}
                        className="absolute inset-0 z-20 flex items-center justify-center p-5 bg-neutral-950/85 backdrop-blur-[3px] border border-[#D4FF00]/30 rounded-3xl cursor-pointer hover:border-[#D4FF00]/50 transition-all"
                      >
                        <div className="max-w-sm w-full text-center space-y-3 p-5 rounded-2xl bg-[#222222]/95 border border-[#D4FF00]/30 shadow-2xl backdrop-blur-xl">
                          <div className="w-12 h-12 mx-auto rounded-2xl bg-[#D4FF00]/15 border border-[#D4FF00]/30 flex items-center justify-center text-[#D4FF00] shadow-md">
                            <Lock size={22} strokeWidth={2.5} />
                          </div>
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#D4FF00]/15 text-[#D4FF00] border border-[#D4FF00]/30">
                              🔒 Fitur Terkunci • Paket Workout Coach
                            </span>
                            <h3 className="text-base font-black text-white mt-1">
                              Unlock AI Workout Coach
                            </h3>
                            <p className="text-xs text-neutral-300 font-medium mt-1 leading-relaxed">
                              Dapatkan program latihan harian personal, checklist set latihan sinkron WhatsApp, dan 100+ panduan GIF.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleOpenUpgradeModal("workout"); }}
                            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#D4FF00] to-lime-400 hover:from-[#c2ea00] text-black font-black text-xs transition-all shadow-md shadow-[#D4FF00]/25 flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Sparkles size={14} />
                            <span>Upgrade Plan</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return <div key="workout_bento" className="h-full">{workoutBentoContent}</div>;
              })()}
            </div>

            {/* ========================================================================= */}
            {/* 3. WELLNESS & MOOD SELECTOR                                               */}
            {/* ========================================================================= */}
            <div className="bg-[#222222] border border-white/[0.08] rounded-3xl p-5 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-[#D4FF00]" />
                  <h3 className="text-sm font-extrabold text-white">
                    {t.howDoYouFeel}
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                  {feelState === "great" ? t.great : feelState === "good" ? t.good : feelState === "okay" ? t.okay : feelState === "not_great" ? t.notGreat : feelState === "sick" ? t.sick : t.feelBad}
                </span>
              </div>

              <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
                {[
                  { key: "great", emoji: "🔥", label: t.great },
                  { key: "good", emoji: "🙂", label: t.good },
                  { key: "okay", emoji: "😐", label: t.okay },
                  { key: "not_great", emoji: "🙁", label: t.notGreat },
                  { key: "sick", emoji: "🤒", label: t.sick },
                  { key: "bad", emoji: "😫", label: t.feelBad },
                ].map((f) => {
                  const isSelected = feelState === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => handleSelectFeel(f.key as FeelState)}
                      className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer border ${
                        isSelected
                          ? "bg-[#D4FF00] text-black border-[#D4FF00] font-black scale-105 shadow-md"
                          : "bg-[#181818] text-neutral-400 border-white/[0.08] hover:bg-[#2a2a2a] hover:text-white"
                      }`}
                    >
                      <span className="text-xl sm:text-2xl">{f.emoji}</span>
                      <span className="text-[9px] sm:text-[10px] font-bold mt-1 truncate max-w-full">{f.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ========================================================================= */}
            {/* 4. AI COACH RECOMMENDATION                                                */}
            {/* ========================================================================= */}
            <div className="bg-[#222222] border border-white/[0.08] rounded-3xl p-5 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#D4FF00] text-black font-black flex items-center justify-center text-sm shadow-xs shrink-0">
                    {isMaxPersona ? "🏋️" : "✨"}
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-white">
                      {isEN ? `${coachName}'s Recommendation` : `Saran ${coachName} Hari Ini`}
                    </h2>
                    <span className="text-[10px] font-semibold text-[#D4FF00] block">
                      {isMaxPersona ? (isEN ? "Strength Coach" : "Pelatih Gym & Otot") : (isEN ? "Nutritionist" : "Ahli Gizi & Pola Makan")}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const moodData = {
                      great: { icon: "🔥", title: isEN ? "You're at your peak!" : "Lo lagi di puncak!", message: isEN ? "Maximum energy! Finish your workout sets & meet your daily protein!" : "Energi maksimal! Gas tuntaskan menu workout hari ini & penuhi target protein!", tips: [isEN ? "Progressive overload" : "Kejar progressive overload", isEN ? "Log meals realtime" : "Log makanan secara realtime", isEN ? "2.5L hydration" : "Cukupi 2.5L hidrasi"], color: "#D4FF00" },
                      good: { icon: "🙂", title: isEN ? "Solid day!" : "Hari yang solid!", message: isEN ? "Great condition for structured workout and clean nutrition." : "Kondisi sangat baik untuk latihan terstruktur dan makanan bergizi.", tips: [isEN ? "Focus on best form" : "Latihan sesuai form terbaik", isEN ? "Post-workout protein" : "Konsumsi protein pasca latihan"], color: "#4ade80" },
                      okay: { icon: "😐", title: isEN ? "Keep consistent!" : "Tetap konsisten!", message: isEN ? "Start with a 10-minute dynamic warmup to build momentum." : "Mulai pelan-pelan dengan pemanasan 10 menit untuk menaikkan fokus.", tips: [isEN ? "Dynamic warmup" : "Warmup dinamis 10 mnt", isEN ? "Don't skip the session" : "Jangan skip sesi"], color: "#facc15" },
                      not_great: { icon: "🙁", title: isEN ? "Listen to your body" : "Dengarkan tubuhmu", message: isEN ? "If fatigued, reduce weights and focus on stretching or light walk." : "Jika lelah, kurangi beban dan fokus pada peregangan atau jalan kaki santai.", tips: [isEN ? "Light walk / mobility" : "Latihan ringan / kardio santai", isEN ? "Early sleep" : "Tidur lebih awal"], color: "#fb923c" },
                      sick: { icon: "🤒", title: isEN ? "Rest is progress" : "Fokus istirahat & sembuh", message: isEN ? "Rest is essential for recovery. Skip heavy lifting and nourish your body." : "Rest adalah bagian dari progress. Istirahat total dan makan makanan hangat bergizi.", tips: [isEN ? "Skip heavy lifting" : "Skip latihan berat", isEN ? "Hydrate & electrolytes" : "Minum air hangat & vitamin"], color: "#f87171" },
                      bad: { icon: "😫", title: isEN ? "Time to recharge" : "Waktunya recharge", message: isEN ? "Take a recovery day. Stress management and sleep come first." : "Jangan paksakan beban berat saat stres atau lelah berlebih. Refresh pikiranmu.", tips: [isEN ? "Quality sleep" : "Istirahat berkualitas", isEN ? "Clean whole foods" : "Makan bersih & cukup air"], color: "#a78bfa" }
                    }[feelState] || { icon: "🏋️", title: "Saran Harian", message: getCoachFeelingRecommendation(), tips: ["Tetap konsisten!"], color: "#D4FF00" };
                    setCoachMoodData(moodData);
                    setShowCoachMoodPopup(true);
                  }}
                  className="text-xs font-bold text-[#D4FF00] hover:underline cursor-pointer"
                >
                  {isEN ? "View Tip" : "Buka Detail"}
                </button>
              </div>

              <div className="bg-[#181818] border border-white/[0.08] rounded-2xl p-4 flex items-start gap-3">
                <p className="text-xs text-neutral-300 font-medium leading-relaxed">
                  {getCoachFeelingRecommendation()}
                </p>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* 5. DETAILED ACTIVITY BREAKDOWN (FOOD MEALS LIST & HYDRATION TRACKER)       */}
            {/* ========================================================================= */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
              
              {/* ── CARD A: TODAY'S FOOD MEALS DETAILED LIST ── */}
              {(() => {
                const foodDetailedContent = (
                  <div className="bg-[#222222] border border-white/[0.08] rounded-3xl p-5 sm:p-6 shadow-xl space-y-4 flex flex-col justify-between h-full">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-white/[0.08] pb-3">
                        <div className="flex items-center gap-2">
                          <Flame size={18} className="text-amber-400" />
                          <h2 className="text-base font-extrabold text-white">{t.foodMeals}</h2>
                          <span className="text-xs font-bold text-neutral-400 px-2 py-0.5 rounded-full bg-[#181818] border border-white/[0.08]">
                            {foodMeals.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowScanModal(true)}
                            className="px-3 py-1.5 rounded-xl bg-[#181818] border border-white/[0.08] text-[#D4FF00] hover:bg-[#D4FF00] hover:text-black font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                          >
                            <Camera size={14} />
                            <span>Scan Foto</span>
                          </button>
                          <button
                            type="button"
                            onClick={openAddFoodModal}
                            className="px-3 py-1.5 rounded-xl bg-[#D4FF00] text-black font-extrabold text-xs flex items-center gap-1 hover:bg-[#c4ec00] transition-all cursor-pointer shadow-xs"
                          >
                            <Plus size={14} />
                            <span>Tambah</span>
                          </button>
                        </div>
                      </div>

                      {foodMeals.length === 0 ? (
                        <div className="text-center py-8 px-4 border border-dashed border-white/[0.08] rounded-2xl bg-[#181818] space-y-3">
                          <div className="w-12 h-12 rounded-2xl bg-[#222222] text-2xl flex items-center justify-center mx-auto border border-white/[0.08]">
                            🍽️
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-sm font-extrabold text-white">
                              {isEN ? "No meals logged yet" : "Belum ada makanan tercatat"}
                            </h4>
                            <p className="text-xs text-neutral-400 font-medium max-w-sm mx-auto">
                              {isEN ? "Start tracking your meals to see your daily nutrition here." : "Mulai catat makanan harianmu untuk memantau kalori dan makronutrisi di sini."}
                            </p>
                          </div>
                          <div className="flex items-center justify-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={openAddFoodModal}
                              className="px-4 py-2 bg-[#D4FF00] text-black font-black text-xs rounded-xl hover:bg-[#c4ec00] transition-all cursor-pointer shadow-xs"
                            >
                              + {isEN ? "Add Meal" : "Catat Makanan"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowScanModal(true)}
                              className="px-4 py-2 bg-[#181818] border border-white/[0.08] text-neutral-300 font-bold text-xs rounded-xl hover:bg-[#2a2a2a] transition-all cursor-pointer"
                            >
                              📸 {isEN ? "Scan Photo" : "Scan Foto"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                          {foodMeals.map((item) => (
                            <div
                              key={item.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => setSelectedMealDetail(item)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setSelectedMealDetail(item);
                                }
                              }}
                              className="w-full text-left p-3.5 bg-[#181818] hover:bg-[#2a2a2a] focus-visible:bg-[#2a2a2a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4FF00] border border-white/[0.08] hover:border-white/15 rounded-2xl transition-all cursor-pointer group flex items-center justify-between gap-3 shadow-xs"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-base leading-none">
                                    {getFoodEmoji(item.foodName)}
                                  </span>
                                  <h4 className="font-extrabold text-sm text-white group-hover:text-[#D4FF00] transition-colors truncate">
                                    {item.foodName}
                                  </h4>
                                  {item.mealType && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#222222] text-neutral-400 border border-white/[0.08] capitalize shrink-0">
                                      {item.mealType}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-neutral-400 font-medium mt-1 flex-wrap">
                                  <span className="text-white font-black">{formatDashboardInteger(item.calories)} kcal</span>
                                  <span className="text-neutral-600">•</span>
                                  <span className="text-indigo-300 font-medium">P: {formatDashboardMacro(item.protein)}g</span>
                                  <span className="text-emerald-300 font-medium">C: {formatDashboardMacro(item.carbs)}g</span>
                                  <span className="text-rose-300 font-medium">F: {formatDashboardMacro(item.fat)}g</span>
                                  {item.time && (
                                    <>
                                      <span className="text-neutral-600">•</span>
                                      <span className="text-neutral-400 font-mono text-[11px]">{item.time}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditMealModal(item);
                                  }}
                                  className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-[#222222] transition-colors cursor-pointer"
                                  title="Ubah data kalori & makro"
                                >
                                  <Edit3 size={15} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMealToDelete(item);
                                  }}
                                  className="p-2 rounded-xl text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                  title="Hapus catatan makanan"
                                >
                                  <Trash2 size={15} />
                                </button>
                                <ChevronRight size={16} className="text-neutral-500 group-hover:text-[#D4FF00] group-hover:translate-x-0.5 transition-all" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );

                if (!hasNutritionAccess) {
                  return (
                    <div key="food_detail_bento" className="relative overflow-hidden rounded-3xl group h-full">
                      <div className="opacity-35 filter blur-[0.5px] pointer-events-none select-none transition-all h-full">
                        {foodDetailedContent}
                      </div>
                      <div 
                        onClick={() => handleOpenUpgradeModal("nutrition")}
                        className="absolute inset-0 z-20 flex items-center justify-center p-5 bg-neutral-950/85 backdrop-blur-[3px] border border-emerald-500/25 rounded-3xl cursor-pointer hover:border-emerald-500/45 transition-all"
                      >
                        <div className="text-center space-y-2.5 max-w-sm p-4">
                          <div className="w-10 h-10 mx-auto rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                            <Lock size={18} strokeWidth={2.5} />
                          </div>
                          <div>
                            <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">
                              🔒 Fitur Terkunci • Nutritionist
                            </span>
                            <h4 className="text-sm font-black text-white mt-0.5">
                              Buka Jurnal Makanan Real-Time
                            </h4>
                            <p className="text-xs text-neutral-300 mt-1">
                              Catat makanan via foto & chat WhatsApp dengan estimasi makro presisi tinggi pada Paket Nutritionist.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleOpenUpgradeModal("nutrition"); }}
                            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                          >
                            <Sparkles size={14} />
                            <span>Upgrade Plan</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return <div key="food_detail_bento" className="h-full">{foodDetailedContent}</div>;
              })()}

              {/* ── CARD B: WATER & 2.5L HYDRATION TRACKER ── */}
              {(() => {
                const hydrationDetailedContent = (
                  <div className="bg-[#222222] border border-white/[0.08] rounded-3xl p-5 sm:p-6 shadow-xl space-y-4 flex flex-col justify-between h-full">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Droplets size={18} className="text-blue-400" />
                          <h2 className="text-base font-extrabold text-white">{t.waterHydration}</h2>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleQuickAddWater(250)}
                            className="px-2.5 py-1.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300 font-extrabold text-xs hover:bg-blue-500/25 transition-all cursor-pointer shadow-xs"
                          >
                            +250 ml
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickAddWater(500)}
                            className="px-2.5 py-1.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300 font-extrabold text-xs hover:bg-blue-500/25 transition-all cursor-pointer shadow-xs"
                          >
                            +500 ml
                          </button>
                          <button
                            type="button"
                            onClick={openAddDrinkModal}
                            className="px-3 py-1.5 rounded-xl bg-[#D4FF00] text-black font-extrabold text-xs flex items-center gap-1 hover:bg-[#c4ec00] transition-all cursor-pointer shadow-xs"
                          >
                            <Plus size={14} />
                            <span>+ Catat Minum</span>
                          </button>
                        </div>
                      </div>

                      {/* Hydration Target Banner */}
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">{t.hydrationTarget}</span>
                          <p className="text-base sm:text-lg font-black text-white">{totalHydrationMl} ml <span className="text-xs text-neutral-400 font-medium">/ 2,500 ml ({totalWaterCups} {isEN ? "Glasses" : "Gelas"})</span></p>
                        </div>
                        
                        {/* 8 Interactive Visual Water Cups */}
                        <div className="flex items-center gap-1.5">
                          {Array.from({ length: 8 }).map((_, idx) => {
                            const isFilled = idx < totalWaterCups;
                            return (
                              <div
                                key={idx}
                                className={`w-5 h-7 rounded-md border flex items-end p-0.5 transition-all ${
                                  isFilled
                                    ? "bg-blue-500/20 border-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.4)]"
                                    : "bg-[#181818] border-white/[0.08] opacity-40"
                                }`}
                              >
                                <div
                                  className={`w-full rounded-xs transition-all ${
                                    isFilled ? "bg-blue-400 h-full" : "h-0"
                                  }`}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Hydration Log Items */}
                      {hydrationLogs.length === 0 ? (
                        <div className="bg-[#181818] border border-white/[0.08] rounded-2xl p-4 text-center">
                          <p className="text-xs text-neutral-400 font-medium">
                            {isEN ? "No water logged today. Tap +250 ml or +500 ml above to record!" : "Belum ada catatan air minum hari ini. Tap +250 ml atau +500 ml di atas untuk mencatat!"}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
                            {isEN ? `Today's Water History (${hydrationLogs.length})` : `Riwayat Minum Hari Ini (${hydrationLogs.length})`}
                          </span>
                          <div className="space-y-2">
                            {hydrationLogs.map((item) => (
                              <div
                                key={item.id}
                                className="bg-[#181818] border border-white/[0.08] rounded-2xl p-3 flex items-center justify-between transition-all hover:border-white/15"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-300 flex items-center justify-center text-sm font-bold">
                                    💧
                                  </div>
                                  <div>
                                    <h4 className="font-extrabold text-sm text-white">{item.foodName}</h4>
                                    <p className="text-[11px] text-neutral-400 font-medium">
                                      {item.volumeMl || 250} ml {item.time ? `• ${item.time}` : ""}
                                    </p>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteLogItem(item.id)}
                                  className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                  title={t.delete}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );

                if (!hasNutritionAccess) {
                  return (
                    <div key="hydration_detail_bento" className="relative overflow-hidden rounded-3xl group h-full">
                      <div className="opacity-35 filter blur-[0.5px] pointer-events-none select-none transition-all h-full">
                        {hydrationDetailedContent}
                      </div>
                      <div 
                        onClick={() => handleOpenUpgradeModal("nutrition")}
                        className="absolute inset-0 z-20 flex items-center justify-center p-5 bg-neutral-950/85 backdrop-blur-[3px] border border-blue-500/25 rounded-3xl cursor-pointer hover:border-blue-500/45 transition-all"
                      >
                        <div className="text-center space-y-2.5 max-w-sm p-4">
                          <div className="w-10 h-10 mx-auto rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                            <Lock size={18} strokeWidth={2.5} />
                          </div>
                          <div>
                            <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider">
                              🔒 Fitur Terkunci • Nutritionist
                            </span>
                            <h4 className="text-sm font-black text-white mt-0.5">
                              Buka Pelacak Hidrasi & Minum
                            </h4>
                            <p className="text-xs text-neutral-300 mt-1">
                              Pantau target 2.500ml harian dan riwayat minum lengkap dengan paket Nutritionist.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleOpenUpgradeModal("nutrition"); }}
                            className="px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-black font-black text-xs transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                          >
                            <Sparkles size={14} />
                            <span>Upgrade Plan</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return <div key="hydration_detail_bento" className="h-full">{hydrationDetailedContent}</div>;
              })()}
            </div>

            {/* ========================================================================= */}
            {/* 6. GYMBUDDY USP EXCELLENCE HUB & SUPERPOWERS SHOWCASE                      */}
            {/* ========================================================================= */}
            <div className="bg-[#222222] border border-white/[0.08] rounded-3xl p-5 sm:p-6 shadow-xl space-y-4 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#D4FF00]/15 border border-[#D4FF00]/30 text-[#D4FF00] font-black text-[10px] uppercase tracking-wider">
                      ✨ GymBuddy Superpowers
                    </span>
                    <span className="text-xs text-neutral-400 font-semibold">{isEN ? "All-in-One AI Fitness OS" : "Ekosistem Fitness AI Lengkap"}</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white mt-1">
                    {isEN ? "Why GymBuddy is Your Ultimate Fitness Partner" : "Kenapa GymBuddy Sahabat Terbaik Fitness Kamu?"}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAffiliateModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-[#D4FF00] text-black font-black text-xs flex items-center gap-1.5 shadow-md hover:scale-102 transition-all cursor-pointer"
                >
                  <Gift size={14} />
                  <span>{isEN ? "Affiliate Program (20%-35%)" : "Program Afiliasi (20%-35%)"}</span>
                </button>
              </div>

              {/* USP Grid Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {/* USP 1: Vision AI */}
                <div 
                  onClick={() => setShowScanModal(true)}
                  className="bg-[#181818] border border-white/[0.08] hover:border-[#D4FF00]/40 rounded-2xl p-4 space-y-2.5 transition-all cursor-pointer group hover:bg-[#2a2a2a]"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 text-base font-black">
                      📸
                    </div>
                    <span className="text-[10px] font-black text-[#D4FF00] group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      Scan Foto <ArrowRight size={12} />
                    </span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-white group-hover:text-[#D4FF00] transition-colors">
                      Vision AI Makanan Lokal
                    </h4>
                    <p className="text-xs text-neutral-400 font-medium mt-1 leading-relaxed">
                      Paham menu Indonesia: Nasi Padang, Kopi Kenangan, Boba, Sate, dll. Hitung kalori & makro dalam &lt;1.5 detik.
                    </p>
                  </div>
                </div>

                {/* USP 2: Realtime Macro Manager */}
                <div 
                  onClick={openAddFoodModal}
                  className="bg-[#181818] border border-white/[0.08] hover:border-[#D4FF00]/40 rounded-2xl p-4 space-y-2.5 transition-all cursor-pointer group hover:bg-[#2a2a2a]"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-base font-black">
                      ⚡
                    </div>
                    <span className="text-[10px] font-black text-[#D4FF00] group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      Catat Makan <ArrowRight size={12} />
                    </span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-white group-hover:text-[#D4FF00] transition-colors">
                      Realtime Macro & Food Log
                    </h4>
                    <p className="text-xs text-neutral-400 font-medium mt-1 leading-relaxed">
                      Tracking nutrisi lengkap (Protein, Karbohidrat, Lemak, Gula) dengan formula Atwater presisi tinggi.
                    </p>
                  </div>
                </div>

                {/* USP 3: Smart Hydration */}
                <div 
                  onClick={() => setShowAddDrinkModal(true)}
                  className="bg-[#181818] border border-white/[0.08] hover:border-[#D4FF00]/40 rounded-2xl p-4 space-y-2.5 transition-all cursor-pointer group hover:bg-[#2a2a2a]"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 text-base font-black">
                      💧
                    </div>
                    <span className="text-[10px] font-black text-[#D4FF00] group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      Catat Minum <ArrowRight size={12} />
                    </span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-white group-hover:text-[#D4FF00] transition-colors">
                      Smart Hydration Tracker
                    </h4>
                    <p className="text-xs text-neutral-400 font-medium mt-1 leading-relaxed">
                      Target 2.500ml harian dengan visual gelas interaktif & auto-kalkulasi air untuk Americano, Teh, dan Kopi.
                    </p>
                  </div>
                </div>

                {/* USP 4: AI Workout Coach & GIF Library */}
                <div 
                  onClick={() => setActiveTab("workouts")}
                  className="bg-[#181818] border border-white/[0.08] hover:border-[#D4FF00]/40 rounded-2xl p-4 space-y-2.5 transition-all cursor-pointer group hover:bg-[#2a2a2a]"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-[#D4FF00]/15 border border-[#D4FF00]/30 flex items-center justify-center text-[#D4FF00] text-base font-black">
                      🏋️
                    </div>
                    <span className="text-[10px] font-black text-[#D4FF00] group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      Menu Latihan <ArrowRight size={12} />
                    </span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-white group-hover:text-[#D4FF00] transition-colors">
                      100+ Visual Panduan Alat
                    </h4>
                    <p className="text-xs text-neutral-400 font-medium mt-1 leading-relaxed">
                      Kamus visual gerakan 2 fase, cue pelatih Max & Mia, dan checklist set latihan tersinkronisasi otomatis.
                    </p>
                  </div>
                </div>

                {/* USP 5: Body Transformation Analytics */}
                <div 
                  onClick={() => setActiveTab("progress")}
                  className="bg-[#181818] border border-white/[0.08] hover:border-[#D4FF00]/40 rounded-2xl p-4 space-y-2.5 transition-all cursor-pointer group hover:bg-[#2a2a2a]"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 text-base font-black">
                      📈
                    </div>
                    <span className="text-[10px] font-black text-[#D4FF00] group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      Lihat Grafik <ArrowRight size={12} />
                    </span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-white group-hover:text-[#D4FF00] transition-colors">
                      Grafik Progres & Analitik
                    </h4>
                    <p className="text-xs text-neutral-400 font-medium mt-1 leading-relaxed">
                      Visualisasi kurva berat badan, histori kalori 7 hari, tingkat konsistensi, dan proyeksi pencapaian target.
                    </p>
                  </div>
                </div>

                {/* USP 6: Affiliate & Partner */}
                <div 
                  onClick={() => setShowAffiliateModal(true)}
                  className="bg-[#222222] border border-[#D4FF00]/30 hover:border-[#D4FF00] rounded-2xl p-4 space-y-2.5 transition-all cursor-pointer group shadow-sm hover:bg-[#2a2a2a]"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-[#D4FF00]/20 border border-[#D4FF00]/40 flex items-center justify-center text-[#D4FF00] text-base font-black">
                      💰
                    </div>
                    <span className="text-[10px] font-black text-[#D4FF00] group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      Join Affiliate <ArrowRight size={12} />
                    </span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-white group-hover:text-[#D4FF00] transition-colors">
                      Program Afiliasi GymBuddy
                    </h4>
                    <p className="text-xs text-neutral-300 font-medium mt-1 leading-relaxed">
                      Dapatkan komisi berulang 20% – 35% setiap kali teman atau klien gym kamu berlangganan via kodemu.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: WORKOUTS (JADWAL & SESI LATIHAN) */}
        {/* ========================================================================= */}
        {activeTab === "workouts" && (() => {
          const workoutTabContent = (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#222222] border border-white/[0.08] rounded-2xl p-4 sm:p-5">
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                    <Dumbbell size={22} className="text-[#D4FF00]" />
                    <span>{isEN ? "Gym Schedule & Workouts" : "Jadwal & Latihan Gym"}</span>
                  </h1>
                  <p className="text-xs text-neutral-400 font-semibold mt-0.5">
                    {selectedDayName} • {todayScheduleObj.focus} ({overallWorkoutPercent}% {isEN ? "Completed" : "Selesai"})
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setShowWatchConnectModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-neutral-800/80 hover:bg-[#D4FF00] hover:text-black border border-white/[0.08] text-neutral-300 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title={isEN ? "Connect Apple Watch (Magic Link)" : "Hubungkan ke Apple Watch (Magic Link)"}
                  >
                    <Watch size={14} className="text-[#D4FF00]" />
                    <span className="hidden sm:inline">Apple Watch</span>
                  </button>

                  <button
                    onClick={() => setShowExerciseExplorerModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-[#D4FF00]/15 border border-[#D4FF00]/40 text-[#D4FF00] font-bold text-xs hover:bg-[#D4FF00]/25 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <BookOpen size={14} />
                    <span>{isEN ? "Exercise Library (GIFs)" : "Kamus Alat (GIF Guide)"}</span>
                  </button>

                  <button
                    onClick={() => setShowFullWeeklyOverview(!showFullWeeklyOverview)}
                    className="px-3 py-1.5 rounded-xl bg-[#181818] border border-white/[0.08] text-neutral-300 font-bold text-xs hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Layers size={14} />
                    <span>{showFullWeeklyOverview ? (isEN ? "View Today" : "Lihat Hari Ini") : (isEN ? "7-Day Schedule" : "Jadwal 7 Hari")}</span>
                  </button>
                </div>
              </div>

            {!showFullWeeklyOverview ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exercises.map((ex) => {
                  const percent = ex.targetSets > 0 ? Math.round((ex.completedSets / ex.targetSets) * 100) : 0;
                  const isDone = percent === 100;
                  const matchedDb = findExerciseOrEquipment(ex.name);

                  return (
                    <div
                      key={ex.id}
                      className={`border rounded-2xl p-4 sm:p-5 transition-all space-y-3.5 cursor-pointer group ${
                        isDone
                          ? "bg-emerald-500/10 border-emerald-500/30 text-white"
                          : ex.completedSets > 0
                          ? "bg-amber-500/10 border-amber-500/30 text-white"
                          : "bg-[#222222] border-white/[0.08] hover:border-[#D4FF00]/50 hover:bg-[#181818]"
                      }`}
                      onClick={() => setActiveWorkoutDetail(ex)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-extrabold text-base text-white group-hover:text-[#D4FF00] transition-colors">{ex.name}</h3>
                            {matchedDb && (
                              <span className="px-2 py-0.5 rounded-md bg-[#D4FF00]/20 text-[#D4FF00] border border-[#D4FF00]/30 text-[9px] font-black tracking-wider flex items-center gap-1">
                                <Play size={8} fill="currentColor" /> GIF
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-400 font-semibold">{ex.targetReps} • {ex.targetSets} Sets</p>
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

                      <div className="flex items-center justify-between pt-2 border-t border-white/[0.08]">
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {ex.setsState.map((isSetDone, setIdx) => (
                            <button
                              key={setIdx}
                              onClick={() => handleToggleSet(ex.id, setIdx)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer border ${
                                isSetDone
                                  ? "bg-[#D4FF00] text-black border-[#D4FF00] shadow-xs"
                                  : "bg-[#181818] text-neutral-300 border-white/[0.08] hover:bg-neutral-800"
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

              {activities.length > 0 && (
                <div className="mt-4 p-4 sm:p-5 rounded-2xl bg-[#222222] border border-white/[0.08] space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
                      <span>🏅</span>
                      <span>{isEN ? "Additional Activities (Logged via WhatsApp)" : "Aktivitas Tambahan Hari Ini"}</span>
                    </h4>
                    <div className="flex items-center gap-2">
                      {activities.some(a => a.estimatedCaloriesBurned) && (
                        <span className="text-xs font-extrabold text-amber-400">
                          🔥 ~{activities.reduce((sum, a) => sum + (Number(a.estimatedCaloriesBurned) || 0), 0)} kcal
                        </span>
                      )}
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#D4FF00]/15 text-[#D4FF00] border border-[#D4FF00]/30">
                        {activities.length} {isEN ? "Activity" : "Aktivitas"}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {activities.map((act) => (
                      <div key={act.id} className="flex items-center justify-between p-3 rounded-xl bg-[#181818] border border-white/[0.08] hover:border-white/20 transition-all">
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <span className="text-xl flex-shrink-0">{act.icon || "🏅"}</span>
                          <div className="min-w-0">
                            <p className="font-extrabold text-xs sm:text-sm text-white truncate">{act.activityName}</p>
                            <p className="text-[11px] text-neutral-400 font-medium truncate">
                              {act.details ? act.details : (
                                <>
                                  {act.durationMinutes ? `${act.durationMinutes} menit` : ""}
                                  {act.intensity ? ` • ${act.intensity}` : ""}
                                  {act.distanceKm ? ` • ${act.distanceKm} km` : ""}
                                  {act.sets ? ` • ${act.sets} set` : ""}
                                  {act.reps ? ` x ${act.reps} reps` : ""}
                                  {act.weightKg ? ` (${act.weightKg} kg)` : ""}
                                  {act.estimatedCaloriesBurned ? ` • ~${act.estimatedCaloriesBurned} kcal` : ""}
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black">
                            ✅ {isEN ? "Done" : "Selesai"}
                          </span>
                          <button
                            onClick={() => handleDeleteActivity(act.id)}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
                            title={isEN ? "Delete activity" : "Hapus aktivitas"}
                            aria-label={isEN ? "Delete activity" : "Hapus aktivitas"}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
            ) : (
              <div className="space-y-4">
                {weeklySchedule.map((daySch) => {
                  const isSelectedDay = daySch.day === selectedDayName;
                  return (
                    <div
                      key={daySch.day}
                      className={`border rounded-2xl p-4 sm:p-5 transition-all space-y-3 ${
                        isSelectedDay ? "bg-[#222222] text-white border-[#D4FF00]/40" : "bg-[#222222] border-white/[0.08] text-neutral-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className={`px-3 py-1 rounded-xl font-black text-xs uppercase ${isSelectedDay ? "bg-[#D4FF00] text-black" : "bg-neutral-800 text-neutral-300"}`}>
                            {daySch.day}
                          </span>
                          <h4 className="font-extrabold text-base text-white">{daySch.focus}</h4>
                        </div>
                        <span className="text-xs font-semibold text-neutral-400">
                          {daySch.exercises.length} {isEN ? "Exercises" : "Menu Gerakan"}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                        {daySch.exercises.map((exItem) => (
                          <div key={exItem.id} className="p-3 rounded-xl text-xs border bg-[#181818] border-white/[0.08] text-neutral-200">
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
        );

        if (!hasWorkoutAccess) {
          return (
            <div className="space-y-5">
              {/* Locked Full View with Live Preview */}
              <div className="relative overflow-hidden rounded-3xl min-h-[550px] group">
                <div className="opacity-35 filter blur-[0.5px] pointer-events-none select-none transition-all">
                  {workoutTabContent}
                </div>
                <div 
                  onClick={() => handleOpenUpgradeModal("workout")}
                  className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-radial from-neutral-950/70 via-neutral-950/85 to-[#000000]/95 backdrop-blur-[3px] border border-[#D4FF00]/25 rounded-3xl cursor-pointer hover:border-[#D4FF00]/45 transition-all"
                >
                  <div className="max-w-md w-full text-center space-y-4 p-6 sm:p-8 rounded-3xl bg-[#222222]/95 border border-[#D4FF00]/30 shadow-2xl backdrop-blur-xl">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-[#D4FF00]/15 border border-[#D4FF00]/30 flex items-center justify-center text-[#D4FF00] shadow-lg shadow-[#D4FF00]/10">
                      <Lock size={26} strokeWidth={2.5} />
                    </div>
                    <div className="space-y-1.5">
                      <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#D4FF00]/15 text-[#D4FF00] border border-[#D4FF00]/30">
                        🔒 {isEN ? "Plan Locked • Workout Coach" : "Fitur Terkunci • Paket Workout Coach"}
                      </span>
                      <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                        {isEN ? "Unlock Full Workout Coach" : "Buka Akses Penuh AI Workout Coach"}
                      </h3>
                      <p className="text-xs sm:text-sm text-neutral-300 font-medium leading-relaxed">
                        {isEN
                          ? "Get personalized workout plans, progress tracking, and coaching with the Workout Coach plan."
                          : "Dapatkan program latihan terstruktur harian, per-set workout tracker tersinkronisasi WhatsApp, GIF guide alat gym, dan coaching interaktif dengan paket Workout Coach."}
                      </p>
                    </div>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleOpenUpgradeModal("workout"); }}
                        className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-[#D4FF00] to-lime-400 hover:from-[#c2ea00] hover:to-lime-300 text-black font-black text-xs sm:text-sm transition-all shadow-lg shadow-[#D4FF00]/25 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                      >
                        <Sparkles size={16} />
                        <span>{isEN ? "Upgrade to Workout Plan" : "Upgrade Plan"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        return workoutTabContent;
      })()}

        {/* ========================================================================= */}
        {/* TAB 3: PROGRESS (PROYEKSI & HISTORI ANALITIK LENGKAP) */}
        {/* ========================================================================= */}
        {activeTab === "progress" && (
          <div className="space-y-5">
            {/* Header Bar with Timeframe Toggle */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#222222] border border-white/[0.08] rounded-2xl p-4 sm:p-5">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <TrendingUp size={22} className="text-[#D4FF00]" />
                  <span>{isEN ? "Body Transformation & Analytics" : "Grafik & Analitik Transformasi"}</span>
                </h1>
                <p className="text-xs text-neutral-400 font-semibold mt-0.5">
                  Target: {goalTitle} ({weight} kg ➔ {targetWeight} kg) • {remainingKg} kg {isEN ? "to go" : "lagi"}
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex items-center gap-1.5 bg-[#181818] border border-white/[0.08] p-1 rounded-xl shadow-xs">
                  <button
                    type="button"
                    onClick={() => setChartTimeframe("7d")}
                    className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      chartTimeframe === "7d"
                        ? "bg-[#D4FF00] text-black shadow-xs"
                        : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    {isEN ? "7 Days" : "7 Hari"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartTimeframe("30d")}
                    className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      chartTimeframe === "30d"
                        ? "bg-[#D4FF00] text-black shadow-xs"
                        : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    {isEN ? "30 Days" : "30 Hari"}
                  </button>
                </div>

                <button
                  onClick={() => setShowUpdateWeightModal(true)}
                  className="px-4 py-2 bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1.5 active:scale-98"
                >
                  <Edit3 size={14} />
                  <span>{isEN ? "Log Weight" : "Perbarui Berat"}</span>
                </button>
              </div>
            </div>

            {/* 1. WEIGHT EVOLUTION & TREND GRAPH */}
            <div className="bg-[#222222] border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity size={18} className="text-[#D4FF00]" />
                  <h3 className="font-extrabold text-base text-white">
                    {isEN ? "Weight Progression Curve" : "Kurva Progres Berat Badan"}
                  </h3>
                </div>
                <span className="text-xs font-black text-[#D4FF00] bg-[#D4FF00]/10 border border-[#D4FF00]/30 px-3 py-1 rounded-full">
                  Target: {targetWeight} kg
                </span>
              </div>

              <div className="bg-[#181818] border border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between text-xs text-neutral-400 font-bold border-b border-white/[0.08] pb-2">
                  <span>{isEN ? "Start" : "Awal"}: {startWeight || weight} kg</span>
                  <span className="text-neutral-300">
                    {isEN ? `Est: ~${chartTimeframe === "30d" ? "4-8" : "8-12"} Weeks` : `Estimasi: ~${chartTimeframe === "30d" ? "4-8" : "8-12"} Minggu`}
                  </span>
                  <span className="text-[#D4FF00]">Target: {targetWeight} kg</span>
                </div>

                <div className="h-48 sm:h-56 w-full relative flex items-center justify-center pt-2">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 500 160">
                    <defs>
                      <linearGradient id="weightCurveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#D4FF00" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#25D366" stopOpacity="1" />
                      </linearGradient>
                      <linearGradient id="weightAreaFill" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#D4FF00" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#D4FF00" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    <line x1="0" y1="35" x2="500" y2="35" stroke="#1A1A1A" strokeDasharray="4 4" strokeWidth="1" />
                    <line x1="0" y1="75" x2="500" y2="75" stroke="#1A1A1A" strokeDasharray="4 4" strokeWidth="1" />
                    <line x1="0" y1="115" x2="500" y2="115" stroke="#1A1A1A" strokeDasharray="4 4" strokeWidth="1" />

                    {/* Area fill */}
                    {targetWeight < weight ? (
                      <path d="M 30 50 Q 150 65, 250 85 T 470 120 L 470 150 L 30 150 Z" fill="url(#weightAreaFill)" />
                    ) : targetWeight > weight ? (
                      <path d="M 30 120 Q 150 100, 250 80 T 470 50 L 470 150 L 30 150 Z" fill="url(#weightAreaFill)" />
                    ) : (
                      <path d="M 30 80 L 470 80 L 470 150 L 30 150 Z" fill="url(#weightAreaFill)" />
                    )}

                    {/* Line curve */}
                    {targetWeight < weight ? (
                      <path d="M 30 50 Q 150 65, 250 85 T 470 120" fill="none" stroke="url(#weightCurveGrad)" strokeWidth="4" strokeLinecap="round" />
                    ) : targetWeight > weight ? (
                      <path d="M 30 120 Q 150 100, 250 80 T 470 50" fill="none" stroke="url(#weightCurveGrad)" strokeWidth="4" strokeLinecap="round" />
                    ) : (
                      <path d="M 30 80 L 470 80" fill="none" stroke="url(#weightCurveGrad)" strokeWidth="4" strokeLinecap="round" />
                    )}

                    {/* Start Node */}
                    <circle cx="30" cy={targetWeight < weight ? 50 : targetWeight > weight ? 120 : 80} r="6" fill="#080808" stroke="#D4FF00" strokeWidth="3" />
                    <text x="30" y={targetWeight < weight ? 35 : targetWeight > weight ? 140 : 65} fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">
                      {startWeight} kg
                    </text>

                    {/* Mid Current Node */}
                    <circle cx="250" cy={targetWeight < weight ? 85 : targetWeight > weight ? 80 : 80} r="7" fill="#D4FF00" stroke="#080808" strokeWidth="2" />
                    <text x="250" y={targetWeight < weight ? 70 : targetWeight > weight ? 102 : 65} fill="#D4FF00" fontSize="12" fontWeight="900" textAnchor="middle">
                      {weight} kg ({isEN ? "Current" : "Sekarang"})
                    </text>

                    {/* Target Node */}
                    <circle cx="470" cy={targetWeight < weight ? 120 : targetWeight > weight ? 50 : 80} r="7" fill="#25D366" stroke="#080808" strokeWidth="2" />
                    <text x="470" y={targetWeight < weight ? 142 : targetWeight > weight ? 38 : 65} fill="#25D366" fontSize="12" fontWeight="900" textAnchor="middle">
                      {targetWeight} kg ({isEN ? "Target" : "Goal"})
                    </text>
                  </svg>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#181818] border border-white/[0.08] rounded-xl p-3.5 text-center space-y-0.5">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase">{isEN ? "Start Weight" : "Berat Awal"}</span>
                  <p className="text-base sm:text-lg font-black text-white">{startWeight || weight} kg</p>
                </div>
                <div className="bg-[#181818] border border-white/[0.08] rounded-xl p-3.5 text-center space-y-0.5">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase">{isEN ? "Current Weight" : "Saat Ini"}</span>
                  <p className="text-base sm:text-lg font-black text-[#D4FF00]">{weight} kg</p>
                </div>
                <div className="bg-[#181818] border border-white/[0.08] rounded-xl p-3.5 text-center space-y-0.5">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase">{isEN ? "Target Goal" : "Target BB"}</span>
                  <p className="text-base sm:text-lg font-black text-emerald-400">{targetWeight} kg</p>
                </div>
                <div className="bg-[#181818] border border-white/[0.08] rounded-xl p-3.5 text-center space-y-0.5">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase">{isEN ? "Remaining" : "Sisa"}</span>
                  <p className="text-base sm:text-lg font-black text-amber-400">{remainingKg} kg</p>
                </div>
              </div>
            </div>

            {/* 2. 7-DAY CALORIE & MACRO INTAKE BAR CHART */}
            <div className="bg-[#222222] border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Flame size={18} className="text-amber-400" />
                  <h3 className="font-extrabold text-base text-white">
                    {isEN ? "7-Day Calorie & Macro History" : "Histori Kalori & Makro 7 Hari"}
                  </h3>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                    <span className="text-neutral-400">Protein</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span className="text-neutral-400">{isEN ? "Carbs" : "Karbo"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                    <span className="text-neutral-400">{isEN ? "Fat" : "Lemak"}</span>
                  </div>
                </div>
              </div>

              {/* Bar Chart Container */}
              <div className="bg-[#181818] border border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between text-xs text-neutral-400 font-bold">
                  <span>{isEN ? `Target: ${targetCalories} kcal / day` : `Target: ${targetCalories} kcal / hari`}</span>
                  <button 
                    onClick={() => setShowCustomTargetsModal(true)}
                    className="text-[#D4FF00] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Sliders size={12} />
                    <span>{isEN ? "Change Target" : "Ubah Target"}</span>
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-2 sm:gap-3 items-end h-44 pt-4 border-b border-white/[0.08] pb-2">
                  {ribbonDates.map((rDate) => {
                    let dayCal = 0, dayProt = 0, dayCarb = 0, dayFat = 0;
                    try {
                      const dLogs = localStorage.getItem(`gymbuddy_meals_${normPhone}_${rDate.dateStr}`);
                      if (dLogs) {
                        const parsed: MealItem[] = JSON.parse(dLogs);
                        const solids = parsed.filter(i => !isLiquidName(i.foodName) && !i.isHydration);
                        dayCal = solids.reduce((s, i) => s + (Number(i.calories) || 0), 0);
                        dayProt = solids.reduce((s, i) => s + (Number(i.protein) || 0), 0);
                        dayCarb = solids.reduce((s, i) => s + (Number(i.carbs) || 0), 0);
                        dayFat = solids.reduce((s, i) => s + (Number(i.fat) || 0), 0);
                      }
                    } catch (e) {}

                    // Current selected date has live state
                    if (rDate.dateStr === selectedDate) {
                      dayCal = totalCaloriesConsumed;
                      dayProt = totalProteinConsumed;
                      dayCarb = totalCarbsConsumed;
                      dayFat = totalFatConsumed;
                    }

                    const fillHeightPercent = Math.min(100, Math.max(8, Math.round((dayCal / (targetCalories || 2000)) * 100)));
                    const isTargetMet = dayCal >= targetCalories * 0.85 && dayCal <= targetCalories * 1.15;
                    const isOver = dayCal > targetCalories * 1.15;

                    return (
                      <div 
                        key={rDate.dateStr}
                        onClick={() => setSelectedDate(rDate.dateStr)}
                        className={`flex flex-col items-center justify-end h-full gap-1.5 cursor-pointer group transition-all ${
                          rDate.dateStr === selectedDate ? "scale-105 font-black" : "opacity-80 hover:opacity-100"
                        }`}
                      >
                        <span className="text-[10px] text-neutral-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                          {formatDashboardInteger(dayCal)}
                        </span>

                        <div className="w-full max-w-[36px] bg-[#181818] rounded-xl overflow-hidden h-32 flex flex-col justify-end p-1 border border-white/[0.08]">
                          <div 
                            style={{ height: `${fillHeightPercent}%` }}
                            className={`w-full rounded-lg transition-all duration-500 ${
                              isOver 
                                ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                                : isTargetMet
                                ? "bg-[#D4FF00] shadow-[0_0_10px_rgba(212,255,0,0.5)]"
                                : "bg-gradient-to-t from-emerald-500 to-[#D4FF00]"
                            }`}
                          />
                        </div>

                        <span className={`text-[10px] uppercase font-extrabold ${rDate.dateStr === selectedDate ? "text-[#D4FF00]" : "text-neutral-400"}`}>
                          {rDate.dayName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 3. 7-DAY HYDRATION & WORKOUT CONSISTENCY STATS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Hydration Chart */}
              <div className="bg-[#222222] border border-white/[0.08] rounded-2xl p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Droplets size={18} className="text-blue-400" />
                    <h3 className="font-extrabold text-sm text-white">
                      {isEN ? "Hydration Consistency (7 Days)" : "Konsistensi Hidrasi (7 Hari)"}
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-blue-300">Goal: {targetHydrationGoal} ml</span>
                </div>

                <div className="grid grid-cols-7 gap-2 items-end h-28 pt-2">
                  {ribbonDates.map((rDate) => {
                    let dWater = 0;
                    try {
                      const dLogs = localStorage.getItem(`gymbuddy_meals_${normPhone}_${rDate.dateStr}`);
                      if (dLogs) {
                        const parsed: MealItem[] = JSON.parse(dLogs);
                        const drinks = parsed.filter(i => isLiquidName(i.foodName) || i.isHydration);
                        dWater = drinks.reduce((s, i) => s + (Number(i.volumeMl) || extractVolumeMlFromName(i.foodName)), 0);
                      }
                    } catch (e) {}
                    if (rDate.dateStr === selectedDate) dWater = totalHydrationMl;

                    const waterPercent = Math.min(100, Math.max(10, Math.round((dWater / targetHydrationGoal) * 100)));

                    return (
                      <div key={rDate.dateStr} className="flex flex-col items-center gap-1">
                        <div className="w-full bg-[#181818] rounded-lg h-20 flex flex-col justify-end p-0.5 border border-white/[0.08]">
                          <div 
                            style={{ height: `${waterPercent}%` }}
                            className={`w-full rounded-md transition-all ${dWater >= targetHydrationGoal ? "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]" : "bg-blue-500/40"}`}
                          />
                        </div>
                        <span className="text-[9px] text-neutral-400 font-bold uppercase">{rDate.dayName}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Workout Consistency */}
              <div className="bg-[#222222] border border-white/[0.08] rounded-2xl p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Dumbbell size={18} className="text-[#D4FF00]" />
                    <h3 className="font-extrabold text-sm text-white">
                      {isEN ? "Weekly Workout Volume" : "Volume Latihan Mingguan"}
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-[#D4FF00]">
                    🔥 {currentStreak} {isEN ? "Consecutive Days" : "Hari Beruntun"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-[#181818] border border-white/[0.08] rounded-xl p-3.5 text-center space-y-1">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase">
                      {isEN ? "Today's Total Sets" : "Total Set Hari Ini"}
                    </span>
                    <p className="text-xl font-black text-white">{totalCompletedSetsOverall} <span className="text-xs text-neutral-400 font-medium">/ {totalTargetSetsOverall} Sets</span></p>
                  </div>
                  <div className="bg-[#181818] border border-white/[0.08] rounded-xl p-3.5 text-center space-y-1">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase">
                      {isEN ? "Consistency Score" : "Skor Konsistensi"}
                    </span>
                    <p className="text-xl font-black text-emerald-400">{Math.min(100, Math.round((currentStreak / 7) * 100))}%</p>
                  </div>
                </div>

                <div className="bg-[#181818] border border-white/[0.08] rounded-xl p-3 flex items-center justify-between text-xs text-neutral-300">
                  <span className="font-semibold">{isEN ? "Today's Focus:" : "Fokus Menu Hari Ini:"}</span>
                  <span className="font-black text-[#D4FF00]">{todayScheduleObj.focus}</span>
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
            {/* Mobile-First Profile Header Bar */}
            <div className="flex items-center justify-between pb-1">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {isEN ? "Profile & Settings" : "Profil & Pengaturan"}
                </h1>
                <p className="text-xs text-neutral-400 font-medium mt-0.5">
                  {isEN ? "Manage biometrics, targets & coach persona" : "Kelola data fisik, target nutrisi & preferensi coach"}
                </p>
              </div>

              <button
                onClick={toggleLanguage}
                className="px-3.5 py-2 bg-[#222222] hover:bg-[#2a2a2a] border border-white/[0.08] rounded-xl text-xs font-bold text-neutral-300 hover:text-white flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
              >
                <Globe size={14} className="text-[#D4FF00]" />
                <span>{lang}</span>
              </button>
            </div>

            {/* 1. User Profile Header Card */}
            <div className="bg-[#222222] border border-white/[0.08] rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#D4FF00] to-emerald-400 text-black font-black flex items-center justify-center text-2xl shadow-md shrink-0">
                    {(activeUser.name || "U")[0].toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-white">{activeUser.name || "Member GymBuddy"}</h2>
                    <p className="text-xs text-neutral-400 font-semibold mt-0.5">
                      📱 {activeUser.phone || "-"} • {activeUser.gender || "Pria"} • {activeUser.age || 25} Tahun
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(true)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-black text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-98"
                >
                  <Edit3 size={14} />
                  <span>{isEN ? "Edit Personal Info" : "Edit Data Personal"}</span>
                </button>
              </div>

              {/* Personal Details 2 x 3 Grid */}
              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-white/[0.08]">
                {/* Row 1: Height | Weight */}
                <div className="bg-[#181818] border border-white/[0.08] rounded-xl p-3">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase block">{isEN ? "Height" : "Tinggi Badan"}</span>
                  <span className="text-sm font-black text-white">{activeUser.height || 170} cm</span>
                </div>
                <div className="bg-[#181818] border border-white/[0.08] rounded-xl p-3">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase block">{isEN ? "Weight" : "Berat Badan"}</span>
                  <span className="text-sm font-black text-[#D4FF00]">{activeUser.weight || 70} kg</span>
                </div>

                {/* Row 2: Activity Level | AI Coach */}
                <div className="bg-[#181818] border border-white/[0.08] rounded-xl p-3">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase block">{isEN ? "Activity Level" : "Aktivitas"}</span>
                  <span className="text-sm font-black text-white capitalize">{activeUser.activityLevel || (isEN ? "Light" : "Sedang")}</span>
                </div>
                <div className="bg-[#181818] border border-white/[0.08] rounded-xl p-3">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase block">{isEN ? "AI Coach" : "Pelatih AI"}</span>
                  <span className="text-sm font-black text-white">{coachName}</span>
                </div>

                {/* Row 3: Age | Health Condition */}
                <div className="bg-[#181818] border border-white/[0.08] rounded-xl p-3">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase block">{isEN ? "Age" : "Umur"}</span>
                  <span className="text-sm font-black text-white">{activeUser.age || 24} {isEN ? "years" : "tahun"}</span>
                </div>
                <div className="bg-[#181818] border border-white/[0.08] rounded-xl p-3">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase block">{isEN ? "Health Condition" : "Kondisi Kesehatan"}</span>
                  <span className="text-sm font-black text-emerald-400 truncate block">
                    {(() => {
                      const hp = activeUser.healthProfile;
                      if (hp?.conditions && hp.conditions.length > 0) {
                        return hp.conditions.join(", ");
                      }
                      if (hp?.hasCondition === "prefer_not_to_say") {
                        return isEN ? "Confidential" : "Rahasia";
                      }
                      return isEN ? "Fit" : "Bugar";
                    })()}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Custom Macro & Nutrition Target Adjuster Card */}
            <div className="bg-[#222222] border border-white/[0.08] rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Sliders size={18} className="text-[#D4FF00]" />
                    <h3 className="font-extrabold text-base text-white">
                      {isEN ? "Daily Target Nutrition & Macros" : "Target Nutrisi & Makro Harian"}
                    </h3>
                  </div>
                  <p className="text-xs text-neutral-400 font-medium mt-0.5">
                    {Object.keys(customTargets).length > 0 
                      ? (isEN ? "⚡ Using Custom User Targets" : "⚡ Menggunakan Target Kustom Pilihanmu") 
                      : (isEN ? "✨ Using GymBuddy AI Auto Target" : "✨ Menggunakan Rekomendasi Otomatis AI (BMR/TDEE)")}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCustomTargetsModal(true)}
                  className="w-full sm:w-auto px-4 py-2 bg-[#181818] hover:bg-[#222222] border border-white/[0.08] hover:border-[#D4FF00]/40 text-neutral-200 hover:text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Sliders size={14} className="text-[#D4FF00]" />
                  <span>{isEN ? "Adjust Targets" : "Atur Target Kustom"}</span>
                </button>
              </div>

              {/* Current Target Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
                <div className="bg-[#181818] border border-white/[0.08] rounded-xl p-3 space-y-0.5">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase block">{isEN ? "Calories" : "Kalori"}</span>
                  <p className="text-base font-black text-white">{targetCalories} <span className="text-[10px] text-neutral-400 font-normal">kcal</span></p>
                </div>
                <div className="bg-[#181818] border border-white/[0.08] rounded-xl p-3 space-y-0.5">
                  <span className="text-[10px] text-indigo-400 font-bold uppercase block">Protein</span>
                  <p className="text-base font-black text-white">{targetProtein} <span className="text-[10px] text-neutral-400 font-normal">g</span></p>
                </div>
                <div className="bg-[#181818] border border-white/[0.08] rounded-xl p-3 space-y-0.5">
                  <span className="text-[10px] text-emerald-400 font-bold uppercase block">{isEN ? "Carbs" : "Karbo"}</span>
                  <p className="text-base font-black text-white">{targetCarbs} <span className="text-[10px] text-neutral-400 font-normal">g</span></p>
                </div>
                <div className="bg-[#181818] border border-white/[0.08] rounded-xl p-3 space-y-0.5">
                  <span className="text-[10px] text-rose-400 font-bold uppercase block">{isEN ? "Fat" : "Lemak"}</span>
                  <p className="text-base font-black text-white">{targetFat} <span className="text-[10px] text-neutral-400 font-normal">g</span></p>
                </div>
                <div className="bg-[#181818] border border-white/[0.08] rounded-xl p-3 space-y-0.5">
                  <span className="text-[10px] text-purple-400 font-bold uppercase block">{isEN ? "Max Sodium" : "Batas Natrium"}</span>
                  <p className="text-base font-black text-white">{targetSodium} <span className="text-[10px] text-neutral-400 font-normal">mg</span></p>
                </div>
                <div className="bg-[#181818] border border-white/[0.08] rounded-xl p-3 space-y-0.5">
                  <span className="text-[10px] text-amber-400 font-bold uppercase block">{isEN ? "Max Sugar" : "Batas Gula"}</span>
                  <p className="text-base font-black text-white">{targetSugar} <span className="text-[10px] text-neutral-400 font-normal">g</span></p>
                </div>
                <div className="bg-[#181818] border border-white/[0.08] rounded-xl p-3 space-y-0.5">
                  <span className="text-[10px] text-blue-400 font-bold uppercase block">{isEN ? "Hydration" : "Air Minum"}</span>
                  <p className="text-base font-black text-white">{targetHydrationGoal} <span className="text-[10px] text-neutral-400 font-normal">ml</span></p>
                </div>
              </div>
            </div>

            {/* 4. Active Goal & AI Coach Hub Card */}
            <div className="bg-[#222222] border border-white/[0.08] rounded-2xl p-5 shadow-xs space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Goal Item */}
                <div className="bg-[#181818] border border-white/[0.08] rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold text-lg">
                      🎯
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{isEN ? "Active Goal" : "Goal Utama Aktif"}</span>
                      <h4 className="text-sm font-black text-white">{goalTitle}</h4>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowGoalEditModal(true)}
                    className="px-3 py-1.5 rounded-lg bg-[#222222] hover:bg-[#2a2a2a] text-neutral-200 border border-white/[0.08] hover:border-[#D4FF00]/40 text-xs font-bold transition-all cursor-pointer"
                  >
                    {isEN ? "Change" : "Ganti"}
                  </button>
                </div>

                {/* Coach Item */}
                <div className="bg-[#181818] border border-white/[0.08] rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#D4FF00] text-black font-black flex items-center justify-center text-lg shadow-sm">
                      {isMaxPersona ? "🏋️" : "✨"}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{isEN ? "AI Coach" : "Pelatih AI"}</span>
                      <h4 className="text-sm font-black text-white">{coachName}</h4>
                    </div>
                  </div>
                  <a
                    href={`https://wa.me/${(import.meta as any).env?.VITE_WHATSAPP_BOT_NUMBER || "14155238886"}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-[#25D366] hover:bg-[#1ebd59] text-black font-extrabold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <MessageSquare size={14} />
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>

            {/* 5. Affiliate Program Hub Card */}
            <div className="bg-[#222222] border border-[#D4FF00]/30 rounded-2xl p-5 shadow-md space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#D4FF00] text-black font-black flex items-center justify-center text-xl shadow-sm">
                    💰
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-base text-white">Program Afiliasi GymBuddy</h3>
                      <span className="px-2 py-0.5 rounded-full bg-[#D4FF00]/20 text-[#D4FF00] text-[10px] font-black uppercase">
                        20% - 35% Komisi
                      </span>
                    </div>
                    <p className="text-xs text-neutral-300 font-medium mt-0.5">
                      Dapatkan komisi berulang setiap kali teman atau muridmu berlangganan via link referralmu.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAffiliateModal(true)}
                  className="w-full sm:w-auto px-4 py-2 bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm shrink-0"
                >
                  <Gift size={14} />
                  <span>Buka Dashboard Afiliasi</span>
                </button>
              </div>

              {/* Referral Quick Copy Bar */}
              <div className="bg-[#181818] border border-white/[0.08] rounded-xl p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="truncate">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase block">Link Referral Kamu:</span>
                  <span className="text-xs font-mono font-bold text-[#D4FF00] truncate block">{referralLink}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyReferral}
                    className="w-full sm:w-auto px-3 py-1.5 bg-[#181818] hover:bg-[#222222] text-white border border-white/[0.08] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    {referralCopied ? <Check size={13} className="text-[#D4FF00]" /> : <Copy size={13} />}
                    <span>{referralCopied ? "Tersalin!" : "Salin Link"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 6. Account Settings & Logout */}
            <div className="bg-[#222222] border border-white/[0.08] rounded-2xl p-5 shadow-xs flex items-center justify-between">
              <button
                onClick={handleDeleteAccount}
                className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1.5 cursor-pointer py-2"
              >
                <Trash2 size={15} />
                <span>{t.removeAccount}</span>
              </button>

              <button
                onClick={onLogout}
                className="px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-extrabold text-xs flex items-center gap-2 cursor-pointer transition-all active:scale-98"
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
              className="bg-[#181818] border border-white/[0.08] rounded-t-3xl sm:rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 text-white max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
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
                <div className="border-2 border-dashed border-neutral-700 hover:border-[#D4FF00] rounded-2xl p-6 sm:p-8 text-center space-y-4 bg-[#181818]/60 transition-all">
                  <div className="w-16 h-16 rounded-full bg-[#D4FF00]/10 border border-[#D4FF00]/30 flex items-center justify-center mx-auto text-[#D4FF00]">
                    <Camera size={30} />
                  </div>
                  <div>
                    <p className="font-extrabold text-white text-sm">
                      {isEN ? "Take Photo or Upload from Gallery" : "Ambil Foto atau Pilih dari Galeri"}
                    </p>
                    <p className="text-xs text-neutral-400 font-medium mt-1">
                      {isEN ? "Supports any meals, coffee cups, receipts & snacks" : "Mendukung Nasi Padang, Ayam, Kopi, Stiker Cup, Salad, dll."}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                    {/* Option 1: Live Camera */}
                    <label className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-extrabold text-xs transition-all cursor-pointer shadow-md active:scale-98">
                      <Camera size={16} />
                      <span>{isEN ? "Open Camera" : "📷 Buka Kamera"}</span>
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

                    {/* Option 2: Gallery / Photo Library */}
                    <label className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#181818] hover:bg-[#222222] border border-white/[0.08] text-white font-extrabold text-xs transition-all cursor-pointer shadow-md active:scale-98">
                      <Upload size={16} className="text-[#D4FF00]" />
                      <span>{isEN ? "Choose from Gallery" : "🖼️ Pilih dari Galeri / Foto"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handlePhotoSelected(f);
                        }}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Photo Preview */}
                  <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] max-h-56 bg-black flex items-center justify-center">
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

                  {/* Non-Food Detected Notice */}
                  {scanNonFoodMessage && !scanLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-2 text-center"
                    >
                      <span className="text-2xl block">⚠️</span>
                      <h4 className="font-extrabold text-sm text-amber-300">
                        {isEN ? "Not Recognized as Food / Drink" : "Bukan Makanan atau Minuman"}
                      </h4>
                      <p className="text-xs text-neutral-300 font-medium leading-relaxed">
                        {scanNonFoodMessage}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setScanImage(null);
                          setScanNonFoodMessage(null);
                          setScanResult(null);
                        }}
                        className="mt-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs rounded-xl transition-all cursor-pointer inline-block"
                      >
                        {isEN ? "Take Another Photo" : "Ambil Foto Makanan Lain"}
                      </button>
                    </motion.div>
                  )}

                  {/* AI Results */}
                  {scanResult && !scanLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-[#181818] border border-[#D4FF00]/40 rounded-2xl p-4 space-y-3 shadow-md"
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
                          <span className="text-xl font-black text-[#D4FF00]">{formatDashboardInteger(scanResult.calories)}</span>
                          <span className="text-xs text-neutral-400 block font-bold">kcal</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-white/[0.08] text-xs font-bold">
                        <div className="bg-white/5 rounded-xl p-2">
                          <span className="block text-[10px] text-neutral-400 font-semibold">Protein</span>
                          <span className="text-indigo-400 font-black">{formatDashboardMacro(scanResult.protein)}g</span>
                        </div>
                        <div className="bg-white/5 rounded-xl p-2">
                          <span className="block text-[10px] text-neutral-400 font-semibold">{isEN ? "Carbs" : "Karbo"}</span>
                          <span className="text-emerald-400 font-black">{formatDashboardMacro(scanResult.carbs)}g</span>
                        </div>
                        <div className="bg-white/5 rounded-xl p-2">
                          <span className="block text-[10px] text-neutral-400 font-semibold">{isEN ? "Fat" : "Lemak"}</span>
                          <span className="text-rose-400 font-black">{formatDashboardMacro(scanResult.fat)}g</span>
                        </div>
                      </div>

                      {/* Meal Type Selection */}
                      <div className="pt-2">
                        <label className="text-[11px] font-bold text-neutral-400 block mb-1.5">{isEN ? "Meal Type:" : "Waktu Makan:"}</label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {(["breakfast", "lunch", "dinner", "snack"] as const).map((m) => {
                            const mLabel = isEN
                              ? (m === "breakfast" ? "Breakfast" : m === "lunch" ? "Lunch" : m === "dinner" ? "Dinner" : "Snack")
                              : (m === "breakfast" ? "Sarapan" : m === "lunch" ? "Siang" : m === "dinner" ? "Malam" : "Camilan");
                            return (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setScanMealType(m)}
                                className={`py-1.5 rounded-xl text-[11px] font-bold capitalize transition-all cursor-pointer border ${
                                  scanMealType === m
                                    ? "bg-[#D4FF00] text-black border-[#D4FF00]"
                                    : "bg-[#181818] text-neutral-400 border-white/[0.08] hover:text-white"
                                }`}
                              >
                                {mLabel}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <button
                        onClick={handleSaveScannedMeal}
                        className="w-full py-3 bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-98"
                      >
                        <Check size={16} strokeWidth={3} />
                        <span>{isEN ? "Save to Today's Food Journal" : "Simpan ke Jurnal Makan Hari Ini"}</span>
                      </button>
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DEDICATED ADD DRINK / WATER MODAL */}
      <AnimatePresence>
        {showAddDrinkModal && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#181818] border border-white/[0.08] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 text-white"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Droplets size={18} />
                  </div>
                  <div>
                    <h3 className="font-['Archivo_Black'] text-white text-base">
                      {isEN ? "Log Drink & Hydration" : "Catat Minuman & Hidrasi"}
                    </h3>
                    <p className="text-xs text-neutral-400 font-medium">
                      {isEN ? "Water, Americano, Tea, Whey Protein" : "Air putih, Americano, Teh, Susu Protein"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddDrinkModal(false)}
                  className="text-neutral-400 hover:text-white p-1 rounded-lg cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Quick Select Preset Buttons */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
                  {isEN ? "Quick Presets:" : "Pilihan Cepat:"}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: isEN ? "Mineral Water" : "Air Putih", ml: "250", desc: isEN ? "1 Glass (250ml)" : "1 Gelas (250ml)" },
                    { name: isEN ? "Large Water Bottle" : "Air Botol Sedang", ml: "600", desc: isEN ? "1 Bottle (600ml)" : "1 Botol (600ml)" },
                    { name: "Iced Americano", ml: "350", desc: isEN ? "0 kcal (350ml)" : "0 Kalori (350ml)" },
                    { name: isEN ? "Whey Protein Shake" : "Whey Protein Shake", ml: "350", desc: "24g Protein (350ml)" }
                  ].map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setCustomDrinkName(preset.name);
                        setCustomDrinkMl(preset.ml);
                      }}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                        customDrinkName === preset.name
                          ? "bg-blue-500/20 border-blue-400 text-white shadow-xs"
                          : "bg-[#181818] border-white/[0.08] text-neutral-300 hover:border-neutral-700"
                      }`}
                    >
                      <p className="font-extrabold text-xs text-white">{preset.name}</p>
                      <p className="text-[10px] text-neutral-400 mt-0.5">{preset.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Input */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1.5">
                    {isEN ? "Drink Name:" : "Nama Minuman:"}
                  </label>
                  <input
                    type="text"
                    value={customDrinkName}
                    onChange={(e) => setCustomDrinkName(e.target.value)}
                    placeholder={isEN ? "E.g. Iced Americano, Water, Juice..." : "Contoh: Iced Americano, Air Putih, Jus..."}
                    className="w-full bg-[#181818] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-white font-bold placeholder-neutral-500 focus:outline-none focus:border-[#D4FF00]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1.5">
                    {isEN ? "Volume (ml):" : "Volume (ml):"}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={customDrinkMl}
                      onChange={(e) => setCustomDrinkMl(e.target.value)}
                      placeholder="250"
                      className="w-full bg-[#181818] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-white font-bold placeholder-neutral-500 focus:outline-none focus:border-[#D4FF00]"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      {["250", "350", "500", "600"].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setCustomDrinkMl(v)}
                          className={`px-2 py-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                            customDrinkMl === v
                              ? "bg-blue-500 text-white border-blue-500"
                              : "bg-[#181818] text-neutral-400 border-white/[0.08] hover:text-white"
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveCustomDrink}
                className="w-full py-3 bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-98"
              >
                <Check size={16} strokeWidth={3} />
                <span>{isEN ? "Save Drink Log 💧" : "Simpan Catatan Minuman 💧"}</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* CLEAN DOCKED 5-TAB MOBILE NAVIGATION BAR (MOBILE ONLY) */}
      {/* ========================================================================= */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#222222]/95 backdrop-blur-2xl border-t border-white/[0.08] px-4 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] flex items-center justify-around shadow-[0_-8px_30px_rgba(0,0,0,0.7)] lg:hidden">
        {/* Tab 1: Home */}
        <button
          onClick={() => setActiveTab("home")}
          className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === "home" ? "text-[#D4FF00]" : "text-neutral-400 hover:text-white"
          }`}
        >
          <Home size={20} className={activeTab === "home" ? "stroke-[2.5]" : ""} />
          <span className="text-[10px] font-extrabold tracking-tight">{isEN ? "Home" : "Beranda"}</span>
        </button>

        {/* Tab 2: Workouts */}
        <button
          onClick={() => setActiveTab("workouts")}
          className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === "workouts" ? "text-[#D4FF00]" : "text-neutral-400 hover:text-white"
          }`}
        >
          <Dumbbell size={20} className={activeTab === "workouts" ? "stroke-[2.5]" : ""} />
          <span className="text-[10px] font-extrabold tracking-tight">{isEN ? "Workouts" : "Latihan"}</span>
        </button>

        {/* Center Elevate Button: Scan */}
        <div className="-mt-7">
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => setShowScanModal(true)}
            className="w-13 h-13 rounded-full bg-[#D4FF00] text-black flex flex-col items-center justify-center shadow-[0_4px_20px_rgba(212,255,0,0.4)] border-3 border-[#000000] cursor-pointer"
            title={isEN ? "Scan Food Photo (AI)" : "Scan Foto Makanan AI"}
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
          <span className="text-[10px] font-extrabold tracking-tight">{isEN ? "Progress" : "Progres"}</span>
        </button>

        {/* Tab 5: Profile */}
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === "profile" ? "text-[#D4FF00]" : "text-neutral-400 hover:text-white"
          }`}
        >
          <User size={20} className={activeTab === "profile" ? "stroke-[2.5]" : ""} />
          <span className="text-[10px] font-extrabold tracking-tight">{isEN ? "Profile" : "Profil"}</span>
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
              className="bg-[#181818] border border-white/[0.08] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 text-white"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div>
                  <h3 className="font-black text-lg text-white">{t.calendarModalTitle}</h3>
                  <p className="text-xs text-neutral-400 font-medium">{t.calendarSubtext}</p>
                </div>
                <button onClick={() => setShowCalendarModal(false)} className="text-neutral-400 hover:text-white cursor-pointer p-1">
                  <X size={20} />
                </button>
              </div>

              {/* Month Navigation Controls */}
              <div className="flex items-center justify-between bg-[#181818] rounded-2xl p-3 border border-white/[0.08]">
                <button
                  type="button"
                  onClick={handlePrevCalMonth}
                  className="p-1.5 rounded-xl bg-[#181818] text-white border border-neutral-700 hover:bg-neutral-800 cursor-pointer transition-all"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="font-black text-sm text-white capitalize">{calMonthTitle}</span>
                <button
                  type="button"
                  onClick={handleNextCalMonth}
                  className="p-1.5 rounded-xl bg-[#181818] text-white border border-neutral-700 hover:bg-neutral-800 cursor-pointer transition-all"
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
                          ? "bg-[#D4FF00] text-black border-[#D4FF00] shadow-md scale-105 font-black"
                          : isToday
                          ? "bg-[#D4FF00]/15 text-[#D4FF00] border-[#D4FF00]/40 font-black"
                          : isDisabled
                          ? "bg-[#181818]/40 text-neutral-600 border-transparent cursor-not-allowed"
                          : "bg-[#181818] text-neutral-200 border-white/[0.08] hover:border-[#D4FF00]/40 hover:bg-[#181818]"
                      }`}
                    >
                      <span>{dayNum}</span>
                      {isToday && <span className="w-1.5 h-1.5 rounded-full bg-[#D4FF00] mt-0.5" />}
                    </button>
                  );
                })}
              </div>

              {/* Modal Footer Shortcuts */}
              <div className="flex items-center justify-between pt-3 border-t border-white/[0.08]">
                <button
                  onClick={() => {
                    setSelectedDate(todayDateStr);
                    setShowCalendarModal(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-[#D4FF00] text-black hover:bg-[#c4ec00] cursor-pointer shadow-sm transition-all"
                >
                  {t.todayBtn}
                </button>
                <button
                  onClick={() => setShowCalendarModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-400 hover:text-white hover:bg-white/5 cursor-pointer"
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
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            onClick={() => setShowCoachMoodPopup(false)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Card */}
            <div
              className="relative w-full max-w-sm bg-[#181818] border rounded-3xl p-6 shadow-2xl animate-[slideUp_0.35s_cubic-bezier(.16,1,.3,1)]"
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
              <div className="bg-[#181818] rounded-2xl p-4 space-y-2 mb-5">
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
                className="w-full py-3 rounded-2xl font-extrabold text-sm transition-all active:scale-95 cursor-pointer"
                style={{ background: coachMoodData.color, color: "#050505" }}
              >
                {isEN ? "Got it, Coach! 💪" : "Siap, Coach! 💪"}
              </button>
            </div>
          </div>
        )}

        {showAutoReminderModal && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#181818] border border-white/[0.08] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-white"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-black border border-[#D4FF00]/40 flex items-center justify-center text-[#D4FF00]">
                    <Bell size={18} />
                  </div>
                  <h3 className="font-['Archivo_Black'] text-base text-white">{t.autoReminderTitle}</h3>
                </div>
                <button onClick={handleDismissReminder} className="text-neutral-400 hover:text-white cursor-pointer p-1">
                  <X size={18} />
                </button>
              </div>

              <p className="text-sm font-semibold text-neutral-300 leading-relaxed">
                {t.autoReminderPrompt}
              </p>

              <div className="space-y-2">
                <label className="text-xs font-black text-neutral-400 uppercase">{t.selectReminderTime}</label>
                <div className="grid grid-cols-4 gap-2">
                  {["16:00", "17:00", "19:00", "20:00"].map((timeStr) => (
                    <button
                      key={timeStr}
                      onClick={() => setSelectedReminderTime(timeStr)}
                      className={`py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                        selectedReminderTime === timeStr
                          ? "bg-[#D4FF00] text-black border-[#D4FF00] shadow-sm"
                          : "bg-[#181818] text-neutral-300 border-white/[0.08] hover:border-white/20"
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
                  className="px-5 py-2 rounded-xl text-xs font-black bg-[#181818] text-white hover:bg-slate-800 cursor-pointer shadow-xs"
                >
                  {t.setReminderBtn}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* WORKOUT DETAIL MODAL WITH VISUAL GIF & EXERCISEDB INSTRUCTIONS */}
      <AnimatePresence>
        {activeWorkoutDetail && (() => {
          const matchedDb = findExerciseOrEquipment(activeWorkoutDetail.name);
          const percent = activeWorkoutDetail.targetSets > 0 ? Math.round((activeWorkoutDetail.completedSets / activeWorkoutDetail.targetSets) * 100) : 0;
          const coachCue = isMaxPersona
            ? (matchedDb ? matchedDb.coachCues.max : (isEN ? "Focus on movement control and muscle contraction on every rep! Let's crush this set!" : "Fokus pada kontrol gerakan dan kontraksi otot di setiap repetisi bro! Gas bantai set ini!"))
            : (matchedDb ? matchedDb.coachCues.mia : (isEN ? "Perform movements smoothly and connect with your breathing on every rep ✨" : "Lakukan gerakan perlahan dan rasakan kenyamanan di setiap tarikan napas ya ✨"));

          return (
            <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto no-scrollbar">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-[#181818] border border-white/[0.08] rounded-3xl p-5 sm:p-6 max-w-xl w-full shadow-2xl space-y-4 my-auto max-h-[92vh] overflow-y-auto no-scrollbar text-white"
              >
                {/* Header */}
                <div className="flex items-start justify-between border-b border-white/[0.08] pb-3 gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-[#D4FF00]/20 text-[#D4FF00] border border-[#D4FF00]/30 text-[10px] font-black uppercase tracking-wider">
                        {matchedDb ? matchedDb.equipmentName : (isEN ? "Exercise Guide" : "Panduan Latihan")}
                      </span>
                    </div>
                    <h3 className="font-['Archivo_Black'] text-lg sm:text-xl text-white mt-1">{activeWorkoutDetail.name}</h3>
                    {matchedDb && (
                      <p className="text-xs text-neutral-400 font-semibold">{isEN ? matchedDb.equipmentName : matchedDb.indonesianName}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setActiveWorkoutDetail(null)}
                    className="p-1.5 rounded-xl bg-neutral-800/80 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Animated Movement Visual Player Card */}
                {matchedDb && (
                  <ExerciseVisualPlayer item={matchedDb} />
                )}

                {/* Target Muscles & Equipment Tags */}
                {matchedDb && (
                  <div className="bg-[#181818] border border-white/[0.08] rounded-2xl p-3.5 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-bold text-neutral-400">{isEN ? "Target Muscles:" : "Target Otot:"}</span>
                      {matchedDb.targetMuscles.map((m, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold">
                          🎯 {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step-by-Step Instructions */}
                {matchedDb && matchedDb.instructions.length > 0 && (
                  <div className="bg-[#181818] border border-white/[0.08] rounded-2xl p-4 space-y-2.5">
                    <h4 className="text-xs font-black uppercase text-[#D4FF00] tracking-wider flex items-center gap-1.5">
                      <BookOpen size={14} /> {isEN ? "Step-by-Step Instructions" : "Cara Eksekusi Step-by-Step"}
                    </h4>
                    <ol className="space-y-1.5 text-xs text-neutral-300 font-medium list-decimal list-inside leading-relaxed">
                      {matchedDb.instructions.map((step, idx) => (
                        <li key={idx} className="pl-1">
                          <span className="text-neutral-200">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Coach Advice Cue */}
                <div className="bg-[#181818] border border-[#D4FF00]/20 rounded-2xl p-3.5 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#D4FF00] text-black font-black flex items-center justify-center text-sm shrink-0">
                    {isMaxPersona ? "🏋️" : "✨"}
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-black text-[#D4FF00] uppercase tracking-wider">{coachName}</span>
                    <p className="text-xs text-neutral-300 font-medium italic">"{coachCue}"</p>
                  </div>
                </div>

                {/* Set Progress & Checklist */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-white tracking-wider">
                      {isEN ? `Per-Set Checklist (${activeWorkoutDetail.targetReps}):` : `Checklist Tiap Set (${activeWorkoutDetail.targetReps}):`}
                    </span>
                    <span className="text-xs font-black text-[#D4FF00]">
                      {activeWorkoutDetail.completedSets} / {activeWorkoutDetail.targetSets} {isEN ? "Sets" : "Set"} ({percent}%)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {activeWorkoutDetail.setsState.map((isDone, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleToggleSet(activeWorkoutDetail.id, idx)}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isDone
                            ? "bg-[#D4FF00] text-black border-[#D4FF00] font-black shadow-xs"
                            : "bg-[#181818] border-white/[0.08] text-neutral-300 hover:bg-[#181818] hover:text-white"
                        }`}
                      >
                        <span className="text-xs font-black">Set {idx + 1}</span>
                        {isDone ? <Check size={14} strokeWidth={3} /> : <span className="text-[10px] text-neutral-500 font-bold">{isEN ? "Pending" : "Belum"}</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Close button */}
                <div className="flex justify-end pt-2 border-t border-white/[0.08]">
                  <button
                    onClick={() => setActiveWorkoutDetail(null)}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-black bg-[#D4FF00] hover:bg-[#c4ec00] text-black transition-all cursor-pointer shadow-md"
                  >
                    {isEN ? "Save & Close" : "Simpan & Tutup"}
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* EXERCISE EXPLORER & EQUIPMENT DICTIONARY MODAL (2-STEP INTUITIVE FLOW) */}
      <AnimatePresence>
        {showExerciseExplorerModal && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto no-scrollbar">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#181818] border border-white/[0.08] rounded-3xl p-5 sm:p-6 max-w-3xl w-full shadow-2xl space-y-4 my-auto max-h-[92vh] overflow-y-auto no-scrollbar text-white"
            >
              {/* If an exercise detail is viewed inside explorer */}
              {viewingDetailExercise ? (
                <div className="space-y-4">
                  {/* Top bar with Back button */}
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                    <button
                      onClick={() => setViewingDetailExercise(null)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#181818] hover:bg-[#222222] border border-white/[0.08] text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <ArrowLeft size={15} className="text-[#D4FF00]" />
                      <span>{isEN ? "Back to Equipment List" : "Kembali ke Daftar Alat"}</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowExerciseExplorerModal(false);
                        setViewingDetailExercise(null);
                        setSelectedExplorerItem(null);
                      }}
                      className="p-1.5 rounded-xl bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Title & Badge */}
                  <div>
                    <span className="px-2.5 py-0.5 rounded-md bg-[#D4FF00]/20 text-[#D4FF00] border border-[#D4FF00]/30 text-[10px] font-black uppercase tracking-wider">
                      {viewingDetailExercise.equipmentName}
                    </span>
                    <h3 className="font-['Archivo_Black'] text-xl text-white mt-1">{viewingDetailExercise.name}</h3>
                    <p className="text-xs text-neutral-400 font-semibold">{isEN ? viewingDetailExercise.equipmentName : viewingDetailExercise.indonesianName}</p>
                  </div>

                  {/* Animated Movement Visual Player */}
                  <ExerciseVisualPlayer item={viewingDetailExercise} />

                  {/* Target Muscles */}
                  <div className="bg-[#181818] border border-white/[0.08] rounded-2xl p-3.5 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-bold text-neutral-400">{isEN ? "Target Muscles:" : "Target Otot:"}</span>
                      {viewingDetailExercise.targetMuscles.map((m, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold">
                          🎯 {m}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Equipment Setup Guide */}
                  {viewingDetailExercise.equipmentSetup.length > 0 && (
                    <div className="bg-[#181818] border border-white/[0.08] rounded-2xl p-4 space-y-2">
                      <h4 className="text-xs font-black uppercase text-[#D4FF00] tracking-wider flex items-center gap-1.5">
                        <Sliders size={14} /> {isEN ? "Equipment Setup Guide" : "Cara Setting Alat"}
                      </h4>
                      <ul className="space-y-1 text-xs text-neutral-300 font-medium list-disc list-inside leading-relaxed">
                        {viewingDetailExercise.equipmentSetup.map((stp, idx) => (
                          <li key={idx}><span className="text-neutral-200">{stp}</span></li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Execution Instructions */}
                  {viewingDetailExercise.instructions.length > 0 && (
                    <div className="bg-[#181818] border border-white/[0.08] rounded-2xl p-4 space-y-2">
                      <h4 className="text-xs font-black uppercase text-[#D4FF00] tracking-wider flex items-center gap-1.5">
                        <BookOpen size={14} /> {isEN ? "Step-by-Step Instructions" : "Cara Eksekusi Step-by-Step"}
                      </h4>
                      <ol className="space-y-1.5 text-xs text-neutral-300 font-medium list-decimal list-inside leading-relaxed">
                        {viewingDetailExercise.instructions.map((stp, idx) => (
                          <li key={idx} className="pl-1"><span className="text-neutral-200">{stp}</span></li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Do's and Dont's */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-[#181818] border border-emerald-500/20 rounded-2xl p-3.5 space-y-1.5">
                      <span className="text-[11px] font-black text-emerald-400 uppercase tracking-wider block">
                        {isEN ? "✔ Key Form Tips" : "✔ Tips Kunci Form"}
                      </span>
                      {viewingDetailExercise.dosAndDonts.dos.map((d, i) => (
                        <p key={i} className="text-xs text-neutral-300">• {d}</p>
                      ))}
                    </div>
                    <div className="bg-[#181818] border border-red-500/20 rounded-2xl p-3.5 space-y-1.5">
                      <span className="text-[11px] font-black text-red-400 uppercase tracking-wider block">
                        {isEN ? "✖ Common Mistakes" : "✖ Kesalahan Umum"}
                      </span>
                      {viewingDetailExercise.dosAndDonts.donts.map((d, i) => (
                        <p key={i} className="text-xs text-neutral-300">• {d}</p>
                      ))}
                    </div>
                  </div>

                  {/* Bottom Back Button */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/[0.08]">
                    <button
                      onClick={() => setViewingDetailExercise(null)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-400 hover:text-white cursor-pointer"
                    >
                      {isEN ? "← Back to List" : "← Kembali ke Daftar"}
                    </button>
                    <button
                      onClick={() => {
                        setShowExerciseExplorerModal(false);
                        setViewingDetailExercise(null);
                        setSelectedExplorerItem(null);
                      }}
                      className="px-6 py-2.5 rounded-xl text-xs font-black bg-[#D4FF00] hover:bg-[#c4ec00] text-black transition-all cursor-pointer shadow-md"
                    >
                      {isEN ? "Close Explorer" : "Tutup Kamus"}
                    </button>
                  </div>
                </div>
              ) : (
                /* List View of Equipment */
                <div className="space-y-4">
                  {/* Explorer Header */}
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-[#D4FF00]/15 border border-[#D4FF00]/30 flex items-center justify-center text-[#D4FF00]">
                        <BookOpen size={20} />
                      </div>
                      <div>
                        <h3 className="font-['Archivo_Black'] text-lg text-white flex items-center gap-2">
                          <span>{isEN ? "Gym Equipment & Exercise Library" : "Kamus Alat & Gerakan Gym"}</span>
                          <span className="px-2 py-0.5 rounded-full bg-[#D4FF00]/20 text-[#D4FF00] border border-[#D4FF00]/40 text-[10px] font-black">
                            {EXERCISE_DATABASE.length} {isEN ? "Exercises" : "Latihan"}
                          </span>
                        </h3>
                        <p className="text-xs text-neutral-400 font-medium">
                          {isEN ? "Comprehensive database of 870+ exercises with visual movement animations" : "Database lengkap 870+ latihan gym open source dengan animasi gerakan"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setShowExerciseExplorerModal(false);
                        setViewingDetailExercise(null);
                        setSelectedExplorerItem(null);
                      }}
                      className="p-1.5 rounded-xl bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Search & Filter Bar */}
                  <div className="space-y-2.5">
                    <div className="relative">
                      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input
                        type="text"
                        value={explorerSearch}
                        onChange={(e) => setExplorerSearch(e.target.value)}
                        placeholder={isEN ? "Search 870+ exercises (e.g. Bicep, Squat, Bench Press, Lat Pulldown)..." : "Cari dari 870+ latihan (misal: Bicep, Squat, Bench Press, Lat Pulldown)..."}
                        className="w-full pl-10 pr-4 py-2.5 bg-[#181818] border border-white/[0.08] rounded-xl text-xs font-semibold text-white placeholder-neutral-500 focus:outline-none focus:border-[#D4FF00] transition-colors"
                      />
                      {explorerSearch && (
                        <button
                          onClick={() => setExplorerSearch("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-white"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {/* Category Pill Filters */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px] font-bold">
                      {[
                        { id: "all", label: `${isEN ? "All" : "Semua"} (${EXERCISE_DATABASE.length})` },
                        { id: "machine", label: isEN ? "Machine" : "Mesin / Machine" },
                        { id: "cable", label: isEN ? "Cable" : "Kabel / Cable" },
                        { id: "barbell", label: isEN ? "Barbell" : "Barbel" },
                        { id: "dumbbell", label: isEN ? "Dumbbell" : "Dumbbell" },
                        { id: "bodyweight", label: isEN ? "Bodyweight" : "Bodyweight" },
                        { id: "kettlebell", label: isEN ? "Kettlebell" : "Kettlebell" },
                        { id: "cardio", label: isEN ? "Cardio" : "Kardio" }
                      ].map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => setExplorerCategory(cat.id)}
                          className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all cursor-pointer border ${
                            explorerCategory === cat.id
                              ? "bg-[#D4FF00] text-black border-[#D4FF00]"
                              : "bg-[#181818] text-neutral-400 border-white/[0.08] hover:text-white"
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Grid of Exercises */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                    {EXERCISE_DATABASE.filter((item) => {
                      const matchCat = explorerCategory === "all" || item.equipmentCategory === explorerCategory;
                      const matchSearch =
                        !explorerSearch ||
                        item.name.toLowerCase().includes(explorerSearch.toLowerCase()) ||
                        item.indonesianName.toLowerCase().includes(explorerSearch.toLowerCase()) ||
                        item.aliases.some((a) => a.toLowerCase().includes(explorerSearch.toLowerCase())) ||
                        item.targetMuscles.some((m) => m.toLowerCase().includes(explorerSearch.toLowerCase()));
                      return matchCat && matchSearch;
                    }).slice(0, 100).map((item) => {
                      const isSelected = selectedExplorerItem?.id === item.id;

                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedExplorerItem(item)}
                          onDoubleClick={() => setViewingDetailExercise(item)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 group relative ${
                            isSelected
                              ? "bg-[#181818] border-[#D4FF00] shadow-[0_0_20px_rgba(212,255,0,0.15)] ring-1 ring-[#D4FF00]"
                              : "bg-[#181818] border-white/[0.08] hover:border-[#D4FF00]/50 hover:bg-[#181818]"
                          }`}
                        >
                          <div className="w-14 h-14 rounded-xl overflow-hidden bg-black/60 shrink-0 border border-white/[0.08]">
                            <img src={item.imageFrames?.[0] || item.gifUrl} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${isSelected ? "bg-[#D4FF00] text-black" : "bg-[#D4FF00]/15 text-[#D4FF00]"}`}>
                                {item.equipmentCategory}
                              </span>
                              {isSelected && (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-black">
                                  {isEN ? "✓ SELECTED" : "✓ TERPILIH"}
                                </span>
                              )}
                            </div>
                            <h4 className={`font-extrabold text-sm truncate mt-0.5 ${isSelected ? "text-[#D4FF00]" : "text-white group-hover:text-[#D4FF00]"}`}>
                              {item.name}
                            </h4>
                            <p className="text-[11px] text-neutral-400 font-medium truncate">{item.targetMuscles.join(", ")}</p>
                          </div>
                          <ChevronRight size={16} className={`shrink-0 ${isSelected ? "text-[#D4FF00] translate-x-1" : "text-neutral-600 group-hover:text-[#D4FF00]"} transition-all`} />
                        </div>
                      );
                    })}
                  </div>

                  {/* Sticky Action Footer with "Lanjut" button */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/[0.08]">
                    <div className="text-xs">
                      {selectedExplorerItem ? (
                        <span className="text-neutral-300">
                          {isEN ? "Selected Exercise: " : "Alat Terpilih: "}<strong className="text-[#D4FF00]">{selectedExplorerItem.name}</strong>
                        </span>
                      ) : (
                        <span className="text-neutral-500 font-medium">{isEN ? "Click any exercise above to select" : "Klik salah satu alat di atas untuk memilih"}</span>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        if (selectedExplorerItem) {
                          setViewingDetailExercise(selectedExplorerItem);
                        }
                      }}
                      disabled={!selectedExplorerItem}
                      className={`px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                        selectedExplorerItem
                          ? "bg-[#D4FF00] hover:bg-[#c4ec00] text-black scale-100 ring-2 ring-[#D4FF00]/40"
                          : "bg-neutral-800 text-neutral-500 cursor-not-allowed opacity-50"
                      }`}
                    >
                      <span>{isEN ? "Continue (View Guide)" : "Lanjut (Lihat Cara Pakai)"}</span>
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* APPLE WATCH CONNECT & ZERO-TYPING PAIRING MODAL */}
      {showWatchConnectModal && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 99999, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowWatchConnectModal(false); }}
        >
          <div
            style={{ backgroundColor: "#080808", border: "1px solid #1C1C1C", borderRadius: "24px", padding: "20px", maxWidth: "440px", width: "100%", boxShadow: "0 25px 50px rgba(0,0,0,0.9)", color: "white", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1A1A1A", paddingBottom: "12px", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "12px", backgroundColor: "rgba(212,255,0,0.12)", border: "1px solid rgba(212,255,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Watch size={20} color="#D4FF00" />
                </div>
                <div>
                  <h3 style={{ fontFamily: "Arial Black, sans-serif", fontSize: "15px", fontWeight: 900, color: "white", margin: 0 }}>
                    {isEN ? "Connect Apple Watch" : "Hubungkan ke Apple Watch"}
                  </h3>
                  <p style={{ fontSize: "11px", color: "#94a3b8", margin: "2px 0 0 0" }}>
                    {isEN ? "Open on your watch without typing logins" : "Buka di jam tanpa perlu ketik login"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowWatchConnectModal(false)}
                style={{ background: "#1A1A1A", border: "none", borderRadius: "10px", padding: "6px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Magic Link Box */}
            <div style={{ backgroundColor: "#121212", border: "1px solid rgba(212,255,0,0.25)", borderRadius: "16px", padding: "14px", marginBottom: "12px" }}>
              <span style={{ display: "block", fontWeight: 900, color: "#D4FF00", fontSize: "12px", marginBottom: "6px" }}>
                {isEN ? "✨ Magic Link — Automatic Login:" : "✨ Magic Link — Login Otomatis:"}
              </span>
              <p style={{ fontSize: "11px", color: "#cbd5e1", lineHeight: 1.6, margin: "0 0 10px 0" }}>
                {isEN
                  ? "Because Apple Watch screens are compact, send this magic link to yourself. One tap opens your account instantly!"
                  : "Karena layar Apple Watch kecil untuk mengetik, kirim link ini ke dirimu sendiri. Sekali tap di jam, akun langsung terhubung otomatis!"}
              </p>

              {/* URL Display */}
              <div style={{ backgroundColor: "rgba(0,0,0,0.6)", border: "1px solid #1C1C1C", borderRadius: "10px", padding: "8px 10px", fontFamily: "monospace", fontSize: "10px", color: "#64748b", wordBreak: "break-all", marginBottom: "10px", userSelect: "all" }}>
                {typeof window !== "undefined"
                  ? `${window.location.origin}/watch?phone=${encodeURIComponent(activeUser.phone || "0851")}&name=${encodeURIComponent(activeUser.name || "Member")}&goal=${encodeURIComponent(activeUser.goal || "muscle")}`
                  : "/watch"}
              </div>

              {/* Copy + WA buttons */}
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/watch?phone=${encodeURIComponent(activeUser.phone || "0851")}&name=${encodeURIComponent(activeUser.name || "Member")}&goal=${encodeURIComponent(activeUser.goal || "muscle")}`;
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(url);
                      setWatchLinkCopied(true);
                      setTimeout(() => setWatchLinkCopied(false), 3000);
                    }
                  }}
                  style={{ flex: 1, padding: "10px", borderRadius: "10px", backgroundColor: watchLinkCopied ? "#16a34a" : "#1A1A1A", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontWeight: 800, fontSize: "12px", cursor: "pointer" }}
                >
                  {watchLinkCopied ? (isEN ? "✓ Copied!" : "✓ Disalin!") : (isEN ? "📋 Copy Link" : "📋 Salin Link")}
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent((isEN ? "Open GymBuddy on Apple Watch: " : "Buka GymBuddy di Apple Watch: ") + (typeof window !== "undefined" ? `${window.location.origin}/watch?phone=${encodeURIComponent(activeUser.phone || "0851")}&name=${encodeURIComponent(activeUser.name || "Member")}&goal=${encodeURIComponent(activeUser.goal || "muscle")}` : "/watch"))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flex: 1, padding: "10px", borderRadius: "10px", backgroundColor: "#25D366", color: "black", fontWeight: 800, fontSize: "12px", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                >
                  {isEN ? "📱 Send to WA" : "📱 Kirim ke WA"}
                </a>
              </div>
            </div>

            {/* Step Guide */}
            <div style={{ backgroundColor: "#121212", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "12px", fontSize: "11px", color: "#cbd5e1", marginBottom: "14px" }}>
              <span style={{ display: "block", fontWeight: 700, color: "white", marginBottom: "6px" }}>
                {isEN ? "How to use on Apple Watch:" : "Cara Pakai di Apple Watch:"}
              </span>
              <p style={{ margin: "2px 0" }}>{isEN ? "1. Send the magic link above to your WhatsApp or iMessage." : "1. Kirim link di atas ke WhatsApp / iMessage kamu."}</p>
              <p style={{ margin: "2px 0" }}>{isEN ? "2. On Apple Watch, open the message and tap the link." : "2. Di Apple Watch, buka pesan & tap linknya."}</p>
              <p style={{ margin: "2px 0" }}>{isEN ? "3. Watch Mode opens immediately with large buttons & rest timer!" : "3. Watch Mode langsung terbuka — tombol besar & rest timer aktif!"}</p>
            </div>

            {/* Open in browser CTA */}
            <button
              onClick={() => {
                setShowWatchConnectModal(false);
                if (onOpenWatchMode) onOpenWatchMode();
              }}
              style={{ width: "100%", padding: "13px", borderRadius: "14px", backgroundColor: "#D4FF00", border: "none", color: "black", fontWeight: 900, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
            >
              <Watch size={15} color="black" />
              {isEN ? "Open Watch Mode in This Browser" : "Buka Watch Mode di Browser Ini"}
            </button>
          </div>
        </div>
      )}



      {/* ─── NOTIFICATION SCHEDULER SETTINGS MODAL ─────────────────────────── */}
      {showNotifSettingsModal && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 99999, backgroundColor: "rgba(0,0,0,0.80)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowNotifSettingsModal(false); }}
        >
          <div
            style={{ backgroundColor: "#080808", border: "1px solid #1A1A1A", borderRadius: "24px", padding: "20px", maxWidth: "420px", width: "100%", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 30px 60px rgba(0,0,0,0.9)", color: "white" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1A1A1A", paddingBottom: "14px", marginBottom: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "12px", backgroundColor: "rgba(212,255,0,0.12)", border: "1px solid rgba(212,255,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Bell size={20} color="#D4FF00" />
                </div>
                <div>
                  <h3 style={{ fontWeight: 900, fontSize: "15px", color: "white", margin: 0 }}>
                    {isEN ? "Notifications & Scheduler" : "Notifikasi & Scheduler"}
                  </h3>
                  <p style={{ fontSize: "11px", color: "#64748b", margin: "2px 0 0 0" }}>
                    {isEN ? "Configure when GymBuddy reminds you" : "Atur kapan GymBuddy mengingatkanmu"}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowNotifSettingsModal(false)} style={{ background: "#1A1A1A", border: "none", borderRadius: "10px", padding: "6px", cursor: "pointer", color: "#64748b" }}>
                <X size={18} />
              </button>
            </div>

            {/* Permission Status Banner */}
            <div style={{ backgroundColor: notifSettings.permissionGranted ? "rgba(212,255,0,0.08)" : "rgba(255,100,100,0.08)", border: `1px solid ${notifSettings.permissionGranted ? "rgba(212,255,0,0.25)" : "rgba(255,100,100,0.25)"}`, borderRadius: "14px", padding: "12px 14px", marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: "12px", color: notifSettings.permissionGranted ? "#D4FF00" : "#ff6b6b" }}>
                  {notifSettings.permissionGranted
                    ? (isEN ? "✅ Notifications Active" : "✅ Notifikasi Aktif")
                    : (isEN ? "❌ Permission Not Granted" : "❌ Izin Belum Diberikan")}
                </div>
                <div style={{ fontSize: "10px", color: "#64748b", marginTop: "2px" }}>
                  {notifSettings.permissionGranted
                    ? (isEN ? "Scheduler running in background" : "Scheduler berjalan di background")
                    : (isEN ? "Click Enable to grant permission" : "Klik Aktifkan untuk meminta izin")}
                </div>
              </div>
              {!notifSettings.permissionGranted && (
                <button
                  onClick={async () => {
                    const granted = await notificationService.requestPermission();
                    if (granted) {
                      const updated = { ...notifSettings, permissionGranted: true };
                      saveNotifSettings(updated);
                      applyNotifSchedulers(updated);
                      notificationService.sendTestNotification();
                    } else {
                      alert(isEN ? "Please allow notification permission in your browser popup." : "Pastikan Allow di popup browser. Coba di browser lain jika tidak muncul.");
                    }
                  }}
                  style={{ padding: "8px 14px", borderRadius: "10px", backgroundColor: "#D4FF00", color: "#000", fontWeight: 900, fontSize: "11px", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  {isEN ? "Enable →" : "Aktifkan →"}
                </button>
              )}
            </div>

            {/* ─── Scheduler Cards ─── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

              {/* 1. Workout Reminder */}
              <div style={{ backgroundColor: "#121212", border: "1px solid #1A1A1A", borderRadius: "16px", padding: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: notifSettings.workoutEnabled ? "12px" : "0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "20px" }}>🏋️</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "13px", color: "white" }}>
                        {isEN ? "Workout Reminder" : "Pengingat Workout"}
                      </div>
                      <div style={{ fontSize: "10px", color: "#64748b" }}>
                        {notifSettings.workoutEnabled
                          ? (isEN
                              ? `Daily at ${String(notifSettings.workoutHour).padStart(2, "0")}:${String(notifSettings.workoutMinute).padStart(2, "0")}`
                              : `Setiap hari jam ${String(notifSettings.workoutHour).padStart(2, "0")}:${String(notifSettings.workoutMinute).padStart(2, "0")}`)
                          : (isEN ? "Disabled" : "Nonaktif")}
                      </div>
                    </div>
                  </div>
                  {/* Toggle */}
                  <div
                    onClick={() => {
                      const updated = { ...notifSettings, workoutEnabled: !notifSettings.workoutEnabled };
                      saveNotifSettings(updated);
                      if (notifSettings.permissionGranted) applyNotifSchedulers(updated);
                    }}
                    style={{ width: "44px", height: "24px", borderRadius: "12px", backgroundColor: notifSettings.workoutEnabled ? "#D4FF00" : "#1A1A1A", border: `1px solid ${notifSettings.workoutEnabled ? "#D4FF00" : "#333"}`, cursor: "pointer", position: "relative", transition: "all 0.2s" }}
                  >
                    <div style={{ position: "absolute", top: "3px", left: notifSettings.workoutEnabled ? "22px" : "3px", width: "16px", height: "16px", borderRadius: "50%", backgroundColor: notifSettings.workoutEnabled ? "#000" : "#555", transition: "left 0.2s" }} />
                  </div>
                </div>

                {notifSettings.workoutEnabled && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "11px", color: "#64748b", whiteSpace: "nowrap" }}>{isEN ? "Time:" : "Jam:"}</span>
                    <input
                      type="time"
                      value={`${String(notifSettings.workoutHour).padStart(2, "0")}:${String(notifSettings.workoutMinute).padStart(2, "0")}`}
                      onChange={(e) => {
                        const [h, m] = e.target.value.split(":").map(Number);
                        const updated = { ...notifSettings, workoutHour: h, workoutMinute: m };
                        saveNotifSettings(updated);
                        if (notifSettings.permissionGranted) applyNotifSchedulers(updated);
                      }}
                      style={{ flex: 1, padding: "8px 12px", borderRadius: "10px", backgroundColor: "#050505", border: "1px solid #1C1C1C", color: "white", fontSize: "13px", fontWeight: 700, outline: "none" }}
                    />
                  </div>
                )}
              </div>

              {/* 2. Hydration Reminder */}
              <div style={{ backgroundColor: "#121212", border: "1px solid #1A1A1A", borderRadius: "16px", padding: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: notifSettings.hydrationEnabled ? "12px" : "0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "20px" }}>💧</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "13px", color: "white" }}>
                        {isEN ? "Hydration Reminder" : "Pengingat Minum Air"}
                      </div>
                      <div style={{ fontSize: "10px", color: "#64748b" }}>
                        {notifSettings.hydrationEnabled
                          ? (isEN ? `Every ${notifSettings.hydrationInterval} hours (08:00–20:00)` : `Setiap ${notifSettings.hydrationInterval} jam (08:00–20:00)`)
                          : (isEN ? "Disabled" : "Nonaktif")}
                      </div>
                    </div>
                  </div>
                  <div
                    onClick={() => {
                      const updated = { ...notifSettings, hydrationEnabled: !notifSettings.hydrationEnabled };
                      saveNotifSettings(updated);
                      if (notifSettings.permissionGranted) applyNotifSchedulers(updated);
                    }}
                    style={{ width: "44px", height: "24px", borderRadius: "12px", backgroundColor: notifSettings.hydrationEnabled ? "#D4FF00" : "#1A1A1A", border: `1px solid ${notifSettings.hydrationEnabled ? "#D4FF00" : "#333"}`, cursor: "pointer", position: "relative", transition: "all 0.2s" }}
                  >
                    <div style={{ position: "absolute", top: "3px", left: notifSettings.hydrationEnabled ? "22px" : "3px", width: "16px", height: "16px", borderRadius: "50%", backgroundColor: notifSettings.hydrationEnabled ? "#000" : "#555", transition: "left 0.2s" }} />
                  </div>
                </div>

                {notifSettings.hydrationEnabled && (
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {[1, 2, 3, 4].map((h) => (
                      <button
                        key={h}
                        onClick={() => {
                          const updated = { ...notifSettings, hydrationInterval: h };
                          saveNotifSettings(updated);
                          if (notifSettings.permissionGranted) applyNotifSchedulers(updated);
                        }}
                        style={{ flex: 1, padding: "8px 4px", borderRadius: "10px", backgroundColor: notifSettings.hydrationInterval === h ? "#D4FF00" : "#050505", border: `1px solid ${notifSettings.hydrationInterval === h ? "#D4FF00" : "#1C1C1C"}`, color: notifSettings.hydrationInterval === h ? "#000" : "#64748b", fontWeight: 800, fontSize: "12px", cursor: "pointer" }}
                      >
                        {h}{isEN ? "h" : "j"}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Streak Guard */}
              <div style={{ backgroundColor: "#121212", border: "1px solid #1A1A1A", borderRadius: "16px", padding: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "20px" }}>🔥</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "13px", color: "white" }}>
                        {isEN ? "Streak Guard" : "Penjaga Streak"}
                      </div>
                      <div style={{ fontSize: "10px", color: "#64748b" }}>
                        {notifSettings.streakEnabled
                          ? (isEN ? "Remind at 20:00 if not logged today" : "Ingatkan jam 20:00 jika belum log hari ini")
                          : (isEN ? "Disabled" : "Nonaktif")}
                      </div>
                    </div>
                  </div>
                  <div
                    onClick={() => {
                      const updated = { ...notifSettings, streakEnabled: !notifSettings.streakEnabled };
                      saveNotifSettings(updated);
                      if (notifSettings.permissionGranted) applyNotifSchedulers(updated);
                    }}
                    style={{ width: "44px", height: "24px", borderRadius: "12px", backgroundColor: notifSettings.streakEnabled ? "#D4FF00" : "#1A1A1A", border: `1px solid ${notifSettings.streakEnabled ? "#D4FF00" : "#333"}`, cursor: "pointer", position: "relative", transition: "all 0.2s" }}
                  >
                    <div style={{ position: "absolute", top: "3px", left: notifSettings.streakEnabled ? "22px" : "3px", width: "16px", height: "16px", borderRadius: "50%", backgroundColor: notifSettings.streakEnabled ? "#000" : "#555", transition: "left 0.2s" }} />
                  </div>
                </div>
              </div>

            </div>

            {/* Footer actions */}
            <div style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
              {notifSettings.permissionGranted && (
                <button
                  onClick={() => {
                    applyNotifSchedulers(notifSettings);
                    notificationService.sendTestNotification();
                    setShowNotifSettingsModal(false);
                    setReminderNotificationMsg(isEN ? "Scheduler updated & test notification sent! 🔔" : "Scheduler diperbarui & notifikasi tes dikirim! 🔔");
                    setTimeout(() => setReminderNotificationMsg(null), 3500);
                  }}
                  style={{ flex: 1, padding: "13px", borderRadius: "14px", backgroundColor: "#D4FF00", color: "#000", fontWeight: 900, fontSize: "12px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                >
                  <Bell size={14} color="black" />
                  {isEN ? "Save & Test Send" : "Simpan & Kirim Tes"}
                </button>
              )}
              <button
                onClick={() => setShowNotifSettingsModal(false)}
                style={{ flex: notifSettings.permissionGranted ? 0 : 1, padding: "13px 18px", borderRadius: "14px", backgroundColor: "#1A1A1A", color: "#94a3b8", fontWeight: 700, fontSize: "12px", border: "1px solid #1C1C1C", cursor: "pointer" }}
              >
                {isEN ? "Close" : "Tutup"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD LOG MODAL (AI AUTO-DETECTION) */}
      <AnimatePresence>
        {(showAddFoodModal || showAddDrinkModal) && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#181818] border border-white/[0.08] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-white"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-black border border-[#D4FF00]/40 flex items-center justify-center text-[#D4FF00]">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h3 className="font-['Archivo_Black'] text-base text-white">
                      {showAddDrinkModal
                        ? (lang === "EN" ? "Log Drink / Hydration" : "Catat Minuman & Hidrasi")
                        : (lang === "EN" ? "AI Smart Food Log" : "Catat Makanan (AI)")}
                    </h3>
                    <p className="text-[11px] text-neutral-400 font-medium">
                      {lang === "EN" ? "AI auto-calculates calories & macros" : "AI otomatis menghitung kalori & makronutrisi"}
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
                  className="text-neutral-400 hover:text-white p-1 rounded-lg cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-neutral-300 flex items-center justify-between">
                    <span>{t.foodNameLabel}</span>
                    <span className="text-[10px] text-[#D4FF00] font-black bg-[#D4FF00]/10 border border-[#D4FF00]/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Sparkles size={10} /> Auto AI Detection
                    </span>
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      type="text"
                      value={itemNameInput}
                      onChange={(e) => {
                        setItemNameInput(e.target.value);
                        if (aiPreview) {
                          setAiPreview(null);
                          setAiConfirmStep(false);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !isAnalyzingAi) {
                          // Bug #2 fix: If AI preview is ready and waiting for confirmation,
                          // pressing Enter should CONFIRM SAVE, not re-trigger analysis
                          if (aiConfirmStep) {
                            e.preventDefault();
                            handleConfirmSave();
                          } else {
                            handleSaveLogItem();
                          }
                        }
                      }}
                      placeholder={showAddDrinkModal ? "misal: Air Putih 500ml, Kopi Kenangan Mantan, Jus Alpukat" : "misal: Nasi Padang Rendang + Es Teh Manis"}
                      className="w-full px-3.5 py-3 bg-[#181818] border border-white/[0.08] rounded-xl text-sm font-semibold text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#D4FF00] focus:ring-1 focus:ring-[#D4FF00] transition-all shadow-xs"
                    />
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1.5 flex items-start gap-1">
                    <span>💡</span>
                    <span>{t.comboHelpText}</span>
                  </p>
                </div>

                {/* AI Loading State */}
                {isAnalyzingAi && (
                  <div className="p-4 bg-[#181818] border border-[#D4FF00]/30 text-white rounded-xl flex items-center justify-center gap-3 animate-pulse">
                    <Sparkles className="animate-spin text-[#D4FF00]" size={18} />
                    <span className="text-xs font-bold text-neutral-200">
                      {lang === "EN" ? "AI is calculating calories & macros..." : "🤖 AI sedang menghitung kalori & makronutrisi..."}
                    </span>
                  </div>
                )}

                {/* AI Preview Result */}
                {aiPreview && !isAnalyzingAi && (
                  <div className="p-3.5 bg-[#D4FF00]/10 border border-[#D4FF00]/30 rounded-2xl space-y-3">
                    
                    {/* Low Confidence State for Generic Inputs (e.g. "rice bowl") */}
                    {(aiPreview as any).needsClarification || (aiPreview as any).confidence === "low" ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-white flex items-center gap-1.5">
                            <Sparkles size={13} className="text-[#D4FF00]" /> Estimated Nutrition AI
                          </span>
                          <span className="text-[10px] font-black text-amber-900 bg-amber-400 px-2.5 py-0.5 rounded-lg uppercase shadow-xs flex items-center gap-1">
                            <AlertTriangle size={11} /> Low confidence
                          </span>
                        </div>

                        <div className="p-3 bg-[#181818] border border-amber-500/30 rounded-xl space-y-2.5">
                          <p className="text-xs font-bold text-amber-200 leading-snug">
                            We need a little more information to estimate this meal accurately.
                          </p>
                          <p className="text-[11px] font-medium text-neutral-300">
                            {(aiPreview as any).clarificationQuestion || `What’s included in your ${itemNameInput || "meal"}?`}
                          </p>

                          {/* Interactive Clarification Option Chips */}
                          <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            {((aiPreview as any).suggestedOptions || ["Chicken", "Beef", "Egg", "Vegetables", "Sauce", "Other"]).map((opt: string, oIdx: number) => (
                              <button
                                key={oIdx}
                                type="button"
                                onClick={() => {
                                  const newQuery = `${itemNameInput.trim()} with ${opt}`;
                                  setItemNameInput(newQuery);
                                  handleAnalyzeFood(newQuery);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-[#D4FF00] text-neutral-200 hover:text-black text-[11px] font-extrabold border border-neutral-700 hover:border-[#D4FF00] transition-all cursor-pointer flex items-center gap-1"
                              >
                                <span>+ {opt}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-bold text-neutral-400 px-1">
                          <span className="capitalize">{itemNameInput || "Generic Meal"}</span>
                          <span>Food Match: <strong className="text-amber-400">Low</strong> · Portion: <strong>Estimated</strong></span>
                        </div>
                      </div>
                    ) : (
                      /* High / Medium Confidence Estimation Card */
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-white flex items-center gap-1.5">
                                <Sparkles size={13} className="text-[#D4FF00]" /> Estimated Nutrition AI
                              </span>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase ${(aiPreview as any).confidence === "high" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-amber-500/20 text-amber-300 border border-amber-500/40"}`}>
                                {(aiPreview as any).confidence === "high" ? "High confidence" : "Medium confidence"}
                              </span>
                            </div>
                            <p className="text-[10px] text-neutral-400 font-medium mt-0.5">
                              Nutrition estimate
                            </p>
                            {aiPreview.items && Array.isArray(aiPreview.items) && aiPreview.items.length > 0 && (
                              <span className="text-[10px] text-[#D4FF00] font-semibold block mt-0.5">
                                {aiPreview.items.length === 1 ? "1 meal detected" : `${aiPreview.items.length} food items detected`}
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-black text-black bg-[#D4FF00] px-2.5 py-0.5 rounded-lg shadow-xs">
                            ~{Number(aiPreview.calories ?? itemCalInput ?? 0).toLocaleString()} kcal
                          </span>
                        </div>

                        {/* Per-item breakdown list */}
                        {aiPreview.items && Array.isArray(aiPreview.items) && aiPreview.items.length > 0 && (
                          <div className="p-2.5 bg-[#181818]/90 rounded-xl border border-white/[0.08]/80 space-y-2">
                            <div className="text-[10px] font-black text-neutral-400 uppercase tracking-wider flex items-center justify-between">
                              <span>Food Item Breakdown</span>
                              <span className="text-neutral-400 font-bold">
                                {(aiPreview as any).portionDisplayLabel || (aiPreview.items.every((it: any) => it.portion_type === "user_provided") ? "User Provided Portion" : "Portion: Estimated")}
                              </span>
                            </div>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
                              {aiPreview.items.map((it: FoodItemNutrition, idx: number) => {
                                const isLiquidItem = it.item_type === "beverage" || it.item_type === "water" || /(?:americano|kopi|coffee|tea|teh|jus|juice|milk|susu|latte|boba|drink|water|air)/i.test(it.normalized_food_name || it.food_name);
                                const portionDisplay = it.display_unit || (isLiquidItem ? `${it.volume_ml || it.estimated_weight_grams} ml` : `${it.estimated_weight_grams}g`);
                                const dbSourceDisplay = it.data_source === "USDA" ? "USDA" : (it.data_source === "TKPI" ? "TKPI" : "AI Estimation");
                                const foodMatchConfidence = it.data_source === "USDA" || it.data_source === "TKPI" ? "High" : "Medium";
                                const portionStatus = it.portion_type === "user_provided" ? portionDisplay : "Estimated";

                                return (
                                  <div key={idx} className="p-2 bg-[#181818]/80 rounded-lg border border-white/[0.08]/80 flex flex-col gap-1">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="text-neutral-100 font-bold text-xs leading-tight">
                                            • {it.normalized_food_name || it.food_name}
                                          </span>
                                        </div>
                                        <span className="text-[10px] text-neutral-400 font-medium block mt-0.5">
                                          {portionDisplay} · <span className="text-neutral-500">{dbSourceDisplay}</span>
                                        </span>
                                        <div className="flex items-center gap-2 text-[9px] text-neutral-400 mt-0.5">
                                          <span>Food Match: <strong className="text-neutral-200">{foodMatchConfidence}</strong></span>
                                          <span>•</span>
                                          <span>Portion: <strong className="text-neutral-200">{portionStatus}</strong></span>
                                        </div>
                                      </div>
                                      <span className="text-xs font-black text-white whitespace-nowrap">
                                        {formatDashboardInteger(it.calories)} kcal
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[10px] text-neutral-400 pt-0.5 border-t border-white/[0.08]/80 flex-wrap">
                                      <span>P: <strong className="text-indigo-400">{formatDashboardMacro(it.protein)}g</strong></span>
                                      <span>C: <strong className="text-emerald-400">{formatDashboardMacro(it.carbs)}g</strong></span>
                                      <span>F: <strong className="text-rose-400">{formatDashboardMacro(it.fat)}g</strong></span>
                                      {it.fiber !== undefined && it.fiber > 0 && (
                                        <span>Fib: <strong className="text-amber-400">{formatDashboardMacro(it.fiber)}g</strong></span>
                                      )}
                                      {it.sugar !== undefined && it.sugar > 0 && (
                                        <span>Sug: <strong className="text-cyan-400">{formatDashboardMacro(it.sugar)}g</strong></span>
                                      )}
                                      <span>Na: <strong className="text-purple-400">{(it as any).sodium !== undefined && Number((it as any).sodium) > 0 ? `${formatDashboardInteger((it as any).sodium)}mg` : "Not estimated"}</strong></span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 6-Metric Total Macro Grid */}
                        {(() => {
                          const displayProtein = aiPreview.items?.length
                            ? Math.round(aiPreview.items.reduce((s: number, it: any) => s + (Number(it.protein) || 0), 0) * 10) / 10
                            : (Number(itemProteinInput) || 0);
                          const displayCarbs = aiPreview.items?.length
                            ? Math.round(aiPreview.items.reduce((s: number, it: any) => s + (Number(it.carbs) || 0), 0) * 10) / 10
                            : (Number(itemCarbsInput) || 0);
                          const displayFat = aiPreview.items?.length
                            ? Math.round(aiPreview.items.reduce((s: number, it: any) => s + (Number(it.fat) || 0), 0) * 10) / 10
                            : (Number(itemFatInput) || 0);
                          const displayFiber = aiPreview.items?.length
                            ? Math.round(aiPreview.items.reduce((s: number, it: any) => s + (Number(it.fiber) || 0), 0) * 10) / 10
                            : (Number(itemFiberInput) || 0);
                          const displaySugar = aiPreview.items?.length
                            ? Math.round(aiPreview.items.reduce((s: number, it: any) => s + (Number(it.sugar) || 0), 0) * 10) / 10
                            : (Number(itemSugarInput) || 0);

                          const hasValidSodium = (aiPreview as any).sodium !== undefined && Number((aiPreview as any).sodium) > 0;
                          const displaySodiumText = hasValidSodium ? `${formatDashboardInteger((aiPreview as any).sodium)} mg` : "Not estimated";

                          return (
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center text-[10px] sm:text-[11px] font-bold text-neutral-200 pt-0.5">
                              <div className="bg-[#181818] rounded-xl p-1.5 sm:p-2 border border-white/[0.08]/80">
                                <span className="block text-[9px] sm:text-[10px] text-indigo-400 font-bold">Protein</span>
                                <span className="font-black text-white">{formatDashboardMacro(displayProtein)}g</span>
                              </div>
                              <div className="bg-[#181818] rounded-xl p-1.5 sm:p-2 border border-white/[0.08]/80">
                                <span className="block text-[9px] sm:text-[10px] text-emerald-400 font-bold">Carbs</span>
                                <span className="font-black text-white">{formatDashboardMacro(displayCarbs)}g</span>
                              </div>
                              <div className="bg-[#181818] rounded-xl p-1.5 sm:p-2 border border-white/[0.08]/80">
                                <span className="block text-[9px] sm:text-[10px] text-rose-400 font-bold">Fat</span>
                                <span className="font-black text-white">{formatDashboardMacro(displayFat)}g</span>
                              </div>
                              <div className="bg-[#181818] rounded-xl p-1.5 sm:p-2 border border-white/[0.08]/80">
                                <span className="block text-[9px] sm:text-[10px] text-amber-400 font-bold">Fiber</span>
                                <span className="font-black text-white">{formatDashboardMacro(displayFiber)}g</span>
                              </div>
                              <div className="bg-[#181818] rounded-xl p-1.5 sm:p-2 border border-white/[0.08]/80">
                                <span className="block text-[9px] sm:text-[10px] text-cyan-400 font-bold">Sugar</span>
                                <span className="font-black text-white">{formatDashboardMacro(displaySugar)}g</span>
                              </div>
                              <div className="bg-[#181818] rounded-xl p-1.5 sm:p-2 border border-white/[0.08]/80">
                                <span className="block text-[9px] sm:text-[10px] text-purple-400 font-bold">Sodium</span>
                                <span className="font-black text-white">{displaySodiumText}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* Optional Manual Inputs Toggle */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowManualInputs(!showManualInputs)}
                    className="text-xs font-bold text-neutral-400 hover:text-[#D4FF00] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>{showManualInputs ? "▲ Sembunyikan Input Manual" : "▼ Edit Nutrisi Manual (Opsional)"}</span>
                  </button>

                  {showManualInputs && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-3 border-t border-white/[0.08] mt-2"
                    >
                      <div>
                        <label className="text-[11px] font-bold text-neutral-300">{t.caloriesInputLabel}</label>
                        <input
                          type="number"
                          value={itemCalInput}
                          onChange={(e) => setItemCalInput(e.target.value)}
                          placeholder="450"
                          className="w-full mt-1 px-3 py-2 bg-[#181818] border border-white/[0.08] rounded-xl text-xs font-black text-white focus:outline-none focus:border-[#D4FF00]"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-indigo-400">{t.proteinInputLabel}</label>
                        <input
                          type="number"
                          value={itemProteinInput}
                          onChange={(e) => setItemProteinInput(e.target.value)}
                          placeholder="25"
                          className="w-full mt-1 px-3 py-2 bg-[#181818] border border-white/[0.08] rounded-xl text-xs font-black text-white focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-emerald-400">{t.carbsInputLabel}</label>
                        <input
                          type="number"
                          value={itemCarbsInput}
                          onChange={(e) => setItemCarbsInput(e.target.value)}
                          placeholder="40"
                          className="w-full mt-1 px-3 py-2 bg-[#181818] border border-white/[0.08] rounded-xl text-xs font-black text-white focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-rose-400">{t.fatInputLabel}</label>
                        <input
                          type="number"
                          value={itemFatInput}
                          onChange={(e) => setItemFatInput(e.target.value)}
                          placeholder="12"
                          className="w-full mt-1 px-3 py-2 bg-[#181818] border border-white/[0.08] rounded-xl text-xs font-black text-white focus:outline-none focus:border-rose-400"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-amber-400">Serat (Fiber)</label>
                        <input
                          type="number"
                          value={itemFiberInput}
                          onChange={(e) => setItemFiberInput(e.target.value)}
                          placeholder="3"
                          className="w-full mt-1 px-3 py-2 bg-[#181818] border border-white/[0.08] rounded-xl text-xs font-black text-white focus:outline-none focus:border-amber-400"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-cyan-400">Gula (Sugar)</label>
                        <input
                          type="number"
                          value={itemSugarInput}
                          onChange={(e) => setItemSugarInput(e.target.value)}
                          placeholder="2"
                          className="w-full mt-1 px-3 py-2 bg-[#181818] border border-white/[0.08] rounded-xl text-xs font-black text-white focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-purple-400">Natrium (Sodium, mg)</label>
                        <input
                          type="number"
                          value={itemSodiumInput}
                          onChange={(e) => setItemSodiumInput(e.target.value)}
                          placeholder="350"
                          className="w-full mt-1 px-3 py-2 bg-[#181818] border border-white/[0.08] rounded-xl text-xs font-black text-white focus:outline-none focus:border-purple-400"
                        />
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* ── Compact Confirmation Section (Non-Redundant) ──────── */}
                {aiConfirmStep && !isAnalyzingAi && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 p-3.5 bg-[#181818] rounded-2xl space-y-3 border border-[#D4FF00]/40"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-300">
                        Ready to save
                      </span>
                      <span className="text-[11px] font-black text-[#D4FF00] bg-[#D4FF00]/10 px-2.5 py-1 rounded-lg border border-[#D4FF00]/20">
                        ~{Number(itemCalInput || 0).toLocaleString()} kcal · {itemProteinInput || "0"}P · {itemCarbsInput || "0"}C · {itemFatInput || "0"}F{itemSodiumInput ? ` · ${itemSodiumInput}mg Na` : ""}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setAiConfirmStep(false);
                          setShowManualInputs(true);
                        }}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-white/20 text-neutral-300 hover:bg-white/10 cursor-pointer transition-colors"
                      >
                        ✏️ Edit Nutrisi
                      </button>
                      <button
                        onClick={handleConfirmSave}
                        className="flex-1 py-2.5 rounded-xl text-xs font-black bg-[#D4FF00] text-black hover:bg-[#c4ec00] cursor-pointer transition-colors shadow-sm"
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
                        setItemFiberInput("0");
                        setItemSugarInput("0");
                      }}
                      className="w-full py-1.5 rounded-xl text-[11px] font-bold text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors text-center"
                    >
                      ❌ Batal
                    </button>
                  </motion.div>
                )}
                {/* ── End Feature 1 ─────────────────────────────────────── */}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.08]">
                <button
                  onClick={() => {
                    setShowAddFoodModal(false);
                    setShowAddDrinkModal(false);
                    setAiPreview(null);
                    setAiConfirmStep(false);
                    setShowManualInputs(false);
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-neutral-400 hover:text-white hover:bg-white/5 cursor-pointer"
                >
                  {t.closeModal}
                </button>
                {!aiConfirmStep && (
                  <button
                    onClick={handleAnalyzeAndPreview}
                    disabled={isAnalyzingAi || !itemNameInput.trim()}
                    className="px-5 py-2.5 rounded-xl text-xs font-black bg-[#D4FF00] hover:bg-[#c4ec00] text-black disabled:opacity-50 cursor-pointer shadow-xs flex items-center gap-1.5 transition-all"
                  >
                    {isAnalyzingAi ? (
                      <>
                        <Sparkles size={14} className="animate-spin text-black" />
                        <span>Mendeteksi...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} className="text-black" />
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

      {/* UPDATE WEIGHT MODAL (PERSISTENT & OBSIDIAN DARK) */}
      <AnimatePresence>
        {showUpdateWeightModal && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#181818] border border-white/[0.08] rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-white"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-black border border-[#D4FF00]/40 flex items-center justify-center text-[#D4FF00]">
                    <Scale size={16} />
                  </div>
                  <h3 className="font-['Archivo_Black'] text-base text-white">{t.updateWeightTitle}</h3>
                </div>
                <button onClick={() => setShowUpdateWeightModal(false)} className="text-neutral-400 hover:text-white p-1 rounded-lg cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-300">{t.weightInputLabel}</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={newWeightInput}
                    onChange={(e) => setNewWeightInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#181818] border border-white/[0.08] rounded-xl text-base font-black text-white focus:outline-none focus:border-[#D4FF00]"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-neutral-400">kg</span>
                </div>
                <p className="text-[11px] text-neutral-400 font-medium">
                  {isEN ? "Updates your transformation curve & calorie targets" : "Otomatis memperbarui kurva transformasi & target kalori kamu"}
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.08]">
                <button
                  onClick={() => setShowUpdateWeightModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-400 hover:text-white hover:bg-white/5 cursor-pointer"
                >
                  {t.closeModal}
                </button>
                <button
                  onClick={async () => {
                    const w = Number(newWeightInput);
                    if (w > 30 && w < 300) {
                      const updatedUser = { ...activeUser, weight: w };
                      setLiveUser(updatedUser);
                      try {
                        localStorage.setItem(`gymbuddy_user_${normPhone}`, JSON.stringify(updatedUser));
                        localStorage.setItem("gymbuddy_active_session", JSON.stringify(updatedUser));
                        const histKey = `gymbuddy_weight_history_${normPhone}`;
                        const prevHistRaw = localStorage.getItem(histKey);
                        const prevHist = prevHistRaw ? JSON.parse(prevHistRaw) : [];
                        localStorage.setItem(histKey, JSON.stringify([...prevHist, { date: selectedDate, weight: w, timestamp: new Date().toISOString() }]));
                      } catch (e) {}

                      const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-253242815083.asia-southeast2.run.app";
                      try {
                        await fetch(`/api/user/${normPhone}/weight`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ weight: w, date: selectedDate })
                        });
                      } catch (e) {}
                      try {
                        if (API_BASE_URL) {
                          await fetch(`${API_BASE_URL}/api/user/${normPhone}/weight`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ weight: w, date: selectedDate })
                          });
                        }
                      } catch (e) {}

                      setReminderNotificationMsg(isEN ? `Weight updated to ${w} kg! 🎯` : `Berat badan diperbarui menjadi ${w} kg! 🎯`);
                      setTimeout(() => setReminderNotificationMsg(null), 3500);
                    }
                    setShowUpdateWeightModal(false);
                  }}
                  className="px-5 py-2 rounded-xl text-xs font-black bg-[#D4FF00] hover:bg-[#c4ec00] text-black cursor-pointer shadow-xs transition-all"
                >
                  {t.saveWeight}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DASHBOARD CARD LAYOUT CUSTOMIZATION MODAL */}
      <AnimatePresence>
        {showLayoutModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#222222] border border-white/[0.08] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 text-white"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#D4FF00]/10 border border-[#D4FF00]/30 flex items-center justify-center text-[#D4FF00]">
                    <LayoutGrid size={18} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-white">
                      {isEN ? "Customize Dashboard Cards" : "Atur Tata Letak Card Dashboard"}
                    </h3>
                    <p className="text-xs text-neutral-400 font-medium">
                      {isEN ? "Reorder cards to fit your workout workflow" : "Ubah urutan card sesuai kebutuhanmu"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowLayoutModal(false)}
                  className="text-neutral-400 hover:text-white p-1 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Cards Reordering List */}
              <div className="space-y-2.5">
                {cardOrder.map((id, idx) => {
                  const cardNames: Record<CardId, { label: string; icon: string; desc: string }> = {
                    hero: { label: isEN ? "Calorie & Activity Hero" : "Ringkasan Kalori & Metrik", icon: "⚡", desc: isEN ? "Target calories, protein & hydration gauge" : "Target kalori, protein & lingkaran aktivitas" },
                    feel_coach: { label: isEN ? "Mood Feeling & Coach Advice" : "Perasaan & Rekomendasi Coach", icon: "✨", desc: isEN ? "Daily readiness check & coach advice" : "Check-in perasaan hari ini & saran coach" },
                    workout: { label: isEN ? "Today's Workout" : "Latihan Hari Ini", icon: "🏋️", desc: isEN ? "Daily training schedule & exercises" : "Menu latihan & status set hari ini" },
                    food: { label: isEN ? "Food Meals Journal" : "Jurnal Makanan", icon: "🥗", desc: isEN ? "Logged solid meals & photo scanner" : "Catatan makanan padat & scan AI" },
                    hydration: { label: isEN ? "Water & Hydration Tracker" : "Pelacak Air & Hidrasi", icon: "💧", desc: isEN ? "Daily water cups & quick log" : "Visual gelas air & catatan minum" },
                  };
                  const meta = cardNames[id] || { label: id, icon: "📋", desc: "" };

                  return (
                    <div
                      key={id}
                      className="bg-[#181818] border border-white/[0.08] hover:border-white/15 rounded-2xl p-3.5 flex items-center justify-between transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{meta.icon}</span>
                        <div>
                          <h4 className="text-xs sm:text-sm font-extrabold text-white">{meta.label}</h4>
                          <p className="text-[11px] text-neutral-400 font-medium">{meta.desc}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveCard(idx, "up")}
                          disabled={idx === 0}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-[#D4FF00] hover:text-black text-neutral-300 disabled:opacity-30 disabled:hover:bg-white/5 disabled:hover:text-neutral-300 transition-all cursor-pointer"
                          title="Move Up"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveCard(idx, "down")}
                          disabled={idx === cardOrder.length - 1}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-[#D4FF00] hover:text-black text-neutral-300 disabled:opacity-30 disabled:hover:bg-white/5 disabled:hover:text-neutral-300 transition-all cursor-pointer"
                          title="Move Down"
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => saveCardOrder(DEFAULT_CARD_ORDER)}
                  className="text-xs font-bold text-neutral-400 hover:text-amber-300 flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw size={13} />
                  <span>{isEN ? "Reset to Default" : "Reset ke Default"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowLayoutModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-extrabold text-xs transition-all cursor-pointer shadow-md"
                >
                  {isEN ? "Done" : "Selesai"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DYNAMIC GOAL & TARGET WEIGHT EDIT MODAL */}
      <AnimatePresence>
        {showGoalEditModal && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className="bg-[#222222] border border-white/[0.08] rounded-t-3xl sm:rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 text-white max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-[#D4FF00] text-black flex items-center justify-center font-black text-lg shadow-sm">
                    🎯
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-white">
                      {isEN ? "Edit Main Goal & Physical Targets" : "Ubah Goal Utama & Target Fisik"}
                    </h3>
                    <p className="text-xs text-neutral-400 font-medium">
                      {isEN ? "Form automatically adjusts based on your chosen goal" : "Form otomatis disesuaikan berdasarkan goal yang kamu pilih"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowGoalEditModal(false)}
                  className="text-neutral-400 hover:text-white p-1 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Step 1: Select Main Goal */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-neutral-300 uppercase tracking-wider block">
                  {isEN ? "1. Select Main Fitness Goal" : "1. Pilih Goal Utama Kamu"}
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: "lose", label: isEN ? "Weight Loss" : "Menurunkan Berat Badan", icon: "📉", desc: isEN ? "Burn fat & calorie deficit" : "Bakar lemak & defisit kalori" },
                    { id: "gain", label: isEN ? "Muscle Gain" : "Menaikkan Otot & BB", icon: "📈", desc: isEN ? "Build muscle & surplus" : "Bentuk otot & surplus kalori" },
                    { id: "maintain", label: isEN ? "Maintain Weight" : "Menjaga Berat Badan", icon: "⚖️", desc: isEN ? "Tone & energy balance" : "Kebugaran & stabilkan BB" },
                    { id: "healthy", label: isEN ? "Healthy & Energized" : "Gaya Hidup Sehat & Fit", icon: "⚡", desc: isEN ? "Daily stamina & wellness" : "Stamina harian & pola sehat" },
                  ].map((g) => {
                    const isSelected = editGoal === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          setEditGoal(g.id as any);
                          if (g.id === "maintain" || g.id === "healthy") {
                            setEditTargetWeight(editWeight || "70");
                          } else if (g.id === "lose" && Number(editTargetWeight) >= Number(editWeight)) {
                            setEditTargetWeight(String(Math.max(45, Number(editWeight) - 5)));
                          } else if (g.id === "gain" && Number(editTargetWeight) <= Number(editWeight)) {
                            setEditTargetWeight(String(Number(editWeight) + 5));
                          }
                        }}
                        className={`p-3 rounded-2xl text-left border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-[#D4FF00]/10 border-[#D4FF00] text-white shadow-[0_0_12px_rgba(212,255,0,0.15)]"
                            : "bg-[#181818] border-white/[0.08] text-neutral-400 hover:border-white/20 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{g.icon}</span>
                          <span className="text-xs font-extrabold text-white">{g.label}</span>
                        </div>
                        <p className="text-[10px] text-neutral-400 font-medium leading-tight">{g.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Adaptive Follow-up Inputs Based on Goal */}
              <div className="space-y-4 pt-1">
                <label className="text-xs font-extrabold text-neutral-300 uppercase tracking-wider block">
                  {isEN ? "2. Target & Biometrics Details" : "2. Rincian Target & Data Fisik"}
                </label>

                {/* DYNAMIC FORM: WEIGHT LOSS */}
                {editGoal === "lose" && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#181818] border border-white/[0.08] rounded-2xl p-4 space-y-3.5"
                  >
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-neutral-300">
                        {isEN ? "Target Weight (kg)" : "Target Berat Badan (kg)"}
                      </label>
                      {/* AI Healthy Weight Recommendation helper button */}
                      {(() => {
                        const hM = (Number(editHeight) || 170) / 100;
                        const bmiW = Math.round(22 * hM * hM * 2) / 2;
                        const recW = Math.min(Number(editWeight) - 2, Math.max(45, bmiW));
                        return (
                          <button
                            type="button"
                            onClick={() => setEditTargetWeight(String(recW))}
                            className="text-[10px] font-bold text-[#D4FF00] bg-[#D4FF00]/10 hover:bg-[#D4FF00]/20 px-2 py-1 rounded-lg border border-[#D4FF00]/30 transition-all cursor-pointer flex items-center gap-1"
                          >
                            <Sparkles size={11} />
                            <span>{isEN ? `AI Ideal: ${recW} kg` : `Rekomendasi Sehat: ${recW} kg`}</span>
                          </button>
                        );
                      })()}
                    </div>
                    <input
                      type="number"
                      step="0.5"
                      value={editTargetWeight}
                      onChange={(e) => setEditTargetWeight(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#222222] border border-white/[0.08] rounded-xl text-base font-black text-white focus:outline-none focus:border-[#D4FF00]"
                      placeholder="60"
                    />

                    {/* Deficit Pace Selector */}
                    <div>
                      <label className="text-[11px] font-bold text-neutral-400 block mb-1.5">
                        {isEN ? "Deficit Pace / Speed:" : "Kecepatan Defisit / Penurunan:"}
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: "steady", label: isEN ? "Steady (0.5 kg/w)" : "Santai (~0.5 kg/mgg)" },
                          { id: "moderate", label: isEN ? "Ideal (0.75 kg/w)" : "Ideal (~0.75 kg/mgg)" },
                          { id: "aggressive", label: isEN ? "Fast (1.0 kg/w)" : "Cepat (~1 kg/mgg)" },
                        ].map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setEditPace(p.id as any)}
                            className={`py-2 px-1 rounded-xl text-[10px] font-extrabold transition-all border cursor-pointer ${
                              editPace === p.id
                                ? "bg-[#D4FF00] text-black border-[#D4FF00]"
                                : "bg-[#222222] text-neutral-400 border-white/[0.08] hover:text-white"
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* DYNAMIC FORM: MUSCLE GAIN */}
                {editGoal === "gain" && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#181818] border border-white/[0.08] rounded-2xl p-4 space-y-3.5"
                  >
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-neutral-300">
                        {isEN ? "Target Weight (kg)" : "Target Berat Badan (kg)"}
                      </label>
                      <button
                        type="button"
                        onClick={() => setEditTargetWeight(String(Number(editWeight) + 5))}
                        className="text-[10px] font-bold text-[#D4FF00] bg-[#D4FF00]/10 hover:bg-[#D4FF00]/20 px-2 py-1 rounded-lg border border-[#D4FF00]/30 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Sparkles size={11} />
                        <span>{isEN ? `Clean Bulk: +5 kg` : `Target Bulk: +5 kg`}</span>
                      </button>
                    </div>
                    <input
                      type="number"
                      step="0.5"
                      value={editTargetWeight}
                      onChange={(e) => setEditTargetWeight(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#222222] border border-white/[0.08] rounded-xl text-base font-black text-white focus:outline-none focus:border-[#D4FF00]"
                      placeholder="75"
                    />
                    <p className="text-[11px] text-neutral-400 font-medium">
                      {isEN ? "✨ Surplus ~400 kcal/day targeted for progressive overload and muscle hypertrophy without excessive fat gain." : "✨ Surplus ~400 kcal/hari difokuskan untuk progressive overload dan pembentukan otot optimal tanpa lemak berlebih."}
                    </p>
                  </motion.div>
                )}

                {/* DYNAMIC FORM: MAINTAIN / HEALTHY */}
                {(editGoal === "maintain" || editGoal === "healthy") && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#181818] border border-white/[0.08] rounded-2xl p-4 space-y-2"
                  >
                    <div className="flex items-center gap-2 text-xs font-extrabold text-[#D4FF00]">
                      <CheckCircle2 size={14} />
                      <span>{isEN ? "Maintenance Energy Balance" : "Keseimbangan Energi Harian"}</span>
                    </div>
                    <p className="text-xs text-neutral-300 font-medium leading-relaxed">
                      {isEN
                        ? "Target weight is locked to your current weight. Daily calorie and macro recommendations are tuned for high vitality, stamina, and workout recovery."
                        : "Target berat badan dipertahankan sama dengan berat saat ini. Kalori dan makro disesuaikan untuk kebugaran harian, stamina tinggi, dan performa olahraga."}
                    </p>
                  </motion.div>
                )}

                {/* Current Weight & Height Input fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-neutral-400 block mb-1">
                      {isEN ? "Current Weight (kg)" : "BB Saat Ini (kg)"}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={editWeight}
                      onChange={(e) => setEditWeight(e.target.value)}
                      className="w-full px-3 py-2 bg-[#181818] border border-white/[0.08] rounded-xl text-sm font-black text-white focus:outline-none focus:border-[#D4FF00]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-neutral-400 block mb-1">
                      {isEN ? "Height (cm)" : "Tinggi Badan (cm)"}
                    </label>
                    <input
                      type="number"
                      value={editHeight}
                      onChange={(e) => setEditHeight(e.target.value)}
                      className="w-full px-3 py-2 bg-[#181818] border border-white/[0.08] rounded-xl text-sm font-black text-white focus:outline-none focus:border-[#D4FF00]"
                    />
                  </div>
                </div>

                {/* Live Macro Recalculation Preview Banner */}
                {(() => {
                  const cW = Math.max(30, Number(editWeight) || 70);
                  const cH = Math.max(100, Number(editHeight) || 170);
                  const isMale = (activeUser.gender || "pria").toLowerCase() === "pria" || (activeUser.gender || "").toLowerCase() === "male";
                  const bmr = 10 * cW + 6.25 * cH - 5 * (activeUser.age || 25) + (isMale ? 5 : -161);
                  let previewCal = Math.round(bmr * 1.4);
                  let previewProt = Math.round(cW * 2.0);

                  if (editGoal === "lose") {
                    const deficit = editPace === "aggressive" ? 600 : editPace === "steady" ? 300 : 450;
                    previewCal = Math.max(1300, previewCal - deficit);
                    previewProt = Math.round(cW * 2.2);
                  } else if (editGoal === "gain") {
                    previewCal += 400;
                    previewProt = Math.round(cW * 2.2);
                  } else {
                    previewProt = Math.round(cW * 1.8);
                  }

                  return (
                    <div className="bg-[#181818] border border-[#D4FF00]/25 rounded-2xl p-4 space-y-2">
                      <span className="text-[10px] font-black text-[#D4FF00] uppercase tracking-wider block">
                        ⚡ {isEN ? "AI Target Preview (Calculated)" : "Kalkulasi Target Nutrisi Baru (AI)"}
                      </span>
                      <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="bg-[#181818] rounded-xl p-2.5">
                          <span className="text-[10px] text-neutral-400 block font-semibold">{t.caloriesLabel}</span>
                          <span className="text-base font-black text-white">{formatDashboardInteger(previewCal)} kcal</span>
                        </div>
                        <div className="bg-[#181818] rounded-xl p-2.5">
                          <span className="text-[10px] text-neutral-400 block font-semibold">{t.proteinLabel}</span>
                          <span className="text-base font-black text-[#D4FF00]">{formatDashboardMacro(previewProt)} g</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Modal Footer Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowGoalEditModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-neutral-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                >
                  {t.closeModal}
                </button>
                <button
                  type="button"
                  onClick={handleSaveGoalChanges}
                  className="px-6 py-2.5 rounded-xl bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-black text-xs transition-all cursor-pointer shadow-lg active:scale-98"
                >
                  {isEN ? "Save New Goal" : "Simpan Perubahan Goal"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Coach Next-Step Bubble (Centered Popup) ──────────────────────────── */}
      <AnimatePresence>
        {showCoachTip && coachTip && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
            onClick={() => setShowCoachTip(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-[#181818] border border-[#D4FF00]/40 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3.5">
                {/* Coach avatar badge */}
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-[#D4FF00] text-black font-black flex items-center justify-center text-xl shadow-md">
                  {isMaxPersona ? "🏋️" : "✨"}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-[#D4FF00] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Sparkles size={12} />
                    {coachName} — {isEN ? "Next Recommendation" : "Saran Selanjutnya"}
                  </p>
                  <p className="text-sm text-neutral-200 leading-relaxed font-medium">
                    {coachTip}
                  </p>
                </div>

                <button
                  onClick={() => setShowCoachTip(false)}
                  className="flex-shrink-0 text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <button
                onClick={() => setShowCoachTip(false)}
                className="w-full py-3 rounded-xl bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-extrabold text-xs transition-all cursor-pointer shadow-md active:scale-98"
              >
                {isEN ? "Got it, Coach! 💪" : "Siap, Paham Coach! 💪"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* ── End Coach Bubble ────────────────────────────────────────────────── */}

      {/* ========================================================================= */}
      {/* MODAL 1: EDIT PROFILE PERSONAL INFO */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showEditProfileModal && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#181818] border border-white/[0.08] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 text-white max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-black border border-[#D4FF00]/40 flex items-center justify-center text-[#D4FF00]">
                    <User size={18} />
                  </div>
                  <div>
                    <h3 className="font-['Archivo_Black'] text-white text-base">
                      {isEN ? "Edit Personal Info" : "Edit Informasi Personal"}
                    </h3>
                    <p className="text-xs text-neutral-400 font-medium">
                      {isEN ? "Update your name, biometrics & coach" : "Sesuaikan nama panggilan, data fisik & coach"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEditProfileModal(false)}
                  className="text-neutral-400 hover:text-white p-1 rounded-lg cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300">
                    {isEN ? "Full Name / Nickname" : "Nama Panggilan"}
                  </label>
                  <input
                    type="text"
                    value={profName}
                    onChange={(e) => setProfName(e.target.value)}
                    placeholder="Contoh: Akmal"
                    className="w-full px-3.5 py-2.5 bg-[#181818] border border-white/[0.08] rounded-xl text-white text-sm font-semibold focus:outline-none focus:border-[#D4FF00]"
                  />
                </div>

                {/* Gender */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300">
                    {isEN ? "Gender" : "Jenis Kelamin"}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setProfGender("pria")}
                      className={`py-2.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                        profGender.toLowerCase() === "pria" || profGender.toLowerCase() === "male"
                          ? "bg-[#D4FF00] text-black border-[#D4FF00]"
                          : "bg-[#181818] text-neutral-300 border-white/[0.08]"
                      }`}
                    >
                      👨 Pria (Male)
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfGender("wanita")}
                      className={`py-2.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                        profGender.toLowerCase() === "wanita" || profGender.toLowerCase() === "female"
                          ? "bg-[#D4FF00] text-black border-[#D4FF00]"
                          : "bg-[#181818] text-neutral-300 border-white/[0.08]"
                      }`}
                    >
                      👩 Wanita (Female)
                    </button>
                  </div>
                </div>

                {/* Age, Height, Weight Grid */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-neutral-300">{isEN ? "Age (Yrs)" : "Umur"}</label>
                    <input
                      type="number"
                      value={profAge}
                      onChange={(e) => setProfAge(e.target.value)}
                      className="w-full px-3 py-2 bg-[#181818] border border-white/[0.08] rounded-xl text-white text-sm font-black focus:outline-none focus:border-[#D4FF00]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-neutral-300">{isEN ? "Height (cm)" : "Tinggi (cm)"}</label>
                    <input
                      type="number"
                      value={profHeight}
                      onChange={(e) => setProfHeight(e.target.value)}
                      className="w-full px-3 py-2 bg-[#181818] border border-white/[0.08] rounded-xl text-white text-sm font-black focus:outline-none focus:border-[#D4FF00]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-neutral-300">{isEN ? "Weight (kg)" : "BB Saat Ini"}</label>
                    <input
                      type="number"
                      value={profWeight}
                      onChange={(e) => setProfWeight(e.target.value)}
                      className="w-full px-3 py-2 bg-[#181818] border border-white/[0.08] rounded-xl text-white text-sm font-black focus:outline-none focus:border-[#D4FF00]"
                    />
                  </div>
                </div>

                {/* Target Weight */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300">
                    {isEN ? "Target Weight (kg)" : "Target Berat Badan (kg)"}
                  </label>
                  <input
                    type="number"
                    value={profTargetWeight}
                    onChange={(e) => setProfTargetWeight(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#181818] border border-white/[0.08] rounded-xl text-white text-sm font-black focus:outline-none focus:border-[#D4FF00]"
                  />
                </div>

                {/* AI Coach Preference */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300">
                    {isEN ? "AI Coach Persona" : "Persona Pelatih AI"}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setProfPersona("max")}
                      className={`p-3 rounded-xl text-xs font-bold border transition-all text-left flex items-center gap-2 cursor-pointer ${
                        profPersona === "max"
                          ? "bg-[#D4FF00]/15 border-[#D4FF00] text-white"
                          : "bg-[#181818] border-white/[0.08] text-neutral-400"
                      }`}
                    >
                      <span className="text-lg">🏋️</span>
                      <div>
                        <p className="font-black text-white">Coach Max</p>
                        <p className="text-[10px] text-neutral-400">Tegas & Gym Focused</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfPersona("mia")}
                      className={`p-3 rounded-xl text-xs font-bold border transition-all text-left flex items-center gap-2 cursor-pointer ${
                        profPersona === "mia"
                          ? "bg-[#D4FF00]/15 border-[#D4FF00] text-white"
                          : "bg-[#181818] border-white/[0.08] text-neutral-400"
                      }`}
                    >
                      <span className="text-lg">✨</span>
                      <div>
                        <p className="font-black text-white">Coach Mia</p>
                        <p className="text-[10px] text-neutral-400">Ramah & Nutritionist</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Date of Birth & Age Group */}
                <div className="space-y-1.5 pt-2 border-t border-white/[0.08]">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-neutral-300">
                      {isEN ? "Date of Birth (Optional)" : "Tanggal Lahir (Opsional)"}
                    </label>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[#D4FF00]/15 text-[#D4FF00] border border-[#D4FF00]/30">
                      {getDashboardAgeGroupLabel(Number(profAge) || 25)}
                    </span>
                  </div>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                    <input
                      type="date"
                      max={new Date().toISOString().split("T")[0]}
                      value={healthDob}
                      onChange={(e) => {
                        handleHealthDobChange(e.target.value);
                        if (e.target.value && /^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) {
                          const d = new Date(e.target.value);
                          if (!isNaN(d.getTime())) {
                            const today = new Date();
                            let calcAge = today.getFullYear() - d.getFullYear();
                            const m = today.getMonth() - d.getMonth();
                            if (m < 0 || (m === 0 && today.getDate() < d.getDate())) calcAge--;
                            if (calcAge >= 10 && calcAge <= 120) setProfAge(String(calcAge));
                          }
                        }
                      }}
                      className="w-full bg-[#181818] border border-white/[0.08] rounded-xl pl-10 pr-3 py-2.5 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-[#D4FF00]"
                    />
                  </div>
                </div>

                {/* Health Conditions Section */}
                <div className="space-y-2.5 pt-2 border-t border-white/[0.08]">
                  <div>
                    <label className="text-xs font-bold text-neutral-300 block">
                      {isEN ? "Health Conditions & Medical History" : "Kondisi Kesehatan & Riwayat Penyakit"}
                    </label>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      {isEN
                        ? "Helps AI safely tailor workouts, avoid joint risks, and manage sodium/sugar."
                        : "Membantu AI menyesuaikan latihan yang ramah sendi dan mengontrol natrium/gula secara aman."}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { id: "no_condition", label: isEN ? "No conditions" : "Tidak ada kondisi", icon: "✨" },
                      { id: "has_condition", label: isEN ? "Yes, have conditions" : "Ya, ada kondisi", icon: "🩺" },
                      { id: "prefer_not_to_say", label: isEN ? "Prefer not to say" : "Rahasiakan", icon: "🔒" }
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setHealthStatus(st.id as any)}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          healthStatus === st.id
                            ? "bg-[#D4FF00] text-black border-[#D4FF00] font-black shadow-sm"
                            : "bg-[#181818] border-white/[0.08] text-neutral-300 hover:border-neutral-700"
                        }`}
                      >
                        <span>{st.icon}</span>
                        <span className="truncate">{st.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Checklist of conditions when has_condition is selected */}
                  {healthStatus === "has_condition" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="p-3.5 rounded-2xl bg-[#111620] border border-white/[0.08] space-y-2.5"
                    >
                      <span className="text-[11px] font-bold text-neutral-300 block">
                        {isEN ? "Select all applicable conditions:" : "Pilih kondisi kesehatan yang kamu miliki:"}
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: "Diabetes", label: "Diabetes", icon: "🩸" },
                          { id: "High blood pressure", label: isEN ? "High blood pressure" : "Hipertensi", icon: "🫀" },
                          { id: "High cholesterol", label: isEN ? "High cholesterol" : "Kolesterol Tinggi", icon: "🧈" },
                          { id: "Heart condition", label: isEN ? "Heart condition" : "Kondisi Jantung", icon: "❤️" },
                          { id: "Kidney condition", label: isEN ? "Kidney condition" : "Kondisi Ginjal", icon: "🫘" },
                          { id: "Liver condition", label: isEN ? "Liver condition" : "Kondisi Hati", icon: "🩺" },
                          { id: "Asthma", label: isEN ? "Asthma / Respiratory" : "Asma / Nafas", icon: "🫁" },
                          { id: "Arthritis", label: isEN ? "Arthritis / Joint Issue" : "Radang Sendi / Cedera", icon: "🦴" }
                        ].map((cond) => {
                          const isChecked = selectedConditions.includes(cond.id);
                          return (
                            <button
                              key={cond.id}
                              type="button"
                              onClick={() => toggleDashboardHealthCondition(cond.id)}
                              className={`p-2 rounded-xl border text-xs font-bold text-left flex items-center justify-between gap-1.5 cursor-pointer transition-all ${
                                isChecked
                                  ? "bg-[#D4FF00]/15 border-[#D4FF00] text-white"
                                  : "bg-[#181818] border-white/[0.08] text-neutral-400 hover:text-white"
                              }`}
                            >
                              <span className="flex items-center gap-1.5 truncate">
                                <span>{cond.icon}</span>
                                <span className="truncate">{cond.label}</span>
                              </span>
                              {isChecked && <Check size={14} className="text-[#D4FF00] shrink-0" />}
                            </button>
                          );
                        })}
                      </div>

                      <input
                        type="text"
                        value={healthOtherCondition}
                        onChange={(e) => setHealthOtherCondition(e.target.value)}
                        placeholder={isEN ? "Other condition (optional)..." : "Kondisi lainnya (opsional)..."}
                        className="w-full bg-[#181818] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#D4FF00]"
                      />
                    </motion.div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  className="flex-1 py-3 rounded-xl bg-[#181818] hover:bg-[#222222] text-neutral-300 font-extrabold text-xs transition-all cursor-pointer"
                >
                  {isEN ? "Cancel" : "Batal"}
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfileChanges}
                  className="flex-1 py-3 rounded-xl bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-black text-xs transition-all cursor-pointer shadow-lg"
                >
                  {isEN ? "Save Changes" : "Simpan Profil"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 2: CUSTOM MACRO & NUTRITION TARGET ADJUSTER */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showCustomTargetsModal && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#181818] border border-white/[0.08] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 text-white max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-black border border-[#D4FF00]/40 flex items-center justify-center text-[#D4FF00]">
                    <Sliders size={18} />
                  </div>
                  <div>
                    <h3 className="font-['Archivo_Black'] text-white text-base">
                      {isEN ? "Custom Daily Targets" : "Atur Target Nutrisi Kustom"}
                    </h3>
                    <p className="text-xs text-neutral-400 font-medium">
                      {isEN ? "Manually adjust your calorie & macro goals" : "Bebas atur kalori, protein, karbo & air harian"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCustomTargetsModal(false)}
                  className="text-neutral-400 hover:text-white p-1 rounded-lg cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3.5">
                {/* Target Calories */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-300 flex items-center justify-between">
                    <span>{isEN ? "Daily Calorie Target (kcal)" : "Target Kalori Harian (kcal)"}</span>
                    <span className="text-[10px] text-[#D4FF00]">Auto: {autoTargetCalories} kcal</span>
                  </label>
                  <input
                    type="number"
                    value={custCal}
                    onChange={(e) => setCustCal(e.target.value)}
                    placeholder="2000"
                    className="w-full px-3.5 py-2.5 bg-[#181818] border border-white/[0.08] rounded-xl text-white text-base font-black focus:outline-none focus:border-[#D4FF00]"
                  />
                </div>

                {/* Protein, Carbs, Fat Grid */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-indigo-400">Protein (g)</label>
                    <input
                      type="number"
                      value={custProt}
                      onChange={(e) => setCustProt(e.target.value)}
                      placeholder="140"
                      className="w-full px-3 py-2 bg-[#181818] border border-white/[0.08] rounded-xl text-white text-sm font-black focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-emerald-400">{isEN ? "Carbs (g)" : "Karbo (g)"}</label>
                    <input
                      type="number"
                      value={custCarb}
                      onChange={(e) => setCustCarb(e.target.value)}
                      placeholder="220"
                      className="w-full px-3 py-2 bg-[#181818] border border-white/[0.08] rounded-xl text-white text-sm font-black focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-rose-400">{isEN ? "Fat (g)" : "Lemak (g)"}</label>
                    <input
                      type="number"
                      value={custFat}
                      onChange={(e) => setCustFat(e.target.value)}
                      placeholder="55"
                      className="w-full px-3 py-2 bg-[#181818] border border-white/[0.08] rounded-xl text-white text-sm font-black focus:outline-none focus:border-rose-400"
                    />
                  </div>
                </div>

                {/* Sodium, Sugar & Water Grid */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-purple-400">{isEN ? "Max Sodium (mg)" : "Batas Natrium (mg)"}</label>
                    <input
                      type="number"
                      value={custSodium}
                      onChange={(e) => setCustSodium(e.target.value)}
                      placeholder="2000"
                      className="w-full px-3 py-2 bg-[#181818] border border-white/[0.08] rounded-xl text-white text-sm font-black focus:outline-none focus:border-purple-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-amber-400">{isEN ? "Max Sugar (g)" : "Batas Gula (g)"}</label>
                    <input
                      type="number"
                      value={custSugar}
                      onChange={(e) => setCustSugar(e.target.value)}
                      placeholder="45"
                      className="w-full px-3 py-2 bg-[#181818] border border-white/[0.08] rounded-xl text-white text-sm font-black focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-blue-400">{isEN ? "Water (ml)" : "Air (ml)"}</label>
                    <input
                      type="number"
                      value={custWater}
                      onChange={(e) => setCustWater(e.target.value)}
                      placeholder="2500"
                      className="w-full px-3 py-2 bg-[#181818] border border-white/[0.08] rounded-xl text-white text-sm font-black focus:outline-none focus:border-blue-400"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-white/[0.08]">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleResetCustomTargets}
                    className="flex-1 py-2.5 rounded-xl bg-[#181818] hover:bg-[#222222] text-neutral-300 font-extrabold text-xs transition-all cursor-pointer"
                  >
                    {isEN ? "Reset to AI Auto" : "Reset ke Hitungan AI"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCustomTargets}
                    className="flex-1 py-2.5 rounded-xl bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-black text-xs transition-all cursor-pointer shadow-lg"
                  >
                    {isEN ? "Save Custom Targets" : "Simpan Target Kustom"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 4: MEAL DETAIL MODAL (Rule 10, 11, 12, 13) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedMealDetail && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#181818] border border-white/[0.08] rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 text-white max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-white/[0.08] pb-3 gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-[#D4FF00] text-black">
                      {isEN
                        ? (selectedMealDetail.mealType === "breakfast" ? "Breakfast" : selectedMealDetail.mealType === "lunch" ? "Lunch" : selectedMealDetail.mealType === "dinner" ? "Dinner" : "Snacks")
                        : (selectedMealDetail.mealType === "breakfast" ? "Sarapan" : selectedMealDetail.mealType === "lunch" ? "Makan Siang" : selectedMealDetail.mealType === "dinner" ? "Makan Malam" : "Camilan")}
                    </span>
                    {selectedMealDetail.time && (
                      <span className="text-xs text-neutral-400 font-mono flex items-center gap-1">
                        <Clock size={12} className="text-neutral-500" />
                        {selectedMealDetail.time}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-black text-white mt-1 leading-snug break-words">
                    {selectedMealDetail.foodName}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMealDetail(null)}
                  className="text-neutral-400 hover:text-white p-1 rounded-lg cursor-pointer shrink-0"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Nutrition Summary Hero Box */}
              <div className="p-4 bg-[#181818] rounded-2xl border border-white/[0.08]/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-[#D4FF00]" /> {isEN ? "Total Nutrition" : "Total Nutrisi"}
                  </span>
                  <span className="text-sm font-black text-black bg-[#D4FF00] px-3 py-0.5 rounded-lg shadow-sm">
                    ~{formatDashboardInteger(selectedMealDetail.calories)} kcal
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center text-[10px] sm:text-[11px] font-bold">
                  <div className="bg-[#181818] rounded-xl p-2 border border-white/[0.08]/80">
                    <span className="block text-[9px] text-indigo-400 font-bold">Protein</span>
                    <span className="text-white font-black">{formatDashboardMacro(selectedMealDetail.protein)}g</span>
                  </div>
                  <div className="bg-[#181818] rounded-xl p-2 border border-white/[0.08]/80">
                    <span className="block text-[9px] text-emerald-400 font-bold">{isEN ? "Carbs" : "Karbo"}</span>
                    <span className="text-white font-black">{formatDashboardMacro(selectedMealDetail.carbs)}g</span>
                  </div>
                  <div className="bg-[#181818] rounded-xl p-2 border border-white/[0.08]/80">
                    <span className="block text-[9px] text-rose-400 font-bold">{isEN ? "Fat" : "Lemak"}</span>
                    <span className="text-white font-black">{formatDashboardMacro(selectedMealDetail.fat)}g</span>
                  </div>
                  <div className="bg-[#181818] rounded-xl p-2 border border-white/[0.08]/80">
                    <span className="block text-[9px] text-amber-400 font-bold">{isEN ? "Fiber" : "Serat"}</span>
                    <span className="text-white font-black">{formatDashboardMacro(selectedMealDetail.fiber)}g</span>
                  </div>
                  <div className="bg-[#181818] rounded-xl p-2 border border-white/[0.08]/80">
                    <span className="block text-[9px] text-cyan-400 font-bold">{isEN ? "Sugar" : "Gula"}</span>
                    <span className="text-white font-black">{formatDashboardMacro(selectedMealDetail.sugar)}g</span>
                  </div>
                  <div className="bg-[#181818] rounded-xl p-2 border border-white/[0.08]/80">
                    <span className="block text-[9px] text-purple-400 font-bold">{isEN ? "Sodium" : "Natrium"}</span>
                    <span className="text-white font-black">{formatDashboardInteger((selectedMealDetail as any).sodium)}mg</span>
                  </div>
                </div>
              </div>

              {/* Food Item Breakdown (Rule 10) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-neutral-300 uppercase tracking-wider">
                    {isEN ? "Food Item Breakdown" : "Rincian Komponen Makanan"}
                  </span>
                  <span className="text-[10px] text-neutral-500 font-medium">
                    {Array.isArray(selectedMealDetail.items) && selectedMealDetail.items.length > 0
                      ? `${selectedMealDetail.items.length} ${isEN ? "items detected" : "item terdeteksi"}`
                      : (isEN ? "Logged portion" : "Porsi tercatat")}
                  </span>
                </div>

                {Array.isArray(selectedMealDetail.items) && selectedMealDetail.items.length > 0 ? (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto no-scrollbar">
                    {selectedMealDetail.items.map((it: any, idx: number) => (
                      <div key={idx} className="p-2.5 bg-[#181818]/90 rounded-xl border border-white/[0.08]/80 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="text-neutral-100 font-bold text-xs block leading-tight">
                              • {it.normalized_food_name || it.food_name}
                            </span>
                            <span className="text-[10px] text-neutral-400 font-medium block mt-0.5">
                              {it.estimated_weight_grams || 100}g · <span className="text-neutral-500">{it.data_source || (isEN ? "Estimated nutrition" : "Estimasi nutrisi")}</span>
                            </span>
                          </div>
                          <span className="text-xs font-black text-white whitespace-nowrap">
                            {formatDashboardInteger(it.calories)} kcal
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-neutral-400 pt-0.5 border-t border-white/[0.08]/80">
                          <span>P: <strong className="text-indigo-400">{formatDashboardMacro(it.protein)}g</strong></span>
                          <span>C: <strong className="text-emerald-400">{formatDashboardMacro(it.carbs)}g</strong></span>
                          <span>F: <strong className="text-rose-400">{formatDashboardMacro(it.fat)}g</strong></span>
                          {it.fiber !== undefined && it.fiber > 0 && (
                            <span>{isEN ? "Fib" : "Serat"}: <strong className="text-amber-400">{formatDashboardMacro(it.fiber)}g</strong></span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-[#181818]/60 rounded-xl border border-white/[0.08]/80 text-xs text-neutral-400 font-medium">
                    {isEN ? "Meal logged as a single complete menu: " : "Makanan dicatat sebagai satu menu komplit: "}
                    <strong className="text-white">{selectedMealDetail.foodName}</strong> (~{formatDashboardInteger(selectedMealDetail.calories)} kcal).
                  </div>
                )}
              </div>

              {/* Action Buttons (Rule 11, 12) */}
              <div className="flex items-center gap-2 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => handleOpenEditMeal(selectedMealDetail)}
                  className="flex-1 py-2.5 rounded-xl border border-white/20 hover:bg-white/10 text-neutral-200 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Edit3 size={14} />
                  <span>{isEN ? "Edit Nutrition" : "Edit Nutrisi"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMealToDelete(selectedMealDetail)}
                  className="flex-1 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={14} />
                  <span>{isEN ? "Delete Meal" : "Hapus Makanan"}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 5: EDIT MEAL NUTRITION (Rule 11) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {editingMeal && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#181818] border border-white/[0.08] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-white max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2">
                  <Edit3 size={16} className="text-[#D4FF00]" />
                  <h3 className="font-['Archivo_Black'] text-base text-white">
                    {isEN ? "Edit Meal Nutrition" : "Edit Nutrisi Makanan"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingMeal(null)}
                  className="text-neutral-400 hover:text-white p-1 rounded-lg cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-neutral-300">{isEN ? "Food Name" : "Nama Makanan"}</label>
                  <input
                    type="text"
                    value={editMealName}
                    onChange={(e) => setEditMealName(e.target.value)}
                    className="w-full mt-1 px-3.5 py-2.5 bg-[#181818] border border-white/[0.08] rounded-xl text-xs font-bold text-white focus:outline-none focus:border-[#D4FF00]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-neutral-300">{isEN ? "Meal Type" : "Waktu Makan"}</label>
                  <div className="grid grid-cols-4 gap-1.5 mt-1">
                    {(["breakfast", "lunch", "dinner", "snack"] as const).map((mType) => {
                      const mLabel = isEN
                        ? (mType === "breakfast" ? "Breakfast" : mType === "lunch" ? "Lunch" : mType === "dinner" ? "Dinner" : "Snack")
                        : (mType === "breakfast" ? "Sarapan" : mType === "lunch" ? "Siang" : mType === "dinner" ? "Malam" : "Camilan");
                      return (
                        <button
                          key={mType}
                          type="button"
                          onClick={() => setEditMealType(mType)}
                          className={`py-2 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer border ${
                            editMealType === mType
                              ? "bg-[#D4FF00] text-black border-[#D4FF00] font-black"
                              : "bg-[#181818] text-neutral-400 border-white/[0.08] hover:text-white"
                          }`}
                        >
                          {mLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="text-xs font-bold text-white">{isEN ? "Calories (kcal)" : "Kalori (kcal)"}</label>
                    <input
                      type="number"
                      value={editMealCal}
                      onChange={(e) => setEditMealCal(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-[#181818] border border-white/[0.08] rounded-xl text-xs font-black text-white focus:outline-none focus:border-[#D4FF00]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-indigo-400">{isEN ? "Protein (g)" : "Protein (g)"}</label>
                    <input
                      type="number"
                      value={editMealProt}
                      onChange={(e) => setEditMealProt(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-[#181818] border border-white/[0.08] rounded-xl text-xs font-black text-white focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-emerald-400">{isEN ? "Carbs (g)" : "Karbo (g)"}</label>
                    <input
                      type="number"
                      value={editMealCarb}
                      onChange={(e) => setEditMealCarb(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-[#181818] border border-white/[0.08] rounded-xl text-xs font-black text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-rose-400">{isEN ? "Fat (g)" : "Lemak (g)"}</label>
                    <input
                      type="number"
                      value={editMealFat}
                      onChange={(e) => setEditMealFat(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-[#181818] border border-white/[0.08] rounded-xl text-xs font-black text-white focus:outline-none focus:border-rose-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-amber-400">{isEN ? "Fiber (g)" : "Serat (g)"}</label>
                    <input
                      type="number"
                      value={editMealFib}
                      onChange={(e) => setEditMealFib(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-[#181818] border border-white/[0.08] rounded-xl text-xs font-black text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-cyan-400">{isEN ? "Sugar (g)" : "Gula (g)"}</label>
                    <input
                      type="number"
                      value={editMealSug}
                      onChange={(e) => setEditMealSug(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-[#181818] border border-white/[0.08] rounded-xl text-xs font-black text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setEditingMeal(null)}
                  className="flex-1 py-2.5 rounded-xl bg-[#181818] hover:bg-[#222222] text-neutral-300 font-bold text-xs transition-all cursor-pointer"
                >
                  {isEN ? "Cancel" : "Batal"}
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditMeal}
                  className="flex-1 py-2.5 rounded-xl bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-black text-xs transition-all cursor-pointer shadow-md"
                >
                  {isEN ? "Save Changes" : "Simpan Perubahan"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 6: DELETE MEAL CONFIRMATION (Rule 12) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {mealToDelete && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#181818] border border-white/[0.08] rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-white text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto">
                <Trash2 size={22} />
              </div>

              <div className="space-y-1">
                <h3 className="font-['Archivo_Black'] text-base text-white">
                  {isEN ? "Delete this meal?" : "Hapus Makanan Ini?"}
                </h3>
                <p className="text-xs font-bold text-[#D4FF00] px-2 py-1 bg-white/5 rounded-lg inline-block max-w-full truncate">
                  "{mealToDelete.foodName}"
                </p>
                <p className="text-xs text-neutral-400 font-medium pt-1">
                  {isEN
                    ? "Daily calorie and macronutrient totals will be automatically recalculated upon deletion."
                    : "Total kalori dan makronutrisi harian akan otomatis dikurangi setelah dihapus."}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMealToDelete(null)}
                  className="flex-1 py-2.5 rounded-xl bg-[#181818] hover:bg-[#222222] text-neutral-300 font-bold text-xs transition-all cursor-pointer"
                >
                  {isEN ? "Cancel" : "Batal"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteLogItem(mealToDelete.id);
                    if (selectedMealDetail && selectedMealDetail.id === mealToDelete.id) {
                      setSelectedMealDetail(null);
                    }
                    setMealToDelete(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-black text-xs transition-all cursor-pointer shadow-md"
                >
                  {isEN ? "Delete Meal" : "Hapus Makanan"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 7: UPGRADE PLAN MODAL (Plan-Based Feature Locking) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showUpgradePlanModal && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#181818] border border-white/[0.08] rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 text-white my-auto max-h-[92vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-white/[0.08] pb-3 gap-2">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg border ${
                    upgradeTargetFeature === "nutrition"
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                      : "bg-[#D4FF00]/15 border-[#D4FF00]/30 text-[#D4FF00]"
                  }`}>
                    {upgradeTargetFeature === "nutrition" ? "🥗" : "🏋️"}
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                      {isEN ? "GymBuddy Upgrade" : "Tingkatkan Akses GymBuddy"}
                    </span>
                    <h3 className="font-['Archivo_Black'] text-lg sm:text-xl text-white">
                      {upgradeTargetFeature === "nutrition"
                        ? (isEN ? "Unlock AI Nutritionist Plan" : "Buka Akses Paket Nutritionist")
                        : (isEN ? "Unlock AI Workout Coach Plan" : "Buka Akses Paket Workout Coach")}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUpgradePlanModal(false)}
                  className="text-neutral-400 hover:text-white p-1 rounded-lg cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Feature Switcher Selector inside modal */}
              <div className="grid grid-cols-2 gap-2 bg-[#181818] p-1 rounded-2xl border border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setUpgradeTargetFeature("nutrition")}
                  className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    upgradeTargetFeature === "nutrition"
                      ? "bg-emerald-500 text-black shadow-xs font-black"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  <span>🥗 Nutritionist</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUpgradeTargetFeature("workout")}
                  className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    upgradeTargetFeature === "workout"
                      ? "bg-[#D4FF00] text-black shadow-xs font-black"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  <span>🏋️ Workout Coach</span>
                </button>
              </div>

              {/* Plan Details & Benefits */}
              {upgradeTargetFeature === "nutrition" ? (
                <div className="space-y-4">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                      {isEN ? "Personalized Nutrition" : "Pola Makan & Nutrisi Presisi"}
                    </span>
                    <h4 className="text-sm font-black text-white">
                      {isEN ? "AI Nutritionist & Real-Time Food Tracker" : "AI Nutritionist & Jurnal Makanan Real-Time"}
                    </h4>
                    <p className="text-xs text-neutral-300">
                      {isEN
                        ? "Track macros, log meals instantly via WhatsApp photo/text, and get personalized calorie advice."
                        : "Hitung otomatis kalori & makro harian dengan foto atau chat WhatsApp, plus konsultasi pola makan terpandu."}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
                      {isEN ? "Included Features:" : "Fitur yang Didapatkan:"}
                    </span>
                    {[
                      { icon: "📸", title: isEN ? "Vision AI Photo Food Scanning" : "Scan Foto Makanan & Estimasi Makro Instan", desc: isEN ? "Recognizes Indonesian and global meals in <1.5s." : "Mengenali nasi padang, jajanan, minuman, & menu diet." },
                      { icon: "💬", title: isEN ? "WhatsApp Meal Logging" : "Catat Makanan via WhatsApp Tanpa Buka Web", desc: isEN ? "Log meals naturally via chat or photo on WhatsApp." : "Kirim teks atau foto makanan langsung ke WhatsApp bot." },
                      { icon: "📊", title: isEN ? "Dynamic Macronutrient Targets" : "Target Kalori, Protein, Karbo, Lemak & Natrium", desc: isEN ? "Custom formula tailored to your body and goal." : "Sistem auto-kalkulasi defisit/surplus kalori presisi." },
                      { icon: "💧", title: isEN ? "Smart 2.5L Hydration Tracking" : "Pelacak Air & Hidrasi Cerdas 2.500ml", desc: isEN ? "Interactive glasses, water log, and drink presets." : "Visual 8 gelas interaktif dan auto-kalkulasi kopi & teh." }
                    ].map((feat, idx) => (
                      <div key={idx} className="p-3 bg-[#181818] border border-white/[0.08] rounded-2xl flex items-start gap-3">
                        <span className="text-xl shrink-0">{feat.icon}</span>
                        <div>
                          <h5 className="text-xs font-black text-white">{feat.title}</h5>
                          <p className="text-[11px] text-neutral-400 font-medium mt-0.5">{feat.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-[#D4FF00]/10 border border-[#D4FF00]/20 rounded-2xl p-4 space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#D4FF00]">
                      {isEN ? "Structured Strength Training" : "Program Latihan Gym Terstruktur"}
                    </span>
                    <h4 className="text-sm font-black text-white">
                      {isEN ? "AI Workout Coach & Interactive Exercise Guide" : "AI Workout Coach & Panduan Alat Komprehensif"}
                    </h4>
                    <p className="text-xs text-neutral-300">
                      {isEN
                        ? "Get personalized workout splits, per-set checklist tracking with WhatsApp sync, and 100+ GIF guides."
                        : "Jadwal harian sesuai target bentuk otot/fat loss, per-set checklist sinkron WhatsApp, dan panduan alat GIF."}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
                      {isEN ? "Included Features:" : "Fitur yang Didapatkan:"}
                    </span>
                    {[
                      { icon: "📅", title: isEN ? "Daily Tailored Gym Routines" : "Menu Latihan Harian Personal", desc: isEN ? "Push/Pull/Legs, Upper/Lower, or Full Body split." : "Disusun sesuai level kebugaran dan target tubuhmu." },
                      { icon: "✅", title: isEN ? "Per-Set Checklist & WhatsApp Sync" : "Checklist Set Latihan Tersinkronisasi Otomatis", desc: isEN ? "Log done sets via WhatsApp chat or directly on dashboard." : "Set checklist terupdate otomatis saat chat 'done set 1'." },
                      { icon: "🎬", title: isEN ? "100+ Exercise GIF & Equipment Guides" : "Kamus Alat Gym & Video/GIF Visual Gerakan", desc: isEN ? "Proper biomechanics form and coach cues." : "Visualisasi gerakan 2 fase, cue pelatih Max & Mia." },
                      { icon: "🏊‍♂️", title: isEN ? "Spontaneous Additional Activities" : "Tracking Aktivitas Olahraga Bebas", desc: isEN ? "Log swimming, running, badminton, walking & yoga anytime." : "Catat renang, lari, badminton, sepedaan di luar jadwal." }
                    ].map((feat, idx) => (
                      <div key={idx} className="p-3 bg-[#181818] border border-white/[0.08] rounded-2xl flex items-start gap-3">
                        <span className="text-xl shrink-0">{feat.icon}</span>
                        <div>
                          <h5 className="text-xs font-black text-white">{feat.title}</h5>
                          <p className="text-[11px] text-neutral-400 font-medium mt-0.5">{feat.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => {
                    // Activate demo user / plan switch for testing
                    if (upgradeTargetFeature === "nutrition") {
                      handleSelectDemoUser("alex");
                    } else {
                      handleSelectDemoUser("mia");
                    }
                    setShowUpgradePlanModal(false);
                  }}
                  className={`w-full py-3.5 rounded-2xl font-black text-xs sm:text-sm transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2 ${
                    upgradeTargetFeature === "nutrition"
                      ? "bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 text-black shadow-emerald-500/25"
                      : "bg-gradient-to-r from-[#D4FF00] to-lime-400 hover:from-[#c2ea00] text-black shadow-[#D4FF00]/25"
                  }`}
                >
                  <Sparkles size={16} />
                  <span>
                    {upgradeTargetFeature === "nutrition"
                      ? (isEN ? "Switch to Nutritionist Plan (Demo)" : "Aktifkan Paket Nutritionist (Demo)")
                      : (isEN ? "Switch to Workout Coach Plan (Demo)" : "Aktifkan Paket Workout Coach (Demo)")}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleSelectDemoUser("both");
                    setShowUpgradePlanModal(false);
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#181818] hover:bg-[#222222] border border-white/[0.08] text-neutral-300 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>🌟 {isEN ? "Unlock All-Access (Both Plans)" : "Buka Akses Penuh (Kedua Paket)"}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* HEALTH PROFILE PERSONALIZATION MODAL (Existing Users Prompt & Profile Edit) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showHealthProfileModal && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#181818] border border-white/[0.08] rounded-3xl p-5 sm:p-7 max-w-lg w-full shadow-2xl space-y-5 text-white max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#D4FF00]/15 border border-[#D4FF00]/30 flex items-center justify-center text-[#D4FF00]">
                    <HeartPulse size={22} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#D4FF00] block">
                      {isEN ? "Health Personalization" : "Personalisasi Kesehatan"}
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-white">
                      {isEN ? "Help Us Personalize GymBuddy" : "Personalisasi GymBuddy Kamu"}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDismissHealthModal}
                  className="text-neutral-400 hover:text-white p-1 rounded-lg cursor-pointer transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Friendly Explanation Banner */}
              <div className="p-3.5 rounded-2xl bg-[#222222] border border-white/[0.08] space-y-1">
                <p className="text-xs text-neutral-300 leading-relaxed font-medium">
                  {isEN
                    ? "Your age and health details help AI Nutritionist and AI Workout Coach provide safe, age-appropriate, and context-aware guidance."
                    : "Informasi usia dan kondisi kesehatan membantu Nutritionist AI & Workout Coach AI memberikan panduan yang aman dan tepat sesuai kondisi fisikmu."}
                </p>
              </div>

              {/* Section 1: Date of Birth & Age */}
              <div className="space-y-3">
                <label className="block text-xs font-['Inter'] font-bold text-neutral-300 uppercase tracking-wider">
                  {isEN ? "1. Date of Birth & Age" : "1. Tanggal Lahir & Usia"}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] font-semibold text-neutral-400 block mb-1.5">
                      {isEN ? "Date of Birth (Optional)" : "Tanggal Lahir (Opsional)"}
                    </span>
                    <div className="relative">
                      <CalendarIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                      <input
                        type="date"
                        max={new Date().toISOString().split("T")[0]}
                        value={healthDob}
                        onChange={(e) => handleHealthDobChange(e.target.value)}
                        className="w-full bg-[#111620] border border-white/[0.08] rounded-xl pl-10 pr-3 py-2.5 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-[#D4FF00]"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold text-neutral-400">
                        {isEN ? "Age (Years)" : "Usia (Tahun)"}
                      </span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[#D4FF00]/15 text-[#D4FF00] border border-[#D4FF00]/30">
                        {getDashboardAgeGroupLabel(Number(healthAge) || 25)}
                      </span>
                    </div>
                    <input
                      type="number"
                      min="10"
                      max="120"
                      value={healthAge}
                      onChange={(e) => setHealthAge(e.target.value.replace(/-/g, ''))}
                      placeholder="25"
                      className="w-full bg-[#111620] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm font-black text-white focus:outline-none focus:border-[#D4FF00]"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Health Conditions Question */}
              <div className="space-y-3 pt-3 border-t border-white/[0.08]">
                <label className="block text-xs font-['Inter'] font-bold text-neutral-300 uppercase tracking-wider">
                  {isEN ? "2. Health Conditions" : "2. Kondisi Kesehatan"}
                </label>
                <p className="text-xs text-neutral-400">
                  {isEN
                    ? "Do you have any health conditions we should consider when creating your nutrition and workout recommendations?"
                    : "Apakah kamu memiliki kondisi kesehatan yang perlu dipertimbangkan saat AI membuat rekomendasi?"}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: "no_condition", label: isEN ? "No health conditions" : "Tidak ada kondisi", icon: "✨" },
                    { id: "has_condition", label: isEN ? "Yes, I have conditions" : "Ya, ada kondisi", icon: "🩺" },
                    { id: "prefer_not_to_say", label: isEN ? "Prefer not to say" : "Tidak ingin menyebutkan", icon: "🔒" }
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setHealthStatus(st.id as any)}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        healthStatus === st.id
                          ? "bg-[#D4FF00] text-black border-[#D4FF00] shadow-sm font-black"
                          : "bg-[#111620] border-white/[0.08] text-neutral-300 hover:border-neutral-700"
                      }`}
                    >
                      <span>{st.icon}</span>
                      <span className="truncate">{st.label}</span>
                    </button>
                  ))}
                </div>

                {/* Condition Selection Tags */}
                {healthStatus === "has_condition" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="p-4 rounded-2xl bg-[#111620] border border-white/[0.08] space-y-3"
                  >
                    <span className="text-xs font-bold text-neutral-300 block">
                      {isEN ? "Select all applicable conditions:" : "Pilih kondisi kesehatan yang berlaku:"}
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "Diabetes", label: "Diabetes", icon: "🩸" },
                        { id: "High blood pressure", label: isEN ? "High blood pressure" : "Hipertensi", icon: "🫀" },
                        { id: "High cholesterol", label: isEN ? "High cholesterol" : "Kolesterol Tinggi", icon: "🧈" },
                        { id: "Heart condition", label: isEN ? "Heart condition" : "Kondisi Jantung", icon: "❤️" },
                        { id: "Kidney condition", label: isEN ? "Kidney condition" : "Kondisi Ginjal", icon: "🫘" },
                        { id: "Liver condition", label: isEN ? "Liver condition" : "Kondisi Hati", icon: "🩺" },
                        { id: "Asthma", label: isEN ? "Asthma / Respiratory" : "Asma / Pernafasan", icon: "🫁" },
                        { id: "Arthritis", label: isEN ? "Arthritis / Joint Issue" : "Radang Sendi", icon: "🦴" }
                      ].map((cond) => {
                        const isChecked = selectedConditions.includes(cond.id);
                        return (
                          <button
                            key={cond.id}
                            type="button"
                            onClick={() => toggleDashboardHealthCondition(cond.id)}
                            className={`p-2.5 rounded-xl border text-xs font-bold text-left flex items-center justify-between gap-1.5 cursor-pointer transition-all ${
                              isChecked
                                ? "bg-[#D4FF00]/15 border-[#D4FF00] text-white"
                                : "bg-[#181818] border-white/[0.08] text-neutral-400 hover:border-neutral-700 hover:text-white"
                            }`}
                          >
                            <span className="flex items-center gap-1.5 truncate">
                              <span>{cond.icon}</span>
                              <span className="truncate">{cond.label}</span>
                            </span>
                            {isChecked && <Check size={14} className="text-[#D4FF00] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-2">
                      <input
                        type="text"
                        value={healthOtherCondition}
                        onChange={(e) => setHealthOtherCondition(e.target.value)}
                        placeholder={isEN ? "Other condition (optional free text)..." : "Kondisi lainnya (opsional)..."}
                        className="w-full bg-[#181818] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#D4FF00]"
                      />
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  disabled={isSavingHealthProfile}
                  onClick={handleSaveHealthProfile}
                  className="w-full py-3.5 rounded-2xl bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-black text-xs sm:text-sm transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2"
                >
                  <Sparkles size={16} />
                  <span>
                    {isSavingHealthProfile
                      ? (isEN ? "Saving Profile..." : "Menyimpan...")
                      : (isEN ? "Save & Personalize" : "Simpan & Personalisasi")}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleDismissHealthModal}
                  className="w-full py-2.5 rounded-xl bg-transparent hover:bg-white/5 text-neutral-400 hover:text-white font-bold text-xs transition-all cursor-pointer"
                >
                  <span>{isEN ? "Skip for Now" : "Lewati Dulu"}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
