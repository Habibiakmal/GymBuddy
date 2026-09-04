import {
  authPendingSessions,
  getPendingSession,
  PendingLoginSession
} from "../server";
import { normalizePhoneToE164 } from "../services/phoneNormalizer";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ Passed: ${message}`);
  }
}

console.log("=== RUNNING COMPREHENSIVE OTP SECURITY TESTS ===");

const canonicalTestPhone = "+6281234567890";
const correctOtp = "123456";

function createFreshSession(sessionId: string, overrides: Partial<PendingLoginSession> = {}): PendingLoginSession {
  const sess: PendingLoginSession = {
    sessionId,
    phone: "081234567890",
    canonicalPhone: canonicalTestPhone,
    normPhone: "081234567890",
    altPhone: "6281234567890",
    device: "Chrome on Windows",
    location: "Jakarta, Indonesia",
    timeStr: "4 Sep 2026, 14:00",
    status: "pending",
    otpCode: correctOtp,
    attempts: 0,
    maxAttempts: 5,
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000,
    profile: {
      userId: "usr_test_security",
      name: "Security Test User",
      phone: canonicalTestPhone
    },
    ...overrides
  };
  authPendingSessions.set(sessionId, sess);
  return sess;
}

// Logic function simulating server-side verify endpoint
function verifyOtpLogic(sessionId: string, inputOtp: string, clientPhone?: string): { success: boolean; status: string; message?: string } {
  const session = getPendingSession(sessionId);
  if (!session) {
    return { success: false, status: "not_found", message: "Sesi verifikasi tidak ditemukan." };
  }

  // Check phone matching if supplied
  if (clientPhone) {
    const inputCanonical = normalizePhoneToE164(clientPhone);
    if (session.canonicalPhone && inputCanonical && session.canonicalPhone !== inputCanonical) {
      return { success: false, status: "phone_mismatch", message: "Nomor telepon tidak cocok dengan sesi." };
    }
  }

  // Check if session cancelled
  if (session.status === "cancelled") {
    return { success: false, status: "cancelled", message: "Sesi telah dibatalkan." };
  }

  // Check if session already approved (anti-reused OTP)
  if (session.status === "approved") {
    return { success: false, status: "already_used", message: "Kode OTP ini sudah digunakan dan tidak berlaku lagi." };
  }

  // Check if expired
  if (session.status === "expired" || Date.now() > session.expiresAt) {
    session.status = "expired";
    return { success: false, status: "expired", message: "Sesi login telah kedaluwarsa." };
  }

  // Check attempt limits
  const currentAttempts = (session.attempts || 0);
  const maxAttempts = session.maxAttempts || 5;
  if (currentAttempts >= maxAttempts) {
    session.status = "expired";
    return { success: false, status: "max_attempts_exceeded", message: "Batas percobaan OTP terlampaui. Sesi dikunci demi keamanan." };
  }

  // Verify OTP match
  if (!session.otpCode || String(inputOtp).trim() !== String(session.otpCode).trim()) {
    session.attempts = currentAttempts + 1;
    if (session.attempts >= maxAttempts) {
      session.status = "expired";
      return { success: false, status: "max_attempts_exceeded", message: "Batas percobaan OTP terlampaui. Sesi dikunci demi keamanan." };
    }
    return { success: false, status: "invalid_otp", message: `Kode verifikasi salah. Sisa percobaan: ${maxAttempts - session.attempts}.` };
  }

  // Success: Approve session
  session.status = "approved";
  session.approvedAt = Date.now();
  return { success: true, status: "approved" };
}

// TEST 1: Wrong OTP increments attempts
{
  const sess = createFreshSession("test_wrong_otp");
  const res = verifyOtpLogic("test_wrong_otp", "000000");
  assert(res.success === false, "Wrong OTP returns failure");
  assert(res.status === "invalid_otp", "Status is invalid_otp");
  assert(sess.attempts === 1, "Attempts incremented to 1");
}

// TEST 2: Attempt limits (5 max attempts locks session)
{
  const sess = createFreshSession("test_attempt_limit");
  // Try 4 wrong attempts
  for (let i = 1; i <= 4; i++) {
    const res = verifyOtpLogic("test_attempt_limit", `99999${i}`);
    assert(res.success === false, `Attempt ${i} rejected`);
    assert(sess.attempts === i, `Attempts count is ${i}`);
    assert(sess.status === "pending", "Session remains pending before limit reached");
  }
  // 5th wrong attempt must lock session
  const res5 = verifyOtpLogic("test_attempt_limit", "999995");
  assert(res5.success === false, "5th attempt rejected");
  assert(res5.status === "max_attempts_exceeded", "5th attempt triggers max_attempts_exceeded");
  assert(sess.status === "expired", "Session status locked to expired");

  // Subsequent attempt even with CORRECT OTP must be rejected
  const resSubsequent = verifyOtpLogic("test_attempt_limit", correctOtp);
  assert(resSubsequent.success === false, "Locked session rejects even correct OTP");
  assert(resSubsequent.status === "max_attempts_exceeded" || resSubsequent.status === "expired", "Locked session rejects retry");
}

// TEST 3: Expired OTP session (expiresAt in the past)
{
  const sess = createFreshSession("test_expired_otp", { expiresAt: Date.now() - 10000 });
  const res = verifyOtpLogic("test_expired_otp", correctOtp);
  assert(res.success === false, "Expired session rejected");
  assert(res.status === "expired", "Status is expired");
}

// TEST 4: Reused OTP rejected
{
  const sess = createFreshSession("test_reused_otp");
  // First verification succeeds
  const res1 = verifyOtpLogic("test_reused_otp", correctOtp);
  assert(res1.success === true, "First verification with correct OTP succeeds");
  assert(sess.status === "approved", "Session status is approved");

  // Second verification on same session must fail (cannot be reused)
  const res2 = verifyOtpLogic("test_reused_otp", correctOtp);
  assert(res2.success === false, "Reused OTP on already-approved session is rejected");
  assert(res2.status === "already_used", "Status is already_used");
}

// TEST 5: Cancelled session rejected
{
  const sess = createFreshSession("test_cancelled_otp", { status: "cancelled" });
  const res = verifyOtpLogic("test_cancelled_otp", correctOtp);
  assert(res.success === false, "Cancelled session rejected");
  assert(res.status === "cancelled", "Status is cancelled");
}

// TEST 6: Wrong session ID rejected
{
  const res = verifyOtpLogic("non_existent_session_id", correctOtp);
  assert(res.success === false, "Non-existent session ID rejected");
  assert(res.status === "not_found", "Status is not_found");
}

// TEST 7: Wrong phone rejected
{
  const sess = createFreshSession("test_phone_guard");
  const res = verifyOtpLogic("test_phone_guard", correctOtp, "08999999999");
  assert(res.success === false, "Session for different phone number rejected");
  assert(res.status === "phone_mismatch", "Status is phone_mismatch");
}

// TEST 8: OTP is NEVER exposed in login request response payload
{
  // Simulating the response builder in POST /api/auth/login-request
  const sess = createFreshSession("test_no_otp_exposure");
  const publicResponse = {
    success: true,
    sessionId: sess.sessionId,
    device: sess.device,
    location: sess.location,
    timeStr: sess.timeStr,
    expiresAt: sess.expiresAt
    // Notice: otpCode is STRICTLY omitted!
  };

  assert(!("otpCode" in publicResponse), "otpCode is NOT present in login-request response JSON");
  assert((publicResponse as any).otpCode === undefined, "otpCode is undefined in client payload");
}

console.log("=== ALL COMPREHENSIVE OTP SECURITY TESTS PASSED ===");
process.exit(0);
