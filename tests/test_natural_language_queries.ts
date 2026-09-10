import { classifyWorkoutIntent, classifyMealIntent, matchPureWeightLog, matchPureWaterLog } from '../server';

console.log("================================================================================");
console.log("TEST SUITE: Natural Language Query & Intent Parser Verification");
console.log("================================================================================\n");

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${msg}`);
    failed++;
  }
}

// 1. Weekly Workout Schedule Queries
const workoutWeek1 = classifyWorkoutIntent("jadwal latihan minggu ini");
assert(workoutWeek1?.isWorkoutIntent === true && workoutWeek1?.scope === "weekly", "Weekly workout schedule detected for 'jadwal latihan minggu ini'");

const workoutWeek2 = classifyWorkoutIntent("saran latihan minggu ini");
assert(workoutWeek2?.isWorkoutIntent === true && workoutWeek2?.scope === "weekly", "Weekly workout schedule detected for 'saran latihan minggu ini'");

const workoutWeek3 = classifyWorkoutIntent("rekomendasi workout minggu ini");
assert(workoutWeek3?.isWorkoutIntent === true && workoutWeek3?.scope === "weekly", "Weekly workout schedule detected for 'rekomendasi workout minggu ini'");

// 2. Daily / Tomorrow Workout Queries
const workoutTomorrow = classifyWorkoutIntent("jadwal workout besok apa");
assert(workoutTomorrow.isWorkoutIntent && workoutTomorrow.scope === "tomorrow", "Tomorrow workout schedule detected for 'jadwal workout besok apa'");

const workoutToday = classifyWorkoutIntent("olahraga apa hari ini");
assert(workoutToday.isWorkoutIntent && workoutToday.scope === "today", "Today workout schedule detected for 'olahraga apa hari ini'");

// 3. Workout Logging vs Pure Weight Logging
const workoutLog = classifyWorkoutIntent("aku udah selesai bench press 3 set 10 reps 60kg");
assert(workoutLog.isWorkoutIntent && workoutLog.action === "log", "Workout completion recognized for 'bench press 3 set 10 reps'");

const weightOnly1 = matchPureWeightLog("catat berat 68.5 kg");
assert(weightOnly1 !== null && weightOnly1[1] === "68.5", "Weight log matched for 'catat berat 68.5 kg'");

const weightOnly2 = matchPureWeightLog("bb 72");
assert(weightOnly2 !== null && weightOnly2[1] === "72", "Weight log matched for 'bb 72'");

// Ensure pure weight is not misclassified as workout completion log
const workoutIntentOnWeight = classifyWorkoutIntent("bb 72 kg");
assert(!workoutIntentOnWeight?.isWorkoutIntent, "'bb 72 kg' not classified as workout log");

// 4. Meal Intent Queries
const mealTomorrow = classifyMealIntent("menu makan besok apa aja");
assert(mealTomorrow.isMealIntent && mealTomorrow.scope === "tomorrow", "Tomorrow meal query detected for 'menu makan besok apa aja'");

const mealWeekly = classifyMealIntent("jadwal makan minggu ini");
assert(mealWeekly.isMealIntent && mealWeekly.scope === "weekly", "Weekly meal query detected for 'jadwal makan minggu ini'");

const mealToday = classifyMealIntent("rekomendasi makanan hari ini");
assert(mealToday.isMealIntent && mealToday.scope === "today", "Today meal recommendation detected for 'rekomendasi makanan hari ini'");

// 5. Water intake
const waterLog = matchPureWaterLog("minum 3 gelas");
assert(waterLog !== null && waterLog[1] === "3", "Water log matched for 'minum 3 gelas'");

console.log("\n================================================================================");
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
}
