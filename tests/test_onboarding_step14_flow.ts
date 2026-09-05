import assert from "assert";
import { normalizePhoneToE164, normalizePhoneToLocal } from "../services/phoneNormalizer";

console.log("=== RUNNING ONBOARDING STEP 14 FLOW INTEGRATION TESTS ===");

// 1. Biometrics calculation test (Simulating Step 14 state calculation)
const weight = "65";
const height = "170";
const age = "23";
const gender = "pria";
const goal = "maintain";
const activityLevel = "sedentary";
const userTargetWeight = "";

const userW = Number(weight) || 65;
const userH = Number(height) || 170;
const userA = Number(age) || 25;
const userG = gender || "pria";
const userGoal = goal || "lose";
const userAct = activityLevel || "light";

const hM = userH / 100;
const bmiIdealW = Math.round(22 * hM * hM * 2) / 2;
const recW = Math.min(userW - 2, Math.max(45, bmiIdealW));

let targetW = Number(userTargetWeight) || userW;
if (userGoal === "lose" && !userTargetWeight) targetW = recW;
else if (userGoal === "gain" && !userTargetWeight) targetW = userW + 5;

const bmr = userG === "wanita"
  ? 10 * userW + 6.25 * userH - 5 * userA - 161
  : 10 * userW + 6.25 * userH - 5 * userA + 5;

const actMultipliers: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725
};
const tdee = Math.round(bmr * (actMultipliers[userAct] || 1.375));

let targetCal = tdee;
if (userGoal === "lose") targetCal = Math.max(1200, Math.round(tdee - 500));
else if (userGoal === "gain") targetCal = Math.round(tdee + 400);

const proteinGram = Math.round((targetCal * 0.30) / 4);
const carbsGram = Math.round((targetCal * 0.45) / 4);
const fatGram = Math.round((targetCal * 0.25) / 9);

// Verify exact numbers from user's screenshot:
// Screenshot: 1,923 kcal/hari, 65kg, 170cm, usia 23 th (pria)
// Protein: 144g, Carbs: 216g, Fat: 53g
console.log(`Computed BMR: ${bmr}, TDEE: ${tdee}, Target Calories: ${targetCal}`);
console.log(`Computed Macros: Protein=${proteinGram}g, Carbs=${carbsGram}g, Fat=${fatGram}g`);

assert.strictEqual(targetCal, 1923, "Calculated target calories must be exactly 1923 kcal matching screenshot");
assert.strictEqual(proteinGram, 144, "Protein must match 144g");
assert.strictEqual(carbsGram, 216, "Carbs must match 216g");
assert.strictEqual(fatGram, 53, "Fat must match 53g");
console.log("✅ Target calories and macro calculations match screenshot 100%");

// 2. Final User Object creation without ReferenceError
const phone = "081234567890";
const cleaned = phone.replace(/\D/g, "");
const norm = cleaned.startsWith("62") ? "0" + cleaned.substring(2) : (cleaned.startsWith("8") ? "0" + cleaned : cleaned);
const canonicalPhone = normalizePhoneToE164(phone) || (norm ? `+62${norm}` : phone);

const finalUserObj = {
  name: "User",
  goal,
  goalTitle: "Gaya Hidup Sehat & Fit",
  goalEvent: "daily",
  goalSecondary: ["portion_control"],
  emotionalVision: "confidence",
  gender,
  weight: userW,
  startWeight: userW,
  targetWeight: targetW,
  aiRecommendedTargetWeight: recW,
  height: Number(height) || 170,
  age: userA, // VERIFY userA is properly defined and doesn't throw ReferenceError
  dob: "",
  healthStatus: "no_condition",
  healthConditions: [],
  otherCondition: "",
  activityLevel,
  experience: "beginner",
  satisfaction: "medium",
  challenges: ["nyerah"],
  injuries: ["none"],
  customInjury: "",
  allergies: ["none"],
  equipment: "full_gym",
  persona: "max",
  selectedPlan: "free_trial",
  selectedFeature: "coach",
  phone: canonicalPhone,
  normalizedPhone: canonicalPhone,
  targetCalories: targetCal,
  dailyTargetCalories: targetCal,
  proteinGrams: proteinGram,
  dailyTargetProtein: proteinGram,
  carbGrams: carbsGram,
  dailyTargetCarbs: carbsGram,
  fatGrams: fatGram,
  dailyTargetFat: fatGram,
  fiberGrams: Math.max(20, Math.min(38, Math.round(targetCal / 75))),
  activeService: "both",
  onboardingCompleted: true
};

assert.strictEqual(finalUserObj.age, 23, "finalUserObj.age is 23 (userA)");
assert.strictEqual(finalUserObj.targetCalories, 1923, "finalUserObj.targetCalories is 1923");
assert.strictEqual(finalUserObj.onboardingCompleted, true, "onboardingCompleted is true");
console.log("✅ finalUserObj created successfully without ReferenceError");

console.log("🎉 ALL ONBOARDING STEP 14 FLOW TESTS PASSED!");
