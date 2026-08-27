import assert from "node:assert";
import {
  getValidatedUserAddressing,
  validateAndFormatCoachNote
} from "../services/nutritionEngine";
import {
  calculateUserData,
  formatNutritionCard
} from "../server";

console.log("=== RUNNING GYMBUDDY COACH ADDRESSING & AGE-BASED NICKNAME TEST SUITE ===");

// ── TEST 1: Lansia Male Addressing (Age >= 60) ──
console.log("\n[TEST 1] Lansia Male Addressing (Pak [Nickname], Anda/Saya, Zero 'bro')");
const lansiaMaleUser = calculateUserData({
  name: "Budi Santoso",
  gender: "pria",
  age: 65,
  persona: "max"
});
const addrLansiaMale = lansiaMaleUser.addressing;
assert.strictEqual(addrLansiaMale.ageGroup, "Lansia");
assert.strictEqual(addrLansiaMale.honorific, "Pak");
assert.strictEqual(addrLansiaMale.nickname, "Budi");
assert.strictEqual(addrLansiaMale.validatedAddress, "Pak Budi");
assert.strictEqual(addrLansiaMale.pronounUser, "Anda");

const lansiaRawComment = "Mantap bro! Aktivitas ekstra lo udah tercatat. Tetap jaga hidrasi & makan bergizi! 🔥";
const lansiaFormatted = validateAndFormatCoachNote(lansiaRawComment, lansiaMaleUser);
console.log("  Raw input :", lansiaRawComment);
console.log("  Validated :", lansiaFormatted);
assert(lansiaFormatted.includes("Pak Budi"), "Must address user as Pak Budi");
assert(!/\bbro\b/i.test(lansiaFormatted), "Must NEVER contain 'bro'");
assert(!/\blo\b/i.test(lansiaFormatted), "Must NEVER contain 'lo' for Lansia");
console.log("  ✅ [PASS] Lansia male correctly addressed as 'Pak Budi' with respectful tone!");

// ── TEST 2: Lansia Female Addressing (Bu [Nickname], Anda/Saya) ──
console.log("\n[TEST 2] Lansia Female Addressing (Bu [Nickname], Anda/Saya, Zero 'bro')");
const lansiaFemaleUser = calculateUserData({
  name: "Siti Rahma",
  gender: "wanita",
  age: 62,
  persona: "mia"
});
const addrLansiaFemale = lansiaFemaleUser.addressing;
assert.strictEqual(addrLansiaFemale.ageGroup, "Lansia");
assert.strictEqual(addrLansiaFemale.honorific, "Bu");
assert.strictEqual(addrLansiaFemale.nickname, "Siti");
assert.strictEqual(addrLansiaFemale.validatedAddress, "Bu Siti");
assert.strictEqual(addrLansiaFemale.pronounUser, "Anda");

const lansiaFemaleRaw = "Sodium lo udah tembus 2650 mg hari ini bro! Langsung imbangi dengan minum air putih...";
const lansiaFemaleFormatted = validateAndFormatCoachNote(lansiaFemaleRaw, lansiaFemaleUser);
console.log("  Raw input :", lansiaFemaleRaw);
console.log("  Validated :", lansiaFemaleFormatted);
assert(lansiaFemaleFormatted.includes("Bu Siti"), "Must address user as Bu Siti");
assert(!/\bbro\b/i.test(lansiaFemaleFormatted), "Must NEVER contain 'bro'");
assert(!/\blo\b/i.test(lansiaFemaleFormatted), "Must NEVER contain 'lo'");
console.log("  ✅ [PASS] Lansia female correctly addressed as 'Bu Siti'!");

// ── TEST 3: Adult Male with Coach Max (Personality MUST NOT override addressing) ──
console.log("\n[TEST 3] Adult Male with Coach Max (Direct & Firm, but NEVER 'bro')");
const adultMaleUser = calculateUserData({
  name: "Habibi Akmal",
  gender: "pria",
  age: 28,
  persona: "max"
});
const addrAdultMale = adultMaleUser.addressing;
assert.strictEqual(addrAdultMale.ageGroup, "Dewasa");
assert.strictEqual(addrAdultMale.nickname, "Habibi");
assert.strictEqual(addrAdultMale.validatedAddress, "Habibi");
assert.strictEqual(addrAdultMale.pronounUser, "kamu");

// Exactly tested against the user's prompt example:
// Correct: "Bagus, [VALIDATED NICKNAME]! Aktivitas ekstra kamu sudah tercatat..."
// Incorrect: "Mantap bro! Aktivitas ekstra lo udah tercatat."
const rawMaxSlang = "Mantap bro! Aktivitas ekstra lo udah tercatat. 🔥";
const formattedMaxSlang = validateAndFormatCoachNote(rawMaxSlang, adultMaleUser);
console.log("  Raw input :", rawMaxSlang);
console.log("  Validated :", formattedMaxSlang);
assert(formattedMaxSlang.includes("Habibi"), "Must address user by validated nickname 'Habibi'");
assert(!/\bbro\b/i.test(formattedMaxSlang), "Coach Max must NEVER output 'bro'");
console.log("  ✅ [PASS] Coach Max successfully uses validated nickname and never overrides with 'bro'!");

