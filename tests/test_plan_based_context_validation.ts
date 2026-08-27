import assert from "node:assert";
import {
  getUserPlanCapabilities,
  classifyUserInput,
  validatePlanContext
} from "../services/planContextEngine";
import { calculateUserData } from "../server";

console.log("=== RUNNING PLAN-BASED CONTEXT VALIDATION TEST SUITE ===");

// ── TEST 1: Plan Capabilities Resolution ──
console.log("\n[TEST 1] Active Plan Capabilities Resolution");
const userNutritionOnly = calculateUserData({
  name: "Alex Pratama",
  gender: "pria",
  age: 28,
  activeService: "nutritionist",
  persona: "mia"
});
const capsNutr = getUserPlanCapabilities(userNutritionOnly);
assert.strictEqual(capsNutr.activePlan, "nutritionist");
assert.strictEqual(capsNutr.canNutrition, true);
assert.strictEqual(capsNutr.canWorkout, false);
console.log("  ✅ [PASS] 'nutritionist' resolved to canNutrition=true, canWorkout=false");

const userWorkoutOnly = calculateUserData({
  name: "Rizky Gym",
  gender: "pria",
  age: 25,
  activeService: "workout",
  persona: "max"
});
const capsWork = getUserPlanCapabilities(userWorkoutOnly);
assert.strictEqual(capsWork.activePlan, "workout");
assert.strictEqual(capsWork.canNutrition, false);
assert.strictEqual(capsWork.canWorkout, true);
console.log("  ✅ [PASS] 'workout' resolved to canNutrition=false, canWorkout=true");

const userBoth = calculateUserData({
  name: "Budi Santoso",
  gender: "pria",
  age: 62,
  activeService: "both",
  persona: "max"
});
const capsBoth = getUserPlanCapabilities(userBoth);
assert.strictEqual(capsBoth.activePlan, "both");
assert.strictEqual(capsBoth.canNutrition, true);
assert.strictEqual(capsBoth.canWorkout, true);
console.log("  ✅ [PASS] 'both' resolved to canNutrition=true, canWorkout=true");

// ── TEST 2: Nutrition Only Plan Behavior ──
console.log("\n[TEST 2] Nutrition Only Plan Validation");

// 2A: Supported Nutrition query
const resMealNutr = validatePlanContext("tadi sarapan bubur ayam 1 mangkok", false, userNutritionOnly);
assert.strictEqual(resMealNutr.canProceed, true);
assert.strictEqual(resMealNutr.decision, "PROCESS_NUTRITION");
console.log("  ✅ [PASS] Food logging allowed on Nutrition Only plan");

// 2B: Food photo
const resPhotoNutr = validatePlanContext("", true, userNutritionOnly);
assert.strictEqual(resPhotoNutr.canProceed, true);
assert.strictEqual(resPhotoNutr.decision, "PROCESS_NUTRITION");
console.log("  ✅ [PASS] Photo logging allowed on Nutrition Only plan");

// 2C: Unsupported Workout request on Nutrition Only plan
const resWorkoutOnNutr = validatePlanContext("buatkan jadwal workout minggu ini", false, userNutritionOnly);
assert.strictEqual(resWorkoutOnNutr.canProceed, false);
assert.strictEqual(resWorkoutOnNutr.decision, "REDIRECT_UNSUPPORTED_WORKOUT");
assert(Boolean(resWorkoutOnNutr.redirectMessage), "Must provide friendly redirection message");
assert(resWorkoutOnNutr.redirectMessage!.toLowerCase().includes("nutrisi"), "Must mention focus on nutrition");
assert(resWorkoutOnNutr.redirectMessage!.toLowerCase().includes("upgrade") || resWorkoutOnNutr.redirectMessage!.toLowerCase().includes("paket"), "Must mention upgrade/plan option");
console.log("  Redirection Message:", `"${resWorkoutOnNutr.redirectMessage}"`);
console.log("  ✅ [PASS] Workout request on Nutrition Only plan politely redirected to Nutrition & upgrade");

// 2D: Equipment inquiry on Nutrition Only plan
const resEquipOnNutr = validatePlanContext("alat gym leg press cara pakainya gimana?", false, userNutritionOnly);
assert.strictEqual(resEquipOnNutr.canProceed, false);
assert.strictEqual(resEquipOnNutr.decision, "REDIRECT_UNSUPPORTED_WORKOUT");
console.log("  ✅ [PASS] Gym equipment inquiry on Nutrition Only plan politely redirected");

// ── TEST 3: Workout Only Plan Behavior ──
console.log("\n[TEST 3] Workout Only Plan Validation");

