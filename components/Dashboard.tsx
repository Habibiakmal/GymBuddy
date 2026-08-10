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
  X,
  Check,
  Clock,
  Smile,
  AlertCircle,
  ThumbsUp,
  Zap,
  Coffee,
  Bell,
  Globe
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

type FeelState = "bad" | "sick" | "not_great" | "okay" | "good" | "great";

// Helper function to check if item is liquid / drink
const isLiquidItem = (name: string): boolean => {
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
    editGoalsBtn: "Edit Goals",
    howDoYouFeel: "How do you feel today?",
    feelSubtext: "Ini bukan diagnosis medis. Hanya digunakan sebagai daily wellbeing dan readiness check.",
    feelBad: "Feeling Bad",
    sick: "Sick",
    notGreat: "Not Great",
    okay: "Okay",
    good: "Good",
    great: "Great",
    todaysWorkout: "Today's Workout",
    workoutProgress: "Workout Progress",
    overallProgress: "Progress Keseluruhan",
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
    addMealModalTitle: "Tambah Nutrisi / Log Makanan",
    addDrinkModalTitle: "Tambah Log Minuman / Hidrasi",
    foodNameLabel: "Nama Makanan",
    drinkNameLabel: "Nama Minuman",
    volumeLabel: "Volume (ml)",
    portionLabel: "Est. Porsi / Pilihan",
    caloriesInputLabel: "Kalori (kcal)",
    proteinInputLabel: "Protein (g)",
    carbsInputLabel: "Karbo (g)",
    fatInputLabel: "Lemak (g)",
    aiAutoEstimate: "Atau ketik bebas (misal: 'Nasi goreng 1 porsi' / 'Es kopi 250ml')",
    analyzeWithAi: "Hitung Otomatis dengan AI",
    analyzing: "Menganalisis...",
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
    editGoalsBtn: "Edit Goals",
    howDoYouFeel: "How do you feel today?",
    feelSubtext: "This is not a medical diagnosis. Used only for daily wellbeing and readiness check.",
    feelBad: "Feeling Bad",
    sick: "Sick",
    notGreat: "Not Great",
    okay: "Okay",
    good: "Good",
    great: "Great",
    todaysWorkout: "Today's Workout",
    workoutProgress: "Workout Progress",
    overallProgress: "Overall Progress",
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
    addMealModalTitle: "Add Food / Meal Log",
    addDrinkModalTitle: "Add Drink / Hydration Log",
    foodNameLabel: "Food Item Name",
    drinkNameLabel: "Drink Name",
    volumeLabel: "Volume (ml)",
    portionLabel: "Est. Portion / Selection",
    caloriesInputLabel: "Calories (kcal)",
    proteinInputLabel: "Protein (g)",
    carbsInputLabel: "Carbs (g)",
    fatInputLabel: "Fat (g)",
    aiAutoEstimate: "Or type freely (e.g. '1 plate fried rice' / 'Iced coffee 250ml')",
    analyzeWithAi: "Auto-estimate with AI",
    analyzing: "Analyzing...",
    saveEntry: "Save Log",
    updateWeightTitle: "Update Body Weight",
    weightInputLabel: "New Weight (kg)",
    saveWeight: "Save New Weight"
  }
};

