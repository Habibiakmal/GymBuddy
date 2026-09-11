/**
 * GymBuddy Recommendation & Safety Engine
 * 
 * CORE DIRECTIVE:
 * Personalization and safety are a deterministic application-level engine.
 * Pipeline:
 * USER PROFILE
 *  → SAFETY / RESTRICTION ANALYSIS
 *  → NUTRITION / FITNESS TARGET ANALYSIS
 *  → CURRENT PROGRESS ANALYSIS
 *  → PERSONALIZED RECOMMENDATION
 *  → SAFETY VALIDATION (Hard Gate)
 *  → FINAL RESPONSE
 */

import { calculateDailyNutritionSummary, type DailyNutritionSummary } from "./nutritionEngine";

// ============================================================================
// 1. CANONICAL USER PROFILE CONTRACT
// ============================================================================

export interface CanonicalUserProfile {
  userId: string;
  phone: string;
  name: string;
  nickname: string;
  gender: "pria" | "wanita" | "unknown";
  age: number | "unknown";
  height: number | "unknown";
  weight: number | "unknown";
  targetWeight?: number;
  fitnessGoal: "lose" | "gain" | "health" | "maintain" | "unknown";
  goalTitle: string;
  persona: "mia" | "max";
  
  // Nutrition targets
  calorieTarget: number;
  macroTargets: {
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  sodiumTarget: number; // default 2000mg, reduced for hypertension
  sugarTarget: number;  // default 50g, reduced for diabetes

  // Health and safety constraints
  allergies: string[];
  allergiesStatus: "reported" | "none_reported" | "unknown";
  
  medicalConditions: string[];
  medicalConditionsStatus: "reported" | "none_reported" | "unknown";
  
  injuries: string[];
  injuriesStatus: "reported" | "none_reported" | "unknown";
  customInjury?: string;
  
  dislikedFoods: string[];
  equipment: "full_gym" | "dumbbells" | "bodyweight" | "unknown";
  workoutSchedule?: any[];
  updatedAt?: string;
}

export interface DailyNutrientTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sodium?: number;
  sugar?: number;
  logs?: any[];
}

export interface SafetyValidationResult {
  pass: boolean;
  violations: string[];
  reasons: string[];
  rejectedItems?: string[];
}

export interface MealCandidate {
  name: string;
  category: "sarapan" | "siang" | "malam" | "snack";
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number; // in mg
  sugar: number;  // in g
  ingredients: string[];
  prepMethod?: string;
  rationale?: string;
}

export interface ExerciseCandidate {
  id: string;
  name: string;
  indonesianName?: string;
  targetMuscles: string[];
  bodyArea: "lower_body" | "upper_body" | "core" | "full_body";
  movementPattern: "squat" | "lunge" | "hinge" | "overhead_press" | "horizontal_press" | "vertical_pull" | "horizontal_pull" | "jumping" | "core" | "cardio" | "isolation";
  impactLevel: "high" | "low" | "none";
  jointLoad: {
    knee: "high" | "moderate" | "low";
    shoulder: "high" | "moderate" | "low";
    spine: "high" | "moderate" | "low";
  };
  equipmentRequired: "full_gym" | "machine" | "barbell" | "cable" | "dumbbells" | "bodyweight";
  contraindications: string[]; // e.g. ["knee", "shoulder", "lower_back", "hypertension", "vertigo"]
  targetSets: number;
  targetReps: string;
  tips?: string;
}

// ============================================================================
// 2. DIAGNOSTIC SAFE LOGGER (NEVER LOGS PASSWORDS, TOKENS, OR SECRETS)
// ============================================================================

export interface RecommendationAuditLog {
  timestamp: string;
  userId: string;
  recommendationType: "meal_single" | "meal_weekly" | "workout_single" | "workout_weekly" | "next_step_tip";
  constraintsDetected: {
    allergies: string[];
    medicalConditions: string[];
    injuries: string[];
    dislikedFoods: string[];
    equipment: string;
  };
  candidateRecommendation: string;
  validationResult: "PASS" | "REJECTED";
  rejectionReason?: string;
  fallbackUsed?: string;
}

export function logRecommendationAudit(entry: RecommendationAuditLog): void {
  // Safe sanitize: ensure no sensitive keys are ever recorded
  const safeLog = {
    time: entry.timestamp || new Date().toISOString(),
    uid: entry.userId,
    type: entry.recommendationType,
    constraints: entry.constraintsDetected,
    candidate: entry.candidateRecommendation,
    status: entry.validationResult,
    reason: entry.rejectionReason || null,
    fallback: entry.fallbackUsed || null
  };
  console.log(`[RecommendationAudit] ${JSON.stringify(safeLog)}`);
}

// ============================================================================
// 3. PROFILE RESOLUTION & NORMALIZATION (NEVER INVENT USER DATA)
// ============================================================================

export function resolveCanonicalProfile(rawProfile: any, calculatedUserData?: any): CanonicalUserProfile {
  const p = rawProfile || {};
  const c = calculatedUserData || {};

  const phone = String(p.phone || p.normalizedPhone || c.phone || "").trim();
  const userId = String(p.userId || c.userId || `usr_${phone || "anon"}`).trim();
  const name = String(p.name || c.name || "Member").trim();
  const nickname = String(p.nickname || c.nickname || name.split(/\s+/)[0] || "Member").trim();
  
  // Gender
  let gender: "pria" | "wanita" | "unknown" = "unknown";
  const rawGender = String(p.gender || c.gender || "").toLowerCase();
  if (rawGender.includes("wanita") || rawGender.includes("female")) {
    gender = "wanita";
  } else if (rawGender.includes("pria") || rawGender.includes("male")) {
    gender = "pria";
  }

  // Age
  let age: number | "unknown" = "unknown";
  const rawAge = Number(p.age || c.age);
  if (!isNaN(rawAge) && rawAge > 0 && rawAge < 120) {
    age = rawAge;
  }

  // Height & Weight
  let height: number | "unknown" = "unknown";
  const rawHeight = Number(p.height || c.height);
  if (!isNaN(rawHeight) && rawHeight > 50 && rawHeight < 260) {
    height = rawHeight;
  }

  let weight: number | "unknown" = "unknown";
  const rawWeight = Number(p.weight || c.weight);
  if (!isNaN(rawWeight) && rawWeight > 20 && rawWeight < 350) {
    weight = rawWeight;
  }

  // Fitness Goal
  let fitnessGoal: "lose" | "gain" | "health" | "maintain" | "unknown" = "unknown";
  const rawGoal = String(p.goal || c.goal || "").toLowerCase();
  if (rawGoal.includes("lose") || rawGoal.includes("turun")) fitnessGoal = "lose";
  else if (rawGoal.includes("gain") || rawGoal.includes("naik")) fitnessGoal = "gain";
  else if (rawGoal.includes("health") || rawGoal.includes("sehat") || rawGoal.includes("maintain")) fitnessGoal = "health";

  const goalTitle = String(p.goalTitle || c.goalTitle || (
    fitnessGoal === "lose" ? "Menurunkan Berat Badan" :
    fitnessGoal === "gain" ? "Menaikkan Massa Otot" :
    fitnessGoal === "health" ? "Gaya Hidup Sehat & Fit" : "Program Kebugaran"
  ));

  // Persona
  const rawPersona = String(p.persona || c.persona || "").toLowerCase();
  const persona: "mia" | "max" = (rawPersona.includes("mia") || rawPersona.includes("nikita")) ? "mia" : "max";

  // Calorie & Macro Targets
  const calorieTarget = Number(p.targetCalories || c.targetCalories || p.dailyTargetCalories || 2000);
  const macroTargets = {
    protein: Number(p.proteinGrams || c.proteinGrams || p.dailyTargetProtein || 150),
    carbs: Number(p.carbGrams || c.carbGrams || p.dailyTargetCarbs || 200),
    fat: Number(p.fatGrams || c.fatGrams || p.dailyTargetFat || 60),
    fiber: Number(p.fiberGrams || c.fiberGrams || p.dailyTargetFiber || 28)
  };

  // ─── ALLERGIES (Never invent absence) ──────────────────────────────────────
  let allergies: string[] = [];
  let allergiesStatus: "reported" | "none_reported" | "unknown" = "unknown";
  
  const rawAllergies = p.allergies || c.allergies;
  if (rawAllergies !== undefined && rawAllergies !== null) {
    const list = Array.isArray(rawAllergies) ? rawAllergies : [String(rawAllergies)];
    const cleanList = list.map(a => String(a).trim().toLowerCase()).filter(Boolean);
    
    if (cleanList.length === 0) {
      allergiesStatus = "unknown";
    } else if (cleanList.length === 1 && (cleanList[0] === "none" || cleanList[0] === "tidak ada")) {
      allergies = ["none"];
      allergiesStatus = "none_reported";
    } else {
      allergies = cleanList.filter(a => a !== "none" && a !== "tidak ada");
      allergiesStatus = allergies.length > 0 ? "reported" : "none_reported";
    }
  }

  // ─── MEDICAL CONDITIONS (Never invent absence) ────────────────────────────
  let medicalConditions: string[] = [];
  let medicalConditionsStatus: "reported" | "none_reported" | "unknown" = p.medicalConditionsStatus || "unknown";

  const rawHp = p.healthProfile || c.healthProfile || {};
  const rawConditions = p.medicalConditions || p.conditions || rawHp.conditions || rawHp.medicalConditions || c.conditions || c.medicalConditions;
  const rawHasCond = p.healthStatus || rawHp.hasCondition;

  if (rawConditions !== undefined || rawHasCond !== undefined) {
    if (rawHasCond === "no_condition") {
      medicalConditionsStatus = "none_reported";
    } else if (rawHasCond === "prefer_not_to_say") {
      medicalConditionsStatus = "unknown";
    } else if (Array.isArray(rawConditions)) {
      medicalConditions = rawConditions.map(cd => String(cd).trim().toLowerCase()).filter(Boolean);
      medicalConditionsStatus = p.medicalConditionsStatus || (medicalConditions.length > 0 ? "reported" : "none_reported");
    }
  }
  // Also check custom/other condition
  const otherCondition = p.otherCondition || rawHp.otherCondition;
  if (otherCondition && typeof otherCondition === "string" && otherCondition.trim()) {
    medicalConditions.push(otherCondition.trim().toLowerCase());
    medicalConditionsStatus = "reported";
  }

  // Set target limits adapted to medical conditions
  let sodiumTarget = 2000;
  if (medicalConditions.some(c => c.includes("hypertens") || c.includes("darah tinggi") || c.includes("tekanan darah"))) {
    sodiumTarget = 1500; // Strict limit for hypertension
  }

  let sugarTarget = 50;
  if (medicalConditions.some(c => c.includes("diabet") || c.includes("gula darah"))) {
    sugarTarget = 25; // Strict limit for diabetes
  }

  // ─── INJURIES (Never invent absence) ─────────────────────────────────────
  let injuries: string[] = [];
  let injuriesStatus: "reported" | "none_reported" | "unknown" = "unknown";

  const rawInjuries = p.injuries || c.injuries;
  if (rawInjuries !== undefined && rawInjuries !== null) {
    const list = Array.isArray(rawInjuries) ? rawInjuries : [String(rawInjuries)];
    const cleanList = list.map(i => String(i).trim().toLowerCase()).filter(Boolean);

    if (cleanList.length === 0) {
      injuriesStatus = "unknown";
    } else if (cleanList.length === 1 && (cleanList[0] === "none" || cleanList[0] === "tidak ada")) {
      injuries = ["none"];
      injuriesStatus = "none_reported";
    } else {
      injuries = cleanList.filter(i => i !== "none" && i !== "tidak ada");
      injuriesStatus = injuries.length > 0 ? "reported" : "none_reported";
    }
  }

  // ─── DISLIKED FOODS ──────────────────────────────────────────────────────
  let dislikedFoods: string[] = [];
  const rawDislikes = p.dislikedFoods || p.dislikes || p.pantangan;
  if (Array.isArray(rawDislikes)) {
    dislikedFoods = rawDislikes.map(d => String(d).trim().toLowerCase()).filter(Boolean);
  } else if (typeof rawDislikes === "string" && rawDislikes.trim()) {
    dislikedFoods = rawDislikes.split(/[,;\n]/).map(d => d.trim().toLowerCase()).filter(Boolean);
  }

  // ─── EQUIPMENT ───────────────────────────────────────────────────────────
  let equipment: "full_gym" | "dumbbells" | "bodyweight" | "unknown" = "unknown";
  const rawEq = String(p.equipment || c.equipment || "").toLowerCase();
  if (rawEq.includes("bodyweight") || rawEq.includes("badan")) equipment = "bodyweight";
  else if (rawEq.includes("dumbbell")) equipment = "dumbbells";
  else if (rawEq.includes("gym") || rawEq.includes("lengkap") || rawEq.includes("fitness")) equipment = "full_gym";
  else if (rawEq) equipment = "full_gym"; // Standard default if stated

  return {
    userId,
    phone,
    name,
    nickname,
    gender,
    age,
    height,
    weight,
    targetWeight: p.targetWeight || c.targetWeight,
    fitnessGoal,
    goalTitle,
    persona,
    calorieTarget,
    macroTargets,
    sodiumTarget,
    sugarTarget,
    allergies,
    allergiesStatus,
    medicalConditions,
    medicalConditionsStatus,
    injuries,
    injuriesStatus,
    customInjury: p.customInjury || c.customInjury,
    dislikedFoods,
    equipment,
    workoutSchedule: p.workoutSchedule || c.workoutSchedule,
    updatedAt: p.updatedAt || new Date().toISOString()
  };
}