// 3A: Supported Workout log
const resWorkoutWork = validatePlanContext("aku tadi push up 3 set x 15 reps", false, userWorkoutOnly);
assert.strictEqual(resWorkoutWork.canProceed, true);
assert.strictEqual(resWorkoutWork.decision, "PROCESS_WORKOUT");
console.log("  ✅ [PASS] Workout log allowed on Workout Only plan");

// 3B: Equipment tutorial
const resEquipWork = validatePlanContext("gimana cara pakai treadmill yang benar", false, userWorkoutOnly);
assert.strictEqual(resEquipWork.canProceed, true);
assert.strictEqual(resEquipWork.decision, "PROCESS_WORKOUT");
console.log("  ✅ [PASS] Equipment guide allowed on Workout Only plan");

// 3C: Unsupported Nutrition request on Workout Only plan
const resFoodOnWork = validatePlanContext("tadi makan nasi padang lauk rendang", false, userWorkoutOnly);
assert.strictEqual(resFoodOnWork.canProceed, false);
assert.strictEqual(resFoodOnWork.decision, "REDIRECT_UNSUPPORTED_NUTRITION");
assert(Boolean(resFoodOnWork.redirectMessage), "Must provide friendly redirection message");
assert(resFoodOnWork.redirectMessage!.toLowerCase().includes("workout") || resFoodOnWork.redirectMessage!.toLowerCase().includes("latihan"), "Must mention focus on workout");
assert(resFoodOnWork.redirectMessage!.toLowerCase().includes("upgrade") || resFoodOnWork.redirectMessage!.toLowerCase().includes("paket"), "Must mention upgrade option");
console.log("  Redirection Message:", `"${resFoodOnWork.redirectMessage}"`);
console.log("  ✅ [PASS] Food logging on Workout Only plan politely redirected to Workout & upgrade");

// 3D: Meal recommendation on Workout Only plan
const resRecOnWork = validatePlanContext("rekomendasi makan malam tinggi protein", false, userWorkoutOnly);
assert.strictEqual(resRecOnWork.canProceed, false);
assert.strictEqual(resRecOnWork.decision, "REDIRECT_UNSUPPORTED_NUTRITION");
console.log("  ✅ [PASS] Meal recommendation on Workout Only plan politely redirected");

// ── TEST 4: Plan with Both (Nutrition + Workout) ──
console.log("\n[TEST 4] Both Plan (Nutrition + Workout)");
const resBothFood = validatePlanContext("makan siang dada ayam panggang", false, userBoth);
assert.strictEqual(resBothFood.canProceed, true);
assert.strictEqual(resBothFood.decision, "PROCESS_NUTRITION");

const resBothWorkout = validatePlanContext("rekomendasi workout dada", false, userBoth);
assert.strictEqual(resBothWorkout.canProceed, true);
assert.strictEqual(resBothWorkout.decision, "PROCESS_WORKOUT");
console.log("  ✅ [PASS] Both nutrition and workout requests allowed on All-Access plan");

// ── TEST 5: Out-of-Context Input ──
console.log("\n[TEST 5] Out-of-Context Input Handling (Friendly Redirect, NO Technical Error)");
const offTopicWeather = "bagaimana cuaca hari ini di jakarta?";
const resWeather = validatePlanContext(offTopicWeather, false, userBoth);
assert.strictEqual(resWeather.canProceed, false);
assert.strictEqual(resWeather.decision, "REDIRECT_OUT_OF_CONTEXT");
assert(!/invalid|error|command not recognized|input tidak valid/i.test(resWeather.redirectMessage!), "Must NEVER contain technical error codes");
console.log("  Off-topic Weather Redirect:", `"${resWeather.redirectMessage}"`);

const offTopicCoding = "bagaimana cara koding python async await?";
const resCoding = validatePlanContext(offTopicCoding, false, userNutritionOnly);
assert.strictEqual(resCoding.canProceed, false);
assert.strictEqual(resCoding.decision, "REDIRECT_OUT_OF_CONTEXT");
assert(!/invalid|error|command not recognized|input tidak valid/i.test(resCoding.redirectMessage!), "Must NEVER contain technical error codes");
console.log("  Off-topic Coding Redirect:", `"${resCoding.redirectMessage}"`);
console.log("  ✅ [PASS] Out-of-context inputs generate friendly, conversational coach redirects without technical error terms!");

