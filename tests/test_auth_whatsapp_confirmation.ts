import {
  authPendingSessions,
  handleWhatsAppLoginConfirmation,
  getPendingSession,
  PendingLoginSession
} from "../server";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ Passed: ${message}`);
  }
}

console.log("=== RUNNING WHATSAPP LOGIN CONFIRMATION & 2FA SECURITY TESTS ===");

// Setup dummy pending session
const testSessionId = `test_sess_${Date.now()}`;
const testPhone = "081234567890";
const testNormPhone = "081234567890";
const testAltPhone = "6281234567890";
const testOtp = "789123";

const sampleSession: PendingLoginSession = {
  sessionId: testSessionId,
  phone: testPhone,
  normPhone: testNormPhone,
  altPhone: testAltPhone,
  device: "Chrome on Windows",
  location: "Jakarta, Indonesia",
  timeStr: "3 Sep 2026, 11:57",
  status: "pending",
  otpCode: testOtp,
  createdAt: Date.now(),
  expiresAt: Date.now() + 5 * 60 * 1000,
  profile: {
    userId: "usr_test_123",
    name: "Budi Santoso",
    phone: testNormPhone
  }
};

authPendingSessions.set(testSessionId, sampleSession);

(async () => {
  // 1. Check getPendingSession
  const retrieved = await getPendingSession(testSessionId);
  assert(retrieved !== null, "Session is retrievable by sessionId");
  assert(retrieved?.status === "pending", "Session initial status is pending");
  assert(retrieved?.location === "Jakarta, Indonesia", "Location matches approximate city+country");
  assert(retrieved?.device === "Chrome on Windows", "Device matches context");

  // 2. Test WhatsApp approval keywords: "YA"
  const replyAck = await handleWhatsAppLoginConfirmation(testAltPhone, "YA");
  assert(replyAck !== null, "Reply acknowledgment returned for 'YA'");
  assert(replyAck!.includes("Login Dikonfirmasi"), "Reply contains confirmation success text");
  assert(sampleSession.status === "approved", "Session status transitioned to approved on 'YA'");

  // 3. Test WhatsApp rejection keywords: "TIDAK"
  const rejectSessionId = `test_reject_${Date.now()}`;
  const rejectSession: PendingLoginSession = {
    sessionId: rejectSessionId,
    phone: "089876543210",
    normPhone: "089876543210",
    altPhone: "6289876543210",
    device: "Safari on iOS",
    location: "Jakarta, Indonesia",
    timeStr: "3 Sep 2026, 12:05",
    status: "pending",
    otpCode: "654321",
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000,
    profile: {
      userId: "usr_test_reject",
      name: "Siti",
      phone: "089876543210"
    }
  };
  authPendingSessions.set(rejectSessionId, rejectSession);

  const rejectReply = await handleWhatsAppLoginConfirmation("089876543210", "TIDAK");
  assert(rejectReply !== null, "Reply acknowledgment returned for 'TIDAK'");
  assert(rejectReply!.includes("Login Ditolak & Akun Diamankan"), "Reply contains account secured warning");
  assert(rejectSession.status === "rejected", "Session status transitioned to rejected on 'TIDAK'");

  // 4. Test Alternative 6-digit OTP code in WhatsApp
  const otpSessionId = `test_otp_${Date.now()}`;
  const otpSession: PendingLoginSession = {
    sessionId: otpSessionId,
    phone: "085555555555",
    normPhone: "085555555555",
    altPhone: "628555555555",
    device: "Edge on Windows",
    location: "Jakarta, Indonesia",
    timeStr: "3 Sep 2026, 12:10",
    status: "pending",
    otpCode: "432198",
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000,
    profile: {
      userId: "usr_test_otp",
      name: "Rian",
      phone: "085555555555"
    }
  };
  authPendingSessions.set(otpSessionId, otpSession);

  const otpReply = await handleWhatsAppLoginConfirmation("085555555555", "432198");
  assert(otpReply !== null, "Reply acknowledgment returned for valid 6-digit OTP");
  assert(otpReply!.includes("Kode Verifikasi Benar"), "Reply confirms OTP match");
  assert(otpSession.status === "approved", "Session transitioned to approved with valid OTP");

  // 5. Test expiration
  const expiredSessionId = `test_exp_${Date.now()}`;
  const expiredSession: PendingLoginSession = {
    sessionId: expiredSessionId,
    phone: "087777777777",
    normPhone: "087777777777",
    altPhone: "628777777777",
    device: "Chrome on Android",
    location: "Jakarta, Indonesia",
    timeStr: "3 Sep 2026, 12:15",
    status: "pending",
    otpCode: "111222",
    createdAt: Date.now() - 6 * 60 * 1000,
    expiresAt: Date.now() - 1 * 60 * 1000, // already expired
    profile: {
      userId: "usr_test_exp",
      name: "Doni",
      phone: "087777777777"
    }
  };
  authPendingSessions.set(expiredSessionId, expiredSession);

  const checkedExpired = await getPendingSession(expiredSessionId);
  assert(checkedExpired?.status === "expired", "Session automatically marked expired after 5 minutes");

  console.log("🎉 ALL WHATSAPP 2FA CONFIRMATION & SECURITY TESTS PASSED!");
  process.exit(0);
})();
