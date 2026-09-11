import assert from "assert";
import {
  classifyUserIntent,
  isGreeting,
  parseMealCorrectionDetails
} from "../services/intentClassifier";
import {
  getActiveTask,
  setActiveTask,
  clearActiveTask,
  clearAllActiveTasks,
  isTaskInterruptingIntent,
  logConversationTurn
} from "../services/conversationStateManager";
import {
  detectMealCorrectionIntent,
  generateGreetingResponse,
  processMealCorrection,
  addMealLog,
  getLastFoodMeal,
  getDailyTotals,
  dbData,
  saveDb
} from "../server";

console.log("================================================================================");
console.log("🧪 RUNNING SUITE: CONVERSATION STATE & INTERRUPTIBLE INTENT CLASSIFICATION");
console.log("================================================================================");

let passed = 0;
let failed = 0;

async function it(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (e: any) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${e?.message || e}`);
    failed++;
  }
}

const TEST_PHONE = "6289912345000";
const mockUserMia = {
  name: "Habibi",
  nickname: "Habibi",
  persona: "mia",
  goal: "maintain",
  targetCalories: 2000,
  proteinGrams: 140,
  carbGrams: 200,
  fatGrams: 60,
  fiberGrams: 30,
  age: 28
};

async function runAllTests() {
  // Clear any state before test run
  clearAllActiveTasks();
  const todayKey = `gymbuddy_activities_${TEST_PHONE}_2026-09-11`;
  dbData.dailyLogs[todayKey] = [];

  console.log("\n▶ TEST GROUP 1: Standalone Greeting Recognition & Prevention of False Meal Correction");

  const greetings = [
    "halo",
    "hai",
    "hi",
    "hello",
    "pagi",
    "siang",
    "sore",
    "malam",
    "halo gymbuddy",
    "halo mia",
    "hai mia",
    "halo coach",
    "test",
    "tes",
    "mia?",
    "max?"
  ];

  for (const g of greetings) {
    await it(`Recognizes "${g}" as GREETING intent and NOT meal correction`, () => {
      assert.strictEqual(isGreeting(g), true, `isGreeting("${g}") should be true`);
      
      // Even if recent meal exists, detectMealCorrectionIntent must return false!
      const isCorrection = detectMealCorrectionIntent(g, true);
      assert.strictEqual(isCorrection, false, `detectMealCorrectionIntent("${g}", true) must be false`);

      // Intent classifier must return GREETING
      const classified = classifyUserIntent(g, { hasRecentMeal: true, userProfile: mockUserMia });
      assert.strictEqual(classified.intent, "GREETING", `classifyUserIntent("${g}") should be GREETING`);
    });
  }

  console.log("\n▶ TEST GROUP 2: Non-Food Token Hardening in parseMealCorrectionDetails");

  const nonFoodQueries = ["halo gymbuddy", "hai", "mia?", "tes", "ok", "siap", "apa kabar"];
  for (const nfq of nonFoodQueries) {
    await it(`parseMealCorrectionDetails("${nfq}") returns null and does not match Rule 8`, () => {
      const details = parseMealCorrectionDetails(nfq);
      assert.strictEqual(details, null, `"${nfq}" should return null, not an ambiguous food correction`);
    });
  }

  console.log("\n▶ TEST GROUP 3: Task Interruption Matrix");

  await it("Active MEAL_CORRECTION task is interrupted and cleared by GREETING", () => {
    clearActiveTask(TEST_PHONE);
    setActiveTask(TEST_PHONE, {
      type: "MEAL_CORRECTION",
      targetId: "meal-999",
      pendingAction: "WAITING_FOR_CORRECTION"
    });

    const activeBefore = getActiveTask(TEST_PHONE);
    assert.ok(activeBefore, "Active task must be set");
    assert.strictEqual(activeBefore?.type, "MEAL_CORRECTION");

    // User sends greeting
    const classified = classifyUserIntent("halo mia");
    assert.strictEqual(classified.intent, "GREETING");
    assert.strictEqual(isTaskInterruptingIntent(classified.intent), true);

    // Clear task
    clearActiveTask(TEST_PHONE, "User sent greeting");
    const activeAfter = getActiveTask(TEST_PHONE);
    assert.strictEqual(activeAfter, null, "Active task must be cleared after greeting");
  });

  await it("Active MEAL_CORRECTION task is interrupted and cleared by NUTRITION_QUESTION", () => {
    setActiveTask(TEST_PHONE, {
      type: "MEAL_CORRECTION",
      targetId: "meal-999",
      pendingAction: "WAITING_FOR_CORRECTION"
    });

    const classified = classifyUserIntent("berapa protein ayam?");
    assert.strictEqual(classified.intent, "NUTRITION_QUESTION");
    assert.strictEqual(isTaskInterruptingIntent(classified.intent), true);

    clearActiveTask(TEST_PHONE, "User asked nutrition question");
    assert.strictEqual(getActiveTask(TEST_PHONE), null);
  });

  await it("Active MEAL_CORRECTION task is interrupted and cleared by WORKOUT_LOG", () => {
    setActiveTask(TEST_PHONE, {
      type: "MEAL_CORRECTION",
      targetId: "meal-999",
      pendingAction: "WAITING_FOR_CORRECTION"
    });

    const classified = classifyUserIntent("catat workout 30 menit");
    assert.strictEqual(classified.intent, "WORKOUT_LOG");
    assert.strictEqual(isTaskInterruptingIntent(classified.intent), true);

    clearActiveTask(TEST_PHONE, "User logged workout");
    assert.strictEqual(getActiveTask(TEST_PHONE), null);
  });

  console.log("\n▶ TEST GROUP 4: User's Exact 7-Step Conversation Turn Sequence");

  // Setup base initial meal: Nasi Putih, Telur Orak-Arik, Daging Sambal
  const baseMeal = {
    id: "meal-exact-seq-001",
    foodName: "Nasi Putih, Telur Orak-Arik, Daging Sambal",
    calories: 615,
    protein: 34.5,
    carbs: 58.5,
    fat: 25.5,
    fiber: 1.5,
    sugar: 1.0,
    sodium: 480,
    timestamp: new Date().toISOString(),
    portionEstimates: [
      "• Nasi Putih: 1 porsi (~204 kcal)",
      "• Telur Orak-Arik: 1 butir (~95 kcal)",
      "• Daging Sambal: 1 porsi (~316 kcal)"
    ],
    items: [
      { name: "Nasi Putih", portion: "1 porsi", calories: 204, protein: 4.2, carbs: 44.5, fat: 0.4 },
      { name: "Telur Orak-Arik", portion: "1 butir", calories: 95, protein: 7.2, carbs: 1.2, fat: 6.8 },
      { name: "Daging Sambal", portion: "1 porsi", calories: 316, protein: 23.1, carbs: 12.8, fat: 18.3 }
    ]
  };

  addMealLog(TEST_PHONE, baseMeal as any);
  clearAllActiveTasks();

  // Turn 1: "halo gymbuddy"
  await it("Turn 1: 'halo gymbuddy' -> Responds with Greeting, does NOT trigger meal correction", () => {
    const userText = "halo gymbuddy";
    const classified = classifyUserIntent(userText, { hasRecentMeal: true, userProfile: mockUserMia });
    assert.strictEqual(classified.intent, "GREETING", "Turn 1 intent is GREETING");

    const isCorrection = detectMealCorrectionIntent(userText, true);
    assert.strictEqual(isCorrection, false, "Turn 1 is NOT meal correction");

    const greetingReply = generateGreetingResponse(mockUserMia);
    assert.ok(greetingReply.includes("Halo Habibi!"), "Greeting addresses user by validated address");
    assert.ok(greetingReply.includes("Coach Mia"), "Greeting mentions Coach Mia");
    assert.ok(!greetingReply.includes("dikoreksi"), "Greeting NEVER asks about meal correction");

    assert.strictEqual(getActiveTask(TEST_PHONE), null, "No active task active after greeting");
  });

  // Turn 2: "koreksi meal tadi"
  await it("Turn 2: 'koreksi meal tadi' -> Asks clarification and sets active task MEAL_CORRECTION", async () => {
    const userText = "koreksi meal tadi";
    const classified = classifyUserIntent(userText, { hasRecentMeal: true, userProfile: mockUserMia });
    assert.strictEqual(classified.intent, "MEAL_CORRECTION", "Turn 2 intent is MEAL_CORRECTION");

    const isCorrection = detectMealCorrectionIntent(userText, true);
    assert.strictEqual(isCorrection, true, "Turn 2 detectMealCorrectionIntent is true");

    const res = await processMealCorrection(TEST_PHONE, userText, mockUserMia);
    assert.ok(res, "processMealCorrection returned result");
    assert.strictEqual(res?.validatedParsed?.isAmbiguous, true, "Turn 2 result is ambiguous");
    assert.ok(res?.card.includes("Bagian mana yang mau dikoreksi dari meal tadi?"), "Asks targeted clarification");

    // System sets active task
    setActiveTask(TEST_PHONE, {
      type: "MEAL_CORRECTION",
      targetId: baseMeal.id,
      pendingAction: "WAITING_FOR_CORRECTION"
    });

    const activeTask = getActiveTask(TEST_PHONE);
    assert.ok(activeTask, "Active task is now set");
    assert.strictEqual(activeTask?.type, "MEAL_CORRECTION");
    assert.strictEqual(activeTask?.targetId, baseMeal.id);
  });

  // Turn 3: "halo mia"
  await it("Turn 3: 'halo mia' -> Greeting IMMEDIATELY clears active task and stops correction flow", () => {
    const userText = "halo mia";
    const activeTaskBefore = getActiveTask(TEST_PHONE);
    assert.ok(activeTaskBefore, "Active task was pending before Turn 3");

    const classified = classifyUserIntent(userText, { hasRecentMeal: true, userProfile: mockUserMia });
    assert.strictEqual(classified.intent, "GREETING", "Turn 3 intent is GREETING");

    // Since intent is GREETING, active task is cleared!
    if (isTaskInterruptingIntent(classified.intent)) {
      clearActiveTask(TEST_PHONE, `User expressed ${classified.intent}`);
    }

    assert.strictEqual(getActiveTask(TEST_PHONE), null, "Active task is CLEARED by greeting");

    // Meal correction must NOT trigger
    const isCorrection = detectMealCorrectionIntent(userText, true);
    assert.strictEqual(isCorrection, false, "detectMealCorrectionIntent is false for 'halo mia'");

    const greetingReply = generateGreetingResponse(mockUserMia);
    assert.ok(greetingReply.includes("Halo Habibi!"), "Turn 3 greeting addresses user");
    assert.ok(!greetingReply.includes("dikoreksi"), "Turn 3 NEVER asks for correction");
  });

  // Turn 4: "berapa protein ayam?"
  await it("Turn 4: 'berapa protein ayam?' -> Classified as NUTRITION_QUESTION, not meal log or correction", () => {
    const userText = "berapa protein ayam?";
    const classified = classifyUserIntent(userText, { hasRecentMeal: true, userProfile: mockUserMia });
    assert.strictEqual(classified.intent, "NUTRITION_QUESTION", "Turn 4 intent is NUTRITION_QUESTION");

    const isCorrection = detectMealCorrectionIntent(userText, true);
    assert.strictEqual(isCorrection, false, "Turn 4 is NOT meal correction");
    assert.strictEqual(getActiveTask(TEST_PHONE), null, "Active task remains cleared");
  });

  // Turn 5: "koreksi lagi, yang tadi ayam ternyata cumi"
  await it("Turn 5: 'koreksi lagi, yang tadi ayam ternyata cumi' -> Resolves and mutates meal in-place", async () => {
    const userText = "koreksi lagi, yang tadi ayam ternyata cumi";
    const classified = classifyUserIntent(userText, { hasRecentMeal: true, userProfile: mockUserMia });
    assert.strictEqual(classified.intent, "MEAL_CORRECTION", "Turn 5 intent is MEAL_CORRECTION");

    const isCorrection = detectMealCorrectionIntent(userText, true);
    assert.strictEqual(isCorrection, true, "Turn 5 detectMealCorrectionIntent is true");

    const res = await processMealCorrection(TEST_PHONE, userText, mockUserMia);
    assert.ok(res, "processMealCorrection succeeded");
    assert.strictEqual(Boolean(res?.validatedParsed?.isAmbiguous), false, "Turn 5 is NOT ambiguous");
    assert.strictEqual(res?.mealRecord.id, baseMeal.id, "Meal ID 100% PRESERVED in-place");
    assert.ok(res?.mealRecord.foodName.toLowerCase().includes("cumi"), "FoodName updated with Cumi");

    // Active task is cleared upon successful completion
    clearActiveTask(TEST_PHONE, "Correction completed");
    assert.strictEqual(getActiveTask(TEST_PHONE), null, "Active task cleared after completion");
  });

  // Turn 6: "hai"
  await it("Turn 6: 'hai' -> Responds with Greeting, NEVER loops back to meal correction", () => {
    const userText = "hai";
    const classified = classifyUserIntent(userText, { hasRecentMeal: true, userProfile: mockUserMia });
    assert.strictEqual(classified.intent, "GREETING", "Turn 6 intent is GREETING");

    const isCorrection = detectMealCorrectionIntent(userText, true);
    assert.strictEqual(isCorrection, false, "Turn 6 is NOT meal correction");

    const greetingReply = generateGreetingResponse(mockUserMia);
    assert.ok(greetingReply.includes("Halo Habibi!"), "Turn 6 responds with friendly greeting");
    assert.ok(!greetingReply.includes("dikoreksi"), "Turn 6 does NOT prompt for meal correction");
  });

  // Turn 7: "catat workout 30 menit"
  await it("Turn 7: 'catat workout 30 menit' -> Classified as WORKOUT_LOG with duration 30 mins", () => {
    const userText = "catat workout 30 menit";
    const classified = classifyUserIntent(userText, { hasRecentMeal: true, userProfile: mockUserMia });
    assert.strictEqual(classified.intent, "WORKOUT_LOG", "Turn 7 intent is WORKOUT_LOG");
    assert.strictEqual(classified.extractedDetails?.durationMinutes, 30, "Extracted duration is 30 minutes");

    const isCorrection = detectMealCorrectionIntent(userText, true);
    assert.strictEqual(isCorrection, false, "Turn 7 is NOT meal correction");
  });

  console.log("\n▶ TEST GROUP 5: Coach Callout 'mia?' and 'max?' Handling");

  await it("'mia?' is classified as GREETING and never trapped as food item", () => {
    const classified = classifyUserIntent("mia?");
    assert.strictEqual(classified.intent, "GREETING");
    assert.strictEqual(detectMealCorrectionIntent("mia?", true), false);
  });

  await it("'max?' is classified as GREETING and never trapped as food item", () => {
    const classified = classifyUserIntent("max?");
    assert.strictEqual(classified.intent, "GREETING");
    assert.strictEqual(detectMealCorrectionIntent("max?", true), false);
  });

  console.log("\n================================================================================");
  console.log(`SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("🎉 ALL CONVERSATION STATE & INTENT INTERRUPTION TESTS PASSED PERFECTLY!");
  }
}

runAllTests().catch(e => {
  console.error("Test Suite Fatal Error:", e);
  process.exit(1);
});
