/**
 * GYMBUDDY FOOD AI CONSISTENCY, FOOD IDENTITY & NUTRITION ENGINE
 * AUTOMATED REGRESSION & PROPERTY-BASED TEST SUITE
 * 
 * Covering Sections 31, 32, and 33 of Master Prompt:
 * - Section 31: Regression Dataset (Branded, Indonesian, Western, Snacks, Drinks)
 * - Section 32: Mandatory Regression Cases
 * - Section 33: Property-Based Invariant Tests
 */

import {
  calculateSingleItemNutrition,
  calculateFoodNutrition,
  calculateCompositeNutrition
} from "../services/nutritionEngine";
import {
  resolveCanonicalFoodIdentity,
  evaluateSemanticDatabaseMatch,
  calculateDualConfidence,
  determineCanonicalMealCategory
} from "../services/foodIdentityEngine";

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    if (detail) console.error(`     Detail: ${detail}`);
    failCount++;
  }
}

console.log("==================================================");
console.log("RUNNING MASTER FOOD AI CONSISTENCY TEST SUITE");
console.log("==================================================\n");

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 32: MANDATORY REGRESSION CASES
// ─────────────────────────────────────────────────────────────────────────────
console.log("--- SECTION 32: MANDATORY REGRESSION CASES ---");

// Case 1: "SilverQueen Bites Milk Chocolate" MUST NOT resolve to "Susu Sapi / UHT"
{
  const res = calculateSingleItemNutrition("SilverQueen Bites Milk Chocolate");
  assert(
    !res.resolvedFoodName.toLowerCase().includes("susu") &&
    !res.normalizedName.toLowerCase().includes("susu sapi") &&
    !res.normalizedName.toLowerCase().includes("uht") &&
    res.resolvedFoodName.toLowerCase().includes("silverqueen"),
    "Case 1: SilverQueen Bites Milk Chocolate MUST NOT resolve to 'Susu Sapi / UHT'",
    `Received resolved: "${res.resolvedFoodName}", normalized: "${res.normalizedName}"`
  );
  assert(
    res.isHydration === false,
    "Case 1b: SilverQueen MUST NOT be hydration (isHydration === false)",
    `Received isHydration: ${res.isHydration}`
  );
  assert(
    res.semanticCategory === "snack",
    "Case 1c: SilverQueen MUST be categorized as snack",
    `Received semanticCategory: ${res.semanticCategory}`
  );
}

// Case 2: "ayam gulai dan otak sapi" MUST resolve to Ayam Gulai and Otak Sapi
{
  const res = calculateFoodNutrition("ayam gulai dan otak sapi");
  const componentNames = res.components.map(c => c.resolvedFoodName || c.normalizedName);
  assert(
    res.components.length >= 2,
    "Case 2a: Multi-item combo decomposed into at least 2 components",
    `Decomposed into ${res.components.length} components: [${componentNames.join(", ")}]`
  );
  assert(
    componentNames.some(n => n.toLowerCase().includes("ayam gulai") || n.toLowerCase().includes("gulai ayam")),
    "Case 2b: Contains 'Ayam Gulai' (NOT 'Chicken Meal')",
    `Found components: [${componentNames.join(", ")}]`
  );
  assert(
    componentNames.some(n => n.toLowerCase().includes("otak sapi") || n.toLowerCase().includes("gulai otak")),
    "Case 2c: Contains 'Otak Sapi' (NOT 'Daging Sapi / Rendang')",
    `Found components: [${componentNames.join(", ")}]`
  );
  assert(
    !componentNames.some(n => n.toLowerCase().includes("chicken meal")),
    "Case 2d: DOES NOT contain generic 'Chicken Meal'",
    `Components: [${componentNames.join(", ")}]`
  );
  assert(
    !componentNames.some(n => n.toLowerCase() === "daging sapi / rendang" || n.toLowerCase() === "rendang"),
    "Case 2e: DOES NOT replace Otak Sapi with 'Daging Sapi / Rendang'",
    `Components: [${componentNames.join(", ")}]`
  );
}

