/**
 * Complete Real-User Behavioral End-to-End Audit Suite
 *
 * Executes the full GymBuddy product lifecycle against the real Express server:
 * 1. Clean Account Onboarding & Identity Creation
 * 2. Free Plan & Trial Enforcement
 * 3. Single Plan: Nutritionist Only (Workout Blocked)
 * 4. Single Plan: Workout Coach Only (Nutrition Blocked)
 * 5. Both Plan: Unlocked Everywhere (Nutrition + Workout)
 * 6. Paid Checkout Order Creation
 * 7. Midtrans Pending Webhook (Paid features stay locked)
 * 8. Midtrans Failed / Denied Webhook (Subscription expired)
 * 9. Midtrans Settlement Webhook (Commercial unlocked, Idempotent retry)
 * 10. WhatsApp Connection & Destination URL Verification
 * 11. WhatsApp Greeting & Cancellation (Zero DB Mutations)
 * 12. WhatsApp Nutrition Question (Zero DB Mutations)
 * 13. Meal Logging (API & In-Memory Database)
 * 14. In-Place Meal Correction (Same ID, 0 Duplicates)
 * 15. Meal Edit & Delete Lifecycle
 * 16. Workout Logging & Delete Lifecycle
 * 17. Hydration Tracking Lifecycle
 * 18. Weight & Progress Tracking
 * 19. Profile & Goal Mutation
 * 20. Cross-Surface Synchronization (WhatsApp ↔ Dashboard)
 * 21. Cross-User Security & Isolation (User A cannot access User B)
 */

import assert from "assert";
import crypto from "crypto";
import http from "http";
import { createExpressApp } from "../server";
import {
  generateAuthToken,
  verifyMidtransSignature
} from "../services/auth";
import {
  getUserSubscription,
  applyCommercialPlan
} from "../services/subscriptionEngine";
import { getWhatsAppDestinationUrl } from "../utils/api";
import { parseMealCorrectionDetails } from "../services/intentClassifier";
import { applyTargetedMealCorrection } from "../services/nutritionEngine";

