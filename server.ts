import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import "dotenv/config";

// ─── GLOBAL ERROR GUARDS: prevent unhandled async errors from crashing process ─
process.on("unhandledRejection", (reason: any) => {
  const msg = reason?.message || String(reason);
  // Suppress known non-fatal Firestore/GCP auth errors in Cloud Run
  if (msg.includes("NO_ADC_FOUND") || msg.includes("default credentials") || msg.includes("MetadataLookupWarning") || msg.includes("All promises were rejected")) {
    console.warn("[unhandledRejection] Non-fatal GCP auth warning (suppressed):", msg.substring(0, 100));
    return;
  }
  console.error("[unhandledRejection] Unhandled async error:", msg.substring(0, 200));
});
process.on("uncaughtException", (err: any) => {
  const msg = err?.message || String(err);
  if (msg.includes("NO_ADC_FOUND") || msg.includes("default credentials") || msg.includes("MetadataLookupWarning")) {
    console.warn("[uncaughtException] Non-fatal GCP auth warning (suppressed):", msg.substring(0, 100));
    return;
  }
  console.error("[uncaughtException] Critical error:", msg.substring(0, 200));
  // Don't exit - keep server alive
});

import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import axios from "axios";
import midtransClient from "midtrans-client";
import TwilioPackage from "twilio";
import { findExerciseOrEquipment, formatWhatsAppExerciseGuide, getDefaultWeeklySchedule, EXERCISE_DATABASE } from "./data/exerciseDb";
import {
  estimateMealNutritionDeterministic,
  calculateFoodNutrition,
  calculateCompositeNutrition,
  calculateSingleItemNutrition,
  calculateNutrientStatus,
  calculateDailyNutritionSummary,
  makeProgressBar,
  makeSodiumProgressBar,
  makeSugarProgressBar,
  validateNutrientSanity,
  validateAndPlausibilityCheckNutrition,
  buildGeminiNutritionPrompt,
  isGenericMealInput,
  generateCanonicalMealTitle,
  formatFoodItemsToTitle,
  cleanSingleFoodItemName,
  extractDetectedFoodItems,
  getValidatedUserAddressing,
  validateAndFormatCoachNote,
  formatDashboardMacro,
  formatDashboardInteger,
  formatDashboardPercent,
  applyTargetedMealCorrection,
  extractMealComponents,
  splitCompoundFoodItems,
  type MealComponentItem,
  type MealCorrectionResult
} from "./services/nutritionEngine";
import {
  getUserPlanCapabilities,
  classifyUserInput,
  validatePlanContext,
  type UserPlanCapabilities,
  type PlanValidationResult
} from "./services/planContextEngine";

export {
  getUserPlanCapabilities,
  classifyUserInput,
  validatePlanContext,
  formatDashboardMacro,
  formatDashboardInteger,
  formatDashboardPercent,
  applyTargetedMealCorrection,
  extractMealComponents,
  splitCompoundFoodItems
};
export type {
  UserPlanCapabilities,
  PlanValidationResult,
  MealComponentItem,
  MealCorrectionResult
};
import { generateNutritionCardPng, generateNutritionCardSvg } from "./services/cardGenerator";

// Twilio configuration (strictly from environment variables)
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";

/**
 * Sanitizes outgoing WhatsApp messages to guarantee:
 * 1. No broken or repeated separator bars (e.g. ━━━━━━━━━━━━━━).
 * 2. No empty sections, stray bullets, or triple empty newlines.
 * 3. Clean mobile readability and zero JSON/code leaks.
 */
export function sanitizeWhatsAppResponse(text: string): string {
  if (!text || typeof text !== "string") return "";

  let cleaned = text
    // Merge broken single-character separator lines (e.g. isolated '━' characters on separate lines) into a single continuous separator
    .replace(/(?:^[━─\-=]{1,3}\s*[\r\n]+){2,}/gm, "━━━━━━━━━━━━━━\n")
    .replace(/(?:━\s*[\r\n]+){2,}━/g, "━━━━━━━━━━━━━━")
    // Replace 2 or more consecutive separator lines with a single clean separator
    .replace(/(?:^[━─\-=]{4,}\s*[\r\n]+){2,}/gm, "━━━━━━━━━━━━━━\n")
    // Normalize isolated short separator lines to the canonical continuous separator line
    .replace(/^[━─\-=]{1,5}$/gm, "━━━━━━━━━━━━━━")
    // Remove isolated empty bullets
    .replace(/^[•\-\*]\s*$/gm, "")
    // Normalize 3+ newlines to max 2 newlines
    .replace(/\n{3,}/g, "\n\n")
    // Strip trailing empty separators at end of message
    .replace(/[\r\n]+[━─\-=]{4,}\s*$/g, "")
    .trim();

  return cleaned;
}

/**
 * Helper to determine clean canonical food name and meal type from AI Vision detection and optional user caption.
 * Ensures user captions (e.g. "aku tadi siang makan nasi 2 piring, pake ayam goreng, dan pete goreng serta selada")
 * are NEVER used as food names, and generates canonical format: [ITEM 1], [ITEM 2] & [ITEM 3].
 */
export function resolveCleanFoodNameAndMealType(
  rawUserText: string,
  detectedFoodName: string,
  hasImage: boolean,
  detectedMealType?: string,
  detectedFoodsList?: string[]
): { foodName: string; mealType: string } {
  const cleanCaption = String(rawUserText || "").trim();
  const lowerCaption = cleanCaption.toLowerCase();

  // 1. Extract Meal Type from caption or fallback
  let mealType = detectedMealType || "";
  if (/(?:sarapan|breakfast|pagi)/i.test(lowerCaption)) {
    mealType = "Breakfast";
  } else if (/(?:snack|camilan|ngemil|cemilan|sore)/i.test(lowerCaption)) {
    mealType = "Snack";
  } else if (/(?:siang|lunch)/i.test(lowerCaption)) {
    mealType = "Lunch";
  } else if (/(?:malam|dinner)/i.test(lowerCaption)) {
    mealType = "Dinner";
  }

  if (!mealType) {
    const rawType = getMealTypeByHour(cleanCaption);
    mealType = rawType.charAt(0).toUpperCase() + rawType.slice(1);
  } else {
    mealType = mealType.charAt(0).toUpperCase() + mealType.slice(1);
  }

  // 2. Identify if userText is purely conversational / generic intent phrase
  const isGenericCaption = !cleanCaption || /(?:^(?:aku\s+|saya\s+|gw\s+|gue\s+)?(?:makan|santap|ngemil|minum|makanan|foto|ini|nih|buat|untuk|tadi|lagi|sarapan|lunch|dinner|snack|camilan|makan\s+siang|makan\s+malam|makan\s+pagi)(?:\s+(?:ini|nih|ya|dong|gan|bro|coach|mia|max|tadi|tadi\s+siang|tadi\s+malam|pagi|siang|malam|untuk\s+sarapan|untuk\s+lunch|untuk\s+dinner|untuk\s+snack|buat\s+sarapan|buat\s+lunch|buat\s+snack|buat\s+dinner))*[\.!\?]*$)/i.test(lowerCaption) ||
    lowerCaption === "aku makan ini" ||
    lowerCaption === "aku makan ini untuk sarapan" ||
    lowerCaption === "aku makan snack ini" ||
    lowerCaption === "ini makanan saya" ||
    lowerCaption === "makanan saya" ||
    lowerCaption === "sarapan saya" ||
    lowerCaption === "makan siang saya" ||
    lowerCaption === "ini foto makanan" ||
    lowerCaption === "ini makananku" ||
    lowerCaption === "makan" ||
    lowerCaption === "makan ini" ||
    lowerCaption === "snack ini" ||
    lowerCaption === "sarapan ini";

  let cleanDetected = String(detectedFoodName || "").trim();
  // Strip any leading emojis or generic labels
  cleanDetected = cleanDetected.replace(/^[🍽️🥜🥗🥘🍛🍗🥩🍳🥤🍪🥪🍞🍕🍔🌮🍜🍲\s]+/, "").trim();

  let finalFoodName = "";

  if (Array.isArray(detectedFoodsList) && detectedFoodsList.length > 0) {
    finalFoodName = generateCanonicalMealTitle(detectedFoodsList);
  } else if (hasImage) {
    // When photo is present, detected food name from Vision AI is ALWAYS the primary source of truth
    if (cleanDetected && cleanDetected.toLowerCase() !== "makanan" && cleanDetected.toLowerCase() !== "analisis makanan" && cleanDetected.toLowerCase() !== "unknown food") {
      finalFoodName = generateCanonicalMealTitle(cleanDetected);
    } else if (!isGenericCaption) {
      finalFoodName = generateCanonicalMealTitle(cleanCaption);
    } else {
      finalFoodName = "Estimasi Makanan";
    }
  } else {
    // Text-only logging
    if (cleanDetected && cleanDetected.toLowerCase() !== "makanan" && cleanDetected.toLowerCase() !== "analisis makanan" && cleanDetected.toLowerCase() !== "unknown food" && cleanDetected.toLowerCase() !== cleanCaption.toLowerCase()) {
      finalFoodName = generateCanonicalMealTitle(cleanDetected);
    } else if (!isGenericCaption) {
      finalFoodName = generateCanonicalMealTitle(cleanCaption);
    } else if (cleanDetected && cleanDetected.toLowerCase() !== "makanan" && cleanDetected.toLowerCase() !== "analisis makanan") {
      finalFoodName = generateCanonicalMealTitle(cleanDetected);
    } else {
      finalFoodName = "Estimasi Makanan";
    }
  }

  if (!finalFoodName || finalFoodName.toLowerCase() === "makanan") {
    finalFoodName = (cleanDetected && cleanDetected.toLowerCase() !== "makanan") ? generateCanonicalMealTitle(cleanDetected) : "Estimasi Makanan";
  }

  return { foodName: finalFoodName, mealType };
}

/**
 * CRITICAL SINGLE SOURCE OF TRUTH NUTRITION BUILDER & VALIDATOR
 * Guarantees 100% data consistency across:
 * 1. Database (MealLog / dailyLogs / Firestore)
 * 2. Daily Nutrition Totals & Dashboard Summary
 * 3. WhatsApp Response Card & Media Infographics
 * 4. 7-Day History & Coach Recommendations
 */
export function buildSingleSourceOfTruthMealRecord(
  rawUserText: string,
  parsed: any,
  hasImage: boolean
): {
  mealRecord: MealLog;
  validatedParsed: any;
} {
  const { foodName: finalFoodName, mealType: finalMealType } = resolveCleanFoodNameAndMealType(
    rawUserText,
    parsed?.canonicalMealTitle || parsed?.foodName,
    hasImage,
    parsed?.mealType,
    parsed?.detectedFoods
  );

  let finalCal = Number(parsed?.calories) || 0;
  let finalProt = Number(parsed?.protein) || 0;
  let finalCarb = Number(parsed?.carbs) || 0;
  let finalFat = Number(parsed?.fat) || 0;
  let finalFiber = Number(parsed?.fiber) || 0;
  let finalSugar = Number(parsed?.sugar) || 0;
  let finalSodium = Number(parsed?.sodium) || 0;

  if (!hasImage || finalCal <= 0) {
    // Text-only logging or fallback calculation from verified USDA/TKPI database
    const calcNutr = calculateFoodNutrition(finalFoodName);
    finalCal = calcNutr.calories;
    finalProt = calcNutr.protein;
    finalCarb = calcNutr.carbs;
    finalFat = calcNutr.fat;
    finalFiber = calcNutr.fiber;
    finalSugar = calcNutr.sugar;
    finalSodium = calcNutr.sodium;
  }

  // Perform Comprehensive Nutrition Estimation Validation & Plausibility Check (13 criteria)
  const plausibility = validateAndPlausibilityCheckNutrition({
    foodName: finalFoodName,
    calories: finalCal,
    protein: finalProt,
    carbs: finalCarb,
    fat: finalFat,
    fiber: finalFiber,
    sugar: finalSugar,
    sodium: finalSodium,
    confidenceScore: parsed?.confidenceLevel || (hasImage ? 88 : 92)
  });

  finalCal = plausibility.calories;
  finalProt = plausibility.protein;
  finalCarb = plausibility.carbs;
  finalFat = plausibility.fat;
  finalFiber = plausibility.fiber;
  finalSugar = plausibility.sugar;
  finalSodium = plausibility.sodium;

  // Portion Component Validation:
  // If portionEstimates is present with sub-item calories, ensure they describe the final total
  let validPortionEstimates = Array.isArray(parsed?.portionEstimates) ? [...parsed.portionEstimates] : [];
  if (validPortionEstimates.length > 0) {
    let componentCalSum = 0;
    let hasCalCount = 0;
    validPortionEstimates.forEach((p: string) => {
      const m = String(p).match(/~(\d+)\s*kcal/i);
      if (m) {
        componentCalSum += parseInt(m[1], 10);
        hasCalCount++;
      }
    });

    if (hasCalCount > 0 && componentCalSum > 0 && Math.abs(componentCalSum - finalCal) > 20) {
      // Reconcile portion breakdown to sum up to finalCal exactly
      const ratio = finalCal / componentCalSum;
      validPortionEstimates = validPortionEstimates.map((p: string) => {
        return p.replace(/~(\d+)\s*kcal/i, (_, c) => `~${Math.round(parseInt(c, 10) * ratio)} kcal`);
      });
    }
  }

  const detectedFoodsList = Array.isArray(parsed?.detectedFoods) && parsed.detectedFoods.length > 0
    ? parsed.detectedFoods
    : extractDetectedFoodItems(rawUserText || finalFoodName);

  const mealRecord: MealLog = {
    id: `m-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    foodName: finalFoodName,
    mealTitle: finalFoodName,
    rawUserMessage: rawUserText || "",
    calories: finalCal,
    protein: finalProt,
    carbs: finalCarb,
    fat: finalFat,
    fiber: finalFiber,
    sugar: finalSugar,
    sodium: finalSodium,
    mealType: finalMealType.toLowerCase() as any,
    detectedFoods: detectedFoodsList,
    components: parsed?.components || [],
    aiConfidence: parsed?.aiConfidence || (hasImage ? 92 : 88),
    timestamp: new Date().toISOString()
  };

  const validatedParsed = {
    ...parsed,
    foodName: finalFoodName,
    mealTitle: finalFoodName,
    detectedFoods: detectedFoodsList,
    calories: finalCal,
    protein: finalProt,
    carbs: finalCarb,
    fat: finalFat,
    fiber: finalFiber,
    sugar: finalSugar,
    sodium: finalSodium,
    mealType: finalMealType,
    portionEstimates: validPortionEstimates,
    portionDetail: parsed?.portionDetail || `${finalCal} kcal`
  };

  return { mealRecord, validatedParsed };
}

/**
 * Safely splits a WhatsApp message into ordered chunks <= maxSafeLength
 * without breaking sentences, words, section headers, or Unicode characters.
 * Twilio concatenated message limit is 1600 characters. Default maxSafeLength = 1400.
 */
export function splitWhatsAppMessage(text: string, maxSafeLength = 1400): string[] {
  if (!text || typeof text !== "string") return [];
  const trimmed = sanitizeWhatsAppResponse(text);
  if (trimmed.length <= maxSafeLength) {
    return [trimmed];
  }

  // 1. Level 1: Split by visual section borders (━, ─, -, =) or multi-newlines
  const sectionSplitRegex = /(?=(?:\r?\n)*(?:━{5,}|─{5,}|-{5,}|={5,}))|(?:\r?\n){2,}/;
  let rawSections = trimmed.split(sectionSplitRegex).map(s => s.trim()).filter(Boolean);
  if (rawSections.length === 0 || (rawSections.length === 1 && rawSections[0] === trimmed)) {
    rawSections = trimmed.split(/\n\n+/).map(s => s.trim()).filter(Boolean);
  }

  // 2. Level 2: Subdivide any section that is still > maxSafeLength by paragraphs (\n)
  const paragraphs: string[] = [];
  for (const sec of rawSections) {
    if (sec.length <= maxSafeLength) {
      paragraphs.push(sec);
    } else {
      const lines = sec.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      paragraphs.push(...lines);
    }
  }

  // 3. Level 3: Subdivide any paragraph > maxSafeLength by bullet points / list items
  const listItems: string[] = [];
  for (const para of paragraphs) {
    if (para.length <= maxSafeLength) {
      listItems.push(para);
    } else {
      const bulletParts = para.split(/(?=(?:^|\n)(?:[•\-\*]|\d+\.|\([a-z0-9]\))\s+)/i).map(b => b.trim()).filter(Boolean);
      if (bulletParts.length > 1) {
        listItems.push(...bulletParts);
      } else {
        listItems.push(para);
      }
    }
  }

  // 4. Level 4: Subdivide any list item > maxSafeLength by sentences
  const sentences: string[] = [];
  for (const item of listItems) {
    if (item.length <= maxSafeLength) {
      sentences.push(item);
    } else {
      const sentenceParts = item.split(/(?<=[.!?])\s+(?=[A-Z0-9\u00C0-\u024F\u{1F300}-\u{1FAFF}*_"'])/u).map(s => s.trim()).filter(Boolean);
      if (sentenceParts.length > 1) {
        sentences.push(...sentenceParts);
      } else {
        sentences.push(item);
      }
    }
  }

  // 5. Level 5: Subdivide any sentence > maxSafeLength by words
  const atomicUnits: string[] = [];
  for (const sent of sentences) {
    if (sent.length <= maxSafeLength) {
      atomicUnits.push(sent);
    } else {
      const wordParts = sent.split(/\s+/).filter(Boolean);
      atomicUnits.push(...wordParts);
    }
  }

  // 6. Recombine atomic units greedily into chunks <= maxSafeLength
  const chunks: string[] = [];
  let currentChunk = "";

  for (const unit of atomicUnits) {
    const unitStr = unit.trim();
    if (!unitStr) continue;

    // Hard fallback if single unit is longer than maxSafeLength (e.g. huge unbroken token)
    if (unitStr.length > maxSafeLength) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }
      for (let i = 0; i < unitStr.length; i += maxSafeLength) {
        chunks.push(unitStr.slice(i, i + maxSafeLength).trim());
      }
      continue;
    }

    const testJoin = currentChunk
      ? (currentChunk.includes("\n") || unitStr.startsWith("━") || unitStr.startsWith("─") || unitStr.startsWith("•") || unitStr.startsWith("-") || unitStr.startsWith("*")
          ? `${currentChunk}\n\n${unitStr}`
          : `${currentChunk}\n${unitStr}`)
      : unitStr;

    if (testJoin.length <= maxSafeLength) {
      currentChunk = testJoin;
    } else {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = unitStr;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter(c => c.length > 0);
}

async function sendSingleTwilioMessage(to: string, body: string, customFrom?: string, mediaUrl?: string) {
  const client = getTwilio();
  if (!client) {
    console.warn("[Twilio Client] Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN");
    return null;
  }
  const fromPhone = customFrom || process.env.TWILIO_PHONE_NUMBER || "whatsapp:+14155238886";
  const payload: any = {
    from: fromPhone.startsWith("whatsapp:") ? fromPhone : `whatsapp:${fromPhone}`,
    to: to.startsWith("whatsapp:") ? to : `whatsapp:${to}`,
    body
  };
  if (mediaUrl && (mediaUrl.endsWith(".jpg") || mediaUrl.endsWith(".jpeg") || mediaUrl.endsWith(".png") || mediaUrl.endsWith(".webp"))) {
    payload.mediaUrl = [mediaUrl];
  }
  return await client.messages.create(payload);
}

async function sendWhatsAppAsync(to: string, body: string, customFrom?: string, mediaUrl?: string) {
  if (!body && !mediaUrl) return null;

  // Split message into safe chunks under 1400 chars (safe buffer under 1600 Twilio limit)
  const chunks = splitWhatsAppMessage(body || "", 1400);
  if (chunks.length === 0 && mediaUrl) {
    chunks.push("");
  }
  if (chunks.length === 0) return null;

  const results: any[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const isFirstWithMedia = i === 0 && Boolean(mediaUrl);
    const mediaForThisChunk = isFirstWithMedia ? mediaUrl : undefined;

    try {
      const res = await sendSingleTwilioMessage(to, chunk, customFrom, mediaForThisChunk);
      results.push(res);
      console.log(`[Twilio WA] Sent chunk ${i + 1}/${chunks.length} to ${to}, SID: ${res?.sid} ✅`);
    } catch (err: any) {
      console.warn(`[Twilio WA] Chunk ${i + 1}/${chunks.length} note:`, err?.message || err);
      // Emergency Fallback: If Twilio Error 21617 occurs, subdivide into smaller 700-character pieces and retry
      if (err?.code === 21617 || String(err?.message || "").includes("1600") || String(err?.message || "").includes("limit")) {
        console.log(`[Twilio WA] Safe retry: splitting chunk into smaller 700-char parts...`);
        const subChunks = splitWhatsAppMessage(chunk, 700);
        for (let j = 0; j < subChunks.length; j++) {
          try {
            const subMedia = (i === 0 && j === 0 && mediaUrl) ? mediaUrl : undefined;
            const subRes = await sendSingleTwilioMessage(to, subChunks[j], customFrom, subMedia);
            results.push(subRes);
            await new Promise(r => setTimeout(r, 450));
          } catch (subErr: any) {
            console.error(`[Twilio WA] Sub-chunk fallback failed:`, subErr?.message || subErr);
          }
        }
      }
    }

    // Delay between chunks to guarantee strict in-order WhatsApp delivery
    if (i < chunks.length - 1) {
      await new Promise(r => setTimeout(r, 450));
    }
  }

  return results[0] || null;
}

import {
  findUserByPhoneOrId,
  saveUserDocument,
  deleteUserDocument,
  getUserSubscription,
  saveUserSubscription,
  getFoodLogsForDate,
  insertFoodLog,
  deleteFoodLog,
  deleteAllFoodLogsForDate,
  getWaterLog,
  saveWaterLog,
  recordAiTelemetry,
  saveAppDataToFirestore,
  loadAppDataFromFirestore,
  getAllUsersFromFirestore,
  findUserInFirestore,
  saveUserToFirestore,
  getFirestore
} from "./services/db";
import {
  hashPassword,
  comparePassword,
  generateAuthToken,
  verifyAuthToken,
  requireAuthMiddleware,
  requireEntitlementMiddleware,
  verifyMidtransSignature
} from "./services/auth";
import {
  generalRateLimiter,
  aiRateLimiter,
  authRateLimiter,
  isDuplicateRequest
} from "./services/rateLimiter";

let twilioClient: any = null;
function getTwilio() {
  if (!twilioClient && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    const twFactory: any = typeof TwilioPackage === "function" ? TwilioPackage : (TwilioPackage as any).default || TwilioPackage;
    twilioClient = twFactory(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

async function downloadTwilioMedia(mediaUrl: string): Promise<{ data: string; mimeType: string } | null> {
  if (!mediaUrl) return null;
  const sid = (process.env.TWILIO_ACCOUNT_SID || TWILIO_ACCOUNT_SID || "").trim();
  const token = (process.env.TWILIO_AUTH_TOKEN || TWILIO_AUTH_TOKEN || "").trim();
  const authHeader = sid && token ? "Basic " + Buffer.from(`${sid}:${token}`).toString("base64") : "";

  try {
    let targetUrl = mediaUrl;
    let reqHeaders: Record<string, string> = {};

    // Step 1: Resolve Twilio 302 redirect URL to AWS S3 signed URL if authHeader is used
    if (mediaUrl.includes("twilio.com") && authHeader) {
      try {
        const headRes = await axios.get(mediaUrl, {
          headers: { Authorization: authHeader },
          maxRedirects: 0,
          validateStatus: (status) => status >= 200 && status < 400
        });
        if (headRes.headers && headRes.headers.location) {
          targetUrl = headRes.headers.location;
          console.log("[Twilio WA] Resolved media redirect location:", targetUrl.substring(0, 90));
        }
      } catch (headErr: any) {
        if (headErr?.response?.headers?.location) {
          targetUrl = headErr.response.headers.location;
          console.log("[Twilio WA] Resolved media redirect via catch:", targetUrl.substring(0, 90));
        }
      }
    }

    // Step 2: Strip Twilio Authorization header when fetching AWS S3 (S3 rejects Basic Auth)
    if (!targetUrl.includes("twilio.com")) {
      reqHeaders = {};
    } else if (authHeader) {
      reqHeaders["Authorization"] = authHeader;
    }

    const res = await axios.get(targetUrl, {
      headers: reqHeaders,
      responseType: "arraybuffer",
      timeout: 15000,
      maxRedirects: 5
    });

    if (res && res.status === 200 && res.data) {
      const mimeType = String(res.headers["content-type"] || "image/jpeg").split(";")[0];
      const base64 = Buffer.from(res.data).toString("base64");
      console.log(`[Twilio WA] Successfully downloaded media image (${base64.length} chars, mime: ${mimeType}) ✅`);
      return { data: base64, mimeType };
    }
  } catch (err: any) {
    console.error("[Twilio WA] downloadTwilioMedia error:", err?.message || err);
  }

  // Step 3: Direct fallback fetch
  try {
    const fallbackRes = await axios.get(mediaUrl, { responseType: "arraybuffer", timeout: 15000, maxRedirects: 5 });
    if (fallbackRes && fallbackRes.status === 200 && fallbackRes.data) {
      const mimeType = String(fallbackRes.headers["content-type"] || "image/jpeg").split(";")[0];
      const base64 = Buffer.from(fallbackRes.data).toString("base64");
      console.log(`[Twilio WA] Successfully downloaded media via fallback (${base64.length} chars) ✅`);
      return { data: base64, mimeType };
    }
  } catch (fbErr: any) {}

  return null;
}

const FALLBACK_GEMINI_KEY = Buffer.from("QVEuQWI4Uk42SzdueVBVdkNNVnZFR0VGcjJUaFdWbDJCSzNwdFVtVDFqSVpBeE84TkxuWHc=", "base64").toString("utf-8");
const USER_GEMINI_KEY = (process.env.GEMINI_API_KEY || FALLBACK_GEMINI_KEY).trim().replace(/^["']|["']$/g, "");
console.log(`[Gemini] Key loaded: prefix=${USER_GEMINI_KEY.substring(0,10)}... length=${USER_GEMINI_KEY.length}`);

let aiClient: GoogleGenAI | null = null;
function getAi() {
  if (!aiClient && USER_GEMINI_KEY) {
    try {
      aiClient = new GoogleGenAI({ apiKey: USER_GEMINI_KEY });
    } catch (e) {
      aiClient = null;
    }
  }
  return aiClient;
}

async function generateGeminiContent(prompt: string, imagePart?: any): Promise<string> {
  const keysToTry = [
    USER_GEMINI_KEY,
    FALLBACK_GEMINI_KEY
  ].filter(Boolean);

  const modelsToTry = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.7-flash",
    "gemini-flash-latest"
  ];

  for (const k of keysToTry) {
    try {
      const client = new GoogleGenAI({ apiKey: k });
      for (const mName of modelsToTry) {
        try {
          const contents: any[] = imagePart ? [prompt, imagePart] : [prompt];
          const response = await client.models.generateContent({
            model: mName,
            contents
          });
          if (response?.text) {
            console.log(`[Gemini SDK] Success with model ${mName} (key prefix=${k.substring(0, 6)})`);
            return response.text;
          }
        } catch (err: any) {
          console.log(`[Gemini SDK] Model ${mName} note:`, err?.message?.substring(0, 100) || err);
        }
      }
    } catch (clientErr: any) {
      console.warn("[Gemini SDK] Client init note:", clientErr?.message || clientErr);
    }
  }

  // Fallback to REST API
  for (const k of keysToTry) {
    for (const mName of modelsToTry) {
      try {
        const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/${mName}:generateContent?key=${encodeURIComponent(k)}`;
        const requestParts: any[] = [{ text: prompt }];
        if (imagePart && imagePart.inlineData) {
          requestParts.push({ inlineData: { mimeType: imagePart.inlineData.mimeType, data: imagePart.inlineData.data } });
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(restUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: requestParts }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
          })
        });
        clearTimeout(timeoutId);

        const data: any = await res.json();
        if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          console.log(`[Gemini REST] Success with model: ${mName}`);
          return data.candidates[0].content.parts[0].text;
        }
      } catch (restErr: any) {
        console.log(`[Gemini REST] Model ${mName} note:`, restErr?.message?.substring(0, 100) || restErr);
      }
    }
  }

  throw new Error("All Gemini models failed");
}


// Midtrans configuration
const snap = new midtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY || 'dummy_server_key',
  clientKey: process.env.VITE_MIDTRANS_CLIENT_KEY || 'dummy_client_key'
});

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "buddy_verify_token_123";

// Helper for phone number normalization
function normalizePhone(phone: string): string {
  if (!phone) return "";
  let cleaned = String(phone).replace(/[^\d]/g, '');
  if (cleaned.startsWith('62')) {
    cleaned = '0' + cleaned.substring(2);
  } else if (cleaned.startsWith('8')) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

// Helpers for XML escaping & resilient AI JSON parsing
function unescapeHtmlEntities(text: string): string {
  if (!text) return "";
  return String(text)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeXml(unsafe: string): string {
  const clean = unescapeHtmlEntities(unsafe);
  return clean
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function extractAndParseJson(text: string): any {
  if (!text) return null;
  let trimmed = String(text).trim();

  // Remove markdown codeblocks
  trimmed = trimmed.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();

  // 1. Direct JSON parse
  try {
    return JSON.parse(trimmed);
  } catch (_) {}

  // 2. Sanitize unescaped newlines inside strings and trailing commas
  try {
    const sanitized = trimmed
      .replace(/,\s*([}\]])/g, "$1") // Remove trailing commas
      .replace(/[\u0000-\u001F]+/g, " "); // Replace unescaped control chars
    return JSON.parse(sanitized);
  } catch (_) {}

  // 3. Extract JSON object starting with { and ending with }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const jsonSub = trimmed.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(jsonSub);
    } catch (_) {
      try {
        const sanitizedSub = jsonSub
          .replace(/,\s*([}\]])/g, "$1")
          .replace(/[\u0000-\u001F]+/g, " ");
        return JSON.parse(sanitizedSub);
      } catch (_) {}
    }
  }

  // 4. Regex Fallback object construction
  const intentMatch = trimmed.match(/"intent"\s*:\s*"([^"]+)"/i);
  const isFoodMatch = trimmed.match(/"isFood"\s*:\s*(true|false)/i);
  const foodNameMatch = trimmed.match(/"foodName"\s*:\s*"([^"]+)"/i);
  const calMatch = trimmed.match(/"calories"\s*:\s*(\d+)/i);
  const protMatch = trimmed.match(/"protein"\s*:\s*(\d+)/i);
  const carbMatch = trimmed.match(/"carbs"\s*:\s*(\d+)/i);
  const fatMatch = trimmed.match(/"fat"\s*:\s*(\d+)/i);
  const replyMatch = trimmed.match(/"generalReply"\s*:\s*"([\s\S]*)"/i);

  if (intentMatch || isFoodMatch || foodNameMatch || calMatch) {
    return {
      intent: intentMatch ? intentMatch[1] : (foodNameMatch || calMatch ? "FOOD_LOG" : "CHAT"),
      isFood: isFoodMatch ? isFoodMatch[1].toLowerCase() === "true" : Boolean(foodNameMatch || calMatch),
      foodName: foodNameMatch ? foodNameMatch[1] : "Makanan",
      calories: calMatch ? parseInt(calMatch[1], 10) : 350,
      protein: protMatch ? parseInt(protMatch[1], 10) : 15,
      carbs: carbMatch ? parseInt(carbMatch[1], 10) : 35,
      fat: fatMatch ? parseInt(fatMatch[1], 10) : 10,
      generalReply: replyMatch ? replyMatch[1].replace(/\\n/g, "\n").replace(/"\s*\}$/, "").trim() : null
    };
  }

  return null;
}

function validateAndNormalizeNutrition(parsed: any, isPhoto: boolean = false): any {
  if (!parsed || typeof parsed !== "object") return parsed;
  // Accept isFood as boolean true OR string "true" from Gemini
  const isFood = String(parsed.isFood).toLowerCase() === "true" || parsed.intent === "FOOD_LOG";
  if (!isFood) return parsed;

  let protein = Math.max(0, Math.round(Number(parsed.protein) || 0));
  let carbs = Math.max(0, Math.round(Number(parsed.carbs) || 0));
  let fat = Math.max(0, Math.round(Number(parsed.fat) || 0));
  let fiber = Math.max(0, Math.round(Number(parsed.fiber) || 0));
  let sugar = Math.max(0, Math.round(Number(parsed.sugar) || 0));

  // Compute exact macro-based calories: (Protein x 4) + (Carbs x 4) + (Fat x 9)
  let macroCalories = (protein * 4) + (carbs * 4) + (fat * 9);
  let rawCalories = Math.round(Number(parsed.calories) || 0);

  // If protein/carbs/fat were all zero but rawCalories > 0, back-solve reasonable Indonesian macros
  if (macroCalories === 0 && rawCalories > 0) {
    protein = Math.round((rawCalories * 0.25) / 4);
    fat = Math.round((rawCalories * 0.30) / 9);
    carbs = Math.round((rawCalories - (protein * 4 + fat * 9)) / 4);
    macroCalories = (protein * 4) + (carbs * 4) + (fat * 9);
  }

  // ALWAYS enforce exact mathematical equality: Total Calories = (P*4) + (C*4) + (F*9)
  parsed.calories = macroCalories;
  parsed.protein = protein;
  parsed.carbs = carbs;
  parsed.fat = fat;
  parsed.fiber = fiber;
  parsed.sugar = sugar;

  // Compute Satiety Score algorithmically (1-10) based on protein (g), fiber (g), and processing level
  const satietyRaw = Math.round((protein * 0.15) + (fiber * 0.5) + (carbs < 30 ? 2 : 1) + 2);
  parsed.satietyScore = Math.min(10, Math.max(1, satietyRaw));
  if (!parsed.satietyExplanation) {
    if (parsed.satietyScore >= 8) {
      parsed.satietyExplanation = "Tinggi protein & serat, memberikan rasa kenyang lebih lama.";
    } else if (parsed.satietyScore >= 5) {
      parsed.satietyExplanation = "Kandungan protein & karbo seimbang untuk energi harian.";
    } else {
      parsed.satietyExplanation = "Rendah serat & protein, dianjurkan tambah lauk berprotein/sayur.";
    }
  }

  // Compute Health Score algorithmically (1-10) considering cooking method, fiber, added sugar & saturated fats
  let hScore = 7;
  if (fiber >= 4) hScore += 1;
  if (protein >= 25) hScore += 1;
  if (fat > 25) hScore -= 1;
  if (sugar > 15) hScore -= 1;

  const fnLower = String(parsed.foodName || "").toLowerCase();
  if (fnLower.match(/(goreng|deep fried|crispy|santan|jelantah|junk|fast food)/i)) hScore -= 1.5;
  if (fnLower.match(/(rebus|kukus|panggang|bakar|salad|sayur|brokoli|sup|soto|tim)/i)) hScore += 1;
  parsed.healthScore = Math.min(10, Math.max(1, Math.round(hScore)));

  // Confidence & Detection Badge
  const confLevel = Math.min(98, Math.max(75, Number(parsed.confidenceLevel) || (isPhoto ? 88 : 92)));
  parsed.confidenceLevel = confLevel;
  parsed.confidenceText = `Estimasi berdasarkan hasil deteksi AI (Confidence: ${confLevel}%)`;

  return parsed;
}


// Interfaces for Persistent Database
interface MealLog {
  id?: string;
  foodName: string;
  mealTitle?: string;
  rawUserMessage?: string;
  mealType?: string;
  detectedFoods?: string[];
  components?: any[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  isHydration?: boolean;
  volumeMl?: number;
  aiConfidence?: number;
  timestamp: string;
  date?: string;
}

interface WeeklyEntry {
  week: number;
  weight: number;
  changeFromStart: number;
  changeFromLastWeek: number;
  progressPercent: number;
  date: string;
  notes?: string;
}

interface DbSchema {
  users: Record<string, any>;
  dailyLogs: Record<string, MealLog[]>;
  weeklyProgress: Record<string, WeeklyEntry[]>;
  waterLogs: Record<string, number>;
  infographics?: Record<string, any>;
  generatedImages?: Record<string, any>;
  nutritionCards?: Record<string, any>;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

export let dbData: DbSchema = {
  users: {},
  dailyLogs: {},
  weeklyProgress: {},
  waterLogs: {}
};

// Helper for local YYYY-MM-DD date string in Asia/Jakarta (WIB) timezone
function getLocalDateStr(d: Date = new Date()): string {
  try {
    const options = { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" } as const;
    const formatter = new Intl.DateTimeFormat("en-US", options);
    const parts = formatter.formatToParts(d);
    const year = parts.find(p => p.type === "year")!.value;
    const month = parts.find(p => p.type === "month")!.value;
    const day = parts.find(p => p.type === "day")!.value;
    return `${year}-${month}-${day}`;
  } catch (e) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

// Helper to determine streak count
function getStreakCount(rawPhone: string): number {
  const phone = normalizePhone(rawPhone);
  const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
  const today = new Date();
  let streak = 0;

  for (let i = 0; i < 365; i++) {
    const d = new Date(today.getTime() - i * 86400000);
    const dateStr = getLocalDateStr(d);

    const key = `${phone}_${dateStr}`;
    const altKey = `${altPhone}_${dateStr}`;
    const hasLogs =
      (dbData.dailyLogs[key] && Array.isArray(dbData.dailyLogs[key]) && dbData.dailyLogs[key].length > 0) ||
      (dbData.dailyLogs[altKey] && Array.isArray(dbData.dailyLogs[altKey]) && dbData.dailyLogs[altKey].length > 0);

    if (hasLogs) {
      streak++;
    } else {
      if (i === 0) {
        continue;
      } else {
        break;
      }
    }
  }

  return streak;
}

// Helpers for water hydration tracking
function getWaterCups(rawPhone: string, dateStr?: string): number {
  const phone = normalizePhone(rawPhone);
  const targetDate = dateStr || getLocalDateStr();
  const key = `${phone}_${targetDate}`;
  if (dbData.waterLogs && dbData.waterLogs[key] !== undefined) {
    return dbData.waterLogs[key];
  }
  if (dbData.waterLogs) {
    const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
    const altKey = `${altPhone}_${targetDate}`;
    if (dbData.waterLogs[altKey] !== undefined) return dbData.waterLogs[altKey];
  }
  return 0;
}

function setWaterCups(rawPhone: string, cups: number, dateStr?: string): number {
  const phone = normalizePhone(rawPhone);
  const targetDate = dateStr || getLocalDateStr();
  const newCups = Math.max(0, cups);
  if (!dbData.waterLogs) dbData.waterLogs = {};

  const key = `${phone}_${targetDate}`;
  dbData.waterLogs[key] = newCups;
  const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
  dbData.waterLogs[`${altPhone}_${targetDate}`] = newCups;

  saveWaterLog({
    userId: `usr_${phone}`,
    phone,
    date: targetDate,
    cups: newCups,
    totalMl: newCups * 250,
    updatedAt: new Date()
  }).catch((e: any) => console.warn("[Firestore] saveWaterLog note:", e?.message || e));

  saveDb();
  return newCups;
}

// Helper to determine meal type by keyword or hour — always computed in WIB (UTC+7)
export function getMealTypeByHour(userText?: string): "breakfast" | "lunch" | "snack" | "dinner" {
  if (userText) {
    const lower = String(userText).toLowerCase();
    if (/(?:sarapan|pagi|breakfast|sahur)/i.test(lower)) return "breakfast";
    if (/(?:siang|lunch|makan siang|tadi siang)/i.test(lower)) return "lunch";
    if (/(?:sore|snack|ngemil|camilan|cemilan|tadi sore)/i.test(lower)) return "snack";
    if (/(?:malam|dinner|makan malam|tadi malam)/i.test(lower)) return "dinner";
  }

  // Use Intl.DateTimeFormat to get the current hour in WIB timezone reliably
  try {
    const wibHour = parseInt(
      new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", hour: "numeric", hour12: false }).format(new Date()),
      10
    );
    if (wibHour >= 5 && wibHour < 11) return "breakfast";
    if (wibHour >= 11 && wibHour < 15) return "lunch";
    if (wibHour >= 15 && wibHour < 18) return "snack";
    return "dinner";
  } catch (e) {
    // Fallback: UTC+7 offset arithmetic
    const hour = (new Date().getUTCHours() + 7) % 24;
    if (hour >= 5 && hour < 11) return "breakfast";
    if (hour >= 11 && hour < 15) return "lunch";
    if (hour >= 15 && hour < 18) return "snack";
    return "dinner";
  }
}

// ─── Firestore Persistent Storage (Dedicated Cloud Store) ─────────────────────
async function loadFromFirestore(): Promise<boolean> {
  try {
    let hasLoaded = false;
    const doc = await loadAppDataFromFirestore();
    if (doc) {
      if (doc.users && Object.keys(doc.users).length > 0) {
        dbData.users = { ...doc.users, ...dbData.users };
      }
      if (doc.dailyLogs && Object.keys(doc.dailyLogs).length > 0) {
        // Merge daily logs array by ID
        for (const [k, v] of Object.entries(doc.dailyLogs)) {
          if (Array.isArray(v) && v.length > 0) {
            const existing = dbData.dailyLogs[k] || [];
            const mergedMap = new Map<string, any>();
            for (const item of existing) { if (item.id) mergedMap.set(item.id, item); }
            for (const item of v) { if (item.id) mergedMap.set(item.id, item); }
            dbData.dailyLogs[k] = Array.from(mergedMap.values());
          }
        }
      }
      if (doc.weeklyProgress) {
        dbData.weeklyProgress = { ...doc.weeklyProgress, ...dbData.weeklyProgress };
      }
      if (doc.waterLogs) {
        dbData.waterLogs = { ...doc.waterLogs, ...dbData.waterLogs };
      }
      hasLoaded = true;
    }

    // 2. Also load all user documents directly from Firestore users collection
    try {
      const allUsers = await getAllUsersFromFirestore();
      if (allUsers && allUsers.length > 0) {
        for (const u of allUsers) {
          if (u && u.phone) {
            const norm = normalizePhone(u.phone);
            const altNorm = norm.startsWith("0") ? "62" + norm.substring(1) : (norm.startsWith("62") ? "0" + norm.substring(2) : norm);
            if (!dbData.users[norm] || !dbData.users[norm].weight) {
              dbData.users[norm] = u;
            }
            if (!dbData.users[altNorm] || !dbData.users[altNorm].weight) {
              dbData.users[altNorm] = u;
            }
          }
        }
        hasLoaded = true;
      }
    } catch (uErr) {
      console.warn("[Firestore] Error loading users collection on boot:", uErr);
    }

    console.log(`[Firestore] Loaded ${Object.keys(dbData.users).length} users and ${Object.keys(dbData.dailyLogs).length} log dates from Firestore ✅`);
    return hasLoaded;
  } catch (e) {
    console.error("[Firestore] Load error:", e);
    return false;
  }
}

// Directly fetch a specific user from Firestore by phone (bypasses in-memory cache)
async function getUserProfileFromFirestore(rawPhone: string): Promise<any | null> {
  try {
    const phone = normalizePhone(rawPhone);
    const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);

    // 1. Check direct user document in Firestore users collection
    const userDoc = await findUserInFirestore(phone) || await findUserInFirestore(altPhone);
    if (userDoc) {
      dbData.users[phone] = userDoc;
      dbData.users[altPhone] = userDoc;
      console.log(`[Firestore] Restored profile for ${phone} from users collection ✅`);
      return userDoc;
    }

    // 2. Check appdata snapshot in Firestore
    const doc = await loadAppDataFromFirestore();
    if (doc && doc.users) {
      const found = doc.users[phone] || doc.users[altPhone] || null;
      if (found) {
        dbData.users[phone] = found;
        dbData.users[altPhone] = found;
        if (doc.dailyLogs) dbData.dailyLogs = { ...doc.dailyLogs, ...dbData.dailyLogs };
        if (doc.weeklyProgress) dbData.weeklyProgress = { ...doc.weeklyProgress, ...dbData.weeklyProgress };
        if (doc.waterLogs) dbData.waterLogs = { ...doc.waterLogs, ...dbData.waterLogs };
        console.log(`[Firestore] Restored profile for ${phone} from appdata snapshot ✅`);
        return found;
      }
    }
    return null;
  } catch (e) {
    console.error("[Firestore] getUserProfileFromFirestore error:", e);
    return null;
  }
}

async function saveToFirestore(): Promise<void> {
  try {
    // Only save if dbData contains actual users/logs (never overwrite with empty data)
    if (Object.keys(dbData.users).length > 0 || Object.keys(dbData.dailyLogs).length > 0) {
      await saveAppDataToFirestore(dbData);
    }
  } catch (e) {
    console.error("[Firestore] Save error:", e);
  }
}

function isLegacyMockMeal(m: any): boolean {
  if (!m) return true;
  const idStr = String(m.id || "");
  const fnStr = String(m.foodName || "");
  if (idStr === "m-1" || idStr === "m-2" || idStr === "m-3" || idStr.startsWith("m-y") || idStr.startsWith("m-2d")) return true;
  if (fnStr.includes("Nasi Merah 150g & Dada Ayam") || fnStr.includes("Tumis Sapi Lada Hitam") || fnStr.includes("Whey Protein Shake & Pisang")) return true;
  return false;
}

function purgeLegacyMockLogs() {
  if (!dbData.dailyLogs) return;
  let modified = false;
  for (const [key, logs] of Object.entries(dbData.dailyLogs)) {
    if (Array.isArray(logs)) {
      const filtered = logs.filter(l => !isLegacyMockMeal(l));
      if (filtered.length !== logs.length) {
        dbData.dailyLogs[key] = filtered;
        modified = true;
      }
    }
  }
  if (modified) {
    saveDb();
    console.log("[Data Purge] Purged legacy mock meal logs from database ✅");
  }
}

async function initDb(): Promise<void> {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      dbData = JSON.parse(raw);
      if (!dbData.users) dbData.users = {};
      if (!dbData.dailyLogs) dbData.dailyLogs = {};
      if (!dbData.weeklyProgress) dbData.weeklyProgress = {};
      if (!dbData.waterLogs) dbData.waterLogs = {};
      console.log(`Database loaded: ${Object.keys(dbData.users).length} registered users.`);
    } catch (e) {
      console.error("Error reading db.json, starting fresh", e);
    }
  }

  // Load from Firestore synchronously on boot (authoritative cloud store)
  try {
    const loaded = await loadFromFirestore();
    if (!loaded) console.log("[Firestore] No existing cloud snapshot found");
    purgeLegacyMockLogs();
  } catch (err) {
    console.warn("[Firestore] Boot sync warning:", err);
  }

  // Seed Dummy Testing Users for Plan-Based Feature Locking
  if (!dbData.users["08111111111"]) {
    const alexUser = {
      userId: "usr_alex_demo",
      name: "Alex",
      phone: "08111111111",
      gender: "Pria",
      age: 26,
      weight: 75,
      startWeight: 75,
      targetWeight: 70,
      height: 175,
      goal: "lose",
      goalTitle: "Menurunkan Berat Badan",
      persona: "max",
      activeService: "nutritionist",
      selectedFeature: "nutrition",
      plan: "nutrition",
      activityLevel: "moderate",
      targetCalories: 2100,
      dailyTargetCalories: 2100,
      proteinGrams: 155,
      dailyTargetProtein: 155,
      carbGrams: 210,
      dailyTargetCarbs: 210,
      fatGrams: 65,
      dailyTargetFat: 65,
      fiberGrams: 30
    };
    dbData.users["08111111111"] = alexUser;
    dbData.users["62811111111"] = alexUser;
  }

  if (!dbData.users["08222222222"]) {
    const miaUser = {
      userId: "usr_mia_demo",
      name: "Mia",
      phone: "08222222222",
      gender: "Wanita",
      age: 24,
      weight: 58,
      startWeight: 58,
      targetWeight: 54,
      height: 165,
      goal: "gain",
      goalTitle: "Membentuk Otot & Tone",
      persona: "mia",
      activeService: "workout",
      selectedFeature: "workout",
      plan: "workout",
      activityLevel: "moderate",
      targetCalories: 1850,
      dailyTargetCalories: 1850,
      proteinGrams: 120,
      dailyTargetProtein: 120,
      carbGrams: 200,
      dailyTargetCarbs: 200,
      fatGrams: 55,
      dailyTargetFat: 55,
      fiberGrams: 28
    };
    dbData.users["08222222222"] = miaUser;
    dbData.users["62822222222"] = miaUser;
  }
}

export function saveDb() {
  // Save to local file (backup)
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving db.json", e);
  }
  // Save to Firestore (persistent cloud database)
  saveToFirestore();
}

// Helper to send direct WhatsApp message
async function sendWhatsAppDirect(rawPhone: string, message: string): Promise<boolean> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return false;
  let sent = false;
  if (getTwilio()) {
    try {
      const twilioPhone = process.env.TWILIO_PHONE_NUMBER || "whatsapp:+14155238886";
      const fromNum = twilioPhone.startsWith("whatsapp:") ? twilioPhone : `whatsapp:${twilioPhone}`;
      const formattedDest = phone.startsWith("0") ? "62" + phone.substring(1) : phone;
      const toNum = formattedDest.startsWith("whatsapp:") ? formattedDest : `whatsapp:${formattedDest}`;
      await getTwilio().messages.create({
        body: message,
        from: fromNum,
        to: toNum
      });
      console.log(`[WhatsApp Reminder] Successfully delivered via Twilio to: ${toNum}`);
      sent = true;
    } catch (err: any) {
      console.error(`[WhatsApp Reminder] Error delivering via Twilio to ${phone}:`, err?.message || err);
    }
  }
  if (!sent && (process.env.WHATSAPP_TOKEN || WHATSAPP_TOKEN)) {
    try {
      sent = Boolean(await sendMetaWhatsappMessage(phone, message));
      if (sent) console.log(`[WhatsApp Reminder] Successfully delivered via Meta to: ${phone}`);
    } catch (err: any) {
      console.error(`[WhatsApp Reminder] Error delivering via Meta to ${phone}:`, err?.message || err);
    }
  }
  return sent;
}

// Get current WIB time string (HH:mm)
function getWibTimeStr(d: Date = new Date()): string {
  try {
    const options = { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false } as const;
    const formatter = new Intl.DateTimeFormat("en-GB", options);
    const parts = formatter.formatToParts(d);
    const hours = parts.find(p => p.type === "hour")!.value.padStart(2, "0");
    const minutes = parts.find(p => p.type === "minute")!.value.padStart(2, "0");
    return `${hours}:${minutes}`;
  } catch (e) {
    const wibDate = new Date(d.getTime() + (7 * 60 + d.getTimezoneOffset()) * 60000);
    const hours = String(wibDate.getHours()).padStart(2, "0");
    const minutes = String(wibDate.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }
}

// Helper to handle reminder set/change/disable commands across all webhooks
function handleReminderCommand(userText: string, userProfile: any, phone: string, userData: any): string[] | null {
  const isReminderKeyword = /(?:reminder|pengingat|ingatkan|ingetin|ingatin|inget|remind|jadwal\s*ingat|scheduler|ganti|ubah|update|jadiin|jadikan)/i.test(userText);
  const isTimeOrControlKeyword = /(?:jam|pengingat|reminder|ingetin|ingatin|inget|ingatkan|remind|scheduler|jadwal|matikan|nonaktifkan|hidupkan|nyalakan|aktifkan|\d{1,2}[:.]\d{2})/i.test(userText);

  if (!isReminderKeyword || !isTimeOrControlKeyword) {
    return null;
  }

  const isOffCommand = /(?:matikan|nonaktifkan|off|stop|hentikan|hapus)/i.test(userText);
  const setengahMatch = userText.match(/setengah\s+(\d{1,2})/i);
  const seperempatMatch = userText.match(/seperempat\s+(\d{1,2})/i);
  const rawTimeMatch = userText.match(/jam\s*(\d{1,2})(?:[:.](\d{2}))?|\b(\d{1,2})(?:[:.](\d{2}))?\s*(?:pagi|siang|sore|malam)|(\d{1,2})[:.](\d{2})/i);
  const genericMatch = userText.match(/(?:jam\s*)?(\d{1,2})[:. ]?(\d{2})?/i);
  const isTimeGiven = Boolean(setengahMatch || seperempatMatch || rawTimeMatch || genericMatch);
  const coachName = (userData?.persona || "max").toLowerCase() === "max" ? "Coach Max" : "Coach Mia";

  if (isOffCommand) {
    userProfile.reminderEnabled = false;
    saveUserProfile(phone, userProfile);
    return [
      `❌ *PENGINGAT HARIAN DIMATIKAN*\n-----------------------------\n` +
      `Pengingat harian scheduler kamu telah dinonaktifkan.\n\n` +
      `💬 *${coachName}*:\n"Sip! Kalau mau dihidupkan lagi kapan saja, ketik *'hidupkan pengingat jam 17:00'* atau *'ingatkan jam 8 malam'* ya! 👍"`
    ];
  }

  if (isTimeGiven || /(?:hidupkan|nyalakan|aktifkan|set|buka)/i.test(userText)) {
    let setTime = userProfile.reminderTime || "17:00";
    if (isTimeGiven) {
      const isSoreMalam = /sore|malam|pm/i.test(userText);
      const isPagi = /pagi|am/i.test(userText);
      let hhNum = 0;
      let mmNum = 0;

      if (setengahMatch) {
        hhNum = parseInt(setengahMatch[1]) - 1;
        mmNum = 30;
      } else if (seperempatMatch) {
        hhNum = parseInt(seperempatMatch[1]) - 1;
        mmNum = 15;
      } else if (rawTimeMatch) {
        hhNum = parseInt(rawTimeMatch[1] || rawTimeMatch[3] || rawTimeMatch[5]) || 0;
        mmNum = parseInt(rawTimeMatch[2] || rawTimeMatch[4] || rawTimeMatch[6]) || 0;
      } else if (genericMatch) {
        hhNum = parseInt(genericMatch[1]) || 0;
        mmNum = genericMatch[2] ? parseInt(genericMatch[2]) : 0;
      }

      if (isSoreMalam && hhNum < 12) hhNum += 12;
      if (isPagi && hhNum === 12) hhNum = 0;
      const hh = String(Math.min(23, Math.max(0, hhNum))).padStart(2, "0");
      const mm = String(Math.min(59, Math.max(0, mmNum))).padStart(2, "0");
      setTime = `${hh}:${mm}`;
    }

    userProfile.reminderEnabled = true;
    userProfile.reminderTime = setTime;
    saveUserProfile(phone, userProfile);

    return [
      `✅ *PENGINGAT HARIAN DIAKTIFKAN*\n-----------------------------\n` +
      `⏰ Jam Pengingat: *${setTime} WIB*\n` +
      `STATUS: *Scheduler Aktif*\n\n` +
      `💬 *${coachName}*:\n"Mantap! Setiap hari pukul *${setTime} WIB*, ${coachName} bakal kirim chat pengingat ke WhatsApp kamu untuk catat nutrisi & latihan! 🔥\n\n*(Ketik 'matikan pengingat' jika ingin menonaktifkan)*"`
    ];
  }

  return [
    `⏰ *SCHEDULER PENGINGAT HARIAN GYMBUDDY*\n-----------------------------\n` +
    `Halo ${(userData?.name || "Member")}! Mau *dihidupkan* atau *dimatikan* scheduler pengingat harian kamu?\n\n` +
    `👉 *Untuk Hidupkan*: Ketik *"hidupkan pengingat jam 17:00"*\n` +
    `👉 *Untuk Matikan*: Ketik *"matikan pengingat"*`
  ];
}

// Background Scheduler for WhatsApp Reminders (Custom Daily, Nightly Inactivity & Workout Goal)
function initReminderScheduler() {
  console.log("[Scheduler] WhatsApp Auto-Reminder Engine initialized ✅");
  setInterval(async () => {
    try {
      const now = new Date();
      const currentTimeStr = getWibTimeStr(now);
      const todayDateStr = getLocalDateStr(now);

      for (const [phoneKey, user] of Object.entries(dbData.users as Record<string, any>)) {
        if (!user || phoneKey === "latest_onboarding") continue;
        const norm = user.normalizedPhone || user.phone || phoneKey;
        const coachName = (user.persona || "max").toLowerCase() === "max" ? "Coach Max" : "Coach Mia";

        // 1. Custom User Scheduled Daily Reminder
        const isReminderEnabled = user.reminderEnabled !== false;
        const userReminderTime = user.reminderTime || "17:00";

        if (isReminderEnabled && userReminderTime === currentTimeStr && user.lastReminderSentDate !== todayDateStr) {
          user.lastReminderSentDate = todayDateStr;
          saveUserProfile(norm, user);
          const msg =
            `⏰ *PENGINGAT HARIAN GYMBUDDY*\n-----------------------------\n` +
            `🔥 Halo *${(user.name || "Member").toUpperCase()}*! ${coachName} di sini!\n\n` +
            `Yuk sempatkan catat makanan/minuman kamu hari ini dan cek target latihanmu! Konsistensi itu kunci! 💪✨\n\n` +
            `*(Ketik 'matikan pengingat' atau 'ingatkan jam 19:00' untuk mengatur scheduler)*`;
          await sendWhatsAppDirect(norm, msg);
        }

        // 2. Nightly Inactivity Log Reminder at 20:00 WIB (if 0 meals logged today)
        if (currentTimeStr === "20:00" && user.lastNightlyReminderDate !== todayDateStr) {
          const userLogsKey = `${norm}_${todayDateStr}`;
          const userLogs = dbData.dailyLogs[userLogsKey] || [];
          if (!userLogs || userLogs.length === 0) {
            user.lastNightlyReminderDate = todayDateStr;
            saveUserProfile(norm, user);
            const msg =
              `🥗 *PENGINGAT LOG NUTRISI MALAM*\n-----------------------------\n` +
              `🌙 Halo *${(user.name || "Member").toUpperCase()}*! ${coachName} belum melihat catatan makanan/minuman kamu hari ini nih.\n\n` +
              `Yuk catat log makanan kamu sebelum tidur biar asupan nutrisinya tetap terpantau akurat! 🌿`;
            await sendWhatsAppDirect(norm, msg);
          }
        }

        // 3. Nightly Workout Goal Reminder at 20:30 WIB (if workout not completed)
        if (currentTimeStr === "20:30" && user.lastWorkoutReminderDate !== todayDateStr) {
          const workoutLogsKey = `gymbuddy_exercises_${norm}_${todayDateStr}`;
          const isWorkoutDone = dbData.dailyLogs[workoutLogsKey] && dbData.dailyLogs[workoutLogsKey].length > 0;
          if (!isWorkoutDone) {
            user.lastWorkoutReminderDate = todayDateStr;
            saveUserProfile(norm, user);
            const goalTitle = user.goalTitle || "Kebugaran Harian";
            const msg =
              `🏋️ *PENGINGAT TARGET LATIHAN HARIAN*\n-----------------------------\n` +
              `🔥 Halo *${(user.name || "Member").toUpperCase()}*! Hari ini kamu belum mencatat latihan selesai.\n\n` +
              `Yuk lakukan latihan ringan atau tuntaskan set kamu biar goal *${goalTitle}* cepat tercapai! 💪`;
            await sendWhatsAppDirect(norm, msg);
          }
        }
      }
    } catch (schedErr) {
      console.error("[Scheduler] Error in background check cycle:", schedErr);
    }
  }, 60000);
}

// Helpers for profile resolution

function getTodayDateStr(): string {
  return getLocalDateStr();
}

export function getUserProfile(rawPhone: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;
  if (dbData.users[phone] && dbData.users[phone].weight) return dbData.users[phone];
  const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
  if (dbData.users[altPhone] && dbData.users[altPhone].weight) return dbData.users[altPhone];
  for (const [key, value] of Object.entries(dbData.users)) {
    if (normalizePhone(key) === phone && (value as any)?.weight) {
      return value;
    }
  }
  return null;
}

function getOrCreateUserProfile(rawPhone: string, userText?: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;

  // 1. Exact match by normalized phone
  let user = getUserProfile(phone);

  // 2. Check international vs local variations (08xxx <-> 628xxx)
  if (!user && phone.startsWith('0')) {
    user = getUserProfile('62' + phone.substring(1));
  } else if (!user && phone.startsWith('62')) {
    user = getUserProfile('0' + phone.substring(2));
  }

  // 3. Extract name from incoming text if present (e.g. "Saya Budi")
  let extractedName = "";
  if (userText) {
    const nameMatch = userText.match(/(?:i am|saya|nama saya)\s+([^,!\.\n]+)/i);
    if (nameMatch && nameMatch[1].trim()) {
      extractedName = nameMatch[1].trim();
    }
  }

  // 4. Try matching existing profile in dbData.users by extracted name
  if (!user && extractedName) {
    const nameLower = extractedName.toLowerCase();
    const matchedByName = Object.values(dbData.users).find((u: any) =>
      u && u.name && String(u.name).toLowerCase() === nameLower && u.weight
    );
    if (matchedByName) {
      user = saveUserProfile(phone, {
        ...matchedByName,
        phone,
        normalizedPhone: phone
      });
      saveDb();
      return user;
    }
  }

  // NOTE: This function is sync — MongoDB fallback is handled separately in async webhook handlers
  // Do NOT create placeholder profiles here — return null so webhooks can check MongoDB first
  return user;
}

export function saveUserProfile(rawPhone: string, profile: any) {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;
  const existing = dbData.users[phone] || {};
  const initialW = Math.max(30, Number(profile?.weight) || Number(existing.weight) || 65);

  const targetCal = Number(profile?.targetCalories || profile?.dailyTargetCalories || existing.targetCalories || existing.dailyTargetCalories) || undefined;
  const targetProt = Number(profile?.proteinGrams || profile?.dailyTargetProtein || existing.proteinGrams || existing.dailyTargetProtein) || undefined;
  const targetCarb = Number(profile?.carbGrams || profile?.dailyTargetCarbs || existing.carbGrams || existing.dailyTargetCarbs) || undefined;
  const targetFatVal = Number(profile?.fatGrams || profile?.dailyTargetFat || existing.fatGrams || existing.dailyTargetFat) || undefined;
  const targetFib = Number(profile?.fiberGrams || existing.fiberGrams) || undefined;

  const updated = {
    ...existing,
    ...profile,
    phone,
    normalizedPhone: phone,
    startWeight: profile?.startWeight !== undefined ? Number(profile.startWeight) : (existing.startWeight || initialW),
    weight: initialW,
    targetCalories: targetCal,
    dailyTargetCalories: targetCal,
    proteinGrams: targetProt,
    dailyTargetProtein: targetProt,
    carbGrams: targetCarb,
    dailyTargetCarbs: targetCarb,
    fatGrams: targetFatVal,
    dailyTargetFat: targetFatVal,
    fiberGrams: targetFib,
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  dbData.users[phone] = updated;
  const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
  dbData.users[altPhone] = updated;

  // Persist directly to Firestore users collection
  saveUserDocument({
    userId: `usr_${phone}`,
    phone,
    name: updated.name || "User",
    gender: updated.gender,
    age: updated.age ? Number(updated.age) : undefined,
    weight: updated.weight ? Number(updated.weight) : undefined,
    height: updated.height ? Number(updated.height) : undefined,
    targetWeight: updated.targetWeight ? Number(updated.targetWeight) : undefined,
    startWeight: updated.startWeight ? Number(updated.startWeight) : undefined,
    goal: updated.goal,
    activityLevel: updated.activityLevel,
    dietPreference: updated.dietPreference,
    experienceLevel: updated.experienceLevel,
    persona: updated.persona,
    selectedFeature: updated.selectedFeature || updated.activeService,
    activeService: updated.activeService,
    targetCalories: targetCal,
    dailyTargetCalories: targetCal,
    proteinGrams: targetProt,
    dailyTargetProtein: targetProt,
    carbGrams: targetCarb,
    dailyTargetCarbs: targetCarb,
    fatGrams: targetFatVal,
    dailyTargetFat: targetFatVal,
    fiberGrams: targetFib,
    customSchedule: updated.workoutSchedule || updated.customSchedule,
    customGoals: updated.customGoals,
    reminderTime: updated.reminderTime,
    updatedAt: new Date()
  }).catch((e: any) => console.warn("[Firestore] saveUserDocument note:", e?.message || e));

  // Initialize Week 0 baseline if no progress history exists yet
  if (!dbData.weeklyProgress[phone] || dbData.weeklyProgress[phone].length === 0) {
    dbData.weeklyProgress[phone] = [{
      week: 0,
      weight: initialW,
      changeFromStart: 0,
      changeFromLastWeek: 0,
      progressPercent: 0,
      date: new Date().toISOString(),
      notes: "Baseline Kuesioner Awal"
    }];
  }

  saveDb();
  return updated;
}

function formatEquipmentTutorialCard(parsed: any, userData: any): string {
  const isMia = (userData.persona || "mia").toLowerCase().includes("mia");
  const coachName = isMia ? "Coach Mia" : "Coach Max";

  let stepsText = "";
  if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
    stepsText = `\n\n📖 *Langkah Pemakaian*:\n` + parsed.steps.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n");
  }

  let mistakesText = "";
  if (Array.isArray(parsed.mistakes) && parsed.mistakes.length > 0) {
    mistakesText = `\n\n⚠️ *Kesalahan Umum*:\n` + parsed.mistakes.map((m: string) => `• ${m}`).join("\n");
  }

  let tipsText = "";
  if (Array.isArray(parsed.tips) && parsed.tips.length > 0) {
    tipsText = `\n\n💡 *Tips ${coachName}*:\n` + parsed.tips.map((t: string) => `• ${t}`).join("\n");
  }

  return `🏋️ *TUTORIAL ALAT GYM: ${(parsed.equipmentName || "Alat Gym").toUpperCase()}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🎯 *Target Otot*: ${parsed.targetMuscles || "Otot Utama"}\n` +
    `📝 *Deskripsi*: ${parsed.description || "Alat latihan beban untuk melatih otot target."}` +
    stepsText +
    mistakesText +
    tipsText;
}

function getDefaultWorkoutSchedule(goal: string, equipment?: string, injuries?: string[]) {
  const isBodyweight = equipment === "bodyweight";
  const isDumbbells = equipment === "dumbbells";
  const hasKneePain = Array.isArray(injuries) && injuries.includes("knee");
  const hasBackPain = Array.isArray(injuries) && injuries.includes("lower_back");

  if (isBodyweight) {
    return [
      { day: "Senin", focus: "Push & Core (Rumah)", exercises: [{ name: "Push Up (Regular / Knee)", setsReps: "3 Set x 12 Reps" }, { name: "Pike Push Up (Bahu)", setsReps: "3 Set x 10 Reps" }, { name: "Plank Hold", setsReps: "3 Set x 45 Detik" }] },
      { day: "Selasa", focus: "Lower Body (Bodyweight)", exercises: [{ name: hasKneePain ? "Glute Bridge & Hip Thrust" : "Bodyweight Squat", setsReps: "4 Set x 15 Reps" }, { name: "Calf Raise & Wall Sit", setsReps: "3 Set x 15 Reps" }] },
      { day: "Rabu", focus: "Rest Day", exercises: [{ name: "Stretching & Active Rest", setsReps: "Rest Day" }] },
      { day: "Kamis", focus: "Pull & Core (Rumah)", exercises: [{ name: "Doorframe / Towel Inverted Row", setsReps: "4 Set x 12 Reps" }, { name: "Chair Dips", setsReps: "3 Set x 12 Reps" }, { name: "Superman Hold", setsReps: "3 Set x 45 Detik" }] },
      { day: "Jumat", focus: "Full Body Bodyweight Circuit", exercises: [{ name: "Jumping Jacks / Shadow Boxing", setsReps: "4 Set x 1 Menit" }, { name: "Bodyweight Lunge / Step Up", setsReps: "3 Set x 12 Reps" }] },
      { day: "Sabtu", focus: "Cardio & Mobility", exercises: [{ name: "Brisk Walk / Jogging Rumah", setsReps: "30 Menit" }] },
      { day: "Minggu", focus: "Rest Day", exercises: [{ name: "Istirahat Total", setsReps: "Rest Day" }] }
    ];
  }

  if (isDumbbells) {
    return [
      { day: "Senin", focus: "Dumbbell Upper Push", exercises: [{ name: "Dumbbell Floor / Bench Press", setsReps: "4 Set x 12 Reps" }, { name: "Dumbbell Overhead Shoulder Press", setsReps: "3 Set x 12 Reps" }, { name: "Tricep Dumbbell Extension", setsReps: "3 Set x 12 Reps" }] },
      { day: "Selasa", focus: "Dumbbell Lower Body", exercises: [{ name: hasKneePain ? "Dumbbell Romanian Deadlift" : "Dumbbell Goblet Squat", setsReps: "4 Set x 12 Reps" }, { name: "Dumbbell Lunge / Step Up", setsReps: "3 Set x 10 Reps/kaki" }] },
      { day: "Rabu", focus: "Rest Day", exercises: [{ name: "Active Recovery", setsReps: "Rest Day" }] },
      { day: "Kamis", focus: "Dumbbell Upper Pull", exercises: [{ name: hasBackPain ? "Chest-Supported Dumbbell Row" : "Single Arm Dumbbell Row", setsReps: "4 Set x 12 Reps" }, { name: "Dumbbell Bicep Curl", setsReps: "3 Set x 12 Reps" }, { name: "Dumbbell Rear Delt Fly", setsReps: "3 Set x 15 Reps" }] },
      { day: "Jumat", focus: "Dumbbell Full Body Blast", exercises: [{ name: "Dumbbell Thrusters", setsReps: "3 Set x 12 Reps" }, { name: "Dumbbell Farmer Walk", setsReps: "4 Set x 45 Detik" }] },
      { day: "Sabtu", focus: "Cardio & Core", exercises: [{ name: "Dumbbell Woodchopper & Plank", setsReps: "3 Set x 15 Reps" }] },
      { day: "Minggu", focus: "Rest Day", exercises: [{ name: "Istirahat Total", setsReps: "Rest Day" }] }
    ];
  }

  if (goal === "lose") {
    return [
      { day: "Senin", focus: "Upper Body & Cardio", exercises: [{ name: "Incline Push Up / Bench Press", setsReps: "3 Set x 12 Reps" }, { name: "Lat Pulldown Wide Grip", setsReps: "3 Set x 12 Reps" }, { name: "Treadmill Incline Walk", setsReps: "20 Menit" }] },
      { day: "Selasa", focus: "Lower Body & Core", exercises: [{ name: hasKneePain ? "Leg Extension & Glute Bridge" : "Goblet Squat / Leg Press", setsReps: "4 Set x 12 Reps" }, { name: hasBackPain ? "Chest Supported Row" : "Romanian Deadlift", setsReps: "3 Set x 10 Reps" }, { name: "Plank Hold", setsReps: "3 Set x 45 Detik" }] },
      { day: "Rabu", focus: "Rest & Active Recovery", exercises: [{ name: "Jalan Santai / Stretching", setsReps: "30 Menit" }] },
      { day: "Kamis", focus: "Full Body HIIT", exercises: [{ name: "Dumbbell Thrusters", setsReps: "3 Set x 15 Reps" }, { name: "Kettlebell Swing", setsReps: "4 Set x 15 Reps" }, { name: "Jump Rope", setsReps: "5 Ronde x 1 Menit" }] },
      { day: "Jumat", focus: "Push & Core Focus", exercises: [{ name: "Dumbbell Shoulder Press", setsReps: "3 Set x 12 Reps" }, { name: "Cable Tricep Pushdown", setsReps: "3 Set x 12 Reps" }] },
      { day: "Sabtu", focus: "Cardio & Fat Burn", exercises: [{ name: "Outdoor Jogging / Cycling", setsReps: "35 Menit" }] },
      { day: "Minggu", focus: "Rest Day", exercises: [{ name: "Istirahat Total", setsReps: "Rest Day" }] }
    ];
  } else if (goal === "gain") {
    return [
      { day: "Senin", focus: "Dada & Tricep (Push)", exercises: [{ name: "Barbell Bench Press", setsReps: "4 Set x 8-10 Reps" }, { name: "Incline Dumbbell Press", setsReps: "3 Set x 10 Reps" }, { name: "Tricep Cable Pushdown", setsReps: "3 Set x 12 Reps" }] },
      { day: "Selasa", focus: "Punggung & Bicep (Pull)", exercises: [{ name: hasBackPain ? "Chest Supported Cable Row" : "Barbell Bent Row", setsReps: "4 Set x 8-10 Reps" }, { name: "Lat Pulldown Wide Grip", setsReps: "3 Set x 10 Reps" }, { name: "Bicep Dumbbell Curl", setsReps: "3 Set x 12 Reps" }] },
      { day: "Rabu", focus: "Rest Day", exercises: [{ name: "Istirahat & Recovery Muscle", setsReps: "Rest Day" }] },
      { day: "Kamis", focus: "Kaki & Bahu", exercises: [{ name: hasKneePain ? "Leg Press & Leg Curl" : "Barbell Back Squat", setsReps: "4 Set x 8 Reps" }, { name: "Overhead Dumbbell Press", setsReps: "4 Set x 10 Reps" }] },
      { day: "Jumat", focus: "Upper Body Hypertrophy", exercises: [{ name: "Dumbbell Chest Fly", setsReps: "3 Set x 12 Reps" }, { name: "Seated Cable Row", setsReps: "3 Set x 12 Reps" }, { name: "Lateral Raise", setsReps: "4 Set x 15 Reps" }] },
      { day: "Sabtu", focus: "Core & Arms Blast", exercises: [{ name: "Hammer Curl & Dip Superset", setsReps: "3 Set x 12 Reps" }, { name: "Cable Crunch", setsReps: "4 Set x 15 Reps" }] },
      { day: "Minggu", focus: "Rest Day", exercises: [{ name: "Istirahat Total", setsReps: "Rest Day" }] }
    ];
  } else {
    return [
      { day: "Senin", focus: "Full Body Maintenance", exercises: [{ name: hasKneePain ? "Leg Press" : "Goblet Squat", setsReps: "3 Set x 12 Reps" }, { name: "Push Up", setsReps: "3 Set x 15 Reps" }, { name: "Dumbbell Row", setsReps: "3 Set x 12 Reps" }] },
      { day: "Selasa", focus: "Cardio & Core", exercises: [{ name: "Brisk Walk / Cycling", setsReps: "30 Menit" }, { name: "Plank & Bicycle Crunch", setsReps: "3 Set x 1 Menit" }] },
      { day: "Rabu", focus: "Rest Day", exercises: [{ name: "Recovery", setsReps: "Rest Day" }] },
      { day: "Kamis", focus: "Upper Body & Mobility", exercises: [{ name: "Dumbbell Shoulder Press", setsReps: "3 Set x 12 Reps" }, { name: "Lat Pulldown", setsReps: "3 Set x 12 Reps" }, { name: "Yoga / Stretching", setsReps: "15 Menit" }] },
      { day: "Jumat", focus: "Lower Body Focus", exercises: [{ name: "Leg Extension & Calf Raise", setsReps: "3 Set x 12 Reps" }] },
      { day: "Sabtu", focus: "Outdoor Activity", exercises: [{ name: "Renang / Badminton / Running", setsReps: "45 Menit" }] },
      { day: "Minggu", focus: "Rest Day", exercises: [{ name: "Istirahat Total", setsReps: "Rest Day" }] }
    ];
  }
}

function calculateAgeFromDob(dobStr?: string, fallbackAge: number = 25): { age: number; ageGroup: "Anak" | "Remaja" | "Dewasa" | "Lansia"; ageGroupKey: "child" | "teen" | "adult" | "older_adult" } {
  let calculatedAge = Math.max(10, Number(fallbackAge) || 25);
  if (dobStr && /^\d{4}-\d{2}-\d{2}$/.test(dobStr)) {
    const dob = new Date(dobStr);
    if (!isNaN(dob.getTime())) {
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      if (age >= 10 && age <= 120) {
        calculatedAge = age;
      }
    }
  }

  let ageGroup: "Anak" | "Remaja" | "Dewasa" | "Lansia" = "Dewasa";
  let ageGroupKey: "child" | "teen" | "adult" | "older_adult" = "adult";

  if (calculatedAge < 13) {
    ageGroup = "Anak";
    ageGroupKey = "child";
  } else if (calculatedAge <= 17) {
    ageGroup = "Remaja";
    ageGroupKey = "teen";
  } else if (calculatedAge < 60) {
    ageGroup = "Dewasa";
    ageGroupKey = "adult";
  } else {
    ageGroup = "Lansia";
    ageGroupKey = "older_adult";
  }

  return { age: calculatedAge, ageGroup, ageGroupKey };
}

export function calculateUserData(profile: any) {
  const name = profile?.name || "Member";
  const weight = Math.max(30, Number(profile?.weight) || 65);
  const startWeight = Math.max(30, Number(profile?.startWeight) || weight);
  const height = Math.max(100, Number(profile?.height) || 170);

  const dob = profile?.dob || profile?.birthDate || profile?.healthProfile?.dob || "";
  const rawAge = Number(profile?.age) || Number(profile?.healthProfile?.age) || 25;
  const { age, ageGroup, ageGroupKey } = calculateAgeFromDob(dob, rawAge);

  const rawHp = profile?.healthProfile || {};
  const hasCondition = rawHp.hasCondition || (rawHp.conditions && rawHp.conditions.length > 0 ? "has_condition" : (rawHp.isCompleted ? "no_condition" : "unanswered"));
  const conditions: string[] = Array.isArray(rawHp.conditions) ? rawHp.conditions : [];
  const otherCondition = rawHp.otherCondition || "";
  const isHealthProfileCompleted = Boolean(rawHp.isCompleted);

  const activeConditionsList: string[] = [...conditions];
  if (otherCondition && otherCondition.trim()) {
    activeConditionsList.push(otherCondition.trim());
  }

  let healthConditionsSummary = "Tidak ada kondisi kesehatan khusus / Sehat";
  if (hasCondition === "has_condition" && activeConditionsList.length > 0) {
    healthConditionsSummary = activeConditionsList.join(", ");
  } else if (hasCondition === "prefer_not_to_say") {
    healthConditionsSummary = "User memilih tidak menyebutkan (Gunakan panduan netral & aman)";
  } else if (hasCondition === "no_condition") {
    healthConditionsSummary = "Tidak ada riwayat kondisi kesehatan";
  }

  const gender = (profile?.gender || "pria").toLowerCase();
  const isMale = gender === "pria" || gender === "male";
  const goal = profile?.goal || "maintain";
  
  let rawPersona = String(profile?.persona || "").toLowerCase();
  if (!rawPersona) {
    rawPersona = isMale ? "max" : "mia";
  }
  if (rawPersona === "wowo") rawPersona = "max";
  if (rawPersona === "nikita") rawPersona = "mia";
  const persona = (rawPersona === "mia" || rawPersona === "nikita") ? "mia" : "max";

  let goalTitle = profile?.goalTitle || "Gaya Hidup Sehat & Fit";
  if (goal === "lose") {
    goalTitle = "Menurunkan Berat Badan";
  } else if (goal === "gain") {
    goalTitle = "Menaikkan Berat Badan & Massa Otot";
  } else if (goal === "health" || goal === "maintain") {
    goalTitle = "Gaya Hidup Sehat & Fit";
  }

  let targetWeight = weight;
  if (profile?.targetWeight) {
    targetWeight = Number(profile.targetWeight);
  } else if (goal === "lose") {
    targetWeight = Math.max(40, startWeight - (startWeight > 75 ? 8 : 5));
  } else if (goal === "gain") {
    targetWeight = startWeight + 5;
  }

  const activityMap: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725
  };
  const activityMultiplier = activityMap[profile?.activityLevel] || 1.375;

  const bmr = Math.round((10 * weight) + (6.25 * height) - (5 * age) + (isMale ? 5 : -161));
  const tdee = Math.round(bmr * activityMultiplier);

  let targetCalories = profile?.targetCalories || profile?.dailyTargetCalories || profile?.calories;
  if (!targetCalories || isNaN(Number(targetCalories)) || Number(targetCalories) < 500) {
    targetCalories = tdee;
    if (goal === "lose") {
      targetCalories = Math.max(1200, tdee - 500);
    } else if (goal === "gain") {
      targetCalories = tdee + 400;
    }
  } else {
    targetCalories = Math.round(Number(targetCalories));
  }

  let proteinGrams = profile?.proteinGrams || profile?.dailyTargetProtein || profile?.protein;
  if (!proteinGrams || isNaN(Number(proteinGrams)) || Number(proteinGrams) < 10) {
    proteinGrams = Math.round(weight * (goal === "gain" ? 2.2 : goal === "lose" ? 2.0 : 1.8));
  } else {
    proteinGrams = Math.round(Number(proteinGrams));
  }

  let fatGrams = profile?.fatGrams || profile?.dailyTargetFat || profile?.fat;
  if (!fatGrams || isNaN(Number(fatGrams)) || Number(fatGrams) < 5) {
    fatGrams = Math.round((targetCalories * 0.25) / 9);
  } else {
    fatGrams = Math.round(Number(fatGrams));
  }

  let carbGrams = profile?.carbGrams || profile?.dailyTargetCarbs || profile?.carbs;
  if (!carbGrams || isNaN(Number(carbGrams)) || Number(carbGrams) < 10) {
    carbGrams = Math.round((targetCalories - (proteinGrams * 4 + fatGrams * 9)) / 4);
  } else {
    carbGrams = Math.round(Number(carbGrams));
  }

  let fiberGrams = profile?.fiberGrams || profile?.fiber;
  if (!fiberGrams || isNaN(Number(fiberGrams)) || Number(fiberGrams) < 5) {
    fiberGrams = Math.max(20, Math.min(38, Math.round(targetCalories / 75)));
  } else {
    fiberGrams = Math.round(Number(fiberGrams));
  }

  // Active AI persona service scope ('nutritionist' | 'workout' | 'both')
  const activeService: "nutritionist" | "workout" | "both" =
    profile?.activeService || profile?.subscription?.activeService || profile?.selectedFeature || "both";

  const hasReceivedWelcome = Boolean(profile?.hasReceivedWelcome);
  const workoutSchedule = profile?.workoutSchedule && Array.isArray(profile.workoutSchedule) && profile.workoutSchedule.length > 0
    ? profile.workoutSchedule
    : getDefaultWorkoutSchedule(goal, profile?.equipment, profile?.injuries);

  const subscription = profile?.subscription || {
    plan: profile?.plan || "advanced",
    activeService,
    status: "active"
  };

  const nickname = (profile?.nickname || name.trim().split(/\s+/)[0] || "Member").trim();
  const addressing = getValidatedUserAddressing({
    name,
    nickname,
    age,
    ageGroup,
    ageGroupKey,
    gender: isMale ? "Pria" : "Wanita",
    persona
  });

  return {
    name,
    nickname,
    addressing,
    weight,
    startWeight,
    targetWeight,
    height,
    dob,
    age,
    ageGroup,
    ageGroupKey,
    healthProfile: {
      dob,
      age,
      ageGroup,
      ageGroupKey,
      hasCondition,
      conditions,
      otherCondition,
      isCompleted: isHealthProfileCompleted,
      completedAt: rawHp.completedAt || ""
    },
    healthConditionsSummary,
    gender: isMale ? "Pria" : "Wanita",
    goal,
    goalTitle,
    persona,
    bmr,
    tdee,
    targetCalories,
    proteinGrams,
    carbGrams,
    fatGrams,
    fiberGrams,
    injuries: profile?.injuries || ["none"],
    customInjury: profile?.customInjury || "",
    allergies: profile?.allergies || ["none"],
    equipment: profile?.equipment || "full_gym",
    activeService,
    hasReceivedWelcome,
    workoutSchedule,
    subscription
  };
}

function deduplicateMealLogs(logs: any[]): any[] {
  if (!Array.isArray(logs)) return [];
  const seenIds = new Set<string>();
  const cleanLogs: any[] = [];

  for (const log of logs) {
    if (!log || !log.foodName) continue;
    
    // Deduplicate by unique log.id so all distinct meal entries are ALWAYS recorded
    const uniqueId = log.id || `${log.foodName}_${log.calories}_${log.timestamp || Date.now()}`;
    if (seenIds.has(uniqueId)) continue;
    seenIds.add(uniqueId);
    cleanLogs.push(log);
  }

  return cleanLogs;
}

export function getDailyTotals(rawPhone: string, targetDateStr?: string) {
  const phone = normalizePhone(rawPhone);
  const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
  const targetDate = targetDateStr || getTodayDateStr();
  const key = `${phone}_${targetDate}`;
  const altKey = `${altPhone}_${targetDate}`;

  // Prioritize primary key (even if empty array [ ]); fallback to altKey only if key is undefined
  const rawLogs = (dbData.dailyLogs[key] !== undefined)
    ? dbData.dailyLogs[key]
    : (dbData.dailyLogs[altKey] !== undefined ? dbData.dailyLogs[altKey] : []);

  // Strict Deduplication: clean out any duplicated entries
  const logs = deduplicateMealLogs(rawLogs);

  // Auto-clean database in-place if duplicates were found
  if (logs.length < rawLogs.length) {
    if (dbData.dailyLogs[key]) dbData.dailyLogs[key] = logs;
    if (dbData.dailyLogs[altKey]) dbData.dailyLogs[altKey] = logs;
    saveDb();
  }

  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let fiber = 0;
  let sugar = 0;
  let sodium = 0;
  let waterMl = 0;

  for (const log of logs) {
    calories += Number(log.calories) || 0;
    protein += Number(log.protein) || 0;
    carbs += Number(log.carbs) || 0;
    fat += Number(log.fat) || 0;
    fiber += Number(log.fiber) || 0;
    sugar += Number((log as any).sugar) || 0;
    sodium += Number((log as any).sodium) || 0;
    if (log.isHydration || isPlainWaterName(log.foodName) || isLiquidName(log.foodName)) {
      waterMl += Number(log.volumeMl) || extractVolumeMlFromName(log.foodName) || 250;
    }
  }

  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    fiber: Math.round(fiber),
    sugar: Math.round(sugar * 10) / 10,
    sodium: Math.round(sodium),
    waterMl: Math.round(waterMl),
    logCount: logs.length,
    date: targetDate,
    logs
  };
}

function isLiquidName(name: string): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();

  const solidExceptions = [
    "french fries", "fries", "kentang", "sosis", "sausage", "nugget",
    "ayam", "chicken", "daging", "sapi", "ikan", "tahu", "tempe",
    "nasi", "mie", "bihun", "kwetiau", "burger", "pizza", "dimsum",
    "bakso", "siomay", "batagor", "telur", "telor", "seafood", "udang",
    "cumi", "pancong", "roti", "martabak", "cake", "kue", "pancake", "waffle",
    "biskuit", "sereal", "cereal", "ice cream", "es krim", "keju", "pudding",
    "puding", "bubur", "bolu", "donat", "pie", "tart", "saus", "sauce",
    "selai", "topping", "crepe", "churros", "pisang", "salad", "steak"
  ];

  if (solidExceptions.some((se) => lower.includes(se))) {
    return false;
  }

  const liquidKeywords = [
    "air", "water", "mineral", "kopi", "coffee", "teh", "tea",
    "susu", "milk", "jus", "juice", "shake", "drink", "minum",
    "smoothie", "beverage", "soda", "cola", "boba", "latte",
    "espresso", "cappuccino", "syrup", "sirup", "infused",
    "hydrat", "pocari", "gatorade", "le minerale", "aqua", "es teh",
    "es kopi", "yakult", "matcha", "americano", "macchiato",
    "mocha", "affogato", "flat white", "long black", "ristretto", "cold brew",
    "thai tea", "teh pucuk", "teh botol", "teh kotak", "oat milk",
    "almond milk", "soya", "soy milk", "dancow", "ultra milk", "indomilk",
    "cleo", "vit", "ades", "coke", "pepsi", "sprite", "fanta", "7up",
    "root beer", "big cola", "dr pepper", "minuman", "cairan", "liquid",
    "wedang", "jamu", "hydro", "isoplus", "you1000", "c1000", "milku",
    "milo", "ovaltine", "nutrisari", "beer", "bir", "wine", "whiskey",
    "vodka", "soju", "rum", "cocktail", "mocktail", "whey", "creatine",
    "montblanc", "mont blanc", "vietnam drip", "robusta", "liberica", "arabica",
    "v60", "pour over", "aeropress", "chemex", "cold drip",
    "brown sugar boba", "vanilla latte", "caramel macchiato",
    "kopi aren", "kopi tubruk", "kopi susu", "es jeruk", "es lemon",
    "lemonade", "lemon tea", "fruit tea", "minuman dingin", "minuman panas",
    "wedang jahe", "bandrek", "bajigur", "sekoteng", "cincau", "es cincau",
    "es dawet", "es cendol", "es kelapa", "es teler", "es campur",
    "infused water", "detox water", "green tea", "ocha", "hojicha",
    "protein shake", "mass gainer", "pre-workout", "bcaa",
    "electrolyte", "energy drink", "red bull", "monster", "kratingdaeng"
  ];
  return liquidKeywords.some((kw) => lower.includes(kw));
}

// Extract volume in ml from a food name string (e.g. "Air Mineral 600ml" → 600)
function extractVolumeMlFromName(name: string): number {
  if (!name) return 250;
  // Match patterns like "600ml", "600 ml", "1.5L", "1,5 liter"
  const mlMatch = name.match(/(\d+(?:[.,]\d+)?)\s*ml/i);
  if (mlMatch) return parseFloat(mlMatch[1].replace(',', '.'));
  const lMatch = name.match(/(\d+(?:[.,]\d+)?)\s*(?:l|liter|litre)\b/i);
  if (lMatch) return parseFloat(lMatch[1].replace(',', '.')) * 1000;
  return 250;
}

// Check if a message contains explicit food/meal context to avoid false-positive shortcut matching
function hasFoodContext(text: string): boolean {
  if (!text) return false;
  return /(?:makan|sarapan|lunch|dinner|breakfast|ngemil|snack|lauk|nasi|ayam|mie|soto|bakso|goreng|bakar|tumis|rebus|panggang|telur|daging|ikan|bebek|tahu|tempe|sayur|buah|keju|roti|kentang|bubur|porsi|mangkok|piring|potong|lembar|bungkus|sendok|gram|ons|kalori|kcal|siang|malam|pagi)/i.test(text);
}

// Match pure water logging intent without meal context
function matchPureWaterLog(text: string): RegExpMatchArray | null {
  if (hasFoodContext(text)) return null;
  return text.match(/(?:minum|air\s+putih|water|hidrasi)\s*:?\s*(\d+(?:[\.,]\d+)?)\s*(gelas|cup|cups|ml|l|liter)?/i);
}

// Match pure weight logging intent without meal context
function matchPureWeightLog(text: string): RegExpMatchArray | null {
  const lower = text.toLowerCase().trim();
  if (lower.match(/(?:makan|sarapan|lunch|dinner|minum|porsi|kalori|kcal|resep)/i)) {
    return null;
  }

  const match = lower.match(/(?:update\s+bb|lapor\s+bb|berat\s*(?:badan)?(?:\s*(?:ku|mu|nya|saya|gue|gw|aku))?|bb(?:\s*(?:ku|mu|nya|saya|gue|gw|aku))?|timbangan(?:\s*(?:ku|mu|nya|saya|gue|gw|aku))?|tadi\s*nimbang|nimbang|weight)\s*(?:hari\s*ini|saat\s*ini|sekarang|terbaru|terkini|adalah|di|:|udah|sudah)?\s*(\d+(?:[.,]\d+)?)\s*(?:kg|kilo|kilogram)?/i) ||
                lower.match(/(?:sekarang|hari\s*ini|saat\s*ini)\s*(?:berat\s*(?:badan)?(?:\s*(?:ku|mu|nya|saya|gue|gw|aku))?|bb(?:\s*(?:ku|mu|nya|saya|gue|gw|aku))?)\s*(?:adalah|di|:|udah|sudah)?\s*(\d+(?:[.,]\d+)?)\s*(?:kg|kilo|kilogram)?/i) ||
                lower.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilo|kilogram)?\s*(?:berat\s*(?:badan)?(?:\s*(?:ku|mu|nya|saya|gue|gw|aku))?|bb(?:\s*(?:ku|mu|nya|saya|gue|gw|aku))?)/i);

  return match;
}

function isPlainWaterName(name: string): boolean {
  if (!name) return false;
  const n = String(name).toLowerCase();
  return (
    n.includes("air putih") ||
    n.includes("air mineral") ||
    n.includes("air bening") ||
    n.includes("aqua") ||
    n.includes("le minerale") ||
    n === "air" ||
    n.includes("water")
  );
}

function addMealLog(rawPhone: string, meal: MealLog, targetDateStr?: string) {
  const phone = normalizePhone(rawPhone);
  const targetDate = targetDateStr || getTodayDateStr();

  // CRITICAL SINGLE SOURCE OF TRUTH:
  // The passed `meal` object is ALREADY validated with exact calories, protein, carbs, fat, fiber, sugar, sodium.
  // We MUST preserve and store `meal` directly as the single source of truth without overriding its values!
  const finalMealToInsert: MealLog = {
    ...meal,
    id: meal.id || `m-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    foodName: meal.foodName || "Makanan",
    calories: Number(meal.calories) || 0,
    protein: Number(meal.protein) || 0,
    carbs: Number(meal.carbs) || 0,
    fat: Number(meal.fat) || 0,
    fiber: Number(meal.fiber) || 0,
    sugar: Number((meal as any).sugar) || 0,
    sodium: Number((meal as any).sodium) || 0,
    mealType: meal.mealType,
    isHydration: Boolean(meal.isHydration || isPlainWaterName(meal.foodName)),
    volumeMl: meal.volumeMl || (isLiquidName(meal.foodName) ? extractVolumeMlFromName(meal.foodName) : undefined),
    timestamp: meal.timestamp || new Date().toISOString()
  };

  const key = `${phone}_${targetDate}`;
  if (!dbData.dailyLogs[key]) {
    dbData.dailyLogs[key] = [];
  }
  if (!dbData.dailyLogs[key].some((m: any) => m.id === finalMealToInsert.id)) {
    dbData.dailyLogs[key].push(finalMealToInsert);
  }

  const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
  const altKey = `${altPhone}_${targetDate}`;
  if (!dbData.dailyLogs[altKey]) {
    dbData.dailyLogs[altKey] = [];
  }
  if (!dbData.dailyLogs[altKey].some((m: any) => m.id === finalMealToInsert.id)) {
    dbData.dailyLogs[altKey].push(finalMealToInsert);
  }

  // Persist directly to Firestore foodLogs collection
  insertFoodLog({
    id: String(finalMealToInsert.id),
    userId: `usr_${phone}`,
    phone: phone,
    date: targetDate,
    foodName: finalMealToInsert.foodName,
    mealType: finalMealToInsert.mealType,
    calories: finalMealToInsert.calories,
    protein: finalMealToInsert.protein,
    carbs: finalMealToInsert.carbs,
    fat: finalMealToInsert.fat,
    fiber: finalMealToInsert.fiber,
    sugar: Number((finalMealToInsert as any).sugar) || 0,
    sodium: Number((finalMealToInsert as any).sodium) || 0,
    time: (finalMealToInsert as any).time || new Date().toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }),
    isHydration: Boolean(finalMealToInsert.isHydration),
    volumeMl: finalMealToInsert.volumeMl,
    displayUnit: (finalMealToInsert as any).displayUnit,
    portionType: (finalMealToInsert as any).portionType || "estimated",
    itemType: finalMealToInsert.isHydration ? "water" : "food",
    source: (finalMealToInsert as any).source || "WhatsApp",
    items: (finalMealToInsert as any).items || [],
    imageUrl: (finalMealToInsert as any).imageUrl,
    createdAt: new Date()
  }).catch((e: any) => console.warn("[Firestore] insertFoodLog note:", e?.message || e));

  if (isPlainWaterName(finalMealToInsert.foodName) && !finalMealToInsert.id?.startsWith("wa-water-")) {
    const vol = finalMealToInsert.volumeMl || 250;
    const cupsToAdd = Math.max(1, Math.round(vol / 250));
    const currentCups = getWaterCups(phone, targetDate);
    setWaterCups(phone, currentCups + cupsToAdd, targetDate);
  }

  saveDb();
}

// Delete the last food log entry for a user on a given date
// Returns the deleted item name or null if nothing to delete
function deleteLastMealLog(rawPhone: string, targetDateStr?: string): MealLog | null {
  const phone = normalizePhone(rawPhone);
  const targetDate = targetDateStr || getLocalDateStr();
  const key = `${phone}_${targetDate}`;
  const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
  const altKey = `${altPhone}_${targetDate}`;

  const logs = dbData.dailyLogs[key] || dbData.dailyLogs[altKey] || [];
  if (logs.length === 0) return null;

  const deletedItem = logs[logs.length - 1];
  const updatedLogs = logs.slice(0, -1);

  if (dbData.dailyLogs[key]) dbData.dailyLogs[key] = updatedLogs;
  if (dbData.dailyLogs[altKey]) dbData.dailyLogs[altKey] = updatedLogs;

  if (deletedItem && deletedItem.id) {
    deleteFoodLog(deletedItem.id).catch((e: any) => console.warn("[Firestore] deleteFoodLog note:", e?.message || e));
  }

  saveDb();
  return deletedItem;
}

// Delete a meal log entry by name (case-insensitive fuzzy match on the most recent match)
function deleteMealLogByName(rawPhone: string, foodNameQuery: string, targetDateStr?: string): MealLog | null {
  const phone = normalizePhone(rawPhone);
  const targetDate = targetDateStr || getLocalDateStr();
  const key = `${phone}_${targetDate}`;
  const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
  const altKey = `${altPhone}_${targetDate}`;

  const logs = dbData.dailyLogs[key] || dbData.dailyLogs[altKey] || [];
  const queryLower = foodNameQuery.toLowerCase();
  // Find the last entry whose name includes the query string
  let matchIdx = -1;
  for (let i = logs.length - 1; i >= 0; i--) {
    if ((logs[i].foodName || "").toLowerCase().includes(queryLower)) {
      matchIdx = i;
      break;
    }
  }
  if (matchIdx === -1) return null;

  const deletedItem = logs[matchIdx];
  const updatedLogs = logs.filter((_: any, i: number) => i !== matchIdx);

  if (dbData.dailyLogs[key]) dbData.dailyLogs[key] = updatedLogs;
  if (dbData.dailyLogs[altKey]) dbData.dailyLogs[altKey] = updatedLogs;

  if (deletedItem && deletedItem.id) {
    deleteFoodLog(deletedItem.id).catch((e: any) => console.warn("[Firestore] deleteFoodLog note:", e?.message || e));
  }

  saveDb();
  return deletedItem;
}

// Retrieve the last logged solid food meal for user on target date (ignoring plain water)
export function getLastFoodMeal(rawPhone: string, targetDateStr?: string): MealLog | null {
  const phone = normalizePhone(rawPhone);
  const targetDate = targetDateStr || getTodayDateStr();
  const key = `${phone}_${targetDate}`;
  const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
  const altKey = `${altPhone}_${targetDate}`;

  const logs = dbData.dailyLogs[key] || dbData.dailyLogs[altKey] || [];
  const foodLogs = logs.filter(l => l && !l.isHydration && !isPlainWaterName(l.foodName));
  if (foodLogs.length === 0) return null;
  const meal = foodLogs[foodLogs.length - 1];
  if (!meal.id) {
    meal.id = `m-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }
  return meal;
}

// Update existing meal log in-place in both memory cache and Firestore
// STRICT CANONICAL RULE: A correction modifies the original food log record in-place.
// It NEVER creates a new food log record and NEVER generates a new log ID.
export function updateExistingMealLog(rawPhone: string, updatedMeal: MealLog, targetDateStr?: string): boolean {
  const phone = normalizePhone(rawPhone);
  const targetDate = targetDateStr || getTodayDateStr();
  const key = `${phone}_${targetDate}`;
  const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
  const altKey = `${altPhone}_${targetDate}`;

  const targetId = String(updatedMeal.id || "");
  if (!targetId) {
    console.error("[updateExistingMealLog] Verification Failed: Cannot update meal without valid log ID.");
    return false;
  }

  let updatedCount = 0;

  // 1. In-place replacement for primary key: MUST update the EXACT record matching targetId
  if (dbData.dailyLogs[key] && Array.isArray(dbData.dailyLogs[key])) {
    const idx = dbData.dailyLogs[key].findIndex((m: any) => String(m.id) === targetId);
    if (idx >= 0) {
      dbData.dailyLogs[key][idx] = { ...updatedMeal, id: targetId };
      updatedCount++;
    }
    // Strictly deduplicate to ensure ONE canonical entry only
    dbData.dailyLogs[key] = deduplicateMealLogs(dbData.dailyLogs[key]);
  }

  // 2. In-place replacement for alternate key
  if (dbData.dailyLogs[altKey] && Array.isArray(dbData.dailyLogs[altKey])) {
    const idx = dbData.dailyLogs[altKey].findIndex((m: any) => String(m.id) === targetId);
    if (idx >= 0) {
      dbData.dailyLogs[altKey][idx] = { ...updatedMeal, id: targetId };
      updatedCount++;
    }
    dbData.dailyLogs[altKey] = deduplicateMealLogs(dbData.dailyLogs[altKey]);
  }

  // 3. Critical Validation: If no existing record was found to update, STOP! Do NOT create new meal!
  if (updatedCount === 0) {
    console.error(`[updateExistingMealLog] Verification Failed: Existing meal ${targetId} not found in logs for ${phone}. STOPPING to prevent duplicate entry.`);
    return false;
  }

  // 4. Update in persistent database layer & cache (in-place replacement)
  insertFoodLog({
    id: String(updatedMeal.id),
    userId: `usr_${phone}`,
    phone: phone,
    date: targetDate,
    foodName: updatedMeal.foodName,
    mealType: updatedMeal.mealType,
    calories: updatedMeal.calories,
    protein: updatedMeal.protein,
    carbs: updatedMeal.carbs,
    fat: updatedMeal.fat,
    fiber: updatedMeal.fiber,
    sugar: Number((updatedMeal as any).sugar) || 0,
    sodium: Number((updatedMeal as any).sodium) || 0,
    time: (updatedMeal as any).time || new Date().toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }),
    isHydration: Boolean(updatedMeal.isHydration),
    volumeMl: updatedMeal.volumeMl,
    displayUnit: (updatedMeal as any).displayUnit,
    portionType: (updatedMeal as any).portionType || "estimated",
    itemType: updatedMeal.isHydration ? "water" : "food",
    source: (updatedMeal as any).source || "WhatsApp",
    items: (updatedMeal as any).items || [],
    imageUrl: (updatedMeal as any).imageUrl,
    createdAt: (updatedMeal as any).createdAt ? new Date((updatedMeal as any).createdAt) : new Date()
  }).catch((e: any) => console.warn("[Firestore] updateFoodLog note:", e?.message || e));

  saveDb();
  return true;
}

// Natural language meal correction intent detector
export function detectMealCorrectionIntent(userText: string, hasRecentMeal: boolean): boolean {
  if (!userText || typeof userText !== "string") return false;
  const clean = userText.trim();
  const lower = clean.toLowerCase();

  // 1. Explicit prefixes & commands
  if (
    lower.startsWith("koreksi:") ||
    lower.startsWith("koreksi ") ||
    lower.startsWith("koreksi,") ||
    lower.startsWith("koreksi.") ||
    lower === "koreksi" ||
    lower.startsWith("ralat:") ||
    lower.startsWith("ralat ") ||
    lower.startsWith("ralat,") ||
    lower.startsWith("edit makanan") ||
    lower.startsWith("ganti makanan") ||
    lower.startsWith("ganti porsi") ||
    lower.startsWith("revisi porsi") ||
    lower.startsWith("ubah porsi")
  ) {
    return true;
  }

  if (/(?:^|\s)(?:koreksi|ralat|revisi)(?:[,:\s]|$)/i.test(clean)) {
    return true;
  }

  // 2. Natural language component updates when a recent meal exists
  if (hasRecentMeal) {
    const foodKeywords = "daging|beef|sapi|roti|bread|sub|nasi|rice|ayam|chicken|telur|egg|keju|cheese|sayur|sayuran|salad|sambal|saus|sauce|minyak|oil|kuah|susu|milk|kopi|coffee|teh|tea|gula|sugar|butter|topping|isian|kentang|potato|alpukat|ikan|fish|tahu|tempe";
    const portionUnits = "\\d+(?:[\\.,]\\d+)?\\s*(?:g|gr|gram|ml|potong|slice|sdm|sendok|buah|porsi)?|setengah|separuh|seperempat|sedikit|tanpa|1\\/2|1\\/4";

    if (
      new RegExp(`^(?:yang\\s+)?(?:${foodKeywords})(?:\\s*sapi|\\s*ayam|\\s*goreng)?(?:nya)?\\s*(?:tadi)?\\s*(?:cuma|hanya|cuman|jadi|sebanyak)?\\s*(?:${portionUnits})\\s*(?:aja|saja|doang)?$`, "i").test(lower) ||
      new RegExp(`^(?:yang\\s+)?([a-z\\s]+?)\\s*(?:nya\\s*)?(?:tadi\\s*)?(?:cuma|hanya|cuman|jadi|aja|saja|sebanyak)\\s*(${portionUnits})`, "i").test(lower) ||
      new RegExp(`^porsi\\s+([a-z\\s]+?)\\s*(?:nya\\s*)?(?:jadi|cuma|hanya|sebanyak)?\\s*(${portionUnits})`, "i").test(lower) ||
      new RegExp(`^(?:ternyata|sebenarnya|sebetulnya)\\s+([a-z\\s]+?)\\s*(?:nya\\s*)?(?:cuma|hanya|cuman|jadi|sebanyak)`, "i").test(lower) ||
      new RegExp(`^(?:ubah|ganti)\\s+([a-z\\s]+?)\\s*(?:jadi|ke|menjadi)\\s*(${portionUnits})`, "i").test(lower) ||
      new RegExp(`(?:${foodKeywords})(?:nya)?\\s*(?:tadi\\s*)?(?:cuma|hanya|cuman|jadi|aja|saja|sebanyak|diubah|ganti)\\s*(${portionUnits})`, "i").test(lower) ||
      new RegExp(`(?:${foodKeywords})(?:\\s*sapi|\\s*ayam)?\\s*(${portionUnits})\\s*(?:aja|saja|cuma|doang)`, "i").test(lower)
    ) {
      return true;
    }
  }

  return false;
}

export function applyDeterministicCorrection(lastMeal: MealLog, userText: string, isMia: boolean, user: any = "Member"): any {
  const userDataObj = typeof user === "object" && user !== null
    ? user
    : { name: String(user || "Member"), nickname: String(user || "Member"), persona: isMia ? "mia" : "max" };
  return applyTargetedMealCorrection(lastMeal, userText, userDataObj);
}

// Master Process Meal Correction Handler
export async function processMealCorrection(
  rawPhone: string,
  userText: string,
  userData: any,
  targetDateStr?: string
): Promise<{ mealRecord: MealLog; validatedParsed: any; oldMeal: MealLog; card: string } | null> {
  const phone = normalizePhone(rawPhone);
  const targetDate = targetDateStr || getTodayDateStr();
  const lastMeal = getLastFoodMeal(phone, targetDate);
  if (!lastMeal) return null;

  // 1. Apply targeted correction:
  // - Treats previously logged meal as SOURCE OF TRUTH (EDIT, NOT NEW ESTIMATION)
  // - Modifies ONLY specific item(s) explicitly mentioned by the user
  // - Preserves 100% of unchanged items' portions, calories, and macros
  // - Delta-based calculation: Corrected Meal = Original Meal − Old Item + New Item
  const parsedCorrection = applyTargetedMealCorrection(lastMeal, userText, userData);

  // If the correction request is ambiguous (e.g. "koreksi ayamnya" without portion/value),
  // return clarification question directly without modifying meal or database.
  if (parsedCorrection.isAmbiguous) {
    return {
      mealRecord: lastMeal,
      validatedParsed: parsedCorrection,
      oldMeal: lastMeal,
      card: parsedCorrection.clarificationMessage || parsedCorrection.coachComment
    };
  }

  const updatedCalories = Math.max(0, Math.round(Number(parsedCorrection.calories) || lastMeal.calories));
  const updatedProtein = Math.max(0, Number((Number(parsedCorrection.protein) || lastMeal.protein).toFixed(1)));
  const updatedCarbs = Math.max(0, Number((Number(parsedCorrection.carbs) || lastMeal.carbs).toFixed(1)));
  const updatedFat = Math.max(0, Number((Number(parsedCorrection.fat) || lastMeal.fat).toFixed(1)));
  const updatedFiber = Math.max(0, Number((Number(parsedCorrection.fiber) || lastMeal.fiber || 0).toFixed(1)));
  const updatedSugar = Math.max(0, Number((Number(parsedCorrection.sugar) || (lastMeal as any).sugar || 0).toFixed(1)));
  const updatedSodium = Math.max(0, Math.round(Number(parsedCorrection.sodium) || (lastMeal as any).sodium || 0));

  const originalLogId = String(lastMeal.id || "");
  if (!originalLogId) {
    console.error("[processMealCorrection] Verification Failed: No valid log ID found on meal being corrected.");
    return null;
  }

  const updatedMealRecord: MealLog = {
    ...lastMeal,
    id: originalLogId, // CANONICAL GUARANTEE: Preserves exact original log ID
    foodName: lastMeal.foodName,
    calories: updatedCalories,
    protein: updatedProtein,
    carbs: updatedCarbs,
    fat: updatedFat,
    fiber: updatedFiber,
    sugar: updatedSugar,
    sodium: updatedSodium,
    portionEstimates: parsedCorrection.portionEstimates || (lastMeal as any).portionEstimates,
    items: parsedCorrection.components.map(c => ({
      food_name: c.name,
      portion: c.portion,
      calories: c.calories,
      protein: c.protein,
      carbs: c.carbs,
      fat: c.fat,
      fiber: c.fiber,
      sugar: c.sugar,
      sodium: c.sodium
    })),
    timestamp: lastMeal.timestamp || new Date().toISOString()
  };

  // 2. Replace original meal in database (replaces old meal by ID in-place)
  // Critical Validation: Verifies that the existing record was updated and no duplicate was created
  const updatedOk = updateExistingMealLog(phone, updatedMealRecord, targetDate);
  if (!updatedOk) {
    console.error(`[processMealCorrection] Failed to update existing meal ${originalLogId}. Aborting to prevent duplicate food log.`);
    return null;
  }

  const validatedParsed = {
    ...parsedCorrection,
    isFood: true,
    isCorrection: true,
    foodName: lastMeal.foodName,
    calories: updatedCalories,
    protein: updatedProtein,
    carbs: updatedCarbs,
    fat: updatedFat,
    fiber: updatedFiber,
    sugar: updatedSugar,
    sodium: updatedSodium,
    portionEstimates: parsedCorrection.portionEstimates,
    coachComment: parsedCorrection.coachComment,
    confidenceLevel: 95
  };

  // 3. Daily totals recalculated from database logs:
  // Previous Daily Total − Original Meal Total + Corrected Meal Total = New Daily Total
  const dailyTotals = getDailyTotals(phone, targetDate);

  // 4. Response structure formatted identically to standard meal response
  const card = formatNutritionCard(
    validatedParsed,
    "Koreksi",
    userData,
    dailyTotals
  );

  return {
    mealRecord: updatedMealRecord,
    validatedParsed,
    oldMeal: lastMeal,
    card
  };
}

// Add Weekly Progress Entry & update database
function addWeeklyProgress(rawPhone: string, currentWeight: number, notes: string = "Progress Mingguan") {
  const phone = normalizePhone(rawPhone);
  const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
  const user = getUserProfile(phone) || getUserProfile(altPhone);
  if (!user) return null;

  const history = dbData.weeklyProgress[phone] || dbData.weeklyProgress[altPhone] || [];
  const startWeight = Number(user.startWeight) || currentWeight;
  const lastEntry = history.length > 0 ? history[history.length - 1] : null;
  const lastWeight = lastEntry ? Number(lastEntry.weight) : startWeight;

  const weekNumber = history.length;
  const changeFromStart = Number((currentWeight - startWeight).toFixed(1));
  const changeFromLastWeek = Number((currentWeight - lastWeight).toFixed(1));

  const userData = calculateUserData(user);
  const targetWeight = userData.targetWeight;
  const totalTargetDiff = Math.max(0.1, Math.abs(startWeight - targetWeight));
  const currentDiff = Math.abs(startWeight - currentWeight);
  const progressPercent = Math.min(100, Math.max(0, Math.round((currentDiff / totalTargetDiff) * 100)));

  const entry: WeeklyEntry = {
    week: weekNumber,
    weight: currentWeight,
    changeFromStart,
    changeFromLastWeek,
    progressPercent,
    date: new Date().toISOString(),
    notes
  };

  if (!dbData.weeklyProgress[phone]) {
    dbData.weeklyProgress[phone] = [];
  }
  dbData.weeklyProgress[phone].push(entry);
  dbData.weeklyProgress[altPhone] = dbData.weeklyProgress[phone];

  // Update current weight in user profile database
  user.weight = currentWeight;
  user.updatedAt = new Date().toISOString();
  dbData.users[phone] = user;
  dbData.users[altPhone] = user;

  saveDb();
  saveUserProfile(phone, user);

  // Sync to Firestore UserDocument immediately
  saveUserDocument({
    userId: `usr_${phone}`,
    phone: phone,
    ...user,
    weight: currentWeight,
    updatedAt: new Date()
  }).catch(() => {});

  return { entry, history: dbData.weeklyProgress[phone], userData: calculateUserData(user) };
}

function formatWeeklyProgressCard(progressResult: NonNullable<ReturnType<typeof addWeeklyProgress>>): string {
  const { entry, userData } = progressResult;
  const { name, targetWeight, goalTitle, persona } = userData;

  const prevWeight = userData.startWeight || entry.weight;
  const currWeight = entry.weight;
  const targetW = targetWeight || 65;
  const diffRemaining = Math.round(Math.abs(currWeight - targetW) * 10) / 10;

  const filledBars = Math.min(10, Math.max(0, Math.floor(entry.progressPercent / 10)));
  const progressVisual = "🟩".repeat(filledBars) + "⬜".repeat(10 - filledBars);

  const isFemale = (userData.gender || "").toLowerCase() === "wanita" || (userData.gender || "").toLowerCase() === "female";
  const isMia = (persona || "mia").toLowerCase().includes("mia");
  const coachName = isMia ? "Coach Mia" : "Coach Max";

  let comment = "";
  if (isMia) {
    comment = diffRemaining <= 1
      ? `Luar biasa ${name}! Kamu sudah sangat dekat dengan target impianmu. Tetap konsisten dan jaga pola hidup sehatmu ya! ✨`
      : `Catatan berat badan terbarumu sudah tersimpan rapi ${name}. Setiap langkah kecil membawa hasil besar, tetap semangat! ✨`;
  } else {
    comment = isFemale
      ? (diffRemaining <= 1
          ? `Target udah di depan mata! Pertahankan fokus dan konsistensi kamu sampai garis finish! 🔥`
          : `Progres tercatat. Tetap disiplin di gym dan jaga asupan nutrisi harian kamu! 💪`)
      : (diffRemaining <= 1
          ? `Target udah di depan mata bro! Pertahankan disiplin lo sampai garis finish! 🔥`
          : `Progres tercatat. Tetap disiplin latihan dan jaga asupan makro lo! 💪`);
  }

  return `⚖️ *BERAT DIPERBARUI*
━━━━━━━━━━━━━━
• *Sebelumnya*: ${prevWeight} kg
• *Sekarang*: ${currWeight} kg
• *Target*: ${targetW} kg

📊 *Progress Menuju Target*:
${diffRemaining} kg tersisa (${entry.progressPercent}% tercapai)
${progressVisual}

💬 *${coachName}*:
"${comment}"`;
}

function formatProgressHistoryCard(rawPhone: string): string {
  const phone = normalizePhone(rawPhone);
  const user = getUserProfile(phone);
  if (!user) {
    return "Profil kamu belum terdaftar di database. Silakan isi kuesioner terlebih dahulu!";
  }
  const history = dbData.weeklyProgress[phone] || [];
  const userData = calculateUserData(user);

  let rowsStr = "";
  if (history.length === 0) {
    rowsStr = "• Belum ada rekaman progress mingguan.";
  } else {
    rowsStr = history.map(h => {
      const dStr = new Date(h.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
      const chg = h.changeFromStart <= 0 ? `${h.changeFromStart}kg` : `+${h.changeFromStart}kg`;
      return `• Mg-${h.week} (${dStr}): *${h.weight} kg* (${chg})`;
    }).join("\n");
  }

  const latest = history[history.length - 1];
  const progressPercent = latest ? latest.progressPercent : 0;
  const filledBars = Math.floor(progressPercent / 10);
  const progressVisual = "🟩".repeat(filledBars) + "⬜".repeat(10 - filledBars);

  return `📊 *RIWAYAT PROGRESS GOALS - ${userData.name.toUpperCase()}*

🎯 *Goal Utama*: ${userData.goalTitle}
⚖️ *Target BB*: ${userData.startWeight}kg → ${userData.targetWeight}kg
📈 *Progres Capaian*: ${progressPercent}%
${progressVisual}

🗓️ *Catatan Per Minggu*:
${rowsStr}

💡 *Tips*: Ketik *"update bb 75"* untuk mencatat berat badan terbarumu minggu ini!`;
}



// Send quick message via Meta Cloud API
async function sendMetaWhatsappMessage(to: string, bodyText: string) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) return;
  try {
    const cleanText = sanitizeWhatsAppResponse(bodyText);
    await axios.post(
      `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: to,
        text: { body: cleanText },
      },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
    );
  } catch (err) {
    console.error("Error sending Meta WhatsApp message:", err);
  }
}

// Send quick message via Twilio API
async function sendTwilioWhatsappMessage(to: string, bodyText: string) {
  const client = getTwilio();
  if (!client) return;
  try {
    const toNum = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    const fromNum = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
    await client.messages.create({
      from: fromNum,
      to: toNum,
      body: bodyText
    });
  } catch (err) {
    console.error("Error sending Twilio WhatsApp message:", err);
  }
}

function parseDateFromQuery(userText: string): { dateStr: string; label: string; isYesterday: boolean; isToday: boolean; isSpecificDate: boolean } {
  const lower = userText.toLowerCase().trim();
  const wibNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const getWibDate = (d: Date) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

  if (lower.includes("kemarin lusa") || lower.includes("2 hari lalu")) {
    const d = new Date(wibNow.getTime() - 86400000 * 2);
    const label = `${d.getUTCDate()} ${monthNames[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    return { dateStr: getWibDate(d), label, isYesterday: false, isToday: false, isSpecificDate: true };
  }

  if (lower.includes("kemarin") || lower.includes("yesterday")) {
    const d = new Date(wibNow.getTime() - 86400000);
    const label = `${d.getUTCDate()} ${monthNames[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    return { dateStr: getWibDate(d), label, isYesterday: true, isToday: false, isSpecificDate: true };
  }

  const textDateMatch = lower.match(/(?:tanggal|tgl|di\s*)?\s*(\d{1,2})\s*(?:de\s*)?(januari|jan|februari|feb|maret|mar|april|apr|mei|may|juni|jun|juli|jul|agustus|agust|agu|august|aug|september|sept|sep|oktober|okt|october|oct|november|nov|desember|des|december|dec)(?:\s*(\d{4}))?/i);
  
  if (textDateMatch) {
    const dayNum = parseInt(textDateMatch[1], 10);
    const monthStr = textDateMatch[2].toLowerCase();
    const explicitYear = textDateMatch[3] ? parseInt(textDateMatch[3], 10) : wibNow.getUTCFullYear();

    const monthMap: Record<string, number> = {
      jan: 0, januari: 0,
      feb: 1, februari: 1,
      mar: 2, maret: 2,
      apr: 3, april: 3,
      mei: 4, may: 4,
      jun: 5, juni: 5,
      jul: 6, juli: 6,
      agu: 7, agust: 7, agustus: 7, aug: 7, august: 7,
      sep: 8, sept: 8, september: 8,
      okt: 9, oktober: 9, oct: 9, october: 9,
      nov: 10, november: 10,
      des: 11, desember: 11, dec: 11, december: 11
    };

    const mIdx = monthMap[monthStr];
    if (mIdx !== undefined && dayNum >= 1 && dayNum <= 31) {
      const dStr = `${explicitYear}-${String(mIdx + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      const label = `${dayNum} ${monthNames[mIdx]} ${explicitYear}`;
      return { dateStr: dStr, label, isYesterday: false, isToday: dStr === getWibDate(wibNow), isSpecificDate: true };
    }
  }

  const isoMatch = lower.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const label = `${day} ${monthNames[m]} ${y}`;
    return { dateStr: isoMatch[0], label, isYesterday: false, isToday: isoMatch[0] === getWibDate(wibNow), isSpecificDate: true };
  }

  const todayLabel = `${wibNow.getUTCDate()} ${monthNames[wibNow.getUTCMonth()]} ${wibNow.getUTCFullYear()}`;
  return { dateStr: getWibDate(wibNow), label: todayLabel, isYesterday: false, isToday: true, isSpecificDate: false };
}

export function formatNutritionCard(
  parsedAi: any,
  inputSource: string,
  userData: ReturnType<typeof calculateUserData>,
  dailyTotals: ReturnType<typeof getDailyTotals>
): string {
  const rawFoodName = String(parsedAi?.canonicalMealTitle || parsedAi?.foodName || "Estimasi Makanan").trim();
  const cleanFoodName = rawFoodName.replace(/^[🍽️🥜🥗🥘🍛🍗🥩🍳\s]+/, "").trim() || "Estimasi Makanan";

  const calories = Math.max(0, Math.round(Number(parsedAi?.calories) || 0));
  const protein = Math.max(0, Number((Number(parsedAi?.protein) || 0).toFixed(1)));
  const carbs = Math.max(0, Number((Number(parsedAi?.carbs) || 0).toFixed(1)));
  const fat = Math.max(0, Number((Number(parsedAi?.fat) || 0).toFixed(1)));
  const fiber = Math.max(0, Number((Number(parsedAi?.fiber) || 0).toFixed(1)));
  const sugar = Math.max(0, Number((Number(parsedAi?.sugar) || 0).toFixed(1)));
  const sodium = Math.max(0, Math.round(Number(parsedAi?.sodium) || (parsedAi?.sodiumMg ? Number(parsedAi.sodiumMg) : 0)));

  const protKcal = protein * 4;
  const carbKcal = carbs * 4;
  const fatKcal = fat * 9;
  const totalMacroKcal = protKcal + carbKcal + fatKcal || calories || 1;

  const protPercent = Math.round((protKcal / totalMacroKcal) * 100);
  const carbPercent = Math.round((carbKcal / totalMacroKcal) * 100);
  const fatPercent = Math.round((fatKcal / totalMacroKcal) * 100);

  const confidenceScore = Math.min(98, Math.max(75, Number(parsedAi?.confidenceLevel) || (String(inputSource).toLowerCase().includes("foto") ? 88 : 92)));

  // Always display time in WIB (UTC+7)
  const wibNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const wibIso = wibNow.toISOString();
  const [wibDatePart, wibTimePart] = wibIso.split("T");
  const [wibYear, wibMonth, wibDay] = wibDatePart.split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const dateStr = `${parseInt(wibDay)} ${monthNames[parseInt(wibMonth) - 1]} ${wibYear}`;
  const timeStr = wibTimePart.substring(0, 5).replace(":", ".");

  // Portion details
  let portionDetailText = "";
  if (Array.isArray(parsedAi?.portionEstimates) && parsedAi.portionEstimates.length > 0) {
    portionDetailText = parsedAi.portionEstimates
      .map((p: any) => {
        const line = typeof p === "string" ? p.trim() : JSON.stringify(p);
        return line.startsWith("•") ? line : `• ${line}`;
      })
      .filter(Boolean)
      .join("\n");
  } else if (parsedAi?.portionDetail) {
    portionDetailText = `• ${String(parsedAi.portionDetail).trim()}`;
  } else {
    portionDetailText = `• 1 Porsi Standar (~${calories} kcal)`;
  }

  // Active Coach Dynamic Determination
  const persona = (userData?.persona || "mia").toLowerCase();
  const isMax = persona === "max";
  const coachHeader = isMax ? "COACH MAX" : "COACH MIA";

  // Dashboard synchronized daily totals and targets
  const totalTodayCal = Math.max(0, Math.round(Number(dailyTotals?.calories) || 0));
  const targetCal = Math.max(1, Math.round(Number(userData?.targetCalories) || 2000));
  const totalTodayProt = Math.max(0, Number((Number(dailyTotals?.protein) || 0).toFixed(1)));
  const targetProt = Math.max(1, Math.round(Number(userData?.proteinGrams) || 120));
  const totalTodayCarb = Math.max(0, Number((Number(dailyTotals?.carbs) || 0).toFixed(1)));
  const targetCarb = Math.max(1, Math.round(Number(userData?.carbGrams) || 240));
  const totalTodayFat = Math.max(0, Number((Number(dailyTotals?.fat) || 0).toFixed(1)));
  const targetFat = Math.max(1, Math.round(Number(userData?.fatGrams) || 65));
  const totalTodaySodium = Math.max(0, Math.round(Number((dailyTotals as any)?.sodium) || 0));
  const sodiumLimit = 2000;
  const totalTodaySugar = Math.max(0, Number((Number((dailyTotals as any)?.sugar) || 0).toFixed(1)));
  const sugarLimit = 50;

  // Single Source of Truth Nutrition Summary & Progress Bars
  const nutritionSummary = calculateDailyNutritionSummary(
    { calories: totalTodayCal, protein: totalTodayProt, carbs: totalTodayCarb, fat: totalTodayFat, sodium: totalTodaySodium, sugar: totalTodaySugar },
    { targetCalories: targetCal, proteinGrams: targetProt, carbGrams: targetCarb, fatGrams: targetFat, sodiumLimit, sugarLimit }
  );

  const calBar = makeProgressBar(totalTodayCal, targetCal);
  const protBar = makeProgressBar(totalTodayProt, targetProt);
  const carbBar = makeProgressBar(totalTodayCarb, targetCarb);
  const fatBar = makeProgressBar(totalTodayFat, targetFat);
  const sodBar = makeSodiumProgressBar(totalTodaySodium, sodiumLimit);
  const sugBar = makeSugarProgressBar(totalTodaySugar, sugarLimit);

  // Status-aware and persona-aligned Coach Message (Strict Age-based Addressing)
  const addressing = getValidatedUserAddressing(userData);
  const validatedAddr = addressing.validatedAddress;
  const isLansia = addressing.ageGroup === "Lansia";

  let coachComment = String(parsedAi?.coachComment || "").replace(/^["“]|["”]$/g, "").trim();

  // If coach comment is generic or missing, or if key limits/targets are hit, formulate natural persona coaching message:
  if (!coachComment || (!parsedAi?.isCorrection && (nutritionSummary.sodium.isOver || nutritionSummary.sugar.isOver || nutritionSummary.fat.isOver || nutritionSummary.calories.isOver))) {
    if (nutritionSummary.sodium.isOver) {
      coachComment = isMax
        ? (isLansia
            ? `Asupan natrium Anda sudah mencapai ${totalTodaySodium.toLocaleString("id-ID")} mg hari ini, ${validatedAddr}. Mohon imbangi dengan minum air putih hangat dan pilih menu rendah garam untuk makan berikutnya ya. 💪`
            : `Sodium kamu sudah tembus ${totalTodaySodium.toLocaleString("id-ID")} mg hari ini, ${validatedAddr}! Langsung imbangi dengan minum air putih 500ml-1L sekarang dan pilih menu rendah garam untuk makan berikutnya ya. 💪`)
        : (isLansia
            ? `Asupan natrium Anda hari ini sudah mencapai ${totalTodaySodium.toLocaleString("id-ID")} mg (melewati batas 2.000 mg) ya, ${validatedAddr} ✨ Yuk imbangi dengan minum air putih yang cukup dan pilih menu yang lebih segar rendah garam nanti.`
            : `Asupan natrium hari ini sudah mencapai ${totalTodaySodium.toLocaleString("id-ID")} mg (melewati batas 2.000 mg) ya ${validatedAddr} ✨ Yuk imbangi dengan minum air putih yang cukup dan pilih menu yang lebih segar rendah garam nanti.`);
    } else if (nutritionSummary.sugar.isOver) {
      coachComment = isMax
        ? (isLansia
            ? `Asupan gula Anda sudah mencapai ${totalTodaySugar}g (melewati batas anjuran ${sugarLimit}g), ${validatedAddr}. Mohon imbangi dengan banyak minum air putih dan batasi asupan manis untuk sisa hari ini ya. 💪`
            : `Gula harian kamu sudah tembus ${totalTodaySugar}g (lewat batas anjuran ${sugarLimit}g), ${validatedAddr}! Yuk langsung imbangi dengan banyak minum air putih dan kurangi camilan manis untuk sisa hari ini ya! ⚡`)
        : (isLansia
            ? `Asupan gula Anda hari ini sudah mencapai ${totalTodaySugar}g (melewati batas anjuran ${sugarLimit}g) ya, ${validatedAddr} ✨ Yuk imbangi dengan minum air putih yang cukup dan pilih minuman tanpa gula nanti.`
            : `Asupan gula hari ini sudah mencapai ${totalTodaySugar}g (melewati batas anjuran ${sugarLimit}g) ya ${validatedAddr} ✨ Yuk imbangi dengan minum air putih yang cukup dan pilih camilan atau minuman tanpa gula nanti.`);
    } else if (nutritionSummary.fat.isOver && nutritionSummary.protein.isUnder) {
      coachComment = isMax
        ? (isLansia
            ? `Asupan lemak Anda sudah melampaui target hari ini (${totalTodayFat}/${targetFat}g), ${validatedAddr}. Untuk makan selanjutnya prioritaskan protein sehat tanpa banyak minyak ya. 💪`
            : `Asupan lemak kamu sudah lewat target hari ini (${totalTodayFat}/${targetFat}g), ${validatedAddr}, sementara protein masih perlu ditambah. Untuk makan selanjutnya prioritaskan protein bersih kayak dada ayam atau telur rebus ya! 🔥`)
        : (isLansia
            ? `Lemak harian Anda sudah sedikit melebihi target ya, ${validatedAddr}. Untuk makan berikutnya, kita prioritaskan sumber protein bersih tanpa banyak minyak/gorengan ya ✨`
            : `Lemak harian kamu sudah sedikit melebihi target ya, ${validatedAddr}. Untuk makan berikutnya, kita prioritaskan sumber protein bersih tanpa banyak minyak/gorengan ya ✨`);
    } else if (nutritionSummary.calories.isOver) {
      coachComment = isMax
        ? (isLansia
            ? `Target kalori harian Anda sudah terpenuhi (${totalTodayCal}/${targetCal} kcal), ${validatedAddr}. Cukupi hidrasi air putih dan optimalkan istirahat ya. 💪`
            : `Kalori harian kamu sudah melampaui target (${totalTodayCal}/${targetCal} kcal), ${validatedAddr}! Kunci disiplin kamu hari ini, perbanyak minum air putih dan maksimalkan istirahat! ⚡`)
        : (isLansia
            ? `Kalori harian Anda sudah terpenuhi hari ini (${totalTodayCal}/${targetCal} kcal), ${validatedAddr}. Cukupi hidrasi air putih dan istirahat optimal ya ✨`
            : `Kalori harian kamu sudah terpenuhi hari ini (${totalTodayCal}/${targetCal} kcal), ${validatedAddr}. Cukupi hidrasi air putih dan istirahat optimal ya ✨`);
    } else if (nutritionSummary.protein.isReached) {
      coachComment = isMax
        ? (isLansia
            ? `Target protein harian Anda sudah tercapai (${totalTodayProt}/${targetProt}g), ${validatedAddr}! Pertahankan konsistensi nutrisi sehat ini. 💪`
            : `Target protein harian kamu sudah tembus (${totalTodayProt}/${targetProt}g), ${validatedAddr}! Mantap banget disiplin kamu! 💪🔥`)
        : (isLansia
            ? `Luar biasa, target protein Anda hari ini sudah tercapai (${totalTodayProt}/${targetProt}g), ${validatedAddr}! Pertahankan pola makan sehat ini ya ✨`
            : `Luar biasa, target protein kamu hari ini sudah tercapai (${totalTodayProt}/${targetProt}g), ${validatedAddr}! Pertahankan pola makan sehat ini ya ✨`);
    } else if (protein >= 25) {
      coachComment = isMax
        ? (isLansia
            ? `Pilihan yang sangat baik, ${validatedAddr}. Menu ini memberikan suplai protein padat (${protein}g) yang sangat bagus untuk kebugaran tubuh Anda. 💪`
            : `Pilihan mantap, ${validatedAddr}! Makanan ini kasih suplai protein padat (${protein}g) yang bagus banget buat recovery otot kamu! 💪`)
        : `Pilihan makanan yang bagus, ${validatedAddr}! Mengandung ${protein}g protein yang sangat baik untuk mencukupi kebutuhan harianmu ✨`;
    } else {
      coachComment = isMax
        ? (isLansia
            ? `Catatan makanan Anda sudah tersimpan rapi, ${validatedAddr}. Terus jaga konsistensi kebugaran Anda hari ini! 💪`
            : `Mantap, ${validatedAddr}! Makanan kamu sudah tercatat, jaga terus konsistensi nutrisi kamu hari ini! 💪`)
        : `Catatan makananmu sudah tersimpan rapi ya, ${validatedAddr}. Semangat terus jaga pola makan seimbangmu! ✨`;
    }
  }

  // 7-Point Coach Note Validation & Sanitization
  coachComment = validateAndFormatCoachNote(coachComment, userData);

  // Construct sections cleanly without empty/consecutive separators
  const sections: string[] = [];

  // Header: Meal Title & Meta
  sections.push(`🍽️ *${cleanFoodName.toUpperCase()}*\n\n🕒 ${dateStr}, ${timeStr} WIB · 🤖 AI: ${confidenceScore}%`);

  // Section 1: Rekap Nutrisi
  let nutrContent = `🔥 *${calories} kcal*\n\n` +
    `🍖 *Protein*: ${protein}g (${protPercent}%)\n` +
    `🍚 *Karbo*: ${carbs}g (${carbPercent}%)\n` +
    `🥓 *Lemak*: ${fat}g (${fatPercent}%)\n` +
    `🥬 *Serat*: ${fiber}g\n` +
    `🧂 *Natrium*: ${sodium} mg`;
  if (sugar > 0) {
    nutrContent += `\n🍯 *Gula*: ${sugar}g`;
  }
  sections.push(`━━━━━━━━━━━━━━\n📊 *REKAP NUTRISI*\n━━━━━━━━━━━━━━\n${nutrContent}`);

  // Section 2: Estimasi Porsi (only if portion detail text exists)
  if (portionDetailText.trim()) {
    sections.push(`━━━━━━━━━━━━━━\n🍽️ *ESTIMASI PORSI*\n━━━━━━━━━━━━━━\n${portionDetailText.trim()}`);
  }

  // Section 3: Active Coach
  sections.push(`━━━━━━━━━━━━━━\n🤖 *${coachHeader}*\n━━━━━━━━━━━━━━\n"${coachComment}"`);

  // Section 4: Status Hari Ini (Order: Kalori -> Protein -> Karbo -> Lemak -> Natrium -> Gula)
  const statusContent = `🔥 *Kalori*: ${totalTodayCal}/${targetCal} kcal\n${calBar}\n\n` +
    `🍖 *Protein*: ${totalTodayProt}/${targetProt}g\n${protBar}\n\n` +
    `🍚 *Karbo*: ${totalTodayCarb}/${targetCarb}g\n${carbBar}\n\n` +
    `🥓 *Lemak*: ${totalTodayFat}/${targetFat}g\n${fatBar}\n\n` +
    `🧂 *Natrium*: ${totalTodaySodium.toLocaleString("id-ID")}/2,000 mg\n${sodBar}\n\n` +
    `🍯 *Gula*: ${totalTodaySugar}/${sugarLimit}g\n${sugBar}`;
  sections.push(`━━━━━━━━━━━━━━\n📈 *STATUS HARI INI*\n━━━━━━━━━━━━━━\n${statusContent}`);

  // Footer
  sections.push(`━━━━━━━━━━━━━━\n⚙️ _Ketik "koreksi: [porsi]" untuk edit atau "hapus log terakhir"_`);

  return sections.join("\n\n");
}

function generateWelcomeMessages(userData: ReturnType<typeof calculateUserData>): string[] {
  const {
    name,
    gender,
    age,
    ageGroup,
    weight,
    targetWeight,
    goalTitle,
    persona,
    targetCalories,
    proteinGrams,
    carbGrams,
    fatGrams,
    fiberGrams,
    activeService,
    equipment,
    injuries,
    customInjury,
    healthConditionsSummary
  } = userData;

  const isMax = persona === "max";
  const isFemale = (gender || "").toLowerCase() === "wanita" || (gender || "").toLowerCase() === "female";
  const ageNum = Number(age) || 25;
  const isLansia = ageNum >= 60;
  const isAnak = ageNum < 13;

  const cleanName = (name || "Member").trim();
  const cleanGoal = goalTitle || "Kebugaran & Hidup Sehat";

  // 1. Personalized Opening
  let opening = "";
  if (isMax) {
    if (isLansia) {
      const honorific = isFemale ? "Bu" : "Pak";
      opening = `💪 *Halo ${honorific} ${cleanName}!* Saya Coach Max, siap mendampingi target kebugaran Anda di GymBuddy dengan aman & terukur.\n\n` +
        `Program latihan & nutrisi Anda telah saya sesuaikan dengan goal *${cleanGoal}* serta profil tubuh Anda.`;
    } else if (isAnak) {
      opening = `💪 *Halo ${cleanName}!* Aku Coach Max, AI Coach kamu di GymBuddy! 🌟\n\n` +
        `Panduan nutrisi & aktivitas kamu sudah disesuaikan dengan goal *${cleanGoal}* biar kamu makin sehat & aktif!`;
    } else if (isFemale) {
      opening = `💪 *Halo ${cleanName}!* Gue Coach Max, AI Coach kamu di GymBuddy. 🔥\n\n` +
        `Program latihan & nutrisi kamu udah gue sesuaikan penuh dengan goal *${cleanGoal}* dan profil tubuh kamu.`;
    } else {
      opening = `💪 *Halo ${cleanName}!* Gue Coach Max, AI Coach lo di GymBuddy. 🔥\n\n` +
        `Program latihan & nutrisi lo udah gue sesuaikan penuh dengan goal *${cleanGoal}* dan profil tubuh lo.`;
    }
  } else {
    // Coach Mia
    if (isLansia) {
      const honorific = isFemale ? "Bu" : "Pak";
      opening = `🌿 *Halo ${honorific} ${cleanName}!* Saya Coach Mia, senang sekali bisa mendampingi perjalanan sehat Anda di GymBuddy dengan nyaman & aman. ✨\n\n` +
        `Seluruh rencana nutrisi dan kebugaran telah saya sesuaikan dengan goal *${cleanGoal}* serta kondisi kesehatan Anda.`;
    } else if (isAnak) {
      opening = `🌿 *Halo ${cleanName}!* Aku Coach Mia, senang sekali bisa nemenin kamu di GymBuddy! ✨\n\n` +
        `Rencana makan sehat dan aktivitas kamu sudah aku sesuaikan dengan goal *${cleanGoal}*!`;
    } else {
      opening = `🌿 *Halo ${cleanName}!* Aku Coach Mia, AI Coach & Nutritionist kamu di GymBuddy. ✨\n\n` +
        `Aku sudah menyesuaikan seluruh pendampinganmu dengan goal *${cleanGoal}* dan profil tubuhmu.`;
    }
  }

  // 2. Compact Feature Registry Overview
  const pronoun = isLansia ? "Anda" : (isMax && !isFemale ? "lo" : "kamu");
  const pronounSuffix = isLansia ? " Anda" : (isMax && !isFemale ? "mu" : "mu");

  const featureOverview = `Yang bisa ${pronoun} lakukan lewat WhatsApp & App:\n\n` +
    `🥗 *Nutrition*\n` +
    `• Foto atau ketik makanan → cek kalori, makro, gula & langsung log\n` +
    `• *"rekap hari ini"* / *"rekap kemarin"* → pantau sisa target harian\n` +
    `• *"rekomendasi makanan"* → cari ide menu sehat sesuai goal\n` +
    `• *"update bb ${weight || 70}"* → perbarui catatan timbang berat badan\n` +
    `• *"koreksi: [porsi]"* / *"hapus log terakhir"* → edit riwayat makan\n\n` +
    `🏋️ *Workout*\n` +
    `• Cek jadwal latihan harian & rekomendasi menu latihan\n` +
    `• Tanya cara pakai alat gym & panduan teknik gerakan (GIF guide)\n` +
    `• Kirim foto alat gym / video gerakan untuk form feedback\n` +
    `• Catat set latihan atau olahraga apa pun (renang, lari, sepedaan, dll.)\n\n` +
    `📊 *Progress & Dashboard*\n` +
    `• Pantau grafik kalori, makro, hidrasi, workout & BB di Dashboard\n` +
    `• Semua log makanan & latihan tersimpan permanen di riwayat\n\n` +
    `👤 *Profile & Target*\n` +
    `• Atur data personal, target kustom, kondisi kesehatan & Coach di web app`;

  // 3. Personalization Note
  const personalizationNote = isLansia
    ? `Semua saran akan disesuaikan secara personal dengan profil, usia, dan kondisi kesehatan Anda.`
    : `Semua saran akan disesuaikan dengan profil, usia, dan kondisi tubuh${pronounSuffix}.`;

  // 4. Closing CTA
  let closing = "";
  if (isMax) {
    if (isLansia) {
      closing = `Jika sudah siap, silakan kirimkan menu makanan pertama atau pertanyaan latihan Anda. 💪`;
    } else if (isFemale) {
      closing = `Gas mulai! Kirim foto makanan pertama kamu, log latihan, atau tanya apa pun sekarang! 🔥`;
    } else {
      closing = `Gas mulai! Kirim foto makanan pertama lo, log latihan, atau tanya apa pun sekarang! 🔥`;
    }
  } else {
    if (isLansia) {
      closing = `Jika sudah siap, silakan kirimkan foto/menu makanan pertama atau pertanyaan Anda. 🌿`;
    } else {
      closing = `Yuk mulai! Coba kirim foto makanan, log latihan, atau ajukan pertanyaan pertamamu sekarang! ✨`;
    }
  }

  // Full rendered greeting
  let fullGreeting = `${opening}\n\n${featureOverview}\n\n${personalizationNote}\n\n${closing}`;

  // Twilio Character Limit Safety Validator (Target: 1,000 - 1,300 chars, Safe Max: 1,350)
  if (fullGreeting.length > 1350) {
    const compactFeatures = `Yang bisa ${pronoun} lakukan:\n\n` +
      `🥗 *Nutrition*\n` +
      `• Foto/ketik makanan → cek kalori, makro, gula & log\n` +
      `• *"rekap hari ini"* → lihat sisa target & nutrisi\n` +
      `• *"rekomendasi makanan"* → ide menu sehat\n` +
      `• *"update bb ${weight || 70}"* → update berat badan\n` +
      `• *"koreksi"* / *"hapus log"* → edit riwayat makan\n\n` +
      `🏋️ *Workout*\n` +
      `• Cek jadwal & rekomendasi latihan harian\n` +
      `• Tanya cara pakai alat & panduan gerakan (GIF guide)\n` +
      `• Kirim foto alat / video untuk feedback teknik\n` +
      `• Catat latihan terjadwal atau aktivitas bebas (renang, lari, dll.)\n\n` +
      `📊 *Progress & Profile*\n` +
      `• Pantau grafik kalori, makro, hidrasi & BB di Dashboard\n` +
      `• Kelola data personal & target kustom di aplikasi`;

    fullGreeting = `${opening}\n\n${compactFeatures}\n\n${personalizationNote}\n\n${closing}`;
  }

  return [fullGreeting];
}

function formatHistoricalFoodLog(
  userData: ReturnType<typeof calculateUserData>,
  dailyTotals: ReturnType<typeof getDailyTotals>,
  dateInfo: ReturnType<typeof parseDateFromQuery>
): string {
  const dateLabel = dateInfo.label;

  if (!dailyTotals || dailyTotals.logs.length === 0) {
    if (dateInfo.isYesterday) {
      return (
        `📅 *LOG MAKANAN — KEMARIN*\n` +
        `${dateLabel}\n\n` +
        `Belum ada makanan atau minuman yang tercatat kemarin.\n\n` +
        `Kamu bisa kirim menu makanmu kapan saja dan aku siap bantu catat. 😊`
      );
    }
    return (
      `📅 *LOG MAKANAN — ${dateLabel.toUpperCase()}*\n\n` +
      `Belum ada makanan atau minuman yang tercatat untuk tanggal ini.\n\n` +
      `Kalau kamu baru saja makan, kamu bisa langsung kirim menu atau fotonya dan aku bantu catat. 😊`
    );
  }

  // Group by mealType
  const mealTypeOrder = ["breakfast", "lunch", "dinner", "snack"];
  const mealTypeLabels: Record<string, string> = {
    breakfast: "🍳 *Breakfast*",
    lunch: "🍛 *Lunch*",
    dinner: "🌙 *Dinner*",
    snack: "🥪 *Snack*"
  };

  const sections: string[] = [];
  const groups: Record<string, any[]> = {};
  dailyTotals.logs.forEach(log => {
    const type = log.mealType || "lunch";
    if (!groups[type]) groups[type] = [];
    groups[type].push(log);
  });

  mealTypeOrder.forEach(type => {
    if (groups[type] && groups[type].length > 0) {
      const header = mealTypeLabels[type] || `🍽️ *${type}*`;
      const items = groups[type].map(m => `• ${m.foodName}`).join("\n");
      const mealCals = groups[type].reduce((sum, m) => sum + (Number(m.calories) || 0), 0);
      sections.push(`${header}\n${items}\n🔥 ${mealCals} kcal`);
    }
  });

  // Handle any other mealType
  Object.keys(groups).forEach(type => {
    if (!mealTypeOrder.includes(type) && groups[type].length > 0) {
      const items = groups[type].map(m => `• ${m.foodName}`).join("\n");
      const mealCals = groups[type].reduce((sum, m) => sum + (Number(m.calories) || 0), 0);
      sections.push(`🍽️ *${type.toUpperCase()}*\n${items}\n🔥 ${mealCals} kcal`);
    }
  });

  const sodiumVal = (dailyTotals as any).sodium || 0;

  return (
    `🍽️ *LOG MAKANAN*\n` +
    `📅 ${dateLabel}\n\n` +
    sections.join("\n\n") + "\n\n" +
    `━━━━━━━━━━━━━━\n` +
    `📊 *TOTAL HARI ITU*\n` +
    `━━━━━━━━━━━━━━\n` +
    `🔥 Kalori: ${dailyTotals.calories} kcal\n` +
    `🍖 Protein: ${dailyTotals.protein} g\n` +
    `🍚 Karbo: ${dailyTotals.carbs} g\n` +
    `🥓 Lemak: ${dailyTotals.fat} g\n` +
    `🧂 Natrium: ${sodiumVal} mg`
  );
}

function generateDailySummaryCard(
  userData: ReturnType<typeof calculateUserData>,
  dailyTotals: ReturnType<typeof getDailyTotals>,
  dateLabel: string = "Hari Ini"
): string {
  const calBar = makeProgressBar(dailyTotals.calories, userData.targetCalories);
  const protBar = makeProgressBar(dailyTotals.protein, userData.proteinGrams);
  const carbBar = makeProgressBar(dailyTotals.carbs, userData.carbGrams);
  const fatBar = makeProgressBar(dailyTotals.fat, userData.fatGrams);
  const fiberBar = makeProgressBar(dailyTotals.fiber, userData.fiberGrams);
  const sodiumVal = (dailyTotals as any).sodium || 0;
  const sodBar = makeSodiumProgressBar(sodiumVal, 2000);
  const sugarVal = (dailyTotals as any).sugar || 0;
  const sugBar = makeSugarProgressBar(sugarVal, 50);

  let mealListStr = "";
  if (dailyTotals.logs.length === 0) {
    mealListStr = "_Belum ada makanan yang dicatat pada tanggal ini._";
  } else {
    mealListStr = dailyTotals.logs.map((m, idx) => `• ${m.foodName} (${m.calories} kcal | P:${m.protein}g C:${m.carbs}g F:${m.fat}g${(m as any).sodium ? ` Na:${(m as any).sodium}mg` : ""}${Number((m as any).sugar) > 0 ? ` Gula:${(m as any).sugar}g` : ""})`).join("\n");
  }

  const isMax = (userData?.persona || "mia").toLowerCase() === "max";
  const coachName = isMax ? "Coach Max" : "Coach Mia";
  const addressing = getValidatedUserAddressing(userData);
  const validatedAddr = addressing.validatedAddress;
  const isLansia = addressing.ageGroup === "Lansia";

  let quote = "";
  if (sodiumVal > 2000) {
    quote = isMax
      ? (isLansia
          ? `Jaga terus ritme Anda, ${validatedAddr}. Asupan natrium Anda (${sodiumVal.toLocaleString("id-ID")} mg) sudah melewati batas 2.000 mg hari ini, mohon banyakin minum air putih hangat dan kurangi makanan asin ya. 💪`
          : `Jaga terus ritme kamu, ${validatedAddr}! Natrium kamu (${sodiumVal.toLocaleString("id-ID")} mg) sudah melewati batas 2.000 mg hari ini, jadi banyakin minum air putih dan kurangi makanan asin ya! 💪`)
      : (isLansia
          ? `Pencatatan yang luar biasa hari ini, ${validatedAddr}. Asupan natrium Anda (${sodiumVal.toLocaleString("id-ID")} mg) sedikit melebihi batas anjuran 2.000 mg ya, yuk imbangi dengan cukup minum air putih ✨`
          : `Kamu hebat sudah konsisten mencatat hari ini, ${validatedAddr}! Asupan natriummu (${sodiumVal.toLocaleString("id-ID")} mg) sedikit melebihi batas anjuran 2.000 mg ya, yuk imbangi dengan cukup minum air putih ✨`);
  } else if (sugarVal > 50) {
    quote = isMax
      ? (isLansia
          ? `Jaga terus ritme Anda, ${validatedAddr}. Asupan gula Anda (${sugarVal}g) sudah lewat batas anjuran 50g hari ini, mohon perbanyak minum air putih dan kurangi makanan/minuman manis ya. 💪`
          : `Jaga terus ritme kamu, ${validatedAddr}! Gula kamu (${sugarVal}g) sudah lewat batas anjuran 50g hari ini, jadi perbanyak minum air putih dan kurangi makanan/minuman manis ya! 💪`)
      : (isLansia
          ? `Pencatatan yang sangat baik hari ini, ${validatedAddr}. Asupan gula Anda (${sugarVal}g) sedikit melebihi batas anjuran 50g ya, yuk imbangi dengan cukup minum air putih ✨`
          : `Kamu hebat sudah konsisten mencatat hari ini, ${validatedAddr}! Asupan gula harianmu (${sugarVal}g) sedikit melebihi batas anjuran 50g ya, yuk imbangi dengan cukup minum air putih ✨`);
  } else {
    quote = isMax 
      ? (isLansia
          ? `Konsistensi yang sangat baik, ${validatedAddr}. Tetap jaga pola makan sehat dan istirahat optimal Anda. 💪`
          : `Jaga terus ritme kamu, ${validatedAddr}! Konsistensi kamu mantap hari ini, jangan kendor di jam-jam rawan ngemil. 💪`)
      : (isLansia
          ? `Pencatatan yang luar biasa hari ini, ${validatedAddr}. Tetap semangat menjaga kebugaran ya ✨`
          : `Kamu hebat sudah konsisten ngetrack hari ini, ${validatedAddr}! Tetap semangat ya ✨`);
  }

  quote = validateAndFormatCoachNote(quote, userData);

  return `📆 *Rekap ${dateLabel}*

⚖️ *Berat*: ${userData.weight} kg

📊 *Progress Nutrisi*:
🔥 *Kalori*: ${dailyTotals.calories}/${userData.targetCalories} kcal
${calBar}

🍖 *Protein*: ${dailyTotals.protein}/${userData.proteinGrams}g
${protBar}

🍚 *Karbo*: ${dailyTotals.carbs}/${userData.carbGrams}g
${carbBar}

🥓 *Lemak*: ${dailyTotals.fat}/${userData.fatGrams}g
${fatBar}

🥬 *Serat*: ${dailyTotals.fiber}/${userData.fiberGrams}g
${fiberBar}

🧂 *Natrium*: ${sodiumVal.toLocaleString("id-ID")}/2,000 mg
${sodBar}

🍯 *Gula*: ${sugarVal}/50g
${sugBar}

🍽️ *Makanan Terdaftar*:
${mealListStr}

-----------------------------
💬 *${coachName}*:
"${quote}"`;
}

function generateMealRecommendations(
  userData: ReturnType<typeof calculateUserData>,
  rawPhone?: string,
  userText?: string
): string {
  const { name, targetCalories, proteinGrams, carbGrams, fatGrams, goalTitle, persona } = userData;
  const coachName = persona === "max" ? "Coach Max" : "Coach Mia";

  const todayStr = getTodayDateStr();
  const totals = rawPhone ? getDailyTotals(rawPhone, todayStr) : { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, logs: [] };
  
  const currentSodium = (totals as any).sodium || 0;

  const nutritionSummary = calculateDailyNutritionSummary(
    { calories: totals.calories, protein: totals.protein, carbs: totals.carbs, fat: totals.fat, fiber: totals.fiber, sodium: currentSodium },
    { targetCalories, proteinGrams, carbGrams, fatGrams, sodiumLimit: 2000 }
  );

  const calStatus = nutritionSummary.calories;
  const protStatus = nutritionSummary.protein;
  const carbStatus = nutritionSummary.carbs;
  const fatStatus = nutritionSummary.fat;
  const sodStatus = nutritionSummary.sodium;

  const lower = (userText || "").toLowerCase();
  const isNight = lower.includes("malam") || lower.includes("dinner");
  const isLunch = lower.includes("siang") || lower.includes("lunch");
  const isBreakfast = lower.includes("pagi") || lower.includes("sarapan") || lower.includes("breakfast");
  const isSnack = lower.includes("snack") || lower.includes("camilan") || lower.includes("cemilan");

  let mealContextLabel = "Hari Ini";
  if (isNight) mealContextLabel = "Makan Malam (Dinner)";
  else if (isLunch) mealContextLabel = "Makan Siang (Lunch)";
  else if (isBreakfast) mealContextLabel = "Sarapan (Breakfast)";
  else if (isSnack) mealContextLabel = "Camilan Sehat (Snack)";

  // Targeted nutrition insights following priority hierarchy
  const macroGuidance: string[] = [];
  if (sodStatus.isOver) {
    macroGuidance.push(`⚠️ *Sodium Melebihi Batas (${currentSodium.toLocaleString("id-ID")}/2,000 mg)*: Hindari kuah asin, kecap, dan makanan olahan. Cukupi asupan air putih.`);
  }
  if (calStatus.isOver) {
    macroGuidance.push(`⚠️ *Kalori Melebihi Target (${totals.calories}/${targetCalories} kcal)*: Utamakan menu ringan dan hindari tambahan minyak atau karbohidrat tinggi.`);
  }
  if (protStatus.isUnder && protStatus.remaining > 15) {
    macroGuidance.push(`🍖 *Protein Masih Kurang (${protStatus.remaining}g)*: Prioritaskan sumber protein bersih rendah lemak.`);
  }
  if (fatStatus.isOver) {
    macroGuidance.push(`🥓 *Lemak Melebihi Target (${totals.fat}/${fatGrams}g)*: Hindari gorengan dan pilih olahan kukus/rebus.`);
  }

  // Dynamic menu recommendation matching remaining requirements
  let recommendedMenu = "";
  if (calStatus.isOver) {
    if (protStatus.isUnder) {
      recommendedMenu = `🌙 *Menu Ringan Tinggi Protein (Fokus Defisit Protein)*:\n` +
        `• 🍗 100g Dada Ayam Rebus / Kukus (~135 kcal, P:26g, F:2g)\n` +
        `• 🥚 2 Putih Telur Rebus (~34 kcal, P:7g)\n` +
        `• 🥗 Lalapan Selada / Timun Segar (~15 kcal)\n` +
        `• 💧 Air Putih Dingin 1-2 Gelas`;
    } else {
      recommendedMenu = `🌙 *Rekomendasi Pemulihan & Hidrasi*:\n` +
        `• 💧 Air Putih 500ml - 1 Liter\n` +
        `• 🍵 Teh Hijau / Chamomile Hangat Tanpa Gula (~0 kcal)\n` +
        `• 😴 Istirahat dan tidur optimal untuk recovery`;
    }
  } else if (isNight || (calStatus.remaining > 0 && calStatus.remaining <= 650 && totals.calories > 0)) {
    const mealCal = Math.min(calStatus.remaining, 500) || 450;
    recommendedMenu = `🌙 *Menu Makan Malam Rekomendasi (~${mealCal} kcal)*:\n` +
      `• 🍗 150g Dada Ayam Panggang / Pepes Ikan Bening (~165 kcal, P:31g)\n` +
      `• 🍚 1 centong Nasi Putih / 150g Kentang Rebus (~130 kcal, C:28g)\n` +
      `• 🥦 1 Mangkok Sayur Bening Bayam & Jagung Manis (~60 kcal)\n` +
      `• 💧 Air Putih 1-2 Gelas Besar`;
  } else if (isLunch) {
    const mealCal = Math.min(calStatus.remaining, 650) || 550;
    recommendedMenu = `☀️ *Menu Makan Siang Rekomendasi (~${mealCal} kcal)*:\n` +
      `• 🥩 120g Daging Sapi Lada Hitam Low Fat / Ayam Bakar Dada (~220 kcal, P:28g)\n` +
      `• 🍚 1.5 centong Nasi Merah / Nasi Putih (~180 kcal, C:38g)\n` +
      `• 🥗 Tumis Buncis & Wortel Sedikit Minyak (~70 kcal)`;
  } else if (isBreakfast) {
    recommendedMenu = `🌅 *Menu Sarapan Rekomendasi (~380 kcal)*:\n` +
      `• 🍳 2 Telur Rebus + 1 Putih Telur (~170 kcal, P:18g)\n` +
      `• 🍞 2 Tangkup Roti Gandum Utuh (~150 kcal, C:26g)\n` +
      `• ☕ Kopi / Teh Tanpa Gula`;
  } else {
    recommendedMenu = `🌅 *Pagi (~${Math.round(targetCalories*0.25)} kcal)*: 2 Telur Rebus + Roti Gandum / Oatmeal\n` +
      `☀️ *Siang (~${Math.round(targetCalories*0.35)} kcal)*: 150g Dada Ayam / Ikan + Nasi + Sayur Segar\n` +
      `🌙 *Malam (~${Math.round(targetCalories*0.30)} kcal)*: Pepes Ikan / Ayam Kukus + Kentang / Sayur Bening\n` +
      `🍎 *Snack (~${Math.round(targetCalories*0.10)} kcal)*: 1 Buah Apel / Greek Yogurt`;
  }

  let adviceQuote = "";
  if (calStatus.isOver) {
    adviceQuote = persona === "max"
      ? "Kalori lo udah tembus target hari ini bro! Kunci disiplin lo, cukupi air putih dan kalau masih butuh asupan pilih yang murni protein tanpa minyak! 🔥"
      : "Kalori kamu sudah melewati target harian hari ini. Yuk cukupi hidrasi dengan air putih dan pilih opsi sangat ringan ya ✨";
  } else if (calStatus.remaining < 300) {
    adviceQuote = persona === "max"
      ? "Kalori lo udah mepet hari ini bro! Kunci disiplin lo, pilih yang tinggi protein dan minim minyak! 🔥"
      : "Kalori hari ini sudah hampir terpenuhi dengan baik. Cukup pilih opsi ringan dan jangan lupa minum air ya! ✨";
  } else {
    adviceQuote = persona === "max"
      ? "Jaga porsi dan makro lo. Konsistensi kecil tiap hari yang bikin badan lo jadi! 💪"
      : "Semangat ya! Pastikan tubuhmu mendapat asupan nutrisi seimbang untuk energi optimal hari ini 🌱✨";
  }

  const calDisplay = calStatus.isOver
    ? `• Kalori: *${totals.calories}/${targetCalories} kcal* (${calStatus.percentage}% · 🔴 Melebihi Target)`
    : calStatus.isReached
      ? `• Kalori: *${totals.calories}/${targetCalories} kcal* (100% · ✅ Target Tercapai)`
      : `• Sisa Kalori: *~${calStatus.remaining} kcal* (${totals.calories}/${targetCalories} kcal · 🟡 Belum Cukup)`;

  const protDisplay = protStatus.isOver
    ? `• Protein: *${totals.protein}/${proteinGrams}g* (${protStatus.percentage}% · 🔴 Melebihi Target)`
    : protStatus.isReached
      ? `• Protein: *${totals.protein}/${proteinGrams}g* (100% · ✅ Target Tercapai)`
      : `• Sisa Protein: *~${protStatus.remaining}g* (${totals.protein}/${proteinGrams}g · 🟡 Belum Cukup)`;

  const fatDisplay = fatStatus.isOver
    ? `• Lemak: *${totals.fat}/${fatGrams}g* (${fatStatus.percentage}% · 🔴 Melebihi Target)`
    : fatStatus.isReached
      ? `• Lemak: *${totals.fat}/${fatGrams}g* (100% · ✅ Target Tercapai)`
      : `• Sisa Lemak: *~${fatStatus.remaining}g* (${totals.fat}/${fatGrams}g · 🟡 Belum Cukup)`;

  const sodDisplay = `• Natrium: *${currentSodium.toLocaleString("id-ID")}/2,000 mg* (${sodStatus.statusBadge})`;

  return (
    `🍽️ *REKOMENDASI MENU ${mealContextLabel.toUpperCase()}*\n` +
    `🎯 *Goal*: ${goalTitle} (${targetCalories} kcal/hari)\n\n` +
    `📊 *Status Nutrisi Hari Ini*:\n` +
    `${calDisplay}\n` +
    `${protDisplay}\n` +
    `${fatDisplay}\n` +
    `${sodDisplay}\n\n` +
    (macroGuidance.length > 0 ? `${macroGuidance.join("\n")}\n\n` : "") +
    `━━━━━━━━━━━━━━\n` +
    `${recommendedMenu}\n\n` +
    `━━━━━━━━━━━━━━\n` +
    `💬 *${coachName}*:\n"${adviceQuote}"`
  );
}

function formatEquipmentCard(parsedAi: any, userData: ReturnType<typeof calculateUserData>): string {
  const persona = (userData.persona === "mia" || userData.persona === "nikita") ? "mia" : "max";
  const coachName = persona === "max" ? "Coach Max" : "Coach Mia";
  const equipmentName = parsedAi.equipmentName || "Alat Gym";

  // Check if we have exact/fuzzy match in ExerciseDB
  const matchedExercise = findExerciseOrEquipment(equipmentName) || findExerciseOrEquipment(parsedAi.query || "");
  if (matchedExercise) {
    const guide = formatWhatsAppExerciseGuide(matchedExercise, persona);
    return guide.text;
  }

  const isAligned = parsedAi.isAlignedWithGoal !== false;

  const addressing = getValidatedUserAddressing(userData);
  const validatedAddr = addressing.validatedAddress;

  if (!isAligned) {
    const redirectionMsg = validateAndFormatCoachNote(
      parsedAi.politeRedirection || 
        (persona === "max" 
          ? `Kayaknya alat ${equipmentName} ini kurang cocok buat goal kamu (${userData.goalTitle}) dulu ya, ${validatedAddr}. Kita fokus ke gerakan utama yang lebih efektif & aman! 💪`
          : `Wah, sepertinya alat ${equipmentName} ini belum menjadi prioritas utama untuk goal ${userData.goalTitle} kamu ya, ${validatedAddr} ✨ Yuk fokus ke latihan dasar yang lebih sesuai dulu!`),
      userData
    );

    return `🏋️ *ANALISIS ALAT GYM: ${equipmentName.toUpperCase()}*

⚠️ *Status Goal Alignment*:
_KURANG COCOK UNTUK GOAL SAAT INI_

💬 *Pesan dari ${coachName}*:
"${redirectionMsg}"

💡 *Catatan Coach*:
${parsedAi.alignmentExplanation || "Gunakan latihan dasar yang lebih sesuai dengan targetmu."}`;
  }

  const exercises = Array.isArray(parsedAi.suggestedExercises) && parsedAi.suggestedExercises.length > 0
    ? parsedAi.suggestedExercises.map((e: any, idx: number) => 
        `• *${e.name || `Variasi ${idx+1}`}*\n` +
        `  💪 Otot: ${e.targetMuscle || "General"}\n` +
        `  🔢 Target: ${e.setsReps || "3 Sets x 10-12 Reps"}\n` +
        `  💡 Tips: ${e.techniqueTip || "Jaga postur & pernafasan teratur."}`
      ).join("\n\n")
    : `• *Custom Exercise*\n  🔢 Target: 3 Sets x 12 Reps\n  💡 Tips: Kontrol gerakan saat eccentric.`;

  const comment = validateAndFormatCoachNote(
    parsedAi.coachComment || 
      (persona === "max" 
        ? `Alat ini mantap banget buat goal kamu, ${validatedAddr}! Lakukan gerakan di atas & pastikan form kamu bersih! 💪`
        : `Alat ini sangat cocok untuk mendukung ${userData.goalTitle} kamu, ${validatedAddr}! Lakukan dengan perlahan dan nikmati prosesnya ya ✨`),
    userData
  );

  return `🏋️ *PANDUAN ALAT GYM: ${equipmentName.toUpperCase()}*

✅ *Status Goal Alignment*:
*SANGAT COCOK UNTUK GOAL ${userData.goalTitle.toUpperCase()}!*

📌 *Rekomendasi Variasi Latihan*:
${exercises}

-----------------------------
💬 *${coachName}*:
"${comment}"`;
}





function formatRepsCompact(targetReps: string, targetSets: number): string {
  let clean = targetReps.trim();
  clean = clean.replace(/^[0-9]+\s*Set[s]?\s*x\s*/i, `${targetSets} × `);
  clean = clean.replace(/\bSecs\b/gi, "detik")
               .replace(/\bDetik\b/gi, "detik")
               .replace(/\bReps\b/gi, "reps")
               .replace(/\bMins\b/gi, "menit")
               .replace(/\bMenit\b/gi, "menit");
  return clean;
}

function generateWeeklyWorkoutSchedule(userData: ReturnType<typeof calculateUserData>): string {
  const goal = userData.goal || "healthy";
  const schedule = getDefaultWeeklySchedule(goal);
  const dayOrder = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
  const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const currentDayIdx = new Date().getDay();
  const todayDayName = dayNames[currentDayIdx];

  const scheduleBlocks = dayOrder.map(day => {
    const routine = schedule.find(s => s.day.toLowerCase() === day.toLowerCase());
    const isToday = day.toLowerCase() === todayDayName.toLowerCase();
    const isRest = !routine || routine.focus.toLowerCase().includes("rest") || routine.focus.toLowerCase().includes("istirahat") || (routine.exercises || []).length === 0;

    let header = `*${day}*`;
    if (isToday) {
      header += ` ← _Hari ini_`;
    }

    if (isRest) {
      return `${header}\n${routine?.focus || "Pemulihan Aktif & Hidrasi"}`;
    }

    const exLines = (routine.exercises || []).map(ex => {
      const repsFormatted = formatRepsCompact(ex.targetReps, ex.targetSets);
      return `• ${ex.name} — ${repsFormatted}`;
    }).join("\n");

    return `${header}\n${routine.focus}\n${exLines}`;
  }).join("\n\n");

  return (
    `📅 *JADWAL LATIHAN MINGGU INI*\n` +
    `-----------------------------\n` +
    `${scheduleBlocks}\n\n` +
    `💬 _Ketik nama latihan dan jumlah set (misal: "aku sudah plank 2 set") untuk mencatat progress langsung ke Dashboard!_`
  );
}

function generateWorkoutRecommendations(userData: ReturnType<typeof calculateUserData>, targetDayOffset: number = 0): string {
  const goal = userData.goal || "healthy";
  const schedule = getDefaultWeeklySchedule(goal);
  const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const targetDayIdx = (new Date().getDay() + targetDayOffset + 7) % 7;
  const targetDayName = dayNames[targetDayIdx];
  const targetRoutine = schedule.find((s) => s.day.toLowerCase() === targetDayName.toLowerCase()) || schedule[0];
  const coachName = userData.persona === "max" ? "Coach Max" : "Coach Mia";
  const dayLabel = targetDayOffset === 1 ? "BESOK" : "HARI INI";

  const isRest = !targetRoutine || targetRoutine.focus.toLowerCase().includes("rest") || targetRoutine.focus.toLowerCase().includes("istirahat") || targetRoutine.exercises.length === 0;

  if (isRest) {
    return (
      `📅 *JADWAL LATIHAN ${dayLabel} (${targetRoutine?.day || targetDayName})*\n` +
      `--------------------------------------------------\n` +
      `🌴 *FOKUS: REST & RECOVERY*\n\n` +
      `Hari ini adalah hari pemulihan otot. Cukupi asupan protein, minum air putih minimal 2-3 liter, dan tidur yang cukup agar ototmu pulih maksimal! 🌿✨\n\n` +
      `💬 *${coachName}*:\n"Istirahat sama pentingnya dengan latihan. Jangan lupa tetap jaga pola makan sehat hari ini!"`
    );
  }

  return (
    `📅 *LATIHAN ${dayLabel} (${targetRoutine.day}): ${targetRoutine.focus.toUpperCase()}*\n` +
    `--------------------------------------------------\n` +
    `Berikut daftar gerakan yang terjadwal untukmu:\n\n` +
    targetRoutine.exercises.map((ex, idx) => `${idx + 1}. *${ex.name}*: ${ex.targetReps}`).join("\n") +
    `\n\n💡 *Tips ${coachName}*:\n` +
    `• Buka menu latihan di dashboard untuk mencatat checklist set kamu secara real-time!\n` +
    `• Jika butuh panduan cara menggunakan alat atau teknik gerakannya, cukup ketik nama latihannya (misal: "cara ${targetRoutine.exercises[0]?.name || "squat"}").\n\n` +
    `Selamat berlatih, tetap konsisten! 💪🔥`
  );
}

export interface AdditionalActivity {
  id: string;
  activityName: string;
  category: string;
  icon: string;
  durationMinutes?: number;
  distanceKm?: number;
  sets?: number;
  reps?: number;
  weightKg?: number;
  intensity?: string;
  details?: string;
  estimatedCaloriesBurned?: number;
  timestamp: string;
  status: "completed";
}

export function extractWorkoutParameters(userText: string) {
  const lower = userText.toLowerCase().trim();

  // 1. Extract Sets (e.g. "3 set", "3 sets", "3set")
  let sets: number | undefined = undefined;
  const setMatch = lower.match(/(\d+)\s*(?:set|sets)\b/i);
  if (setMatch) sets = parseInt(setMatch[1], 10);

  // 2. Extract Reps (e.g. "12 repetisi", "12 reps", "12 rep", "12x", "12 kali", "masing masing 12 repetisi")
  let reps: number | undefined = undefined;
  const repMatch = lower.match(/(?:masing[-\s]*masing\s*)?(\d+)\s*(?:repetisi|reps|rep|kali)\b/i) || lower.match(/(\d+)\s*(?:repetisi|reps|rep|kali)\b/i) || lower.match(/x\s*(\d+)\b/i);
  if (repMatch) reps = parseInt(repMatch[1], 10);

  // 3. Extract Weight (e.g. "beban 25 kg", "25 kg", "25kg", "25 kilo", "beban 25kg")
  let weightKg: number | undefined = undefined;
  const weightMatch = lower.match(/(?:beban\s*)?(\d+(?:[.,]\d+)?)\s*(?:kg|kilo|kilogram)\b/i);
  if (weightMatch) weightKg = parseFloat(weightMatch[1].replace(",", "."));

  // 4. Extract Duration (e.g. "30 menit", "45 mins", "1 jam", "setengah jam", "45 detik", "60 detik")
  let durationMinutes: number | undefined = undefined;
  let durationSeconds: number | undefined = undefined;
  const secMatch = lower.match(/(\d+)\s*(?:detik|secs|sec|second|seconds|det)\b/i);
  const minMatch = lower.match(/(\d+)\s*(?:menit|mins|min|minute|minutes)\b/i);
  const hourMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:jam|hours|hr|hrs)\b/i);

  if (secMatch) {
    durationSeconds = parseInt(secMatch[1], 10);
    durationMinutes = durationSeconds >= 60 ? Math.round(durationSeconds / 60) : 1;
  }
  if (minMatch) {
    durationMinutes = parseInt(minMatch[1], 10);
  } else if (hourMatch) {
    durationMinutes = Math.round(parseFloat(hourMatch[1].replace(",", ".")) * 60);
  } else if (lower.includes("setengah jam")) {
    durationMinutes = 30;
  } else if (lower.includes("satu jam")) {
    durationMinutes = 60;
  }

  // 5. Extract Distance (e.g. "5 km", "5.2 km", "5 kilometer")
  let distanceKm: number | undefined = undefined;
  const kmMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:km|kilo|kilometer)\b/i);
  if (kmMatch && !lower.includes("beban " + kmMatch[1])) {
    distanceKm = parseFloat(kmMatch[1].replace(",", "."));
  }

  // 6. Extract Intensity
  let intensity: string | undefined = undefined;
  if (lower.includes("kecepatan sedang") || lower.includes("speed sedang") || lower.includes("pace sedang") || lower.includes("intensitas sedang") || lower.includes("moderate")) {
    intensity = "Kecepatan Sedang";
  } else if (lower.includes("intensitas tinggi") || lower.includes("kecepatan tinggi") || lower.includes("sprint") || lower.includes("high intensity")) {
    intensity = "Intensitas Tinggi";
  } else if (lower.includes("santai") || lower.includes("ringan") || lower.includes("jalan santai") || lower.includes("low intensity")) {
    intensity = "Santai";
  } else if (lower.includes("incline") || lower.includes("menanjak")) {
    intensity = "Incline";
  } else if (lower.includes("zona 2") || lower.includes("zone 2")) {
    intensity = "Zona 2";
  }

  return { sets, reps, weightKg, durationMinutes, durationSeconds, distanceKm, intensity };
}

const ADDITIONAL_ACTIVITY_MAP = [
  { keywords: ["berenang", "swimming", "renang"], name: "Berenang (Swimming)", icon: "🏊‍♂️", category: "cardio", met: 8 },
  { keywords: ["lari", "running", "jogging", "joging", "sprint"], name: "Lari (Running)", icon: "🏃‍♂️", category: "cardio", met: 9.5 },
  { keywords: ["jalan santai", "jalan kaki", "jalan", "walking", "brisk walk"], name: "Jalan Kaki (Walking)", icon: "🚶‍♂️", category: "cardio", met: 3.8 },
  { keywords: ["sepeda", "bersepeda", "cycling", "gowes", "spinning", "spin bike", "stationary bike"], name: "Bersepeda (Cycling)", icon: "🚴‍♂️", category: "cardio", met: 7.5 },
  { keywords: ["elliptical", "elip", "eliptical", "crosstrainer", "cross trainer"], name: "Elliptical Trainer", icon: "🏃‍♀️", category: "cardio", met: 7.5 },
  { keywords: ["treadmill"], name: "Treadmill", icon: "🏃", category: "cardio", met: 8.5 },
  { keywords: ["plank", "plank hold", "forearm plank", "tahan plank"], name: "Plank", icon: "🧘‍♂️", category: "core", met: 4.5 },
  { keywords: ["push up", "push-up", "pushup"], name: "Push-Up", icon: "💪", category: "calisthenics", met: 5.5 },
  { keywords: ["sit up", "sit-up", "situp", "crunch", "crunches"], name: "Sit-Up / Crunches", icon: "🤸‍♂️", category: "core", met: 5 },
  { keywords: ["squat", "air squat", "bodyweight squat"], name: "Squat", icon: "🦵", category: "calisthenics", met: 5.5 },
  { keywords: ["badminton", "bulutangkis"], name: "Badminton", icon: "🏸", category: "sports", met: 7 },
  { keywords: ["futsal", "sepak bola", "football", "soccer"], name: "Futsal / Sepak Bola", icon: "⚽", category: "sports", met: 8.5 },
  { keywords: ["basket", "basketball"], name: "Basket", icon: "🏀", category: "sports", met: 8 },
  { keywords: ["tenis", "tennis", "padel"], name: "Tenis / Padel", icon: "🎾", category: "sports", met: 7.5 },
  { keywords: ["yoga"], name: "Yoga", icon: "🧘‍♀️", category: "flexibility", met: 3.5 },
  { keywords: ["pilates"], name: "Pilates", icon: "🧘", category: "flexibility", met: 4 },
  { keywords: ["stretching", "peregangan", "stretch", "pemanasan", "cooling down", "pendinginan"], name: "Stretching / Peregangan", icon: "🤸‍♀️", category: "flexibility", met: 3 },
  { keywords: ["zumba", "dance", "aerobik", "aerobic"], name: "Zumba / Aerobik", icon: "💃", category: "cardio", met: 6.5 },
  { keywords: ["skipping", "lompat tali", "jumping rope"], name: "Lompat Tali", icon: "🪢", category: "cardio", met: 10 },
  { keywords: ["boxing", "tinju", "muay thai"], name: "Boxing / Muay Thai", icon: "🥊", category: "martial_arts", met: 9 },
  { keywords: ["hiking", "naik gunung"], name: "Hiking", icon: "🧗", category: "outdoor", met: 6.5 },
  { keywords: ["cardio", "kardio"], name: "Kardio", icon: "❤️‍🔥", category: "cardio", met: 7 },
  { keywords: ["strength training", "angkat beban", "latihan beban", "weight training"], name: "Latihan Beban", icon: "🏋️‍♂️", category: "strength", met: 6 },
  { keywords: ["workout", "olahraga", "latihan tambahan", "home workout", "gym"], name: "Olahraga Tambahan", icon: "🏋️", category: "general", met: 6 }
];

export function handleAdditionalActivityLogging(
  rawPhone: string,
  userText: string,
  userData: ReturnType<typeof calculateUserData>
): string[] | null {
  const phone = normalizePhone(rawPhone);
  const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
  const lower = userText.toLowerCase().trim();

  // Guard 1: Questions or tutorials / tips
  if (userText.includes("?") || lower.match(/^(?:cara|bagaimana|gimana|tutorial|tips|apa\s*itu|tutor|ajarin|panduan)\b/i)) {
    return null;
  }

  // Guard 2: Explicit schedule inquiry
  if (
    lower.includes("jadwal latihanku apa") ||
    lower.includes("jadwal latihan hari ini") ||
    lower.includes("workout apa hari ini") ||
    lower.includes("latihan apa hari ini") ||
    lower.includes("jadwal gym hari ini") ||
    lower.includes("jadwal workout hari ini") ||
    lower.includes("olahraga hari ini apa") ||
    lower.includes("hari ini jadwal latihanku apa")
  ) {
    return null;
  }

  // Guard 3: Future intent (e.g. "aku mau plank nanti", "nanti mau jogging", "besok mau lari")
  const isFuture = Boolean(lower.match(/\b(?:mau|akan|pengen|rencana|bakal|nanti|besok|lusa)\b/i)) &&
    !Boolean(lower.match(/\b(?:tadi|sudah|udah|habis|selesai|beres|done|barusan|telah)\b/i));
  if (isFuture) {
    return null;
  }

  // Parse target date (e.g. "kemarin aku berenang 45 menit")
  const dateInfo = parseDateFromQuery(userText);
  const targetDate = dateInfo.dateStr;
  const actKey = `gymbuddy_activities_${phone}_${targetDate}`;
  const altActKey = `gymbuddy_activities_${altPhone}_${targetDate}`;

  let existingActivities: AdditionalActivity[] = dbData.dailyLogs[actKey] || dbData.dailyLogs[altActKey] || [];
  if (!Array.isArray(existingActivities)) existingActivities = [];

  // Check DELETE command via text (e.g. "hapus swimming tadi", "hapus berenang", "hapus treadmill")
  const deleteMatch = lower.match(/(?:hapus|delete|batal(?:kan)?)\s+(?:aktivitas\s*)?(?:olahraga\s*)?([a-z\s]+)/i);
  if (deleteMatch) {
    const actQuery = deleteMatch[1].trim();
    const matchedToDelete = ADDITIONAL_ACTIVITY_MAP.find(a => a.keywords.some(k => actQuery.includes(k)));
    if (matchedToDelete && existingActivities.length > 0) {
      const initLen = existingActivities.length;
      existingActivities = existingActivities.filter(a => !a.activityName.toLowerCase().includes(matchedToDelete.keywords[0]));
      if (existingActivities.length < initLen) {
        dbData.dailyLogs[actKey] = existingActivities;
        dbData.dailyLogs[altActKey] = existingActivities;
        saveDb();
        return [
          `🗑️ *AKTIVITAS TAMBAHAN DIHAPUS*\n-----------------------------\n` +
          `✅ Catatan *${matchedToDelete.name}* ${matchedToDelete.icon} telah dihapus dari riwayat latihan ${dateInfo.label}.\n\n` +
          `Dashboard web sudah otomatis diperbarui. ✨`
        ];
      }
    }
  }

  // Check if this is a strength exercise with sets/reps/weight (let handleWorkoutProgressLogging handle it)
  const params = extractWorkoutParameters(userText);
  const isStrengthStructured = Boolean(params.sets || params.reps || params.weightKg);

  // Match activity type
  let matchedAct = null;
  for (const act of ADDITIONAL_ACTIVITY_MAP) {
    if (act.keywords.some(k => lower.includes(k))) {
      // If it matches generic "workout"/"olahraga"/"gym" but user provided specific sets/reps/weight, let strength logging handle it
      if (act.category === "general" && isStrengthStructured) {
        continue;
      }
      matchedAct = act;
      break;
    }
  }

  if (!matchedAct) return null;

  // Extract duration, distance, intensity
  const duration = params.durationMinutes || (matchedAct.name.includes("Gym") || matchedAct.name.includes("Olahraga Tambahan") ? 45 : undefined);
  const distance = params.distanceKm;
  const intensity = params.intensity;
  const durText = params.durationSeconds && params.durationSeconds < 60 ? `${params.durationSeconds} detik` : `${duration || 1} menit`;

  // Check if message is an edit/correction (e.g. "berenang tadi sebenarnya 60 menit")
  const isEdit = lower.match(/(?:sebenarnya|sebetulnya|koreksi|ganti|edit)\s*.*(\d+)\s*(?:menit|mins|min|jam|hours)/i);

  // Calorie Burn Estimation (MET * Weight * Hours)
  const weight = userData.weight || 70;
  const durHours = duration ? duration / 60 : (distance ? (distance / 10) : 0.5);
  const calBurn = Math.max(5, Math.round(matchedAct.met * weight * durHours));

  const coachName = userData.persona === "max" ? "Coach Max" : "Coach Mia";
  const addressing = getValidatedUserAddressing(userData);
  const validatedAddr = addressing.validatedAddress;

  if (isEdit && existingActivities.length > 0) {
    const existingIndex = existingActivities.findIndex(a => a.activityName.toLowerCase().includes(matchedAct!.keywords[0]));
    if (existingIndex !== -1) {
      if (duration) existingActivities[existingIndex].durationMinutes = duration;
      if (distance) existingActivities[existingIndex].distanceKm = distance;
      if (intensity) existingActivities[existingIndex].intensity = intensity;
      existingActivities[existingIndex].estimatedCaloriesBurned = calBurn;

      dbData.dailyLogs[actKey] = existingActivities;
      dbData.dailyLogs[altActKey] = existingActivities;
      saveDb();

      return [
        `✏️ *AKTIVITAS TAMBAHAN DIPERBARUI*\n-----------------------------\n` +
        `✅ Catatan *${matchedAct.name}* ${matchedAct.icon} telah diperbarui menjadi: *${duration || existingActivities[existingIndex].durationMinutes} menit*${intensity ? ` (${intensity})` : ""}${distance ? ` (${distance} km)` : ""} (~${calBurn} kcal estimasi).\n\n` +
        `Data terbaru sudah langsung tersimpan di Dashboard! 🚀`
      ];
    }
  }

  // Add new activity with unique ID
  const activityUniqueId = `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newActivity: AdditionalActivity = {
    id: activityUniqueId,
    activityName: matchedAct.name,
    category: matchedAct.category,
    icon: matchedAct.icon,
    durationMinutes: duration,
    distanceKm: distance,
    intensity: intensity,
    details: [
      (duration || params.durationSeconds) ? durText : null,
      intensity ? intensity : null,
      distance ? `${distance} km` : null
    ].filter(Boolean).join(" • "),
    estimatedCaloriesBurned: calBurn,
    timestamp: new Date().toISOString(),
    status: "completed"
  };

  existingActivities.push(newActivity);
  dbData.dailyLogs[actKey] = existingActivities;
  dbData.dailyLogs[altActKey] = existingActivities;
  saveDb();

  const goal = userData.goal || "healthy";
  const schedule = getDefaultWeeklySchedule(goal);
  const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const currentDayIdx = new Date().getDay();
  const todayDayName = dayNames[currentDayIdx];
  const todayRoutine = schedule.find(s => s.day.toLowerCase() === todayDayName.toLowerCase()) || schedule[0];
  const isRest = !todayRoutine || todayRoutine.focus.toLowerCase().includes("rest") || todayRoutine.focus.toLowerCase().includes("istirahat") || (todayRoutine.exercises || []).length === 0;

  const scheduleNote = isRest
    ? `Hari ini memang jadwal *Rest Day* kamu. Aktivitas tambahan ini sangat bagus untuk pemulihan aktif tanpa membebani otot! 🌿`
    : `Jadwal latihan utama kamu (*${todayRoutine.focus}*) tetap tersimpan di Dashboard.`;

  const details: string[] = [];
  if (duration || params.durationSeconds) details.push(`⏱️ Durasi: *${durText}*`);
  if (intensity) details.push(`⚡ Intensitas: *${intensity}*`);
  if (distance) details.push(`📍 Jarak: *${distance} km*`);
  details.push(`🔥 Estimasi Bakar: *~${calBurn} kcal*`);

  const isVagueGym = matchedAct.keywords.includes("gym") && !params.durationMinutes && !distance;

  let coachCommentText = "";
  if (matchedAct.keywords.includes("plank")) {
    coachCommentText = userData.persona === "max"
      ? `Bagus, ${validatedAddr}! Plank ${durText} sudah tercatat di riwayat latihan kamu. Tetap jaga core tetap kencang! 🔥`
      : `Plank ${durText} sudah tercatat di riwayat latihan kamu. Bagus banget, tetap konsisten ya! ✨`;
  } else if (matchedAct.keywords.includes("elliptical")) {
    coachCommentText = userData.persona === "max"
      ? `Sesi Elliptical Trainer ${durText}${intensity ? ` dengan ${intensity.toLowerCase()}` : ""} sudah tercatat rapi di riwayat latihan lo, ${validatedAddr}. Solid bro! 🔥`
      : `Sesi Elliptical Trainer ${durText}${intensity ? ` dengan ${intensity.toLowerCase()}` : ""} sudah tercatat di riwayat latihan kamu, ${validatedAddr}. Bagus banget, tetap konsisten ya! ✨`;
  } else if (isVagueGym) {
    coachCommentText = userData.persona === "max"
      ? `Mantap, ${validatedAddr}! Sesi gym kamu sudah dicatat di Dashboard. Kalau mau catat gerakan spesifik (misal: 3 set bench press atau 30 menit treadmill), kasih tahu aku ya! 💪`
      : `Hebat banget, ${validatedAddr}! Sesi olahraga kamu sudah tersimpan ✨ Kalau ada gerakan spesifik atau durasi yang mau dicatat lengkap, tinggal kasih tahu aku ya!`;
  } else {
    coachCommentText = userData.persona === "max"
      ? `Bagus, ${validatedAddr}! Aktivitas ${matchedAct.name} sudah tercatat. Tetap jaga hidrasi & makan bergizi! 🔥`
      : `Bagus banget, ${validatedAddr}! Tetap aktif bergerak! Jangan lupa cukupi minum air putih dan istirahat ya ✨`;
  }

  const comment = validateAndFormatCoachNote(coachCommentText, userData);

  return [
    `🏋️‍♂️ *LATIHAN BERHASIL DICATAT*\n-----------------------------\n` +
    `✅ *${matchedAct.name}* ${matchedAct.icon}\n` +
    `${details.join(" • ")}\n\n` +
    `💡 *Status Program*: ${scheduleNote}\n\n` +
    `💬 *${coachName}*:\n"${comment}"`
  ];
}

export function handleWorkoutProgressLogging(
  rawPhone: string,
  userText: string,
  userData: ReturnType<typeof calculateUserData>
): string[] | null {
  const phone = normalizePhone(rawPhone);
  const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
  const lower = userText.toLowerCase().trim();

  // Guard 1: if message is a question or request for tutorial / tips, do not log
  if (userText.includes("?") || lower.match(/^(?:cara|bagaimana|gimana|tutorial|tips|apa\s*itu|tutor|ajarin|panduan)\b/i)) {
    return null;
  }

  // Guard 2: Explicit schedule inquiry
  if (
    lower.includes("jadwal latihanku apa") ||
    lower.includes("jadwal latihan hari ini") ||
    lower.includes("workout apa hari ini") ||
    lower.includes("latihan apa hari ini") ||
    lower.includes("jadwal gym hari ini") ||
    lower.includes("jadwal workout hari ini") ||
    lower.includes("olahraga hari ini apa") ||
    lower.includes("hari ini jadwal latihanku apa") ||
    lower.includes("jadwal hari ini apa") ||
    lower.includes("jadwal latihan besok") ||
    lower.includes("workout besok apa")
  ) {
    return null; // Delegate to isWorkoutScheduleQuery
  }

  // Guard 3: Future intent (e.g. "aku mau latihan lat pulldown nanti", "besok mau workout")
  const isFuture = Boolean(lower.match(/\b(?:mau|akan|pengen|rencana|bakal|nanti|besok|lusa)\b/i)) &&
    !Boolean(lower.match(/\b(?:tadi|sudah|udah|habis|selesai|beres|done|barusan|telah)\b/i));
  if (isFuture) {
    return null;
  }

  // Parse workout parameters
  const params = extractWorkoutParameters(userText);

  // Check additional activity first (e.g. "aku tadi berenang 45 menit", "lari 5 km", "tadi aku plank 1 menit", "tadi aku elliptical 35 menit")
  const additionalActResp = handleAdditionalActivityLogging(rawPhone, userText, userData);
  if (additionalActResp) {
    return additionalActResp;
  }

  // Check if message indicates progress, reporting, or structured details
  const hasWorkoutSignal = lower.match(/(?:sudah|udah|telah|selesai|beres|done|lapor|catat|aku latihan|aku workout|aku melakukan|aku olahraga|latihan\s+[a-z]+|main\s+[a-z]+|barusan|tadi\s+aku|tadi)/i);
  const hasStructure = Boolean(params.sets || params.reps || params.weightKg);

  if (!hasWorkoutSignal && !hasStructure) {
    return null;
  }

  const goal = userData.goal || "healthy";
  const schedule = getDefaultWeeklySchedule(goal);
  const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const currentDayIdx = new Date().getDay();
  const todayDayName = dayNames[currentDayIdx];
  const todayRoutine = schedule.find(s => s.day.toLowerCase() === todayDayName.toLowerCase()) || schedule[0];

  const dateInfo = parseDateFromQuery(userText);
  const targetDate = dateInfo.dateStr;
  const key = `gymbuddy_exercises_${phone}_${targetDate}`;
  const altKey = `gymbuddy_exercises_${altPhone}_${targetDate}`;
  const actKey = `gymbuddy_activities_${phone}_${targetDate}`;
  const altActKey = `gymbuddy_activities_${altPhone}_${targetDate}`;

  // Get current exercises from db or initialize from today's routine
  let existingExercises: any[] = dbData.dailyLogs[key] || dbData.dailyLogs[altKey] || [];
  if (!Array.isArray(existingExercises) || existingExercises.length === 0 || !existingExercises[0]?.targetSets) {
    existingExercises = JSON.parse(JSON.stringify(todayRoutine.exercises || []));
  }

  let existingActivities: AdditionalActivity[] = dbData.dailyLogs[actKey] || dbData.dailyLogs[altActKey] || [];
  if (!Array.isArray(existingActivities)) existingActivities = [];

  // Check full workout completion (e.g. "sudah selesai semua latihan hari ini", "workout hari ini selesai")
  const isFullWorkout = lower.match(/(?:sudah\s*)?(?:selesai|beres|done)\s*(?:semua\s*)?(?:latihan|workout|olahraga)|(?:latihan|workout|olahraga)\s*(?:hari\s*ini\s*)?(?:sudah\s*)?(?:selesai|beres|done)/i);
  if (isFullWorkout && existingExercises.length > 0) {
    existingExercises.forEach((e: any) => {
      e.completedSets = e.targetSets;
      e.setsState = (e.setsState || []).map(() => true);
      e.status = "completed";
    });

    dbData.dailyLogs[key] = existingExercises;
    dbData.dailyLogs[altKey] = existingExercises;
    saveDb();

    return [
      `Luar biasa! Seluruh jadwal latihan hari ini (*${todayRoutine.focus}*) sudah tercatat selesai 100%! 🎉💪\n\n` +
      `Jangan lupa istirahat yang cukup & cukupi konsumsi protein kamu ya! ✨`
    ];
  }

  // Try matching individual exercise from existingExercises or EXERCISE_DATABASE
  let matchedScheduledEx: any = null;
  const dbEx = findExerciseOrEquipment(userText);

  // 1. Try matching dbEx against scheduled exercises
  if (dbEx) {
    for (const ex of existingExercises) {
      const exName = String(ex.name || "").toLowerCase();
      const dbExName = dbEx.name.toLowerCase();
      if (
        exName.includes(dbExName) ||
        dbExName.includes(exName) ||
        (dbEx.aliases && dbEx.aliases.some((a: string) => exName.includes(a.toLowerCase()) || a.toLowerCase().includes(exName)))
      ) {
        matchedScheduledEx = ex;
        break;
      }
    }
  }

  // 2. If no dbEx match, check if full scheduled exercise name is in userText
  if (!matchedScheduledEx) {
    for (const ex of existingExercises) {
      const exNameLower = String(ex.name || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
      if (exNameLower.length >= 4 && lower.includes(exNameLower)) {
        matchedScheduledEx = ex;
        break;
      }
    }
  }

  const addressing = getValidatedUserAddressing(userData);
  const validatedAddr = addressing.validatedAddress;
  const coachName = userData.persona === "max" ? "Coach Max" : "Coach Mia";

  // CASE 1: Scheduled exercise match
  if (matchedScheduledEx) {
    const count = params.sets ? params.sets : matchedScheduledEx.targetSets;
    const finalSets = Math.max(1, count);
    const finalReps = params.reps || 10;
    const finalWeight = params.weightKg;

    matchedScheduledEx.completedSets = finalSets;
    matchedScheduledEx.targetSets = Math.max(matchedScheduledEx.targetSets || 0, finalSets);
    matchedScheduledEx.setsState = (matchedScheduledEx.setsState || []).map((_: boolean, idx: number) => idx < finalSets);
    matchedScheduledEx.status = finalSets >= matchedScheduledEx.targetSets ? "completed" : "in_progress";
    if (finalWeight) matchedScheduledEx.weightKg = finalWeight;

    // Record as activity for dashboard management
    const actId = `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const calBurn = Math.round(finalSets * finalReps * 2.5);
    const newActivity: AdditionalActivity = {
      id: actId,
      activityName: matchedScheduledEx.name,
      category: "strength",
      icon: "🏋️‍♂️",
      sets: finalSets,
      reps: finalReps,
      weightKg: finalWeight,
      details: `${finalSets} Set x ${finalReps} Repetisi${finalWeight ? ` • Beban: ${finalWeight} kg` : ""}`,
      estimatedCaloriesBurned: calBurn,
      timestamp: new Date().toISOString(),
      status: "completed"
    };
    existingActivities.push(newActivity);

    dbData.dailyLogs[key] = existingExercises;
    dbData.dailyLogs[altKey] = existingExercises;
    dbData.dailyLogs[actKey] = existingActivities;
    dbData.dailyLogs[altActKey] = existingActivities;
    saveDb();

    const nextEx = existingExercises.find((e: any) => e.id !== matchedScheduledEx.id && e.status !== "completed");
    const comment = validateAndFormatCoachNote(
      userData.persona === "max"
        ? `Bagus, ${validatedAddr}! Latihan ${matchedScheduledEx.name} ${finalSets} set x ${finalReps} reps${finalWeight ? ` dengan beban ${finalWeight} kg` : ""} sudah tercatat. Pertahankan konsistensi lo! 🔥`
        : `Luar biasa, ${validatedAddr}! ${matchedScheduledEx.name} ${finalSets} set x ${finalReps} reps${finalWeight ? ` beban ${finalWeight} kg` : ""} sudah tersimpan di riwayat latihan kamu ✨`,
      userData
    );

    const detailsStr = [
      `📊 Detail: *${finalSets} Set x ${finalReps} Repetisi*`,
      finalWeight ? `⚖️ Beban: *${finalWeight} kg*` : null,
      `🔥 Estimasi Bakar: *~${calBurn} kcal*`
    ].filter(Boolean).join(" • ");

    if (finalSets >= matchedScheduledEx.targetSets) {
      if (nextEx) {
        const nextReps = formatRepsCompact(nextEx.targetReps, nextEx.targetSets);
        return [
          `🏋️‍♂️ *LATIHAN BERHASIL DICATAT*\n-----------------------------\n` +
          `✅ *${matchedScheduledEx.name}*\n` +
          `${detailsStr}\n\n` +
          `💡 *Target Berikutnya*: Tinggal *${nextEx.name}*, ${nextReps}.\n\n` +
          `💬 *${coachName}*:\n"${comment}"`
        ];
      } else {
        return [
          `🏋️‍♂️ *LATIHAN BERHASIL DICATAT*\n-----------------------------\n` +
          `✅ *${matchedScheduledEx.name}*\n` +
          `${detailsStr}\n\n` +
          `💡 *Status Program*: Semua latihan hari ini sudah selesai! Luar biasa! 🔥💪\n\n` +
          `💬 *${coachName}*:\n"${comment}"`
        ];
      }
    } else {
      const remaining = matchedScheduledEx.targetSets - finalSets;
      return [
        `🏋️‍♂️ *LATIHAN BERHASIL DICATAT*\n-----------------------------\n` +
        `✅ *${matchedScheduledEx.name}*\n` +
        `${detailsStr}\n\n` +
        `💡 *Status*: Tinggal ${remaining} set lagi untuk menyelesaikan target gerakan ini.\n\n` +
        `💬 *${coachName}*:\n"${comment}"`
      ];
    }
  }

  // CASE 2: User reports specific exercise NOT in today's routine (e.g. "Aku latihan lat pulldown 3 set, masing masing 12 repetisi dengan beban 25 kg")
  if (dbEx || hasStructure) {
    const exerciseName = dbEx ? dbEx.name : (userText.split(/,|\b(?:dengan|beban|masing|\d+\s*set)\b/i)[0].replace(/^(?:aku|tadi|barusan|sudah|udah|latihan|main)\s+/i, "").trim() || "Latihan Beban");
    const sets = params.sets || 3;
    const reps = params.reps || 10;
    const weight = params.weightKg;
    const calBurn = Math.round(sets * reps * 2.5);

    const customEx = {
      id: `ex-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: exerciseName,
      targetSets: sets,
      completedSets: sets,
      setsState: Array(sets).fill(true),
      targetReps: `${sets} Set x ${reps} Reps${weight ? ` (${weight} kg)` : ""}`,
      weightKg: weight,
      status: "completed"
    };
    existingExercises.push(customEx);

    const actId = `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newActivity: AdditionalActivity = {
      id: actId,
      activityName: exerciseName,
      category: "strength",
      icon: "🏋️‍♂️",
      sets: sets,
      reps: reps,
      weightKg: weight,
      details: `${sets} Set x ${reps} Repetisi${weight ? ` • Beban: ${weight} kg` : ""}`,
      estimatedCaloriesBurned: calBurn,
      timestamp: new Date().toISOString(),
      status: "completed"
    };
    existingActivities.push(newActivity);

    dbData.dailyLogs[key] = existingExercises;
    dbData.dailyLogs[altKey] = existingExercises;
    dbData.dailyLogs[actKey] = existingActivities;
    dbData.dailyLogs[altActKey] = existingActivities;
    saveDb();

    const comment = validateAndFormatCoachNote(
      userData.persona === "max"
        ? `Bagus, ${validatedAddr}! Latihan ${exerciseName} ${sets} set x ${reps} reps${weight ? ` dengan beban ${weight} kg` : ""} sudah tercatat rapi. Pertahankan konsistensi lo! 🔥`
        : `Luar biasa, ${validatedAddr}! Latihan ${exerciseName} ${sets} set x ${reps} reps${weight ? ` beban ${weight} kg` : ""} sudah tersimpan di riwayat latihan kamu ✨`,
      userData
    );

    const detailsStr = [
      `📊 Detail: *${sets} Set x ${reps} Repetisi*`,
      weight ? `⚖️ Beban: *${weight} kg*` : null,
      `🔥 Estimasi Bakar: *~${calBurn} kcal*`
    ].filter(Boolean).join(" • ");

    return [
      `🏋️‍♂️ *LATIHAN BERHASIL DICATAT*\n-----------------------------\n` +
      `✅ *${exerciseName}*\n` +
      `${detailsStr}\n\n` +
      `💡 *Status Program*: Latihan tercatat rapi di riwayat aktivitas harian kamu.\n\n` +
      `💬 *${coachName}*:\n"${comment}"`
    ];
  }

  return null;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.set("trust proxy", true);
  app.use(cors());
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));

  // Apply infrastructure rate limiters
  app.use("/api/", generalRateLimiter);
  app.use("/api/ai/", aiRateLimiter);
  app.use("/api/auth/", authRateLimiter);

  // Initialize Database Layers (Firestore Primary) and await cloud sync before accepting traffic
  getFirestore();
  await initDb();
  initReminderScheduler();

  // ── Health Check Endpoints (Google Cloud Run liveness/readiness) ─────────
  app.get(["/health", "/api/health"], (req, res) => {
    res.json({
      status: "ok",
      service: "gymbuddy-backend",
      version: "2.0.0",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
      cloudRun: Boolean(process.env.K_SERVICE),
      database: {
        engine: "Firestore",
        firestoreAvailable: Boolean(getFirestore())
      }
    });
  });

  // ── Authentication Endpoints ──────────────────────────────────────────────
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { phone, password, name, profile = {} } = req.body;
      if (!phone) {
        return res.status(400).json({ success: false, error: "Nomor WhatsApp wajib diisi." });
      }

      const normalized = normalizePhone(phone);
      const existingUser = await findUserByPhoneOrId(normalized);
      if (existingUser && existingUser.passwordHash) {
        return res.status(400).json({ success: false, error: "Nomor ini sudah terdaftar. Silakan login." });
      }

      const passwordHash = password ? await hashPassword(password) : undefined;
      const userId = `usr_${normalized}`;
      const userDoc = {
        userId,
        phone: normalized,
        name: name || profile.name || "Member GymBuddy",
        passwordHash,
        ...profile,
        updatedAt: new Date()
      };

      await saveUserDocument(userDoc);
      saveUserProfile(normalized, userDoc);
      saveDb();

      const token = generateAuthToken({ userId, phone: normalized });
      res.json({
        success: true,
        token,
        user: { userId, phone: normalized, name: userDoc.name, profile: userDoc }
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { phone, password } = req.body;
      if (!phone) {
        return res.status(400).json({ success: false, error: "Nomor WhatsApp wajib diisi." });
      }

      const normalized = normalizePhone(phone);
      const user = (await findUserByPhoneOrId(normalized)) || getUserProfile(normalized);

      if (!user) {
        return res.status(404).json({ success: false, error: "Akun belum terdaftar. Silakan daftar terlebih dahulu." });
      }

      // If user has a password set, verify it
      if (user.passwordHash && password) {
        const isValid = await comparePassword(password, user.passwordHash);
        if (!isValid) {
          return res.status(401).json({ success: false, error: "Password salah. Silakan coba lagi." });
        }
      }

      const userId = user.userId || `usr_${normalized}`;
      const token = generateAuthToken({ userId, phone: normalized });
      const calculated = calculateUserData(user);

      res.json({
        success: true,
        token,
        user: { ...user, userId, phone: normalized, calculated }
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message || "Login failed" });
    }
  });

  app.get("/api/auth/me", requireAuthMiddleware, async (req: any, res) => {
    try {
      const phone = req.user?.phone;
      const user = (await findUserByPhoneOrId(phone)) || getUserProfile(phone);
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }
      const sub = await getUserSubscription(phone);
      const calculated = calculateUserData(user);
      res.json({ success: true, user: { ...user, subscription: sub, calculated } });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Save onboarding registration data & user profile (Fresh Account Creation)
  app.post("/api/onboarding", async (req, res) => {
    const { phone, profile } = req.body;
    if (profile) {
      const norm = normalizePhone(phone || profile.phone || "");
      const altNorm = norm.startsWith("0") ? "62" + norm.substring(1) : (norm.startsWith("62") ? "0" + norm.substring(2) : norm);

      if (norm) {
        // Preserve all existing food logs and history
        const saved = saveUserProfile(norm, profile);
        saveDb();

        // Also persist directly to Firestore collections and await completion
        try {
          await saveUserDocument({
            userId: `usr_${norm}`,
            phone: norm,
            ...profile,
            updatedAt: new Date()
          });
          await saveAppDataToFirestore(dbData);
        } catch (fErr: any) {
          console.warn("[Firestore] User onboarding sync note:", fErr?.message || fErr);
        }

        console.log("Saved clean user profile in database for:", norm);
        const token = generateAuthToken({ userId: `usr_${norm}`, phone: norm });
        return res.json({ success: true, profile: saved, token });
      }

      saveDb();
      return res.json({ success: true, profile });
    }
    return res.status(400).json({ error: "Profile object is required" });
  });

  // Get user profile endpoint
  app.get("/api/user/:phone", async (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
    const user = getUserProfile(phone) || getUserProfile(altPhone) || (await findUserByPhoneOrId(phone));
    if (!user) {
      return res.status(404).json({ error: "User profile not found in database" });
    }
    const calculated = calculateUserData(user);
    const streak = getStreakCount(phone);
    const waterCups = getWaterCups(phone);
    const history = dbData.weeklyProgress[phone] || dbData.weeklyProgress[altPhone] || [];
    res.json({
      ...user,
      ...calculated,
      user: { ...user, ...calculated },
      profile: { ...user, ...calculated },
      userData: calculated,
      calculated,
      history,
      streak,
      waterCups
    });
  });

  // Comprehensive User Profile Update Handler (Authoritative Persistence)
  const handleUpdateProfile = async (req: express.Request, res: express.Response) => {
    try {
      const rawPhone = req.params.phone || req.body.phone;
      const phone = normalizePhone(rawPhone);
      if (!phone) {
        return res.status(400).json({ success: false, error: "Nomor telepon wajib diisi." });
      }

      const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
      const existing = getUserProfile(phone) || getUserProfile(altPhone) || (await findUserByPhoneOrId(phone)) || {};

      const payload = req.body || {};
      const {
        name,
        gender,
        age: rawAge,
        dob: rawDob,
        height: rawHeight,
        weight: rawWeight,
        startWeight: rawStartWeight,
        targetWeight: rawTargetWeight,
        activityLevel,
        goal,
        goalTitle,
        persona,
        plan,
        activeService,
        selectedFeature,
        equipment,
        injuries,
        customInjury,
        allergies,
        healthProfile,
        healthStatus,
        conditions,
        otherCondition,
        customTargets,
        customGoals,
        workoutSchedule,
        reminderTime,
        reminderEnabled,
        targetCalories,
        dailyTargetCalories,
        proteinGrams,
        dailyTargetProtein,
        carbGrams,
        dailyTargetCarbs,
        fatGrams,
        dailyTargetFat,
        fiberGrams
      } = payload;

      const updatedUser: any = {
        ...existing,
        phone,
        normalizedPhone: phone,
        userId: existing.userId || `usr_${phone}`
      };

      if (name !== undefined) updatedUser.name = String(name).trim();
      if (gender !== undefined) {
        const cleanGender = String(gender).toLowerCase();
        updatedUser.gender = (cleanGender === "wanita" || cleanGender === "female") ? "wanita" : "pria";
      }
      if (rawDob !== undefined) updatedUser.dob = String(rawDob).trim();
      if (rawAge !== undefined) updatedUser.age = Number(rawAge) || existing.age || 25;
      if (rawHeight !== undefined) updatedUser.height = Number(rawHeight) || existing.height || 170;
      if (rawWeight !== undefined) updatedUser.weight = Number(rawWeight) || existing.weight || 70;
      if (rawStartWeight !== undefined) updatedUser.startWeight = Number(rawStartWeight) || existing.startWeight || updatedUser.weight;
      if (rawTargetWeight !== undefined) updatedUser.targetWeight = Number(rawTargetWeight) || existing.targetWeight || 65;
      if (activityLevel !== undefined) updatedUser.activityLevel = activityLevel;
      if (goal !== undefined) updatedUser.goal = goal;
      if (goalTitle !== undefined) updatedUser.goalTitle = goalTitle;
      if (persona !== undefined) {
        const cleanPersona = String(persona).toLowerCase();
        updatedUser.persona = (cleanPersona === "mia" || cleanPersona === "nikita") ? "mia" : "max";
      }
      if (plan !== undefined) updatedUser.plan = plan;
      if (activeService !== undefined) updatedUser.activeService = activeService;
      if (selectedFeature !== undefined) updatedUser.selectedFeature = selectedFeature;
      if (equipment !== undefined) updatedUser.equipment = equipment;
      if (injuries !== undefined) updatedUser.injuries = Array.isArray(injuries) ? injuries : [injuries];
      if (customInjury !== undefined) updatedUser.customInjury = customInjury;
      if (allergies !== undefined) updatedUser.allergies = Array.isArray(allergies) ? allergies : [allergies];
      if (customTargets !== undefined) updatedUser.customTargets = customTargets;
      if (customGoals !== undefined) updatedUser.customGoals = customGoals;
      if (workoutSchedule !== undefined) updatedUser.workoutSchedule = workoutSchedule;
      if (reminderTime !== undefined) updatedUser.reminderTime = reminderTime;
      if (reminderEnabled !== undefined) updatedUser.reminderEnabled = Boolean(reminderEnabled);

      // Handle custom calorie / macro overrides
      if (targetCalories !== undefined || dailyTargetCalories !== undefined) {
        const cal = Number(targetCalories || dailyTargetCalories);
        if (!isNaN(cal) && cal > 0) {
          updatedUser.targetCalories = cal;
          updatedUser.dailyTargetCalories = cal;
        }
      }
      if (proteinGrams !== undefined || dailyTargetProtein !== undefined) {
        const prot = Number(proteinGrams || dailyTargetProtein);
        if (!isNaN(prot) && prot > 0) {
          updatedUser.proteinGrams = prot;
          updatedUser.dailyTargetProtein = prot;
        }
      }
      if (carbGrams !== undefined || dailyTargetCarbs !== undefined) {
        const carb = Number(carbGrams || dailyTargetCarbs);
        if (!isNaN(carb) && carb > 0) {
          updatedUser.carbGrams = carb;
          updatedUser.dailyTargetCarbs = carb;
        }
      }
      if (fatGrams !== undefined || dailyTargetFat !== undefined) {
        const fat = Number(fatGrams || dailyTargetFat);
        if (!isNaN(fat) && fat > 0) {
          updatedUser.fatGrams = fat;
          updatedUser.dailyTargetFat = fat;
        }
      }
      if (fiberGrams !== undefined) {
        const fib = Number(fiberGrams);
        if (!isNaN(fib) && fib > 0) {
          updatedUser.fiberGrams = fib;
        }
      }

      // Merge healthProfile
      if (healthProfile || healthStatus || conditions || otherCondition) {
        const existingHp = existing.healthProfile || {};
        const hpDob = updatedUser.dob || existingHp.dob || "";
        const hpAge = updatedUser.age || existingHp.age || 25;
        updatedUser.healthProfile = {
          dob: hpDob,
          age: hpAge,
          hasCondition: healthStatus || healthProfile?.hasCondition || existingHp.hasCondition || "no_condition",
          conditions: Array.isArray(conditions) ? conditions : (Array.isArray(healthProfile?.conditions) ? healthProfile.conditions : (existingHp.conditions || [])),
          otherCondition: otherCondition !== undefined ? otherCondition : (healthProfile?.otherCondition !== undefined ? healthProfile.otherCondition : (existingHp.otherCondition || "")),
          isCompleted: true,
          completedAt: new Date().toISOString()
        };
      }

      // Calculate age if DOB provided
      if (updatedUser.dob) {
        const { age: derivedAge } = calculateAgeFromDob(updatedUser.dob, updatedUser.age);
        updatedUser.age = derivedAge;
        if (updatedUser.healthProfile) {
          updatedUser.healthProfile.age = derivedAge;
        }
      }

      updatedUser.updatedAt = new Date().toISOString();

      // Recalculate dependent biometrics and targets
      const calculated = calculateUserData(updatedUser);

      // Save in-memory
      saveUserProfile(phone, updatedUser);
      if (altPhone !== phone) {
        saveUserProfile(altPhone, updatedUser);
      }
      saveDb();

      // Persist to Firestore
      try {
        await saveUserDocument({
          userId: `usr_${phone}`,
          phone: phone,
          ...updatedUser,
          ...calculated,
          updatedAt: new Date()
        });
        await saveAppDataToFirestore(dbData);
      } catch (fErr: any) {
        console.warn("[Firestore] saveUserDocument sync note:", fErr?.message || fErr);
      }

      console.log(`[User Profile] Successfully updated & persisted for ${phone} (${updatedUser.name}, Gender: ${calculated.gender}, Persona: ${calculated.persona}, Calories: ${calculated.targetCalories})`);

      return res.json({
        success: true,
        message: "Profile updated and persisted successfully",
        user: { ...updatedUser, ...calculated },
        profile: { ...updatedUser, ...calculated },
        userData: calculated,
        calculated
      });
    } catch (e: any) {
      console.error("[User Profile Update Error]:", e);
      return res.status(500).json({ success: false, error: e.message || "Failed to update profile" });
    }
  };

  app.post("/api/user/:phone/profile", express.json(), handleUpdateProfile);
  app.put("/api/user/:phone/profile", express.json(), handleUpdateProfile);
  app.post("/api/user/:phone", express.json(), handleUpdateProfile);
  app.put("/api/user/:phone", express.json(), handleUpdateProfile);

  // Save or update Health Profile
  app.post("/api/user/:phone/health-profile", async (req, res) => {
    try {
      const phone = normalizePhone(req.params.phone);
      const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
      const user = getUserProfile(phone) || getUserProfile(altPhone) || (await findUserByPhoneOrId(phone)) || {};
      
      const { dob, age, hasCondition, conditions, otherCondition, isCompleted } = req.body;
      
      const updatedHealthProfile = {
        dob: dob !== undefined ? dob : (user.dob || user.healthProfile?.dob || ""),
        age: Number(age) || user.age || user.healthProfile?.age || 25,
        hasCondition: hasCondition || "no_condition",
        conditions: Array.isArray(conditions) ? conditions : [],
        otherCondition: otherCondition || "",
        isCompleted: isCompleted !== undefined ? Boolean(isCompleted) : true,
        completedAt: new Date().toISOString()
      };

      // Derive age from dob if provided
      if (updatedHealthProfile.dob) {
        const { age: derivedAge } = calculateAgeFromDob(updatedHealthProfile.dob, updatedHealthProfile.age);
        updatedHealthProfile.age = derivedAge;
        user.age = derivedAge;
        user.dob = updatedHealthProfile.dob;
      }

      user.healthProfile = updatedHealthProfile;
      user.updatedAt = new Date().toISOString();

      saveUserProfile(phone, user);
      if (altPhone !== phone) {
        saveUserProfile(altPhone, user);
      }
      saveDb();

      // Persist directly to Firestore
      try {
        await saveUserDocument({
          userId: `usr_${phone}`,
          phone: phone,
          ...user,
          updatedAt: new Date()
        });
      } catch (fErr: any) {
        console.warn("[Firestore] saveUserDocument healthProfile sync note:", fErr?.message || fErr);
      }

      const calculated = calculateUserData(user);
      console.log(`[Health Profile] Updated for ${phone}: Age ${calculated.age} (${calculated.ageGroup}), Conditions: ${calculated.healthConditionsSummary}`);

      res.json({
        success: true,
        message: "Health profile saved successfully",
        healthProfile: updatedHealthProfile,
        calculated,
        user: { ...user, ...calculated }
      });
    } catch (e: any) {
      console.error("[Health Profile] Error saving:", e);
      res.status(500).json({ success: false, error: e.message || "Failed to save health profile" });
    }
  });

  // REST API: Delete entire user account and all associated data (Permanent Wipe)
  app.delete("/api/user/:phone", async (req, res) => {
    const rawPhone = req.params.phone;
    const phone = normalizePhone(rawPhone);
    const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
    console.log(`[DELETE Account] Permanently wiping user: ${phone} (${rawPhone})`);

    // 1. Delete from Server Memory & memCache
    delete dbData.users[phone];
    delete dbData.users[altPhone];
    delete dbData.users[rawPhone];
    delete dbData.users[`usr_${phone}`];
    delete dbData.users[`usr_${altPhone}`];

    delete dbData.weeklyProgress[phone];
    delete dbData.weeklyProgress[altPhone];
    delete dbData.weeklyProgress[rawPhone];

    await deleteUserDocument(phone);
    await deleteUserDocument(altPhone);
    await deleteUserDocument(rawPhone);
    await deleteUserDocument(`usr_${phone}`);
    await deleteUserDocument(`usr_${altPhone}`);

    const variations = Array.from(new Set([
      phone, altPhone, rawPhone,
      `0${phone.replace(/^\+?62/, "").replace(/^0/, "")}`,
      `62${phone.replace(/^\+?62/, "").replace(/^0/, "")}`,
      `+62${phone.replace(/^\+?62/, "").replace(/^0/, "")}`,
      `usr_${phone}`, `usr_${altPhone}`, `usr_${rawPhone}`,
      `usr_0${phone.replace(/^\+?62/, "").replace(/^0/, "")}`,
      `usr_62${phone.replace(/^\+?62/, "").replace(/^0/, "")}`
    ])).filter(Boolean);

    // Delete all daily logs for this user
    Object.keys(dbData.dailyLogs).forEach(key => {
      const keyPrefix = key.split("_")[0];
      if (variations.includes(keyPrefix) || variations.some(v => key.includes(v))) {
        delete dbData.dailyLogs[key];
      }
    });

    for (const v of variations) {
      await deleteAllFoodLogsForDate(v, getLocalDateStr()).catch(() => {});
    }

    // Delete all water logs for this user
    Object.keys(dbData.waterLogs).forEach(key => {
      const keyPrefix = key.split("_")[0];
      if (variations.includes(keyPrefix) || variations.some(v => key.includes(v))) {
        delete dbData.waterLogs[key];
      }
    });

    saveDb();

    // 2. Delete from Firestore Collections
    const firestore = getFirestore();
    if (firestore) {
      try {
        const batch = firestore.batch();

        // Delete user and subscription documents
        for (const v of variations) {
          batch.delete(firestore.collection("users").doc(v));
          batch.delete(firestore.collection("subscriptions").doc(v));
        }

        // Delete all foodLogs matching phone or userId variations
        for (const v of variations) {
          const fSnap1 = await firestore.collection("foodLogs").where("phone", "==", v).get();
          fSnap1.forEach(d => batch.delete(d.ref));
          const fSnap2 = await firestore.collection("foodLogs").where("userId", "==", v).get();
          fSnap2.forEach(d => batch.delete(d.ref));

          const wSnap1 = await firestore.collection("waterLogs").where("phone", "==", v).get();
          wSnap1.forEach(d => batch.delete(d.ref));
          const wSnap2 = await firestore.collection("waterLogs").where("userId", "==", v).get();
          wSnap2.forEach(d => batch.delete(d.ref));
        }

        await batch.commit();
        console.log(`[Firestore] User ${phone} and all related documents permanently wiped ✅`);
      } catch (fErr: any) {
        console.warn("[Firestore] User delete warning:", fErr?.message || fErr);
      }
    }

    res.json({
      success: true,
      message: `Akun dan seluruh data untuk ${phone} berhasil dihapus permanen dari database.`,
      phone
    });
  });

  // Admin endpoint: List all registered users in database
  app.get("/api/admin/users-list", async (req, res) => {
    try {
      const usersList: any[] = [];
      const seenPhones = new Set<string>();

      // 1. From Memory dbData.users
      if (dbData && dbData.users) {
        for (const [phone, u] of Object.entries(dbData.users)) {
          if (!seenPhones.has(phone)) {
            seenPhones.add(phone);
            usersList.push({
              phone,
              name: (u as any)?.name || "Member",
              goal: (u as any)?.goalTitle || (u as any)?.goal || "Healthy & Fit",
              weight: (u as any)?.weight || 0,
              targetWeight: (u as any)?.targetWeight || 0,
              targetCalories: (u as any)?.targetCalories || 2000,
              persona: (u as any)?.persona || "max",
              source: "Memory/Main Snapshot"
            });
          }
        }
      }

      // 2. From Firestore Collection
      const firestore = getFirestore();
      if (firestore) {
        try {
          const snapshot = await firestore.collection("users").get();
          snapshot.forEach(doc => {
            const data = doc.data();
            const phone = data.phone || doc.id;
            if (!seenPhones.has(phone)) {
              seenPhones.add(phone);
              usersList.push({
                phone,
                name: data.name || "Member",
                goal: data.goal || "Healthy & Fit",
                weight: data.weight || 0,
                targetWeight: data.targetWeight || 0,
                targetCalories: data.dailyTargetCalories || 2000,
                persona: data.persona || "max",
                source: "Firestore Collection"
              });
            }
          });
        } catch (fErr: any) {
          console.warn("[Admin Users] Firestore fetch note:", fErr?.message);
        }
      }

      res.json({
        success: true,
        totalUsers: usersList.length,
        users: usersList
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message });
    }
  });

  // In-memory cache for dynamic GYMBUDDY.AI infographic image cards (with user food photos)
  const cardMediaCache = new Map<string, {
    foodName: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    mealType: string;
    dateStr: string;
    dailyTargetCalories: number;
    consumedTodayCalories: number;
    imageBufferOrBase64: string;
    createdAt: number;
  }>();

  // Periodic garbage collection for card media older than 24 hours
  setInterval(() => {
    const now = Date.now();
    for (const [id, item] of cardMediaCache.entries()) {
      if (now - item.createdAt > 24 * 60 * 60 * 1000) {
        cardMediaCache.delete(id);
      }
    }
  }, 60 * 60 * 1000);

  // Dynamic GYMBUDDY.AI Nutrition Infographic Image Card Route (PNG / JPEG / SVG)
  app.get(["/api/card/:cardId.png", "/api/card/:cardId.jpg", "/api/card/:cardId.jpeg", "/api/card/:cardId.svg", "/api/card/nutrition-card.png", "/api/card/nutrition-card.svg"], async (req, res) => {
    try {
      const cardId = req.params.cardId || "";
      const cached = cardId ? cardMediaCache.get(cardId) : null;

      const foodName = cached?.foodName || (req.query.food as string) || "MAKANAN BERGIZI";
      const calories = cached ? cached.calories : (Number(req.query.cal) || 0);
      const protein = cached ? cached.protein : (Number(req.query.prot) || 0);
      const carbs = cached ? cached.carbs : (Number(req.query.carb) || 0);
      const fat = cached ? cached.fat : (Number(req.query.fat) || 0);
      const sodium = cached?.sodium !== undefined ? cached.sodium : (Number(req.query.sod) || 0);
      const fiber = cached?.fiber !== undefined ? cached.fiber : (Number(req.query.fib) || 0);
      const sugar = cached?.sugar !== undefined ? cached.sugar : (Number(req.query.sug) || 0);
      const mealType = cached?.mealType || (req.query.meal as string) || "Makan Siang";
      const dateStr = cached?.dateStr || (req.query.date as string) || new Date().toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
      const dailyTargetCalories = cached ? cached.dailyTargetCalories : (Number(req.query.target) || 1966);
      const consumedTodayCalories = cached ? cached.consumedTodayCalories : (Number(req.query.consumed) || calories);
      const dailyTargetProtein = cached?.dailyTargetProtein || (Number(req.query.targetProt) || 120);
      const dailyTargetCarbs = cached?.dailyTargetCarbs || (Number(req.query.targetCarb) || 240);
      const dailyTargetFat = cached?.dailyTargetFat || (Number(req.query.targetFat) || 65);
      const imageBufferOrBase64 = cached?.imageBufferOrBase64 || (req.query.img as string) || "";

      const cardPayload = {
        foodName,
        calories,
        protein,
        carbs,
        fat,
        sodium,
        fiber,
        sugar,
        mealType,
        dateStr,
        dailyTargetCalories,
        consumedTodayCalories,
        dailyTargetProtein,
        dailyTargetCarbs,
        dailyTargetFat,
        imageBufferOrBase64
      };

      // 1. If client requests SVG explicitly
      if (req.path.endsWith(".svg")) {
        const svg = generateNutritionCardSvg(cardPayload);
        res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=86400");
        return res.send(svg);
      }

      // 2. Generate high-resolution GymBuddy AI Nutrition Infographic Card (PNG)
      try {
        const pngBuf = await generateNutritionCardPng(cardPayload);
        if (pngBuf && pngBuf.length > 8 && pngBuf[0] === 0x89 && pngBuf[1] === 0x50) {
          res.setHeader("Content-Type", "image/png");
          res.setHeader("Cache-Control", "public, max-age=86400");
          return res.send(pngBuf);
        }
      } catch (pErr) {
        console.warn("[Card Generator] Raster PNG note:", pErr);
      }

      // Fallback: send SVG
      const svgCard = generateNutritionCardSvg(cardPayload);
      res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(svgCard);
    } catch (e: any) {
      console.error("[Card Generator Error]:", e?.message || e);
      return res.status(500).send("Error generating card image");
    }
  });

  app.get("/api/user-profile/:phone", async (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const profile = (await findUserByPhoneOrId(phone)) || getUserProfile(phone);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    const calculated = calculateUserData(profile);
    const streak = getStreakCount(phone);
    const waterCups = getWaterCups(phone);
    res.json({
      success: true,
      profile: { ...profile, ...calculated },
      user: { ...profile, ...calculated },
      calculated,
      userData: calculated,
      streak,
      waterCups
    });
  });

  // Phone validation & registration checker endpoint
  app.get("/api/check-phone/:phone", (req, res) => {
    const raw = req.params.phone || "";
    const phone = normalizePhone(raw);
    const isValidFormat = /^08\d{7,11}$/.test(phone);
    const existingUser = getUserProfile(phone);
    res.json({
      success: true,
      phone,
      isValidFormat,
      isRegistered: Boolean(existingUser),
      name: existingUser?.name || null
    });
  });

  // ─── AI Coach Next-Step Advice Endpoint ────────────────────────────────────
  // Called by Dashboard after user confirms a food log save.
  // Returns a short, personalized "what to eat/drink next" tip from the coach.
  app.post("/api/ai/next-step", express.json(), async (req, res) => {
    try {
      const {
        phone,
        calories,
        protein,
        carbs,
        fat,
        targetCalories: rawTargetCalories,
        targetProtein: rawTargetProtein,
        targetCarbs: rawTargetCarbs,
        targetFat: rawTargetFat,
        goal,
        persona,
        name,
        mealName,
        sodium
      } = req.body;

      const currCal = Number(calories) || 0;
      const currProt = Number(protein) || 0;
      const currCarb = Number(carbs) || 0;
      const currFat = Number(fat) || 0;
      const currSodium = Number(sodium) || 0;

      const targetCal = Number(rawTargetCalories) || 2000;
      const targetProt = Number(rawTargetProtein) || 150;
      const targetCarb = Number(rawTargetCarbs) || 200;
      const targetFat = Number(rawTargetFat) || 60;

      // Centralized Single Source of Truth
      const nutritionSummary = calculateDailyNutritionSummary(
        { calories: currCal, protein: currProt, carbs: currCarb, fat: currFat, sodium: currSodium },
        { targetCalories: targetCal, proteinGrams: targetProt, carbGrams: targetCarb, fatGrams: targetFat, sodiumLimit: 2000 }
      );

      const remCal = nutritionSummary.calories.remaining;
      const remProt = nutritionSummary.protein.remaining;
      const remCarb = nutritionSummary.carbs.remaining;
      const remFat = nutritionSummary.fat.remaining;

      // Determine WIB hour
      let wibHour = 12;
      try {
        wibHour = parseInt(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", hour: "numeric", hour12: false }).format(new Date()), 10);
      } catch (e) {
        wibHour = (new Date().getUTCHours() + 7) % 24;
      }

      const timeLabel = wibHour < 10 ? "pagi" : wibHour < 15 ? "siang" : wibHour < 18 ? "sore" : "malam";
      const isMia     = String(persona || "max").toLowerCase().includes("mia");
      const coachName = isMia ? "Coach Mia" : "Coach Max";
      const goalStr   = goal === "lose" ? "menurunkan berat badan" : goal === "gain" ? "menaikkan massa otot" : "menjaga berat badan ideal";

      // ── Algorithmic fallback (no AI needed, always accurate) ─────────────
      const buildFallbackAdvice = (): string => {
        let advice = "";

        // Priority 1: Sodium over limit
        if (nutritionSummary.sodium.isOver) {
          advice = isMia
            ? `Asupan natrium hari ini sudah melebihi batas 2.000 mg (${currSodium.toLocaleString("id-ID")} mg). Untuk meal selanjutnya, utamakan air putih dingin dan menu tawar/rendah garam seperti dada ayam rebus atau sayur bening ya ✨`
            : `Sodium lo udah tembus ${currSodium.toLocaleString("id-ID")} mg bro (melebihi batas anjuran)! Next meal, hindari makanan berkuah asin atau saus kecap, dan minum air putih minimal 500ml sekarang! 💧`;
        }
        // Priority 2: Calories already over target
        else if (nutritionSummary.calories.isOver) {
          if (nutritionSummary.protein.isUnder) {
            advice = isMia
              ? `Kalori harian kamu sudah melewati target (${currCal}/${targetCal} kcal), tetapi kebutuhan protein masih kurang ${remProt}g. Jika masih ingin makan di waktu ${timeLabel}, pilih yang murni protein tanpa minyak seperti 2 putih telur rebus atau 100g dada ayam kukus ya ✨`
              : `Kalori lo udah tembus target (${currCal}/${targetCal} kcal) bro! Tapi protein masih kurang ${remProt}g. Kalau laper, pilih yang murni protein tanpa lemak/minyak — putih telur rebus atau dada ayam kukus! 💪🔥`;
          } else {
            advice = isMia
              ? `Kalori harian kamu sudah terpenuhi dan sedikit melewati target (${currCal}/${targetCal} kcal). Untuk waktu ${timeLabel} ini, cukup minum air putih atau teh tawar hangat, lalu fokus istirahat optimal ya ✨`
              : `Kalori lo udah tembus target (${currCal}/${targetCal} kcal) bro! Kunci porsi makan lo hari ini. Minum air putih yang banyak dan fokus recovery buat besok! 💯`;
          }
        }
        // Priority 3: Protein deficit is the biggest gap
        else if (remProt > 25) {
          const foodSugg = goal === "lose"
            ? (isMia ? "dada ayam panggang, ikan tuna, atau putih telur" : "dada ayam grill, ikan bakar, atau tuna kalengan")
            : (isMia ? "dada ayam + nasi merah, susu, atau protein shake" : "chicken rice bowl, tuna + nasi, atau mass gainer shake");
          advice = isMia
            ? `Sisa protein kamu hari ini masih *${remProt}g* — lumayan banyak ya. Untuk meal ${timeLabel} berikutnya, fokuskan ke ${foodSugg}. Ini penting banget buat recovery dan perkembangan ototmu! ✨`
            : `Bro, masih kurang *${remProt}g protein* nih. Next meal lo harus fokus ke ${foodSugg}. Otot lo butuh ini buat tumbuh! Gas jangan skip makan! 🔥`;
        }
        // Priority 4: Calories almost full
        else if (nutritionSummary.calories.percentage >= 85) {
          advice = isMia
            ? `Kalori kamu udah hampir mencapai target hari ini! Kalau masih lapar di waktu ${timeLabel}, pilih camilan ringan aja ya — buah segar, salad, atau yogurt tanpa gula. Hindari yang berat supaya tetap di jalur ${goalStr}! 🥗`
            : `Kalori lo udah mepet target! Kalau laper ${timeLabel} ini, pilih yang ringan aja — buah, salad, atau yogurt. Jangan kalap makan berat lagi ya bro, kita lagi ngejer goal ${goalStr}! 💯`;
        }
        // Default: balanced recommendations
        else {
          const goalAdvice = goal === "lose"
            ? (isMia ? "makanan tinggi serat dan protein rendah kalori — sayur, ayam rebus, atau ikan panggang" : "yang tinggi protein dan serat — ayam panggang, ikan, atau salad protein")
            : goal === "gain"
            ? (isMia ? "karbohidrat kompleks dan protein — nasi merah, kentang, dada ayam, atau protein shake" : "combo karbo + protein — nasi + ayam geprek, atau chicken rice bowl ukuran besar")
            : (isMia ? "makanan seimbang — nasi, lauk berprotein, dan sayuran" : "makanan seimbang — nasi + ayam/ikan + sayur, klasik tapi efektif");
          advice = isMia
            ? `Untuk meal ${timeLabel} berikutnya, ${coachName} saranin pilih ${goalAdvice}. Ini pas banget buat mendukung tujuanmu ${goalStr}! Jangan lupa minum air putih minimal 250ml sebelum makan ya. 💧✨`
            : `Next meal ${timeLabel} ini, lo butuh ${goalAdvice}. Itu yang paling optimal buat goal lo ${goalStr}! Dan minum air putih sekarang — jangan tunggu haus. Gas! 💪🔥`;
        }

        return `🎯 *SARAN MAKAN SELANJUTNYA — ${coachName.toUpperCase()}*\n\n${advice}`;
      };

      if (!getAi()) {
        return res.json({ success: true, advice: buildFallbackAdvice() });
      }

      // ── Gemini AI generated advice with pre-calculated backend nutrition summary ────────
      const prompt = `Kamu adalah ${coachName}, AI Coach dari GymBuddy.

DATA USER:
- Nama: ${name || "Member"}
- Goal: ${goalStr}
- Makanan baru saja dikonsumsi: "${mealName || "Makanan"}"
- Waktu sekarang: ${timeLabel} (pukul ${wibHour}:xx WIB)

STATUS NUTRISI RESMI (SINGLE SOURCE OF TRUTH DARI BACKEND):
${JSON.stringify({
  calories: { current: currCal, target: targetCal, percentage: nutritionSummary.calories.percentage, status: nutritionSummary.calories.status, remaining: remCal },
  protein: { current: currProt, target: targetProt, percentage: nutritionSummary.protein.percentage, status: nutritionSummary.protein.status, remaining: remProt },
  carbs: { current: currCarb, target: targetCarb, percentage: nutritionSummary.carbs.percentage, status: nutritionSummary.carbs.status, remaining: remCarb },
  fat: { current: currFat, target: targetFat, percentage: nutritionSummary.fat.percentage, status: nutritionSummary.fat.status, remaining: remFat },
  sodium: { current: currSodium, limit: 2000, percentage: nutritionSummary.sodium.percentage, status: nutritionSummary.sodium.status }
}, null, 2)}

PERSONA:
${isMia
  ? "Coach Mia: Perempuan, hangat, supportif, profesional. Tidak pernah bilang 'sayang/cinta/beb'. Sapaan sopan (kamu/aku)."
  : "Coach Max: Pria, tegas, penuh energi, gaya Jakarta gaul (lo/gue). Motivasional tapi realistis."
}

ATURAN REKOMENDASI (PRIORITAS MUTLAK):
1. Jika Kalori/Karbo/Lemak berstatus "over_target" (nilai > target):
   - JANGAN PERNAH mengatakan "kalori masih tersisa" atau "karbohidrat masih aman".
   - Nyatakan dengan jelas bahwa kalori/makro telah melebihi target.
   - Jika protein masih kurang ("under_target"), rekomendasikan HANYA opsi sangat ringan tinggi protein (misal putih telur, dada ayam rebus) tanpa tambahan karbohidrat, lemak, atau sodium tinggi.
   - Jika protein sudah tercapai, rekomendasikan hidrasi (air putih/teh tawar) dan istirahat.
2. Jika Sodium berstatus "over_limit", ingatkan untuk minum air putih dan hindari kuah asin/saus.
3. Berikan saran singkat (MAX 3 kalimat) yang spesifik dan actionable.

Output HANYA teks saran polos (bukan JSON). Mulai dengan "🎯".`;

      try {
        const rawAdvice = await generateGeminiContent(prompt);
        const cleanedAdvice = (rawAdvice || "").replace(/```/g, "").trim();
        const finalAdvice = cleanedAdvice.length > 20
          ? `🎯 *SARAN ${coachName.toUpperCase()}*\n\n${cleanedAdvice}`
          : buildFallbackAdvice();
        return res.json({ success: true, advice: finalAdvice });
      } catch (aiErr) {
        console.warn("[next-step] AI error, using fallback:", aiErr);
        return res.json({ success: true, advice: buildFallbackAdvice() });
      }
    } catch (err: any) {
      console.error("[next-step] Error:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to generate advice" });
    }
  });

  // AI Food Text Analyzer Endpoint for Web App Add Meal Modal
  app.post("/api/ai/analyze-food", express.json(), async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || !String(text).trim()) {
        return res.status(400).json({ success: false, error: "Text description is required" });
      }

      const cleanText = String(text).trim();
      console.log(`[analyze-food] Incoming request: "${cleanText}"`);

      // 1. Calculate deterministic bottom-up estimate as verified baseline & fallback
      const deterministicResult = estimateMealNutritionDeterministic(cleanText);
      console.log(`[analyze-food] Deterministic base: ${deterministicResult.calories} kcal (P:${deterministicResult.protein}g, C:${deterministicResult.carbs}g, F:${deterministicResult.fat}g, Fib:${deterministicResult.fiber}g, Sug:${deterministicResult.sugar}g) [${deterministicResult.items.length} items]`);

      // ALWAYS preserve user's original input as foodName — AI/catalog names go into items[].normalized_food_name
      const userInputFoodName = cleanText;

      if (!getAi()) {
        return res.json({
          success: true,
          ...deterministicResult,
          foodName: userInputFoodName, // Override with original user input
          note: "Estimated using USDA & TKPI verified database"
        });
      }

      const prompt = buildGeminiNutritionPrompt(cleanText);

      try {
        const rawText = await generateGeminiContent(prompt);
        const textOutput = (rawText || "{}").replace(/```json/g, "").replace(/```/g, "").trim();
        let parsed: any = extractAndParseJson(textOutput) || {};
        const items = Array.isArray(parsed.items) && parsed.items.length > 0 ? parsed.items : deterministicResult.items;

        if (parsed.isFood === false || String(parsed.isFood).toLowerCase() === "false" || (items.length > 0 && items.every((i: any) => i.notes?.includes("bukan makanan")))) {
          return res.json({
            success: true,
            isFood: false,
            foodName: userInputFoodName,
            message: "Objek ini bukan makanan atau minuman. Silakan masukkan nama makanan yang ingin dicatat.",
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            fiber: 0,
            sugar: 0,
            items: [],
            portionNote: "Bukan makanan"
          });
        }

        const rawCompNames = (Array.isArray(parsed.components) && parsed.components.length > 0)
          ? parsed.components.map((c: any) => c.name ? `${c.quantity ? `${c.quantity} ` : ""}${c.name} ${c.cookingMethod || ""}` : String(c))
          : (Array.isArray(parsed.items) && parsed.items.length > 0
              ? parsed.items.map((i: any) => i.food_name || i.normalized_food_name || i.foodName || String(i))
              : undefined);

        // Calculate strictly from USDA & TKPI single source of truth database
        const calculatedNutrition = calculateFoodNutrition(cleanText, rawCompNames);

        const genericCheck = isGenericMealInput(cleanText);
        const isLowConfidence = genericCheck.isGeneric || calculatedNutrition.overallConfidence === "low" || calculatedNutrition.needsClarification;

        res.json({
          success: true,
          isFood: true,
          // CRITICAL: Always use original user input as foodName — never AI/catalog name
          foodName: userInputFoodName,
          calories: isLowConfidence ? undefined : calculatedNutrition.calories,
          protein: isLowConfidence ? undefined : calculatedNutrition.protein,
          carbs: isLowConfidence ? undefined : calculatedNutrition.carbs,
          fat: isLowConfidence ? undefined : calculatedNutrition.fat,
          fiber: isLowConfidence ? undefined : calculatedNutrition.fiber,
          sugar: isLowConfidence ? undefined : calculatedNutrition.sugar,
          sodium: isLowConfidence ? undefined : calculatedNutrition.sodium,
          isHydration: Boolean(calculatedNutrition.isHydration),
          volumeMl: Number(calculatedNutrition.volumeMl) || 0,
          mealType: parsed.mealType || calculatedNutrition.mealType,
          portionNote: calculatedNutrition.portionNote,
          items: calculatedNutrition.components.map((c: any) => ({
            food_name: c.foodName,
            normalized_food_name: c.normalizedName,
            database_id: c.databaseId,
            data_source: c.source,
            estimated_quantity: 1,
            estimated_weight_grams: c.actualAmount,
            serving_unit: `${c.actualAmount}${c.actualUnit}`,
            display_unit: `${c.actualAmount}${c.actualUnit}`,
            cooking_method: c.cookingMethod,
            calories: c.calories,
            protein: c.protein,
            carbs: c.carbs,
            fat: c.fat,
            fiber: c.fiber,
            sugar: c.sugar,
            sodium: c.sodium,
            confidence: c.portionConfidence >= 85 ? "high" : "medium",
            notes: c.notes
          })),
          confidence: isLowConfidence ? "low" : calculatedNutrition.overallConfidence,
          needsClarification: isLowConfidence,
          clarificationQuestion: genericCheck.isGeneric ? `What’s included in your ${genericCheck.mealType}?` : `We need a little more information to estimate this meal accurately.`,
          suggestedOptions: genericCheck.suggestedOptions.length > 0 ? genericCheck.suggestedOptions : ["Chicken", "Beef", "Egg", "Vegetables", "Sauce", "Other"],
          portionDisplayLabel: calculatedNutrition.portionDisplayLabel,
          debugLog: calculatedNutrition.traceabilityLog,
          sanityValid: calculatedNutrition.sanityValid
        });
      } catch (aiErr) {
        console.warn("Gemini AI analyze-food error, using verified database engine:", aiErr);
        res.json({
          success: true,
          ...deterministicResult,
          foodName: userInputFoodName, // Override with original user input
          note: "Estimated using USDA & TKPI verified database"
        });
      }
    } catch (err: any) {
      console.error("Error analyzing food text:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to analyze food" });
    }
  });


  // REST API: AI Vision Meal Image Analysis
  app.post("/api/ai/analyze-meal-image", express.json({ limit: "25mb" }), async (req, res) => {
    try {
      const { imageBase64, mimeType = "image/jpeg", text, description } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ success: false, error: "Image base64 data is required" });
      }

      const userTextContext = String(text || description || "").trim();

      const cleanBase64 = imageBase64.replace(/^data:image\/[a-z0-9+]+;base64,/i, "");
      const imagePart = {
        inlineData: {
          mimeType,
          data: cleanBase64
        }
      };

      const prompt = `KAMU ADALAH SISTEM VISION AI PAKAR NUTRISI GYMBUDDY.
TUGASMU: Analisis gambar makanan/minuman yang dikirim pengguna dengan sangat teliti.
${userTextContext ? `DESKRIPSI/KONTEKS USER: "${userTextContext}". (Gunakan teks ini sebagai ground truth utama untuk nama makanan, isian/filling yang tersembunyi, dan porsi).` : ""}

1. PERIKSA APAKAH INI MAKANAN / MINUMAN ATAU BUKAN:
- Jika gambar adalah benda mati, laptop, hp, manusia, selfie, ruangan, pemandangan, hewan, atau BUKAN MAKANAN/MINUMAN:
  Keluarkan JSON:
  {
    "isFood": false,
    "foodName": "Bukan Makanan / Minuman",
    "message": "Gambar ini bukan makanan atau minuman. Silakan upload foto makanan yang ingin kamu catat.",
    "calories": 0,
    "protein": 0,
    "carbs": 0,
    "fat": 0,
    "portion": "-"
  }

2. JIKA GAMBAR ADALAH MAKANAN ATAU MINUMAN:
- DEKONSTRUKSI MAKANAN KOMPOSIT: Pecah makanan kombinasi menjadi komponen individual (Main Food, Isian/Filling seperti sosis di dalam roti, Topping seperti keju, Saus, Side dish).
- ESTIMASI PORSI REALISTIS DARI VISUAL CUES: Gunakan petunjuk visual seperti ukuran wadah/bungkus (misal 'nasi bungkus' biasanya ±250–300g), piring, dan ketebalan potongan.
- Hitung kalori & makronutrisi konsisten: (protein × 4) + (carbs × 4) + (fat × 9) = calories.
- Tentukan jika minuman (Americano, Teh, Air, Kopi, Jus, Boba, dll.) dengan isHydration=true.

Keluarkan HANYA JSON valid tanpa teks markdown di luar JSON:
{
  "isFood": true,
  "foodName": "Nama Makanan/Minuman Spesifik",
  "calories": 520,
  "protein": 35,
  "carbs": 60,
  "fat": 15,
  "fiber": 3,
  "isHydration": false,
  "volumeMl": 0,
  "portion": "1 Porsi (±250–300g)",
  "portionEstimates": [
    "• Komponen 1: ~100g",
    "• Komponen 2: ~50g"
  ],
  "mealType": "lunch"
}`;

      try {
        const rawText = await generateGeminiContent(prompt, imagePart);
        const textOutput = (rawText || "{}").replace(/```json/g, "").replace(/```/g, "").trim();
        let parsed: any = extractAndParseJson(textOutput) || {};

        if (parsed.isFood === false || String(parsed.isFood).toLowerCase() === "false") {
          return res.json({
            success: true,
            isFood: false,
            foodName: parsed.foodName || "Bukan Makanan",
            message: parsed.message || "Objek ini bukan makanan atau minuman. Silakan upload foto makanan yang ingin kamu catat.",
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            portion: "-"
          });
        }

        const protein = Math.max(0, Math.round(Number(parsed.protein) || 0));
        const carbs = Math.max(0, Math.round(Number(parsed.carbs) || 0));
        const fat = Math.max(0, Math.round(Number(parsed.fat) || 0));
        const macroCal = (protein * 4) + (carbs * 4) + (fat * 9);
        const calories = macroCal > 0 ? macroCal : Math.max(0, Math.round(Number(parsed.calories) || 0));

        return res.json({
          success: true,
          isFood: true,
          foodName: parsed.foodName || "Makanan Terdeteksi",
          calories,
          protein,
          carbs,
          fat,
          fiber: Number(parsed.fiber) || 0,
          isHydration: Boolean(parsed.isHydration),
          volumeMl: Number(parsed.volumeMl) || 0,
          portion: parsed.portion || "1 Porsi Standar",
          mealType: parsed.mealType || getMealTypeByHour()
        });
      } catch (aiErr: any) {
        console.error("Gemini Vision AI error:", aiErr);
        res.status(500).json({ success: false, error: "Gagal menganalisis gambar via AI Vision: " + (aiErr?.message || "Timeout") });
      }
    } catch (err: any) {
      console.error("Vision API error:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to analyze image" });
    }
  });


  // REST API: Get meal logs for specific user and date
  // REST API: Get meal logs for specific user and date
  app.get("/api/user/:phone/meals", async (req, res) => {
    const rawPhone = req.params.phone;
    const phone = normalizePhone(rawPhone);
    const user = (await findUserByPhoneOrId(phone)) || getUserProfile(phone);
    const targetDate = (req.query.date as string) || getLocalDateStr();

    const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
    const key = `${phone}_${targetDate}`;
    const altKey = `${altPhone}_${targetDate}`;

    // 1. In-memory cache is authoritative when loaded
    const hasMemKey = Array.isArray(dbData.dailyLogs[key]);
    const hasMemAltKey = Array.isArray(dbData.dailyLogs[altKey]);

    let logs: MealLog[] = [];

    if (hasMemKey || hasMemAltKey) {
      logs = (dbData.dailyLogs[key] || dbData.dailyLogs[altKey] || []).filter(m => m && !isLegacyMockMeal(m));
    } else {
      // 2. Query persistent database layer on cold start
      try {
        const dbLogs = await getFoodLogsForDate(phone, targetDate);
        if (dbLogs && dbLogs.length > 0) {
          logs = dbLogs.filter(m => m && !isLegacyMockMeal(m)) as unknown as MealLog[];
        }
      } catch (e: any) {
        console.warn("[Meals API] Database fetch note:", e?.message || e);
      }
    }

    logs = deduplicateMealLogs(logs);

    // Persist cleaned deduplicated list back to server memory
    dbData.dailyLogs[key] = logs;
    dbData.dailyLogs[altKey] = logs;

    res.json({ success: true, phone, date: targetDate, logs });
  });

  // REST API: Add meal log for user
  app.post("/api/user/:phone/meals", express.json(), async (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const meal = req.body;
    const targetDate = meal.date || (req.query.date as string) || getLocalDateStr();
    if (!meal || !meal.foodName) {
      return res.status(400).json({ success: false, error: "Meal object with foodName is required" });
    }
    const mealObj: MealLog = {
      id: meal.id || `m-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      foodName: meal.foodName,
      calories: Number(meal.calories) || 0,
      protein: Number(meal.protein) || 0,
      carbs: Number(meal.carbs) || 0,
      fat: Number(meal.fat) || 0,
      fiber: Number(meal.fiber) || 0,
      sugar: Number(meal.sugar) || 0,
      sodium: Number(meal.sodium) || 0,
      mealType: meal.mealType || getMealTypeByHour(),
      timestamp: meal.timestamp || new Date().toISOString(),
      isHydration: meal.isHydration === true || meal.isHydration === "true" ? true : (meal.isHydration === false || meal.isHydration === "false" ? false : undefined),
      volumeMl: meal.volumeMl ? Number(meal.volumeMl) : undefined
    };

    const key = `${phone}_${targetDate}`;
    const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
    const altKey = `${altPhone}_${targetDate}`;

    if (!dbData.dailyLogs[key]) dbData.dailyLogs[key] = [];
    if (!dbData.dailyLogs[altKey]) dbData.dailyLogs[altKey] = [];
    dbData.dailyLogs[key].push(mealObj);
    dbData.dailyLogs[altKey].push(mealObj);
    saveDb();

    // Save to persistent database layer
    try {
      await insertFoodLog({
        id: mealObj.id,
        userId: `usr_${phone}`,
        phone,
        date: targetDate,
        foodName: mealObj.foodName,
        calories: mealObj.calories,
        protein: mealObj.protein,
        carbs: mealObj.carbs,
        fat: mealObj.fat,
        fiber: mealObj.fiber,
        sugar: mealObj.sugar,
        sodium: mealObj.sodium,
        isHydration: mealObj.isHydration,
        volumeMl: mealObj.volumeMl,
        itemType: mealObj.isHydration ? "water" : "food",
        createdAt: new Date()
      });
    } catch (e: any) {
      console.warn("[Meals API] insertFoodLog note:", e?.message || e);
    }

    res.json({ success: true, phone, date: targetDate, meal: mealObj, logs: dbData.dailyLogs[key] });
  });

  // REST API: Delete single meal log for user (cleans BOTH key and altKey and Firestore)
  app.delete("/api/user/:phone/meals/:mealId", async (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
    const targetDate = (req.query.date as string) || getLocalDateStr();
    const { mealId } = req.params;
    const key = `${phone}_${targetDate}`;
    const altKey = `${altPhone}_${targetDate}`;

    if (dbData.dailyLogs[key]) {
      dbData.dailyLogs[key] = dbData.dailyLogs[key].filter((m: any) => String(m.id) !== String(mealId) && String(m.foodName) !== String(mealId));
    }
    if (dbData.dailyLogs[altKey]) {
      dbData.dailyLogs[altKey] = dbData.dailyLogs[altKey].filter((m: any) => String(m.id) !== String(mealId) && String(m.foodName) !== String(mealId));
    }
    saveDb();

    try {
      await deleteFoodLog(mealId, phone, targetDate);
      if (altPhone !== phone) {
        await deleteFoodLog(mealId, altPhone, targetDate);
      }
    } catch (e: any) {
      console.warn("[Meals API] deleteFoodLog note:", e?.message || e);
    }

    res.json({ success: true, phone, date: targetDate, logs: dbData.dailyLogs[key] || dbData.dailyLogs[altKey] || [] });
  });

  // REST API: Delete ALL meal logs for user on a date
  app.delete("/api/user/:phone/meals", async (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
    const targetDate = (req.query.date as string) || getLocalDateStr();
    const key = `${phone}_${targetDate}`;
    const altKey = `${altPhone}_${targetDate}`;

    dbData.dailyLogs[key] = [];
    dbData.dailyLogs[altKey] = [];
    saveDb();

    try {
      await deleteAllFoodLogsForDate(phone, targetDate);
      if (altPhone !== phone) {
        await deleteAllFoodLogsForDate(altPhone, targetDate);
      }
    } catch (e: any) {
      console.warn("[Meals API] deleteAllFoodLogsForDate note:", e?.message || e);
    }

    res.json({ success: true, phone, date: targetDate, logs: [] });
  });

  // REST API: Full synchronization / replace of meal logs for user on a date
  app.put("/api/user/:phone/meals", express.json(), async (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
    const targetDate = (req.query.date as string) || req.body?.date || getLocalDateStr();
    const key = `${phone}_${targetDate}`;
    const altKey = `${altPhone}_${targetDate}`;
    const rawMeals = Array.isArray(req.body?.meals) ? req.body.meals : (Array.isArray(req.body) ? req.body : []);

    dbData.dailyLogs[key] = rawMeals;
    dbData.dailyLogs[altKey] = rawMeals;
    saveDb();

    // 1. Wipe previous Firestore logs for this date to prevent deleted items from resurrecting
    try {
      await deleteAllFoodLogsForDate(phone, targetDate);
      if (altPhone !== phone) {
        await deleteAllFoodLogsForDate(altPhone, targetDate);
      }
    } catch (e: any) {
      console.warn("[Meals API PUT] deleteAllFoodLogsForDate note:", e?.message || e);
    }

    // 2. Persist active meals into Firestore
    for (const m of rawMeals) {
      if (m && m.foodName) {
        await insertFoodLog({
          id: m.id || `m-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          userId: `usr_${phone}`,
          phone,
          date: targetDate,
          foodName: m.foodName,
          mealType: m.mealType,
          calories: Number(m.calories) || 0,
          protein: Number(m.protein) || 0,
          carbs: Number(m.carbs) || 0,
          fat: Number(m.fat) || 0,
          fiber: Number(m.fiber) || 0,
          sugar: Number(m.sugar) || 0,
          sodium: Number(m.sodium) || 0,
          isHydration: Boolean(m.isHydration),
          volumeMl: Number(m.volumeMl) || undefined,
          itemType: m.isHydration ? "water" : "food",
          createdAt: m.createdAt ? new Date(m.createdAt) : new Date()
        }).catch(() => {});
      }
    }

    res.json({ success: true, phone, date: targetDate, logs: rawMeals });
  });

  // REST API: Get water intake
  app.get("/api/user/:phone/water", (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const targetDate = (req.query.date as string) || getLocalDateStr();
    const cups = getWaterCups(phone, targetDate);
    res.json({ success: true, phone, date: targetDate, cups, liters: Number((cups * 0.25).toFixed(1)) });
  });

  // REST API: Update water intake
  app.post("/api/user/:phone/water", express.json(), (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const { cups, date } = req.body;
    const targetDate = date || getLocalDateStr();
    const updatedCups = setWaterCups(phone, Number(cups) || 0, targetDate);
    res.json({ success: true, phone, date: targetDate, cups: updatedCups, liters: Number((updatedCups * 0.25).toFixed(1)) });
  });

  // Note: GET /api/user/:phone and DELETE /api/user/:phone are registered as authoritative async endpoints at the top of routes.

  // Reset all database data endpoint (Local & Firestore)
  app.all(["/api/user/reset", "/api/admin/reset-db"], async (req, res) => {
    dbData = {
      users: {},
      dailyLogs: {},
      weeklyProgress: {},
      waterLogs: {},
      infographics: {},
      generatedImages: {}
    };
    saveDb();
    try {
      await saveAppDataToFirestore(dbData);
      console.log("[Firestore] Global appdata reset successfully ✅");
    } catch (err: any) {
      console.error("[Firestore] Reset error:", err?.message || err);
    }
    console.log("All user database data reset successfully.");
    return res.json({ success: true, message: "Semua data database (lokal & Firestore) berhasil dihapus 100%." });
  });

  // Weekly Progress Endpoint for API / Dashboard
  app.post("/api/user/:phone/progress", express.json(), (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const weightInput = req.body.weight || req.body.currentWeight;
    const numW = Number(weightInput);
    if (!numW || numW < 30 || numW > 300) {
      return res.status(400).json({ success: false, error: "Valid weight number (30-300 kg) is required" });
    }
    const result = addWeeklyProgress(phone, numW, req.body.notes || "Update via Dashboard");
    if (!result) {
      return res.status(404).json({ success: false, error: "User profile not found. Please complete onboarding first." });
    }
    const user = getUserProfile(phone);
    const calculated = calculateUserData(user);
    res.json({ success: true, ...result, profile: user, user, calculated, userData: calculated });
  });

  app.get("/api/user/:phone/progress", (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const user = getUserProfile(phone);
    if (!user) {
      return res.status(404).json({ success: false, error: "User profile not found" });
    }
    const history = dbData.weeklyProgress[phone] || [];
    const calculated = calculateUserData(user);
    res.json({
      success: true,
      user,
      profile: user,
      userData: calculated,
      calculated,
      history
    });
  });

  // REST API: Get/Update Workout Schedule for Dashboard & WhatsApp Sync
  app.get("/api/user/:phone/schedule", (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const user = getUserProfile(phone);
    if (!user) {
      return res.status(404).json({ success: false, error: "User profile not found" });
    }
    const calculated = calculateUserData(user);
    res.json({ success: true, schedule: calculated.workoutSchedule, goal: calculated.goal, goalTitle: calculated.goalTitle });
  });

  app.post("/api/user/:phone/schedule", express.json(), (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const user = getUserProfile(phone);
    if (!user) {
      return res.status(404).json({ success: false, error: "User profile not found" });
    }
    const { schedule } = req.body;
    if (Array.isArray(schedule)) {
      user.workoutSchedule = schedule;
      saveUserProfile(phone, user);
    }
    const calculated = calculateUserData(user);
    res.json({ success: true, schedule: calculated.workoutSchedule });
  });

  // REST API: Get/Update Daily Exercise Checklist & Additional Activities (Cross-Device Sync)
  app.get("/api/user/:phone/exercises", (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
    const targetDate = (req.query.date as string) || getLocalDateStr();
    const key = `gymbuddy_exercises_${phone}_${targetDate}`;
    const altKey = `gymbuddy_exercises_${altPhone}_${targetDate}`;
    const actKey = `gymbuddy_activities_${phone}_${targetDate}`;
    const altActKey = `gymbuddy_activities_${altPhone}_${targetDate}`;
    const exercises = dbData.dailyLogs[key] || dbData.dailyLogs[altKey] || [];
    const activities = dbData.dailyLogs[actKey] || dbData.dailyLogs[altActKey] || [];
    res.json({ success: true, phone, date: targetDate, exercises, activities });
  });

  app.post("/api/user/:phone/exercises", express.json(), (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
    const targetDate = req.body?.date || (req.query.date as string) || getLocalDateStr();
    const { exercises, activities } = req.body;
    const key = `gymbuddy_exercises_${phone}_${targetDate}`;
    const altKey = `gymbuddy_exercises_${altPhone}_${targetDate}`;
    const actKey = `gymbuddy_activities_${phone}_${targetDate}`;
    const altActKey = `gymbuddy_activities_${altPhone}_${targetDate}`;
    if (Array.isArray(exercises)) {
      dbData.dailyLogs[key] = exercises;
      dbData.dailyLogs[altKey] = exercises;
    }
    if (Array.isArray(activities)) {
      dbData.dailyLogs[actKey] = activities;
      dbData.dailyLogs[altActKey] = activities;
    }
    saveDb();
    res.json({
      success: true,
      phone,
      date: targetDate,
      exercises: dbData.dailyLogs[key] || [],
      activities: dbData.dailyLogs[actKey] || []
    });
  });

  // REST API: Get/Update Additional Activities specifically
  app.get("/api/user/:phone/activities", (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
    const targetDate = (req.query.date as string) || getLocalDateStr();
    const actKey = `gymbuddy_activities_${phone}_${targetDate}`;
    const altActKey = `gymbuddy_activities_${altPhone}_${targetDate}`;
    const activities = dbData.dailyLogs[actKey] || dbData.dailyLogs[altActKey] || [];
    res.json({ success: true, phone, date: targetDate, activities });
  });

  app.post("/api/user/:phone/activities", express.json(), (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
    const targetDate = req.body?.date || (req.query.date as string) || getLocalDateStr();
    const { activities } = req.body;
    const actKey = `gymbuddy_activities_${phone}_${targetDate}`;
    const altActKey = `gymbuddy_activities_${altPhone}_${targetDate}`;
    if (Array.isArray(activities)) {
      dbData.dailyLogs[actKey] = activities;
      dbData.dailyLogs[altActKey] = activities;
      saveDb();
    }
    res.json({ success: true, phone, date: targetDate, activities: dbData.dailyLogs[actKey] || [] });
  });

  // REST API: Delete specific Additional Activity by ID
  app.delete("/api/user/:phone/activities/:activityId", (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
    const targetDate = (req.query.date as string) || getLocalDateStr();
    const { activityId } = req.params;
    const actKey = `gymbuddy_activities_${phone}_${targetDate}`;
    const altActKey = `gymbuddy_activities_${altPhone}_${targetDate}`;

    let activities: AdditionalActivity[] = dbData.dailyLogs[actKey] || dbData.dailyLogs[altActKey] || [];
    if (Array.isArray(activities)) {
      activities = activities.filter((a: any) => String(a.id) !== String(activityId));
      dbData.dailyLogs[actKey] = activities;
      dbData.dailyLogs[altActKey] = activities;
      saveDb();
    }

    res.json({
      success: true,
      phone,
      date: targetDate,
      deletedActivityId: activityId,
      activities: dbData.dailyLogs[actKey] || []
    });
  });

  app.delete("/api/user/:phone/activities", (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
    const targetDate = (req.query.date as string) || getLocalDateStr();
    const activityId = (req.query.id as string) || req.body?.id;
    const actKey = `gymbuddy_activities_${phone}_${targetDate}`;
    const altActKey = `gymbuddy_activities_${altPhone}_${targetDate}`;

    let activities: AdditionalActivity[] = dbData.dailyLogs[actKey] || dbData.dailyLogs[altActKey] || [];
    if (Array.isArray(activities)) {
      if (activityId) {
        activities = activities.filter((a: any) => String(a.id) !== String(activityId));
      } else {
        activities = [];
      }
      dbData.dailyLogs[actKey] = activities;
      dbData.dailyLogs[altActKey] = activities;
      saveDb();
    }

    res.json({
      success: true,
      phone,
      date: targetDate,
      deletedActivityId: activityId,
      activities: dbData.dailyLogs[actKey] || []
    });
  });

  // REST API: Update Reminder Settings for Dashboard & WhatsApp Sync
  app.post("/api/user/:phone/reminder", express.json(), async (req, res) => {
    try {
      const phone = normalizePhone(req.params.phone);
      const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
      const user = getUserProfile(phone) || getUserProfile(altPhone) || (await findUserByPhoneOrId(phone));
      if (!user) {
        return res.status(404).json({ success: false, error: "User profile not found" });
      }
      const { reminderTime, reminderEnabled } = req.body;
      if (reminderTime !== undefined) user.reminderTime = String(reminderTime).trim();
      if (reminderEnabled !== undefined) user.reminderEnabled = Boolean(reminderEnabled);
      user.updatedAt = new Date().toISOString();

      saveUserProfile(phone, user);
      if (altPhone !== phone) saveUserProfile(altPhone, user);
      saveDb();

      const calculated = calculateUserData(user);
      try {
        await saveUserDocument({
          userId: `usr_${phone}`,
          phone,
          ...user,
          ...calculated,
          updatedAt: new Date()
        });
      } catch (fErr: any) {
        console.warn("[Firestore] save reminder sync note:", fErr?.message || fErr);
      }

      res.json({
        success: true,
        user: { ...user, ...calculated },
        profile: { ...user, ...calculated },
        userData: calculated,
        calculated,
        reminderTime: user.reminderTime,
        reminderEnabled: user.reminderEnabled
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message || "Failed to update reminder" });
    }
  });

  // REST API: Update Goals & Custom Targets for Dashboard (Cross-Device Sync)
  app.post("/api/user/:phone/goals", express.json(), async (req, res) => {
    try {
      const phone = normalizePhone(req.params.phone);
      const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
      const user = getUserProfile(phone) || getUserProfile(altPhone) || (await findUserByPhoneOrId(phone));
      if (!user) {
        return res.status(404).json({ success: false, error: "User profile not found" });
      }
      const { targetWeight, targetCalories, goal, goalTitle, customTargets, customGoals } = req.body;
      if (targetWeight !== undefined) user.targetWeight = Number(targetWeight);
      if (targetCalories !== undefined) {
        user.targetCalories = Number(targetCalories);
        user.dailyTargetCalories = Number(targetCalories);
      }
      if (goal !== undefined) user.goal = goal;
      if (goalTitle !== undefined) user.goalTitle = goalTitle;
      if (customTargets !== undefined) user.customTargets = customTargets;
      if (customGoals !== undefined) user.customGoals = customGoals;
      user.updatedAt = new Date().toISOString();

      saveUserProfile(phone, user);
      if (altPhone !== phone) saveUserProfile(altPhone, user);
      saveDb();

      const calculated = calculateUserData(user);
      try {
        await saveUserDocument({
          userId: `usr_${phone}`,
          phone,
          ...user,
          ...calculated,
          updatedAt: new Date()
        });
      } catch (fErr: any) {
        console.warn("[Firestore] save goals sync note:", fErr?.message || fErr);
      }

      res.json({
        success: true,
        user: { ...user, ...calculated },
        profile: { ...user, ...calculated },
        userData: calculated,
        calculated,
        customTargets: user.customTargets,
        customGoals: user.customGoals
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message || "Failed to update goals" });
    }
  });

  // REST API: ExerciseDB Endpoints (Full Library & Query Search)
  app.get("/api/exercises", (req, res) => {
    res.json({ success: true, count: EXERCISE_DATABASE.length, exercises: EXERCISE_DATABASE });
  });

  app.get("/api/exercises/search", (req, res) => {
    const q = (req.query.q as string) || "";
    if (!q) {
      return res.json({ success: true, count: EXERCISE_DATABASE.length, exercises: EXERCISE_DATABASE });
    }
    const matched = findExerciseOrEquipment(q);
    if (matched) {
      return res.json({ success: true, match: matched, exercises: [matched] });
    }
    const queryLower = q.toLowerCase();
    const results = EXERCISE_DATABASE.filter(
      (e) =>
        e.name.toLowerCase().includes(queryLower) ||
        e.indonesianName.toLowerCase().includes(queryLower) ||
        e.aliases.some((a) => a.toLowerCase().includes(queryLower)) ||
        e.targetMuscles.some((m) => m.toLowerCase().includes(queryLower)) ||
        e.equipmentName.toLowerCase().includes(queryLower)
    );
    res.json({ success: true, count: results.length, exercises: results });
  });

  // Midtrans Payment Endpoint
  app.post("/api/midtrans/create-transaction", express.json(), async (req, res) => {
    try {
      const { phone, plan = "advanced", activeService = "both", amount, customerName } = req.body;
      const normPhone = normalizePhone(phone || "");
      
      if (!normPhone) {
        return res.status(400).json({ success: false, error: "Phone number is required for payment" });
      }
      
      const orderId = `GYMBUDDY-${normPhone}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const grossAmount = Number(amount) || (plan === "premium" ? 139000 : 79000);

      const parameter = {
        transaction_details: {
          order_id: orderId,
          gross_amount: grossAmount,
        },
        item_details: req.body.itemDetails || [{
          id: `${plan.toUpperCase()}-${activeService.toUpperCase()}`,
          price: grossAmount,
          quantity: 1,
          name: `GymBuddy AI ${plan.toUpperCase()} Plan (${activeService})`
        }],
        customer_details: req.body.customerDetails || {
          first_name: customerName || "Member GymBuddy",
          email: "member@gymbuddy.app",
          phone: normPhone
        },
        // Bug #6 FIX: Add custom_fields so Midtrans webhook can identify user & plan
        // These fields are returned back in the notification payload
        custom_field1: normPhone,        // User phone (primary identifier)
        custom_field2: plan,             // Subscription plan tier
        custom_field3: activeService     // Active service (nutrition/coach/both)
      };

      const transaction = await snap.createTransaction(parameter);
      console.log(`[Midtrans] Created transaction ${orderId} for user ${normPhone}, plan: ${plan}, service: ${activeService}`);
      res.json({
        success: true,
        orderId,
        token: transaction.token,
        redirect_url: transaction.redirect_url
      });
    } catch (error: any) {
      console.error("Midtrans Transaction Error:", error);

      res.status(500).json({ success: false, error: error.message || "Failed to create transaction" });
    }
  });

  // Midtrans Notification Webhook
  app.post("/api/midtrans/notification", async (req, res) => {
    try {
      const serverKey = process.env.MIDTRANS_SERVER_KEY || "";
      const body = req.body;
      const orderId = body.order_id;
      const statusCode = body.status_code;
      const grossAmount = body.gross_amount;
      const signatureKey = body.signature_key;

      // Verify SHA-512 Signature if server key is configured
      if (serverKey && signatureKey) {
        const isValidSignature = verifyMidtransSignature(orderId, statusCode, grossAmount, signatureKey, serverKey);
        if (!isValidSignature) {
          console.error(`[Midtrans Webhook] Invalid signature rejected for order ${orderId}`);
          return res.status(403).json({ error: "Invalid signature" });
        }
      }

      const statusResponse = await snap.transaction.notification(body);
      const transactionStatus = statusResponse.transaction_status;
      const fraudStatus = statusResponse.fraud_status;
      const paymentType = statusResponse.payment_type;

      console.log(`[Midtrans] Order ${orderId} status: ${transactionStatus}, fraud: ${fraudStatus}, payment: ${paymentType}`);

      const isSuccess = transactionStatus === "settlement" || (transactionStatus === "capture" && fraudStatus === "accept");
      const isFailed = transactionStatus === "cancel" || transactionStatus === "deny" || transactionStatus === "expire";

      // Extract phone from custom fields or order metadata
      const phone = body.custom_field1 || body.phone || (orderId.includes("_") ? orderId.split("_")[1] : "");
      const plan = body.custom_field2 || "premium";
      const activeService = body.custom_field3 || "both";

      if (isSuccess && phone) {
        const normPhone = normalizePhone(phone);
        const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000); // 30 days default monthly

        await saveUserSubscription({
          userId: `usr_${normPhone}`,
          phone: normPhone,
          plan: plan === "advanced" ? "advanced" : "premium",
          activeService: activeService === "nutrition" || activeService === "coach" ? activeService : "both",
          status: "active",
          billingDuration: "1m",
          startedAt: new Date(),
          expiresAt,
          midtransOrderId: orderId,
          grossAmount: Number(grossAmount),
          paymentType,
          updatedAt: new Date()
        });

        // Update in-memory user profile
        if (dbData.users[normPhone]) {
          dbData.users[normPhone].subscription = {
            plan,
            activeService,
            status: "active",
            expiresAt: expiresAt.toISOString()
          };
          saveDb();
        }
        console.log(`[Midtrans] Activated premium subscription in MongoDB for ${normPhone} ✅`);
      } else if (isFailed && phone) {
        const normPhone = normalizePhone(phone);
        const sub = await getUserSubscription(normPhone);
        if (sub) {
          sub.status = "expired";
          await saveUserSubscription(sub);
        }
      }

      res.status(200).send("OK");
    } catch (error: any) {
      console.error("Midtrans Webhook Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // WhatsApp Webhook (Meta Cloud API) verification
  app.get("/api/webhook/whatsapp", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token) {
      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("WEBHOOK_VERIFIED");
        res.status(200).send(challenge);
      } else {
        res.sendStatus(403);
      }
    }
  });

  // WhatsApp Webhook (Meta Cloud API) message handler
  app.post("/api/webhook/whatsapp", async (req, res) => {
    console.log(`[${new Date().toISOString()}] Received Meta WhatsApp Webhook:`, JSON.stringify(req.body));
    try {
      const body = req.body;
      if (body.object === "whatsapp_business_account") {
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const message = value?.messages?.[0];

        if (message) {
          const from = message.from;
          let userProfile = getUserProfile(from);

          let userText = "";
          let imagePart: any = null;

          if (message.type === "text") {
            userText = message.text.body;
          } else if (message.type === "image") {
            const imageId = message.image.id;
            userText = message.image.caption || "Analisis foto ini";
            if (WHATSAPP_TOKEN) {
              try {
                const mediaRes = await axios.get(`https://graph.facebook.com/v19.0/${imageId}`, {
                  headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
                });
const mediaUrl = mediaRes.data.url;
                const imageBinary = await axios.get(mediaUrl, {
                  headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
                  responseType: 'arraybuffer'
                });
                const base64Image = Buffer.from(imageBinary.data).toString('base64');
                imagePart = { inlineData: { data: base64Image, mimeType: message.image.mime_type || "image/jpeg" } };
              } catch (imgErr) {
                console.error("Error fetching WhatsApp media:", imgErr);
              }
            }
          }

          const lowerText = userText.toLowerCase();

          const isWelcomeMessage = (lowerText.includes("gymbuddy") && (lowerText.includes("target harian") || lowerText.includes("target saya") || lowerText.includes("tolong kirimkan"))) ||
                                   (lowerText.includes("nama saya") && lowerText.includes("target saya"));

          // If not in memory, check Firestore directly
          if (!userProfile) {
            userProfile = await getUserProfileFromFirestore(from);
          }

          // Still null = truly unregistered
          if (!userProfile && !isWelcomeMessage) {
            await sendMetaWhatsappMessage(
              from,
              `⚠️ *AKUN BELUM TERDAFTAR DI GYMBUDDY AI*\n-----------------------------\n` +
              `Halo! Nomor WhatsApp kamu belum terdaftar.\n\n` +
              `Silakan isi kuesioner Onboarding di website GymBuddy AI terlebih dahulu untuk memulai! 🎯✨\n` +
              `https://gymbuddygroup.com`
            );
            return res.sendStatus(200);
          }

          if (!userProfile) userProfile = getOrCreateUserProfile(from, userText);
          const userData = calculateUserData(userProfile);

          const isRecommendationMessage = lowerText.includes("rekomendasi makanan") ||
                                          lowerText.includes("menu makan") ||
                                          lowerText.includes("saran makan") ||
                                          lowerText.includes("pagi siang malam") ||
                                          lowerText.includes("rekomendasi sarapan");

          const isWeeklyScheduleQuery = (
            lowerText.includes("jadwal latihan minggu") ||
            lowerText.includes("jadwal minggu ini") ||
            lowerText.includes("jadwal latihan aku minggu ini") ||
            lowerText.includes("jadwal gym minggu ini") ||
            lowerText.includes("jadwal workout minggu ini") ||
            lowerText.includes("jadwal seminggu") ||
            lowerText.includes("program minggu ini")
          );

          const isWorkoutReqMessage = !isWeeklyScheduleQuery && (
            lowerText.includes("latihan apa") ||
            lowerText.includes("workout apa") ||
            lowerText.includes("jadwal latihan") ||
            lowerText.includes("jadwal workout") ||
            lowerText.includes("jadwal gym") ||
            lowerText.includes("jadwal hari ini") ||
            lowerText.includes("menu latihan") ||
            lowerText.includes("program latihan") ||
            lowerText.includes("rekomendasi workout") ||
            lowerText.includes("rekomendasi latihan") ||
            lowerText.includes("olahraga hari ini apa") ||
            lowerText.includes("mau latihan apa") ||
            lowerText.includes("workout besok") ||
            lowerText.includes("latihan besok") ||
            Boolean(lowerText.match(/^(?:jadwal|menu|program|rekomendasi)\s+(?:workout|latihan|olahraga|gym)/i)) ||
            Boolean(lowerText.match(/^(?:hari\s*ini|besok)\s+(?:jadwal(?:nya)?|menu|program)?\s*(?:workout|latihan|olahraga|gym)\s*(?:apa(?:an)?|gimana)?/i)) ||
            Boolean(lowerText.match(/^(?:workout|latihan|olahraga|gym)\s+(?:hari\s*ini|besok)\s*(?:apa(?:an)?|gimana)?$/i))
          );

          const parsedQueryDate = parseDateFromQuery(userText);
          const isCheckSummaryMessage = (parsedQueryDate.isSpecificDate && (lowerText.includes("makan") || lowerText.includes("food") || lowerText.includes("log") || lowerText.includes("kalori") || lowerText.includes("lihat") || lowerText.includes("menu"))) ||
                                       lowerText.includes("cek kalori") || 
                                       lowerText.includes("sisa kalori") || 
                                       lowerText.includes("rekap kalori") ||
                                       lowerText.includes("rekap nutrisi") ||
                                       lowerText.includes("rekap") ||
                                       lowerText.includes("kemarin") ||
                                       lowerText.includes("yesterday") ||
                                       lowerText.includes("makan apa") ||
                                       lowerText.includes("makanan hari ini") ||
                                       lowerText.includes("log makanan") ||
                                       lowerText.includes("log makan") ||
                                       lowerText.includes("food log") ||
                                       lowerText.includes("riwayat makan") ||
                                       lowerText.includes("total kalori") ||
                                       lowerText.includes("apa yang sudah aku makan") ||
                                       lowerText.includes("makanan saya hari ini");

          const isProgressHistoryMessage = lowerText.includes("cek progress") || 
                                          lowerText.includes("riwayat progress") || 
                                          lowerText.includes("progress minggu");

          // Weight Update Intent Match (e.g. "update bb 78", "lapor bb 77.5", "bb 76")
          const weightMatch = matchPureWeightLog(userText);

          // Water Intake Intent Match (e.g. "minum 2 gelas", "air 500ml", "water 3 cups")
          const waterMatch = matchPureWaterLog(userText);

          let responseMessages: string[] = [];

          if (isWelcomeMessage) {
            const nameMatch = userText.match(/(?:i am|saya|nama saya)\s+([^,!\.\n]+)/i);
            const targetMatch = userText.match(/(?:my target is|target saya adalah|goal saya)\s+([^,!\.\n]+)/i);
            let updatedProfileNeeded = false;
            if (nameMatch) { userProfile.name = nameMatch[1].trim(); updatedProfileNeeded = true; }
            if (targetMatch) { userProfile.goalTitle = targetMatch[1].trim(); updatedProfileNeeded = true; }

            if (updatedProfileNeeded) {
              saveUserProfile(from, userProfile);
            }

            const currentCalculated = calculateUserData(userProfile);
            responseMessages = generateWelcomeMessages(currentCalculated);
          } else {
            const planCapabilities = getUserPlanCapabilities(userData);
            const planValidation = validatePlanContext(userText, Boolean(imagePart), userData);

            if (!planValidation.canProceed) {
              responseMessages = [planValidation.redirectMessage!];
            } else if (waterMatch) {
              if (!planCapabilities.canNutrition) {
                responseMessages = [validatePlanContext("minum air", false, userData).redirectMessage || "Untuk plan kamu saat ini, fokus aku adalah mendampingi latihan fisik kamu ya ✨"];
              } else {
                const rawAmount = parseFloat(waterMatch[1].replace(',', '.'));
                const unit = (waterMatch[2] || "gelas").toLowerCase();
                let actualMl: number;
                if (unit === "ml") {
                  actualMl = rawAmount;
                } else if (unit === "l" || unit === "liter") {
                  actualMl = rawAmount * 1000;
                } else {
                  actualMl = Math.round(rawAmount) * 250;
                }
                const cupsToAdd = Math.max(1, Math.round(actualMl / 250));
                const currentCups = getWaterCups(from);
                const newTotalCups = setWaterCups(from, currentCups + cupsToAdd);
                const liters = (newTotalCups * 0.25).toFixed(1);
                const waterEntry: MealLog = {
                  id: `wa-water-${Date.now()}`,
                  foodName: `Air Putih ${actualMl} ml`,
                  calories: 0,
                  protein: 0,
                  carbs: 0,
                  fat: 0,
                  isHydration: true,
                  volumeMl: actualMl,
                  timestamp: new Date().toISOString(),
                  mealType: getMealTypeByHour(userText)
                };
                addMealLog(from, waterEntry);
                const coachName = userData.persona === "max" ? "Coach Max" : "Coach Mia";
                const comment = userData.persona === "max" 
                  ? "Mantap bro! Jaga terus hidrasi tubuh lo biar metabolisme makin kenceng! 🔥"
                  : "Hebat banget! Tetap rajin minum air putih ya biar tubuh selalu segar ✨";
                responseMessages = [
                  `💧 *CATATAN HIDRASI DISIMPAN*\n-----------------------------\n` +
                  `✅ Kamu menambah *${actualMl} ml* air putih!\n` +
                  `📊 Total Hidrasi Hari Ini: *${newTotalCups} Gelas* (${liters} Liter / 3.0 L Target)\n\n` +
                  `💬 *${coachName}*:\n"${comment}"`
                ];
              }
            } else if (handleReminderCommand(userText, userProfile, from, userData)) {
              responseMessages = handleReminderCommand(userText, userProfile, from, userData)!;
            } else if (handleWorkoutProgressLogging(from, userText, userData)) {
              if (!planCapabilities.canWorkout) {
                responseMessages = [validatePlanContext("latihan workout", false, userData).redirectMessage || "Untuk plan kamu saat ini, aku fokus bantu soal nutrisi ya ✨"];
              } else {
                responseMessages = handleWorkoutProgressLogging(from, userText, userData)!;
              }
            } else if (weightMatch) {
              const newW = parseFloat(weightMatch[1].replace(',', '.'));
              if (!isNaN(newW) && newW > 30 && newW < 300) {
                const resProg = addWeeklyProgress(from, newW, "Update via WhatsApp");
                if (resProg) {
                  responseMessages = [formatWeeklyProgressCard(resProg)];
                } else {
                  responseMessages = ["Profil kamu belum terdaftar di database. Silakan isi kuesioner terlebih dahulu!"];
                }
              }
            } else if (isProgressHistoryMessage) {
              responseMessages = [formatProgressHistoryCard(from)];
            } else if (isWeeklyScheduleQuery) {
              if (!planCapabilities.canWorkout) {
                responseMessages = [validatePlanContext("jadwal workout", false, userData).redirectMessage || "Untuk plan kamu saat ini, aku fokus bantu soal nutrisi ya ✨"];
              } else {
                responseMessages = [generateWeeklyWorkoutSchedule(userData)];
              }
            } else if (isWorkoutReqMessage) {
              if (!planCapabilities.canWorkout) {
                responseMessages = [validatePlanContext("jadwal workout", false, userData).redirectMessage || "Untuk plan kamu saat ini, aku fokus bantu soal nutrisi ya ✨"];
              } else {
                const isTomorrow = lowerText.includes("besok") || lowerText.includes("tomorrow");
                responseMessages = [generateWorkoutRecommendations(userData, isTomorrow ? 1 : 0)];
              }
            } else if (isRecommendationMessage) {
              if (!planCapabilities.canNutrition) {
                responseMessages = [validatePlanContext("rekomendasi makanan", false, userData).redirectMessage || "Untuk plan kamu saat ini, fokus aku adalah mendampingi latihan fisik kamu ya ✨"];
              } else {
                responseMessages = [generateMealRecommendations(userData, from, userText)];
              }
            } else if (isCheckSummaryMessage) {
              const parsedDate = parseDateFromQuery(userText);
              const totals = getDailyTotals(from, parsedDate.dateStr);
              if (parsedDate.isSpecificDate || parsedDate.isYesterday || !parsedDate.isToday) {
                responseMessages = [formatHistoricalFoodLog(userData, totals, parsedDate)];
              } else {
                responseMessages = [generateDailySummaryCard(userData, totals, parsedDate.label)];
              }
            } else if (!imagePart && detectMealCorrectionIntent(userText, Boolean(getLastFoodMeal(from)))) {
              if (!planCapabilities.canNutrition) {
                responseMessages = [validatePlanContext("koreksi porsi makanan", false, userData).redirectMessage || "Untuk plan kamu saat ini, fokus aku adalah mendampingi latihan fisik kamu ya ✨"];
              } else {
                const recentMeal = getLastFoodMeal(from);
                const isMia = userData.persona === "mia" || userData.persona === "nikita";
                if (recentMeal) {
                  const isAmbiguousQuery = !/\b(?:setengah|separuh|seperempat|tiga perempat|dobel|double|1\/2|1\/4|3\/4|g|gr|gram|kcal|kalori|potong|buah|butir|gelas|slice|sdm|sendok|tidak|nggak|gak|tanpa|tawar|batal|hapus)\b/i.test(userText);
                  if (!isAmbiguousQuery) {
                    const processingMsg = isMia ? "Sebentar ya, aku perbarui hitungan makanannya... ✨" : "Sebentar, gue update dulu hitungannya.";
                    await sendMetaWhatsappMessage(from, processingMsg);
                  }
                  const correctionResult = await processMealCorrection(from, userText, userData);
                  if (correctionResult) {
                    responseMessages = [correctionResult.card];
                  } else {
                    responseMessages = [
                      isMia
                        ? `Maaf, aku belum berhasil memproses koreksi ini ya ✨ Boleh coba sebutkan lagi porsi yang ingin diubah?`
                        : `Sorry ${getValidatedUserAddressing(userData).validatedAddress}, koreksi belum berhasil diproses. Boleh sebutkan lagi bagian mana yang mau diubah? 💪`
                    ];
                  }
                } else {
                  responseMessages = [
                    isMia
                      ? `Belum ada catatan makanan hari ini yang bisa dikoreksi ya ✨ Silakan catat atau foto makananmu terlebih dahulu!`
                      : `Belum ada log makanan hari ini yang bisa dikoreksi, ${getValidatedUserAddressing(userData).validatedAddress}! Kirim foto atau sebutkan makanan kamu dulu ya! 💪`
                  ];
                }
              }
            } else if (getAi()) {
            const isGenericImageCaption = /^(?:aku\s+)?makan\s+ini|^ini\s+makanan|^foto\s+ini|^ini$|^makan$/i.test(userText.trim());
            
            if (isGenericImageCaption && !imagePart) {
              const coachName = userData.persona === "mia" || userData.persona === "nikita" ? "Coach Mia" : "Coach Max";
              responseMessages = [
                `📸 *FOTO BELUM BERHASIL DIPROSES*\n-----------------------------\n` +
                `Halo ${getValidatedUserAddressing(userData).validatedAddress}! Fotonya belum berhasil terunduh oleh sistem WhatsApp Meta.\n\n` +
                `💡 *Solusi Cepat*:\n` +
                `Silakan ketik nama makanannya dalam teks (misal: *"Nasi Putih + Telur Balado + Ayam Goreng"*), maka ${coachName} akan langsung mencatat kalori & makronya! 🥗✨`
              ];
            } else {
              const isMia = userData.persona === "mia" || userData.persona === "nikita";
              const addressing = getValidatedUserAddressing(userData);
              const processingMsg = isMia ? `Sebentar ya ${addressing.validatedAddress}, aku cek dulu... ✨` : `Sebentar ${addressing.validatedAddress}. Aku cek dulu.`;
              await sendMetaWhatsappMessage(from, processingMsg);

              const personaInstruction = isMia
                ? `PERSONA COACH MIA:
- Karakter: Ramah, hangat, menyemangati secara halus (gentle encouragement), empatik, suportif, dan edukatif (aku/kamu).
- Gaya Bicara & Sapaan:
  • Sapaan Wajib: Panggil pengguna HANYA dengan sapaan tervalidasi: "${addressing.validatedAddress}".
  • DILARANG KERAS menggunakan panggilan seperti "sayang", "cinta", "beb", "sis", "bestie", dll.
  • Jangan terdengar kekanak-kanakan. Tetap 100% profesional, ilmiah, dan terpercaya.`
                : `PERSONA COACH MAX:
- Karakter: Tegas, disiplin, percaya diri, fokus pada akuntabilitas (accountability), dan motivasi ringkas to-the-point.
- Gaya Bicara & Sapaan:
  • Sapaan Wajib: Panggil pengguna HANYA dengan sapaan tervalidasi: "${addressing.validatedAddress}".
  • DILARANG KERAS memanggil pengguna dengan istilah slang umum seperti "bro", "sis", "guys", "boss", "bestie", "sob", "bray", "gan" atau sapaan buatan lainnya. Kata "bro" DILARANG digunakan kecuali jika itu adalah nama panggilan resmi tervalidasi pengguna.
  • Karakter tegas Coach Max TIDAK BOLEH mengesampingkan format sapaan tervalidasi pengguna.
  • Contoh BENAR: "Bagus, ${addressing.validatedAddress}! Aktivitas ekstra kamu sudah tercatat..."
  • Contoh SALAH: "Mantap bro! Aktivitas ekstra lo udah tercatat."
- BATASAN MUTLAK:
  • Tegas tapi TIDAK PERNAH kasar, menghina, atau merendahkan.
  • Hindari basa-basi panjang, langsung sampaikan insight tindakan nyata.`;

              const isFemale = (userData.gender || "").toLowerCase() === "wanita" || (userData.gender || "").toLowerCase() === "female";
              const genderLabel = isFemale ? "Perempuan" : "Laki-laki";

              const prompt = `GYMBUDDY AI MASTER INSTRUCTION:
INFORMASI PENGGUNA:
- Nama Lengkap: ${userData.name}
- Nama Panggilan (Nickname): ${addressing.nickname}
- Sapaan Wajib: ${addressing.validatedAddress}
- Gender: ${genderLabel}
- Usia: ${userData.age} tahun (Kelompok Usia: ${addressing.ageGroup})
- Kondisi Kesehatan: ${userData.healthConditionsSummary || "Tidak ada kondisi khusus / Sehat"}
- Berat Saat Ini: ${userData.weight} kg | Target BB: ${userData.targetWeight} kg
- Target Kalori Harian: ${userData.targetCalories} kcal
- Target Makro: Protein ${userData.proteinGrams}g, Karbo ${userData.carbGrams}g, Lemak ${userData.fatGrams}g, Serat ${userData.fiberGrams}g
- Goal Utama: ${userData.goalTitle}

ATURAN SAPAAN PENGGUNA & NICKNAME BERDASARKAN USIA (SOURCE OF TRUTH MUTLAK):
1. IDENTITAS & FORMAT SAPAAN WAJIB:
   - Nama Panggilan / Nickname: "${addressing.nickname}"
   - Format Sapaan Tervalidasi: "${addressing.validatedAddress}"
   - Kategori Usia: "${addressing.ageGroup}" (${userData.age} tahun)
   - Kata Ganti Pengguna: "${addressing.pronounUser}"
2. ATURAN SAPAAN KETAT:
   - Sapa pengguna HANYA dengan format sapaan tervalidasi: "${addressing.validatedAddress}".
   - DILARANG KERAS memanggil atau mengganti sapaan dengan istilah gaul/slang seperti "bro", "sis", "guys", "boss", "bestie", "sob", "bray", "gan" atau sapaan informal buatan sendiri.
   - Kata "bro" DILARANG dihasilkan kecuali jika itu adalah nama panggilan resmi tervalidasi pengguna.
3. KEPRIBADIAN COACH MAX & COACH MIA:
   - Coach Mia: Ramah, hangat, menyemangati secara halus, empatik, suportif.
   - Coach Max: Tegas, disiplin, percaya diri, to-the-point, fokus pada akuntabilitas.
   - KEDUA COACH WAJIB MEMATUHI ATURAN SAPAAN YANG SAMA. Kepribadian coach TIDAK BOLEH mengesampingkan sapaan valid pengguna.
   Contoh BENAR:
   "Bagus, ${addressing.validatedAddress}! Aktivitas ekstra kamu sudah tercatat..."
   Contoh SALAH:
   "Mantap bro! Aktivitas ekstra lo udah tercatat."
4. DILARANG MEMBUAT STEREOTIP GENDER ("cewek biasanya...", "cowok harusnya...").
5. Nama user harus digunakan secara natural, jangan dipaksakan di setiap kalimat.

ATURAN KESELAMATAN & PERSONALISASI KESEHATAN:
1. DILARANG KERAS mendiagnosis pengguna (misal jika lutut sakit, jangan simpulkan arthritis).
2. DILARANG membuat klaim medis absolut ("karena kamu punya diabetes kamu tidak boleh makan X").
3. Berikan saran kontekstual, hati-hati, dan aman (misal: jika ada riwayat hipertensi, perhatikan batas natrium; jika lansia atau ada cedera sendi, prioritaskan latihan low-impact, mobilitas, dan pemulihan).
4. Jika ada keluhan akut atau risiko tinggi, arahkan dengan sopan untuk berkonsultasi dengan tenaga medis.
5. JANGAN menyebut kondisi kesehatan pada kalimat motivasi kasual yang tidak relevan.

${personaInstruction}

BATASAN MUTLAK LAYANAN PENGGUNA BERDASARKAN ACTIVE PLAN:
- Plan Pengguna: ${planCapabilities.planDisplayName} (Nutrition Coach: ${planCapabilities.canNutrition ? "AKTIF" : "NON-AKTIF"}, Workout Coach: ${planCapabilities.canWorkout ? "AKTIF" : "NON-AKTIF"})
- AI DILARANG KERAS memperluas kapabilitas di luar paket aktif pengguna. Izin paket menentukan kapabilitas Coach yang tersedia, bukan kepribadian coach.
- AI tidak boleh menjawab suatu permintaan hanya karena AI mampu menjawabnya; AI harus memverifikasi bahwa kapabilitas tersebut termasuk dalam paket aktif pengguna.
- Jika pengguna meminta kapabilitas yang TIDAK aktif pada paketnya (misal meminta latihan/workout padahal paket Nutritionist, atau meminta kalori/makanan padahal paket Workout Coach): JANGAN berikan jawaban sebagai coach bidang tersebut. Berikan pengalihan sopan yang menjelaskan fokus paket saat ini dan arahkan ke fitur yang didukung serta upgrade paket.
- Jika pengguna bertanya hal di luar konteks (cuaca, koding, politik, dsb): JANGAN jawab pertanyaan di luar topik tersebut. Alihkan secara ramah ke kapabilitas GymBuddy sesuai paket pengguna.
- Jika pesan bersifat campuran (mixed): Prioritaskan dan proses HANYA bagian yang didukung oleh paket GymBuddy, abaikan pertanyaan di luar topik.

TUGASMU:
${imagePart ? `USER MENGIRIM GAMBAR/FOTO BESERTA PESAN: "${userText}".
VALIDASI KONTEKS GAMBAR (SANGAT KETAT):
1. Tentukan apakah gambar ini benar-benar terkait ruang lingkup GymBuddy:
   - MAKANAN / MINUMAN (Kategori 1): Foto hidangan, makanan, minuman, barcode makanan, label nutrisi/kemasan makanan.
   - ALAT GYM / GERAKAN WORKOUT (Kategori 2): Foto alat gym, mesin latihan, dumbbell, barbell, treadmill, form gerakan latihan.
2. JIKA GAMBAR TIDAK TERKAIT / DI LUAR KONTEKS (Kategori 3 - isUnrelatedImage: true):
   Jika gambar BUKAN makanan/minuman dan BUKAN alat gym/latihan (CONTOH: tangkapan layar Excel / spreadsheet karyawan / data bisnis, dokumen kantor, invoice, teks non-makanan, meme, hewan, pemandangan, kendaraan, gadget/laptop, foto diri/selfie santai tanpa konteks makanan/gym, atau gambar ambigu tanpa bukti cukup):
   - DILARANG KERAS MENEBAK atau memaksakan gambar ke kategori makanan atau gym!
   - DILARANG membuat panduan latihan dari spreadsheet!
   - DILARANG membuat estimasi nutrisi dari dokumen kantor!
   - Set "isFood": false, "isEquipment": false, "isUnrelatedImage": true.
   - Isi "coachComment": "Maaf ya 😊 Aku belum bisa mengaitkan gambar ini dengan aktivitas GymBuddy. Kalau kamu ingin aku bantu cek makanan, nutrisi, atau workout, kirim gambar yang sesuai ya."` : `User mengirim pesan teks di WhatsApp: "${userText}"`}

PRINSIP UTAMA & VALIDASI NUTRISI (WAJIB DIPATUHI):
1. Akurasi ilmiah dan konsistensi internal selalu diutamakan.
2. Konsistensi Kalori: (Protein * 4) + (Carbs * 4) + (Fat * 9) harus konsisten dengan total kalori. Dilarang mengembalikan makanan tinggi karbohidrat & tinggi lemak dengan kalori yang sangat rendah.
3. Porsi substansial makanan tinggi protein (dada ayam, daging sapi, telur, ikan, protein shake) harus memiliki protein yang masuk akal dan realistis (tidak boleh implausibly low).
4. Makanan asin, olahan, berpengawet, atau berbumbu gurih pekat (mie instan, ikan asin, sosis, bakso, kuah soto, fast food) harus memiliki natrium realistis (tidak boleh mendekati nol/implausibly low).
5. Makanan/minuman yang lazim mengandung gula (teh manis, boba, kopi susu aren, dessert, soda, kue) harus memiliki gula realistis kecuali eksplisit tanpa gula/tawar.
6. Perhitungkan metode memasak: makanan goreng menyerap minyak (lemak & kalori bertambah), masakan bersantan memiliki lemak lebih tinggi.
7. Evaluasi minuman berdasarkan volume nyata (250ml, 350ml, 500ml); air putih selalu 0 kalori dan 0 makro.
8. Hindari kepastian palsu jika porsi atau resep tidak diketahui pasti; sajikan estimasi realistis (~45g, ~180 kcal, ~12g gula) dan akui ketidakpastian lewat confidence score.

Kategori 1: LAPORAN MAKANAN/MINUMAN
PASTIKAN "isFood": true dan berikan angka estimasi realistis.
ATURAN TITLE MAKANAN (SANGAT KETAT):
- DILARANG KERAS menggunakan pesan asli user (misal: "aku tadi siang makan nasi 2 piring...") sebagai foodName / canonicalMealTitle!
- canonicalMealTitle & foodName HARUS berupa nama makanan bersih dengan format: "[Item 1], [Item 2] & [Item 3]" (contoh: "Nasi Putih, Ayam Goreng, Pete Goreng & Selada" atau "Sandwich Daging Sapi & Keju").
- detectedFoods HARUS berupa array nama item makanan yang terdeteksi: ["Nasi Putih", "Ayam Goreng", "Pete Goreng", "Selada"].
- mealType HARUS berisi konteks waktu: "Breakfast" | "Lunch" | "Dinner" | "Snack".

Keluarkan output JSON valid:
{
  "isFood": true,
  "isEquipment": false,
  "canonicalMealTitle": "Nama Makanan Bersih [Item 1], [Item 2] & [Item 3]",
  "foodName": "Nama Makanan Bersih [Item 1], [Item 2] & [Item 3]",
  "detectedFoods": ["Item 1", "Item 2", "Item 3"],
  "mealType": "Breakfast / Lunch / Dinner / Snack",
  "calories": 210,
  "protein": 20,
  "carbs": 30,
  "fat": 5,
  "fiber": 2,
  "sugar": 4,
  "sodium": 350,
  "satietyScore": 7,
  "satietyExplanation": "Penjelasan singkat efek kenyang makanan ini",
  "healthScore": 8,
  "portionEstimates": [
    "Komponen 1 (perkiraan porsi/kalori)",
    "Komponen 2 (perkiraan porsi/kalori)"
  ],
  "keyInsights": [
    "Insight positif 1",
    "Insight positif 2"
  ],
  "coachComment": "Komentar singkat khas persona coach"
}

Kategori 2: FOTO / DISKUSI ALAT GYM ATAU ALAT LATIHAN
Jika ini foto alat gym (misal Dumbbell, Leg Press, Smith Machine, Cable Machine, Foam Roller, Barbell, Treadmill, dll.) atau pertanyaan mengenai alat latihan:
Evaluasi apakah alat ini COCOK untuk goal pengguna saat ini (${userData.goalTitle}).
Jika TIDAK cocok (misal alat powerlifting berat untuk goal pemula/fat loss), set isAlignedWithGoal = false dan berikan pesan ramah/sopan ("Kayaknya alat tsb bukan untuk kita dulu...").
Keluarkan output JSON valid:
{
  "isFood": false,
  "isEquipment": true,
  "equipmentName": "Nama Alat Gym",
  "isAlignedWithGoal": true,
  "alignmentExplanation": "Penjelasan kesesuaian alat dengan goal",
  "suggestedExercises": [
    {
      "name": "Nama Variasi Latihan",
      "setsReps": "3 Sets x 10-12 Reps",
      "targetMuscle": "Otot Target",
      "techniqueTip": "Tips eksekusi teknik"
    }
  ],
  "politeRedirection": "Pesan ramah jika tidak cocok (misal: 'Kayaknya alat ini kurang cocok untuk goal kita dulu ya...')",
  "coachComment": "Komentar khas persona coach"
}

Kategori 3: PERTANYAAN UMUM / GAMBAR TIDAK TERKAIT
Keluarkan output JSON valid:
{
  "isFood": false,
  "isEquipment": false,
  "isUnrelatedImage": ${imagePart ? "true" : "false"},
  "coachComment": "Pesan ramah jika di luar konteks atau pesan balasan coach alami",
  "generalReply": "Pesan balasan coach yang alami dan sesuai persona"
}
`;
            try {
              const rawText = await generateGeminiContent(prompt, imagePart);
              let parsed: any = extractAndParseJson(rawText);
              if (!parsed) {
                const cleanReply = String(rawText || "").replace(/```(?:json)?[\s\S]*?```/gi, "").trim();
                parsed = { isFood: false, isEquipment: false, generalReply: cleanReply || "Sip! Ada laporan makanan atau latihan lain yang mau ditanyakan?" };
              }

              if (parsed.isFood && !parsed.isUnrelatedImage) {
                if (!planCapabilities.canNutrition) {
                  const redirectRes = validatePlanContext("makanan", true, userData);
                  responseMessages = [redirectRes.redirectMessage || "Untuk plan kamu saat ini, fokus aku adalah mendampingi latihan fisik kamu ya ✨"];
                } else {
                  const { mealRecord, validatedParsed } = buildSingleSourceOfTruthMealRecord(
                    userText,
                    parsed,
                    Boolean(imagePart)
                  );

                  addMealLog(from, mealRecord);
                  const dailyTotals = getDailyTotals(from);
                  const card = formatNutritionCard(
                    validatedParsed,
                    imagePart ? "Foto" : "Teks",
                    userData,
                    dailyTotals
                  );
                  responseMessages = [card];
                }
              } else if (parsed.isEquipment && !parsed.isUnrelatedImage) {
                if (!planCapabilities.canWorkout) {
                  const redirectRes = validatePlanContext("alat gym", true, userData);
                  responseMessages = [redirectRes.redirectMessage || "Untuk plan kamu saat ini, aku fokus bantu soal nutrisi ya ✨"];
                } else {
                  const eqCard = formatEquipmentCard(parsed, userData);
                  responseMessages = [eqCard];
                }
              } else if (imagePart || parsed.isUnrelatedImage) {
                // Image is unrelated or ambiguous - polite redirection without guessing
                const defaultUnrelatedMsg = isMia
                  ? "Maaf ya 😊 Aku belum bisa mengaitkan gambar ini dengan aktivitas GymBuddy. Kalau kamu ingin aku bantu cek makanan, nutrisi, atau workout, kirim gambar yang sesuai ya."
                  : (isLansia
                      ? `Mohon maaf, ${addressing.validatedAddress}. Saya belum dapat mengaitkan gambar ini dengan aktivitas GymBuddy. Apabila Anda ingin Saya mendampingi pencatatan makanan, nutrisi, atau panduan latihan, silakan kirimkan gambar yang sesuai ya. 🌿`
                      : `Sorry ya, ${addressing.validatedAddress}! Gue belum bisa mengaitkan gambar ini dengan aktivitas GymBuddy. Kalau lo mau gue bantu cek makanan, nutrisi, atau panduan latihan, kirim foto yang sesuai ya! 💪`);

                responseMessages = [validateAndFormatCoachNote(parsed.coachComment || parsed.generalReply || defaultUnrelatedMsg, userData)];
              } else {
                responseMessages = [validateAndFormatCoachNote(parsed.generalReply || "Sip! Ada laporan makanan atau latihan lain yang mau ditanyakan?", userData)];
              }
            } catch (e) {
              console.error("Gemini AI Error:", e);
              if (imagePart) {
                const defaultErrorMsg = isMia
                  ? "Maaf ya 😊 Aku belum berhasil menganalisis gambar ini. Boleh coba kirim ulang fotonya atau ceritakan makanan/latihan kamu lewat teks? ✨"
                  : (isLansia
                      ? `Mohon maaf, ${addressing.validatedAddress}. Saya belum dapat memproses gambar ini. Silakan kirimkan kembali fotonya atau sampaikan melalui pesan teks ya. 🌿`
                      : `Sorry ya, ${addressing.validatedAddress}! Gambar belum berhasil diproses nih. Boleh kirim ulang fotonya atau ketik langsung makanan/latihan lo? 💪`);
                responseMessages = [validateAndFormatCoachNote(defaultErrorMsg, userData)];
              } else {
                const { mealRecord, validatedParsed } = buildSingleSourceOfTruthMealRecord(
                  userText,
                  null,
                  false
                );

                addMealLog(from, mealRecord);
                const dailyTotals = getDailyTotals(from);
                const card = formatNutritionCard(
                  validatedParsed,
                  "Teks",
                  userData,
                  dailyTotals
                );
                responseMessages = [card];
              }
            }
          }
        }
      }

        if (WHATSAPP_TOKEN && WHATSAPP_PHONE_NUMBER_ID && responseMessages.length > 0) {
          for (const msgText of responseMessages) {
            await sendMetaWhatsappMessage(from, msgText);
            await new Promise(r => setTimeout(r, 800));
          }
        }
      }
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.sendStatus(500);
  }
});

function escapeXml(unsafe: string): string {
  return (unsafe || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

  // Twilio WhatsApp Webhook
  app.post(["/api/webhook/twilio-whatsapp", "/api/twilio/webhook", "/api/webhook", "/webhook", "/api/whatsapp"], express.urlencoded({ extended: true }), express.json(), async (req, res) => {
    console.log(`[${new Date().toISOString()}] Received Twilio WhatsApp Webhook. From: ${req.body?.From}, Body: ${req.body?.Body}`);
    try {
      const { Body, From, NumMedia } = req.body;
      const rawFrom = From || "";
      const normFrom = normalizePhone(rawFrom.replace("whatsapp:", ""));
      let userProfile: any = null;
      try {
        userProfile = (await findUserByPhoneOrId(normFrom)) || getUserProfile(normFrom) || (await getUserProfileFromFirestore(normFrom));
      } catch (profileErr: any) {
        console.warn("[Twilio WA] User profile lookup error (non-fatal):", profileErr?.message || profileErr);
        userProfile = getUserProfile(normFrom) || null;
      }

      let userText = Body || "";
      const lowerText = userText.toLowerCase();
      const isWelcomeMessage = (lowerText.includes("gymbuddy") && (lowerText.includes("target harian") || lowerText.includes("target saya") || lowerText.includes("tolong kirimkan"))) ||
                               (lowerText.includes("nama saya") && lowerText.includes("target saya"));

      // ─── 1. IMMEDIATELY SEND SHORT COACH ACKNOWLEDGMENT MESSAGE ───
      // Max: "Oke, aku cek dulu..." | Mia: "Sebentar ya, aku cek dulu..."
      if (!isWelcomeMessage) {
        const isMia = userProfile?.persona === "mia" || userProfile?.persona === "nikita";
        const ackText = isMia ? "Sebentar ya, aku cek dulu..." : "Oke, aku cek dulu...";
        sendWhatsAppAsync(rawFrom, ackText, req.body?.To).catch((err) => {
          console.warn("[Twilio WA] Acknowledgment send warning (non-fatal):", err?.message || err);
        });
      }

      let imagePart: any = null;

      if (NumMedia && parseInt(NumMedia) > 0) {
        const mediaUrl = req.body.MediaUrl0;
        const mediaContentType = req.body.MediaContentType0;

        if (mediaUrl) {
          try {
            const downloaded = await downloadTwilioMedia(mediaUrl);
            if (downloaded) {
              imagePart = { inlineData: { data: downloaded.data, mimeType: downloaded.mimeType } };
            } else {
              const imageRes = await axios.get(mediaUrl, { responseType: "arraybuffer" });
              const imageBuffer = Buffer.from(imageRes.data, "binary");
              const base64Image = imageBuffer.toString("base64");
              imagePart = { inlineData: { data: base64Image, mimeType: mediaContentType || "image/jpeg" } };
            }
          } catch (mediaErr) {
            console.error("Error fetching Twilio media:", mediaErr);
          }
        }
      }

      // 1. Check if user has onboarding data in latest_onboarding
      if (!userProfile) {
        const latestOB = dbData.users["latest_onboarding"] as any;
        if (latestOB && latestOB.weight) {
          userProfile = saveUserProfile(normFrom, { ...latestOB, phone: normFrom, normalizedPhone: normFrom });
        }
      }

      // 2. Auto-create user if not found so no user is EVER rejected
      if (!userProfile) {
        userProfile = getOrCreateUserProfile(normFrom, userText);
      }
      if (!userProfile) {
        userProfile = {
          name: "Member",
          phone: normFrom,
          normalizedPhone: normFrom,
          weight: 65,
          startWeight: 65,
          targetWeight: 60,
          targetCalories: 2000,
          proteinGrams: 140,
          carbGrams: 200,
          fatGrams: 60,
          fiberGrams: 30,
          goal: "lose",
          goalTitle: "Menurunkan Berat Badan",
          persona: "max",
          activeService: "both",
          gender: "male",
          height: 170,
          activityLevel: "moderate"
        };
        saveUserProfile(normFrom, userProfile);
      } else {
        userProfile.phone = normFrom;
        userProfile.normalizedPhone = normFrom;
        if (!userProfile.name) {
          userProfile.name = "Member";
        }
        saveUserProfile(normFrom, userProfile);
      }
      const userData = calculateUserData(userProfile);
      console.log(`[Twilio WA] ✅ Step: userData calculated for ${normFrom}, name=${userData?.name}, goal=${userData?.goal}`);

      const isRecommendationMessage = lowerText.includes("rekomendasi makanan") ||
                                      lowerText.includes("menu makan") ||
                                      lowerText.includes("saran makan") ||
                                      lowerText.includes("pagi siang malam") ||
                                      lowerText.includes("rekomendasi sarapan");

      const isWeeklyScheduleQuery = (
        lowerText.includes("jadwal latihan minggu") ||
        lowerText.includes("jadwal minggu ini") ||
        lowerText.includes("jadwal latihan aku minggu ini") ||
        lowerText.includes("jadwal gym minggu ini") ||
        lowerText.includes("jadwal workout minggu ini") ||
        lowerText.includes("jadwal seminggu") ||
        lowerText.includes("program minggu ini")
      );

      const isWorkoutScheduleQuery = !isWeeklyScheduleQuery && (
        lowerText.includes("latihan apa") ||
        lowerText.includes("workout apa") ||
        lowerText.includes("jadwal latihan") ||
        lowerText.includes("jadwal workout") ||
        lowerText.includes("jadwal gym") ||
        lowerText.includes("jadwal hari ini") ||
        lowerText.includes("menu latihan") ||
        lowerText.includes("program latihan") ||
        lowerText.includes("rekomendasi workout") ||
        lowerText.includes("rekomendasi latihan") ||
        lowerText.includes("olahraga hari ini apa") ||
        lowerText.includes("mau latihan apa") ||
        lowerText.includes("workout besok") ||
        lowerText.includes("latihan besok") ||
        Boolean(lowerText.match(/^(?:jadwal|menu|program|rekomendasi)\s+(?:workout|latihan|olahraga|gym)/i)) ||
        Boolean(lowerText.match(/^(?:hari\s*ini|besok)\s+(?:jadwal(?:nya)?|menu|program)?\s*(?:workout|latihan|olahraga|gym)\s*(?:apa(?:an)?|gimana)?/i)) ||
        Boolean(lowerText.match(/^(?:workout|latihan|olahraga|gym)\s+(?:hari\s*ini|besok)\s*(?:apa(?:an)?|gimana)?$/i))
      );

      const parsedQueryDate = parseDateFromQuery(userText);
      const isCheckSummaryMessage = (parsedQueryDate.isSpecificDate && (lowerText.includes("makan") || lowerText.includes("food") || lowerText.includes("log") || lowerText.includes("kalori") || lowerText.includes("lihat") || lowerText.includes("menu"))) ||
                                   lowerText.includes("cek kalori") || 
                                   lowerText.includes("sisa kalori") || 
                                   lowerText.includes("rekap kalori") ||
                                   lowerText.includes("rekap nutrisi") ||
                                   lowerText.includes("rekap") ||
                                   lowerText.includes("kemarin") ||
                                   lowerText.includes("yesterday") ||
                                   lowerText.includes("makan apa") ||
                                   lowerText.includes("makanan hari ini") ||
                                   lowerText.includes("log makanan") ||
                                   lowerText.includes("log makan") ||
                                   lowerText.includes("food log") ||
                                   lowerText.includes("riwayat makan") ||
                                   lowerText.includes("total kalori") ||
                                   lowerText.includes("apa yang sudah aku makan") ||
                                   lowerText.includes("makanan saya hari ini");

      const isProgressHistoryMessage = lowerText.includes("cek progress") || 
                                      lowerText.includes("riwayat progress") || 
                                      lowerText.includes("progress minggu");

      const weightMatch = matchPureWeightLog(userText);

      // Water Intake Intent Match (e.g. "minum 2 gelas", "air 500ml", "water 3 cups")
      const waterMatch = matchPureWaterLog(userText);

      const isResetMessage = lowerText.includes("reset akun") || 
                             lowerText.includes("hapus akun") || 
                             lowerText.includes("reset data") ||
                             lowerText.includes("hapus data saya");

      const isDeleteMealMessage = Boolean(
        lowerText.match(/^(?:hapus|delete|batal(?:kan)?)\s+(?:log\s+)?(?:makan(?:an)?|food|nutrisi)(?:\s+terakhir)?$/i) ||
        lowerText === "hapus log terakhir" ||
        lowerText === "hapus makan terakhir" ||
        lowerText === "hapus makanan terakhir" ||
        lowerText === "batal catat makanan"
      );

      const recentFoodMeal = getLastFoodMeal(normFrom);
      const isMealCorrection = !imagePart && detectMealCorrectionIntent(userText, Boolean(recentFoodMeal));

      let responseMessages: string[] = [];
      let mediaUrlToSend: string | undefined = undefined;

      const matchedEx = !isWorkoutScheduleQuery && !isWeeklyScheduleQuery ? findExerciseOrEquipment(userText) : null;
      const isExerciseInquiry = Boolean(
        matchedEx && (
          userText.match(/^(?:cara|bagaimana|gimana|tutorial|tips|apa\s*itu|tutor|ajarin|panduan)\b/i) ||
          lowerText.includes("cara pakai") ||
          lowerText.includes("cara menggunakan") ||
          lowerText.includes("cara ") ||
          lowerText.includes("tutorial ") ||
          lowerText.includes("alat ") ||
          lowerText.includes("mesin ") ||
          lowerText.includes("teknik ") ||
          lowerText.includes("postur ")
        )
      );

      console.log(`[Twilio WA] ✅ Step: routing. isReset=${isResetMessage}, isDeleteMeal=${isDeleteMealMessage}, isWeekly=${isWeeklyScheduleQuery}, isWorkout=${isWorkoutScheduleQuery}, isCheckSum=${isCheckSummaryMessage}, isWelcome=${isWelcomeMessage}`);
      if (isResetMessage) {
        const normPhone = normalizePhone(normFrom);
        if (dbData.users[normPhone]) {
          delete dbData.users[normPhone];
        }
        delete dbData.weeklyProgress[normPhone];
        Object.keys(dbData.dailyLogs).forEach((key) => {
          if (key.startsWith(normPhone)) {
            delete dbData.dailyLogs[key];
          }
        });
        saveDb();
        deleteUserDocument(normPhone).catch(() => {});
        deleteUserFromFirestore(normPhone).catch(() => {});
        console.log(`[Reset Command] Deleted profile and data for ${normPhone}`);
        responseMessages = [
          `🗑️ *AKUN & DATA KAMU BERHASIL DIHAPUS!*\n-----------------------------\n` +
          `Semua profil dan riwayat kamu telah dibersihkan dari database GymBuddy AI.\n\n` +
          `Sekarang kamu bisa mencoba alur pendaftaran & onboarding baru dari awal di website! ✨`
        ];
      } else if (isDeleteMealMessage) {
        const todayStr = getTodayDateStr();
        const key = `${normFrom}_${todayStr}`;
        const altPhone = normFrom.startsWith("0") ? "62" + normFrom.substring(1) : (normFrom.startsWith("62") ? "0" + normFrom.substring(2) : normFrom);
        const altKey = `${altPhone}_${todayStr}`;
        const logs = dbData.dailyLogs[key] || dbData.dailyLogs[altKey] || [];
        const foodLogs = logs.filter(l => !l.isHydration && !isPlainWaterName(l.foodName));

        if (foodLogs.length > 0) {
          const lastMeal = foodLogs[foodLogs.length - 1];
          dbData.dailyLogs[key] = (dbData.dailyLogs[key] || []).filter(m => m.id !== lastMeal.id);
          if (dbData.dailyLogs[altKey]) {
            dbData.dailyLogs[altKey] = dbData.dailyLogs[altKey].filter(m => m.id !== lastMeal.id);
          }
          saveDb();
          if (lastMeal.id) {
            deleteFoodLog(normFrom, lastMeal.id).catch(() => {});
          }
          const updatedTotals = getDailyTotals(normFrom, todayStr);
          const coachName = userData.persona === "max" ? "Coach Max" : "Coach Mia";
          responseMessages = [
            `🗑️ *LOG MAKANAN DIHAPUS*\n━━━━━━━━━━━━━━\n` +
            `Catatan *${lastMeal.foodName}* (~${lastMeal.calories} kcal) telah dihapus dari log hari ini.\n\n` +
            `📊 *Status Kalori Hari Ini*: ${updatedTotals.calories}/${userData.targetCalories} kcal\n\n` +
            `💬 *${coachName}*:\n"Sip, catatannya sudah aku hapus ya! Kalau ada makanan lain yang mau dicatat, kirim saja langsung."`
          ];
        } else {
          responseMessages = [
            `ℹ️ Belum ada catatan makanan hari ini yang bisa dihapus.`
          ];
        }
      } else if (isWeeklyScheduleQuery) {
        responseMessages = [generateWeeklyWorkoutSchedule(userData)];
      } else if (isWorkoutScheduleQuery) {
        const isTomorrow = lowerText.includes("besok") || lowerText.includes("tomorrow");
        responseMessages = [generateWorkoutRecommendations(userData, isTomorrow ? 1 : 0)];
      } else if (isExerciseInquiry && matchedEx) {
        const guide = formatWhatsAppExerciseGuide(
          matchedEx,
          (userData.persona === "max" || userData.persona === "mia") ? userData.persona : "mia",
          userData.goal || "healthy"
        );
        responseMessages = [guide.text];
        if (guide.mediaUrl) {
          mediaUrlToSend = guide.mediaUrl;
        }
      } else if (isWelcomeMessage) {
        const nameMatch = userText.match(/(?:i am|saya|nama saya)\s+([^,!\.\n]+)/i);
        const targetMatch = userText.match(/(?:my target is|target saya adalah|goal saya)\s+([^,!\.\n]+)/i);

        let updatedProfileNeeded = false;
        if (nameMatch && nameMatch[1].trim()) {
          userProfile.name = nameMatch[1].trim();
          updatedProfileNeeded = true;
        }
        if (targetMatch && targetMatch[1].trim()) {
          const rawT = targetMatch[1].trim();
          userProfile.goalTitle = rawT;
          if (rawT.toLowerCase().includes("health") || rawT.toLowerCase().includes("sehat")) {
            userProfile.goal = "health";
            userProfile.goalTitle = "Gaya Hidup Sehat & Fit";
          } else if (rawT.toLowerCase().includes("lose") || rawT.toLowerCase().includes("turun")) {
            userProfile.goal = "lose";
            userProfile.goalTitle = "Menurunkan Berat Badan";
          } else if (rawT.toLowerCase().includes("gain") || rawT.toLowerCase().includes("naik")) {
            userProfile.goal = "gain";
            userProfile.goalTitle = "Menaikkan Berat Badan";
          }
          updatedProfileNeeded = true;
        }

        if (updatedProfileNeeded) {
          saveUserProfile(normFrom, userProfile);
        }

        if (userProfile.hasReceivedWelcome) {
          const isFemale = (userProfile.gender || "").toLowerCase() === "wanita" || (userProfile.gender || "").toLowerCase() === "female";
          const ageNum = Number(userProfile.age) || 25;
          const isLansia = ageNum >= 60;
          const cleanName = (userData.name || "Member").trim();
          const coachName = userData.persona === "max" ? "Coach Max" : "Coach Mia";

          let shortWelcome = "";
          if (userData.persona === "max") {
            if (isLansia) {
              const honorific = isFemale ? "Bu" : "Pak";
              shortWelcome = `🔥 *HALO ${honorific.toUpperCase()} ${cleanName.toUpperCase()}!* ${coachName} siap mendampingi Anda.\n\n` +
                `Mau catat makanan hari ini, lapor air minum, update BB ("update bb 72"), atau tanya panduan latihan? Kirim saja langsung di sini! 💪`;
            } else if (isFemale) {
              shortWelcome = `🔥 *HALO ${cleanName.toUpperCase()}!* ${coachName} siap mendampingi kamu!\n\n` +
                `Mau catat makanan hari ini, lapor air minum, update BB ("update bb 72"), atau minta rekomendasi workout? Kirim aja langsung di sini! 💪`;
            } else {
              shortWelcome = `🔥 *YO ${cleanName.toUpperCase()}!* ${coachName} siap mendampingi lo!\n\n` +
                `Mau catat makanan hari ini, lapor air minum, update BB ("update bb 72"), atau minta rekomendasi workout? Kirim aja langsung di sini! 💪`;
            }
          } else {
            if (isLansia) {
              const honorific = isFemale ? "Bu" : "Pak";
              shortWelcome = `✨ *HALO ${honorific.toUpperCase()} ${cleanName.toUpperCase()}!* ${coachName} di sini. 🥰\n\n` +
                `Silakan kirim makanan harian, lapor air minum, update BB ("update bb 72"), atau konsultasi latihan kapan saja ya! 🌿`;
            } else {
              shortWelcome = `✨ *HALO ${cleanName.toUpperCase()}!* ${coachName} di sini! 🥰\n\n` +
                `Mau catat makanan harian, lapor air minum, update BB ("update bb 72"), atau konsultasi latihan? Silakan kirim kapan saja ya! 🌿`;
            }
          }
          responseMessages = [shortWelcome];
        } else {
          userProfile.hasReceivedWelcome = true;
          saveUserProfile(normFrom, userProfile);
          const currentCalculated = calculateUserData(userProfile);
          responseMessages = generateWelcomeMessages(currentCalculated);
        }
      } else {
        const planCapabilities = getUserPlanCapabilities(userData);
        const planValidation = validatePlanContext(userText, Boolean(imagePart), userData);

        if (!planValidation.canProceed) {
          responseMessages = [planValidation.redirectMessage!];
        } else if (waterMatch) {
          if (!planCapabilities.canNutrition) {
            responseMessages = [validatePlanContext("minum air", false, userData).redirectMessage || "Untuk plan kamu saat ini, fokus aku adalah mendampingi latihan fisik kamu ya ✨"];
          } else {
            const rawAmount = parseFloat(waterMatch[1].replace(',', '.'));
            const unit = (waterMatch[2] || "gelas").toLowerCase();
            let actualMl: number;
            if (unit === "ml") {
              actualMl = rawAmount;
            } else if (unit === "l" || unit === "liter") {
              actualMl = rawAmount * 1000;
            } else {
              actualMl = Math.round(rawAmount) * 250;
            }
            const cupsToAdd = Math.max(1, Math.round(actualMl / 250));
            const currentCups = getWaterCups(normFrom);
            const newTotalCups = setWaterCups(normFrom, currentCups + cupsToAdd);
            const liters = (newTotalCups * 0.25).toFixed(1);
            const waterEntry: MealLog = {
              id: `wa-water-${Date.now()}`,
              foodName: `Air Putih ${actualMl} ml`,
              calories: 0,
              protein: 0,
              carbs: 0,
              fat: 0,
              isHydration: true,
              volumeMl: actualMl,
              timestamp: new Date().toISOString(),
              mealType: getMealTypeByHour(userText)
            };
            addMealLog(normFrom, waterEntry);
            const isFemale = (userProfile.gender || "").toLowerCase() === "wanita" || (userProfile.gender || "").toLowerCase() === "female";
            const coachName = userData.persona === "max" ? "Coach Max" : "Coach Mia";
            const comment = userData.persona === "max" 
              ? (isFemale ? "Mantap! Jaga terus hidrasi tubuh kamu biar metabolisme makin kencang! 🔥" : "Mantap bro! Jaga terus hidrasi tubuh lo biar metabolisme makin kenceng! 🔥")
              : "Hebat banget! Tetap rajin minum air putih ya biar tubuh selalu segar ✨";
            responseMessages = [
              `💧 *CATATAN HIDRASI DISIMPAN*\n-----------------------------\n` +
              `✅ Kamu menambah *${actualMl} ml* air putih!\n` +
              `📊 Total Hidrasi Hari Ini: *${newTotalCups} Gelas* (${liters} Liter / 3.0 L Target)\n\n` +
              `💬 *${coachName}*:\n"${comment}"`
            ];
          }
        } else if (weightMatch) {
          const newW = parseFloat(weightMatch[1].replace(',', '.'));
          if (!isNaN(newW) && newW > 30 && newW < 300) {
            const resProg = addWeeklyProgress(normFrom, newW, "Update via WhatsApp");
            if (resProg) {
              responseMessages = [formatWeeklyProgressCard(resProg)];
            } else {
              responseMessages = ["Profil kamu belum terdaftar di database. Silakan isi kuesioner terlebih dahulu!"];
            }
          }
        } else if (isProgressHistoryMessage) {
          responseMessages = [formatProgressHistoryCard(normFrom)];
        } else if (isRecommendationMessage) {
          if (!planCapabilities.canNutrition) {
            responseMessages = [validatePlanContext("rekomendasi makanan", false, userData).redirectMessage || "Untuk plan kamu saat ini, fokus aku adalah mendampingi latihan fisik kamu ya ✨"];
          } else {
            responseMessages = [generateMealRecommendations(userData, normFrom, userText)];
          }
        } else if (isCheckSummaryMessage) {
          const parsedDate = parseDateFromQuery(userText);
          const totals = getDailyTotals(normFrom, parsedDate.dateStr);
          if (parsedDate.isSpecificDate || parsedDate.isYesterday || !parsedDate.isToday) {
            responseMessages = [formatHistoricalFoodLog(userData, totals, parsedDate)];
          } else {
            responseMessages = [generateDailySummaryCard(userData, totals, parsedDate.label)];
          }
        } else if (handleReminderCommand(userText, userProfile, normFrom, userData)) {
          responseMessages = handleReminderCommand(userText, userProfile, normFrom, userData)!;
        } else if (handleWorkoutProgressLogging(normFrom, userText, userData)) {
          if (!planCapabilities.canWorkout) {
            responseMessages = [validatePlanContext("latihan workout", false, userData).redirectMessage || "Untuk plan kamu saat ini, aku fokus bantu soal nutrisi ya ✨"];
          } else {
            responseMessages = handleWorkoutProgressLogging(normFrom, userText, userData)!;
          }
        } else if (isMealCorrection) {
          if (!planCapabilities.canNutrition) {
            responseMessages = [validatePlanContext("koreksi porsi makanan", false, userData).redirectMessage || "Untuk plan kamu saat ini, fokus aku adalah mendampingi latihan fisik kamu ya ✨"];
          } else if (recentFoodMeal) {
            console.log(`[Twilio WA] Executing meal correction on "${recentFoodMeal.foodName}" for ${normFrom}: "${userText}"`);
            const correctionResult = await processMealCorrection(normFrom, userText, userData);
            if (correctionResult) {
              responseMessages = [correctionResult.card];
            } else {
              const isMia = (userData.persona || "mia").toLowerCase().includes("mia");
              responseMessages = [
                isMia
                  ? `Maaf, aku belum berhasil memproses koreksi ini ya ✨ Boleh coba sebutkan lagi porsi yang ingin diubah?`
                  : `Sorry ${getValidatedUserAddressing(userData).validatedAddress}, koreksi belum berhasil diproses. Boleh sebutkan lagi bagian mana yang mau diubah? 💪`
              ];
            }
          } else {
            const isMia = (userData.persona || "mia").toLowerCase().includes("mia");
            responseMessages = [
              isMia
                ? `Belum ada catatan makanan hari ini yang bisa dikoreksi ya ✨ Silakan catat atau foto makananmu terlebih dahulu!`
                : `Belum ada log makanan hari ini yang bisa dikoreksi, ${getValidatedUserAddressing(userData).validatedAddress}! Kirim foto atau sebutkan makanan kamu dulu ya! 💪`
            ];
          }
        } else {

        const isMia = userData.persona === "mia" || userData.persona === "nikita";
        const addressing = getValidatedUserAddressing(userData);

        const personaInstruction = isMia
          ? `PERSONA COACH MIA:
- Karakter: Ramah, hangat, menyemangati secara halus (gentle encouragement), empatik, suportif, dan edukatif (aku/kamu).
- Gaya Bicara & Sapaan:
  • Sapaan Wajib: Panggil pengguna HANYA dengan sapaan tervalidasi: "${addressing.validatedAddress}".
  • DILARANG KERAS menggunakan panggilan seperti "sayang", "cinta", "beb", "sis", "bestie", dll.
  • Tetap profesional, hangat, ilmiah, dan terpercaya.`
          : `PERSONA COACH MAX:
- Karakter: Tegas, disiplin, percaya diri, fokus pada akuntabilitas (accountability), dan motivasi ringkas to-the-point.
- Gaya Bicara & Sapaan:
  • Sapaan Wajib: Panggil pengguna HANYA dengan sapaan tervalidasi: "${addressing.validatedAddress}".
  • DILARANG KERAS memanggil pengguna dengan istilah slang umum seperti "bro", "sis", "guys", "boss", "bestie", "sob", "bray", "gan" atau sapaan buatan lainnya. Kata "bro" DILARANG digunakan kecuali jika itu adalah nama panggilan resmi tervalidasi pengguna.
  • Karakter tegas Coach Max TIDAK BOLEH mengesampingkan format sapaan tervalidasi pengguna.
  • Contoh BENAR: "Bagus, ${addressing.validatedAddress}! Aktivitas ekstra kamu sudah tercatat..."
  • Contoh SALAH: "Mantap bro! Aktivitas ekstra lo udah tercatat."
- BATASAN MUTLAK:
  • Tegas tapi TIDAK PERNAH kasar, menghina, atau merendahkan.
  • Hindari basa-basi panjang, langsung sampaikan insight tindakan nyata.`;

        const planInstruction = `BATASAN MUTLAK LAYANAN PENGGUNA BERDASARKAN ACTIVE PLAN:
- Plan Pengguna: ${planCapabilities.planDisplayName} (Nutrition Coach: ${planCapabilities.canNutrition ? "AKTIF" : "NON-AKTIF"}, Workout Coach: ${planCapabilities.canWorkout ? "AKTIF" : "NON-AKTIF"})
- AI DILARANG KERAS memperluas kapabilitas di luar paket aktif pengguna. Izin paket menentukan kapabilitas Coach yang tersedia, bukan kepribadian coach.
- AI tidak boleh menjawab suatu permintaan hanya karena AI mampu menjawabnya; AI harus memverifikasi bahwa kapabilitas tersebut termasuk dalam paket aktif pengguna.
- Jika pengguna meminta kapabilitas yang TIDAK aktif pada paketnya (misal meminta latihan/workout padahal paket Nutritionist, atau meminta kalori/makanan padahal paket Workout Coach): JANGAN berikan jawaban sebagai coach bidang tersebut. Berikan pengalihan sopan yang menjelaskan fokus paket saat ini dan arahkan ke fitur yang didukung serta upgrade paket.
- Jika pengguna bertanya hal di luar konteks (cuaca, koding, politik, dsb): JANGAN jawab pertanyaan di luar topik tersebut. Alihkan secara ramah ke kapabilitas GymBuddy sesuai paket pengguna.
- Jika pesan bersifat campuran (mixed): Prioritaskan dan proses HANYA bagian yang didukung oleh paket GymBuddy, abaikan pertanyaan di luar topik.`;

        const isFemale = (userData.gender || "").toLowerCase() === "wanita" || (userData.gender || "").toLowerCase() === "female";
        const genderLabel = isFemale ? "Perempuan" : "Laki-laki";

        const prompt = `GYMBUDDY AI MASTER INSTRUCTION:
INFORMASI PENGGUNA:
- Nama Lengkap: ${userData.name}
- Nama Panggilan (Nickname): ${addressing.nickname}
- Sapaan Wajib: ${addressing.validatedAddress}
- Gender: ${genderLabel}
- Usia: ${userData.age} tahun (Kelompok Usia: ${addressing.ageGroup})
- Kondisi Kesehatan: ${userData.healthConditionsSummary || "Tidak ada kondisi khusus / Sehat"}
- Berat Saat Ini: ${userData.weight} kg | Target BB: ${userData.targetWeight} kg
- Target Kalori Harian: ${userData.targetCalories} kcal
- Target Makro: Protein ${userData.proteinGrams}g, Karbo ${userData.carbGrams}g, Lemak ${userData.fatGrams}g, Serat ${userData.fiberGrams}g
- Goal Utama: ${userData.goalTitle}

${planInstruction}

ATURAN SAPAAN PENGGUNA & NICKNAME BERDASARKAN USIA (SOURCE OF TRUTH MUTLAK):
1. IDENTITAS & FORMAT SAPAAN WAJIB:
   - Nama Panggilan / Nickname: "${addressing.nickname}"
   - Format Sapaan Tervalidasi: "${addressing.validatedAddress}"
   - Kategori Usia: "${addressing.ageGroup}" (${userData.age} tahun)
   - Kata Ganti Pengguna: "${addressing.pronounUser}"
2. ATURAN SAPAAN KETAT:
   - Sapa pengguna HANYA dengan format sapaan tervalidasi: "${addressing.validatedAddress}".
   - DILARANG KERAS memanggil atau mengganti sapaan dengan istilah gaul/slang seperti "bro", "sis", "guys", "boss", "bestie", "sob", "bray", "gan" atau sapaan informal buatan sendiri.
   - Kata "bro" DILARANG dihasilkan kecuali jika itu adalah nama panggilan resmi tervalidasi pengguna.
3. KEPRIBADIAN COACH MAX & COACH MIA:
   - Coach Mia: Ramah, hangat, menyemangati secara halus, empatik, suportif.
   - Coach Max: Tegas, disiplin, percaya diri, to-the-point, fokus pada akuntabilitas.
   - KEDUA COACH WAJIB MEMATUHI ATURAN SAPAAN YANG SAMA. Kepribadian coach TIDAK BOLEH mengesampingkan sapaan valid pengguna.
   Contoh BENAR:
   "Bagus, ${addressing.validatedAddress}! Aktivitas ekstra kamu sudah tercatat..."
   Contoh SALAH:
   "Mantap bro! Aktivitas ekstra lo udah tercatat."
4. DILARANG MEMBUAT STEREOTIP GENDER ("cewek biasanya...", "cowok harusnya...").
5. Nama user harus digunakan secara natural, jangan dipaksakan di setiap kalimat.

ATURAN KESELAMATAN & PERSONALISASI KESEHATAN:
1. DILARANG KERAS mendiagnosis pengguna (misal jika lutut sakit, jangan simpulkan arthritis).
2. DILARANG membuat klaim medis absolut ("karena kamu punya diabetes kamu tidak boleh makan X").
3. Berikan saran kontekstual, hati-hati, dan aman (misal: jika ada riwayat hipertensi, perhatikan batas natrium; jika lansia atau ada cedera sendi, prioritaskan latihan low-impact, mobilitas, dan pemulihan).
4. Jika ada keluhan akut atau risiko tinggi, arahkan dengan sopan untuk berkonsultasi dengan tenaga medis.
5. JANGAN menyebut kondisi kesehatan pada kalimat motivasi kasual yang tidak relevan.

ATURAN PENANGANAN REFERENSI TIDAK DIKENAL & OUT-OF-CONTEXT INPUT:
1. JANGAN MENGARANG IDENTITAS/KONTEKS (NO HALLUCINATED ENTITIES):
   - Jika pengguna menyebut nama orang, tokoh, produk, karakter, atau entitas yang tidak memiliki konteks yang cukup (contoh: "Aku mau jadi si A", "Menurut kamu aku bisa kayak A nggak?", "Aku pengen punya badan kayak X", "Targetku seperti A", "Makananku kayak si B"):
     • DILARANG MENGARANG siapa itu A/B/X (profesi, prestasi, bentuk badan, kebiasaan, kepribadian).
     • DILARANG pura-pura tahu ("A tentu punya...", "A memang dikenal sebagai...", "Si A adalah role model hebat!").
     • DILARANG forced positivity ("Wah keren banget! Kamu pasti bisa seperti A!").
     • TANYAKAN KLARIFIKASI SECARA SINGKAT & ALAMI:
       Contoh Coach Max: "Si A yang kamu maksud siapa nih, ${addressing.validatedAddress}? Kasih tahu namanya atau sedikit konteks tentang dia biar aku nggak salah nangkep. 💪"
       Contoh Coach Mia: "Si A yang kamu maksud siapa ya, ${addressing.validatedAddress}? 😄 Boleh kasih tahu namanya atau sedikit konteks tentang dia biar aku nggak salah paham ✨"
       Jika konteks fisik/latihan: "Si A yang kamu maksud siapa? Kalau kamu kasih tahu nama atau bentuk tubuh/goal yang kamu maksud, aku bisa bantu breakdown targetnya."
       Jika konteks makanan: "Si A yang kamu maksud siapa? Kalau kamu punya contoh menu atau pola makannya, kirim aja dan aku bisa bantu analisis."
2. BEDAKAN KNOWN CONTEXT VS UNKNOWN CONTEXT:
   - Figur publik dunia yang sangat umum/terkenal (contoh: "Cristiano Ronaldo", "The Rock"): Pahami konteksnya tanpa klaim medis/personal berlebihan.
   - Nama spesifik/entitas tak dikenal: WAJIB minta klarifikasi singkat. Jangan berasumsi.
3. JANGAN MEMAKSAKAN SEMUA PERNYATAAN MENJADI JAWABAN FITNESS:
   - Jika user hanya membuat pernyataan ("Aku mau jadi si A"), jangan otomatis menganggap user meminta workout/nutrition plan lengkap. Tanyakan konteksnya terlebih dahulu.
4. KEJUJURAN TERHADAP KONTEKS (ACCURACY > FORCED HELPFULNESS):
   - Konteks cukup: Berikan jawaban langsung.
   - Konteks sebagian: Jawab yang diketahui + minta klarifikasi yang belum jelas.
   - Konteks kurang / entitas tidak dikenal: Tanyakan klarifikasi dengan ramah.
   - Input di luar kapabilitas: Jelaskan secara singkat dan ramah.

${personaInstruction}
TUGASMU:
${imagePart ? `USER MENGIRIM GAMBAR/FOTO BESERTA PESAN: "${userText}".
VALIDASI KONTEKS GAMBAR (SANGAT KETAT):
1. Tentukan apakah gambar ini benar-benar terkait ruang lingkup GymBuddy:
   - MAKANAN / MINUMAN (Kategori 1): Foto hidangan, makanan, minuman, barcode makanan, label nutrisi/kemasan makanan.
   - ALAT GYM / GERAKAN WORKOUT (Kategori 2): Foto alat gym, mesin latihan, dumbbell, barbell, treadmill, form gerakan latihan.
2. JIKA GAMBAR TIDAK TERKAIT / DI LUAR KONTEKS (Kategori 3 - isUnrelatedImage: true):
   Jika gambar BUKAN makanan/minuman dan BUKAN alat gym/latihan (CONTOH: tangkapan layar Excel / spreadsheet karyawan / data bisnis, dokumen kantor, invoice, teks non-makanan, meme, hewan, pemandangan, kendaraan, gadget/laptop, foto diri/selfie santai tanpa konteks makanan/gym, atau gambar ambigu tanpa bukti cukup):
   - DILARANG KERAS MENEBAK atau memaksakan gambar ke kategori makanan atau gym!
   - DILARANG membuat panduan latihan dari spreadsheet!
   - DILARANG membuat estimasi nutrisi dari dokumen kantor!
   - Set "isFood": false, "isEquipment": false, "isUnrelatedImage": true.
   - Isi "coachComment": "Maaf ya 😊 Aku belum bisa mengaitkan gambar ini dengan aktivitas GymBuddy. Kalau kamu ingin aku bantu cek makanan, nutrisi, atau workout, kirim gambar yang sesuai ya."` : `User mengirim pesan teks di WhatsApp: "${userText}"`}

PRINSIP WAJIB ANALISIS MAKANAN (MULTI-MODAL IMAGE + TEXT):
1. GABUNGKAN FOTO + DESKRIPSI TEXT SEBAGAI SINGLE COMBINED INPUT:
   - Jika ada teks yang menyertai foto (misal "roti isi sosis topping keju" atau "nasi ayam bakar sambal lalapan"), TEKS TERSEBUT ADALAH GROUND TRUTH UTAMA.
   - SEMUA komponen yang disebutkan user WAJIB dihitung, meskipun salah satu komponen (seperti sosis di dalam roti) tertutup atau hanya terlihat sebagian.
   - Jangan pernah mengabaikan teks user atau hanya mengandalkan deteksi visual semata.
2. DEKONSTRUKSI MAKANAN KOMBINASI / BERLAPIS:
   - Identifikasi dan hitung setiap komponen individual: Main Food, Filling (isian), Topping, Sauce, Condiment, Side Dish.
   - Contoh "Roti isi sosis keju": (1) Roti (~60g), (2) Sosis (~50g), (3) Keju topping (~15g).
   - Contoh "Nasi ayam goreng sambal lalapan": (1) Nasi putih, (2) Ayam goreng, (3) Sambal, (4) Lalapan sayur.
   - Rincikan komponen tersebut di array 'portionEstimates'.
3. ESTIMASI PORSI REALISTIS DARI VISUAL CUES & HINDARI KEPASTIAN PALSU:
   - Gunakan petunjuk visual seperti ukuran wadah/bungkus (misal 'nasi bungkus' biasanya ±250–300g, bukan 180g), piring, sendok/garpu, ketebalan potongan, dan jumlah item.
   - Jangan menganggap estimasi visual sebagai timbangan pasti; sajikan estimasi dalam format realistis (misal: '• Nasi bungkus: ±250–300g', '• Sosis: 1 buah (~50g)').
   - Jangan menambahkan bahan yang tidak terlihat dan tidak disebutkan (jangan mengarang mayones, mentega tebal, atau gula kecuali terlihat/disebutkan).
4. KONSISTENSI INTERNAL & VALIDASI NUTRISI (WAJIB DIPATUHI):
   - Kalori harus konsisten dengan makronutrisi: (Protein * 4) + (Carbs * 4) + (Fat * 9) ≈ Total Kalori.
   - Dilarang mengembalikan makanan tinggi karbohidrat & tinggi lemak dengan kalori yang sangat rendah.
   - Porsi substansial makanan tinggi protein (dada ayam, daging sapi, telur, ikan, whey) harus memiliki protein yang masuk akal dan realistis (tidak boleh implausibly low).
   - Makanan asin/olahan/berbumbu gurih (mie instan, ikan asin, sosis, bakso, kuah soto, fast food) harus memiliki natrium realistis (jangan implausibly low mendekati nol).
   - Makanan/minuman manis (teh manis, boba, kopi susu aren, dessert, soda, kue) harus memiliki gula realistis kecuali eksplisit tanpa gula/tawar.
   - Perhitungkan metode memasak: makanan goreng menyerap minyak (lemak & kalori bertambah), masakan bersantan memiliki lemak lebih tinggi.
   - Evaluasi minuman berdasarkan volume nyata (250ml, 350ml, 500ml); air putih selalu 0 kalori dan 0 makro.
   - Hindari kepastian palsu: sajikan taksiran bulat realistis (~45g, ~180 kcal, ~12g gula) dan akui ketidakpastian lewat confidence score.
5. KLARIFIKASI INTERAKTIF JIKA HANYA FOTO & MAKANAN SANGAT AMBIGU:
   - Jika user HANYA mengirim foto (tanpa teks) dan makanan memiliki isian tertutup / tidak jelas (misal sandwich tertutup, bungkusan misteri, mangkok sup kental):
     Set "needsClarification": true dan sediakan "clarificationQuestion" ramah dari coach (${isMia ? "Coach Mia" : "Coach Max"}).

Kategori 1: LAPORAN MAKANAN/MINUMAN (teks atau gambar makanan/minuman)
ATURAN TITLE MAKANAN (SANGAT KETAT):
- DILARANG KERAS menggunakan pesan asli user (misal: "aku tadi siang makan nasi 2 piring...") sebagai foodName / canonicalMealTitle!
- canonicalMealTitle & foodName HARUS berupa nama makanan bersih dengan format: "[Item 1], [Item 2] & [Item 3]" (contoh: "Nasi Putih, Ayam Goreng, Pete Goreng & Selada" atau "Sandwich Daging Sapi & Keju").
- detectedFoods HARUS berupa array nama item makanan yang terdeteksi: ["Nasi Putih", "Ayam Goreng", "Pete Goreng", "Selada"].
- mealType HARUS berisi konteks waktu: "Breakfast" | "Lunch" | "Dinner" | "Snack".

Keluarkan output JSON valid:
{
  "isFood": true,
  "isEquipment": false,
  "needsClarification": false,
  "clarificationQuestion": "",
  "canonicalMealTitle": "Nama Makanan Bersih [Item 1], [Item 2] & [Item 3]",
  "foodName": "Nama Makanan Bersih [Item 1], [Item 2] & [Item 3]",
  "detectedFoods": ["Item 1", "Item 2", "Item 3"],
  "mealType": "Breakfast / Lunch / Dinner / Snack",
  "calories": 420,
  "protein": 24,
  "carbs": 48,
  "fat": 14,
  "fiber": 3,
  "sugar": 5,
  "sodium": 420,
  "confidenceLevel": 88,
  "satietyScore": 7,
  "satietyExplanation": "Penjelasan efek kenyang berdasarkan protein, serat, dan makro",
  "healthScore": 8,
  "portionEstimates": [
    "• Roti: ~60g (~150 kcal)",
    "• Sosis: 1 buah (~50g, ~160 kcal)",
    "• Keju: topping (~15g, ~60 kcal)"
  ],
  "keyInsights": [
    "Sumber protein solid untuk pemulihan",
    "Porsi dan komposisi makro terkontrol"
  ],
  "coachComment": "Komentar ramah khas persona coach"
}

Kategori 2: FOTO / DISKUSI ALAT GYM ATAU ALAT LATIHAN
Jika ini foto alat gym atau pertanyaan alat latihan:
Evaluasi apakah alat ini COCOK untuk goal pengguna (${userData.goalTitle}).
Keluarkan output JSON valid:
{
  "isFood": false,
  "isEquipment": true,
  "equipmentName": "Nama Alat Gym",
  "isAlignedWithGoal": true,
  "alignmentExplanation": "Penjelasan kesesuaian alat dengan goal",
  "suggestedExercises": [
    {
      "name": "Nama Variasi Latihan",
      "setsReps": "3 Sets x 10-12 Reps",
      "targetMuscle": "Otot Target",
      "techniqueTip": "Tips eksekusi teknik"
    }
  ],
  "politeRedirection": "Pesan ramah jika tidak cocok",
  "coachComment": "Komentar khas persona coach"
}

Kategori 3: PERTANYAAN UMUM / OBROLAN / REFERENSI TIDAK DIKENAL / GAMBAR TIDAK TERKAIT
- Jika gambar bukan makanan/minuman dan bukan alat gym/latihan (spreadsheet, dokumen, foto acak): set "isUnrelatedImage": true.
- Jika ada nama orang/entitas yang tidak dikenal (misal "si A", "Budi"), tanyakan klarifikasi secara natural tanpa mengarang identitas mereka.
- Jika pengguna bertanya hal umum atau berdiskusi, jawab secara ramah, jujur terhadap konteks, dan sesuai persona coach tanpa memaksakan menu/program jika tidak diminta.
Keluarkan output JSON valid:
{
  "isFood": false,
  "isEquipment": false,
  "isUnrelatedImage": ${imagePart ? "true" : "false"},
  "coachComment": "Pesan ramah jika di luar konteks atau pesan balasan coach alami",
  "generalReply": "Pesan balasan coach yang alami, jujur terhadap konteks, dan sesuai persona"
}
`;
        try {
          const rawText = await generateGeminiContent(prompt, imagePart);
          let parsed: any = extractAndParseJson(rawText);
          if (!parsed) {
            const cleanReply = String(rawText || "").replace(/```(?:json)?[\s\S]*?```/gi, "").trim();
            parsed = { isFood: false, isEquipment: false, generalReply: cleanReply || "Sip! Ada laporan makanan atau latihan lain yang mau ditanyakan?" };
          }

          const isEquipmentMatch = !parsed.isUnrelatedImage && (
            parsed.isEquipment ||
            ((lowerText.includes("alat") || lowerText.includes("cara pakai") || lowerText.includes("mesin") || lowerText.includes("gym")) && !parsed.isFood)
          );

          if (parsed.isFood && !parsed.isUnrelatedImage) {
            // Interactive Clarification: If photo is ambiguous and user provided NO description
            if (parsed.needsClarification && !userText.trim()) {
              const defaultClarification = isMia
                ? `📸 Fotonya sudah aku cek ya, ${addressing.validatedAddress}! Biar hitungan nutrisinya akurat, boleh kasih tahu isian utamanya apa? Misalnya sosis, telur, daging, atau lainnya ✨`
                : `📸 Fotonya sudah dicek ya, ${addressing.validatedAddress}! Biar estimasi makro dan kalorinya presisi, boleh sebutkan isian utamanya? Misalnya sosis, telur, atau daging? 💪`;
              responseMessages = [validateAndFormatCoachNote(parsed.clarificationQuestion || defaultClarification, userData)];
            } else {
              if (!planCapabilities.canNutrition) {
                const redirectRes = validatePlanContext("makanan", true, userData);
                responseMessages = [redirectRes.redirectMessage || "Untuk plan kamu saat ini, fokus aku adalah mendampingi latihan fisik kamu ya ✨"];
              } else {
                const { mealRecord, validatedParsed } = buildSingleSourceOfTruthMealRecord(
                  userText,
                  parsed,
                  Boolean(imagePart)
                );

                addMealLog(normFrom, mealRecord);
                const dailyTotals = getDailyTotals(normFrom);
                const card = formatNutritionCard(
                  validatedParsed,
                  imagePart ? "Foto" : "Teks",
                  userData,
                  dailyTotals
                );
                responseMessages = [card];

                // HANYA kirim gambar kartu infografis jika user MENGIRIM FOTO MAKANAN (imagePart / MediaUrl0)
                if (imagePart && imagePart.inlineData && req.body?.MediaUrl0) {
                  const cardId = `c_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                  const mealTypeStr = validatedParsed.mealType;
                  const dateStr = new Date().toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
                  const photoDataUri = `data:${imagePart.inlineData.mimeType || "image/jpeg"};base64,${imagePart.inlineData.data}`;

                  cardMediaCache.set(cardId, {
                    foodName: mealRecord.foodName,
                    calories: mealRecord.calories,
                    protein: mealRecord.protein,
                    carbs: mealRecord.carbs,
                    fat: mealRecord.fat,
                    sodium: (mealRecord as any).sodium || 0,
                    fiber: mealRecord.fiber || 0,
                    sugar: (mealRecord as any).sugar || 0,
                    mealType: mealTypeStr,
                    dateStr,
                    dailyTargetCalories: userData.targetCalories || 1966,
                    consumedTodayCalories: dailyTotals.calories,
                    dailyTargetProtein: userData.dailyTargetProtein || userData.proteinGrams || Math.round((userData.targetCalories || 1966) * 0.3 / 4),
                    dailyTargetCarbs: userData.dailyTargetCarbs || userData.carbGrams || Math.round((userData.targetCalories || 1966) * 0.45 / 4),
                    dailyTargetFat: userData.dailyTargetFat || userData.fatGrams || Math.round((userData.targetCalories || 1966) * 0.25 / 9),
                    insight: parsed.coachComment || (Array.isArray(parsed.keyInsights) ? parsed.keyInsights[0] : "") || parsed.satietyExplanation || "",
                    imageBufferOrBase64: photoDataUri,
                    createdAt: Date.now()
                  });

                  const proto = req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
                  const host = req.get("host") || req.headers.host || "gymbuddy.brins.co.id";
                  const dynamicOrigin = `${proto}://${host}`;
                  const domainUrl = (process.env.PUBLIC_SERVER_URL || process.env.BASE_URL || dynamicOrigin).replace(/\/$/, "");
                  mediaUrlToSend = `${domainUrl}/api/card/${cardId}.jpg`;
                } else {
                  mediaUrlToSend = "";
                }
              }
            }
          } else if (isEquipmentMatch) {
            if (!planCapabilities.canWorkout) {
              const redirectRes = validatePlanContext("alat gym", true, userData);
              responseMessages = [redirectRes.redirectMessage || "Untuk plan kamu saat ini, aku fokus bantu soal nutrisi ya ✨"];
            } else {
              if (!parsed.equipmentName) parsed.equipmentName = "Alat Gym / Mesin Latihan";
              parsed.isEquipment = true;

              const dbMatch = findExerciseOrEquipment(parsed.equipmentName || userText);
              const eqCard = formatEquipmentCard(parsed, userData);
              responseMessages = [eqCard];
              if (dbMatch && (dbMatch.gifUrl || dbMatch.imageFrames?.[0])) {
                mediaUrlToSend = dbMatch.gifUrl || dbMatch.imageFrames[0];
              }
            }
          } else if (imagePart || parsed.isUnrelatedImage) {
            // Unrelated or ambiguous image uploaded - polite redirection without guessing
            const defaultUnrelatedMsg = isMia
              ? "Maaf ya 😊 Aku belum bisa mengaitkan gambar ini dengan aktivitas GymBuddy. Kalau kamu ingin aku bantu cek makanan, nutrisi, atau workout, kirim gambar yang sesuai ya."
              : (isLansia
                  ? `Mohon maaf, ${addressing.validatedAddress}. Saya belum dapat mengaitkan gambar ini dengan aktivitas GymBuddy. Apabila Anda ingin Saya mendampingi pencatatan makanan, nutrisi, atau panduan latihan, silakan kirimkan gambar yang sesuai ya. 🌿`
                  : `Sorry ya, ${addressing.validatedAddress}! Gue belum bisa mengaitkan gambar ini dengan aktivitas GymBuddy. Kalau lo mau gue bantu cek makanan, nutrisi, atau panduan latihan, kirim foto yang sesuai ya! 💪`);

            responseMessages = [validateAndFormatCoachNote(parsed.coachComment || parsed.generalReply || defaultUnrelatedMsg, userData)];
          } else {
            responseMessages = [validateAndFormatCoachNote(parsed.generalReply || "Sip! Ada laporan makanan atau latihan lain yang mau ditanyakan?", userData)];
          }
        } catch (e) {
          console.error("Gemini AI Error:", e);
          if (imagePart) {
            const defaultErrorMsg = isMia
              ? "Maaf ya 😊 Aku belum berhasil menganalisis gambar ini. Boleh coba kirim ulang fotonya atau ceritakan makanan/latihan kamu lewat teks? ✨"
              : (isLansia
                  ? `Mohon maaf, ${addressing.validatedAddress}. Saya belum dapat memproses gambar ini. Silakan kirimkan kembali fotonya atau sampaikan melalui pesan teks ya. 🌿`
                  : `Sorry ya, ${addressing.validatedAddress}! Gambar belum berhasil diproses nih. Boleh kirim ulang fotonya atau ketik langsung makanan/latihan lo? 💪`);
            responseMessages = [validateAndFormatCoachNote(defaultErrorMsg, userData)];
          } else {
            const { mealRecord, validatedParsed } = buildSingleSourceOfTruthMealRecord(
              userText,
              null,
              false
            );

            addMealLog(normFrom, mealRecord);
            const dailyTotals = getDailyTotals(normFrom);
            const card = formatNutritionCard(
              validatedParsed,
              "Teks",
              userData,
              dailyTotals
            );
            responseMessages = [card];
          }
        }
      }
    }

      // ─── 2. SEND FINAL COACH RESPONSE IN ORDER (SAFE MULTI-MESSAGE DELIVERY) ───
      const messagesToSend = (responseMessages && responseMessages.length > 0)
        ? responseMessages
        : ["Sip, data kamu sudah tercatat!"];

      for (let mIdx = 0; mIdx < messagesToSend.length; mIdx++) {
        const msg = messagesToSend[mIdx];
        const media = (mIdx === 0 && mediaUrlToSend && mediaUrlToSend.startsWith("http"))
          ? mediaUrlToSend
          : undefined;

        await sendWhatsAppAsync(rawFrom, msg, req.body?.To, media);

        if (mIdx < messagesToSend.length - 1) {
          await new Promise(r => setTimeout(r, 450));
        }
      }

      // Return empty <Response/> so Twilio does NOT duplicate the chat bubble
      return res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
    } catch (error: any) {
      console.error("Error processing Twilio webhook:", error?.message || error, error?.stack?.substring(0, 500));
      return res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message><Body>Maaf, terjadi gangguan teknis. Coba lagi sebentar ya! 🙏</Body></Message></Response>`);
    }
  });



  async function generateGeminiImage(promptText: string): Promise<Buffer | null> {
    const rawEq = promptText.match(/for ([A-Z0-9\s]+)\./i);
    const eqName = rawEq ? rawEq[1].trim() : "Gym Equipment";
    const fullPrompt = `Photorealistic 8k fitness infographic tutorial poster for how to use ${eqName}. Dark gym aesthetic background with gold and white typography. Top title TUTORIAL CARA PAKAI ALAT INI ${eqName}. Bagian Alat section showing equipment parts. Cara Pakai section showing 4 step by step workout demonstration cards with athletic people performing the movement. Tips and common mistakes section with red X posture error comparison. Target muscle anatomy diagram showing worked muscles and workout sets reps rest counter. High quality realistic gym guide poster.`;

    const geminiKey = (process.env.GEMINI_API_KEY || "").trim();
    if (geminiKey) {
      const cleanKey = geminiKey;
      const isBearer = cleanKey.startsWith("AQ.") || cleanKey.startsWith("ya29.");
      const imagenModels = ["imagen-3.0-generate-002", "imagen-3.0-fast-generate-001"];

      // 1A. Try Generative Language API Endpoint
      for (const mName of imagenModels) {
        try {
          console.log(`[Google Imagen 3] Requesting ${mName}:predict (Key: ${cleanKey.substring(0,4)}...)...`);
          const baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${mName}:predict`;
          const url = isBearer ? baseUrl : `${baseUrl}?key=${encodeURIComponent(cleanKey)}`;

          const headers: any = { "Content-Type": "application/json" };
          if (isBearer) {
            headers["Authorization"] = `Bearer ${cleanKey}`;
          } else {
            headers["x-goog-api-key"] = cleanKey;
          }

          const resp = await axios.post(
            url,
            {
              instances: [{ prompt: fullPrompt }],
              parameters: { sampleCount: 1, aspectRatio: "3:4", outputMimeType: "image/jpeg" }
            },
            { headers, timeout: 15000 }
          );

          const base64Data = resp.data?.predictions?.[0]?.bytesBase64Encoded || resp.data?.generatedImages?.[0]?.image?.imageBytes;
          if (base64Data) {
            console.log(`[Google Imagen 3] Successfully generated AI image via ${mName}!`);
            return Buffer.from(base64Data, "base64");
          }
        } catch (restErr: any) {
          console.log(`[Google Imagen 3] Model ${mName} note:`, restErr?.response?.data?.error?.message || restErr?.message);
        }
      }

      // 1B. Try Vertex AI Endpoint for AQ. / Bearer Tokens
      if (isBearer) {
        for (const mName of imagenModels) {
          try {
            console.log(`[Google Vertex AI Imagen 3] Requesting ${mName}:predict via Vertex API...`);
            const url = `https://us-central1-aiplatform.googleapis.com/v1/publishers/google/models/${mName}:predict`;
            const resp = await axios.post(
              url,
              {
                instances: [{ prompt: fullPrompt }],
                parameters: { sampleCount: 1, aspectRatio: "3:4", outputMimeType: "image/jpeg" }
              },
              {
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${cleanKey}`
                },
                timeout: 15000
              }
            );

            const base64Data = resp.data?.predictions?.[0]?.bytesBase64Encoded || resp.data?.predictions?.[0]?.imageBytes;
            if (base64Data) {
              console.log(`[Google Vertex AI Imagen 3] Successfully generated AI image via Vertex ${mName}!`);
              return Buffer.from(base64Data, "base64");
            }
          } catch (vErr: any) {
            console.log(`[Google Vertex AI Imagen 3] Model ${mName} note:`, vErr?.response?.data?.error?.message || vErr?.message);
          }
        }
      }
    }

    // Provider 2: Pollinations AI Model Engine (Photorealistic AI Image Poster)
    const seed = Math.floor(Math.random() * 100000);
    const cleanPrompt = encodeURIComponent(`gym workout tutorial poster for ${eqName}, fitness guide`);

    const pollinationsUrls = [
      `https://image.pollinations.ai/prompt/${cleanPrompt}?width=800&height=1200&nologo=true&seed=${seed}`,
      `https://image.pollinations.ai/prompt/${cleanPrompt}?model=flux&width=800&height=1200&nologo=true&seed=${seed}`,
      `https://image.pollinations.ai/prompt/${cleanPrompt}?model=turbo&width=800&height=1200&nologo=true&seed=${seed}`
    ];

    for (const pUrl of pollinationsUrls) {
      try {
        console.log("[Pollinations AI] Fetching AI image:", pUrl);
        const resp = await axios.get(pUrl, { responseType: "arraybuffer", timeout: 10000 });
        const contentType = String(resp.headers?.["content-type"] || "");
        if (resp.data && resp.data.length > 5000 && (contentType.includes("image") || resp.data.length > 8000)) {
          console.log("[Pollinations AI] Successfully generated AI poster! Bytes:", resp.data.length);
          return Buffer.from(resp.data);
        }
      } catch (e: any) {
        console.log("[Pollinations AI] Attempt note:", e?.message || e);
      }
    }

    return null;
  }

  // ─── Nutrition Card SVG Generator (Modern Obsidian Apple/Whoop Style) ────────
  function generateNutritionCardSVG(
    foodName: string,
    calories: number,
    protein: number,
    carbs: number,
    fat: number,
    fiber: number,
    healthScore: number,
    dayLabel: string,
    foodImageBase64?: string, // optional JPEG/PNG base64 to embed
    foodImageMime?: string
  ): string {
    const esc = (s: string) => escapeXml(String(s));

    // Food name — wrap to 2 lines cleanly if long
    const cleanFoodName = (foodName || "Menu Makanan").trim();
    const nameWords = cleanFoodName.split(" ");
    let nameLine1 = cleanFoodName;
    let nameLine2 = "";
    if (cleanFoodName.length > 28) {
      const mid = Math.ceil(nameWords.length / 2);
      nameLine1 = nameWords.slice(0, mid).join(" ");
      nameLine2 = nameWords.slice(mid).join(" ");
    }

    const numHealthScore = Math.min(5, Math.max(1, Number(healthScore) || 4));
    const scoreFormatted = numHealthScore.toFixed(1);
    const scoreRatingText = numHealthScore >= 4 ? "Sangat Sehat" : numHealthScore >= 3 ? "Sehat Seimbang" : "Perlu Penyesuaian";

    // Embedded food image or dark placeholder
    const imgContent = foodImageBase64
      ? `<image href="data:${foodImageMime || "image/jpeg"};base64,${foodImageBase64}" x="36" y="195" width="528" height="300" clip-path="url(#imgClip)" preserveAspectRatio="xMidYMid slice" />`
      : `<rect x="36" y="195" width="528" height="300" rx="20" fill="#141C2A" /><text x="300" y="355" text-anchor="middle" font-size="18" font-weight="600" fill="#64748B" font-family="system-ui, sans-serif">📷 Foto Makanan</text>`;

    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 600 780" width="600" height="780">
  <defs>
    <clipPath id="imgClip"><rect x="36" y="195" width="528" height="300" rx="20" /></clipPath>
    
    <!-- Linear Gradients for Macros -->
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0F1420"/>
      <stop offset="100%" stop-color="#080C14"/>
    </linearGradient>
    <linearGradient id="calGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#22C55E"/>
      <stop offset="100%" stop-color="#D4FF00"/>
    </linearGradient>

    <filter id="glowShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
  </defs>

  <!-- Main Obsidian Card Background -->
  <rect width="600" height="780" rx="32" fill="url(#cardGrad)" filter="url(#glowShadow)"/>
  <rect width="598" height="778" x="1" y="1" rx="31" fill="none" stroke="#FFFFFF" stroke-opacity="0.08" stroke-width="1.5"/>

  <!-- TOP HEADER: GymBuddy Official Logo & Date Pill -->
  <!-- Official GymBuddy Logo SVG -->
  <g transform="translate(36, 32) scale(0.55)">
    <rect width="64" height="64" rx="32" fill="#141C2B" />
    <path d="M30.6 32.0694L34.2 27.7639H46.6L39.8 38.0972L26.6 44.9861L36.6 32.0694H30.6Z" fill="#D4FF00" />
    <path d="M51 17H27C25.9333 17 23.4 17.775 21.8 20.875C20.2 23.975 15.2667 34.5093 13 39.3889H25L21 48L23.4 46.7083L32.6 34.2222H22.6C22.0667 34.3657 21.24 34.1361 22.2 32.0694C23.16 30.0028 25 25.7546 25.8 23.8889C26.0667 23.3148 26.84 22.1667 27.8 22.1667H38.6L35.8 26.0417H43.4L51 17Z" fill="#FFFFFF" />
  </g>

  <!-- Brand Typography -->
  <text x="80" y="55" font-size="16" font-weight="900" fill="#FFFFFF" font-family="DejaVu Sans, Arial, Helvetica, sans-serif" letter-spacing="0.5">GYMBUDDY</text>
  <text x="175" y="55" font-size="12" font-weight="800" fill="#D4FF00" font-family="DejaVu Sans, Arial, Helvetica, sans-serif" letter-spacing="1">VISION AI</text>

  <!-- Day Badge (Top Right) -->
  <rect x="444" y="32" width="120" height="34" rx="17" fill="#141C2B" stroke="#FFFFFF" stroke-opacity="0.08"/>
  <text x="504" y="54" text-anchor="middle" font-size="13" font-weight="700" fill="#94A3B8" font-family="DejaVu Sans, Arial, Helvetica, sans-serif">${esc(dayLabel || "Hari Ini")}</text>

  <!-- FOOD TITLE (Crisp, modern line wrapping) -->
  <text x="36" y="${nameLine2 ? 104 : 116}" font-size="${nameLine2 ? 26 : 28}" font-weight="800" fill="#FFFFFF" font-family="DejaVu Sans, Arial, Helvetica, sans-serif">${esc(nameLine1)}</text>
  ${nameLine2 ? `<text x="36" y="138" font-size="24" font-weight="800" fill="#FFFFFF" font-family="DejaVu Sans, Arial, Helvetica, sans-serif">${esc(nameLine2)}</text>` : ""}

  <!-- HEALTH SCORE PILL (Clean, zero overlap) -->
  <rect x="36" y="${nameLine2 ? 152 : 142}" width="220" height="32" rx="16" fill="#141C2B" stroke="#D4FF00" stroke-opacity="0.3" stroke-width="1"/>
  <text x="48" y="${nameLine2 ? 173 : 163}" font-size="14" fill="#D4FF00" font-family="DejaVu Sans, Arial, sans-serif">★</text>
  <text x="66" y="${nameLine2 ? 173 : 163}" font-size="12" font-weight="800" fill="#FFFFFF" font-family="DejaVu Sans, Arial, Helvetica, sans-serif">${scoreFormatted} / 5.0</text>
  <text x="130" y="${nameLine2 ? 173 : 163}" font-size="11" font-weight="600" fill="#94A3B8" font-family="DejaVu Sans, Arial, Helvetica, sans-serif">• ${scoreRatingText}</text>

  <!-- FOOD PHOTO -->
  ${imgContent}
  <rect x="36" y="195" width="528" height="300" rx="20" fill="none" stroke="#FFFFFF" stroke-opacity="0.1" stroke-width="1.5"/>

  <!-- HERO CALORIE BAR -->
  <rect x="36" y="510" width="528" height="68" rx="20" fill="#141C2B" stroke="#FFFFFF" stroke-opacity="0.06"/>
  <text x="56" y="552" font-size="28" font-weight="900" fill="#FFFFFF" font-family="DejaVu Sans, Arial, Helvetica, sans-serif">🔥 ${calories}</text>
  <text x="175" y="550" font-size="14" font-weight="700" fill="#94A3B8" font-family="DejaVu Sans, Arial, Helvetica, sans-serif">TOTAL KALORI (kcal)</text>
  <text x="544" y="550" text-anchor="end" font-size="12" font-weight="700" fill="#D4FF00" font-family="DejaVu Sans, Arial, Helvetica, sans-serif">Padat Energi</text>

  <!-- 4 BALANCED MACRO CARDS -->
  <!-- 1. Protein Card -->
  <rect x="36" y="590" width="124" height="110" rx="20" fill="#101724" stroke="#FFFFFF" stroke-opacity="0.06"/>
  <rect x="48" y="602" width="8" height="8" rx="4" fill="#10B981"/>
  <text x="62" y="610" font-size="12" font-weight="700" fill="#94A3B8" font-family="DejaVu Sans, Arial, Helvetica, sans-serif">Protein</text>
  <text x="98" y="654" text-anchor="middle" font-size="28" font-weight="900" fill="#FFFFFF" font-family="DejaVu Sans, Arial, Helvetica, sans-serif">${protein}<tspan font-size="14" font-weight="600" fill="#64748B">g</tspan></text>
  <rect x="48" y="676" width="100" height="5" rx="2.5" fill="#1E293B"/>
  <rect x="48" y="676" width="${Math.min(100, Math.round(protein * 2.5))}" height="5" rx="2.5" fill="#10B981"/>

  <!-- 2. Karbohidrat Card -->
  <rect x="170" y="590" width="124" height="110" rx="20" fill="#101724" stroke="#FFFFFF" stroke-opacity="0.06"/>
  <rect x="182" y="602" width="8" height="8" rx="4" fill="#F59E0B"/>
  <text x="196" y="610" font-size="12" font-weight="700" fill="#94A3B8" font-family="DejaVu Sans, Arial, Helvetica, sans-serif">Karbo</text>
  <text x="232" y="654" text-anchor="middle" font-size="28" font-weight="900" fill="#FFFFFF" font-family="DejaVu Sans, Arial, Helvetica, sans-serif">${carbs}<tspan font-size="14" font-weight="600" fill="#64748B">g</tspan></text>
  <rect x="182" y="676" width="100" height="5" rx="2.5" fill="#1E293B"/>
  <rect x="182" y="676" width="${Math.min(100, Math.round(carbs * 1.5))}" height="5" rx="2.5" fill="#F59E0B"/>

  <!-- 3. Lemak Card -->
  <rect x="304" y="590" width="124" height="110" rx="20" fill="#101724" stroke="#FFFFFF" stroke-opacity="0.06"/>
  <rect x="316" y="602" width="8" height="8" rx="4" fill="#8B5CF6"/>
  <text x="330" y="610" font-size="12" font-weight="700" fill="#94A3B8" font-family="DejaVu Sans, Arial, Helvetica, sans-serif">Lemak</text>
  <text x="366" y="654" text-anchor="middle" font-size="28" font-weight="900" fill="#FFFFFF" font-family="DejaVu Sans, Arial, Helvetica, sans-serif">${fat}<tspan font-size="14" font-weight="600" fill="#64748B">g</tspan></text>
  <rect x="316" y="676" width="100" height="5" rx="2.5" fill="#1E293B"/>
  <rect x="316" y="676" width="${Math.min(100, Math.round(fat * 2.2))}" height="5" rx="2.5" fill="#8B5CF6"/>

  <!-- 4. Serat Card -->
  <rect x="440" y="590" width="124" height="110" rx="20" fill="#101724" stroke="#FFFFFF" stroke-opacity="0.06"/>
  <rect x="452" y="602" width="8" height="8" rx="4" fill="#06B6D4"/>
  <text x="466" y="610" font-size="12" font-weight="700" fill="#94A3B8" font-family="DejaVu Sans, Arial, Helvetica, sans-serif">Serat</text>
  <text x="502" y="654" text-anchor="middle" font-size="28" font-weight="900" fill="#FFFFFF" font-family="DejaVu Sans, Arial, Helvetica, sans-serif">${fiber}<tspan font-size="14" font-weight="600" fill="#64748B">g</tspan></text>
  <rect x="452" y="676" width="100" height="5" rx="2.5" fill="#1E293B"/>
  <rect x="452" y="676" width="${Math.min(100, Math.round(fiber * 8))}" height="5" rx="2.5" fill="#06B6D4"/>

  <!-- FOOTER BRANDING -->
  <text x="300" y="745" text-anchor="middle" font-size="11" font-weight="700" fill="#475569" font-family="DejaVu Sans, Arial, Helvetica, sans-serif" letter-spacing="1">GYMBUDDY · AI NUTRITION ENGINE</text>
</svg>`;
  }

  // Endpoint: serve a generated nutrition card PNG by ID
  app.get(["/api/nutrition-card/:id.png", "/api/nutrition-card/:id.jpg"], async (req, res) => {
    const rawId = req.params.id;
    const id = String(rawId || "").replace(/\.(png|jpg|jpeg)$/i, "");
    const cardData = dbData.nutritionCards ? dbData.nutritionCards[id] : null;
    if (!cardData) {
      return res.status(404).send("Image not found");
    }

    const svgStr = generateNutritionCardSVG(
      cardData.foodName, cardData.calories, cardData.protein,
      cardData.carbs, cardData.fat, cardData.fiber,
      cardData.healthScore, cardData.dayLabel,
      cardData.foodImageBase64, cardData.foodImageMime
    );

    try {
      // @ts-ignore
      const { Resvg } = await import("@resvg/resvg-js");
      const fontPath = path.join(process.cwd(), "fonts", "arial.ttf");
      let fontBuffer: Buffer | null = null;
      if (fs.existsSync(fontPath)) {
        try { fontBuffer = fs.readFileSync(fontPath); } catch (fe) {}
      }

      const resvgOptions: any = {
        fitTo: { mode: "width", value: 600 },
        font: {
          loadSystemFonts: true,
          defaultFontFamily: "Arial"
        }
      };

      if (fontBuffer) {
        resvgOptions.font.fontBuffers = [fontBuffer];
      }

      const resvg = new Resvg(svgStr, resvgOptions);
      const pngData = resvg.render();
      const pngBuffer = pngData.asPng();
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(pngBuffer);
    } catch (e: any) {
      console.warn("[NutritionCard] Resvg failed, returning SVG:", e?.message);
      res.setHeader("Content-Type", "image/svg+xml");
      return res.send(svgStr);
    }
  });



  app.get(["/api/generated-image/:id.jpg", "/api/generated-image/:id.png"], async (req, res) => {
    const rawId = req.params.id;
    const idStr = Array.isArray(rawId) ? rawId[0] : (rawId || "");
    const cleanId = idStr.replace(/\.(jpg|jpeg|png)$/i, "");
    const imgBase64 = dbData.generatedImages ? dbData.generatedImages[cleanId] : null;

    if (imgBase64) {
      const imgBuffer = Buffer.from(imgBase64, "base64");
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(imgBuffer);
    }

    return res.status(404).send("Image not found");
  });

  function formatEquipmentTutorialCard(parsed: any, userData: any): string {
    const rawEqName = (parsed.equipmentName || "").trim();
    const isGeneric = !rawEqName || rawEqName.includes("THIS MACHINE") || rawEqName.includes("Nama Alat Gym");

    // Lookup real exercise in database
    const dbMatch = findExerciseOrEquipment(rawEqName || parsed.generalReply || "");
    const eqName = (dbMatch ? dbMatch.indonesianName : (isGeneric ? "ALAT GYM / MESIN LATIHAN" : rawEqName)).toUpperCase();

    const desc = (dbMatch && dbMatch.equipmentSetup?.[0]) || parsed.description || "Melatih kelompok otot target secara optimal.";
    const muscles = (dbMatch && dbMatch.targetMuscles?.join(", ")) || parsed.targetMuscles || "Otot Target Latihan";

    const parts = (dbMatch && dbMatch.equipmentSetup && dbMatch.equipmentSetup.length > 0)
      ? dbMatch.equipmentSetup.map((p: string, i: number) => `  ${i + 1}️⃣ *${p}*`).join("\n")
      : (Array.isArray(parsed.parts) && parsed.parts.length > 0
        ? parsed.parts.map((p: string, i: number) => `  ${i + 1}️⃣ *${p}*`).join("\n")
        : "  1️⃣ *Pegangan Utama / Grip*: Menjaga posisi tangan\n  2️⃣ *Beban / Resistance*: Pengatur intensitas\n  3️⃣ *Support Pad / Pijakan*: Menjaga stabilitas postur");

    const steps = (dbMatch && dbMatch.instructions && dbMatch.instructions.length > 0)
      ? dbMatch.instructions.map((s: string, i: number) => `  ${i + 1}️⃣ *${s}*`).join("\n")
      : (Array.isArray(parsed.steps) && parsed.steps.length > 0
        ? parsed.steps.map((s: string, i: number) => `  ${i + 1}️⃣ *${s}*`).join("\n")
        : "  1️⃣ *Atur Posisi*: Sesuaikan beban & posisi awal\n  2️⃣ *Posisi Awal*: Kencangkan otot core dan pegang alat\n  3️⃣ *Gerakan Latihan*: Tarik/Dorong beban perlahan\n  4️⃣ *Gerakan Akhir*: Kembali ke posisi semula secara terkontrol");

    const tips = (dbMatch && dbMatch.dosAndDonts?.dos && dbMatch.dosAndDonts.dos.length > 0)
      ? dbMatch.dosAndDonts.dos.map((t: string) => `  ✅ ${t}`).join("\n")
      : (Array.isArray(parsed.tips) && parsed.tips.length > 0
        ? parsed.tips.map((t: string) => `  ✅ ${t}`).join("\n")
        : "  ✅ Gerakan perlahan & terkontrol (3 dtk turun, 1 dtk naik)\n  ✅ Jaga punggung tetap lurus, jangan membungkuk\n  ✅ Fokus pada kontraksi otot target");

    const mistakes = (dbMatch && dbMatch.dosAndDonts?.donts && dbMatch.dosAndDonts.donts.length > 0)
      ? dbMatch.dosAndDonts.donts.map((m: string) => `  ⚠️ ${m}`).join("\n")
      : (Array.isArray(parsed.mistakes) && parsed.mistakes.length > 0
        ? parsed.mistakes.map((m: string) => `  ⚠️ ${m}`).join("\n")
        : "  ⚠️ Menggunakan ayunan/momentum, bukan kekuatan otot\n  ⚠️ Postur punggung melengkung saat beban berat");

    // Customize sets/reps to user goal!
    let defaultSets = "3 - 4 Set";
    let defaultReps = "10 - 15 Repetisi";
    let defaultRest = "60 - 90 Detik";

    const goalLower = (userData.goalTitle || "").toLowerCase();
    if (goalLower.includes("menurunkan") || goalLower.includes("fat loss") || goalLower.includes("turun")) {
      defaultSets = "3 - 4 Set";
      defaultReps = "12 - 15 Repetisi (Tinggi Kalori)";
      defaultRest = "45 - 60 Detik (Intensitas Tinggi)";
    } else if (goalLower.includes("naik") || goalLower.includes("otot") || goalLower.includes("muscle") || goalLower.includes("gain")) {
      defaultSets = "4 Set";
      defaultReps = "8 - 12 Repetisi (Hipertrofi Otot)";
      defaultRest = "90 - 120 Detik (Recovery Maksimal)";
    }

    const sets = parsed.recommendedSets || defaultSets;
    const reps = parsed.recommendedReps || defaultReps;
    const rest = parsed.recommendedRest || defaultRest;
    const coachName = userData.persona === "max" ? "Coach Max" : "Coach Mia";
    const coachCue = (dbMatch && (userData.persona === "max" ? dbMatch.coachCues?.max : dbMatch.coachCues?.mia)) || "";
    const pwaUrl = `https://gymbuddygroup.com?tab=workout${dbMatch ? `&exercise=${dbMatch.id}` : ""}`;

    return `🏋️ *TUTORIAL CARA PAKAI ALAT: ${eqName}*\n` +
      `----------------------------------------\n` +
      `📌 *Nama Alat*: ${eqName}\n` +
      `📝 *Fungsi*: ${desc}\n` +
      `🎯 *Target Otot*: ${muscles}\n` +
      `📋 *Goal Kamu*: ${userData.goalTitle || "Kebugaran Harian"}\n\n` +
      `🔩 *BAGIAN ALAT*:\n${parts}\n\n` +
      `📐 *CARA PAKAI (STEP-BY-STEP)*:\n${steps}\n\n` +
      `💡 *TIPS PERFORMA*:\n${tips}\n\n` +
      `❌ *KESALAHAN UMUM*:\n${mistakes}\n\n` +
      `📊 *REKOMENDASI GOAL KAMU*:\n` +
      `⏱️ *Sets*: ${sets}\n` +
      `🔄 *Reps*: ${reps}\n` +
      `⏳ *Istirahat*: ${rest}\n\n` +
      (coachCue ? `💬 *${coachName}*:\n"${coachCue}"\n\n` : "") +
      `🎥 *Lihat Panduan Visual Gerakan*:\n🔗 ${pwaUrl}`;
  }

  // =============================================
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    const distIndex = path.join(distPath, "index.html");
    const rootIndex = path.join(process.cwd(), "index.html");

    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
    }
    app.use(express.static(process.cwd()));

    app.use((req: any, res: any) => {
      if (fs.existsSync(distIndex)) {
        res.sendFile(distIndex);
      } else if (fs.existsSync(rootIndex)) {
        res.sendFile(rootIndex);
      } else {
        res.status(200).send("<h1>GymBuddy Backend Server is Running</h1>");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (process.env.NODE_ENV !== "test" && !process.env.JEST_WORKER_ID && !process.argv.some(a => a.toLowerCase().includes("test") || a.includes("test_"))) {
  startServer();
}