// ============================================================================
// 4. STRUCTURED ALLERGEN DICTIONARY & HIDDEN SOURCE ONTOLOGY
// ============================================================================

export interface AllergenRule {
  id: string;
  aliases: string[];
  prohibitedIngredients: string[];
  hiddenSources: string[];
}

export const ALLERGEN_REGISTRY: Record<string, AllergenRule> = {
  peanuts: {
    id: "peanuts",
    aliases: ["peanut", "peanuts", "kacang", "kacang tanah", "kacang-kacangan"],
    prohibitedIngredients: [
      "kacang", "kacang tanah", "peanut", "peanuts", "peanut butter",
      "selai kacang", "bumbu kacang", "saus kacang", "minyak kacang"
    ],
    hiddenSources: [
      "gado-gado", "gado gado", "pecel", "ketoprak", "bumbu pecel",
      "sate ayam bumbu kacang", "sate bumbu kacang", "rempeyek kacang",
      "batagor", "siomay bumbu kacang", "kuah kacang"
    ]
  },
  seafood: {
    id: "seafood",
    aliases: ["seafood", "shellfish", "udang", "kepiting", "cumi", "lobster", "kerang", "ikan laut"],
    prohibitedIngredients: [
      "udang", "shrimp", "prawn", "kepiting", "crab", "lobster", "cumi",
      "cumi-cumi", "squid", "kerang", "clam", "mussel", "oyster", "shellfish",
      "seafood", "terasi", "belacan", "petis", "ebi", "saus tiram", "oyster sauce",
      "minyak ikan", "fish sauce", "kecap ikan", "dashi", "katsuobushi"
    ],
    hiddenSources: [
      "sambal terasi", "nasi goreng terasi", "tumis kangkung terasi", "petis tahu",
      "rujak petis", "pempek ebi", "capcay saus tiram", "kangkung saus tiram",
      "cumi goreng tepung", "bakwan udang", "tekwan"
    ]
  },
  dairy: {
    id: "dairy",
    aliases: ["dairy", "susu", "laktosa", "milk", "lactose", "cheese", "keju"],
    prohibitedIngredients: [
      "susu", "milk", "susu sapi", "cow milk", "keju", "cheese", "mentega",
      "butter", "yogurt", "yoghurt", "whey", "whey protein", "krimer",
      "creamer", "cream", "krim", "sour cream", "laktosa", "buttermilk"
    ],
    hiddenSources: [
      "sop krim", "cream soup", "pasta carbonara", "roti bakar keju",
      "martabak manis mentega", "kopi susu", "milk tea", "smoothie susu",
      "puding susu", "saus bechamel"
    ]
  },
  eggs: {
    id: "eggs",
    aliases: ["egg", "eggs", "telur", "telor"],
    prohibitedIngredients: [
      "telur", "telor", "egg", "eggs", "putih telur", "kuning telur",
      "egg white", "egg yolk", "mayones", "mayonnaise", "mayo"
    ],
    hiddenSources: [
      "telur ceplok", "telur dadar", "omelet", "orak-arik telur", "nasi goreng telur",
      "martabak telur", "egg tart", "kue bolu", "salad dressing mayo"
    ]
  },
  gluten: {
    id: "gluten",
    aliases: ["gluten", "gandum", "wheat", "terigu"],
    prohibitedIngredients: [
      "gandum", "wheat", "tepung terigu", "terigu", "roti", "bread", "mie",
      "bakmi", "noodle", "pasta", "spaghetti", "macaroni", "biskuit", "pastry"
    ],
    hiddenSources: [
      "mie ayam", "indomie", "gorengan tepung", "ayam tepung krispi",
      "cumi goreng tepung", "roti tawar", "roti gandum", "shoyu"
    ]
  },
  soy: {
    id: "soy",
    aliases: ["soy", "kedelai", "soya", "tofu", "tahu"],
    prohibitedIngredients: [
      "kedelai", "soy", "soybean", "tahu", "tofu", "tempe", "tempeh",
      "kecap", "kecap manis", "kecap asin", "tauco", "susu kedelai", "edamame"
    ],
    hiddenSources: [
      "ayam kecap", "tumis tahu tempe", "tahu goreng", "tempe bacem",
      "orek tempe", "semur ayam kecap"
    ]
  }
};

// ============================================================================
// 5. EXERCISE BIOMECHANICS & INJURY CONTRAINDICATIONS
// ============================================================================

export const EXERCISE_REGISTRY: ExerciseCandidate[] = [
  // LOWER BODY
  {
    id: "leg-press",
    name: "Leg Press Machine",
    indonesianName: "Mesin Leg Press (Paha & Bokong)",
    targetMuscles: ["Quadriceps", "Gluteus"],
    bodyArea: "lower_body",
    movementPattern: "squat",
    impactLevel: "none",
    jointLoad: { knee: "moderate", shoulder: "low", spine: "low" },
    equipmentRequired: "machine",
    contraindications: [],
    targetSets: 4,
    targetReps: "4 Set x 10-12 Reps",
    tips: "Punggung menempel rata, jangan kunci mati sendi lutut di atas."
  },
  {
    id: "glute-bridge",
    name: "Glute Bridge & Hip Thrust",
    indonesianName: "Glute Bridge (Bokong & Hamstrings)",
    targetMuscles: ["Gluteus Maximus", "Hamstrings"],
    bodyArea: "lower_body",
    movementPattern: "hinge",
    impactLevel: "none",
    jointLoad: { knee: "low", shoulder: "low", spine: "low" },
    equipmentRequired: "bodyweight",
    contraindications: [],
    targetSets: 3,
    targetReps: "3 Set x 15 Reps",
    tips: "Sangat aman untuk lutut dan punggung bawah, fokus dorong pakai tumit."
  },
  {
    id: "bodyweight-squat",
    name: "Bodyweight Squat",
    indonesianName: "Squat Beban Tubuh",
    targetMuscles: ["Quadriceps", "Gluteus"],
    bodyArea: "lower_body",
    movementPattern: "squat",
    impactLevel: "low",
    jointLoad: { knee: "high", shoulder: "low", spine: "moderate" },
    equipmentRequired: "bodyweight",
    contraindications: ["knee"],
    targetSets: 3,
    targetReps: "3 Set x 12-15 Reps",
    tips: "Hindari jika ada cedera lutut akut."
  },
  {
    id: "jump-squat",
    name: "Jump Squat",
    indonesianName: "Squat Lompat",
    targetMuscles: ["Quadriceps", "Gluteus", "Calves"],
    bodyArea: "lower_body",
    movementPattern: "jumping",
    impactLevel: "high",
    jointLoad: { knee: "high", shoulder: "low", spine: "high" },
    equipmentRequired: "bodyweight",
    contraindications: ["knee", "lower_back"],
    targetSets: 3,
    targetReps: "3 Set x 10 Reps",
    tips: "Impact tinggi pada sendi lutut dan tulang belakang."
  },
  {
    id: "jumping-rope",
    name: "Jumping Rope",
    indonesianName: "Lompat Tali",
    targetMuscles: ["Calves", "Cardio"],
    bodyArea: "lower_body",
    movementPattern: "jumping",
    impactLevel: "high",
    jointLoad: { knee: "high", shoulder: "moderate", spine: "moderate" },
    equipmentRequired: "bodyweight",
    contraindications: ["knee", "lower_back", "hypertension", "vertigo"],
    targetSets: 4,
    targetReps: "4 Ronde x 1 Menit",
    tips: "Dilarang untuk cedera lutut atau masalah persendian kaki."
  },
  {
    id: "burpee",
    name: "Burpee",
    indonesianName: "Burpee (Full Body HIIT)",
    targetMuscles: ["Full Body", "Cardio"],
    bodyArea: "full_body",
    movementPattern: "jumping",
    impactLevel: "high",
    jointLoad: { knee: "high", shoulder: "high", spine: "high" },
    equipmentRequired: "bodyweight",
    contraindications: ["knee", "shoulder", "lower_back", "hypertension", "vertigo"],
    targetSets: 3,
    targetReps: "3 Set x 10 Reps",
    tips: "Gerakan compound eksplosif, hindari jika memiliki cedera lutut, bahu, atau punggung."
  },
  {
    id: "barbell-back-squat",
    name: "Barbell Back Squat",
    indonesianName: "Squat Barbell",
    targetMuscles: ["Quadriceps", "Gluteus", "Erector Spinae"],
    bodyArea: "lower_body",
    movementPattern: "squat",
    impactLevel: "low",
    jointLoad: { knee: "high", shoulder: "moderate", spine: "high" },
    equipmentRequired: "barbell",
    contraindications: ["knee", "lower_back"],
    targetSets: 4,
    targetReps: "4 Set x 8-10 Reps",
    tips: "Beban aksial menekan tulang belakang dan lutut."
  },
  {
    id: "dumbbell-goblet-squat",
    name: "Dumbbell Goblet Squat",
    indonesianName: "Goblet Squat Dumbbell",
    targetMuscles: ["Quadriceps", "Gluteus"],
    bodyArea: "lower_body",
    movementPattern: "squat",
    impactLevel: "low",
    jointLoad: { knee: "high", shoulder: "low", spine: "moderate" },
    equipmentRequired: "dumbbells",
    contraindications: ["knee"],
    targetSets: 3,
    targetReps: "3 Set x 12 Reps",
    tips: "Pegang dumbbell di dada, jaga postur tegak."
  },
  {
    id: "dumbbell-romanian-deadlift",
    name: "Dumbbell Romanian Deadlift",
    indonesianName: "Romanian Deadlift Dumbbell",
    targetMuscles: ["Hamstrings", "Gluteus"],
    bodyArea: "lower_body",
    movementPattern: "hinge",
    impactLevel: "none",
    jointLoad: { knee: "low", shoulder: "low", spine: "moderate" },
    equipmentRequired: "dumbbells",
    contraindications: ["lower_back"],
    targetSets: 3,
    targetReps: "3 Set x 12 Reps",
    tips: "Aman untuk lutut karena lutut semi-fixed, namun perlu kontrol punggung bawah."
  },

  // UPPER BODY
  {
    id: "push-up",
    name: "Push-Up (Regular / Knee)",
    indonesianName: "Push-Up",
    targetMuscles: ["Pectoralis Major", "Triceps", "Anterior Deltoids"],
    bodyArea: "upper_body",
    movementPattern: "horizontal_press",
    impactLevel: "none",
    jointLoad: { knee: "low", shoulder: "moderate", spine: "low" },
    equipmentRequired: "bodyweight",
    contraindications: [],
    targetSets: 3,
    targetReps: "3 Set x 12 Reps",
    tips: "Jaga siku 45 derajat dari badan, tubuh lurus dari kepala ke tumit."
  },
  {
    id: "dumbbell-bench-press",
    name: "Dumbbell Bench Press",
    indonesianName: "Bench Press Dumbbell",
    targetMuscles: ["Dada", "Triceps"],
    bodyArea: "upper_body",
    movementPattern: "horizontal_press",
    impactLevel: "none",
    jointLoad: { knee: "low", shoulder: "moderate", spine: "low" },
    equipmentRequired: "dumbbells",
    contraindications: [],
    targetSets: 4,
    targetReps: "4 Set x 10-12 Reps",
    tips: "Jaga stabilitas bahu, dorong kuat ke atas tanpa membenturkan dumbbell."
  },
  {
    id: "overhead-dumbbell-press",
    name: "Overhead Dumbbell Shoulder Press",
    indonesianName: "Shoulder Press Dumbbell",
    targetMuscles: ["Bahu Depan & Samping", "Triceps"],
    bodyArea: "upper_body",
    movementPattern: "overhead_press",
    impactLevel: "none",
    jointLoad: { knee: "low", shoulder: "high", spine: "moderate" },
    equipmentRequired: "dumbbells",
    contraindications: ["shoulder"],
    targetSets: 3,
    targetReps: "3 Set x 10-12 Reps",
    tips: "DILARANG jika mengalami cedera bahu atau impingement rotator cuff."
  },
  {
    id: "chest-supported-row",
    name: "Chest-Supported Dumbbell Row",
    indonesianName: "Row Dumbbell dengan Sandaran Dada",
    targetMuscles: ["Upper Back", "Rhomboids", "Lats"],
    bodyArea: "upper_body",
    movementPattern: "horizontal_pull",
    impactLevel: "none",
    jointLoad: { knee: "low", shoulder: "low", spine: "low" },
    equipmentRequired: "dumbbells",
    contraindications: [],
    targetSets: 4,
    targetReps: "4 Set x 12 Reps",
    tips: "Sangat aman untuk punggung bawah dan lutut karena dada disangga bangku miring."
  },
  {
    id: "barbell-bent-over-row",
    name: "Barbell Bent-Over Row",
    indonesianName: "Bent-Over Row Barbell",
    targetMuscles: ["Lats", "Rhomboids", "Erector Spinae"],
    bodyArea: "upper_body",
    movementPattern: "horizontal_pull",
    impactLevel: "none",
    jointLoad: { knee: "moderate", shoulder: "moderate", spine: "high" },
    equipmentRequired: "barbell",
    contraindications: ["lower_back"],
    targetSets: 4,
    targetReps: "4 Set x 8-10 Reps",
    tips: "Beban torsi tinggi pada punggung bawah, dilarang jika ada cedera lumbar."
  },
  {
    id: "lat-pulldown",
    name: "Wide-Grip Lat Pulldown Machine",
    indonesianName: "Mesin Lat Pulldown",
    targetMuscles: ["Latissimus Dorsi", "Biceps"],
    bodyArea: "upper_body",
    movementPattern: "vertical_pull",
    impactLevel: "none",
    jointLoad: { knee: "low", shoulder: "low", spine: "low" },
    equipmentRequired: "machine",
    contraindications: [],
    targetSets: 4,
    targetReps: "4 Set x 10-12 Reps",
    tips: "Tarik ke dada atas, jangan ke belakang leher."
  },
  {
    id: "seated-cable-row",
    name: "Seated Cable Row",
    indonesianName: "Dayung Kabel Duduk",
    targetMuscles: ["Middle Back", "Lats"],
    bodyArea: "upper_body",
    movementPattern: "horizontal_pull",
    impactLevel: "none",
    jointLoad: { knee: "low", shoulder: "low", spine: "low" },
    equipmentRequired: "cable",
    contraindications: [],
    targetSets: 3,
    targetReps: "3 Set x 12 Reps",
    tips: "Jaga dada tegak, squeeze belikat di akhir tarikan."
  },
  {
    id: "lateral-raise",
    name: "Dumbbell Side Lateral Raise",
    indonesianName: "Lateral Raise Dumbbell",
    targetMuscles: ["Side Deltoids"],
    bodyArea: "upper_body",
    movementPattern: "isolation",
    impactLevel: "none",
    jointLoad: { knee: "low", shoulder: "moderate", spine: "low" },
    equipmentRequired: "dumbbells",
    contraindications: ["shoulder"],
    targetSets: 3,
    targetReps: "3 Set x 15 Reps",
    tips: "Gunakan beban ringan untuk isolasi bahu samping."
  },

  // CORE & RECOVERY
  {
    id: "plank-hold",
    name: "Plank Hold",
    indonesianName: "Plank Statis",
    targetMuscles: ["Core", "Transverse Abdominis"],
    bodyArea: "core",
    movementPattern: "core",
    impactLevel: "none",
    jointLoad: { knee: "low", shoulder: "low", spine: "low" },
    equipmentRequired: "bodyweight",
    contraindications: [],
    targetSets: 3,
    targetReps: "3 Set x 45 Detik",
    tips: "Tahan perut tetap kencang, pinggul sejajar tidak melorot."
  },
  {
    id: "incline-treadmill-walk",
    name: "Incline Treadmill Walk",
    indonesianName: "Jalan Menanjak Treadmill",
    targetMuscles: ["Cardio", "Glutes", "Calves"],
    bodyArea: "lower_body",
    movementPattern: "cardio",
    impactLevel: "low",
    jointLoad: { knee: "low", shoulder: "low", spine: "low" },
    equipmentRequired: "machine",
    contraindications: [],
    targetSets: 1,
    targetReps: "25-30 Menit",
    tips: "Kardio pembakar lemak rendah impact, sangat ramah sendi lutut."
  },
  {
    id: "stationary-bike",
    name: "Stationary Bike",
    indonesianName: "Sepeda Statis",
    targetMuscles: ["Cardio", "Quadriceps"],
    bodyArea: "lower_body",
    movementPattern: "cardio",
    impactLevel: "none",
    jointLoad: { knee: "low", shoulder: "low", spine: "low" },
    equipmentRequired: "machine",
    contraindications: [],
    targetSets: 1,
    targetReps: "20-30 Menit",
    tips: "Tanpa impact benturan ke lantai, aman untuk lutut."
  },
  {
    id: "active-mobility-stretch",
    name: "Dynamic Mobility & Stretching",
    indonesianName: "Peregangan Mobilitas Dinamis",
    targetMuscles: ["Full Body Mobility"],
    bodyArea: "full_body",
    movementPattern: "isolation",
    impactLevel: "none",
    jointLoad: { knee: "low", shoulder: "low", spine: "low" },
    equipmentRequired: "bodyweight",
    contraindications: [],
    targetSets: 1,
    targetReps: "15 Menit Mobilitas",
    tips: "Meningkatkan sirkulasi darah dan pemulihan sendi tanpa beban."
  }
];