// ── TEST 6: Ambiguous Input Handling ──
console.log("\n[TEST 6] Ambiguous Input Handling ('Aku capek banget')");
// 6A: Workout Coach enabled
const resAmbigWorkout = validatePlanContext("aku capek banget", false, userWorkoutOnly);
assert.strictEqual(resAmbigWorkout.canProceed, false);
assert.strictEqual(resAmbigWorkout.decision, "CLARIFY_AMBIGUOUS");
assert(resAmbigWorkout.redirectMessage!.toLowerCase().includes("workout") || resAmbigWorkout.redirectMessage!.toLowerCase().includes("latihan") || resAmbigWorkout.redirectMessage!.toLowerCase().includes("recovery"), "Must ask clarification regarding workout recovery");
console.log("  Workout Ambiguous Clarification:", `"${resAmbigWorkout.redirectMessage}"`);

// 6B: Nutrition Coach Only (Workout NOT enabled - must NOT assume workout!)
const resAmbigNutr = validatePlanContext("aku capek banget", false, userNutritionOnly);
assert.strictEqual(resAmbigNutr.canProceed, false);
assert.strictEqual(resAmbigNutr.decision, "CLARIFY_AMBIGUOUS");
assert(!resAmbigNutr.redirectMessage!.toLowerCase().includes("setelah workout"), "Must NOT assume workout request on nutrition-only plan");
assert(resAmbigNutr.redirectMessage!.toLowerCase().includes("makan") || resAmbigNutr.redirectMessage!.toLowerCase().includes("air") || resAmbigNutr.redirectMessage!.toLowerCase().includes("asupan"), "Must check nutrition/hydration/energy intake");
console.log("  Nutrition Ambiguous Clarification:", `"${resAmbigNutr.redirectMessage}"`);
console.log("  ✅ [PASS] Ambiguous input dynamically contextualized based on active plan!");

// ── TEST 7: Mixed Input Handling ──
console.log("\n[TEST 7] Mixed Input Handling (Supported + Unsupported Topics)");
const mixedWeatherAndMeal = "Cuaca hari ini gimana? Oh iya, tadi aku makan nasi goreng.";
const resMixed = validatePlanContext(mixedWeatherAndMeal, false, userNutritionOnly);
assert.strictEqual(resMixed.canProceed, true);
assert.strictEqual(resMixed.inputCategory, "MIXED");
assert.strictEqual(resMixed.decision, "PROCESS_NUTRITION");
console.log("  ✅ [PASS] Mixed message prioritized supported meal logging portion and ignored weather query!");

// ── TEST 8: Casual Conversation ──
console.log("\n[TEST 8] Casual Conversation (Greetings, Thanks, Acknowledgments)");
const casualGreetings = ["Halo coach", "Selamat pagi", "Terima kasih", "Okay", "Siap"];
for (const greeting of casualGreetings) {
  const resCasual = validatePlanContext(greeting, false, userNutritionOnly);
  assert.strictEqual(resCasual.canProceed, true);
  assert.strictEqual(resCasual.inputCategory, "GREETING_OR_CASUAL");
  assert.strictEqual(resCasual.decision, "PROCESS_CASUAL");
}
console.log("  ✅ [PASS] All casual conversational inputs allowed naturally regardless of active plan!");

// ── TEST 9: Addressing & Persona Alignment in Plan Redirection ──
console.log("\n[TEST 9] Validated Addressing in Plan Redirections (Zero 'bro' slang)");
// 9A: Lansia Male on Workout-Only Plan
const resLansiaWorkRedirect = validatePlanContext("tadi makan soto ayam", false, userBoth);
// userBoth allows nutrition, but let's test a Lansia Male on Nutrition-Only plan asking for workout:
const userLansiaNutrOnly = calculateUserData({
  name: "Budi Santoso",
  gender: "pria",
  age: 65,
  activeService: "nutritionist",
  persona: "max"
});
const resLansiaRedirect = validatePlanContext("buatkan jadwal latihan", false, userLansiaNutrOnly);
console.log("  Lansia Redirect:", `"${resLansiaRedirect.redirectMessage}"`);
assert(resLansiaRedirect.redirectMessage!.includes("Pak Budi"), "Must address Lansia as 'Pak Budi'");
assert(!/\bbro\b/i.test(resLansiaRedirect.redirectMessage!), "Must NEVER contain 'bro'");
assert(resLansiaRedirect.redirectMessage!.includes("Anda"), "Must use respectful pronoun 'Anda'");
console.log("  ✅ [PASS] Plan redirection strictly follows age-based addressing and respectful tone!");

console.log("\n--------------------------------------------------");
console.log("🎉 ALL PLAN-BASED CONTEXT VALIDATION TESTS PASSED 100%!");
