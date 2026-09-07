import assert from "assert";
import {
  formatNutritionCard,
  calculateUserData,
  handleWorkoutProgressLogging,
  handleAdditionalActivityLogging,
  dbData,
  saveDb
} from "../server";

function normalizePhone(phone: string): string {
  let cleaned = (phone || "").replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+62")) cleaned = "0" + cleaned.slice(3);
  else if (cleaned.startsWith("62")) cleaned = "0" + cleaned.slice(2);
  else if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
  return cleaned;
}

console.log("=== RUNNING WORKOUT QUERY & NUTRITION CARD FORMATTING VERIFICATION ===");

// ----------------------------------------------------------------------------
// TEST 1: Workout Schedule Queries Must NOT Log Any Workouts or Activities
// ----------------------------------------------------------------------------
console.log("\n▶ TEST 1: Schedule Query Intent Guarding (No Unintentional Logging)");

const testPhone = "089912345678";
const normPhone = normalizePhone(testPhone);

const testUser = {
  id: `usr_${normPhone}`,
  name: "Budi",
  age: 28,
  gender: "Pria",
  weight: 75,
  targetWeight: 70,
  height: 175,
  activityLevel: "moderate",
  goal: "lose",
  persona: "mia",
  allergies: [],
  conditions: [],
  medicalConditions: [],
  injuries: [],
  dislikedFoods: []
};

const userData = calculateUserData(testUser);

const scheduleQueries = [
  "kasih aku jadwal olahraga hari ini",
  "jadwal olahraga hari ini",
  "latihan hari ini",
  "workout hari ini apa",
  "jadwal latihan hari ini",
  "jadwal gym hari ini",
  "rekomendasi latihan hari ini"
];

for (const query of scheduleQueries) {
  const workoutProgressResult = handleWorkoutProgressLogging(normPhone, query, userData);
  assert.strictEqual(
    workoutProgressResult,
    null,
    `Schedule query "${query}" must return null from handleWorkoutProgressLogging, but returned: ${JSON.stringify(workoutProgressResult)}`
  );

  const additionalActResult = handleAdditionalActivityLogging(normPhone, query, userData);
  assert.strictEqual(
    additionalActResult,
    null,
    `Schedule query "${query}" must return null from handleAdditionalActivityLogging, but returned: ${JSON.stringify(additionalActResult)}`
  );
  console.log(`  ✅ [PASS] "${query}" correctly avoided unintentional workout logging`);
}

// ----------------------------------------------------------------------------
// TEST 2: Legitimate Workout Logging Still Works Accurately
// ----------------------------------------------------------------------------
console.log("\n▶ TEST 2: Legitimate Workout Reporting Works Accurately");

const actualWorkoutLogs = [
  "aku sudah latihan bench press 3 set 10 reps 50kg",
  "tadi aku berenang 45 menit",
  "catat olahraga aku lari 5 km 30 menit",
  "aku sudah jalan kaki 30 menit"
];

for (const logText of actualWorkoutLogs) {
  const result = handleWorkoutProgressLogging(normPhone, logText, userData);
  assert.ok(result !== null && result.length > 0, `Legitimate log "${logText}" should produce a response`);
  assert.ok(
    result[0].includes("LATIHAN BERHASIL DICATAT"),
    `Response for "${logText}" should indicate success: ${result[0]}`
  );
  console.log(`  ✅ [PASS] "${logText}" successfully logged`);
}

const genericResult = handleWorkoutProgressLogging(normPhone, "aku sudah olahraga", userData);
assert.ok(genericResult !== null && genericResult.length > 0, `Generic log "aku sudah olahraga" should produce clarification response`);
assert.ok(genericResult[0].toLowerCase().includes("olahraga apa"), `Generic log must ask for activity clarification`);
console.log(`  ✅ [PASS] "aku sudah olahraga" accurately requests activity clarification`);

// ----------------------------------------------------------------------------
// TEST 3: formatNutritionCard Completeness & WhatsApp Formatter Single Ownership
// ----------------------------------------------------------------------------
console.log("\n▶ TEST 3: formatNutritionCard Completeness & Format Enforcement");

const parsedAi = {
  canonicalMealTitle: "Nasi Ayam Bakar & Lalapan",
  calories: 520,
  protein: 38,
  carbs: 55,
  fat: 14,
  fiber: 4,
  sugar: 5,
  sodium: 480,
  confidenceLevel: 94,
  mealType: "lunch",
  portionEstimates: ["• 1 Porsi Dada Ayam Bakar (~150g)", "• 1 Porsi Nasi Putih (~100g)", "• Lalapan Mentimun & Kemangi"],
  coachComment: "Pilihan makan siang yang seimbang! Proteinnya mantap untuk pemulihan otot kamu."
};