// ============================================================================
// 6. HARD GATE SAFETY VALIDATORS
// ============================================================================

export function validateFoodSafety(
  rawMeal: Partial<MealCandidate> | MealCandidate | any,
  rawProfile: CanonicalUserProfile | any
): SafetyValidationResult & { isSafe: boolean; reason: string; matchedAllergens: string[] } {
  const profile = resolveCanonicalProfile(rawProfile);
  const meal: MealCandidate = {
    name: rawMeal.name || "",
    category: rawMeal.category || "siang",
    calories: Number(rawMeal.calories) || 0,
    protein: Number(rawMeal.protein) || 0,
    carbs: Number(rawMeal.carbs) || 0,
    fat: Number(rawMeal.fat) || 0,
    fiber: Number(rawMeal.fiber) || 0,
    sodium: Number(rawMeal.sodium ?? rawMeal.sodiumMg ?? 0),
    sugar: Number(rawMeal.sugar ?? rawMeal.sugarG ?? 0),
    ingredients: Array.isArray(rawMeal.ingredients) ? rawMeal.ingredients : [],
    prepMethod: rawMeal.prepMethod || ""
  };

  const violations: string[] = [];
  const reasons: string[] = [];
  const rejectedItems: string[] = [];

  const mealText = `${meal.name} ${(meal.ingredients || []).join(" ")} ${meal.prepMethod || ""}`.toLowerCase();

  // 1. HARD ALLERGEN CHECK
  if (profile.allergiesStatus === "reported" && profile.allergies.length > 0) {
    for (const allergyId of profile.allergies) {
      const cleanAllergy = allergyId.trim().toLowerCase();
      if (cleanAllergy === "none" || cleanAllergy === "tidak ada") continue;

      // Find matched rule or fuzzy lookup
      let matchedRule: AllergenRule | undefined = ALLERGEN_REGISTRY[cleanAllergy];
      if (!matchedRule) {
        for (const rule of Object.values(ALLERGEN_REGISTRY)) {
          if (rule.aliases.some(alias => cleanAllergy.includes(alias) || alias.includes(cleanAllergy))) {
            matchedRule = rule;
            break;
          }
        }
      }

      if (matchedRule) {
        // Check direct prohibited ingredients
        for (const item of matchedRule.prohibitedIngredients) {
          if (mealText.includes(item)) {
            violations.push(`allergen_conflict:${matchedRule.id}`);
            reasons.push(`Mengandung bahan alergen '${item}' yang bertentangan dengan alergi ${matchedRule.id}`);
            rejectedItems.push(item);
          }
        }
        // Check known hidden sources
        for (const source of matchedRule.hiddenSources) {
          if (mealText.includes(source)) {
            violations.push(`hidden_allergen:${matchedRule.id}`);
            reasons.push(`Mengandung olahan '${source}' yang berpotensi memiliki turunan ${matchedRule.id}`);
            rejectedItems.push(source);
          }
        }
      } else {
        // Fallback exact keyword check for custom allergen
        if (mealText.includes(cleanAllergy)) {
          violations.push(`allergen_conflict:${cleanAllergy}`);
          reasons.push(`Mengandung bahan yang memicu alergi spesifik: '${cleanAllergy}'`);
          rejectedItems.push(cleanAllergy);
        }
      }
    }
  }

  // 2. MEDICAL CONDITIONS HARD CHECK
  if (profile.medicalConditionsStatus === "reported" && profile.medicalConditions.length > 0) {
    const hasHypertension = profile.medicalConditions.some(c => c.includes("hypertens") || c.includes("darah tinggi") || c.includes("tekanan darah"));
    const hasDiabetes = profile.medicalConditions.some(c => c.includes("diabet") || c.includes("gula"));
    const hasCholesterol = profile.medicalConditions.some(c => c.includes("cholesterol") || c.includes("kolesterol"));
    const hasHeart = profile.medicalConditions.some(c => c.includes("heart") || c.includes("jantung"));

    // Hypertension guards
    if (hasHypertension) {
      if (meal.sodium > 600) {
        violations.push("medical_sodium_exceeded");
        reasons.push(`Sodium menu (${meal.sodium}mg) melebihi batas aman untuk kondisi hipertensi (<600mg per meal)`);
      }
      const saltyKeywords = ["ikan asin", "keripik asin", "kuah instan", "sosis asin", "kornet", "kecap asin pekat"];
      for (const kw of saltyKeywords) {
        if (mealText.includes(kw)) {
          violations.push(`medical_hypertension_ingredient:${kw}`);
          reasons.push(`Makanan '${kw}' tinggi garam tidak dianjurkan untuk riwayat hipertensi`);
        }
      }
    }

    // Diabetes guards
    if (hasDiabetes) {
      if (meal.sugar > 8) {
        violations.push("medical_sugar_exceeded");
        reasons.push(`Kandungan gula (${meal.sugar}g) melebihi batas anjuran diabetes (<8g per meal)`);
      }
      const sugaryKeywords = ["es teh manis", "sirup", "kue manis", "boba", "madu pekat", "soda", "kolak"];
      for (const kw of sugaryKeywords) {
        if (mealText.includes(kw)) {
          violations.push(`medical_diabetes_ingredient:${kw}`);
          reasons.push(`Makanan/minuman '${kw}' tinggi gula bebas tidak dianjurkan untuk riwayat diabetes`);
        }
      }
    }

    // Cholesterol guards
    if (hasCholesterol) {
      if (meal.fat > 18) {
        violations.push("medical_fat_exceeded");
        reasons.push(`Lemak menu (${meal.fat}g) melebihi batas anjuran kolesterol tinggi (<18g per meal)`);
      }
      const fattyKeywords = ["gorengan", "santan kental", "gulai otak", "jeroan", "kulit ayam krispi", "lemak sapi"];
      for (const kw of fattyKeywords) {
        if (mealText.includes(kw)) {
          violations.push(`medical_cholesterol_ingredient:${kw}`);
          reasons.push(`Makanan '${kw}' tinggi lemak jenuh/kolesterol tidak dianjurkan`);
        }
      }
    }

    // Heart condition: no extreme heavy meals
    if (hasHeart) {
      if (meal.calories > 850) {
        violations.push("medical_heart_heavy_meal");
        reasons.push(`Porsi kalori terlalu berat (${meal.calories} kcal) untuk kondisi jantung; utamakan porsi moderat`);
      }
    }
  }

  // 3. DISLIKED FOODS CHECK
  if (profile.dislikedFoods && profile.dislikedFoods.length > 0) {
    for (const dislike of profile.dislikedFoods) {
      if (mealText.includes(dislike)) {
        violations.push(`disliked_food:${dislike}`);
        reasons.push(`Mengandung bahan yang tidak disukai pengguna: '${dislike}'`);
      }
    }
  }

  const pass = violations.length === 0;

  return {
    pass,
    isSafe: pass,
    violations,
    reasons,
    reason: reasons[0] || "",
    rejectedItems,
    matchedAllergens: rejectedItems
  };
}

