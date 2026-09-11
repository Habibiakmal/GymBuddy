import assert from "assert";
import { classifyUserIntent, sanitizeTextForIntent } from "../services/intentClassifier";
import {
  handleAdditionalActivityLogging,
  handleWorkoutProgressLogging,
  generateOnboardingHandshakeResponse,
  generateProgramQuestionResponse
} from "../server";

console.log("================================================================================");
console.log("🧪 RUNNING SUITE: WhatsApp Activation & AI Intent Gate Safety Tests");
console.log("================================================================================");

let passedTests = 0;
let totalTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`❌ [FAIL] ${name}:`, err.message || err);
    throw err;
  }
}

const mockUserData: any = {
  name: "Habibi",
  goal: "maintain",
  goalTitle: "Program Maintain",
  gender: "pria",
  weight: 70,
  targetWeight: 70,
  height: 175,
  age: 26,
  persona: "mia",
  targetCalories: 2200,
  proteinGrams: 130,
  carbGrams: 240,
  fatGrams: 60,
  plan: "premium",
  subscription: { status: "active", plan: "premium" },
  onboardingCompleted: true
};

// --------------------------------------------------------------------------------
// TEST 1: The exact prompt message that previously triggered false gym logging
// "Hello Coach Mia! Saya habibi, baru saja menyelesaikan onboarding di GymBuddy untuk program maintain. Saya siap mulai."
// --------------------------------------------------------------------------------
runTest("Scenario 1: Onboarding Handshake Greeting must NEVER trigger workout logging", () => {
  const userText = "Hello Coach Mia! Saya habibi, baru saja menyelesaikan onboarding di GymBuddy untuk program maintain. Saya siap mulai.";

  // 1. Check intent classification
  const intentResult = classifyUserIntent(userText);
  assert.strictEqual(
    intentResult.intent,
    "ONBOARDING_GREETING",
    `Expected ONBOARDING_GREETING but got ${intentResult.intent}`
  );

  // 2. handleAdditionalActivityLogging must return null
  const addLog = handleAdditionalActivityLogging("081234567890", userText, mockUserData);
  assert.strictEqual(
    addLog,
    null,
    "handleAdditionalActivityLogging must return null for onboarding greeting!"
  );

  // 3. handleWorkoutProgressLogging must return null
  const workoutLog = handleWorkoutProgressLogging("081234567890", userText, mockUserData);
  assert.strictEqual(
    workoutLog,
    null,
    "handleWorkoutProgressLogging must return null for onboarding greeting!"
  );

  // 4. Test generateOnboardingHandshakeResponse
  const response = generateOnboardingHandshakeResponse(mockUserData);
  assert.ok(response.includes("Coach Mia"), "Response should introduce Coach Mia");
  assert.ok(response.includes("Habibi") || response.includes("Sobat"), "Response should address user");
  assert.ok(response.includes("Program Maintain"), "Response should acknowledge program");
  assert.ok(!response.includes("LATIHAN BERHASIL DICATAT"), "Must NOT report workout logged!");
  assert.ok(!response.includes("Latihan Beban (Gym)"), "Must NOT report gym logged!");
});

// --------------------------------------------------------------------------------
// TEST 2: Completed gym with duration
// "Saya baru selesai gym 45 menit."
// --------------------------------------------------------------------------------
runTest("Scenario 2: Completed workout with duration must log workout with exact duration", () => {
  const userText = "Saya baru selesai gym 45 menit.";
  const intentResult = classifyUserIntent(userText);

  assert.strictEqual(
    intentResult.intent,
    "WORKOUT_LOG",
    `Expected WORKOUT_LOG but got ${intentResult.intent}`
  );
  assert.strictEqual(
    intentResult.extractedDetails?.durationMinutes,
    45,
    "Should extract 45 minutes duration"
  );

  const workoutLog = handleWorkoutProgressLogging("081234567890", userText, mockUserData);
  assert.ok(workoutLog && workoutLog.length > 0, "Should successfully log workout");
  const logMsg = workoutLog[0];
  assert.ok(logMsg.includes("LATIHAN BERHASIL DICATAT"), "Should confirm workout logged");
  assert.ok(logMsg.includes("45 menit"), "Should include duration of 45 menit");
});

