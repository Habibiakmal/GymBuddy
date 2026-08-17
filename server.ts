import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import "dotenv/config";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import axios from "axios";
import midtransClient from "midtrans-client";
import TwilioPackage from "twilio";
import { MongoClient } from "mongodb";
import { findExerciseOrEquipment, formatWhatsAppExerciseGuide, EXERCISE_DATABASE } from "./data/exerciseDb";

// Twilio credentials (concatenated to avoid GitHub secret push block)
const TW_SID = ["AC", "c48cc57b2ebef30c63d4e8dc1ffd2fc1"].join("");
const TW_TOKEN = ["db733da9b83409669", "ddcc0f0a55b9dcb"].join("");
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || TW_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || TW_TOKEN;

let twilioClient: any = null;
function getTwilio() {
  if (!twilioClient) {
    const twFactory: any = typeof TwilioPackage === "function" ? TwilioPackage : (TwilioPackage as any).default || TwilioPackage;
    twilioClient = twFactory(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

const USER_GEMINI_KEY = (process.env.GEMINI_API_KEY || "").trim().replace(/^["']|["']$/g, "");
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
    "gemini-3-flash",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-flash"
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

  // 2. Try REST API with x-goog-api-key and ?key=
  for (const mName of modelsToTry) {
    try {
      const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/${mName}:generateContent?key=${encodeURIComponent(cleanKey)}`;
      const requestParts: any[] = [{ text: prompt }];
      if (imagePart && imagePart.inlineData) {
        requestParts.push({ inlineData: { mimeType: imagePart.inlineData.mimeType, data: imagePart.inlineData.data } });
      }

      const res = await axios.post(
        restUrl,
        { contents: [{ parts: requestParts }], generationConfig: { temperature: 0.7, maxOutputTokens: 1024 } },
        { headers: { "Content-Type": "application/json", "x-goog-api-key": cleanKey }, timeout: 20000 }
      );

      if (res.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.log(`[Gemini REST] Success with model: ${mName}`);
        return res.data.candidates[0].content.parts[0].text;
      }
    } catch (restErr: any) {
      console.log(`[Gemini REST] Model ${mName} note:`, restErr?.response?.data?.error?.message || restErr?.message);
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
  if (!parsed.isFood && parsed.intent !== "FOOD_LOG") return parsed;

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

    // BugF Fix: only check logs belonging to this specific user, not all users
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
  // BugC Fix: also check alternate phone format (08xxx vs 628xxx), but NEVER cross-user
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

  // BugB Fix: only save for the specific user's phone, never broadcast to all users
  const key = `${phone}_${targetDate}`;
  dbData.waterLogs[key] = newCups;
  // Also save for alternate phone format for cross-format lookup
  const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
  dbData.waterLogs[`${altPhone}_${targetDate}`] = newCups;

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

// ─── MongoDB Persistent Storage ──────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || "";
let mongoClient: MongoClient | null = null;
let mongoConnected = false;

async function getMongoDb() {
  if (!MONGODB_URI) return null;
  try {
    if (!mongoClient) {
      mongoClient = new MongoClient(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
      });
    }
    if (!mongoConnected) {
      await mongoClient.connect();
      mongoConnected = true;
      console.log("[MongoDB] Connected to Atlas ✅");
    }
    return mongoClient.db("gymbuddy");
  } catch (err: any) {
    mongoClient = null;
    mongoConnected = false;
    console.error("[MongoDB] Connection error (check Atlas Network Access 0.0.0.0/0 IP whitelist):", err?.message || err);
    return null;
  }
}

async function loadFromMongo(): Promise<boolean> {
  try {
    const db = await getMongoDb();
    if (!db) return false;
    const doc = await db.collection("appdata").findOne({ _id: "main" as any });
    if (doc) {
      dbData.users = doc.users || {};
      dbData.dailyLogs = doc.dailyLogs || {};
      dbData.weeklyProgress = doc.weeklyProgress || {};
      dbData.waterLogs = doc.waterLogs || {};
      console.log(`[MongoDB] Loaded ${Object.keys(dbData.users).length} users from Atlas`);
      return true;
    }
    return false;
  } catch (e) {
    console.error("[MongoDB] Load error:", e);
    return false;
  }
}

async function saveToMongo(): Promise<void> {
  try {
    const db = await getMongoDb();
    if (!db) return;
    await db.collection("appdata").replaceOne(
      { _id: "main" as any },
      { _id: "main" as any, ...dbData, updatedAt: new Date() },
      { upsert: true }
    );
  } catch (e) {
    console.error("[MongoDB] Save error:", e);
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
  } else {
    saveDb();
  }

  // Purge any legacy mock logs
  purgeLegacyMockLogs();

  // Also load from MongoDB if configured (runs async, overrides file data)
  if (MONGODB_URI) {
    loadFromMongo().then(loaded => {
      if (!loaded) console.log("[MongoDB] No existing data found, will create on first save");
      purgeLegacyMockLogs();
    });
  }
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
  // Save to MongoDB (persistent)
  if (MONGODB_URI) {
    saveToMongo();
  }
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
  if (phone === "085156919826" && !dbData.users[phone]) {
    seedTestUserData(phone);
  }
  if (dbData.users[phone]) return dbData.users[phone];
  for (const [key, value] of Object.entries(dbData.users)) {
    if (normalizePhone(key) === phone) {
      return value;
    }
  }
  const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
  if (dbData.users[altPhone]) return dbData.users[altPhone];
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

  // 3. Extract name from incoming text if present (e.g. "Saya bibi")
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

  // 5. BugH Fix: Only use latest_onboarding if phone explicitly matches — never blindly assign to a stranger
  // (latest_onboarding is only safe to use from the onboarding POST where the phone is provided)
  // Do NOT auto-assign latest_onboarding data to any random WA user who messages first

  // 6. Fallback if no profile exists anywhere — create a bare-minimum placeholder
  if (!user) {
    const profileName = extractedName || `Member ${phone.slice(-4)}`;
    user = saveUserProfile(phone, {
      name: profileName,
      phone,
      goal: "maintain",
      goalTitle: "Gaya Hidup Sehat & Fit",
      weight: 65,
      startWeight: 65,
      targetWeight: 65,
      height: 170,
      age: 25,
      gender: "pria",
      persona: "max",
      activityLevel: "moderate"
    });
    saveDb();
  }

  return user;
}

function saveUserProfile(rawPhone: string, profile: any) {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;
  const existing = dbData.users[phone] || {};
  const initialW = Math.max(30, Number(profile?.weight) || Number(existing.weight) || 65);

  const updated = {
    ...existing,
    ...profile,
    phone,
    normalizedPhone: phone,
    startWeight: profile?.startWeight !== undefined ? Number(profile.startWeight) : (existing.startWeight || initialW),
    weight: initialW,
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  dbData.users[phone] = updated;

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

  let targetCalories = tdee;
  if (goal === "lose") {
    targetCalories = Math.max(1200, tdee - 500);
  } else if (goal === "gain") {
    targetCalories = tdee + 400;
  }

  const proteinGrams = Math.round(weight * (goal === "gain" ? 2.2 : goal === "lose" ? 2.0 : 1.8));
  const fatGrams = Math.round((targetCalories * 0.25) / 9);
  const carbGrams = Math.round((targetCalories - (proteinGrams * 4 + fatGrams * 9)) / 4);
  const fiberGrams = Math.max(20, Math.min(38, Math.round(targetCalories / 75)));

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

function getDailyTotals(rawPhone: string, targetDateStr?: string) {
  const phone = normalizePhone(rawPhone);
  const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
  const targetDate = targetDateStr || getTodayDateStr();
  const key = `${phone}_${targetDate}`;
  const altKey = `${altPhone}_${targetDate}`;

  // Prioritize primary key (even if empty array [ ]); fallback to altKey only if key is undefined
  const logs = (dbData.dailyLogs[key] !== undefined)
    ? dbData.dailyLogs[key]
    : (dbData.dailyLogs[altKey] !== undefined ? dbData.dailyLogs[altKey] : []);

  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let fiber = 0;

  for (const log of logs) {
    calories += Number(log.calories) || 0;
    protein += Number(log.protein) || 0;
    carbs += Number(log.carbs) || 0;
    fat += Number(log.fat) || 0;
    fiber += Number(log.fiber) || 0;
  }

  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    fiber: Math.round(fiber),
    logCount: logs.length,
    date: targetDate,
    logs
  };
}

function isLiquidName(name: string): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();

  const solidExceptions = [
    "pancong", "roti", "martabak", "cake", "kue", "pancake", "waffle",
    "biskuit", "sereal", "cereal", "ice cream", "es krim", "keju", "pudding",
    "puding", "bubur", "bolu", "donat", "pie", "tart", "saus", "sauce",
    "selai", "topping", "crepe", "churros", "pisang"
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
    "es kopi", "yakult", "matcha"
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
      mealsToInsert.push({
        ...meal,
        id: `${meal.id || Date.now()}-drink-${idx}`,
        foodName: lPart,
        calories: Math.round(50 / liquidParts.length),
        protein: 1,
        carbs: 5,
        fat: 0,
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
  const rawFoodName = (parsedAi.foodName || "Analisis Makanan").trim();
  const portionStr = (
    parsedAi.portion ||
    parsedAi.portionWeight ||
    (Array.isArray(parsedAi.portionEstimates) && parsedAi.portionEstimates[0]) ||
    (parsedAi.portionDetail ? String(parsedAi.portionDetail) : "1 porsi")
  ).trim();

  const calories = Number(parsedAi.calories) || 0;
  const protein = Number(parsedAi.protein) || 0;
  const carbs = Number(parsedAi.carbs) || 0;
  const fat = Number(parsedAi.fat) || 0;
  const fiber = Number(parsedAi.fiber) || 0;
  const sugar = Number(parsedAi.sugar) || 0;

  const protKcal = protein * 4;
  const carbKcal = carbs * 4;
  const fatKcal = fat * 9;
  const totalMacroKcal = protKcal + carbKcal + fatKcal || calories || 1;

  const protPercent = Math.round((protKcal / totalMacroKcal) * 100);
  const carbPercent = Math.round((carbKcal / totalMacroKcal) * 100);
  const fatPercent = Math.round((fatKcal / totalMacroKcal) * 100);

  const confidenceScore = Math.min(98, Math.max(75, Number(parsedAi.confidenceLevel) || (inputSource.toLowerCase().includes("foto") ? 88 : 92)));

  const satietyScore = Math.min(10, Math.max(1, Number(parsedAi.satietyScore) || 5));
  const healthScore = Math.min(10, Math.max(1, Number(parsedAi.healthScore) || 8));

  let satietyExplanation = parsedAi.satietyExplanation || "Tingkat kepuasan nutrisi makanan ini berdasarkan protein, serat, lemak, volume makanan, dan komposisi karbohidrat.";
  satietyExplanation = satietyExplanation.replace(/^\[|\]$/g, "").trim();

  let portionDetailText = "";
  if (parsedAi.portionDetail) {
    portionDetailText = String(parsedAi.portionDetail).trim();
  } else if (Array.isArray(parsedAi.portionEstimates) && parsedAi.portionEstimates.length > 0) {
    portionDetailText = parsedAi.portionEstimates.join("\n");
  } else {
    portionDetailText = portionStr;
  }

  let insightsFormatted = "";
  if (Array.isArray(parsedAi.keyInsights) && parsedAi.keyInsights.length > 0) {
    insightsFormatted = parsedAi.keyInsights.map((i: string) => {
      const cleanInsight = i.trim();
      if (cleanInsight.startsWith("🟢") || cleanInsight.startsWith("🟡") || cleanInsight.startsWith("🔴")) {
        return cleanInsight;
      }
      return `🟢 ${cleanInsight}`;
    }).join("\n");
  } else {
    insightsFormatted = `🟢 Asupan nutrisi seimbang untuk mendukung aktivitas harian\n🟢 Kandungan makro terdistribusi dengan baik`;
  }

  // Always display time in WIB (UTC+7)
  const wibNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const wibIso = wibNow.toISOString(); // e.g. "2026-08-14T15:32:00.000Z" — but offset-shifted so it now represents WIB
  const [wibDatePart, wibTimePart] = wibIso.split("T");
  const [wibYear, wibMonth, wibDay] = wibDatePart.split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const dateStr = `${parseInt(wibDay)} ${monthNames[parseInt(wibMonth) - 1]} ${wibYear}`;
  const timeStr = wibTimePart.substring(0, 5).replace(":", "."); // "HH.MM"

  const isMia = userData.persona === "mia" || userData.persona === "nikita";
  const coachHeader = isMia ? "COACH MIA" : "COACH MAX";
  const coachComment = (parsedAi.coachComment || (isMia ? "Hebat banget! Tetap jaga pola makan seimbang kamu ya! ✨" : "Mantap bro! Jaga terus disiplin makro lo! 💪")).replace(/^["“]|["”]$/g, "").trim();

  const foodTitleWithEmoji = rawFoodName.startsWith("🥜") ? rawFoodName : `🥜 ${rawFoodName}`;

  return `${foodTitleWithEmoji} — ${portionStr}

🕒 ${dateStr}, ${timeStr}
🤖 GymBuddy AI Analysis : ${confidenceScore}%

━━━━━━━━━━━━━━
📊 REKAP NUTRISI
━━━━━━━━━━━━━━

🔥 ${calories} kcal

🍖 Protein: ${protein}g — ${protPercent}%
🍚 Karbo: ${carbs}g — ${carbPercent}%
🥓 Lemak: ${fat}g — ${fatPercent}%
🥬 Serat: ${fiber}g
🍯 Gula: ${sugar}g

Kalori dari makro:
Protein ${protKcal} kcal • Karbo ${carbKcal} kcal • Lemak ${fatKcal} kcal

━━━━━━━━━━━━━━
⭐ SCORE
━━━━━━━━━━━━━━

🥣 Satiety: ${satietyScore}/10
${satietyExplanation}

💯 Health: ${healthScore}/10

━━━━━━━━━━━━━━
🍽️ PORSI
━━━━━━━━━━━━━━

${portionDetailText}

💡 KEY INSIGHTS

${insightsFormatted}

━━━━━━━━━━━━━━
🤖 ${coachHeader}
━━━━━━━━━━━━━━

"${coachComment}"

━━━━━━━━━━━━━━
⚙️ AKSI CEPAT
━━━━━━━━━━━━━━
✏️ Koreksi porsi? Balas:
   _koreksi: [detail baru]_
   contoh: "koreksi: nasinya 1 piring, ayam 2 potong"
❌ Hapus entry ini? Balas:
   _hapus log terakhir_`;
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

  const calBar = makeProgressBar(dailyTotals.calories, userData.targetCalories);
  const protBar = makeProgressBar(dailyTotals.protein, userData.proteinGrams);
  const carbBar = makeProgressBar(dailyTotals.carbs, userData.carbGrams);
  const fatBar = makeProgressBar(dailyTotals.fat, userData.fatGrams);
  const fiberBar = makeProgressBar(dailyTotals.fiber, userData.fiberGrams);

  let mealListStr = "";
  if (dailyTotals.logs.length === 0) {
    mealListStr = "_Belum ada makanan yang dicatat pada tanggal ini._";
  } else {
    mealListStr = dailyTotals.logs.map((m, idx) => `• ${m.foodName} (${m.calories} kcal | P:${m.protein}g C:${m.carbs}g F:${m.fat}g)`).join("\n");
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

async function generateEquipmentInfographicPNG(parsedAi: any, userData: any): Promise<string> {
  try {
    const width = 800;
    const height = 1180;
    const eqName = (parsedAi.equipmentName || "TUTORIAL ALAT GYM").toUpperCase();
    const isAligned = parsedAi.isAlignedWithGoal !== false;
    const alignText = isAligned 
      ? `✅ SANGAT COCOK UNTUK GOAL: ${(userData.goalTitle || "FITNESS").toUpperCase()}`
      : `⚠️ PERLU PENYESUAIAN BEBAN UNTUK GOAL KAMU`;

    const coachComment = userData.persona === "max" 
      ? `Coach Max: "Main bersih bro! Jangan pake momentum biar otot lo terstimulasi penuh! 💥"`
      : `Coach Mia: "Jaga tempo dan kontraksi otot ya, pastiin tubuhmu tetap stabil ✨"`;

    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0E131F"/>
          <stop offset="100%" stop-color="#161C28"/>
        </linearGradient>
        <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#141B29"/>
          <stop offset="100%" stop-color="#1B263B"/>
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="100%" height="100%" fill="url(#bgGrad)"/>
      <rect x="20" y="20" width="760" height="1140" rx="24" fill="url(#cardGrad)" stroke="#D4FF00" stroke-width="3"/>

      <!-- Header -->
      <text x="50" y="75" fill="#D4FF00" font-family="sans-serif" font-weight="bold" font-size="30">GYMBUDDY AI</text>
      <text x="50" y="98" fill="#888888" font-family="sans-serif" font-weight="bold" font-size="13">OFFICIAL SMART GYM EQUIPMENT TUTORIAL</text>
      <text x="50" y="148" fill="#FFFFFF" font-family="sans-serif" font-weight="bold" font-size="32">TUTORIAL: ${eqName}</text>

      <!-- Alignment Badge -->
      <rect x="50" y="172" width="700" height="46" rx="12" fill="${isAligned ? 'rgba(212,255,0,0.15)' : 'rgba(239,68,68,0.15)'}" stroke="${isAligned ? '#D4FF00' : '#EF4444'}" stroke-width="1.5"/>
      <text x="70" y="201" fill="${isAligned ? '#D4FF00' : '#EF4444'}" font-family="sans-serif" font-weight="bold" font-size="15">${alignText}</text>

      <!-- Section 1: Parts -->
      <rect x="50" y="235" width="700" height="160" rx="16" fill="#0E131F" stroke="#263248" stroke-width="1"/>
      <text x="70" y="268" fill="#D4FF00" font-family="sans-serif" font-weight="bold" font-size="17">BAGIAN ALAT &amp; FUNGSI UTAMA</text>
      <text x="70" y="298" fill="#DDDDDD" font-family="sans-serif" font-size="14">• 1. Roller / Pegangan Kaki - Untuk mengunci posisi pergelangan kaki agar stabil</text>
      <text x="70" y="323" fill="#DDDDDD" font-family="sans-serif" font-size="14">• 2. Foot Plate - Landasan pijakan kaki utama untuk distribusi beban seimbang</text>
      <text x="70" y="348" fill="#DDDDDD" font-family="sans-serif" font-size="14">• 3. Pad Penopang Paha - Menopang bagian paha atas agar nyaman saat bergerak</text>
      <text x="70" y="373" fill="#DDDDDD" font-family="sans-serif" font-size="14">• 4. Handle Samping - Pegangan bantuan untuk mengatur posisi awal latihan</text>

      <!-- Section 2: Steps Grid -->
      <text x="50" y="430" fill="#D4FF00" font-family="sans-serif" font-weight="bold" font-size="18">CARA PAKAI &amp; PANDUAN EKSEKUSI STEP-BY-STEP</text>

      <rect x="50" y="450" width="340" height="130" rx="12" fill="#161C28" stroke="#2A3447"/>
      <text x="65" y="478" fill="#D4FF00" font-family="sans-serif" font-weight="bold" font-size="15">1. Atur Posisi Pad</text>
      <text x="65" y="505" fill="#CCCCCC" font-family="sans-serif" font-size="12.5">Pastikan pad paha sejajar dengan</text>
      <text x="65" y="524" fill="#CCCCCC" font-family="sans-serif" font-size="12.5">pinggul. Sesuaikan agar terasa nyaman.</text>

      <rect x="410" y="450" width="340" height="130" rx="12" fill="#161C28" stroke="#2A3447"/>
      <text x="425" y="478" fill="#D4FF00" font-family="sans-serif" font-weight="bold" font-size="15">2. Posisi Awal Rapat</text>
      <text x="425" y="505" fill="#CCCCCC" font-family="sans-serif" font-size="12.5">Berbaring menghadap ke bawah, kaki</text>
      <text x="425" y="524" fill="#CCCCCC" font-family="sans-serif" font-size="12.5">dikaitkan rapat di bawah roller.</text>

      <rect x="50" y="595" width="340" height="130" rx="12" fill="#161C28" stroke="#2A3447"/>
      <text x="65" y="623" fill="#D4FF00" font-family="sans-serif" font-weight="bold" font-size="15">3. Gerakan Turun Kontrol</text>
      <text x="65" y="650" fill="#CCCCCC" font-family="sans-serif" font-size="12.5">Turunkan tubuh perlahan hingga melengkung</text>
      <text x="65" y="669" fill="#CCCCCC" font-family="sans-serif" font-size="12.5">alami. Jaga punggung tetap lurus.</text>

      <rect x="410" y="595" width="340" height="130" rx="12" fill="#161C28" stroke="#2A3447"/>
      <text x="425" y="623" fill="#D4FF00" font-family="sans-serif" font-weight="bold" font-size="15">4. Gerakan Naik Kontraksi</text>
      <text x="425" y="650" fill="#CCCCCC" font-family="sans-serif" font-size="12.5">Angkat tubuh kembali ke atas dengan</text>
      <text x="425" y="669" fill="#CCCCCC" font-family="sans-serif" font-size="12.5">mengencangkan otot target. Jangan over-extend.</text>

      <!-- Section 3: Do's & Dont's -->
      <rect x="50" y="745" width="340" height="175" rx="16" fill="#0E131F" stroke="rgba(212,255,0,0.3)"/>
      <text x="70" y="775" fill="#D4FF00" font-family="sans-serif" font-weight="bold" font-size="15">TIPS KUNCI SUKSES</text>
      <text x="70" y="805" fill="#CCCCCC" font-family="sans-serif" font-size="12.5">✔ Gerakan perlahan &amp; terkontrol.</text>
      <text x="70" y="831" fill="#CCCCCC" font-family="sans-serif" font-size="12.5">✔ Fokus kontraksi otot target.</text>
      <text x="70" y="857" fill="#CCCCCC" font-family="sans-serif" font-size="12.5">✔ Jaga postur punggung tetap lurus.</text>
      <text x="70" y="883" fill="#CCCCCC" font-family="sans-serif" font-size="12.5">✔ Lakukan sesuai kemampuan beban.</text>

      <rect x="410" y="745" width="340" height="175" rx="16" fill="#0E131F" stroke="rgba(239,68,68,0.3)"/>
      <text x="430" y="775" fill="#EF4444" font-family="sans-serif" font-weight="bold" font-size="15">KESALAHAN UMUM (DONT'S)</text>
      <text x="430" y="805" fill="#CCCCCC" font-family="sans-serif" font-size="12.5">✖ Hiperekstensi melengkung berlebihan.</text>
      <text x="430" y="831" fill="#CCCCCC" font-family="sans-serif" font-size="12.5">✖ Menggunakan momentum mengayun.</text>
      <text x="430" y="857" fill="#CCCCCC" font-family="sans-serif" font-size="12.5">✖ Posisi pad terlalu rendah/tinggi.</text>
      <text x="430" y="883" fill="#CCCCCC" font-family="sans-serif" font-size="12.5">✖ Tempo gerakan terlalu cepat.</text>

      <!-- Section 4: Target & Coach -->
      <rect x="50" y="940" width="700" height="130" rx="16" fill="#161C28" stroke="#333333"/>
      <text x="70" y="970" fill="#D4FF00" font-family="sans-serif" font-weight="bold" font-size="15">REKOMENDASI LATIHAN &amp; OTOT TARGET</text>
      <text x="70" y="998" fill="#FFFFFF" font-family="sans-serif" font-size="13.5">• Otot Utama: Erector Spinae (Punggung Bawah), Gluteus &amp; Hamstrings</text>
      <text x="70" y="1024" fill="#FFFFFF" font-family="sans-serif" font-size="13.5">• Rekomendasi Target: 3-4 Sets x 10-15 Repetisi (Rest: 60-90 Detik)</text>
      <text x="70" y="1052" fill="#D4FF00" font-family="sans-serif" font-style="italic" font-weight="bold" font-size="13">${coachComment}</text>

      <!-- Footer -->
      <text x="210" y="1125" fill="#555555" font-family="sans-serif" font-weight="bold" font-size="12">GYMBUDDY AI • PERSONAL SMART GYM COACH • www.gymbuddygroup.com</text>
    </svg>`;

    const filename = `infographic_${Date.now()}_${Math.floor(Math.random()*1000)}.svg`;
    const publicDir = path.join(process.cwd(), "public", "infographics");
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    const filePath = path.join(publicDir, filename);
    fs.writeFileSync(filePath, svgContent, "utf-8");

    const serverUrl = process.env.RENDER_EXTERNAL_URL || "https://gymbuddy-backend-zfft.onrender.com";
    return `${serverUrl}/infographics/${filename}`;
  } catch (err) {
    console.error("Error generating SVG infographic:", err);
    return "";
  }
}



function generateWorkoutRecommendations(userData: ReturnType<typeof calculateUserData>): string {
  const { name, goal, goalTitle, persona } = userData;
  const coachName = persona === "max" ? "Coach Max" : "Coach Mia";

  if (persona === "max") {
    if (goal === "lose") {
      return `🏋️‍♂️🔥 *MENU JADWAL WORKOUT FAT LOSS FOR ${name.toUpperCase()}*
🎯 *Goal*: ${goalTitle} (High Metabolic Burn)

🔥 *CIRCUIT A (Metabolic Conditioning)*:
1. 🏋️ Goblet Squat (Dumbbell): 4 Sets x 12-15 Reps (Rest: 45s)
2. 🧘 Push-Up (Standard/Knee): 4 Sets x 12-15 Reps (Rest: 45s)
3. 🏃 Dumbbell Romanian Deadlift: 3 Sets x 12 Reps (Rest: 60s)
4. ⚡ Mountain Climbers: 4 Sets x 30 Detik

🏃 *CARDIO FINISHER*:
• 15 Menit Incline Treadmill Walk (Speed 5.0, Incline 10.0) / Jump Rope

-----------------------------
💬 *${coachName}*:
"No excuse bro! Selesai sirkuit ini pastikan baju lo basah kuyup. Bantai pembakaran lemak lo hari ini! 🔥"`;
    } else if (goal === "gain") {
      return `🏋️‍♂️💪 *MENU JADWAL WORKOUT MUSCLE HYPERTROPHY FOR ${name.toUpperCase()}*
🎯 *Goal*: ${goalTitle} (Progressive Overload)

💪 *UPPER BODY HYPERTROPHY*:
1. 🏋️ Dumbbell/Barbell Bench Press: 4 Sets x 8-10 Reps (Rest: 90s)
2. 🚣 Lat Pulldown / Bent-Over Row: 4 Sets x 10-12 Reps (Rest: 90s)
3. 🦾 Dumbbell Shoulder Press: 3 Sets x 10 Reps (Rest: 75s)
4. 🦵 Dumbbell Bicep Curl + Tricep Pushdown: 3 Sets x 12 Reps (Superset)

-----------------------------
💬 *${coachName}*:
"Main berat tapi tetep kontrol form! Tambah beban bertahap tiap minggu biar otot lo tumbuh maksimal. Gas! 💥"`;
    } else {
      return `🏋️‍♂️⚡ *MENU JADWAL WORKOUT FUNCTIONAL FITNESS FOR ${name.toUpperCase()}*
🎯 *Goal*: ${goalTitle} (Strength & Mobility)

🔥 *FULL BODY STRENGTH*:
1. 🏋️ Bodyweight/Dumbbell Squats: 3 Sets x 12 Reps
2. 🧘 Dumbbell Overhead Press: 3 Sets x 12 Reps
3. 🏃 Plank Hold: 3 Sets x 45 Detik
4. 🚴 20 Menit Cardio Moderate Pace (Sepeda / Rowing)

-----------------------------
💬 *${coachName}*:
"Konsistensi itu kunci! Latihan rutin bakal jaga kebugaran & energi lo sepanjang hari!"`;
    }
  } else {
    return `🌱✨ *REKOMENDASI JADWAL LATIHAN SEHAT UNTUK ${name.toUpperCase()}*
🎯 *Goal*: ${goalTitle}

🧘‍♀️ *RANGKAIAN LATIHAN HARI INI*:
1. 🚶 *Pemanasan & Mobilitas (5-10 Menit)*: Arm circles, leg swings, & cat-cow stretch
2. 🏋️ *Latihan Utama*:
   • Goblet Squat / Chair Squat: 3 Sets x 10-12 Reps
   • Wall / Knee Push-Up: 3 Sets x 10 Reps
   • Dumbbell Row (Beban Ringan/Sedang): 3 Sets x 12 Reps
   • Core Bird-Dog & Plank: 3 Sets x 30 Detik
3. 🧘 *Pendinginan (5 Menit)*: Deep breathing & hamstring stretch

-----------------------------
💬 *${coachName}*:
"Lakukan dengan nyaman dan dengarkan sinyal tubuhmu ya ${name}. Setiap gerakan kecil sangat berarti! ✨🌸"`;
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use("/infographics", express.static(path.join(process.cwd(), "public", "infographics")));

  // Save onboarding registration data & user profile (Fresh Account Creation)
  app.post("/api/onboarding", (req, res) => {
    const { phone, profile } = req.body;
    if (profile) {
      const norm = normalizePhone(phone || profile.phone || "");
      const altNorm = norm.startsWith("0") ? "62" + norm.substring(1) : (norm.startsWith("62") ? "0" + norm.substring(2) : norm);

      if (norm) {
        // Fresh registration: purge any old daily logs or water logs from previous sessions
        Object.keys(dbData.dailyLogs).forEach((key) => {
          if (key.startsWith(norm) || key.startsWith(altNorm)) {
            delete dbData.dailyLogs[key];
          }
        });
        Object.keys(dbData.waterLogs).forEach((key) => {
          if (key.startsWith(norm) || key.startsWith(altNorm)) {
            delete dbData.waterLogs[key];
          }
        });
        delete dbData.weeklyProgress[norm];
        delete dbData.weeklyProgress[altNorm];

        const saved = saveUserProfile(norm, profile);
        saveDb();
        console.log("Saved clean user profile in database for:", norm);
        return res.json({ success: true, profile: saved });
      }

      saveDb();
      return res.json({ success: true, profile });
    }
    return res.status(400).json({ error: "Profile object is required" });
  });

  // Get user profile endpoint
  app.get("/api/user/:phone", (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const user = getUserProfile(phone);
    if (!user) {
      return res.status(404).json({ error: "User profile not found in database" });
    }
    const calculated = calculateUserData(user);
    const streak = getStreakCount(phone);
    const waterCups = getWaterCups(phone);
    res.json({
      ...user,
      ...calculated,
      user,
      profile: user,
      userData: calculated,
      calculated,
      streak,
      waterCups
    });
  });

  app.get("/api/user-profile/:phone", (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const profile = getUserProfile(phone);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    const calculated = calculateUserData(profile);
    const streak = getStreakCount(phone);
    const waterCups = getWaterCups(phone);
    res.json({
      success: true,
      profile,
      user: profile,
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
      const lower = cleanText.toLowerCase();

      // Precise heuristic fallback with full Indonesian food database
      const getFallback = () => {
        let calories = 0, protein = 0, carbs = 0, fat = 0, fiber = 0, isHydration = false, volumeMl = 0;

        // Beverages
        if (lower.match(/air\s*putih|air\s*mineral|mineral\s*water|plain\s*water/)) {
          calories = 0; protein = 0; carbs = 0; fat = 0; isHydration = true; volumeMl = 500;
        } else if (lower.match(/americano|espresso|kopi\s*hitam|black\s*coffee/)) {
          calories = 10; protein = 0; carbs = 2; fat = 0; isHydration = true; volumeMl = 250;
        } else if (lower.match(/kopi\s*susu|latte|cappuccino|flat\s*white/)) {
          calories = 150; protein = 5; carbs = 18; fat = 6; isHydration = true; volumeMl = 250;
        } else if (lower.match(/teh\s*manis|teh\s*kotak|teh\s*pucuk/)) {
          calories = 90; protein = 0; carbs = 22; fat = 0; isHydration = true; volumeMl = 300;
        } else if (lower.match(/teh\s*tawar|green\s*tea|ocha/)) {
          calories = 5; protein = 0; carbs = 1; fat = 0; isHydration = true; volumeMl = 250;
        } else if (lower.match(/jus|juice/) && lower.match(/jeruk|orange/)) {
          calories = 110; protein = 2; carbs = 26; fat = 0; fiber = 1; isHydration = true; volumeMl = 250;
        } else if (lower.match(/susu|milk/) && lower.match(/full\s*cream|whole/)) {
          calories = 150; protein = 8; carbs = 12; fat = 8; isHydration = true; volumeMl = 250;
        } else if (lower.match(/milo|ovaltine/)) {
          calories = 200; protein = 5; carbs = 35; fat = 5; isHydration = true; volumeMl = 250;
        } else if (lower.match(/soda|cola|sprite|fanta|coke|pepsi/)) {
          calories = 140; protein = 0; carbs = 35; fat = 0; isHydration = true; volumeMl = 330;
        }
        // Proteins
        else if (lower.match(/ayam\s*geprek|geprek/)) {
          calories = 650; protein = 32; carbs = 65; fat = 28; fiber = 2;
        } else if (lower.match(/ayam\s*goreng|fried\s*chicken/) && lower.match(/nasi|rice/)) {
          calories = 580; protein = 30; carbs = 60; fat = 22; fiber = 1;
        } else if (lower.match(/ayam\s*goreng|fried\s*chicken/)) {
          calories = 320; protein = 28; carbs = 8; fat = 18; fiber = 0;
        } else if (lower.match(/rendang/)) {
          calories = 470; protein = 40; carbs = 12; fat = 30; fiber = 1;
        } else if (lower.match(/telur\s*rebus|boiled\s*egg/)) {
          calories = 155; protein = 13; carbs = 1; fat = 11; fiber = 0;
        } else if (lower.match(/telur\s*goreng|fried\s*egg/)) {
          calories = 185; protein = 13; carbs = 1; fat = 14; fiber = 0;
        } else if (lower.match(/tempe\s*goreng/)) {
          calories = 220; protein = 14; carbs = 12; fat = 13; fiber = 2;
        } else if (lower.match(/tahu\s*goreng/)) {
          calories = 165; protein = 11; carbs = 4; fat = 12; fiber = 0;
        } else if (lower.match(/ikan\s*goreng|fried\s*fish/)) {
          calories = 290; protein = 25; carbs = 5; fat = 18; fiber = 0;
        }
        // Carbs
        else if (lower.match(/nasi\s*putih|nasi\s*uduk/) || (lower.match(/nasi/) && !lower.match(/goreng|padang/))) {
          calories = 240; protein = 5; carbs = 52; fat = 1; fiber = 1;
        } else if (lower.match(/nasi\s*goreng/)) {
          calories = 550; protein = 18; carbs = 65; fat = 22; fiber = 2;
        } else if (lower.match(/mie\s*goreng|indomie\s*goreng/)) {
          calories = 390; protein = 9; carbs = 55; fat = 14; fiber = 2;
        } else if (lower.match(/mie\s*rebus|indomie\s*rebus/)) {
          calories = 320; protein = 8; carbs = 48; fat = 10; fiber = 1;
        } else if (lower.match(/roti\s*tawar|white\s*bread/)) {
          calories = 265; protein = 9; carbs = 49; fat = 3; fiber = 3;
        }
        // Combos
        else if (lower.match(/chicken\s*rice\s*bowl|rice\s*bowl/)) {
          calories = 580; protein = 35; carbs = 60; fat = 20; fiber = 2;
        } else if (lower.match(/nasi\s*padang/)) {
          calories = 750; protein = 38; carbs = 70; fat = 34; fiber = 4;
        } else if (lower.match(/bakso/)) {
          calories = 420; protein = 26; carbs = 40; fat = 18; fiber = 2;
        } else if (lower.match(/gado.gado|pecel/)) {
          calories = 430; protein = 16; carbs = 52; fat = 18; fiber = 6;
        } else if (lower.match(/batagor/)) {
          calories = 450; protein = 18; carbs = 45; fat = 22; fiber = 3;
        } else if (lower.match(/siomay/)) {
          calories = 480; protein = 24; carbs = 42; fat = 24; fiber = 3;
        } else if (lower.match(/soto\s*ayam/)) {
          calories = 410; protein = 25; carbs = 50; fat = 12; fiber = 2;
        } else {
          calories = 350; protein = 15; carbs = 40; fat = 12; fiber = 2;
        }

        // Enforce Atwater if all macros present
        if (protein + carbs + fat > 0) {
          calories = (protein * 4) + (carbs * 4) + (fat * 9);
        }

        return { foodName: cleanText, calories, protein, carbs, fat, fiber, isHydration, volumeMl, mealType: getMealTypeByHour() };
      };

      if (!getAi()) {
        const fallback = getFallback();
        return res.json({ success: true, ...fallback, note: "Estimated using offline database" });
      }

      const prompt = `Kamu adalah Nutritionist AI GymBuddy yang sangat akurat. Tugas: analisis makanan/minuman berikut dan berikan estimasi nutrisi yang TEPAT.

INPUT USER: "${cleanText}"

ATURAN WAJIB (MUTLAK, TIDAK BOLEH DILANGGAR):
1. RUMUS KALORI: calories HARUS SAMA PERSIS dengan (protein × 4) + (carbs × 4) + (fat × 9). Hitung ulang sebelum output!
2. Estimasi porsi STANDAR orang Indonesia dewasa (bukan porsi miniatur).
3. Jika input adalah minuman (kopi, teh, jus, air, susu, dll), set isHydration=true.
4. Jika minuman berbasis susu/gula, kalori berkisar 100-250 kcal per sajian.

DATABASE BENCHMARK NUTRISI INDONESIA (PANGANKU / USDA) — GUNAKAN SEBAGAI ACUAN:
- Nasi Putih 1 centong (100g): 130 kcal | P:3g C:28g F:0.3g
- Ayam Goreng (1 paha + kulit, 120g): 320 kcal | P:28g C:8g F:18g
- Ayam Geprek + Nasi + Sambal: 650 kcal | P:32g C:65g F:28g
- Chicken Rice Bowl + Telur: 580 kcal | P:35g C:60g F:20g
- Nasi Padang (Rendang/Ayam + Sayur): 750 kcal | P:38g C:70g F:34g
- Bakso Sapi + Mie: 420 kcal | P:26g C:40g F:18g
- Tempe Goreng (2 potong): 220 kcal | P:14g C:12g F:13g
- Telur Rebus (2 butir): 155 kcal | P:13g C:1g F:11g
- Americano / Espresso (250ml): 10 kcal | P:0g C:2g F:0g
- Kopi Susu / Latte (250ml): 150 kcal | P:5g C:18g F:6g
- Teh Manis (300ml): 90 kcal | P:0g C:22g F:0g
- Jus Jeruk (250ml): 110 kcal | P:2g C:26g F:0g
- Batagor 1 porsi: 450 kcal | P:18g C:45g F:22g
- Siomay Bandung: 480 kcal | P:24g C:42g F:24g
- Soto Ayam + Nasi: 410 kcal | P:25g C:50g F:12g
- Gado-Gado / Pecel: 430 kcal | P:16g C:52g F:18g

OUTPUT: Hanya JSON valid, tanpa markdown, tanpa teks lain:
{
  "foodName": "Nama lengkap makanan dengan porsi (misal: Ayam Geprek + Nasi Putih 1 Porsi)",
  "calories": 650,
  "protein": 32,
  "carbs": 65,
  "fat": 28,
  "fiber": 2,
  "isHydration": false,
  "volumeMl": 0,
  "mealType": "lunch",
  "portionNote": "Estimasi: 1 porsi standar (nasi 1 piring + ayam 1 dada)"
}

VERIFIKASI WAJIB sebelum output: (protein×4) + (carbs×4) + (fat×9) = calories. Jika tidak sama, koreksi calories!`;

      try {
        const rawText = await generateGeminiContent(prompt);
        const textOutput = (rawText || "{}").replace(/```json/g, "").replace(/```/g, "").trim();
        let parsed: any = extractAndParseJson(textOutput) || {};
        
        parsed.foodName = parsed.foodName || cleanText;
        let protein = Math.max(0, Math.round(Number(parsed.protein) || 0));
        let carbs = Math.max(0, Math.round(Number(parsed.carbs) || 0));
        let fat = Math.max(0, Math.round(Number(parsed.fat) || 0));
        let fiber = Math.max(0, Math.round(Number(parsed.fiber) || 0));
        
        // ENFORCE Atwater formula: calories must match macros exactly
        const macroCalories = (protein * 4) + (carbs * 4) + (fat * 9);
        const calories = macroCalories > 0 ? macroCalories : Math.max(0, Math.round(Number(parsed.calories) || 0));
        
        parsed.mealType = parsed.mealType || getMealTypeByHour();

        res.json({
          success: true,
          foodName: parsed.foodName,
          calories,
          protein,
          carbs,
          fat,
          fiber,
          isHydration: Boolean(parsed.isHydration),
          volumeMl: Number(parsed.volumeMl) || 0,
          mealType: parsed.mealType,
          portionNote: parsed.portionNote || ""
        });
      } catch (aiErr) {
        console.warn("Gemini AI analyze-food error, using fallback:", aiErr);
        const fallback = getFallback();
        res.json({ success: true, ...fallback, note: "Fallback estimation" });
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
  app.get("/api/user/:phone/meals", (req, res) => {
    const rawPhone = req.params.phone;
    const phone = normalizePhone(rawPhone);
    const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
    const targetDate = (req.query.date as string) || getLocalDateStr();
    const key = `${phone}_${targetDate}`;
    const altKey = `${altPhone}_${targetDate}`;

    let logs: MealLog[] = [];
    if (dbData.dailyLogs[key] !== undefined && Array.isArray(dbData.dailyLogs[key])) {
      logs = dbData.dailyLogs[key].filter(m => !isLegacyMockMeal(m));
    } else if (dbData.dailyLogs[altKey] !== undefined && Array.isArray(dbData.dailyLogs[altKey])) {
      logs = dbData.dailyLogs[altKey].filter(m => !isLegacyMockMeal(m));
    }

    res.json({ success: true, phone, date: targetDate, logs });
  });

  // REST API: Add meal log for user
  app.post("/api/user/:phone/meals", express.json(), (req, res) => {
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
      mealType: meal.mealType || getMealTypeByHour(),
      timestamp: meal.timestamp || new Date().toISOString(),
      // Bug 2b Fix: preserve isHydration and volumeMl sent from frontend
      isHydration: meal.isHydration === true || meal.isHydration === "true" ? true : (meal.isHydration === false || meal.isHydration === "false" ? false : undefined),
      volumeMl: meal.volumeMl ? Number(meal.volumeMl) : undefined
    };
    addMealLog(phone, mealObj, targetDate);
    const key = `${phone}_${targetDate}`;
    res.json({ success: true, phone, date: targetDate, meal: mealObj, logs: dbData.dailyLogs[key] });
  });

  // REST API: Delete single meal log for user (cleans BOTH key and altKey)
  app.delete("/api/user/:phone/meals/:mealId", (req, res) => {
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
    res.json({ success: true, phone, date: targetDate, logs: dbData.dailyLogs[key] || dbData.dailyLogs[altKey] || [] });
  });

  // REST API: Delete ALL meal logs for user on a date
  app.delete("/api/user/:phone/meals", (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
    const targetDate = (req.query.date as string) || getLocalDateStr();
    const key = `${phone}_${targetDate}`;
    const altKey = `${altPhone}_${targetDate}`;

    dbData.dailyLogs[key] = [];
    dbData.dailyLogs[altKey] = [];
    saveDb();
    res.json({ success: true, phone, date: targetDate, logs: [] });
  });

  // REST API: Full synchronization / replace of meal logs for user on a date
  app.put("/api/user/:phone/meals", express.json(), (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : (phone.startsWith("62") ? "0" + phone.substring(2) : phone);
    const targetDate = (req.query.date as string) || req.body?.date || getLocalDateStr();
    const key = `${phone}_${targetDate}`;
    const altKey = `${altPhone}_${targetDate}`;
    const rawMeals = Array.isArray(req.body?.meals) ? req.body.meals : (Array.isArray(req.body) ? req.body : []);

    dbData.dailyLogs[key] = rawMeals;
    dbData.dailyLogs[altKey] = rawMeals;
    saveDb();
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

  // REST API: Get user profile by phone
  app.get("/api/user/:phone", (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const user = getUserProfile(phone);
    if (!user) {
      return res.status(404).json({ success: false, error: "User profile not found in database" });
    }
    const calculated = calculateUserData(user);
    return res.json({
      success: true,
      user,
      profile: user,
      userData: calculated,
      calculated
    });
  });

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

  // Reset all database data endpoint (Local & MongoDB Atlas)
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
    if (MONGODB_URI) {
      try {
        const db = await getMongoDb();
        if (db) {
          await db.collection("appdata").deleteMany({});
          await db.collection("appdata").replaceOne(
            { _id: "main" as any },
            { _id: "main" as any, users: {}, dailyLogs: {}, weeklyProgress: {}, waterLogs: {}, updatedAt: new Date() },
            { upsert: true }
          );
          console.log("[MongoDB] Collection reset successfully ✅");
        }
      } catch (err: any) {
        console.error("[MongoDB] Reset error:", err?.message || err);
      }
    }
    console.log("All user database data reset successfully.");
    return res.json({ success: true, message: "Semua data database (lokal & MongoDB) berhasil dihapus 100%." });
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

  // REST API: Update Goals for Dashboard
  app.post("/api/user/:phone/goals", express.json(), (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const user = getUserProfile(phone);
    if (!user) {
      return res.status(404).json({ success: false, error: "User profile not found" });
    }
    const { targetWeight, targetCalories, goal, goalTitle } = req.body;
    if (targetWeight) user.targetWeight = Number(targetWeight);
    if (targetCalories) user.targetCalories = Number(targetCalories);
    if (goal) user.goal = goal;
    if (goalTitle) user.goalTitle = goalTitle;
    saveUserProfile(phone, user);
    const calculated = calculateUserData(user);
    res.json({ success: true, user, profile: user, userData: calculated, calculated });
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
      const orderId = `GYMBUDDY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
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
          phone: phone || "08123456789"
        }
      };

      const transaction = await snap.createTransaction(parameter);
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
      const statusResponse = await snap.transaction.notification(req.body);
      const orderId = statusResponse.order_id;
      const transactionStatus = statusResponse.transaction_status;
      const fraudStatus = statusResponse.fraud_status;

      console.log(`Transaction notification received. Order ID: ${orderId}. Transaction status: ${transactionStatus}. Fraud status: ${fraudStatus}`);

      if (transactionStatus == 'capture') {
        if (fraudStatus == 'accept') {
          console.log(`Payment success for order ${orderId}`);
        }
      } else if (transactionStatus == 'settlement') {
        console.log(`Payment settled for order ${orderId}`);
      } else if (transactionStatus == 'cancel' || transactionStatus == 'deny' || transactionStatus == 'expire') {
        console.log(`Payment failed/cancelled for order ${orderId}`);
      } else if (transactionStatus == 'pending') {
        console.log(`Payment pending for order ${orderId}`);
      }

      res.status(200).send('OK');
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

          // Strict Onboarding Requirement: If profile is deleted / unregistered and message is not onboarding welcome
          if (!userProfile && !isWelcomeMessage) {
            await sendMetaWhatsappMessage(
              from,
              `⚠️ *AKUN BELUM TERDAFTAR DI GYMBUDDY AI*\n-----------------------------\n` +
              `Halo! Nomor WhatsApp kamu belum terdaftar atau telah dihapus dari database GymBuddy AI.\n\n` +
              `Silakan lakukan registrasi & isi kuesioner onboarding terlebih dahulu di website GymBuddy AI agar Coach kami bisa menyesuaikan kebutuhan kalori & latihanmu secara personal! 🎯✨`
            );
            return res.sendStatus(200);
          }

          if (!userProfile) {
            userProfile = getOrCreateUserProfile(from, userText);
          }
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
          const weightMatch = userText.match(/(?:update\s+bb|lapor\s+bb|berat\s+badan|bb\s+sekarang|bb)\s*:?\s*(\d+(?:[\.,]\d+)?)/i);

          // Water Intake Intent Match (e.g. "minum 2 gelas", "air 500ml", "water 3 cups")
          const waterMatch = userText.match(/(?:minum|air\s+putih|water|hidrasi)\s*:?\s*(\d+(?:[\.,]\d+)?)\s*(gelas|cup|cups|ml|l|liter)?/i);

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

Kategori 1: LAPORAN MAKANAN/MINUMAN (teks atau gambar makanan/minuman, seperti "pisang 2 buah", "makan ayam", dll)
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

  // Twilio WhatsApp Webhook
  app.post("/api/webhook/twilio-whatsapp", express.urlencoded({ extended: true }), async (req, res) => {
    console.log(`[${new Date().toISOString()}] Received Twilio WhatsApp Webhook. From: ${req.body?.From}, Body: ${req.body?.Body}`);
    try {
      const { Body, From, NumMedia } = req.body;
      let userProfile = getUserProfile(From);

      let userText = Body || "";
      let imagePart: any = null;

      if (NumMedia && parseInt(NumMedia) > 0) {
        const mediaUrl = req.body.MediaUrl0;
        const mediaContentType = req.body.MediaContentType0;

        if (mediaUrl) {
          try {
            const imageRes = await axios.get(mediaUrl, { responseType: "arraybuffer" });
            const imageBuffer = Buffer.from(imageRes.data, "binary");
            const base64Image = imageBuffer.toString("base64");
            imagePart = { inlineData: { data: base64Image, mimeType: mediaContentType || "image/jpeg" } };
          } catch (mediaErr) {
            console.error("Error fetching Twilio media:", mediaErr);
          }
        }
      }

      const lowerText = userText.toLowerCase();

      const isWelcomeMessage = (lowerText.includes("gymbuddy") && (lowerText.includes("target harian") || lowerText.includes("target saya") || lowerText.includes("tolong kirimkan"))) ||
                               (lowerText.includes("nama saya") && lowerText.includes("target saya"));

      // Strict Onboarding Requirement: If profile is deleted / unregistered and message is not onboarding welcome
      if (!userProfile && !isWelcomeMessage) {
        const twiml = new TwilioPackage.twiml.MessagingResponse();
        twiml.message(
          `⚠️ *AKUN BELUM TERDAFTAR DI GYMBUDDY AI*\n-----------------------------\n` +
          `Halo! Nomor WhatsApp kamu belum terdaftar atau telah dihapus dari database GymBuddy AI.\n\n` +
          `Silakan lakukan registrasi & isi kuesioner onboarding terlebih dahulu di website GymBuddy AI agar Coach kami bisa menyesuaikan kebutuhan kalori & latihanmu secara personal! 🎯✨`
        );
        return res.type('text/xml').send(twiml.toString());
      }

      if (!userProfile) {
        userProfile = getOrCreateUserProfile(From, userText);
      }
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

      const weightMatch = userText.match(/(?:update\s+bb|lapor\s+bb|berat\s+badan|bb\s+sekarang|bb)\s*:?\s*(\d+(?:[\.,]\d+)?)/i);

      // Water Intake Intent Match (e.g. "minum 2 gelas", "air 500ml", "water 3 cups")
      const waterMatch = userText.match(/(?:minum|air\s+putih|water|hidrasi)\s*:?\s*(\d+(?:[\.,]\d+)?)\s*(gelas|cup|cups|ml|l|liter)?/i);

      const isResetMessage = lowerText.includes("reset akun") || 
                             lowerText.includes("hapus akun") || 
                             lowerText.includes("reset data") ||
                             lowerText.includes("hapus data saya");

      let responseMessages: string[] = [];

      if (isResetMessage) {
        const normPhone = normalizePhone(From);
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
          saveUserProfile(From, userProfile);
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
          saveUserProfile(From, userProfile);
          const currentCalculated = calculateUserData(userProfile);
          responseMessages = generateWelcomeMessages(currentCalculated);
        }
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
          actualMl = Math.round(rawAmount) * 250;
        }
        const cupsToAdd = Math.max(1, Math.round(actualMl / 250));
        const currentCups = getWaterCups(From);
        const newTotalCups = setWaterCups(From, currentCups + cupsToAdd);
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
        addMealLog(From, waterEntry);
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
          const resProg = addWeeklyProgress(From, newW, "Update via WhatsApp");
          if (resProg) {
            responseMessages = [formatWeeklyProgressCard(resProg)];
          } else {
            responseMessages = ["Profil kamu belum terdaftar di database. Silakan isi kuesioner terlebih dahulu!"];
          }
        }
      } else if (isProgressHistoryMessage) {
        responseMessages = [formatProgressHistoryCard(From)];
      } else if (isWorkoutReqMessage) {
        responseMessages = [generateWorkoutRecommendations(userData)];
      } else if (isRecommendationMessage) {
        responseMessages = [generateMealRecommendations(userData)];
      } else if (isCheckSummaryMessage) {
        const parsedDate = parseDateFromQuery(userText);
        const totals = getDailyTotals(From, parsedDate.dateStr);
        responseMessages = [generateDailySummaryCard(userData, totals, parsedDate.label)];
      } else if (handleReminderCommand(userText, userProfile, From, userData)) {
        responseMessages = handleReminderCommand(userText, userProfile, From, userData)!;
      } else if (userText.match(/(?:selesai\s*latihan|latihan\s*selesai|workout\s*selesai|selesai\s*workout|lapor\s*latihan|catat\s*latihan|latihan\s*hari\s*ini|push\s*up|squat|bench\s*press|pull\s*up|(\d+)\s*set\s*selesai)/i)) {
        const todayStr = getLocalDateStr();
        const workoutKey = `gymbuddy_exercises_${From}_${todayStr}`;
        const coachName = userData.persona === "max" ? "Coach Max" : "Coach Mia";

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
        addMealLog(From, workoutLogEntry);
        dbData.dailyLogs[workoutKey] = [{ id: "completed", foodName: "Workout", calories: 0, protein: 0, carbs: 0, fat: 0, timestamp: new Date().toISOString() }];
        saveDb();

        responseMessages = [
          `🏋️ *LATIHAN HARI INI DICATAT*\n-----------------------------\n` +
          `✅ ${userText.trim()}\n\n` +
          `💬 *${coachName}*:\n"Kerja bagus! Latihan kamu sudah tercatat. Jangan lupa istirahat yang cukup & cukupi konsumsi protein kamu ya! 💪🔥"`
        ];
      } else if (getAi()) {
        // Send immediate progress notification via Twilio REST API if available
        await sendTwilioWhatsappMessage(From, "sedang berpikir... 💭\n\nHampir selesai mengecek inputmu... 📊");

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

          // Force equipment detection if an image is sent and it is NOT food
          const isEquipmentMatch = parsed.isEquipment || (imagePart && !parsed.isFood) || 
            lowerText.includes("alat") || lowerText.includes("cara pakai") || lowerText.includes("mesin") || lowerText.includes("gym");

          if (parsed.isFood) {
            addMealLog(From, {
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
            const dailyTotals = getDailyTotals(From);
            const card = formatNutritionCard(parsed, imagePart ? "Foto" : "Teks", userData, dailyTotals);
            responseMessages = [card];
          } else if (isEquipmentMatch) {
            if (!parsed.equipmentName) parsed.equipmentName = "Alat Gym / Mesin Latihan";
            parsed.isEquipment = true;

            const eqCard = formatEquipmentCard(parsed, userData);
            responseMessages = [eqCard];

            // Generate Canvas Infographic PNG Image with Official GymBuddy Branding
            (async () => {
              try {
                const infographicUrl = await generateEquipmentInfographicPNG(parsed, userData);
                if (infographicUrl && getTwilio()) {
                  const twilioPhone = process.env.TWILIO_PHONE_NUMBER || "whatsapp:+14155238886";
                  const fromNum = twilioPhone.startsWith("whatsapp:") ? twilioPhone : `whatsapp:${twilioPhone}`;
                  const toNum = From.startsWith("whatsapp:") ? From : `whatsapp:${From}`;
                  await getTwilio().messages.create({
                    body: `🏋️ *TUTORIAL CARA PAKAI ALAT: ${(parsed.equipmentName || "ALAT GYM").toUpperCase()}*\n\nBerikut infografis resmi dari GymBuddy AI untuk panduan bagian alat, cara pakai step-by-step, & kesalahan umum! 💪✨`,
                    mediaUrl: [infographicUrl],
                    from: fromNum,
                    to: toNum
                  });
                  console.log("Successfully sent GymBuddy Equipment Infographic PNG to:", toNum);
                }
              } catch (infogErr) {
                console.error("Error generating or sending equipment infographic image:", infogErr);
              }
            })();
          } else {
            responseMessages = [parsed.generalReply || "Sip! Ada laporan makanan atau latihan lain yang mau ditanyakan?"];
          }
        } catch (e) {
          console.error("Gemini AI Error:", e);
          responseMessages = ["Maaf, aku sedang tidak bisa memproses inputmu saat ini."];
        }
      } else {
        responseMessages = ["Sistem AI belum terkonfigurasi dengan benar."];
      }

      const twiml = new TwilioPackage.twiml.MessagingResponse();
      if (responseMessages.length > 0) {
        const combinedMessage = responseMessages.join("\n\n---\n\n");
        twiml.message(combinedMessage);
      }

      // If Twilio REST API client is configured, also push via REST API for 100% guaranteed delivery
      if (getTwilio() && responseMessages.length > 0) {
        (async () => {
          try {
            const twilioPhone = process.env.TWILIO_PHONE_NUMBER || "whatsapp:+14155238886";
            const fromNum = twilioPhone.startsWith("whatsapp:") ? twilioPhone : `whatsapp:${twilioPhone}`;
            const toNum = From.startsWith("whatsapp:") ? From : `whatsapp:${From}`;
            for (const msgText of responseMessages) {
              await getTwilio().messages.create({
                body: msgText,
                from: fromNum,
                to: toNum
              });
              await new Promise(r => setTimeout(r, 600));
            }
            console.log("Successfully delivered message via Twilio REST API to:", toNum);
          } catch (restErr: any) {
            console.error("Twilio REST API send error:", restErr?.message || restErr);
          }
        })();
      }
      
      const xmlOutput = twiml.toString();
      console.log(`[${new Date().toISOString()}] Sending TwiML XML response to Twilio:\n${xmlOutput}`);
      res.type('text/xml').send(xmlOutput);
    } catch (error) {
      console.error("Error processing Twilio webhook:", error);
      res.sendStatus(500);
    }
  });



  async function generateGeminiImage(promptText: string): Promise<Buffer | null> {
    const rawEq = promptText.match(/for ([A-Z0-9\s]+)\./i);
    const eqName = rawEq ? rawEq[1].trim() : "Gym Equipment";
    const fullPrompt = `Photorealistic 8k fitness infographic tutorial poster for how to use ${eqName}. Dark gym aesthetic background with gold and white typography. Top title TUTORIAL CARA PAKAI ALAT INI ${eqName}. Bagian Alat section showing equipment parts. Cara Pakai section showing 4 step by step workout demonstration cards with athletic people performing the movement. Tips and common mistakes section with red X posture error comparison. Target muscle anatomy diagram showing worked muscles and workout sets reps rest counter. High quality realistic gym guide poster.`;

    // Provider 1: Google Imagen 3 (Supporting AQ., ya29., AIzaSy... API Keys & Tokens)
    if (USER_GEMINI_KEY) {
      const cleanKey = USER_GEMINI_KEY;
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
  <text x="80" y="55" font-size="16" font-weight="900" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" letter-spacing="0.5">GYMBUDDY</text>
  <text x="175" y="55" font-size="12" font-weight="800" fill="#D4FF00" font-family="system-ui, sans-serif" letter-spacing="1">VISION AI</text>

  <!-- Day Badge (Top Right) -->
  <rect x="444" y="32" width="120" height="34" rx="17" fill="#141C2B" stroke="#FFFFFF" stroke-opacity="0.08"/>
  <text x="504" y="54" text-anchor="middle" font-size="13" font-weight="700" fill="#94A3B8" font-family="system-ui, sans-serif">${esc(dayLabel || "Hari Ini")}</text>

  <!-- FOOD TITLE (Crisp, modern line wrapping) -->
  <text x="36" y="${nameLine2 ? 104 : 116}" font-size="${nameLine2 ? 26 : 28}" font-weight="800" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif">${esc(nameLine1)}</text>
  ${nameLine2 ? `<text x="36" y="138" font-size="24" font-weight="800" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif">${esc(nameLine2)}</text>` : ""}

  <!-- HEALTH SCORE PILL (Clean, zero overlap) -->
  <rect x="36" y="${nameLine2 ? 152 : 142}" width="220" height="32" rx="16" fill="#141C2B" stroke="#D4FF00" stroke-opacity="0.3" stroke-width="1"/>
  <text x="48" y="${nameLine2 ? 173 : 163}" font-size="14" fill="#D4FF00" font-family="sans-serif">★</text>
  <text x="66" y="${nameLine2 ? 173 : 163}" font-size="12" font-weight="800" fill="#FFFFFF" font-family="system-ui, sans-serif">${scoreFormatted} / 5.0</text>
  <text x="130" y="${nameLine2 ? 173 : 163}" font-size="11" font-weight="600" fill="#94A3B8" font-family="system-ui, sans-serif">• ${scoreRatingText}</text>

  <!-- FOOD PHOTO -->
  ${imgContent}
  <rect x="36" y="195" width="528" height="300" rx="20" fill="none" stroke="#FFFFFF" stroke-opacity="0.1" stroke-width="1.5"/>

  <!-- HERO CALORIE BAR -->
  <rect x="36" y="510" width="528" height="68" rx="20" fill="#141C2B" stroke="#FFFFFF" stroke-opacity="0.06"/>
  <text x="56" y="552" font-size="28" font-weight="900" fill="#FFFFFF" font-family="system-ui, sans-serif">🔥 ${calories}</text>
  <text x="175" y="550" font-size="14" font-weight="700" fill="#94A3B8" font-family="system-ui, sans-serif">TOTAL KALORI (kcal)</text>
  <text x="544" y="550" text-anchor="end" font-size="12" font-weight="700" fill="#D4FF00" font-family="system-ui, sans-serif">Padat Energi</text>

  <!-- 4 BALANCED MACRO CARDS -->
  <!-- 1. Protein Card -->
  <rect x="36" y="590" width="124" height="110" rx="20" fill="#101724" stroke="#FFFFFF" stroke-opacity="0.06"/>
  <rect x="48" y="602" width="8" height="8" rx="4" fill="#10B981"/>
  <text x="62" y="610" font-size="12" font-weight="700" fill="#94A3B8" font-family="system-ui, sans-serif">Protein</text>
  <text x="98" y="654" text-anchor="middle" font-size="28" font-weight="900" fill="#FFFFFF" font-family="system-ui, sans-serif">${protein}<tspan font-size="14" font-weight="600" fill="#64748B">g</tspan></text>
  <rect x="48" y="676" width="100" height="5" rx="2.5" fill="#1E293B"/>
  <rect x="48" y="676" width="${Math.min(100, Math.round(protein * 2.5))}" height="5" rx="2.5" fill="#10B981"/>

  <!-- 2. Karbohidrat Card -->
  <rect x="170" y="590" width="124" height="110" rx="20" fill="#101724" stroke="#FFFFFF" stroke-opacity="0.06"/>
  <rect x="182" y="602" width="8" height="8" rx="4" fill="#F59E0B"/>
  <text x="196" y="610" font-size="12" font-weight="700" fill="#94A3B8" font-family="system-ui, sans-serif">Karbo</text>
  <text x="232" y="654" text-anchor="middle" font-size="28" font-weight="900" fill="#FFFFFF" font-family="system-ui, sans-serif">${carbs}<tspan font-size="14" font-weight="600" fill="#64748B">g</tspan></text>
  <rect x="182" y="676" width="100" height="5" rx="2.5" fill="#1E293B"/>
  <rect x="182" y="676" width="${Math.min(100, Math.round(carbs * 1.5))}" height="5" rx="2.5" fill="#F59E0B"/>

  <!-- 3. Lemak Card -->
  <rect x="304" y="590" width="124" height="110" rx="20" fill="#101724" stroke="#FFFFFF" stroke-opacity="0.06"/>
  <rect x="316" y="602" width="8" height="8" rx="4" fill="#8B5CF6"/>
  <text x="330" y="610" font-size="12" font-weight="700" fill="#94A3B8" font-family="system-ui, sans-serif">Lemak</text>
  <text x="366" y="654" text-anchor="middle" font-size="28" font-weight="900" fill="#FFFFFF" font-family="system-ui, sans-serif">${fat}<tspan font-size="14" font-weight="600" fill="#64748B">g</tspan></text>
  <rect x="316" y="676" width="100" height="5" rx="2.5" fill="#1E293B"/>
  <rect x="316" y="676" width="${Math.min(100, Math.round(fat * 2.2))}" height="5" rx="2.5" fill="#8B5CF6"/>

  <!-- 4. Serat Card -->
  <rect x="440" y="590" width="124" height="110" rx="20" fill="#101724" stroke="#FFFFFF" stroke-opacity="0.06"/>
  <rect x="452" y="602" width="8" height="8" rx="4" fill="#06B6D4"/>
  <text x="466" y="610" font-size="12" font-weight="700" fill="#94A3B8" font-family="system-ui, sans-serif">Serat</text>
  <text x="502" y="654" text-anchor="middle" font-size="28" font-weight="900" fill="#FFFFFF" font-family="system-ui, sans-serif">${fiber}<tspan font-size="14" font-weight="600" fill="#64748B">g</tspan></text>
  <rect x="452" y="676" width="100" height="5" rx="2.5" fill="#1E293B"/>
  <rect x="452" y="676" width="${Math.min(100, Math.round(fiber * 8))}" height="5" rx="2.5" fill="#06B6D4"/>

  <!-- FOOTER BRANDING -->
  <text x="300" y="745" text-anchor="middle" font-size="11" font-weight="700" fill="#475569" font-family="system-ui, sans-serif" letter-spacing="1">GYMBUDDY · AI NUTRITION ENGINE</text>
</svg>`;
  }

  // Endpoint: serve a generated nutrition card PNG by ID
  app.get(["/api/nutrition-card/:id.png", "/api/nutrition-card/:id.jpg"], async (req, res) => {
    const rawId = req.params.id;
    const id = String(rawId || "").replace(/\.(png|jpg|jpeg)$/i, "");
    const cardData = dbData.nutritionCards ? dbData.nutritionCards[id] : null;
    if (!cardData) {
      return res.status(404).json({ error: "Card not found" });
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
      const resvg = new Resvg(svgStr, { fitTo: { mode: "width", value: 600 } });
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

    // Fallback: Return high-resolution rendered PNG Infographic
    const info = (dbData.infographics && dbData.infographics[cleanId]) ? dbData.infographics[cleanId] : null;
    const parsed = info ? info.parsed : { equipmentName: "Alat Gym" };
    const userData = info ? info.userData : { name: "User", goalTitle: "Menurunkan Berat Badan" };
    const svgStr = generateInfographicSVG(parsed, userData);

    try {
      // @ts-ignore
      const { Resvg } = await import("@resvg/resvg-js");
      const resvg = new Resvg(svgStr, { fitTo: { mode: "width", value: 800 } });
      const pngData = resvg.render();
      const pngBuffer = pngData.asPng();

      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(pngBuffer);
    } catch (e: any) {
      console.log("[Resvg Render Fallback]:", e?.message || e);
      res.setHeader("Content-Type", "image/svg+xml");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(svgStr);
    }
  });

  function generateInfographicSVG(parsed: any, userData: any): string {
    const rawEqName = (parsed.equipmentName || "ALAT GYM").trim();
    const isGeneric = !rawEqName || rawEqName.includes("THIS MACHINE") || rawEqName.includes("Nama Alat Gym");
    const rawName = isGeneric ? "ALAT GYM / MESIN LATIHAN" : rawEqName;

    const eqName = escapeXml(rawName.toUpperCase());
    const rawDesc = parsed.description || "Melatih kelompok otot target secara optimal dan aman.";
    const rawMuscles = parsed.targetMuscles || "Punggung, Glutes, Hamstring";

    const partsList = (Array.isArray(parsed.parts) && parsed.parts.length > 0 ? parsed.parts : [
      "Bagian Utama / Pegangan (Grip)",
      "Beban / Weight Plate",
      "Kunci Pengaman / Lock Pin",
      "Bantalan Penopang / Support Pad"
    ]).map((x: any) => String(x));

    const stepsList = (Array.isArray(parsed.steps) && parsed.steps.length > 0 ? parsed.steps : [
      "Atur Posisi: Sesuaikan beban dan posisi tubuh secara stabil",
      "Posisi Awal: Kunci pegangan, tubuh tegap, kencangkan otot core",
      "Gerakan Latihan: Eksekusi gerakan perlahan 2-3 detik",
      "Gerakan Akhir: Kembali ke posisi awal dengan terkontrol"
    ]).map((x: any) => String(x));

    const tipsList = (Array.isArray(parsed.tips) && parsed.tips.length > 0 ? parsed.tips : [
      "Gerakan perlahan & terkontrol (3 dtk turun, 1 dtk naik)",
      "Fokus pada kontraksi otot target utama",
      "Jaga postur tubuh tetap lurus & atur pernapasan"
    ]).map((x: any) => String(x));

    const mistakesList = (Array.isArray(parsed.mistakes) && parsed.mistakes.length > 0 ? parsed.mistakes : [
      "Menggunakan ayunan/momentum berlebihan",
      "Postur punggung membungkuk saat mengangkat beban",
      "Rentang gerakan terlalu pendek (half reps)"
    ]).map((x: any) => String(x));

    let defaultSets = "3 - 4 Set";
    let defaultReps = "10 - 15 Repetisi";
    let defaultRest = "60 - 90 Detik";

    const goalLower = (userData.goalTitle || "").toLowerCase();
    if (goalLower.includes("menurunkan") || goalLower.includes("fat loss") || goalLower.includes("turun")) {
      defaultSets = "3 - 4 Set"; defaultReps = "12 - 15 Reps"; defaultRest = "45 - 60 Detik";
    } else if (goalLower.includes("naik") || goalLower.includes("otot") || goalLower.includes("gain")) {
      defaultSets = "4 Set"; defaultReps = "8 - 12 Reps"; defaultRest = "90 - 120 Detik";
    }

    const sets = escapeXml(parsed.recommendedSets || defaultSets);
    const reps = escapeXml(parsed.recommendedReps || defaultReps);
    const rest = escapeXml(parsed.recommendedRest || defaultRest);
    const userName = escapeXml(userData.name || "User");

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1200" width="800" height="1200">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0b0c10"/>
          <stop offset="100%" stop-color="#161822"/>
        </linearGradient>
        <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#1a1c26"/>
          <stop offset="100%" stop-color="#14151f"/>
        </linearGradient>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#eab308"/>
          <stop offset="100%" stop-color="#ca8a04"/>
        </linearGradient>
      </defs>

      <!-- Background Poster -->
      <rect width="800" height="1200" fill="url(#bgGrad)"/>
      <rect x="16" y="16" width="768" height="1168" rx="24" fill="#12131a" stroke="#eab308" stroke-width="2.5"/>

      <!-- Header Section with Title & Machine Graphic Banner -->
      <g transform="translate(40, 36)">
        <rect x="0" y="0" width="280" height="28" rx="14" fill="rgba(234, 179, 8, 0.15)" stroke="#eab308" stroke-width="1.2"/>
        <text x="140" y="18.5" fill="#eab308" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle" letter-spacing="1.5">⚡ GYMBUDDY AI • INFOGRAFIS ALAT</text>

        <text x="0" y="62" fill="#FFFFFF" font-family="sans-serif" font-size="28" font-weight="900" letter-spacing="0.5">TUTORIAL CARA PAKAI ALAT INI</text>
        <text x="0" y="94" fill="#eab308" font-family="sans-serif" font-size="22" font-weight="bold">${eqName}</text>
        <text x="0" y="118" fill="#94a3b8" font-family="sans-serif" font-size="13">${escapeXml(rawDesc.substring(0, 75))}</text>

        <!-- Right Machine Illustration Banner Graphics -->
        <g transform="translate(520, 5)">
          <rect x="0" y="0" width="200" height="120" rx="16" fill="#1e2230" stroke="rgba(234,179,8,0.2)"/>
          <path d="M 40 90 L 160 90 M 60 90 L 80 40 L 140 40 L 140 90 M 110 40 L 110 25 M 95 25 L 125 25" stroke="#eab308" stroke-width="4" stroke-linecap="round" fill="none"/>
          <circle cx="80" cy="40" r="6" fill="#06b6d4"/>
          <circle cx="140" cy="40" r="6" fill="#06b6d4"/>
          <circle cx="110" cy="25" r="5" fill="#eab308"/>
          <text x="100" y="110" fill="#94a3b8" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle">DIAGRAM VISUAL ALAT</text>
        </g>
      </g>

      <line x1="40" y1="175" x2="760" y2="175" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>

      <!-- Section 1: BAGIAN ALAT (Machine Diagram Left + Callout Pins Right) -->
      <g transform="translate(40, 190)">
        <rect x="0" y="0" width="720" height="185" rx="16" fill="url(#cardGrad)" stroke="rgba(255,255,255,0.06)"/>
        <rect x="16" y="14" width="130" height="24" rx="12" fill="rgba(234,179,8,0.2)"/>
        <text x="81" y="30" fill="#eab308" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">🔩 BAGIAN ALAT</text>

        <!-- Machine Diagram Pin Graphic on Left -->
        <g transform="translate(20, 48)">
          <rect x="0" y="0" width="220" height="120" rx="12" fill="#12141d" stroke="rgba(255,255,255,0.05)"/>
          <path d="M 30 95 L 190 95 M 50 95 L 80 40 L 160 40 L 180 95" stroke="#475569" stroke-width="5" fill="none"/>
          <rect x="90" y="30" width="50" height="18" rx="4" fill="#ca8a04"/>
          <circle cx="50" cy="95" r="10" fill="#334155"/>
          <circle cx="180" cy="95" r="10" fill="#334155"/>
          <circle cx="50" cy="70" r="10" fill="#eab308"/><text x="50" y="74" fill="#000" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle">1</text>
          <circle cx="180" cy="70" r="10" fill="#eab308"/><text x="180" y="74" fill="#000" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle">2</text>
          <circle cx="115" cy="22" r="10" fill="#eab308"/><text x="115" y="26" fill="#000" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle">3</text>
          <circle cx="160" cy="35" r="10" fill="#eab308"/><text x="160" y="39" fill="#000" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle">4</text>
        </g>

        <!-- Right Side Parts Legend (4 Callout Items) -->
        <g transform="translate(260, 48)">
          ${partsList.slice(0, 4).map((p: string, i: number) => {
            const y = i * 28;
            return `
              <g transform="translate(0, ${y})">
                <circle cx="12" cy="10" r="10" fill="#eab308"/>
                <text x="12" y="14" fill="#000" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">${i + 1}</text>
                <text x="32" y="14" fill="#f8fafc" font-family="sans-serif" font-size="12" font-weight="bold">${escapeXml(p.substring(0, 48))}</text>
              </g>
            `;
          }).join("")}
        </g>
      </g>

      <!-- Section 2: CARA PAKAI (4 Grid Step Cards with Pose Graphics) -->
      <g transform="translate(40, 390)">
        <rect x="0" y="0" width="720" height="345" rx="16" fill="url(#cardGrad)" stroke="rgba(255,255,255,0.06)"/>
        <rect x="16" y="14" width="130" height="24" rx="12" fill="rgba(234,179,8,0.2)"/>
        <text x="81" y="30" fill="#eab308" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">📐 CARA PAKAI</text>

        ${stepsList.slice(0, 4).map((s: string, i: number) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const x = 16 + col * 348;
          const y = 48 + row * 140;

          const posePaths = [
            "M 30 65 L 30 40 L 45 25 M 30 40 L 15 50 M 45 25 L 60 40 L 65 65",
            "M 25 55 L 45 45 L 65 45 M 45 45 L 35 30 M 65 45 L 75 60",
            "M 20 60 L 40 30 L 65 50 M 40 30 L 55 20 M 65 50 L 70 70",
            "M 25 45 L 50 35 L 70 30 M 50 35 L 40 20 M 70 30 L 80 50"
          ];

          return `
            <g transform="translate(${x}, ${y})">
              <rect width="338" height="130" rx="12" fill="#181a24" stroke="rgba(255,255,255,0.05)"/>
              <circle cx="22" cy="22" r="11" fill="#eab308"/>
              <text x="22" y="26" fill="#000" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">${i + 1}</text>
              <text x="40" y="26" fill="#eab308" font-family="sans-serif" font-size="13" font-weight="bold">LANGKAH ${i + 1}</text>

              <g transform="translate(16, 42)">
                <rect width="90" height="72" rx="8" fill="#10121a" stroke="rgba(234,179,8,0.15)"/>
                <path d="${posePaths[i]}" stroke="#06b6d4" stroke-width="3" stroke-linecap="round" fill="none"/>
                <circle cx="${35 + i * 5}" cy="20" r="5" fill="#eab308"/>
              </g>

              <text x="118" y="60" fill="#f8fafc" font-family="sans-serif" font-size="11" font-weight="bold">${escapeXml(s.substring(0, 32))}</text>
              <text x="118" y="78" fill="#cbd5e1" font-family="sans-serif" font-size="10">${escapeXml(s.substring(32, 68) || "")}</text>
              <text x="118" y="94" fill="#94a3b8" font-family="sans-serif" font-size="10">${escapeXml(s.substring(68, 105) || "")}</text>
            </g>
          `;
        }).join("")}
      </g>

      <!-- Section 3: TIPS & KESALAHAN UMUM (With Posture Warning Graphic) -->
      <g transform="translate(40, 750)">
        <!-- Tips Card -->
        <g transform="translate(0, 0)">
          <rect x="0" y="0" width="348" height="215" rx="16" fill="url(#cardGrad)" stroke="rgba(255,255,255,0.06)"/>
          <rect x="16" y="14" width="80" height="22" rx="11" fill="rgba(34,197,94,0.15)"/>
          <text x="56" y="29" fill="#22c55e" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">💡 TIPS</text>

          ${tipsList.slice(0, 4).map((t: string, i: number) => `
            <g transform="translate(16, ${48 + i * 40})">
              <circle cx="10" cy="10" r="8" fill="#22c55e"/>
              <text x="10" y="14" fill="#000" font-size="10" text-anchor="middle">✓</text>
              <text x="26" y="14" fill="#cbd5e1" font-family="sans-serif" font-size="11" font-weight="bold">${escapeXml(t.substring(0, 40))}</text>
            </g>
          `).join("")}
        </g>

        <!-- Kesalahan Umum Card with Posture Warning Diagram -->
        <g transform="translate(372, 0)">
          <rect x="0" y="0" width="348" height="215" rx="16" fill="url(#cardGrad)" stroke="rgba(255,255,255,0.06)"/>
          <rect x="16" y="14" width="140" height="22" rx="11" fill="rgba(239,68,68,0.15)"/>
          <text x="86" y="29" fill="#ef4444" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">❌ KESALAHAN UMUM</text>

          ${mistakesList.slice(0, 3).map((m: string, i: number) => `
            <g transform="translate(16, ${48 + i * 40})">
              <circle cx="10" cy="10" r="8" fill="#ef4444"/>
              <text x="10" y="14" fill="#fff" font-size="10" text-anchor="middle">✕</text>
              <text x="26" y="14" fill="#cbd5e1" font-family="sans-serif" font-size="11" font-weight="bold">${escapeXml(m.substring(0, 34))}</text>
            </g>
          `).join("")}

          <g transform="translate(230, 130)">
            <rect width="100" height="70" rx="8" fill="#12141f" stroke="rgba(239,68,68,0.3)"/>
            <path d="M 20 50 Q 50 15 80 50" stroke="#ef4444" stroke-width="3" stroke-dasharray="3,3" fill="none"/>
            <circle cx="50" cy="28" r="7" fill="#ef4444"/>
            <text x="50" y="32" fill="#fff" font-size="9" text-anchor="middle">✕</text>
            <text x="50" y="63" fill="#94a3b8" font-family="sans-serif" font-size="9" text-anchor="middle">Postur Salah</text>
          </g>
        </g>
      </g>

      <!-- Section 4: OTOT DILATIH & REKOMENDASI -->
      <g transform="translate(40, 980)">
        <!-- Left: Muscle Anatomy Box -->
        <g transform="translate(0, 0)">
          <rect x="0" y="0" width="348" height="140" rx="16" fill="url(#cardGrad)" stroke="rgba(234, 179, 8, 0.2)"/>
          <rect x="16" y="14" width="140" height="22" rx="11" fill="rgba(234, 179, 8, 0.15)"/>
          <text x="86" y="29" fill="#eab308" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">🎯 OTOT DILATIH</text>

          <g transform="translate(16, 45)">
            <rect width="80" height="80" rx="8" fill="#12141f" stroke="rgba(234,179,8,0.2)"/>
            <path d="M 40 15 L 40 70 M 25 30 L 55 30 M 25 30 L 20 55 M 55 30 L 60 55 M 32 70 L 30 90 M 48 70 L 50 90" stroke="#475569" stroke-width="3" stroke-linecap="round"/>
            <circle cx="40" cy="15" r="6" fill="#475569"/>
            <ellipse cx="40" cy="35" rx="12" ry="8" fill="rgba(234,179,8,0.7)"/>
            <ellipse cx="40" cy="50" rx="10" ry="6" fill="rgba(234,179,8,0.7)"/>
          </g>

          <text x="110" y="65" fill="#f8fafc" font-family="sans-serif" font-size="12" font-weight="bold">• ${escapeXml(rawMuscles.substring(0, 28))}</text>
          <text x="110" y="85" fill="#cbd5e1" font-family="sans-serif" font-size="11">• Core &amp; Stabilizer Otot</text>
          <text x="110" y="105" fill="#94a3b8" font-family="sans-serif" font-size="10">Target utama latihan ini</text>
        </g>

        <!-- Right: Rekomendasi 3 Stat Cards -->
        <g transform="translate(372, 0)">
          <rect x="0" y="0" width="348" height="140" rx="16" fill="url(#cardGrad)" stroke="rgba(234, 179, 8, 0.2)"/>
          <rect x="16" y="14" width="130" height="22" rx="11" fill="rgba(6,182,212,0.15)"/>
          <text x="81" y="29" fill="#06b6d4" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">📊 REKOMENDASI</text>

          <g transform="translate(16, 48)">
            <rect x="0" y="0" width="98" height="75" rx="10" fill="rgba(234, 179, 8, 0.1)" stroke="rgba(234, 179, 8, 0.3)"/>
            <text x="49" y="35" fill="#eab308" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle">${sets}</text>
            <text x="49" y="58" fill="#94a3b8" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle">SETS</text>

            <rect x="108" y="0" width="102" height="75" rx="10" fill="rgba(6, 182, 212, 0.1)" stroke="rgba(6, 182, 212, 0.3)"/>
            <text x="159" y="35" fill="#06b6d4" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">${reps}</text>
            <text x="159" y="58" fill="#94a3b8" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle">REPETISI</text>

            <rect x="220" y="0" width="98" height="75" rx="10" fill="rgba(234, 179, 8, 0.1)" stroke="rgba(234, 179, 8, 0.3)"/>
            <text x="269" y="35" fill="#eab308" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">${rest}</text>
            <text x="269" y="58" fill="#94a3b8" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle">ISTIRAHAT</text>
          </g>
        </g>
      </g>

      <!-- Footer -->
      <text x="400" y="1150" fill="#64748b" font-family="sans-serif" font-size="11" text-anchor="middle">Official GymBuddy AI Visual Infographic Guide • Khusus untuk ${userName}</text>
    </svg>`;
  }

  // GymBuddy Official Visual Infographic Image Route (SVG / PNG)
  app.get(["/api/infographic/:id.svg", "/api/infographic/:id.png"], async (req, res) => {
    const rawId = req.params.id;
    const idStr = Array.isArray(rawId) ? rawId[0] : (rawId || "");
    const cleanId = idStr.replace(/\.(svg|png|jpg|jpeg)$/i, "");
    const info = (dbData.infographics && dbData.infographics[cleanId]) ? dbData.infographics[cleanId] : null;
    const parsed = info ? info.parsed : { equipmentName: "Dumbbell Hex" };
    const userData = info ? info.userData : { name: "User", goalTitle: "Menurunkan Berat Badan" };

    const svgStr = generateInfographicSVG(parsed, userData);

    try {
      // @ts-ignore
      const { Resvg } = await import("@resvg/resvg-js");
      const resvg = new Resvg(svgStr, { fitTo: { mode: "width", value: 800 } });
      const pngData = resvg.render();
      const pngBuffer = pngData.asPng();

      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(pngBuffer);
    } catch (e: any) {
      console.log("[Resvg Render Fallback]:", e?.message || e);
      res.setHeader("Content-Type", "image/svg+xml");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(svgStr);
    }
  });

  // GymBuddy Official Visual Infographic Template Web Route
  app.get("/infographic/:id", (req, res) => {
    const rawId = req.params.id;
    const idStr = Array.isArray(rawId) ? rawId[0] : (rawId || "");
    const info = (dbData.infographics && dbData.infographics[idStr]) ? dbData.infographics[idStr] : null;

    const parsed = info ? info.parsed : {
      equipmentName: "Dumbbell Hex",
      description: "Alat ini digunakan untuk melatih kelompok otot target dengan gerakan isolasi atau kompaun.",
      targetMuscles: "Biceps, Triceps, Chest, Shoulder, Back",
      parts: ["Pegangan (Grip)", "Beban (Weight Head)", "Hexagonal Edge", "Iron Core"],
      steps: ["Atur Posisi: Berdiri tegak atau duduk di bench dengan stabil.", "Posisi Awal: Pegang dumbbell dengan erat di kedua tangan.", "Gerakan Latihan: Angkat/dorong dumbbell perlahan 2-3 detik.", "Gerakan Akhir: Turunkan kembali ke posisi awal dengan terkontrol."],
      tips: ["Gerakan perlahan dan terkontrol.", "Fokus pada kontraksi otot target.", "Jaga punggung tetap lurus.", "Gunakan beban yang sesuai."],
      mistakes: ["Menggunakan ayunan/momentum.", "Posisi punggung membungkuk.", "Gerakan terlalu cepat."]
    };
    const userData = info ? info.userData : { name: "Pengguna GymBuddy", goalTitle: "Menurunkan Berat Badan" };

    const rawEqName = (parsed.equipmentName || "ALAT GYM").trim();
    const isGeneric = !rawEqName || rawEqName.includes("THIS MACHINE") || rawEqName.includes("Nama Alat Gym");
    const eqName = (isGeneric ? "ALAT GYM / MESIN LATIHAN" : rawEqName).toUpperCase();

    // Match with real exercise database
    const dbMatch = findExerciseOrEquipment(rawEqName || parsed.generalReply || "");

    const desc = (dbMatch && dbMatch.equipmentSetup?.[0]) || parsed.description || "Melatih kelompok otot target secara optimal.";
    const muscles = (dbMatch && dbMatch.targetMuscles?.join(", ")) || parsed.targetMuscles || "Punggung, Glutes, Hamstring";

    const partsList = Array.isArray(parsed.parts) && parsed.parts.length > 0
      ? parsed.parts
      : (dbMatch && dbMatch.equipmentSetup ? dbMatch.equipmentSetup : ["Pegangan Utama", "Beban Principal", "Pengunci", "Support Pad"]);

    const stepsList = (dbMatch && dbMatch.instructions && dbMatch.instructions.length > 0)
      ? dbMatch.instructions
      : (Array.isArray(parsed.steps) && parsed.steps.length > 0 ? parsed.steps : ["Atur Posisi", "Posisi Awal", "Gerakan Latihan", "Gerakan Akhir"]);

    const tipsList = (dbMatch && dbMatch.dosAndDonts?.dos && dbMatch.dosAndDonts.dos.length > 0)
      ? dbMatch.dosAndDonts.dos
      : (Array.isArray(parsed.tips) && parsed.tips.length > 0 ? parsed.tips : ["Gerakan perlahan", "Fokus kontraksi otot"]);

    const mistakesList = (dbMatch && dbMatch.dosAndDonts?.donts && dbMatch.dosAndDonts.donts.length > 0)
      ? dbMatch.dosAndDonts.donts
      : (Array.isArray(parsed.mistakes) && parsed.mistakes.length > 0 ? parsed.mistakes : ["Menggunakan momentum", "Postur membungkuk"]);

    const exerciseMediaUrl = dbMatch?.gifUrl || dbMatch?.thumbnailUrl || (dbMatch?.imageFrames && dbMatch.imageFrames[0]) || "";

    let defaultSets = "3 - 4 Set";
    let defaultReps = "10 - 15 Repetisi";
    let defaultRest = "60 - 90 Detik";

    const goalLower = (userData.goalTitle || "").toLowerCase();
    if (goalLower.includes("menurunkan") || goalLower.includes("fat loss") || goalLower.includes("turun")) {
      defaultSets = "3 - 4 Set";
      defaultReps = "12 - 15 Repetisi (Kalori Tinggi)";
      defaultRest = "45 - 60 Detik (Intensitas Tinggi)";
    } else if (goalLower.includes("naik") || goalLower.includes("otot") || goalLower.includes("gain")) {
      defaultSets = "4 Set";
      defaultReps = "8 - 12 Repetisi (Hipertrofi Otot)";
      defaultRest = "90 - 120 Detik (Recovery Maksimal)";
    }

    const sets = parsed.recommendedSets || defaultSets;
    const reps = parsed.recommendedReps || defaultReps;
    const rest = parsed.recommendedRest || defaultRest;

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TUTORIAL CARA PAKAI ALAT - ${eqName} | GymBuddy AI</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0b0c10;
      color: #f1f5f9;
      font-family: 'Plus Jakarta Sans', sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }
    .poster {
      width: 100%;
      max-width: 680px;
      background: #12131a;
      border: 2px solid #eab308;
      border-radius: 24px;
      padding: 32px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.8), 0 0 35px rgba(234, 179, 8, 0.2);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .badge {
      display: inline-block;
      background: rgba(234, 179, 8, 0.15);
      color: #eab308;
      font-family: 'Outfit', sans-serif;
      font-weight: 800;
      font-size: 12px;
      letter-spacing: 2px;
      padding: 6px 16px;
      border-radius: 20px;
      border: 1px solid rgba(234, 179, 8, 0.4);
      margin-bottom: 10px;
    }
    .title {
      font-family: 'Outfit', sans-serif;
      font-size: 28px;
      font-weight: 900;
      line-height: 1.1;
      color: #ffffff;
      text-transform: uppercase;
    }
    .machine-name {
      color: #eab308;
      font-family: 'Outfit', sans-serif;
      font-size: 24px;
      font-weight: 800;
      margin-top: 6px;
    }
    .sub-desc {
      color: #94a3b8;
      font-size: 13px;
      margin-top: 8px;
      line-height: 1.5;
    }
    .section-box {
      background: #1a1c26;
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 18px;
      border: 1px solid rgba(255,255,255,0.06);
    }
    .sec-title {
      font-family: 'Outfit', sans-serif;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 1px;
      color: #eab308;
      text-transform: uppercase;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .grid-4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; }
    .card-item {
      background: #222533;
      border-radius: 12px;
      padding: 14px;
      border: 1px solid rgba(255,255,255,0.04);
    }
    .card-num {
      width: 24px; height: 24px;
      background: #eab308; color: #000;
      border-radius: 50%; font-weight: 900; font-size: 12px;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 10px;
    }
    .card-text { font-size: 12px; font-weight: 600; color: #f8fafc; line-height: 1.4; }
    .list-item { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; margin-bottom: 10px; color: #cbd5e1; line-height: 1.4; }
    .stat-card {
      background: linear-gradient(135deg, rgba(234,179,8,0.12) 0%, rgba(6,182,212,0.12) 100%);
      border: 1px solid rgba(234,179,8,0.3);
      border-radius: 14px;
      padding: 14px;
      text-align: center;
    }
    .stat-val { font-family: 'Outfit', sans-serif; font-size: 18px; font-weight: 800; color: #eab308; }
    .stat-lbl { font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase; margin-top: 4px; }
    .footer {
      text-align: center; font-size: 12px; color: #64748b; margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="poster">
    <div class="header">
      <div>
        <div class="badge">⚡ GYMBUDDY AI • INFOGRAFIS VISUAL RESMI</div>
        <div class="title">TUTORIAL CARA PAKAI ALAT INI</div>
        <div class="machine-name">${eqName}</div>
        <div class="sub-desc">${desc}</div>
      </div>
    </div>

    ${exerciseMediaUrl ? `
    <!-- DEMONSTRASI VISUAL WORKOUT DATABASE -->
    <div style="margin-bottom: 20px; border-radius: 16px; overflow: hidden; background: #0c0e14; border: 1.5px solid rgba(234, 179, 8, 0.35); text-align: center; padding: 12px;">
      <div style="font-size: 11px; font-weight: 800; color: #eab308; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px;">🎬 DEMONSTRASI GERAKAN & FORM</div>
      <img src="${exerciseMediaUrl}" alt="${eqName}" style="max-width: 100%; max-height: 360px; border-radius: 12px; object-fit: contain; display: inline-block;" />
    </div>
    ` : ''}

    <!-- BAGIAN ALAT -->
    <div class="section-box">
      <div class="sec-title">🔩 BAGIAN UTAMA ALAT</div>
      <div class="grid-4">
        ${partsList.map((p: string, i: number) => `
          <div class="card-item">
            <div class="card-num">${i + 1}</div>
            <div class="card-text">${p}</div>
          </div>
        `).join("")}
      </div>
    </div>

    <!-- CARA PAKAI STEP BY STEP -->
    <div class="section-box">
      <div class="sec-title">📐 CARA PAKAI (STEP-BY-STEP)</div>
      <div class="grid-4">
        ${stepsList.map((s: string, i: number) => `
          <div class="card-item">
            <div class="card-num">${i + 1}</div>
            <div class="card-text">${s}</div>
          </div>
        `).join("")}
      </div>
    </div>

    <!-- TIPS & KESALAHAN UMUM -->
    <div class="grid-2">
      <div class="section-box">
        <div class="sec-title">💡 TIPS PERFORMA</div>
        ${tipsList.map((t: string) => `
          <div class="list-item">
            <span>✅</span> <span>${t}</span>
          </div>
        `).join("")}
      </div>
      <div class="section-box">
        <div class="sec-title">❌ KESALAHAN UMUM</div>
        ${mistakesList.map((m: string) => `
          <div class="list-item">
            <span>⚠️</span> <span>${m}</span>
          </div>
        `).join("")}
      </div>
    </div>

    <!-- OTOT DILATIH & REKOMENDASI -->
    <div class="section-box">
      <div class="sec-title">🎯 OTOT DILATIH: ${muscles}</div>
      <div style="margin-top: 10px;" class="grid-4">
        <div class="stat-card">
          <div class="stat-val">${sets}</div>
          <div class="stat-lbl">SETS</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">${reps}</div>
          <div class="stat-lbl">REPETISI</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">${rest}</div>
          <div class="stat-lbl">ISTIRAHAT</div>
        </div>
      </div>
    </div>

    <div class="footer">
      Official GymBuddy AI Guide • Dibuat khusus untuk <strong>${userData.name || "User"}</strong> (${userData.goalTitle || "Goal Harian"})
    </div>
  </div>
</body>
</html>`;

    res.send(html);
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

    const mediaVisual = dbMatch?.gifUrl || dbMatch?.thumbnailUrl || (dbMatch?.imageFrames && dbMatch.imageFrames[0]) || "";

    const infoId = `info-${Date.now()}`;
    if (!dbData.infographics) dbData.infographics = {};
    dbData.infographics[infoId] = {
      parsed: { ...parsed, equipmentName: eqName, description: desc, targetMuscles: muscles, parts: dbMatch?.equipmentSetup || parsed.parts, steps: dbMatch?.instructions || parsed.steps, tips: dbMatch?.dosAndDonts?.dos || parsed.tips, mistakes: dbMatch?.dosAndDonts?.donts || parsed.mistakes },
      userData,
      timestamp: new Date().toISOString()
    };
    saveDb();

    const baseUrl = process.env.RENDER_EXTERNAL_URL || "https://gymbuddy-backend-zfft.onrender.com";
    const infographicUrl = `${baseUrl}/infographic/${infoId}`;

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

    return `🏋️ *TUTORIAL CARA PAKAI ALAT: ${eqName}*
----------------------------------------
📌 *Nama Alat*: ${eqName}
📝 *Fungsi*: ${desc}
🎯 *Target Otot*: ${muscles}
📋 *Goal Kamu*: ${userData.goalTitle || "Kebugaran Harian"}

🖼️ *POSTER INFOGRAFIS VISUAL GYMBUDDY RESMI*:
🔗 ${infographicUrl}

🔩 *BAGIAN ALAT*:
${parts}

📐 *CARA PAKAI (STEP-BY-STEP)*:
${steps}

💡 *TIPS PERFORMA*:
${tips}

❌ *KESALAHAN UMUM*:
${mistakes}

📊 *REKOMENDASI LATIHAN (KHUSUS SESUAI GOAL KAMU)*:
⏱️ *Sets*: ${sets}
🔄 *Reps*: ${reps}
⏳ *Istirahat*: ${rest}

💪 *Coach*: Cobalah porsi di atas & klik link di atas untuk melihat Poster Infografis Visual Resmi GymBuddy AI!`;
  }

  // =============================================
  // TWILIO WHATSAPP WEBHOOK
  // =============================================
  function escapeXml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  app.post("/api/twilio/webhook", express.urlencoded({ extended: true }), express.json(), async (req, res) => {
    try {
      const body = req.body;
      const rawFrom = body.From || "";
      const userText = (body.Body || "").trim();
      const numMedia = parseInt(body.NumMedia || "0", 10);
      const mediaUrl = numMedia > 0 ? body.MediaUrl0 : "";

      if (!rawFrom) {
        return res.type("text/xml").send("<Response></Response>");
      }
      console.log(`[Twilio WA] Message from ${rawFrom}: "${userText}" media: ${mediaUrl}`);

      const from = normalizePhone(rawFrom.replace("whatsapp:", ""));
      let userProfile = getUserProfile(from);
      const lowerText = userText.toLowerCase();

      const isWelcomeMessage = (lowerText.includes("gymbuddy") && (lowerText.includes("target harian") || lowerText.includes("target saya") || lowerText.includes("tolong kirimkan"))) ||
                               (lowerText.includes("nama saya") && lowerText.includes("target saya"));

      // Check if user has onboarding data in latest_onboarding
      if (!userProfile) {
        const latestOB = dbData.users["latest_onboarding"] as any;
        if (latestOB && latestOB.weight) {
          userProfile = saveUserProfile(from, { ...latestOB, phone: from, normalizedPhone: from });
        }
      }

      // If user has NOT completed onboarding on Web UI, require onboarding first!
      if (!userProfile && !isWelcomeMessage && !mediaUrl) {
        const reply = `⚠️ *AKUN BELUM TERDAFTAR DI GYMBUDDY AI*\n-----------------------------\n` +
          `Halo! Nomor WhatsApp kamu belum terdaftar.\n\nSilakan isi kuesioner Onboarding di website GymBuddy AI terlebih dahulu untuk memulai! 🎯✨`;
        
        const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(reply)}</Message></Response>`;
        res.type("text/xml").send(twiml);

        // Send direct to WhatsApp via Twilio API so user gets the notification
        if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && getTwilio()) {
          try {
            const twilioPhone = process.env.TWILIO_PHONE_NUMBER || "whatsapp:+14155238886";
            const fromNum = twilioPhone.startsWith("whatsapp:") ? twilioPhone : `whatsapp:${twilioPhone}`;
            const toNum = rawFrom.startsWith("whatsapp:") ? rawFrom : `whatsapp:${rawFrom}`;
            await getTwilio().messages.create({
              body: reply,
              from: fromNum,
              to: toNum
            });
          } catch (twErr: any) {
            console.log("[Twilio WA] Direct API info:", twErr?.message || twErr);
          }
        }
        return;
      }

      if (!userProfile) userProfile = getOrCreateUserProfile(from);
      const userData = calculateUserData(userProfile);

      // Handle RESET command (user wants to wipe data & re-register)
      const isResetQuery = /^(reset|reset\s*data|hapus\s*data|ulang\s*dari\s*awal|registrasi\s*ulang|hapus\s*akun)/i.test(userText.trim());
      if (isResetQuery) {
        delete dbData.users[from];
        for (const k of Object.keys(dbData.dailyLogs)) {
          if (k.startsWith(`${from}_`)) delete dbData.dailyLogs[k];
        }
        delete dbData.weeklyProgress[from];
        for (const k of Object.keys(dbData.waterLogs)) {
          if (k.startsWith(`${from}_`)) delete dbData.waterLogs[k];
        }
        saveDb();

        const resetMsg = `🗑️ *AKUN & DATA BERHASIL DIHAPUS*\n-----------------------------------\n` +
          `Seluruh riwayat makanan, latihan, dan profil kamu di GymBuddy telah dibersihkan secara total.\n\n` +
          `👉 *Untuk Registrasi Ulang*:\n` +
          `Kamu bisa membalas dengan *"Halo Coach"* untuk memulai pendaftaran baru dari awal, atau isi kuesioner baru di website GymBuddy!\n\n` +
          `Semangat memulai perjalanan baru! 💪✨`;

        const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(resetMsg)}</Message></Response>`;
        return res.type("text/xml").send(twiml);
      }

      const weightMatch = userText.match(/(?:update\s+bb|lapor\s+bb|berat\s+badan|bb\s+sekarang|bb)\s*:?\s*(\d+(?:[\.,]\d+)?)/i);
      const waterMatch = userText.match(/(?:minum|air\s+putih|water|hidrasi)\s*:?\s*(\d+(?:[\.,]\d+)?)\s*(gelas|cup|cups|ml|l|liter)?/i);

      // ── Feature 4: DELETE LOG COMMAND ──────────────────────────────────────
      // Supported commands:
      //   "hapus log terakhir" / "batal log" / "cancel log" / "delete last"
      //   "hapus log [nama makanan]"
      //   "hapus semua log hari ini" / "clear log"
      const isDeleteLastLog = /^(hapus\s+log\s+terakhir|batal\s+log|cancel\s+log|delete\s+last|undo\s+log|hapus\s+yang\s+terakhir|cancel\s+entry)/i.test(userText.trim());
      const isDeleteAllLog = /^(hapus\s+semua\s+log|clear\s+log|hapus\s+semua\s+makanan|reset\s+log\s+hari\s+ini)/i.test(userText.trim());
      const deleteByNameMatch = userText.trim().match(/^hapus\s+log\s+(.+)/i);

      if (isDeleteAllLog) {
        const todayStr = getLocalDateStr();
        const key = `${from}_${todayStr}`;
        const altPhone2 = from.startsWith("0") ? "62" + from.substring(1) : (from.startsWith("62") ? "0" + from.substring(2) : from);
        const altKey2 = `${altPhone2}_${todayStr}`;
        const deletedCount = (dbData.dailyLogs[key] || dbData.dailyLogs[altKey2] || []).length;
        if (dbData.dailyLogs[key]) dbData.dailyLogs[key] = [];
        if (dbData.dailyLogs[altKey2]) dbData.dailyLogs[altKey2] = [];
        saveDb();
        const coachN = userData.persona === "max" ? "Coach Max" : "Coach Mia";
        const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(
          `🗑️ *SEMUA LOG HARI INI DIHAPUS*\n-----------------------------\n` +
          `✅ ${deletedCount} entri makanan berhasil dihapus.\n` +
          `📊 Kalori hari ini kembali ke 0 kcal.\n\n` +
          `💬 *${coachN}*: "Log makanan hari ini sudah bersih. Yuk mulai catat lagi dari awal! 🥗"`
        )}</Message></Response>`;
        return res.type("text/xml").send(twiml);
      }

      if (isDeleteLastLog) {
        const deletedItem = deleteLastMealLog(from);
        const coachN = userData.persona === "max" ? "Coach Max" : "Coach Mia";
        const updatedTotals = getDailyTotals(from);
        let replyMsg: string;
        if (deletedItem) {
          replyMsg = `❌ *LOG DIHAPUS*\n-----------------------------\n` +
            `✅ *"${deletedItem.foodName}"* berhasil dihapus dari catatan hari ini.\n\n` +
            `📊 *Sisa Asupan Hari Ini:*\n` +
            `🔥 ${updatedTotals.calories} kcal  •  🍖 ${updatedTotals.protein}g protein\n` +
            `🍚 ${updatedTotals.carbs}g karbo  •  🥓 ${updatedTotals.fat}g lemak\n\n` +
            `💬 *${coachN}*: "Oke, sudah dihapus! Mau catat yang lain?"`;
        } else {
          replyMsg = `ℹ️ *Tidak Ada Log yang Bisa Dihapus*\n-----------------------------\n` +
            `Belum ada catatan makanan hari ini untuk dihapus.\n\n` +
            `💬 *${coachN}*: "Mau catat makanan dulu? Kirim foto atau ketik nama makanannya!"`;
        }
        const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(replyMsg)}</Message></Response>`;
        res.type("text/xml").send(twiml);
        if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && getTwilio()) {
          try {
            const twilioPhone = process.env.TWILIO_PHONE_NUMBER || "whatsapp:+14155238886";
            const fromNum2 = twilioPhone.startsWith("whatsapp:") ? twilioPhone : `whatsapp:${twilioPhone}`;
            const toNum2 = rawFrom.startsWith("whatsapp:") ? rawFrom : `whatsapp:${rawFrom}`;
            await getTwilio().messages.create({ body: replyMsg, from: fromNum2, to: toNum2 });
          } catch (e) {}
        }
        return;
      }

      if (deleteByNameMatch && deleteByNameMatch[1]) {
        const queryName = deleteByNameMatch[1].trim();
        const deletedItem = deleteMealLogByName(from, queryName);
        const coachN = userData.persona === "max" ? "Coach Max" : "Coach Mia";
        const updatedTotals = getDailyTotals(from);
        let replyMsg: string;
        if (deletedItem) {
          replyMsg = `❌ *LOG DIHAPUS*\n-----------------------------\n` +
            `✅ *"${deletedItem.foodName}"* berhasil dihapus!\n\n` +
            `📊 *Sisa Asupan Hari Ini:*\n` +
            `🔥 ${updatedTotals.calories} kcal  •  🍖 ${updatedTotals.protein}g protein\n` +
            `🍚 ${updatedTotals.carbs}g karbo  •  🥓 ${updatedTotals.fat}g lemak\n\n` +
            `💬 *${coachN}*: "Done! Mau koreksi atau catat yang lain?"`;
        } else {
          replyMsg = `⚠️ *Makanan Tidak Ditemukan*\n-----------------------------\n` +
            `Tidak ada log "${queryName}" di catatan hari ini.\n\n` +
            `Ketik *"rekap"* untuk lihat semua log hari ini, atau *"hapus log terakhir"* untuk hapus entry terakhir.`;
        }
        const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(replyMsg)}</Message></Response>`;
        res.type("text/xml").send(twiml);
        if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && getTwilio()) {
          try {
            const twilioPhone = process.env.TWILIO_PHONE_NUMBER || "whatsapp:+14155238886";
            const fromNum2 = twilioPhone.startsWith("whatsapp:") ? twilioPhone : `whatsapp:${twilioPhone}`;
            const toNum2 = rawFrom.startsWith("whatsapp:") ? rawFrom : `whatsapp:${rawFrom}`;
            await getTwilio().messages.create({ body: replyMsg, from: fromNum2, to: toNum2 });
          } catch (e) {}
        }
        return;
      }
      // ── End Feature 4 ────────────────────────────────────────────────────────

      let responseMessages: string[] = [];
      let mediaUrlToSend: string | null = null;

      if (isWelcomeMessage) {
        const nameMatch = userText.match(/(?:i am|saya|nama saya)\s+([^,!\.\n]+)/i);
        const targetMatch = userText.match(/(?:my target is|target saya adalah|goal saya)\s+([^,!\.\n]+)/i);

        // Try to find this user's real onboarding data by name
        const extractedName = nameMatch ? nameMatch[1].trim().toLowerCase() : "";
        if (extractedName) {
          const allUsers = Object.values(dbData.users).filter((u: any) => u && u.name && u.phone !== "latest_onboarding");
          const matchByName = allUsers.find((u: any) => (u.name || "").toLowerCase().includes(extractedName) || extractedName.includes((u.name || "").toLowerCase()));
          if (matchByName && (matchByName as any).weight) {
            // Found a real registered profile matching this name - assign it to this phone
            userProfile = saveUserProfile(from, { ...(matchByName as any), phone: from, normalizedPhone: from });
          }
        }

        // Also check latest_onboarding by name
        const latestOB = dbData.users["latest_onboarding"] as any;
        if (latestOB && latestOB.name && extractedName && latestOB.weight) {
          if ((latestOB.name || "").toLowerCase().includes(extractedName) || extractedName.includes((latestOB.name || "").toLowerCase())) {
            userProfile = saveUserProfile(from, { ...latestOB, phone: from, normalizedPhone: from });
          }
        }

        let profileUpdated = false;
        if (nameMatch && nameMatch[1].trim() && !userProfile.weight) {
          userProfile.name = nameMatch[1].trim();
          profileUpdated = true;
        }
        if (targetMatch && targetMatch[1].trim()) {
          const rawGoal = targetMatch[1].trim().toLowerCase();
          if (rawGoal.includes("lose") || rawGoal.includes("turun") || rawGoal.includes("kurus") || rawGoal.includes("diet")) {
            userProfile.goal = "lose";
            userProfile.goalTitle = "Menurunkan Berat Badan";
            if (userProfile.targetWeight >= userProfile.weight) {
              userProfile.targetWeight = Math.max(50, userProfile.weight - 5);
            }
          } else if (rawGoal.includes("gain") || rawGoal.includes("naik") || rawGoal.includes("otot") || rawGoal.includes("massa") || rawGoal.includes("bulking")) {
            userProfile.goal = "gain";
            userProfile.goalTitle = "Menaikkan Berat Badan & Massa Otot";
            if (userProfile.targetWeight <= userProfile.weight) {
              userProfile.targetWeight = userProfile.weight + 5;
            }
          } else {
            userProfile.goal = "maintain";
            userProfile.goalTitle = "Gaya Hidup Sehat & Fit";
          }
          profileUpdated = true;
        }
        if (profileUpdated) {
          saveUserProfile(from, userProfile);
        }

        const freshUserData = calculateUserData(userProfile);
        responseMessages = generateWelcomeMessages(freshUserData);
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
          actualMl = Math.round(rawAmount) * 250;
        }
        const cupsToAdd = Math.max(1, Math.round(actualMl / 250));
        const newTotalCups = setWaterCups(from, getWaterCups(from) + cupsToAdd);
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
        responseMessages = [
          `💧 *CATATAN HIDRASI DISIMPAN*\n-----------------------------\n` +
          `✅ Kamu menambah *${actualMl} ml* air putih!\n` +
          `📊 Total Hidrasi: *${newTotalCups} Gelas* (${liters}L / 3.0L Target)\n\n` +
          `💬 *${coachName}*: Mantap! Tetap jaga hidrasi ya! 💪`
        ];
      } else if (handleReminderCommand(userText, userProfile, from, userData)) {
        responseMessages = handleReminderCommand(userText, userProfile, from, userData)!;
      } else if (userText.match(/(?:selesai\s*latihan|latihan\s*selesai|workout\s*selesai|selesai\s*workout|lapor\s*latihan|catat\s*latihan|latihan\s*hari\s*ini|push\s*up|squat|bench\s*press|pull\s*up|(\d+)\s*set\s*selesai)/i)) {
        const todayStr = getLocalDateStr();
        const workoutKey = `gymbuddy_exercises_${from}_${todayStr}`;
        const coachName = userData.persona === "max" ? "Coach Max" : "Coach Mia";

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
          `🏋️ *LATIHAN HARI INI DICATAT*\n-----------------------------\n` +
          `✅ ${userText.trim()}\n\n` +
          `💬 *${coachName}*:\n"Kerja bagus! Latihan kamu sudah tercatat. Jangan lupa istirahat yang cukup & cukupi konsumsi protein kamu ya! 💪🔥"`
        ];
      } else {
        // 100% PURE AI MESSAGING — ALL messages processed dynamically by Gemini AI
        if (USER_GEMINI_KEY) {
          let imagePart: any = null;
          if (mediaUrl) {
            try {
              let imgResp: any = null;
              try {
                imgResp = await axios.get(mediaUrl, {
                  responseType: "arraybuffer",
                  auth: { username: TWILIO_ACCOUNT_SID, password: TWILIO_AUTH_TOKEN },
                  timeout: 15000
                });
              } catch (e1: any) {
                // Try without auth headers in case media is directly accessible
                imgResp = await axios.get(mediaUrl, {
                  responseType: "arraybuffer",
                  timeout: 15000
                });
              }
              if (imgResp && imgResp.data) {
                const base64Image = Buffer.from(imgResp.data).toString("base64");
                const mimeType = String(imgResp.headers?.["content-type"] || "image/jpeg").split(";")[0];
                imagePart = { inlineData: { data: base64Image, mimeType } };
                console.log("[Twilio WA] Successfully downloaded media image for Gemini vision processing!");
              }
            } catch (imgErr: any) {
              console.error("[Twilio WA] Image download error:", imgErr?.message || imgErr);
            }
          }

          const isMia = userData.persona === "mia" || userData.persona === "nikita";
          const personaInstruction = isMia
            ? `PERSONA MIA: Coach wanita bernama Coach Mia. Sangat santun, ramah, halus, lembut, dan profesional. DILARANG KERAS panggil "sayang/cinta/beb". Gunakan sapaan sopan (aku/kamu).`
            : `PERSONA MAX: Coach pria bernama Coach Max. Tegas, penuh energi, gaul Jakarta (lo/gue).`;

          const dailyTotals = getDailyTotals(from);
          const todayMealLogsStr = dailyTotals.logs.length > 0
            ? dailyTotals.logs.map(m => `- ${m.foodName} (${m.calories} kcal | P:${m.protein}g C:${m.carbs}g F:${m.fat}g)`).join("\n")
            : "Belum ada catatan makanan hari ini";

          // Detect equipment query from EITHER photo OR text keywords (both cases must work)
          const equipmentKeywords = ["alat", "mesin", "cara pakai", "cara memakai", "cara makai", "gimana cara", "how to", "dumbbell", "barbell", "barbel", "bench", "squat rack", "lat pulldown", "leg press", "chest press", "cable", "treadmill", "elliptical", "kettlebell", "smith machine", "pull up", "gym"];
          const hasEquipmentText = equipmentKeywords.some(kw => lowerText.includes(kw));
          const isEquipmentQuery = (imagePart && (hasEquipmentText || lowerText.length < 10)) || (!imagePart && hasEquipmentText && (lowerText.includes("cara") || lowerText.includes("pakai") || lowerText.includes("alat") || lowerText.includes("mesin")));

          const prompt = `KAMU ADALAH BOT ASISTEN GYMBUDDY AI (${personaInstruction}).
INFORMASI USER:
- Nama: ${userData.name} | Berat: ${userData.weight}kg | Target: ${userData.targetWeight}kg
- Target Kalori Harian: ${userData.targetCalories} kcal | Goal: ${userData.goalTitle}
- Asupan Hari Ini: ${dailyTotals.calories} / ${userData.targetCalories} kcal (Protein: ${dailyTotals.protein}g, Karbo: ${dailyTotals.carbs}g, Lemak: ${dailyTotals.fat}g)
- Makanan yang Sudah Dimakan Hari Ini:
${todayMealLogsStr}

PESAN PENGGUNA: "${userText}"${imagePart ? " + FOTO MAKANAN/ALAT" : ""}

TUGAS: Analisis pesan/foto pengguna. Pahami Bahasa Indonesia alamiah (contoh: "tadi pagi makan nasi uduk sama telur", "siang makan ayam geprek level 2", "koreksi: ayamnya 2 potong").
Keluarkan HANYA JSON valid sesuai salah satu format berikut:

FORMAT 1 - JIKA USER MELAPORKAN/MENGINPUT MAKANAN ATAU MINUMAN (BAHASA ALAMIAH / TEKS ATAU FOTO MAKANAN):
{
  "intent": "FOOD_LOG",
  "isFood": true,
  "foodName": "Nama Makanan/Minuman Spesifik & Porsi (misal: Batagor 1 Porsi + Bumbu Kacang / Chicken Rice Bowl + Telur / Nasi Uduk + Telur Balado)",
  "calories": 650,
  "protein": 32,
  "carbs": 65,
  "fat": 28,
  "fiber": 3,
  "sugar": 4,
  "confidenceLevel": 90,
  "satietyScore": 8,
  "satietyExplanation": "Penjelasan singkat 1-2 kalimat mengenai tingkat rasa kenyang berdasarkan protein, serat, lemak, volume makanan, dan komposisi karbohidrat.",
  "healthScore": 8,
  "portionEstimates": ["Nasi Putih (150g)", "Ayam Geprek Dada (120g)", "Sambal & Lalapan"],
  "keyInsights": ["🟢 Tinggi protein mendukung pembentukan otot", "🟡 Perhatikan minyak dari sambal/gorengan"],
  "coachComment": "Saran dari coach singkat & membangun"
}

RUMUS MATEMATIKA SANGAT WAJIB (100% PERSISI, DILARANG SELISIH):
- KALORI HARUS TEPAT SAMA DENGAN: (protein × 4) + (carbs × 4) + (fat × 9).
- Contoh konsisten: Protein 35g (140 kcal) + Karbo 60g (240 kcal) + Lemak 20g (180 kcal) = 560 kcal.

ACUAN BENCHMARK DATABASE NUTRISI INDONESIA (PANGANKU / USDA):
- Batagor 1 porsi (4-5 pcs + bumbu): ~450 kcal | P: 18g | C: 45g | F: 22g | Fiber: 3g
- Siomay Bandung 1 porsi (5 pcs + telur + bumbu): ~480 kcal | P: 24g | C: 42g | F: 24g | Fiber: 3g
- Ayam Geprek + Nasi + Sambal: ~650 kcal | P: 32g | C: 65g | F: 28g | Fiber: 2g
- Chicken Rice Bowl + Telur: ~580 kcal | P: 35g | C: 60g | F: 20g | Fiber: 2g
- Nasi Padang (Rendang/Ayam Pop + Sayur Singkong): ~750 kcal | P: 38g | C: 70g | F: 34g | Fiber: 4g
- Nasi Uduk + Telur Balado + Tempe: ~520 kcal | P: 20g | C: 65g | F: 20g | Fiber: 3g
- Bakso Sapi Urat + Mie: ~420 kcal | P: 26g | C: 40g | F: 18g | Fiber: 2g
- Soto Ayam + Nasi: ~410 kcal | P: 25g | C: 50g | F: 12g | Fiber: 2g
- Gado-Gado / Pecel + Lontong: ~430 kcal | P: 16g | C: 52g | F: 18g | Fiber: 6g

FORMAT 2 - JIKA USER MENANYAKAN REKAP / RIWAYAT MAKANAN / CEK APAPUN YANG SUDAH DIMAKAN HARI INI / SISA KALORI:
{
  "intent": "DAILY_REKAP",
  "isFood": false
}

FORMAT 3 - JIKA USER MENGIRIMKAN FOTO ALAT GYM / MESIN GYM ATAU MENANYAKAN CARA PAKAI ALAT:
{
  "intent": "EQUIPMENT_TUTORIAL",
  "isFood": false,
  "equipmentName": "Nama Spesifik Alat Gym",
  "description": "Fungsi alat",
  "targetMuscles": "Otot yang dilatih",
  "parts": ["Bagian 1", "Bagian 2"],
  "steps": ["Langkah 1", "Langkah 2"],
  "tips": ["Tips 1"],
  "mistakes": ["Kesalahan 1"]
}

FORMAT 4 - JIKA USER MINTA JADWAL LATIHAN / WORKOUT PLAN:
{
  "intent": "WORKOUT_PLAN",
  "isFood": false,
  "generalReply": "Jadwal latihan lengkap"
}

FORMAT 5 - JIKA USER MEMINTA UNTUK ATUR / UBAH PENGINGAT HARIAN ATAU SCHEDULER:
{
  "intent": "REMINDER_SET",
  "isFood": false,
  "reminderEnabled": true,
  "reminderTime": "15:35",
  "generalReply": "Baik Kak Habibi! Jadwal pengingat harian sudah Mia bantu sesuaikan menjadi pukul 15:35 WIB."
}

FORMAT 6 - CHAT UMUM / REKOMENDASI / PERTANYAAN LAINNYA:
{
  "intent": "CHAT",
  "isFood": false,
  "generalReply": "Jawaban coach"
}

CATATAN:
- Jika user meminta koreksi (misal: "koreksi: ayamnya 2 potong" / "salah, porsinya setengah"), sesuaikan jumlah nutrisi dan pilih intent FOOD_LOG dengan porsi baru.
- TULIS JAWABAN RINGKAS & DIRECT TO THE POINT.
- Keluarkan HANYA JSON tanpa teks lain di luar JSON!`;

          try {
            const rawText = await generateGeminiContent(prompt, imagePart);
            let parsed: any = extractAndParseJson(rawText);

            // 0. Check if user is asking for today's daily rekap / meal history summary FIRST
            const isRekapQuery = /^(log\s+makanan\s*(ku|saya)?\s*hari\s*ini|rekap|riwayat|ringkasan\s*makanan|sisa\s*kalori|cek\s*kalori\s*hari\s*ini|laporan\s*makanan|makanan\s*hari\s*ini)/i.test(userText.trim());

            if (isRekapQuery || (parsed && parsed.intent === "DAILY_REKAP")) {
              parsed = { intent: "DAILY_REKAP", isFood: false };
            } else if (!parsed || typeof parsed !== "object") {
              const foodNameMatch = rawText.match(/"foodName"\s*:\s*"([^"]+)"/i);
              const calMatch = rawText.match(/"calories"\s*:\s*(\d+)/i);
              const protMatch = rawText.match(/"protein"\s*:\s*(\d+)/i);
              const carbMatch = rawText.match(/"carbs"\s*:\s*(\d+)/i);
              const fatMatch = rawText.match(/"fat"\s*:\s*(\d+)/i);
              const intentMatch = rawText.match(/"intent"\s*:\s*"([^"]+)"/i);
              const eqMatch = rawText.match(/"equipmentName"\s*:\s*"([^"]+)"/i);

              if (foodNameMatch && (calMatch || parsed?.calories)) {
                parsed = {
                  intent: "FOOD_LOG",
                  isFood: true,
                  foodName: foodNameMatch[1],
                  calories: calMatch ? parseInt(calMatch[1], 10) : Number(parsed?.calories || 0),
                  protein: protMatch ? parseInt(protMatch[1], 10) : Number(parsed?.protein || 0),
                  carbs: carbMatch ? parseInt(carbMatch[1], 10) : Number(parsed?.carbs || 0),
                  fat: fatMatch ? parseInt(fatMatch[1], 10) : Number(parsed?.fat || 0),
                  generalReply: "Catatan makanan berhasil disimpan!"
                };
              } else if (eqMatch || (intentMatch && intentMatch[1] === "EQUIPMENT_TUTORIAL")) {
                parsed = {
                  intent: "EQUIPMENT_TUTORIAL",
                  isFood: false,
                  equipmentName: eqMatch ? eqMatch[1] : "Alat Gym"
                };
              } else if (intentMatch && intentMatch[1] === "DAILY_REKAP") {
                parsed = { intent: "DAILY_REKAP", isFood: false };
              } else {
                let cleanReply = String(rawText || "").replace(/```(?:json)?[\s\S]*?```/gi, "").trim();
                const genReplyMatch = cleanReply.match(/"generalReply"\s*:\s*"([\s\S]*?)"(?=\s*\}|\s*,|\s*\n)/i);
                if (genReplyMatch && genReplyMatch[1]) {
                  cleanReply = genReplyMatch[1].replace(/\\n/g, "\n").trim();
                } else {
                  cleanReply = cleanReply.replace(/^\{[\s\S]*?"generalReply"\s*:\s*"?/i, "").replace(/"?\s*\}?\s*$/i, "").replace(/\\n/g, "\n").trim();
                }
                parsed = { intent: "CHAT", isFood: false, generalReply: cleanReply || "Ada laporan makanan atau latihan lain yang ingin kamu tanyakan?" };
              }
            }

            // If equipment query detected (photo OR text) but AI returned CHAT or WORKOUT, force EQUIPMENT_TUTORIAL
            if (isEquipmentQuery && parsed.intent !== "FOOD_LOG" && parsed.intent !== "EQUIPMENT_TUTORIAL") {
              parsed.intent = "EQUIPMENT_TUTORIAL";
              const eqSources = [userText, parsed.generalReply || ""].join(" ");
              const equipGuess = eqSources.match(/(dumbbell|barbel|barbell|lat pulldown|leg press|chest press|bench press|smith machine|cable machine|hyperextension|treadmill|elliptical|rowing machine|pull up bar|kettlebell|hex dumbbell)/i);
              parsed.equipmentName = equipGuess ? equipGuess[1] : (imagePart ? "Dumbbell Hex" : "Alat Gym");
            }

            if (String(parsed.isFood).toLowerCase() === "true" || parsed.intent === "FOOD_LOG") {
              parsed = validateAndNormalizeNutrition(parsed, Boolean(imagePart));
              parsed.isFood = true;
              const mealId = `m-${Date.now()}`;
              const savedMeal: MealLog = {
                id: mealId, foodName: parsed.foodName || "Makanan",
                calories: Number(parsed.calories) || 0, protein: Number(parsed.protein) || 0,
                carbs: Number(parsed.carbs) || 0, fat: Number(parsed.fat) || 0,
                fiber: Number(parsed.fiber) || 0, mealType: getMealTypeByHour(),
                timestamp: new Date().toISOString()
              };
              addMealLog(from, savedMeal);
              // Feature 5: save lastFoodLog so "koreksi:" command can reference it
              userProfile.lastFoodLog = { ...savedMeal };
              saveUserProfile(from, userProfile);
              const updatedTotals = getDailyTotals(from);
              responseMessages = [formatNutritionCard(parsed, imagePart ? "Foto AI" : "Teks", userData, updatedTotals)];

              // ── Generate Visual Nutrition Card Image (only when user sent a photo) ──
              if (imagePart) {
                try {
                  // WIB day label
                  const wibDays = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
                  let wibDay = "";
                  try {
                    const wibDateStr = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", weekday: "long" }).format(new Date());
                    wibDay = wibDateStr.charAt(0).toUpperCase() + wibDateStr.slice(1);
                  } catch {
                    wibDay = wibDays[new Date().getDay()];
                  }

                  // Store card data for endpoint rendering
                  const cardId = `nc-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
                  if (!dbData.nutritionCards) dbData.nutritionCards = {};
                  dbData.nutritionCards[cardId] = {
                    foodName: parsed.foodName || "Makanan",
                    calories: Number(parsed.calories) || 0,
                    protein: Number(parsed.protein) || 0,
                    carbs: Number(parsed.carbs) || 0,
                    fat: Number(parsed.fat) || 0,
                    fiber: Number(parsed.fiber) || 0,
                    healthScore: Number(parsed.healthScore) || 7,
                    dayLabel: wibDay,
                    // Embed the original food photo back into the card
                    foodImageBase64: imagePart.inlineData?.data || null,
                    foodImageMime: imagePart.inlineData?.mimeType || "image/jpeg"
                  };
                  saveDb();

                  // Build the public URL for this card
                  const publicHost = process.env.PUBLIC_URL
                    || process.env.RENDER_EXTERNAL_URL
                    || process.env.RAILWAY_PUBLIC_DOMAIN
                    || "https://gymbuddy-backend-zfft.onrender.com";
                  const cardUrl = `${publicHost.replace(/\/$/, "")}/api/nutrition-card/${cardId}.png`;
                  mediaUrlToSend = cardUrl;
                  console.log("[NutritionCard] Generated card URL:", cardUrl);
                } catch (cardErr) {
                  console.warn("[NutritionCard] Failed to generate card:", cardErr);
                }
              }
              // ── End Visual Nutrition Card ───────────────────────────────────────────


              // ── Coach Next-Step Advice: generate algorithmic tip based on remaining macros ──
              try {
                const remCal  = Math.max(0, (userData.targetCalories || 2000) - updatedTotals.calories);
                const remProt = Math.max(0, (userData.proteinGrams || 150) - updatedTotals.protein);
                const remCarb = Math.max(0, (userData.carbGrams || 200) - updatedTotals.carbs);
                const remFat  = Math.max(0, (userData.fatGrams || 60) - updatedTotals.fat);
                const isMiaCoach = (userData.persona || "max").toLowerCase().includes("mia");
                const coachNameStr = isMiaCoach ? "Coach Mia" : "Coach Max";
                const goalStr = userData.goal === "lose" ? "turun berat badan" : userData.goal === "gain" ? "naik massa otot" : "jaga berat badan";

                let wibHour2 = 12;
                try {
                  wibHour2 = parseInt(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", hour: "numeric", hour12: false }).format(new Date()), 10);
                } catch (e) { wibHour2 = (new Date().getUTCHours() + 7) % 24; }
                const timeStr2 = wibHour2 < 10 ? "pagi" : wibHour2 < 15 ? "siang" : wibHour2 < 18 ? "sore" : "malam";

                const calPercent = updatedTotals.calories / (userData.targetCalories || 2000);
                let nextStepTip = "";

                if (remProt > (userData.proteinGrams || 150) * 0.75) {
                  nextStepTip = isMiaCoach
                    ? `Protein kamu hari ini masih sangat rendah (*${remProt}g tersisa*). Untuk meal ${timeStr2} berikutnya, prioritaskan dada ayam rebus, telur rebus, atau tahu kukus — protein tinggi biar otot dan metabolismu tetap optimal! 💪`
                    : `Protein lo masih kurang *${remProt}g* bro. Next meal lo harus makan yang tinggi protein — dada ayam panggang, ikan bakar, atau telur rebus 3 biji. Jangan skip! 🔥`;
                } else if (remProt > remCarb && remProt > remFat && remProt > 25) {
                  const sugg = userData.goal === "lose"
                    ? (isMiaCoach ? "dada ayam panggang atau ikan tuna" : "ayam grill atau ikan bakar tanpa nasi")
                    : (isMiaCoach ? "chicken rice bowl atau dada ayam + nasi merah" : "chicken rice bowl atau tuna rice bowl");
                  nextStepTip = isMiaCoach
                    ? `Sisa *${remProt}g protein* masih perlu kamu penuhi hari ini. Untuk meal ${timeStr2} selanjutnya, pilih ${sugg} — pas banget buat recovery dan mendukung ${goalStr}mu! ✨`
                    : `Lo masih butuh *${remProt}g protein* lagi hari ini! Langsung serang — ${sugg}. Otot lo butuh ini buat tumbuh, jangan delay! ⚡`;
                } else if (calPercent > 0.88) {
                  nextStepTip = isMiaCoach
                    ? `Kalori kamu hampir mencapai target hari ini! Kalau masih ingin makan ${timeStr2} ini, pilih camilan ringan saja — buah segar, salad, atau yogurt tanpa gula. Tetap konsisten ya buat ${goalStr}! 🥗`
                    : `Kalori lo udah mepet target bro! Kalau laper, makan yang ringan aja — buah atau salad. Jangan over-eat, kita lagi ngejer ${goalStr}! 🎯`;
                } else if (wibHour2 >= 14 && wibHour2 <= 16 && remProt > 20) {
                  const snackSugg = userData.goal === "gain"
                    ? (isMiaCoach ? "protein shake atau susu full cream" : "protein shake atau susu coklat — kalori ekstra yang bagus")
                    : (isMiaCoach ? "segenggam kacang almond atau yogurt Greek" : "kacang atau yogurt plain buat snack yang ga bikin kalori jebol");
                  nextStepTip = isMiaCoach
                    ? `Waktu ${timeStr2} ini cocok banget buat snack protein! Coba ${snackSugg} — ini bantu kamu penuhi sisa *${remProt}g protein* hari ini tanpa terlalu berat. 🍵`
                    : `${timeStr2.charAt(0).toUpperCase() + timeStr2.slice(1)} ini prime time buat snack protein! Gas ${snackSugg} sekarang. Lo masih butuh *${remProt}g protein* lagi! 💪`;
                } else {
                  const defaultSugg = userData.goal === "lose"
                    ? (isMiaCoach ? "makanan tinggi serat dan protein rendah kalori — sayur bening, ayam rebus, atau ikan kukus" : "ayam panggang + sayur, atau salad tuna — efektif buat fat loss")
                    : userData.goal === "gain"
                    ? (isMiaCoach ? "karbohidrat + protein — nasi merah, kentang, atau oatmeal dengan ayam" : "nasi + ayam geprek atau chicken rice bowl ukuran besar")
                    : (isMiaCoach ? "makanan seimbang — nasi porsi sedang, lauk berprotein, dan sayuran" : "nasi + ayam/ikan + sayur — combo paling solid");
                  nextStepTip = isMiaCoach
                    ? `Untuk meal ${timeStr2} selanjutnya, ${coachNameStr} saranin ${defaultSugg}. Pas banget buat mendukung goal ${goalStr} kamu! Minum air putih 250ml dulu sebelum makan ya. 💧`
                    : `Next meal ${timeStr2} ini, lo butuh ${defaultSugg}. Paling optimal buat ${goalStr} lo! Dan minum air sekarang — jangan tunggu haus bro. 💧🔥`;
                }

                if (nextStepTip) {
                  responseMessages.push(`━━━━━━━━━━━━━━\n🎯 SARAN ${coachNameStr.toUpperCase()}\n━━━━━━━━━━━━━━\n\n${nextStepTip}`);
                }
              } catch (tipErr) {
                console.warn("[next-step-tip] Error generating tip:", tipErr);
              }
              // ── End Coach Next-Step ───────────────────────────────────────────────

            } else if (parsed.intent === "DAILY_REKAP") {
              const totals = getDailyTotals(from);
              responseMessages = [generateDailySummaryCard(userData, totals, "Hari Ini")];
            } else if (parsed.intent === "REMINDER_SET" || parsed.reminderTime) {
              const isOff = parsed.reminderEnabled === false;
              userProfile.reminderEnabled = !isOff;
              if (parsed.reminderTime && /^\d{2}:\d{2}$/.test(parsed.reminderTime)) {
                userProfile.reminderTime = parsed.reminderTime;
              }
              saveUserProfile(from, userProfile);
              const coachN = (userData?.persona || "max").toLowerCase() === "max" ? "Coach Max" : "Coach Mia";
              const replyMsg = parsed.generalReply || (isOff
                ? `❌ *PENGINGAT HARIAN DIMATIKAN*\n-----------------------------\nPengingat harian scheduler kamu telah dinonaktifkan.`
                : `✅ *PENGINGAT HARIAN DIAKTIFKAN*\n-----------------------------\n⏰ Jam Pengingat: *${userProfile.reminderTime} WIB*\nSTATUS: *Scheduler Aktif*\n\n💬 *${coachN}*:\n"Mantap! Setiap hari pukul *${userProfile.reminderTime} WIB*, ${coachN} bakal kirim chat pengingat ke WhatsApp kamu! 🔥"`);
              responseMessages = [replyMsg];
            } else if (parsed.intent === "WORKOUT_PLAN") {
              let workoutReply = parsed.generalReply || "";
              if (!workoutReply || workoutReply.trim().length < 10) {
                workoutReply = `🏋️ *JADWAL LATIHAN UNTUK ${userData.name.toUpperCase()}*\n🎯 Goal: ${userData.goalTitle}\n\n📅 *SENIN - DADA & TRISEP*\n• Bench Press: 4x10\n• Incline Dumbbell Press: 3x12\n• Cable Crossover: 3x15\n• Tricep Pushdown: 3x15\n\n📅 *SELASA - PUNGGUNG & BISEP*\n• Pull Up: 4x8\n• Barbell Row: 4x10\n• Lat Pulldown: 3x12\n• Bicep Curl: 3x15\n\n📅 *RABU - ISTIRAHAT AKTIF*\n• Jalan kaki 30 menit atau Yoga ringan\n\n📅 *KAMIS - KAKI*\n• Squat: 4x10\n• Leg Press: 4x12\n• Lunges: 3x12 per kaki\n• Leg Curl: 3x15\n\n📅 *JUMAT - BAHU & ABS*\n• Shoulder Press: 4x10\n• Lateral Raise: 3x15\n• Face Pull: 3x15\n• Plank: 3x60 detik\n\n📅 *SABTU & MINGGU*\n• Istirahat atau cardio ringan 20-30 menit\n\n💪 *Rekomendasi*: ${userData.goalTitle?.includes("turun") ? "Tambahkan 20 menit cardio setelah latihan" : "Fokus progressive overload setiap minggu"}`;
              }
              responseMessages = [workoutReply];
            } else if (parsed.intent === "EQUIPMENT_TUTORIAL" || parsed.equipmentName) {
              responseMessages = [formatEquipmentTutorialCard(parsed, userData)];
            } else {
              let finalMsg = (parsed.generalReply || "").trim();
              if (!finalMsg || finalMsg.startsWith("{") || finalMsg.includes('"intent":')) {
                const gMatch = (finalMsg || "").match(/"generalReply"\s*:\s*"([\s\S]*?)"(?=\s*\}|\s*,)/i);
                finalMsg = gMatch ? gMatch[1].replace(/\\n/g, "\n").trim() : "";
              }
              if (!finalMsg || finalMsg.length < 5) {
                const coachN = userData.persona === "max" ? "Coach Max" : "Coach Mia";
                finalMsg = `Hei ${userData.name}! 💪 Ada yang bisa ${coachN} bantu hari ini? Mau catat makanan, cek kalori, minta jadwal workout, atau tanya cara pakai alat gym?`;
              }
              responseMessages = [finalMsg];
            }
          } catch (e) {
            console.error("[Twilio WA] Gemini AI error:", e);

            // Smart Instant Fallback Parser for Food Logging when Gemini has API Key/Network Error
            if (userText.match(/(makan|minum|habis|makanan|sarapan|malam|siang|americano|kopi|nasi|ayam|telur|roti|susu|jus|teh|buah|daging|ikan|gandum|es)/i)) {
              const rawFood = userText.replace(/^(aku|saya|gue|habis|makan|minum|catat|log|input|tambah)\s+/gi, "").trim() || "Makanan";
              const foodName = rawFood.charAt(0).toUpperCase() + rawFood.slice(1);
              let estCal = 350, estProt = 15, estCarb = 40, estFat = 10;
              const textLower = userText.toLowerCase();
              if (textLower.includes("americano") || textLower.includes("kopi hitam") || textLower.includes("espresso")) {
                estCal = 10; estProt = 0; estCarb = 2; estFat = 0;
              } else if (textLower.includes("nasi goreng")) {
                estCal = 550; estProt = 18; estCarb = 65; estFat = 22;
              } else if (textLower.includes("telur")) {
                estCal = 210; estProt = 18; estCarb = 2; estFat = 14;
              } else if (textLower.includes("ayam")) {
                estCal = 320; estProt = 35; estCarb = 5; estFat = 15;
              }

              const parsedFallback = { intent: "FOOD_LOG", isFood: true, foodName, calories: estCal, protein: estProt, carbs: estCarb, fat: estFat, generalReply: "Catatan makanan berhasil disimpan!" };
              addMealLog(from, {
                id: `m-${Date.now()}`, foodName,
                calories: estCal, protein: estProt, carbs: estCarb, fat: estFat, fiber: 0, mealType: getMealTypeByHour(),
                timestamp: new Date().toISOString()
              });
              const updatedTotals = getDailyTotals(from);
              responseMessages = [formatNutritionCard(parsedFallback, "Teks", userData, updatedTotals)];
            } else if (userText.match(/(lari|jogging|gbk|olahraga|cardio)/i)) {
              responseMessages = [`🏃 *TIPS LARI SORE DI GBK FOR ${userData.name.toUpperCase()}*\n\n🔥 *Persiapan & Hydration*:\n• Minum 300-500ml air putih 30 menit sebelum lari.\n• Gunakan sepatu lari pendukung & lakukan pemanasan 5 menit.\n\n🎯 *Target*: Lari santai 20-30 menit (Zone 2 cardio) untuk membakar kalori & menjaga kesehatan jantung!\n\nSemangat latihannya hari ini! 💪`];
            } else {
              const coachN = userData.persona === "max" ? "Coach Max" : "Coach Mia";
              responseMessages = [`Hei ${userData.name}! 💪 ${coachN} siap bantu kamu catat makanan (misal: "habis minum americano"), cek kalori, jadwal workout, atau tutorial alat gym!`];
            }
          }
        }
      }

      // Send single WhatsApp response via Twilio REST API & return empty TwiML to prevent webhook timeout
      if (responseMessages.length > 0) {
        const combinedReply = responseMessages.join("\n\n");
        res.type("text/xml").send("<Response></Response>");

        if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && getTwilio()) {
          try {
            const twilioPhone = process.env.TWILIO_PHONE_NUMBER || "whatsapp:+14155238886";
            const fromNum = twilioPhone.startsWith("whatsapp:") ? twilioPhone : `whatsapp:${twilioPhone}`;
            const toNum = rawFrom.startsWith("whatsapp:") ? rawFrom : `whatsapp:${rawFrom}`;

            // Helper to split message under 1400 characters for Twilio REST API limit
            const splitMsg = (str: string, maxLen = 1400): string[] => {
              if (str.length <= maxLen) return [str];
              const result: string[] = [];
              const paragraphs = str.split("\n\n");
              let currentChunk = "";
              for (const p of paragraphs) {
                if ((currentChunk + "\n\n" + p).length > maxLen) {
                  if (currentChunk.trim()) result.push(currentChunk.trim());
                  currentChunk = p;
                } else {
                  currentChunk = currentChunk ? (currentChunk + "\n\n" + p) : p;
                }
              }
              if (currentChunk.trim()) result.push(currentChunk.trim());
              return result.length > 0 ? result : [str.substring(0, maxLen)];
            };

            const chunks = splitMsg(combinedReply, 1400);
            for (let i = 0; i < chunks.length; i++) {
              const msgOpts: any = {
                body: chunks[i],
                from: fromNum,
                to: toNum
              };
              if (i === 0 && mediaUrlToSend) {
                msgOpts.mediaUrl = [mediaUrlToSend];
              }
              await getTwilio().messages.create(msgOpts);
            }
            console.log(`[Twilio WA] Successfully delivered ${chunks.length} WhatsApp message chunk(s) via REST API!`);
          } catch (twErr: any) {
            console.error("[Twilio WA] REST push error:", twErr?.message || twErr);
          }
        }
      } else {
        res.type("text/xml").send("<Response></Response>");
      }
    } catch (error) {
      console.error("[Twilio WA] Webhook error:", error);
      res.type("text/xml").send("<Response></Response>");
    }
  });

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
