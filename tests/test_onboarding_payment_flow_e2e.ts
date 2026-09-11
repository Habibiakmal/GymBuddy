import assert from "assert";
import axios from "axios";
import { normalizePhoneToE164, normalizePhoneToLocal } from "../services/phoneNormalizer";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

async function runE2ETests() {
  console.log("================================================================================");
  console.log("🚀 STARTING E2E TEST: ONBOARDING, PLAN SELECTION, MIDTRANS & WHATSAPP FLOW");
  console.log(`Targeting Server: ${BASE_URL}`);
  console.log("================================================================================\n");

  const testPhoneFree = `+62812${Math.floor(10000000 + Math.random() * 90000000)}`;
  const testPhoneSingle = `+62813${Math.floor(10000000 + Math.random() * 90000000)}`;
  const testPhoneBoth = `+62814${Math.floor(10000000 + Math.random() * 90000000)}`;

  // ============================================================================
  // TEST SCENARIO 1: FREE PLAN ONBOARDING & ACTIVATION
  // ============================================================================
  console.log("--- TEST SCENARIO 1: FREE PLAN FLOW ---");
  console.log("1.1 Submitting complete onboarding profile without phone...");

  const freeProfilePayload = {
    name: "Budi Santoso",
    goal: "lose",
    goalTitle: "Defisit Kalori & Turun BB",
    goalEvent: "target_year",
    goalSecondary: ["belly_fat"],
    emotionalVision: "confidence",
    gender: "pria",
    weight: 80,
    startWeight: 80,
    targetWeight: 72,
    aiRecommendedTargetWeight: 70,
    height: 175,
    age: 26,
    dob: "1998-05-12",
    activityLevel: "moderate",
    challenges: ["gorengan", "malam"],
    injuries: ["lower_back"],
    allergies: ["udang", "kacang"],
    commitmentLevel: "medium",
    persona: "max",
    targetCalories: 1850,
    dailyTargetCalories: 1850,
    targetProtein: 139,
    targetCarbs: 208,
    targetFat: 51
  };

  const profileRes1 = await axios.post(`${BASE_URL}/api/onboarding/profile`, freeProfilePayload);
  assert.strictEqual(profileRes1.status, 200, "Profile endpoint must return 200");
  assert.ok(profileRes1.data.userId, "Profile must return a userId");
  assert.strictEqual(profileRes1.data.userState, "onboarding_complete", "State must be onboarding_complete");
  const freeUserId = profileRes1.data.userId;
  console.log(`✅ Profile saved successfully with userId: ${freeUserId}`);

  console.log("1.2 Creating Order for Free Trial (Rp 0)...");
  const orderRes1 = await axios.post(`${BASE_URL}/api/orders/create`, {
    userId: freeUserId,
    plan: "free_trial",
    feature: null
  });
  assert.strictEqual(orderRes1.status, 200, "Order create must return 200");
  assert.strictEqual(orderRes1.data.order.amount, 0, "Free plan amount must be 0");
  assert.strictEqual(orderRes1.data.order.status, "paid", "Free plan order status is immediately paid");
  assert.strictEqual(orderRes1.data.order.userState, "plan_selected", "State must be plan_selected");
  const freeOrderId = orderRes1.data.order.orderId;
  console.log(`✅ Free order created: ${freeOrderId}, amount: Rp ${orderRes1.data.order.amount}`);

  console.log(`1.3 Connecting WhatsApp (${testPhoneFree}) to activate Free Trial...`);
  const connectRes1 = await axios.post(`${BASE_URL}/api/account/connect-whatsapp`, {
    userId: freeUserId,
    orderId: freeOrderId,
    phone: testPhoneFree
  });
  assert.strictEqual(connectRes1.status, 200, "Connect WhatsApp must return 200");
  assert.ok(connectRes1.data.token, "Must return JWT session token");
  assert.strictEqual(connectRes1.data.user.phone, normalizePhoneToE164(testPhoneFree), "Phone must be normalized E164");
  assert.strictEqual(connectRes1.data.user.subscription.status, "trial", "Subscription status must be trial");
  assert.strictEqual(connectRes1.data.user.userState, "active", "User state must be active");
  assert.strictEqual(connectRes1.data.user.name, "Budi Santoso", "User name must match onboarding");
  assert.deepStrictEqual(connectRes1.data.user.injuries, ["lower_back"], "Injuries must match onboarding");
  assert.deepStrictEqual(connectRes1.data.user.allergies, ["udang", "kacang"], "Allergies must match onboarding");
  console.log("✅ Free Plan Account activated with 2-day trial and onboarding context intact!\n");

  // ============================================================================
  // TEST SCENARIO 2: PAID PLAN (SINGLE COACH: Rp 89.000) WITH MIDTRANS CHECKOUT
  // ============================================================================
  console.log("--- TEST SCENARIO 2: PAID PLAN (SINGLE COACH - NUTRITIONIST: Rp 89.000) ---");
  console.log("2.1 Submitting onboarding profile for single coach plan...");

  const singleProfilePayload = {
    name: "Siti Rahma",
    goal: "health",
    goalTitle: "Pola Makan Sehat & Bersih",
    emotionalVision: "energy",
    gender: "wanita",
    weight: 55,
    startWeight: 55,
    targetWeight: 53,
    height: 160,
    age: 24,
    dob: "2000-08-20",
    activityLevel: "light",
    challenges: ["manis", "ngemil"],
    injuries: ["none"],
    allergies: ["laktosa"],
    commitmentLevel: "high",
    persona: "mia",
    targetCalories: 1550,
    dailyTargetCalories: 1550,
    targetProtein: 116,
    targetCarbs: 174,
    targetFat: 43
  };

  const profileRes2 = await axios.post(`${BASE_URL}/api/onboarding/profile`, singleProfilePayload);
  const singleUserId = profileRes2.data.userId;
  console.log(`✅ Profile saved with userId: ${singleUserId}`);

  console.log("2.2 Creating Order for Single Coach (Nutritionist Specialist)...");
  const orderRes2 = await axios.post(`${BASE_URL}/api/orders/create`, {
    userId: singleUserId,
    plan: "advanced",
    feature: "nutrition"
  });
  assert.strictEqual(orderRes2.data.order.amount, 89000, "Single coach plan amount must be Rp 89.000");
  assert.strictEqual(orderRes2.data.order.feature, "nutrition", "Feature must be nutrition");
  assert.strictEqual(orderRes2.data.order.status, "pending", "Initial order status must be pending");
  assert.strictEqual(orderRes2.data.order.userState, "payment_pending", "User state must be payment_pending");
  assert.ok(orderRes2.data.token || orderRes2.data.redirectUrl, "Snap token or redirectUrl must be provided");
  const singleOrderId = orderRes2.data.order.orderId;
  console.log(`✅ Order created: ${singleOrderId}, gross amount: Rp ${orderRes2.data.order.amount}, Midtrans token ready.`);

  console.log("2.3 Simulating Midtrans Webhook payment settlement...");
  const webhookRes2 = await axios.post(`${BASE_URL}/api/midtrans/notification`, {
    order_id: singleOrderId,
    transaction_status: "settlement",
    status_code: "200",
    gross_amount: "89000.00",
    payment_type: "gopay"
  });
  assert.strictEqual(webhookRes2.status, 200, "Webhook must respond 200");

  // Verify order status updated to paid
  const checkOrderRes2 = await axios.get(`${BASE_URL}/api/orders/${singleOrderId}`);
  assert.strictEqual(checkOrderRes2.data.order.status, "paid", "Order status must transition to paid");
  assert.strictEqual(checkOrderRes2.data.order.userState, "payment_paid", "User state must be payment_paid");
  console.log(`✅ Midtrans settlement processed! Order ${singleOrderId} marked paid.`);

  console.log(`2.4 Connecting WhatsApp (${testPhoneSingle}) to activate Single Coach Plan...`);
  const connectRes2 = await axios.post(`${BASE_URL}/api/account/connect-whatsapp`, {
    userId: singleUserId,
    orderId: singleOrderId,
    phone: testPhoneSingle
  });
  assert.strictEqual(connectRes2.status, 200);
  assert.strictEqual(connectRes2.data.user.subscription.status, "active", "Subscription must be active");
  assert.strictEqual(connectRes2.data.user.subscription.plan, "nutritionist", "Plan must be nutritionist specialist");
  assert.strictEqual(connectRes2.data.user.persona, "mia", "Persona must be Mia");
  console.log("✅ Single Coach Plan successfully activated with Coach Mia!\n");

  // ============================================================================
  // TEST SCENARIO 3: PAID PLAN (BOTH COACHES - ALL-ACCESS: Rp 149.000)
  // ============================================================================
  console.log("--- TEST SCENARIO 3: PAID PLAN (BOTH: NUTRITION + WORKOUT: Rp 149.000) ---");
  console.log("3.1 Submitting onboarding profile for Both coaches...");

  const bothProfilePayload = {
    name: "Rian Perkasa",
    goal: "gain",
    goalTitle: "Bulking & Bentuk Otot",
    emotionalVision: "strength",
    gender: "pria",
    weight: 68,
    startWeight: 68,
    targetWeight: 75,
    height: 178,
    age: 22,
    dob: "2002-03-15",
    activityLevel: "active",
    challenges: ["kenyang", "protein_kurang"],
    injuries: ["shoulder_impingement"],
    allergies: ["none"],
    commitmentLevel: "hardcore",
    persona: "max",
    targetCalories: 2650,
    dailyTargetCalories: 2650,
    targetProtein: 198,
    targetCarbs: 298,
    targetFat: 73
  };

  const profileRes3 = await axios.post(`${BASE_URL}/api/onboarding/profile`, bothProfilePayload);
  const bothUserId = profileRes3.data.userId;

  console.log("3.2 Creating Order for Both Coaches (All-Access)...");
  const orderRes3 = await axios.post(`${BASE_URL}/api/orders/create`, {
    userId: bothUserId,
    plan: "premium",
    feature: null
  });
  assert.strictEqual(orderRes3.data.order.amount, 149000, "Both plan amount must be Rp 149.000");
  assert.strictEqual(orderRes3.data.order.status, "pending");
  const bothOrderId = orderRes3.data.order.orderId;
  console.log(`✅ Order created: ${bothOrderId}, gross amount: Rp ${orderRes3.data.order.amount}`);

  console.log("3.3 Simulating Midtrans Webhook payment settlement for Rp 149.000...");
  await axios.post(`${BASE_URL}/api/midtrans/notification`, {
    order_id: bothOrderId,
    transaction_status: "settlement",
    status_code: "200",
    gross_amount: "149000.00",
    payment_type: "bank_transfer"
  });

  console.log(`3.4 Connecting WhatsApp (${testPhoneBoth}) to activate Both Coaches Plan...`);
  const connectRes3 = await axios.post(`${BASE_URL}/api/account/connect-whatsapp`, {
    userId: bothUserId,
    orderId: bothOrderId,
    phone: testPhoneBoth
  });
  assert.strictEqual(connectRes3.data.user.subscription.status, "active");
  assert.strictEqual(connectRes3.data.user.subscription.plan, "premium", "Plan must be premium");
  assert.strictEqual(connectRes3.data.user.targetCalories, 2650, "Target calories must be 2650 kcal");
  assert.deepStrictEqual(connectRes3.data.user.injuries, ["shoulder_impingement"]);
  console.log("✅ Both Coaches Plan activated successfully!\n");

  // ============================================================================
  // TEST SCENARIO 4: PAYMENT FAILURE & RETRY RESILIENCE
  // ============================================================================
  console.log("--- TEST SCENARIO 4: PAYMENT FAILURE & RETRY FLOW ---");
  const retryProfilePayload = {
    name: "Doni Pratama",
    goal: "maintain",
    weight: 70,
    height: 172,
    age: 28,
    dob: "1996-01-10"
  };
  const profileRes4 = await axios.post(`${BASE_URL}/api/onboarding/profile`, retryProfilePayload);
  const retryUserId = profileRes4.data.userId;

  const orderRes4 = await axios.post(`${BASE_URL}/api/orders/create`, {
    userId: retryUserId,
    plan: "advanced",
    feature: "coach"
  });
  const retryOrderId = orderRes4.data.order.orderId;
  console.log(`4.1 Order created: ${retryOrderId}`);

  console.log("4.2 Simulating Midtrans payment failure (expire / deny)...");
  await axios.post(`${BASE_URL}/api/midtrans/notification`, {
    order_id: retryOrderId,
    transaction_status: "expire",
    status_code: "200"
  });

  const checkFailedOrder = await axios.get(`${BASE_URL}/api/orders/${retryOrderId}`);
  assert.strictEqual(checkFailedOrder.data.order.status, "expired");
  assert.strictEqual(checkFailedOrder.data.order.userState, "payment_expired");
  console.log("✅ Order status correctly reflects expired without losing onboarding data.");

  console.log("4.3 Retrying payment for the same order...");
  const retryPaymentRes = await axios.post(`${BASE_URL}/api/orders/${retryOrderId}/retry`);
  assert.strictEqual(retryPaymentRes.status, 200);
  assert.ok(retryPaymentRes.data.token || retryPaymentRes.data.redirectUrl, "Must generate a fresh Snap token for retry");
  assert.strictEqual(retryPaymentRes.data.order.status, "pending");
  assert.strictEqual(retryPaymentRes.data.order.userState, "payment_pending");
  console.log("✅ Retry endpoint regenerated Midtrans Snap session successfully without redoing onboarding!\n");

  // ============================================================================
  // TEST SCENARIO 5: BOT CONTEXT RECOGNITION (NO RE-PROMPTING)
  // ============================================================================
  console.log("--- TEST SCENARIO 5: BOT CONTEXT RECOGNITION (NO RE-PROMPTING) ---");
  // Fetch user profile from DB using the phone of User 1 (Budi)
  const localPhoneFree = normalizePhoneToLocal(testPhoneFree);
  const userProfileRes = await axios.get(`${BASE_URL}/api/user/${localPhoneFree}`);
  assert.strictEqual(userProfileRes.status, 200);
  const user = userProfileRes.data;
  console.log(`5.1 Verified user in DB: Name="${user.name}", Goal="${user.goal}", Calories=${user.targetCalories} kcal`);
  assert.strictEqual(user.name, "Budi Santoso");
  assert.strictEqual(user.targetCalories, 1850);
  assert.deepStrictEqual(user.injuries, ["lower_back"]);
  assert.deepStrictEqual(user.allergies, ["udang", "kacang"]);
  console.log("✅ AI Coach has full access to onboarding data via phone key without re-prompting!\n");

  console.log("================================================================================");
  console.log("🎉 ALL 5 E2E ONBOARDING & PAYMENT FLOW TEST SCENARIOS PASSED WITH 100% SUCCESS!");
  console.log("================================================================================");
}

runE2ETests().catch((err) => {
  console.error("❌ E2E TEST FAILED:", err.response?.data || err.message);
  process.exit(1);
});
