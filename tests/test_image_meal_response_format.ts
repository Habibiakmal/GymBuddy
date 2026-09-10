import assert from "node:assert";
import { formatNutritionCard, splitWhatsAppMessage, calculateUserData, buildImageMealResponseMessages } from "../server";

console.log("=== RUNNING IMAGE MEAL RESPONSE FORMAT TESTS ===");

const userMia = calculateUserData({
  name: "Alex",
  persona: "mia",
  targetCalories: 1966,
  weight: 70,
  height: 175,
  gender: "pria",
  goal: "lose"
});

const userMax = calculateUserData({
  name: "Budi",
  persona: "max",
  targetCalories: 2200,
  weight: 75,
  height: 178,
  gender: "pria",
  goal: "gain"
});

const sampleMealData = {
  foodName: "Nasi Putih, Soto Daging Kuah Santan & Bawang Goreng",
  calories: 550,
  protein: 28,
  carbs: 55,
  fat: 22,
  fiber: 3,
  sugar: 4,
  sodium: 890,
  portionDetail: "1 mangkok soto daging + 1 porsi nasi putih",
  coachComment: "Pilihan makanan yang enak! Tapi kuah santannya cukup tinggi lemak jenuh ya, yuk imbangi dengan banyak minum air putih!"
};

const dailyTotals = { calories: 1185, protein: 55, carbs: 120, fat: 48, fiber: 10, sugar: 12, sodium: 1450 } as any;

// Test 1: Full Card Formatting & Exact Section Sequence for Mia
const cardMia = formatNutritionCard(sampleMealData, "Foto", userMia, dailyTotals);
console.log("Test 1: Card generated. Length:", cardMia.length);

assert.ok(cardMia.includes("🍽️ *Nasi Putih, Soto Daging Kuah Santan & Bawang Goreng*"), "Should contain food name title");
assert.ok(cardMia.includes("🤖 GymBuddy AI:"), "Should contain GymBuddy AI confidence");
assert.ok(cardMia.includes("📊 *ESTIMASI NUTRISI*"), "Should contain ESTIMASI NUTRISI section");
assert.ok(cardMia.includes("🔥 550 kcal"), "Should contain calories");
assert.ok(cardMia.includes("🍖 Protein: 28g"), "Should contain protein");
assert.ok(cardMia.includes("🍚 Karbo: 55g"), "Should contain carbs");
assert.ok(cardMia.includes("🥓 Lemak: 22g"), "Should contain fat");
assert.ok(cardMia.includes("🥬 Serat: 3g"), "Should contain fiber");
assert.ok(cardMia.includes("🧂 Natrium: 890 mg"), "Should contain sodium");
assert.ok(cardMia.includes("🍯 Gula: 4g"), "Should contain sugar");
assert.ok(cardMia.includes("🍽️ *ESTIMASI PORSI*"), "Should contain ESTIMASI PORSI section");
assert.ok(cardMia.includes("1 mangkok soto daging + 1 porsi nasi putih"), "Should contain portion detail");
assert.ok(cardMia.includes("📈 *STATUS HARI INI*"), "Should contain STATUS HARI INI section");
assert.ok(cardMia.includes("🔥 Kalori: 1185/1966 kcal"), "Should contain Kalori progress");
assert.ok(cardMia.includes("🍖 Protein: 55/140g"), "Should contain Protein progress");
assert.ok(cardMia.includes("🍚 Karbo: 120/228g"), "Should contain Karbo progress");
assert.ok(cardMia.includes("🥓 Lemak: 48/55g"), "Should contain Lemak progress");
assert.ok(cardMia.includes("🧂 Natrium: 1.450/2.000 mg"), "Should contain Natrium progress");
assert.ok(cardMia.includes("🍯 Gula: 12/50g"), "Should contain Gula progress");
assert.ok(cardMia.includes("🤖 *COACH MIA*"), "Should contain Coach Mia heading");
assert.ok(cardMia.includes("Ketik *koreksi: [porsi]* jika ada yang perlu diperbaiki."), "Should contain correction footer");

// Verify Section Ordering: Header -> Nutrition -> Portion -> Status -> Coach -> Correction
const idxHeader = cardMia.indexOf("🍽️ *Nasi Putih");
const idxNutr = cardMia.indexOf("📊 *ESTIMASI NUTRISI*");
const idxPortion = cardMia.indexOf("🍽️ *ESTIMASI PORSI*");
const idxStatus = cardMia.indexOf("📈 *STATUS HARI INI*");
const idxCoach = cardMia.indexOf("🤖 *COACH MIA*");
const idxCorrection = cardMia.indexOf("Ketik *koreksi: [porsi]*");

assert.ok(idxHeader < idxNutr, "Header must come before Nutrition");
assert.ok(idxNutr < idxPortion, "Nutrition must come before Portion");
assert.ok(idxPortion < idxStatus, "Portion must come before Status");
assert.ok(idxStatus < idxCoach, "Status must come before Coach");
assert.ok(idxCoach < idxCorrection, "Coach must come before Correction");
console.log("✓ Section order strictly verified!");

// Test 2: Coach Max Persona
const cardMax = formatNutritionCard(sampleMealData, "Foto", userMax, dailyTotals);
assert.ok(cardMax.includes("🤖 *COACH MAX*"), "Should contain Coach Max heading when persona is max");
console.log("✓ Coach Max persona verified!");

// Test 3: buildImageMealResponseMessages under typical length (< 1500 chars)
const singleMsgArray = buildImageMealResponseMessages(sampleMealData, "Foto", userMia, dailyTotals, 1500);
assert.strictEqual(singleMsgArray.length, 1, "Under standard length threshold, it must return exactly 1 message");
assert.strictEqual(singleMsgArray[0], cardMia, "Single message must match the full formatted card");
console.log("✓ Single message return verified!");

// Test 4: buildImageMealResponseMessages deterministic 2-part split if exceeding threshold
const longMealData = {
  ...sampleMealData,
  coachComment: "Catatan coach yang sangat detail dan komprehensif ".repeat(25)
};
const splitMsgArray = buildImageMealResponseMessages(longMealData, "Foto", userMia, dailyTotals, 1000);
assert.strictEqual(splitMsgArray.length, 2, "When exceeding threshold, it splits into exactly 2 logical parts");
assert.ok(splitMsgArray[0].includes("ESTIMASI NUTRISI") && splitMsgArray[0].includes("ESTIMASI PORSI"), "Part 1 has meal details and portion");
assert.ok(splitMsgArray[1].includes("STATUS HARI INI") && splitMsgArray[1].includes("COACH MIA"), "Part 2 has daily status and coach");
console.log("✓ Deterministic split behavior verified!");

console.log("\nALL TESTS PASSED SUCCESSFULLY! 🎉");
process.exit(0);
