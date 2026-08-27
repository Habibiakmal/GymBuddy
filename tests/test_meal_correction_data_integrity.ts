import {
  applyTargetedMealCorrection,
  extractMealComponents,
  formatNutritionCard,
  sanitizeWhatsAppResponse,
  detectMealCorrectionIntent,
  classifyUserInput,
  validatePlanContext
} from "../server";

console.log("================================================================================");
console.log("🧪 RUNNING SUITE: MEAL CORRECTION, DATA INTEGRITY & RESPONSE FORMAT SPEC");
console.log("================================================================================");

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}${detail ? ` -> Detail: ${detail}` : ""}`);
    failedCount++;
  }
}

// ── Baseline Test Data: Standard Indonesian Meal with 5 items ──
const mockOriginalMeal = {
  id: "meal-baseline-001",
  foodName: "PAKET AYAM GORENG & TAHU DENGAN ES TEH",
  calories: 792,
  protein: 38.0,
  carbs: 85.0,
  fat: 32.0,
  fiber: 5.0,
  sugar: 18.0,
  sodium: 850,
  mealType: "lunch" as any,
  portionEstimates: [
    "• Nasi Putih: 1 porsi (200g) (~251 kcal)",
    "• Ayam Goreng: 1 potong (100g) (~260 kcal)",
    "• Tahu Goreng: 1 potong (50g) (~75 kcal)",
    "• Es Teh Manis: 1 gelas (250ml) (~90 kcal)",
    "• Sambal & Lalapan: 1 porsi (~116 kcal)"
  ]
};

const mockUserDataMia = {
  name: "Budi Santoso",
  nickname: "Budi",
  persona: "mia",
  targetCalories: 2000,
  proteinGrams: 120,
  carbGrams: 240,
  fatGrams: 65,
  gender: "pria",
  age: 28
};

const mockUserDataMax = {
  name: "Habibi",
  nickname: "Habibi",
  persona: "max",
  targetCalories: 2200,
  proteinGrams: 150,
  carbGrams: 250,
  fatGrams: 70,
  gender: "pria",
  age: 25
};

// ── GROUP 1: IDENTIFY WHAT WAS CORRECTED (Examples from Prompt) ──
console.log("\n▶ GROUP 1: Targeted Component Identification & Preserving Unchanged Items");

// Case 1: "koreksi, nasi putihnya cuma setengah"
const resRiceHalf = applyTargetedMealCorrection(mockOriginalMeal, "koreksi, nasi putihnya cuma setengah", mockUserDataMia);
assert(resRiceHalf.foodName === mockOriginalMeal.foodName, "Case 1: Food name preserved as source of truth");
assert(resRiceHalf.correctedComponent.toLowerCase().includes("nasi"), "Case 1: Correctly identified Nasi Putih as target");

// Verify unchanged items are 100% preserved
const ayamInRes1 = resRiceHalf.components.find(c => c.name.toLowerCase().includes("ayam"));
const tahuInRes1 = resRiceHalf.components.find(c => c.name.toLowerCase().includes("tahu"));
const tehInRes1 = resRiceHalf.components.find(c => c.name.toLowerCase().includes("teh"));
const sambalInRes1 = resRiceHalf.components.find(c => c.name.toLowerCase().includes("sambal"));

assert(ayamInRes1?.calories === 260, "Case 1: Ayam Goreng calories 100% unchanged (260 kcal)");
assert(tahuInRes1?.calories === 75, "Case 1: Tahu Goreng calories 100% unchanged (75 kcal)");
assert(tehInRes1?.calories === 90, "Case 1: Es Teh Manis calories 100% unchanged (90 kcal)");
assert(sambalInRes1?.calories === 116, "Case 1: Sambal & Lalapan calories 100% unchanged (116 kcal)");
assert(!ayamInRes1?.isUpdated && !tahuInRes1?.isUpdated && !tehInRes1?.isUpdated, "Case 1: Only Nasi Putih is flagged as updated");

// Case 2: "koreksi, ayamnya cuma setengah potong"
const resChickenHalf = applyTargetedMealCorrection(mockOriginalMeal, "koreksi, ayamnya cuma setengah potong", mockUserDataMia);
assert(resChickenHalf.correctedComponent.toLowerCase().includes("ayam"), "Case 2: Correctly identified Ayam Goreng as target");
const riceInRes2 = resChickenHalf.components.find(c => c.name.toLowerCase().includes("nasi"));
assert(riceInRes2?.calories === 251, "Case 2: Nasi Putih 100% preserved (251 kcal)");

// Case 3: "koreksi, es tehnya tanpa gula"
const resTeaNoSugar = applyTargetedMealCorrection(mockOriginalMeal, "koreksi, es tehnya tanpa gula", mockUserDataMia);
const teaInRes3 = resTeaNoSugar.components.find(c => c.name.toLowerCase().includes("teh"));
assert(Boolean(teaInRes3 && teaInRes3.sugar === 0), "Case 3: Es Teh Manis sugar modified to 0g");
assert(Boolean(teaInRes3 && teaInRes3.calories < 90), "Case 3: Es Teh Manis calories reduced without sugar");
const riceInRes3 = resTeaNoSugar.components.find(c => c.name.toLowerCase().includes("nasi"));
assert(riceInRes3?.calories === 251, "Case 3: Nasi Putih 100% preserved (251 kcal)");

// Case 4: "koreksi, ternyata aku tidak makan tahunya" (Removal)
const resRemoveTofu = applyTargetedMealCorrection(mockOriginalMeal, "koreksi, ternyata aku tidak makan tahunya", mockUserDataMia);
const hasTofuInList = resRemoveTofu.portionEstimates.some(l => l.toLowerCase().includes("tahu"));
assert(!hasTofuInList, "Case 4: Tahu Goreng completely removed from portion estimates");
assert(resRemoveTofu.calories === 792 - 75, `Case 4: Delta calculation for removal: 792 - 75 = ${792 - 75} kcal (got ${resRemoveTofu.calories})`);

// ── GROUP 2: DELTA-BASED CALCULATION FORMULA ──
console.log("\n▶ GROUP 2: Delta-Based Calculation (Formula: Original − Old Item + New Item)");

// Prompt Example: Original: 792 kcal, Original rice: 251 kcal, Corrected rice: 102 kcal -> Corrected meal: 792 - 251 + 102 = 643 kcal
const resExplicitPrompt = applyTargetedMealCorrection(
  mockOriginalMeal,
  "koreksi, aku cuma makan nasi putih setengah 102 kcal",
  mockUserDataMia
);
assert(resExplicitPrompt.calories === 643, `Calculates exact prompt formula: 792 - 251 + 102 = 643 kcal (got ${resExplicitPrompt.calories})`);

// Standard half ratio without explicit kcal: 251 -> 126 kcal -> 792 - 251 + 126 = 667 kcal
const resHalfRatio = applyTargetedMealCorrection(mockOriginalMeal, "koreksi, nasi putihnya cuma setengah", mockUserDataMia);
const newRiceCal = resHalfRatio.components.find(c => c.name.toLowerCase().includes("nasi"))?.calories || 0;
const expectedMealCal = 792 - 251 + newRiceCal;
assert(resHalfRatio.calories === expectedMealCal, `Delta calculation exact: 792 - 251 + ${newRiceCal} = ${expectedMealCal} kcal`);

// ── GROUP 3: MULTIPLE CORRECTIONS IN ONE QUERY ──
console.log("\n▶ GROUP 3: Multiple Corrections ('koreksi, nasinya setengah dan ayamnya cuma setengah potong')");

const resMultiple = applyTargetedMealCorrection(
  mockOriginalMeal,
  "koreksi, nasinya setengah dan ayamnya cuma setengah potong",
  mockUserDataMax
);
const riceInMulti = resMultiple.components.find(c => c.name.toLowerCase().includes("nasi"));
const chickenInMulti = resMultiple.components.find(c => c.name.toLowerCase().includes("ayam"));
const tofuInMulti = resMultiple.components.find(c => c.name.toLowerCase().includes("tahu"));
const teaInMulti = resMultiple.components.find(c => c.name.toLowerCase().includes("teh"));

assert(riceInMulti?.isUpdated === true, "Multiple: Nasi Putih marked as updated");
assert(chickenInMulti?.isUpdated === true, "Multiple: Ayam Goreng marked as updated");
assert(tofuInMulti?.isUpdated !== true && tofuInMulti?.calories === 75, "Multiple: Tahu Goreng 100% preserved (75 kcal)");
assert(teaInMulti?.isUpdated !== true && teaInMulti?.calories === 90, "Multiple: Es Teh Manis 100% preserved (90 kcal)");

// ── GROUP 4: COACH RESPONSE CONTENT & ADDRESSING ──
console.log("\n▶ GROUP 4: Coach Response Persona, Addressing & Transparency");

assert(resRiceHalf.coachComment.includes("Budi"), "Coach Mia addresses user by validated nickname ('Budi')");
assert(resRiceHalf.coachComment.toLowerCase().includes("nasi putih"), "Coach comment explains specific component changed ('nasi putih')");
assert(resRiceHalf.coachComment.includes("Item lainnya tetap"), "Coach comment clarifies unchanged items remain as logged");
assert(!resRiceHalf.coachComment.toLowerCase().includes("bro"), "Zero forbidden slang ('bro')");

assert(resMultiple.coachComment.includes("Habibi"), "Coach Max addresses user by validated nickname ('Habibi')");
assert(resMultiple.coachComment.toLowerCase().includes("nasi") && resMultiple.coachComment.toLowerCase().includes("ayam"), "Coach Max explains both changed components");

// ── GROUP 5: RESPONSE STRUCTURE & CONTINUOUS SEPARATORS ──
console.log("\n▶ GROUP 5: Response Structure Consistency & Continuous Separator Validation");

const mockDailyTotals = {
  calories: 792,
  protein: 38,
  carbs: 85,
  fat: 32,
  sodium: 850,
  sugar: 18,
  logs: [mockOriginalMeal]
} as any;

const formattedCard = formatNutritionCard(resRiceHalf, "Koreksi", mockUserDataMia as any, mockDailyTotals);

// Check 1: Continuous separator line: ━━━━━━━━━━━━━━
const hasContinuousSep = formattedCard.includes("━━━━━━━━━━━━━━");
assert(hasContinuousSep, "Contains continuous single-line separator: ━━━━━━━━━━━━━━");

// Check 2: No broken separator characters on individual lines (e.g. single ━ followed by newline)
const hasBrokenSeparators = /(?:^|\n)━(?:\n|$)/.test(formattedCard);
assert(!hasBrokenSeparators, "Zero broken separator characters (no single '━' lines)");

// Check 3: Exact section order check
const idxHeader = formattedCard.indexOf("🍽️");
const idxRekap = formattedCard.indexOf("📊 *REKAP NUTRISI*");
const idxPorsi = formattedCard.indexOf("🍽️ *ESTIMASI PORSI*");
const idxCoach = formattedCard.indexOf("🤖 *COACH MIA*");
const idxStatus = formattedCard.indexOf("📈 *STATUS HARI INI*");
const idxFooter = formattedCard.indexOf("⚙️");

assert(idxHeader !== -1 && idxHeader < idxRekap, "Section Order: Header comes before Rekap Nutrisi");
assert(idxRekap < idxPorsi, "Section Order: Rekap Nutrisi comes before Estimasi Porsi");
assert(idxPorsi < idxCoach, "Section Order: Estimasi Porsi comes before Coach Section");
assert(idxCoach < idxStatus, "Section Order: Coach Section comes before Status Hari Ini");
assert(idxStatus < idxFooter, "Section Order: Status Hari Ini comes before Footer");

// ── GROUP 6: SANITIZE WHATSAPP RESPONSE SEPARATOR INTEGRITY ──
console.log("\n▶ GROUP 6: Sanitizer Broken Separator Cleanup");

const brokenSample = "Header\n\n━\n\n━\n\n━\n\nSection 1\n\n━━━━━\n\nSection 2";
const sanitized = sanitizeWhatsAppResponse(brokenSample);
assert(sanitized.includes("━━━━━━━━━━━━━━"), "Sanitizer collapses broken ━ lines into continuous ━━━━━━━━━━━━━━");
assert(!/(?:^|\n)━(?:\n|$)/.test(sanitized), "Sanitizer eliminates isolated single ━ lines");

// ── GROUP 7: ITEM-LEVEL DECOMPOSITION (Prompt Example 1) ──
console.log("\n▶ GROUP 7: Compound Meal Decomposition into Individual Items");

const mockCompoundMeal = {
  id: "meal-compound-001",
  foodName: "Nasi Putih, Ayam Goreng, Tahu Goreng & Es Teh Manis",
  calories: 690,
  protein: 37.1,
  carbs: 80.3,
  fat: 20.2,
  fiber: 2.1,
  sugar: 18.2,
  sodium: 492
};

const extractedFromCompound = extractMealComponents(mockCompoundMeal);
assert(extractedFromCompound.length === 4, `Decomposes compound meal into 4 distinct items (got ${extractedFromCompound.length})`);
assert(extractedFromCompound.some(c => c.name.toLowerCase().includes("nasi")), "Contains independent Item 1: Nasi Putih");
assert(extractedFromCompound.some(c => c.name.toLowerCase().includes("ayam")), "Contains independent Item 2: Ayam Goreng");
assert(extractedFromCompound.some(c => c.name.toLowerCase().includes("tahu")), "Contains independent Item 3: Tahu Goreng");
assert(extractedFromCompound.some(c => c.name.toLowerCase().includes("teh")), "Contains independent Item 4: Es Teh Manis");

// Correction targeting single item in compound meal
const resTargetCompound = applyTargetedMealCorrection(mockCompoundMeal, "koreksi, nasi putihnya cuma setengah", mockUserDataMia);
const portionLines = resTargetCompound.portionEstimates;

assert(portionLines.length === 4, `Displays exactly 4 individual item lines in Estimasi Porsi (got ${portionLines.length})`);
assert(portionLines.some(l => l.includes("Nasi Putih: 1/2 porsi") && l.includes("← diperbarui")), "Nasi Putih updated to 1/2 porsi and marked ← diperbarui");
assert(portionLines.some(l => l.includes("Ayam Goreng") && !l.includes("← diperbarui")), "Ayam Goreng preserved without badge");
assert(portionLines.some(l => l.includes("Tahu Goreng") && !l.includes("← diperbarui")), "Tahu Goreng preserved without badge");
assert(portionLines.some(l => l.includes("Es Teh Manis") && !l.includes("← diperbarui")), "Es Teh Manis preserved without badge");

// NEVER output combined title with 1/2 porsi
const hasInvalidCombinedLine = portionLines.some(l => l.includes("Nasi Putih, Ayam Goreng, Tahu Goreng & Es Teh Manis: 1/2 porsi"));
assert(!hasInvalidCombinedLine, "NEVER outputs combined meal title as portion (e.g. 'Nasi Putih, Ayam Goreng...: 1/2 porsi')");

// ── GROUP 8: SEQUENTIAL CUMULATIVE CORRECTIONS (Prompt Example 2) ──
console.log("\n▶ GROUP 8: Sequential Corrections & Cumulative State Preservation");

// State after Correction 1 (from resTargetCompound)
const intermediateMealState = {
  ...mockCompoundMeal,
  calories: resTargetCompound.calories,
  protein: resTargetCompound.protein,
  carbs: resTargetCompound.carbs,
  fat: resTargetCompound.fat,
  fiber: resTargetCompound.fiber,
  sugar: resTargetCompound.sugar,
  sodium: resTargetCompound.sodium,
  portionEstimates: resTargetCompound.portionEstimates,
  items: resTargetCompound.components.map(c => ({
    food_name: c.name,
    portion: c.portion,
    calories: c.calories,
    protein: c.protein,
    carbs: c.carbs,
    fat: c.fat,
    fiber: c.fiber,
    sugar: c.sugar,
    sodium: c.sodium
  }))
};

// Apply Correction 2: "koreksi, ayamnya juga cuma setengah potong"
const resCorrection2 = applyTargetedMealCorrection(intermediateMealState, "koreksi, ayamnya juga cuma setengah potong", mockUserDataMia);
const portionLines2 = resCorrection2.portionEstimates;

const riceLineAfter2 = portionLines2.find(l => l.includes("Nasi Putih"));
const chickenLineAfter2 = portionLines2.find(l => l.includes("Ayam Goreng"));
const tofuLineAfter2 = portionLines2.find(l => l.includes("Tahu Goreng"));
const teaLineAfter2 = portionLines2.find(l => l.includes("Es Teh Manis"));

assert(riceLineAfter2?.includes("1/2 porsi") && !riceLineAfter2?.includes("← diperbarui"), "Correction 2: Nasi Putih retains 1/2 porsi from Correction 1 and has NO badge");
assert(chickenLineAfter2?.includes("1/2 potong") && chickenLineAfter2?.includes("← diperbarui"), "Correction 2: Ayam Goreng updated to 1/2 potong and IS marked ← diperbarui");
assert(!tofuLineAfter2?.includes("← diperbarui"), "Correction 2: Tahu Goreng untouched and has NO badge");
assert(!teaLineAfter2?.includes("← diperbarui"), "Correction 2: Es Teh Manis untouched and has NO badge");

// ── GROUP 9: AMBIGUOUS CORRECTION HANDLING (Prompt: 'koreksi ayamnya') ──
console.log("\n▶ GROUP 9: Ambiguous Correction (Asking Clarification, No Guessing, No Database Update)");

const resAmbiguous = applyTargetedMealCorrection(mockCompoundMeal, "koreksi ayamnya", mockUserDataMia);
assert(resAmbiguous.isAmbiguous === true, "Query 'koreksi ayamnya' detected as ambiguous");
assert(resAmbiguous.isCorrection === false, "isCorrection is false when query is ambiguous");
assert(resAmbiguous.clarificationMessage?.includes("Mau dikoreksi bagian apa dari ayamnya?"), "Clarification message asks: 'Mau dikoreksi bagian apa dari ayamnya?'");
assert(resAmbiguous.clarificationMessage?.includes("porsinya") && resAmbiguous.clarificationMessage?.includes("jumlah potongnya"), "Clarification options mention portion, quantity, or type");
assert(resAmbiguous.calories === mockCompoundMeal.calories, "Calories NOT changed when query is ambiguous (Source of truth preserved)");

// Bare query "koreksi"
const resBareCorrection = applyTargetedMealCorrection(mockCompoundMeal, "koreksi", mockUserDataMia);
assert(resBareCorrection.isAmbiguous === true, "Bare query 'koreksi' detected as ambiguous");
assert(resBareCorrection.clarificationMessage?.includes("Mau koreksi makanan yang mana"), "Bare query asks which food to correct");

// ── GROUP 10: STRICT OUT-OF-SCOPE GATE (Prompt: 'apa itu laptop?') ──
console.log("\n▶ GROUP 10: Strict Out-of-Scope Gate");

const categoryLaptop = classifyUserInput("apa itu laptop?", false);
assert(categoryLaptop === "OUT_OF_CONTEXT", "Query 'apa itu laptop?' classified as OUT_OF_CONTEXT");

const validationLaptop = validatePlanContext("apa itu laptop?", false, mockUserDataMia);
assert(validationLaptop.canProceed === false, "canProceed is false for out-of-scope question");
assert(validationLaptop.decision === "REDIRECT_OUT_OF_CONTEXT", "Decision is REDIRECT_OUT_OF_CONTEXT");
assert(validationLaptop.redirectMessage.includes("Maaf ya"), "Politely apologizes in redirect");
assert(validationLaptop.redirectMessage.includes("nutrisi, makanan, dan latihan di GymBuddy"), "Mentions GymBuddy scope (nutrition, food, workout)");
assert(!validationLaptop.redirectMessage.toLowerCase().includes("laptop"), "Never defines or explains what a laptop is");

// ── SUMMARY ──
console.log("\n================================================================================");
console.log(`SUMMARY: ${passedCount} PASSED | ${failedCount} FAILED`);
console.log("================================================================================");

if (failedCount === 0) {
  console.log("🎉 ALL MEAL CORRECTION & DATA INTEGRITY TESTS PASSED PERFECTLY!\n");
  process.exit(0);
} else {
  console.error("❌ SOME TESTS FAILED!\n");
  process.exit(1);
}
