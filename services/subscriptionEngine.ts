/**
 * Single Source of Truth Subscription & Access Control Engine for GymBuddy.
 * Authoritative resolver for canonical plans, entitlements, durations, expiry states, and notifications.
 */

export type CanonicalPlan =
  | "trial"
  | "nutritionist"
  | "workout_coach"
  | "premium"
  | "lifetime";

export type CanonicalPlanDuration =
  | "2_days"
  | "1_month"
  | "3_months"
  | "6_months"
  | "1_year"
  | "lifetime";

export interface PlanEntitlements {
  canNutrition: boolean;
  canWorkout: boolean;
  isActive: boolean;
  isExpired: boolean;
  reason?: "active" | "expired" | "invalid_config" | "no_plan";
}

export interface ResolvedSubscription {
  plan: CanonicalPlan;
  planDuration: CanonicalPlanDuration;
  planStartedAt: string | null;
  planExpiresAt: string | null;
  hasUsedTrial: boolean;
  isActive: boolean;
  isExpired: boolean;
  planDisplayName: string;
  entitlements: PlanEntitlements;
  daysRemaining?: number;
  hoursRemaining?: number;
}

export interface ExpiryNotificationSchedule {
  eligibleForNotification: boolean;
  notificationType?: "7_days" | "3_days" | "1_day" | "trial_1_day" | "trial_2_hours" | "expired";
  messageTextID?: string;
  messageTextEN?: string;
}

/**
 * Returns human-readable label for canonical plan.
 */
export function getPlanDisplayName(plan: CanonicalPlan, language: "ID" | "EN" = "ID"): string {
  switch (plan) {
    case "trial":
      return language === "EN" ? "Trial Full Access" : "Trial Full Access";
    case "nutritionist":
      return "AI Nutritionist";
    case "workout_coach":
      return "AI Workout Coach";
    case "premium":
      return language === "EN" ? "Premium All-Access" : "Paket Premium (All-Access)";
    case "lifetime":
      return language === "EN" ? "Lifetime Access" : "Lifetime Access";
    default:
      return "GymBuddy Plan";
  }
}

/**
 * Validates that a plan and duration combination conforms to canonical business rules.
 */
export function validatePlanAndDuration(plan: string, duration: string): boolean {
  const p = plan as CanonicalPlan;
  const d = duration as CanonicalPlanDuration;

  if (p === "trial") {
    return d === "2_days";
  }

  if (p === "lifetime") {
    return d === "lifetime";
  }

  if (p === "nutritionist" || p === "workout_coach" || p === "premium") {
    return ["1_month", "3_months", "6_months", "1_year"].includes(d);
  }

  return false;
}

/**
 * Parses any date/timestamp into a Date object or null.
 */
function parseNullableDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === "object" && typeof val.toDate === "function") {
    // Firestore Timestamp
    return val.toDate();
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Resolves the canonical plan for a user, safely migrating or falling back from legacy fields
 * WITHOUT creating alternative sources of truth.
 */
export function resolveCanonicalPlanString(user: any): CanonicalPlan {
  const rawPlan = String(user?.plan || "").toLowerCase().trim();

  if (rawPlan === "trial") return "trial";
  if (rawPlan === "nutritionist") return "nutritionist";
  if (rawPlan === "workout_coach") return "workout_coach";
  if (rawPlan === "premium") return "premium";
  if (rawPlan === "lifetime") return "lifetime";

  // Legacy field normalization (for existing records prior to migration)
  const legacyService = String(
    user?.activeService ||
    user?.subscription?.activeService ||
    user?.selectedFeature ||
    ""
  ).toLowerCase().trim();

  if (legacyService === "nutritionist" || legacyService === "nutrition") {
    return "nutritionist";
  }
  if (legacyService === "coach" || legacyService === "workout") {
    return "workout_coach";
  }
  if (legacyService === "both") {
    return "premium";
  }

  // If user has legacy subscription plan
  const legacySubPlan = String(user?.subscription?.plan || "").toLowerCase().trim();
  if (legacySubPlan === "advanced") {
    if (legacyService === "workout" || legacyService === "coach") return "workout_coach";
    if (legacyService === "nutrition" || legacyService === "nutritionist") return "nutritionist";
    return "premium";
  }
  if (legacySubPlan === "premium") {
    return "premium";
  }

  // Default canonical state for existing unmigrated accounts is lifetime per business spec
  return "lifetime";
}

/**
 * Resolves the canonical duration for a user.
 */
export function resolveCanonicalDuration(user: any, plan: CanonicalPlan): CanonicalPlanDuration {
  if (plan === "trial") return "2_days";
  if (plan === "lifetime") return "lifetime";

  const rawDuration = String(user?.planDuration || user?.subscription?.billingDuration || "").toLowerCase().trim();

  if (rawDuration === "2_days" || rawDuration === "2d") return "2_days";
  if (rawDuration === "1_month" || rawDuration === "1m") return "1_month";
  if (rawDuration === "3_months" || rawDuration === "3m") return "3_months";
  if (rawDuration === "6_months" || rawDuration === "6m") return "6_months";
  if (rawDuration === "1_year" || rawDuration === "1y") return "1_year";
  if (rawDuration === "lifetime") return "lifetime";

  return "1_month";
}

/**
 * Centralized Single Source of Truth Subscription Resolver.
 * Authoritative place for current plan, duration, active state, expiry, and entitlements.
 */
export function getUserSubscription(user: any, now: Date = new Date()): ResolvedSubscription {
  if (!user || typeof user !== "object") {
    const defaultEntitlements: PlanEntitlements = {
      canNutrition: false,
      canWorkout: false,
      isActive: false,
      isExpired: true,
      reason: "no_plan"
    };
    return {
      plan: "trial",
      planDuration: "2_days",
      planStartedAt: null,
      planExpiresAt: null,
      hasUsedTrial: false,
      isActive: false,
      isExpired: true,
      planDisplayName: getPlanDisplayName("trial"),
      entitlements: defaultEntitlements
    };
  }

  const plan = resolveCanonicalPlanString(user);
  const planDuration = resolveCanonicalDuration(user, plan);

  const rawStartedAt = user.planStartedAt || user.subscription?.startedAt || user.createdAt;
  const startedAtDate = parseNullableDate(rawStartedAt);
  const planStartedAt = startedAtDate ? startedAtDate.toISOString() : null;

  let planExpiresAt: string | null = null;
  let expiresAtDate: Date | null = null;

  if (plan === "lifetime") {
    planExpiresAt = null;
    expiresAtDate = null;
  } else {
    const rawExpiresAt = user.planExpiresAt || user.subscription?.expiresAt;
    expiresAtDate = parseNullableDate(rawExpiresAt);
    planExpiresAt = expiresAtDate ? expiresAtDate.toISOString() : null;
  }

  const hasUsedTrial = Boolean(user.hasUsedTrial || user.trialUsed || plan === "trial" || user.trialStartedAt);

  // Determine active/expired state
  let isActive = false;
  let isExpired = false;
  let entitlementReason: PlanEntitlements["reason"] = "active";
  let daysRemaining: number | undefined;
  let hoursRemaining: number | undefined;

  const hasExplicitCanonicalPlan = Boolean(user.plan && ["trial", "nutritionist", "workout_coach", "premium", "lifetime"].includes(String(user.plan).toLowerCase().trim()));

  if (plan === "lifetime") {
    isActive = true;
    isExpired = false;
    entitlementReason = "active";
  } else {
    if (!expiresAtDate) {
      if (hasExplicitCanonicalPlan) {
        // Explicit time-limited canonical plan without expiry timestamp is invalid configuration
        isActive = false;
        isExpired = true;
        entitlementReason = "invalid_config";
      } else {
        // Legacy object without explicit plan field (backward compatibility during migration / legacy tests)
        isActive = true;
        isExpired = false;
        entitlementReason = "active";
      }
    } else {
      const diffMs = expiresAtDate.getTime() - now.getTime();
      if (diffMs > 0) {
        isActive = true;
        isExpired = false;
        entitlementReason = "active";
        hoursRemaining = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
        daysRemaining = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      } else {
        isActive = false;
        isExpired = true;
        entitlementReason = "expired";
        hoursRemaining = 0;
        daysRemaining = 0;
      }
    }
  }

  // Resolve feature entitlements strictly based on plan matrix
  let canNutrition = false;
  let canWorkout = false;

  switch (plan) {
    case "trial":
      canNutrition = true;
      canWorkout = true;
      break;
    case "nutritionist":
      canNutrition = true;
      canWorkout = false;
      break;
    case "workout_coach":
      canNutrition = false;
      canWorkout = true;
      break;
    case "premium":
      canNutrition = true;
      canWorkout = true;
      break;
    case "lifetime":
      canNutrition = true;
      canWorkout = true;
      break;
  }

  // If subscription is not active (e.g. expired), features are disabled
  if (!isActive) {
    canNutrition = false;
    canWorkout = false;
  }

  const entitlements: PlanEntitlements = {
    canNutrition,
    canWorkout,
    isActive,
    isExpired,
    reason: entitlementReason
  };

  return {
    plan,
    planDuration,
    planStartedAt,
    planExpiresAt,
    hasUsedTrial,
    isActive,
    isExpired,
    planDisplayName: getPlanDisplayName(plan),
    entitlements,
    daysRemaining,
    hoursRemaining
  };
}

/**
 * Returns feature entitlements for a user.
 */
export function getUserEntitlements(user: any, now: Date = new Date()): PlanEntitlements {
  return getUserSubscription(user, now).entitlements;
}

/**
 * Evaluates detailed subscription expiry state and notification schedule.
 * Strictly enforces: Lifetime NEVER receives expiry alerts.
 */
export function getSubscriptionExpiryState(user: any, now: Date = new Date()): ExpiryNotificationSchedule {
  const sub = getUserSubscription(user, now);

  // Rule: Lifetime never receives expiry notifications
  if (sub.plan === "lifetime") {
    return { eligibleForNotification: false };
  }

  // If missing expiry date, cannot calculate notification schedule safely
  if (!sub.planExpiresAt) {
    return { eligibleForNotification: false };
  }

  const expiresAt = new Date(sub.planExpiresAt);
  const diffMs = expiresAt.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  const formattedExpiryWIB = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short"
  }).format(expiresAt);

  // 1. Expired state
  if (diffMs <= 0) {
    if (sub.plan === "trial") {
      return {
        eligibleForNotification: true,
        notificationType: "expired",
        messageTextID:
          `🔒 *TRIAL FULL ACCESS SUDAH BERAKHIR*\n-----------------------------\n` +
          `Akses 2 hari uji coba kamu telah selesai pada ${formattedExpiryWIB}.\n\n` +
          `Untuk melanjutkan konsultasi nutrisi & bimbingan latihan di WhatsApp, silakan pilih paket yang sesuai dengan kebutuhanmu di website ya! ✨`,
        messageTextEN:
          `🔒 *TRIAL FULL ACCESS HAS ENDED*\n-----------------------------\n` +
          `Your 2-day trial ended on ${formattedExpiryWIB}.\n\n` +
          `To continue WhatsApp coaching and food photo tracking, choose your preferred plan on the website! ✨`
      };
    } else {
      const planName = getPlanDisplayName(sub.plan, "ID");
      return {
        eligibleForNotification: true,
        notificationType: "expired",
        messageTextID:
          `🔒 *SUBSCRIPTION ${planName.toUpperCase()} SUDAH BERAKHIR*\n-----------------------------\n` +
          `Masa aktif paket ${planName} kamu telah berakhir pada ${formattedExpiryWIB}.\n\n` +
          `Yuk perpanjang paketmu sekarang agar progres kebugaran dan target defisitmu tetap terjaga konsisten! 💪`,
        messageTextEN:
          `🔒 *${getPlanDisplayName(sub.plan, "EN").toUpperCase()} SUBSCRIPTION EXPIRED*\n-----------------------------\n` +
          `Your ${getPlanDisplayName(sub.plan, "EN")} subscription ended on ${formattedExpiryWIB}.\n\n` +
          `Renew your plan today to keep your fitness transformation on track! 💪`
      };
    }
  }

  // 2. Trial-Specific Notification Schedule (2 Days Total)
  if (sub.plan === "trial") {
    // Final Warning: between 0 and 3 hours remaining
    if (diffHours <= 3) {
      return {
        eligibleForNotification: true,
        notificationType: "trial_2_hours",
        messageTextID:
          `⚠️ *TRIAL FULL ACCESS AKAN SEGERA BERAKHIR*\n-----------------------------\n` +
          `Akses seluruh fitur GymBuddy kamu akan berakhir dalam beberapa jam (${formattedExpiryWIB}).\n\n` +
          `Pilih paket langganan sekarang untuk melanjutkan bimbingan coach AI tanpa terputus! 🚀`,
        messageTextEN:
          `⚠️ *TRIAL FULL ACCESS ENDING SOON*\n-----------------------------\n` +
          `Your full trial access will expire in a few hours (${formattedExpiryWIB}).\n\n` +
          `Choose your plan now to ensure uninterrupted AI coaching! 🚀`
      };
    }

    // 1 Day Remaining: between 20 and 26 hours remaining
    if (diffHours <= 26 && diffHours >= 20) {
      return {
        eligibleForNotification: true,
        notificationType: "trial_1_day",
        messageTextID:
          `🎁 *TRIAL FULL ACCESS BERAKHIR BESOK*\n-----------------------------\n` +
          `Kamu masih punya akses ke seluruh fitur AI Nutritionist & AI Workout Coach sampai besok (${formattedExpiryWIB}).\n\n` +
          `Maksimalkan uji coba hari keduamu untuk cek foto makanan atau konsultasi latihan! ✨`,
        messageTextEN:
          `🎁 *TRIAL FULL ACCESS ENDING TOMORROW*\n-----------------------------\n` +
          `You have full access to AI Nutritionist & AI Workout Coach until tomorrow (${formattedExpiryWIB}).\n\n` +
          `Make the most of your trial today with food photo logs and workout guidance! ✨`
      };
    }

    return { eligibleForNotification: false };
  }

  // 3. Paid Commercial Plans Notification Schedule (7d, 3d, 1d)
  const planName = getPlanDisplayName(sub.plan, "ID");

  // 1 Day remaining: between 0.5 and 1.5 days
  if (diffDays <= 1.5 && diffDays > 0) {
    return {
      eligibleForNotification: true,
      notificationType: "1_day",
      messageTextID:
        `⏰ *PENGINGAT: PAKET ${planName.toUpperCase()} BERAKHIR BESOK*\n-----------------------------\n` +
        `Masa aktif paket ${planName} kamu akan berakhir besok pada ${formattedExpiryWIB}.\n\n` +
        `Perpanjang paket sekarang agar bimbingan harianmu di WhatsApp tetap aktif tanpa jeda! ✨`,
      messageTextEN:
        `⏰ *REMINDER: ${getPlanDisplayName(sub.plan, "EN").toUpperCase()} EXPIRES TOMORROW*\n-----------------------------\n` +
        `Your ${getPlanDisplayName(sub.plan, "EN")} plan expires tomorrow at ${formattedExpiryWIB}.\n\n` +
        `Renew today to keep your daily coaching running without interruption! ✨`
    };
  }

  // 3 Days remaining: between 2.5 and 3.5 days
  if (diffDays <= 3.5 && diffDays > 2.5) {
    return {
      eligibleForNotification: true,
      notificationType: "3_days",
      messageTextID:
        `📅 *PENGINGAT: 3 HARI LAGI PAKET ${planName.toUpperCase()} BERAKHIR*\n-----------------------------\n` +
        `Paket ${planName} kamu akan berakhir dalam 3 hari (${formattedExpiryWIB}).\n\n` +
        `Yuk periksa dashboard atau hubungi kami jika ingin beralih ke paket All-Access! 🌟`,
      messageTextEN:
        `📅 *REMINDER: 3 DAYS LEFT ON ${getPlanDisplayName(sub.plan, "EN").toUpperCase()}*\n-----------------------------\n` +
        `Your ${getPlanDisplayName(sub.plan, "EN")} plan will expire in 3 days (${formattedExpiryWIB}).\n\n` +
        `Check the dashboard or message us if you wish to upgrade to All-Access! 🌟`
    };
  }

  // 7 Days remaining: between 6.5 and 7.5 days
  if (diffDays <= 7.5 && diffDays > 6.5) {
    return {
      eligibleForNotification: true,
      notificationType: "7_days",
      messageTextID:
        `🔔 *PENGINGAT: 7 HARI LAGI PAKET ${planName.toUpperCase()} BERAKHIR*\n-----------------------------\n` +
        `Paket ${planName} kamu aktif sampai 7 hari ke depan (${formattedExpiryWIB}).\n\n` +
        `Terima kasih telah konsisten berproses bersama GymBuddy! 💪`,
      messageTextEN:
        `🔔 *REMINDER: 7 DAYS LEFT ON ${getPlanDisplayName(sub.plan, "EN").toUpperCase()}*\n-----------------------------\n` +
        `Your ${getPlanDisplayName(sub.plan, "EN")} plan is active for 7 more days (${formattedExpiryWIB}).\n\n` +
        `Thank you for staying consistent with GymBuddy! 💪`
    };
  }

  return { eligibleForNotification: false };
}