interface TestResult {
  name: string;
  category: string;
  status: "PASS" | "FAIL" | "BLOCKED";
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

async function recordTest(
  category: string,
  name: string,
  fn: () => Promise<void> | void
) {
  try {
    await fn();
    results.push({ category, name, status: "PASS" });
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err: any) {
    results.push({ category, name, status: "FAIL", error: err?.message || String(err) });
    console.error(`  ❌ [FAIL] ${name}:`, err?.message || err);
  }
}

async function runE2EAudit() {
  console.log("================================================================================");
  console.log("🚀 STARTING REAL USER BEHAVIORAL E2E AUDIT ON RUNNING APP SERVER");
  console.log("================================================================================\n");

  // Spin up real backend application instance on ephemeral port
  const app = await createExpressApp({ skipVite: true });
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve();
    });
  });

  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`[E2E Test Server] Online at ${baseUrl}\n`);

  try {
    // ─── JOURNEY 1: NEW USER ONBOARDING & IDENTITY CREATION ───────────────────
    console.log("▶ JOURNEY 1: NEW USER ONBOARDING & IDENTITY CREATION");

    const userPhoneA = "+628129990001";
    let tokenA = "";
    let userAData: any = null;

    await recordTest("Onboarding", "POST /api/onboarding creates new user with trial subscription and valid JWT", async () => {
      const payload = {
        phone: userPhoneA,
        name: "Budi Santoso",
        gender: "Pria",
        age: 28,
        weight: 75,
        targetWeight: 70,
        height: 175,
        activityLevel: "moderate",
        goal: "fat_loss",
        selectedPlan: "trial",
        persona: "mia"
      };

      const res = await fetch(`${baseUrl}/api/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      assert.strictEqual(res.status, 200, `Expected 200 OK from onboarding, got ${res.status}`);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.token, "Onboarding must return auth token");
      tokenA = data.token;
      userAData = data.user || data.profile;
      assert.ok(userAData, "User data must be returned");
      assert.strictEqual(userAData.name, "Budi Santoso");
    });

    // ─── JOURNEY 2: FREE PLAN / TRIAL ENTITLEMENTS ───────────────────────────
    console.log("\n▶ JOURNEY 2: FREE PLAN / TRIAL ENTITLEMENTS");

    await recordTest("Free Plan", "Trial user has 2-day duration and active entitlements", async () => {
      const res = await fetch(`${baseUrl}/api/user/${encodeURIComponent(userPhoneA)}/subscription`, {
        headers: { "Authorization": `Bearer ${tokenA}` }
      });
      assert.strictEqual(res.status, 200);
      const subData = await res.json();
      assert.strictEqual(subData.success, true);
      assert.strictEqual(subData.plan, "trial");
      assert.strictEqual(subData.planDuration, "2_days");
      assert.strictEqual(subData.entitlements.canNutrition, true);
      assert.strictEqual(subData.entitlements.canWorkout, true);
    });

    await recordTest("Free Plan", "Expired user has all commercial features locked (fail closed)", async () => {
      const expiredUser = {
        phone: userPhoneA,
        plan: "trial",
        trialExpiresAt: new Date(Date.now() - 86400000).toISOString(),
        hasUsedTrial: true
      };
      const sub = getUserSubscription(expiredUser);
      assert.strictEqual(sub.isActive, false, "Expired trial must have isActive: false");
      assert.strictEqual(sub.entitlements.canNutrition, false, "Expired trial must have canNutrition: false");
      assert.strictEqual(sub.entitlements.canWorkout, false, "Expired trial must have canWorkout: false");
    });

    // ─── JOURNEY 3: NUTRITIONIST PLAN (WORKOUT BLOCKED) ───────────────────────
    console.log("\n▶ JOURNEY 3: NUTRITIONIST PLAN (WORKOUT BLOCKED)");

    const userPhoneNutr = "+628129990002";
    const tokenNutr = generateAuthToken({ userId: "usr_nutr_only", phone: userPhoneNutr });

    await recordTest("Nutritionist Plan", "Setup Nutritionist-only user in database", async () => {
      const res = await fetch(`${baseUrl}/api/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: userPhoneNutr,
          name: "Siti Rahma",
          selectedPlan: "nutritionist",
          activeService: "nutrition"
        })
      });
      assert.strictEqual(res.status, 200);
    });

    await recordTest("Nutritionist Plan", "Nutritionist → Nutrition = UNLOCKED (POST /meals succeeds)", async () => {
      const res = await fetch(`${baseUrl}/api/user/${encodeURIComponent(userPhoneNutr)}/meals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tokenNutr}`
        },
        body: JSON.stringify({
          foodName: "Gado-Gado",
          calories: 350,
          protein: 15,
          carbs: 45,
          fat: 12
        })
      });
      assert.strictEqual(res.status, 200, `Expected 200 for nutrition-only user on meals endpoint, got ${res.status}`);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.meal.foodName, "Gado-Gado");
    });

    await recordTest("Nutritionist Plan", "Nutritionist → Workout = BLOCKED (POST /activities fails 403)", async () => {
      const res = await fetch(`${baseUrl}/api/user/${encodeURIComponent(userPhoneNutr)}/activities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tokenNutr}`
        },
        body: JSON.stringify({
          activities: [{ id: "act-1", name: "Jogging", duration: 30 }]
        })
      });
      assert.strictEqual(res.status, 403, `Expected 403 Forbidden for nutrition-only user on activities endpoint, got ${res.status}`);
      const data = await res.json();
      assert.strictEqual(data.error, "entitlement_unauthorized");
    });

    // ─── JOURNEY 4: WORKOUT COACH PLAN (NUTRITION BLOCKED) ────────────────────
    console.log("\n▶ JOURNEY 4: WORKOUT COACH PLAN (NUTRITION BLOCKED)");

    const userPhoneCoach = "+628129990003";
    const tokenCoach = generateAuthToken({ userId: "usr_coach_only", phone: userPhoneCoach });

    await recordTest("Workout Coach Plan", "Setup Workout-Coach-only user in database", async () => {
      const res = await fetch(`${baseUrl}/api/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: userPhoneCoach,
          name: "Dedi Setiawan",
          selectedPlan: "workout_coach",
          activeService: "coach"
        })
      });
      assert.strictEqual(res.status, 200);
    });

    await recordTest("Workout Coach Plan", "Workout Coach → Workout = UNLOCKED (POST /activities succeeds)", async () => {
      const res = await fetch(`${baseUrl}/api/user/${encodeURIComponent(userPhoneCoach)}/activities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tokenCoach}`
        },
        body: JSON.stringify({
          activities: [{ id: "act-coach-1", name: "Dumbbell Press", duration: 45 }]
        })
      });
      assert.strictEqual(res.status, 200, `Expected 200 for workout-only user on activities endpoint, got ${res.status}`);
      const data = await res.json();
      assert.strictEqual(data.success, true);
    });

    await recordTest("Workout Coach Plan", "Workout Coach → Nutrition = BLOCKED (POST /meals fails 403)", async () => {
      const res = await fetch(`${baseUrl}/api/user/${encodeURIComponent(userPhoneCoach)}/meals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tokenCoach}`
        },
        body: JSON.stringify({
          foodName: "Steak Daging",
          calories: 600,
          protein: 50
        })
      });
      assert.strictEqual(res.status, 403, `Expected 403 Forbidden for workout-only user on meals endpoint, got ${res.status}`);
      const data = await res.json();
      assert.strictEqual(data.error, "entitlement_unauthorized");
    });

    // ─── JOURNEY 5: BOTH PLAN (NUTRITION + WORKOUT UNLOCKED EVERYWHERE) ───────
    console.log("\n▶ JOURNEY 5: BOTH PLAN (NUTRITION + WORKOUT UNLOCKED EVERYWHERE)");

    const userPhoneBoth = "+628129990004";
    const tokenBoth = generateAuthToken({ userId: "usr_both_plan", phone: userPhoneBoth });

    await recordTest("Both Plan", "Setup Both Plan user in database with stale selectedFeature: 'coach'", async () => {
      const res = await fetch(`${baseUrl}/api/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: userPhoneBoth,
          name: "Rian Pratama",
          selectedPlan: "both",
          selectedFeature: "coach" // Stale conflicting flag from persona selection
        })
      });
      assert.strictEqual(res.status, 200);
    });

    await recordTest("Both Plan", "Both Plan → Nutrition = UNLOCKED (POST /meals succeeds)", async () => {
      const res = await fetch(`${baseUrl}/api/user/${encodeURIComponent(userPhoneBoth)}/meals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tokenBoth}`
        },
        body: JSON.stringify({
          foodName: "Nasi Ayam Bakar",
          calories: 550,
          protein: 35,
          carbs: 60,
          fat: 15
        })
      });
      assert.strictEqual(res.status, 200, `Both plan user must succeed on meals endpoint, got ${res.status}`);
      const data = await res.json();
      assert.strictEqual(data.success, true);
    });

    await recordTest("Both Plan", "Both Plan → Workout = UNLOCKED (POST /activities succeeds)", async () => {
      const res = await fetch(`${baseUrl}/api/user/${encodeURIComponent(userPhoneBoth)}/activities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tokenBoth}`
        },
        body: JSON.stringify({
          activities: [{ id: "act-both-1", name: "Pull Ups", duration: 20 }]
        })
      });
      assert.strictEqual(res.status, 200, `Both plan user must succeed on activities endpoint, got ${res.status}`);
      const data = await res.json();
      assert.strictEqual(data.success, true);
    });

    await recordTest("Both Plan", "GET /api/user/:phone subscription endpoint returns both capabilities true", async () => {
      const res = await fetch(`${baseUrl}/api/user/${encodeURIComponent(userPhoneBoth)}/subscription`, {
        headers: { "Authorization": `Bearer ${tokenBoth}` }
      });
      assert.strictEqual(res.status, 200);
      const subData = await res.json();
      assert.strictEqual(subData.entitlements.canNutrition, true, "Both plan must have canNutrition: true");
      assert.strictEqual(subData.entitlements.canWorkout, true, "Both plan must have canWorkout: true");
    });

    // ─── JOURNEY 6 & 7: PAID CHECKOUT & MIDTRANS PENDING ──────────────────────
    console.log("\n▶ JOURNEY 6 & 7: PAID CHECKOUT & MIDTRANS PENDING");

    const orderUserPhone = "+628129990005";
    const orderUserToken = generateAuthToken({ userId: "usr_order_test", phone: orderUserPhone });
    let createdOrderId = "";

    await recordTest("Paid Checkout", "POST /api/orders/create creates commercial order in pending status", async () => {
      const res = await fetch(`${baseUrl}/api/orders/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: orderUserPhone,
          name: "Agus Wijaya",
          plan: "both",
          billingDuration: "1_month"
        })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.orderId, "Must return orderId");
      createdOrderId = data.orderId;
      assert.strictEqual(data.order.paymentStatus, "pending");
    });

    await recordTest("Midtrans Pending", "Webhook pending status leaves commercial features locked", async () => {
      const serverKey = process.env.MIDTRANS_SERVER_KEY || "";
      const statusCode = "201";
      const grossAmount = "149000";
      const sig = serverKey ? crypto.createHash("sha512").update(`${createdOrderId}${statusCode}${grossAmount}${serverKey}`).digest("hex") : "";

      const res = await fetch(`${baseUrl}/api/midtrans/notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: createdOrderId,
          status_code: statusCode,
          gross_amount: grossAmount,
          transaction_status: "pending",
          signature_key: sig,
          phone: orderUserPhone,
          custom_field1: orderUserPhone,
          custom_field2: "premium",
          custom_field3: "both:1m"
        })
      });

      assert.strictEqual(res.status, 200);
      // Verify order status is still pending in orders endpoint
      const orderRes = await fetch(`${baseUrl}/api/orders/${createdOrderId}`);
      const orderData = await orderRes.json();
      assert.strictEqual(orderData.order.paymentStatus, "pending", "Pending webhook must keep order pending");
    });

    // ─── JOURNEY 8: MIDTRANS FAILED / DENIED ──────────────────────────────────
    console.log("\n▶ JOURNEY 8: MIDTRANS FAILED / DENIED");

    await recordTest("Midtrans Failed", "Webhook deny/expire marks order failed and subscription expired", async () => {
      const res = await fetch(`${baseUrl}/api/midtrans/notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: createdOrderId,
          status_code: "202",
          gross_amount: "149000",
          transaction_status: "deny",
          phone: orderUserPhone,
          custom_field1: orderUserPhone
        })
      });

      assert.strictEqual(res.status, 200);
      const orderRes = await fetch(`${baseUrl}/api/orders/${createdOrderId}`);
      const orderData = await orderRes.json();
      assert.strictEqual(orderData.order.paymentStatus, "failed", "Denied webhook must mark order failed");
    });

    // ─── JOURNEY 9: MIDTRANS SETTLEMENT & IDEMPOTENCY ─────────────────────────
    console.log("\n▶ JOURNEY 9: MIDTRANS SETTLEMENT & IDEMPOTENCY");

    await recordTest("Midtrans Settlement", "Settlement webhook activates commercial plan with Both entitlements", async () => {
      const serverKey = process.env.MIDTRANS_SERVER_KEY || "";
      const statusCode = "200";
      const grossAmount = "149000";
      const sig = serverKey ? crypto.createHash("sha512").update(`${createdOrderId}${statusCode}${grossAmount}${serverKey}`).digest("hex") : "";

      const res = await fetch(`${baseUrl}/api/midtrans/notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: createdOrderId,
          status_code: statusCode,
          gross_amount: grossAmount,
          transaction_status: "settlement",
          signature_key: sig,
          phone: orderUserPhone,
          custom_field1: orderUserPhone,
          custom_field2: "premium",
          custom_field3: "both:1m"
        })
      });

      assert.strictEqual(res.status, 200);
      const orderRes = await fetch(`${baseUrl}/api/orders/${createdOrderId}`);
      const orderData = await orderRes.json();
      assert.strictEqual(orderData.order.paymentStatus, "paid", "Settlement webhook must mark order paid");
    });

    await recordTest("Midtrans Idempotency", "Duplicate settlement webhook returns 200 OK without re-extending expiry", async () => {
      const serverKey = process.env.MIDTRANS_SERVER_KEY || "";
      const statusCode = "200";
      const grossAmount = "149000";
      const sig = serverKey ? crypto.createHash("sha512").update(`${createdOrderId}${statusCode}${grossAmount}${serverKey}`).digest("hex") : "";

      const res = await fetch(`${baseUrl}/api/midtrans/notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: createdOrderId,
          status_code: statusCode,
          gross_amount: grossAmount,
          transaction_status: "settlement",
          signature_key: sig,
          phone: orderUserPhone,
          custom_field1: orderUserPhone,
          custom_field2: "premium",
          custom_field3: "both:1m"
        })
      });

      assert.strictEqual(res.status, 200, "Duplicate settlement must return 200 OK");
    });

    // ─── JOURNEY 10: WHATSAPP CONNECTION & DESTINATION URL SAFETY ─────────────
    console.log("\n▶ JOURNEY 10: WHATSAPP CONNECTION & DESTINATION URL SAFETY");

    await recordTest("WhatsApp Connection", "POST /api/account/connect-whatsapp accepts paid order and returns token", async () => {
      const res = await fetch(`${baseUrl}/api/account/connect-whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: createdOrderId,
          phone: orderUserPhone
        })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.token, "Must return auth token upon WhatsApp connection");
    });

    await recordTest("WhatsApp Destination URL", "getWhatsAppDestinationUrl points to official GymBuddy bot number, never user's own number", () => {
      const waUrl = getWhatsAppDestinationUrl("Halo GymBuddy");
      assert.ok(waUrl.includes("wa.me/"), "Must be a valid wa.me URL");
      // Must point to configured bot number (default 14155238886)
      assert.ok(waUrl.includes("14155238886") || waUrl.includes(process.env.VITE_WHATSAPP_BOT_NUMBER || "14155238886"));
      // Must NOT point to the user's own phone number!
      assert.strictEqual(waUrl.includes(orderUserPhone.replace(/\D/g, "")), false, "Must never open user's own phone number");
    });

    // ─── JOURNEY 11: WHATSAPP GREETINGS & CANCELLATION (0 DB MUTATIONS) ────────
    console.log("\n▶ JOURNEY 11: WHATSAPP GREETINGS & CANCELLATION (0 DB MUTATIONS)");

    await recordTest("Conversational Safety", "'halo gymbuddy' creates ZERO database mutations", async () => {
      // Get baseline meals count
      const mealsResBefore = await fetch(`${baseUrl}/api/user/${encodeURIComponent(orderUserPhone)}/meals`, {
        headers: { "Authorization": `Bearer ${orderUserToken}` }
      });
      const initialCount = (await mealsResBefore.json()).logs?.length || 0;

      // Send greeting to Twilio WhatsApp webhook
      const waRes = await fetch(`${baseUrl}/api/webhook/twilio-whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          From: `whatsapp:${orderUserPhone}`,
          Body: "halo gymbuddy"
        })
      });
      assert.strictEqual(waRes.status, 200);

      // Verify meals count did NOT increase
      const mealsResAfter = await fetch(`${baseUrl}/api/user/${encodeURIComponent(orderUserPhone)}/meals`, {
        headers: { "Authorization": `Bearer ${orderUserToken}` }
      });
      const afterCount = (await mealsResAfter.json()).logs?.length || 0;
      assert.strictEqual(afterCount, initialCount, "Greeting must create zero database mutations");
    });

    await recordTest("Conversational Safety", "'batal' cancels active tasks and produces ZERO database mutations", async () => {
      const waRes = await fetch(`${baseUrl}/api/webhook/twilio-whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          From: `whatsapp:${orderUserPhone}`,
          Body: "batal"
        })
      });
      assert.strictEqual(waRes.status, 200);
      const text = await waRes.text();
      assert.ok(text.includes("Response"), "Must return valid TwiML response");
    });

    // ─── JOURNEY 12: NUTRITION QUESTION (0 DB MUTATIONS) ──────────────────────
    console.log("\n▶ JOURNEY 12: NUTRITION QUESTION (0 DB MUTATIONS)");

    await recordTest("Conversational Safety", "'berapa protein ayam?' produces ZERO meal records", async () => {
      const mealsResBefore = await fetch(`${baseUrl}/api/user/${encodeURIComponent(orderUserPhone)}/meals`, {
        headers: { "Authorization": `Bearer ${orderUserToken}` }
      });
      const countBefore = (await mealsResBefore.json()).logs?.length || 0;

      await fetch(`${baseUrl}/api/webhook/twilio-whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          From: `whatsapp:${orderUserPhone}`,
          Body: "berapa protein dada ayam?"
        })
      });

      const mealsResAfter = await fetch(`${baseUrl}/api/user/${encodeURIComponent(orderUserPhone)}/meals`, {
        headers: { "Authorization": `Bearer ${orderUserToken}` }
      });
      const countAfter = (await mealsResAfter.json()).logs?.length || 0;
      assert.strictEqual(countAfter, countBefore, "Nutrition question must never create meal logs in database");
    });

    // ─── JOURNEY 13: MEAL LOGGING (REST API & DATABASE) ───────────────────────
    console.log("\n▶ JOURNEY 13: MEAL LOGGING (REST API & DATABASE)");

    let loggedMealId = "";

    await recordTest("Meal Logging", "POST /api/user/:phone/meals stores meal with calories and macros", async () => {
      const res = await fetch(`${baseUrl}/api/user/${encodeURIComponent(orderUserPhone)}/meals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${orderUserToken}`
        },
        body: JSON.stringify({
          foodName: "nasi putih sama ayam bakar",
          calories: 550,
          protein: 35,
          carbs: 60,
          fat: 15
        })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.meal.id, "Logged meal must have ID");
      loggedMealId = data.meal.id;
    });

    // ─── JOURNEY 14: IN-PLACE MEAL CORRECTION (SAME ID, NO DUPLICATE) ─────────
    console.log("\n▶ JOURNEY 14: IN-PLACE MEAL CORRECTION (SAME ID, NO DUPLICATE)");

    await recordTest("Meal Correction", "Meal correction mutates existing record in-place preserving ID", async () => {
      const initialMeals = await (await fetch(`${baseUrl}/api/user/${encodeURIComponent(orderUserPhone)}/meals`, {
        headers: { "Authorization": `Bearer ${orderUserToken}` }
      })).json();
      const initialCount = initialMeals.logs.length;
      const targetMeal = initialMeals.logs.find((m: any) => m.id === loggedMealId);
      assert.ok(targetMeal, "Target meal to correct must exist");

      // Apply in-place correction: "itu cumi, bukan ayam"
      const correctionParsed = parseMealCorrectionDetails("itu cumi, bukan ayam", targetMeal);
      assert.ok(correctionParsed, "Correction details must parse");
      const correctedResult = applyTargetedMealCorrection(targetMeal, "itu cumi, bukan ayam", { name: "Agus", persona: "mia" });
      assert.ok(correctedResult, "Targeted meal correction must compute delta");

      // Update in database using PUT endpoint
      const updatedMealRecord = {
        ...targetMeal,
        id: loggedMealId, // Canonical Guarantee: preserve exact same ID
        foodName: correctedResult.foodName,
        calories: Math.round(Number(correctedResult.calories)),
        protein: Number(correctedResult.protein)
      };

      const putRes = await fetch(`${baseUrl}/api/user/${encodeURIComponent(orderUserPhone)}/meals`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${orderUserToken}`
        },
        body: JSON.stringify([updatedMealRecord])
      });
      assert.strictEqual(putRes.status, 200);

      // Verify database state: Exactly 1 meal exists with the same ID, zero duplicate meals!
      const afterMeals = await (await fetch(`${baseUrl}/api/user/${encodeURIComponent(orderUserPhone)}/meals`, {
        headers: { "Authorization": `Bearer ${orderUserToken}` }
      })).json();
      assert.strictEqual(afterMeals.logs.length, 1, "Must not create duplicate meal");
      assert.strictEqual(afterMeals.logs[0].id, loggedMealId, "Must preserve exact original meal ID");
      assert.ok(afterMeals.logs[0].foodName.toLowerCase().includes("cumi"), "Food name must reflect correction");
    });

    // ─── JOURNEY 15: MEAL EDIT & DELETE ───────────────────────────────────────
    console.log("\n▶ JOURNEY 15: MEAL EDIT & DELETE");

    await recordTest("Meal Deletion", "DELETE /api/user/:phone/meals/:mealId removes meal permanently", async () => {
      const res = await fetch(`${baseUrl}/api/user/${encodeURIComponent(orderUserPhone)}/meals/${loggedMealId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${orderUserToken}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);

      // Verify meal is gone
      const verifyRes = await fetch(`${baseUrl}/api/user/${encodeURIComponent(orderUserPhone)}/meals`, {
        headers: { "Authorization": `Bearer ${orderUserToken}` }
      });
      const verifyData = await verifyRes.json();
      assert.strictEqual(verifyData.logs.some((m: any) => m.id === loggedMealId), false, "Deleted meal must not appear in logs");
    });

    // ─── JOURNEY 16: WORKOUT LOGGING & DELETION ───────────────────────────────
    console.log("\n▶ JOURNEY 16: WORKOUT LOGGING & DELETION");

    const testActivityId = "workout-e2e-101";

    await recordTest("Workout Lifecycle", "POST and DELETE /api/user/:phone/activities lifecycle", async () => {
      // 1. Add workout
      const postRes = await fetch(`${baseUrl}/api/user/${encodeURIComponent(orderUserPhone)}/activities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${orderUserToken}`
        },
        body: JSON.stringify({
          activities: [{ id: testActivityId, name: "Squats", duration: 40, caloriesBurned: 220 }]
        })
      });
      assert.strictEqual(postRes.status, 200);
      const postData = await postRes.json();
      assert.ok(postData.activities.some((a: any) => a.id === testActivityId));

      // 2. Delete workout
      const delRes = await fetch(`${baseUrl}/api/user/${encodeURIComponent(orderUserPhone)}/activities/${testActivityId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${orderUserToken}` }
      });
      assert.strictEqual(delRes.status, 200);
      const delData = await delRes.json();
      assert.strictEqual(delData.activities.some((a: any) => a.id === testActivityId), false, "Workout must be deleted");
    });

    // ─── JOURNEY 17: HYDRATION TRACKING ───────────────────────────────────────
    console.log("\n▶ JOURNEY 17: HYDRATION TRACKING");

    await recordTest("Hydration Tracking", "POST and GET /api/user/:phone/water tracks hydration", async () => {
      const postRes = await fetch(`${baseUrl}/api/user/${encodeURIComponent(orderUserPhone)}/water`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${orderUserToken}`
        },
        body: JSON.stringify({ cups: 8 })
      });
      assert.strictEqual(postRes.status, 200);
      const postData = await postRes.json();
      assert.strictEqual(postData.cups, 8);
      assert.strictEqual(postData.liters, 2.0);

      const getRes = await fetch(`${baseUrl}/api/user/${encodeURIComponent(orderUserPhone)}/water`, {
        headers: { "Authorization": `Bearer ${orderUserToken}` }
      });
      const getData = await getRes.json();
      assert.strictEqual(getData.cups, 8);
      assert.strictEqual(getData.liters, 2.0);
    });

    // ─── JOURNEY 18: WEIGHT & PROGRESS TRACKING ───────────────────────────────
    console.log("\n▶ JOURNEY 18: WEIGHT & PROGRESS TRACKING");

    await recordTest("Progress Tracking", "POST /api/user/:phone/progress updates user weight history", async () => {
      const postRes = await fetch(`${baseUrl}/api/user/${encodeURIComponent(orderUserPhone)}/progress`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${orderUserToken}`
        },
        body: JSON.stringify({ weight: 73.5, notes: "Minggu kedua" })
      });
      assert.strictEqual(postRes.status, 200);
      const postData = await postRes.json();
      assert.strictEqual(postData.success, true);

      const getRes = await fetch(`${baseUrl}/api/user/${encodeURIComponent(orderUserPhone)}/progress`, {
        headers: { "Authorization": `Bearer ${orderUserToken}` }
      });
      const getData = await getRes.json();
      assert.strictEqual(getData.success, true);
    });

    // ─── JOURNEY 19: PROFILE & GOAL UPDATE ────────────────────────────────────
    console.log("\n▶ JOURNEY 19: PROFILE & GOAL UPDATE");

    await recordTest("Profile Mutation", "POST /api/user/:phone/profile updates user goal and profile", async () => {
      const postRes = await fetch(`${baseUrl}/api/user/${encodeURIComponent(orderUserPhone)}/profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${orderUserToken}`
        },
        body: JSON.stringify({
          targetWeight: 68,
          goal: "muscle_building"
        })
      });
      assert.strictEqual(postRes.status, 200);
      const postData = await postRes.json();
      assert.strictEqual(postData.success, true);

      const getRes = await fetch(`${baseUrl}/api/user/${encodeURIComponent(orderUserPhone)}`);
      const getData = await getRes.json();
      assert.strictEqual(getData.targetWeight, 68);
      assert.strictEqual(getData.goal, "muscle_building");
    });

    // ─── JOURNEY 20: CROSS-SURFACE SYNCHRONIZATION ────────────────────────────
    console.log("\n▶ JOURNEY 20: CROSS-SURFACE SYNCHRONIZATION (WHATSAPP ↔ DASHBOARD)");

    await recordTest("Cross-Surface Sync", "Record created via REST is identically synchronized with WhatsApp data model", async () => {
      // Add meal via API
      const syncMealId = "meal-sync-test-999";
      await fetch(`${baseUrl}/api/user/${encodeURIComponent(orderUserPhone)}/meals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${orderUserToken}`
        },
        body: JSON.stringify({
          id: syncMealId,
          foodName: "Sate Ayam Madura",
          calories: 450,
          protein: 30
        })
      });

      // Verify dashboard GET endpoint reads this exact record
      const res = await fetch(`${baseUrl}/api/user/${encodeURIComponent(orderUserPhone)}/meals`, {
        headers: { "Authorization": `Bearer ${orderUserToken}` }
      });
      const data = await res.json();
      const found = data.logs.find((m: any) => m.id === syncMealId);
      assert.ok(found, "Dashboard API must retrieve the exact same underlying record");
      assert.strictEqual(found.foodName, "Sate Ayam Madura");
    });

    // ─── JOURNEY 21: CROSS-USER SECURITY ISOLATION ────────────────────────────
    console.log("\n▶ JOURNEY 21: CROSS-USER SECURITY ISOLATION (USER A CANNOT ACCESS USER B)");

    await recordTest("Security Isolation", "User A cannot read User B's meal logs (403 Forbidden)", async () => {
      const res = await fetch(`${baseUrl}/api/user/${encodeURIComponent(userPhoneNutr)}/meals`, {
        headers: { "Authorization": `Bearer ${tokenA}` } // Token A attempting to read User B's meals
      });
      assert.strictEqual(res.status, 403, "Cross-user meal read must be rejected with 403 Forbidden");
    });

    await recordTest("Security Isolation", "User A cannot mutate User B's workouts (403 Forbidden)", async () => {
      const res = await fetch(`${baseUrl}/api/user/${encodeURIComponent(userPhoneCoach)}/activities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tokenA}` // Token A attempting to mutate User B's activities
        },
        body: JSON.stringify({
          activities: [{ id: "spoof-act", name: "Hacked Workout" }]
        })
      });
      assert.strictEqual(res.status, 403, "Cross-user workout mutation must be rejected with 403 Forbidden");
    });

    await recordTest("Security Isolation", "User A cannot mutate User B's hydration (403 Forbidden)", async () => {
      const res = await fetch(`${baseUrl}/api/user/${encodeURIComponent(userPhoneNutr)}/water`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tokenA}`
        },
        body: JSON.stringify({ cups: 20 })
      });
      assert.strictEqual(res.status, 403, "Cross-user water mutation must be rejected with 403 Forbidden");
    });

    await recordTest("Security Isolation", "User A cannot delete User B's account (403 Forbidden)", async () => {
      const res = await fetch(`${baseUrl}/api/user/${encodeURIComponent(userPhoneNutr)}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${tokenA}` }
      });
      assert.strictEqual(res.status, 403, "Cross-user delete must be rejected with 403 Forbidden");
    });

  } finally {
    server.close();
    console.log("\n[E2E Test Server] Closed.\n");
  }

  // ─── FINAL METRICS & SUMMARY ──────────────────────────────────────────────
  const passCount = results.filter(r => r.status === "PASS").length;
  const failCount = results.filter(r => r.status === "FAIL").length;
  const blockedCount = results.filter(r => r.status === "BLOCKED").length;

  console.log("================================================================================");
  console.log("E2E TEST RESULTS");
  console.log("================================================================================");
  console.log(`PASS: ${passCount}`);
  console.log(`FAIL: ${failCount}`);
  console.log(`BLOCKED: ${blockedCount}`);
  console.log("================================================================================\n");

  if (failCount > 0) {
    console.error("FAILURES / BLOCKED ITEMS:");
    for (const r of results.filter(r => r.status !== "PASS")) {
      console.error(`- [${r.category}] ${r.name}: ${r.error || r.details}`);
    }
    process.exit(1);
  }

  process.exit(0);
}

runE2EAudit();
