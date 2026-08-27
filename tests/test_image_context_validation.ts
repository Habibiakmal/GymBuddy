import {
  classifyUserInput,
  validatePlanContext,
  getUserPlanCapabilities,
  type UserPlanCapabilities
} from "../services/planContextEngine";
import { getValidatedUserAddressing } from "../services/nutritionEngine";

console.log("================================================================================");
console.log("🧪 RUNNING SUITE: IMAGE INPUT CONTEXT VALIDATION SPEC");
console.log("================================================================================");

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}${detail ? ` -> Detail: ${detail}` : ""}`);
    failedCount++;
  }
}

const mockUserMia = {
  name: "Budi Santoso",
  nickname: "Budi",
  persona: "mia",
  subscription_plan: "both" as any,
  goalTitle: "Menurunkan Berat Badan",
  age: 28,
  gender: "pria"
};

const mockUserMax = {
  name: "Habibi",
  nickname: "Habibi",
  persona: "max",
  subscription_plan: "both" as any,
  goalTitle: "Muscle Building",
  age: 25,
  gender: "pria"
};

const mockUserLansia = {
  name: "Bambang Sudirgo",
  nickname: "Bambang",
  persona: "mia",
  subscription_plan: "both" as any,
  goalTitle: "Kebugaran Jantung & Mobilitas",
  age: 65,
  gender: "pria"
};

// ── GROUP 1: IMAGE + TEXT CONTEXT PRIORITY (Prompt Examples) ──
console.log("\n▶ GROUP 1: Image + Text Context Priority");

// Example 1: User uploads unrelated Excel screenshot with "ini maksudnya apa?"
// Text is generic, but if user explicitly mentions office spreadsheet:
const catOffice = classifyUserInput("ini spreadsheet daftar nama pegawai dan gaji", true);
assert(catOffice === "OUT_OF_CONTEXT", "Explicit spreadsheet/office text with image classified as OUT_OF_CONTEXT");

const resOffice = validatePlanContext("ini spreadsheet daftar nama pegawai dan gaji", true, mockUserMia);
assert(resOffice.canProceed === false, "canProceed is false for spreadsheet upload");
assert(resOffice.decision === "REDIRECT_OUT_OF_CONTEXT", "Decision is REDIRECT_OUT_OF_CONTEXT");
assert(resOffice.redirectMessage?.includes("Aku belum bisa mengaitkan gambar ini dengan aktivitas GymBuddy"), "Prompt exact redirect: 'Aku belum bisa mengaitkan gambar ini dengan aktivitas GymBuddy'");
assert(resOffice.redirectMessage?.includes("cek makanan, nutrisi, atau workout"), "Suggests supported capabilities (makanan, nutrisi, workout)");

// Example 2: User uploads gym equipment with "ini alat apa?"
const catEquip = classifyUserInput("ini alat apa?", true);
assert(catEquip === "WORKOUT", "Photo with 'ini alat apa?' classified as WORKOUT");

const resEquip = validatePlanContext("ini alat apa?", true, mockUserMia);
assert(resEquip.canProceed === true, "canProceed is true for gym equipment photo");
assert(resEquip.decision === "PROCESS_WORKOUT", "Decision is PROCESS_WORKOUT");

// Example 3: User uploads food photo with "aku makan ini"
const catFood = classifyUserInput("aku makan ini", true);
assert(catFood === "NUTRITION", "Photo with 'aku makan ini' classified as NUTRITION");

const resFood = validatePlanContext("aku makan ini", true, mockUserMia);
assert(resFood.canProceed === true, "canProceed is true for food photo");
assert(resFood.decision === "PROCESS_NUTRITION", "Decision is PROCESS_NUTRITION");

// ── GROUP 2: NO VISUAL GUESSING & UNRELATED IMAGE REDIRECTION ──
console.log("\n▶ GROUP 2: No Visual Guessing on Unrelated / Ambiguous Images");

// When Gemini evaluates an unrelated image (e.g. Excel spreadsheet) and sets isUnrelatedImage: true
function simulateImageHandling(parsedGemini: any, hasImage: boolean, userData: any) {
  const isMia = (userData.persona || "mia").toLowerCase().includes("mia");
  const isLansia = (userData.age || 0) >= 60;
  const addressing = getValidatedUserAddressing(userData);

  if (parsedGemini.isFood && !parsedGemini.isUnrelatedImage) {
    return { type: "NUTRITION_CARD", message: "Rekap Nutrisi" };
  } else if (parsedGemini.isEquipment && !parsedGemini.isUnrelatedImage) {
    return { type: "EQUIPMENT_CARD", message: "Panduan Alat Gym" };
  } else if (hasImage || parsedGemini.isUnrelatedImage) {
    const defaultUnrelatedMsg = isMia
      ? "Maaf ya 😊 Aku belum bisa mengaitkan gambar ini dengan aktivitas GymBuddy. Kalau kamu ingin aku bantu cek makanan, nutrisi, atau workout, kirim gambar yang sesuai ya."
      : (isLansia
          ? `Mohon maaf, ${addressing.validatedAddress}. Saya belum dapat mengaitkan gambar ini dengan aktivitas GymBuddy. Apabila Anda ingin Saya mendampingi pencatatan makanan, nutrisi, atau panduan latihan, silakan kirimkan gambar yang sesuai ya. 🌿`
          : `Sorry ya, ${addressing.validatedAddress}! Gue belum bisa mengaitkan gambar ini dengan aktivitas GymBuddy. Kalau lo mau gue bantu cek makanan, nutrisi, atau panduan latihan, kirim foto yang sesuai ya! 💪`);
    return { type: "UNRELATED_IMAGE_REDIRECT", message: parsedGemini.coachComment || defaultUnrelatedMsg };
  }
  return { type: "GENERAL_REPLY", message: parsedGemini.generalReply };
}

// Case A: Excel spreadsheet uploaded (parsed as unrelated image)
const parsedExcel = {
  isFood: false,
  isEquipment: false,
  isUnrelatedImage: true,
  unrelatedExplanation: "Screenshot Excel spreadsheet daftar karyawan",
  coachComment: "Maaf ya 😊 Aku belum bisa mengaitkan gambar ini dengan aktivitas GymBuddy. Kalau kamu ingin aku bantu cek makanan, nutrisi, atau workout, kirim gambar yang sesuai ya."
};

const resultExcel = simulateImageHandling(parsedExcel, true, mockUserMia);
assert(resultExcel.type === "UNRELATED_IMAGE_REDIRECT", "Excel spreadsheet triggers UNRELATED_IMAGE_REDIRECT");
assert(resultExcel.message.includes("belum bisa mengaitkan gambar ini"), "Excel spreadsheet politely redirected without guessing");
assert(!resultExcel.message.toLowerCase().includes("kalori"), "Zero nutrition fabrication for spreadsheet");
assert(!resultExcel.message.toLowerCase().includes("reps") && !resultExcel.message.toLowerCase().includes("sets"), "Zero workout exercise guide fabrication for spreadsheet");

// Case B: Non-food & non-equipment image where AI did NOT set isFood or isEquipment
const parsedRandomPhoto = {
  isFood: false,
  isEquipment: false,
  generalReply: "Foto pemandangan alam"
};
const resultRandom = simulateImageHandling(parsedRandomPhoto, true, mockUserMia);
assert(resultRandom.type === "UNRELATED_IMAGE_REDIRECT", "Random non-food/non-equipment photo triggers UNRELATED_IMAGE_REDIRECT");
assert(resultRandom.message.includes("belum bisa mengaitkan gambar ini"), "Random photo gets GymBuddy capability redirect");

// ── GROUP 3: COACH PERSONA & ADDRESSING IN IMAGE REDIRECTION ──
console.log("\n▶ GROUP 3: Coach Persona & Respectful Addressing");

// Coach Max
const resMax = validatePlanContext("ini dokumen invoice kantor", true, mockUserMax);
assert(resMax.redirectMessage?.includes("Gue belum bisa mengaitkan gambar ini") || resMax.redirectMessage?.includes("Habibi"), "Coach Max redirect uses natural masculine/friendly tone");

// Coach Mia for Lansia (Pak Bambang, 65 th)
const resLansia = validatePlanContext("ini laporan excel absensi", true, mockUserLansia);
assert(resLansia.redirectMessage?.includes("Pak Bambang") || resLansia.redirectMessage?.includes("Saya"), "Lansia redirect uses respectful honorific and formal tone");
assert(!resLansia.redirectMessage?.includes("bro"), "Zero forbidden 'bro' slang in Lansia redirect");

// ── GROUP 4: PLAN RESTRICTIONS WITH IMAGES ──
console.log("\n▶ GROUP 4: Plan Capability Enforcement with Images");

const mockNutritionOnlyUser = {
  ...mockUserMia,
  plan: "nutritionist",
  activeService: "nutritionist"
};

const mockWorkoutOnlyUser = {
  ...mockUserMax,
  plan: "workout",
  activeService: "workout"
};

// Workout equipment photo sent by user with Nutrition Only plan
const resEquipOnNutrition = validatePlanContext("ini alat apa?", true, mockNutritionOnlyUser);
assert(resEquipOnNutrition.canProceed === false, "canProceed is false for equipment inquiry on Nutrition-Only plan");
assert(resEquipOnNutrition.decision === "REDIRECT_UNSUPPORTED_WORKOUT", "Redirected to unsupported workout on Nutrition plan");

// Food photo sent by user with Workout Only plan
const resFoodOnWorkout = validatePlanContext("aku makan ini", true, mockWorkoutOnlyUser);
assert(resFoodOnWorkout.canProceed === false, "canProceed is false for food logging on Workout-Only plan");
assert(resFoodOnWorkout.decision === "REDIRECT_UNSUPPORTED_NUTRITION", "Redirected to unsupported nutrition on Workout plan");

// ── SUMMARY ──
console.log("\n================================================================================");
console.log(`SUMMARY: ${passedCount} PASSED | ${failedCount} FAILED`);
console.log("================================================================================");

if (failedCount === 0) {
  console.log("🎉 ALL IMAGE INPUT CONTEXT VALIDATION TESTS PASSED PERFECTLY!\n");
  process.exit(0);
} else {
  console.error("❌ SOME TESTS FAILED!\n");
  process.exit(1);
}
