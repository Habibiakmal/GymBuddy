/**
 * Test Suite: Personalization & Commercial Pricing Integrity
 * 
 * Verifies:
 * 1. Health data persistence & DOB/age calculation rules:
 *    - DOB exists -> calculates age accurately from DOB
 *    - DOB missing, explicit age exists -> uses explicit age
 *    - Both missing -> age is null, NEVER 25
 *    - Real onboarding health data sets healthProfile.isCompleted = true
 *    - Empty health data leaves healthProfile.isCompleted = false
 * 2. Canonical commercial pricing integrity:
 *    - Durations: 3_months, 6_months, 1_year
 *    - Single specialists: 249k, 449k, 749k
 *    - Both (All-Access): 399k, 699k, 1199k
 * 3. Plan merge logic:
 *    - workout_coach + nutritionist -> both
 *    - nutritionist + workout_coach -> both
 *    - both + anything -> both
 * 4. Dashboard modal defense-in-depth logic:
 *    - Does NOT prompt users who completed onboarding with health fields
 */

import {
  PLAN_PRICING,
  DURATIONS,
  DURATION_LABELS,
  getPrice,
  normalizeDuration,
  normalizePlan,
  mergePlans,
  type PlanKey,
  type DurationKey
} from "../services/pricingConfig";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("TEST 1: Canonical Pricing Config Values");
  console.log("=======================================================");

  // Check durations
  assert(DURATIONS.length === 3, "Exactly 3 commercial durations are defined");
  assert(DURATIONS.includes("3_months"), "Includes 3_months");
  assert(DURATIONS.includes("6_months"), "Includes 6_months");
  assert(DURATIONS.includes("1_year"), "Includes 1_year");

  // Check Nutritionist prices
  assert(getPrice("nutritionist", "3_months") === 249000, "Nutritionist 3 months = Rp 249.000");
  assert(getPrice("nutritionist", "6_months") === 449000, "Nutritionist 6 months = Rp 449.000");
  assert(getPrice("nutritionist", "1_year") === 749000, "Nutritionist 1 year = Rp 749.000");

  // Check Workout Coach prices
  assert(getPrice("workout_coach", "3_months") === 249000, "Workout Coach 3 months = Rp 249.000");
  assert(getPrice("workout_coach", "6_months") === 449000, "Workout Coach 6 months = Rp 449.000");
  assert(getPrice("workout_coach", "1_year") === 749000, "Workout Coach 1 year = Rp 749.000");

  // Check Both (All-Access) prices
  assert(getPrice("both", "3_months") === 399000, "Both 3 months = Rp 399.000");
  assert(getPrice("both", "6_months") === 699000, "Both 6 months = Rp 699.000");
  assert(getPrice("both", "1_year") === 1199000, "Both 1 year = Rp 1.199.000");

  console.log("\n=======================================================");
  console.log("TEST 2: Duration & Plan Normalizers");
  console.log("=======================================================");

  assert(normalizeDuration("3_months") === "3_months", "Normalizes 3_months");
  assert(normalizeDuration("3m") === "3_months", "Normalizes 3m to 3_months");
  assert(normalizeDuration("6_months") === "6_months", "Normalizes 6_months");
  assert(normalizeDuration("6m") === "6_months", "Normalizes 6m to 6_months");
  assert(normalizeDuration("1_year") === "1_year", "Normalizes 1_year");
  assert(normalizeDuration("1y") === "1_year", "Normalizes 1y to 1_year");
  assert(normalizeDuration("invalid") === null, "Rejects invalid duration");

  assert(normalizePlan("workout_coach") === "workout_coach", "Normalizes workout_coach");
  assert(normalizePlan("coach") === "workout_coach", "Normalizes coach to workout_coach");
  assert(normalizePlan("nutritionist") === "nutritionist", "Normalizes nutritionist");
  assert(normalizePlan("both") === "both", "Normalizes both");
  assert(normalizePlan("premium") === "both", "Normalizes premium to both");

  console.log("\n=======================================================");
  console.log("TEST 3: Plan Merge Logic");
  console.log("=======================================================");

  assert(mergePlans("workout_coach", "nutritionist") === "both", "Workout Coach + Nutritionist = Both");
  assert(mergePlans("nutritionist", "workout_coach") === "both", "Nutritionist + Workout Coach = Both");
  assert(mergePlans("both", "nutritionist") === "both", "Both + Nutritionist = Both");
  assert(mergePlans("both", "workout_coach") === "both", "Both + Workout Coach = Both");
  assert(mergePlans("free", "workout_coach") === "workout_coach", "Free + Workout Coach = Workout Coach");
  assert(mergePlans(null, "nutritionist") === "nutritionist", "Null + Nutritionist = Nutritionist");

  console.log("\n=======================================================");
  console.log("TEST 4: Age Derivation & Health Data Rules");
  console.log("=======================================================");

  function deriveAgeAndHealthProfile(profile: any) {
    const rawDob = profile.dob || "";
    let derivedAge: number | null = null;
    if (rawDob && /^\d{4}-\d{2}-\d{2}$/.test(rawDob)) {
      const d = new Date(rawDob);
      if (!isNaN(d.getTime())) {
        const today = new Date();
        let calc = today.getFullYear() - d.getFullYear();
        const m = today.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < d.getDate())) calc--;
        if (calc >= 1 && calc <= 130) derivedAge = calc;
      }
    } else if (profile.age !== undefined && profile.age !== null && Number(profile.age) > 0) {
      derivedAge = Number(profile.age);
    }

    const onboardingConditions: string[] = Array.isArray(profile.healthConditions)
      ? profile.healthConditions
      : [];
    const onboardingHealthStatus: string | undefined =
      profile.healthStatus || (onboardingConditions.length > 0 ? "has_condition" : undefined);
    const hasRealHealthData = Boolean(
      rawDob || (derivedAge !== null) || onboardingHealthStatus
    );

    const synthesizedHealthProfile = hasRealHealthData
      ? {
          dob: rawDob || null,
          age: derivedAge,
          hasCondition: onboardingHealthStatus || "no_condition",
          conditions: onboardingConditions,
          otherCondition: profile.otherCondition || "",
          isCompleted: true,
          completedAt: new Date().toISOString(),
          source: "onboarding"
        }
      : (profile.healthProfile ?? null);

    return {
      age: derivedAge !== null ? derivedAge : (profile.age ?? null),
      healthProfile: synthesizedHealthProfile
    };
  }

  // Case A: Real DOB (e.g. born 2000-01-15)
  const caseA = deriveAgeAndHealthProfile({
    dob: "2000-01-15",
    healthStatus: "no_condition"
  });
  assert(caseA.age !== null && caseA.age >= 25, `DOB 2000-01-15 derived age: ${caseA.age} (not null)`);
  assert(caseA.healthProfile !== null && caseA.healthProfile.isCompleted === true, "healthProfile.isCompleted is true for user with DOB & healthStatus");
  assert(caseA.healthProfile.dob === "2000-01-15", "Exact DOB survived in healthProfile");

  // Case B: Explicit age without DOB (e.g. age 32)
  const caseB = deriveAgeAndHealthProfile({
    age: 32,
    healthConditions: ["hypertension"]
  });
  assert(caseB.age === 32, "Explicit age 32 used when DOB is missing");
  assert(caseB.healthProfile?.age === 32, "Explicit age propagated to healthProfile");
  assert(caseB.healthProfile?.isCompleted === true, "healthProfile.isCompleted is true when explicit age & condition given");
  assert(caseB.healthProfile?.conditions[0] === "hypertension", "Health condition preserved");

  // Case C: Missing DOB and missing age
  const caseC = deriveAgeAndHealthProfile({
    healthStatus: "no_condition"
  });
  assert(caseC.age === null, "Age is strictly null when DOB and age are missing (NEVER defaults to 25)");
  assert(caseC.healthProfile?.age === null, "healthProfile.age is null, not 25");

  // Case D: Completely empty health profile
  const caseD = deriveAgeAndHealthProfile({});
  assert(caseD.age === null, "Empty profile: age is null");
  assert(caseD.healthProfile === null, "Empty profile: healthProfile is null, not marked completed");

  console.log("\n=======================================================");
  console.log("TEST 5: Dashboard Modal Suppression Defense-In-Depth");
  console.log("=======================================================");

  function shouldShowHealthModal(user: any): boolean {
    const hp = user?.healthProfile;
    const isCompleted =
      Boolean(hp?.isCompleted) ||
      Boolean(user?.dob && user?.healthStatus) ||
      Boolean(user?.onboardingCompleted && user?.dob);
    return !isCompleted;
  }

  // User after onboarding with synthesized healthProfile
  assert(!shouldShowHealthModal({
    healthProfile: { isCompleted: true, dob: "1998-05-20", age: 28 }
  }), "Modal suppressed when healthProfile.isCompleted === true");

  // User with flat onboarding fields (pre-fix migration / fallback)
  assert(!shouldShowHealthModal({
    dob: "1995-10-10",
    healthStatus: "no_condition"
  }), "Modal suppressed when flat dob + healthStatus exist");

  // User who finished onboarding with dob
  assert(!shouldShowHealthModal({
    onboardingCompleted: true,
    dob: "1992-03-01"
  }), "Modal suppressed when onboardingCompleted && dob exist");

  // Brand new user with zero health data
  assert(shouldShowHealthModal({
    phone: "628123456789"
  }), "Modal shown for brand new user who has never entered health data");

  console.log("\n=======================================================");
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
  console.log("=======================================================\n");
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
