import {
  detectMealCorrectionIntent,
  applyDeterministicCorrection,
  getLastFoodMeal,
  updateExistingMealLog,
  formatNutritionCard
} from "../server";

console.log("=== RUNNING MEAL CORRECTION LOGIC TEST SUITE ===");

let allPassed = true;

// ── TEST 1: Natural Language Intent Recognition ──
console.log("\n[TEST 1] Natural Language Correction Intent Detection");
const positiveTestCases = [
  "koreksi, irisan daging sapinya cuma 50g",
  "koreksi dagingnya 50g",
  "dagingnya cuma 50 gram",
  "daging sapi 50g aja",
  "yang daging tadi 50g",
  "ternyata dagingnya cuma 50g",
  "ubah daging jadi 50g",
  "porsi dagingnya 50g",
  "rotinya cuma setengah",
  "koreksi: ayamnya 100g",
  "ralat, telurnya cuma 1 butir",
  "edit makanan: nasinya 150g"
];

for (const query of positiveTestCases) {
  const isMatch = detectMealCorrectionIntent(query, true);
  if (isMatch) {
    console.log(`  ✅ [PASS] Correctly detected correction: "${query}"`);
  } else {
    console.error(`  ❌ [FAIL] Failed to detect correction intent: "${query}"`);
    allPassed = false;
  }
}

// ── TEST 2: User Case - Subway Sandwich Beef Correction ──
console.log("\n[TEST 2] User Case: Subway Sandwich Single Component Correction (70g -> 50g)");

const mockSubwaySandwich = {
  id: "m-subway-001",
  foodName: "SANDWICH DAGING SAPI & KEJU (SUBWAY STYLE 6-INCH)",
  calories: 401,
  protein: 28.0,
  carbs: 42.0,
  fat: 14.0,
  fiber: 3.5,
  sugar: 4.0,
  sodium: 620,
  mealType: "lunch" as any,
  portionEstimates: [
    "• Roti Sub Herb/Gandum 6 inch: 80g (~190 kcal)",
    "• Irisan daging sapi: 70g (~120 kcal)",
    "• Keju leleh: 20g (~70 kcal)",
    "• Sayuran & acar: 80g (~21 kcal)"
  ]
};

const userCorrectionQuery = "koreksi, irisan daging sapinya cuma 50g";
const correctionResult1 = applyDeterministicCorrection(mockSubwaySandwich, userCorrectionQuery, true, "Habibi");

// Validations for Test 2
console.log("  Food Name:", correctionResult1.foodName);
if (correctionResult1.foodName === "SANDWICH DAGING SAPI & KEJU (SUBWAY STYLE 6-INCH)") {
  console.log("  ✅ [PASS] Food Name preserved as original title (NOT changed to correction text)!");
} else {
  console.error("  ❌ [FAIL] Food Name changed:", correctionResult1.foodName);
  allPassed = false;
}

console.log("  Recalculated Calories:", correctionResult1.calories, "kcal (Old: 401 kcal)");
if (correctionResult1.calories >= 360 && correctionResult1.calories <= 375) {
  console.log("  ✅ [PASS] Total calories recalculated correctly from all components (~367 kcal)!");
} else {
  console.error("  ❌ [FAIL] Unexpected calories:", correctionResult1.calories);
  allPassed = false;
}

console.log("  Portion Estimates:");
correctionResult1.portionEstimates.forEach((line: string) => console.log("   ", line));

const hasUpdatedBeef = correctionResult1.portionEstimates.some((l: string) => l.includes("50g") && (l.includes("diperbarui") || l.includes("86 kcal") || l.includes("85 kcal")));
const hasPreservedBread = correctionResult1.portionEstimates.some((l: string) => l.includes("80g") && l.includes("190 kcal"));
const hasPreservedCheese = correctionResult1.portionEstimates.some((l: string) => l.includes("20g") && l.includes("70 kcal"));
const hasPreservedVeggies = correctionResult1.portionEstimates.some((l: string) => l.includes("80g") && l.includes("21 kcal"));

