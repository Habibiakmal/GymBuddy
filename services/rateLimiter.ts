import rateLimit from "express-rate-limit";
import { Request, Response } from "express";

/**
 * General API Rate Limiter
 * 60 requests per minute per IP
 */
export const generalRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => req.path.includes("webhook") || req.path.includes("health"),
  message: {
    success: false,
    error: "Too many requests. Please slow down and try again in a minute."
  }
});

/**
 * AI Endpoint Rate Limiter (Vision & Heavy AI)
 * 15 requests per minute per IP to protect from bot flooding and infinite loops.
 * (This is purely infrastructure protection, NOT a monthly user quota).
 */
export const aiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "AI analysis is processing quickly! Please wait a few seconds before submitting another request."
  }
});

/**
 * Authentication / Login / OTP Rate Limiter
 * 10 attempts per minute per IP to prevent brute-force attacks.
 */
export const authRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => req.path.includes("login-status") || req.path.includes("login-cancel"),
  message: {
    success: false,
    error: "Too many login attempts. Please wait a minute before trying again."
  }
});

/**
 * In-memory Request Deduplication Cache
 * Prevents identical duplicate requests sent within 3 seconds (e.g. double click on mobile).
 */
const recentRequests = new Map<string, number>();

export function isDuplicateRequest(key: string, cooldownMs: number = 3000): boolean {
  const now = Date.now();
  const lastTime = recentRequests.get(key);
  if (lastTime && now - lastTime < cooldownMs) {
    return true;
  }
  recentRequests.set(key, now);

  // Clean old keys every 100 entries
  if (recentRequests.size > 200) {
    for (const [k, time] of recentRequests.entries()) {
      if (now - time > 10000) {
        recentRequests.delete(k);
      }
    }
  }

  return false;
}
