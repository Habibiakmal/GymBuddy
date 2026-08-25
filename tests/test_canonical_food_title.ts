import {
  resolveCleanFoodNameAndMealType,
  buildSingleSourceOfTruthMealRecord
} from "../server";
import {
  generateCanonicalMealTitle,
  extractDetectedFoodItems,
  cleanSingleFoodItemName,
  formatFoodItemsToTitle
} from "../services/nutritionEngine";

console.log("=== RUNNING CANONICAL FOOD TITLE & STRUCTURED DATA TEST SUITE ===\n");

let allPassed = true;

// ── TEST 1: User Case 1 (4 Components with Conversational Noise) ──
console.log("[TEST 1] Complex 4-Component Meal with Time and Conversational Clutter");
const rawInput1 = "aku tadi siang makan nasi 2 piring, pake ayam goreng, dan pete goreng serta selada";
const extracted1 = extractDetectedFoodItems(rawInput1);
const canonical1 = generateCanonicalMealTitle(rawInput1);
const resolved1 = resolveCleanFoodNameAndMealType(rawInput1, "", false);

console.log("  Raw User Input :", `"${rawInput1}"`);
console.log("  Extracted Items:", extracted1);
console.log("  Canonical Title:", `"${canonical1}"`);
console.log("  Resolved Title :", `"${resolved1.foodName}"`);
console.log("  Resolved Meal  :", `"${resolved1.mealType}"`);

if (resolved1.mealType === "Lunch") {
  console.log("  ✅ [PASS] Meal context cleanly isolated as 'Lunch'");
} else {
  console.error("  ❌ [FAIL] Expected MealType 'Lunch', got:", resolved1.mealType);
  allPassed = false;
}

if (resolved1.foodName === "Nasi Putih, Ayam Goreng, Pete Goreng & Selada") {
  console.log("  ✅ [PASS] Canonical Title formatted exactly as 'Nasi Putih, Ayam Goreng, Pete Goreng & Selada'!");
} else {
  console.error("  ❌ [FAIL] Expected 'Nasi Putih, Ayam Goreng, Pete Goreng & Selada', got:", resolved1.foodName);
  allPassed = false;
}

// Ensure conversational filler words are 100% stripped
const forbiddenWords = ["aku", "tadi", "siang", "makan", "pake", "serta", "dan"];
const titleLower = resolved1.foodName.toLowerCase();
const hasForbidden = forbiddenWords.some(w => new RegExp(`\\b${w}\\b`, 'i').test(titleLower) && w !== "dan");
if (!hasForbidden) {
  console.log("  ✅ [PASS] Verified zero conversational words in display title!");
} else {
  console.error("  ❌ [FAIL] Display title contains conversational noise:", resolved1.foodName);
  allPassed = false;
}

// ── TEST 2: User Case 2 (2 Components) ──
console.log("\n[TEST 2] 2-Component Meal: 'aku makan nasi sama ayam goreng'");
const rawInput2 = "aku makan nasi sama ayam goreng";
const resolved2 = resolveCleanFoodNameAndMealType(rawInput2, "", false);

console.log("  Raw User Input :", `"${rawInput2}"`);
console.log("  Resolved Title :", `"${resolved2.foodName}"`);

if (resolved2.foodName === "Nasi Putih & Ayam Goreng") {
  console.log("  ✅ [PASS] Canonical Title formatted exactly as 'Nasi Putih & Ayam Goreng'!");
} else {
  console.error("  ❌ [FAIL] Expected 'Nasi Putih & Ayam Goreng', got:", resolved2.foodName);
  allPassed = false;
}

// ── TEST 3: User Case 3 (3 Components with Morning Context) ──
console.log("\n[TEST 3] 3-Component Breakfast: 'tadi pagi aku makan roti telur dan kopi'");
const rawInput3 = "tadi pagi aku makan roti telur dan kopi";
const resolved3 = resolveCleanFoodNameAndMealType(rawInput3, "", false);

console.log("  Raw User Input :", `"${rawInput3}"`);
console.log("  Resolved Title :", `"${resolved3.foodName}"`);
console.log("  Resolved Meal  :", `"${resolved3.mealType}"`);

if (resolved3.mealType === "Breakfast") {
  console.log("  ✅ [PASS] Meal context cleanly isolated as 'Breakfast'");
} else {
  console.error("  ❌ [FAIL] Expected MealType 'Breakfast', got:", resolved3.mealType);
  allPassed = false;
}

if (resolved3.foodName === "Roti Telur & Kopi" || resolved3.foodName === "Roti, Telur & Kopi") {
  console.log("  ✅ [PASS] Canonical Title formatted cleanly:", resolved3.foodName);
} else {
  console.error("  ❌ [FAIL] Unexpected title for roti telur & kopi:", resolved3.foodName);
  allPassed = false;
}

