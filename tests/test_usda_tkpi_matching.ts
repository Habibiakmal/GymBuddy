import {
  calculateSingleItemNutrition,
  calculateCompositeNutrition,
  calculateFoodNutrition
} from "../services/nutritionEngine";

console.log("=== RUNNING USDA/TKPI MATCHING & TRACEABILITY TEST SUITE ===");

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

// 1. Exact TKPI Match
const nasiPadang = calculateSingleItemNutrition("Nasi Padang Komplit");
assertEqual("TKPI: Nasi Padang Source", nasiPadang.source, "TKPI");
assertEqual("TKPI: Nasi Padang Normalized Name", nasiPadang.normalizedName, "Nasi Padang Komplit");

// 2. Exact USDA Match
const pasta = calculateSingleItemNutrition("Pasta Cooked 180g");
assertEqual("USDA: Pasta Source", pasta.source, "USDA");
assertEqual("USDA: Pasta Normalized Name", pasta.normalizedName, "Pasta (Cooked)");

// 3. Local Indonesian food priority
const ayamGeprek = calculateSingleItemNutrition("Ayam geprek");
assertEqual("TKPI Priority: Ayam Geprek Source", ayamGeprek.source, "TKPI");
assertEqual("TKPI: Ayam Geprek Normalized Name", ayamGeprek.normalizedName, "Ayam Geprek Crispy + Sambal");

// 4. Cooking Method Matching
const telurRebus = calculateSingleItemNutrition("Telur rebus 1 butir");
const telurGoreng = calculateSingleItemNutrition("Telur goreng 1 butir");
assertEqual("Cooking Variant: Telur Rebus Calories", telurRebus.calories, 75); // Atwater (6.3*4 + 0.6*4 + 5.3*9) = ~75 kcal
assertEqual("Cooking Variant: Telur Goreng Fat is Higher", telurGoreng.fat > telurRebus.fat, true);

// 5. Piece Conversion
const nugget4 = calculateSingleItemNutrition("4 pcs chicken nugget");
assertEqual("Portion Normalization: 4 pcs nugget grams", nugget4.actualAmount, 80);
assertEqual("Portion Normalization: 4 pcs nugget protein", nugget4.protein, 12);

// 6. Multi-Component Decomposition: "Roti isi sosis topping keju"
const rotiCombo = calculateFoodNutrition("roti isi sosis topping keju");
assertEqual("Multi-Component: Component Count", rotiCombo.components.length, 3);
assertEqual("Multi-Component: Bread Matched", rotiCombo.components.some(c => c.normalizedName.includes("Roti")), true);
assertEqual("Multi-Component: Sausage Matched", rotiCombo.components.some(c => c.normalizedName.includes("Sosis")), true);
assertEqual("Multi-Component: Cheese Matched", rotiCombo.components.some(c => c.normalizedName.includes("Keju")), true);

// 7. Multi-Component Decomposition: "Nasi ayam bumbu, perkedel, dan daun singkong"
const nasiCombo = calculateFoodNutrition("Nasi ayam, perkedel, dan daun singkong");
assertEqual("Nasi Combo: Component Count", nasiCombo.components.length, 3);
assertEqual("Nasi Combo: Rice & Chicken Matched", nasiCombo.components[0].normalizedName.includes("Nasi") || nasiCombo.components[0].normalizedName.includes("Ayam"), true);
assertEqual("Nasi Combo: Perkedel Matched", nasiCombo.components.some(c => c.normalizedName.includes("Perkedel")), true);
assertEqual("Nasi Combo: Daun Singkong Matched", nasiCombo.components.some(c => c.normalizedName.includes("Daun Singkong")), true);

// 8. Traceability Metadata
for (const comp of rotiCombo.components) {
  assertEqual(`Traceability for ${comp.foodName}: Has databaseId`, Boolean(comp.databaseId), true);
  assertEqual(`Traceability for ${comp.foodName}: Has source`, Boolean(comp.source), true);
  assertEqual(`Traceability for ${comp.foodName}: Has referenceAmount`, comp.referenceAmount, 100);
  assertEqual(`Traceability for ${comp.foodName}: Has actualAmount`, comp.actualAmount > 0, true);
}

// 9. Ignoring Gemini Macro Guesses Simulation:
// If an external input has Gemini guessed calories (e.g. 9999 kcal), backend calculation must still derive the true database sum!
const rawUserText = "2 telur rebus dan 2 lembar roti tawar";
const verifiedResult = calculateFoodNutrition(rawUserText);
// True math: 2 eggs (100g) = 150 kcal, 2 roti (60g) = 157 kcal -> Total = 307 kcal
assertEqual("Ignore Gemini Guesses: Backend Source of Truth Calories", verifiedResult.calories, 307);

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.`);
if (passedTests !== totalTests) {
  process.exit(1);
}