function getPersonalizedExercises(user: UserProfileData): WorkoutExercise[] {
  const goal = user?.goal || "lose";

  if (goal === "gain") {
    return [
      { id: "w-1", name: "Incline Barbell Bench Press", targetSets: 4, completedSets: 0, setsState: [false, false, false, false], targetReps: "4 Set x 8-10 Reps", status: "not_started" },
      { id: "w-2", name: "Wide-Grip Lat Pulldown", targetSets: 4, completedSets: 0, setsState: [false, false, false, false], targetReps: "4 Set x 10-12 Reps", status: "not_started" },
      { id: "w-3", name: "Barbell Back Squat", targetSets: 4, completedSets: 0, setsState: [false, false, false, false], targetReps: "4 Set x 8 Reps", status: "not_started" },
      { id: "w-4", name: "Dumbbell Bicep Curls", targetSets: 3, completedSets: 0, setsState: [false, false, false], targetReps: "3 Set x 12 Reps", status: "not_started" }
    ];
  } else if (goal === "lose") {
    return [
      { id: "w-1", name: "Push Up (Chest & Core)", targetSets: 3, completedSets: 0, setsState: [false, false, false], targetReps: "3 Set x 12-15 Reps", status: "not_started" },
      { id: "w-2", name: "Goblet Bodyweight Squat", targetSets: 3, completedSets: 0, setsState: [false, false, false], targetReps: "3 Set x 15 Reps", status: "not_started" },
      { id: "w-3", name: "Incline Treadmill Walk", targetSets: 1, completedSets: 0, setsState: [false], targetReps: "30-45 Detik / Menit", status: "not_started" },
      { id: "w-4", name: "Plank & Core Hold", targetSets: 3, completedSets: 0, setsState: [false, false, false], targetReps: "3 Set x 45 Detik", status: "not_started" }
    ];
  } else {
    return [
      { id: "w-1", name: "Bodyweight Circuit Push-Up", targetSets: 3, completedSets: 0, setsState: [false, false, false], targetReps: "3 Set x 10 Reps", status: "not_started" },
      { id: "w-2", name: "Lunges & Body Balance", targetSets: 3, completedSets: 0, setsState: [false, false, false], targetReps: "3 Set x 12 Reps", status: "not_started" },
      { id: "w-3", name: "Cardio Jogging / Walking", targetSets: 1, completedSets: 0, setsState: [false], targetReps: "25-30 Menit", status: "not_started" }
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
      return (stored === "EN" || stored === "ID") ? stored : initialLang;
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
  const [loadingLogs, setLoadingLogs] = useState(false);

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

  // Workouts State per date
  const [exercises, setExercises] = useState<WorkoutExercise[]>(() => {
    try {
      const stored = localStorage.getItem(`gymbuddy_exercises_${initialUser.phone || "user"}_${selectedDate}`);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return getPersonalizedExercises(initialUser);
  });

  const [activeWorkoutDetail, setActiveWorkoutDetail] = useState<WorkoutExercise | null>(null);

  // Modals State
  const [showAddFoodModal, setShowAddFoodModal] = useState(false);
  const [showAddDrinkModal, setShowAddDrinkModal] = useState(false);
  const [showUpdateWeightModal, setShowUpdateWeightModal] = useState(false);
  const [showEditGoalsModal, setShowEditGoalsModal] = useState(false);

  // New Food / Drink Input State
  const [itemNameInput, setItemNameInput] = useState("");
  const [itemCalInput, setItemCalInput] = useState("");
  const [itemProteinInput, setItemProteinInput] = useState("");
  const [itemCarbsInput, setItemCarbsInput] = useState("");
  const [itemFatInput, setItemFatInput] = useState("");
  const [itemVolumeInput, setItemVolumeInput] = useState("250");
  const [aiInputText, setAiInputText] = useState("");
  const [analyzingAi, setAnalyzingAi] = useState(false);

  // New Weight & Goals Input State
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

  // Date Navigation Ribbon (7 Days)
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

  // Separate Food Meals vs Water Hydration
  const foodMeals = allLogs.filter((item) => !isLiquidItem(item.foodName) && !item.isHydration);
  const hydrationLogs = allLogs.filter((item) => isLiquidItem(item.foodName) || item.isHydration);

  // Totals
  const totalCaloriesConsumed = foodMeals.reduce((sum, item) => sum + (Number(item.calories) || 0), 0);
  const totalProteinConsumed = foodMeals.reduce((sum, item) => sum + (Number(item.protein) || 0), 0);
  const totalCarbsConsumed = foodMeals.reduce((sum, item) => sum + (Number(item.carbs) || 0), 0);
  const totalFatConsumed = foodMeals.reduce((sum, item) => sum + (Number(item.fat) || 0), 0);

  const totalHydrationMl = hydrationLogs.reduce((sum, item) => sum + (Number(item.volumeMl) || (item.foodName.match(/\d+/) ? Number(item.foodName.match(/\d+/)![0]) : 250)), 0);
  const totalWaterCups = Math.floor(totalHydrationMl / 250);

  // Workout Set Progress Calculations
  const totalTargetSetsOverall = exercises.reduce((sum, ex) => sum + ex.targetSets, 0);
  const totalCompletedSetsOverall = exercises.reduce((sum, ex) => sum + ex.completedSets, 0);
  const overallWorkoutPercent = totalTargetSetsOverall > 0 ? Math.round((totalCompletedSetsOverall / totalTargetSetsOverall) * 100) : 0;
  const isTodayWorkoutFinished = overallWorkoutPercent === 100 && totalTargetSetsOverall > 0;

  // Streak Calculation (Consecutive Active Days up to today)
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
        if (i === 0) {
          // If today hasn't had activity logged yet, preserve streak from yesterday
          continue;
        } else {
          isCountingCurrent = false;
        }
      }
    }

    return { currentStreak: Math.max(current, totalCompletedSetsOverall > 0 || allLogs.length > 0 ? 1 : 0), longestStreak: Math.max(longest, current, 1) };
  };

  const { currentStreak, longestStreak } = calculateStreaks();

  // Fetch Meals/Logs from API & LocalStorage
  const fetchLogsForDate = async (dateStr: string) => {
    setLoadingLogs(true);
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
          setLoadingLogs(false);
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
    setLoadingLogs(false);
  };

  useEffect(() => {
    fetchLogsForDate(selectedDate);

    // Restore feel state for selected date
    try {
      const storedFeel = localStorage.getItem(`gymbuddy_feel_${activeUser.phone || "user"}_${selectedDate}`);
      if (storedFeel) setFeelState(storedFeel as FeelState);
    } catch (e) {}

    // Restore exercises for selected date
    try {
      const storedEx = localStorage.getItem(`gymbuddy_exercises_${activeUser.phone || "user"}_${selectedDate}`);
      if (storedEx) setExercises(JSON.parse(storedEx));
      else setExercises(getPersonalizedExercises(activeUser));
    } catch (e) {
      setExercises(getPersonalizedExercises(activeUser));
    }
  }, [selectedDate, activeUser.phone]);

  // Save Exercises State helper
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

  // Select Feel State
  const handleSelectFeel = (state: FeelState) => {
    setFeelState(state);
    try {
      localStorage.setItem(`gymbuddy_feel_${activeUser.phone || "user"}_${selectedDate}`, state);
    } catch (e) {}

    // Requirement 5: Auto Trigger Reminder when Good or Great and Workout Incomplete
    if ((state === "good" || state === "great") && !isTodayWorkoutFinished) {
      const reminderFlagKey = `gymbuddy_reminder_dismissed_${activeUser.phone || "user"}_${selectedDate}`;
      try {
        const alreadyPrompted = localStorage.getItem(reminderFlagKey);
        if (!alreadyPrompted) {
          setShowAutoReminderModal(true);
        }
      } catch (e) {
        setShowAutoReminderModal(true);
      }
    }
  };

  // Dismiss / Confirm Reminder
  const handleSetReminderTime = () => {
    const reminderFlagKey = `gymbuddy_reminder_dismissed_${activeUser.phone || "user"}_${selectedDate}`;
    try {
      localStorage.setItem(reminderFlagKey, "true");
      localStorage.setItem(`gymbuddy_reminder_time_${activeUser.phone || "user"}_${selectedDate}`, selectedReminderTime);
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

  // Handle Add Item (Food or Drink)
  const handleSaveLogItem = async (isDrink: boolean) => {
    if (!itemNameInput.trim()) return;

    const normPhone = normalizePhone(activeUser.phone || "085156919826");
    const newItem: MealItem = {
      id: `m-${Date.now()}`,
      foodName: itemNameInput,
      calories: isDrink ? 50 : Number(itemCalInput) || 0,
      protein: isDrink ? 1 : Number(itemProteinInput) || 0,
      carbs: isDrink ? 5 : Number(itemCarbsInput) || 0,
      fat: isDrink ? 0 : Number(itemFatInput) || 0,
      isHydration: isDrink || isLiquidItem(itemNameInput),
      volumeMl: isDrink ? Number(itemVolumeInput) || 250 : undefined,
      timestamp: new Date().toISOString()
    };

    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "";
    try {
      await fetch(`${API_BASE_URL}/api/user/${normPhone}/meals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newItem, date: selectedDate })
      });
    } catch (e) {}

    const updated = [...allLogs, newItem];
    setAllLogs(updated);
    try {
      localStorage.setItem(`gymbuddy_meals_${normPhone}_${selectedDate}`, JSON.stringify(updated));
    } catch (e) {}

    setItemNameInput("");
    setItemCalInput("");
    setItemProteinInput("");
    setItemCarbsInput("");
    setItemFatInput("");
    setAiInputText("");
    setShowAddFoodModal(false);
    setShowAddDrinkModal(false);
  };

  // Quick Add Water
  const handleQuickAddWater = (ml: number) => {
    const normPhone = normalizePhone(activeUser.phone || "085156919826");
    const newItem: MealItem = {
      id: `m-${Date.now()}`,
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
    if (!window.confirm(lang === "EN" ? "Are you sure you want to permanently delete your account data?" : "Apakah Anda yakin ingin menghapus akun dan semua data harian Anda?")) {
      return;
    }
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

  // Coach Dynamic Feeling Recommendation text (Requirement 4)
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
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-slate-900 selection:text-white pb-24">
      {/* Notification Toast */}
      <AnimatePresence>
        {reminderNotificationMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-full text-sm font-semibold shadow-lg flex items-center gap-2 border border-slate-800"
          >
            <Bell size={16} className="text-emerald-400" />
            <span>{reminderNotificationMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <GymBuddyLogo size={32} showText textClassName="text-lg sm:text-xl text-slate-900 font-black tracking-tight" />
          <span className="hidden md:inline-block px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
            {t.memberDashboard}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Language Switcher ID | EN */}
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 transition-all text-xs font-extrabold cursor-pointer"
            title="Switch Language"
          >
            <Globe size={14} className="text-slate-500" />
            <span className={lang === "ID" ? "text-slate-900 font-black underline" : "text-slate-400"}>ID</span>
            <span className="text-slate-300">|</span>
            <span className={lang === "EN" ? "text-slate-900 font-black underline" : "text-slate-400"}>EN</span>
          </button>

          <button
            onClick={onBackToHome}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft size={14} />
            <span>{t.landingPage}</span>
          </button>

          <a
            href={`https://wa.me/${(import.meta as any).env?.VITE_WHATSAPP_BOT_NUMBER || "14155238886"}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 rounded-full bg-emerald-600 text-white font-extrabold text-xs flex items-center gap-1.5 hover:bg-emerald-700 transition-all shadow-xs"
          >
            <span>WhatsApp AI</span>
          </a>

          <button
            onClick={handleDeleteAccount}
            className="px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-all text-xs font-bold flex items-center gap-1 cursor-pointer"
            title={t.removeAccount}
          >
            <Trash2 size={13} />
            <span className="hidden sm:inline">{t.removeAccount}</span>
          </button>

          <button
            onClick={onLogout}
            className="p-2 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title={t.logout}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main Content (Strict 9-Step Hierarchy Layout) */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* STEP 1: USER NAME HEADER & GREETING */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white font-black flex items-center justify-center text-2xl shadow-sm">
              {activeUser.name ? activeUser.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  {t.welcome}, {activeUser.name || "Member"}!
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                  {coachName}
                </span>
              </div>
              <p className="text-sm text-slate-500 font-medium">
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
                  className={`flex flex-col items-center justify-center w-12 h-14 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
                    isSel
                      ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <span className="text-[10px] uppercase font-semibold opacity-75">{d.dayName}</span>
                  <span className="text-base font-black">{d.dayNum}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 2: CURRENT STREAK & LONGEST STREAK */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Current Streak */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-600 text-xs font-extrabold uppercase tracking-wider">
                <Flame size={16} className="fill-amber-500" />
                <span>{t.currentStreak}</span>
              </div>
              <div className="text-3xl font-black text-slate-900 tracking-tight">
                {currentStreak} <span className="text-lg font-bold text-slate-500">{t.activeDaysConsecutive}</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center font-black text-xl">
              🔥
            </div>
          </div>

          {/* Longest Streak */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-indigo-600 text-xs font-extrabold uppercase tracking-wider">
                <Award size={16} />
                <span>{t.longestStreak}</span>
              </div>
              <div className="text-3xl font-black text-slate-900 tracking-tight">
                {longestStreak} <span className="text-lg font-bold text-slate-500">{t.recordStreakDays}</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center font-black text-xl">
              🏆
            </div>
          </div>
        </div>

        {/* STEP 3: TARGET GOALS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target size={18} className="text-slate-700" />
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">{t.targetGoals}</h2>
            </div>
            <button
              onClick={() => setShowUpdateWeightModal(true)}
              className="text-xs font-extrabold text-slate-700 hover:text-slate-900 underline cursor-pointer"
            >
              {t.updateWeightTitle}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase">{t.mainGoalTitle}</span>
              <p className="text-base font-extrabold text-slate-900">{goalTitle}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase">{t.currentWeightLabel} → {t.targetWeightLabel}</span>
              <p className="text-base font-extrabold text-slate-900">{weight} kg → {targetWeight} kg ({t.remainingLabel} {remainingKg} kg)</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase">{t.dailyTargetLabel}</span>
              <p className="text-base font-extrabold text-slate-900">{targetCalories} kcal / {targetProtein}g P</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs font-extrabold text-slate-600">
              <span>Goal Overall Progress</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div className="h-full bg-emerald-600 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
            </div>
          </div>
        </div>

        {/* STEP 4: HOW DO YOU FEEL TODAY? */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">{t.howDoYouFeel}</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{t.feelSubtext}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 pt-1">
            {[
              { id: "bad", label: t.feelBad, icon: "😫", border: "hover:border-red-400 active:bg-red-50", activeBg: "bg-red-50 border-red-500 text-red-700" },
              { id: "sick", label: t.sick, icon: "🤒", border: "hover:border-red-400 active:bg-red-50", activeBg: "bg-red-50 border-red-500 text-red-700" },
              { id: "not_great", label: t.notGreat, icon: "🙁", border: "hover:border-amber-400 active:bg-amber-50", activeBg: "bg-amber-50 border-amber-500 text-amber-800" },
              { id: "okay", label: t.okay, icon: "😐", border: "hover:border-slate-400 active:bg-slate-100", activeBg: "bg-slate-100 border-slate-700 text-slate-900" },
              { id: "good", label: t.good, icon: "🙂", border: "hover:border-emerald-400 active:bg-emerald-50", activeBg: "bg-emerald-50 border-emerald-500 text-emerald-800" },
              { id: "great", label: t.great, icon: "🔥", border: "hover:border-emerald-400 active:bg-emerald-50", activeBg: "bg-emerald-50 border-emerald-600 text-emerald-900" }
            ].map((st) => {
              const isSelected = feelState === st.id;
              return (
                <button
                  key={st.id}
                  onClick={() => handleSelectFeel(st.id as FeelState)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer font-bold text-xs gap-1.5 ${
                    isSelected
                      ? `${st.activeBg} font-black shadow-xs ring-2 ring-slate-900/10`
                      : `bg-slate-50 border-slate-200 text-slate-700 ${st.border}`
                  }`}
                >
                  <span className="text-xl">{st.icon}</span>
                  <span className="leading-tight">{st.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 5 & STEP 6: TODAY'S WORKOUT & WORKOUT PROGRESS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Dumbbell size={18} className="text-slate-800" />
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">{t.todaysWorkout}</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">
                {totalCompletedSetsOverall} / {totalTargetSetsOverall} {t.setsCompleted} ({overallWorkoutPercent}%)
              </span>
            </div>
          </div>

          {/* Overall Daily Progress Bar */}
          <div className="space-y-1">
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div className="h-full bg-emerald-600 rounded-full transition-all duration-300" style={{ width: `${overallWorkoutPercent}%` }}></div>
            </div>
          </div>

          {/* Exercises List Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
            {exercises.map((ex) => {
              const percent = ex.targetSets > 0 ? Math.round((ex.completedSets / ex.targetSets) * 100) : 0;
              const isDone = percent === 100;

              return (
                <div
                  key={ex.id}
                  className={`border rounded-xl p-4 transition-all space-y-3 cursor-pointer ${
                    isDone
                      ? "bg-emerald-50/60 border-emerald-200 text-slate-900"
                      : ex.completedSets > 0
                      ? "bg-amber-50/40 border-amber-200 text-slate-900"
                      : "bg-slate-50 border-slate-200 hover:border-slate-300"
                  }`}
                  onClick={() => setActiveWorkoutDetail(ex)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900">{ex.name}</h3>
                      <p className="text-xs text-slate-500 font-medium">{ex.targetReps}</p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                        isDone
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : ex.completedSets > 0
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : "bg-slate-100 text-slate-600 border-slate-300"
                      }`}
                    >
                      {isDone ? t.statusCompleted : ex.completedSets > 0 ? t.statusInProgress : t.statusNotStarted}
                    </span>
                  </div>

                  {/* Sets Progress Checkboxes Inline */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {ex.setsState.map((isSetDone, setIdx) => (
                        <button
                          key={setIdx}
                          onClick={() => handleToggleSet(ex.id, setIdx)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer border ${
                            isSetDone
                              ? "bg-emerald-600 text-white border-emerald-700 shadow-2xs"
                              : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                          }`}
                        >
                          <span>Set {setIdx + 1}</span>
                          {isSetDone && <Check size={12} strokeWidth={3} />}
                        </button>
                      ))}
                    </div>
                    <div className="text-xs font-black text-slate-700">
                      {ex.completedSets} / {ex.targetSets} {t.setUnit} ({percent}%)
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* STEP 7: FOOD MEALS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame size={18} className="text-amber-600" />
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">{t.foodMeals}</h2>
            </div>
            <button
              onClick={() => setShowAddFoodModal(true)}
              className="px-3 py-1.5 rounded-full bg-slate-900 text-white font-extrabold text-xs flex items-center gap-1 hover:bg-slate-800 transition-all shadow-2xs cursor-pointer"
            >
              <Plus size={14} />
              <span>{t.addFoodBtn}</span>
            </button>
          </div>

          {/* Meals Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase">{t.caloriesLabel}</span>
              <p className="text-base font-black text-slate-900">{totalCaloriesConsumed} / {targetCalories} kcal</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase">{t.proteinLabel}</span>
              <p className="text-base font-black text-slate-900">{totalProteinConsumed} / {targetProtein}g</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase">{t.carbsLabel}</span>
              <p className="text-base font-black text-slate-900">{totalCarbsConsumed} / {targetCarbs}g</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase">{t.fatLabel}</span>
              <p className="text-base font-black text-slate-900">{totalFatConsumed} / {targetFat}g</p>
            </div>
          </div>

          {/* Solid Food Items List */}
          {foodMeals.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm font-medium border border-dashed border-slate-200 rounded-xl">
              {t.noMealsLogged}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {foodMeals.map((item) => (
                <div key={item.id} className="p-3.5 bg-white flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900">{item.foodName}</h4>
                    <p className="text-xs text-slate-500 font-medium">
                      {item.calories} kcal • P: {item.protein}g | C: {item.carbs}g | F: {item.fat}g
                    </p>
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

        {/* STEP 8: WATER / HYDRATION */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Droplets size={18} className="text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">{t.waterHydration}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleQuickAddWater(250)}
                className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-extrabold text-xs hover:bg-blue-100 cursor-pointer"
              >
                {t.quickAdd250}
              </button>
              <button
                onClick={() => handleQuickAddWater(500)}
                className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-extrabold text-xs hover:bg-blue-100 cursor-pointer"
              >
                {t.quickAdd500}
              </button>
              <button
                onClick={() => setShowAddDrinkModal(true)}
                className="px-3 py-1.5 rounded-full bg-slate-900 text-white font-extrabold text-xs flex items-center gap-1 hover:bg-slate-800 transition-all shadow-2xs cursor-pointer"
              >
                <Plus size={14} />
                <span>{t.addDrinkBtn}</span>
              </button>
            </div>
          </div>

          {/* Hydration Bar Summary */}
          <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-blue-700 uppercase">{t.hydrationTarget}</span>
              <p className="text-xl font-black text-slate-900">{totalHydrationMl} ml / 2,500 ml ({totalWaterCups} Gelas)</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-lg shadow-2xs">
              💧
            </div>
          </div>

          {/* Liquids Item List */}
          {hydrationLogs.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm font-medium border border-dashed border-slate-200 rounded-xl">
              {t.noDrinksLogged}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {hydrationLogs.map((item) => (
                <div key={item.id} className="p-3.5 bg-white flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <Coffee size={16} className="text-blue-500" />
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900">{item.foodName}</h4>
                      <p className="text-xs text-slate-500 font-medium">
                        {item.volumeMl || 250} ml • {item.calories || 0} kcal
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
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">{t.coachRecommendation} ({coachName})</h2>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-black flex items-center justify-center text-sm shrink-0">
              {isMaxPersona ? "M" : "N"}
            </div>
            <div className="space-y-1">
              <h4 className="font-extrabold text-sm text-slate-900">{coachName} Advice</h4>
              <p className="text-sm text-slate-700 font-medium leading-relaxed">{getCoachFeelingRecommendation()}</p>
            </div>
          </div>
        </div>

      </main>

      {/* AUTO REMINDER MODAL (Requirement 5) */}
      <AnimatePresence>
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
                <label className="text-xs font-extrabold text-slate-600 uppercase">Pilih Jam Pengingat:</label>
                <div className="grid grid-cols-4 gap-2">
                  {["16:00", "17:00", "19:00", "20:00"].map((timeStr) => (
                    <button
                      key={timeStr}
                      onClick={() => setSelectedReminderTime(timeStr)}
                      className={`py-2 rounded-lg text-xs font-extrabold border transition-all cursor-pointer ${
                        selectedReminderTime === timeStr
                          ? "bg-slate-900 text-white border-slate-900"
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
                  className="px-4 py-2 rounded-xl text-xs font-black bg-slate-900 text-white hover:bg-slate-800 transition-all cursor-pointer shadow-2xs"
                >
                  {t.setReminderBtn}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* WORKOUT DETAIL MODAL (Requirement 1) */}
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

              <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
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

              {/* Set Checkboxes */}
              <div className="space-y-2">
                <span className="text-xs font-black text-slate-700 uppercase">{t.setChecklistLabel}:</span>
                <div className="space-y-2">
                  {activeWorkoutDetail.setsState.map((isDone, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleToggleSet(activeWorkoutDetail.id, idx)}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isDone
                          ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-3 font-extrabold text-sm">
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${isDone ? "bg-emerald-600 border-emerald-700 text-white" : "bg-white border-slate-300"}`}>
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
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-slate-900 text-white hover:bg-slate-800 transition-all cursor-pointer shadow-2xs"
                >
                  {t.closeModal}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD FOOD MODAL */}
      <AnimatePresence>
        {showAddFoodModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-black text-base text-slate-900">{t.addMealModalTitle}</h3>
                <button onClick={() => setShowAddFoodModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
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
                    placeholder="misal: Nasi Goreng Telur"
                    className="w-full mt-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-slate-900"
                  />
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
                  onClick={() => setShowAddFoodModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {t.closeModal}
                </button>
                <button
                  onClick={() => handleSaveLogItem(false)}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-slate-900 text-white hover:bg-slate-800 cursor-pointer shadow-2xs"
                >
                  {t.saveEntry}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD DRINK MODAL */}
      <AnimatePresence>
        {showAddDrinkModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-black text-base text-slate-900">{t.addDrinkModalTitle}</h3>
                <button onClick={() => setShowAddDrinkModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">{t.drinkNameLabel}</label>
                  <input
                    type="text"
                    value={itemNameInput}
                    onChange={(e) => setItemNameInput(e.target.value)}
                    placeholder="misal: Air Mineral / Kopi Hitam / Protein Shake"
                    className="w-full mt-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">{t.volumeLabel}</label>
                  <input
                    type="number"
                    value={itemVolumeInput}
                    onChange={(e) => setItemVolumeInput(e.target.value)}
                    placeholder="250"
                    className="w-full mt-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setShowAddDrinkModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {t.closeModal}
                </button>
                <button
                  onClick={() => handleSaveLogItem(true)}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-2xs"
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
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base font-black focus:outline-none focus:border-slate-900"
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
                  className="px-4 py-2 rounded-xl text-xs font-black bg-slate-900 text-white hover:bg-slate-800 cursor-pointer shadow-2xs"
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
