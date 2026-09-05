process.env.NODE_ENV = "test";
import { formatNutritionCard } from "../server";
import { calculateNutrientStatus, makeProgressBar, makeSodiumProgressBar } from "../services/nutritionEngine";

console.log("=== RUNNING GYMBUDDY AI WHATSAPP RESPONSE FORMATTING TEST SUITE ===\n");

let allPassed = true;

// ── TEST 1: Exact Response Structure & Separator Rules ──
console.log("[TEST 1] Standard WhatsApp Meal Response Structure & Clean Separators");
const mockUserMia = {
  name: "Siti",
  gender: "wanita",
  age: 28,
  weight: 60,
  targetCalories: 1966,
  proteinGrams: 147,
  carbGrams: 221,
  fatGrams: 55,
  persona: "mia",
  goalTitle: "Fat Loss"
} as any;

const mockMeal1 = {
  foodName: "Nasi Putih & Ayam Bakar",
  calories: 450,
  protein: 35,
  carbs: 48,
  fat: 12,
  fiber: 2,
  sugar: 3,
  sodium: 480,
  portionEstimates: [
    "• Nasi Putih: 1 piring (~200 kcal)",
    "• Ayam Bakar Dada: 1 potong (~250 kcal)"
  ]
};

const mockDailyTotals1 = {
  calories: 1958,
  protein: 103,
  carbs: 181,
  fat: 90,
  sodium: 2650,
  logs: [mockMeal1]
} as any;

const cardMia = formatNutritionCard(mockMeal1, "Foto", mockUserMia, mockDailyTotals1);
console.log("--- GENERATED WHATSAPP CARD (COACH MIA) ---\n" + cardMia + "\n-------------------------------------------\n");

// Check Section Headers
const expectedHeaders = [
  "*Nasi Putih & Ayam Bakar*",
  "📊 *REKAP NUTRISI*",
  "🍽️ *ESTIMASI PORSI*",
  "🤖 *COACH MIA*",
  "📈 *STATUS HARI INI*",
  "⚙️ _Ketik \"koreksi: [porsi]\" untuk edit atau \"hapus log terakhir\"_"
];

expectedHeaders.forEach(header => {
  if (cardMia.includes(header)) {
    console.log(`  ✅ [PASS] Found expected header/section: ${header}`);
  } else {
    console.error(`  ❌ [FAIL] Missing header: ${header}`);
    allPassed = false;
  }
});

// Check Separator Integrity
const consecutiveSeparators = /━━━━━━━━━━━━━━\s*\n\s*━━━━━━━━━━━━━━/.test(cardMia);
if (!consecutiveSeparators) {
  console.log("  ✅ [PASS] Zero consecutive separators!");
} else {
  console.error("  ❌ [FAIL] Found consecutive separators!");
  allPassed = false;
}

// Ensure NO separate "💡 Catatan Natrium" section exists
if (!cardMia.includes("💡 *Catatan Natrium*") && !cardMia.includes("💡 Catatan Natrium")) {
  console.log("  ✅ [PASS] Confirmed NO separate nutrition warning section (integrated naturally into coach comment)!");
} else {
  console.error("  ❌ [FAIL] Found separate Catatan Natrium warning section outside coach message!");
  allPassed = false;
}

// ── TEST 2: Active Coach Dynamic Assignment (Coach Max) ──
console.log("\n[TEST 2] Active Coach Dynamic Assignment (Coach Max)");
const mockUserMax = {
  ...mockUserMia,
  name: "Budi",
  gender: "pria",
  persona: "max"
};

const cardMax = formatNutritionCard(mockMeal1, "Foto", mockUserMax, mockDailyTotals1);
if (cardMax.includes("🤖 *COACH MAX*") && !cardMax.includes("COACH MIA")) {
  console.log("  ✅ [PASS] Active coach dynamically assigned as 'COACH MAX'!");
} else {
  console.error("  ❌ [FAIL] Expected 'COACH MAX', got wrong coach header!");
  allPassed = false;
}

