import { 
  resolveCanonicalProfile, 
  validateFoodSafety, 
  validateWorkoutSafety, 
  generatePersonalizedMealRecommendation, 
  generatePersonalizedWeeklyMealPlan, 
  generatePersonalizedWorkoutRecommendation, 
  generatePersonalizedWeeklyWorkoutPlan,
  UserProfileInput
} from "../services/recommendationEngine";

let passedCount = 0;
let totalCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`✅ [PASS] ${testName}`);
  } else {
    console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
    throw new Error(`Test failed: ${testName}`);
  }
}

async function runTests() {
  console.log("===============================================================================");
  console.log("🧪 STARTING GYMBUDDY RECOMMENDATION ENGINE HARDENING TEST SUITE");
  console.log("===============================================================================\n");

  // TEST 1: Peanut Allergy (Direct peanuts + hidden sources: bumbu kacang, gado-gado)
  console.log("--- TEST 1: Peanut Allergy Enforcement ---");
  const peanutProfile: UserProfileInput = {
    userId: "test-user-1",
    name: "Budi",
    allergies: ["peanuts", "kacang"],
    allergiesStatus: "reported",
    goal: "lose",
    targetCalories: 1800,
    proteinGrams: 140,
    carbGrams: 180,
    fatGrams: 50
  };

  const peanutSafeCheck = validateFoodSafety({ name: "Gado-Gado dengan Bumbu Kacang" }, peanutProfile);
  assert(!peanutSafeCheck.isSafe, "Gado-Gado bumbu kacang must be rejected for peanut allergy", peanutSafeCheck.reason);
  assert(peanutSafeCheck.matchedAllergens.length > 0, "Allergen violation correctly identified");

  const peanutRec = generatePersonalizedMealRecommendation(peanutProfile, { calories: 500, protein: 40, carbs: 50, fat: 15, sodium: 400 });
  assert(!peanutRec.toLowerCase().includes("kacang"), "Recommendation text must not contain kacang");
  assert(!peanutRec.toLowerCase().includes("gado-gado"), "Recommendation text must not contain gado-gado");
  assert(!peanutRec.includes("━━━━━━━━━━━━━━"), "Recommendation must not use decorative split-causing lines");

  // TEST 2: Shellfish & Seafood Allergy (Shrimp, crab, squid, terasi)
  console.log("\n--- TEST 2: Shellfish/Seafood Allergy Enforcement ---");
  const seafoodProfile: UserProfileInput = {
    userId: "test-user-2",
    name: "Siti",
    allergies: ["shellfish", "udang", "seafood"],
    allergiesStatus: "reported",
    goal: "gain",
    targetCalories: 2400,
    proteinGrams: 160,
    carbGrams: 280,
    fatGrams: 70
  };

  const shrimpCheck = validateFoodSafety({ name: "Tumis Kangkung Terasi Udang" }, seafoodProfile);
  assert(!shrimpCheck.isSafe, "Terasi udang must be rejected for seafood allergy", shrimpCheck.reason);

  const seafoodRec = generatePersonalizedMealRecommendation(seafoodProfile, { calories: 800, protein: 50, carbs: 100, fat: 20, sodium: 500 });
  assert(!seafoodRec.toLowerCase().includes("udang"), "Recommendation text must not contain udang");
  assert(!seafoodRec.toLowerCase().includes("seafood"), "Recommendation text must not contain seafood");
  assert(!seafoodRec.toLowerCase().includes("terasi"), "Recommendation text must not contain terasi");

  // TEST 3: Dairy Allergy (Milk, cheese, butter, whey)
  console.log("\n--- TEST 3: Dairy Allergy Enforcement ---");
  const dairyProfile: UserProfileInput = {
    userId: "test-user-3",
    name: "Rian",
    allergies: ["dairy", "susu"],
    allergiesStatus: "reported",
    targetCalories: 2000,
    proteinGrams: 150
  };
  const cheeseCheck = validateFoodSafety({ name: "Roti Gandum Keju Oles" }, dairyProfile);
  assert(!cheeseCheck.isSafe, "Keju must be rejected for dairy allergy", cheeseCheck.reason);

  const dairyRec = generatePersonalizedMealRecommendation(dairyProfile, { calories: 600, protein: 30, carbs: 60, fat: 20, sodium: 300 });
  assert(!dairyRec.toLowerCase().includes("keju"), "Recommendation must not contain keju");
  assert(!dairyRec.toLowerCase().includes("susu sapi"), "Recommendation must not contain susu sapi");

  // TEST 4: Egg Allergy (Egg, mayonnaise)
  console.log("\n--- TEST 4: Egg Allergy Enforcement ---");
  const eggProfile: UserProfileInput = {
    userId: "test-user-4",
    name: "Dewi",
    allergies: ["eggs", "telur"],
    allergiesStatus: "reported",
    targetCalories: 1700,
    proteinGrams: 130
  };
  const eggCheck = validateFoodSafety({ name: "Salad dengan Telur Rebus & Mayones" }, eggProfile);
  assert(!eggCheck.isSafe, "Telur & mayones must be rejected for egg allergy", eggCheck.reason);

  const eggRec = generatePersonalizedMealRecommendation(eggProfile, { calories: 500, protein: 30, carbs: 60, fat: 15, sodium: 400 });
  assert(!eggRec.toLowerCase().includes("telur"), "Recommendation must not contain telur");
  assert(!eggRec.toLowerCase().includes("mayones"), "Recommendation must not contain mayones");

  // TEST 5: Gluten Allergy (Wheat, bread, pasta, noodles)
  console.log("\n--- TEST 5: Gluten Allergy Enforcement ---");
  const glutenProfile: UserProfileInput = {
    userId: "test-user-5",
    name: "Agus",
    allergies: ["gluten", "terigu"],
    allergiesStatus: "reported",
    targetCalories: 1900
  };
  const noodleCheck = validateFoodSafety({ name: "Mie Goreng Spesial" }, glutenProfile);
  assert(!noodleCheck.isSafe, "Mie must be rejected for gluten allergy", noodleCheck.reason);

  const glutenRec = generatePersonalizedMealRecommendation(glutenProfile, { calories: 400, protein: 25, carbs: 40, fat: 10, sodium: 300 });
  assert(!glutenRec.toLowerCase().includes("roti gandum"), "Recommendation must not recommend roti gandum for gluten allergy");

  // TEST 6: Hypertension Medical Condition (Low sodium guard, max 500mg/meal)
  console.log("\n--- TEST 6: Hypertension Nutrition & Workout Safety ---");
  const hyperProfile: UserProfileInput = {
    userId: "test-user-6",
    name: "Pak Hendra",
    medicalConditions: ["hypertension", "hipertensi", "darah tinggi"],
    medicalConditionsStatus: "reported",
    targetCalories: 1800,
    proteinGrams: 120
  };
  const saltyMealCheck = validateFoodSafety({ name: "Ayam Kecap Asin Pekat", sodiumMg: 750 }, hyperProfile);
  assert(!saltyMealCheck.isSafe, "Meal with 750mg sodium must be rejected for hypertension", saltyMealCheck.reason);

  const hyperMealRec = generatePersonalizedMealRecommendation(hyperProfile, { calories: 400, protein: 30, carbs: 40, fat: 10, sodium: 600 });
  assert(hyperMealRec.toLowerCase().includes("natrium") || hyperMealRec.toLowerCase().includes("sodium") || hyperMealRec.toLowerCase().includes("garam"), "Hypertension recommendation includes sodium/natrium awareness note");

  const hyperWorkoutRec = generatePersonalizedWorkoutRecommendation(hyperProfile, 0);
  assert(!hyperWorkoutRec.toLowerCase().includes("burpees"), "High intensity burpees avoided for hypertension");

  // TEST 7: Diabetes Medical Condition (Low sugar guard, balanced carbs)
  console.log("\n--- TEST 7: Diabetes Nutrition Safety ---");
  const diabProfile: UserProfileInput = {
    userId: "test-user-7",
    name: "Ibu Ratna",
    medicalConditions: ["diabetes", "gula darah"],
    medicalConditionsStatus: "reported",
    targetCalories: 1600
  };
  const sweetMealCheck = validateFoodSafety({ name: "Es Teh Manis & Kolak Pisang", sugarG: 28 }, diabProfile);
  assert(!sweetMealCheck.isSafe, "High sugar item must be rejected for diabetes", sweetMealCheck.reason);

  const diabMealRec = generatePersonalizedMealRecommendation(diabProfile, { calories: 500, protein: 35, carbs: 50, fat: 15, sugar: 4 });
  assert(!diabMealRec.toLowerCase().includes("gula pasir"), "Diabetes recommendation does not suggest added sugar");

  // TEST 8: High Cholesterol (Low saturated fat, no deep fried foods)
  console.log("\n--- TEST 8: High Cholesterol Nutrition Safety ---");
  const cholProfile: UserProfileInput = {
    userId: "test-user-8",
    name: "Bambang",
    medicalConditions: ["high_cholesterol", "kolesterol tinggi"],
    medicalConditionsStatus: "reported",
    targetCalories: 1900
  };
  const friedCheck = validateFoodSafety({ name: "Gorengan Bakwan & Jeroan Sapi" }, cholProfile);
  assert(!friedCheck.isSafe, "Gorengan & jeroan rejected for cholesterol", friedCheck.reason);

  // TEST 9: Heart Conditions (Conservative intensity)
  console.log("\n--- TEST 9: Heart Condition Safety ---");
  const heartProfile: UserProfileInput = {
    userId: "test-user-9",
    name: "Pak Surya",
    medicalConditions: ["heart_condition", "penyakit jantung"],
    medicalConditionsStatus: "reported"
  };
  const hiitCheck = validateWorkoutSafety({ name: "Extreme Sprint HIIT Interval", impact: "high" }, heartProfile);
  assert(!hiitCheck.isSafe, "Extreme HIIT rejected for heart condition", hiitCheck.reason);

  // TEST 10: Kidney Conditions (No protein overload push)
  console.log("\n--- TEST 10: Kidney Disease Advice Safety ---");
  const kidneyProfile: UserProfileInput = {
    userId: "test-user-10",
    name: "Bu Linda",
    medicalConditions: ["kidney_disease", "ginjal"],
    medicalConditionsStatus: "reported"
  };
  const kidneyRec = generatePersonalizedMealRecommendation(kidneyProfile, { calories: 400, protein: 20, carbs: 50, fat: 10 });
  assert(kidneyRec.toLowerCase().includes("dokter") || kidneyRec.toLowerCase().includes("medis"), "Kidney disease profile emphasizes medical/physician guidance");

  // TEST 11: Knee Injury (No jump rope, jump squats, heavy knee squats; low-impact alternatives)
  console.log("\n--- TEST 11: Knee Injury Workout Safety & Substitution ---");
  const kneeProfile: UserProfileInput = {
    userId: "test-user-11",
    name: "Reza",
    injuries: ["knee", "lutut"],
    injuriesStatus: "reported",
    equipment: "dumbbell"
  };
  const jumpRopeCheck = validateWorkoutSafety({ name: "Jumping Rope", impact: "high" }, kneeProfile);
  assert(!jumpRopeCheck.isSafe, "Jumping Rope rejected for knee injury", jumpRopeCheck.reason);

  const jumpSquatCheck = validateWorkoutSafety({ name: "Jump Squat", impact: "high" }, kneeProfile);
  assert(!jumpSquatCheck.isSafe, "Jump Squat rejected for knee injury", jumpSquatCheck.reason);

  const kneeWorkoutRec = generatePersonalizedWorkoutRecommendation(kneeProfile, 0);
  assert(!kneeWorkoutRec.toLowerCase().includes("jump squat"), "Knee workout rec does not contain jump squat");
  assert(!kneeWorkoutRec.toLowerCase().includes("jumping rope"), "Knee workout rec does not contain jumping rope");
  assert(kneeWorkoutRec.toLowerCase().includes("lutut") || kneeWorkoutRec.toLowerCase().includes("rendah beban") || kneeWorkoutRec.toLowerCase().includes("glute bridge") || kneeWorkoutRec.toLowerCase().includes("squat ke kursi"), "Knee injury adaptation or safe exercise present");

  // TEST 12: Shoulder Injury (No overhead press, heavy shoulder loading)
  console.log("\n--- TEST 12: Shoulder Injury Workout Safety ---");
  const shoulderProfile: UserProfileInput = {
    userId: "test-user-12",
    name: "Doni",
    injuries: ["shoulder", "bahu"],
    injuriesStatus: "reported",
    equipment: "full_gym"
  };
  const ohpCheck = validateWorkoutSafety({ name: "Dumbbell Overhead Press" }, shoulderProfile);
  assert(!ohpCheck.isSafe, "Overhead press rejected for shoulder injury", ohpCheck.reason);

  const shoulderWorkoutRec = generatePersonalizedWorkoutRecommendation(shoulderProfile, 0);
  assert(!shoulderWorkoutRec.toLowerCase().includes("overhead press"), "Shoulder workout rec avoids overhead press");

  // TEST 13: Lower Back Limitation (No heavy deadlifts, spinal loading)
  console.log("\n--- TEST 13: Lower Back Workout Safety ---");
  const backProfile: UserProfileInput = {
    userId: "test-user-13",
    name: "Fajar",
    injuries: ["lower_back", "pinggang", "punggung bawah"],
    injuriesStatus: "reported"
  };
  const deadliftCheck = validateWorkoutSafety({ name: "Barbell Deadlift" }, backProfile);
  assert(!deadliftCheck.isSafe, "Deadlift rejected for lower back injury", deadliftCheck.reason);

  const backWorkoutRec = generatePersonalizedWorkoutRecommendation(backProfile, 0);
  assert(!backWorkoutRec.toLowerCase().includes("barbell deadlift"), "Back workout rec avoids heavy deadlift");

  // TEST 14: Multiple Restrictions (Knee injury + Peanut allergy + Hypertension)
  console.log("\n--- TEST 14: Multiple Restrictions Concurrently Enforced ---");
  const multiProfile: UserProfileInput = {
    userId: "test-user-14",
    name: "Citra",
    allergies: ["peanuts", "kacang"],
    allergiesStatus: "reported",
    medicalConditions: ["hypertension", "darah tinggi"],
    medicalConditionsStatus: "reported",
    injuries: ["knee", "lutut"],
    injuriesStatus: "reported",
    equipment: "bodyweight_only",
    targetCalories: 1700,
    proteinGrams: 110
  };

  const multiMealRec = generatePersonalizedMealRecommendation(multiProfile, { calories: 400, protein: 25, carbs: 45, fat: 12, sodium: 550 });
  assert(!multiMealRec.toLowerCase().includes("kacang"), "Multi-restriction meal avoids peanuts");
  assert(multiMealRec.toLowerCase().includes("natrium") || multiMealRec.toLowerCase().includes("rendah garam"), "Multi-restriction meal honors hypertension sodium care");

  const multiWorkoutRec = generatePersonalizedWorkoutRecommendation(multiProfile, 0);
  assert(!multiWorkoutRec.toLowerCase().includes("jump squat"), "Multi-restriction workout avoids jump squat");
  assert(!multiWorkoutRec.toLowerCase().includes("jumping rope"), "Multi-restriction workout avoids jumping rope");

  // TEST 15: Profile Update Mid-Journey (Immediate constraint enforcement)
  console.log("\n--- TEST 15: Dynamic Profile Updates Reflected Immediately ---");
  const baselineUser: UserProfileInput = {
    userId: "test-user-15",
    name: "Eko",
    allergies: [],
    allergiesStatus: "none_reported",
    injuries: [],
    injuriesStatus: "none_reported",
    targetCalories: 2000
  };
  const preUpdateMeal = generatePersonalizedMealRecommendation(baselineUser, { calories: 500, protein: 30, carbs: 50, fat: 15 });
  // Now user updates profile with shellfish allergy & knee injury
  const updatedUser: UserProfileInput = {
    ...baselineUser,
    allergies: ["seafood", "udang"],
    allergiesStatus: "reported",
    injuries: ["knee", "cedera lutut"],
    injuriesStatus: "reported"
  };
  const postUpdateMeal = generatePersonalizedMealRecommendation(updatedUser, { calories: 500, protein: 30, carbs: 50, fat: 15 });
  assert(!postUpdateMeal.toLowerCase().includes("udang") && !postUpdateMeal.toLowerCase().includes("seafood"), "Updated profile immediately excludes seafood");
  
  const postUpdateWorkout = generatePersonalizedWorkoutRecommendation(updatedUser, 0);
  assert(!postUpdateWorkout.toLowerCase().includes("jump squat"), "Updated profile immediately excludes jump squats");

  // TEST 16: Nutrition Target Adaptation (Deficit, Surplus, and Protein Gaps)
  console.log("\n--- TEST 16: Dynamic Nutrition Target Adaptation ---");
  const targetUser: UserProfileInput = {
    userId: "test-user-16",
    name: "Taufik",
    targetCalories: 2000,
    proteinGrams: 150,
    carbGrams: 200,
    fatGrams: 60
  };
  // Case A: High remaining protein gap (120g left)
  const proteinGapRec = generatePersonalizedMealRecommendation(targetUser, { calories: 700, protein: 30, carbs: 90, fat: 20 });
  assert(proteinGapRec.toLowerCase().includes("protein") && proteinGapRec.toLowerCase().includes("sisa"), "Meal rec acknowledges protein remaining gap");

  // Case B: Calorie limit exceeded (2200/2000 kcal)
  const overCalRec = generatePersonalizedMealRecommendation(targetUser, { calories: 2200, protein: 155, carbs: 240, fat: 75 });
  assert(overCalRec.toLowerCase().includes("melebihi") || overCalRec.toLowerCase().includes("air putih") || overCalRec.toLowerCase().includes("pemulihan"), "Over calorie state recommends light recovery and water");

  // TEST 17: Weekly Plans (7-Day Meal & Workout Schedules)
  console.log("\n--- TEST 17: 7-Day Personalized Meal & Workout Schedules ---");
  const weeklyMeal = generatePersonalizedWeeklyMealPlan(multiProfile);
  assert(weeklyMeal.toLowerCase().includes("senin") && weeklyMeal.toLowerCase().includes("minggu"), "Weekly meal plan contains all 7 days");
  assert(!weeklyMeal.toLowerCase().includes("kacang"), "Weekly meal plan strictly avoids peanut allergen for multiProfile");
  assert(!weeklyMeal.includes("━━━━━━━━━━━━━━"), "Weekly meal plan has no WhatsApp splitting characters");

  const weeklyWorkout = generatePersonalizedWeeklyWorkoutPlan(multiProfile);
  assert(weeklyWorkout.toLowerCase().includes("senin") && weeklyWorkout.toLowerCase().includes("minggu"), "Weekly workout plan contains 7-day schedule");
  assert(!weeklyWorkout.toLowerCase().includes("jump squat"), "Weekly workout plan excludes jump squats for knee injury");
  assert(!weeklyWorkout.toLowerCase().includes("jumping rope"), "Weekly workout plan excludes jump rope for knee injury");

  console.log("\n===============================================================================");
  console.log(`🎉 ALL ${passedCount}/${totalCount} RECOMMENDATION & SAFETY TESTS PASSED SUCCESSFULLY!`);
  console.log("===============================================================================");
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