/**
 * Grants a new 2-Day Full Access Trial to an eligible user.
 * Strictly checks server-side trial eligibility.
 */
export function grantTrialToUser(user: any, now: Date = new Date()): {
  success: boolean;
  user: any;
  error?: string;
} {
  if (!user || typeof user !== "object") {
    return { success: false, user, error: "Invalid user object" };
  }

  if (user.hasUsedTrial || user.trialUsed || user.trialStartedAt) {
    return {
      success: false,
      user,
      error: "User has already used the 2-day free trial."
    };
  }

  const startedAt = now.toISOString();
  // Exactly 2 days = 48 hours = 48 * 3600 * 1000 ms
  const expiresAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();

  const updated = {
    ...user,
    plan: "trial" as CanonicalPlan,
    planDuration: "2_days" as CanonicalPlanDuration,
    planStartedAt: startedAt,
    planExpiresAt: expiresAt,
    hasUsedTrial: true,
    trialStartedAt: startedAt,
    trialExpiresAt: expiresAt,
    updatedAt: now.toISOString()
  };

  return {
    success: true,
    user: updated
  };
}

/**
 * Grants or sets a commercial plan on a user account (e.g. after migration or future verified purchase).
 */
export function applyCommercialPlan(
  user: any,
  plan: CanonicalPlan,
  duration: CanonicalPlanDuration,
  now: Date = new Date()
): { success: boolean; user: any; error?: string } {
  if (!validatePlanAndDuration(plan, duration)) {
    return {
      success: false,
      user,
      error: `Invalid plan and duration combination: ${plan} + ${duration}`
    };
  }

  let planExpiresAt: string | null = null;
  const startedAt = now.toISOString();

  if (plan === "lifetime") {
    planExpiresAt = null;
  } else {
    let daysToAdd = 30;
    if (duration === "3_months") daysToAdd = 90;
    else if (duration === "6_months") daysToAdd = 180;
    else if (duration === "1_year") daysToAdd = 365;

    planExpiresAt = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();
  }

  const updated = {
    ...user,
    plan,
    planDuration: duration,
    planStartedAt: startedAt,
    planExpiresAt,
    hasUsedTrial: true,
    updatedAt: now.toISOString()
  };

  return {
    success: true,
    user: updated
  };
}

