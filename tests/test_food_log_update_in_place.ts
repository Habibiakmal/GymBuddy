import {
  processMealCorrection,
  getLastFoodMeal,
  updateExistingMealLog,
  getDailyTotals,
  dbData
} from "../server";

console.log("================================================================================");
console.log("🧪 RUNNING TEST SUITE: MEAL CORRECTION IN-PLACE UPDATE & CANONICAL FOOD LOG");
console.log("================================================================================");

let allPassed = true;
function check(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${desc}`);
  } else {
    console.error(`  ❌ [FAIL] ${desc}`);
    allPassed = false;
  }
}

const testPhone = "081299998888";
const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
const key = `${testPhone}_${todayStr}`;

// Initialize clean database state for test user
dbData.dailyLogs[key] = [];

const mockUser = {
  name: "Budi Santoso",
  nickname: "Budi",
  persona: "mia",
  age: 28,
  gender: "pria",
  calorieTarget: 2000,
  proteinTarget: 140,
  carbsTarget: 220,
  fatTarget: 55
};

// ── STEP 1: INITIAL LOGGED MEAL ──
console.log("\n▶ STEP 1: Single Canonical Food Log Creation");

const canonicalLogId = "12345";
const initialMeal = {
  id: canonicalLogId,
  foodName: "Nasi Putih, Ayam Goreng, Tahu Goreng & Es Teh Manis",
  calories: 700,
  protein: 45.0,
  carbs: 58.8,
  fat: 22.0,
  fiber: 4.0,
  sugar: 15.0,
  sodium: 480,
  mealType: "lunch" as any,
  portionEstimates: [
    "• Nasi Putih: 200g (~260 kcal)",
    "• Ayam Goreng: 1 potong (~260 kcal)",
    "• Tahu Goreng: 1 potong (~75 kcal)",
    "• Es Teh Manis: 1 gelas (~105 kcal)"
  ],
  items: [
    { food_name: "Nasi Putih", portion: "200g", calories: 260, protein: 5.4, carbs: 57.2, fat: 0.6, fiber: 0.8, sugar: 0.1, sodium: 2 },
    { food_name: "Ayam Goreng", portion: "1 potong", calories: 260, protein: 26.0, carbs: 0.0, fat: 16.0, fiber: 0.0, sugar: 0.0, sodium: 320 },
    { food_name: "Tahu Goreng", portion: "1 potong", calories: 75, protein: 7.0, carbs: 1.5, fat: 5.0, fiber: 1.0, sugar: 0.5, sodium: 80 },
    { food_name: "Es Teh Manis", portion: "1 gelas", calories: 105, protein: 0.0, carbs: 26.0, fat: 0.0, fiber: 0.0, sugar: 25.0, sodium: 10 }
  ],
  timestamp: new Date().toISOString()
};

// Add initial meal
dbData.dailyLogs[key] = [initialMeal];

const retrievedInitial = getLastFoodMeal(testPhone, todayStr);
check(retrievedInitial !== null, "Initial meal is successfully retrieved from database");
check(retrievedInitial?.id === canonicalLogId, `Canonical LOG_ID is preserved: ${canonicalLogId}`);
check(dbData.dailyLogs[key].length === 1, "Food Journal contains exactly 1 food log entry");

const initialTotals = getDailyTotals(testPhone, todayStr);
check(initialTotals.calories === 700, `Initial daily calories is exactly 700 kcal (got ${initialTotals.calories})`);

// ── STEP 2: CORRECTION 1 (Nasi jadi 100g) ──
console.log("\n▶ STEP 2: Correction 1 - Update Existing Food Log in Place ('koreksi, nasi putihnya jadi 100g')");

async function runTests() {
  const correction1Result = await processMealCorrection(
    testPhone,
    "koreksi, nasi putihnya jadi 100g",
    mockUser,
    todayStr
  );

  check(correction1Result !== null, "Correction 1 processed successfully");
  check(correction1Result?.mealRecord.id === canonicalLogId, `Correction 1 MUST preserve canonical LOG_ID: ${canonicalLogId} (NOT a new ID like 12346)`);
  check(dbData.dailyLogs[key].length === 1, `Food Journal still contains EXACTLY 1 food log entry (0 additional entries, got ${dbData.dailyLogs[key].length})`);
  check(dbData.dailyLogs[key][0].id === canonicalLogId, `Existing food log at index 0 updated with same ID: ${canonicalLogId}`);

  // Nutrition formula: Daily Total = Daily Total - Old Meal Total + New Meal Total
  // Nasi changed from 200g (260 kcal) to 100g (~130 kcal). Meal calories = 700 - 260 + 130 = 570 kcal
  const totalsAfterCorrection1 = getDailyTotals(testPhone, todayStr);
  check(
    totalsAfterCorrection1.calories === 570,
    `Daily calories is Daily Total − Old Meal + New Meal: 700 - 260 + 130 = 570 kcal (got ${totalsAfterCorrection1.calories})`
  );
  check(
    totalsAfterCorrection1.calories < 700,
    `Daily calories strictly decreased after portion reduction (Did NOT add new meal on top of old: 700 + 570 = 1270 is FORBIDDEN)`
  );

  // Verify item states
  const updatedNasiItem = correction1Result?.mealRecord.items?.find((i: any) => i.food_name.toLowerCase().includes("nasi"));
  check(updatedNasiItem?.portion === "100g", "Item Nasi Putih portion updated to 100g");

  // ── STEP 3: CORRECTION 2 (Ayam jadi setengah potong) ──
  console.log("\n▶ STEP 3: Correction 2 - Multiple Sequential Corrections on Same Log ('koreksi ayam jadi setengah potong')");

  const correction2Result = await processMealCorrection(
    testPhone,
    "koreksi ayam jadi setengah potong",
    mockUser,
    todayStr
  );

  check(correction2Result !== null, "Correction 2 processed successfully");
  check(correction2Result?.mealRecord.id === canonicalLogId, `Correction 2 MUST STILL preserve canonical LOG_ID: ${canonicalLogId} (NOT 12347)`);
  check(dbData.dailyLogs[key].length === 1, `Food Journal still contains EXACTLY 1 food log entry (0 additional entries, got ${dbData.dailyLogs[key].length})`);
  check(dbData.dailyLogs[key][0].id === canonicalLogId, `Database record updated in-place with same canonical ID: ${canonicalLogId}`);

  // Ayam 1 potong (260 kcal) -> 1/2 potong (130 kcal). New meal total = 570 - 260 + 130 = 440 kcal
  const totalsAfterCorrection2 = getDailyTotals(testPhone, todayStr);
  check(
    totalsAfterCorrection2.calories === 440,
    `Daily calories after Correction 2 is: 570 - 260 + 130 = 440 kcal (got ${totalsAfterCorrection2.calories})`
  );

  // Verify cumulative state: Nasi from Correction 1 is still 100g, Ayam from Correction 2 is 1/2 potong
  const finalNasi = correction2Result?.mealRecord.items?.find((i: any) => i.food_name.toLowerCase().includes("nasi"));
  const finalAyam = correction2Result?.mealRecord.items?.find((i: any) => i.food_name.toLowerCase().includes("ayam"));
  const finalTahu = correction2Result?.mealRecord.items?.find((i: any) => i.food_name.toLowerCase().includes("tahu"));
  const finalTeh = correction2Result?.mealRecord.items?.find((i: any) => i.food_name.toLowerCase().includes("teh"));

  check(finalNasi?.portion === "100g", "Cumulative state: Nasi Putih retained 100g from Correction 1");
  check(finalAyam?.portion === "1/2 potong", "Cumulative state: Ayam Goreng updated to 1/2 potong from Correction 2");
  check(finalTahu?.portion === "1 potong", "Cumulative state: Tahu Goreng 100% preserved as 1 potong");
  check(finalTeh?.portion === "1 gelas", "Cumulative state: Es Teh Manis 100% preserved as 1 gelas");

  // ── STEP 3B: CORRECTION 3 (Es Teh Manis tanpa gula) ──
  console.log("\n▶ STEP 3B: Correction 3 - Third Sequential Correction on Same Log ('koreksi es tehnya tanpa gula')");

  const correction3Result = await processMealCorrection(
    testPhone,
    "koreksi es tehnya tanpa gula",
    mockUser,
    todayStr
  );

  check(correction3Result !== null, "Correction 3 processed successfully");
  check(correction3Result?.mealRecord.id === canonicalLogId, `Correction 3 MUST STILL preserve canonical LOG_ID: ${canonicalLogId} (NOT 12348)`);
  check(dbData.dailyLogs[key].length === 1, `Food Journal still contains EXACTLY 1 food log entry (0 additional entries, got ${dbData.dailyLogs[key].length})`);
  check(dbData.dailyLogs[key][0].id === canonicalLogId, `Database record updated in-place with same canonical ID: ${canonicalLogId}`);

  const finalTehSugar = correction3Result?.mealRecord.items?.find((i: any) => i.food_name.toLowerCase().includes("teh"));
  check(finalTehSugar?.sugar === 0, "Es Teh Manis sugar is now 0g");

  // ── STEP 4: MULTI-MEAL DAY TOTAL TEST (Exact Prompt Example: 2,000 - 700 + 500 = 1,800) ──
  console.log("\n▶ STEP 4: Multi-Meal Day Calculation (Prompt Example: 2,000 kcal - 700 kcal + 500 kcal = 1,800 kcal)");

  const multiUserPhone = "081211112222";
  const multiKey = `${multiUserPhone}_${todayStr}`;

  const breakfastMeal = {
    id: "m-breakfast-101",
    foodName: "Oatmeal & Pisang",
    calories: 500,
    protein: 15,
    carbs: 85,
    fat: 8,
    mealType: "breakfast" as any,
    timestamp: "2026-08-27T07:30:00.000Z"
  };

  const lunchMeal = {
    id: "12345", // Canonical ID from prompt
    foodName: "Nasi Putih, Ayam Goreng, Tahu Goreng & Es Teh Manis",
    calories: 700,
    protein: 45,
    carbs: 58.8,
    fat: 22,
    mealType: "lunch" as any,
    portionEstimates: [
      "• Nasi Putih: 200g (~260 kcal)",
      "• Ayam Goreng: 1 potong (~260 kcal)",
      "• Tahu Goreng: 1 potong (~75 kcal)",
      "• Es Teh Manis: 1 gelas (~105 kcal)"
    ],
    items: [
      { food_name: "Nasi Putih", portion: "200g", calories: 260, protein: 5.4, carbs: 57.2, fat: 0.6, fiber: 0.8, sugar: 0.1, sodium: 2 },
      { food_name: "Ayam Goreng", portion: "1 potong", calories: 260, protein: 26.0, carbs: 0.0, fat: 16.0, fiber: 0.0, sugar: 0.0, sodium: 320 },
      { food_name: "Tahu Goreng", portion: "1 potong", calories: 75, protein: 7.0, carbs: 1.5, fat: 5.0, fiber: 1.0, sugar: 0.5, sodium: 80 },
      { food_name: "Es Teh Manis", portion: "1 gelas", calories: 105, protein: 0.0, carbs: 26.0, fat: 0.0, fiber: 0.0, sugar: 25.0, sodium: 10 }
    ],
    timestamp: "2026-08-27T12:30:00.000Z"
  };

  const dinnerMeal = {
    id: "m-dinner-103",
    foodName: "Salmon Salad & Alpukat",
    calories: 800,
    protein: 50,
    carbs: 30,
    fat: 45,
    mealType: "dinner" as any,
    timestamp: "2026-08-27T19:00:00.000Z"
  };

  // Chronological order:
  // 1. Breakfast is logged (500 kcal)
  // 2. Lunch is logged (700 kcal)
  // Day total before correction: 500 + 700 = 1,200 kcal
  dbData.dailyLogs[multiKey] = [breakfastMeal, lunchMeal];

  const beforeCorrectionDailyTotals = getDailyTotals(multiUserPhone, todayStr);
  check(beforeCorrectionDailyTotals.calories === 1200, `Before correction daily total is 1,200 kcal (500 + 700 = ${beforeCorrectionDailyTotals.calories})`);
  check(dbData.dailyLogs[multiKey].length === 2, "Food Journal has 2 logged meals");

  // User corrects the lunch meal (the most recent meal)
  const multiCorrectionResult = await processMealCorrection(
    multiUserPhone,
    "koreksi, nasinya cuma setengah dan tahunya gak makan",
    mockUser,
    todayStr
  );

  check(multiCorrectionResult !== null, "Multi-meal correction processed successfully");
  check(multiCorrectionResult?.mealRecord.id === "12345", "Canonical Lunch meal ID (12345) preserved");
  check(dbData.dailyLogs[multiKey].length === 2, `Food Journal STILL has exactly 2 meals (0 additional entries, got ${dbData.dailyLogs[multiKey].length})`);

  // Verify daily total follows exact formula: DAILY TOTAL = DAILY TOTAL - OLD MEAL TOTAL + NEW MEAL TOTAL
  // 1200 - 700 + multiCorrectionResult.calories
  const afterCorrectionDailyTotals = getDailyTotals(multiUserPhone, todayStr);
  const expectedLunchNewDaily = 1200 - 700 + multiCorrectionResult!.mealRecord.calories;
  check(
    afterCorrectionDailyTotals.calories === expectedLunchNewDaily,
    `Formula DAILY TOTAL = DAILY TOTAL - OLD MEAL TOTAL + NEW MEAL TOTAL: 1200 - 700 + ${multiCorrectionResult!.mealRecord.calories} = ${expectedLunchNewDaily} kcal (got ${afterCorrectionDailyTotals.calories})`
  );
  check(
    afterCorrectionDailyTotals.calories < 1200,
    `Daily total is STRICTLY LESS than 1,200 kcal (NEVER added on top: 1,200 + ${multiCorrectionResult!.mealRecord.calories} is FORBIDDEN)`
  );

  // Verify Breakfast was 100% untouched
  const breakfastAfter = dbData.dailyLogs[multiKey].find((m: any) => m.id === "m-breakfast-101");
  check(breakfastAfter?.calories === 500, "Breakfast meal 100% unchanged (500 kcal)");

  // 3. User later logs Dinner (800 kcal)
  dbData.dailyLogs[multiKey].push(dinnerMeal);
  const finalDayTotals = getDailyTotals(multiUserPhone, todayStr);
  check(
    finalDayTotals.calories === expectedLunchNewDaily + 800,
    `Final day totals with Dinner added is: ${expectedLunchNewDaily} + 800 = ${expectedLunchNewDaily + 800} kcal (got ${finalDayTotals.calories})`
  );
  check(dbData.dailyLogs[multiKey].length === 3, "Food Journal has exactly 3 meals at the end of the day");

  // ── STEP 5: CRITICAL VALIDATION BEFORE SAVING ──
  console.log("\n▶ STEP 5: Critical Validation Before Saving (Refusing to Create Phantom Logs)");

  const fakeNonExistentMeal = {
    ...initialMeal,
    id: "non-existent-log-99999",
    foodName: "Makanan Hantu",
    calories: 999
  };

  const updateResultForNonExistent = updateExistingMealLog(testPhone, fakeNonExistentMeal as any, todayStr);
  check(
    updateResultForNonExistent === false,
    "Critical Validation: updateExistingMealLog returns false when target meal ID does not exist"
  );
  check(
    !dbData.dailyLogs[key].some((m: any) => m.id === "non-existent-log-99999"),
    "Critical Validation: NEVER created a new meal log for non-existent ID"
  );
  check(
    dbData.dailyLogs[key].length === 1,
    "Critical Validation: Food Journal still contains EXACTLY 1 food log entry"
  );

  console.log("\n================================================================================");
  if (allPassed) {
    console.log("🎉 ALL FOOD LOG IN-PLACE UPDATE & CANONICAL LOG ID TESTS PASSED 100%!");
    console.log("================================================================================");
    process.exit(0);
  } else {
    console.error("❌ SOME TESTS FAILED!");
    console.log("================================================================================");
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Fatal error running tests:", err);
  process.exit(1);
});
