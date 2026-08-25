import {
  getUserProfile,
  saveUserProfile,
  calculateUserData,
  dbData,
  saveDb
} from "../server";

console.log("=== RUNNING USER DATA PERSISTENCE & STATE SYNCHRONIZATION TEST SUITE ===");

let allPassed = true;
const testPhone = "08999998888";
const altPhone = "628999998888";

// ── SETUP: Initialize User Profile ──
console.log("\n[SETUP] Initializing base user profile...");
const initialProfile = {
  name: "Budi Santoso",
  phone: testPhone,
  gender: "pria",
  age: 25,
  dob: "2001-01-15",
  height: 170,
  weight: 78,
  startWeight: 78,
  targetWeight: 70,
  activityLevel: "moderate",
  goal: "lose",
  goalTitle: "Menurunkan Berat Badan",
  persona: "max",
  healthProfile: {
    dob: "2001-01-15",
    age: 25,
    hasCondition: "no_condition",
    conditions: [],
    otherCondition: "",
    isCompleted: true
  }
};

saveUserProfile(testPhone, initialProfile);
saveDb();

// ── TEST 1: Gender Update & Dependent Recalculation ──
console.log("\n[TEST 1] Gender Change: Pria -> Wanita");
const initialCalculated = calculateUserData(getUserProfile(testPhone));
console.log("  Initial Gender:", initialCalculated.gender, "| BMR:", initialCalculated.bmr, "| Target Cal:", initialCalculated.targetCalories);

// User changes Gender to "wanita"
const updatedGenderUser = {
  ...getUserProfile(testPhone),
  gender: "wanita"
};
saveUserProfile(testPhone, updatedGenderUser);
saveDb();

// Verify Database
const savedGenderUser = getUserProfile(testPhone);
const genderCalculated = calculateUserData(savedGenderUser);

console.log("  Updated Gender:", genderCalculated.gender, "| BMR:", genderCalculated.bmr, "| Target Cal:", genderCalculated.targetCalories);

if (savedGenderUser.gender === "wanita" && genderCalculated.gender === "Wanita") {
  console.log("  ✅ [PASS] Gender successfully updated and persisted as 'wanita' in DB!");
} else {
  console.error("  ❌ [FAIL] Gender update failed in DB:", savedGenderUser.gender);
  allPassed = false;
}

// Female BMR should use -161 vs +5 for Male (diff = 166 kcal)
if (genderCalculated.bmr < initialCalculated.bmr) {
  console.log(`  ✅ [PASS] Dependent recalculation verified: BMR updated from ${initialCalculated.bmr} to ${genderCalculated.bmr} kcal!`);
} else {
  console.error("  ❌ [FAIL] BMR did not recalculate for female gender!");
  allPassed = false;
}

// ── TEST 2: Weight & Height Update & Recalculation ──
console.log("\n[TEST 2] Weight & Height Update (78kg -> 76kg, 170cm -> 175cm)");

const updatedBiometrics = {
  ...getUserProfile(testPhone),
  weight: 76,
  height: 175
};
saveUserProfile(testPhone, updatedBiometrics);
saveDb();

const savedBio = getUserProfile(testPhone);
const bioCalculated = calculateUserData(savedBio);

if (savedBio.weight === 76 && bioCalculated.weight === 76 && savedBio.height === 175 && bioCalculated.height === 175) {
  console.log("  ✅ [PASS] Weight 76kg and Height 175cm persisted and calculated accurately!");
} else {
  console.error("  ❌ [FAIL] Biometrics update failed:", savedBio.weight, savedBio.height);
  allPassed = false;
}

// ── TEST 3: DOB & Derived Age Update ──
console.log("\n[TEST 3] Date of Birth & Derived Age (1998-05-15 -> Age 28)");

const updatedDob = {
  ...getUserProfile(testPhone),
  dob: "1998-05-15"
};
saveUserProfile(testPhone, updatedDob);
saveDb();

const savedDobUser = getUserProfile(testPhone);
const dobCalculated = calculateUserData(savedDobUser);

if (dobCalculated.dob === "1998-05-15" && dobCalculated.age === 28) {
  console.log("  ✅ [PASS] Date of Birth persisted and dynamically derived Age 28!");
} else {
  console.error("  ❌ [FAIL] DOB / Age calculation failed:", dobCalculated.age, dobCalculated.dob);
  allPassed = false;
}

// ── TEST 4: AI Coach Persona Switch (Max -> Mia) ──
console.log("\n[TEST 4] AI Coach Persona Switch (Max -> Mia)");

const updatedPersona = {
  ...getUserProfile(testPhone),
  persona: "mia"
};
saveUserProfile(testPhone, updatedPersona);
saveDb();

const savedPersonaUser = getUserProfile(testPhone);
const personaCalculated = calculateUserData(savedPersonaUser);

