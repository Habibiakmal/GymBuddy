import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { findUserByPhoneOrId, getUserSubscription, isAccountDeleted } from "./db";

const JWT_SECRET = process.env.JWT_SECRET || "gymbuddy_production_jwt_secret_key_2026_fitness";
const JWT_EXPIRES_IN = "30d";

export interface AuthTokenPayload {
  userId: string;
  phone: string;
  role?: string;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false;
  return await bcrypt.compare(password, hash);
}

export function generateAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
  } catch (e) {
    return null;
  }
}

import admin from "firebase-admin";
import { normalizePhoneToE164 } from "./phoneNormalizer";

export async function requireAuthMiddleware(req: Request & { user?: AuthTokenPayload }, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Authentication required. Please log in." });
  }

  const token = authHeader.split(" ")[1];

  // 1. Try GymBuddy JWT token
  const payload = verifyAuthToken(token);
  if (payload) {
    if (await isAccountDeleted(payload.phone) || (payload.userId && await isAccountDeleted(payload.userId))) {
      return res.status(401).json({
        success: false,
        error: "account_deleted",
        message: "Akun ini telah dihapus. Sesi Anda tidak lagi berlaku."
      });
    }
    req.user = payload;
    return next();
  }

  // 2. Try Firebase Auth ID token
  if (admin.apps.length > 0) {
    try {
      const decodedFirebase = await admin.auth().verifyIdToken(token);
      if (decodedFirebase) {
        const phone = decodedFirebase.phone_number || decodedFirebase.uid;
        if (await isAccountDeleted(phone) || await isAccountDeleted(decodedFirebase.uid)) {
          return res.status(401).json({
            success: false,
            error: "account_deleted",
            message: "Akun ini telah dihapus. Sesi Anda tidak lagi berlaku."
          });
        }
        const user = await findUserByPhoneOrId(phone);
        req.user = {
          userId: decodedFirebase.uid,
          phone: user ? user.phone : phone
        };
        return next();
      }
    } catch (firebaseErr) {
      // Not a valid Firebase token either
    }
  }

  return res.status(401).json({ success: false, error: "Invalid or expired authentication token. Please log in again." });
}

import {
  getUserSubscription as getCanonicalSubscription,
  getUserEntitlements,
  getPlanDisplayName,
  type CanonicalPlan
} from "./subscriptionEngine";

/**
 * Server-Side Subscription Entitlement Guard
 * Uses canonical subscriptionEngine as single source of truth.
 */
export function requireEntitlementMiddleware(requiredCapability: "nutrition" | "workout" | "both" | "advanced" | "premium" | "any_paid") {
  return async (req: Request & { user?: AuthTokenPayload }, res: Response, next: NextFunction) => {
    const userPhone = req.user?.phone || req.params.phone || req.body?.phone;
    if (!userPhone) {
      return res.status(401).json({ success: false, error: "User authentication required" });
    }

    const user = await findUserByPhoneOrId(String(userPhone));
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const sub = getCanonicalSubscription(user);
    if (!sub.isActive) {
      return res.status(403).json({
        success: false,
        error: "subscription_required",
        reason: sub.entitlements.reason,
        plan: sub.plan,
        isExpired: sub.isExpired,
        message: sub.isExpired
          ? `Masa aktif paket ${sub.planDisplayName} kamu telah berakhir.`
          : `Paket ${sub.planDisplayName} kamu belum aktif.`
      });
    }

    if ((requiredCapability === "nutrition" || requiredCapability === "advanced") && !sub.entitlements.canNutrition) {
      return res.status(403).json({
        success: false,
        error: "entitlement_unauthorized",
        plan: sub.plan,
        message: `Paket ${sub.planDisplayName} kamu tidak mencakup fitur nutrisi. Upgrade ke AI Nutritionist atau Premium.`
      });
    }

    if (requiredCapability === "workout" && !sub.entitlements.canWorkout) {
      return res.status(403).json({
        success: false,
        error: "entitlement_unauthorized",
        plan: sub.plan,
        message: `Paket ${sub.planDisplayName} kamu tidak mencakup fitur latihan. Upgrade ke AI Workout Coach atau Premium.`
      });
    }

    if ((requiredCapability === "both" || requiredCapability === "premium") && (!sub.entitlements.canNutrition || !sub.entitlements.canWorkout)) {
      return res.status(403).json({
        success: false,
        error: "entitlement_unauthorized",
        plan: sub.plan,
        message: `Fitur ini memerlukan Paket Premium (All-Access).`
      });
    }

    next();
  };
}

/**
 * Midtrans SHA-512 Signature Verification
 * Signature = SHA512(order_id + status_code + gross_amount + ServerKey)
 */
export function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  incomingSignature: string,
  serverKey: string
): boolean {
  if (!orderId || !statusCode || !grossAmount || !incomingSignature || !serverKey) {
    return false;
  }
  const cleanAmount = Number(grossAmount).toFixed(2);
  const candidatePayloads = [
    `${orderId}${statusCode}${grossAmount}${serverKey}`,
    `${orderId}${statusCode}${cleanAmount}${serverKey}`,
    `${orderId}${statusCode}${Math.round(Number(grossAmount))}${serverKey}`
  ];

  for (const payload of candidatePayloads) {
    const hash = crypto.createHash("sha512").update(payload).digest("hex");
    if (hash === incomingSignature) {
      return true;
    }
  }

  return false;
}

/**
 * User Data Ownership Guard Middleware
 * Ensures the authenticated user can only view or mutate their own records.
 */
export function requireOwnershipMiddleware(req: Request & { user?: AuthTokenPayload }, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: "Authentication required." });
  }
  const candidatePhones = [
    req.params?.phone,
    req.body?.phone,
    req.query?.phone,
    req.query?.user
  ].filter(Boolean) as string[];

  const canonicalUserPhone = normalizePhoneToE164(String(req.user.phone));

  for (const candidate of candidatePhones) {
    const canonicalTarget = normalizePhoneToE164(String(candidate));
    if (canonicalTarget && canonicalUserPhone && canonicalTarget !== canonicalUserPhone) {
      return res.status(403).json({ success: false, error: "Access denied. You can only access your own data." });
    }
  }
  next();
}

/**
 * Admin Role & Secret Key Guard Middleware
 */
export function requireAdminAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const adminKey = req.headers["x-admin-key"] || (req.headers["authorization"]?.startsWith("Bearer ") ? req.headers["authorization"].replace("Bearer ", "") : null);
  const expectedKey = process.env.ADMIN_API_KEY || "gymbuddy-secure-admin-key";
  if (!adminKey || adminKey !== expectedKey) {
    return res.status(403).json({ success: false, error: "Admin authorization required." });
  }
  next();
}
