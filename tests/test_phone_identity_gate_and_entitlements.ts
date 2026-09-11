/**
 * Automated Acceptance Test Suite:
 * Phone Number Identity Gate, Upfront Entitlement Resolution, and Lifecycle Management
 * 
 * Verifies all 10 P0 Architecture Requirements:
 * 1. New Phone (0812...) -> check-phone returns exists:false -> order created -> paid -> active.
 * 2. Canonical Variation (+62812... / 62812...) -> check-phone resolves exact same userId & active status.
 * 3. User with Workout Coach buys Workout Coach -> resolves purchaseType: "renewal" -> extends expiry from current date.
 * 4. User with Workout Coach buys Nutritionist -> resolves purchaseType: "upgrade" -> grants both (premium) entitlements.
 * 5. User with Nutritionist buys Nutritionist -> resolves purchaseType: "renewal" -> extends expiry from current date.
 * 6. User with Nutritionist buys Workout Coach -> resolves purchaseType: "upgrade" -> grants both (premium) entitlements.
 * 7. User with Both buys Workout Coach -> blocked by backend with 400 ('already_included_in_both').
 * 8. User with Both buys Nutritionist -> blocked by backend with 400 ('already_included_in_both').
 * 9. User with Both buys Both -> resolves purchaseType: "renewal" -> extends expiry from current date.
 * 10. Deleted User -> check-phone returns isDeleted:true, exists:false, no auto-resurrection -> fresh onboarding succeeds cleanly.
 */

import http from "http";
import assert from "assert";
import {
  createExpressApp,
  dbData,
  saveUserProfile,
  getUserProfile,
  saveDb
} from "../server";
import {
  normalizePhoneToE164,
  normalizePhoneToLocal,
  normalizePhone
} from "../services/phoneNormalizer";
import {
  markAccountDeleted,
  isAccountDeleted,
  clearAccountDeletedTombstone,
  deleteUserDocument
} from "../services/db";
import {
  determinePurchaseType,
  applyCommercialPlan,
  getUserSubscription
} from "../services/subscriptionEngine";

