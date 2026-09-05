process.env.NODE_ENV = "test";
import assert from "assert";
import {
  classifyMealType,
  isSmartSnack,
  getMealTypeLabel
} from "../services/mealClassifier";
import {
  buildSingleSourceOfTruthMealRecord,
  formatNutritionCard,
  splitWhatsAppMessage,
  sanitizeWhatsAppResponse,
  resolveCleanFoodNameAndMealType
} from "../server";

console.log("================================================================================");
console.log("🧪 RUNNING SUITE: END-TO-END WHATSAPP MEAL LOGGING & FORMATTING FLOW");
console.log("================================================================================\n");

let passedCount = 0;
let totalCount = 0;

function check(desc: string, fn: () => void) {
  totalCount++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passedCount++;
  } catch (err: any) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(`     Error: ${err?.message || err}`);
    process.exitCode = 1;
  }
}

const mockUserData = {
  name: "Habibi",
  gender: "pria",
  age: 26,
  ageGroup: "Dewasa",
  weight: 72,
  targetCalories: 2000,
  proteinGrams: 140,
  carbGrams: 230,
  fatGrams: 60,
  persona: "mia",
  goalTitle: "Maintenance"
} as any;

const mockDailyTotals = {
  calories: 1450,
  protein: 105,
  carbs: 165,
  fat: 45,
  sodium: 1200,
  sugar: 20
} as any;

// ── GROUP 1: Smart Snack vs Main Meal Classification ──────────────────────────
console.log("▶ GROUP 1: Smart Snack vs Main Meal Classification");

check("1.1: 'Harvest Oatmeal Raisin Cookies' at 13:58 classifies as 'snack' (not lunch)", () => {
  const result = classifyMealType({
    foodName: "Harvest Oatmeal Raisin Cookies",
    timeOrDate: "13:58"
  });
  assert.strictEqual(result, "snack", `Expected snack, got ${result}`);
});

check("1.2: 'Gyukatsu Set, White Rice, Onsen Tamago & Miso Soup' at 18:16 classifies as 'dinner'", () => {
  const result = classifyMealType({
    foodName: "Gyukatsu Set, White Rice, Onsen Tamago & Miso Soup",
    timeOrDate: "18:16"
  });
  assert.strictEqual(result, "dinner", `Expected dinner, got ${result}`);
});

check("1.3: 'Chiki' at 19:35 classifies as 'snack' (smart snack override in dinner window)", () => {
  const result = classifyMealType({
    foodName: "Chiki",
    timeOrDate: "19:35"
  });
  assert.strictEqual(result, "snack", `Expected snack, got ${result}`);
});

check("1.4: '2 butir telur rebus' at 19:35 classifies as 'snack' (standalone egg override)", () => {
  const result = classifyMealType({
    foodName: "2 butir telur rebus",
    timeOrDate: "19:35"
  });
  assert.strictEqual(result, "snack", `Expected snack, got ${result}`);
});

check("1.5: 'Nasi Padang' at 19:35 classifies as 'dinner' (complete meal in dinner window)", () => {
  const result = classifyMealType({
    foodName: "Nasi Padang",
    timeOrDate: "19:35"
  });
  assert.strictEqual(result, "dinner", `Expected dinner, got ${result}`);
});

// ── GROUP 2: Single Source of Truth & Label Consistency ───────────────────────
console.log("\n▶ GROUP 2: Single Source of Truth & WhatsApp Response Header Consistency");

check("2.1: Single Source of Truth Meal Record for Cookies resolves to 'snack'", () => {
  const parsed = {
    foodName: "Harvest Oatmeal Raisin Cookies",
    calories: 220,
    protein: 4,
    carbs: 32,
    fat: 9,
    fiber: 2,
    sugar: 14,
    sodium: 110,
    timeOrDate: "13:58"
  };
  const { mealRecord, validatedParsed } = buildSingleSourceOfTruthMealRecord(
    "Harvest Oatmeal Raisin Cookies",
    parsed,
    false
  );
  assert.strictEqual(mealRecord.mealType, "snack");
  assert.strictEqual(validatedParsed.mealType.toLowerCase(), "snack");
});

check("2.2: WhatsApp Card for Cookies displays '🍪 SNACK' and food name", () => {
  const parsed = {
    canonicalMealTitle: "Harvest Oatmeal Raisin Cookies",
    foodName: "Harvest Oatmeal Raisin Cookies",
    calories: 220,
    protein: 4,
    carbs: 32,
    fat: 9,
    fiber: 2,
    sugar: 14,
    sodium: 110,
    mealType: "Snack"
  };
  const card = formatNutritionCard(parsed, "Teks", mockUserData, mockDailyTotals);
  assert(card.includes("🍪 SNACK"), "Must contain '🍪 SNACK' header");
  assert(card.includes("Harvest Oatmeal Raisin Cookies"), "Must contain food title");
});