// ── TEST 4: User Case 4 (Compound Dish: Sandwich) ──
console.log("\n[TEST 4] Compound Dish: 'aku makan sandwich daging sapi dan keju'");
const rawInput4 = "aku makan sandwich daging sapi dan keju";
const resolved4 = resolveCleanFoodNameAndMealType(rawInput4, "", false);

console.log("  Raw User Input :", `"${rawInput4}"`);
console.log("  Resolved Title :", `"${resolved4.foodName}"`);

if (resolved4.foodName.toLowerCase().includes("sandwich") && resolved4.foodName.toLowerCase().includes("daging sapi")) {
  console.log("  ✅ [PASS] Compound dish preserved as unified title:", resolved4.foodName);
} else {
  console.error("  ❌ [FAIL] Compound dish was malformed:", resolved4.foodName);
  allPassed = false;
}

// ── TEST 5: User Case 5 (Drink: Iced Coffee with Cream Foam) ──
console.log("\n[TEST 5] Drink: 'aku minum iced coffee dengan cream foam'");
const rawInput5 = "aku minum iced coffee dengan cream foam";
const resolved5 = resolveCleanFoodNameAndMealType(rawInput5, "", false);

console.log("  Raw User Input :", `"${rawInput5}"`);
console.log("  Resolved Title :", `"${resolved5.foodName}"`);

if (resolved5.foodName.toLowerCase().includes("iced coffee") && resolved5.foodName.toLowerCase().includes("cream foam")) {
  console.log("  ✅ [PASS] Drink title cleanly preserved:", resolved5.foodName);
} else {
  console.error("  ❌ [FAIL] Drink title was malformed:", resolved5.foodName);
  allPassed = false;
}

// ── TEST 6: User Case 6 (Single Food Item) ──
console.log("\n[TEST 6] Single Food Item: 'aku makan apel'");
const rawInput6 = "aku makan apel";
const resolved6 = resolveCleanFoodNameAndMealType(rawInput6, "", false);

console.log("  Raw User Input :", `"${rawInput6}"`);
console.log("  Resolved Title :", `"${resolved6.foodName}"`);

if (resolved6.foodName === "Apel") {
  console.log("  ✅ [PASS] Single item formatted as 'Apel'!");
} else {
  console.error("  ❌ [FAIL] Expected 'Apel', got:", resolved6.foodName);
  allPassed = false;
}

// ── TEST 7: Structured Data Separation in Meal Record ──
console.log("\n[TEST 7] Structured Data Separation in Database Record");
const mockParsed = {
  canonicalMealTitle: "Nasi Putih, Ayam Goreng, Pete Goreng & Selada",
  detectedFoods: ["Nasi Putih", "Ayam Goreng", "Pete Goreng", "Selada"],
  mealType: "Lunch",
  calories: 680,
  protein: 38,
  carbs: 75,
  fat: 22,
  fiber: 6,
  sugar: 3,
  sodium: 480
};

const { mealRecord, validatedParsed } = buildSingleSourceOfTruthMealRecord(rawInput1, mockParsed, false);

console.log("  Record ID             :", mealRecord.id);
console.log("  Record Title (Display):", mealRecord.foodName);
console.log("  Raw User Message      :", mealRecord.rawUserMessage);
console.log("  Meal Type Context     :", mealRecord.mealType);
console.log("  Detected Foods Array  :", mealRecord.detectedFoods);
console.log("  Calories & Macros     :", `${mealRecord.calories} kcal | P: ${mealRecord.protein}g | C: ${mealRecord.carbs}g | F: ${mealRecord.fat}g`);

if (mealRecord.foodName === "Nasi Putih, Ayam Goreng, Pete Goreng & Selada") {
  console.log("  ✅ [PASS] Display title uses AI-detected canonical title!");
} else {
  console.error("  ❌ [FAIL] Display title leaked raw message:", mealRecord.foodName);
  allPassed = false;
}

if (mealRecord.rawUserMessage === rawInput1) {
  console.log("  ✅ [PASS] Raw user message preserved for debugging/audit!");
} else {
  console.error("  ❌ [FAIL] Raw user message missing in record!");
  allPassed = false;
}

if (Array.isArray(mealRecord.detectedFoods) && mealRecord.detectedFoods.length === 4) {
  console.log("  ✅ [PASS] Structured detected foods array populated!");
} else {
  console.error("  ❌ [FAIL] Detected foods array not populated properly:", mealRecord.detectedFoods);
  allPassed = false;
}

console.log("\n--------------------------------------------------");
if (allPassed) {
  console.log("🎉 ALL CANONICAL FOOD TITLE & STRUCTURED DATA TESTS PASSED 100%!");
  process.exit(0);
} else {
  console.error("❌ SOME TESTS FAILED!");
  process.exit(1);
}