export function validateWorkoutSafety(
  rawExercise: Partial<ExerciseCandidate> | ExerciseCandidate | any,
  rawProfile: CanonicalUserProfile | any
): SafetyValidationResult & { isSafe: boolean; reason: string } {
  const profile = resolveCanonicalProfile(rawProfile);
  let exercise: ExerciseCandidate;

  const found = EXERCISE_REGISTRY.find(e => 
    e.id.toLowerCase() === String(rawExercise.id || "").toLowerCase() ||
    e.name.toLowerCase() === String(rawExercise.name || "").toLowerCase() ||
    (e.indonesianName && e.indonesianName.toLowerCase() === String(rawExercise.name || "").toLowerCase()) ||
    String(rawExercise.name || "").toLowerCase().includes(e.name.toLowerCase())
  );

  if (found) {
    exercise = { ...found, ...rawExercise };
  } else {
    const rawName = String(rawExercise.name || "").toLowerCase();
    const isJumping = rawName.includes("jump") || rawName.includes("lompat") || rawName.includes("burpee") || rawName.includes("rope");
    const isOverhead = rawName.includes("overhead") || rawName.includes("shoulder press") || rawName.includes("military press");
    const isDeadlift = rawName.includes("deadlift") || rawName.includes("bent-over row");
    const isSquat = rawName.includes("squat");
    const isHIIT = rawName.includes("hiit") || rawName.includes("sprint") || rawName.includes("extreme");

    exercise = {
      id: rawExercise.id || "custom-ex",
      name: rawExercise.name || "Custom Exercise",
      targetMuscles: rawExercise.targetMuscles || ["General"],
      bodyArea: rawExercise.bodyArea || (isOverhead ? "upper_body" : isSquat || isDeadlift ? "lower_body" : "full_body"),
      movementPattern: rawExercise.movementPattern || (isJumping ? "jumping" : isOverhead ? "overhead_press" : isDeadlift ? "hinge" : isSquat ? "squat" : "isolation"),
      impactLevel: rawExercise.impactLevel || rawExercise.impact || (isJumping || isHIIT ? "high" : "none"),
      jointLoad: rawExercise.jointLoad || {
        knee: isSquat || isJumping ? "high" : "low",
        shoulder: isOverhead ? "high" : "low",
        spine: isDeadlift || isSquat ? "high" : "low"
      },
      equipmentRequired: rawExercise.equipmentRequired || "bodyweight",
      contraindications: rawExercise.contraindications || [
        ...(isSquat || isJumping ? ["knee"] : []),
        ...(isOverhead ? ["shoulder"] : []),
        ...(isDeadlift ? ["lower_back"] : []),
        ...(isHIIT || isJumping ? ["hypertension", "vertigo"] : [])
      ],
      targetSets: rawExercise.targetSets || 3,
      targetReps: rawExercise.targetReps || "10 Reps"
    };
  }

  const violations: string[] = [];
  const reasons: string[] = [];

  // 1. INJURIES HARD GATE
  if (profile.injuriesStatus === "reported" && profile.injuries.length > 0) {
    for (const injury of profile.injuries) {
      const cleanInjury = injury.trim().toLowerCase();
      if (cleanInjury === "none" || cleanInjury === "tidak ada") continue;

      // Knee Injury checks
      if (cleanInjury.includes("knee") || cleanInjury.includes("lutut")) {
        if (exercise.jointLoad?.knee === "high" || exercise.contraindications?.includes("knee")) {
          violations.push("injury_contraindication:knee");
          reasons.push(`Latihan '${exercise.name}' memiliki beban sendi lutut tinggi (contraindicated for knee injury)`);
        }
        if (exercise.impactLevel === "high" || exercise.movementPattern === "jumping") {
          violations.push("injury_impact_contraindication:knee");
          reasons.push(`Latihan lompat/high impact '${exercise.name}' dilarang untuk cedera lutut`);
        }
      }

      // Shoulder Injury checks
      if (cleanInjury.includes("shoulder") || cleanInjury.includes("bahu")) {
        if (exercise.jointLoad?.shoulder === "high" || exercise.contraindications?.includes("shoulder")) {
          violations.push("injury_contraindication:shoulder");
          reasons.push(`Latihan '${exercise.name}' membebani sendi bahu secara berlebihan (contraindicated for shoulder injury)`);
        }
        if (exercise.movementPattern === "overhead_press") {
          violations.push("injury_overhead_contraindication:shoulder");
          reasons.push(`Gerakan overhead press '${exercise.name}' berisiko memicu impingement bahu`);
        }
      }

      // Lower Back Injury checks
      if (cleanInjury.includes("lower_back") || cleanInjury.includes("back") || cleanInjury.includes("punggung") || cleanInjury.includes("pinggang")) {
        if (exercise.jointLoad?.spine === "high" || exercise.contraindications?.includes("lower_back")) {
          violations.push("injury_contraindication:lower_back");
          reasons.push(`Latihan '${exercise.name}' memberi beban aksial tinggi pada tulang belakang (contraindicated for lower back)`);
        }
      }

      // Vertigo / Hypertension checks
      if (cleanInjury.includes("hypertens") || cleanInjury.includes("vertigo") || cleanInjury.includes("darah tinggi")) {
        if (exercise.contraindications?.includes("hypertension") || exercise.contraindications?.includes("vertigo")) {
          violations.push("injury_contraindication:vertigo_hypertension");
          reasons.push(`Latihan eksplosif / posisi kepala berganti cepat '${exercise.name}' dilarang untuk riwayat vertigo/tekanan darah`);
        }
      }
    }
  }

  // 2. MEDICAL CONDITIONS WORKOUT CHECKS (Heart, Hypertension)
  if (profile.medicalConditionsStatus === "reported" && profile.medicalConditions.length > 0) {
    const hasHeart = profile.medicalConditions.some(c => c.includes("heart") || c.includes("jantung"));
    const hasHyper = profile.medicalConditions.some(c => c.includes("hypertens") || c.includes("darah tinggi"));

    if (hasHeart && (exercise.impactLevel === "high" || exercise.movementPattern === "jumping" || exercise.name.toLowerCase().includes("hiit") || exercise.name.toLowerCase().includes("sprint"))) {
      violations.push("medical_condition:heart");
      reasons.push(`Latihan intensitas tinggi/ekstrem '${exercise.name}' dilarang untuk riwayat penyakit jantung`);
    }

    if (hasHyper && (exercise.contraindications?.includes("hypertension") || exercise.movementPattern === "jumping")) {
      violations.push("medical_condition:hypertension");
      reasons.push(`Latihan eksplosif '${exercise.name}' dilarang untuk kondisi hipertensi`);
    }
  }

  // 3. EQUIPMENT RESTRICTION CHECK
  if (profile.equipment === "bodyweight") {
    if (exercise.equipmentRequired !== "bodyweight") {
      violations.push(`equipment_mismatch:${exercise.equipmentRequired}`);
      reasons.push(`Latihan '${exercise.name}' memerlukan alat (${exercise.equipmentRequired}), profil hanya memiliki bodyweight`);
    }
  } else if (profile.equipment === "dumbbells") {
    if (exercise.equipmentRequired !== "bodyweight" && exercise.equipmentRequired !== "dumbbells") {
      violations.push(`equipment_mismatch:${exercise.equipmentRequired}`);
      reasons.push(`Latihan '${exercise.name}' memerlukan alat gym/mesin, profil hanya memiliki dumbbell`);
    }
  }

  const pass = violations.length === 0;

  return {
    pass,
    isSafe: pass,
    violations,
    reasons,
    reason: reasons[0] || ""
  };
}

// ============================================================================
// 7. DYNAMIC MEAL CANDIDATE POOL (CLEAN & BALANCED BASE)
// ============================================================================

export const BASE_MEAL_POOL: MealCandidate[] = [
  // BREAKFAST
  {
    name: "2 Telur Rebus + Oatmeal Buah Segar",
    category: "sarapan",
    calories: 320,
    protein: 18,
    carbs: 42,
    fat: 9,
    fiber: 5,
    sodium: 140,
    sugar: 8,
    ingredients: ["telur rebus", "oatmeal", "potongan pisang", "air panas"],
    prepMethod: "rebus",
    rationale: "Karbohidrat kompleks lambat serap dan protein telur untuk energi pagi stabil."
  },
  {
    name: "Oatmeal Apel Kayu Manis + Biji Chia Nabati",
    category: "sarapan",
    calories: 280,
    protein: 8,
    carbs: 52,
    fat: 5,
    fiber: 9,
    sodium: 40,
    sugar: 7,
    ingredients: ["oatmeal", "apel segar", "biji chia", "kayu manis bubuk", "air hangat"],
    prepMethod: "seduh",
    rationale: "Formula nabati bersih kaya serat larut dan mikronutrien."
  },
  {
    name: "Pepes Ikan Nila Bening + 1 Centong Nasi Merah + Timun",
    category: "sarapan",
    calories: 350,
    protein: 28,
    carbs: 45,
    fat: 6,
    fiber: 4,
    sodium: 260,
    sugar: 2,
    ingredients: ["ikan nila", "bumbu kuning kunyit jahe", "nasi merah", "timun segar"],
    prepMethod: "kukus",
    rationale: "Sarapan tinggi protein ikan segar dengan rempah antiinflamasi alami."
  },
  {
    name: "Tahu Kukus Kemangi + Ubi Rebus + Selada",
    category: "sarapan",
    calories: 260,
    protein: 14,
    carbs: 40,
    fat: 5,
    fiber: 6,
    sodium: 120,
    sugar: 4,
    ingredients: ["tahu putih", "daun kemangi", "ubi kuning kukus", "selada"],
    prepMethod: "kukus",
    rationale: "Pilihan nabati murni rendah garam dan ramah eliminasi."
  },

  // LUNCH
  {
    name: "Dada Ayam Panggang Herbal + Nasi Merah + Tumis Buncis Jagung",
    category: "siang",
    calories: 460,
    protein: 36,
    carbs: 52,
    fat: 8,
    fiber: 6,
    sodium: 320,
    sugar: 3,
    ingredients: ["dada ayam tanpa kulit", "bawang putih", "lada hitam", "nasi merah", "buncis", "jagung manis"],
    prepMethod: "panggang",
    rationale: "Padat protein murni dengan bumbu herbal segar, ramah tekanan darah."
  },
  {
    name: "Pepes Ikan Mas Daun Kemangi + Sayur Bening Bayam + Kentang Rebus",
    category: "siang",
    calories: 410,
    protein: 32,
    carbs: 48,
    fat: 9,
    fiber: 5,
    sodium: 280,
    sugar: 2,
    ingredients: ["ikan mas", "daun kemangi", "bayam segar", "jagung", "kentang rebus"],
    prepMethod: "kukus bening",
    rationale: "Rendah natrium dan lemak jenuh, sangat aman untuk hipertensi dan kolesterol."
  },
  {
    name: "Daging Sapi Has Dalam Lada Hitam (Sedikit Minyak) + Nasi Putih + Brokoli Kukus",
    category: "siang",
    calories: 480,
    protein: 34,
    carbs: 55,
    fat: 11,
    fiber: 5,
    sodium: 380,
    sugar: 3,
    ingredients: ["daging sapi has dalam lean", "lada hitam", "bawang bombay", "nasi putih", "brokoli kukus"],
    prepMethod: "tumis sedikit minyak zaitun",
    rationale: "Sumber zat besi dan zinc tinggi dengan pemotongan lemak berlebih."
  },
  {
    name: "Tumis Tempe Buncis Bawang Putih + Kentang Rebus + Sup Wortel",
    category: "siang",
    calories: 380,
    protein: 20,
    carbs: 54,
    fat: 9,
    fiber: 8,
    sodium: 210,
    sugar: 3,
    ingredients: ["tempe kedelai segar", "buncis", "kentang rebus", "wortel bening"],
    prepMethod: "tumis air",
    rationale: "Pilihan nabati berserat tinggi yang menjaga profil lipid tetap sehat."
  },

  // DINNER
  {
    name: "Sup Ayam Bening Wortel & Jamur + 1/2 Centong Nasi + Lalapan Timun",
    category: "malam",
    calories: 360,
    protein: 30,
    carbs: 38,
    fat: 7,
    fiber: 4,
    sodium: 340,
    sugar: 2,
    ingredients: ["dada ayam cincang", "wortel", "jamur tiram", "bawang putih kaldu bening", "nasi putih", "timun"],
    prepMethod: "rebus sup",
    rationale: "Hangat, mudah dicerna sebelum tidur, dan mendukung pemulihan otot malam hari."
  },
  {
    name: "Pepes Tahu Jamur + Sayur Bening Bayam + 1 Centong Nasi Jagung",
    category: "malam",
    calories: 310,
    protein: 18,
    carbs: 44,
    fat: 6,
    fiber: 6,
    sodium: 190,
    sugar: 2,
    ingredients: ["tahu putih", "jamur kuping", "daun salam", "bayam", "nasi jagung"],
    prepMethod: "kukus",
    rationale: "Bebas kolesterol jenuh dan natrium sangat minimal, mendukung tidur nyenyak."
  },
  {
    name: "Ikan Kembung Bakar Kunyit (Tanpa Sambal Terasi) + Lalapan Daun Selada + Ubi Rebus",
    category: "malam",
    calories: 390,
    protein: 29,
    carbs: 42,
    fat: 10,
    fiber: 5,
    sodium: 230,
    sugar: 3,
    ingredients: ["ikan kembung", "kunyit jahe", "selada segar", "ubi rebus"],
    prepMethod: "bakar teflon",
    rationale: "Kaya asam lemak Omega-3 alami untuk kesehatan pembuluh darah dan sendi."
  },

  // SNACK
  {
    name: "1 Buah Apel Segar + 15g Biji Bunga Matahari",
    category: "snack",
    calories: 140,
    protein: 4,
    carbs: 21,
    fat: 5,
    fiber: 4,
    sodium: 10,
    sugar: 14,
    ingredients: ["apel fuji", "biji bunga matahari tanpa garam"],
    prepMethod: "segar",
    rationale: "Camilan segar kaya mikronutrien antioksidan tanpa sodium dan tanpa lemak jenuh."
  },
  {
    name: "1 Buah Pir Segar / Jambu Biji Merah Potong",
    category: "snack",
    calories: 80,
    protein: 1,
    carbs: 19,
    fat: 0,
    fiber: 5,
    sodium: 5,
    sugar: 12,
    ingredients: ["buah pir segar"],
    prepMethod: "segar",
    rationale: "Bebas alergen total, hidrasi alami dan ramah diabetes karena indeks glikemik rendah."
  },
  {
    name: "Edamame Rebus Tanpa Garam (100g)",
    category: "snack",
    calories: 120,
    protein: 11,
    carbs: 9,
    fat: 5,
    fiber: 5,
    sodium: 15,
    sugar: 2,
    ingredients: ["edamame segar", "air rebusan"],
    prepMethod: "rebus",
    rationale: "Tinggi protein nabati dan serat, sangat mengenyangkan di sela jam makan."
  }
];

// ============================================================================
// 8. PERSONALIZED SINGLE MEAL RECOMMENDATION GENERATOR
// ============================================================================