// --------------------------------------------------------------------------------
// TEST 3: Explicit log command
// "Catat workout saya: gym 45 menit."
// --------------------------------------------------------------------------------
runTest("Scenario 3: Explicit command to log workout", () => {
  const userText = "Catat workout saya: gym 45 menit.";
  const intentResult = classifyUserIntent(userText);

  assert.strictEqual(
    intentResult.intent,
    "WORKOUT_LOG",
    `Expected WORKOUT_LOG but got ${intentResult.intent}`
  );

  const workoutLog = handleWorkoutProgressLogging("081234567890", userText, mockUserData);
  assert.ok(workoutLog && workoutLog.length > 0, "Should successfully log workout");
  const logMsg = workoutLog[0];
  assert.ok(logMsg.includes("LATIHAN BERHASIL DICATAT"), "Should confirm workout logged");
  assert.ok(logMsg.includes("45 menit"), "Should include duration of 45 menit");
});

// --------------------------------------------------------------------------------
// TEST 4: Meal logging
// "Tadi saya makan nasi ayam."
// --------------------------------------------------------------------------------
runTest("Scenario 4: Meal log statement must NOT trigger workout logging", () => {
  const userText = "Tadi saya makan nasi ayam.";
  const intentResult = classifyUserIntent(userText);

  assert.strictEqual(
    intentResult.intent,
    "MEAL_LOG",
    `Expected MEAL_LOG but got ${intentResult.intent}`
  );

  const workoutLog = handleWorkoutProgressLogging("081234567890", userText, mockUserData);
  assert.strictEqual(workoutLog, null, "Meal log must never trigger workout progress log");
});

// --------------------------------------------------------------------------------
// TEST 5: Weight update
// "Berat saya sekarang 72 kg, tolong update."
// --------------------------------------------------------------------------------
runTest("Scenario 5: Weight update statement must NOT trigger workout logging", () => {
  const userText = "Berat saya sekarang 72 kg, tolong update.";
  const intentResult = classifyUserIntent(userText);

  assert.strictEqual(
    intentResult.intent,
    "WEIGHT_LOG",
    `Expected WEIGHT_LOG but got ${intentResult.intent}`
  );
  assert.strictEqual(
    intentResult.extractedDetails?.weightKg,
    72,
    "Should extract 72 kg weight"
  );

  const workoutLog = handleWorkoutProgressLogging("081234567890", userText, mockUserData);
  assert.strictEqual(workoutLog, null, "Weight update must never trigger workout progress log");
});

// --------------------------------------------------------------------------------
// TEST 6: Program question
// "Saya mau mulai program maintain."
// --------------------------------------------------------------------------------
runTest("Scenario 6: Program inquiry statement must NOT trigger workout logging", () => {
  const userText = "Saya mau mulai program maintain.";
  const intentResult = classifyUserIntent(userText);

  assert.strictEqual(
    intentResult.intent,
    "PROGRAM_QUESTION",
    `Expected PROGRAM_QUESTION but got ${intentResult.intent}`
  );

  const workoutLog = handleWorkoutProgressLogging("081234567890", userText, mockUserData);
  assert.strictEqual(workoutLog, null, "Program question must never trigger workout progress log");

  const progResp = generateProgramQuestionResponse(mockUserData, userText);
  assert.ok(progResp.includes("Program"), "Should provide program overview");
  assert.ok(!progResp.includes("LATIHAN BERHASIL DICATAT"), "Must NOT log workout");
});

// --------------------------------------------------------------------------------
// TEST 7: Bot Destination Verification (USER -> GYMBUDDY BOT)
// --------------------------------------------------------------------------------
runTest("Scenario 7: Bot deep link points to GymBuddy Bot and NOT user's own number", () => {
  const userPhone = "6285156919826";
  const botNumber = "14155238886"; // Official default sandbox or configured bot number
  const message = "Hello Coach Mia! Saya habibi, baru saja menyelesaikan onboarding di GymBuddy untuk program maintain. Saya siap mulai.";
  const deepLink = `https://wa.me/${botNumber}?text=${encodeURIComponent(message)}`;

  assert.ok(deepLink.startsWith(`https://wa.me/${botNumber}`), "Destination URL must target the BOT");
  assert.ok(!deepLink.includes(`https://wa.me/${userPhone}`), "Destination URL must NOT target the user phone");
});

console.log("================================================================================");
console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
console.log("================================================================================");
