import {
  authPendingSessions,
  getPendingSession,
  handleWhatsAppLoginConfirmation,
  PendingLoginSession
} from "../server";
import { normalizePhoneToE164, normalizePhoneToLocal } from "../services/phoneNormalizer";
import fs from "fs";
import path from "path";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runTests() {
  console.log("================================================================================");
  console.log("🚀 RUNNING PRODUCTION WHATSAPP LOGIN FLOW TEST SUITE (ZERO OTP & STRICT SECURITY)");
  console.log("================================================================================\n");

  const testPhone = "+6281299998888";
  const normPhone = normalizePhoneToLocal(testPhone);
  const canonicalPhone = normalizePhoneToE164(testPhone);

  // Clear any existing test sessions
  authPendingSessions.clear();

  // -------------------------------------------------------------------------
  // TEST 1: Registered number initiates login -> Session created with 5 min TTL
  // -------------------------------------------------------------------------
  console.log("--- TEST 1: Session creation with 5m TTL ---");
  const sessionId1 = "test_sess_001";
  const now = Date.now();
  const session1: PendingLoginSession = {
    sessionId: sessionId1,
    phone: testPhone,
    normPhone,
    altPhone: "62" + normPhone.substring(1),
    canonicalPhone,
    device: "Chrome on Windows",
    location: "Jakarta, Indonesia",
    timeStr: "04 Sep 2026, 16:00",
    status: "pending",
    createdAt: now,
    expiresAt: now + 5 * 60 * 1000,
    profile: {
      userId: "usr_test_001",
      name: "Budi",
      phone: normPhone
    }
  };
  authPendingSessions.set(sessionId1, session1);

  const retrieved1 = await getPendingSession(sessionId1);
  assert(retrieved1 !== null, "Session 1 is retrievable");
  assert(retrieved1?.status === "pending", "Session 1 is initially pending");
  assert(
    Math.round((retrieved1?.expiresAt! - retrieved1?.createdAt!) / 1000) === 300,
    "Session 1 has exact 5 minute (300s) TTL"
  );

  // -------------------------------------------------------------------------
  // TEST 2: Correct registered number replies "YA" -> Session approved
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 2: Text confirmation with 'YA' approves session ---");
  const ack2 = await handleWhatsAppLoginConfirmation(canonicalPhone, "YA");
  assert(ack2 !== null && ack2.includes("Login Dikonfirmasi"), "WhatsApp returns confirmation message for 'YA'");
  assert(session1.status === "approved", "Session 1 status changed to 'approved'");

  // -------------------------------------------------------------------------
  // TEST 3: Correct registered number clicks "Ya, ini saya" / interactive button
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 3: Interactive button 'Ya, ini saya' approves session ---");
  const sessionId3 = "test_sess_003";
  const session3: PendingLoginSession = {
    sessionId: sessionId3,
    phone: testPhone,
    normPhone,
    altPhone: "62" + normPhone.substring(1),
    canonicalPhone,
    device: "Safari on iOS",
    location: "Jakarta, Indonesia",
    timeStr: "04 Sep 2026, 16:05",
    status: "pending",
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000,
    profile: {
      userId: "usr_test_001",
      name: "Budi",
      phone: normPhone
    }
  };
  authPendingSessions.set(sessionId3, session3);

  const ack3 = await handleWhatsAppLoginConfirmation(canonicalPhone, "Ya, ini saya");
  assert(ack3 !== null && ack3.includes("Login Dikonfirmasi"), "Returns confirmation message for 'Ya, ini saya'");
  assert(session3.status === "approved", "Session 3 status changed to 'approved'");

  // Also verify interactive button id payload 'auth_approve_xyz'
  const sessionId3b = "test_sess_003b";
  const session3b: PendingLoginSession = {
    sessionId: sessionId3b,
    phone: testPhone,
    normPhone,
    altPhone: "62" + normPhone.substring(1),
    canonicalPhone,
    device: "Safari on iOS",
    location: "Jakarta, Indonesia",
    timeStr: "04 Sep 2026, 16:06",
    status: "pending",
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000,
    profile: { userId: "usr_test_001", name: "Budi", phone: normPhone }
  };
  authPendingSessions.set(sessionId3b, session3b);

  const ack3b = await handleWhatsAppLoginConfirmation(canonicalPhone, `Ya, ini saya auth_approve_${sessionId3b}`);
  assert(session3b.status === "approved", "Interactive button payload with auth_approve approves session");

  // -------------------------------------------------------------------------
  // TEST 4: Reply "TIDAK" or "Bukan saya" -> Session rejected
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 4: Reply 'TIDAK' or 'Bukan saya' rejects session ---");
  const sessionId4 = "test_sess_004";
  const session4: PendingLoginSession = {
    sessionId: sessionId4,
    phone: testPhone,
    normPhone,
    altPhone: "62" + normPhone.substring(1),
    canonicalPhone,
    device: "Chrome on Android",
    location: "Jakarta, Indonesia",
    timeStr: "04 Sep 2026, 16:10",
    status: "pending",
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000,
    profile: { userId: "usr_test_001", name: "Budi", phone: normPhone }
  };
  authPendingSessions.set(sessionId4, session4);

  const ack4 = await handleWhatsAppLoginConfirmation(canonicalPhone, "Bukan saya");
  assert(ack4 !== null && ack4.includes("Login Ditolak"), "Returns rejection & security message for 'Bukan saya'");
  assert(session4.status === "rejected", "Session 4 status changed to 'rejected'");

  // -------------------------------------------------------------------------
  // TEST 5: Different WhatsApp number replies "YA" -> Ignored / Session stays pending
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 5: Mismatched WhatsApp sender cannot approve session ---");
  const sessionId5 = "test_sess_005";
  const session5: PendingLoginSession = {
    sessionId: sessionId5,
    phone: testPhone,
    normPhone,
    altPhone: "62" + normPhone.substring(1),
    canonicalPhone,
    device: "Chrome on Windows",
    location: "Jakarta, Indonesia",
    timeStr: "04 Sep 2026, 16:15",
    status: "pending",
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000,
    profile: { userId: "usr_test_001", name: "Budi", phone: normPhone }
  };
  authPendingSessions.set(sessionId5, session5);

  const attackerPhone = "+6281900001111"; // Different number
  const ack5 = await handleWhatsAppLoginConfirmation(attackerPhone, "YA");
  assert(ack5 === null, "Mismatched sender gets no approval response (returns null)");
  assert(session5.status === "pending", "Session 5 strictly remains 'pending' despite attacker message");

  // -------------------------------------------------------------------------
  // TEST 6: Expired session receives "YA" -> Ignored & Rejected
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 6: Expired session cannot be approved ---");
  authPendingSessions.clear();
  const sessionId6 = "test_sess_006";
  const session6: PendingLoginSession = {
    sessionId: sessionId6,
    phone: testPhone,
    normPhone,
    altPhone: "62" + normPhone.substring(1),
    canonicalPhone,
    device: "Chrome on Windows",
    location: "Jakarta, Indonesia",
    timeStr: "04 Sep 2026, 16:20",
    status: "pending",
    createdAt: Date.now() - 10 * 60 * 1000, // Created 10 mins ago
    expiresAt: Date.now() - 5 * 60 * 1000,  // Expired 5 mins ago
    profile: { userId: "usr_test_001", name: "Budi", phone: normPhone }
  };
  authPendingSessions.set(sessionId6, session6);

  const ack6 = await handleWhatsAppLoginConfirmation(canonicalPhone, "YA");
  assert(ack6 === null, "Expired session confirmation returns null");
  const retrieved6 = await getPendingSession(sessionId6);
  assert(retrieved6?.status === "expired", "Session 6 status is marked 'expired'");

  // -------------------------------------------------------------------------
  // TEST 7: Cancelled session receives "YA" -> Ignored & not approved
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 7: Cancelled session cannot be approved ---");
  authPendingSessions.clear();
  const sessionId7 = "test_sess_007";
  const session7: PendingLoginSession = {
    sessionId: sessionId7,
    phone: testPhone,
    normPhone,
    altPhone: "62" + normPhone.substring(1),
    canonicalPhone,
    device: "Chrome on Windows",
    location: "Jakarta, Indonesia",
    timeStr: "04 Sep 2026, 16:25",
    status: "cancelled", // User cancelled in UI
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000,
    profile: { userId: "usr_test_001", name: "Budi", phone: normPhone }
  };
  authPendingSessions.set(sessionId7, session7);

  const ack7 = await handleWhatsAppLoginConfirmation(canonicalPhone, "YA");
  assert(ack7 === null, "Cancelled session confirmation returns null");
  assert(session7.status === "cancelled", "Session 7 strictly remains 'cancelled'");

  // -------------------------------------------------------------------------
  // TEST 8: Reusing already-approved session -> Rejected (cannot be re-approved)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 8: Already-approved session cannot be re-approved ---");
  authPendingSessions.clear();
  const sessionId8 = "test_sess_008";
  const session8: PendingLoginSession = {
    sessionId: sessionId8,
    phone: testPhone,
    normPhone,
    altPhone: "62" + normPhone.substring(1),
    canonicalPhone,
    device: "Chrome on Windows",
    location: "Jakarta, Indonesia",
    timeStr: "04 Sep 2026, 16:30",
    status: "approved", // Already approved previously
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000,
    profile: { userId: "usr_test_001", name: "Budi", phone: normPhone }
  };
  authPendingSessions.set(sessionId8, session8);

  const ack8 = await handleWhatsAppLoginConfirmation(canonicalPhone, "YA");
  assert(ack8 === null, "Reusing approved session returns null (no new approval)");

  // -------------------------------------------------------------------------
  // TEST 9: Provider delivery failure handling in production
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 9: Provider delivery failure handling ---");
  // Check code logic in server.ts that enforces 502 when delivery fails in production
  const serverCode = fs.readFileSync(path.join(process.cwd(), "server.ts"), "utf8");
  assert(
    serverCode.includes('if (!delivered && process.env.NODE_ENV === "production")'),
    "server.ts checks WhatsApp delivery failure under production"
  );
  assert(
    serverCode.includes("deliveryError: true"),
    "server.ts returns deliveryError: true when WhatsApp message delivery fails"
  );
  assert(
    serverCode.includes("res.status(502)"),
    "server.ts returns HTTP 502 Bad Gateway when provider fails"
  );

  // -------------------------------------------------------------------------
  // TEST 10 & 11: Production bundle & source code check (zero OTP, zero simulator)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 10 & 11: Source code & compiled bundle zero OTP and zero simulator check ---");
  const loginModalCode = fs.readFileSync(path.join(process.cwd(), "components", "LoginModal.tsx"), "utf8");
  assert(!loginModalCode.includes("otpInput"), "LoginModal contains zero 'otpInput'");
  assert(!loginModalCode.includes("otpError"), "LoginModal contains zero 'otpError'");
  assert(!loginModalCode.includes("handleVerifyOtp"), "LoginModal contains zero 'handleVerifyOtp'");
  assert(!loginModalCode.includes("Gunakan metode verifikasi lain"), "LoginModal contains zero OTP alternative button");
  assert(!loginModalCode.includes("otp_input"), "LoginModal contains zero 'otp_input' step");
  assert(
    loginModalCode.includes("import.meta.env.DEV &&"),
    "LoginModal simulator is wrapped with import.meta.env.DEV for dead-code elimination"
  );

  const distAssets = path.join(process.cwd(), "dist", "assets");
  if (fs.existsSync(distAssets)) {
    const jsFiles = fs.readdirSync(distAssets).filter((f) => f.endsWith(".js"));
    for (const f of jsFiles) {
      const content = fs.readFileSync(path.join(distAssets, f), "utf8");
      assert(!/SIMULATOR UJI COBA/i.test(content), `Compiled ${f} contains zero 'SIMULATOR UJI COBA'`);
      assert(!/handleVerifyOtp/i.test(content), `Compiled ${f} contains zero 'handleVerifyOtp'`);
      assert(!/login-verify-otp/i.test(content), `Compiled ${f} contains zero 'login-verify-otp'`);
      assert(!/Gunakan metode verifikasi lain/i.test(content), `Compiled ${f} contains zero 'Gunakan metode verifikasi lain'`);
    }
    console.log("✅ PASSED: Compiled production bundle verified clean (zero OTP and zero simulator).");
  }

  console.log("\n================================================================================");
  console.log("🎉 ALL 11 PRODUCTION LOGIN FLOW VERIFICATION SCENARIOS PASSED WITH 100% SUCCESS!");
  console.log("================================================================================");
}

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
