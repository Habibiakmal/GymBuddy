/**
 * GymBuddy Canonical Pricing Configuration
 *
 * ============================================================
 * ⚠️  PENDING BUSINESS CONFIRMATION
 * ============================================================
 * The prices below are directionally correct but have NOT been
 * formally signed off as final business prices.
 *
 * Before going live with any payment flow:
 *   1. Confirm all IDR prices with the product/finance owner.
 *   2. Update this file ONLY — every surface reads from here.
 *   3. Remove the PENDING_BUSINESS_CONFIRMATION comment once confirmed.
 *
 * Last reviewed: 2026-09-11 (pre-approval, not yet confirmed)
 * ============================================================
 *
 * This file is the SINGLE SOURCE OF TRUTH for:
 *   Plan × Duration → Price (IDR)
 *
 * Import from this file in:
 *   - components/Onboarding.tsx
 *   - components/Dashboard.tsx (upgrade modal)
 *   - components/PricingPage.tsx
 *   - server.ts (order creation, amount validation)
 *
 * Do NOT hardcode prices anywhere else.
 */

export type PlanKey = "nutritionist" | "workout_coach" | "both";
export type DurationKey = "3_months" | "6_months" | "1_year";

export interface PriceEntry {
  /** IDR amount in full integer (e.g. 249000) */
  idr: number;
  /** Human-readable short label (e.g. "Rp 249rb") */
  label: string;
  /** Number of calendar months this plan covers */
  durationMonths: number;
  /** Optional savings badge text (Indonesian) */
  savingLabel?: string;
}

// ============================================================
// ⚠️  PENDING_BUSINESS_CONFIRMATION — see header comment
// ============================================================
export const PLAN_PRICING: Record<PlanKey, Record<DurationKey, PriceEntry>> = {
  nutritionist: {
    "3_months": {
      idr: 249000,
      label: "Rp 249rb",
      durationMonths: 3,
    },
    "6_months": {
      idr: 449000,
      label: "Rp 449rb",
      durationMonths: 6,
      savingLabel: "Hemat ~16%",
    },
    "1_year": {
      idr: 749000,
      label: "Rp 749rb",
      durationMonths: 12,
      savingLabel: "Paling Hemat ~30%",
    },
  },
  workout_coach: {
    "3_months": {
      idr: 249000,
      label: "Rp 249rb",
      durationMonths: 3,
    },
    "6_months": {
      idr: 449000,
      label: "Rp 449rb",
      durationMonths: 6,
      savingLabel: "Hemat ~16%",
    },
    "1_year": {
      idr: 749000,
      label: "Rp 749rb",
      durationMonths: 12,
      savingLabel: "Paling Hemat ~30%",
    },
  },
  both: {
    "3_months": {
      idr: 399000,
      label: "Rp 399rb",
      durationMonths: 3,
    },
    "6_months": {
      idr: 699000,
      label: "Rp 699rb",
      durationMonths: 6,
      savingLabel: "Hemat ~20%",
    },
    "1_year": {
      idr: 1199000,
      label: "Rp 1.199rb",
      durationMonths: 12,
      savingLabel: "Paling Hemat ~33%",
    },
  },
};

/** Ordered list of available billing durations */
export const DURATIONS: DurationKey[] = ["3_months", "6_months", "1_year"];

/** Human-readable labels for each duration */
export const DURATION_LABELS: Record<DurationKey, { id: string; en: string }> = {
  "3_months": { id: "3 Bulan",  en: "3 Months" },
  "6_months": { id: "6 Bulan",  en: "6 Months" },
  "1_year":   { id: "1 Tahun",  en: "1 Year"   },
};

/**
 * Get the canonical IDR price for a plan + duration combination.
 * Returns 0 if the combination is not found.
 */
export function getPrice(plan: PlanKey, duration: DurationKey): number {
  return PLAN_PRICING[plan]?.[duration]?.idr ?? 0;
}

/**
 * Get the full price entry for a plan + duration combination.
 * Returns null if the combination is not found.
 */
export function getPriceEntry(plan: PlanKey, duration: DurationKey): PriceEntry | null {
  return PLAN_PRICING[plan]?.[duration] ?? null;
}

/**
 * Normalize a raw billing period string to a canonical DurationKey.
 * Accepts both canonical ("3_months") and short ("3m") forms.
 * Returns null for unrecognized values.
 */
export function normalizeDuration(raw: string | undefined | null): DurationKey | null {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (s === "3_months" || s === "3m") return "3_months";
  if (s === "6_months" || s === "6m") return "6_months";
  if (s === "1_year"   || s === "1y") return "1_year";
  return null;
}

/**
 * Normalize a raw plan string to a canonical PlanKey.
 * Returns null for unrecognized values.
 */
export function normalizePlan(raw: string | undefined | null): PlanKey | null {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (s === "nutritionist") return "nutritionist";
  if (s === "workout_coach" || s === "coach") return "workout_coach";
  if (s === "both" || s === "premium")        return "both";
  return null;
}

/**
 * Given an existing plan and a newly purchased plan, return the merged result.
 *
 * Rules:
 *   workout_coach + nutritionist → both
 *   nutritionist  + workout_coach → both
 *   both          + anything      → both (renewal)
 *   free/null     + anything      → the purchased plan
 *   same          + same          → same (renewal)
 *
 * ⚠️  NOTE: Subscription *expiry* merge behavior for upgrade cases
 * (e.g. existing workout_coach subscriber adding nutritionist) is a
 * PENDING BUSINESS DECISION and is NOT handled by this function.
 * The caller must implement the expiry rule once confirmed.
 */
export function mergePlans(
  existingPlan: string | undefined | null,
  newPlan: PlanKey
): PlanKey {
  const existing = normalizePlan(existingPlan);
  if (!existing || existing === newPlan) return newPlan;
  if (
    (existing === "workout_coach" && newPlan === "nutritionist") ||
    (existing === "nutritionist"  && newPlan === "workout_coach") ||
    existing === "both"
  ) {
    return "both";
  }
  return newPlan;
}
