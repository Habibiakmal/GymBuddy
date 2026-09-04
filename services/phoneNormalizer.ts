/**
 * Centralized Phone Normalization Engine for GymBuddy.
 * Enforces canonical E.164 (+628xxxxxxxxxx) for Indonesian numbers across:
 * - Registration & Onboarding
 * - Login & WhatsApp 2FA Verification
 * - Database Uniqueness & Lookups
 */

/**
 * Normalizes any Indonesian phone number format into canonical E.164: +628xxxxxxxxxx
 * Examples:
 *   "081234567890"        -> "+6281234567890"
 *   "+62 812-3456-7890"   -> "+6281234567890"
 *   "+6281234567890"      -> "+6281234567890"
 *   "6281234567890"       -> "+6281234567890"
 *   "81234567890"         -> "+6281234567890"
 *   "+62081234567890"     -> "+6281234567890" (handles accidental 0 after country code)
 */
export function normalizePhoneToE164(phone: string | null | undefined): string {
  if (!phone) return "";
  const raw = String(phone).trim();
  if (!raw) return "";

  // Extract digits only
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  // Handle Indonesian prefixes
  if (digits.startsWith("62")) {
    digits = digits.substring(2);
    // Strip accidental leading 0 after 62: e.g. 620812... -> 812...
    if (digits.startsWith("0")) {
      digits = digits.substring(1);
    }
    return `+62${digits}`;
  }

  if (digits.startsWith("0")) {
    digits = digits.substring(1);
    return `+62${digits}`;
  }

  if (digits.startsWith("8")) {
    return `+62${digits}`;
  }

  // If raw started with '+' and wasn't 62, keep international code
  if (raw.startsWith("+")) {
    return `+${digits}`;
  }

  // Default fallback for numbers starting with other digits
  return `+${digits}`;
}

/**
 * Normalizes to Indonesian local format: 08xxxxxxxxxx
 */
export function normalizePhoneToLocal(phone: string | null | undefined): string {
  const e164 = normalizePhoneToE164(phone);
  if (!e164) return "";
  if (e164.startsWith("+62")) {
    return "0" + e164.substring(3);
  }
  return e164.replace(/^\+/, "");
}

/**
 * Returns legacy phone variations strictly for backwards-compatible database lookups.
 * MUST NOT be used as the primary uniqueness key.
 */
export function getLegacyPhoneVariations(phone: string | null | undefined): string[] {
  const e164 = normalizePhoneToE164(phone);
  if (!e164) return [];

  const local = normalizePhoneToLocal(e164);
  const rawDigits = e164.replace(/\D/g, "");
  const withoutPlus = e164.replace(/^\+/, "");

  return Array.from(
    new Set([
      e164,                   // Canonical: +6281234567890
      local,                  // Local: 081234567890
      withoutPlus,            // 6281234567890
      rawDigits,              // Digits only
      `usr_${local}`,         // Legacy user ID usr_081234567890
      `usr_${withoutPlus}`,   // Legacy user ID usr_6281234567890
      `usr_${e164}`           // Legacy user ID usr_+6281234567890
    ])
  ).filter(Boolean);
}

/**
 * Validates whether a phone number is a valid Indonesian mobile number
 */
export function isValidIndonesianMobile(phone: string | null | undefined): boolean {
  const e164 = normalizePhoneToE164(phone);
  if (!e164.startsWith("+628")) return false;
  const digitsAfterPrefix = e164.substring(4);
  // Indonesian mobile numbers are typically 8 to 12 digits after 08 (9 to 13 total digits)
  return digitsAfterPrefix.length >= 7 && digitsAfterPrefix.length <= 13;
}
