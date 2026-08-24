import {
  calculateSingleItemNutrition,
  calculateCompositeNutrition,
  calculateFoodNutrition,
  validateNutrientSanity,
  normalizePortion
} from "../services/nutritionEngine";

console.log("=== RUNNING SUGAR ACCURACY & VALIDATION TEST SUITE ===");

let passedTests = 0;
let totalTests = 0;

function assertEqual(testName: string, actual: any, expected: any) {
  totalTests++;
  if (actual === expected) {
    console.log(`✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${testName} -> Expected: ${expected}, Actual: ${actual}`);
    process.exitCode = 1;
  }
}

// TEST S1: 10g sugar / 100g * 100g portion -> 10g
const ratioS1 = normalizePortion(100, "g", 100, "g");
const sugarS1 = Math.round(10 * ratioS1 * 10) / 10;
assertEqual("TEST S1: Sugar 100g portion", sugarS1, 10);

// TEST S2: 10g sugar / 100g * 250g portion -> 25g
const ratioS2 = normalizePortion(250, "g", 100, "g");
const sugarS2 = Math.round(10 * ratioS2 * 10) / 10;
assertEqual("TEST S2: Sugar 250g portion", sugarS2, 25);

// TEST S3: Carbs 50g, Sugar 10g -> VALID
const sanityS3 = validateNutrientSanity({ carbs: 50, sugar: 10, calories: 240, protein: 5, fat: 2 });
assertEqual("TEST S3: Carbs 50g Sugar 10g is Valid", sanityS3.isValid, true);
assertEqual("TEST S3: Errors count", sanityS3.errors.length, 0);

// TEST S4: Carbs 10g, Sugar 20g -> INVALID (must NOT silently modify)
const sanityS4 = validateNutrientSanity({ carbs: 10, sugar: 20, calories: 120, protein: 2, fat: 1 });
assertEqual("TEST S4: Carbs 10g Sugar 20g is Invalid", sanityS4.isValid, false);
if (sanityS4.errors.some(e => e.includes("cannot exceed total Carbohydrates"))) {
  console.log("✅ [PASS] TEST S4: Correct error message for Sugar > Carbs");
  passedTests++;
  totalTests++;
} else {
  console.error("❌ [FAIL] TEST S4: Expected error message for Sugar > Carbs");
  totalTests++;
}

// TEST S5: Food has no sugar (e.g. Dada Ayam / Air Mineral) -> 0g sugar without hallucination
const chickenNutr = calculateSingleItemNutrition("Dada ayam 120g");
assertEqual("TEST S5: Dada Ayam Sugar is 0", chickenNutr.sugar, 0);
const waterNutr = calculateSingleItemNutrition("Air mineral 500ml");
assertEqual("TEST S5: Water Sugar is 0", waterNutr.sugar, 0);

// TEST S6: Composite Food Summation
// Bread (3g) + Sausage (1g) + Cheese (0.5g)
const mockComposite = calculateCompositeNutrition([
  { name: "Roti", grams: 60 },    // ~3g sugar (5g/100g * 60g)
  { name: "Sosis", grams: 50 },   // ~0.6g sugar (1.2g/100g * 50g)
  { name: "Keju", grams: 20 }     // ~0.1g sugar (0.5g/100g * 20g)
]);
const expectedSugarS6 = Math.round((3 + 0.6 + 0.1) * 10) / 10;
assertEqual("TEST S6: Composite Sugar Sum", mockComposite.sugar, expectedSugarS6);
assertEqual("TEST S6: Composite Sanity Valid", mockComposite.sanityValid, true);

// TEST S7: Same food + same portion consistency
const calcA = calculateFoodNutrition("Roti tawar 60g");
const calcB = calculateFoodNutrition("Roti tawar 60g");
assertEqual("TEST S7: Sugar Consistency", calcA.sugar, calcB.sugar);
assertEqual("TEST S7: Calories Consistency", calcA.calories, calcB.calories);
assertEqual("TEST S7: Carbs Consistency", calcA.carbs, calcB.carbs);

// TEST S8: "Roti isi sosis topping keju" individual component decomposition
const rotiCombo = calculateFoodNutrition("roti isi sosis topping keju");
assertEqual("TEST S8: Multi-component item count", rotiCombo.components.length, 3);
assertEqual("TEST S8: Component 1 is Bread", rotiCombo.components[0].normalizedName, "Roti Tawar");
assertEqual("TEST S8: Component 2 is Sausage", rotiCombo.components[1].normalizedName, "Sosis (Cooked)");
assertEqual("TEST S8: Component 3 is Cheese", rotiCombo.components[2].normalizedName, "Keju (1 Slice)");
assertEqual("TEST S8: Sugar is <= Carbs", rotiCombo.sugar <= rotiCombo.carbs, true);
assertEqual("TEST S8: Sanity check passes", rotiCombo.sanityValid, true);

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.`);
if (passedTests !== totalTests) {
  process.exit(1);
}
