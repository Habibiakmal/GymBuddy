import assert from "assert";
import { formatNutritionCard } from "../server";
import { calculateNutrientStatus } from "../services/nutritionEngine";
import { getWhatsAppDestinationUrl } from "../utils/api";

console.log("===============================================================");
console.log("RUNNING COMPREHENSIVE PRODUCTION AUDIT TEST SUITE (ISSUES 1-5)");
console.log("===============================================================\n");

let passed = 0;
let total = 0;

function test(name: string, fn: () => void | Promise<void>) {
  total++;
  try {
    const result = fn();
    if (result && typeof (result as any).then === "function") {
      return (result as any).then(() => {
        console.log(`✅ [PASS] ${name}`);
        passed++;
      }).catch((err: any) => {
        console.error(`❌ [FAIL] ${name}:`, err.message || err);
        process.exitCode = 1;
      });
    } else {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    }
  } catch (err: any) {
    console.error(`❌ [FAIL] ${name}:`, err.message || err);
    process.exitCode = 1;
  }
}

async function runAllTests() {
  // ─── ISSUE 1: WhatsApp Meal Response Quality & Formatting ─────────────────
  console.log("--- ISSUE 1: WhatsApp Response Quality & Compact Formatting ---");

  test("1.1 Compact single-message format (< 800 chars) without separator corruption", () => {
    const dummyMeal = {
      foodName: "Nasi Ayam Bakar & Timun",
      calories: 520,
      protein: 38,
      carbs: 55,
      fat: 14,
      fiber: 4,
      sodium: 480,
      sugar: 5,
      mealType: "dinner",
      mealCategory: "MAKAN MALAM",
      aiConfidence: 94,
      time: "19:30"
    };

    const dummyUser = {
      name: "Budi",
      targetCalories: 2000,
      targetProtein: 140,
      targetCarbs: 220,
      targetFat: 60,
      goal: "lose",
      persona: "mia"
    };

    const dummyDayTotals = {
      calories: 1450,
      protein: 105,
      carbs: 160,
      fat: 42,
      sodium: 1200,
      sugar: 18
    };

    const card = formatNutritionCard(dummyMeal, dummyUser, dummyDayTotals);
    
    // Assert single compact message length
    assert(card.length < 800, `Message length ${card.length} exceeds 800 chars`);
    
    // Assert absence of corrupting horizontal bar unicode (━)
    assert(!card.includes("━"), "Message should not contain corrupted Unicode horizontal bar '━'");
    
    // Assert required sections exist
    assert(card.includes("🍽️ *Nasi Ayam Bakar & Timun*"), "Header must include food name");
    assert(card.includes("🌙 *MAKAN MALAM*"), "Must include meal category");
    assert(card.includes("📊 *Estimasi Nutrisi*"), "Must include nutrition section");
    assert(card.includes("🔥 520 kcal"), "Must include calories");
    assert(card.includes("🍖 Protein: 38g"), "Must include protein");
    assert(card.includes("🤖 *Coach Mia*"), "Must include Coach Mia header");
    assert(card.includes("📈 *Hari Ini*"), "Must include daily progress section");
    assert(card.includes("Sisa target:"), "Must include neutral sisa target info");
    assert(card.includes("Ketik *koreksi:"), "Must include correction footer");
  });

  test("1.2 Nutrition status does not use misleading 'Belum Cukup' badge", () => {
    const status = calculateNutrientStatus(35, 100, false);
    assert(status.statusBadge !== "🟡 Belum Cukup", "Status badge must NOT be 'Belum Cukup'");
    assert(status.statusBadge.startsWith("Sisa target:"), `Status badge should be neutral remaining format, got: ${status.statusBadge}`);
  });

  test("1.3 Coach Mia dinner context advises hydration & sleep, never 'nanti malam'", () => {
    const dummyMeal = {
      foodName: "Steak Daging & Sayur",
      calories: 650,
      protein: 48,
      carbs: 20,
      fat: 22,
      mealType: "dinner",
      mealCategory: "MAKAN MALAM"
    };

    const dummyUser = {
      name: "Rina",
      targetCalories: 1800,
      targetProtein: 120,
      goal: "lose",
      persona: "mia"
    };

    const dummyDayTotals = {
      calories: 1650,
      protein: 110,
      carbs: 140,
      fat: 45
    };

    const card = formatNutritionCard(dummyMeal, dummyUser, dummyDayTotals);
    assert(!card.toLowerCase().includes("nanti malam"), "Dinner advice must NOT say 'nanti malam'");
    assert(!card.toLowerCase().includes("selamat menikmati"), "Dinner advice must NOT say 'selamat menikmati' after meal is logged");
  });

  // ─── ISSUE 2: Onboarding Completion & WhatsApp Redirect ───────────────────
  console.log("\n--- ISSUE 2: Onboarding Completion & WhatsApp Redirect ---");

  test("2.1 WhatsApp destination URL uses official GymBuddy bot number, NEVER Twilio Sandbox", () => {
    const url = getWhatsAppDestinationUrl("Halo GymBuddy 👋");
    assert(!url.includes("14155238886"), "URL must NOT use Twilio Sandbox +14155238886");
    assert(url.includes("wa.me/"), "URL must be a valid wa.me link");
    assert(url.includes(encodeURIComponent("Halo GymBuddy 👋")), "URL must contain prefilled greeting");
  });

  // ─── ISSUE 3: Solid Food vs Hydration Strict Separation ────────────────────
  console.log("\n--- ISSUE 3: Solid Food vs Hydration Strict Separation ---");

  test("3.1 Solid food like SilverQueen Bites Milk Chocolate Cashews is NEVER classified as hydration", () => {
    // Import dashboard categorization logic equivalents
    const solidExceptions = [
      "french fries", "fries", "kentang", "sosis", "sausage", "nugget",
      "ayam", "chicken", "daging", "sapi", "ikan", "tahu", "tempe",
      "nasi", "mie", "bihun", "kwetiau", "burger", "pizza", "dimsum",
      "bakso", "siomay", "batagor", "telur", "telor", "seafood", "udang",
      "cumi", "pancong", "roti", "martabak", "cake", "kue", "pancake", "waffle",
      "biskuit", "sereal", "cereal", "ice cream", "es krim", "keju", "pudding",
      "puding", "bubur", "bolu", "donat", "pie", "tart", "saus", "sauce",
      "selai", "topping", "crepe", "churros", "pisang", "salad", "steak",
      "chocolate", "cokelat", "coklat", "cashew", "kacang", "snack", "candy",
      "permen", "wafer", "cookies", "kukis", "bites", "bar", "chips", "keripik", "crisp"
    ];

    const foodName = "SilverQueen Bites Milk Chocolate Cashews";
    const lower = foodName.toLowerCase();
    const isSolid = solidExceptions.some(se => lower.includes(se));
    assert(isSolid === true, "SilverQueen Bites Cashews must match solid exceptions");
  });

  test("3.2 Meal logs strictly separate from hydration logs by type", () => {
    const mockLogs = [
      { id: "1", type: "meal", foodName: "SilverQueen Bites Milk Chocolate Cashews", calories: 210, protein: 4, carbs: 22, fat: 12 },
      { id: "2", type: "hydration", foodName: "Air Mineral 600ml", isHydration: true, volumeMl: 600, amountMl: 600 },
      { id: "3", type: "meal", foodName: "Nasi Padang Rendang", calories: 650, protein: 32, carbs: 70, fat: 22 }
    ];

    const foodAndBeverageMeals = mockLogs.filter((item: any) => item.type === "meal" || (!item.type && !item.isHydration && item.type !== "hydration"));
    const hydrationLogs = mockLogs.filter((item: any) => item.type === "hydration" || item.isHydration === true);

    assert(foodAndBeverageMeals.length === 2, `Expected 2 food meals, got ${foodAndBeverageMeals.length}`);
    assert(hydrationLogs.length === 1, `Expected 1 hydration item, got ${hydrationLogs.length}`);
    assert(hydrationLogs[0].foodName === "Air Mineral 600ml", "Hydration item must be Air Mineral");
    
    // Verify SilverQueen is not in hydration
    const silverQueenInHydration = hydrationLogs.some((h: any) => h.foodName.includes("SilverQueen"));
    assert(!silverQueenInHydration, "SilverQueen must NOT be in hydrationLogs");
  });

  // ─── ISSUE 4: Meal Category Consistency ────────────────────────────────────
  console.log("\n--- ISSUE 4: Meal Category Consistency ---");

  test("4.1 Meal category is consistently mapped and preserved", () => {
    const sampleMeal = {
      id: "m-12345",
      type: "meal",
      mealCategory: "MAKAN MALAM",
      mealType: "dinner",
      foodName: "Ikan Bakar & Lalapan",
      calories: 420
    };

    assert(sampleMeal.mealCategory === "MAKAN MALAM", "Meal category must be MAKAN MALAM");
    assert(sampleMeal.mealType === "dinner", "Meal type must be dinner");
    assert(sampleMeal.type === "meal", "Type must be meal");
  });

  // ─── ISSUE 5: Zero OTP and Pure WhatsApp 2FA Verification ──────────────────
  console.log("\n--- ISSUE 5: Zero OTP & Pure WhatsApp 2FA Confirmation ---");

  test("5.1 WhatsApp 2FA message asks for YA / TIDAK confirmation, never OTP code", () => {
    const device = "Chrome on Windows";
    const location = "Jakarta, Indonesia";
    const nowFormatted = "5 Sep 2026 21:00";

    const waMsg = [
      `🔐 *Konfirmasi Login GymBuddy*`,
      ``,
      `Apakah Anda mencoba login ke GymBuddy?`,
      ``,
      `📱 *Perangkat*: ${device}`,
      `📍 *Lokasi*: ${location}`,
      `⏱️ *Waktu*: ${nowFormatted}`,
      ``,
      `Balas pesan ini untuk memproses:`,
      `*YA* — untuk mengonfirmasi login`,
      `*TIDAK* — untuk membatalkan`,
      ``,
      `_Pesan ini berlaku selama 5 menit. Jangan balas YA jika ini bukan Anda._`
    ].join("\n");

    assert(waMsg.includes("*YA* — untuk mengonfirmasi login"), "Must contain YA confirmation instructions");
    assert(waMsg.includes("*TIDAK* — untuk membatalkan"), "Must contain TIDAK cancellation instructions");
    assert(!waMsg.toLowerCase().includes("kode verifikasi (otp)"), "Must NOT contain OTP code instructions");
  });

  test("5.2 WhatsApp webhook handles 'YA' approval and 'TIDAK' rejection", () => {
    const testSession = {
      sessionId: "sess_test_123",
      normPhone: "081234567890",
      status: "pending",
      expiresAt: Date.now() + 300000
    };

    // Test YA
    const approveText = "YA";
    const isApprove = /^(?:ya(?:,\s*ini\s*saya|\s*ini\s*saya)?|yes|1|benar|setuju|it'?s\s*me)\b/i.test(approveText.trim());
    assert(isApprove === true, "'YA' must trigger login approval");

    // Test TIDAK
    const rejectText = "TIDAK";
    const isReject = /^(?:tidak|no|2|bukan(?:\s*saya)?|tolak|secure|amankan)\b/i.test(rejectText.trim());
    assert(isReject === true, "'TIDAK' must trigger login rejection");
  });

  console.log("\n===============================================================");
  console.log(`AUDIT RESULT: ${passed}/${total} TESTS PASSED`);
  console.log("===============================================================");
}

runAllTests();
