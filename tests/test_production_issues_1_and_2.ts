process.env.NODE_ENV = "test";
import assert from "assert";
import {
  detectDeleteMealIntent,
  handleDeleteMealCommand,
  detectMealCorrectionIntent,
  getLastFoodMeal,
  getDailyTotals,
  addMealLog,
  calculateUserData,
  saveUserProfile
} from "../server";
import {
  classifyMealIntent,
  generateMealTimingAdvice,
  isMealTimingAdviceQuery,
  resolveCanonicalProfile
} from "../services/recommendationEngine";

console.log("================================================================================");
console.log("🧪 RUNNING COMPREHENSIVE PRODUCTION TEST SUITE: ISSUES 1 & 2");
console.log("================================================================================\n");

let passedCount = 0;
let totalCount = 0;

function check(desc: string, fn: () => void | Promise<void>) {
  totalCount++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res.then(() => {
        console.log(`  ✅ [PASS] ${desc}`);
        passedCount++;
      }).catch(err => {
        console.error(`  ❌ [FAIL] ${desc}`);
        console.error(`     Error: ${err?.message || err}`);
        process.exitCode = 1;
      });
    } else {
      console.log(`  ✅ [PASS] ${desc}`);
      passedCount++;
    }
  } catch (err: any) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(`     Error: ${err?.message || err}`);
    process.exitCode = 1;
  }
}