// ── TEST 4: Adult Female with Coach Max & Coach Mia ──
console.log("\n[TEST 4] Adult Female Addressing (Valid Nickname, No Casual Slang)");
const adultFemaleUser = calculateUserData({
  name: "Rina Kartika",
  gender: "wanita",
  age: 25,
  persona: "max"
});
const addrAdultFemale = adultFemaleUser.addressing;
assert.strictEqual(addrAdultFemale.nickname, "Rina");
assert.strictEqual(addrAdultFemale.validatedAddress, "Rina");

const rawSlangFemale = "Keren bestie! Catatan makanan lo udah masuk, mantap bro!";
const formattedFemale = validateAndFormatCoachNote(rawSlangFemale, adultFemaleUser);
console.log("  Raw input :", rawSlangFemale);
console.log("  Validated :", formattedFemale);
assert(formattedFemale.includes("Rina"), "Must use validated nickname 'Rina'");
assert(!/\b(bro|sis|guys|boss|bestie)\b/i.test(formattedFemale), "Must NEVER contain casual slang");
console.log("  ✅ [PASS] Adult female note sanitized of all generic slang terms!");

// ── TEST 5: Child Addressing (Age < 13) ──
console.log("\n[TEST 5] Child Addressing (Age < 13, Cheerful, Validated Nickname, Zero Slang)");
const childUser = calculateUserData({
  name: "Alif Hidayat",
  gender: "pria",
  age: 11,
  persona: "mia"
});
const addrChild = childUser.addressing;
assert.strictEqual(addrChild.ageGroup, "Anak");
assert.strictEqual(addrChild.validatedAddress, "Alif");
assert.strictEqual(addrChild.pronounUser, "kamu");

const childRaw = "Aktivitas lo mantap bro! Tetap semangat ya.";
const childFormatted = validateAndFormatCoachNote(childRaw, childUser);
console.log("  Raw input :", childRaw);
console.log("  Validated :", childFormatted);
assert(childFormatted.includes("Alif"), "Must address child by nickname 'Alif'");
assert(!/\b(bro|lo|lu|gue)\b/i.test(childFormatted), "Child must never receive 'bro' or street slang");
console.log("  ✅ [PASS] Child addressing properly validated and formatted!");

// ── TEST 6: WhatsApp Nutrition Response Card Coach Note Section ──
console.log("\n[TEST 6] WhatsApp Nutrition Response Card Coach Note Verification");
const mockMeal = {
  canonicalMealTitle: "Nasi Ayam Bakar & Lalapan",
  foodName: "Nasi Ayam Bakar & Lalapan",
  calories: 550,
  protein: 34,
  carbs: 60,
  fat: 15,
  fiber: 4,
  sugar: 4,
  sodium: 2300, // triggers high sodium advice
  portionEstimates: ["• Nasi Putih: 1 piring (~200 kcal)", "• Ayam Bakar: 1 potong (~350 kcal)"]
};
const mockDailyTotals = {
  calories: 1800,
  protein: 110,
  carbs: 190,
  fat: 55,
  fiber: 20,
  sodium: 2650,
  sugar: 25,
  logCount: 3,
  date: "2026-08-27",
  logs: []
};

// 6A. Card with Adult Male & Coach Max
const cardAdultMax = formatNutritionCard(mockMeal, "Foto", adultMaleUser, mockDailyTotals as any);
assert(cardAdultMax.includes("🤖 *COACH MAX*"));
const coachNoteMax = cardAdultMax.split("🤖 *COACH MAX*")[1].split("━━━━━━━━━━━━━━")[1];
console.log("  Coach Max Note in Card:\n ", coachNoteMax.trim());
assert(coachNoteMax.includes("Habibi"), "Coach Max note must address Habibi by validated nickname");
assert(!/\bbro\b/i.test(coachNoteMax), "Coach Max note must NEVER contain 'bro'");

// 6B. Card with Lansia Male & Coach Max
const cardLansiaMax = formatNutritionCard(mockMeal, "Foto", lansiaMaleUser, mockDailyTotals as any);
const coachNoteLansiaMax = cardLansiaMax.split("🤖 *COACH MAX*")[1].split("━━━━━━━━━━━━━━")[1];
console.log("  Coach Max Lansia Note in Card:\n ", coachNoteLansiaMax.trim());
assert(coachNoteLansiaMax.includes("Pak Budi"), "Coach Max note must address Lansia as 'Pak Budi'");
assert(!/\bbro\b/i.test(coachNoteLansiaMax), "Coach Max note for Lansia must NEVER contain 'bro'");

// 6C. Card with Lansia Female & Coach Mia
const cardLansiaMia = formatNutritionCard(mockMeal, "Foto", lansiaFemaleUser, mockDailyTotals as any);
const coachNoteLansiaMia = cardLansiaMia.split("🤖 *COACH MIA*")[1].split("━━━━━━━━━━━━━━")[1];
console.log("  Coach Mia Lansia Note in Card:\n ", coachNoteLansiaMia.trim());
assert(coachNoteLansiaMia.includes("Bu Siti"), "Coach Mia note must address Lansia as 'Bu Siti'");
assert(!/\bbro\b/i.test(coachNoteLansiaMia), "Coach Mia note for Lansia must NEVER contain 'bro'");

console.log("  ✅ [PASS] WhatsApp response cards strictly apply validated age-based addressing across all user profiles and coach personas!");

console.log("\n--------------------------------------------------");
console.log("🎉 ALL COACH ADDRESSING & AGE-BASED NICKNAME TESTS PASSED 100%!");