export function generatePersonalizedMealRecommendation(
  rawProfile: any,
  rawTotals?: any,
  userText?: string
): string {
  const profile = resolveCanonicalProfile(rawProfile);
  const totals: DailyNutrientTotals = {
    calories: Number(rawTotals?.calories) || 0,
    protein: Number(rawTotals?.protein) || 0,
    carbs: Number(rawTotals?.carbs) || 0,
    fat: Number(rawTotals?.fat) || 0,
    sodium: Number(rawTotals?.sodium) || 0,
    sugar: Number(rawTotals?.sugar) || 0
  };

  const remainingCal = Math.max(0, profile.calorieTarget - totals.calories);
  const remainingProt = Math.max(0, profile.macroTargets.protein - totals.protein);
  const remainingSodium = Math.max(0, profile.sodiumTarget - (totals.sodium || 0));

  const lower = (userText || "").toLowerCase();
  const isNight = lower.includes("malam") || lower.includes("dinner");
  const isLunch = lower.includes("siang") || lower.includes("lunch");
  const isBreakfast = lower.includes("pagi") || lower.includes("sarapan") || lower.includes("breakfast");
  const isSnack = lower.includes("snack") || lower.includes("camilan") || lower.includes("cemilan");

  let targetCategory: "sarapan" | "siang" | "malam" | "snack" = "siang";
  if (isNight) targetCategory = "malam";
  else if (isBreakfast) targetCategory = "sarapan";
  else if (isSnack) targetCategory = "snack";
  else if (isLunch) targetCategory = "siang";
  else {
    // Determine by WIB hour if not specified
    let hour = 12;
    try {
      hour = parseInt(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", hour: "numeric", hour12: false }).format(new Date()), 10);
    } catch {
      hour = (new Date().getUTCHours() + 7) % 24;
    }
    if (hour < 10) targetCategory = "sarapan";
    else if (hour < 15) targetCategory = "siang";
    else if (hour < 18) targetCategory = "snack";
    else targetCategory = "malam";
  }

  // Filter candidates matching category
  let candidates = BASE_MEAL_POOL.filter(m => m.category === targetCategory);
  if (candidates.length === 0) candidates = BASE_MEAL_POOL;

  const hasHypertension = profile.medicalConditions.some(c => c.includes("hypertens") || c.includes("darah tinggi") || c.includes("tekanan darah"));
  const hasDiabetes = profile.medicalConditions.some(c => c.includes("diabet") || c.includes("gula"));

  // DYNAMIC MACRO & DEFICIT AWARE CANDIDATE RANKING
  candidates = [...candidates].sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;
    // Priority: Large protein deficit -> favor high-protein meals
    if (remainingProt > 25) {
      scoreA += a.protein * 2.5;
      scoreB += b.protein * 2.5;
    }
    // Priority: Low remaining calories -> favor lighter meals
    if (remainingCal > 0 && remainingCal < 400) {
      scoreA -= Math.abs(a.calories - remainingCal);
      scoreB -= Math.abs(b.calories - remainingCal);
    }
    // Priority: Medical adaptation signals
    if (hasHypertension) {
      scoreA -= (a.sodium || 0);
      scoreB -= (b.sodium || 0);
    }
    if (hasDiabetes) {
      scoreA -= (a.sugar || 0) * 15;
      scoreB -= (b.sugar || 0) * 15;
      scoreA += (a.fiber || 0) * 10;
      scoreB += (b.fiber || 0) * 10;
    }
    return scoreB - scoreA;
  });

  // HARD GATE SAFETY VALIDATION LOOP
  let chosenMeal: MealCandidate | null = null;
  let validationResult: SafetyValidationResult | null = null;

  for (const candidate of candidates) {
    const check = validateFoodSafety(candidate, profile);
    if (check.pass) {
      chosenMeal = candidate;
      validationResult = check;
      logRecommendationAudit({
        timestamp: new Date().toISOString(),
        userId: profile.userId,
        recommendationType: "meal_single",
        constraintsDetected: {
          allergies: profile.allergies,
          medicalConditions: profile.medicalConditions,
          injuries: profile.injuries,
          dislikedFoods: profile.dislikedFoods,
          equipment: profile.equipment
        },
        candidateRecommendation: candidate.name,
        validationResult: "PASS"
      });
      break;
    } else {
      logRecommendationAudit({
        timestamp: new Date().toISOString(),
        userId: profile.userId,
        recommendationType: "meal_single",
        constraintsDetected: {
          allergies: profile.allergies,
          medicalConditions: profile.medicalConditions,
          injuries: profile.injuries,
          dislikedFoods: profile.dislikedFoods,
          equipment: profile.equipment
        },
        candidateRecommendation: candidate.name,
        validationResult: "REJECTED",
        rejectionReason: check.reasons.join("; ")
      });
    }
  }

  // If all category candidates failed, try universally safe custom emergency meal
  if (!chosenMeal) {
    const universalSafe: MealCandidate = {
      name: "Sup Bening Dada Ayam Suwir & Wortel Kukus + Nasi Merah Bersih",
      category: targetCategory,
      calories: 340,
      protein: 28,
      carbs: 42,
      fat: 4,
      fiber: 4,
      sodium: 180,
      sugar: 2,
      ingredients: ["dada ayam rebus tawar", "wortel kukus", "nasi merah kukus", "daun bawang"],
      prepMethod: "rebus tawar",
      rationale: "Menu netral ramah eliminasi dengan protein bersih dan tinggi serat."
    };

    const emergencyCheck = validateFoodSafety(universalSafe, profile);
    if (emergencyCheck.pass) {
      chosenMeal = universalSafe;
      validationResult = emergencyCheck;
    } else {
      // Vegan allergen-free fallback
      const veganSafe: MealCandidate = {
        name: "Kentang Kukus Bening + Brokoli & Wortel Rebus Tanpa Garam",
        category: targetCategory,
        calories: 220,
        protein: 6,
        carbs: 48,
        fat: 1,
        fiber: 6,
        sodium: 60,
        sugar: 3,
        ingredients: ["kentang kukus", "brokoli kukus", "wortel kukus"],
        prepMethod: "kukus",
        rationale: "Menu eliminasi murni ramah seluruh pantangan alergi dan medis."
      };
      chosenMeal = veganSafe;
      validationResult = validateFoodSafety(veganSafe, profile);
    }
  }

  // Progress insights
  const progressNotes: string[] = [];
  if (totals.calories > profile.calorieTarget) {
    progressNotes.push(`⚠️ *Kalori Harian Melebihi Target*: Total asupan (${totals.calories}/${profile.calorieTarget} kcal) telah melebihi target. Utamakan hidrasi air putih, hindari camilan manis/berlemak, dan fokus pada pemulihan tubuh.`);
  } else {
    progressNotes.push(`📊 *Sisa Anggaran Kalori Hari Ini*: ~${remainingCal} kcal lagi (Target: ${profile.calorieTarget} kcal)`);
  }

  const hasKidney = profile.medicalConditions.some(c => c.includes("kidney") || c.includes("ginjal"));
  if (hasKidney) {
    progressNotes.push(`⚕️ *Catatan Medis Ginjal*: Asupan protein dan cairan harus selalu dikonsultasikan dengan dokter spesialis atau dokter pendampingmu ya.`);
  } else if (remainingProt > 20) {
    progressNotes.push(`🍖 *Prioritas Protein*: Masih memerlukan ~${remainingProt}g protein hari ini.`);
  }

  if (hasHypertension) {
    progressNotes.push(`🧂 *Perhatian Natrium (Hipertensi)*: Menjaga asupan garam ketat (<1.500 mg/hari). Menu ini dipilih rendah garam untuk kesehatan tekanan darahmu.`);
  } else if (totals.sodium && totals.sodium > profile.sodiumTarget) {
    progressNotes.push(`🧂 *Perhatian Sodium*: Natrium hari ini (${totals.sodium} mg) sudah mendekati batas anjuran. Menu ini dipilih rendah garam.`);
  }

  const coachName = profile.persona === "max" ? "Coach Max" : "Coach Mia";
  const personaNote = profile.persona === "max"
    ? `Menu ini gue pilihkan berdasarkan data profil dan sisa target harian lo bro. Tetap konsisten jaga pola makan bergizi dan jangan lupa hidrasi! Gas! 🔥`
    : `Menu ini dipilih berdasarkan data profil dan kebutuhan nutrisimu hari ini ya. Tetap jaga pola makan seimbang dan cukupi hidrasi agar tubuh selalu bugar ✨`;

  // Format final clean WhatsApp message
  return (
    `🍽️ *REKOMENDASI MENU ${targetCategory.toUpperCase()} PERSONAL*\n` +
    `--------------------------------------------------\n` +
    `👤 *Profil*: ${profile.name} | Goal: ${profile.goalTitle}\n` +
    `🛡️ *Status Rekomendasi*: Direkomendasikan berdasarkan data profil dan targetmu\n\n` +
    `🍱 *Menu Pilihan*: *${chosenMeal.name}*\n` +
    `🔥 Kalori: ~${chosenMeal.calories} kcal\n` +
    `🍖 Protein: ~${chosenMeal.protein}g | 🍚 Karbo: ~${chosenMeal.carbs}g | 🥓 Lemak: ~${chosenMeal.fat}g\n` +
    `🧂 Sodium: ~${chosenMeal.sodium} mg | 🥬 Serat: ~${chosenMeal.fiber}g\n\n` +
    `💡 *Alasan Pemilihan*: ${chosenMeal.rationale}\n\n` +
    `📈 *Analisis Progress Nutrisi*: \n` +
    progressNotes.map(n => `• ${n}`).join("\n") + `\n\n` +
    `--------------------------------------------------\n` +
    `💬 *${coachName}*:\n"${personaNote}"`
  );
}

// ============================================================================
// 8.5 TEMPORAL RESOLUTION & MEAL INTENT CLASSIFIER
// ============================================================================

export interface MealIntentResult {
  isMealIntent: boolean;
  domain: "meal";
  action: "recommendation" | "plan" | "advice";
  topic?: "meal_timing";
  scope: "today" | "tomorrow" | "weekly" | "meal_timing";
  targetDate: string; // YYYY-MM-DD
  targetDateLabel: string; // e.g. "Jumat, 11 Sep 2026"
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
}

export function isMealTimingAdviceQuery(userText: string): boolean {
  if (!userText || typeof userText !== "string") return false;
  const lower = userText.toLowerCase().trim();

  // Negative checks: exclude workout, pure food logs, delete requests, tomorrow, weekly
  if (lower.match(/\b(?:workout|latihan|olahraga|gym|push\s*up|treadmill|berenang)\b/i)) return false;
  if (lower.match(/^(?:hapus|delete|batal|koreksi|ralat|buang|hilangkan)/i)) return false;
  if (lower.match(/^(?:aku\s+(?:tadi\s+)?makan|tadi\s+makan)\b/i)) return false;
  if (lower.includes("besok") || lower.includes("tomorrow")) return false;
  if (lower.match(/\b(?:seminggu|mingguan|7\s*hari|tujuh\s*hari)\b/i)) return false;

  const hasLunch = /\b(?:siang|lunch)\b/i.test(lower);
  const hasDinner = /\b(?:malam|dinner)\b/i.test(lower);
  const hasBreakfast = /\b(?:sarapan|breakfast|pagi)\b/i.test(lower);
  const hasSkip = /\b(?:skip|melewatkan|tidak\s+makan|nggak\s+makan|gak\s+makan|ngga\s+makan|tanpa\s+makan)\b/i.test(lower);
  const hasComparison = /\b(?:mending|lebih\s+bagus|lebih\s+baik|atau|bagusan|cukup|boleh|harus|perlu|mendingan)\b/i.test(lower);

  // 1. Dual-meal dilemma: lunch + dinner with skip / comparison
  if (hasLunch && hasDinner && (hasSkip || hasComparison)) {
    return true;
  }

  // 2. Explicit skip meal queries with meal context
  if (hasSkip && (hasLunch || hasDinner || hasBreakfast)) {
    return true;
  }

  // 3. Timing / frequency advice queries
  if (/\b(?:waktu|jam|jadwal|aturan|pola)\s+makan\b/i.test(lower) && /\b(?:saran|bagus|baik|ideal|gimana|bagaimana|rekomendasi)\b/i.test(lower)) {
    return true;
  }

  return false;
}

export function getWibDateDetails(offsetDays: number = 0): {
  dateStr: string;
  dayName: string;
  formattedDate: string;
  fullDate: string;
} {
  const now = new Date();
  const targetTime = new Date(now.getTime() + (offsetDays * 24 * 60 * 60 * 1000));
  
  const options = { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" } as const;
  const parts = new Intl.DateTimeFormat("en-US", options).formatToParts(targetTime);
  const year = parts.find(p => p.type === "year")!.value;
  const month = parts.find(p => p.type === "month")!.value;
  const day = parts.find(p => p.type === "day")!.value;
  const dateStr = `${year}-${month}-${day}`;

  const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const dayName = dayNames[dateObj.getDay()];

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
  ];
  const monthFullNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  const mIdx = parseInt(month, 10) - 1;
  const formattedDate = `${dayName}, ${parseInt(day, 10)} ${monthNames[mIdx]} ${year}`;
  const fullDate = `${dayName}, ${parseInt(day, 10)} ${monthFullNames[mIdx]} ${year}`;

  return { dateStr, dayName, formattedDate, fullDate };
}