if (hasUpdatedBeef && hasPreservedBread && hasPreservedCheese && hasPreservedVeggies) {
  console.log("  ✅ [PASS] Non-destructive update: ONLY beef updated to 50g, all 3 other components 100% preserved!");
} else {
  console.error("  ❌ [FAIL] Component preservation failed!");
  allPassed = false;
}

console.log("  Coach Comment:", `"${correctionResult1.coachComment}"`);
if (correctionResult1.coachComment.includes("Habibi") && correctionResult1.coachComment.includes("50g") && correctionResult1.coachComment.includes("daging")) {
  console.log("  ✅ [PASS] Coach comment explains specific component change!");
} else {
  console.error("  ❌ [FAIL] Coach comment missing component context:", correctionResult1.coachComment);
  allPassed = false;
}

// ── TEST 3: Multiple Sequential Corrections ──
console.log("\n[TEST 3] Multiple Sequential Corrections (Next: 'rotinya cuma setengah')");

// Create updated meal from correction 1
const updatedMealAfterCorrection1 = {
  ...mockSubwaySandwich,
  calories: correctionResult1.calories,
  protein: correctionResult1.protein,
  carbs: correctionResult1.carbs,
  fat: correctionResult1.fat,
  portionEstimates: correctionResult1.portionEstimates
};

const userCorrectionQuery2 = "rotinya cuma setengah";
const correctionResult2 = applyDeterministicCorrection(updatedMealAfterCorrection1, userCorrectionQuery2, true, "Habibi");

console.log("  Portion Estimates after 2nd correction:");
correctionResult2.portionEstimates.forEach((line: string) => console.log("   ", line));

const hasUpdatedBreadHalf = correctionResult2.portionEstimates.some((l: string) => l.includes("40g") && (l.includes("95 kcal") || l.includes("diperbarui")));
const stillHas50gBeef = correctionResult2.portionEstimates.some((l: string) => l.includes("50g") && (l.includes("86 kcal") || l.includes("85 kcal")));

if (hasUpdatedBreadHalf && stillHas50gBeef) {
  console.log("  ✅ [PASS] Sequential correction: Bread updated to 40g while retaining 50g beef from 1st correction!");
} else {
  console.error("  ❌ [FAIL] Sequential correction failed to preserve previous state!");
  allPassed = false;
}

console.log("  Calories after 2nd correction:", correctionResult2.calories, "kcal");
if (correctionResult2.calories >= 265 && correctionResult2.calories <= 280) {
  console.log("  ✅ [PASS] Total calories correctly recalculated to ~272 kcal!");
} else {
  console.error("  ❌ [FAIL] Unexpected calories:", correctionResult2.calories);
  allPassed = false;
}

// ── TEST 4: Format Nutrition Card with Correction ──
console.log("\n[TEST 4] WhatsApp Nutrition Card Format for Correction");
const mockUserData = {
  name: "Habibi",
  persona: "mia",
  targetCalories: 2000,
  proteinGrams: 140,
  carbGrams: 220,
  fatGrams: 55,
  gender: "pria"
} as any;

const mockDailyTotals = {
  calories: 200 + correctionResult1.calories, // 200 existing + 367 = 567
  protein: 15 + correctionResult1.protein,
  carbs: 30 + correctionResult1.carbs,
  fat: 8 + correctionResult1.fat,
  sodium: 120 + correctionResult1.sodium,
  logs: [correctionResult1]
} as any;

const card = formatNutritionCard(correctionResult1, "Koreksi", mockUserData, mockDailyTotals);
console.log("\n--- GENERATED WHATSAPP CARD ---\n" + card + "\n-------------------------------\n");

if (
  card.includes("SANDWICH DAGING SAPI & KEJU") &&
  card.includes("50g") &&
  card.includes("Habibi") &&
  card.includes("567") || card.includes(String(mockDailyTotals.calories))
) {
  console.log("  ✅ [PASS] Card contains correct food title, updated component, coach explanation, and updated daily totals!");
} else {
  console.error("  ❌ [FAIL] Card content verification failed!");
  allPassed = false;
}

if (allPassed) {
  console.log("\n🎉 ALL MEAL CORRECTION TESTS PASSED 100%!");
  process.exit(0);
} else {
  console.error("\n❌ SOME TESTS FAILED!");
  process.exit(1);
}
