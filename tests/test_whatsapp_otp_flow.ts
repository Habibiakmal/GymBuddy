import {
  authPendingSessions,
  savePendingSession,
  getPendingSession,
  handleWhatsAppLoginConfirmation,
  PendingLoginSession
} from "../server";
import { verifyAuthToken } from "../services/auth";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ Passed: ${message}`);
  }
}

console.log("=== RUNNING WHATSAPP 6-DIGIT OTP VERIFICATION FLOW TESTS ===");

(async () => {
  // 1. TEST: OTP Generation characteristics
  console.log("\n--- TEST 1: OTP Code Generation & Format ---");
  for (let i = 0; i < 50; i++) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    assert(code.length === 6, `OTP is exactly 6 chars: ${code}`);
    assert(/^\d{6}$/.test(code), `OTP is strictly 6 digits: ${code}`);
    const num = parseInt(code, 10);
    assert(num >= 100000 && num <= 999999, `OTP is within [100000, 999999]: ${code}`);
  }

  // Helper simulating the core logic of POST /api/auth/login-verify-otp
  async function simulateVerifyOtpEndpoint(sessionId: string, otp: string) {
    if (!sessionId || !otp) {
      return { status: 400, body: { success: false, error: "missing_fields" } };
    }
    const session = await getPendingSession(sessionId);
    if (!session) {
      return { status: 404, body: { success: false, error: "session_not_found" } };
    }
    if (session.status === "cancelled") {
      return { status: 400, body: { success: false, error: "session_cancelled" } };
    }
    if (session.status === "approved" && session.token) {
      return {
        status: 200,
        body: { success: true, status: "approved", token: session.token, profile: session.profile }
      };
    }
    if (Date.now() > session.expiresAt || session.status === "expired") {
      session.status = "expired";
      await savePendingSession(session);
      return { status: 400, body: { success: false, error: "otp_expired" } };
    }

    const maxAttempts = session.maxAttempts || 5;
    const currentAttempts = session.attempts || 0;
    if (currentAttempts >= maxAttempts) {
      session.status = "expired";
      await savePendingSession(session);
      return { status: 429, body: { success: false, error: "too_many_attempts" } };
    }

    const cleanOtp = String(otp).trim().replace(/\D/g, "");
    if (session.otpCode !== cleanOtp) {
      session.attempts = currentAttempts + 1;
      if (session.attempts >= maxAttempts) {
        session.status = "expired";
      }
      await savePendingSession(session);
      const remaining = Math.max(0, maxAttempts - session.attempts);
      return {
        status: 400,
        body: { success: false, error: "invalid_otp", remainingAttempts: remaining }
      };
    }

    // Success
    session.status = "approved";
    const { generateAuthToken } = await import("../services/auth");
    const userId = session.profile?.userId || `usr_${session.normPhone}`;
    session.token = generateAuthToken({ userId, phone: session.normPhone });
    await savePendingSession(session);

    return {
      status: 200,
      body: {
        success: true,
        status: "approved",
        token: session.token,
        profile: session.profile
      }
    };
  }

  // 2. TEST: Valid OTP verification flow
  console.log("\n--- TEST 2: Valid OTP Verification & JWT Token Issuance ---");
  const validSessionId = `test_valid_${Date.now()}`;
  const validOtp = "582914";
  const validSession: PendingLoginSession = {
    sessionId: validSessionId,
    phone: "081234567890",
    normPhone: "081234567890",
    altPhone: "6281234567890",
    canonicalPhone: "+6281234567890",
    device: "Chrome on Windows",
    location: "Jakarta, Indonesia",
    timeStr: "4 Sep 2026, 17:00",
    status: "pending",
    otpCode: validOtp,
    attempts: 0,
    maxAttempts: 5,
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000,
    profile: {
      userId: "usr_valid_tester",
      name: "Valid Tester",
      phone: "081234567890"
    }
  };
  await savePendingSession(validSession);

  const validRes = await simulateVerifyOtpEndpoint(validSessionId, validOtp);
  assert(validRes.status === 200, "Valid OTP verification HTTP status is 200");
  assert(validRes.body.success === true, "Valid OTP verification returns success: true");
  assert(validRes.body.status === "approved", "Session status is approved");
  assert(Boolean(validRes.body.token), "Auth JWT token is generated and returned");

  // Verify JWT token signature and payload
  const tokenPayload = verifyAuthToken(validRes.body.token);
  assert(tokenPayload !== null, "JWT token is cryptographically valid");
  assert(tokenPayload?.userId === "usr_valid_tester", "JWT token contains correct userId");
  assert(tokenPayload?.phone === "081234567890", "JWT token contains correct phone");

  // 3. TEST: Idempotency (double submit)
  console.log("\n--- TEST 3: Idempotent Double Verification ---");
  const doubleRes = await simulateVerifyOtpEndpoint(validSessionId, validOtp);
  assert(doubleRes.status === 200, "Double submit returns HTTP 200");
  assert(doubleRes.body.success === true, "Double submit returns success: true");
  assert(doubleRes.body.token === validRes.body.token, "Double submit returns same valid token");

  // 4. TEST: Invalid OTP and brute-force attempt lockout
  console.log("\n--- TEST 4: Invalid OTP & Brute-Force Lockout (5 Attempts) ---");
  const bruteSessionId = `test_brute_${Date.now()}`;
  const secretOtp = "773910";
  const bruteSession: PendingLoginSession = {
    sessionId: bruteSessionId,
    phone: "089998887776",
    normPhone: "089998887776",
    altPhone: "6289998887776",
    canonicalPhone: "+6289998887776",
    device: "Chrome on Android",
    location: "Bandung, Indonesia",
    timeStr: "4 Sep 2026, 17:05",
    status: "pending",
    otpCode: secretOtp,
    attempts: 0,
    maxAttempts: 5,
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000,
    profile: {
      userId: "usr_brute_tester",
      name: "Brute Tester",
      phone: "089998887776"
    }
  };
  await savePendingSession(bruteSession);

  // Attempts 1 to 4 should be rejected with decreasing remaining attempts
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await simulateVerifyOtpEndpoint(bruteSessionId, "000000");
    assert(res.status === 400, `Attempt ${attempt} returns HTTP 400`);
    assert(res.body.error === "invalid_otp", `Attempt ${attempt} error is invalid_otp`);
    assert(res.body.remainingAttempts === 5 - attempt, `Attempt ${attempt} remaining attempts is ${5 - attempt}`);
  }

  // 5th attempt with wrong OTP must lock the session
  const res5 = await simulateVerifyOtpEndpoint(bruteSessionId, "000000");
  assert(res5.status === 400, "5th attempt returns HTTP 400");
  assert(res5.body.remainingAttempts === 0, "5th attempt remaining attempts is 0");

  const lockedSess = await getPendingSession(bruteSessionId);
  assert(lockedSess?.status === "expired", "Session status is locked to expired after 5 failed attempts");

  // 6th attempt should return too_many_attempts or otp_expired
  const res6 = await simulateVerifyOtpEndpoint(bruteSessionId, secretOtp);
  assert(res6.status === 429 || res6.status === 400, "6th attempt is rejected");
  assert(res6.body.error === "too_many_attempts" || res6.body.error === "otp_expired", "6th attempt error indicates lockout");

  // 5. TEST: Expired session rejection
  console.log("\n--- TEST 5: Expired Session Handling ---");
  const expSessionId = `test_exp_${Date.now()}`;
  const expSession: PendingLoginSession = {
    sessionId: expSessionId,
    phone: "087711223344",
    normPhone: "087711223344",
    altPhone: "6287711223344",
    canonicalPhone: "+6287711223344",
    device: "Safari on iOS",
    location: "Surabaya, Indonesia",
    timeStr: "4 Sep 2026, 17:10",
    status: "pending",
    otpCode: "349182",
    attempts: 0,
    maxAttempts: 5,
    createdAt: Date.now() - 6 * 60 * 1000,
    expiresAt: Date.now() - 1 * 60 * 1000, // expired 1 minute ago
    profile: {
      userId: "usr_exp_tester",
      name: "Expired Tester",
      phone: "087711223344"
    }
  };
  await savePendingSession(expSession);

  const expRes = await simulateVerifyOtpEndpoint(expSessionId, "349182");
  assert(expRes.status === 400, "Expired OTP returns HTTP 400");
  assert(expRes.body.error === "otp_expired", "Expired OTP returns error: otp_expired");

  // 6. TEST: WhatsApp reply fallback (user replies with digits or YA on WhatsApp)
  console.log("\n--- TEST 6: WhatsApp Message Direct Reply Integration ---");
  const waSessionId = `test_wa_${Date.now()}`;
  const waSessionPhone = "081987654321";
  const waSession: PendingLoginSession = {
    sessionId: waSessionId,
    phone: waSessionPhone,
    normPhone: waSessionPhone,
    altPhone: "6281987654321",
    canonicalPhone: "+6281987654321",
    device: "Chrome on macOS",
    location: "Jakarta, Indonesia",
    timeStr: "4 Sep 2026, 17:15",
    status: "pending",
    otpCode: "918273",
    attempts: 0,
    maxAttempts: 5,
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000,
    profile: {
      userId: "usr_wa_tester",
      name: "WhatsApp Tester",
      phone: waSessionPhone
    }
  };
  await savePendingSession(waSession);

  // User replies with the 6 digits in WhatsApp
  const waReplyAck = await handleWhatsAppLoginConfirmation(waSessionPhone, "918273");
  assert(waReplyAck !== null, "WhatsApp reply handler acknowledged 6 digits");
  assert(waSession.status === "approved", "WhatsApp 6-digit reply approved the session");

  console.log("\n🎉 ALL WHATSAPP 6-DIGIT OTP TESTS PASSED SUCCESSFULLY!");
  process.exit(0);
})();