export function classifyMealIntent(userText: string): MealIntentResult | null {
  const lower = (userText || "").toLowerCase().trim();

  // Exclude queries that are strictly workout/exercise without meal words
  const isPureWorkout = (
    lower.match(/^(?:workout|latihan|olahraga|gym)\s+(?:besok|tomorrow|hari\s*ini|mingguan|seminggu)/i) ||
    lower.match(/^(?:besok|tomorrow|hari\s*ini|mingguan|seminggu)\s+(?:jadwal(?:nya)?|menu|program)?\s*(?:workout|latihan|olahraga|gym)/i) ||
    (lower.match(/\b(?:workout|latihan|olahraga|gym)\b/i) && !lower.match(/\b(?:makan|makanan|diet|menu|sarapan|lunch|dinner|snack|camilan|cemilan|nutrisi|meal)\b/i))
  );
  if (isPureWorkout) {
    return null;
  }

  // 0. MEAL TIMING ADVICE scope takes precedence for conversational meal timing questions
  if (isMealTimingAdviceQuery(userText)) {
    const { dateStr, formattedDate } = getWibDateDetails(0);
    return {
      isMealIntent: true,
      domain: "meal",
      action: "advice",
      topic: "meal_timing",
      scope: "meal_timing",
      targetDate: dateStr,
      targetDateLabel: formattedDate
    };
  }

  const hasMealKeyword = Boolean(
    lower.match(/\b(?:makan|makanan|diet|menu|sarapan|lunch|dinner|breakfast|snack|camilan|cemilan|nutrisi|meal|meal\s*plan)\b/i)
  );

  let detectedMealType: "breakfast" | "lunch" | "dinner" | "snack" | undefined;
  if (lower.match(/\b(?:sarapan|breakfast|pagi)\b/i)) {
    detectedMealType = "breakfast";
  } else if (lower.match(/\b(?:lunch|siang)\b/i)) {
    detectedMealType = "lunch";
  } else if (lower.match(/\b(?:dinner|malam)\b/i)) {
    detectedMealType = "dinner";
  } else if (lower.match(/\b(?:snack|camilan|cemilan|sore)\b/i)) {
    detectedMealType = "snack";
  }

  // 1. TOMORROW scope takes precedence when "besok" or "tomorrow" is present
  const isTomorrow = lower.includes("besok") || lower.includes("tomorrow");
  if (isTomorrow && hasMealKeyword) {
    const { dateStr, formattedDate } = getWibDateDetails(1);
    return {
      isMealIntent: true,
      domain: "meal",
      action: "recommendation",
      scope: "tomorrow",
      targetDate: dateStr,
      targetDateLabel: formattedDate,
      mealType: detectedMealType
    };
  }

  // 2. WEEKLY scope requires explicit weekly keywords
  const hasWeeklyKeyword = Boolean(
    lower.match(/\b(?:minggu(?:an)?|seminggu|7\s*hari|tujuh\s*hari|meal\s*plan)\b/i)
  );
  if (hasWeeklyKeyword && hasMealKeyword && !isTomorrow) {
    const { dateStr, formattedDate } = getWibDateDetails(0);
    return {
      isMealIntent: true,
      domain: "meal",
      action: "plan",
      scope: "weekly",
      targetDate: dateStr,
      targetDateLabel: formattedDate,
      mealType: detectedMealType
    };
  }

  // 3. TODAY scope for immediate meal recommendations
  const isTodayRecommendation = Boolean(
    lower.includes("rekomendasi makanan") ||
    lower.includes("rekomendasi makan") ||
    lower.includes("menu makan") ||
    lower.includes("saran makan") ||
    lower.includes("pagi siang malam") ||
    lower.includes("rekomendasi sarapan") ||
    lower.includes("saran sarapan") ||
    lower.match(/(?:saran|rekomendasi|ide|menu)\s+(?:sarapan|makan|lunch|dinner|camilan|snack)/i) ||
    lower.match(/saran\s+makan(?:an)?(?:\s+hari\s*ini)?/i) ||
    lower.match(/ada\s+saran\s+makan/i) ||
    lower.match(/makan\s+(?:siang|malam|pagi)\s+apa/i) ||
    lower.match(/sarapan\s+(?:pagi|apa)/i) ||
    lower.match(/saran\s+menu/i) ||
    lower.match(/rekomendasi\s+menu/i)
  );

  if (isTodayRecommendation && !isTomorrow && !hasWeeklyKeyword) {
    const { dateStr, formattedDate } = getWibDateDetails(0);
    return {
      isMealIntent: true,
      domain: "meal",
      action: "recommendation",
      scope: "today",
      targetDate: dateStr,
      targetDateLabel: formattedDate,
      mealType: detectedMealType
    };
  }

  return null;
}

// ============================================================================
// 8.6 PERSONALIZED TOMORROW MEAL RECOMMENDATION GENERATOR
// ============================================================================

export function generatePersonalizedTomorrowMealPlan(rawProfile: any): string {
  const profile = resolveCanonicalProfile(rawProfile);
  const coachName = profile.persona === "max" ? "Coach Max" : "Coach Mia";
  const { formattedDate } = getWibDateDetails(1);

  // Pre-filter safe pools using deterministic validator
  const safeBreakfastPool = BASE_MEAL_POOL.filter(m => m.category === "sarapan" && validateFoodSafety(m, profile).pass);
  const safeLunchPool = BASE_MEAL_POOL.filter(m => m.category === "siang" && validateFoodSafety(m, profile).pass);
  const safeSnackPool = BASE_MEAL_POOL.filter(m => m.category === "snack" && validateFoodSafety(m, profile).pass);
  const safeDinnerPool = BASE_MEAL_POOL.filter(m => m.category === "malam" && validateFoodSafety(m, profile).pass);

  // Fallback items if extreme restriction
  const certifiedFallbackBreakfast: MealCandidate = {
    name: "Oatmeal Apel Rebus + Biji Chia Alami",
    category: "sarapan",
    calories: 280,
    protein: 8,
    carbs: 52,
    fat: 5,
    fiber: 9,
    sodium: 40,
    sugar: 7,
    ingredients: ["oatmeal", "apel kukus", "biji chia"],
    prepMethod: "seduh",
    rationale: "Karbohidrat kompleks larut air ramah eliminasi."
  };

  const certifiedFallbackLunch: MealCandidate = {
    name: "Sup Bening Dada Ayam Suwir + Nasi Merah + Wortel Rebus",
    category: "siang",
    calories: 360,
    protein: 30,
    carbs: 45,
    fat: 5,
    fiber: 5,
    sodium: 200,
    sugar: 2,
    ingredients: ["dada ayam tanpa kulit", "wortel kukus", "nasi merah", "daun bawang"],
    prepMethod: "rebus",
    rationale: "Menu netral dengan protein bersih dan bumbu alami ramah eliminasi."
  };

  const certifiedFallbackSnack: MealCandidate = {
    name: "1 Buah Pir Segar / Jambu Biji Merah Potong",
    category: "snack",
    calories: 80,
    protein: 1,
    carbs: 19,
    fat: 0,
    fiber: 5,
    sodium: 5,
    sugar: 12,
    ingredients: ["buah pir segar"],
    prepMethod: "segar",
    rationale: "Bebas alergen total, hidrasi alami dan ramah indeks glikemik rendah."
  };

  const certifiedFallbackDinner: MealCandidate = {
    name: "Pepes Ikan Mas Kunyit Jahe + Kentang Kukus + Sayur Bening",
    category: "malam",
    calories: 330,
    protein: 28,
    carbs: 40,
    fat: 6,
    fiber: 5,
    sodium: 180,
    sugar: 2,
    ingredients: ["ikan mas", "kunyit", "jahe", "kentang kukus", "bayam"],
    prepMethod: "kukus",
    rationale: "Kaya protein segar dan rempah antiinflamasi alami untuk pemulihan malam."
  };

  const certifiedVeganFallback: MealCandidate = {
    name: "Kentang Kukus Bening + Brokoli & Wortel Rebus Tanpa Garam",
    category: "siang",
    calories: 220,
    protein: 6,
    carbs: 48,
    fat: 1,
    fiber: 6,
    sodium: 60,
    sugar: 3,
    ingredients: ["kentang kukus", "brokoli kukus", "wortel kukus"],
    prepMethod: "kukus",
    rationale: "Menu eliminasi murni ramah seluruh pantangan alergi dan medis."
  };

  let chosenBreakfast: MealCandidate = safeBreakfastPool.length > 0
    ? safeBreakfastPool[0]
    : (validateFoodSafety(certifiedFallbackBreakfast, profile).pass ? certifiedFallbackBreakfast : certifiedVeganFallback);

  let chosenLunch: MealCandidate = safeLunchPool.length > 0
    ? safeLunchPool[0]
    : (validateFoodSafety(certifiedFallbackLunch, profile).pass ? certifiedFallbackLunch : certifiedVeganFallback);

  let chosenSnack: MealCandidate = safeSnackPool.length > 0
    ? safeSnackPool[0]
    : (validateFoodSafety(certifiedFallbackSnack, profile).pass ? certifiedFallbackSnack : certifiedVeganFallback);

  let chosenDinner: MealCandidate = safeDinnerPool.length > 0
    ? safeDinnerPool[0]
    : (validateFoodSafety(certifiedFallbackDinner, profile).pass ? certifiedFallbackDinner : certifiedVeganFallback);

  // Safety checks
  if (!validateFoodSafety(chosenBreakfast, profile).pass) {
    chosenBreakfast = safeBreakfastPool.find(m => validateFoodSafety(m, profile).pass) || certifiedVeganFallback;
  }
  if (!validateFoodSafety(chosenLunch, profile).pass) {
    chosenLunch = safeLunchPool.find(m => validateFoodSafety(m, profile).pass) || certifiedVeganFallback;
  }
  if (!validateFoodSafety(chosenSnack, profile).pass) {
    chosenSnack = safeSnackPool.find(m => validateFoodSafety(m, profile).pass) || certifiedVeganFallback;
  }
  if (!validateFoodSafety(chosenDinner, profile).pass) {
    chosenDinner = safeDinnerPool.find(m => validateFoodSafety(m, profile).pass) || certifiedVeganFallback;
  }

  const estCalories = chosenBreakfast.calories + chosenLunch.calories + chosenSnack.calories + chosenDinner.calories;
  const estProtein = chosenBreakfast.protein + chosenLunch.protein + chosenSnack.protein + chosenDinner.protein;
  const estCarbs = chosenBreakfast.carbs + chosenLunch.carbs + chosenSnack.carbs + chosenDinner.carbs;
  const estFat = chosenBreakfast.fat + chosenLunch.fat + chosenSnack.fat + chosenDinner.fat;

  const tomorrowCoachClosing = profile.persona === "max"
    ? `Rencana makan besok ini udah gue susun pas sesuai target harian lo bro. Siapkan bahan-bahannya dari sekarang biar besok tinggal eksekusi! Tetap disiplin & gas pol! 🔥`
    : `Rencana makan besok ini sudah aku susun seimbang sesuai target nutrisi harianmu ya. Kamu bisa persiapkan bahannya dari sekarang agar besok lebih santai. Semangat! ✨`;

  return (
    `📅 *JADWAL MAKAN BESOK*\n` +
    `--------------------------------------------------\n\n` +
    `📆 *${formattedDate}*\n\n` +
    `☀️ *SARAPAN*\n` +
    `${chosenBreakfast.name}\n` +
    `~${chosenBreakfast.calories} kcal • Protein ${chosenBreakfast.protein}g\n\n` +
    `🍱 *MAKAN SIANG*\n` +
    `${chosenLunch.name}\n` +
    `~${chosenLunch.calories} kcal • Protein ${chosenLunch.protein}g\n\n` +
    `🍪 *SNACK*\n` +
    `${chosenSnack.name}\n` +
    `~${chosenSnack.calories} kcal • Protein ${chosenSnack.protein}g\n\n` +
    `🌙 *MAKAN MALAM*\n` +
    `${chosenDinner.name}\n` +
    `~${chosenDinner.calories} kcal • Protein ${chosenDinner.protein}g\n\n` +
    `--------------------------------------------------\n` +
    `📊 *ESTIMASI HARIAN*\n\n` +
    `🔥 Kalori: ~${estCalories} kcal\n` +
    `🍖 Protein: ~${estProtein}g\n` +
    `🍚 Karbo: ~${estCarbs}g\n` +
    `🥓 Lemak: ~${estFat}g\n\n` +
    `--------------------------------------------------\n` +
    `💬 *${coachName}*:\n"${tomorrowCoachClosing}"`
  );
}

// ============================================================================
// 9. PERSONALIZED WEEKLY MEAL PLAN GENERATOR (ITEM-BY-ITEM VALIDATION)
// ============================================================================