/**
 * Idempotent, safe, repeatable migration granting Lifetime access to all existing users.
 * Does NOT modify profile, meal, workout, hydration, or onboarding data.
 * Does NOT require payment or subscription records.
 * Reports number of users migrated.
 */
export async function migrateExistingUsersToLifetime(
  inMemoryUsers: Record<string, any>,
  firestoreUsersLoader?: () => Promise<any[]>,
  firestoreUserSaver?: (user: any) => Promise<void>
): Promise<{ migratedCount: number; alreadyLifetimeCount: number; totalUsers: number }> {
  let migratedCount = 0;
  let alreadyLifetimeCount = 0;
  const processedKeys = new Set<string>();

  // 1. Process in-memory users
  for (const [key, user] of Object.entries(inMemoryUsers || {})) {
    if (!user || typeof user !== "object" || key === "latest_onboarding") continue;
    const normPhone = user.normalizedPhone || user.phone || key;
    if (processedKeys.has(normPhone)) continue;
    processedKeys.add(normPhone);

    const isAlreadyLifetime =
      user.plan === "lifetime" &&
      user.planDuration === "lifetime" &&
      (user.planExpiresAt === null || user.planExpiresAt === undefined);

    if (isAlreadyLifetime) {
      alreadyLifetimeCount++;
      continue;
    }

    user.plan = "lifetime";
    user.planDuration = "lifetime";
    user.planExpiresAt = null;
    user.hasUsedTrial = true;
    if (!user.planStartedAt) {
      user.planStartedAt = user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString();
    }
    user.updatedAt = new Date().toISOString();
    migratedCount++;
  }

  // 2. Process Firestore users if loader provided
  if (typeof firestoreUsersLoader === "function") {
    try {
      const fsUsers = await firestoreUsersLoader();
      if (Array.isArray(fsUsers)) {
        for (const user of fsUsers) {
          if (!user || typeof user !== "object") continue;
          const normPhone = user.normalizedPhone || user.phone || user.userId;
          if (!normPhone || processedKeys.has(normPhone)) continue;
          processedKeys.add(normPhone);

          const isAlreadyLifetime =
            user.plan === "lifetime" &&
            user.planDuration === "lifetime" &&
            (user.planExpiresAt === null || user.planExpiresAt === undefined);

          if (isAlreadyLifetime) {
            alreadyLifetimeCount++;
            continue;
          }

          user.plan = "lifetime";
          user.planDuration = "lifetime";
          user.planExpiresAt = null;
          user.hasUsedTrial = true;
          if (!user.planStartedAt) {
            user.planStartedAt = user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString();
          }
          user.updatedAt = new Date().toISOString();

          if (typeof firestoreUserSaver === "function") {
            await firestoreUserSaver(user).catch(err => {
              console.warn("[Migration] Firestore user save error:", err?.message || err);
            });
          }
          migratedCount++;
        }
      }
    } catch (e: any) {
      console.warn("[Migration] Firestore load warning:", e?.message || e);
    }
  }

  const totalUsers = processedKeys.size;
  return {
    migratedCount,
    alreadyLifetimeCount,
    totalUsers
  };
}