// ── TEST 3: Calorie Progress: 1958/1966 = 99% (Never 100% when under target) ──
console.log("\n[TEST 3] Calorie Progress & Bar Consistency: 1958 / 1966 kcal");
const calStatus = calculateNutrientStatus(1958, 1966, false);
const calBar = makeProgressBar(1958, 1966);

console.log("  Calorie Status Output :", calStatus.percentage + "%", "·", calStatus.statusBadge);
console.log("  Calorie Progress Bar  :", calBar);

if (calStatus.percentage === 99 && calStatus.statusText === "Belum Cukup") {
  console.log("  ✅ [PASS] 1958/1966 accurately displays 99% · 🟡 Belum Cukup (NOT 100%)!");
} else {
  console.error(`  ❌ [FAIL] Expected 99% Belum Cukup, got: ${calStatus.percentage}% ${calStatus.statusText}`);
  allPassed = false;
}

if (calBar.includes("[█████████░] 99% · 🟡 Belum Cukup")) {
  console.log("  ✅ [PASS] Progress bar has exactly 9 filled blocks and 1 empty block [█████████░]!");
} else {
  console.error("  ❌ [FAIL] Progress bar incorrect:", calBar);
  allPassed = false;
}

// ── TEST 4: Macro Progress (Protein 103/147, Karbo 181/221, Lemak 90/55) ──
console.log("\n[TEST 4] Macro Progress Consistency");
const fatStatus = calculateNutrientStatus(90, 55, false);
const fatBar = makeProgressBar(90, 55);

console.log("  Fat Status Output :", fatStatus.percentage + "%", "·", fatStatus.statusBadge);
console.log("  Fat Progress Bar  :", fatBar);

if (fatStatus.percentage >= 163 && fatStatus.isOver && fatStatus.statusText === "Melebihi Target") {
  console.log("  ✅ [PASS] Fat 90/55g labeled correctly as '🔴 Melebihi Target' (NOT Belum Cukup)!");
} else {
  console.error(`  ❌ [FAIL] Fat status incorrect: ${fatStatus.percentage}% ${fatStatus.statusText}`);
  allPassed = false;
}

// ── TEST 5: Sodium Upper Limit (2650/2000 mg) ──
console.log("\n[TEST 5] Sodium Upper Limit Consistency: 2650 / 2000 mg");
const sodStatus = calculateNutrientStatus(2650, 2000, true);
const sodBar = makeSodiumProgressBar(2650, 2000);

console.log("  Sodium Status Output :", sodStatus.percentage + "%", "·", sodStatus.statusBadge);
console.log("  Sodium Progress Bar  :", sodBar);

if (sodStatus.percentage === 133 && sodStatus.statusText === "Melebihi Batas") {
  console.log("  ✅ [PASS] Sodium 2650/2000 mg displays 133% · 🔴 Melebihi Batas!");
} else {
  console.error(`  ❌ [FAIL] Sodium status incorrect: ${sodStatus.percentage}% ${sodStatus.statusText}`);
  allPassed = false;
}

// Verify Sodium Warning Natural Integration in Coach Message
if (cardMia.toLowerCase().includes("natrium") || cardMia.toLowerCase().includes("garam") || cardMia.includes("2.650")) {
  console.log("  ✅ [PASS] Coach Mia naturally integrated sodium insight into coaching advice!");
} else {
  console.error("  ❌ [FAIL] Coach Mia did not mention high sodium in response!");
  allPassed = false;
}

if (cardMax.toLowerCase().includes("sodium") || cardMax.toLowerCase().includes("natrium") || cardMax.includes("2.650")) {
  console.log("  ✅ [PASS] Coach Max naturally integrated sodium insight into coaching advice!");
} else {
  console.error("  ❌ [FAIL] Coach Max did not mention high sodium in response!");
  allPassed = false;
}

console.log("\n--------------------------------------------------");
if (allPassed) {
  console.log("🎉 ALL GYMBUDDY AI WHATSAPP RESPONSE TESTS PASSED 100%!");
  process.exit(0);
} else {
  console.error("❌ SOME TESTS FAILED!");
  process.exit(1);
}