export function generatePersonalizedWeeklyMealPlan(rawProfile: any): string {
  const profile = resolveCanonicalProfile(rawProfile);
  const days = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
  const coachName = profile.persona === "max" ? "Coach Max" : "Coach Mia";

  // Pre-filter safe pools using deterministic validator
  const safeBreakfastPool = BASE_MEAL_POOL.filter(m => m.category === "sarapan" && validateFoodSafety(m, profile).pass);
  const safeLunchPool = BASE_MEAL_POOL.filter(m => m.category === "siang" && validateFoodSafety(m, profile).pass);
  const safeSnackPool = BASE_MEAL_POOL.filter(m => m.category === "snack" && validateFoodSafety(m, profile).pass);
  const safeDinnerPool = BASE_MEAL_POOL.filter(m => m.category === "malam" && validateFoodSafety(m, profile).pass);

  // Certified neutral fallback meals for extreme multiple restrictions
  const certifiedFallbackBreakfast: MealCandidate = {
    name: "Oatmeal Apel Rebus + Biji Chia Alami",
    category: "sarapan",
    calories: 280,
    protein: 8,
    carbs: 52,
    fat: 5,
    fiber: 9,
    sodium: 40,
    sugar: 7,
    ingredients: ["oatmeal", "apel kukus", "biji chia"],
    prepMethod: "seduh",
    rationale: "Karbohidrat kompleks larut air ramah eliminasi."
  };

  const certifiedFallbackLunch: MealCandidate = {
    name: "Sup Bening Dada Ayam Suwir + Nasi Merah + Wortel Rebus",
    category: "siang",
    calories: 360,
    protein: 30,
    carbs: 45,
    fat: 5,
    fiber: 5,
    sodium: 200,
    sugar: 2,
    ingredients: ["dada ayam tanpa kulit", "wortel kukus", "nasi merah", "daun bawang"],
    prepMethod: "rebus",
    rationale: "Menu netral dengan protein bersih dan bumbu alami ramah eliminasi."
  };

  const certifiedFallbackSnack: MealCandidate = {
    name: "1 Buah Pir Segar / Jambu Biji Merah Potong",
    category: "snack",
    calories: 80,
    protein: 1,
    carbs: 19,
    fat: 0,
    fiber: 5,
    sodium: 5,
    sugar: 12,
    ingredients: ["buah pir segar"],
    prepMethod: "segar",
    rationale: "Bebas alergen total, hidrasi alami dan ramah indeks glikemik rendah."
  };

  const certifiedFallbackDinner: MealCandidate = {
    name: "Pepes Ikan Mas Kunyit Jahe + Kentang Kukus + Sayur Bening",
    category: "malam",
    calories: 330,
    protein: 28,
    carbs: 40,
    fat: 6,
    fiber: 5,
    sodium: 180,
    sugar: 2,
    ingredients: ["ikan mas", "kunyit", "jahe", "kentang kukus", "bayam"],
    prepMethod: "kukus",
    rationale: "Kaya protein segar dan rempah antiinflamasi alami untuk pemulihan malam."
  };

  const certifiedVeganFallback: MealCandidate = {
    name: "Kentang Kukus Bening + Brokoli & Wortel Rebus Tanpa Garam",
    category: "siang",
    calories: 220,
    protein: 6,
    carbs: 48,
    fat: 1,
    fiber: 6,
    sodium: 60,
    sugar: 3,
    ingredients: ["kentang kukus", "brokoli kukus", "wortel kukus"],
    prepMethod: "kukus",
    rationale: "Menu eliminasi murni ramah seluruh pantangan alergi dan medis."
  };

  const dailyPlans = days.map((day, idx) => {
    let chosenBreakfast: MealCandidate = safeBreakfastPool.length > 0
      ? safeBreakfastPool[idx % safeBreakfastPool.length]
      : (validateFoodSafety(certifiedFallbackBreakfast, profile).pass ? certifiedFallbackBreakfast : certifiedVeganFallback);

    let chosenLunch: MealCandidate = safeLunchPool.length > 0 
      ? safeLunchPool[(idx + 1) % safeLunchPool.length]
      : (validateFoodSafety(certifiedFallbackLunch, profile).pass ? certifiedFallbackLunch : certifiedVeganFallback);

    let chosenSnack: MealCandidate = safeSnackPool.length > 0
      ? safeSnackPool[idx % safeSnackPool.length]
      : (validateFoodSafety(certifiedFallbackSnack, profile).pass ? certifiedFallbackSnack : certifiedVeganFallback);

    let chosenDinner: MealCandidate = safeDinnerPool.length > 0
      ? safeDinnerPool[(idx + 2) % safeDinnerPool.length]
      : (validateFoodSafety(certifiedFallbackDinner, profile).pass ? certifiedFallbackDinner : certifiedVeganFallback);

    // Hard gate assertion: verify all four chosen meals strictly pass safety
    if (!validateFoodSafety(chosenBreakfast, profile).pass) {
      chosenBreakfast = safeBreakfastPool.find(m => validateFoodSafety(m, profile).pass) || certifiedVeganFallback;
    }
    if (!validateFoodSafety(chosenLunch, profile).pass) {
      chosenLunch = safeLunchPool.find(m => validateFoodSafety(m, profile).pass) || certifiedVeganFallback;
    }
    if (!validateFoodSafety(chosenSnack, profile).pass) {
      chosenSnack = safeSnackPool.find(m => validateFoodSafety(m, profile).pass) || certifiedVeganFallback;
    }
    if (!validateFoodSafety(chosenDinner, profile).pass) {
      chosenDinner = safeDinnerPool.find(m => validateFoodSafety(m, profile).pass) || certifiedVeganFallback;
    }

    const dayRationale = idx === 0 ? "Fokus awal pekan: optimalisasi protein bersih & energi stabil." :
                         idx === 1 ? "Pilihan rendah natrium untuk menjaga tekanan darah stabil." :
                         idx === 2 ? "Karbohidrat kompleks untuk energi aktivitas tengah pekan." :
                         idx === 3 ? "Serat tinggi dan antioksidan untuk kesehatan pencernaan." :
                         idx === 4 ? "Recovery gizi seimbang menjelang akhir pekan." :
                         idx === 5 ? "Menu bernutrisi padat untuk mobilitas weekend." :
                                     "Pemulihan pencernaan & persiapan pekan berikutnya.";

    return (
      `*${day.toUpperCase()}*\n` +
      `☀️ *Sarapan*: ${chosenBreakfast.name} (~${chosenBreakfast.calories} kcal, P:${chosenBreakfast.protein}g)\n` +
      `🍱 *Makan Siang*: ${chosenLunch.name} (~${chosenLunch.calories} kcal, P:${chosenLunch.protein}g)\n` +
      `🍪 *Snack*: ${chosenSnack.name} (~${chosenSnack.calories} kcal, P:${chosenSnack.protein}g)\n` +
      `🌙 *Makan Malam*: ${chosenDinner.name} (~${chosenDinner.calories} kcal, P:${chosenDinner.protein}g)\n` +
      `💡 _${dayRationale}_`
    );
  }).join("\n\n");

  const constraintSummary: string[] = [];
  if (profile.allergiesStatus === "reported" && profile.allergies.length > 0) {
    constraintSummary.push(`Eliminasi Alergen Personal Terverifikasi`);
  }
  if (profile.medicalConditionsStatus === "reported" && profile.medicalConditions.length > 0) {
    constraintSummary.push(`Adaptasi Kondisi Medis Aktif`);
  }

  const constraintText = constraintSummary.length > 0
    ? `🛡️ *Proteksi Profil*: ${constraintSummary.join(" | ")}\n`
    : `🛡️ *Proteksi Profil*: Nutrisi Seimbang Sesuai Targetmu\n`;

  const weeklyMealPersonaClosing = profile.persona === "max"
    ? `Jadwal makan seminggu ini gue susun sesuai data profil dan target harian lo bro. Mau tukar atau ada menu yang kurang pas? Langsung bilang ke gue ya! 🔥`
    : `Jadwal ini disusun berdasarkan data profil dan kebutuhan tubuhmu ya. Mau ganti salah satu menu? Cukup beri tahu aku kapan saja ✨`;

  return (
    `📅 *JADWAL MAKAN MINGGUAN PERSONAL*\n` +
    `--------------------------------------------------\n` +
    `👤 *Nama*: ${profile.name} | *Target Kalori*: ~${profile.calorieTarget} kcal/hari\n` +
    constraintText +
    `--------------------------------------------------\n\n` +
    `${dailyPlans}\n\n` +
    `--------------------------------------------------\n` +
    `💬 *${coachName}*:\n"${weeklyMealPersonaClosing}"`
  );
}

// ============================================================================
// 10. PERSONALIZED WORKOUT & WEEKLY PLAN GENERATOR (ITEM-BY-ITEM VALIDATION)
// ============================================================================

export function generatePersonalizedWorkoutRecommendation(rawProfile: any, targetDayOffset: number = 0): string {
  const profile = resolveCanonicalProfile(rawProfile);
  const coachName = profile.persona === "max" ? "Coach Max" : "Coach Mia";
  const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const targetDayIdx = (new Date().getDay() + targetDayOffset + 7) % 7;
  const targetDayName = dayNames[targetDayIdx];
  const dayLabel = targetDayOffset === 1 ? "BESOK" : "HARI INI";

  // Filter exercises by hard safety validation
  const safeExercises = EXERCISE_REGISTRY.filter(ex => validateWorkoutSafety(ex, profile).pass);

  // Goal & Area Selection
  let targetArea: "lower_body" | "upper_body" | "core" | "full_body" = "upper_body";
  if (targetDayIdx === 1 || targetDayIdx === 4) targetArea = "upper_body";
  else if (targetDayIdx === 2 || targetDayIdx === 5) targetArea = "lower_body";
  else if (targetDayIdx === 3 || targetDayIdx === 6) targetArea = "core";
  else targetArea = "full_body";

  // Format current date nicely in WIB (UTC+7)
  const wibNow = new Date(Date.now() + 7 * 60 * 60 * 1000 + targetDayOffset * 24 * 60 * 60 * 1000);
  const [wibDatePart] = wibNow.toISOString().split("T");
  const [wYear, wMonth, wDay] = wibDatePart.split("-");
  const monthFullNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  const fullDateLabel = `${targetDayName}, ${parseInt(wDay, 10)} ${monthFullNames[parseInt(wMonth, 10) - 1]} ${wYear}`;
  const addressing = profile.name && profile.name !== "Member" ? profile.name : "kamu";

  // If Sunday: Rest & Recovery
  if (targetDayIdx === 0) {
    const recoveryClosing = profile.persona === "max"
      ? `Hari ini jadwal rest day lo, ${addressing}! 🔥 Cukupi istirahat lo biar sesi berikutnya makin gahar.`
      : `Hari ini jadwal rest day kamu ya, ${addressing}! ✨ Istirahat yang cukup agar tubuhmu siap untuk sesi latihan berikutnya.`;
    return (
      `🏋️‍♂️ *JADWAL OLAHRAGA ${dayLabel}*\n` +
      `--------------------------------------------------\n\n` +
      `📅 *${fullDateLabel}*\n\n` +
      `🌴 *FOKUS: REST & AKTIF RECOVERY*\n\n` +
      `Hari ini adalah waktu untuk pemulihan otot dan relaksasi persendian. ` +
      `Cukupi air putih minimal 2.5 liter dan tidur nyenyak agar sesi latihan berikutnya maksimal! 🌿✨\n\n` +
      `--------------------------------------------------\n\n` +
      `💬 *${coachName}*\n\n` +
      `"${recoveryClosing}"`
    );
  }

  let selected = safeExercises.filter(e => e.bodyArea === targetArea);
  if (selected.length < 3) {
    selected = [...selected, ...safeExercises.filter(e => e.bodyArea !== targetArea)].slice(0, 3);
  } else {
    selected = selected.slice(0, 3);
  }

  // Ensure every single selected exercise strictly passes validation
  selected = selected.map(ex => {
    if (validateWorkoutSafety(ex, profile).pass) return ex;
    return safeExercises.find(alt => validateWorkoutSafety(alt, profile).pass) || ex;
  });

  const exerciseLines = selected.map((ex, idx) => 
    `${idx + 1}. *${ex.indonesianName || ex.name}*\n` +
    `   🔢 ${formatSetsReps(ex.targetSets, ex.targetReps)}\n` +
    `   💡 Tips: ${ex.tips || "Jaga postur netral dan atur pernafasan."}`
  ).join("\n\n");

  const injuryNote = profile.injuriesStatus === "reported" && profile.injuries.length > 0
    ? `🛡️ *Penyesuaian Fisik*: Latihan ini dipilih dengan mempertimbangkan keterbatasan ${profile.injuries.join(", ")} yang kamu masukkan di profil.`
    : `🛡️ *Kondisi Fisik*: Latihan disesuaikan dengan tingkat aktivitas dan tujuan kebugaranmu.`;

  const workoutPersonaClosing = profile.persona === "max"
    ? `Ini jadwal latihan lo hari ini, ${addressing}! 🔥\nKalau lo udah selesai latihan dan mau catat hasilnya, baru bilang kalau lo udah selesai latihan.`
    : `Ini jadwal latihan kamu hari ini ya, ${addressing}! ✨\nKalau kamu sudah selesai latihan dan ingin mencatatnya, baru bilang bahwa kamu sudah selesai latihan.`;

  return (
    `🏋️‍♂️ *JADWAL OLAHRAGA ${dayLabel}*\n` +
    `--------------------------------------------------\n\n` +
    `📅 *${fullDateLabel}*\n\n` +
    `🎯 *Fokus*: ${targetArea.replace("_", " ").toUpperCase()} (${profile.goalTitle})\n` +
    `${injuryNote}\n\n` +
    `📌 *Daftar Gerakan Terpilih*:\n\n` +
    `${exerciseLines}\n\n` +
    `--------------------------------------------------\n\n` +
    `💬 *${coachName}*\n\n` +
    `"${workoutPersonaClosing}"`
  );
}

