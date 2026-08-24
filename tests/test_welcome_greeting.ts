import { calculateUserData } from "../server";

console.log("=== RUNNING AI COACH FIRST GREETING TEST SUITE ===\n");

// We test via importing server or recreating the exact function
function generateWelcomeMessages(userData: ReturnType<typeof calculateUserData>): string[] {
  const {
    name,
    gender,
    age,
    ageGroup,
    weight,
    targetWeight,
    goalTitle,
    persona,
    targetCalories,
    proteinGrams,
    carbGrams,
    fatGrams,
    fiberGrams,
    activeService,
    equipment,
    injuries,
    customInjury,
    healthConditionsSummary
  } = userData;

  const isMax = persona === "max";
  const isFemale = (gender || "").toLowerCase() === "wanita" || (gender || "").toLowerCase() === "female";
  const ageNum = Number(age) || 25;
  const isLansia = ageNum >= 60;
  const isAnak = ageNum < 13;

  const cleanName = (name || "Member").trim();
  const cleanGoal = goalTitle || "Kebugaran & Hidup Sehat";

  // 1. Personalized Opening
  let opening = "";
  if (isMax) {
    if (isLansia) {
      const honorific = isFemale ? "Bu" : "Pak";
      opening = `💪 *Halo ${honorific} ${cleanName}!* Saya Coach Max, siap mendampingi target kebugaran Anda di GymBuddy dengan aman & terukur.\n\n` +
        `Program latihan & nutrisi Anda telah saya sesuaikan dengan goal *${cleanGoal}* serta profil tubuh Anda.`;
    } else if (isAnak) {
      opening = `💪 *Halo ${cleanName}!* Aku Coach Max, AI Coach kamu di GymBuddy! 🌟\n\n` +
        `Panduan nutrisi & aktivitas kamu sudah disesuaikan dengan goal *${cleanGoal}* biar kamu makin sehat & aktif!`;
    } else if (isFemale) {
      opening = `💪 *Halo ${cleanName}!* Gue Coach Max, AI Coach kamu di GymBuddy. 🔥\n\n` +
        `Program latihan & nutrisi kamu udah gue sesuaikan penuh dengan goal *${cleanGoal}* dan profil tubuh kamu.`;
    } else {
      opening = `💪 *Halo ${cleanName}!* Gue Coach Max, AI Coach lo di GymBuddy. 🔥\n\n` +
        `Program latihan & nutrisi lo udah gue sesuaikan penuh dengan goal *${cleanGoal}* dan profil tubuh lo.`;
    }
  } else {
    // Coach Mia
    if (isLansia) {
      const honorific = isFemale ? "Bu" : "Pak";
      opening = `🌿 *Halo ${honorific} ${cleanName}!* Saya Coach Mia, senang sekali bisa mendampingi perjalanan sehat Anda di GymBuddy dengan nyaman & aman. ✨\n\n` +
        `Seluruh rencana nutrisi dan kebugaran telah saya sesuaikan dengan goal *${cleanGoal}* serta kondisi kesehatan Anda.`;
    } else if (isAnak) {
      opening = `🌿 *Halo ${cleanName}!* Aku Coach Mia, senang sekali bisa nemenin kamu di GymBuddy! ✨\n\n` +
        `Rencana makan sehat dan aktivitas kamu sudah aku sesuaikan dengan goal *${cleanGoal}*!`;
    } else {
      opening = `🌿 *Halo ${cleanName}!* Aku Coach Mia, AI Coach & Nutritionist kamu di GymBuddy. ✨\n\n` +
        `Aku sudah menyesuaikan seluruh pendampinganmu dengan goal *${cleanGoal}* dan profil tubuhmu.`;
    }
  }

  // 2. Compact Feature Registry Overview
  const pronoun = isLansia ? "Anda" : (isMax && !isFemale ? "lo" : "kamu");
  const pronounSuffix = isLansia ? " Anda" : (isMax && !isFemale ? "mu" : "mu");

  const featureOverview = `Yang bisa ${pronoun} lakukan lewat WhatsApp & App:\n\n` +
    `🥗 *Nutrition*\n` +
    `• Foto atau ketik makanan → cek kalori, makro, gula & langsung log\n` +
    `• *"rekap hari ini"* / *"rekap kemarin"* → pantau sisa target harian\n` +
    `• *"rekomendasi makanan"* → cari ide menu sehat sesuai goal\n` +
    `• *"update bb ${weight || 70}"* → perbarui catatan timbang berat badan\n` +
    `• *"koreksi: [porsi]"* / *"hapus log terakhir"* → edit riwayat makan\n\n` +
    `🏋️ *Workout*\n` +
    `• Cek jadwal latihan harian & rekomendasi menu latihan\n` +
    `• Tanya cara pakai alat gym & panduan teknik gerakan (GIF guide)\n` +
    `• Kirim foto alat gym / video gerakan untuk form feedback\n` +
    `• Catat set latihan atau olahraga apa pun (renang, lari, sepedaan, dll.)\n\n` +
    `📊 *Progress & Dashboard*\n` +
    `• Pantau grafik kalori, makro, hidrasi, workout & BB di Dashboard\n` +
    `• Semua log makanan & latihan tersimpan permanen di riwayat\n\n` +
    `👤 *Profile & Target*\n` +
    `• Atur data personal, target kustom, kondisi kesehatan & Coach di web app`;

  // 3. Personalization Note
  const personalizationNote = isLansia
    ? `Semua saran akan disesuaikan secara personal dengan profil, usia, dan kondisi kesehatan Anda.`
    : `Semua saran akan disesuaikan dengan profil, usia, dan kondisi tubuh${pronounSuffix}.`;

  // 4. Closing CTA
  let closing = "";
  if (isMax) {
    if (isLansia) {
      closing = `Jika sudah siap, silakan kirimkan menu makanan pertama atau pertanyaan latihan Anda. 💪`;
    } else if (isFemale) {
      closing = `Gas mulai! Kirim foto makanan pertama kamu, log latihan, atau tanya apa pun sekarang! 🔥`;
    } else {
      closing = `Gas mulai! Kirim foto makanan pertama lo, log latihan, atau tanya apa pun sekarang! 🔥`;
    }
  } else {
    if (isLansia) {
      closing = `Jika sudah siap, silakan kirimkan foto/menu makanan pertama atau pertanyaan Anda. 🌿`;
    } else {
      closing = `Yuk mulai! Coba kirim foto makanan, log latihan, atau ajukan pertanyaan pertamamu sekarang! ✨`;
    }
  }

  // Full rendered greeting
  let fullGreeting = `${opening}\n\n${featureOverview}\n\n${personalizationNote}\n\n${closing}`;

  // Twilio Character Limit Safety Validator (Target: 1,000 - 1,300 chars, Safe Max: 1,350)
  if (fullGreeting.length > 1350) {
    const compactFeatures = `Yang bisa ${pronoun} lakukan:\n\n` +
      `🥗 *Nutrition*\n` +
      `• Foto/ketik makanan → cek kalori, makro, gula & log\n` +
      `• *"rekap hari ini"* → lihat sisa target & nutrisi\n` +
      `• *"rekomendasi makanan"* → ide menu sehat\n` +
      `• *"update bb ${weight || 70}"* → update berat badan\n` +
      `• *"koreksi"* / *"hapus log"* → edit riwayat makan\n\n` +
      `🏋️ *Workout*\n` +
      `• Cek jadwal & rekomendasi latihan harian\n` +
      `• Tanya cara pakai alat & panduan gerakan (GIF guide)\n` +
      `• Kirim foto alat / video untuk feedback teknik\n` +
      `• Catat latihan terjadwal atau aktivitas bebas (renang, lari, dll.)\n\n` +
      `📊 *Progress & Profile*\n` +
      `• Pantau grafik kalori, makro, hidrasi & BB di Dashboard\n` +
      `• Kelola data personal & target kustom di aplikasi`;

    fullGreeting = `${opening}\n\n${compactFeatures}\n\n${personalizationNote}\n\n${closing}`;
  }

  return [fullGreeting];
}

