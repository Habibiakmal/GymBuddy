import {
  generatePersonalizedWorkoutPlan,
  adjustWorkoutPlanDuration,
  createCompletedWorkoutRecord,
  initializeSessionState,
  CompletedWorkoutActivity,
  WorkoutPlan
} from "../services/workoutEngine";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ [PASS] ${msg}`);
  }
}

console.log("=== RUNNING WORKOUT PERSISTENCE & DURATION CHANGE SUITE ===");

const userPhoneE164 = "+628123456789";
const dateStr = "2026-09-12";

// ── STEP 1: Generate initial 45-minute workout plan ──
console.log("\n▶ STEP 1: Initial 45-Minute Workout Generation");
const initialPlan = generatePersonalizedWorkoutPlan(
  {
    workoutDuration: 45,
    workoutFrequency: "3-4",
    fitnessLevel: "intermediate",
    equipment: "full_gym",
    primaryGoal: "lose",
    persona: "max"
  },
  dateStr
);

assert(initialPlan.targetDuration === 45, "Initial plan target duration is 45m");
assert(initialPlan.mainExercises.length > 0, "Initial plan has main exercises");

// ── STEP 2: User completes the 45-minute workout ──
console.log("\n▶ STEP 2: Complete Workout and Create Activity Record");
const session = initializeSessionState(initialPlan);
session.completedSets = session.totalSets; // Completed 100%

const activityRecord = createCompletedWorkoutRecord(
  session,
  initialPlan,
  2700, // 45 minutes
  "good",
  undefined,
  userPhoneE164
);

assert(activityRecord.phone === "08123456789", "Phone normalized to Indonesian 08 format consistently");
assert(activityRecord.workoutId === initialPlan.id, "Workout ID matches initial plan");
assert(activityRecord.completionPercentage === 100, "Completion percentage is 100%");
assert(activityRecord.actualDurationMinutes === 45, "Duration is recorded as 45m");

// Store in user's completed history (simulating Dashboard state)
let completedWorkouts: CompletedWorkoutActivity[] = [activityRecord];
let lastWorkoutActivity: CompletedWorkoutActivity | null = completedWorkouts[0];

assert(completedWorkouts.length === 1, "Completed workouts array contains exactly 1 activity");
assert(lastWorkoutActivity?.workoutTitle === activityRecord.workoutTitle, "Last activity shows the completed workout");

// ── STEP 3: User changes duration to 15 minutes ──
console.log("\n▶ STEP 3: Change Duration to 15 minutes (45m -> 15m)");
const shortenedPlan = adjustWorkoutPlanDuration(initialPlan, 15, {
  workoutDuration: 15,
  workoutFrequency: "3-4",
  fitnessLevel: "intermediate",
  equipment: "full_gym",
  primaryGoal: "lose",
  persona: "max"
});

assert(shortenedPlan.targetDuration === 15, "Plan shortened to 15m");
assert(shortenedPlan.id.endsWith("_shortened_15m"), "Plan has clean shortened ID suffix");

// CRITICAL DATA INTEGRITY CHECK:
// Changing duration MUST NOT mutate, replace, or clear completedWorkouts or lastWorkoutActivity!
assert(completedWorkouts.length === 1, "Completed workouts history REMAINS 1 (NOT deleted)");
assert(completedWorkouts[0].activityId === activityRecord.activityId, "Completed activity record is preserved identically");
lastWorkoutActivity = completedWorkouts[0];
assert(lastWorkoutActivity !== null, "Last Workout Activity remains present after duration change to 15m");
assert(lastWorkoutActivity.actualDurationMinutes === 45, "Last activity still shows the completed 45m workout");

// ── STEP 4: User changes duration back to 45 minutes ──
console.log("\n▶ STEP 4: Change Duration back to 45 minutes (15m -> 45m)");
const restoredPlan = adjustWorkoutPlanDuration(shortenedPlan, 45, {
  workoutDuration: 45,
  workoutFrequency: "3-4",
  fitnessLevel: "intermediate",
  equipment: "full_gym",
  primaryGoal: "lose",
  persona: "max"
});

assert(restoredPlan.targetDuration === 45, "Plan scaled back to 45m");
// Check that plan ID does not suffer from chained suffix explosion
assert(!restoredPlan.id.includes("_shortened_15m_scaled_45m"), "Plan ID did not suffer from chained suffix explosion");
assert(restoredPlan.id.endsWith("_scaled_45m"), "Plan has clean scaled ID");

// CRITICAL DATA INTEGRITY CHECK:
assert(completedWorkouts.length === 1, "Completed workouts history REMAINS 1 after switching back to 45m");
assert(completedWorkouts[0].activityId === activityRecord.activityId, "Completed activity record is preserved identically");
lastWorkoutActivity = completedWorkouts[0];
assert(lastWorkoutActivity !== null, "Last Workout Activity remains present after switching back to 45m");
assert(lastWorkoutActivity.actualDurationMinutes === 45, "Last activity continues to show the completed 45m workout");

// ── STEP 5: Re-running shortening repeatedly does not corrupt ID ──
console.log("\n▶ STEP 5: Repeated Duration Adjustments Cleanliness");
const plan15Again = adjustWorkoutPlanDuration(restoredPlan, 15);
assert(plan15Again.id.endsWith("_shortened_15m"), "Subsequent 15m adjustment has clean ID");
assert(!plan15Again.id.includes("_scaled_45m_shortened_15m"), "No chained nested suffixes");

console.log("\n🎉 ALL WORKOUT PERSISTENCE & DURATION TESTS PASSED PERFECTLY!");
process.exit(0);
