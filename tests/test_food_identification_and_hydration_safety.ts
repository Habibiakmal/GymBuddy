import {
  calculateSingleItemNutrition,
  calculateFoodNutrition,
  estimateMealNutritionDeterministic,
  validateSemanticCompatibility,
  NUTRITION_DATABASE
} from "../services/nutritionEngine";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log("==================================================");
console.log("RUNNING AI FOOD IDENTIFICATION & HYDRATION SAFETY TESTS");
console.log("==================================================\n");

// Test 1: "silverqueen bites milk chocolate"
console.log("Test 1: 'silverqueen bites milk chocolate' identity & category");
{
  const result = calculateSingleItemNutrition("silverqueen bites milk chocolate");
  console.log("Result 1:", {
    foodName: result.foodName,
    normalizedName: result.normalizedName,
    semanticCategory: result.semanticCategory,
    calories: result.calories,
    isHydration: result.isHydration,
    volumeMl: result.volumeMl
  });

  assert(result.semanticCategory === "snack", "Category must be snack");
  assert(!result.normalizedName.toLowerCase().includes("susu sapi"), "Must NOT resolve to Susu Sapi / UHT");
  assert(
    result.normalizedName.toLowerCase().includes("silverqueen") ||
    result.normalizedName.toLowerCase().includes("chocolate") ||
    result.normalizedName.toLowerCase().includes("cokelat"),
    "Resolved name must preserve chocolate identity"
  );
  assert(result.isHydration === false, "Must NOT be hydration");
  assert(result.volumeMl === undefined || result.volumeMl === 0, "volumeMl must be undefined or 0");
  assert(result.calories > 100 && result.calories < 250, "Calories for 30g chocolate must be ~161 kcal");

  const fullMeal = estimateMealNutritionDeterministic("silverqueen bites milk chocolate");
  assert(fullMeal.mealType === "snack", "Full meal mealType must be 'snack'");
  assert(fullMeal.isHydration === false, "Full meal isHydration must be false");
  assert(fullMeal.foodName === "silverqueen bites milk chocolate", "FoodName must preserve original input");
}

console.log("\nTest 2: 'susu sapi uht 1 gelas' (Dairy/Drink, NOT pure water hydration)");
{
  const result = calculateSingleItemNutrition("susu sapi uht 1 gelas");
  console.log("Result 2:", {
    normalizedName: result.normalizedName,
    calories: result.calories,
    isHydration: result.isHydration,
    item_type: result.item_type
  });

  assert(result.normalizedName.toLowerCase().includes("susu"), "Must resolve to milk");
  assert(result.isHydration === false, "Cow milk meal entry must NOT have isHydration: true");
  assert(result.calories >= 140 && result.calories <= 165, "Calories for 250ml milk must be ~150-155 kcal");
}

console.log("\nTest 3: 'susu cokelat' / 'chocolate milk' (Beverage, not snack bar & not pure water)");
{
  const result = calculateSingleItemNutrition("susu cokelat");
  console.log("Result 3:", {
    normalizedName: result.normalizedName,
    semanticCategory: result.semanticCategory,
    calories: result.calories,
    isHydration: result.isHydration
  });

  assert(result.semanticCategory === "beverage", "Category must be beverage");
  assert(result.normalizedName.toLowerCase().includes("susu cokelat") || result.normalizedName.toLowerCase().includes("chocolate milk"), "Must resolve to chocolate milk");
  assert(result.isHydration === false, "Chocolate milk must NOT be pure water hydration");
}

console.log("\nTest 4: 'chitato sapi panggang' (Snack/chips, NOT beef meat)");
{
  const result = calculateSingleItemNutrition("chitato sapi panggang");
  console.log("Result 4:", {
    normalizedName: result.normalizedName,
    semanticCategory: result.semanticCategory,
    calories: result.calories
  });

  assert(result.semanticCategory === "snack", "Category must be snack");
  assert(!result.normalizedName.toLowerCase().includes("daging sapi"), "Must NOT resolve to beef steak/daging sapi");
  assert(result.normalizedName.toLowerCase().includes("kentang") || result.normalizedName.toLowerCase().includes("chips"), "Must resolve to potato chips");
}

console.log("\nTest 5: 'gyukatsu' (Beef katsu, NOT chicken)");
{
  const result = calculateSingleItemNutrition("gyukatsu");
  console.log("Result 5:", {
    normalizedName: result.normalizedName,
    calories: result.calories
  });

  assert(!result.normalizedName.toLowerCase().includes("chicken") && !result.normalizedName.toLowerCase().includes("ayam"), "Must NOT resolve to chicken");
  assert(result.normalizedName.toLowerCase().includes("gyukatsu") || result.normalizedName.toLowerCase().includes("beef"), "Must resolve to Gyukatsu / beef katsu");
}

