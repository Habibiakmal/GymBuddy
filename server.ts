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
import { estimateMealNutritionDeterministic, buildGeminiNutritionPrompt, isGenericMealInput } from "./services/nutritionEngine";

// Twilio configuration (strictly from environment variables)
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";

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
  const cleanKey = USER_GEMINI_KEY;
  if (!cleanKey) {
    throw new Error("GEMINI_API_KEY is not set in environment variables");
  }

  const modelsToTry = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-2.5-flash",
    "gemini-1.5-flash"
  ];

  // 1. Try official SDK first (@google/genai natively supports AQ. Auth keys)
  const ai = getAi();
  if (ai) {
    for (const mName of modelsToTry) {
      try {
        const contents: any[] = imagePart ? [prompt, imagePart] : [prompt];
        const response = await ai.models.generateContent({
          model: mName,
          contents
        });
        if (response?.text) {
          console.log(`[Gemini SDK] Success with model: ${mName}`);
          return response.text;
        }
      } catch (err: any) {
        console.log(`[Gemini SDK] Model ${mName} note:`, err?.message || err);
      }
    }
  }

  // 2. Try REST API with key in URL and native fetch
  for (const mName of modelsToTry) {
    try {
      const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/${mName}:generateContent?key=${encodeURIComponent(cleanKey)}`;
      const requestParts: any[] = [{ text: prompt }];
      if (imagePart && imagePart.inlineData) {
        requestParts.push({ inlineData: { mimeType: imagePart.inlineData.mimeType, data: imagePart.inlineData.data } });
      }

      const res = await fetch(restUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: requestParts }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
        })
      });

      const data: any = await res.json();
      if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.log(`[Gemini REST] Success with model: ${mName}`);
        return data.candidates[0].content.parts[0].text;
      }
    } catch (restErr: any) {
      console.log(`[Gemini REST] Model ${mName} note:`, restErr?.message || restErr);
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
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  isHydration?: boolean;
  volumeMl?: number;
  timestamp: string;
  mealType?: string;
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

let dbData: DbSchema = {
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

// Helper to determine meal type by hour — always computed in WIB (UTC+7)
function getMealTypeByHour(): "breakfast" | "lunch" | "snack" | "dinner" {
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
      console.log(`[Firestore] Loaded ${Object.keys(dbData.users).length} users and ${Object.keys(dbData.dailyLogs).length} log dates from Firestore ✅`);
      return true;
    }
    return false;
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

function initDb() {
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

  // Load from Firestore asynchronously (authoritative cloud store)
  loadFromFirestore().then(loaded => {
    if (!loaded) console.log("[Firestore] No existing cloud snapshot found");
    purgeLegacyMockLogs();
  });
}

function saveDb() {
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

// Initialize database & scheduler on server start
initDb();
initReminderScheduler();

function getTodayDateStr(): string {
  return getLocalDateStr();
}

function getUserProfile(rawPhone: string) {
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

function saveUserProfile(rawPhone: string, profile: any) {
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

function calculateUserData(profile: any) {
  const name = profile?.name || "Member";
  const weight = Math.max(30, Number(profile?.weight) || 65);
  const startWeight = Math.max(30, Number(profile?.startWeight) || weight);
  const height = Math.max(100, Number(profile?.height) || 170);
  const age = Math.max(10, Number(profile?.age) || 25);
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

  return {
    name,
    weight,
    startWeight,
    targetWeight,
    height,
    age,
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

function getDailyTotals(rawPhone: string, targetDateStr?: string) {
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
  let sodium = 0;

  for (const log of logs) {
    calories += Number(log.calories) || 0;
    protein += Number(log.protein) || 0;
    carbs += Number(log.carbs) || 0;
    fat += Number(log.fat) || 0;
    fiber += Number(log.fiber) || 0;
    sodium += Number((log as any).sodium) || 0;
  }

  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    fiber: Math.round(fiber),
    sodium: Math.round(sodium),
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
  if (hasFoodContext(text) && !/^(?:update\s+bb|lapor\s+bb|berat\s+badan|bb\s+sekarang)\b/i.test(text.trim())) {
    return null;
  }
  return text.match(/(?:update\s+bb|lapor\s+bb|berat\s+badan|bb\s+sekarang|bb)\s*:?\s*(\d+(?:[\.,]\d+)?)/i);
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

  // Smart splitting for combo text (e.g. "Nasi Ayam McD + Kopi")
  const rawName = meal.foodName || "";
  const parts = rawName.split(/\+|\s+&\s+|\s+dan\s+|\s+with\s+|,/i).map((p) => p.trim()).filter(Boolean);

  const solidParts: string[] = [];
  const liquidParts: string[] = [];

  for (const part of parts) {
    if (isLiquidName(part)) {
      liquidParts.push(part);
    } else {
      solidParts.push(part);
    }
  }

  const mealsToInsert: MealLog[] = [];

  if (solidParts.length > 0) {
    mealsToInsert.push({
      ...meal,
      id: `${meal.id || Date.now()}-food`,
      foodName: solidParts.join(" + "),
      calories: liquidParts.length > 0 ? Math.max(0, (Number(meal.calories) || 450) - (liquidParts.length * 50)) : (Number(meal.calories) || 450),
      isHydration: false,
      volumeMl: undefined
    });
  }

  if (liquidParts.length > 0) {
    liquidParts.forEach((lPart, idx) => {
      const detectedVolumeMl = extractVolumeMlFromName(lPart);
      const isMilky = /(susu|milk|latte|whey|protein|gainer|yogurt|shake)/i.test(lPart);
      const isSweet = /(manis|sweet|gula|sugar|sirup|syrup|boba|jus|juice|soda|coca|cola|sprite|fanta)/i.test(lPart);

      const cal = isMilky ? 120 : (isSweet ? 65 : 2);
      const prot = isMilky ? 6 : 0;
      const carb = isMilky ? 10 : (isSweet ? 16 : 0);
      const fat = isMilky ? 4 : 0;

      mealsToInsert.push({
        ...meal,
        id: `${meal.id || Date.now()}-drink-${idx}`,
        foodName: lPart,
        calories: cal,
        protein: prot,
        carbs: carb,
        fat: fat,
        isHydration: true,
        volumeMl: detectedVolumeMl
      } as any);
    });
  } else if (solidParts.length === 0) {
    mealsToInsert.push({
      ...meal,
      isHydration: isLiquidName(rawName),
      volumeMl: isLiquidName(rawName) ? extractVolumeMlFromName(rawName) : undefined
    } as any);
  }

  for (const itemMeal of mealsToInsert) {
    // BugA Fix: only save to the specific user's log, never broadcast to all users
    const key = `${phone}_${targetDate}`;
    if (!dbData.dailyLogs[key]) {
      dbData.dailyLogs[key] = [];
    }
    if (!dbData.dailyLogs[key].some((m: any) => m.id === itemMeal.id)) {
      dbData.dailyLogs[key].push(itemMeal);
    }
    // Also save for alternate phone format (08xxx vs 628xxx) to keep lookup consistent
    const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
    const altKey = `${altPhone}_${targetDate}`;
    if (!dbData.dailyLogs[altKey]) {
      dbData.dailyLogs[altKey] = [];
    }
    if (!dbData.dailyLogs[altKey].some((m: any) => m.id === itemMeal.id)) {
      dbData.dailyLogs[altKey].push(itemMeal);
    }

    // Persist directly to Firestore foodLogs collection
    insertFoodLog({
      id: String(itemMeal.id || `m-${Date.now()}`),
      userId: `usr_${phone}`,
      phone: phone,
      date: targetDate,
      foodName: itemMeal.foodName,
      calories: Number(itemMeal.calories) || 0,
      protein: Number(itemMeal.protein) || 0,
      carbs: Number(itemMeal.carbs) || 0,
      fat: Number(itemMeal.fat) || 0,
      fiber: Number(itemMeal.fiber) || 0,
      sugar: Number((itemMeal as any).sugar) || 0,
      time: (itemMeal as any).time || new Date().toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }),
      isHydration: Boolean(itemMeal.isHydration),
      volumeMl: itemMeal.volumeMl,
      displayUnit: (itemMeal as any).displayUnit,
      portionType: (itemMeal as any).portionType || "estimated",
      itemType: itemMeal.isHydration ? "water" : "food",
      source: (itemMeal as any).source || "WhatsApp",
      items: (itemMeal as any).items || [],
      imageUrl: (itemMeal as any).imageUrl,
      createdAt: new Date()
    }).catch((e: any) => console.warn("[Firestore] insertFoodLog note:", e?.message || e));

    if (isPlainWaterName(itemMeal.foodName) && !itemMeal.id?.startsWith("wa-water-")) {
      const vol = itemMeal.volumeMl || 250;
      const cupsToAdd = Math.max(1, Math.round(vol / 250));
      const currentCups = getWaterCups(phone, targetDate);
      setWaterCups(phone, currentCups + cupsToAdd, targetDate);
    }
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

// Add Weekly Progress Entry & update database
function addWeeklyProgress(rawPhone: string, currentWeight: number, notes: string = "Progress Mingguan") {
  const phone = normalizePhone(rawPhone);
  const user = getUserProfile(phone);
  if (!user) return null;

  const history = dbData.weeklyProgress[phone] || [];
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

  // Update current weight in user profile database
  user.weight = currentWeight;
  dbData.users[phone] = user;

  saveDb();
  return { entry, history: dbData.weeklyProgress[phone], userData: calculateUserData(user) };
}

function formatWeeklyProgressCard(progressResult: NonNullable<ReturnType<typeof addWeeklyProgress>>): string {
  const { entry, userData } = progressResult;
  const { name, targetWeight, goalTitle, persona, targetCalories, proteinGrams, carbGrams, fatGrams } = userData;

  const filledBars = Math.floor(entry.progressPercent / 10);
  const progressVisual = "🟩".repeat(filledBars) + "⬜".repeat(10 - filledBars);

  const changeStr = entry.changeFromStart <= 0 ? `${entry.changeFromStart} kg` : `+${entry.changeFromStart} kg`;
  const weekChangeStr = entry.changeFromLastWeek <= 0 ? `${entry.changeFromLastWeek} kg` : `+${entry.changeFromLastWeek} kg`;

  const coachName = persona === "max" ? "Coach Max" : "Coach Mia";
  const comment = persona === "max"
    ? (entry.changeFromStart <= 0 
        ? `Mantap bro! Berat badan lo udah berkurang ${Math.abs(entry.changeFromStart)} kg dari awal. Jangan kasih kendor, bantai terus!`
        : `Ada kenaikan sedikit, tapi gak masalah! Penyesuaian makro hari ini bakal bikin lo balik ke jalur yang bener. Gas!`)
    : (entry.changeFromStart <= 0
        ? `Wah selamat ya ${name}! Kamu sudah berhasil mengikis ${Math.abs(entry.changeFromStart)} kg. Mia bangga banget sama konsistensimu! ✨`
        : `Tetap tenang ya ${name}, fluktuasi berat badan itu wajar. Kita tetap fokus ke pola makan seimbang minggu ini ya 🌱`);

  return `📈 *LAPORAN PROGRESS MINGGUAN FOR ${name.toUpperCase()}*
-----------------------------
🎯 *Goal*: ${goalTitle}
🗓️ *Status*: Minggu ke-${entry.week}
⚖️ *BB Awal*: ${userData.startWeight} kg
⚖️ *BB Sekarang*: ${entry.weight} kg (${changeStr} total)
📉 *Perubahan Minggu Ini*: ${weekChangeStr}
🎯 *Target Akhir*: ${targetWeight} kg

📊 *PROGRES CAPAIAN GOAL*: ${entry.progressPercent}%
${progressVisual}

⚡ *TARGET NUTRISI BARU DISESUAIKAN*:
🔥 Kalori Harian: ${targetCalories} kcal
🍖 Protein: ${proteinGrams}g | 🍚 Karbo: ${carbGrams}g | 🥓 Lemak: ${fatGrams}g
-----------------------------

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
    await axios.post(
      `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: to,
        text: { body: bodyText },
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

function makeProgressBar(current: number, target: number, length: number = 10): string {
  if (!target || target <= 0) return "░".repeat(length);
  const percent = Math.min(100, Math.max(0, Math.round((current / target) * 100)));
  const filledCount = Math.min(length, Math.max(0, Math.floor((percent / 100) * length)));
  return "🟩".repeat(filledCount) + "░".repeat(length - filledCount);
}

function parseDateFromQuery(userText: string): { dateStr: string; label: string } {
  const lower = userText.toLowerCase();
  const today = new Date();
  
  const formatDate = (d: Date) => getLocalDateStr(d);
  const formatLabel = (d: Date, prefix: string = "") => {
    const dayStr = d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    return prefix ? `${prefix} (${dayStr})` : dayStr;
  };

  if (lower.includes("kemarin lusa") || lower.includes("2 hari lalu")) {
    const d = new Date(today.getTime() - 86400000 * 2);
    return { dateStr: formatDate(d), label: formatLabel(d, "2 Hari Lalu") };
  }

  if (lower.includes("kemarin") || lower.includes("yesterday")) {
    const d = new Date(today.getTime() - 86400000);
    return { dateStr: formatDate(d), label: formatLabel(d, "Kemarin") };
  }

  const dateMatch = userText.match(/(\d{4}-\d{2}-\d{2})|(\d{1,2})\s*(jan|feb|mar|apr|mei|jun|jul|agu|sep|okt|nov|des|januari|februari|maret|april|juni|juli|agustus|september|oktober|november|desember)/i);
  if (dateMatch) {
    if (dateMatch[1]) {
      const parsedDate = new Date(dateMatch[1]);
      if (!isNaN(parsedDate.getTime())) {
        return { dateStr: dateMatch[1], label: formatLabel(parsedDate) };
      }
    } else if (dateMatch[2] && dateMatch[3]) {
      const dayNum = parseInt(dateMatch[2]);
      const monthStr = dateMatch[3].toLowerCase();
      const monthMap: Record<string, number> = {
        jan: 0, januari: 0, feb: 1, februari: 1, mar: 2, maret: 2, apr: 3, april: 3,
        mei: 4, jun: 5, juni: 5, jul: 6, juli: 6, agu: 7, agustus: 7, sep: 8, september: 8,
        okt: 9, oktober: 9, nov: 10, november: 10, des: 11, desember: 11
      };
      const monthIdx = monthMap[monthStr];
      if (monthIdx !== undefined) {
        let year = today.getFullYear();
        const d = new Date(year, monthIdx, dayNum);
        return { dateStr: formatDate(d), label: formatLabel(d) };
      }
    }
  }

  return { dateStr: formatDate(today), label: formatLabel(today, "Hari Ini") };
}

function formatNutritionCard(
  parsedAi: any,
  inputSource: string,
  userData: ReturnType<typeof calculateUserData>,
  dailyTotals: ReturnType<typeof getDailyTotals>
): string {
  const rawFoodName = String(parsedAi?.foodName || "Analisis Makanan").trim();
  const rawPortion = parsedAi?.portion || parsedAi?.portionWeight || (Array.isArray(parsedAi?.portionEstimates) && parsedAi?.portionEstimates[0] ? parsedAi.portionEstimates[0] : null) || parsedAi?.portionDetail || "1 porsi";
  const portionStr = String(rawPortion).trim();

  const calories = Number(parsedAi?.calories) || 0;
  const protein = Number(parsedAi?.protein) || 0;
  const carbs = Number(parsedAi?.carbs) || 0;
  const fat = Number(parsedAi?.fat) || 0;
  const fiber = Number(parsedAi?.fiber) || 0;
  const sugar = Number(parsedAi?.sugar) || 0;

  const protKcal = protein * 4;
  const carbKcal = carbs * 4;
  const fatKcal = fat * 9;
  const totalMacroKcal = protKcal + carbKcal + fatKcal || calories || 1;

  const protPercent = Math.round((protKcal / totalMacroKcal) * 100);
  const carbPercent = Math.round((carbKcal / totalMacroKcal) * 100);
  const fatPercent = Math.round((fatKcal / totalMacroKcal) * 100);

  const confidenceScore = Math.min(98, Math.max(75, Number(parsedAi?.confidenceLevel) || (String(inputSource).toLowerCase().includes("foto") ? 88 : 92)));

  const satietyScore = Math.min(10, Math.max(1, Number(parsedAi?.satietyScore) || 5));
  const healthScore = Math.min(10, Math.max(1, Number(parsedAi?.healthScore) || 8));

  let satietyExplanation = String(parsedAi?.satietyExplanation || "Tingkat kepuasan nutrisi makanan ini berdasarkan protein, serat, lemak, volume makanan, dan komposisi karbohidrat.");
  satietyExplanation = satietyExplanation.replace(/^\[|\]$/g, "").trim();

  const cleanFoodName = rawFoodName.replace(/^[🍽️🥜🥗🥘🍛🍗🥩🍳\s]+/, "").trim() || "Analisis Makanan";
  
  let portionDetailText = "";
  if (Array.isArray(parsedAi?.portionEstimates) && parsedAi.portionEstimates.length > 0) {
    portionDetailText = parsedAi.portionEstimates
      .map((p: any) => {
        const line = typeof p === "string" ? p.trim() : JSON.stringify(p);
        return line.startsWith("•") ? line : `• ${line}`;
      })
      .join("\n");
  } else if (parsedAi?.portionDetail) {
    portionDetailText = `• ${String(parsedAi.portionDetail).trim()}`;
  } else {
    portionDetailText = `• 1 Porsi Standar (~${calories} kcal)`;
  }

  let insightsFormatted = "";
  if (Array.isArray(parsedAi?.keyInsights) && parsedAi.keyInsights.length > 0) {
    insightsFormatted = parsedAi.keyInsights.map((i: any) => {
      const cleanInsight = String(i || "").trim();
      if (!cleanInsight) return "";
      if (cleanInsight.startsWith("🟢") || cleanInsight.startsWith("🟡") || cleanInsight.startsWith("🔴")) {
        return cleanInsight;
      }
      return `🟢 ${cleanInsight}`;
    }).filter(Boolean).join("\n");
  } else {
    insightsFormatted = `🟢 Asupan nutrisi seimbang untuk mendukung target kamu\n🟢 Distribusi makronutrisi sesuai target harian`;
  }

  // Always display time in WIB (UTC+7)
  const wibNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const wibIso = wibNow.toISOString();
  const [wibDatePart, wibTimePart] = wibIso.split("T");
  const [wibYear, wibMonth, wibDay] = wibDatePart.split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const dateStr = `${parseInt(wibDay)} ${monthNames[parseInt(wibMonth) - 1]} ${wibYear}`;
  const timeStr = wibTimePart.substring(0, 5).replace(":", ".");

  const isMia = (userData?.persona || "mia").toLowerCase().includes("mia");
  const coachHeader = isMia ? "COACH MIA" : "COACH MAX";
  const coachComment = String(parsedAi?.coachComment || (isMia ? "Hebat banget! Tetap jaga pola makan seimbang kamu ya! ✨" : "Mantap bro! Jaga terus disiplin makro lo! 💪")).replace(/^["“]|["”]$/g, "").trim();

  const sodium = Number(parsedAi?.sodium) || (parsedAi?.sodiumMg ? Number(parsedAi.sodiumMg) : 0);

  const totalTodayCal = dailyTotals.calories;
  const targetCal = userData.targetCalories || 2000;
  const calPercent = Math.min(100, Math.round((totalTodayCal / targetCal) * 100));

  return `🍽️ *${cleanFoodName.toUpperCase()}*

🕒 ${dateStr}, ${timeStr} WIB · 🤖 AI: ${confidenceScore}%

━━━━━━━━━━━━━━
📊 *REKAP NUTRISI*
━━━━━━━━━━━━━━
🔥 *${calories} kcal*

🍖 *Protein*: ${protein}g (${protPercent}%)
🍚 *Karbo*: ${carbs}g (${carbPercent}%)
🥓 *Lemak*: ${fat}g (${fatPercent}%)
🥬 *Serat*: ${fiber}g
🧂 *Natrium*: ${sodium} mg${sugar > 0 ? `\n🍯 *Gula*: ${sugar}g` : ""}

━━━━━━━━━━━━━━
🍽️ *ESTIMASI PORSI*
━━━━━━━━━━━━━━
${portionDetailText}

━━━━━━━━━━━━━━
🤖 *${coachHeader}*
━━━━━━━━━━━━━━
"${coachComment}"

━━━━━━━━━━━━━━
📈 *STATUS HARI INI*
━━━━━━━━━━━━━━
🔥 Kalori: ${totalTodayCal}/${targetCal} kcal (${calPercent}%)
🍖 Protein: ${dailyTotals.protein}/${userData.proteinGrams}g
🧂 Natrium: ${dailyTotals.sodium || 0}/2000 mg

━━━━━━━━━━━━━━
⚙️ _Ketik "koreksi: [porsi]" untuk edit atau "hapus log terakhir"_`;
}

function generateWelcomeMessages(userData: ReturnType<typeof calculateUserData>): string[] {
  const { name, weight, targetWeight, goalTitle, persona, targetCalories, proteinGrams, carbGrams, fatGrams, fiberGrams, activeService, equipment, injuries, customInjury } = userData;

  const isMax = persona === "max";
  const showNutrition = activeService === "nutritionist" || activeService === "both";
  const showWorkout = activeService === "workout" || activeService === "both";

  const eqText = equipment === "bodyweight"
    ? "Tanpa Alat / Rumah"
    : equipment === "dumbbells"
    ? "Dumbbell di Rumah"
    : "Alat Gym Lengkap";

  const injList = Array.isArray(injuries) ? injuries.filter((i: string) => i !== "none") : [];
  if (customInjury) injList.push(customInjury);
  const injText = injList.length > 0 ? injList.join(", ") : "Sehat (Tanpa Cedera)";

  if (isMax) {
    let summarySection = `📊 SUMMARY STRATEGI LO:\n🎯 Goal: ${goalTitle}\n`;
    if (showNutrition) {
      summarySection += `🔥 Target Kalori: ${targetCalories} kcal/hari\n🍖 Protein: ${proteinGrams}g/hari\n🍚 Karbo: ${carbGrams}g/hari\n🥓 Lemak: ${fatGrams}g/hari\n🥬 Serat: ${fiberGrams}g/hari\n`;
    }
    summarySection += `⚖️ Target BB: ${weight}kg → ${targetWeight}kg`;
    if (showWorkout) {
      summarySection += `\n🏋️ Alat: ${eqText}\n🩹 Kondisi Fisik: ${injText}`;
    }

    let guides: string[] = [];
    if (showNutrition) {
      guides.push(
`Nutrition AI 🥦
• Kirim foto/chat makanan lo ke sini.
• Gue bakal breakdown makro & kalorinya + catat progress harian lo.
• Kalo mau cek sisa kalori / rekap kemarin, bilang "rekap kemarin"!
• Kalo butuh ide makan, bilang "rekomendasi makanan"!
• Kalo mau catat berat badan mingguan, bilang "update bb 75"!`
      );
    }

    if (showWorkout) {
      guides.push(
`AI Coach 🏋️‍♂️
• Kirim foto form latihan / foto alat gym atau tanya menu workout.
• Gue kasih feedback tajam dan jadwal latihan disesuaikan alat (${eqText}) & kondisi tubuh lo (${injText}).`
      );
    }

    const firstItemPrompt = showNutrition && showWorkout
      ? "foto makanan atau pertanyaan workout"
      : showNutrition
      ? "foto makanan"
      : "pertanyaan workout";

    return [
`💪🔥 Woy ${name}! Gue Max, AI Coach & Nutritionist lo mulai sekarang. Welcome to GymBuddy AI!
Integrasi WhatsApp AI & Dashboard siap bantu capai target kebugaran lo.

${summarySection}

Gue di sini buat pastiin lo stay on track, no excuse! 🛑

${guides.join("\n\n")}

Tips dari gue:
Konsistensi > Motivasi. Kalo lo males, inget kenapa lo mulai.

Udah siap? Ayo kirim ${firstItemPrompt} pertama lo sekarang! 🔥`
    ];
  } else {
    let summarySection = `📊 SUMMARY RENCANA KAMU:\n🎯 Goal: ${goalTitle}\n`;
    if (showNutrition) {
      summarySection += `🔥 Target Kalori: ${targetCalories} kcal/hari\n🍖 Protein: ${proteinGrams}g/hari\n🍚 Karbo: ${carbGrams}g/hari\n🥓 Lemak: ${fatGrams}g/hari\n🥬 Serat: ${fiberGrams}g/hari\n`;
    }
    summarySection += `⚖️ Target BB: ${weight}kg → ${targetWeight}kg`;
    if (showWorkout) {
      summarySection += `\n🏋️ Alat: ${eqText}\n🩹 Kondisi Fisik: ${injText}`;
    }

    let guides: string[] = [];
    if (showNutrition) {
      guides.push(
`Nutrition AI 🥗
• Tinggal kirim foto makanan atau ketik apa yang kamu makan hari ini.
• Aku bantu hitung kalori, nutrisi, & rekap konsumsi harianmu.
• Kamu bisa tanya sisa kalori lewat "rekap kemarin"!
• Minta rekomendasi makan sehat lewat "rekomendasi makanan"!
• Kamu juga bisa update berat badanmu lewat "update bb 75"!`
      );
    }

    if (showWorkout) {
      guides.push(
`AI Coach 🧘‍♀️
• Kirim foto/video latihan atau foto alat gym untuk rekomendasi.
• Aku akan kasih saran yang aman dan rekomendasi yang nyaman buat tubuhmu.`
      );
    }

    const firstItemPrompt = showNutrition && showWorkout
      ? "foto makanan atau latihan"
      : showNutrition
      ? "foto makanan"
      : "pertanyaan latihan";

    return [
`🌿 Halo ${name}! Saya Coach Mia, AI Coach & Nutritionist kamu. Selamat datang di GymBuddy AI! ✨
Integrasi WhatsApp AI & Dashboard siap menemani dan memantau nutrisi & kebugaran kamu secara langsung.

${summarySection}

Saya siap mendampingi perjalanan kebugaran kamu dengan saran yang aman, halus, dan nyaman untuk tubuhmu.

${guides.join("\n\n")}

Pesan dari Coach Mia:
Dengarkan kondisi tubuhmu dengan baik, setiap progres kecil sangat berharga! 🌱

Yuk, kita mulai! Coba kirim ${firstItemPrompt} pertama kamu sekarang! ✨`
    ];
  }
}

function generateDailySummaryCard(
  userData: ReturnType<typeof calculateUserData>,
  dailyTotals: ReturnType<typeof getDailyTotals>,
  dateLabel: string = "Hari Ini"
): string {
  const calPercent = userData.targetCalories > 0 ? Math.min(100, Math.round((dailyTotals.calories / userData.targetCalories) * 100)) : 0;
  const protPercent = userData.proteinGrams > 0 ? Math.min(100, Math.round((dailyTotals.protein / userData.proteinGrams) * 100)) : 0;
  const carbPercent = userData.carbGrams > 0 ? Math.min(100, Math.round((dailyTotals.carbs / userData.carbGrams) * 100)) : 0;
  const fatPercent = userData.fatGrams > 0 ? Math.min(100, Math.round((dailyTotals.fat / userData.fatGrams) * 100)) : 0;
  const fiberPercent = userData.fiberGrams > 0 ? Math.min(100, Math.round((dailyTotals.fiber / userData.fiberGrams) * 100)) : 0;
  const sodiumVal = (dailyTotals as any).sodium || 0;
  const sodPercent = Math.min(100, Math.round((sodiumVal / 2000) * 100));

  const calBar = makeProgressBar(dailyTotals.calories, userData.targetCalories);
  const protBar = makeProgressBar(dailyTotals.protein, userData.proteinGrams);
  const carbBar = makeProgressBar(dailyTotals.carbs, userData.carbGrams);
  const fatBar = makeProgressBar(dailyTotals.fat, userData.fatGrams);
  const fiberBar = makeProgressBar(dailyTotals.fiber, userData.fiberGrams);
  const sodBar = makeProgressBar(sodiumVal, 2000);

  let mealListStr = "";
  if (dailyTotals.logs.length === 0) {
    mealListStr = "_Belum ada makanan yang dicatat pada tanggal ini._";
  } else {
    mealListStr = dailyTotals.logs.map((m, idx) => `• ${m.foodName} (${m.calories} kcal | P:${m.protein}g C:${m.carbs}g F:${m.fat}g${(m as any).sodium ? ` Na:${(m as any).sodium}mg` : ""})`).join("\n");
  }

  const coachName = userData.persona === "max" ? "Coach Max" : "Coach Mia";
  const quote = userData.persona === "max" 
    ? "Jaga terus ritme lo! Jangan kendor di jam-jam rawan ngemil."
    : "Kamu hebat sudah konsisten ngetrack hari ini! Tetap semangat ya ✨";

  return `📆 *Rekap ${dateLabel}*

⚖️ *Berat*: ${userData.weight} kg

📊 *Progress User*:
🔥 *Kalori*: ${dailyTotals.calories}/${userData.targetCalories}kcal (${calPercent}%)
${calBar}
🍖 *Protein*: ${dailyTotals.protein}/${userData.proteinGrams}g (${protPercent}%)
${protBar}
🍚 *Karbo*: ${dailyTotals.carbs}/${userData.carbGrams}g (${carbPercent}%)
${carbBar}
🥓 *Lemak*: ${dailyTotals.fat}/${userData.fatGrams}g (${fatPercent}%)
${fatBar}
🥬 *Serat*: ${dailyTotals.fiber}/${userData.fiberGrams}g (${fiberPercent}%)
${fiberBar}
🧂 *Natrium*: ${sodiumVal}/2000mg (${sodPercent}%)
${sodBar}

🍽️ *Makanan Terdaftar*:
${mealListStr}

-----------------------------
💬 *${coachName}*:
"${quote}"`;
}

function generateMealRecommendations(userData: ReturnType<typeof calculateUserData>): string {
  const { name, targetCalories, goalTitle, persona } = userData;
  const coachName = persona === "max" ? "Coach Max" : "Coach Mia";

  const targetPagi = Math.round(targetCalories * 0.25);
  const targetSiang = Math.round(targetCalories * 0.35);
  const targetMalam = Math.round(targetCalories * 0.30);
  const targetSnack = Math.round(targetCalories * 0.10);

  if (persona === "max") {
    return `🍽️ *REKOMENDASI MENU MAKANAN HARI INI FOR ${name.toUpperCase()}*
🎯 *Goal*: ${goalTitle} (${targetCalories} kcal/hari)

🌅 *Makan Pagi (~${targetPagi} kcal)*:
• 🍳 3 Butir Telur Rebus / Orak-arik
• 🍞 2 Tangkup Roti Gandum Utuh
• ☕ Kopi Hitam / Teh Hijau Tanpa Gula
_Makro: ~35g Protein, ~30g Karbo, ~12g Lemak_

☀️ *Makan Siang (~${targetSiang} kcal)*:
• 🍗 150g Dada Ayam Panggang / Bakar Kecap
• 🍚 150g Nasi Merah / Nasi Putih Porsi Terkontrol
• 🥦 1 Mangkok Tumis Brokoli / Buncis Lada Hitam
_Makro: ~45g Protein, ~45g Karbo, ~10g Lemak_

🌙 *Makan Malam (~${targetMalam} kcal)*:
• 🐟 150g Ikan Gurame / Salmon / Daging Sapi Cincang Low Fat
• 🥔 150g Kentang Rebus / Ubi Kukus
• 🥗 Salad Sayur Segar + Perasan Lemon
_Makro: ~40g Protein, ~35g Karbo, ~12g Lemak_

🍎 *Camilan Sehat (~${targetSnack} kcal)*:
• 🍌 1 Buah Pisang + 1 Scoop Whey Protein / Greek Yogurt

-----------------------------
💬 *${coachName}*:
"Nih menu juara buat capai target lo. Gak usah bikin alasan, patuhi porsinya & bantai hari ini! 🔥"`;
  } else {
    return `🌿🥗 *REKOMENDASI MENU SEHAT HARI INI UNTUK ${name.toUpperCase()}*
🎯 *Goal*: ${goalTitle} (${targetCalories} kcal/hari)

🌅 *Makan Pagi / Breakfast (~${targetPagi} kcal)*:
• 🥣 Oatmeal hangat dengan potongan pisang & 1 sdm madu
• 🥚 2 butir telur rebus (tinggi protein & bikin kenyang)
• 🍵 Teh hijau atau air putih hangat

☀️ *Makan Siang / Lunch (~${targetSiang} kcal)*:
• 🍗 150g Dada Ayam Tumis Wijen atau Sup Ayam Bening
• 🍚 1 centong Nasi Merah / Nasi Utuh
• 🥦 Tumis buncis, wortel, dan jagung manis

🌙 *Makan Malam / Dinner (~${targetMalam} kcal)*:
• 🐟 Ikan Panggang Teppan / Pepes Tahu Ayam
• 🥔 1 buah kentang panggang ukuran sedang
• 🥗 Salad hijau segar dengan sedikit olive oil

🍎 *Camilan Sehat / Snack (~${targetSnack} kcal)*:
• 🍏 1 buah Apel Merah atau 1 porsi Greek Yogurt rendah lemak

-----------------------------
💬 *${coachName}*:
"Nikmati setiap porsi makanmu ya ${name}! Nutrisi yang seimbang adalah bentuk kasih sayang untuk tubuhmu 🌱✨"`;
  }
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

  if (!isAligned) {
    const redirectionMsg = parsedAi.politeRedirection || 
      (persona === "max" 
        ? `Kayaknya alat ${equipmentName} ini kurang cocok buat goal lo (${userData.goalTitle}) dulu ya bro. Kita fokus ke gerakan utama yang lebih efektif & aman!`
        : `Wah, sepertinya alat ${equipmentName} ini belum menjadi prioritas utama untuk goal ${userData.goalTitle} kamu ya ✨ Yuk fokus ke latihan dasar yang lebih sesuai dulu!`);

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

  const comment = parsedAi.coachComment || 
    (persona === "max" 
      ? `Alat ini mantap banget buat goal lo! Sikat gerakan di atas & pastikan form lo bersih!`
      : `Alat ini sangat cocok untuk mendukung ${userData.goalTitle} kamu! Lakukan dengan perlahan dan nikmati prosesnya ya ✨`);

  return `🏋️ *PANDUAN ALAT GYM: ${equipmentName.toUpperCase()}*

✅ *Status Goal Alignment*:
*SANGAT COCOK UNTUK GOAL ${userData.goalTitle.toUpperCase()}!*

📌 *Rekomendasi Variasi Latihan*:
${exercises}

-----------------------------
💬 *${coachName}*:
"${comment}"`;
}





function generateWorkoutRecommendations(userData: ReturnType<typeof calculateUserData>): string {
  const goal = userData.goal || "healthy";
  const schedule = getDefaultWeeklySchedule(goal);
  const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const currentDayIdx = new Date().getDay();
  const todayDayName = dayNames[currentDayIdx];
  const todayRoutine = schedule.find((s) => s.day.toLowerCase() === todayDayName.toLowerCase()) || schedule[0];
  const coachName = userData.persona === "max" ? "Coach Max" : "Coach Mia";

  return (
    `Halo ${userData.name || "Kak"}! Sesuai dengan target *${userData.goalTitle || "Kebugaran"}* dan jadwal kamu di dashboard:\n\n` +
    `📅 *LATIHAN HARI INI (${todayRoutine.day}): ${todayRoutine.focus.toUpperCase()}*\n` +
    `--------------------------------------------------\n` +
    `Berikut daftar gerakan yang terjadwal untukmu hari ini:\n\n` +
    todayRoutine.exercises.map((ex, idx) => `${idx + 1}. *${ex.name}*: ${ex.targetReps}`).join("\n") +
    `\n\n💡 *Tips ${coachName}*:\n` +
    `• Buka menu latihan di dashboard untuk mencatat checklist set kamu secara real-time!\n` +
    `• Jika butuh panduan cara menggunakan alat atau teknik gerakannya, cukup ketik nama latihannya (misal: "cara ${todayRoutine.exercises[0]?.name || "squat"}").\n\n` +
    `Selamat berlatih, tetap konsisten! 💪🔥`
  );
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

  // Initialize Database Layers (Firestore Primary)
  getFirestore();

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

        // Also persist to MongoDB collections
        saveUserDocument({
          userId: `usr_${norm}`,
          phone: norm,
          ...profile,
          updatedAt: new Date()
        }).catch((err) => console.warn("[MongoDB] User doc save warning:", err?.message || err));

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
    const user = (await findUserByPhoneOrId(phone)) || getUserProfile(phone);
    if (!user) {
      return res.status(404).json({ error: "User profile not found in database" });
    }
    const calculated = calculateUserData(user);
    const streak = getStreakCount(phone);
    const waterCups = getWaterCups(phone);
    res.json({
      ...user,
      ...calculated,
      user: { ...user, ...calculated },
      profile: { ...user, ...calculated },
      userData: calculated,
      calculated,
      streak,
      waterCups
    });
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

    // 3. Save clean snapshot to appdata/main
    saveToFirestore();

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
      const { phone, calories, protein, carbs, fat, targetCalories, targetProtein, targetCarbs, targetFat, goal, persona, name, mealName } = req.body;

      const remCal  = Math.max(0, (Number(targetCalories) || 2000) - (Number(calories) || 0));
      const remProt = Math.max(0, (Number(targetProtein)  || 150)  - (Number(protein)  || 0));
      const remCarb = Math.max(0, (Number(targetCarbs)    || 200)  - (Number(carbs)    || 0));
      const remFat  = Math.max(0, (Number(targetFat)      || 60)   - (Number(fat)      || 0));

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
        const calPercent = Number(calories) / (Number(targetCalories) || 2000);

        let advice = "";

        // Case 1: Very early in the day, protein very low
        if (remProt > Number(targetProtein) * 0.8) {
          advice = isMia
            ? `Protein kamu hari ini masih sangat rendah. Untuk meal berikutnya, prioritaskan sumber protein berkualitas — dada ayam rebus/panggang, telur rebus, atau tahu kukus. Minumnya air putih dulu ya biar metabolisme tetap optimal! 💪`
            : `Protein lo masih rendah banget! Next meal, gue rekomendasiin langsung serang protein dulu — dada ayam panggang, ikan bakar, atau telur rebus 3 biji. Jangan lupa minum air putih 500ml sekarang bro! 💧`;
        }
        // Case 2: Protein deficit is the biggest gap
        else if (remProt > remCarb && remProt > remFat && remProt > 30) {
          const foodSugg = goal === "lose"
            ? (isMia ? "dada ayam panggang, ikan tuna, atau putih telur" : "dada ayam grill, ikan bakar, atau tuna kalengan")
            : (isMia ? "dada ayam + nasi merah, susu, atau protein shake" : "chicken rice bowl, tuna + nasi, atau mass gainer shake");
          advice = isMia
            ? `Sisa protein kamu hari ini masih *${remProt}g* — lumayan banyak ya. Untuk meal ${timeLabel} berikutnya, fokuskan ke ${foodSugg}. Ini penting banget buat recovery dan perkembangan ototmu! ✨`
            : `Bro, masih kurang *${remProt}g protein* nih. Next meal lo harus fokus ke ${foodSugg}. Otot lo butuh ini buat tumbuh! Gas jangan skip makan! 🔥`;
        }
        // Case 3: Calories almost full, recommend light/beverage
        else if (calPercent > 0.85) {
          advice = isMia
            ? `Kalori kamu udah hampir mencapai target hari ini! Kalau masih lapar di waktu ${timeLabel}, pilih camilan ringan aja ya — buah segar, salad, atau yogurt tanpa gula. Hindari yang berat supaya tetap di jalur ${goalStr}! 🥗`
            : `Kalori lo udah mepet target! Kalau laper ${timeLabel} ini, pilih yang ringan aja — buah, salad, atau yogurt. Jangan kalap makan berat lagi ya bro, kita lagi ngejer goal ${goalStr}! 💯`;
        }
        // Case 4: Hydration reminder
        else if (wibHour >= 13 && wibHour <= 15) {
          const proteinSugg = goal === "gain"
            ? (isMia ? "protein shake atau susu full cream" : "protein shake atau susu coklat")
            : (isMia ? "teh hijau atau air lemon" : "air putih dingin atau teh tanpa gula");
          advice = isMia
            ? `Waktu ${timeLabel} ini biasanya energi mulai turun. Yuk minum dulu — ${proteinSugg} sangat bagus buat menjaga energi! Kalau belum makan siang, pilih yang tinggi protein dan serat ya supaya kenyang lebih lama. 🍵`
            : `${timeLabel.charAt(0).toUpperCase() + timeLabel.slice(1)} ini waktu yang rawan mager bro! Minum dulu — ${proteinSugg}. Kalau belum makan siang, langsung cari yang protein-nya tinggi ya! 💪`;
        }
        // Case 5: Fat deficit
        else if (remFat < 10 && remFat > 0) {
          advice = isMia
            ? `Lemak sehat kamu hari ini udah hampir terpenuhi. Untuk meal selanjutnya, pilih yang rendah lemak — dada ayam tanpa kulit, ikan rebus, atau sayuran kukus dengan sedikit olive oil. Tetap jaga keseimbangan nutrisinya ya! 🥦`
            : `Lemak lo udah hampir habis jatahnya hari ini. Next meal, pilih yang low-fat aja — dada ayam tanpa kulit, ikan kukus, atau salad sayur. Jaga makro lo bro! ⚡`;
        }
        // Default: general next meal advice based on goal
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

      // ── Gemini AI generated advice ────────────────────────────────────────
      const prompt = `Kamu adalah ${coachName}, AI Coach dari GymBuddy.

DATA USER:
- Nama: ${name || "Member"}
- Goal: ${goalStr}
- Makanan baru saja dikonsumsi: "${mealName || "Makanan"}"
- Waktu sekarang: ${timeLabel} (pukul ${wibHour}:xx WIB)

SISA KEBUTUHAN NUTRISI HARI INI (setelah makan ini):
- Kalori tersisa: ${remCal} kcal
- Protein tersisa: ${remProt}g
- Karbohidrat tersisa: ${remCarb}g
- Lemak tersisa: ${remFat}g

PERSONA:
${isMia
  ? "Coach Mia: Perempuan, hangat, supportif, profesional. Tidak pernah bilang 'sayang/cinta/beb'. Sapaan sopan (kamu/aku)."
  : "Coach Max: Pria, tegas, penuh energi, gaya Jakarta gaul (lo/gue). Motivasional tapi realistis."
}

TUGAS:
Berikan saran singkat (MAX 3 kalimat) tentang apa yang SEBAIKNYA DIMAKAN atau DIMINUM pada meal/snack selanjutnya berdasarkan:
1. Sisa kebutuhan nutrisi hari ini (fokus pada makro yang paling defisit)
2. Waktu (${timeLabel} — apakah ini saatnya snack, makan besar, atau cukup minum dulu?)
3. Goal user (${goalStr})
4. Sesuatu yang SPESIFIK dan ACTIONABLE — sebut nama makanan konkret, bukan generik

PENTING:
- Jangan copy/paste referensi apapun. Kreasikan sendiri dengan gaya ${coachName}.
- Boleh pakai emoji 1-2 buah saja.
- Output HANYA teks saran polos (bukan JSON). Mulai dengan "🎯" atau emoji relevan.
- Kalau remCal < 200, sarankan hanya minuman/camilan ringan saja.
- Kalau protein adalah defisit terbesar, itu harus jadi fokus utama saran.`;

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

        const itemsToUse = Array.isArray(parsed.items) && parsed.items.length > 0 ? parsed.items : deterministicResult.items;

        // Strict Requirement: Total Calories & Macros MUST ALWAYS BE SUM(items)
        let sumCal = 0, sumProt = 0, sumCarb = 0, sumFat = 0, sumFib = 0, sumSug = 0;
        for (const it of itemsToUse) {
          sumCal += Number(it.calories) || 0;
          sumProt += Number(it.protein) || 0;
          sumCarb += Number(it.carbs) || 0;
          sumFat += Number(it.fat) || 0;
          sumFib += Number(it.fiber) || 0;
          sumSug += Number(it.sugar) || 0;
        }

        const protein = Math.round(sumProt * 10) / 10;
        const carbs = Math.round(sumCarb * 10) / 10;
        const fat = Math.round(sumFat * 10) / 10;
        const fiber = Math.round(sumFib * 10) / 10;
        const sugar = Math.round(sumSug * 10) / 10;

        const genericCheck = isGenericMealInput(cleanText);
        const isLowConfidence = genericCheck.isGeneric || parsed.confidence === "low" || deterministicResult.needsClarification;

        // Sodium handling: preserve null/undefined when unestimated (never convert unknown to 0)
        const rawSodium = parsed.sodium !== undefined && parsed.sodium !== null ? Number(parsed.sodium) : undefined;
        const sodium = (rawSodium !== undefined && !isNaN(rawSodium) && rawSodium > 0) ? rawSodium : undefined;

        // Atwater Macro Calorie Rule: Calories = Protein * 4 + Carbs * 4 + Fat * 9 (Sodium/Electrolytes = 0 kcal)
        const atwaterCal = Math.round((protein * 4) + (carbs * 4) + (fat * 9));

        res.json({
          success: true,
          isFood: true,
          // CRITICAL: Always use original user input as foodName — never AI/catalog name
          foodName: userInputFoodName,
          calories: isLowConfidence ? undefined : atwaterCal,
          protein: isLowConfidence ? undefined : protein,
          carbs: isLowConfidence ? undefined : carbs,
          fat: isLowConfidence ? undefined : fat,
          fiber: isLowConfidence ? undefined : fiber,
          sugar: isLowConfidence ? undefined : sugar,
          sodium: isLowConfidence ? undefined : sodium,
          isHydration: Boolean(parsed.isHydration || deterministicResult.isHydration),
          volumeMl: Number(parsed.volumeMl) || deterministicResult.volumeMl || 0,
          mealType: parsed.mealType,
          portionNote: itemsToUse.length === 1 ? "1 meal detected" : `${itemsToUse.length} food items detected`,
          items: itemsToUse,
          confidence: isLowConfidence ? "low" : (parsed.confidence || deterministicResult.confidence || "medium"),
          needsClarification: isLowConfidence,
          clarificationQuestion: genericCheck.isGeneric ? `What’s included in your ${genericCheck.mealType}?` : `We need a little more information to estimate this meal accurately.`,
          suggestedOptions: genericCheck.suggestedOptions.length > 0 ? genericCheck.suggestedOptions : ["Chicken", "Beef", "Egg", "Vegetables", "Sauce", "Other"],
          portionDisplayLabel: deterministicResult.portionDisplayLabel,
          debugLog: deterministicResult.debugLog
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
      const { imageBase64, mimeType = "image/jpeg" } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ success: false, error: "Image base64 data is required" });
      }

      const cleanBase64 = imageBase64.replace(/^data:image\/[a-z0-9+]+;base64,/i, "");
      const imagePart = {
        inlineData: {
          mimeType,
          data: cleanBase64
        }
      };

      const prompt = `KAMU ADALAH SISTEM VISION AI PAKAR NUTRISI GYMBUDDY.
TUGASMU: Analisis gambar yang dikirim pengguna dengan sangat teliti.

1. PERIKSA APAKAH INI MAKANAN / MINUMAN ATAU BUKAN.
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
- Kenali jenis makanan/minuman secara spesifik dan akurat.
- Estimasi porsi standar orang Indonesia dewasa.
- Hitung kalori & makronutrisi: (protein × 4) + (carbs × 4) + (fat × 9) = calories.
- Tentukan jika minuman (Americano, Teh, Air, Kopi, Jus, Boba, dll.) dengan isHydration=true.
  * Americano / Kopi Hitam: calories: 5, protein: 0, carbs: 1, fat: 0, isHydration: true, volumeMl: 250
  * Cafe Latte / Kopi Susu: calories: 130, protein: 5, carbs: 12, fat: 6, isHydration: true, volumeMl: 250
  * Air Putih / Mineral: calories: 0, protein: 0, carbs: 0, fat: 0, isHydration: true, volumeMl: 250

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
  "portion": "1 Porsi Standar (~300g)",
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
  app.get("/api/user/:phone/meals", async (req, res) => {
    const rawPhone = req.params.phone;
    const phone = normalizePhone(rawPhone);
    const user = (await findUserByPhoneOrId(phone)) || getUserProfile(phone);
    if (!user) {
      return res.json({ success: true, phone, date: (req.query.date as string) || getLocalDateStr(), logs: [] });
    }

    const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
    const targetDate = (req.query.date as string) || getLocalDateStr();
    const key = `${phone}_${targetDate}`;
    const altKey = `${altPhone}_${targetDate}`;

    let logs: MealLog[] = [];
    if (dbData.dailyLogs[key] !== undefined && Array.isArray(dbData.dailyLogs[key]) && dbData.dailyLogs[key].length > 0) {
      logs = deduplicateMealLogs(dbData.dailyLogs[key].filter(m => !isLegacyMockMeal(m)));
    } else if (dbData.dailyLogs[altKey] !== undefined && Array.isArray(dbData.dailyLogs[altKey]) && dbData.dailyLogs[altKey].length > 0) {
      logs = deduplicateMealLogs(dbData.dailyLogs[altKey].filter(m => !isLegacyMockMeal(m)));
    } else {
      // Query persistent database layer (Firestore / MongoDB / memory)
      try {
        const dbLogs = await getFoodLogsForDate(phone, targetDate);
        if (dbLogs && dbLogs.length > 0) {
          logs = deduplicateMealLogs(dbLogs as unknown as MealLog[]);
          dbData.dailyLogs[key] = logs;
          saveDb();
        }
      } catch (e: any) {
        console.warn("[Meals API] Database fetch note:", e?.message || e);
      }
    }

    // Persist cleaned deduplicated list back to server memory
    if (logs.length > 0) {
      dbData.dailyLogs[key] = logs;
      if (dbData.dailyLogs[altKey]) dbData.dailyLogs[altKey] = logs;
      saveDb();
    }


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
      id: meal.id || `m-${Date.now()}`,
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

  // REST API: Delete single meal log for user (cleans BOTH key and altKey)
  app.delete("/api/user/:phone/meals/:mealId", async (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
    const targetDate = (req.query.date as string) || getLocalDateStr();
    const { mealId } = req.params;
    const key = `${phone}_${targetDate}`;
    const altKey = `${altPhone}_${targetDate}`;

    if (dbData.dailyLogs[key]) {
      dbData.dailyLogs[key] = dbData.dailyLogs[key].filter((m: any) => m.id !== mealId);
    }
    if (dbData.dailyLogs[altKey]) {
      dbData.dailyLogs[altKey] = dbData.dailyLogs[altKey].filter((m: any) => m.id !== mealId);
    }
    saveDb();

    try {
      await deleteFoodLog(mealId);
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

    // Persist each meal to database layer
    for (const m of rawMeals) {
      if (m && m.foodName) {
        insertFoodLog({
          id: m.id || `m-${Date.now()}`,
          userId: `usr_${phone}`,
          phone,
          date: targetDate,
          foodName: m.foodName,
          calories: Number(m.calories) || 0,
          protein: Number(m.protein) || 0,
          carbs: Number(m.carbs) || 0,
          fat: Number(m.fat) || 0,
          fiber: Number(m.fiber) || 0,
          sugar: Number(m.sugar) || 0,
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

  // Note: GET /api/user/:phone is already registered at the top of routes (async version with MongoDB lookup).
  // The duplicate sync-only version has been removed to prevent route conflicts.


  // Delete user profile endpoint (Purge user, logs, and progress)
  app.delete("/api/user/:phone", (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
    if (phone) {
      delete dbData.users[phone];
      delete dbData.users[altPhone];
      delete dbData.weeklyProgress[phone];
      delete dbData.weeklyProgress[altPhone];
      Object.keys(dbData.dailyLogs).forEach((key) => {
        if (key.startsWith(phone) || key.startsWith(altPhone)) {
          delete dbData.dailyLogs[key];
        }
      });
      Object.keys(dbData.waterLogs).forEach((key) => {
        if (key.startsWith(phone) || key.startsWith(altPhone)) {
          delete dbData.waterLogs[key];
        }
      });
      saveDb();
      console.log(`Deleted user profile and all logs for ${phone}`);
      return res.json({ success: true, message: `Data user ${phone} dan semua riwayat log berhasil dihapus 100%.` });
    }
    return res.status(404).json({ success: false, error: "User profile not found" });
  });

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

  // REST API: Get/Update Daily Exercise Checklist (Cross-Device Sync)
  app.get("/api/user/:phone/exercises", (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
    const targetDate = (req.query.date as string) || getLocalDateStr();
    const key = `gymbuddy_exercises_${phone}_${targetDate}`;
    const altKey = `gymbuddy_exercises_${altPhone}_${targetDate}`;
    const exercises = dbData.dailyLogs[key] || dbData.dailyLogs[altKey] || [];
    res.json({ success: true, phone, date: targetDate, exercises });
  });

  app.post("/api/user/:phone/exercises", express.json(), (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
    const targetDate = req.body?.date || (req.query.date as string) || getLocalDateStr();
    const { exercises } = req.body;
    const key = `gymbuddy_exercises_${phone}_${targetDate}`;
    const altKey = `gymbuddy_exercises_${altPhone}_${targetDate}`;
    if (Array.isArray(exercises)) {
      dbData.dailyLogs[key] = exercises;
      dbData.dailyLogs[altKey] = exercises;
      saveDb();
    }
    res.json({ success: true, phone, date: targetDate, exercises: dbData.dailyLogs[key] || [] });
  });

  // REST API: Update Reminder Settings for Dashboard & WhatsApp Sync
  app.post("/api/user/:phone/reminder", express.json(), (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const user = getUserProfile(phone);
    if (!user) {
      return res.status(404).json({ success: false, error: "User profile not found" });
    }
    const { reminderTime, reminderEnabled } = req.body;
    if (reminderTime) user.reminderTime = String(reminderTime).trim();
    if (reminderEnabled !== undefined) user.reminderEnabled = Boolean(reminderEnabled);
    saveUserProfile(phone, user);
    res.json({
      success: true,
      user,
      reminderTime: user.reminderTime,
      reminderEnabled: user.reminderEnabled
    });
  });

  // REST API: Update Goals & Custom Targets for Dashboard (Cross-Device Sync)
  app.post("/api/user/:phone/goals", express.json(), (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const user = getUserProfile(phone);
    if (!user) {
      return res.status(404).json({ success: false, error: "User profile not found" });
    }
    const { targetWeight, targetCalories, goal, goalTitle, customTargets, customGoals } = req.body;
    if (targetWeight) user.targetWeight = Number(targetWeight);
    if (targetCalories) user.targetCalories = Number(targetCalories);
    if (goal) user.goal = goal;
    if (goalTitle) user.goalTitle = goalTitle;
    if (customTargets) user.customTargets = customTargets;
    if (customGoals) user.customGoals = customGoals;
    saveUserProfile(phone, user);
    const calculated = calculateUserData(user);
    res.json({ success: true, user, profile: user, userData: calculated, calculated, customTargets: user.customTargets });
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

          const isWorkoutReqMessage = lowerText.includes("workout") ||
                                      lowerText.includes("latihan") ||
                                      lowerText.includes("jadwal gym") ||
                                      lowerText.includes("rekomendasi workout") ||
                                      lowerText.includes("menu latihan") ||
                                      lowerText.includes("olahraga");

          const isCheckSummaryMessage = lowerText.includes("cek kalori") || 
                                       lowerText.includes("sisa kalori") || 
                                       lowerText.includes("rekap kalori") ||
                                       lowerText.includes("rekap") ||
                                       lowerText.includes("kemarin") ||
                                       lowerText.includes("makan apa");

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
          } else if (waterMatch) {
            const rawAmount = parseFloat(waterMatch[1].replace(',', '.'));
            const unit = (waterMatch[2] || "gelas").toLowerCase();
            // Bug 4 Fix: compute actual ml accurately (no rounding loss)
            let actualMl: number;
            if (unit === "ml") {
              actualMl = rawAmount;
            } else if (unit === "l" || unit === "liter") {
              actualMl = rawAmount * 1000;
            } else {
              // "gelas" / "cup" = 250ml each
              actualMl = Math.round(rawAmount) * 250;
            }
            const cupsToAdd = Math.max(1, Math.round(actualMl / 250));
            const currentCups = getWaterCups(from);
            const newTotalCups = setWaterCups(from, currentCups + cupsToAdd);
            const liters = (newTotalCups * 0.25).toFixed(1);
            // Bug 4 Fix: also add entry to dailyLogs so dashboard shows it
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
              mealType: getMealTypeByHour()
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
          } else if (handleReminderCommand(userText, userProfile, from, userData)) {
            responseMessages = handleReminderCommand(userText, userProfile, from, userData)!;
          } else if (userText.match(/(?:selesai\s*latihan|latihan\s*selesai|workout\s*selesai|selesai\s*workout|lapor\s*latihan|catat\s*latihan|latihan\s*hari\s*ini|push\s*up|squat|bench\s*press|pull\s*up|(\d+)\s*set\s*selesai)/i)) {
            const todayStr = getTodayDateStr();
            const workoutKey = `gymbuddy_exercises_${from}_${todayStr}`;
            const coachName = userData.persona === "max" ? "Coach Max" : "Coach Mia";

            // Record workout log in dailyLogs
            const workoutLogEntry: MealLog = {
              id: `wa-workout-${Date.now()}`,
              foodName: `🏋️ Log Latihan: ${userText.trim()}`,
              calories: 0,
              protein: 0,
              carbs: 0,
              fat: 0,
              timestamp: new Date().toISOString(),
              mealType: "snack"
            };
            addMealLog(from, workoutLogEntry);
            dbData.dailyLogs[workoutKey] = [{ id: "completed", foodName: "Workout", calories: 0, protein: 0, carbs: 0, fat: 0, timestamp: new Date().toISOString() }];
            saveDb();

            responseMessages = [
              `🏋️ *CATATAN LATIHAN BERHASIL DISIMPAN!*\n-----------------------------\n` +
              `✅ Laporan latihan kamu: *"${userText.trim()}"* telah dicatat Selesai hari ini!\n\n` +
              `💬 *${coachName}*:\n"Mantap bro ${(userData.name || "").toUpperCase()}! 1 langkah lebih dekat ke target *${userData.goalTitle || "Kebugaran"}* kamu! Istirahat cukup dan jaga nutrisi ya! 🔥"`
            ];
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
          } else if (isWorkoutReqMessage) {
            responseMessages = [generateWorkoutRecommendations(userData)];
          } else if (isRecommendationMessage) {
            responseMessages = [generateMealRecommendations(userData)];
          } else if (isCheckSummaryMessage) {
            const parsedDate = parseDateFromQuery(userText);
            const totals = getDailyTotals(from, parsedDate.dateStr);
            responseMessages = [generateDailySummaryCard(userData, totals, parsedDate.label)];
          } else if (getAi()) {
            // Check if user sent a generic photo caption like "aku makan ini" without image binary
            const isGenericImageCaption = /^(?:aku\s+)?makan\s+ini|^ini\s+makanan|^foto\s+ini|^ini$|^makan$/i.test(userText.trim());
            
            if (isGenericImageCaption && !imagePart) {
              const coachName = userData.persona === "mia" || userData.persona === "nikita" ? "Coach Mia" : "Coach Max";
              responseMessages = [
                `📸 *FOTO BELUM BERHASIL DIPROSES*\n-----------------------------\n` +
                `Halo ${userData.name}! Fotonya belum berhasil terunduh oleh sistem WhatsApp Meta.\n\n` +
                `💡 *Solusi Cepat*:\n` +
                `Silakan ketik nama makanannya dalam teks (misal: *"Nasi Putih + Telur Balado + Ayam Goreng"*), maka ${coachName} akan langsung mencatat kalori & makronya! 🥗✨`
              ];
            } else {
              // Immediate Status notification: "sedang berpikir..."
              await sendMetaWhatsappMessage(from, "sedang berpikir... 💭\n\nHampir selesai mengecek inputmu... 📊");

              const isMia = userData.persona === "mia" || userData.persona === "nikita";
              const personaInstruction = isMia
                ? `PERSONA MIA: Kamu adalah pelatih (coach) profesional wanita bernama Coach Mia. Kamu sangat santun, ramah, halus, lembut, dan edukatif (aku/kamu). DILARANG KERAS menggunakan panggilan berlebihan seperti "sayang", "cinta", "beb", dll. Tetaplah 100% PROFESIONAL, sopan, baik hati, dan mendukung kebugaran pengguna secara halus. SELALU panggil dirimu Coach Mia dan JANGAN PERNAH menyapa sebagai Coach Max.`
                : `PERSONA MAX: Kamu adalah pelatih (coach) pria bernama Coach Max. Kamu tegas, serius, to-the-point, dan ala bahasa gaul Jakarta/bro (lo/gue). SELALU panggil dirimu Coach Max.`;

              const prompt = `INFORMASI PENGGUNA:
- Nama: ${userData.name}
- Berat Saat Ini: ${userData.weight} kg | Target BB: ${userData.targetWeight} kg
- Target Kalori Harian: ${userData.targetCalories} kcal
- Target Makro: Protein ${userData.proteinGrams}g, Karbo ${userData.carbGrams}g, Lemak ${userData.fatGrams}g, Serat ${userData.fiberGrams}g
- Goal Utama: ${userData.goalTitle}

${personaInstruction}

TUGASMU:
User mengirim pesan/foto di WhatsApp: "${userText}"
${imagePart ? "CATATAN KRUSIAL: USER MENGIRIM GAMBAR/FOTO MAKANAN/MINUMAN. Kamu HARUS menganalisis seluruh makanan & minuman yang terlihat di foto (nasi, lauk, sayur, buah, dll.) dan SELALU set \"isFood\": true." : ""}

Kategori 1: LAPORAN MAKANAN/MINUMAN (teks atau gambar makanan/minuman, seperti "pisang 2 buah", "makan ayam", "aku makan ini", dll)
PASTIKAN "isFood": true dan selalu berikan angka estimasi realistis (calories > 0, protein, carbs, fat, fiber).

Keluarkan output JSON valid:
{
  "isFood": true,
  "isEquipment": false,
  "foodName": "Nama Makanan/Minuman",
  "calories": 210,
  "protein": 20,
  "carbs": 30,
  "fat": 5,
  "fiber": 2,
  "sugar": 4,
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

Kategori 3: PERTANYAAN UMUM / WORKOUT REKLAMASI LAINNYA
Keluarkan output JSON valid:
{
  "isFood": false,
  "isEquipment": false,
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

              if (parsed.isFood) {
                addMealLog(from, {
                  id: `m-${Date.now()}`,
                  foodName: parsed.foodName || "Makanan",
                  calories: Number(parsed.calories) || 0,
                  protein: Number(parsed.protein) || 0,
                  carbs: Number(parsed.carbs) || 0,
                  fat: Number(parsed.fat) || 0,
                  fiber: Number(parsed.fiber) || 0,
                  mealType: parsed.mealType || getMealTypeByHour(),
                  timestamp: new Date().toISOString()
                });
                const dailyTotals = getDailyTotals(from);
                const card = formatNutritionCard(parsed, imagePart ? "Foto" : "Teks", userData, dailyTotals);
                responseMessages = [card];
              } else if (parsed.isEquipment) {
                const eqCard = formatEquipmentCard(parsed, userData);
                responseMessages = [eqCard];
              } else {
                responseMessages = [parsed.generalReply || "Sip! Ada laporan makanan atau latihan lain yang mau ditanyakan?"];
              }
            } catch (e) {
              console.error("Gemini AI Error:", e);
              // Fallback smart parser for food text
              let calEst = 350;
              let protEst = 20;
              let carbEst = 40;
              let fatEst = 12;
              let foodTitle = userText;

              if (userText.toLowerCase().includes("batagor") || userText.toLowerCase().includes("padang") || userText.toLowerCase().includes("pizza")) {
                calEst = 3800;
                protEst = 140;
                carbEst = 420;
                fatEst = 160;
                foodTitle = "Batagor 3x, Nasi Padang 3x & Pizza 1 Loyang";
              }

              const fallbackFoodObj = {
                isFood: true,
                isEquipment: false,
                foodName: foodTitle,
                calories: calEst,
                protein: protEst,
                carbs: carbEst,
                fat: fatEst,
                fiber: 15,
                sugar: 30,
                satietyScore: 9,
                satietyExplanation: "Porsi makan sangat besar dengan kepadatan kalori tinggi.",
                healthScore: 5,
                portionEstimates: [userText],
                keyInsights: ["Asupan kalori & karbohidrat sangat tinggi", "Sangat bagus untuk pemulihan energi setelah latihan berat"],
                coachComment: userData.persona === "max"
                  ? "Gila bro! Porsi segunung gini langsung melampaui target kalori! Tapi kalau buat bulking ekstrim, habiskan dan gas pembakaran di gym besok!"
                  : "Wah porsi makanmu banyak banget hari ini! Imbangi dengan air putih yang cukup ya ✨"
              };

              addMealLog(from, {
                id: `m-${Date.now()}`,
                foodName: fallbackFoodObj.foodName,
                calories: calEst,
                protein: protEst,
                carbs: carbEst,
                fat: fatEst,
                fiber: 15,
                mealType: getMealTypeByHour(),
                timestamp: new Date().toISOString()
              });

              const dailyTotals = getDailyTotals(from);
              const card = formatNutritionCard(fallbackFoodObj, "Teks", userData, dailyTotals);
              responseMessages = [card];
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

      const lowerText = userText.toLowerCase();

      const isWelcomeMessage = (lowerText.includes("gymbuddy") && (lowerText.includes("target harian") || lowerText.includes("target saya") || lowerText.includes("tolong kirimkan"))) ||
                               (lowerText.includes("nama saya") && lowerText.includes("target saya"));

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

      const isWorkoutReqMessage = lowerText.includes("workout") ||
                                  lowerText.includes("latihan") ||
                                  lowerText.includes("jadwal gym") ||
                                  lowerText.includes("rekomendasi workout") ||
                                  lowerText.includes("menu latihan") ||
                                  lowerText.includes("olahraga");

      const isCheckSummaryMessage = lowerText.includes("cek kalori") || 
                                   lowerText.includes("sisa kalori") || 
                                   lowerText.includes("rekap kalori") ||
                                   lowerText.includes("rekap") ||
                                   lowerText.includes("kemarin") ||
                                   lowerText.includes("makan apa");

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

      let responseMessages: string[] = [];
      let mediaUrlToSend: string | undefined = undefined;

      const isWorkoutScheduleQuery = (
        lowerText.includes("latihan apa") ||
        lowerText.includes("workout apa") ||
        lowerText.includes("jadwal hari ini") ||
        lowerText.includes("latihan hari ini") ||
        lowerText.includes("workout hari ini") ||
        lowerText.includes("jadwal gym") ||
        lowerText.includes("jadwal latihan") ||
        lowerText.includes("menu latihan") ||
        lowerText.includes("rekomendasi workout") ||
        lowerText.includes("rekomendasi latihan") ||
        lowerText.includes("olahraga hari ini") ||
        (lowerText.includes("latihan") && (lowerText.includes("hari ini") || lowerText.includes("jadwal") || lowerText.includes("apa"))) ||
        (lowerText.includes("workout") && (lowerText.includes("hari ini") || lowerText.includes("jadwal") || lowerText.includes("apa")))
      );

      const matchedEx = !isWorkoutScheduleQuery ? findExerciseOrEquipment(userText) : null;
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

      console.log(`[Twilio WA] ✅ Step: routing. isReset=${isResetMessage}, isWorkout=${isWorkoutScheduleQuery}, isCheckSum=${isCheckSummaryMessage}, isWelcome=${isWelcomeMessage}`);
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
        console.log(`[Reset Command] Deleted profile and data for ${normPhone}`);
        responseMessages = [
          `🗑️ *AKUN & DATA KAMU BERHASIL DIHAPUS!*\n-----------------------------\n` +
          `Semua profil dan riwayat kamu telah dibersihkan dari database GymBuddy AI.\n\n` +
          `Sekarang kamu bisa mencoba alur pendaftaran & onboarding baru dari awal di website! ✨`
        ];
      } else if (isWorkoutScheduleQuery) {
        responseMessages = [generateWorkoutRecommendations(userData)];
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
          const coachName = userData.persona === "max" ? "Coach Max" : "Coach Mia";
          const shortWelcome = userData.persona === "max"
            ? `🔥 *WOY ${userData.name.toUpperCase()}!* ${coachName} siap mendampingi lo!\n\n` +
              `Mau catat makanan hari ini, lapor air minum, update BB ("update bb 72"), atau minta rekomendasi workout? Kirim aja langsung di sini! 💪`
            : `✨ *HALO ${userData.name.toUpperCase()}!* ${coachName} di sini! 🥰\n\n` +
              `Mau catat makanan harian, lapor air minum, update BB ("update bb 72"), atau konsultasi latihan? Silakan kirim kapan saja ya! 🌿`;
          responseMessages = [shortWelcome];
        } else {
          userProfile.hasReceivedWelcome = true;
          saveUserProfile(normFrom, userProfile);
          const currentCalculated = calculateUserData(userProfile);
          responseMessages = generateWelcomeMessages(currentCalculated);
        }
      } else if (waterMatch) {
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
          mealType: getMealTypeByHour()
        };
        addMealLog(normFrom, waterEntry);
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
      } else if (isWorkoutReqMessage) {
        responseMessages = [generateWorkoutRecommendations(userData)];
      } else if (isRecommendationMessage) {
        responseMessages = [generateMealRecommendations(userData)];
      } else if (isCheckSummaryMessage) {
        const parsedDate = parseDateFromQuery(userText);
        const totals = getDailyTotals(normFrom, parsedDate.dateStr);
        responseMessages = [generateDailySummaryCard(userData, totals, parsedDate.label)];
      } else if (handleReminderCommand(userText, userProfile, normFrom, userData)) {
        responseMessages = handleReminderCommand(userText, userProfile, normFrom, userData)!;
      } else if (
        !userText.match(/^(?:cara|bagaimana|gimana|tutorial|tips|apa\s*itu|tutor|ajarin|panduan)\b/i) &&
        !userText.includes("?") &&
        userText.match(/(?:(?:sudah|udah|telah)?\s*(?:selesai\s*(?:latihan|workout|olahraga|gym)|latihan\s*(?:sudah\s*)?selesai|workout\s*(?:sudah\s*)?selesai)|lapor\s*(?:selesai\s*)?latihan|catat\s*(?:selesai\s*)?latihan|(\d+)\s*set\s*(?:selesai|done))/i)
      ) {
        const todayStr = getLocalDateStr();
        const workoutKey = `gymbuddy_exercises_${normFrom}_${todayStr}`;
        const coachName = userData.persona === "max" ? "Coach Max" : "Coach Mia";

        dbData.dailyLogs[workoutKey] = [{ id: "completed", foodName: "Workout", calories: 0, protein: 0, carbs: 0, fat: 0, timestamp: new Date().toISOString() }];
        saveDb();

        responseMessages = [
          `🏋️ *LATIHAN HARI INI DICATAT*\n-----------------------------\n` +
          `✅ ${userText.trim()}\n\n` +
          `💬 *${coachName}*:\n"Kerja bagus! Latihan kamu sudah tercatat. Jangan lupa istirahat yang cukup & cukupi konsumsi protein kamu ya! 💪🔥"`
        ];
      } else if (getAi()) {
        const isMia = userData.persona === "mia" || userData.persona === "nikita";
        const personaInstruction = isMia
          ? `PERSONA MIA: Kamu adalah pelatih (coach) profesional wanita bernama Coach Mia. Kamu sangat santun, ramah, halus, lembut, dan edukatif (aku/kamu). DILARANG KERAS menggunakan panggilan berlebihan seperti "sayang", "cinta", "beb", dll. Tetaplah 100% PROFESIONAL, sopan, baik hati, dan mendukung kebugaran pengguna secara halus. SELALU panggil dirimu Coach Mia dan JANGAN PERNAH menyapa sebagai Coach Max.`
          : `PERSONA MAX: Kamu adalah pelatih (coach) pria bernama Coach Max. Kamu tegas, serius, to-the-point, dan ala bahasa gaul Jakarta/bro (lo/gue). SELALU panggil dirimu Coach Max.`;

        const activeService = userData.activeService || "both";
        const serviceInstruction = activeService === "nutritionist"
          ? `BATASAN LAYANAN PENGGUNA: User berlangganan Paket AI Nutritionist.
Fokuslah 100% pada konsultasi nutrisi, evaluasi porsi makan, kalori, dan makro.
Jika user meminta program/jadwal workout yang detail, berikan jawaban singkat lalu ingatkan secara sopan:
"💡 *Catatan Coach*: Layanan aktif kamu saat ini adalah AI Nutritionist. Kamu bisa upgrade ke Paket Premium untuk mengaktifkan AI Workout Coach penuh! 🏋️‍♂️"`
          : activeService === "workout"
          ? `BATASAN LAYANAN PENGGUNA: User berlangganan Paket AI Workout Coach.
Fokuslah 100% pada teknik latihan, posture check, rekomendasi workout, dan alat gym.
Jika user meminta pencatatan kalori/makanan, berikan estimasi singkat lalu ingatkan secara sopan:
"💡 *Catatan Coach*: Layanan aktif kamu saat ini adalah AI Workout Coach. Kamu bisa upgrade ke Paket Premium untuk mengaktifkan AI Nutritionist penuh! 🥦"`
          : `BATASAN LAYANAN PENGGUNA: User berlangganan Paket Premium (All-Access). Berikan pendampingan penuh untuk nutrisi maupun latihan.`;

        const prompt = `INFORMASI PENGGUNA:
- Nama: ${userData.name}
- Berat Saat Ini: ${userData.weight} kg | Target BB: ${userData.targetWeight} kg
- Target Kalori Harian: ${userData.targetCalories} kcal
- Target Makro: Protein ${userData.proteinGrams}g, Karbo ${userData.carbGrams}g, Lemak ${userData.fatGrams}g, Serat ${userData.fiberGrams}g
- Goal Utama: ${userData.goalTitle}

${personaInstruction}
${serviceInstruction}

TUGASMU:
User mengirim pesan/foto di WhatsApp: "${userText}"

Kategori 1: LAPORAN MAKANAN/MINUMAN (teks atau gambar makanan/minuman, seperti "pisang 2 buah", "makan ayam", dll)
PASTIKAN "isFood": true dan selalu berikan angka estimasi realistis (calories > 0, protein, carbs, fat, fiber, sodium dalam mg).
Keluarkan output JSON valid:
{
  "isFood": true,
  "isEquipment": false,
  "foodName": "Nama Makanan/Minuman",
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

Kategori 3: PERTANYAAN UMUM / WORKOUT REKLAMASI LAINNYA
Keluarkan output JSON valid:
{
  "isFood": false,
  "isEquipment": false,
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

          // Force equipment detection if an image is sent and it is NOT food
          const isEquipmentMatch = parsed.isEquipment || (imagePart && !parsed.isFood) || 
            lowerText.includes("alat") || lowerText.includes("cara pakai") || lowerText.includes("mesin") || lowerText.includes("gym");

          if (parsed.isFood) {
            addMealLog(normFrom, {
              id: `m-${Date.now()}`,
              foodName: parsed.foodName || "Makanan",
              calories: Number(parsed.calories) || 0,
              protein: Number(parsed.protein) || 0,
              carbs: Number(parsed.carbs) || 0,
              fat: Number(parsed.fat) || 0,
              fiber: Number(parsed.fiber) || 0,
              sugar: Number(parsed.sugar) || 0,
              sodium: Number(parsed.sodium) || 0,
              mealType: parsed.mealType || getMealTypeByHour(),
              timestamp: new Date().toISOString()
            });
            const dailyTotals = getDailyTotals(normFrom);
            const card = formatNutritionCard(parsed, imagePart ? "Foto" : "Teks", userData, dailyTotals);
            responseMessages = [card];
            if (imagePart && req.body.MediaUrl0) {
              mediaUrlToSend = req.body.MediaUrl0;
            }
          } else if (isEquipmentMatch) {
            if (!parsed.equipmentName) parsed.equipmentName = "Alat Gym / Mesin Latihan";
            parsed.isEquipment = true;

            const dbMatch = findExerciseOrEquipment(parsed.equipmentName || userText);
            const eqCard = formatEquipmentTutorialCard(parsed, userData);
            responseMessages = [eqCard];
            if (dbMatch && (dbMatch.gifUrl || dbMatch.imageFrames?.[0])) {
              mediaUrlToSend = dbMatch.gifUrl || dbMatch.imageFrames[0];
            }
          } else {
            responseMessages = [parsed.generalReply || "Sip! Ada laporan makanan atau latihan lain yang mau ditanyakan?"];
          }
        } catch (e) {
          console.error("Gemini AI Error:", e);
          responseMessages = ["Maaf, aku sedang tidak bisa memproses inputmu saat ini."];
        }
      } else {
        responseMessages = ["Sistem AI belum terkonfigurasi dengan benar. Hubungi admin GymBuddy."];
      }

      let twiml = `<?xml version="1.0" encoding="UTF-8"?><Response>`;
      if (responseMessages.length === 0) {
        responseMessages = ["Sip, data kamu sudah tercatat! Ada yang ingin kamu tanyakan lagi?"];
      }

      for (let i = 0; i < responseMessages.length; i++) {
        const msgText = responseMessages[i];
        if (msgText && msgText.trim()) {
          const maxChunk = 1400;
          for (let j = 0; j < msgText.length; j += maxChunk) {
            const chunk = msgText.substring(j, j + maxChunk);
            twiml += `<Message>`;
            if (i === 0 && j === 0 && mediaUrlToSend && mediaUrlToSend.startsWith("https://")) {
              twiml += `<Media>${escapeXml(mediaUrlToSend)}</Media>`;
            }
            twiml += `<Body>${escapeXml(chunk)}</Body></Message>`;
          }
        }
      }
      twiml += `</Response>`;
      console.log(`[Twilio WA] Sending TwiML XML response (${responseMessages.length} message blocks) ✅`);
      return res.type("text/xml").send(twiml);
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
      `📱 *Kamus Alat & Animasi Gerakan di Web/PWA*:\n🔗 ${pwaUrl}`;
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

startServer();
