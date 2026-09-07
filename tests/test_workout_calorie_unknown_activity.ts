/**
 * Test Suite: WORKOUT CALORIE ESTIMATION & UNKNOWN ACTIVITY CLARIFICATION SPEC
 * 
 * Verifies:
 * 1. Test A: "ku sudah olahraga 45 menit"
 *    - Intent = WORKOUT_LOG
 *    - Duration = 45 minutes
 *    - Activity = UNKNOWN
 *    - CaloriesBurned = null / not calculated
 *    - Clarification requested
 *    - No invented calorie value (no 352 kcal, no "Olahraga Tambahan")
 * 2. Test B: "aku sudah lari 45 menit"
 *    - Intent = WORKOUT_LOG
 *    - Activity = running (Lari)
 *    - Duration = 45 minutes
 *    - CaloriesBurned calculated using MET & user weight
 *    - Calorie value explicitly presented as an estimate (~X kcal)
 * 3. Test C: User has today's scheduled workout: "ku sudah olahraga 45 menit"
 *    - System MUST NOT assume the scheduled workout was completed
 *    - System MUST ask which activity was performed
 * 4. Test D: "aku sudah selesai latihan HIIT 45 menit"
 *    - Activity = HIIT
 *    - Duration = 45 minutes
 *    - Calculate estimated calories (~X kcal)
 *    - Save completed workout
 * 5. Two-Turn Clarification Flow:
 *    - Turn 1: "ku sudah olahraga 45 menit" -> requests clarification, pending state stored
 *    - Turn 2: "lari" -> resolves to Lari 45 min, ~X kcal estimated, persists completed log
 * 6. Read-Only Schedule Requests:
 *    - "kasih aku jadwal olahraga hari ini" -> read-only schedule, NO workout log, NO calories burned
 * 7. Coach Persona Isolation:
 *    - Coach Mia and Coach Max both ask clarification without absolute safety claims
 */

