import assert from "assert";
import {
  classifyMealIntent,
  generateTomorrowMealSchedule,
  generateWeeklyMealSchedule,
  generateMealRecommendations,
  calculateUserData
} from "../server.js";

async function runMealIntentTests() {
  console.log("================================================================================");
  console.log("TEST SUITE: Meal Intent Classification & Tomorrow/Weekly Meal Plan Generation");
  console.log("================================================================================\n");

  // 1. Test classifyMealIntent for tomorrow queries
  console.log("Test 1: Classifying 'tomorrow' meal queries...");
  const tomorrowQueries = [
    "rekomendasi makan buat besok",
    "rekomendasi makanan besok",
    "menu makan besok apa ya coach",
    "saran makanan untuk besok",
    "rekomendasi sarapan besok",
    "makan siang besok apa ya",
    "menu diet besok pagi siang malam",
    "rekomendasi menu besok"
  ];

  for (const q of tomorrowQueries) {
    const result = classifyMealIntent(q);
    assert.ok(result, `Query '${q}' should be recognized as meal intent`);
    assert.strictEqual(result.isMealIntent, true, `'${q}' isMealIntent must be true`);
    assert.strictEqual(result.scope, "tomorrow", `'${q}' scope must be 'tomorrow'`);
  }
  console.log(`✅ PASS: All ${tomorrowQueries.length} tomorrow meal queries correctly classified.\n`);

  // 2. Test classifyMealIntent for weekly queries
  console.log("Test 2: Classifying 'weekly' meal queries...");
  const weeklyQueries = [
    "jadwal makanan minggu ini",
    "jadwal makan seminggu",
    "menu seminggu",
    "meal plan",
    "saran makan minggu ini",
    "rekomendasi makan seminggu"
  ];

  for (const q of weeklyQueries) {
    const result = classifyMealIntent(q);
    assert.ok(result, `Query '${q}' should be recognized as meal intent`);
    assert.strictEqual(result.isMealIntent, true, `'${q}' isMealIntent must be true`);
    assert.strictEqual(result.scope, "weekly", `'${q}' scope must be 'weekly'`);
  }
  console.log(`✅ PASS: All ${weeklyQueries.length} weekly meal queries correctly classified.\n`);

  // 3. Test classifyMealIntent for today / specific meal queries
  console.log("Test 3: Classifying 'today' meal queries...");
  const todayLunch = classifyMealIntent("rekomendasi makan siang");
  assert.ok(todayLunch && todayLunch.scope === "today");
  assert.strictEqual(todayLunch.mealType, "lunch");

  const todayBreakfast = classifyMealIntent("saran sarapan pagi hari ini");
  assert.ok(todayBreakfast && todayBreakfast.scope === "today");
  assert.strictEqual(todayBreakfast.mealType, "breakfast");

  const todayDinner = classifyMealIntent("rekomendasi makan malam");
  assert.ok(todayDinner && todayDinner.scope === "today");
  assert.strictEqual(todayDinner.mealType, "dinner");
  console.log("✅ PASS: Today meal queries correctly identified with meal types.\n");

  // 4. Test classifyMealIntent ignores non-meal queries
  console.log("Test 4: Non-meal queries return null / isMealIntent: false...");
  assert.strictEqual(classifyMealIntent("workout besok"), null);
  assert.strictEqual(classifyMealIntent("jadwal latihan hari ini"), null);
  assert.strictEqual(classifyMealIntent("halo coach mia"), null);
  console.log("✅ PASS: Workout and greeting queries correctly ignored.\n");

  // 5. Test generateTomorrowMealSchedule content & formatting
  console.log("Test 5: Testing generateTomorrowMealSchedule output...");
  const mockUser = {
    name: "Budi",
    phone: "628111111111",
    weight: 75,
    height: 172,
    gender: "pria",
    goal: "lose",
    persona: "mia",
    plan: "premium_all_access",
    planExpiresAt: new Date(Date.now() + 30 * 86400000).toISOString()
  };
  const userData = calculateUserData(mockUser as any);
  const tomorrowCard = generateTomorrowMealSchedule(userData);

  assert.ok(tomorrowCard.includes("JADWAL MAKAN BESOK"), "Header must indicate tomorrow's meal plan");
  assert.ok(tomorrowCard.includes("SARAPAN"), "Must contain Breakfast recommendation");
  assert.ok(tomorrowCard.includes("MAKAN SIANG"), "Must contain Lunch recommendation");
  assert.ok(tomorrowCard.includes("MAKAN MALAM"), "Must contain Dinner recommendation");
  assert.ok(tomorrowCard.includes("ESTIMASI HARIAN"), "Must contain daily nutrition estimate");
  assert.ok(!tomorrowCard.includes("Sisa Kalori Hari Ini"), "Must NOT display today's consumed/remaining calories for tomorrow's plan");
  console.log("✅ PASS: Tomorrow meal schedule is beautifully formatted and free of today's calorie leakage.\n");

  // 6. Test generateMealRecommendations delegation when user asks for tomorrow
  console.log("Test 6: Testing generateMealRecommendations delegation for tomorrow query...");
  const recResult = generateMealRecommendations(userData, "628111111111", "rekomendasi makan buat besok");
  assert.ok(recResult.includes("JADWAL MAKAN BESOK"), "Delegates to tomorrow meal schedule");
  assert.ok(!recResult.includes("Sisa Kalori Hari Ini"), "Must not leak today's totals");
  console.log("✅ PASS: generateMealRecommendations correctly routed to tomorrow plan.\n");

  // 7. Test generateMealRecommendations delegation when user asks for weekly
  console.log("Test 7: Testing generateMealRecommendations delegation for weekly query...");
  const recWeekly = generateMealRecommendations(userData, "628111111111", "jadwal makanan minggu ini");
  assert.ok(recWeekly.includes("JADWAL MAKAN MINGGUAN PERSONAL"), "Delegates to weekly meal schedule");
  console.log("✅ PASS: generateMealRecommendations correctly routed to weekly plan.\n");

  console.log("================================================================================");
  console.log("ALL MEAL INTENT & SCHEDULE TESTS PASSED! 🥗✨");
  console.log("================================================================================\n");
}

runMealIntentTests().catch(err => {
  console.error("Test failure:", err);
  process.exit(1);
});
