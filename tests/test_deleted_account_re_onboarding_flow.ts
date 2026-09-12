import {
  createExpressApp,
  dbData,
  saveUserProfile,
  getUserProfile
} from "../server";
import {
  markAccountDeleted,
  isAccountDeleted,
  clearAccountDeletedTombstone
} from "../services/db";
import http from "http";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runTest() {
  console.log("\n================================================================================");
  console.log("TEST: Deleted Account Re-Onboarding and Checkout Flow");
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

  try {
    const testPhone = "081299991234";
    const canonicalPhone = "+6281299991234";
    const obUserId = `usr_ob_${Date.now()}_test123`;

    // 1. Mark account as deleted
    await markAccountDeleted(testPhone, `usr_${testPhone}`);
    assert(await isAccountDeleted(testPhone), "1. Account is marked as deleted");

    // 2. Step 1: /api/auth/check-phone detects deleted account and allows onboarding
    const checkRes = await req("/api/auth/check-phone", {
      method: "POST",
      body: { phone: canonicalPhone }
    });
    assert(checkRes.status === 200, "2. /api/auth/check-phone returns 200");
    assert(checkRes.body.canOnboard === true, "2. /api/auth/check-phone sets canOnboard = true");
    assert(checkRes.body.isDeleted === true, "2. /api/auth/check-phone detects isDeleted = true");

    // 3. Step 13 -> 14: Save Onboarding Profile
    const profileRes = await req("/api/onboarding/profile", {
      method: "POST",
      body: {
        userId: obUserId,
        phone: canonicalPhone,
        profile: {
          userId: obUserId,
          phone: canonicalPhone,
          name: "Re-onboarding User",
          goal: "lose",
          gender: "pria",
          weight: 78,
          height: 175,
          age: 26,
          dob: "1998-05-10"
        }
      }
    });
    assert(profileRes.status === 200, "3. /api/onboarding/profile saved successfully");

    // 4. Step 14: Create Order (Single Specialist Workout Coach, 3 months, exactly as in user screenshot)
    const orderRes = await req("/api/orders/create", {
      method: "POST",
      body: {
        userId: obUserId,
        phone: canonicalPhone,
        plan: "workout_coach",
        activeService: "coach",
        amount: 249000,
        billingPeriod: "3_months",
        duration: "3_months",
        customerName: "Re-onboarding User",
        isOnboarding: true
      }
    });

    assert(orderRes.status === 200, `4. /api/orders/create succeeded with 200 (got ${orderRes.status}: ${JSON.stringify(orderRes.body)})`);
    assert(orderRes.body.success === true, "4. Order creation success is true");
    assert(orderRes.body.order !== undefined, "4. Order object is returned");
    assert(orderRes.body.token !== undefined, "4. Midtrans Snap token is generated");

    // 5. Verify tombstone was cleared
    assert(!(await isAccountDeleted(testPhone)), "5. Tombstone is cleanly cleared for user");

    // 6. Test Scenario B: Direct onboarding order creation with isOnboarding flag even if profile was not previously saved
    const testPhone2 = "081299995678";
    const canonicalPhone2 = "+6281299995678";
    await markAccountDeleted(testPhone2, `usr_${testPhone2}`);
    assert(await isAccountDeleted(testPhone2), "6. Account 2 marked as deleted");

    const orderRes2 = await req("/api/orders/create", {
      method: "POST",
      body: {
        userId: `usr_ob_${Date.now()}_refresh`,
        phone: canonicalPhone2,
        plan: "both",
        activeService: "both",
        amount: 399000,
        billingPeriod: "3_months",
        duration: "3_months",
        customerName: "User 2",
        isOnboarding: true
      }
    });
    assert(orderRes2.status === 200, `6. Onboarding order succeeded with 200 even after refresh (got ${orderRes2.status})`);
    assert(orderRes2.body.success === true, "6. Order 2 success is true");

    // Clean up
    await clearAccountDeletedTombstone(testPhone);
    await clearAccountDeletedTombstone(testPhone2);

    console.log("\n================================================================================");
    console.log("🎉 ALL RE-ONBOARDING VERIFICATIONS PASSED!");
    console.log("================================================================================\n");
    server.close();
    process.exit(0);
  } catch (err) {
    console.error("Test failed:", err);
    server.close();
    process.exit(1);
  }
}

runTest();