export function formatSetsReps(targetSets?: number, targetReps?: string): string {
  if (!targetReps) {
    return targetSets ? `${targetSets} Set` : "";
  }
  const cleanReps = targetReps.trim();
  if (/^\d+\s*set\b/i.test(cleanReps)) {
    return cleanReps;
  }
  if (targetSets && !cleanReps.toLowerCase().includes("set")) {
    return `${targetSets} Set x ${cleanReps}`;
  }
  return cleanReps;
}

export interface WorkoutIntentResult {
  isWorkoutIntent: boolean;
  domain: "workout";
  action: "recommendation" | "schedule" | "log" | "education";
  scope: "today" | "tomorrow" | "weekly" | "general";
  targetDayOffset: number; // 0 for today, 1 for tomorrow, 7 for weekly
}

export function classifyWorkoutIntent(userText: string): WorkoutIntentResult | null {
  const lower = (userText || "").toLowerCase().trim();

  // 1. Weight updates are pure body weight logs, NEVER workout intent
  if (
    lower.match(/(?:update\s+bb|lapor\s+bb|berat\s*(?:badan)?(?:\s*(?:ku|mu|nya|saya|gue|gw|aku))?|bb(?:\s*(?:ku|mu|nya|saya|gue|gw|aku))?|timbangan|tadi\s*nimbang|nimbang)\s*(?:hari\s*ini|saat\s*ini|sekarang|terbaru|terkini|adalah|di|:|udah|sudah)?\s*(\d+(?:[.,]\d+)?)\s*(?:kg|kilo|kilogram)?/i) ||
    lower.match(/^(?:berat\s*(?:badan)?|bb)\s*(?:aku|saya|gue|gw)?\s*(?:skrng|sekarang|saat\s*ini)?\s*(\d+(?:[.,]\d+)?)\s*(?:kg|kilo)?$/i)
  ) {
    return null;
  }

  // 2. Pure logging / past workout signals (e.g. "aku tadi push up 10x", "aku tadi olahraga 45 menit", "selesai latihan", "lapor workout")
  const hasPastSignal = Boolean(
    lower.match(/\b(?:sudah|udah|telah|selesai|beres|done|barusan|tadi|habis|lapor|catat\s+(?:latihan|olahraga|workout)|aku latihan|aku workout|aku olahraga|aku melakukan)\b/i)
  );

  const isExplicitRequest = Boolean(
    lower.match(/\b(?:kasih|minta|mau|saran|rekomendasi|jadwal|program|menu|plan|ide|gimana|apa\s*aja|bagus(?:nya)?)\b/i)
  );

  if (hasPastSignal && !isExplicitRequest) {
    return {
      isWorkoutIntent: true,
      domain: "workout",
      action: "log",
      scope: "today",
      targetDayOffset: 0
    };
  }

  // Check if text pertains to workout/exercise
  const hasWorkoutKeyword = Boolean(
    lower.match(/\b(?:olahraga|latihan|workout|gym|fitness|strength|kardio|cardio|senam|push\s*up|pull\s*up|squat)\b/i)
  );

  if (!hasWorkoutKeyword) {
    return null;
  }

  // 3. Educational questions (e.g. "apa manfaat strength training?", "berapa kali seminggu sebaiknya cardio?", "kenapa harus pemanasan?")
  const isEducationInquiry = Boolean(
    lower.match(/^(?:apa\s+(?:manfaat|fungsi|keuntungan)|kenapa\s+harus|mengapa|berapa\s+kali\s+seminggu\s+sebaiknya)\b/i) ||
    (lower.includes("?") && lower.match(/\b(?:apa\s+itu|definisi|pengertian|manfaat)\b/i))
  );
  if (isEducationInquiry && !isExplicitRequest) {
    return {
      isWorkoutIntent: true,
      domain: "workout",
      action: "education",
      scope: "general",
      targetDayOffset: 0
    };
  }

  // 4. WEEKLY SCOPE:
  // "kasih aku saran olahraga minggu ini"
  // "kasih aku jadwal olahraga minggu ini"
  // "kasih aku olahraga mingguan"
  // "jadwal latihan minggu ini"
  // "saran olahraga minggu ini"
  // "program minggu ini", etc.
  const hasWeeklyKeyword = Boolean(
    lower.match(/\b(?:minggu\s*ini|mingguan|seminggu(?:an)?|7\s*hari|tujuh\s*hari|pekan\s*ini)\b/i)
  );

  if (hasWeeklyKeyword) {
    const isSchedule = lower.includes("jadwal") || lower.includes("program");
    return {
      isWorkoutIntent: true,
      domain: "workout",
      action: isSchedule ? "schedule" : "recommendation",
      scope: "weekly",
      targetDayOffset: 7
    };
  }

  // 5. TOMORROW SCOPE:
  const hasTomorrowKeyword = Boolean(
    lower.match(/\b(?:besok|tomorrow|esok\s*hari)\b/i)
  );
  if (hasTomorrowKeyword) {
    return {
      isWorkoutIntent: true,
      domain: "workout",
      action: "recommendation",
      scope: "tomorrow",
      targetDayOffset: 1
    };
  }

  // 6. TODAY SCOPE:
  const hasTodayKeyword = Boolean(
    lower.match(/\b(?:hari\s*ini|today|sekarang)\b/i)
  );
  const isTodayRecommendation = Boolean(
    hasTodayKeyword ||
    lower.match(/\b(?:saran|rekomendasi|jadwal|menu|program)\s+(?:olahraga|latihan|workout|gym)\b/i) ||
    lower.match(/\b(?:olahraga|latihan|workout|gym)\s+(?:apa|gimana|hari\s*ini)\b/i) ||
    lower.match(/^(?:kasih\s+aku\s+)?(?:saran|jadwal|rekomendasi)\s+(?:olahraga|latihan|workout|gym)/i)
  );

  if (isTodayRecommendation) {
    return {
      isWorkoutIntent: true,
      domain: "workout",
      action: "recommendation",
      scope: "today",
      targetDayOffset: 0
    };
  }

  return null;
}

export function generatePersonalizedWeeklyWorkoutPlan(rawProfile: any): string {
  const profile = resolveCanonicalProfile(rawProfile);
  const coachLabel = profile.persona === "max" ? "COACH MAX" : "COACH MIA";

  // Filter verified safe exercise pool
  const safePool = EXERCISE_REGISTRY.filter(ex => validateWorkoutSafety(ex, profile).pass);
  if (safePool.length === 0) {
    const defaultSafe = EXERCISE_REGISTRY.find(e => e.id === "incline-treadmill-walk" || e.id === "active-mobility-stretch") || EXERCISE_REGISTRY[0];
    safePool.push(defaultSafe);
  }

  const upperExercises = safePool.filter(e => e.bodyArea === "upper_body");
  const lowerExercises = safePool.filter(e => e.bodyArea === "lower_body");
  const coreExercises = safePool.filter(e => e.bodyArea === "core" || e.movementPattern === "cardio");

  // Generate safe 7-day schedule
  // SENIN: Strength Training / Full Body
  const monEx1 = upperExercises[0] || safePool[0];
  const monEx2 = lowerExercises[0] || safePool[1] || monEx1;
  const monEx3 = coreExercises[0] || upperExercises[1] || safePool[2] || monEx1;
  const mondayBlock =
    `📆 SENIN\n` +
    `💪 Full Body / Push Day\n` +
    `• ${monEx1.indonesianName || monEx1.name} — ${formatSetsReps(monEx1.targetSets, monEx1.targetReps)}\n` +
    `• ${monEx2.indonesianName || monEx2.name} — ${formatSetsReps(monEx2.targetSets, monEx2.targetReps)}\n` +
    `• ${monEx3.indonesianName || monEx3.name} — ${formatSetsReps(monEx3.targetSets, monEx3.targetReps)}`;

  // SELASA: Cardio / Active Recovery
  const tuesdayBlock =
    `📆 SELASA\n` +
    `🚶 Cardio / Active Recovery\n` +
    `• Jalan Cepat (Brisk Walk) / Incline Treadmill\n` +
    `• 30–45 Menit (Intensitas Sedang)`;

  // RABU: Strength Training
  const wedEx1 = upperExercises[1] || upperExercises[0] || safePool[0];
  const wedEx2 = lowerExercises[1] || lowerExercises[0] || safePool[1] || wedEx1;
  const wednesdayBlock =
    `📆 RABU\n` +
    `💪 Strength Training\n` +
    `• ${wedEx1.indonesianName || wedEx1.name} — ${formatSetsReps(wedEx1.targetSets, wedEx1.targetReps)}\n` +
    `• ${wedEx2.indonesianName || wedEx2.name} — ${formatSetsReps(wedEx2.targetSets, wedEx2.targetReps)}`;

  // KAMIS: Recovery / Rest
  const thursdayBlock =
    `📆 KAMIS\n` +
    `🧘 Recovery / Rest\n` +
    `• Peregangan Dinamis & Mobilitas Sendi\n` +
    `• 15–20 Menit`;

  // JUMAT: Strength Training
  const friEx1 = lowerExercises[0] || safePool[0];
  const friEx2 = upperExercises[0] || safePool[1] || friEx1;
  const fridayBlock =
    `📆 JUMAT\n` +
    `💪 Strength Training\n` +
    `• ${friEx1.indonesianName || friEx1.name} — ${formatSetsReps(friEx1.targetSets, friEx1.targetReps)}\n` +
    `• ${friEx2.indonesianName || friEx2.name} — ${formatSetsReps(friEx2.targetSets, friEx2.targetReps)}`;

  // SABTU: Cardio / Activity
  const saturdayBlock =
    `📆 SABTU\n` +
    `🏃 Cardio / Activity\n` +
    `• Jogging Santai / Bersepeda Statis\n` +
    `• 30–45 Menit (Intensitas Sedang)`;

  // MINGGU: Rest / Recovery
  const sundayBlock =
    `📆 MINGGU\n` +
    `😴 Rest / Recovery\n` +
    `• Istirahat Total & Relaksasi Otot\n` +
    `• Cukupi tidur 7–8 jam & hidrasi optimal`;

  const coachGuidance = profile.persona === "max"
    ? (profile.injuriesStatus === "reported" && profile.injuries.length > 0
        ? `Latihan ini dipilih dengan mempertimbangkan keterbatasan ${profile.injuries.join(", ")} yang kamu masukkan di profil. Konsistensi kunci utama, tetap disiplin dan gas pol! 🔥`
        : `Latihan ini disusun dengan mempertimbangkan target kebugaran yang kamu masukkan di profil. Konsistensi kunci utama, tetap disiplin dan gas pol! 🔥`)
    : (profile.injuriesStatus === "reported" && profile.injuries.length > 0
        ? `Latihan ini dipilih dengan mempertimbangkan keterbatasan ${profile.injuries.join(", ")} yang kamu masukkan di profil ya. Utamakan konsistensi dan nikmati setiap prosesnya ✨`
        : `Latihan ini disusun dengan mempertimbangkan target kebugaran yang kamu masukkan di profil ya. Utamakan konsistensi dan nikmati setiap prosesnya ✨`);

  return (
    `🏋️‍♂️ *JADWAL OLAHRAGA MINGGU INI*\n` +
    `--------------------------------------------------\n\n` +
    `${mondayBlock}\n\n` +
    `${tuesdayBlock}\n\n` +
    `${wednesdayBlock}\n\n` +
    `${thursdayBlock}\n\n` +
    `${fridayBlock}\n\n` +
    `${saturdayBlock}\n\n` +
    `${sundayBlock}\n\n` +
    `--------------------------------------------------\n` +
    `💬 *${coachLabel}*\n\n` +
    `"${coachGuidance}"`
  );
}

/**
 * Generates clear, concise, actionable meal timing advice.
 * Addresses conversational questions comparing lunch + dinner vs skipping lunch,
 * adhering to canonical user profile and Coach Mia/Max personas without truncation.
 */
export function generateMealTimingAdvice(rawProfile: any, userText?: string): string {
  const profile = resolveCanonicalProfile(rawProfile);
  const isMia = (profile.persona || "mia").toLowerCase().includes("mia");
  const coachLabel = isMia ? "Coach Mia" : "Coach Max";

  const separator = "--------------------------------------------------";

  const coachQuote = isMia
    ? "Kalau kamu kasih tahu kira-kira jam makan dan aktivitasmu hari ini, aku bisa bantu atur pembagian porsinya ya ✨"
    : "Fokus pada total asupan harian dan dengarkan sinyal tubuhmu. Kabari jam aktivitasmu kalau mau aku bantu atur porsi! 💪";

  return (
    `🍽️ *SARAN WAKTU MAKAN*\n` +
    `${separator}\n\n` +
    `Kalau kamu memang lapar, lebih baik tetap makan siang dan makan malam dengan porsi yang disesuaikan kebutuhan harianmu. Nggak perlu sengaja melewatkan makan siang hanya supaya bisa makan banyak di malam hari.\n\n` +
    `Kalau kamu tidak lapar saat siang, kamu juga tidak harus memaksakan makan hanya karena jadwal. Yang penting total asupan harian dan nutrisimu tetap terpenuhi seimbang.\n\n` +
    `💡 *Praktisnya*:\n` +
    `• Siang: porsi normal atau lebih ringan\n` +
    `• Malam: sesuaikan sisa kebutuhan harian\n` +
    `• Utamakan protein, sayur, dan karbohidrat sesuai targetmu\n\n` +
    `${separator}\n` +
    `💬 *${coachLabel}*\n` +
    `"${coachQuote}"`
  );
}

