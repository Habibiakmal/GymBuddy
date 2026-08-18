import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { findUserByPhoneOrId, getUserSubscription } from "./db";

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

export async function requireAuthMiddleware(req: Request & { user?: AuthTokenPayload }, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // If no Bearer token, check for legacy phone param or header during transition
    const legacyPhone = req.params.phone || req.headers["x-user-phone"] as string;
    if (legacyPhone) {
      const user = await findUserByPhoneOrId(legacyPhone);
      if (user) {
        req.user = { userId: user.userId, phone: user.phone };
        return next();
      }
    }
    return res.status(401).json({ success: false, error: "Authentication required. Please log in." });
  }

  const token = authHeader.split(" ")[1];
  const payload = verifyAuthToken(token);
  if (!payload) {
    return res.status(401).json({ success: false, error: "Invalid or expired token. Please log in again." });
  }

  req.user = payload;
  next();
}

/**
 * Server-Side Subscription Entitlement Guard
 * Ensures a Plan 1 user cannot access Plan 2 features without active subscription in MongoDB.
 */
export function requireEntitlementMiddleware(requiredTier: "advanced" | "premium" | "any_paid") {
  return async (req: Request & { user?: AuthTokenPayload }, res: Response, next: NextFunction) => {
    const userPhone = req.user?.phone || req.params.phone || req.body?.phone;
    if (!userPhone) {
      return res.status(401).json({ success: false, error: "User authentication required" });
    }

    const sub = await getUserSubscription(userPhone);
    if (!sub) {
      // In trial window or free tier
      return next();
    }

    const now = new Date();
    const isExpired = sub.expiresAt && new Date(sub.expiresAt) < now;
    if (isExpired && sub.status === "active") {
      sub.status = "expired";
    }

    if (requiredTier === "premium" && sub.plan !== "premium" && sub.status === "active") {
      return res.status(403).json({
        success: false,
        error: "This feature requires the GymBuddy Premium (All-Access) plan. Upgrade to unlock.",
        requiredPlan: "premium",
        currentPlan: sub.plan
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
