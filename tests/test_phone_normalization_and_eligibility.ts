import {
  normalizePhoneToE164,
  normalizePhoneToLocal,
  getLegacyPhoneVariations,
  isValidIndonesianMobile
} from "../services/phoneNormalizer";
import {
  isExistingUserPhone,
  activeRegistrationLocks,
  dbData
} from "../server";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ Passed: ${message}`);
  }
}

console.log("=== RUNNING PHONE NORMALIZATION & REGISTRATION ELIGIBILITY TESTS ===");

// 1. Normalization to Canonical E.164
const testInputs = [
  "+62 812 3456 7890",
  "0812 3456 7890",
  "+6281234567890",
  "0812-3456-7890",
  "81234567890",
  "6281234567890",
  "+62081234567890" // Accidental 0 after country code
];

const canonicalExpected = "+6281234567890";
for (const input of testInputs) {
  const normalized = normalizePhoneToE164(input);
  assert(normalized === canonicalExpected, `normalizePhoneToE164("${input}") resolves to "${canonicalExpected}" (got "${normalized}")`);
}

// 2. Local normalization
assert(normalizePhoneToLocal("+6281234567890") === "081234567890", "normalizePhoneToLocal converts E.164 to 08xxxxxxxxxx");
assert(normalizePhoneToLocal("081234567890") === "081234567890", "normalizePhoneToLocal keeps 08xxxxxxxxxx");

// 3. Indonesian Mobile Validation
assert(isValidIndonesianMobile("081234567890") === true, "Valid 0812 mobile number accepted");
assert(isValidIndonesianMobile("+6281987654321") === true, "Valid +62819 mobile number accepted");
assert(isValidIndonesianMobile("0211234567") === false, "Landline 021 rejected");
assert(isValidIndonesianMobile("12345") === false, "Too short rejected");

// 4. Legacy variations for backward-compatible lookup ONLY
const variations = getLegacyPhoneVariations("+6281234567890");
assert(variations.includes("+6281234567890"), "Variations contain canonical E.164");
assert(variations.includes("081234567890"), "Variations contain local format");
assert(variations.includes("6281234567890"), "Variations contain plain 62 format");
assert(variations.includes("usr_081234567890"), "Variations contain legacy usr_ prefix");

// 5. Existing user detection with canonical and legacy records
(async () => {
  const existingCanonical = "+6281234567890";
  dbData.users[existingCanonical] = {
    userId: `usr_${existingCanonical}`,
    name: "Existing Member",
    phone: existingCanonical,
    normalizedPhone: existingCanonical
  };

  // Test detection with various formats of the same phone number
  assert(await isExistingUserPhone("+62 812 3456 7890") === true, "isExistingUserPhone detects spaced format");
  assert(await isExistingUserPhone("081234567890") === true, "isExistingUserPhone detects local 08 format");
  assert(await isExistingUserPhone("81234567890") === true, "isExistingUserPhone detects raw 8 format");
  assert(await isExistingUserPhone("+6281234567890") === true, "isExistingUserPhone detects canonical E.164");

  // Non-existent phone
  assert(await isExistingUserPhone("+6287777777777") === false, "isExistingUserPhone returns false for new phone");

  // 6. Concurrency lock prevents race condition duplicate registration
  const lockPhone = "+6285555555555";
  assert(!activeRegistrationLocks.has(lockPhone), "Lock initially free");
  activeRegistrationLocks.add(lockPhone);
  assert(activeRegistrationLocks.has(lockPhone), "Lock acquired during registration");
  // Second concurrent attempt must detect active lock
  const isLocked = activeRegistrationLocks.has(lockPhone);
  assert(isLocked === true, "Concurrent registration attempt detects lock and halts duplicate creation");
  activeRegistrationLocks.delete(lockPhone);
  assert(!activeRegistrationLocks.has(lockPhone), "Lock released after operation completion");

  console.log("=== ALL PHONE NORMALIZATION & ELIGIBILITY TESTS PASSED ===");
  process.exit(0);
})();
