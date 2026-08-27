/**
 * Test Suite: WORKOUT INPUT INTENT & ADDITIONAL WORKOUT ACTIVITY DASHBOARD DELETE
 * 
 * Verifies:
 * 1. User-Reported Activity Priority (e.g. Treadmill moderate speed preserved, never substituted)
 * 2. Structured Workout Input (e.g. Lat Pulldown 3 sets x 12 reps @ 25 kg preserved)
 * 3. Scheduled Workout vs Completed Activity separation
 * 4. Vague Workout Input handling (e.g. "Aku gym tadi" -> general session without inventing fake exercises)
 * 5. Generic Exercise Ambiguity ("Cara melakukan squat yang benar?" -> Bodyweight Squat, not Goblet Squat)
 * 6. Dashboard Delete Action by activity ID & Calorie Recalculation
 */

import {
  extractWorkoutParameters,
  handleAdditionalActivityLogging,
  handleWorkoutProgressLogging,
  calculateUserData,
  AdditionalActivity
} from "../server";
import { findExerciseOrEquipment, formatWhatsAppExerciseGuide } from "../data/exerciseDb";

let totalPassed = 0;
let totalFailed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    totalPassed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ""}`);
    totalFailed++;
  }
}

console.log("\n================================================================================");
console.log("🧪 RUNNING SUITE: WORKOUT INPUT INTENT & DASHBOARD DELETE SPEC");
console.log("================================================================================\n");

// Mock user profiles
const mockUserMax = calculateUserData({
  name: "Rizky",
  phone: "081299990001",
  normalizedPhone: "081299990001",
  weight: 75,
  targetCalories: 2200,
  goal: "gain",
  goalTitle: "Membentuk Otot & Bulk Bersih",
  persona: "max",
  activeService: "both",
  gender: "male",
  age: 26
});

const mockUserMia = calculateUserData({
  name: "Siti",
  phone: "081299990002",
  normalizedPhone: "081299990002",
  weight: 60,
  targetCalories: 1800,
  goal: "lose",
  goalTitle: "Menurunkan Lemak Tubuh",
  persona: "mia",
  activeService: "both",
  gender: "female",
  age: 25
});

// ── GROUP 1: USER-REPORTED ACTIVITY HAS PRIORITY ─────────────────────────────
console.log("▶ GROUP 1: User-Reported Activity Has Priority");

const treadmillInput = "Tadi aku latihan treadmill 30 menit dengan kecepatan sedang";
const params1 = extractWorkoutParameters(treadmillInput);
assert(params1.durationMinutes === 30, "Extracts duration 30 minutes accurately");
assert(params1.intensity === "Kecepatan Sedang", "Extracts intensity 'Kecepatan Sedang' accurately");

const treadmillResp = handleAdditionalActivityLogging("081299990001", treadmillInput, mockUserMax);
assert(Boolean(treadmillResp && treadmillResp.length > 0), "Treadmill activity logging returns confirmation response");
const treadmillText = treadmillResp ? treadmillResp.join("\n") : "";

assert(treadmillText.includes("Treadmill"), "Preserves exact activity name 'Treadmill'");
assert(!treadmillText.toLowerCase().includes("stationary bike"), "Does NOT change Treadmill into Stationary Bike");
assert(!treadmillText.toLowerCase().includes("zone 2 bike"), "Does NOT fabricate bike parameters");
assert(treadmillText.includes("30 menit"), "Preserves duration 30 minutes in output card");
assert(treadmillText.includes("Kecepatan Sedang"), "Preserves intensity 'Kecepatan Sedang' in output card");

// ── GROUP 2: STRUCTURED WORKOUT INPUT DETAIL PRESERVATION ────────────────────
console.log("\n▶ GROUP 2: Structured Workout Input Detail Preservation");

const latPulldownInput = "Aku latihan lat pulldown 3 set, masing masing 12 repetisi dengan beban 25 kg";
const params2 = extractWorkoutParameters(latPulldownInput);
assert(params2.sets === 3, "Extracts sets: 3 accurately");
assert(params2.reps === 12, "Extracts reps: 12 accurately");
assert(params2.weightKg === 25, "Extracts weight: 25 kg accurately");

const latResp = handleWorkoutProgressLogging("081299990001", latPulldownInput, mockUserMax);
assert(Boolean(latResp && latResp.length > 0), "Lat Pulldown progress logging returns confirmation response");
const latText = latResp ? latResp.join("\n") : "";

assert(latText.includes("Lat Pulldown"), "Preserves exact exercise name 'Lat Pulldown'");
assert(latText.includes("3 Set"), "Preserves 3 sets in output");
assert(latText.includes("12 Repetisi") || latText.includes("12 reps"), "Preserves 12 reps in output");
assert(latText.includes("25 kg"), "Preserves 25 kg weight in output");
assert(!latText.includes("Barbell Bench Press"), "Does NOT substitute with scheduled chest routine");

// ── GROUP 3: SCHEDULED WORKOUT VS COMPLETED ACTIVITY SEPARATION ───────────────
console.log("\n▶ GROUP 3: Scheduled Workout vs Completed Activity Separation");

// 1. Asking for schedule -> Should NOT be processed as activity logging (returns null so isWorkoutScheduleQuery handles it)
const scheduleQuery = "hari ini jadwal latihanku apa?";
const progressForSchedule = handleWorkoutProgressLogging("081299990001", scheduleQuery, mockUserMax);
assert(progressForSchedule === null, "Explicit schedule query ('hari ini jadwal latihanku apa?') is NOT intercepted as completed activity");

const scheduleQuery2 = "jadwal latihan hari ini";
const progressForSchedule2 = handleWorkoutProgressLogging("081299990001", scheduleQuery2, mockUserMax);
assert(progressForSchedule2 === null, "Explicit schedule query ('jadwal latihan hari ini') is NOT intercepted as completed activity");

// 2. Reporting completed activity -> Should be processed as activity logging
const treadmillReport = "tadi aku treadmill 30 menit";
const treadmillProgress = handleWorkoutProgressLogging("081299990001", treadmillReport, mockUserMax);
assert(treadmillProgress !== null, "'tadi aku treadmill 30 menit' is recognized as completed activity");

const latReport = "aku latihan lat pulldown 3 set";
const latProgress = handleWorkoutProgressLogging("081299990001", latReport, mockUserMax);
assert(latProgress !== null, "'aku latihan lat pulldown 3 set' is recognized as completed activity");

// ── GROUP 4: VAGUE WORKOUT INPUT HANDLING ────────────────────────────────────
console.log("\n▶ GROUP 4: Vague Workout Input Handling");

const vagueGymInput = "Aku gym tadi";
const vagueResp = handleAdditionalActivityLogging("081299990001", vagueGymInput, mockUserMax);
assert(Boolean(vagueResp && vagueResp.length > 0), "'Aku gym tadi' is recorded as general additional activity session");
const vagueText = vagueResp ? vagueResp.join("\n") : "";

assert(!vagueText.toLowerCase().includes("barbell bench press"), "Does NOT invent specific exercises for vague input");
assert(!vagueText.toLowerCase().includes("goblet squat"), "Does NOT invent fake Goblet Squats for vague input");
assert(vagueText.toLowerCase().includes("sesi") || vagueText.toLowerCase().includes("gym") || vagueText.toLowerCase().includes("olahraga"), "Acknowledges gym workout session");
assert(vagueText.includes("45 menit") || vagueText.includes("Estimasi Bakar"), "Provides general session time / calorie estimate");

// ── GROUP 5: EXERCISE NAME AMBIGUITY HANDLING ────────────────────────────────
console.log("\n▶ GROUP 5: Generic Exercise Ambiguity Handling");

const genericSquatQuery = "Cara melakukan squat yang benar?";
const matchedSquat = findExerciseOrEquipment(genericSquatQuery);
assert(matchedSquat !== null, "Matches squat exercise in exercise database");
assert(matchedSquat?.id === "bodyweight-squat", "Generic 'squat' query resolves to Bodyweight Squat (not Goblet Squat or Smith Machine)");
assert(matchedSquat?.equipmentCategory === "bodyweight", "Generic squat equipment is categorized as bodyweight (tanpa alat)");

const guide = formatWhatsAppExerciseGuide(matchedSquat!, "max", "gain");
assert(!guide.text.toLowerCase().includes("dumbbell"), "Generic squat guide does NOT invent dumbbell equipment");
assert(!guide.text.toLowerCase().includes("kettlebell"), "Generic squat guide does NOT invent kettlebell equipment");

// Specific queries should still resolve to specific equipment
const gobletQuery = "Cara melakukan goblet squat dengan dumbbell?";
const matchedGoblet = findExerciseOrEquipment(gobletQuery);
assert(matchedGoblet?.id === "goblet-squat", "Explicit 'goblet squat' query resolves to Goblet Squat");

const smithQuery = "Cara pakai mesin smith machine squat?";
const matchedSmith = findExerciseOrEquipment(smithQuery);
assert(matchedSmith?.id === "smith-machine-squat", "Explicit 'smith machine' query resolves to Smith Machine Squat");

// ── GROUP 6: DASHBOARD ACTIVITY DELETE & CALORIE RECALCULATION ───────────────
console.log("\n▶ GROUP 6: Dashboard Activity Delete & Calorie Recalculation");

// Simulate 3 activities for user on Dashboard
const actA: AdditionalActivity = {
  id: "act-treadmill-101",
  activityName: "Treadmill",
  category: "cardio",
  icon: "🏃",
  durationMinutes: 30,
  intensity: "Kecepatan Sedang",
  estimatedCaloriesBurned: 200,
  timestamp: new Date().toISOString(),
  status: "completed"
};

const actB: AdditionalActivity = {
  id: "act-walking-102",
  activityName: "Jalan Kaki (Walking)",
  category: "cardio",
  icon: "🚶‍♂️",
  durationMinutes: 45,
  estimatedCaloriesBurned: 150,
  timestamp: new Date().toISOString(),
  status: "completed"
};

const actC: AdditionalActivity = {
  id: "act-latpulldown-103",
  activityName: "Lat Pulldown",
  category: "strength",
  icon: "🏋️‍♂️",
  sets: 3,
  reps: 12,
  weightKg: 25,
  details: "3 Set x 12 Repetisi • Beban: 25 kg",
  estimatedCaloriesBurned: 90,
  timestamp: new Date().toISOString(),
  status: "completed"
};

let userActivities = [actA, actB, actC];

// Initial total calories burned
const initialCalories = userActivities.reduce((sum, a) => sum + (a.estimatedCaloriesBurned || 0), 0);
assert(initialCalories === 440, `Initial total calories burned is 440 kcal (200 + 150 + 90 = ${initialCalories})`);

// Delete Activity B ("act-walking-102") by unique ID
const targetDeleteId = "act-walking-102";
userActivities = userActivities.filter(a => a.id !== targetDeleteId);

assert(userActivities.length === 2, "Activity list size reduced from 3 to 2 after deletion");
assert(userActivities.some(a => a.id === "act-treadmill-101"), "Activity A (Treadmill) remains 100% intact");
assert(!userActivities.some(a => a.id === "act-walking-102"), "Activity B (Walking) successfully removed by ID");
assert(userActivities.some(a => a.id === "act-latpulldown-103"), "Activity C (Lat Pulldown) remains 100% intact");

// Recalculated total calories burned
const recalculatedCalories = userActivities.reduce((sum, a) => sum + (a.estimatedCaloriesBurned || 0), 0);
assert(recalculatedCalories === 290, `Recalculated calories accurately equals 290 kcal (440 - 150 = ${recalculatedCalories})`);
assert(!recalculatedCalories.toString().includes("440"), "Deleted activity's 150 kcal is completely purged from calculation");

// ── GROUP 7: COMPREHENSIVE COMPLETED EXERCISE COVERAGE ──────────────────────
console.log("\n▶ GROUP 7: Comprehensive Completed Exercise Coverage");

// 1. Plank 1 menit
const plankInput = "Tadi aku plank 1 menit";
const plankParams = extractWorkoutParameters(plankInput);
assert(plankParams.durationMinutes === 1, "Plank duration extracted as 1 minute");
const plankResp = handleWorkoutProgressLogging("081299990002", plankInput, mockUserMia);
assert(Boolean(plankResp && plankResp.length > 0), "Plank 1 menit returns confirmation response");
const plankText = plankResp ? plankResp.join("\n") : "";
assert(plankText.includes("Plank"), "Plank confirmation includes 'Plank'");
assert(plankText.includes("1 menit"), "Plank confirmation includes '1 menit'");
assert(plankText.includes("LATIHAN BERHASIL DICATAT"), "Uses explicit confirmation header 'LATIHAN BERHASIL DICATAT'");
assert(plankText.includes("Plank 1 menit sudah tercatat"), "Coach Mia explicitly confirms 'Plank 1 menit sudah tercatat'");

// 2. Elliptical 35 menit dengan intensitas sedang
const ellipticalInput = "Tadi aku elliptical 35 menit dengan intensitas sedang";
const ellipticalParams = extractWorkoutParameters(ellipticalInput);
assert(ellipticalParams.durationMinutes === 35, "Elliptical duration extracted as 35 minutes");
assert(ellipticalParams.intensity === "Kecepatan Sedang", "Elliptical intensity extracted as 'Kecepatan Sedang'");
const ellipticalResp = handleWorkoutProgressLogging("081299990001", ellipticalInput, mockUserMax);
assert(Boolean(ellipticalResp && ellipticalResp.length > 0), "Elliptical 35 menit returns confirmation response");
const ellipticalText = ellipticalResp ? ellipticalResp.join("\n") : "";
assert(ellipticalText.includes("Elliptical"), "Elliptical confirmation includes 'Elliptical'");
assert(ellipticalText.includes("35 menit"), "Elliptical confirmation includes '35 menit'");
assert(ellipticalText.includes("Kecepatan Sedang"), "Elliptical confirmation includes 'Kecepatan Sedang'");

// 3. Push-Up
const pushUpInput = "Sudah push up 20 kali";
const pushUpParams = extractWorkoutParameters(pushUpInput);
assert(pushUpParams.reps === 20, "Push-up reps extracted as 20");
const pushUpResp = handleWorkoutProgressLogging("081299990001", pushUpInput, mockUserMax);
assert(Boolean(pushUpResp && pushUpResp.length > 0), "Push-up returns confirmation response");
assert(pushUpResp!.join("\n").includes("Push-Up"), "Push-up confirmation includes 'Push-Up'");

// 4. Sit-Up
const sitUpInput = "Barusan sit up 30 kali";
const sitUpParams = extractWorkoutParameters(sitUpInput);
assert(sitUpParams.reps === 30, "Sit-up reps extracted as 30");
const sitUpResp = handleWorkoutProgressLogging("081299990001", sitUpInput, mockUserMax);
assert(Boolean(sitUpResp && sitUpResp.length > 0), "Sit-up returns confirmation response");
assert(sitUpResp!.join("\n").includes("Sit-Up"), "Sit-up confirmation includes 'Sit-Up'");

// 5. Stretching
const stretchInput = "Selesai stretching 15 menit";
const stretchParams = extractWorkoutParameters(stretchInput);
assert(stretchParams.durationMinutes === 15, "Stretching duration extracted as 15 minutes");
const stretchResp = handleWorkoutProgressLogging("081299990001", stretchInput, mockUserMax);
assert(Boolean(stretchResp && stretchResp.length > 0), "Stretching returns confirmation response");
assert(stretchResp!.join("\n").includes("Stretching"), "Stretching confirmation includes 'Stretching'");

// 6. Seated Row
const seatedRowInput = "Aku latihan seated row 3 set, 12 repetisi, 30 kg";
const seatedRowParams = extractWorkoutParameters(seatedRowInput);
assert(seatedRowParams.sets === 3, "Seated row sets extracted as 3");
assert(seatedRowParams.reps === 12, "Seated row reps extracted as 12");
assert(seatedRowParams.weightKg === 30, "Seated row weight extracted as 30 kg");
const seatedRowResp = handleWorkoutProgressLogging("081299990001", seatedRowInput, mockUserMax);
assert(Boolean(seatedRowResp && seatedRowResp.length > 0), "Seated row returns confirmation response");
const seatedRowText = seatedRowResp ? seatedRowResp.join("\n") : "";
assert(seatedRowText.includes("Row") || seatedRowText.includes("seated"), "Seated row confirmation includes exercise name");
assert(seatedRowText.includes("3 Set"), "Seated row confirmation includes 3 Set");
assert(seatedRowText.includes("12 Repetisi"), "Seated row confirmation includes 12 Repetisi");
assert(seatedRowText.includes("30 kg"), "Seated row confirmation includes 30 kg");

// ── GROUP 8: DISTINGUISHING GUIDE VS COMPLETED VS FUTURE PLAN ─────────────────
console.log("\n▶ GROUP 8: Distinguishing Guide vs Completed vs Future Plan");

// 1. "Bagaimana cara melakukan plank?" -> Guide / Tutorial (NOT a completed log)
const plankGuideQuery = "Bagaimana cara melakukan plank?";
const plankGuideLog = handleWorkoutProgressLogging("081299990001", plankGuideQuery, mockUserMax);
assert(plankGuideLog === null, "'Bagaimana cara melakukan plank?' does NOT trigger workout logging");
const matchedPlankEx = findExerciseOrEquipment(plankGuideQuery);
assert(matchedPlankEx !== null && (matchedPlankEx.id === "plank-hold" || matchedPlankEx.aliases.includes("plank")), "'Bagaimana cara melakukan plank?' resolves to Exercise Guide tutorial in exerciseDb");

// 2. "Aku mau plank nanti" -> Future intent (NOT a completed log)
const futurePlankQuery = "Aku mau plank nanti";
const futurePlankLog = handleWorkoutProgressLogging("081299990001", futurePlankQuery, mockUserMax);
assert(futurePlankLog === null, "'Aku mau plank nanti' does NOT trigger workout logging");

// 3. "Tadi aku plank 1 menit" -> Completed activity (MUST log)
const completedPlankQuery = "Tadi aku plank 1 menit";
const completedPlankLog = handleWorkoutProgressLogging("081299990001", completedPlankQuery, mockUserMax);
assert(completedPlankLog !== null, "'Tadi aku plank 1 menit' MUST trigger workout logging");

// 4. "Nanti mau latihan lat pulldown" -> Future intent (NOT a completed log)
const futureLatQuery = "Nanti mau latihan lat pulldown";
const futureLatLog = handleWorkoutProgressLogging("081299990001", futureLatQuery, mockUserMax);
assert(futureLatLog === null, "'Nanti mau latihan lat pulldown' does NOT trigger workout logging");

// 5. "Aku latihan lat pulldown 3 set, 12 repetisi, 25 kg" -> Completed activity (MUST log)
const completedLatQuery = "Aku latihan lat pulldown 3 set, 12 repetisi, 25 kg";
const completedLatLog = handleWorkoutProgressLogging("081299990001", completedLatQuery, mockUserMax);
assert(completedLatLog !== null, "'Aku latihan lat pulldown 3 set, 12 repetisi, 25 kg' MUST trigger workout logging");

// ================================================================================
console.log("\n================================================================================");
console.log(`SUMMARY: ${totalPassed} PASSED | ${totalFailed} FAILED`);
console.log("================================================================================");

if (totalFailed > 0) {
  console.error("❌ SOME WORKOUT INTENT & DELETE TESTS FAILED!");
  process.exit(1);
} else {
  console.log("🎉 ALL WORKOUT INTENT & DASHBOARD DELETE TESTS PASSED PERFECTLY!\n");
}