// Case 3: "daging sapi" MUST NOT automatically become "Rendang"
{
  const res = calculateSingleItemNutrition("daging sapi");
  assert(
    !res.resolvedFoodName.toLowerCase().includes("rendang"),
    "Case 3: 'daging sapi' MUST NOT automatically become 'Rendang'",
    `Received resolved: "${res.resolvedFoodName}"`
  );
  assert(
    res.resolvedFoodName === "Daging Sapi",
    "Case 3b: 'daging sapi' resolved name is 'Daging Sapi'",
    `Received: "${res.resolvedFoodName}"`
  );
}

// Case 4: "ayam" MUST NOT automatically become "Chicken Breast"
{
  const res = calculateSingleItemNutrition("ayam");
  assert(
    !res.resolvedFoodName.toLowerCase().includes("dada") &&
    !res.resolvedFoodName.toLowerCase().includes("breast"),
    "Case 4: 'ayam' MUST NOT automatically become 'Chicken Breast' / 'Dada Ayam'",
    `Received resolved: "${res.resolvedFoodName}"`
  );
  assert(
    res.resolvedFoodName === "Ayam",
    "Case 4b: 'ayam' resolved name is 'Ayam'",
    `Received: "${res.resolvedFoodName}"`
  );
}

// Case 5: "kopi susu" MUST NOT become Air / Hydration
{
  const res = calculateSingleItemNutrition("kopi susu");
  assert(
    res.isHydration === false,
    "Case 5: 'kopi susu' MUST NOT be hydration (isHydration === false)",
    `Received isHydration: ${res.isHydration}`
  );
  assert(
    res.calories > 0,
    "Case 5b: 'kopi susu' has macro calories (not 0 kcal water)",
    `Received calories: ${res.calories} kcal`
  );
}

// Case 6: "air putih 250 ml" May become hydration ONLY when logged as hydration
{
  const res = calculateSingleItemNutrition("air putih 250 ml");
  assert(
    res.isHydration === true,
    "Case 6: 'air putih 250 ml' is recognized as pure water hydration",
    `Received isHydration: ${res.isHydration}`
  );
  assert(
    res.calories === 0,
    "Case 6b: Pure water has 0 calories",
    `Received calories: ${res.calories}`
  );
}