check("2.3: WhatsApp Card for Gyukatsu Set displays '🍽️ MAKAN MALAM' and food name", () => {
  const parsed = {
    canonicalMealTitle: "Gyukatsu Set, Nasi Putih, Onsen Tamago & Sup Miso",
    foodName: "Gyukatsu Set, Nasi Putih, Onsen Tamago & Sup Miso",
    calories: 780,
    protein: 45,
    carbs: 72,
    fat: 32,
    fiber: 4,
    sugar: 3,
    sodium: 1250,
    mealType: "Dinner"
  };
  const card = formatNutritionCard(parsed, "Foto", mockUserData, mockDailyTotals);
  assert(card.includes("🍽️ MAKAN MALAM"), "Must contain '🍽️ MAKAN MALAM' header");
  assert(card.includes("Gyukatsu Set, Nasi Putih, Onsen Tamago & Sup Miso"), "Must contain food title");
});

// ── GROUP 3: Coach Mia Context Awareness ──────────────────────────────────────
console.log("\n▶ GROUP 3: Coach Mia Context Awareness (No 'nanti malam' for Dinner)");

check("3.1: Dinner card coach advice does NOT mention 'nanti malam'", () => {
  const parsed = {
    canonicalMealTitle: "Gyukatsu Set",
    foodName: "Gyukatsu Set",
    calories: 780,
    protein: 45,
    carbs: 72,
    fat: 32,
    fiber: 4,
    sugar: 3,
    sodium: 1250,
    mealType: "Dinner",
    coachComment: "Pilihan bagus! Nanti malam pastikan minum air putih ya."
  };
  const card = formatNutritionCard(parsed, "Foto", mockUserData, mockDailyTotals);
  assert(!card.toLowerCase().includes("nanti malam"), "Must not say 'nanti malam' when dinner is already logged");
});

check("3.2: Dinner fallback advice acknowledges meal as dinner or evening rest", () => {
  const parsed = {
    canonicalMealTitle: "Gyukatsu Set",
    foodName: "Gyukatsu Set",
    calories: 780,
    protein: 45,
    carbs: 72,
    fat: 32,
    fiber: 4,
    sugar: 3,
    sodium: 1250,
    mealType: "Dinner"
  };
  const card = formatNutritionCard(parsed, "Foto", mockUserData, mockDailyTotals);
  assert(card.toLowerCase().includes("makan malam") || card.toLowerCase().includes("istirahat"), "Fallback should mention makan malam or istirahat");
});

// ── GROUP 4: Separator Rendering & Sanitization ───────────────────────────────
console.log("\n▶ GROUP 4: Separator Rendering & Sanitization");

check("4.1: splitWhatsAppMessage does NOT break '━━━━━━━━━━━━━━' into single '━' characters", () => {
  const longCard = `🍽️ MAKAN MALAM
*Gyukatsu Set, Nasi Putih, Onsen Tamago & Sup Miso*

🕒 4 Sep 2026, 18.16 WIB · 🤖 AI: 92%

━━━━━━━━━━━━━━
📊 *REKAP NUTRISI*
━━━━━━━━━━━━━━
🔥 *780 kcal*

Distribusi Makro (% kalori):
🍖 *Protein*: 45g · 24% kalori
🍚 *Karbo*: 72g · 38% kalori
🥓 *Lemak*: 32g · 38% kalori
🥬 *Serat*: 4g
🧂 *Natrium*: 1.250 mg

━━━━━━━━━━━━━━
🍽️ *ESTIMASI PORSI*
━━━━━━━━━━━━━━
• Gyukatsu Daging Sapi: 1 porsi (~420 kcal)
• Nasi Putih: 1 mangkok (~210 kcal)
• Onsen Tamago: 1 butir (~75 kcal)
• Sup Miso: 1 mangkok (~75 kcal)

━━━━━━━━━━━━━━
🤖 *COACH MIA*
━━━━━━━━━━━━━━
"Makan malam yang sangat lengkap dan bergizi seimbang! Asupan protein 45g sangat ideal untuk pemulihan otot kamu. Selamat beristirahat malam ya ✨"

━━━━━━━━━━━━━━
📈 *STATUS HARI INI*
━━━━━━━━━━━━━━
Status Nutrisi: 🟡 On Track

🔥 *Kalori*: 1.450/2.000 kcal
[███████░░░] 73% · 🟡 Belum Cukup

🍖 *Protein*: 105/140g
[███████░░░] 75% · 🟡 Belum Cukup

🍚 *Karbo*: 165/230g
[███████░░░] 72% · 🟡 Belum Cukup

🥓 *Lemak*: 45/60g
[███████░░░] 75% · 🟡 Belum Cukup

🧂 *Natrium*: 1.200/2,000 mg
[██████░░░░] 60% · 🟢 Dalam Batas

🍯 *Gula*: 20/50g
[████░░░░░░] 40% · 🟢 Dalam Batas

━━━━━━━━━━━━━━
⚙️ _Ketik "koreksi: [porsi]" untuk edit atau "hapus log terakhir"_`;

  // Force split into multiple chunks with small limit
  const chunks = splitWhatsAppMessage(longCard, 700);
  assert(chunks.length > 1, "Should split into multiple chunks");

  chunks.forEach((chunk, i) => {
    // Assert no single '━' isolated line exists
    const hasBrokenSingleChar = /(?:^|\n)[━─\-=]{1,3}(?:\n|$)/.test(chunk);
    assert(!hasBrokenSingleChar, `Chunk ${i + 1} has broken single separator characters`);

    // Any separator that appears should be full 14 chars
    const sepMatches = chunk.match(/[━─\-=]{4,}/g) || [];
    sepMatches.forEach(sep => {
      assert.strictEqual(sep, "━━━━━━━━━━━━━━", `Separator must be 14 '━' characters, got '${sep}'`);
    });
  });
});

