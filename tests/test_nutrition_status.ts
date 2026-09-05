import { calculateNutrientStatus, calculateDailyNutritionSummary, makeProgressBar, makeSodiumProgressBar } from "../services/nutritionEngine";

console.log("=== RUNNING NUTRITION STATUS LOGIC TEST SUITE ===");

let passedTests = 0;
let totalTests = 0;

function assertEqual(testName: string, actual: any, expected: any) {
  totalTests++;
  if (actual === expected) {
    console.log(`✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${testName} -> Expected: "${expected}", Actual: "${actual}"`);
    process.exitCode = 1;
  }
}

// TEST 1: 100 / 200 -> 50% -> under_target (🟡 Dalam Proses)
const res1 = calculateNutrientStatus(100, 200, false);
assertEqual("TEST 1: Status", res1.status, "under_target");
assertEqual("TEST 1: StatusBadge", res1.statusBadge, "Sisa target: 100");
assertEqual("TEST 1: Percentage", res1.percentage, 50);

// TEST 2: 199 / 200 -> 99.5% -> under_target (Sisa target: 1, NEVER Tercapai)
const res2 = calculateNutrientStatus(199, 200, false);
assertEqual("TEST 2: Status", res2.status, "under_target");
assertEqual("TEST 2: StatusBadge", res2.statusBadge, "Sisa target: 1");
assertEqual("TEST 2: IsUnder", res2.isUnder, true);
assertEqual("TEST 2: IsReached", res2.isReached, false);

// TEST 3: 200 / 200 -> 100% -> reached (✅ Tercapai)
const res3 = calculateNutrientStatus(200, 200, false);
assertEqual("TEST 3: Status", res3.status, "reached");
assertEqual("TEST 3: StatusBadge", res3.statusBadge, "✅ Tercapai");
assertEqual("TEST 3: Percentage", res3.percentage, 100);

// TEST 4: 201 / 200 -> 100.5% -> over_target (🔴 Melebihi Target)
const res4 = calculateNutrientStatus(201, 200, false);
assertEqual("TEST 4: Status", res4.status, "over_target");
assertEqual("TEST 4: StatusBadge", res4.statusBadge, "🔴 Melebihi Target");
assertEqual("TEST 4: IsOver", res4.isOver, true);
assertEqual("TEST 4: IsReached", res4.isReached, false);

// TEST 5: 500 / 200 -> 250% -> over_target (🔴 Melebihi Target)
const res5 = calculateNutrientStatus(500, 200, false);
assertEqual("TEST 5: Status", res5.status, "over_target");
assertEqual("TEST 5: StatusBadge", res5.statusBadge, "🔴 Melebihi Target");
assertEqual("TEST 5: Percentage", res5.percentage, 250);

// TEST 6: 2761 / 1783 -> 155% -> over_target (🔴 Melebihi Target)
const res6 = calculateNutrientStatus(2761, 1783, false);
assertEqual("TEST 6: Status", res6.status, "over_target");
assertEqual("TEST 6: StatusBadge", res6.statusBadge, "🔴 Melebihi Target");
assertEqual("TEST 6: Percentage", res6.percentage, 155);

// TEST 7: 348 / 201 -> 173% -> over_target (🔴 Melebihi Target)
const res7 = calculateNutrientStatus(348, 201, false);
assertEqual("TEST 7: Status", res7.status, "over_target");
assertEqual("TEST 7: StatusBadge", res7.statusBadge, "🔴 Melebihi Target");
assertEqual("TEST 7: Percentage", res7.percentage, 173);

// TEST 8: 68 / 50 -> 136% -> over_target (🔴 Melebihi Target)
const res8 = calculateNutrientStatus(68, 50, false);
assertEqual("TEST 8: Status", res8.status, "over_target");
assertEqual("TEST 8: StatusBadge", res8.statusBadge, "🔴 Melebihi Target");
assertEqual("TEST 8: Percentage", res8.percentage, 136);

// TEST 9: 4290 / 2000 -> 215% -> over_limit (🔴 Melebihi Batas)
const res9 = calculateNutrientStatus(4290, 2000, true);
assertEqual("TEST 9: Status", res9.status, "over_limit");
assertEqual("TEST 9: StatusBadge", res9.statusBadge, "🔴 Melebihi Batas");
assertEqual("TEST 9: Percentage", res9.percentage, 215);

// Progress Bar Output Verification
const calBar = makeProgressBar(2761, 1783);
assertEqual("Progress Bar Calorie", calBar, "[██████████] 155% · 🔴 Melebihi Target");

const protBar = makeProgressBar(100, 134);
assertEqual("Progress Bar Protein", protBar, "[███████░░░] 75% · Sisa target: 34");

const carbBar = makeProgressBar(348, 201);
assertEqual("Progress Bar Carbs", carbBar, "[██████████] 173% · 🔴 Melebihi Target");

const fatBar = makeProgressBar(68, 50);
assertEqual("Progress Bar Fat", fatBar, "[██████████] 136% · 🔴 Melebihi Target");

const sodBar = makeSodiumProgressBar(4290, 2000);
assertEqual("Progress Bar Sodium", sodBar, "[██████████] 215% · 🔴 Melebihi Batas");

// Daily Summary Object Verification
const dailySummary = calculateDailyNutritionSummary(
  { calories: 2761, protein: 100, carbs: 348, fat: 68, sodium: 4290 },
  { targetCalories: 1783, proteinGrams: 134, carbGrams: 201, fatGrams: 50, sodiumLimit: 2000 }
);

assertEqual("Summary Calorie Status", dailySummary.calories.statusBadge, "🔴 Melebihi Target");
assertEqual("Summary Protein Status", dailySummary.protein.statusBadge, "Sisa target: 34");
assertEqual("Summary Carbs Status", dailySummary.carbs.statusBadge, "🔴 Melebihi Target");
assertEqual("Summary Fat Status", dailySummary.fat.statusBadge, "🔴 Melebihi Target");
assertEqual("Summary Sodium Status", dailySummary.sodium.statusBadge, "🔴 Melebihi Batas");

// Negative / Prohibited String Assertions
const renderedOutput = `${calBar}\n${protBar}\n${carbBar}\n${fatBar}\n${sodBar}`;
if (renderedOutput.includes("155% · ✅ Tercapai") || renderedOutput.includes("173% · ✅ Tercapai") || renderedOutput.includes("136% · ✅ Tercapai")) {
  console.error("❌ [FAIL] Found forbidden string 'Tercapai' on over-target nutrient!");
  process.exitCode = 1;
} else {
  console.log("✅ [PASS] Confirmed NO over-target nutrient displays '✅ Tercapai'");
  passedTests++;
  totalTests++;
}

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.`);
if (passedTests !== totalTests) {
  process.exit(1);
}