// Case 7: "SilverQueen 250g" MUST remain meal, NOT 250ml hydration
{
  const res = calculateSingleItemNutrition("SilverQueen 250g");
  assert(
    res.isHydration === false,
    "Case 7: 'SilverQueen 250g' MUST remain meal (isHydration === false)",
    `Received isHydration: ${res.isHydration}`
  );
  assert(
    res.actualUnit === "g",
    "Case 7b: 'SilverQueen 250g' portion unit MUST remain 'g', NOT 'ml'",
    `Received unit: ${res.actualUnit}`
  );
  assert(
    res.actualAmount === 250,
    "Case 7c: Portion weight is preserved as 250g",
    `Received actualAmount: ${res.actualAmount}`
  );
  assert(
    res.volumeMl === undefined || res.volumeMl === 0,
    "Case 7d: Volume in ml MUST NOT be populated for solid food",
    `Received volumeMl: ${res.volumeMl}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 31: REGRESSION DATASET
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n--- SECTION 31: REGRESSION DATASET ---");

// A. BRANDED PRODUCTS
console.log("\n  [A. Branded Products]");
const brandedCases = [
  { input: "SilverQueen Bites Milk Chocolate", expectNamePart: "silverqueen", expectSnack: true },
  { input: "Oreo", expectNamePart: "oreo", expectSnack: true },
  { input: "Chitato", expectNamePart: "chitato", expectSnack: true },
  { input: "Chiki", expectNamePart: "chiki", expectSnack: true },
  { input: "Indomie", expectNamePart: "indomie", expectSnack: false }
];

for (const bCase of brandedCases) {
  const res = calculateSingleItemNutrition(bCase.input);
  assert(
    res.resolvedFoodName.toLowerCase().includes(bCase.expectNamePart),
    `Brand preserved: "${bCase.input}" -> "${res.resolvedFoodName}"`,
    `Expected "${bCase.expectNamePart}" in "${res.resolvedFoodName}"`
  );
  assert(
    res.isHydration === false,
    `Brand item is NOT hydration: "${bCase.input}"`,
    `isHydration: ${res.isHydration}`
  );
  if (bCase.expectSnack) {
    assert(
      res.semanticCategory === "snack",
      `Brand item categorized as snack: "${bCase.input}"`,
      `semanticCategory: ${res.semanticCategory}`
    );
  }
}

// B. INDONESIAN DISHES
console.log("\n  [B. Indonesian Dishes]");
const indoCases = [
  { input: "Ayam Gulai", forbidden: "chicken meal", expectedPart: "ayam gulai" },
  { input: "Gulai Ayam", forbidden: "chicken meal", expectedPart: "gulai ayam" },
  { input: "Rendang", forbidden: "chicken", expectedPart: "rendang" },
  { input: "Nasi Padang", forbidden: "white rice", expectedPart: "nasi padang" },
  { input: "Nasi Goreng", forbidden: "pasta", expectedPart: "nasi goreng" },
  { input: "Soto Ayam", forbidden: "soup bowl", expectedPart: "soto ayam" },
  { input: "Bakso", forbidden: "noodle", expectedPart: "bakso" },
  { input: "Rawon", forbidden: "curry", expectedPart: "rawon" },
  { input: "Otak Sapi", forbidden: "rendang", expectedPart: "otak sapi" },
  { input: "Cumi Goreng Tepung", forbidden: "chicken", expectedPart: "cumi" },
  { input: "Tumis Kangkung", forbidden: "chicken", expectedPart: "kangkung" }
];

for (const iCase of indoCases) {
  const res = calculateSingleItemNutrition(iCase.input);
  assert(
    !res.resolvedFoodName.toLowerCase().includes(iCase.forbidden) &&
    !res.normalizedName.toLowerCase().includes(iCase.forbidden),
    `Indo food identity preserved: "${iCase.input}" does NOT contain "${iCase.forbidden}"`,
    `Resolved: "${res.resolvedFoodName}", Normalized: "${res.normalizedName}"`
  );
  assert(
    res.resolvedFoodName.toLowerCase().includes(iCase.expectedPart.toLowerCase()) ||
    res.normalizedName.toLowerCase().includes(iCase.expectedPart.toLowerCase()),
    `Indo food matches concept: "${iCase.input}" -> contains "${iCase.expectedPart}"`,
    `Resolved: "${res.resolvedFoodName}"`
  );
}

// C. WESTERN FOOD
console.log("\n  [C. Western Food]");
const westernCases = ["Burger", "Pizza", "Pasta", "Chicken Sandwich", "Steak"];
for (const wCase of westernCases) {
  const res = calculateSingleItemNutrition(wCase);
  assert(
    res.resolvedFoodName.toLowerCase().includes(wCase.toLowerCase()),
    `Western dish recognized: "${wCase}" -> "${res.resolvedFoodName}"`,
    `Resolved: "${res.resolvedFoodName}"`
  );
  assert(
    res.calories > 0,
    `Western dish has realistic calories: "${wCase}" (${res.calories} kcal)`,
    `Calories: ${res.calories}`
  );
}

// D. SNACKS
console.log("\n  [D. Snacks as First-Class Category]");
const snackCases = ["Cookies", "Chocolate", "Chips", "Crackers", "Fruit", "Yogurt", "Nuts"];
for (const sCase of snackCases) {
  const res = calculateSingleItemNutrition(sCase);
  const cat = determineCanonicalMealCategory("", resolveCanonicalFoodIdentity(sCase), new Date("2026-09-06T13:00:00Z")); // 13:00 would normally be lunch!
  assert(
    cat === "SNACK" || res.semanticCategory === "snack",
    `Snack "${sCase}" at 13:00 is classified as SNACK (first-class snack rule)`,
    `Meal category: "${cat}", Semantic: "${res.semanticCategory}"`
  );
}

// E. DRINKS
console.log("\n  [E. Drinks & Pure Water Isolation]");
const drinkCases = [
  { input: "Air Putih", expectHydration: true },
  { input: "Kopi", expectHydration: false },
  { input: "Kopi Susu", expectHydration: false },
  { input: "Teh", expectHydration: false },
  { input: "Juice", expectHydration: false },
  { input: "Milk", expectHydration: false }
];

for (const dCase of drinkCases) {
  const res = calculateSingleItemNutrition(dCase.input);
  assert(
    res.isHydration === dCase.expectHydration,
    `Drink "${dCase.input}" hydration check: isHydration === ${dCase.expectHydration}`,
    `Received isHydration: ${res.isHydration}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 33: PROPERTY-BASED INVARIANT TESTS
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n--- SECTION 33: PROPERTY-BASED INVARIANT TESTS ---");

// Invariant 1 & 2: Record Type Segregation
{
  const mealItems = ["Ayam Gulai", "Nasi Padang", "SilverQueen", "Kopi Susu", "Pizza", "Indomie"];
  for (const item of mealItems) {
    const res = calculateSingleItemNutrition(item);
    assert(
      res.isHydration === false,
      `Invariant 1: For meal "${item}", isHydration MUST be false`,
      `isHydration: ${res.isHydration}`
    );
  }

  const waterItems = ["Air Putih", "Air Mineral", "plain water"];
  for (const item of waterItems) {
    const res = calculateSingleItemNutrition(item);
    assert(
      res.isHydration === true,
      `Invariant 2: For pure water "${item}", isHydration MUST be true`,
      `isHydration: ${res.isHydration}`
    );
  }
}

// Invariant 3 & 4: Food Identity Sacredness & Database Match Never Overwrites Display Name
{
  const sampleInputs = [
    "Ayam Gulai",
    "Otak Sapi",
    "SilverQueen Bites Milk Chocolate",
    "Tumis Kangkung",
    "Cumi Goreng Tepung",
    "Chiki",
    "Chitato Sapi Panggang"
  ];

  for (const input of sampleInputs) {
    const res = calculateSingleItemNutrition(input);
    const identity = resolveCanonicalFoodIdentity(input);
    assert(
      res.resolvedFoodName.toLowerCase() === identity.resolvedFoodName.toLowerCase(),
      `Invariant 3: resolvedFoodName preserves user identity for "${input}"`,
      `Expected: "${identity.resolvedFoodName}", Got: "${res.resolvedFoodName}"`
    );
  }
}

// Invariant 5: Portions in grams MUST NOT become milliliters
{
  const solidPortions = ["Ayam 150g", "SilverQueen 45g", "Nasi 200g", "Otak Sapi 100g"];
  for (const p of solidPortions) {
    const res = calculateSingleItemNutrition(p);
    assert(
      res.actualUnit === "g" && (res.volumeMl === undefined || res.volumeMl === 0),
      `Invariant 5: "${p}" has actualUnit 'g' and volumeMl is undefined/0`,
      `actualUnit: ${res.actualUnit}, volumeMl: ${res.volumeMl}`
    );
  }
}

// Invariant 6: Low confidence or mismatch requires review
{
  const unknownObj = calculateSingleItemNutrition("makanan aneh antah berantah xyz99");
  assert(
    unknownObj.requiresReview === true,
    "Invariant 6: Unknown / low confidence food requires review",
    `requiresReview: ${unknownObj.requiresReview}`
  );
}

// Summary
console.log("\n==================================================");
console.log(`TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
console.log("==================================================");

if (failCount > 0) {
  process.exit(1);
} else {
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!\n");
}
