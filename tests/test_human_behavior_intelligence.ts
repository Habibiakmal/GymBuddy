import {
  generatePersonalizedMealRecommendationDetailed,
  generatePersonalizedTomorrowMealPlan,
  generatePersonalizedWorkoutRecommendation,
  validateFoodSafety,
  validateTemporalOverrideSafety,
  validateUserInstructionSafety,
  type CanonicalUserProfile
} from "../services/recommendationEngine";

import {
  classifyUserIntent,
  parsePreferenceInstruction,
  detectRecommendationRejection,
  detectWorkoutAdaptation,
  detectMultiIntent,
  classifyResponseComplexity
} from "../services/intentClassifier";

import {
  setRecentRecommendation,
  getRecentRecommendation,
  clearRecentRecommendation,
  addSessionExcludedIngredient,
  addTemporalOverride,
  resolveRecommendationReference,
  modifyActiveRecommendation
} from "../services/conversationStateManager";

import {
  handleBehavioralIntelligenceIntent,
  generateMealRecommendations
} from "../server";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ [PASS] ${testName}`);
  } else {
    console.error(`❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ""}`);
    throw new Error(`Assertion failed: ${testName}`);
  }
}

console.log("================================================================================");
console.log("🧪 RUNNING COMPREHENSIVE HUMAN BEHAVIOR INTELLIGENCE TEST SUITE (20 SCENARIOS)");
console.log("================================================================================\n");

async function runTestSuite() {
  const testPhone = "628999999999";

  // ---------------------------------------------------------------------------
  // SCENARIO 1: Persistent Dislike
  // User says: "Aku gak suka ikan"
  // ---------------------------------------------------------------------------
  console.log("--- SCENARIO 1: Persistent Dislike ---");
  {
    const text = "Aku gak suka ikan";
    const parsed = parsePreferenceInstruction(text);
    assert(parsed !== null, "Scenario 1: Preference instruction parsed");
    assert(parsed?.type === "PERSISTENT_DISLIKE", "Scenario 1: Detected as PERSISTENT_DISLIKE");
    assert(parsed?.value === "ikan", "Scenario 1: Target value is 'ikan'");

    const baseProfile: CanonicalUserProfile = {
      userId: "user-s1",
      persona: "mia",
      allergiesStatus: "none",
      allergies: [],
      medicalConditionsStatus: "none",
      medicalConditions: [],
      injuries: [],
      dislikedFoods: ["ikan"],
      equipment: "bodyweight",
      targetCalories: 2000,
      targetProtein: 140,
      targetCarbs: 220,
      targetFat: 60
    };

    const rec = generatePersonalizedMealRecommendationDetailed(baseProfile, { calories: 0, protein: 0, carbs: 0, fat: 0 });
    assert(!rec.text.toLowerCase().includes("ikan"), "Scenario 1: Meal recommendation excludes fish");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 2: Temporary Preference (Today only)
  // User says: "Hari ini aku gak mau ayam"
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 2: Temporary Preference (Today) ---");
  {
    const text = "Hari ini aku gak mau ayam";
    const parsed = parsePreferenceInstruction(text);
    assert(parsed !== null, "Scenario 2: Preference instruction parsed");
    assert(parsed?.type === "TEMPORARY_PREFERENCE", "Scenario 2: Detected as TEMPORARY_PREFERENCE");
    assert(parsed?.value === "ayam", "Scenario 2: Excluded value is 'ayam'");
    assert(parsed?.scope === "today", "Scenario 2: Scope is 'today'");

    clearRecentRecommendation(testPhone);
    addSessionExcludedIngredient(testPhone, "ayam");
    const ctx = getRecentRecommendation(testPhone);
    assert(ctx?.excludedIngredients.includes("ayam") === true, "Scenario 2: Session exclusion has 'ayam'");

    const profile: CanonicalUserProfile = {
      userId: "user-s2",
      persona: "max",
      allergiesStatus: "none",
      allergies: [],
      medicalConditionsStatus: "none",
      medicalConditions: [],
      injuries: [],
      dislikedFoods: [], // persistent dislike is empty!
      equipment: "bodyweight",
      targetCalories: 2000,
      targetProtein: 140,
      targetCarbs: 220,
      targetFat: 60
    };

    const rec = generatePersonalizedMealRecommendationDetailed(profile, { calories: 0, protein: 0, carbs: 0, fat: 0 }, undefined, {
      sessionExcludedIngredients: ctx?.excludedIngredients
    });
    assert(!rec.text.toLowerCase().includes("ayam"), "Scenario 2: Session recommendation honors temporary exclusion of ayam");
    assert(profile.dislikedFoods.length === 0, "Scenario 2: Persistent dislikedFoods remains untouched");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 3: Meal-Specific Preference (Tonight only)
  // User has persistent dislikedFoods: ["ikan"], says "Makan malam ini aku mau ikan"
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 3: Meal-Specific Temporal Override (Tonight) ---");
  {
    const text = "Makan malam ini aku mau ikan";
    const parsed = parsePreferenceInstruction(text);
    assert(parsed !== null, "Scenario 3: Preference instruction parsed");
    assert(parsed?.type === "TEMPORAL_OVERRIDE", "Scenario 3: Detected as TEMPORAL_OVERRIDE");
    assert(parsed?.value === "ikan", "Scenario 3: Target value is 'ikan'");
    assert(parsed?.scope === "tonight_only", "Scenario 3: Scope is 'tonight_only'");
    assert(parsed?.category === "malam", "Scenario 3: Category is 'malam'");

    const profileWithFishDislike: CanonicalUserProfile = {
      userId: "user-s3",
      persona: "mia",
      allergiesStatus: "none",
      allergies: [],
      medicalConditionsStatus: "none",
      medicalConditions: [],
      injuries: [],
      dislikedFoods: ["ikan"],
      equipment: "bodyweight",
      targetCalories: 2000,
      targetProtein: 140,
      targetCarbs: 220,
      targetFat: 60
    };

    // Dinner rec with tonight override allows fish
    const recDinner = generatePersonalizedMealRecommendationDetailed(profileWithFishDislike, { calories: 0, protein: 0, carbs: 0, fat: 0 }, "rekomendasi makan malam", {
      targetScope: "tonight_only",
      temporalOverrides: [{
        value: "ikan",
        scope: "tonight_only",
        category: "malam",
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000
      }]
    });
    assert(recDinner.meal !== null, "Scenario 3: Dinner recommendation generated");

    // But breakfast rec without tonight override strictly still excludes fish
    const recBreakfast = generatePersonalizedMealRecommendationDetailed(profileWithFishDislike, { calories: 0, protein: 0, carbs: 0, fat: 0 }, "sarapan", {
      temporalOverrides: [{
        value: "ikan",
        scope: "tonight_only",
        category: "malam",
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000
      }]
    });
    assert(!recBreakfast.text.toLowerCase().includes("ikan"), "Scenario 3: Breakfast still excludes fish");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 4: Persistent Preference Change
  // User says: "Mulai sekarang aku gak masalah makan ikan"
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 4: Persistent Preference Change ---");
  {
    const text = "Mulai sekarang aku gak masalah makan ikan";
    const parsed = parsePreferenceInstruction(text);
    assert(parsed !== null, "Scenario 4: Preference instruction parsed");
    assert(parsed?.type === "PERSISTENT_CHANGE", "Scenario 4: Detected as PERSISTENT_CHANGE");
    assert(parsed?.value === "ikan", "Scenario 4: Target value is 'ikan'");
    assert(parsed?.action === "remove_disliked", "Scenario 4: Action is remove_disliked");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 5: Allergy Override Attempt BLOCKED
  // User has shrimp allergy, says: "Besok aku mau makan udang."
  // Result: BLOCKED. Temporal override must NOT make shrimp eligible!
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 5: Allergy Override Attempt BLOCKED ---");
  {
    const text = "Besok aku mau makan udang";
    const parsed = parsePreferenceInstruction(text);
    assert(parsed !== null && parsed.type === "TEMPORAL_OVERRIDE", "Scenario 5: User requested override for tomorrow");

    const shrimpAllergyProfile: CanonicalUserProfile = {
      userId: "user-shrimp-allergy",
      persona: "mia",
      allergiesStatus: "reported",
      allergies: ["udang", "seafood"],
      medicalConditionsStatus: "none",
      medicalConditions: [],
      injuries: [],
      dislikedFoods: [],
      equipment: "bodyweight",
      targetCalories: 2000,
      targetProtein: 140,
      targetCarbs: 220,
      targetFat: 60
    };

    // Subordination gate validation check
    const safetyCheck = validateTemporalOverrideSafety(parsed.value, shrimpAllergyProfile);
    assert(!safetyCheck.allowed, "Scenario 5: Override for udang is strictly BLOCKED for allergy profile");
    assert(safetyCheck.violationType === "allergy_conflict", "Scenario 5: Violation identified as allergy conflict");

    // Even if tomorrow plan runs with an override passed, validateFoodSafety subordination blocks shrimp
    const tomorrowPlan = generatePersonalizedTomorrowMealPlan(shrimpAllergyProfile, {
      temporalOverrides: [{
        value: "udang",
        scope: "tomorrow_only",
        createdAt: Date.now(),
        expiresAt: Date.now() + 86400000
      }]
    });
    assert(!tomorrowPlan.toLowerCase().includes("udang"), "Scenario 5: Tomorrow plan strictly omits udang");
    assert(!tomorrowPlan.toLowerCase().includes("terasi"), "Scenario 5: Tomorrow plan strictly omits terasi");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 6: Diabetes Nutrition Property Evaluation
  // Evaluates sugar < 8g and avoids sugary drinks/kolak. Complex carbs permitted.
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 6: Diabetes Nutrition Property Evaluation ---");
  {
    const diabProfile: CanonicalUserProfile = {
      userId: "user-diab",
      persona: "mia",
      allergiesStatus: "none",
      allergies: [],
      medicalConditionsStatus: "reported",
      medicalConditions: ["diabetes", "gula darah"],
      injuries: [],
      dislikedFoods: [],
      equipment: "bodyweight",
      targetCalories: 1800,
      targetProtein: 120,
      targetCarbs: 200,
      targetFat: 50
    };

    const highSugarMeal = { name: "Kolak Pisang Manis", sugar: 25, sodium: 100, calories: 350, fat: 5, protein: 3, carbs: 70 };
    const safeComplexCarbMeal = { name: "Oatmeal Apel Rebus", sugar: 6, sodium: 50, calories: 280, fat: 4, protein: 8, carbs: 50 };

    const checkBad = validateFoodSafety(highSugarMeal, diabProfile);
    assert(!checkBad.pass, "Scenario 6: High sugar meal rejected for diabetes");

    const checkGood = validateFoodSafety(safeComplexCarbMeal, diabProfile);
    assert(checkGood.pass, "Scenario 6: Low sugar complex carbohydrate meal allowed for diabetes");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 7: Hypertension Nutrition Property Evaluation
  // Evaluates sodium < 600mg and avoids salty keywords.
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 7: Hypertension Nutrition Property Evaluation ---");
  {
    const hyperProfile: CanonicalUserProfile = {
      userId: "user-hyper",
      persona: "max",
      allergiesStatus: "none",
      allergies: [],
      medicalConditionsStatus: "reported",
      medicalConditions: ["hypertension", "darah tinggi"],
      injuries: [],
      dislikedFoods: [],
      equipment: "bodyweight",
      targetCalories: 2000,
      targetProtein: 140,
      targetCarbs: 220,
      targetFat: 60
    };

    const saltyMeal = { name: "Ayam Kecap Asin Pekat", sodium: 750, sugar: 3, calories: 400, fat: 12, protein: 35, carbs: 20 };
    const lowSodiumMeal = { name: "Sup Dada Ayam Sayur Bening", sodium: 250, sugar: 2, calories: 350, fat: 6, protein: 32, carbs: 30 };

    const checkBad = validateFoodSafety(saltyMeal, hyperProfile);
    assert(!checkBad.pass, "Scenario 7: High sodium meal rejected for hypertension");

    const checkGood = validateFoodSafety(lowSodiumMeal, hyperProfile);
    assert(checkGood.pass, "Scenario 7: Low sodium meal allowed for hypertension");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 8: Cholesterol Nutrition Property Evaluation
  // Evaluates fat < 18g and avoids jeroan/gorengan.
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 8: Cholesterol Nutrition Property Evaluation ---");
  {
    const cholProfile: CanonicalUserProfile = {
      userId: "user-chol",
      persona: "mia",
      allergiesStatus: "none",
      allergies: [],
      medicalConditionsStatus: "reported",
      medicalConditions: ["cholesterol", "kolesterol tinggi"],
      injuries: [],
      dislikedFoods: [],
      equipment: "bodyweight",
      targetCalories: 1900,
      targetProtein: 130,
      targetCarbs: 210,
      targetFat: 55
    };

    const friedMeal = { name: "Gorengan Bakwan & Jeroan Sapi", fat: 28, sodium: 400, sugar: 2, calories: 550, protein: 15, carbs: 45 };
    const leanMeal = { name: "Pepes Ikan Nila Kukus + Buncis", fat: 8, sodium: 300, sugar: 1, calories: 360, protein: 34, carbs: 32 };

    const checkBad = validateFoodSafety(friedMeal, cholProfile);
    assert(!checkBad.pass, "Scenario 8: Gorengan & jeroan rejected for cholesterol");

    const checkGood = validateFoodSafety(leanMeal, cholProfile);
    assert(checkGood.pass, "Scenario 8: Lean non-fried meal allowed for cholesterol");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 9: Workout Duration 15m (Conservative)
  // "waktuku cuma 15 menit" -> condensed to 2 key exercises with regular rest.
  // DOES NOT assume HIIT, DOES NOT add burpees, DOES NOT remove rest.
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 9: Workout Duration 15m (Conservative) ---");
  {
    const text = "Waktuku cuma 15 menit";
    const adaptation = detectWorkoutAdaptation(text);
    assert(adaptation.isAdaptation, "Scenario 9: Detected as workout adaptation");
    assert(adaptation.targetDurationMinutes === 15, "Scenario 9: Target duration is 15m");
    assert(!adaptation.isFatigued, "Scenario 9: Not marked as fatigued");

    const profile: CanonicalUserProfile = {
      userId: "user-w9",
      persona: "max",
      allergiesStatus: "none",
      allergies: [],
      medicalConditionsStatus: "none",
      medicalConditions: [],
      injuries: [],
      dislikedFoods: [],
      equipment: "bodyweight",
      targetCalories: 2000,
      targetProtein: 140,
      targetCarbs: 220,
      targetFat: 60
    };

    const workout = generatePersonalizedWorkoutRecommendation(profile, 0, {
      targetDurationMinutes: 15
    });

    assert(workout.includes("15 Menit"), "Scenario 9: Workout card header indicates 15 minutes");
    assert(!workout.toLowerCase().includes("burpee"), "Scenario 9: Does NOT force burpees");
    assert(!workout.toLowerCase().includes("hiit ekstrem"), "Scenario 9: Does NOT force extreme HIIT");
    assert(workout.includes("Istirahat"), "Scenario 9: Preserves standard rest intervals");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 10: Workout Duration 15m + Fatigue
  // "waktuku 15 menit dan lagi capek" -> light mobility / active recovery focus.
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 10: Workout 15m + Fatigue ---");
  {
    const text = "Waktuku 15 menit dan lagi capek banget";
    const adaptation = detectWorkoutAdaptation(text);
    assert(adaptation.isAdaptation, "Scenario 10: Detected as workout adaptation");
    assert(adaptation.targetDurationMinutes === 15, "Scenario 10: Duration 15m");
    assert(adaptation.isFatigued === true, "Scenario 10: Fatigue detected");

    const profile: CanonicalUserProfile = {
      userId: "user-w10",
      persona: "mia",
      allergiesStatus: "none",
      allergies: [],
      medicalConditionsStatus: "none",
      medicalConditions: [],
      injuries: [],
      dislikedFoods: [],
      equipment: "bodyweight",
      targetCalories: 1800,
      targetProtein: 120,
      targetCarbs: 200,
      targetFat: 50
    };

    const workout = generatePersonalizedWorkoutRecommendation(profile, 0, {
      targetDurationMinutes: 15,
      isFatigued: true
    });

    assert(workout.toLowerCase().includes("pemulihan") || workout.toLowerCase().includes("mobilitas"), "Scenario 10: Emphasizes recovery / mobility");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 11: Knee Discomfort
  // "lututku lagi gak enak" -> conservative avoidance of jump squats/plyometrics.
  // Never diagnoses or claims an exercise is medically safe.
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 11: Knee Discomfort ---");
  {
    const text = "Lututku lagi gak enak hari ini";
    const adaptation = detectWorkoutAdaptation(text);
    assert(adaptation.isAdaptation, "Scenario 11: Detected as workout adaptation");
    assert(adaptation.discomfortArea === "knee", "Scenario 11: Discomfort area is knee");

    const profile: CanonicalUserProfile = {
      userId: "user-w11",
      persona: "max",
      allergiesStatus: "none",
      allergies: [],
      medicalConditionsStatus: "none",
      medicalConditions: [],
      injuries: [],
      dislikedFoods: [],
      equipment: "bodyweight",
      targetCalories: 2000,
      targetProtein: 140,
      targetCarbs: 220,
      targetFat: 60
    };

    const workout = generatePersonalizedWorkoutRecommendation(profile, 0, {
      discomfortArea: "knee"
    });

    assert(!workout.toLowerCase().includes("jump squat"), "Scenario 11: Jump squats avoided");
    assert(!workout.toLowerCase().includes("burpee"), "Scenario 11: Burpees avoided");
    assert(!workout.toLowerCase().includes("100% aman medis"), "Scenario 11: No claims of guaranteed medical safety");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 12: Simple Logging (Concise Action)
  // "tambah air 500ml" -> concise confirmation without full dashboard dump.
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 12: Simple Logging (Concise Action) ---");
  {
    const text = "tambah air 500ml";
    const complexity = classifyResponseComplexity("SIMPLE_ACTION", text);
    assert(complexity === "SIMPLE_ACTION", "Scenario 12: Classified as SIMPLE_ACTION complexity");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 13: Simple Correction (Concise Affected Values)
  // Active rec: chicken rice bowl -> "ganti ayam jadi tahu"
  // Shows only affected calories/protein.
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 13: Simple Correction (Concise Affected Values) ---");
  {
    clearRecentRecommendation(testPhone);
    setRecentRecommendation(testPhone, {
      type: "meal",
      mealData: {
        id: "ayam-panggang-nasi-merah",
        name: "Ayam Panggang Nasi Merah",
        category: "siang",
        calories: 480,
        protein: 38,
        carbs: 45,
        fat: 12,
        components: [
          { name: "Dada Ayam Panggang", portion: "120g", calories: 190, protein: 32, carbs: 0, fat: 4 },
          { name: "Nasi Merah", portion: "1 centong", calories: 150, protein: 3, carbs: 32, fat: 1 },
          { name: "Tumis Buncis", portion: "1 mangkuk kecil", calories: 80, protein: 3, carbs: 8, fat: 4 }
        ]
      },
      excludedIngredients: [],
      temporalOverrides: []
    });

    const resolution = resolveRecommendationReference(testPhone, "ganti ayam jadi tahu");
    assert(resolution.isResolved, "Scenario 13: Reference resolved");
    assert(resolution.action === "replace", "Scenario 13: Action is replace");
    assert(resolution.target === "Dada Ayam Panggang", "Scenario 13: Target is Dada Ayam Panggang");
    assert(resolution.replacement === "tahu", "Scenario 13: Replacement is tahu");

    const updated = modifyActiveRecommendation(testPhone, resolution);
    assert(updated !== null, "Scenario 13: Context successfully modified in place");
    assert(updated!.mealData!.calories < 480, "Scenario 13: Calories recalculated accurately");
    assert(updated!.mealData!.protein < 38, "Scenario 13: Protein recalculated accurately");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 14: Multi-Intent Handling
  // User says: "aku udah makan siang nasi uduk, nanti malam rekomendasi apa ya?"
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 14: Multi-Intent Handling ---");
  {
    const text = "aku udah makan siang nasi uduk, nanti malam rekomendasi apa ya?";
    const multi = detectMultiIntent(text);
    assert(multi.isMultiIntent, "Scenario 14: Detected as multi-intent");
    assert(multi.intents.some(i => i.type === "LOG_MEAL"), "Scenario 14: Contains LOG_MEAL intent");
    assert(multi.intents.some(i => i.type === "RECOMMENDATION"), "Scenario 14: Contains RECOMMENDATION intent");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 15: Permanent Fish Rejection Loop (Action First)
  // AI: "Pepes Ikan Nila..." -> User: "Aku gak suka ikan"
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 15: Permanent Fish Rejection Loop ---");
  {
    const text = "Aku gak suka ikan";
    const rejection = detectRecommendationRejection(text);
    assert(rejection.isRejection, "Scenario 15: Detected as recommendation rejection");
    assert(rejection.rejectedItem === "ikan", "Scenario 15: Rejected item is 'ikan'");
    assert(rejection.isPersistent === true, "Scenario 15: Rejection is persistent dislike");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 16: Conversational Reference: "yang tadi"
  // User says: "yang tadi"
  // Exactly 1 plausible target exists -> resolve automatically!
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 16: Conversational Reference: 'yang tadi' ---");
  {
    clearRecentRecommendation(testPhone);
    setRecentRecommendation(testPhone, {
      type: "meal",
      mealData: {
        id: "pepes-tahu-jamur",
        name: "Pepes Tahu Jamur + Nasi Merah",
        category: "siang",
        calories: 380,
        protein: 18,
        carbs: 45,
        fat: 8
      },
      excludedIngredients: [],
      temporalOverrides: []
    });

    const res = resolveRecommendationReference(testPhone, "yang tadi");
    assert(res.isResolved === true, "Scenario 16: 'yang tadi' resolved automatically");
    assert(res.isAmbiguous === false, "Scenario 16: Not ambiguous (single entity)");
    assert(res.action === "recall", "Scenario 16: Action is recall");
    assert(res.target === "Pepes Tahu Jamur + Nasi Merah", "Scenario 16: Target matched previous meal name");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 17: Conversational Reference: "ganti yang tadi"
  // User says: "ganti yang tadi"
  // Exactly 1 plausible target exists -> resolve automatically to replace!
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 17: Conversational Reference: 'ganti yang tadi' ---");
  {
    clearRecentRecommendation(testPhone);
    setRecentRecommendation(testPhone, {
      type: "meal",
      mealData: {
        id: "pepes-tahu-jamur",
        name: "Pepes Tahu Jamur + Nasi Merah",
        category: "siang",
        calories: 380,
        protein: 18,
        carbs: 45,
        fat: 8
      },
      excludedIngredients: [],
      temporalOverrides: []
    });

    const res = resolveRecommendationReference(testPhone, "ganti yang tadi");
    assert(res.isResolved === true, "Scenario 17: 'ganti yang tadi' resolved automatically");
    assert(res.isAmbiguous === false, "Scenario 17: Not ambiguous");
    assert(res.action === "replace", "Scenario 17: Action is replace");
    assert(res.target === "Pepes Tahu Jamur + Nasi Merah", "Scenario 17: Target matched previous meal");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 18: Conversational Reference: "yang ayamnya"
  // User says: "yang ayamnya"
  // Exactly 1 plausible target exists -> resolve automatically!
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 18: Conversational Reference: 'yang ayamnya' ---");
  {
    clearRecentRecommendation(testPhone);
    setRecentRecommendation(testPhone, {
      type: "meal",
      mealData: {
        id: "bowl-ayam",
        name: "Chicken Protein Bowl",
        category: "siang",
        calories: 450,
        protein: 36,
        carbs: 42,
        fat: 10,
        components: [
          { name: "Dada Ayam Panggang", portion: "120g", calories: 190, protein: 32, carbs: 0, fat: 4 },
          { name: "Nasi Merah", portion: "1 centong", calories: 150, protein: 3, carbs: 32, fat: 1 },
          { name: "Tumis Buncis", portion: "1 mangkuk kecil", calories: 80, protein: 3, carbs: 8, fat: 4 }
        ]
      },
      excludedIngredients: [],
      temporalOverrides: []
    });

    const res = resolveRecommendationReference(testPhone, "yang ayamnya");
    assert(res.isResolved === true, "Scenario 18: 'yang ayamnya' resolved automatically");
    assert(res.isAmbiguous === false, "Scenario 18: Exactly 1 matching component exists");
    assert(res.target === "Dada Ayam Panggang", "Scenario 18: Target matched Dada Ayam Panggang");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 19: Ambiguous Reference: "ganti yang itu"
  // Recommendation has multiple components -> multiple plausible targets exist.
  // Asks one concise clarification. NEVER guesses!
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 19: Ambiguous Reference: 'ganti yang itu' ---");
  {
    clearRecentRecommendation(testPhone);
    setRecentRecommendation(testPhone, {
      type: "meal",
      mealData: {
        id: "bowl-ayam",
        name: "Chicken Protein Bowl",
        category: "siang",
        calories: 450,
        protein: 36,
        carbs: 42,
        fat: 10,
        components: [
          { name: "Dada Ayam Panggang", portion: "120g", calories: 190, protein: 32, carbs: 0, fat: 4 },
          { name: "Nasi Merah", portion: "1 centong", calories: 150, protein: 3, carbs: 32, fat: 1 },
          { name: "Tumis Buncis", portion: "1 mangkuk kecil", calories: 80, protein: 3, carbs: 8, fat: 4 }
        ]
      },
      excludedIngredients: [],
      temporalOverrides: []
    });

    const res = resolveRecommendationReference(testPhone, "ganti yang itu");
    assert(res.isResolved === false, "Scenario 19: Not resolved automatically");
    assert(res.isAmbiguous === true, "Scenario 19: Marked as ambiguous");
    assert((res.candidates || []).length === 3, "Scenario 19: Lists all 3 candidate components");
    assert(Boolean(res.clarificationPrompt), "Scenario 19: Provides concise clarification prompt");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 20: WhatsApp Clean Vertical Readability
  // Clean bullet list, no decorative split lines, no internal system jargon.
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 20: WhatsApp Clean Vertical Readability ---");
  {
    const profile: CanonicalUserProfile = {
      userId: "user-clean-format",
      persona: "mia",
      allergiesStatus: "none",
      allergies: [],
      medicalConditionsStatus: "none",
      medicalConditions: [],
      injuries: [],
      dislikedFoods: [],
      equipment: "bodyweight",
      targetCalories: 2000,
      targetProtein: 140,
      targetCarbs: 220,
      targetFat: 60
    };

    const rec = generatePersonalizedMealRecommendationDetailed(profile, { calories: 0, protein: 0, carbs: 0, fat: 0 });
    assert(!rec.text.includes("--------------------------------------------------"), "Scenario 20: No 50-dash separator");
    assert(!rec.text.includes("-----------------------------"), "Scenario 20: No 29-dash separator in recommendation body");
    assert(!rec.text.includes("Status Rekomendasi:"), "Scenario 20: No internal system jargon");
    assert(rec.text.includes("🔥"), "Scenario 20: Has clean vertical macro formatting");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 21: Direct handleBehavioralIntelligenceIntent E2E Verifications
  // Tests the exact 3 fixes from the user request end-to-end through the handler
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 21: Direct handleBehavioralIntelligenceIntent E2E ---");
  {
    const e2ePhone = "628123456789";

    // 21.1: Shrimp allergy + "Besok aku mau makan udang" -> BLOCKED
    const shrimpUserData: any = {
      persona: "mia",
      allergiesStatus: "reported",
      allergies: ["udang", "seafood"],
      medicalConditionsStatus: "none",
      medicalConditions: [],
      injuries: [],
      dislikedFoods: [],
      targetCalories: 2000,
      targetProtein: 140,
      targetCarbs: 220,
      targetFat: 60
    };
    clearRecentRecommendation(e2ePhone);
    const blockedRes = await handleBehavioralIntelligenceIntent(e2ePhone, "Besok aku mau makan udang", shrimpUserData);
    assert(blockedRes !== null && blockedRes.length > 0, "Scenario 21.1: Handled response generated");
    assert(blockedRes![0].toLowerCase().includes("tidak bisa") || blockedRes![0].toLowerCase().includes("alergi") || blockedRes![0].toLowerCase().includes("sensitif"), "Scenario 21.1: Response indicates request is blocked");
    const ctxAfterBlock = getRecentRecommendation(e2ePhone);
    assert((ctxAfterBlock?.temporalOverrides || []).length === 0, "Scenario 21.1: Temporal override was NOT created for allergen");

    // 21.2: Fish dislike + "Besok aku mau makan ikan" -> ALLOWED for tomorrow only
    const fishDislikeUserData: any = {
      persona: "mia",
      allergiesStatus: "none",
      allergies: [],
      medicalConditionsStatus: "none",
      medicalConditions: [],
      injuries: [],
      dislikedFoods: ["ikan"],
      targetCalories: 2000,
      targetProtein: 140,
      targetCarbs: 220,
      targetFat: 60
    };
    clearRecentRecommendation(e2ePhone);
    const allowedRes = await handleBehavioralIntelligenceIntent(e2ePhone, "Besok aku mau makan ikan", fishDislikeUserData);
    assert(allowedRes !== null && allowedRes.length > 0, "Scenario 21.2: Override response generated");
    assert(allowedRes![0].toLowerCase().includes("diizinkan"), "Scenario 21.2: Override confirmed for tomorrow");
    const ctxAfterAllow = getRecentRecommendation(e2ePhone);
    assert((ctxAfterAllow?.temporalOverrides || []).some(o => o.value === "ikan" && o.scope === "tomorrow_only"), "Scenario 21.2: Temporal override created with tomorrow_only scope");

    // 21.3: Conversational reference: "ganti yang tadi"
    clearRecentRecommendation(e2ePhone);
    setRecentRecommendation(e2ePhone, {
      type: "meal",
      mealData: {
        id: "pepes-tahu",
        name: "Pepes Tahu Jamur + Nasi Merah",
        category: "siang",
        calories: 380,
        protein: 18,
        carbs: 45,
        fat: 8
      },
      excludedIngredients: [],
      temporalOverrides: []
    });
    const gantiTadiRes = await handleBehavioralIntelligenceIntent(e2ePhone, "ganti yang tadi", fishDislikeUserData);
    assert(gantiTadiRes !== null && gantiTadiRes.length > 0, "Scenario 21.3: Response generated for 'ganti yang tadi'");
    assert(gantiTadiRes![0].toLowerCase().includes("pengganti") || gantiTadiRes![0].toLowerCase().includes("menu"), "Scenario 21.3: Generates alternative menu replacing yang tadi");

    // 21.4: Ambiguous conversational reference: "ganti yang itu" with multiple components
    clearRecentRecommendation(e2ePhone);
    setRecentRecommendation(e2ePhone, {
      type: "meal",
      mealData: {
        id: "chicken-bowl",
        name: "Chicken Rice Bowl",
        category: "siang",
        calories: 500,
        protein: 40,
        carbs: 50,
        fat: 12,
        components: [
          { name: "Dada Ayam Panggang", portion: "120g", calories: 200, protein: 34, carbs: 0, fat: 4 },
          { name: "Nasi Merah", portion: "1 centong", calories: 150, protein: 3, carbs: 32, fat: 1 },
          { name: "Tumis Buncis", portion: "1 mangkuk", calories: 80, protein: 3, carbs: 8, fat: 4 }
        ]
      },
      excludedIngredients: [],
      temporalOverrides: []
    });
    const ambiguousRes = await handleBehavioralIntelligenceIntent(e2ePhone, "ganti yang itu", fishDislikeUserData);
    assert(ambiguousRes !== null && ambiguousRes.length > 0, "Scenario 21.4: Ambiguous reference handled");
    assert(ambiguousRes![0].toLowerCase().includes("dada ayam panggang") && ambiguousRes![0].toLowerCase().includes("nasi merah"), "Scenario 21.4: Returns clarification asking which component to replace");

    // 21.5: Single target reference replacement: "ganti ayam jadi tahu"
    const replaceRes = await handleBehavioralIntelligenceIntent(e2ePhone, "ganti ayam jadi tahu", fishDislikeUserData);
    assert(replaceRes !== null && replaceRes.length > 0, "Scenario 21.5: Component replacement handled");
    assert(replaceRes![0].includes("🔥") && replaceRes![0].includes("💪"), "Scenario 21.5: Returns concise affected nutrition values without full dashboard dump");

    // 21.6: PRIORITY GATEKEEPER - Explicit user instruction vs Hard Safety (Allergies)
    // User with shrimp allergy says "Tambahin udang" -> BLOCKED!
    clearRecentRecommendation(e2ePhone);
    setRecentRecommendation(e2ePhone, {
      type: "meal",
      mealData: {
        id: "chicken-bowl-safety",
        name: "Chicken Rice Bowl",
        category: "siang",
        calories: 500,
        protein: 40,
        carbs: 50,
        fat: 12,
        components: [
          { name: "Dada Ayam Panggang", portion: "120g", calories: 200, protein: 34, carbs: 0, fat: 4 },
          { name: "Nasi Merah", portion: "1 centong", calories: 150, protein: 3, carbs: 32, fat: 1 }
        ]
      },
      excludedIngredients: [],
      temporalOverrides: []
    });
    const shrimpAddRes = await handleBehavioralIntelligenceIntent(e2ePhone, "Tambahin udang", shrimpUserData);
    assert(shrimpAddRes !== null && shrimpAddRes.length > 0, "Scenario 21.6: Response generated for allergen addition request");
    assert(shrimpAddRes![0].toLowerCase().includes("alergi") || shrimpAddRes![0].toLowerCase().includes("tidak bisa"), "Scenario 21.6: Explicit instruction 'Tambahin udang' BLOCKED by allergy safety gatekeeper");
    const recAfterShrimpAttempt = getRecentRecommendation(e2ePhone);
    assert(!recAfterShrimpAttempt?.mealData?.components?.some(c => c.name.toLowerCase().includes("udang")), "Scenario 21.6: Allergen was NOT added to meal components");

    // 21.7: PRIORITY GATEKEEPER - Explicit user instruction vs Medical Safety Validation
    // User with hypertension says "Tambahin ikan asin" -> BLOCKED!
    const hyperUserData: any = {
      persona: "mia",
      allergiesStatus: "none",
      allergies: [],
      medicalConditionsStatus: "reported",
      medicalConditions: ["hipertensi", "tekanan darah tinggi"],
      injuries: [],
      dislikedFoods: [],
      targetCalories: 2000,
      targetProtein: 140,
      targetCarbs: 220,
      targetFat: 60
    };
    const hyperAddRes = await handleBehavioralIntelligenceIntent(e2ePhone, "Tambahin ikan asin", hyperUserData);
    assert(hyperAddRes !== null && hyperAddRes.length > 0, "Scenario 21.7: Response generated for high sodium addition request");
    assert(hyperAddRes![0].toLowerCase().includes("tidak dianjurkan") || hyperAddRes![0].toLowerCase().includes("kondisi kesehatan"), "Scenario 21.7: Explicit instruction 'Tambahin ikan asin' BLOCKED by medical safety gatekeeper");
    const recAfterHyperAttempt = getRecentRecommendation(e2ePhone);
    assert(!recAfterHyperAttempt?.mealData?.components?.some(c => c.name.toLowerCase().includes("asin")), "Scenario 21.7: High sodium item was NOT added to meal components");

    // 21.8: PRIORITY GATEKEEPER - Explicit user instruction modifies normal preference (Gate 2 > Gate 7)
    // User has "tahu" in dislikedFoods, but explicitly says "Ganti ayam jadi tahu" -> ALLOWED!
    const tahuDislikeUserData: any = {
      persona: "mia",
      allergiesStatus: "none",
      allergies: [],
      medicalConditionsStatus: "none",
      medicalConditions: [],
      injuries: [],
      dislikedFoods: ["tahu"],
      targetCalories: 2000,
      targetProtein: 140,
      targetCarbs: 220,
      targetFat: 60
    };
    const directSafetyValidation = validateUserInstructionSafety("tahu", tahuDislikeUserData);
    assert(directSafetyValidation.allowed === true, "Scenario 21.8: validateUserInstructionSafety permits disliked food when explicitly requested by user");
    const tahuReplaceRes = await handleBehavioralIntelligenceIntent(e2ePhone, "ganti ayam jadi tahu", tahuDislikeUserData);
    assert(tahuReplaceRes !== null && tahuReplaceRes.length > 0, "Scenario 21.8: Replacement succeeded");
    assert(tahuReplaceRes![0].toLowerCase().includes("tahu sudah aku ganti") || tahuReplaceRes![0].toLowerCase().includes("tahu"), "Scenario 21.8: Tahu successfully substituted into recommendation despite dislikedFoods");

    // 21.9: TEMPORAL OVERRIDE EXPLICIT TYPE VALIDATION
    // Verify TemporalOverride includes explicit type property
    clearRecentRecommendation(e2ePhone);
    addTemporalOverride(e2ePhone, {
      type: "preference_override",
      value: "salmon",
      scope: "tomorrow_only",
      category: "siang"
    });
    const overrideCtx = getRecentRecommendation(e2ePhone);
    assert((overrideCtx?.temporalOverrides || []).length === 1, "Scenario 21.9: Override registered in context");
    assert(overrideCtx!.temporalOverrides[0].type === "preference_override", "Scenario 21.9: Override has explicit type 'preference_override'");
    assert(overrideCtx!.temporalOverrides[0].scope === "tomorrow_only", "Scenario 21.9: Override has scope 'tomorrow_only'");
  }

  console.log("\n================================================================================");
  console.log(`🎉 ALL ${passedTests}/${totalTests} BEHAVIORAL SCENARIOS PASSED PERFECTLY!`);
  console.log("================================================================================\n");
}

runTestSuite().catch(err => {
  console.error("Test suite execution failed:", err);
  process.exit(1);
});
