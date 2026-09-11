import assert from "assert";
import {
  getUserSubscription,
  resolveCanonicalPlanString,
  isSubscriptionActive,
  applyCommercialPlan,
  grantTrialToUser,
  migrateExistingUsersToLifetime
} from "../services/subscriptionEngine";
import {
  getUserPlanCapabilities
} from "../services/planContextEngine";
import {
  calculateUserData
} from "../server";

console.log("================================================================================");
console.log("🛡️ RUNNING AUDIT: FULL SYSTEM ENTITLEMENT & PLAN SYNCHRONIZATION AUDIT");
console.log("================================================================================");

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (e: any) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${e?.message || e}`);
    failed++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CANONICAL PLAN RESOLUTION AUDIT
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n▶ AUDIT 1: Canonical Plan String Resolution Across Heterogeneous Data Schemas");

check("User with plan='both' resolves to canonical 'premium'", () => {
  const user = { plan: "both", selectedFeature: "coach", activeService: "coach" };
  const canonical = resolveCanonicalPlanString(user);
  assert.strictEqual(canonical, "premium", "Must normalize 'both' to 'premium'");
});

check("User with selectedPlan='both' resolves to canonical 'premium'", () => {
  const user = { selectedPlan: "both", selectedFeature: "coach" };
  const canonical = resolveCanonicalPlanString(user);
  assert.strictEqual(canonical, "premium", "Must normalize selectedPlan 'both' to 'premium'");
});

check("User with order.selectedPlan='both' resolves to canonical 'premium'", () => {
  const user = { order: { selectedPlan: "both" }, selectedFeature: "coach" };
  const canonical = resolveCanonicalPlanString(user);
  assert.strictEqual(canonical, "premium", "Must extract order.selectedPlan 'both' to 'premium'");
});

check("User with subscription.plan='both' resolves to canonical 'premium'", () => {
  const user = { subscription: { plan: "both" }, selectedFeature: "coach" };
  const canonical = resolveCanonicalPlanString(user);
  assert.strictEqual(canonical, "premium", "Must normalize subscription.plan 'both' to 'premium'");
});

check("User with plan='lifetime' resolves to canonical 'lifetime'", () => {
  const user = { plan: "lifetime" };
  const canonical = resolveCanonicalPlanString(user);
  assert.strictEqual(canonical, "lifetime");
});

check("User with plan='nutritionist' resolves to canonical 'nutritionist'", () => {
  const user = { plan: "nutritionist", selectedFeature: "nutrition" };
  const canonical = resolveCanonicalPlanString(user);
  assert.strictEqual(canonical, "nutritionist");
});

check("User with plan='workout_coach' resolves to canonical 'workout_coach'", () => {
  const user = { plan: "workout_coach", selectedFeature: "coach" };
  const canonical = resolveCanonicalPlanString(user);
  assert.strictEqual(canonical, "workout_coach");
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. CANONICAL ENTITLEMENT MATRIX AUDIT
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n▶ AUDIT 2: Canonical Entitlements & Subscription Capabilities Matrix");

check("Both Plan (Commercial Active) grants BOTH Nutritionist & Workout Coach", () => {
  const bothUser = {
    phone: "6281234567890",
    name: "Both Plan User",
    plan: "both",
    selectedFeature: "coach", // Lingering coach token from onboarding
    activeService: "coach",   // Lingering coach token
    planExpiresAt: new Date(Date.now() + 30 * 86400000).toISOString()
  };

  const sub = getUserSubscription(bothUser);
  assert.strictEqual(sub.isActive, true, "Subscription must be active");
  assert.strictEqual(sub.plan, "premium", "Canonical plan is premium (all-access)");
  assert.strictEqual(sub.entitlements.canNutrition, true, "Nutrition MUST be unlocked");
  assert.strictEqual(sub.entitlements.canWorkout, true, "Workout MUST be unlocked");

  // WhatsApp Capability Parity
  const waCaps = getUserPlanCapabilities(bothUser);
  assert.strictEqual(waCaps.canNutrition, true, "WhatsApp must grant nutrition tracking");
  assert.strictEqual(waCaps.canWorkout, true, "WhatsApp must grant workout tracking");
});

check("Both Plan with userState='active' but missing expiresAtDate remains active", () => {
  const activeUserStateUser = {
    phone: "6281234567891",
    name: "Active Both User No Expiry",
    plan: "both",
    userState: "active"
  };

  const sub = getUserSubscription(activeUserStateUser);
  assert.strictEqual(sub.isActive, true, "Subscription must be active due to userState active");
  assert.strictEqual(sub.entitlements.canNutrition, true);
  assert.strictEqual(sub.entitlements.canWorkout, true);
});

check("Nutritionist Only Plan grants ONLY Nutritionist (Workout Locked)", () => {
  const nutritionUser = {
    phone: "6281234567892",
    plan: "nutritionist",
    activeService: "nutrition",
    planExpiresAt: new Date(Date.now() + 30 * 86400000).toISOString()
  };

  const sub = getUserSubscription(nutritionUser);
  assert.strictEqual(sub.isActive, true);
  assert.strictEqual(sub.entitlements.canNutrition, true, "Nutritionist unlocked");
  assert.strictEqual(sub.entitlements.canWorkout, false, "Workout locked");

  const waCaps = getUserPlanCapabilities(nutritionUser);
  assert.strictEqual(waCaps.canNutrition, true);
  assert.strictEqual(waCaps.canWorkout, false);
});

check("Workout Coach Only Plan grants ONLY Workout Coach (Nutritionist Locked)", () => {
  const workoutUser = {
    phone: "6281234567893",
    plan: "workout_coach",
    activeService: "workout",
    planExpiresAt: new Date(Date.now() + 30 * 86400000).toISOString()
  };

  const sub = getUserSubscription(workoutUser);
  assert.strictEqual(sub.isActive, true);
  assert.strictEqual(sub.entitlements.canNutrition, false, "Nutritionist locked");
  assert.strictEqual(sub.entitlements.canWorkout, true, "Workout unlocked");

  const waCaps = getUserPlanCapabilities(workoutUser);
  assert.strictEqual(waCaps.canNutrition, false);
  assert.strictEqual(waCaps.canWorkout, true);
});

check("Lifetime Plan grants BOTH Nutritionist & Workout Coach permanently", () => {
  const lifetimeUser = {
    phone: "6281234567894",
    plan: "lifetime"
  };

  const sub = getUserSubscription(lifetimeUser);
  assert.strictEqual(sub.isActive, true);
  assert.strictEqual(sub.plan, "lifetime");
  assert.strictEqual(sub.entitlements.canNutrition, true);
  assert.strictEqual(sub.entitlements.canWorkout, true);

  const waCaps = getUserPlanCapabilities(lifetimeUser);
  assert.strictEqual(waCaps.canNutrition, true);
  assert.strictEqual(waCaps.canWorkout, true);
});

check("Active Free Trial User grants access during trial period", () => {
  const trialUser = {
    phone: "6281234567895",
    plan: "trial",
    trialExpiresAt: new Date(Date.now() + 48 * 3600000).toISOString()
  };

  const sub = getUserSubscription(trialUser);
  assert.strictEqual(sub.isActive, true, "Trial must be active");
  assert.strictEqual(sub.plan, "trial");
  assert.strictEqual(sub.entitlements.canNutrition, true);
  assert.strictEqual(sub.entitlements.canWorkout, true);
});

check("Expired Free User locks both capabilities", () => {
  const expiredUser = {
    phone: "6281234567896",
    plan: "free",
    hasUsedTrial: true,
    trialExpiresAt: new Date(Date.now() - 86400000).toISOString()
  };

  const sub = getUserSubscription(expiredUser);
  assert.strictEqual(sub.isActive, false, "Must be inactive");
  assert.strictEqual(sub.entitlements.canNutrition, false, "Nutrition locked");
  assert.strictEqual(sub.entitlements.canWorkout, false, "Workout locked");
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. SERVER-SIDE DATA CALCULATION & API HARMONIZATION AUDIT
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n▶ AUDIT 3: Server calculateUserData & API Profile Enrichment Audit");

check("calculateUserData overrides lingering 'coach' when user has Both Plan entitlements", () => {
  const userProfile = {
    userId: "usr_test_both_123",
    name: "Budi Santoso",
    phone: "628129998881",
    plan: "both",
    selectedFeature: "coach", // User picked Coach Max in Step 12
    activeService: "coach",   // Old lingering value
    planExpiresAt: new Date(Date.now() + 30 * 86400000).toISOString()
  };

  const calculated = calculateUserData(userProfile);
  assert.strictEqual(calculated.activeService, "both", "activeService must be forced to 'both'");
  assert.strictEqual(calculated.plan, "premium", "Canonical plan is 'premium'");
  assert.strictEqual(calculated.entitlements.canNutrition, true);
  assert.strictEqual(calculated.entitlements.canWorkout, true);
});

check("applyCommercialPlan with 'premium' sets activeService and selectedFeature to 'both'", () => {
  const rawUser = {
    phone: "6281234567899",
    name: "Andi",
    selectedFeature: "coach",
    activeService: "coach"
  };

  const result = applyCommercialPlan(rawUser, "premium", "1_month");
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.user.activeService, "both", "activeService must be both");
  assert.strictEqual(result.user.selectedFeature, "both", "selectedFeature must be both");
  assert.strictEqual(result.user.plan, "premium");
});

check("applyCommercialPlan with 'lifetime' sets activeService and selectedFeature to 'both'", () => {
  const rawUser = {
    phone: "6281234567898",
    name: "Siti",
    selectedFeature: "nutrition",
    activeService: "nutrition"
  };

  const result = applyCommercialPlan(rawUser, "lifetime", "lifetime");
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.user.activeService, "both");
  assert.strictEqual(result.user.selectedFeature, "both");
  assert.strictEqual(result.user.plan, "lifetime");
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n================================================================================");
console.log(`AUDIT SUMMARY: ${passed} PASSED | ${failed} FAILED`);
console.log("================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("🎉 ALL ENTITLEMENT & PLAN SYNCHRONIZATION AUDIT CHECKS PASSED PERFECTLY!\n");
}