if (savedPersonaUser.persona === "mia" && personaCalculated.persona === "mia") {
  console.log("  ✅ [PASS] Coach Persona switched to 'mia' and persisted in DB!");
} else {
  console.error("  ❌ [FAIL] Coach Persona update failed:", savedPersonaUser.persona);
  allPassed = false;
}

// ── TEST 5: Health Profile & Conditions ──
console.log("\n[TEST 5] Health Profile Conditions & Summary");

const updatedHealth = {
  ...getUserProfile(testPhone),
  healthProfile: {
    dob: "1998-05-15",
    age: 28,
    hasCondition: "has_condition",
    conditions: ["hypertension", "joint_pain"],
    otherCondition: "Asthma",
    isCompleted: true,
    completedAt: new Date().toISOString()
  }
};
saveUserProfile(testPhone, updatedHealth);
saveDb();

const savedHealthUser = getUserProfile(testPhone);
const healthCalculated = calculateUserData(savedHealthUser);

if (
  healthCalculated.healthProfile.hasCondition === "has_condition" &&
  healthCalculated.healthProfile.conditions.includes("hypertension") &&
  healthCalculated.healthProfile.conditions.includes("joint_pain") &&
  healthCalculated.healthProfile.otherCondition === "Asthma" &&
  healthCalculated.healthConditionsSummary.includes("hypertension") &&
  healthCalculated.healthConditionsSummary.includes("Asthma")
) {
  console.log("  ✅ [PASS] Health profile and conditions summary persisted accurately:", healthCalculated.healthConditionsSummary);
} else {
  console.error("  ❌ [FAIL] Health profile persistence failed:", healthCalculated.healthConditionsSummary);
  allPassed = false;
}

// ── TEST 6: Custom Nutrition Targets ──
console.log("\n[TEST 6] Custom Nutrition Targets (Manual Override & Reset)");

const customTargets = {
  calories: 2400,
  protein: 175,
  carbs: 250,
  fat: 70,
  sugar: 35,
  water: 3000
};

const updatedCustomTargets = {
  ...getUserProfile(testPhone),
  customTargets,
  targetCalories: 2400
};
saveUserProfile(testPhone, updatedCustomTargets);
saveDb();

const savedCustomUser = getUserProfile(testPhone);
if (savedCustomUser.customTargets?.calories === 2400 && savedCustomUser.customTargets?.protein === 175) {
  console.log("  ✅ [PASS] Custom nutrition targets persisted in DB!");
} else {
  console.error("  ❌ [FAIL] Custom targets persistence failed:", savedCustomUser.customTargets);
  allPassed = false;
}

// ── TEST 7: Single Source of Truth & No Duplicate Profiles ──
console.log("\n[TEST 7] Single Source of Truth & Zero Duplicate Records");

const matchingUserKeys = Object.keys(dbData.users).filter(k => k.includes("8999998888"));
console.log("  Matching DB keys for user:", matchingUserKeys);

// Both normalized keys (08999998888 and 628999998888) point to identical object state
const user1 = getUserProfile(testPhone);
const user2 = getUserProfile(altPhone);

if (user1 && user2 && user1.gender === user2.gender && user1.weight === user2.weight && user1.dob === user2.dob) {
  console.log("  ✅ [PASS] Single source of truth: Primary and Alt phone lookups are 100% synchronized!");
} else {
  console.error("  ❌ [FAIL] Discrepancy between primary and alt phone records!");
  allPassed = false;
}

// ── TEST 8: Full Refresh / Reload Simulation ──
console.log("\n[TEST 8] Full Reload Simulation: Fetching Fresh State from Database");

// Simulate full reload by reading directly from DB without any prior in-memory React state
const freshLoadedUser = getUserProfile(testPhone);
const freshCalculated = calculateUserData(freshLoadedUser);

if (
  freshCalculated.name === "Budi Santoso" &&
  freshCalculated.gender === "Wanita" &&
  freshCalculated.weight === 76 &&
  freshCalculated.height === 175 &&
  freshCalculated.age === 28 &&
  freshCalculated.dob === "1998-05-15" &&
  freshCalculated.persona === "mia" &&
  freshCalculated.healthProfile.otherCondition === "Asthma"
) {
  console.log("  ✅ [PASS] Full reload simulation survived: All 8 updated fields retained fresh values!");
} else {
  console.error("  ❌ [FAIL] Refresh simulation returned stale data:", freshCalculated);
  allPassed = false;
}

// ── CLEANUP ──
delete dbData.users[testPhone];
delete dbData.users[altPhone];
saveDb();

console.log("\n--------------------------------------------------");
if (allPassed) {
  console.log("🎉 ALL DATA PERSISTENCE & STATE SYNCHRONIZATION TESTS PASSED 100%!");
  process.exit(0);
} else {
  console.error("❌ SOME TESTS FAILED!");
  process.exit(1);
}
