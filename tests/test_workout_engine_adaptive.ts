/**
 * GYMBUDDY AI WORKOUT COACH 2.1 — ADAPTIVE ENGINE & SAFETY TEST SUITE
 * 
 * Comprehensive regression tests covering:
 * 1. Workout Generation across Durations (15, 30, 45, 60 min)
 * 2. Realistic Time Validation & Duration Constraints
 * 3. Goal, Fitness Level, and Equipment Personalization
 * 4. Deterministic Injury Constraints & Strict Medical Safety Disclaimers
 * 5. In-Workout Pain Reporting & Safety Substitution
 * 6. Guarded Adaptive Progression (Easy, Good, Hard, Very Hard, Incomplete, Poor Recovery)
 * 7. Dynamic Session Shortening (preserves compounds, removes accessories)
 * 8. Workout Session State Machine Transitions & Duplicate Set Prevention
 * 9. Data Consistency & String Normalization (Core & Incline Walking includes Incline Walking, no malformed reps)
 */

import {
  generatePersonalizedWorkoutPlan,
  shortenWorkoutPlan,
  initializeSessionState,
  transitionWorkoutSession,
  calculateNextWorkoutAdaptation,
  calculateRecoveryContext,
  validateExerciseSafety,
  normalizeSetsRepsString,
  generatePersonalizedWeeklySchedule,
  MEDICAL_SAFETY_DISCLAIMER,
  WorkoutPreferences,
  InjuryConstraint
} from "../services/workoutEngine";

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}${detail ? ` — ${detail}` : ""}`);
    failCount++;
  }
}

console.log("\n================================================================================");
console.log("🧪 RUNNING SUITE: GYMBUDDY AI WORKOUT COACH 2.1 SPECIFICATION TESTS");
console.log("================================================================================\n");

// ─── GROUP 1: WORKOUT DURATION & REALISTIC TIME ESTIMATION ───────────────────
console.log("▶ GROUP 1: Workout Duration Composition & Realistic Time Estimation");

const plan15m = generatePersonalizedWorkoutPlan({
  workoutDuration: 15,
  workoutFrequency: "3-4",
  fitnessLevel: "intermediate",
  equipment: "full_gym",
  primaryGoal: "lose"
});
assert(plan15m.targetDuration === 15, "15-minute plan targetDuration equals 15");
assert(plan15m.estimatedDuration <= 18, `15-minute plan estimatedDuration (${plan15m.estimatedDuration}m) does not materially exceed 15 min`);
assert(plan15m.mainExercises.length <= 3, `15-minute plan uses 2-3 focused movements (actual: ${plan15m.mainExercises.length})`);

const plan30m = generatePersonalizedWorkoutPlan({
  workoutDuration: 30,
  workoutFrequency: "3-4",
  fitnessLevel: "intermediate",
  equipment: "full_gym",
  primaryGoal: "lose"
});
assert(plan30m.targetDuration === 30, "30-minute plan targetDuration equals 30");
assert(plan30m.estimatedDuration <= 35, `30-minute plan estimatedDuration (${plan30m.estimatedDuration}m) fits ~30 min window`);

const plan45m = generatePersonalizedWorkoutPlan({
  workoutDuration: 45,
  workoutFrequency: "3-4",
  fitnessLevel: "intermediate",
  equipment: "full_gym",
  primaryGoal: "gain"
});
assert(plan45m.targetDuration === 45, "45-minute plan targetDuration equals 45");
assert(plan45m.totalExercises >= 3, `45-minute plan includes comprehensive exercise rundown (total exercises: ${plan45m.totalExercises})`);

const plan60m = generatePersonalizedWorkoutPlan({
  workoutDuration: 60,
  workoutFrequency: "5+",
  fitnessLevel: "advanced",
  equipment: "full_gym",
  primaryGoal: "gain"
});
assert(plan60m.targetDuration === 60, "60-minute plan targetDuration equals 60");
assert(plan60m.totalSets >= 12, `60-minute plan delivers adequate volume for 60 min (sets: ${plan60m.totalSets})`);

const plan90m = generatePersonalizedWorkoutPlan({
  workoutDuration: 90,
  workoutFrequency: "5+",
  fitnessLevel: "advanced",
  equipment: "full_gym",
  primaryGoal: "gain"
});
assert(plan90m.targetDuration === 90, "90-minute plan targetDuration equals 90");
assert(plan90m.totalExercises >= 6, `90-minute plan scales exercises up (actual: ${plan90m.totalExercises})`);
assert(plan90m.totalSets >= 18, `90-minute plan provides dedicated high volume (sets: ${plan90m.totalSets})`);

const plan120m = generatePersonalizedWorkoutPlan({
  workoutDuration: 120,
  workoutFrequency: "5+",
  fitnessLevel: "advanced",
  equipment: "full_gym",
  primaryGoal: "gain"
});
assert(plan120m.targetDuration === 120, "120-minute plan targetDuration equals 120");
assert(plan120m.totalExercises >= 8, `120-minute plan provides maximum athletic exercise selection (actual: ${plan120m.totalExercises})`);
assert(plan120m.totalSets >= 24, `120-minute plan provides full athlete volume (sets: ${plan120m.totalSets})`);

// ─── GROUP 2: EQUIPMENT & GOAL PERSONALIZATION ────────────────────────────────
console.log("\n▶ GROUP 2: Equipment & Goal Personalization");

const bodyweightPlan = generatePersonalizedWorkoutPlan({
  workoutDuration: 45,
  workoutFrequency: "3-4",
  fitnessLevel: "beginner",
  equipment: "bodyweight",
  primaryGoal: "lose"
});
const allBwEquip = [...bodyweightPlan.mainExercises, ...(bodyweightPlan.cardio ? [bodyweightPlan.cardio] : [])]
  .every(e => e.equipment === "bodyweight" || e.equipment === "none" || e.equipment === "machines");
assert(allBwEquip, "Bodyweight equipment preference does not generate barbell exercises");

const dumbbellsPlan = generatePersonalizedWorkoutPlan({
  workoutDuration: 45,
  workoutFrequency: "3-4",
  fitnessLevel: "intermediate",
  equipment: "dumbbells",
  primaryGoal: "gain"
});
const dbEquipValid = dumbbellsPlan.mainExercises.every(e => e.equipment === "dumbbells" || e.equipment === "bodyweight");
assert(dbEquipValid, "Dumbbells preference restricts exercises to dumbbells or bodyweight movements");

// ─── GROUP 3: INJURY CONSTRAINTS & STRICT SAFETY VALIDATION ───────────────────
console.log("\n▶ GROUP 3: Injury Constraints & Safety Validation Layer");

// Severe knee limitation: must eliminate high joint load exercises on knee
const kneeLimitation: InjuryConstraint = {
  bodyArea: "knee",
  severity: "severe",
  avoidMovements: ["deep_squat", "jumping"],
  painTriggers: ["axial_load"]
};

const kneeProtectedPlan = generatePersonalizedWorkoutPlan({
  workoutDuration: 45,
  workoutFrequency: "3-4",
  fitnessLevel: "intermediate",
  equipment: "full_gym",
  primaryGoal: "lose",
  injuryLimitations: [kneeLimitation]
}, "2026-09-15", [], 1); // Day 1: Tuesday (Lower body day)

const hasSevereKneeExercise = kneeProtectedPlan.mainExercises.some(e => e.jointLoad.knee === "high" || e.jointLoad.knee === "moderate");
assert(!hasSevereKneeExercise, "Severe knee limitation eliminates exercises with moderate or high knee joint load");
assert(kneeProtectedPlan.safetyNotes.length > 0, "Safety notes document protected joints");

// Medical Safety Disclaimer verification (Prompt Section 7: never diagnose or promise medical clearance)
assert(
  MEDICAL_SAFETY_DISCLAIMER.includes("TIDAK mendiagnosis") && !MEDICAL_SAFETY_DISCLAIMER.includes("pasti aman"),
  "GymBuddy safety policy explicitly disclaims medical diagnosis and advises medical evaluation"
);

// ─── GROUP 4: DYNAMIC SESSION SHORTENING ─────────────────────────────────────
console.log("\n▶ GROUP 4: Dynamic Session Shortening");

const original45m = generatePersonalizedWorkoutPlan({
  workoutDuration: 45,
  workoutFrequency: "3-4",
  fitnessLevel: "intermediate",
  equipment: "full_gym",
  primaryGoal: "lose"
});

const shortenedTo15m = shortenWorkoutPlan(original45m, 15);
assert(shortenedTo15m.targetDuration === 15, "Shortened plan targets 15 minutes");
assert(shortenedTo15m.mainExercises.every(e => e.priority === "essential"), "Shortened plan preserves essential compound movements");
assert(shortenedTo15m.estimatedDuration <= 18, `Shortened duration fits available time window (${shortenedTo15m.estimatedDuration}m)`);
assert(shortenedTo15m.rationale.includes("15 menit"), "Shortened plan rationale explains focus on core movements");

// Bidirectional scaling: changing 15m back to 45m or up to 90m / 120m
const scaledBackTo45m = shortenWorkoutPlan(shortenedTo15m, 45);
assert(scaledBackTo45m.targetDuration === 45, "Plan scales back up to 45 minutes after being shortened");
assert(scaledBackTo45m.totalExercises >= 3, `Scaled 45m plan restores full exercise count (actual: ${scaledBackTo45m.totalExercises})`);

const scaledUpTo90m = shortenWorkoutPlan(shortenedTo15m, 90);
assert(scaledUpTo90m.targetDuration === 90, "Plan can scale up to 90 minutes from shortened state");
assert(scaledUpTo90m.totalExercises >= 6, `Scaled 90m plan provides expanded exercise menu (actual: ${scaledUpTo90m.totalExercises})`);

// ─── GROUP 5: SESSION STATE MACHINE & DUPLICATE PREVENTION ────────────────────
console.log("\n▶ GROUP 5: Workout Session State Machine & In-Workout Pain Handling");

let session = initializeSessionState(original45m);
assert(session.status === "SCHEDULED", "Session initializes with SCHEDULED state");

session = transitionWorkoutSession(session, { type: "START_WORKOUT" });
assert(session.status === "SET_ACTIVE" || session.status === "IN_PROGRESS", "START_WORKOUT transitions to active set");

const initialCompletedSets = session.completedSets;
session = transitionWorkoutSession(session, { type: "COMPLETE_SET" });
assert(session.completedSets === initialCompletedSets + 1, "COMPLETE_SET increments completedSets by exactly 1");
assert(session.status === "REST", "Completing set transitions to REST state");

// Duplicate completion test: attempting to complete during REST must be rejected or prevented
const restCompletedSets = session.completedSets;
session = transitionWorkoutSession(session, { type: "COMPLETE_SET" });
assert(session.completedSets === restCompletedSets, "Duplicate COMPLETE_SET while resting does NOT double-increment sets");

session = transitionWorkoutSession(session, { type: "SKIP_REST" });
assert(session.status === "SET_ACTIVE", "SKIP_REST advances to next active set");

// Pause & Resume
session = transitionWorkoutSession(session, { type: "PAUSE_WORKOUT" });
assert(session.status === "PAUSED", "PAUSE_WORKOUT sets status to PAUSED");

session = transitionWorkoutSession(session, { type: "RESUME_WORKOUT" });
assert(session.status === "SET_ACTIVE", "RESUME_WORKOUT restores active status");

// In-Workout Pain Reporting (Prompt Section 7: Stop or modify movement immediately)
session = transitionWorkoutSession(session, { type: "REPORT_PAIN", bodyArea: "knee", note: "Nyeri saat turun" });
assert(session.painReportedDuringSession === true, "Reporting pain flags painReportedDuringSession");
assert(session.exercises[0].painReported === true, "Current exercise flagged as stopped due to pain");

// ─── GROUP 6: GUARDED ADAPTIVE PROGRESSION ────────────────────────────────────
console.log("\n▶ GROUP 6: Guarded Adaptive Progression & Overload Rules");

const goodRecovery = calculateRecoveryContext([], "2026-09-12");

// Rule 1: Easy + 100% completion + High recovery -> consider rep progression (never fabricate weight)
const easySession = {
  ...session,
  totalSets: 12,
  completedSets: 12,
  overallDifficulty: "easy" as const,
  painReportedDuringSession: false
};
const easyAdaptation = calculateNextWorkoutAdaptation(easySession, { ...goodRecovery, recoveryScore: "high" });
assert(easyAdaptation.recommendation === "increase_reps", "Easy + 100% completion + high recovery triggers progressive rep overload");
assert(!easyAdaptation.adjustmentSummary.includes("kg"), "Progression does NOT fabricate arbitrary weight load");

// Rule 2: Easy does NOT blindly progress if recovery is poor
const poorRecovery = { ...goodRecovery, recoveryScore: "poor" as const, recommendation: "deload" as const };
const poorRecoveryAdaptation = calculateNextWorkoutAdaptation(easySession, poorRecovery);
assert(poorRecoveryAdaptation.recommendation === "deload", "Poor recovery forces deload even if workout felt Easy");

// Rule 3: Very Hard triggers deload / volume reduction
const veryHardSession = {
  ...session,
  totalSets: 12,
  completedSets: 12,
  overallDifficulty: "very_hard" as const,
  painReportedDuringSession: false
};
const veryHardAdaptation = calculateNextWorkoutAdaptation(veryHardSession, goodRecovery);
assert(veryHardAdaptation.recommendation === "deload", "Very Hard difficulty triggers volume control / deload");

// Rule 4: Incomplete workout does not progress
const incompleteSession = {
  ...session,
  totalSets: 12,
  completedSets: 5,
  overallDifficulty: "easy" as const,
  painReportedDuringSession: false
};
const incompleteAdaptation = calculateNextWorkoutAdaptation(incompleteSession, goodRecovery);
assert(incompleteAdaptation.recommendation === "maintain", "Incomplete workout maintains target rather than progressing");

// Rule 5: Pain reported triggers safety modification
const painSession = {
  ...session,
  totalSets: 12,
  completedSets: 10,
  overallDifficulty: "hard" as const,
  painReportedDuringSession: true
};
const painAdaptation = calculateNextWorkoutAdaptation(painSession, goodRecovery);
assert(painAdaptation.recommendation === "safety_modify", "Pain reported forces safety_modify for next session");

// ─── GROUP 7: DATA CONSISTENCY & CONTENT INTEGRITY ────────────────────────────
console.log("\n▶ GROUP 7: Data Consistency & String Normalization");

// Saturday workout consistency: Core & Incline Walking must include Incline Walking
const saturdayPlan = generatePersonalizedWorkoutPlan({
  workoutDuration: 45,
  workoutFrequency: "3-4",
  fitnessLevel: "intermediate",
  equipment: "full_gym",
  primaryGoal: "lose"
}, "2026-09-12", [], 5); // Day index 5 = Saturday

assert(saturdayPlan.focus.includes("Core & Incline Walking"), "Saturday routine is titled Core & Incline Walking");
const hasInclineWalking = saturdayPlan.cardio?.exerciseId === "incline-treadmill-walk" ||
  saturdayPlan.mainExercises.some(e => e.exerciseId === "incline-treadmill-walk");
assert(hasInclineWalking, "Saturday Core & Incline Walking actually contains Incline Treadmill Walk in rundown");

// Normalized strings test (Section 12: clean '3 Sets × 20 Reps', no '3 Set x 3 Set x 20 Reps')
const normalizedReps1 = normalizeSetsRepsString(3, "20 Reps");
assert(normalizedReps1 === "3 Sets × 20 Reps", `Clean normalization: '${normalizedReps1}'`);

const normalizedReps2 = normalizeSetsRepsString(3, "3 Set x 3 Set x 20 Reps");
assert(normalizedReps2 === "3 Sets × 20 Reps", `De-duplicates malformed string: '${normalizedReps2}'`);

const normalizedTimed = normalizeSetsRepsString(1, "15–20 min · Incline 8%");
assert(normalizedTimed === "15–20 min · Incline 8%", `Preserves cardio duration format: '${normalizedTimed}'`);

// Weekly schedule generation compatibility
const weeklySchedule = generatePersonalizedWeeklySchedule({
  workoutDuration: 45,
  workoutFrequency: "3-4",
  fitnessLevel: "intermediate",
  equipment: "full_gym",
  primaryGoal: "lose"
});
assert(weeklySchedule.length === 7, `Personalized weekly schedule produces 7 days (actual: ${weeklySchedule.length})`);
assert(weeklySchedule[5].exercises.some(e => e.name.toLowerCase().includes("incline") || e.name.toLowerCase().includes("walk")), "Weekly schedule Saturday includes Incline Walk");

console.log("\n================================================================================");
console.log(`SUMMARY: ${passCount} PASSED | ${failCount} FAILED`);
console.log("================================================================================\n");

if (failCount > 0) {
  process.exit(1);
} else {
  console.log("🎉 ALL ADAPTIVE ENGINE & SAFETY SPECIFICATION TESTS PASSED PERFECTLY!\n");
}
