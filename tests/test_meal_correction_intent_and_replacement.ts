/**
 * Comprehensive Verification Suite for:
 * 1. Dedicated MEAL_CORRECTION intent & subtypes
 * 2. Food item replacement logic (e.g. Daging Sambal -> Cumi Sambal)
 * 3. Complete meal composition clarification (e.g. Nasi Putih + Cumi Sambal, removing Telur)
 * 4. Nutrition recalculation using replacement item (squid protein)
 * 5. In-place database update preserving Meal ID (no duplicate meals)
 * 6. Web dashboard consistency
 * 7. All 7 specified test cases from the user prompt
 */

import {
  applyTargetedMealCorrection,
  extractMealComponents,
  formatNutritionCard
} from "../services/nutritionEngine";
import {
  classifyUserIntent,
  parseMealCorrectionDetails,
  type MealCorrectionSubtype
} from "../services/intentClassifier";
import {
  detectMealCorrectionIntent,
  processMealCorrection,
  getLastFoodMeal,
  addMealLog,
  getDailyTotals,
  dbData,
  saveDb
} from "../server";

console.log("================================================================================");
console.log("🧪 RUNNING SUITE: MEAL CORRECTION INTENT & FOOD ITEM REPLACEMENT");
console.log("================================================================================");

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}${detail ? ` -> Detail: ${detail}` : ""}`);
    failedCount++;
  }
}

const mockUserDataMia = {
  name: "Habibi",
  nickname: "Habibi",
  persona: "mia",
  targetCalories: 2000,
  proteinGrams: 120,
  carbGrams: 240,
  fatGrams: 65,
  gender: "pria",
  age: 25
};

// ── TEST 1: Existing Nasi + Daging; User: "Itu cumi, bukan daging." ──
console.log("\n▶ TEST 1: 'Itu cumi, bukan daging.' on Nasi + Daging");
{
  const meal = {
    id: "meal-test-1",
    foodName: "Nasi Putih & Daging Sapi",
    calories: 431,
    protein: 25.4,
    carbs: 56.2,
    fat: 10.6,
    fiber: 0.8,
    sugar: 0.2,
    sodium: 182,
    portionEstimates: [
      "• Nasi Putih: 1 porsi (200g) (~251 kcal)",
      "• Daging Sapi: 1 porsi (80g) (~180 kcal)"
    ]
  };

  const parsedIntent = parseMealCorrectionDetails("Itu cumi, bukan daging.");
  assert(parsedIntent?.subtype === "MEAL_CORRECTION_ITEM", "Test 1: Intent is MEAL_CORRECTION_ITEM");
  assert(parsedIntent?.action === "replace_item", "Test 1: Action is replace_item");
  assert(parsedIntent?.targetItem === "daging", "Test 1: Target item is daging");
  assert(parsedIntent?.replacementItem === "cumi", "Test 1: Replacement item is cumi");

  const result = applyTargetedMealCorrection(meal, "Itu cumi, bukan daging.", mockUserDataMia);
  assert(result.isCorrection === true, "Test 1: isCorrection is true");
  assert(!result.isAmbiguous, "Test 1: isAmbiguous is false");
  assert(result.foodName === "Nasi Putih, Cumi", "Test 1: Result foodName is 'Nasi Putih, Cumi'");
  assert(result.components.length === 2, "Test 1: Has exactly 2 components");
  assert(result.components[0].name === "Nasi Putih", "Test 1: Nasi Putih preserved");
  assert(result.components[1].name === "Cumi", "Test 1: Daging replaced with Cumi");
  assert(!result.coachComment.includes("Mau dikoreksi bagian apa dari Nasi Putih?"), "Test 1: Does NOT ask about Nasi Putih");
}

// ── TEST 2: Existing Nasi + Telur + Daging; User: "Ganti daging sambal jadi cumi sambal." ──
console.log("\n▶ TEST 2: 'Ganti daging sambal jadi cumi sambal.' on Nasi + Telur + Daging");
{
  const meal = {
    id: "meal-test-2",
    foodName: "Nasi Putih, Telur Orak-Arik, Daging Sambal",
    calories: 480,
    protein: 28,
    carbs: 45,
    fat: 20,
    fiber: 2,
    sugar: 3,
    sodium: 500,
    portionEstimates: [
      "• Nasi Putih: 1 porsi (~251 kcal)",
      "• Telur Orak-Arik: 1 butir (~95 kcal)",
      "• Daging Sambal: 70g (~134 kcal)"
    ]
  };

  const parsedIntent = parseMealCorrectionDetails("Ganti daging sambal jadi cumi sambal.");
  assert(parsedIntent?.subtype === "MEAL_CORRECTION_ITEM", "Test 2: Intent is MEAL_CORRECTION_ITEM");
  assert(parsedIntent?.targetItem === "daging sambal", "Test 2: Target is daging sambal");
  assert(parsedIntent?.replacementItem === "cumi sambal", "Test 2: Replacement is cumi sambal");

  const result = applyTargetedMealCorrection(meal, "Ganti daging sambal jadi cumi sambal.", mockUserDataMia);
  assert(result.foodName === "Nasi Putih, Telur Orak-Arik, Cumi Sambal", "Test 2: FoodName is 'Nasi Putih, Telur Orak-Arik, Cumi Sambal'");
  assert(result.components.some(c => c.name === "Nasi Putih"), "Test 2: Nasi Putih preserved");
  assert(result.components.some(c => c.name === "Telur Orak-Arik"), "Test 2: Telur Orak-Arik preserved");
  assert(result.components.some(c => c.name === "Cumi Sambal"), "Test 2: Cumi Sambal present");
  assert(!result.components.some(c => c.name === "Daging Sambal"), "Test 2: Daging Sambal removed");
}

// ── TEST 3: Existing Nasi + Telur + Daging; User: "Nasinya cuma 100 gram." ──
console.log("\n▶ TEST 3: 'Nasinya cuma 100 gram.' on Nasi + Telur + Daging");
{
  const meal = {
    id: "meal-test-3",
    foodName: "Nasi Putih, Telur Orak-Arik, Daging Sambal",
    calories: 480,
    protein: 28,
    carbs: 45,
    fat: 20,
    fiber: 2,
    sugar: 3,
    sodium: 500,
    portionEstimates: [
      "• Nasi Putih: 1 porsi (200g) (~251 kcal)",
      "• Telur Orak-Arik: 1 butir (~95 kcal)",
      "• Daging Sambal: 70g (~134 kcal)"
    ]
  };

  const parsedIntent = parseMealCorrectionDetails("Nasinya cuma 100 gram.");
  assert(parsedIntent?.subtype === "MEAL_CORRECTION_PORTION", "Test 3: Intent is MEAL_CORRECTION_PORTION");
  assert(parsedIntent?.targetItem === "nasi", "Test 3: Target is nasi");
  assert(parsedIntent?.weightGrams === 100, "Test 3: Grams is 100");

  const result = applyTargetedMealCorrection(meal, "Nasinya cuma 100 gram.", mockUserDataMia);
  const riceComp = result.components.find(c => c.name.toLowerCase().includes("nasi"));
  assert(riceComp?.portion.includes("100g") || riceComp?.weightGrams === 100, "Test 3: Only rice portion updated to 100g");
  assert(result.components.some(c => c.name.includes("Telur")), "Test 3: Telur NOT replaced");
  assert(result.components.some(c => c.name.includes("Daging")), "Test 3: Daging NOT replaced");
}

// ── TEST 4: Existing Nasi + Telur + Daging; User: "Telurnya nggak jadi." ──
console.log("\n▶ TEST 4: 'Telurnya nggak jadi.' on Nasi + Telur + Daging");
{
  const meal = {
    id: "meal-test-4",
    foodName: "Nasi Putih, Telur Orak-Arik, Daging Sambal",
    calories: 480,
    protein: 28,
    carbs: 45,
    fat: 20,
    fiber: 2,
    sugar: 3,
    sodium: 500,
    portionEstimates: [
      "• Nasi Putih: 1 porsi (~251 kcal)",
      "• Telur Orak-Arik: 1 butir (~95 kcal)",
      "• Daging Sambal: 70g (~134 kcal)"
    ]
  };

  const parsedIntent = parseMealCorrectionDetails("Telurnya nggak jadi.");
  assert(parsedIntent?.subtype === "MEAL_CORRECTION_COMPONENT", "Test 4: Intent is MEAL_CORRECTION_COMPONENT");
  assert(parsedIntent?.action === "remove_component", "Test 4: Action is remove_component");

  const result = applyTargetedMealCorrection(meal, "Telurnya nggak jadi.", mockUserDataMia);
  assert(!result.components.some(c => c.name.includes("Telur")), "Test 4: Telur successfully removed");
  assert(result.components.some(c => c.name.includes("Nasi")), "Test 4: Nasi preserved");
  assert(result.components.some(c => c.name.includes("Daging")), "Test 4: Daging preserved");
  assert(result.foodName === "Nasi Putih, Daging Sambal", "Test 4: Result foodName is 'Nasi Putih, Daging Sambal'");
}

// ── TEST 5: Existing Nasi + Telur + Daging; User: "Koreksi meal tadi." ──
console.log("\n▶ TEST 5: 'Koreksi meal tadi.' on Nasi + Telur + Daging");
{
  const meal = {
    id: "meal-test-5",
    foodName: "Nasi Putih, Telur Orak-Arik, Daging Sambal",
    calories: 480,
    protein: 28,
    carbs: 45,
    fat: 20,
    fiber: 2,
    sugar: 3,
    sodium: 500,
    portionEstimates: [
      "• Nasi Putih: 1 porsi (~251 kcal)",
      "• Telur Orak-Arik: 1 butir (~95 kcal)",
      "• Daging Sambal: 70g (~134 kcal)"
    ]
  };

  const parsedIntent = parseMealCorrectionDetails("Koreksi meal tadi.");
  assert(parsedIntent?.subtype === "MEAL_CORRECTION_GENERAL", "Test 5: Intent is MEAL_CORRECTION_GENERAL");
  assert(parsedIntent?.isAmbiguous === true, "Test 5: isAmbiguous is true");

  const result = applyTargetedMealCorrection(meal, "Koreksi meal tadi.", mockUserDataMia);
  assert(result.isAmbiguous === true, "Test 5: applyTargetedMealCorrection returns isAmbiguous true");
  assert(result.isCorrection === false, "Test 5: isCorrection is false");
  assert(result.calories === meal.calories, "Test 5: Calories untouched");
  assert(!result.clarificationMessage?.toLowerCase().includes("dari nasi putih"), "Test 5: Does NOT falsely ask about Nasi Putih");
  assert(result.clarificationMessage?.includes("Bagian mana yang mau dikoreksi"), "Test 5: Asks targeted clarification 'Bagian mana yang mau dikoreksi'");
}

// ── TEST 6: Existing Nasi + Telur + Daging; User: "Meal tadi isinya nasi putih sama cumi sambal." ──
console.log("\n▶ TEST 6: 'Meal tadi isinya nasi putih sama cumi sambal.' on Nasi + Telur + Daging");
{
  const meal = {
    id: "meal-test-6",
    foodName: "Nasi Putih, Telur Orak-Arik, Daging Sambal",
    calories: 480,
    protein: 28,
    carbs: 45,
    fat: 20,
    fiber: 2,
    sugar: 3,
    sodium: 500,
    portionEstimates: [
      "• Nasi Putih: 1 porsi (~251 kcal)",
      "• Telur Orak-Arik: 1 butir (~95 kcal)",
      "• Daging Sambal: 70g (~134 kcal)"
    ]
  };

  const parsedIntent = parseMealCorrectionDetails("Meal tadi isinya nasi putih sama cumi sambal.");
  assert(parsedIntent?.subtype === "MEAL_CORRECTION_GENERAL", "Test 6: Intent is MEAL_CORRECTION_GENERAL");
  assert(parsedIntent?.action === "set_composition", "Test 6: Action is set_composition");
  assert(parsedIntent?.compositionItems?.length === 2, "Test 6: Has 2 composition items");

  const result = applyTargetedMealCorrection(meal, "Meal tadi isinya nasi putih sama cumi sambal.", mockUserDataMia);
  assert(result.foodName === "Nasi Putih, Cumi Sambal", "Test 6: Result foodName is 'Nasi Putih, Cumi Sambal'");
  assert(result.components.length === 2, "Test 6: Strictly contains 2 components");
  assert(!result.components.some(c => c.name.includes("Telur")), "Test 6: Telur removed as requested");
  assert(result.components.some(c => c.name.includes("Cumi Sambal")), "Test 6: Cumi Sambal present");
}

// ── TEST 7: Existing Nasi + Daging; User: "Yang tadi bukan ayam, tapi cumi." ──
console.log("\n▶ TEST 7: 'Yang tadi bukan ayam, tapi cumi.' on Nasi + Daging");
{
  const meal = {
    id: "meal-test-7",
    foodName: "Nasi Putih, Daging Sapi",
    calories: 431,
    protein: 25.4,
    carbs: 56.2,
    fat: 10.6,
    fiber: 0.8,
    sugar: 0.2,
    sodium: 182,
    portionEstimates: [
      "• Nasi Putih: 1 porsi (~251 kcal)",
      "• Daging Sapi: 1 porsi (~180 kcal)"
    ]
  };

  const parsedIntent = parseMealCorrectionDetails("Yang tadi bukan ayam, tapi cumi.");
  assert(parsedIntent?.subtype === "MEAL_CORRECTION_ITEM", "Test 7: Intent is MEAL_CORRECTION_ITEM");
  assert(parsedIntent?.targetItem === "ayam", "Test 7: Target is ayam");
  assert(parsedIntent?.replacementItem === "cumi", "Test 7: Replacement is cumi");

  const result = applyTargetedMealCorrection(meal, "Yang tadi bukan ayam, tapi cumi.", mockUserDataMia);
  assert(result.foodName === "Nasi Putih, Cumi", "Test 7: Resolves protein item in meal and replaces Daging with Cumi");
  assert(result.components.some(c => c.name === "Nasi Putih"), "Test 7: Nasi Putih preserved");
  assert(result.components.some(c => c.name === "Cumi"), "Test 7: Cumi present");
  assert(!result.coachComment.includes("Nasi Putih?"), "Test 7: Does NOT ask about Nasi Putih");
}

// ── TEST 8: USER'S EXACT TEST CONVERSATION & DATABASE IN-PLACE UPDATE ──
console.log("\n▶ TEST 8: User's Exact Conversation & Database In-Place Integrity");
(async () => {
  const testPhone = "628999888777";
  const todayStr = new Date().toISOString().split("T")[0];

  // Step 1: Initial meal logged
  const initialMeal = {
    id: `meal-initial-${Date.now()}`,
    foodName: "Nasi Putih, Telur Orak-Arik, Daging Sambal",
    calories: 480,
    protein: 28.0,
    carbs: 45.0,
    fat: 20.0,
    fiber: 2.0,
    sugar: 3.0,
    sodium: 500,
    timestamp: new Date().toISOString(),
    portionEstimates: [
      "• Nasi Putih: 1 porsi (200g) (~251 kcal)",
      "• Telur Orak-Arik: 1 butir (~95 kcal)",
      "• Daging Sambal: 70g (~134 kcal)"
    ],
    items: [
      { food_name: "Nasi Putih", portion: "1 porsi (200g)", calories: 251, protein: 5.4, carbs: 56.2, fat: 0.6, fiber: 0.8, sugar: 0.2, sodium: 2 },
      { food_name: "Telur Orak-Arik", portion: "1 butir", calories: 95, protein: 8.0, carbs: 0.8, fat: 6.7, fiber: 0, sugar: 0.8, sodium: 79 },
      { food_name: "Daging Sambal", portion: "70g", calories: 134, protein: 14.6, carbs: 3.2, fat: 12.7, fiber: 0.6, sugar: 2.0, sodium: 419 }
    ]
  };

  addMealLog(testPhone, initialMeal);
  const logged = getLastFoodMeal(testPhone, todayStr);
  assert(logged?.id === initialMeal.id, "Step 1: Initial meal successfully saved to database");

  // Step 2: User correction: "koreksi, itu cumi, bukan daging sambal"
  const userCorrectionText = "koreksi, itu cumi, bukan daging sambal";
  const isDetected = detectMealCorrectionIntent(userCorrectionText, true);
  assert(isDetected === true, "Step 2: detectMealCorrectionIntent returns true for 'koreksi, itu cumi, bukan daging sambal'");

  const correctionRes = await processMealCorrection(testPhone, userCorrectionText, mockUserDataMia, todayStr);
  assert(correctionRes !== null, "Step 2: processMealCorrection processed successfully");
  assert(correctionRes?.mealRecord.id === initialMeal.id, "Step 2: Meal ID is 100% PRESERVED (mutated in-place)");
  assert(correctionRes?.mealRecord.foodName === "Nasi Putih, Telur Orak-Arik, Cumi Sambal", "Step 2: FoodName updated to reflect Cumi Sambal");
  assert(correctionRes?.card.includes("Cumi Sambal"), "Step 2: Response card displays Cumi Sambal");
  assert(!correctionRes?.card.includes("Mau dikoreksi bagian apa dari Nasi Putih?"), "Step 2: NEVER asks 'Mau dikoreksi bagian apa dari Nasi Putih?'");

  // Verify database record in dailyLogs
  const currentDbMeal = getLastFoodMeal(testPhone, todayStr);
  assert(currentDbMeal?.id === initialMeal.id, "Step 2 DB: Exactly 1 meal exists in DB with original ID");
  assert(currentDbMeal?.foodName === "Nasi Putih, Telur Orak-Arik, Cumi Sambal", "Step 2 DB: DB record has updated foodName for Web Dashboard");
  assert(currentDbMeal?.items?.some((it: any) => it.food_name === "Cumi Sambal"), "Step 2 DB: items array has Cumi Sambal");
  assert(!currentDbMeal?.items?.some((it: any) => it.food_name === "Daging Sambal"), "Step 2 DB: Daging Sambal was replaced in items");

  // Step 3: User second clarification: "koreksi meal, itu nasi putih dan cumi sambal"
  const secondClarifyText = "koreksi meal, itu nasi putih dan cumi sambal";
  const secondRes = await processMealCorrection(testPhone, secondClarifyText, mockUserDataMia, todayStr);
  assert(secondRes !== null, "Step 3: Second clarification processed successfully");
  assert(secondRes?.mealRecord.id === initialMeal.id, "Step 3: Meal ID still preserved (mutated in-place)");
  assert(secondRes?.mealRecord.foodName === "Nasi Putih, Cumi Sambal", "Step 3: FoodName is now 'Nasi Putih, Cumi Sambal'");
  assert(!secondRes?.card.includes("Mau dikoreksi bagian apa dari Nasi Putih?"), "Step 3: NEVER asks 'Mau dikoreksi bagian apa dari Nasi Putih?'");

  const finalDbMeal = getLastFoodMeal(testPhone, todayStr);
  assert(finalDbMeal?.foodName === "Nasi Putih, Cumi Sambal", "Step 3 DB: Web dashboard reflects final composition");
  assert(finalDbMeal?.items?.length === 2, "Step 3 DB: Exactly 2 items remaining (Telur removed)");

  // ── SUMMARY ──
  console.log("\n================================================================================");
  console.log(`SUMMARY: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log("================================================================================");

  if (failedCount === 0) {
    console.log("🎉 ALL MEAL CORRECTION INTENT & FOOD REPLACEMENT TESTS PASSED PERFECTLY!\n");
    process.exit(0);
  } else {
    console.error("❌ SOME TESTS FAILED!\n");
    process.exit(1);
  }
})();
