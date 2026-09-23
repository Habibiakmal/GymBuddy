import {
  findExerciseOrEquipment,
  formatWhatsAppExerciseGuide,
  formatWhatsAppEquipmentGuide,
  resolveCanonicalEquipment,
  findExercisesByEquipment,
  validateContentConsistency,
  CANONICAL_EQUIPMENT_TYPES,
  EXERCISE_DATABASE
} from "../data/exerciseDb";
import {
  classifyUserIntent,
  type EquipmentIntentSubtype
} from "../services/intentClassifier";
import {
  getRecentVisualContext,
  setRecentVisualContext,
  clearRecentVisualContext,
  isTaskInterruptingIntent,
  setActiveTask,
  getActiveTask,
  clearActiveTask
} from "../services/conversationStateManager";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failedCount++;
    throw new Error(`Test failed: ${message}`);
  }
}

async function runVisionEquipmentUnderstandingTests() {
  console.log("\n================================================================================");
  console.log("🧪 RUNNING SUITE: AI VISION & EQUIPMENT UNDERSTANDING SPEC");
  console.log("================================================================================\n");

  // ============================================================================
  // GROUP 1: Core Bug Reproduction & Fix Verification
  // ============================================================================
  console.log("▶ GROUP 1: Dumbbell Image & Demonstrative Query Root Cause Elimination");

  const bugQuery = "gimana cara make alat ini?";

  // 1. Text match should NOT produce bodyweight-squat anymore
  const textMatch = findExerciseOrEquipment(bugQuery);
  assert(textMatch === null, `'${bugQuery}' must return null from findExerciseOrEquipment (was incorrectly returning bodyweight-squat)`);

  // 2. Intent classifier with image must classify as EQUIPMENT_INQUIRY with HOW_TO_USE subtype
  const classifiedBug = classifyUserIntent(bugQuery, { hasImage: true });
  assert(classifiedBug.intent === "EQUIPMENT_INQUIRY", `'${bugQuery}' with image must classify as EQUIPMENT_INQUIRY (got ${classifiedBug.intent})`);
  assert(classifiedBug.equipmentSubtype === "HOW_TO_USE", `'${bugQuery}' subtype must be HOW_TO_USE (got ${classifiedBug.equipmentSubtype})`);

  // 3. Equipment guide for Dumbbell must return Dumbbell instructions, NOT Bodyweight Squat
  const dumbbellGuide = formatWhatsAppEquipmentGuide({
    equipmentName: "Dumbbell",
    subtype: "HOW_TO_USE",
    persona: "max",
    userGoal: "healthy",
    confidence: 95
  });

  assert(!dumbbellGuide.text.toLowerCase().includes("bodyweight squat"), "Dumbbell guide must NEVER contain 'bodyweight squat'");
  assert(!dumbbellGuide.text.toLowerCase().includes("tanpa alat"), "Dumbbell guide must NEVER state 'tanpa alat'");
  assert(dumbbellGuide.canonicalEquipment === "dumbbell", `Canonical equipment must be 'dumbbell' (got ${dumbbellGuide.canonicalEquipment})`);
  assert(Boolean(dumbbellGuide.selectedExercise), "Selected exercise must exist for dumbbell");
  assert(dumbbellGuide.selectedExercise?.equipmentCategory === "dumbbell", `Selected exercise equipmentCategory must be 'dumbbell' (got ${dumbbellGuide.selectedExercise?.equipmentCategory})`);

  // 4. Content Consistency Verification: TITLE = CONTENT ID = URL = IMAGE = INSTRUCTIONS
  const ex = dumbbellGuide.selectedExercise!;
  assert(dumbbellGuide.text.includes(ex.name.toUpperCase()) || dumbbellGuide.text.includes("DUMBBELL"), "Guide text title must reference dumbbell exercise");
  assert(dumbbellGuide.text.includes(`exercise=${ex.id}`), `Guide text must contain Web/PWA URL with exercise id '${ex.id}'`);
  assert(dumbbellGuide.mediaUrl === ex.gifUrl, `Media URL must match exercise gifUrl (${dumbbellGuide.mediaUrl} === ${ex.gifUrl})`);
  assert(dumbbellGuide.text.includes(ex.instructions[0]), "Guide text must contain instructions for the selected dumbbell exercise");

  const consistencyCheck = validateContentConsistency("Dumbbell", ex);
  assert(consistencyCheck.isValid === true, `validateContentConsistency for Dumbbell must be valid: ${consistencyCheck.reason}`);

  // Negative test: validateContentConsistency must reject Bodyweight Squat for Dumbbell
  const squatEx = EXERCISE_DATABASE.find(e => e.id === "bodyweight-squat")!;
  const invalidSquatCheck = validateContentConsistency("Dumbbell", squatEx);
  assert(invalidSquatCheck.isValid === false, "validateContentConsistency must REJECT Bodyweight Squat when equipment is Dumbbell");

  // ============================================================================
  // GROUP 2: Full Coverage of All 9 Canonical Equipment Types
  // ============================================================================
  console.log("\n▶ GROUP 2: All 9 Canonical Equipment Types Verification");

  const canonicalTypes = [
    { input: "Dumbbell", canonical: "dumbbell", expectedCategory: "dumbbell" },
    { input: "Barbel gym", canonical: "barbell", expectedCategory: "barbell" },
    { input: "Kettlebell 12kg", canonical: "kettlebell", expectedCategory: "kettlebell" },
    { input: "Resistance band elastis", canonical: "resistance band", expectedCategory: "band" },
    { input: "Treadmill lari", canonical: "treadmill", expectedCategory: "cardio" },
    { input: "Sepeda statis / exercise bike", canonical: "exercise bike", expectedCategory: "cardio" },
    { input: "Incline workout bench", canonical: "workout bench", expectedCategory: "dumbbell" },
    { input: "Cable machine pulley", canonical: "cable machine", expectedCategory: "cable" },
    { input: "Matras yoga / yoga mat", canonical: "yoga mat", expectedCategory: "bodyweight" }
  ];

  for (const item of canonicalTypes) {
    const resolved = resolveCanonicalEquipment(item.input);
    assert(resolved === item.canonical, `'${item.input}' must resolve to canonical '${item.canonical}' (got ${resolved})`);

    const exercises = findExercisesByEquipment(item.canonical, 3);
    assert(exercises.length > 0, `Must find at least 1 exercise for canonical '${item.canonical}'`);

    const guide = formatWhatsAppEquipmentGuide({
      equipmentName: item.canonical,
      subtype: "HOW_TO_USE",
      persona: "mia",
      userGoal: "healthy",
      confidence: 90
    });

    assert(guide.canonicalEquipment === item.canonical, `Guide canonicalEquipment must match '${item.canonical}'`);
    assert(Boolean(guide.selectedExercise), `Guide must select an exercise for '${item.canonical}'`);
    assert(guide.text.includes(guide.selectedExercise!.id), `Guide URL must match exercise ID for '${item.canonical}'`);
    assert(guide.mediaUrl === guide.selectedExercise!.gifUrl, `Guide media URL must match GIF for '${item.canonical}'`);

    const consistency = validateContentConsistency(item.canonical, guide.selectedExercise);
    assert(consistency.isValid === true, `Consistency check must pass for '${item.canonical}' -> '${guide.selectedExercise!.name}'`);
  }

  // ============================================================================
  // GROUP 3: Intent Subtypes Verification
  // ============================================================================
  console.log("\n▶ GROUP 3: Visual Equipment Intent Subtypes (WHAT_IS_IT, HOW_TO_USE, EXERCISES, POSTURE)");

  // 1. WHAT_IS_IT
  const whatIsItQuery = "ini apa?";
  const classifiedWhat = classifyUserIntent(whatIsItQuery, { hasImage: true });
  assert(classifiedWhat.intent === "EQUIPMENT_INQUIRY", `'${whatIsItQuery}' must be EQUIPMENT_INQUIRY`);
  assert(classifiedWhat.equipmentSubtype === "WHAT_IS_IT", `'${whatIsItQuery}' subtype must be WHAT_IS_IT`);

  const whatGuide = formatWhatsAppEquipmentGuide({
    equipmentName: "Dumbbell",
    subtype: "WHAT_IS_IT",
    persona: "max",
    userGoal: "gain"
  });
  assert(whatGuide.text.includes("MENGENAL ALAT: DUMBBELL"), "WHAT_IS_IT guide must have header 'MENGENAL ALAT'");
  assert(whatGuide.text.includes("Manfaat Utama"), "WHAT_IS_IT guide must explain benefits");
  assert(whatGuide.text.includes("Variasi Latihan Populer"), "WHAT_IS_IT guide must show popular variations");

  // 2. HOW_TO_USE
  const howToUseQuery = "cara pakai alat ini gimana?";
  const classifiedHow = classifyUserIntent(howToUseQuery, { hasImage: true });
  assert(classifiedHow.intent === "EQUIPMENT_INQUIRY", `'${howToUseQuery}' must be EQUIPMENT_INQUIRY`);
  assert(classifiedHow.equipmentSubtype === "HOW_TO_USE", `'${howToUseQuery}' subtype must be HOW_TO_USE`);

  const howGuide = formatWhatsAppEquipmentGuide({
    equipmentName: "Barbell",
    subtype: "HOW_TO_USE",
    persona: "max"
  });
  assert(howGuide.text.includes("CARA SETTING & POSISI ALAT"), "HOW_TO_USE guide must include equipment setup");
  assert(howGuide.text.includes("CARA PENGGUNAAN STEP-BY-STEP"), "HOW_TO_USE guide must include step-by-step instructions");

  // 3. EXERCISES_FOR_EQUIPMENT
  const exercisesQuery = "bisa buat latihan apa aja?";
  const classifiedExercises = classifyUserIntent(exercisesQuery, { hasImage: true });
  assert(classifiedExercises.intent === "EQUIPMENT_INQUIRY", `'${exercisesQuery}' must be EQUIPMENT_INQUIRY`);
  assert(classifiedExercises.equipmentSubtype === "EXERCISES_FOR_EQUIPMENT", `'${exercisesQuery}' subtype must be EXERCISES_FOR_EQUIPMENT`);

  const exListGuide = formatWhatsAppEquipmentGuide({
    equipmentName: "Kettlebell",
    subtype: "EXERCISES_FOR_EQUIPMENT",
    persona: "mia"
  });
  assert(exListGuide.text.includes("VARIASI LATIHAN: KETTLEBELL"), "EXERCISES guide header must state variations");
  assert(exListGuide.text.includes("Rekomendasi:"), "EXERCISES guide must include sets/reps recommendations");

  // 4. EXERCISE_POSTURE
  const postureQuery = "ini gerakan apa?";
  const classifiedPosture = classifyUserIntent(postureQuery, { hasImage: true });
  assert(classifiedPosture.intent === "EXERCISE_POSTURE_INQUIRY", `'${postureQuery}' must be EXERCISE_POSTURE_INQUIRY`);
  assert(classifiedPosture.equipmentSubtype === "EXERCISE_POSTURE", `'${postureQuery}' subtype must be EXERCISE_POSTURE`);

  const postureGuide = formatWhatsAppEquipmentGuide({
    equipmentName: "Dumbbell",
    subtype: "EXERCISE_POSTURE",
    persona: "max"
  });
  assert(postureGuide.text.includes("CHECKPOINT POSTUR & TEKNIK"), "POSTURE guide header must emphasize posture & form");
  assert(postureGuide.text.includes("POSTUR & FORM YANG BENAR"), "POSTURE guide must include dos");

  // ============================================================================
  // GROUP 4: Stale Context Interruption & Isolation
  // ============================================================================
  console.log("\n▶ GROUP 4: Stale Context Interruption & Isolation");

  const testPhone = "628999888777";
  // User previously asked about squats or had an active squat routine task
  setActiveTask(testPhone, {
    type: "WORKOUT_NAVIGATION",
    pendingAction: "CONFIRM_SQUAT",
    context: { exercise: "Bodyweight Squat" }
  });

  const activeBefore = getActiveTask(testPhone);
  assert(activeBefore !== null && activeBefore.pendingAction === "CONFIRM_SQUAT", "Active squat task initialized");

  // Now user sends a new photo with equipment inquiry
  assert(isTaskInterruptingIntent("EQUIPMENT_INQUIRY") === true, "EQUIPMENT_INQUIRY must interrupt active conversation task");
  assert(isTaskInterruptingIntent("EXERCISE_POSTURE_INQUIRY") === true, "EXERCISE_POSTURE_INQUIRY must interrupt active conversation task");

  clearActiveTask(testPhone, "User sent equipment inquiry");
  const activeAfter = getActiveTask(testPhone);
  assert(activeAfter === null, "Active task must be cleanly cleared, preventing stale squat context carryover");

  // ============================================================================
  // GROUP 5: Two-Step Flow Support (Image First, Then Question)
  // ============================================================================
  console.log("\n▶ GROUP 5: Two-Step Flow Memory (Image First, Then Text Question)");

  // Step 1: User sends photo of Cable Machine (without text or generic caption)
  setRecentVisualContext(testPhone, {
    detectedEquipment: "Cable Machine",
    confidence: 92,
    intentSubtype: "HOW_TO_USE"
  });

  const storedVisual = getRecentVisualContext(testPhone);
  assert(storedVisual !== null, "Stored visual context must exist");
  assert(storedVisual?.detectedEquipment === "Cable Machine", `Stored equipment must be 'Cable Machine' (got ${storedVisual?.detectedEquipment})`);

  // Step 2: User asks "gimana cara make alat ini?" in subsequent message without re-attaching image
  const step2Query = "gimana cara make alat ini?";
  const isDemonstrative = Boolean(
    step2Query.match(/\b(?:alat\s*ini|ini\s*apa|alat\s*apa|cara\s*(?:make|pakai|menggunakan)\s*alat\s*ini|buat\s*apa\s*ini|gerakan\s*ini|mesin\s*ini|benda\s*ini)\b/i) ||
    (step2Query.match(/\b(?:ini|itu)\b/i) && step2Query.match(/\b(?:alat|mesin|gerakan|bisa\s*buat|cara|gimana|buat\s*apa)\b/i))
  );
  assert(isDemonstrative === true, `'${step2Query}' must be recognized as demonstrative query`);

  // Use stored context
  const twoStepGuide = formatWhatsAppEquipmentGuide({
    equipmentName: storedVisual!.detectedEquipment,
    subtype: "HOW_TO_USE",
    persona: "max",
    userGoal: "gain"
  });

  assert(twoStepGuide.canonicalEquipment === "cable machine", `Two-step flow must resolve to 'cable machine' (got ${twoStepGuide.canonicalEquipment})`);
  assert(!twoStepGuide.text.toLowerCase().includes("bodyweight squat"), "Two-step flow must NOT resolve to Bodyweight Squat!");

  clearRecentVisualContext(testPhone);
  assert(getRecentVisualContext(testPhone) === null, "Recent visual context cleared after test");

  // ============================================================================
  // GROUP 6: Low Confidence / Ambiguity Handling
  // ============================================================================
  console.log("\n▶ GROUP 6: Low Confidence & Ambiguity Handling");

  const lowConfidenceGuide = formatWhatsAppEquipmentGuide({
    equipmentName: "Unknown Gear",
    confidence: 45, // < 60%
    persona: "mia",
    userAddressing: "Kak Budi"
  });

  assert(lowConfidenceGuide.selectedExercise === undefined, "Low confidence must not select an arbitrary exercise");
  assert(lowConfidenceGuide.mediaUrl === undefined, "Low confidence must not send media URL");
  assert(lowConfidenceGuide.text.includes("kurang jelas"), "Low confidence must state that photo is not clear");
  assert(lowConfidenceGuide.text.includes("Dumbbell") && lowConfidenceGuide.text.includes("Barbell"), "Low confidence must ask for clarification");
  assert(!lowConfidenceGuide.text.toLowerCase().includes("bodyweight squat"), "Low confidence must NEVER default to Bodyweight Squat!");

  // ============================================================================
  // GROUP 7: Text Demonstrative Query Without Image or Prior Context
  // ============================================================================
  console.log("\n▶ GROUP 7: Demonstrative Query Without Image Or Context");

  // If a user with no stored visual context types "gimana cara make alat ini?",
  // findExerciseOrEquipment returns null, and it does not hallucinate Bodyweight Squat.
  const emptyContextQuery = findExerciseOrEquipment("gimana cara make alat ini?");
  assert(emptyContextQuery === null, "Demonstrative query with no prior context returns null from exerciseDb (never squats!)");

  console.log("\n================================================================================");
  console.log(`SUMMARY: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log("================================================================================");
  if (failedCount === 0) {
    console.log("🎉 ALL AI VISION & EQUIPMENT UNDERSTANDING TESTS PASSED PERFECTLY!\n");
  } else {
    throw new Error(`${failedCount} tests failed!`);
  }
}

runVisionEquipmentUnderstandingTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