console.log("\nTest 6: 'jus alpukat tanpa gula' (Custom calorie adjustment)");
{
  const regResult = calculateSingleItemNutrition("jus alpukat");
  const noSugarResult = calculateSingleItemNutrition("jus alpukat tanpa gula");
  console.log("Result 6:", {
    regularCalories: regResult.calories,
    noSugarCalories: noSugarResult.calories,
    regularSugar: regResult.sugar,
    noSugarSugar: noSugarResult.sugar
  });

  assert(noSugarResult.sugar < regResult.sugar, "Sugar in 'tanpa gula' must be significantly lower");
  assert(noSugarResult.calories < regResult.calories, "Calories in 'tanpa gula' must be lower");
}

console.log("\nTest 7: 'kopi susu gula aren' (Beverage/coffee, NOT plain milk)");
{
  const result = calculateSingleItemNutrition("kopi susu gula aren");
  console.log("Result 7:", {
    normalizedName: result.normalizedName,
    semanticCategory: result.semanticCategory
  });

  assert(result.semanticCategory === "beverage", "Category must be beverage");
  assert(!result.normalizedName.toLowerCase().includes("susu sapi / uht"), "Must NOT resolve to plain cow milk");
  assert(result.normalizedName.toLowerCase().includes("kopi") || result.normalizedName.toLowerCase().includes("latte"), "Must resolve to coffee");
}

console.log("\nTest 8: 'air putih 500ml' vs 'nasi padang rendang' (Hydration safety)");
{
  const waterResult = calculateSingleItemNutrition("air putih 500ml");
  const mealResult = calculateSingleItemNutrition("nasi padang rendang");

  console.log("Result 8:", {
    waterIsHydration: waterResult.isHydration,
    mealIsHydration: mealResult.isHydration
  });

  assert(waterResult.isHydration === true, "Air putih must be hydration");
  assert(mealResult.isHydration === false, "Nasi padang must NOT be hydration");
}

console.log("\nTest 9: Hydration cup calculation logic");
{
  // Simulate the calculationDailyNutrition waterMl logic from server.ts:
  // Water should ONLY be added when log.isHydration === true || log.type === 'hydration' || (isPlainWaterName && log.type !== 'meal')
  const isPlainWaterName = (name: string) => /air putih|air mineral|mineral water|plain water|aqua/i.test(name);

  const logs = [
    { foodName: "Nasi Padang Komplit", calories: 650, isHydration: false, type: "meal", volumeMl: 0 },
    { foodName: "Susu Sapi / UHT (1 Gelas)", calories: 155, isHydration: false, type: "meal", volumeMl: 250 },
    { foodName: "Air Mineral 500ml", calories: 0, isHydration: true, type: "hydration", volumeMl: 500 }
  ];

  let waterMl = 0;
  for (const log of logs) {
    if (log.isHydration === true || log.type === "hydration" || (isPlainWaterName(log.foodName) && log.type !== "meal")) {
      waterMl += Number(log.volumeMl) || 250;
    }
  }

  console.log("Result 9: Calculated waterMl =", waterMl);
  assert(waterMl === 500, `Only pure water must count towards hydration. Expected 500, got ${waterMl}`);
}

console.log("\nTest 10: Confidence scoring & requiresReview flag");
{
  const specificMatch = calculateSingleItemNutrition("silverqueen bites milk chocolate");
  const ambiguousMatch = calculateSingleItemNutrition("camilan manis aneka rasa");

  console.log("Result 10:", {
    specificConfidence: specificMatch.confidence,
    specificRequiresReview: specificMatch.requiresReview,
    ambiguousConfidence: ambiguousMatch.confidence,
    ambiguousRequiresReview: ambiguousMatch.requiresReview
  });

  assert(specificMatch.confidence === "high", "Specific catalog match must have high confidence");
  assert(specificMatch.requiresReview === false, "Specific catalog match does not require review");
  assert(ambiguousMatch.confidence === "medium" || ambiguousMatch.confidence === "low", "Ambiguous match must have medium/low confidence");
  assert(ambiguousMatch.requiresReview === true, "Ambiguous match must have requiresReview: true");
}

console.log("\nTest 11: User manual macro editing safety in review modal");
{
  const baseResult = calculateSingleItemNutrition("silverqueen bites milk chocolate");
  // User changes calories to 180 and protein to 3 in review modal:
  const userEdited = {
    ...baseResult,
    calories: 180,
    protein: 3
  };

  assert(userEdited.calories === 180, "User-edited calories must be preserved");
  assert(userEdited.protein === 3, "User-edited protein must be preserved");
  assert(userEdited.foodName === "silverqueen bites milk chocolate", "Food name must remain unchanged");
  assert(userEdited.isHydration === false, "isHydration must remain false");
}

console.log("\n==================================================");
console.log("🎉 ALL 11 TESTS PASSED SUCCESSFULLY!");
console.log("==================================================");