function check(name: string, condition: boolean, details?: any) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${name}`);
    if (details) console.error("     Details:", details);
    throw new Error(`Assertion failed: ${name}`);
  }
  console.log(`  ✅ [PASS] ${name}`);
}

async function runTestSuite() {
  console.log("================================================================================");
  console.log("🛡️ RUNNING ACCEPTANCE TEST SUITE: PHONE IDENTITY GATE & ENTITLEMENT HARDENING");
  console.log("================================================================================\n");

  const app = await createExpressApp({ skipVite: true });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  async function req(path: string, options: { method?: string; headers?: Record<string, string>; body?: any } = {}) {
    const headers: Record<string, string> = {
      ...(options.headers || {})
    };
    if (options.body) {
      headers["Content-Type"] = "application/json";
    }
    const res = await fetch(`${baseUrl}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, body, headers: res.headers };
  }

  let passedScenarios = 0;
  const testRunId = Date.now().toString().slice(-5);

  try {
    // =========================================================================
    // SCENARIO 1: New Phone (0812...) -> check-phone -> order -> paid -> active
    // =========================================================================
    console.log("\n▶ SCENARIO 1: New Phone Registration Flow with Upfront Identity Gate");
    const s1RawPhone = `0812${testRunId}01`;
    const s1Canonical = normalizePhoneToE164(s1RawPhone);
    const s1Local = normalizePhoneToLocal(s1Canonical);
    const s1UserId = `usr_${s1Local}`;

    // Clean any residual
    await deleteUserDocument(s1Canonical);
    await deleteUserDocument(s1Local);
    delete dbData.users[s1RawPhone];
    delete dbData.users[s1Canonical];
    delete dbData.users[s1Local];
    delete dbData.users[s1UserId];

    const s1CheckRes = await req("/api/auth/check-phone", {
      method: "POST",
      body: { phone: s1RawPhone }
    });

    check("1.1 check-phone returns 200 OK", s1CheckRes.status === 200);
    check("1.2 check-phone identifies new user (exists: false)", s1CheckRes.body?.exists === false);
    check("1.3 check-phone identifies not deleted (isDeleted: false)", s1CheckRes.body?.isDeleted === false);
    check("1.4 check-phone recommends nextStep: 'onboarding'", s1CheckRes.body?.nextStep === "onboarding");
    check("1.5 check-phone canonicalizes phone to E164", s1CheckRes.body?.canonicalPhone === s1Canonical);

    // Create Order for single nutritionist
    const s1OrderRes = await req("/api/orders/create", {
      method: "POST",
      body: {
        phone: s1RawPhone,
        plan: "nutritionist",
        duration: "1_month",
        customerName: "New User One"
      }
    });

    check("1.6 order creation returns 200 OK", s1OrderRes.status === 200);
    check("1.7 order tagged as purchaseType: 'new_purchase'", s1OrderRes.body?.purchaseType === "new_purchase");
    check("1.8 order contains canonical orderId", Boolean(s1OrderRes.body?.orderId));
    const s1OrderId = s1OrderRes.body?.orderId;

    // Simulate Midtrans Payment Settlement Webhook
    const s1WebhookRes = await req("/api/midtrans/notification", {
      method: "POST",
      body: {
        order_id: s1OrderId,
        status_code: "200",
        gross_amount: "89000",
        transaction_status: "settlement",
        phone: s1Canonical,
        custom_field1: s1Canonical,
        custom_field2: "nutritionist",
        custom_field3: "nutrition:1m:new_purchase"
      }
    });

    check("1.9 midtrans webhook accepted with 200 OK", s1WebhookRes.status === 200);

    // Verify User State via check-phone
    const s1PostCheck = await req("/api/auth/check-phone", {
      method: "POST",
      body: { phone: s1RawPhone }
    });

    check("1.10 user now exists in authoritative gate", s1PostCheck.body?.exists === true);
    check("1.11 user subscription is active", s1PostCheck.body?.subscription?.isActive === true);
    check("1.12 canonical plan is 'nutritionist'", s1PostCheck.body?.subscription?.plan === "nutritionist");
    check("1.13 nutritionist entitlement is true", s1PostCheck.body?.entitlements?.nutritionist === true);
    check("1.14 workoutCoach entitlement is false", s1PostCheck.body?.entitlements?.workoutCoach === false);
    passedScenarios++;

    // =========================================================================
    // SCENARIO 2: Canonical Variation (+62812... / 62812...) -> Resolves Same Identity
    // =========================================================================
    console.log("\n▶ SCENARIO 2: Canonical Identity Normalization Across Phone Formats");
    const s2Variations = [
      s1Canonical,
      s1Canonical.replace(/^\+/, ""),
      `  ${s1RawPhone.substring(0, 4)}-${s1RawPhone.substring(4, 8)}-${s1RawPhone.substring(8)}  `
    ];

    for (const varPhone of s2Variations) {
      const varRes = await req("/api/auth/check-phone", {
        method: "POST",
        body: { phone: varPhone }
      });
      check(`2.1 variation '${varPhone}' returns exists: true`, varRes.body?.exists === true);
      check(`2.2 variation '${varPhone}' resolves to canonical userId`, varRes.body?.userId === s1PostCheck.body?.userId);
      check(`2.3 variation '${varPhone}' detects active subscription`, varRes.body?.subscription?.isActive === true);
    }
    passedScenarios++;

    // =========================================================================
    // SCENARIO 3: User with Workout Coach buys Workout Coach -> Renewal
    // =========================================================================
    console.log("\n▶ SCENARIO 3: Workout Coach Renewal (Extends Expiry from Current Date)");
    const s3Phone = `0812${testRunId}03`;
    const s3Canonical = normalizePhoneToE164(s3Phone);
    const s3Local = normalizePhoneToLocal(s3Canonical);
    const s3UserId = `usr_${s3Local}`;
    const s3InitialExpiry = new Date(Date.now() + 15 * 86400000); // 15 days left

    const s3InitialUser = {
      userId: s3UserId,
      phone: s3Canonical,
      name: "Workout Coach User",
      plan: "workout_coach",
      activeService: "coach",
      planExpiresAt: s3InitialExpiry.toISOString(),
      onboardingCompleted: true,
      subscription: {
        plan: "workout_coach",
        activeService: "coach",
        status: "active",
        expiresAt: s3InitialExpiry.toISOString()
      }
    };
    saveUserProfile(s3Canonical, s3InitialUser);
    saveUserProfile(s3Local, s3InitialUser);
    dbData.users[s3Canonical] = s3InitialUser;
    dbData.users[s3Local] = s3InitialUser;
    saveDb();

    const s3OrderRes = await req("/api/orders/create", {
      method: "POST",
      body: {
        phone: s3Canonical,
        plan: "workout_coach",
        duration: "1_month",
        isExplicitRenewal: true
      }
    });

    check("3.1 order accepted with 200 OK", s3OrderRes.status === 200);
    check("3.2 order purchaseType categorized as 'renewal'", s3OrderRes.body?.purchaseType === "renewal");

    // Execute webhook payment settlement
    const s3OrderId = s3OrderRes.body?.orderId;
    await req("/api/midtrans/notification", {
      method: "POST",
      body: {
        order_id: s3OrderId,
        status_code: "200",
        gross_amount: "89000",
        transaction_status: "settlement",
        phone: s3Canonical,
        custom_field1: s3Canonical,
        custom_field2: "workout_coach",
        custom_field3: "coach:1m:renewal"
      }
    });

    const s3PostCheck = await req("/api/auth/check-phone", {
      method: "POST",
      body: { phone: s3Canonical }
    });

    check("3.3 workout coach entitlement remains true", s3PostCheck.body?.entitlements?.workoutCoach === true);
    check("3.4 nutritionist entitlement remains false", s3PostCheck.body?.entitlements?.nutritionist === false);
    const s3NewExpiryMs = new Date(s3PostCheck.body?.subscription?.planExpiresAt).getTime();
    const s3ExpectedMinMs = s3InitialExpiry.getTime() + 29 * 86400000;
    check("3.5 expiry extended by ~30 days from previous expiry (no day loss)", s3NewExpiryMs >= s3ExpectedMinMs);
    passedScenarios++;

    // =========================================================================
    // SCENARIO 4: User with Workout Coach buys Nutritionist -> Upgrade to Both
    // =========================================================================
    console.log("\n▶ SCENARIO 4: Workout Coach Upgrades by purchasing Nutritionist -> Premium (Both)");
    const s4Phone = `0812${testRunId}04`;
    const s4Canonical = normalizePhoneToE164(s4Phone);
    const s4Local = normalizePhoneToLocal(s4Canonical);
    const s4UserId = `usr_${s4Local}`;
    const s4InitialExpiry = new Date(Date.now() + 20 * 86400000);

    const s4InitialUser = {
      userId: s4UserId,
      phone: s4Canonical,
      name: "Upgrade User 4",
      plan: "workout_coach",
      activeService: "coach",
      planExpiresAt: s4InitialExpiry.toISOString(),
      onboardingCompleted: true,
      subscription: {
        plan: "workout_coach",
        activeService: "coach",
        status: "active",
        expiresAt: s4InitialExpiry.toISOString()
      }
    };
    saveUserProfile(s4Canonical, s4InitialUser);
    saveUserProfile(s4Local, s4InitialUser);
    dbData.users[s4Canonical] = s4InitialUser;
    dbData.users[s4Local] = s4InitialUser;
    saveDb();

    const s4OrderRes = await req("/api/orders/create", {
      method: "POST",
      body: {
        phone: s4Canonical,
        plan: "nutritionist",
        duration: "1_month"
      }
    });

    check("4.1 order accepted with 200 OK", s4OrderRes.status === 200);
    check("4.2 purchaseType categorized as 'upgrade'", s4OrderRes.body?.purchaseType === "upgrade");

    // Execute webhook payment settlement
    const s4OrderId = s4OrderRes.body?.orderId;
    await req("/api/midtrans/notification", {
      method: "POST",
      body: {
        order_id: s4OrderId,
        status_code: "200",
        gross_amount: "89000",
        transaction_status: "settlement",
        phone: s4Canonical,
        custom_field1: s4Canonical,
        custom_field2: "nutritionist",
        custom_field3: "nutrition:1m:upgrade"
      }
    });

    const s4PostCheck = await req("/api/auth/check-phone", {
      method: "POST",
      body: { phone: s4Canonical }
    });

    check("4.3 plan upgraded to canonical 'premium'", s4PostCheck.body?.subscription?.plan === "premium");
    check("4.4 workout coach entitlement is granted", s4PostCheck.body?.entitlements?.workoutCoach === true);
    check("4.5 nutritionist entitlement is granted", s4PostCheck.body?.entitlements?.nutritionist === true);
    check("4.6 both entitlement is granted", s4PostCheck.body?.entitlements?.both === true);
    passedScenarios++;

    // =========================================================================
    // SCENARIO 5: User with Nutritionist buys Nutritionist -> Renewal
    // =========================================================================
    console.log("\n▶ SCENARIO 5: Nutritionist Renewal (Extends Expiry from Current Date)");
    const s5Phone = `0812${testRunId}05`;
    const s5Canonical = normalizePhoneToE164(s5Phone);
    const s5Local = normalizePhoneToLocal(s5Canonical);
    const s5UserId = `usr_${s5Local}`;
    const s5InitialExpiry = new Date(Date.now() + 18 * 86400000);

    const s5InitialUser = {
      userId: s5UserId,
      phone: s5Canonical,
      name: "Nutritionist User 5",
      plan: "nutritionist",
      activeService: "nutrition",
      planExpiresAt: s5InitialExpiry.toISOString(),
      onboardingCompleted: true,
      subscription: {
        plan: "nutritionist",
        activeService: "nutrition",
        status: "active",
        expiresAt: s5InitialExpiry.toISOString()
      }
    };
    saveUserProfile(s5Canonical, s5InitialUser);
    saveUserProfile(s5Local, s5InitialUser);
    dbData.users[s5Canonical] = s5InitialUser;
    dbData.users[s5Local] = s5InitialUser;
    saveDb();

    const s5OrderRes = await req("/api/orders/create", {
      method: "POST",
      body: {
        phone: s5Canonical,
        plan: "nutritionist",
        duration: "1_month",
        isExplicitRenewal: true
      }
    });

    check("5.1 order accepted with 200 OK", s5OrderRes.status === 200);
    check("5.2 purchaseType categorized as 'renewal'", s5OrderRes.body?.purchaseType === "renewal");

    const s5OrderId = s5OrderRes.body?.orderId;
    await req("/api/midtrans/notification", {
      method: "POST",
      body: {
        order_id: s5OrderId,
        status_code: "200",
        gross_amount: "89000",
        transaction_status: "settlement",
        phone: s5Canonical,
        custom_field1: s5Canonical,
        custom_field2: "nutritionist",
        custom_field3: "nutrition:1m:renewal"
      }
    });

    const s5PostCheck = await req("/api/auth/check-phone", {
      method: "POST",
      body: { phone: s5Canonical }
    });

    check("5.3 nutritionist entitlement is true", s5PostCheck.body?.entitlements?.nutritionist === true);
    check("5.4 workout coach entitlement is false", s5PostCheck.body?.entitlements?.workoutCoach === false);
    const s5NewExpiryMs = new Date(s5PostCheck.body?.subscription?.planExpiresAt).getTime();
    check("5.5 expiry extended by ~30 days from previous expiry", s5NewExpiryMs >= s5InitialExpiry.getTime() + 29 * 86400000);
    passedScenarios++;

    // =========================================================================
    // SCENARIO 6: User with Nutritionist buys Workout Coach -> Upgrade to Both
    // =========================================================================
    console.log("\n▶ SCENARIO 6: Nutritionist Upgrades by purchasing Workout Coach -> Premium (Both)");
    const s6Phone = `0812${testRunId}06`;
    const s6Canonical = normalizePhoneToE164(s6Phone);
    const s6Local = normalizePhoneToLocal(s6Canonical);
    const s6UserId = `usr_${s6Local}`;
    const s6InitialExpiry = new Date(Date.now() + 25 * 86400000);

    const s6InitialUser = {
      userId: s6UserId,
      phone: s6Canonical,
      name: "Upgrade User 6",
      plan: "nutritionist",
      activeService: "nutrition",
      planExpiresAt: s6InitialExpiry.toISOString(),
      onboardingCompleted: true,
      subscription: {
        plan: "nutritionist",
        activeService: "nutrition",
        status: "active",
        expiresAt: s6InitialExpiry.toISOString()
      }
    };
    saveUserProfile(s6Canonical, s6InitialUser);
    saveUserProfile(s6Local, s6InitialUser);
    dbData.users[s6Canonical] = s6InitialUser;
    dbData.users[s6Local] = s6InitialUser;
    saveDb();

    const s6OrderRes = await req("/api/orders/create", {
      method: "POST",
      body: {
        phone: s6Canonical,
        plan: "workout_coach",
        duration: "1_month"
      }
    });

    check("6.1 order accepted with 200 OK", s6OrderRes.status === 200);
    check("6.2 purchaseType categorized as 'upgrade'", s6OrderRes.body?.purchaseType === "upgrade");

    const s6OrderId = s6OrderRes.body?.orderId;
    await req("/api/midtrans/notification", {
      method: "POST",
      body: {
        order_id: s6OrderId,
        status_code: "200",
        gross_amount: "89000",
        transaction_status: "settlement",
        phone: s6Canonical,
        custom_field1: s6Canonical,
        custom_field2: "workout_coach",
        custom_field3: "coach:1m:upgrade"
      }
    });

    const s6PostCheck = await req("/api/auth/check-phone", {
      method: "POST",
      body: { phone: s6Canonical }
    });

    check("6.3 plan upgraded to canonical 'premium'", s6PostCheck.body?.subscription?.plan === "premium");
    check("6.4 workout coach entitlement granted", s6PostCheck.body?.entitlements?.workoutCoach === true);
    check("6.5 nutritionist entitlement granted", s6PostCheck.body?.entitlements?.nutritionist === true);
    check("6.6 both entitlement granted", s6PostCheck.body?.entitlements?.both === true);
    passedScenarios++;

    // =========================================================================
    // SCENARIO 7: User with Both buys Workout Coach -> Blocked (400)
    // =========================================================================
    console.log("\n▶ SCENARIO 7: User with Both Coach Plan buys Workout Coach -> 400 Blocked");
    const s7Phone = `0812${testRunId}07`;
    const s7Canonical = normalizePhoneToE164(s7Phone);
    const s7Local = normalizePhoneToLocal(s7Canonical);
    const s7UserId = `usr_${s7Local}`;

    const s7BothUser = {
      userId: s7UserId,
      phone: s7Canonical,
      name: "Both Coach User 7",
      plan: "both",
      activeService: "both",
      planExpiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      onboardingCompleted: true,
      subscription: {
        plan: "premium",
        activeService: "both",
        status: "active",
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString()
      }
    };
    saveUserProfile(s7Canonical, s7BothUser);
    saveUserProfile(s7Local, s7BothUser);
    dbData.users[s7Canonical] = s7BothUser;
    dbData.users[s7Local] = s7BothUser;
    saveDb();

    const s7OrderRes = await req("/api/orders/create", {
      method: "POST",
      body: {
        phone: s7Canonical,
        plan: "workout_coach",
        duration: "1_month"
      }
    });

    check("7.1 purchase attempt rejected with 400 Bad Request", s7OrderRes.status === 400);
    check("7.2 error code is 'already_included_in_both'", s7OrderRes.body?.error === "already_included_in_both");
    passedScenarios++;

    // =========================================================================
    // SCENARIO 8: User with Both buys Nutritionist -> Blocked (400)
    // =========================================================================
    console.log("\n▶ SCENARIO 8: User with Both Coach Plan buys Nutritionist -> 400 Blocked");
    const s8OrderRes = await req("/api/orders/create", {
      method: "POST",
      body: {
        phone: s7Canonical,
        plan: "nutritionist",
        duration: "1_month"
      }
    });

    check("8.1 purchase attempt rejected with 400 Bad Request", s8OrderRes.status === 400);
    check("8.2 error code is 'already_included_in_both'", s8OrderRes.body?.error === "already_included_in_both");
    passedScenarios++;

    // =========================================================================
    // SCENARIO 9: User with Both buys Both -> Renewal
    // =========================================================================
    console.log("\n▶ SCENARIO 9: User with Both Coach Plan buys Both -> Renewal (Extends Expiry)");
    const s9InitialExpiry = new Date(Date.now() + 10 * 86400000);
    s7BothUser.planExpiresAt = s9InitialExpiry.toISOString();
    s7BothUser.subscription.expiresAt = s9InitialExpiry.toISOString();
    saveUserProfile(s7Canonical, s7BothUser);
    dbData.users[s7Canonical] = s7BothUser;
    saveDb();

    const s9OrderRes = await req("/api/orders/create", {
      method: "POST",
      body: {
        phone: s7Canonical,
        plan: "both",
        duration: "1_month",
        isExplicitRenewal: true
      }
    });

    check("9.1 renewal order accepted with 200 OK", s9OrderRes.status === 200);
    check("9.2 purchaseType categorized as 'renewal'", s9OrderRes.body?.purchaseType === "renewal");

    const s9OrderId = s9OrderRes.body?.orderId;
    await req("/api/midtrans/notification", {
      method: "POST",
      body: {
        order_id: s9OrderId,
        status_code: "200",
        gross_amount: "149000",
        transaction_status: "settlement",
        phone: s7Canonical,
        custom_field1: s7Canonical,
        custom_field2: "both",
        custom_field3: "both:1m:renewal"
      }
    });

    const s9PostCheck = await req("/api/auth/check-phone", {
      method: "POST",
      body: { phone: s7Canonical }
    });

    check("9.3 both entitlement remains true", s9PostCheck.body?.entitlements?.both === true);
    check("9.4 nutritionist entitlement remains true", s9PostCheck.body?.entitlements?.nutritionist === true);
    check("9.5 workoutCoach entitlement remains true", s9PostCheck.body?.entitlements?.workoutCoach === true);
    const s9NewExpiryMs = new Date(s9PostCheck.body?.subscription?.planExpiresAt).getTime();
    check("9.6 expiry extended by ~30 days from previous expiry", s9NewExpiryMs >= s9InitialExpiry.getTime() + 29 * 86400000);
    passedScenarios++;

    // =========================================================================
    // SCENARIO 10: Deleted User -> check-phone -> no auto-resurrection -> fresh onboarding
    // =========================================================================
    console.log("\n▶ SCENARIO 10: Deleted User Non-Resurrection & Clean Re-Registration");
    const s10Phone = `0812${testRunId}10`;
    const s10Canonical = normalizePhoneToE164(s10Phone);
    const s10Local = normalizePhoneToLocal(s10Canonical);
    const s10UserId = `usr_${s10Local}`;

    // Mark deleted in tombstone system
    await markAccountDeleted(s10Canonical, s10UserId);
    await markAccountDeleted(s10Local, s10UserId);
    await markAccountDeleted(s10Phone, s10UserId);
    delete dbData.users[s10Canonical];
    delete dbData.users[s10Local];
    delete dbData.users[s10Phone];
    delete dbData.users[s10UserId];
    saveDb();

    // 10.1 Check Phone for Deleted User
    const s10CheckRes = await req("/api/auth/check-phone", {
      method: "POST",
      body: { phone: s10Phone }
    });

    check("10.1 check-phone returns 200 OK", s10CheckRes.status === 200);
    check("10.2 check-phone identifies isDeleted: true", s10CheckRes.body?.isDeleted === true);
    check("10.3 check-phone identifies exists: false (tombstoned)", s10CheckRes.body?.exists === false);
    check("10.4 check-phone returns subscription: null (zero auto-resurrection)", s10CheckRes.body?.subscription === null);
    check("10.5 check-phone directs to onboarding", s10CheckRes.body?.nextStep === "onboarding");

    // 10.6 Direct order creation while tombstoned is rejected
    const s10DirectOrderRes = await req("/api/orders/create", {
      method: "POST",
      body: {
        phone: s10Phone,
        plan: "both",
        duration: "1_month"
      }
    });
    check("10.6 order creation without re-registration rejected with 403 Forbidden", s10DirectOrderRes.status === 403);
    check("10.7 error code is 'account_deleted'", s10DirectOrderRes.body?.error === "account_deleted");

    // 10.8 Fresh Onboarding: Profile submission resets tombstone cleanly
    const s10ProfileRes = await req("/api/onboarding/profile", {
      method: "POST",
      body: {
        phone: s10Canonical,
        name: "Re-Registered User",
        goal: "lose",
        gender: "pria",
        weight: 75,
        targetWeight: 70,
        height: 175,
        age: 28,
        dob: "1998-01-01"
      }
    });

    check("10.8 fresh onboarding profile submitted successfully", s10ProfileRes.status === 200);

    // 10.9 New order creation now succeeds cleanly
    const s10NewOrderRes = await req("/api/orders/create", {
      method: "POST",
      body: {
        phone: s10Canonical,
        plan: "nutritionist",
        duration: "1_month"
      }
    });

    check("10.9 fresh order created successfully after re-registration", s10NewOrderRes.status === 200);
    check("10.10 fresh order categorized as 'new_purchase'", s10NewOrderRes.body?.purchaseType === "new_purchase");
    passedScenarios++;

    console.log("\n================================================================================");
    console.log(`🎉 ALL 10 ACCEPTANCE SCENARIOS PASSED WITH ZERO FAILURES! (${passedScenarios}/10)`);
    console.log("================================================================================\n");
    server.close();
    process.exit(0);
  } finally {
    server.close();
  }
}

runTestSuite().catch((err) => {
  console.error("\n❌ TEST SUITE FAILED WITH ERROR:", err);
  process.exit(1);
});
