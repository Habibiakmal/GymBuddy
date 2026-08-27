import assert from "assert";
import {
  formatDashboardMacro,
  formatDashboardInteger,
  formatDashboardPercent
} from "../services/nutritionEngine";

console.log("================================================================================");
console.log("🧪 RUNNING SUITE: DASHBOARD NUMBER FORMATTING & HUMAN READABILITY SPEC");
console.log("================================================================================");

let passed = 0;
let failed = 0;

function it(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ [FAIL] ${name}: ${err?.message || err}`);
    failed++;
  }
}

// -----------------------------------------------------------------------------
// Test Group 1: User-Specified Examples from Prompt
// -----------------------------------------------------------------------------
console.log("\n▶ GROUP 1: Prompt Examples & Trailing Zero Stripping");

it("Rounds 38.599999999999994 to '38.6' (eliminates floating-point drift)", () => {
  const result = formatDashboardMacro(38.599999999999994);
  assert.strictEqual(result, "38.6");
});

it("Rounds 75.69999999999999 to '75.7' (eliminates floating-point drift)", () => {
  const result = formatDashboardMacro(75.69999999999999);
  assert.strictEqual(result, "75.7");
});

it("Rounds 16.599999999999994 to '16.6' (eliminates floating-point drift)", () => {
  const result = formatDashboardMacro(16.599999999999994);
  assert.strictEqual(result, "16.6");
});

it("Formats 108.4 cleanly as '108.4'", () => {
  const result = formatDashboardMacro(108.4);
  assert.strictEqual(result, "108.4");
});

it("Formats 100.0 as '100' (strips unnecessary trailing zeros)", () => {
  const result = formatDashboardMacro(100.0);
  assert.strictEqual(result, "100");
});

it("Formats 50.0 as '50' (strips unnecessary trailing zeros)", () => {
  const result = formatDashboardMacro(50.0);
  assert.strictEqual(result, "50");
});

// -----------------------------------------------------------------------------
// Test Group 2: Remaining and Excess Values Display Strings
// -----------------------------------------------------------------------------
console.log("\n▶ GROUP 2: Remaining & Excess Difference Calculations");

it("Correctly formats remaining protein diff: 147 - 108.4 -> '38.6g sisa'", () => {
  const targetProt = 147;
  const totalProteinConsumed = 108.4;
  // JavaScript floating-point calculation: 147 - 108.4 = 38.599999999999994
  const rawProtDiff = targetProt - totalProteinConsumed;
  assert.strictEqual(rawProtDiff, 38.599999999999994); // Confirm raw JS float artifact exists

  const formattedRemaining = `${formatDashboardMacro(rawProtDiff)}g sisa`;
  assert.strictEqual(formattedRemaining, "38.6g sisa");
});

it("Correctly formats excess carbs diff: 296.7 - 221 -> '+75.7g (134%) · 🔴 Melebihi Target'", () => {
  const targetCarb = 221;
  const totalCarbsConsumed = 296.7;
  // JavaScript floating-point calculation: 221 - 296.7 = -75.70000000000002
  const rawCarbDiff = targetCarb - totalCarbsConsumed;
  const isOverCarb = totalCarbsConsumed > targetCarb;
  const carbPercent = Math.round((totalCarbsConsumed / targetCarb) * 100);

  const formattedExcess = isOverCarb
    ? `+${formatDashboardMacro(Math.abs(rawCarbDiff))}g (${formatDashboardInteger(carbPercent)}%) · 🔴 Melebihi Target`
    : `${formatDashboardMacro(rawCarbDiff)}g sisa`;

  assert.strictEqual(formattedExcess, "+75.7g (134%) · 🔴 Melebihi Target");
});

it("Correctly formats excess fat diff: 68.6 - 52 -> '+16.6g'", () => {
  const targetFat = 52;
  const totalFatConsumed = 68.6;
  const rawFatDiff = targetFat - totalFatConsumed; // -16.599999999999994
  assert.strictEqual(rawFatDiff, -16.599999999999994);

  const formattedExcess = `+${formatDashboardMacro(Math.abs(rawFatDiff))}g`;
  assert.strictEqual(formattedExcess, "+16.6g");
});

// -----------------------------------------------------------------------------
// Test Group 3: Display Precision by Nutrient
// -----------------------------------------------------------------------------
console.log("\n▶ GROUP 3: Nutrient-Specific Precision Boundaries");

it("Calories: 0 decimal places whole number", () => {
  assert.strictEqual(formatDashboardInteger(2058.7), "2,059");
  assert.strictEqual(formatDashboardInteger(2000.0), "2,000");
  assert.strictEqual(formatDashboardInteger(425.2), "425");
});

it("Protein: up to 1 decimal place with trailing zero stripped", () => {
  assert.strictEqual(formatDashboardMacro(140.0), "140");
  assert.strictEqual(formatDashboardMacro(139.75), "139.8");
  assert.strictEqual(formatDashboardMacro(0.0), "0");
});

it("Carbohydrates: up to 1 decimal place with trailing zero stripped", () => {
  assert.strictEqual(formatDashboardMacro(220.0), "220");
  assert.strictEqual(formatDashboardMacro(219.44), "219.4");
});

it("Fat: up to 1 decimal place with trailing zero stripped", () => {
  assert.strictEqual(formatDashboardMacro(55.0), "55");
  assert.strictEqual(formatDashboardMacro(55.56), "55.6");
});

it("Fiber: up to 1 decimal place with trailing zero stripped", () => {
  assert.strictEqual(formatDashboardMacro(28.0), "28");
  assert.strictEqual(formatDashboardMacro(27.89), "27.9");
});

it("Sugar: up to 1 decimal place with trailing zero stripped", () => {
  assert.strictEqual(formatDashboardMacro(45.0), "45");
  assert.strictEqual(formatDashboardMacro(42.34), "42.3");
});

it("Sodium: 0 decimal places whole number", () => {
  assert.strictEqual(formatDashboardInteger(2145.8), "2,146");
  assert.strictEqual(formatDashboardInteger(1850.2), "1,850");
});

it("Water: 0 decimal places whole number", () => {
  assert.strictEqual(formatDashboardInteger(2500.4), "2,500");
  assert.strictEqual(formatDashboardInteger(1750.9), "1,751");
});

it("Percentages: 0 decimal places whole number", () => {
  assert.strictEqual(formatDashboardPercent(134.4), "134%");
  assert.strictEqual(formatDashboardPercent(99.6), "100%");
  assert.strictEqual(formatDashboardPercent(75.1), "75%");
});

// -----------------------------------------------------------------------------
// Test Group 4: Edge Cases (Zero, Null, Undefined, String Numbers)
// -----------------------------------------------------------------------------
console.log("\n▶ GROUP 4: Null, Undefined, String Numbers & Zero Edge Cases");

it("Handles undefined and null gracefully without crashing", () => {
  assert.strictEqual(formatDashboardMacro(undefined), "0");
  assert.strictEqual(formatDashboardMacro(null), "0");
  assert.strictEqual(formatDashboardInteger(undefined), "0");
  assert.strictEqual(formatDashboardInteger(null), "0");
  assert.strictEqual(formatDashboardPercent(undefined), "0%");
  assert.strictEqual(formatDashboardPercent(null), "0%");
});

it("Handles numeric strings correctly", () => {
  assert.strictEqual(formatDashboardMacro("38.599999999999994"), "38.6");
  assert.strictEqual(formatDashboardMacro("100.0"), "100");
  assert.strictEqual(formatDashboardInteger("1958.4"), "1,958");
});

console.log("\n================================================================================");
console.log(`SUMMARY: ${passed} PASSED | ${failed} FAILED`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("🎉 ALL DASHBOARD NUMBER FORMATTING TESTS PASSED PERFECTLY!\n");
  process.exit(0);
}