check("4.2: sanitizeWhatsAppResponse collapses multi-line separated '━' chars into one '━━━━━━━━━━━━━━'", () => {
  const brokenInput = "Header\n\n━\n\n━\n\n━\n\nSection 1\n━\n━\nSection 2";
  const cleaned = sanitizeWhatsAppResponse(brokenInput);
  assert(!/(?:^|\n)[━─\-=]{1,3}(?:\n|$)/.test(cleaned), "Must eliminate all single ━ lines");
  assert(cleaned.includes("━━━━━━━━━━━━━━"), "Must contain normalized separator");
});

// ── GROUP 5: Macro Percentage Clarification & Neutral Status Badges ───────────
console.log("\n▶ GROUP 5: Macro Percentage Clarification & Neutral Status Badges");

check("5.1: REKAP NUTRISI contains 'Distribusi Makro (% kalori)' and '% kalori' tags", () => {
  const parsed = {
    foodName: "Harvest Oatmeal Raisin Cookies",
    calories: 220,
    protein: 4,
    carbs: 32,
    fat: 9,
    mealType: "Snack"
  };
  const card = formatNutritionCard(parsed, "Teks", mockUserData, mockDailyTotals);
  assert(card.includes("Distribusi Makro (% kalori):"), "Must label macro section as '% kalori'");
  assert(card.includes("% kalori"), "Must tag individual macros with '% kalori'");
});

check("5.2: Status Hari Ini displays '🟡 On Track' when totals are 70-99% of target", () => {
  // 1450/2000 kcal = 72.5% -> On Track
  const parsed = {
    foodName: "Harvest Oatmeal Raisin Cookies",
    calories: 220,
    protein: 4,
    carbs: 32,
    fat: 9,
    mealType: "Snack"
  };
  const card = formatNutritionCard(parsed, "Teks", mockUserData, mockDailyTotals);
  assert(card.includes("Status Nutrisi: 🟡 On Track"), "Must display '🟡 On Track' for 70-99%");
});

check("5.3: Status Hari Ini displays '✅ Target Tercapai' when totals reach 100%", () => {
  const fullTotals = {
    calories: 2000,
    protein: 140,
    carbs: 230,
    fat: 60,
    sodium: 1500,
    sugar: 30
  } as any;
  const parsed = {
    foodName: "Dinner Meal",
    calories: 500,
    protein: 30,
    carbs: 60,
    fat: 15,
    mealType: "Dinner"
  };
  const card = formatNutritionCard(parsed, "Foto", mockUserData, fullTotals);
  assert(card.includes("Status Nutrisi: ✅ Target Tercapai"), "Must display '✅ Target Tercapai' for 100%");
});

console.log("\n================================================================================");
console.log(`SUMMARY: ${passedCount}/${totalCount} PASSED`);
console.log("================================================================================");

if (passedCount === totalCount) {
  console.log("🎉 ALL E2E WHATSAPP MEAL FLOW TESTS PASSED 100%!");
} else {
  console.error("❌ SOME TESTS FAILED!");
  process.exitCode = 1;
}