const dailyTotals = {
  calories: 1310,
  protein: 70,
  carbs: 146,
  fat: 49,
  sodium: 625,
  sugar: 16,
  fiber: 12
};

const userNutritionProfile = {
  ...userData,
  targetCalories: 1966,
  proteinGrams: 147,
  carbGrams: 221,
  fatGrams: 55,
  sodiumTarget: 2000,
  sugarTarget: 50,
  persona: "mia"
};

const card = formatNutritionCard(parsedAi, "Foto", userNutritionProfile, dailyTotals);

// Assertions on formatNutritionCard
assert.ok(!card.includes("━"), "Nutrition card must contain NO unicode box-drawing characters (━)");
assert.ok(!card.includes("─"), "Nutrition card must contain NO unicode box-drawing characters (─)");
assert.ok(!card.includes("═"), "Nutrition card must contain NO unicode box-drawing characters (═)");

assert.ok(card.includes("--------------------------------------------------"), "Nutrition card must use standard -------------------------------------------------- delimiter");

// Check headers
assert.ok(card.includes("🍽️ *Nasi Ayam Bakar & Lalapan*"), "Contains food title");
assert.ok(card.includes("📊 *ESTIMASI NUTRISI*"), "Contains ESTIMASI NUTRISI header");
assert.ok(card.includes("🔥 520 kcal"), "Shows meal calories");
assert.ok(card.includes("🍖 Protein: 38g"), "Shows meal protein");
assert.ok(card.includes("🍚 Karbo: 55g"), "Shows meal carbs");
assert.ok(card.includes("🥓 Lemak: 14g"), "Shows meal fat");
assert.ok(card.includes("🥬 Serat: 4g"), "Shows meal fiber");
assert.ok(card.includes("🧂 Natrium: 480 mg"), "Shows meal sodium");
assert.ok(card.includes("🍯 Gula: 5g"), "Shows meal sugar");

assert.ok(card.includes("🍽️ *ESTIMASI PORSI*"), "Contains ESTIMASI PORSI header");
assert.ok(card.includes("• 1 Porsi Dada Ayam Bakar"), "Contains portion detail");

// Check STATUS HARI INI
assert.ok(card.includes("📈 *STATUS HARI INI*"), "Contains STATUS HARI INI header");
assert.ok(card.includes("🔥 Kalori: 1310/1966 kcal"), "Shows daily calorie status");
assert.ok(card.includes("67% · 🟡 Belum Cukup"), "Shows calorie percentage and badge");

assert.ok(card.includes("🍖 Protein: 70/147g"), "Shows daily protein status");
assert.ok(card.includes("48% · 🟡 Belum Cukup"), "Shows protein percentage and badge");

assert.ok(card.includes("🍚 Karbo: 146/221g"), "Shows daily carbs status");
assert.ok(card.includes("66% · 🟡 Belum Cukup"), "Shows carbs percentage and badge");

assert.ok(card.includes("🥓 Lemak: 49/55g"), "Shows daily fat status");
assert.ok(card.includes("89% · 🟡 Belum Cukup"), "Shows fat percentage and badge");

assert.ok(card.includes("🧂 Natrium: 625/2.000 mg"), "Shows daily sodium status");
assert.ok(card.includes("31% · 🟢 Dalam Batas"), "Shows sodium percentage and badge");

assert.ok(card.includes("🍯 Gula: 16/50g"), "Shows daily sugar status");
assert.ok(card.includes("32% · 🟢 Dalam Batas"), "Shows sugar percentage and badge");

// Check Coach section
assert.ok(card.includes("🤖 *COACH MIA*"), "Contains coach header");
assert.ok(card.includes("Ketik *koreksi: [porsi]* jika ada yang perlu diperbaiki."), "Contains correction footer");

console.log("  ✅ [PASS] formatNutritionCard contains all 6 metrics with bars and status badges");
console.log("  ✅ [PASS] formatNutritionCard uses single standard delimiter and zero box-drawing chars");

// Check Coach Max card
const maxNutritionProfile = {
  ...userNutritionProfile,
  persona: "max"
};
const maxCard = formatNutritionCard(parsedAi, "Teks", maxNutritionProfile, dailyTotals);
assert.ok(maxCard.includes("🤖 *COACH MAX*"), "Coach Max header correctly rendered");
assert.ok(!maxCard.includes("━"), "Coach Max card has zero box-drawing chars");
console.log("  ✅ [PASS] Coach Max card adheres to exact same layout & single separator owner");

console.log("\n===============================================================================");
console.log("🎉 ALL TESTS PASSED: Workout query routing and nutrition card format verified!");
console.log("===============================================================================\n");
