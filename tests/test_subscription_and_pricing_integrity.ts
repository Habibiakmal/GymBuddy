import assert from "assert";
import {
  getUserSubscription,
  grantTrialToUser,
  applyCommercialPlan,
  calculateUserData
} from "../server.js";

async function runTests() {
  console.log("================================================================================");
  console.log("TEST SUITE: Subscription Engine, Trial Lifecycle, Entitlements & Pricing Integrity");
  console.log("================================================================================\n");

  // 1. Test 2-Day Trial Granting Logic
  console.log("Test 1: Granting 2-Day Trial to a New User...");
  const newUser: any = {
    name: "Andi Pratama",
    phone: "628123456789",
    weight: 70,
    height: 175,
    gender: "pria",
    goal: "lose"
  };

  const trialResult = grantTrialToUser(newUser);
  assert.strictEqual(trialResult.success, true, "Trial grant should succeed for new user");
  assert.strictEqual(trialResult.user.plan, "trial", "User plan should be set to 'trial'");
  assert.strictEqual(trialResult.user.hasUsedTrial, true, "User hasUsedTrial flag should be true");
  assert.ok(trialResult.user.trialStartedAt, "trialStartedAt timestamp must exist");
  assert.ok(trialResult.user.planExpiresAt, "planExpiresAt timestamp must exist");

  const startMs = new Date(trialResult.user.trialStartedAt).getTime();
  const expiryMs = new Date(trialResult.user.planExpiresAt).getTime();
  const diffHours = (expiryMs - startMs) / (1000 * 60 * 60);
  assert.strictEqual(Math.round(diffHours), 48, "Trial duration must be exactly 48 hours (2 days)");
  console.log("✅ PASS: 2-Day Trial successfully granted with exact 48-hour expiration.\n");

  // 2. Test Double-claiming Trial Prevention
  console.log("Test 2: Preventing Double-Claiming of Trial...");
  const secondTrialAttempt = grantTrialToUser(trialResult.user);
  assert.strictEqual(secondTrialAttempt.success, false, "Should reject second trial attempt");
  console.log("✅ PASS: Repeated trial activation rejected as expected.\n");

  // 3. Test Subscription Resolution for Active Trial
  console.log("Test 3: Subscription Resolution & Entitlements for Active Trial...");
  const activeSub = getUserSubscription(trialResult.user);
  assert.strictEqual(activeSub.plan, "trial");
  assert.strictEqual(activeSub.isActive, true);
  assert.strictEqual(activeSub.isExpired, false);
  assert.strictEqual(activeSub.entitlements.canNutrition, true, "Trial must allow Nutrition features");
  assert.strictEqual(activeSub.entitlements.canWorkout, true, "Trial must allow Workout Coach features");
  console.log("✅ PASS: Active trial receives full access entitlements.\n");

  // 4. Test Subscription Resolution for Expired Trial
  console.log("Test 4: Expired Trial Resolution & Entitlement Restrictions...");
  const expiredTrialUser = {
    ...trialResult.user,
    planExpiresAt: new Date(Date.now() - 3600 * 1000).toISOString() // 1 hour ago
  };
  const expiredSub = getUserSubscription(expiredTrialUser);
  assert.strictEqual(expiredSub.isActive, false, "Expired trial must not be active");
  assert.strictEqual(expiredSub.isExpired, true, "isExpired must be true");
  assert.strictEqual(expiredSub.entitlements.canNutrition, false, "Expired trial cannot use Nutrition");
  assert.strictEqual(expiredSub.entitlements.canWorkout, false, "Expired trial cannot use Workout");
  assert.strictEqual(expiredSub.entitlements.reason, "expired");
  console.log("✅ PASS: Expired trial correctly restricts access with expired code.\n");

  // 5. Test Single AI Nutritionist Plan
  console.log("Test 5: Advanced AI Nutritionist Entitlements...");
  const nutritionUser = {
    ...newUser,
    plan: "nutritionist",
    planDuration: "1_month",
    planExpiresAt: new Date(Date.now() + 30 * 86400000).toISOString()
  };
  const nutritionSub = getUserSubscription(nutritionUser);
  assert.strictEqual(nutritionSub.isActive, true);
  assert.strictEqual(nutritionSub.entitlements.canNutrition, true, "Nutritionist plan must allow nutrition");
  assert.strictEqual(nutritionSub.entitlements.canWorkout, false, "Nutritionist plan cannot use workout features");
  console.log("✅ PASS: Advanced AI Nutritionist plan correctly scopes entitlements to nutrition only.\n");

  // 6. Test Single AI Workout Coach Plan
  console.log("Test 6: Advanced AI Workout Coach Entitlements...");
  const coachUser = {
    ...newUser,
    plan: "workout_coach",
    planDuration: "1_month",
    planExpiresAt: new Date(Date.now() + 30 * 86400000).toISOString()
  };
  const coachSub = getUserSubscription(coachUser);
  assert.strictEqual(coachSub.isActive, true);
  assert.strictEqual(coachSub.entitlements.canNutrition, false, "Workout Coach plan cannot use nutrition features");
  assert.strictEqual(coachSub.entitlements.canWorkout, true, "Workout Coach plan must allow workout features");
  console.log("✅ PASS: Advanced AI Workout Coach plan correctly scopes entitlements to workouts only.\n");

  // 7. Test Premium All-Access Plan
  console.log("Test 7: Premium All-Access Entitlements...");
  const premiumUser = {
    ...newUser,
    plan: "premium",
    planDuration: "1_year",
    planExpiresAt: new Date(Date.now() + 365 * 86400000).toISOString()
  };
  const premiumSub = getUserSubscription(premiumUser);
  assert.strictEqual(premiumSub.isActive, true);
  assert.strictEqual(premiumSub.entitlements.canNutrition, true);
  assert.strictEqual(premiumSub.entitlements.canWorkout, true);
  console.log("✅ PASS: Premium All-Access plan grants both AIs and all vision features.\n");

  // 8. Test Commercial Plan Upgrade Engine
  console.log("Test 8: Upgrading User via applyCommercialPlan...");
  const upgradeResult = applyCommercialPlan(newUser, "premium", "3_months");
  assert.strictEqual(upgradeResult.success, true);
  assert.strictEqual(upgradeResult.user.plan, "premium");
  assert.strictEqual(upgradeResult.user.planDuration, "3_months");
  const upgradedSub = getUserSubscription(upgradeResult.user);
  assert.strictEqual(upgradedSub.isActive, true);
  assert.ok(upgradedSub.daysRemaining >= 89 && upgradedSub.daysRemaining <= 93, "3m should be ~90 days");
  console.log(`✅ PASS: User upgraded to 3m Premium (${upgradedSub.daysRemaining} days remaining).\n`);

  // 9. Test Lifetime Plan
  console.log("Test 9: Lifetime Plan Validity...");
  const lifetimeResult = applyCommercialPlan(newUser, "lifetime", "lifetime");
  assert.strictEqual(lifetimeResult.success, true);
  assert.strictEqual(lifetimeResult.user.plan, "lifetime");
  const lifetimeSub = getUserSubscription(lifetimeResult.user);
  assert.strictEqual(lifetimeSub.isActive, true);
  assert.strictEqual(lifetimeSub.isExpired, false);
  assert.strictEqual(lifetimeSub.planExpiresAt, null, "Lifetime plan should never expire");
  console.log("✅ PASS: Lifetime plan grants perpetual active access.\n");

  // 10. Test calculateUserData Full Integration
  console.log("Test 10: calculateUserData Full Integration...");
  const calc = calculateUserData(upgradeResult.user);
  assert.strictEqual(calc.plan, "premium");
  assert.strictEqual(calc.planDuration, "3_months");
  assert.strictEqual(calc.isActive, true);
  assert.strictEqual(calc.isExpired, false);
  assert.ok(calc.subscription, "subscription object must be present in calculated user data");
  console.log("✅ PASS: calculateUserData seamlessly exposes canonical subscription & entitlements.\n");

  console.log("================================================================================");
  console.log("ALL 10 TESTS PASSED SUCCESSFULLY! 🎉");
  console.log("================================================================================");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