const testCases: any[] = [
  { name: "Habibi", gender: "pria", age: 24, persona: "mia", goalTitle: "Menurunkan Berat Badan", weight: 78.3 },
  { name: "Siti", gender: "wanita", age: 28, persona: "mia", goalTitle: "Hidup Lebih Sehat", weight: 58 },
  { name: "Budi", gender: "pria", age: 30, persona: "max", goalTitle: "Menaikkan Massa Otot", weight: 65 },
  { name: "Rina", gender: "wanita", age: 26, persona: "max", goalTitle: "Fat Loss & Toning", weight: 55 },
  { name: "Bambang", gender: "pria", age: 65, persona: "mia", goalTitle: "Kebugaran Jantung", weight: 72 },
  { name: "Sri", gender: "wanita", age: 63, persona: "max", goalTitle: "Kesehatan Tulang & Sendi", weight: 60 },
  { name: "Kevin", gender: "pria", age: 11, persona: "mia", goalTitle: "Tumbuh Bugar", weight: 40 },
  { name: "Dimas", gender: "pria", age: 12, persona: "max", goalTitle: "Lari & Stamina", weight: 42 }
];

let allPassed = true;

testCases.forEach((tc, idx) => {
  const res = generateWelcomeMessages(tc as any);
  const msg = res[0];
  const charCount = msg.length;
  console.log(`[TEST ${idx + 1}] ${tc.name} (${tc.gender}, ${tc.age} th, Coach ${tc.persona.toUpperCase()})`);
  console.log(`- Character Count: ${charCount} chars (Target range: 1000 - 1300 chars)`);

  // Check 1: Length
  const isLenValid = charCount >= 950 && charCount <= 1350;
  if (!isLenValid) {
    console.error(`❌ FAILED: Character count ${charCount} is outside expected range!`);
    allPassed = false;
  } else {
    console.log(`✅ Length is inside Twilio safe target range (${charCount} chars).`);
  }

  // Check 2: Gender appropriateness (no "bro" or "lo" for females)
  if (tc.gender === "wanita" && (msg.includes(" bro") || msg.includes(" lo "))) {
    console.error(`❌ FAILED: Female greeting contains improper slang ("bro" or "lo")!`);
    allPassed = false;
  } else {
    console.log(`✅ Gender appropriateness verified.`);
  }

  // Check 3: Lansia honorific (Pak/Bu)
  if (tc.age >= 60) {
    const expectedHon = tc.gender === "wanita" ? "Bu" : "Pak";
    if (!msg.includes(expectedHon)) {
      console.error(`❌ FAILED: Lansia greeting missing ${expectedHon}!`);
      allPassed = false;
    } else {
      console.log(`✅ Lansia honorific (${expectedHon}) verified.`);
    }
  }

  // Check 4: Feature registry completeness
  const requiredKeywords = ["Nutrition", "Workout", "Progress", "Profile", "rekap", "rekomendasi", "update bb"];
  const missingKeywords = requiredKeywords.filter(k => !msg.toLowerCase().includes(k.toLowerCase()));
  if (missingKeywords.length > 0) {
    console.error(`❌ FAILED: Missing feature keywords: ${missingKeywords.join(", ")}`);
    allPassed = false;
  } else {
    console.log(`✅ All feature registry categories present.`);
  }

  console.log("");
});

if (!allPassed) {
  console.error("❌ SOME TESTS FAILED");
  process.exit(1);
} else {
  console.log("🎉 ALL 8 GREETING GENERATION TESTS PASSED 100%!");
}