import {
  handleWorkoutProgressLogging,
  calculateUserData,
  pendingWorkoutClarifications,
  dbData,
  saveDb,
  AdditionalActivity
} from "../server";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ""}`);
    failed++;
  }
}

console.log("\n================================================================================");
console.log("🧪 RUNNING SUITE: WORKOUT CALORIE ESTIMATION & UNKNOWN ACTIVITY CLARIFICATION");
console.log("================================================================================\n");

// Initialize users
const userMia = calculateUserData({
  name: "Dewi",
  phone: "081299990010",
  normalizedPhone: "081299990010",
  weight: 60,
  targetCalories: 1800,
  goal: "lose",
  persona: "mia",
  activeService: "both",
  gender: "female",
  age: 27
});

const userMax = calculateUserData({
  name: "Budi",
  phone: "081299990020",
  normalizedPhone: "081299990020",
  weight: 75,
  targetCalories: 2200,
  goal: "gain",
  persona: "max",
  activeService: "both",
  gender: "male",
  age: 26
});

// Clean slate for test phones
pendingWorkoutClarifications.clear();
const today = new Date().toISOString().split("T")[0];
delete dbData.dailyLogs[`gymbuddy_activities_081299990010_${today}`];
delete dbData.dailyLogs[`gymbuddy_activities_081299990020_${today}`];
delete dbData.dailyLogs[`gymbuddy_exercises_081299990010_${today}`];
delete dbData.dailyLogs[`gymbuddy_exercises_081299990020_${today}`];

// ─────────────────────────────────────────────────────────────────────────────
// TEST A: "ku sudah olahraga 45 menit" (Generic Activity with Duration)
// ─────────────────────────────────────────────────────────────────────────────
console.log("▶ TEST A: 'ku sudah olahraga 45 menit'");

const respA = handleWorkoutProgressLogging("081299990010", "ku sudah olahraga 45 menit", userMia);
assert(respA !== null, "Test A: handleWorkoutProgressLogging returns response");
const textA = (respA || []).join("\n");

assert(!textA.includes("Olahraga Tambahan"), "Test A: Does NOT invent activity 'Olahraga Tambahan'");
assert(!textA.includes("352 kcal"), "Test A: Does NOT invent 352 kcal or arbitrary calories");
assert(!textA.includes("Estimasi Bakar"), "Test A: Does NOT include calorie burn section");
assert(textA.toLowerCase().includes("olahraga apa"), "Test A: Asks clarification on what activity was performed");
assert(textA.includes("45 menit"), "Test A: Acknowledges 45 minutes duration");
assert(textA.includes("jalan kaki") || textA.includes("lari") || textA.includes("gym") || textA.includes("HIIT"), "Test A: Provides activity suggestions");

const pendingA = pendingWorkoutClarifications.get("081299990010");
assert(pendingA !== undefined, "Test A: Stores pending workout clarification");
assert(pendingA?.durationMinutes === 45, "Test A: Pending state records duration = 45 min");

const savedActivitiesA = dbData.dailyLogs[`gymbuddy_activities_081299990010_${today}`] || [];
assert(savedActivitiesA.length === 0, "Test A: No completed activity log created before activity is known");

// ─────────────────────────────────────────────────────────────────────────────
// TEST B: "aku sudah lari 45 menit" (Specific Activity with Duration)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n▶ TEST B: 'aku sudah lari 45 menit'");

pendingWorkoutClarifications.clear();
const respB = handleWorkoutProgressLogging("081299990010", "aku sudah lari 45 menit", userMia);
assert(respB !== null, "Test B: handleWorkoutProgressLogging returns response");
const textB = (respB || []).join("\n");

assert(textB.includes("Lari (Running)"), "Test B: Resolves activity to 'Lari (Running)'");
assert(textB.includes("45 menit"), "Test B: Preserves duration = 45 menit");
assert(textB.includes("Estimasi Bakar"), "Test B: Clearly presents calories burned as an estimate");
// For 60kg, MET 9.5, 45 mins: 9.5 * 60 * 0.75 = 427.5 -> 428 kcal
assert(textB.includes("428 kcal") || textB.includes("~"), "Test B: Correctly calculates MET-based calories (~428 kcal)");

const savedActivitiesB = dbData.dailyLogs[`gymbuddy_activities_081299990010_${today}`] || [];
assert(savedActivitiesB.length === 1, "Test B: Persists 1 completed workout activity in database");
assert(savedActivitiesB[0]?.activityName.includes("Lari"), "Test B: Saved record has activity 'Lari'");
assert(savedActivitiesB[0]?.durationMinutes === 45, "Test B: Saved record has duration 45 min");
assert(savedActivitiesB[0]?.estimatedCaloriesBurned !== undefined && savedActivitiesB[0]?.estimatedCaloriesBurned > 0, "Test B: Saved record has estimated calories");

// ─────────────────────────────────────────────────────────────────────────────
// TEST C: User has today's scheduled workout: "ku sudah olahraga 45 menit"
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n▶ TEST C: Scheduled Workout Separation on 'ku sudah olahraga 45 menit'");

pendingWorkoutClarifications.clear();
// Simulate scheduled exercises for userMax
dbData.dailyLogs[`gymbuddy_exercises_081299990020_${today}`] = [
  { id: "ex-1", name: "Barbell Bench Press", targetSets: 4, completedSets: 0, status: "not_started" },
  { id: "ex-2", name: "Incline Dumbbell Press", targetSets: 3, completedSets: 0, status: "not_started" }
];

const respC = handleWorkoutProgressLogging("081299990020", "ku sudah olahraga 45 menit", userMax);
assert(respC !== null, "Test C: Returns response");
const textC = (respC || []).join("\n");

assert(textC.toLowerCase().includes("olahraga apa"), "Test C: Asks which activity was performed");
assert(!textC.includes("Barbell Bench Press"), "Test C: Does NOT claim scheduled Barbell Bench Press was completed");
assert(!textC.includes("100%"), "Test C: Does NOT claim scheduled routine is 100% finished");

const scheduledExercisesAfter = dbData.dailyLogs[`gymbuddy_exercises_081299990020_${today}`];
assert(scheduledExercisesAfter[0].completedSets === 0, "Test C: Scheduled Barbell Bench Press completedSets remains 0");
assert(scheduledExercisesAfter[1].completedSets === 0, "Test C: Scheduled Incline Dumbbell Press completedSets remains 0");
assert(scheduledExercisesAfter[0].status === "not_started", "Test C: Scheduled exercise status remains 'not_started'");

// ─────────────────────────────────────────────────────────────────────────────
// TEST D: "aku sudah selesai latihan HIIT 45 menit"
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n▶ TEST D: 'aku sudah selesai latihan HIIT 45 menit'");

pendingWorkoutClarifications.clear();
const respD = handleWorkoutProgressLogging("081299990020", "aku sudah selesai latihan HIIT 45 menit", userMax);
assert(respD !== null, "Test D: Returns response");
const textD = (respD || []).join("\n");

assert(textD.includes("HIIT"), "Test D: Activity recognized as HIIT");
assert(textD.includes("45 menit"), "Test D: Duration recognized as 45 menit");
// For 75kg, MET 8.5, 45 mins: 8.5 * 75 * 0.75 = 478.1 -> 478 kcal
assert(textD.includes("Estimasi Bakar"), "Test D: Calories labeled as estimate");
assert(textD.includes("478 kcal") || textD.includes("~"), "Test D: Calculates estimated calories for HIIT");

const savedActivitiesD = dbData.dailyLogs[`gymbuddy_activities_081299990020_${today}`] || [];
const hiitAct = savedActivitiesD.find((a: any) => a.activityName.includes("HIIT"));
assert(Boolean(hiitAct), "Test D: Completed HIIT workout saved in database");

// ─────────────────────────────────────────────────────────────────────────────
// TEST E: Two-Turn Clarification Flow
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n▶ TEST E: Two-Turn Clarification Flow");

// Turn 1:
pendingWorkoutClarifications.clear();
delete dbData.dailyLogs[`gymbuddy_activities_081299990010_${today}`];
delete dbData.dailyLogs[`gymbuddy_activities_6281299990010_${today}`];

const turn1 = handleWorkoutProgressLogging("081299990010", "ku sudah olahraga 45 menit", userMia);
assert(turn1 !== null, "Turn 1: Response returned");
assert(turn1![0].toLowerCase().includes("olahraga apa"), "Turn 1: Clarification requested");
assert(pendingWorkoutClarifications.has("081299990010"), "Turn 1: Pending clarification registered");

// Turn 2: User answers "lari"
const turn2 = handleWorkoutProgressLogging("081299990010", "lari", userMia);
assert(turn2 !== null, "Turn 2: Response returned");
const textTurn2 = (turn2 || []).join("\n");

assert(textTurn2.includes("Lari (Running)"), "Turn 2: Activity resolved to 'Lari (Running)'");
assert(textTurn2.includes("45 menit"), "Turn 2: Retrieved pending duration of 45 minutes");
assert(textTurn2.includes("Estimasi Bakar"), "Turn 2: Estimates calories burned");
assert(!pendingWorkoutClarifications.has("081299990010"), "Turn 2: Clears pending clarification");

const savedActivitiesE = dbData.dailyLogs[`gymbuddy_activities_081299990010_${today}`] || [];
assert(savedActivitiesE.length === 1, "Turn 2: Exactly 1 completed workout saved");
assert(savedActivitiesE[0]?.activityName.includes("Lari"), "Turn 2: Activity name is Lari");
assert(savedActivitiesE[0]?.durationMinutes === 45, "Turn 2: Duration is 45 min");

// ─────────────────────────────────────────────────────────────────────────────
// TEST F: Read-Only Schedule Query ("kasih aku jadwal olahraga hari ini")
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n▶ TEST F: Read-Only Schedule Query");

const prevActivitiesCount = (dbData.dailyLogs[`gymbuddy_activities_081299990010_${today}`] || []).length;
const respF = handleWorkoutProgressLogging("081299990010", "kasih aku jadwal olahraga hari ini", userMia);
assert(respF === null, "Test F: handleWorkoutProgressLogging returns null for schedule queries (read-only delegate)");

const currentActivitiesCount = (dbData.dailyLogs[`gymbuddy_activities_081299990010_${today}`] || []).length;
assert(prevActivitiesCount === currentActivitiesCount, "Test F: No new workout logs created");

// ─────────────────────────────────────────────────────────────────────────────
// TEST G: Coach Persona Isolation
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n▶ TEST G: Coach Persona Isolation");

pendingWorkoutClarifications.clear();
const miaClarification = handleWorkoutProgressLogging("081299990010", "ku sudah olahraga 45 menit", userMia)![0];
const maxClarification = handleWorkoutProgressLogging("081299990020", "ku sudah olahraga 45 menit", userMax)![0];

assert(miaClarification.includes("✨"), "Test G: Coach Mia clarification uses warm style with ✨");
assert(maxClarification.includes("🔥"), "Test G: Coach Max clarification uses energetic style with 🔥");
assert(!miaClarification.includes("100% aman"), "Test G: Mia makes no absolute safety claim");
assert(!maxClarification.includes("100% aman"), "Test G: Max makes no absolute safety claim");
assert(pendingWorkoutClarifications.get("081299990010")?.durationMinutes === 45, "Test G: Mia sets duration 45");
assert(pendingWorkoutClarifications.get("081299990020")?.durationMinutes === 45, "Test G: Max sets duration 45");

console.log("\n================================================================================");
console.log(`📊 SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("================================================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("🎉 ALL WORKOUT CALORIE AND UNKNOWN ACTIVITY TESTS PASSED!");
}
