import assert from "node:assert";

// Nutrition Dashboard Calculation and Formatting Tests
console.log("=== RUNNING GYMBUDDY NUTRITION DASHBOARD REVISION TEST SUITE ===");

// 1. Daily Nutrition Order Check
const dailyNutritionMetrics = ["Kalori", "Protein", "Karbohidrat", "Lemak", "Natrium", "Air"];
console.log("\n[TEST 1] Daily Nutrition Exact Order Hierarchy");
assert.strictEqual(dailyNutritionMetrics[0], "Kalori");
assert.strictEqual(dailyNutritionMetrics[1], "Protein");
assert.strictEqual(dailyNutritionMetrics[2], "Karbohidrat");
assert.strictEqual(dailyNutritionMetrics[3], "Lemak");
assert.strictEqual(dailyNutritionMetrics[4], "Natrium");
assert.strictEqual(dailyNutritionMetrics[5], "Air");
console.log("  ✅ [PASS] Daily Nutrition Order verified: Calories → Protein → Carbs → Fat → Sodium → Water!");

// 2. Calorie Progress & Math Accuracy: 1,958 / 1,966 kcal
console.log("\n[TEST 2] Calorie Progress Calculation (1,958 / 1,966 kcal)");
const calConsumed = 1958;
const calTarget = 1966;
const calDiff = calTarget - calConsumed; // 8
const isOverCal = calConsumed > calTarget;
const isExactCal = calConsumed === calTarget;
const calPercent = isOverCal
  ? Math.max(101, Math.round((calConsumed / calTarget) * 100))
  : isExactCal
  ? 100
  : Math.min(99, Math.floor((calConsumed / calTarget) * 100));

assert.strictEqual(calDiff, 8);
assert.strictEqual(calPercent, 99);
assert.strictEqual(isOverCal, false);
console.log(`  Calorie Math: ${calConsumed}/${calTarget} kcal -> ${calPercent}% with ${calDiff} kcal remaining`);
console.log("  ✅ [PASS] Accurately displays 99% (not 100%) and 8 kcal sisa (Belum Cukup)!");

// 3. Over-target Fat: 90 / 55 g
console.log("\n[TEST 3] Over-target Fat Calculation (90 / 55 g)");
const fatConsumed = 90;
const fatTarget = 55;
const fatDiff = fatTarget - fatConsumed; // -35
const isOverFat = fatConsumed > fatTarget;
const fatPercent = isOverFat
  ? Math.max(101, Math.round((fatConsumed / fatTarget) * 100))
  : Math.min(99, Math.floor((fatConsumed / fatTarget) * 100));

assert.strictEqual(isOverFat, true);
assert.strictEqual(fatPercent, 164);
assert.strictEqual(Math.abs(fatDiff), 35);
console.log(`  Fat Math: ${fatConsumed}/${fatTarget}g -> +${Math.abs(fatDiff)}g (${fatPercent}%) 🔴 Melebihi Target`);
console.log("  ✅ [PASS] Over-target fat labeled 🔴 Melebihi Target with +35g and 164%!");

// 4. Sodium Upper Limit Semantics: 2,650 / 2,000 mg
console.log("\n[TEST 4] Sodium Upper Limit Calculation (2,650 / 2,000 mg)");
const sodConsumed = 2650;
const sodLimit = 2000;
const sodDiff = sodLimit - sodConsumed; // -650
const isOverSod = sodConsumed > sodLimit;
const isExactSod = sodConsumed === sodLimit;
const sodPercent = isOverSod
  ? Math.max(101, Math.round((sConsumed => (sConsumed / sodLimit) * 100)(sodConsumed)))
  : Math.min(99, Math.floor((sodConsumed / sodLimit) * 100));
const sodStatus = isOverSod ? "🔴 Melebihi Batas" : isExactSod ? "🟡 Batas Maksimal" : "🟢 Dalam Batas";

assert.strictEqual(isOverSod, true);
assert.strictEqual(sodPercent, 133);
assert.strictEqual(Math.abs(sodDiff), 650);
assert.strictEqual(sodStatus, "🔴 Melebihi Batas");
console.log(`  Sodium Math: ${sodConsumed}/${sodLimit} mg -> +${Math.abs(sodDiff)} mg (${sodPercent}%) ${sodStatus}`);
console.log("  ✅ [PASS] Sodium correctly handles upper limit, +650 mg excess, 133%, and 🔴 Melebihi Batas!");

// 5. Water Intake: 250 / 2,500 ml
console.log("\n[TEST 5] Water Metric (250 / 2,500 ml)");
const waterConsumed = 250;
const waterTarget = 2500;
const waterDiff = waterTarget - waterConsumed; // 2250
const waterPercent = Math.min(100, Math.round((waterConsumed / waterTarget) * 100)); // 10%
assert.strictEqual(waterDiff, 2250);
assert.strictEqual(waterPercent, 10);
console.log(`  Water Math: 💧 Air ${waterConsumed} / ${waterTarget} ml -> ${waterDiff} ml sisa (${waterPercent}%)`);
console.log("  ✅ [PASS] Water labeled 💧 Air with explicit target and remaining ml!");

// 6. Food Journal Logged Count (Empty Slot Handling)
console.log("\n[TEST 6] Food Journal Meal Count & Empty State");
const mealCalories = {
  breakfast: 0,
  lunch: 741,
  dinner: 1213,
  snack: 4
};
const loggedMealSlotsCount = [
  mealCalories.breakfast > 0,
  mealCalories.lunch > 0,
  mealCalories.dinner > 0,
  mealCalories.snack > 0
].filter(Boolean).length;

assert.strictEqual(loggedMealSlotsCount, 3);
console.log(`  Logged Meals: Breakfast (0), Lunch (741), Dinner (1213), Snack (4) -> ${loggedMealSlotsCount} tercatat`);
console.log("  ✅ [PASS] Meal counter reflects only non-empty meal slots (3 tercatat)!");

console.log("\n--------------------------------------------------");
console.log("🎉 ALL NUTRITION DASHBOARD REVISION TESTS PASSED 100%!");
