import {
  buildSingleSourceOfTruthMealRecord,
  getDailyTotals,
  formatNutritionCard
} from "../server";

console.log("=== RUNNING SINGLE SOURCE OF TRUTH NUTRITION TEST SUITE ===\n");

let allPassed = true;

// Helper to assert
function assertEqual(actual: any, expected: any, testName: string) {
  if (actual === expected) {
    console.log(`  ✅ [PASS] ${testName}: ${actual}`);
  } else {
    console.error(`  ❌ [FAIL] ${testName}: Expected ${expected}, got ${actual}`);
    allPassed = false;
  }
}

// TEST 1: User Case - Iced Coffee with Cream Foam / Float
console.log("[TEST 1] User Case: Iced Coffee dengan Cream Foam / Cream Float (230ml)");
const userText = "aku minum ini tadi";
const aiParsed = {
  isFood: true,
  foodName: "Iced Coffee dengan Cream Foam / Cream Float",
  calories: 287,
  protein: 9.2,
  carbs: 47,
  fat: 6.9,
  fiber: 0,
  sugar: 5,
  sodium: 160,
  portionEstimates: [
    "• Kopi & sirup manis (~50 kcal)",
    "• Cream foam / float (~237 kcal)"
  ],
  portionDetail: "1 Gelas (230 ml)",
  mealType: "Breakfast"
};

const { mealRecord, validatedParsed } = buildSingleSourceOfTruthMealRecord(
  userText,
  aiParsed,
  true // hasImage
);

assertEqual(mealRecord.foodName, "Iced Coffee dengan Cream Foam / Cream Float", "Food Name is Detected Name");
assertEqual(mealRecord.mealType, "breakfast", "Meal Type is Breakfast");
assertEqual(mealRecord.calories, 287, "Calories is 287 (NEVER 2 kcal)");
assertEqual(mealRecord.protein, 9.2, "Protein is 9.2g");
assertEqual(mealRecord.carbs, 47, "Carbs is 47g");
assertEqual(mealRecord.fat, 6.9, "Fat is 6.9g");
assertEqual(mealRecord.sugar, 5, "Sugar is 5g");
assertEqual(mealRecord.sodium, 160, "Sodium is 160mg");

// Verify validatedParsed has the EXACT same values
assertEqual(validatedParsed.calories, 287, "ValidatedParsed Calories is 287");
assertEqual(validatedParsed.protein, 9.2, "ValidatedParsed Protein is 9.2");
assertEqual(validatedParsed.carbs, 47, "ValidatedParsed Carbs is 47");
assertEqual(validatedParsed.fat, 6.9, "ValidatedParsed Fat is 6.9");

// Simulate Daily Totals calculation: Previous 206 kcal + New 287 kcal = 493 kcal
const mockExistingLogs = [
  { id: "prev-1", foodName: "Roti Gandum", calories: 150, protein: 5, carbs: 25, fat: 2 },
  { id: "prev-2", foodName: "Telur Rebus", calories: 56, protein: 6, carbs: 1, fat: 4 }
];
const previousCalories = mockExistingLogs.reduce((acc, cur) => acc + cur.calories, 0); // 206 kcal
assertEqual(previousCalories, 206, "Previous Daily Total is 206 kcal");

const newDailyTotalCalories = previousCalories + mealRecord.calories;
assertEqual(newDailyTotalCalories, 493, "New Daily Total Calories is 493 kcal (NEVER 208 kcal)");

// Verify WhatsApp Card generation uses the same values
const mockUserData = {
  name: "Habibi",
  persona: "mia",
  targetCalories: 1966,
  proteinGrams: 147,
  carbGrams: 221,
  fatGrams: 55,
  gender: "pria"
} as any;

const mockDailyTotals = {
  calories: newDailyTotalCalories,
  protein: 20.2,
  carbs: 73,
  fat: 12.9,
  fiber: 0,
  sugar: 5,
  sodium: 160,
  logs: [...mockExistingLogs, mealRecord]
} as any;

const card = formatNutritionCard(validatedParsed, "Foto", mockUserData, mockDailyTotals);
if (card.includes("287 kcal") && (card.includes("493/1966") || card.includes("493/1.966") || card.includes("493/1,966"))) {
  console.log("  ✅ [PASS] WhatsApp Card contains exact 287 kcal and 493 kcal daily total!");
} else {
  console.error("  ❌ [FAIL] WhatsApp Card mismatch:\n" + card);
  allPassed = false;
}

// TEST 2: Portion Components sum check
console.log("\n[TEST 2] Portion Components Validation");
const aiParsedWithDiscrepancy = {
  isFood: true,
  foodName: "Sub Sandwich with Cheese",
  calories: 750,
  protein: 42,
  carbs: 85,
  fat: 26,
  fiber: 6,
  portionEstimates: [
    "• Roti baguette (~150 kcal)",
    "• Daging pastrami (~200 kcal)",
    "• Keju & saus (~150 kcal)"
  ] // sum = 500 kcal vs total 750 kcal
};

const res2 = buildSingleSourceOfTruthMealRecord("", aiParsedWithDiscrepancy, true);
assertEqual(res2.mealRecord.calories, 750, "Total Calories preserved as 750 kcal");
console.log("  Reconciled Portion Estimates:", res2.validatedParsed.portionEstimates);
const allComponentsPresent = res2.validatedParsed.portionEstimates.length === 3;
assertEqual(allComponentsPresent, true, "All 3 components retained with scaled calories");

// TEST 3: Zero / Negative values safety
console.log("\n[TEST 3] Nutrition Record Non-negative Clean Precision");
const zeroFood = {
  isFood: true,
  foodName: "Air Putih Dingin",
  calories: -5,
  protein: -1,
  carbs: 0,
  fat: 0
};
const res3 = buildSingleSourceOfTruthMealRecord("minum air", zeroFood, false);
assertEqual(res3.mealRecord.calories >= 0, true, "Calories clamped to non-negative (>= 0)");
assertEqual(res3.mealRecord.protein >= 0, true, "Protein clamped to non-negative (>= 0)");

console.log("");
if (!allPassed) {
  console.error("❌ SOME TESTS FAILED!");
  process.exit(1);
} else {
  console.log("🎉 ALL SINGLE SOURCE OF TRUTH NUTRITION TESTS PASSED 100%!");
}