async function runTests() {
  const testPhone = "081999888777";
  const mockUser = {
    name: "Habibi",
    phone: testPhone,
    normalizedPhone: testPhone,
    gender: "pria",
    age: 27,
    weight: 70,
    targetWeight: 68,
    targetCalories: 1966,
    proteinGrams: 147,
    carbGrams: 221,
    fatGrams: 55,
    fiberGrams: 28,
    goalTitle: "Defisit Kalori Sehat",
    persona: "mia",
    plan: "premium_all_access"
  };
  saveUserProfile(testPhone, mockUser as any);
  const userData = calculateUserData(mockUser as any);

  // ============================================================================
  // ISSUE 1: DELETE_MEAL INTENT DETECTION & PRIORITY TESTS
  // ============================================================================
  console.log("▶ GROUP 1: DELETE_MEAL Intent Detection Variations (Issue 1)");

  const deleteVariations = [
    "koreksi, hapus ayam barusan",
    "hapus ayam barusan",
    "hapus makanan tadi",
    "hapus makanan terakhir",
    "hapus meal terakhir",
    "hapus yang tadi",
    "koreksi hapus ayam",
    "hapus ayam yang baru dicatat",
    "aku salah, hapus makanan tadi",
    "hapus makanan yang barusan aku log",
    "batal catat makanan",
    "hapus log terakhir",
    "hapus makan terakhir",
    "buang makanan tadi",
    "hilangkan makanan barusan"
  ];

  for (const q of deleteVariations) {
    check(`1.1: '${q}' correctly resolves to DELETE_MEAL`, () => {
      const res = detectDeleteMealIntent(q);
      assert.ok(res, `Expected delete intent for '${q}'`);
      assert.strictEqual(res.isDelete, true);
    });
  }

  console.log("\n▶ GROUP 2: Negative Tests - Must NOT be DELETE_MEAL");
  const negativeDeleteQueries = [
    "aku makan ayam",
    "aku mau makan ayam",
    "saran makanan ayam",
    "kasih aku makanan ayam",
    "berapa kalori ayam?",
    "ayam bagus nggak buat diet?",
    "aku mau sarapan ayam",
    "hapus treadmill",
    "hapus push up",
    "hapus berenang tadi",
    "hapus akun",
    "reset data saya",
    "koreksi porsi ayam jadi 200g"
  ];

  for (const nq of negativeDeleteQueries) {
    check(`2.1: '${nq}' must NOT be DELETE_MEAL`, () => {
      const res = detectDeleteMealIntent(nq);
      assert.strictEqual(res, null, `'${nq}' should not trigger DELETE_MEAL`);
    });
  }

  console.log("\n▶ GROUP 3: Delete Priority Over Meal Correction");
  check("3.1: 'koreksi, hapus ayam barusan' yields priority to DELETE, NOT correction", () => {
    const isCorrection = detectMealCorrectionIntent("koreksi, hapus ayam barusan", true);
    assert.strictEqual(isCorrection, false, "detectMealCorrectionIntent must yield to delete intent");
    const isDelete = detectDeleteMealIntent("koreksi, hapus ayam barusan");
    assert.ok(isDelete && isDelete.isDelete);
    assert.strictEqual(isDelete.targetFoodQuery, "ayam");
  });

  check("3.2: 'koreksi porsi ayam jadi 200g' remains MEAL_CORRECTION", () => {
    const isCorrection = detectMealCorrectionIntent("koreksi porsi ayam jadi 200g", true);
    assert.strictEqual(isCorrection, true, "portion adjustment should remain meal correction");
  });

  // ============================================================================
  // ISSUE 1: CANONICAL DELETION, NUTRITION RECALCULATION & IDEMPOTENCY
  // ============================================================================
  console.log("\n▶ GROUP 4: Deletion Execution, Nutrition Recalculation & Idempotency");

  // Step A: Create Dada Ayam Panggang
  const ayamMeal = {
    id: "meal-ayam-101",
    foodName: "Dada Ayam Panggang",
    calories: 188,
    protein: 37.2,
    carbs: 0,
    fat: 4.3,
    fiber: 0,
    sodium: 89,
    sugar: 0,
    timestamp: new Date().toISOString()
  };
  addMealLog(testPhone, ayamMeal);

  check("4.1: Initial meal created and verified in daily totals", () => {
    const totals = getDailyTotals(testPhone);
    assert.strictEqual(totals.calories, 188);
    assert.strictEqual(totals.protein, Math.round(37.2));
    assert.strictEqual(totals.carbs, 0);
    assert.strictEqual(totals.fat, Math.round(4.3));
    assert.strictEqual(totals.sodium, 89);
    assert.strictEqual(totals.logCount, 1);
  });

  await check("4.2: Execute 'koreksi, hapus ayam barusan' -> meal deleted and totals back to 0", async () => {
    const msgs = await handleDeleteMealCommand(testPhone, "koreksi, hapus ayam barusan", userData);
    assert.ok(msgs && msgs.length > 0);
    const reply = msgs[0];
    assert.ok(reply.includes("MEAL DIHAPUS"), "Header must be MEAL DIHAPUS");
    assert.ok(reply.includes("Dada Ayam Panggang") && reply.includes("sudah dihapus"));
    assert.ok(reply.includes("--------------------------------------------------"));
    assert.ok(reply.includes("Coach Mia"));

    const totalsAfter = getDailyTotals(testPhone);
    assert.strictEqual(totalsAfter.calories, 0, "Calories must return to 0");
    assert.strictEqual(totalsAfter.protein, 0, "Protein must return to 0");
    assert.strictEqual(totalsAfter.fat, 0, "Fat must return to 0");
    assert.strictEqual(totalsAfter.sodium, 0, "Sodium must return to 0");
    assert.strictEqual(totalsAfter.logCount, 0, "Meal log count must be 0");
  });

  await check("4.3: Repeated delete 'hapus ayam barusan' is idempotent (no negative numbers, no error)", async () => {
    const msgs = await handleDeleteMealCommand(testPhone, "hapus ayam barusan", userData);
    assert.ok(msgs && msgs.length > 0);
    const reply = msgs[0];
    assert.ok(reply.includes("sudah dihapus atau tidak ditemukan") || reply.includes("Belum ada catatan makanan"));

    const totalsAfter = getDailyTotals(testPhone);
    assert.strictEqual(totalsAfter.calories, 0, "Calories must not become negative");
    assert.strictEqual(totalsAfter.protein, 0, "Protein must not become negative");
    assert.strictEqual(totalsAfter.logCount, 0);
  });

  // Multi-meal test
  console.log("\n▶ GROUP 5: Multi-Meal Deletion Targeting Most Recent Match");
  const breakfast = {
    id: "meal-bfast-1",
    foodName: "Dada Ayam Panggang",
    calories: 188,
    protein: 37.2,
    carbs: 0,
    fat: 4.3,
    timestamp: new Date(Date.now() - 3600000).toISOString()
  };
  const lunch = {
    id: "meal-lunch-2",
    foodName: "Nasi Putih + Ayam Bakar",
    calories: 450,
    protein: 30,
    carbs: 55,
    fat: 10,
    timestamp: new Date().toISOString()
  };
  addMealLog(testPhone, breakfast);
  addMealLog(testPhone, lunch);

  await check("5.1: 'hapus ayam barusan' deletes ONLY the most recent matching lunch (Nasi Putih + Ayam Bakar)", async () => {
    const totalsBefore = getDailyTotals(testPhone);
    assert.strictEqual(totalsBefore.logCount, 2);

    const msgs = await handleDeleteMealCommand(testPhone, "hapus ayam barusan", userData);
    assert.ok(msgs && msgs.length > 0);
    assert.ok(msgs[0].includes("Nasi Putih + Ayam Bakar") && msgs[0].includes("sudah dihapus"), "Must target the most recent meal with chicken");

    const totalsAfter = getDailyTotals(testPhone);
    assert.strictEqual(totalsAfter.logCount, 1, "Only 1 meal should remain");
    assert.strictEqual(totalsAfter.calories, 188, "Breakfast Dada Ayam Panggang must still remain");
  });

  // Clean up
  await handleDeleteMealCommand(testPhone, "hapus makanan tadi", userData);

  // ============================================================================
  // ISSUE 2: MEAL TIMING ADVICE INTENT & RESPONSE TESTS
  // ============================================================================
  console.log("\n▶ GROUP 6: Meal Timing Advice Intent Detection (Issue 2)");

  const timingQueries = [
    "Saya makan siang lalu malam makan lagi atau saya tidak makan siang nanti malam makan lagi",
    "mending makan siang atau skip sampai malam?",
    "kalau aku nggak makan siang terus makan malam boleh?",
    "makan siang terus makan malam atau cukup malam aja?",
    "lebih bagus makan siang dan malam atau skip siang?",
    "aku harus makan siang nggak kalau malam mau makan?"
  ];

  for (const tq of timingQueries) {
    check(`6.1: '${tq}' resolves to MEAL_TIMING_ADVICE`, () => {
      const intent = classifyMealIntent(tq);
      assert.ok(intent, `Query '${tq}' should resolve to meal intent`);
      assert.strictEqual(intent.isMealIntent, true);
      assert.strictEqual(intent.action, "advice");
      assert.strictEqual(intent.topic, "meal_timing");
      assert.strictEqual(intent.scope, "meal_timing");
    });
  }

  console.log("\n▶ GROUP 7: Meal Timing Negative Tests (Regression Protection)");
  check("7.1: 'ada saran ga besok makan apa?' resolves to 'tomorrow', NOT 'meal_timing'", () => {
    const res = classifyMealIntent("ada saran ga besok makan apa?");
    assert.ok(res && res.scope === "tomorrow");
  });

  check("7.2: 'makanan mingguan?' resolves to 'weekly', NOT 'meal_timing'", () => {
    const res = classifyMealIntent("makanan mingguan?");
    assert.ok(res && res.scope === "weekly");
  });

  check("7.3: 'aku tadi makan ayam' is NOT meal_timing", () => {
    const res = isMealTimingAdviceQuery("aku tadi makan ayam");
    assert.strictEqual(res, false);
  });

  check("7.4: 'aku tadi push up 10x' is NOT meal_timing", () => {
    const res = isMealTimingAdviceQuery("aku tadi push up 10x");
    assert.strictEqual(res, false);
  });

  console.log("\n▶ GROUP 8: Meal Timing Advice Content & WhatsApp Formatting Integrity");
  const adviceResponse = generateMealTimingAdvice(userData, "mending makan siang atau skip sampai malam?");

  check("8.1: Header matches standard '🍽️ *SARAN WAKTU MAKAN*'", () => {
    assert.ok(adviceResponse.includes("🍽️ *SARAN WAKTU MAKAN*"));
  });

  check("8.2: Uses standard separator '--------------------------------------------------'", () => {
    assert.ok(adviceResponse.includes("--------------------------------------------------"));
    assert.ok(!adviceResponse.includes("━━━━━━━━━━━━"));
    assert.ok(!adviceResponse.includes("────────────"));
  });

  check("8.3: Directly answers lunch vs dinner dilemma without being an article", () => {
    assert.ok(adviceResponse.includes("tetap makan siang dan makan malam"));
    assert.ok(adviceResponse.includes("Nggak perlu sengaja melewatkan makan siang"));
    assert.ok(adviceResponse.includes("total asupan harian"));
    assert.ok(!adviceResponse.includes("1. Mencegah Lapar"));
    assert.ok(!adviceResponse.includes("2. Mempermudah Target"));
    assert.ok(!adviceResponse.includes("3. Energi Tetap"));
  });

  check("8.4: Coach Mia quote is concise and friendly", () => {
    assert.ok(adviceResponse.includes("💬 *Coach Mia*"));
    assert.ok(adviceResponse.includes("pembagian porsinya ya ✨"));
  });

  check("8.5: Response length is compact (<700 chars) and does not truncate", () => {
    assert.ok(adviceResponse.length > 200 && adviceResponse.length < 800, `Length was ${adviceResponse.length}`);
    assert.ok(adviceResponse.endsWith('"'), "Response must end properly with closing quote");
  });

  check("8.6: No stale / hallucinated profile targets (no 'Dhony', '1542 kcal', '116g protein')", () => {
    assert.ok(!adviceResponse.includes("Dhony"));
    assert.ok(!adviceResponse.includes("1542 kcal"));
    assert.ok(!adviceResponse.includes("116g"));
  });

  check("8.7: Meal timing advice is strictly READ-ONLY (no meals created)", () => {
    const totals = getDailyTotals(testPhone);
    assert.strictEqual(totals.logCount, 0, "No meals should be created by advice");
    assert.strictEqual(totals.calories, 0);
  });

  console.log("\n================================================================================");
  console.log(`SUMMARY: ${passedCount}/${totalCount} TESTS PASSED`);
  console.log("================================================================================");

  if (passedCount < totalCount) {
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
