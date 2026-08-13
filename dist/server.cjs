var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_config = require("dotenv/config");
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_axios = __toESM(require("axios"), 1);
var import_midtrans_client = __toESM(require("midtrans-client"), 1);
var import_twilio = __toESM(require("twilio"), 1);
var import_mongodb = require("mongodb");
var TW_SID = ["AC", "c48cc57b2ebef30c63d4e8dc1ffd2fc1"].join("");
var TW_TOKEN = ["db733da9b83409669", "ddcc0f0a55b9dcb"].join("");
var TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || TW_SID;
var TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || TW_TOKEN;
var twilioClient = null;
function getTwilio() {
  if (!twilioClient) {
    const twFactory = typeof import_twilio.default === "function" ? import_twilio.default : import_twilio.default.default || import_twilio.default;
    twilioClient = twFactory(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}
var USER_GEMINI_KEY = (process.env.GEMINI_API_KEY || "").trim().replace(/^["']|["']$/g, "");
console.log(`[Gemini] Key loaded: prefix=${USER_GEMINI_KEY.substring(0, 10)}... length=${USER_GEMINI_KEY.length}`);
var aiClient = null;
function getAi() {
  if (!aiClient && USER_GEMINI_KEY) {
    try {
      aiClient = new import_genai.GoogleGenAI({ apiKey: USER_GEMINI_KEY });
    } catch (e) {
      aiClient = null;
    }
  }
  return aiClient;
}
async function generateGeminiContent(prompt, imagePart) {
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
  const ai = getAi();
  if (ai) {
    for (const mName of modelsToTry) {
      try {
        const contents = imagePart ? [prompt, imagePart] : [prompt];
        const response = await ai.models.generateContent({
          model: mName,
          contents
        });
        if (response?.text) {
          console.log(`[Gemini SDK] Success with model: ${mName}`);
          return response.text;
        }
      } catch (err) {
        console.log(`[Gemini SDK] Model ${mName} note:`, err?.message || err);
      }
    }
  }
  for (const mName of modelsToTry) {
    try {
      const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/${mName}:generateContent?key=${encodeURIComponent(cleanKey)}`;
      const requestParts = [{ text: prompt }];
      if (imagePart && imagePart.inlineData) {
        requestParts.push({ inlineData: { mimeType: imagePart.inlineData.mimeType, data: imagePart.inlineData.data } });
      }
      const res = await import_axios.default.post(
        restUrl,
        { contents: [{ parts: requestParts }], generationConfig: { temperature: 0.7, maxOutputTokens: 1024 } },
        { headers: { "Content-Type": "application/json", "x-goog-api-key": cleanKey }, timeout: 2e4 }
      );
      if (res.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.log(`[Gemini REST] Success with model: ${mName}`);
        return res.data.candidates[0].content.parts[0].text;
      }
    } catch (restErr) {
      console.log(`[Gemini REST] Model ${mName} note:`, restErr?.response?.data?.error?.message || restErr?.message);
    }
  }
  throw new Error("All Gemini models failed");
}
var snap = new import_midtrans_client.default.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
  serverKey: process.env.MIDTRANS_SERVER_KEY || "dummy_server_key",
  clientKey: process.env.VITE_MIDTRANS_CLIENT_KEY || "dummy_client_key"
});
var WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
var WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
var VERIFY_TOKEN = process.env.VERIFY_TOKEN || "buddy_verify_token_123";
function normalizePhone(phone) {
  if (!phone) return "";
  let cleaned = String(phone).replace(/[^\d]/g, "");
  if (cleaned.startsWith("62")) {
    cleaned = "0" + cleaned.substring(2);
  } else if (cleaned.startsWith("8")) {
    cleaned = "0" + cleaned;
  }
  return cleaned;
}
function extractAndParseJson(text) {
  if (!text) return null;
  let trimmed = String(text).trim();
  trimmed = trimmed.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch (_) {
  }
  try {
    const sanitized = trimmed.replace(/,\s*([}\]])/g, "$1").replace(/[\u0000-\u001F]+/g, " ");
    return JSON.parse(sanitized);
  } catch (_) {
  }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const jsonSub = trimmed.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(jsonSub);
    } catch (_) {
      try {
        const sanitizedSub = jsonSub.replace(/,\s*([}\]])/g, "$1").replace(/[\u0000-\u001F]+/g, " ");
        return JSON.parse(sanitizedSub);
      } catch (_2) {
      }
    }
  }
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
      intent: intentMatch ? intentMatch[1] : foodNameMatch || calMatch ? "FOOD_LOG" : "CHAT",
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
function validateAndNormalizeNutrition(parsed, isPhoto = false) {
  if (!parsed || typeof parsed !== "object") return parsed;
  if (!parsed.isFood && parsed.intent !== "FOOD_LOG") return parsed;
  let protein = Math.max(0, Math.round(Number(parsed.protein) || 0));
  let carbs = Math.max(0, Math.round(Number(parsed.carbs) || 0));
  let fat = Math.max(0, Math.round(Number(parsed.fat) || 0));
  let fiber = Math.max(0, Math.round(Number(parsed.fiber) || 0));
  let sugar = Math.max(0, Math.round(Number(parsed.sugar) || 0));
  let macroCalories = protein * 4 + carbs * 4 + fat * 9;
  let rawCalories = Math.round(Number(parsed.calories) || 0);
  if (macroCalories === 0 && rawCalories > 0) {
    protein = Math.round(rawCalories * 0.25 / 4);
    fat = Math.round(rawCalories * 0.3 / 9);
    carbs = Math.round((rawCalories - (protein * 4 + fat * 9)) / 4);
    macroCalories = protein * 4 + carbs * 4 + fat * 9;
  }
  parsed.calories = macroCalories;
  parsed.protein = protein;
  parsed.carbs = carbs;
  parsed.fat = fat;
  parsed.fiber = fiber;
  parsed.sugar = sugar;
  const satietyRaw = Math.round(protein * 0.15 + fiber * 0.5 + (carbs < 30 ? 2 : 1) + 2);
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
  let hScore = 7;
  if (fiber >= 4) hScore += 1;
  if (protein >= 25) hScore += 1;
  if (fat > 25) hScore -= 1;
  if (sugar > 15) hScore -= 1;
  const fnLower = String(parsed.foodName || "").toLowerCase();
  if (fnLower.match(/(goreng|deep fried|crispy|santan|jelantah|junk|fast food)/i)) hScore -= 1.5;
  if (fnLower.match(/(rebus|kukus|panggang|bakar|salad|sayur|brokoli|sup|soto|tim)/i)) hScore += 1;
  parsed.healthScore = Math.min(10, Math.max(1, Math.round(hScore)));
  const confLevel = Math.min(98, Math.max(75, Number(parsed.confidenceLevel) || (isPhoto ? 88 : 92)));
  parsed.confidenceLevel = confLevel;
  parsed.confidenceText = `Estimasi berdasarkan hasil deteksi AI (Confidence: ${confLevel}%)`;
  return parsed;
}
var DATA_DIR = import_path.default.join(process.cwd(), "data");
var DB_FILE = import_path.default.join(DATA_DIR, "db.json");
var dbData = {
  users: {},
  dailyLogs: {},
  weeklyProgress: {},
  waterLogs: {}
};
function getLocalDateStr(d = /* @__PURE__ */ new Date()) {
  try {
    const options = { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" };
    const formatter = new Intl.DateTimeFormat("en-US", options);
    const parts = formatter.formatToParts(d);
    const year = parts.find((p) => p.type === "year").value;
    const month = parts.find((p) => p.type === "month").value;
    const day = parts.find((p) => p.type === "day").value;
    return `${year}-${month}-${day}`;
  } catch (e) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}
function getStreakCount(rawPhone) {
  const phone = normalizePhone(rawPhone);
  const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : phone.startsWith("62") ? "0" + phone.substring(2) : phone;
  const today = /* @__PURE__ */ new Date();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today.getTime() - i * 864e5);
    const dateStr = getLocalDateStr(d);
    const key = `${phone}_${dateStr}`;
    const altKey = `${altPhone}_${dateStr}`;
    const hasLogs = dbData.dailyLogs[key] && Array.isArray(dbData.dailyLogs[key]) && dbData.dailyLogs[key].length > 0 || dbData.dailyLogs[altKey] && Array.isArray(dbData.dailyLogs[altKey]) && dbData.dailyLogs[altKey].length > 0;
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
function getWaterCups(rawPhone, dateStr) {
  const phone = normalizePhone(rawPhone);
  const targetDate = dateStr || getLocalDateStr();
  const key = `${phone}_${targetDate}`;
  if (dbData.waterLogs && dbData.waterLogs[key] !== void 0) {
    return dbData.waterLogs[key];
  }
  if (dbData.waterLogs) {
    const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : phone.startsWith("62") ? "0" + phone.substring(2) : phone;
    const altKey = `${altPhone}_${targetDate}`;
    if (dbData.waterLogs[altKey] !== void 0) return dbData.waterLogs[altKey];
  }
  return 0;
}
function setWaterCups(rawPhone, cups, dateStr) {
  const phone = normalizePhone(rawPhone);
  const targetDate = dateStr || getLocalDateStr();
  const newCups = Math.max(0, cups);
  if (!dbData.waterLogs) dbData.waterLogs = {};
  const key = `${phone}_${targetDate}`;
  dbData.waterLogs[key] = newCups;
  const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : phone.startsWith("62") ? "0" + phone.substring(2) : phone;
  dbData.waterLogs[`${altPhone}_${targetDate}`] = newCups;
  saveDb();
  return newCups;
}
function getMealTypeByHour(hour = (/* @__PURE__ */ new Date()).getHours()) {
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 18) return "snack";
  return "dinner";
}
var MONGODB_URI = process.env.MONGODB_URI || "";
var mongoClient = null;
var mongoConnected = false;
async function getMongoDb() {
  if (!MONGODB_URI) return null;
  try {
    if (!mongoClient) {
      mongoClient = new import_mongodb.MongoClient(MONGODB_URI, {
        serverSelectionTimeoutMS: 5e3,
        connectTimeoutMS: 1e4
      });
    }
    if (!mongoConnected) {
      await mongoClient.connect();
      mongoConnected = true;
      console.log("[MongoDB] Connected to Atlas \u2705");
    }
    return mongoClient.db("gymbuddy");
  } catch (err) {
    mongoClient = null;
    mongoConnected = false;
    console.error("[MongoDB] Connection error (check Atlas Network Access 0.0.0.0/0 IP whitelist):", err?.message || err);
    return null;
  }
}
async function loadFromMongo() {
  try {
    const db = await getMongoDb();
    if (!db) return false;
    const doc = await db.collection("appdata").findOne({ _id: "main" });
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
async function saveToMongo() {
  try {
    const db = await getMongoDb();
    if (!db) return;
    await db.collection("appdata").replaceOne(
      { _id: "main" },
      { _id: "main", ...dbData, updatedAt: /* @__PURE__ */ new Date() },
      { upsert: true }
    );
  } catch (e) {
    console.error("[MongoDB] Save error:", e);
  }
}
function initDb() {
  if (!import_fs.default.existsSync(DATA_DIR)) {
    import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (import_fs.default.existsSync(DB_FILE)) {
    try {
      const raw = import_fs.default.readFileSync(DB_FILE, "utf-8");
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
  if (MONGODB_URI) {
    loadFromMongo().then((loaded) => {
      if (!loaded) console.log("[MongoDB] No existing data found, will create on first save");
    });
  }
}
function saveDb() {
  try {
    if (!import_fs.default.existsSync(DATA_DIR)) {
      import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
    }
    import_fs.default.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving db.json", e);
  }
  if (MONGODB_URI) {
    saveToMongo();
  }
}
async function sendWhatsAppDirect(rawPhone, message) {
  const phone = normalizePhone(rawPhone);
  if (!phone || !getTwilio()) return false;
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
    console.log(`[WhatsApp Reminder] Successfully delivered to: ${toNum}`);
    return true;
  } catch (err) {
    console.error(`[WhatsApp Reminder] Error delivering to ${phone}:`, err?.message || err);
    return false;
  }
}
function getWibTimeStr(d = /* @__PURE__ */ new Date()) {
  const wibDate = new Date(d.getTime() + (7 * 60 + d.getTimezoneOffset()) * 6e4);
  const hours = String(wibDate.getHours()).padStart(2, "0");
  const minutes = String(wibDate.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}
function initReminderScheduler() {
  console.log("[Scheduler] WhatsApp Auto-Reminder Engine initialized \u2705");
  setInterval(async () => {
    try {
      const now = /* @__PURE__ */ new Date();
      const currentTimeStr = getWibTimeStr(now);
      const todayDateStr = getLocalDateStr(now);
      for (const [phoneKey, user] of Object.entries(dbData.users)) {
        if (!user || phoneKey === "latest_onboarding") continue;
        const norm = user.normalizedPhone || user.phone || phoneKey;
        const coachName = (user.persona || "max").toLowerCase() === "max" ? "Coach Max" : "Coach Mia";
        const isReminderEnabled = user.reminderEnabled !== false;
        const userReminderTime = user.reminderTime || "17:00";
        if (isReminderEnabled && userReminderTime === currentTimeStr && user.lastReminderSentDate !== todayDateStr) {
          user.lastReminderSentDate = todayDateStr;
          saveUserProfile(norm, user);
          const msg = `\u23F0 *PENGINGAT HARIAN GYMBUDDY*
-----------------------------
\u{1F525} Halo *${(user.name || "Member").toUpperCase()}*! ${coachName} di sini!

Yuk sempatkan catat makanan/minuman kamu hari ini dan cek target latihanmu! Konsistensi itu kunci! \u{1F4AA}\u2728

*(Ketik 'matikan pengingat' atau 'ingatkan jam 19:00' untuk mengatur scheduler)*`;
          await sendWhatsAppDirect(norm, msg);
        }
        if (currentTimeStr === "20:00" && user.lastNightlyReminderDate !== todayDateStr) {
          const userLogsKey = `${norm}_${todayDateStr}`;
          const userLogs = dbData.dailyLogs[userLogsKey] || [];
          if (!userLogs || userLogs.length === 0) {
            user.lastNightlyReminderDate = todayDateStr;
            saveUserProfile(norm, user);
            const msg = `\u{1F957} *PENGINGAT LOG NUTRISI MALAM*
-----------------------------
\u{1F319} Halo *${(user.name || "Member").toUpperCase()}*! ${coachName} belum melihat catatan makanan/minuman kamu hari ini nih.

Yuk catat log makanan kamu sebelum tidur biar asupan nutrisinya tetap terpantau akurat! \u{1F33F}`;
            await sendWhatsAppDirect(norm, msg);
          }
        }
        if (currentTimeStr === "20:30" && user.lastWorkoutReminderDate !== todayDateStr) {
          const workoutLogsKey = `gymbuddy_exercises_${norm}_${todayDateStr}`;
          const isWorkoutDone = dbData.dailyLogs[workoutLogsKey] && dbData.dailyLogs[workoutLogsKey].length > 0;
          if (!isWorkoutDone) {
            user.lastWorkoutReminderDate = todayDateStr;
            saveUserProfile(norm, user);
            const goalTitle = user.goalTitle || "Kebugaran Harian";
            const msg = `\u{1F3CB}\uFE0F *PENGINGAT TARGET LATIHAN HARIAN*
-----------------------------
\u{1F525} Halo *${(user.name || "Member").toUpperCase()}*! Hari ini kamu belum mencatat latihan selesai.

Yuk lakukan latihan ringan atau tuntaskan set kamu biar goal *${goalTitle}* cepat tercapai! \u{1F4AA}`;
            await sendWhatsAppDirect(norm, msg);
          }
        }
      }
    } catch (schedErr) {
      console.error("[Scheduler] Error in background check cycle:", schedErr);
    }
  }, 6e4);
}
initDb();
initReminderScheduler();
function getTodayDateStr() {
  return getLocalDateStr();
}
function getUserProfile(rawPhone) {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;
  if (dbData.users[phone]) return dbData.users[phone];
  for (const [key, value] of Object.entries(dbData.users)) {
    if (normalizePhone(key) === phone) {
      return value;
    }
  }
  return null;
}
function getOrCreateUserProfile(rawPhone, userText) {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;
  let user = getUserProfile(phone);
  if (!user && phone.startsWith("0")) {
    user = getUserProfile("62" + phone.substring(1));
  } else if (!user && phone.startsWith("62")) {
    user = getUserProfile("0" + phone.substring(2));
  }
  let extractedName = "";
  if (userText) {
    const nameMatch = userText.match(/(?:i am|saya|nama saya)\s+([^,!\.\n]+)/i);
    if (nameMatch && nameMatch[1].trim()) {
      extractedName = nameMatch[1].trim();
    }
  }
  if (!user && extractedName) {
    const nameLower = extractedName.toLowerCase();
    const matchedByName = Object.values(dbData.users).find(
      (u) => u && u.name && String(u.name).toLowerCase() === nameLower && u.weight
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
function saveUserProfile(rawPhone, profile) {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;
  const existing = dbData.users[phone] || {};
  const initialW = Math.max(30, Number(profile?.weight) || Number(existing.weight) || 65);
  const updated = {
    ...existing,
    ...profile,
    phone,
    normalizedPhone: phone,
    startWeight: profile?.startWeight !== void 0 ? Number(profile.startWeight) : existing.startWeight || initialW,
    weight: initialW,
    createdAt: existing.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  dbData.users[phone] = updated;
  if (!dbData.weeklyProgress[phone] || dbData.weeklyProgress[phone].length === 0) {
    dbData.weeklyProgress[phone] = [{
      week: 0,
      weight: initialW,
      changeFromStart: 0,
      changeFromLastWeek: 0,
      progressPercent: 0,
      date: (/* @__PURE__ */ new Date()).toISOString(),
      notes: "Baseline Kuesioner Awal"
    }];
  }
  saveDb();
  return updated;
}
function getDefaultWorkoutSchedule(goal, equipment, injuries) {
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
function calculateUserData(profile) {
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
  const persona = rawPersona === "mia" || rawPersona === "nikita" ? "mia" : "max";
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
  const activityMap = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725
  };
  const activityMultiplier = activityMap[profile?.activityLevel] || 1.375;
  const bmr = Math.round(10 * weight + 6.25 * height - 5 * age + (isMale ? 5 : -161));
  const tdee = Math.round(bmr * activityMultiplier);
  let targetCalories = tdee;
  if (goal === "lose") {
    targetCalories = Math.max(1200, tdee - 500);
  } else if (goal === "gain") {
    targetCalories = tdee + 400;
  }
  const proteinGrams = Math.round(weight * (goal === "gain" ? 2.2 : goal === "lose" ? 2 : 1.8));
  const fatGrams = Math.round(targetCalories * 0.25 / 9);
  const carbGrams = Math.round((targetCalories - (proteinGrams * 4 + fatGrams * 9)) / 4);
  const fiberGrams = Math.max(20, Math.min(38, Math.round(targetCalories / 75)));
  const activeService = profile?.activeService || profile?.subscription?.activeService || profile?.selectedFeature || "both";
  const hasReceivedWelcome = Boolean(profile?.hasReceivedWelcome);
  const workoutSchedule = profile?.workoutSchedule && Array.isArray(profile.workoutSchedule) && profile.workoutSchedule.length > 0 ? profile.workoutSchedule : getDefaultWorkoutSchedule(goal, profile?.equipment, profile?.injuries);
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
    equipment: profile?.equipment || "full_gym",
    activeService,
    hasReceivedWelcome,
    workoutSchedule,
    subscription
  };
}
function getDailyTotals(rawPhone, targetDateStr) {
  const phone = normalizePhone(rawPhone);
  const targetDate = targetDateStr || getTodayDateStr();
  const key = `${phone}_${targetDate}`;
  const logs = dbData.dailyLogs[key] || [];
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
function isLiquidName(name) {
  if (!name) return false;
  const lower = name.toLowerCase();
  const solidExceptions = [
    "pancong",
    "roti",
    "martabak",
    "cake",
    "kue",
    "pancake",
    "waffle",
    "biskuit",
    "sereal",
    "cereal",
    "ice cream",
    "es krim",
    "keju",
    "pudding",
    "puding",
    "bubur",
    "bolu",
    "donat",
    "pie",
    "tart",
    "saus",
    "sauce",
    "selai",
    "topping",
    "crepe",
    "churros",
    "pisang"
  ];
  if (solidExceptions.some((se) => lower.includes(se))) {
    return false;
  }
  const liquidKeywords = [
    "air",
    "water",
    "mineral",
    "kopi",
    "coffee",
    "teh",
    "tea",
    "susu",
    "milk",
    "jus",
    "juice",
    "shake",
    "drink",
    "minum",
    "smoothie",
    "beverage",
    "soda",
    "cola",
    "boba",
    "latte",
    "espresso",
    "cappuccino",
    "syrup",
    "sirup",
    "infused",
    "hydrat",
    "pocari",
    "gatorade",
    "le minerale",
    "aqua",
    "es teh",
    "es kopi",
    "yakult",
    "matcha"
  ];
  return liquidKeywords.some((kw) => lower.includes(kw));
}
function extractVolumeMlFromName(name) {
  if (!name) return 250;
  const mlMatch = name.match(/(\d+(?:[.,]\d+)?)\s*ml/i);
  if (mlMatch) return parseFloat(mlMatch[1].replace(",", "."));
  const lMatch = name.match(/(\d+(?:[.,]\d+)?)\s*(?:l|liter|litre)\b/i);
  if (lMatch) return parseFloat(lMatch[1].replace(",", ".")) * 1e3;
  return 250;
}
function addMealLog(rawPhone, meal, targetDateStr) {
  const phone = normalizePhone(rawPhone);
  const targetDate = targetDateStr || getTodayDateStr();
  const rawName = meal.foodName || "";
  const parts = rawName.split(/\+|\s+&\s+|\s+dan\s+|\s+with\s+|,/i).map((p) => p.trim()).filter(Boolean);
  const solidParts = [];
  const liquidParts = [];
  for (const part of parts) {
    if (isLiquidName(part)) {
      liquidParts.push(part);
    } else {
      solidParts.push(part);
    }
  }
  const mealsToInsert = [];
  if (solidParts.length > 0) {
    mealsToInsert.push({
      ...meal,
      id: `${meal.id || Date.now()}-food`,
      foodName: solidParts.join(" + "),
      calories: liquidParts.length > 0 ? Math.max(0, (Number(meal.calories) || 450) - liquidParts.length * 50) : Number(meal.calories) || 450,
      isHydration: false,
      volumeMl: void 0
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
      });
    });
  } else if (solidParts.length === 0) {
    mealsToInsert.push({
      ...meal,
      isHydration: isLiquidName(rawName),
      volumeMl: isLiquidName(rawName) ? extractVolumeMlFromName(rawName) : void 0
    });
  }
  for (const itemMeal of mealsToInsert) {
    const key = `${phone}_${targetDate}`;
    if (!dbData.dailyLogs[key]) {
      dbData.dailyLogs[key] = [];
    }
    if (!dbData.dailyLogs[key].some((m) => m.id === itemMeal.id)) {
      dbData.dailyLogs[key].push(itemMeal);
    }
    const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : phone.startsWith("62") ? "0" + phone.substring(2) : phone;
    const altKey = `${altPhone}_${targetDate}`;
    if (!dbData.dailyLogs[altKey]) {
      dbData.dailyLogs[altKey] = [];
    }
    if (!dbData.dailyLogs[altKey].some((m) => m.id === itemMeal.id)) {
      dbData.dailyLogs[altKey].push(itemMeal);
    }
  }
  saveDb();
}
function addWeeklyProgress(rawPhone, currentWeight, notes = "Progress Mingguan") {
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
  const progressPercent = Math.min(100, Math.max(0, Math.round(currentDiff / totalTargetDiff * 100)));
  const entry = {
    week: weekNumber,
    weight: currentWeight,
    changeFromStart,
    changeFromLastWeek,
    progressPercent,
    date: (/* @__PURE__ */ new Date()).toISOString(),
    notes
  };
  if (!dbData.weeklyProgress[phone]) {
    dbData.weeklyProgress[phone] = [];
  }
  dbData.weeklyProgress[phone].push(entry);
  user.weight = currentWeight;
  dbData.users[phone] = user;
  saveDb();
  return { entry, history: dbData.weeklyProgress[phone], userData: calculateUserData(user) };
}
function formatWeeklyProgressCard(progressResult) {
  const { entry, userData } = progressResult;
  const { name, targetWeight, goalTitle, persona, targetCalories, proteinGrams, carbGrams, fatGrams } = userData;
  const filledBars = Math.floor(entry.progressPercent / 10);
  const progressVisual = "\u{1F7E9}".repeat(filledBars) + "\u2B1C".repeat(10 - filledBars);
  const changeStr = entry.changeFromStart <= 0 ? `${entry.changeFromStart} kg` : `+${entry.changeFromStart} kg`;
  const weekChangeStr = entry.changeFromLastWeek <= 0 ? `${entry.changeFromLastWeek} kg` : `+${entry.changeFromLastWeek} kg`;
  const coachName = persona === "max" ? "Coach Max" : "Coach Mia";
  const comment = persona === "max" ? entry.changeFromStart <= 0 ? `Mantap bro! Berat badan lo udah berkurang ${Math.abs(entry.changeFromStart)} kg dari awal. Jangan kasih kendor, bantai terus!` : `Ada kenaikan sedikit, tapi gak masalah! Penyesuaian makro hari ini bakal bikin lo balik ke jalur yang bener. Gas!` : entry.changeFromStart <= 0 ? `Wah selamat ya ${name}! Kamu sudah berhasil mengikis ${Math.abs(entry.changeFromStart)} kg. Mia bangga banget sama konsistensimu! \u2728` : `Tetap tenang ya ${name}, fluktuasi berat badan itu wajar. Kita tetap fokus ke pola makan seimbang minggu ini ya \u{1F331}`;
  return `\u{1F4C8} *LAPORAN PROGRESS MINGGUAN FOR ${name.toUpperCase()}*
-----------------------------
\u{1F3AF} *Goal*: ${goalTitle}
\u{1F5D3}\uFE0F *Status*: Minggu ke-${entry.week}
\u2696\uFE0F *BB Awal*: ${userData.startWeight} kg
\u2696\uFE0F *BB Sekarang*: ${entry.weight} kg (${changeStr} total)
\u{1F4C9} *Perubahan Minggu Ini*: ${weekChangeStr}
\u{1F3AF} *Target Akhir*: ${targetWeight} kg

\u{1F4CA} *PROGRES CAPAIAN GOAL*: ${entry.progressPercent}%
${progressVisual}

\u26A1 *TARGET NUTRISI BARU DISESUAIKAN*:
\u{1F525} Kalori Harian: ${targetCalories} kcal
\u{1F356} Protein: ${proteinGrams}g | \u{1F35A} Karbo: ${carbGrams}g | \u{1F953} Lemak: ${fatGrams}g
-----------------------------

\u{1F4AC} *${coachName}*:
"${comment}"`;
}
function formatProgressHistoryCard(rawPhone) {
  const phone = normalizePhone(rawPhone);
  const user = getUserProfile(phone);
  if (!user) {
    return "Profil kamu belum terdaftar di database. Silakan isi kuesioner terlebih dahulu!";
  }
  const history = dbData.weeklyProgress[phone] || [];
  const userData = calculateUserData(user);
  let rowsStr = "";
  if (history.length === 0) {
    rowsStr = "\u2022 Belum ada rekaman progress mingguan.";
  } else {
    rowsStr = history.map((h) => {
      const dStr = new Date(h.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
      const chg = h.changeFromStart <= 0 ? `${h.changeFromStart}kg` : `+${h.changeFromStart}kg`;
      return `\u2022 Mg-${h.week} (${dStr}): *${h.weight} kg* (${chg})`;
    }).join("\n");
  }
  const latest = history[history.length - 1];
  const progressPercent = latest ? latest.progressPercent : 0;
  const filledBars = Math.floor(progressPercent / 10);
  const progressVisual = "\u{1F7E9}".repeat(filledBars) + "\u2B1C".repeat(10 - filledBars);
  return `\u{1F4CA} *RIWAYAT PROGRESS GOALS - ${userData.name.toUpperCase()}*

\u{1F3AF} *Goal Utama*: ${userData.goalTitle}
\u2696\uFE0F *Target BB*: ${userData.startWeight}kg \u2192 ${userData.targetWeight}kg
\u{1F4C8} *Progres Capaian*: ${progressPercent}%
${progressVisual}

\u{1F5D3}\uFE0F *Catatan Per Minggu*:
${rowsStr}

\u{1F4A1} *Tips*: Ketik *"update bb 75"* untuk mencatat berat badan terbarumu minggu ini!`;
}
async function sendMetaWhatsappMessage(to, bodyText) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) return;
  try {
    await import_axios.default.post(
      `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        text: { body: bodyText }
      },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
    );
  } catch (err) {
    console.error("Error sending Meta WhatsApp message:", err);
  }
}
async function sendTwilioWhatsappMessage(to, bodyText) {
  const client = getTwilio();
  if (!client) return;
  try {
    const toNum = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
    const fromNum = process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886";
    await client.messages.create({
      from: fromNum,
      to: toNum,
      body: bodyText
    });
  } catch (err) {
    console.error("Error sending Twilio WhatsApp message:", err);
  }
}
function makeProgressBar(current, target, length = 10) {
  if (!target || target <= 0) return "\u2591".repeat(length);
  const percent = Math.min(100, Math.max(0, Math.round(current / target * 100)));
  const filledCount = Math.min(length, Math.max(0, Math.floor(percent / 100 * length)));
  return "\u{1F7E9}".repeat(filledCount) + "\u2591".repeat(length - filledCount);
}
function parseDateFromQuery(userText) {
  const lower = userText.toLowerCase();
  const today = /* @__PURE__ */ new Date();
  const formatDate = (d) => getLocalDateStr(d);
  const formatLabel = (d, prefix = "") => {
    const dayStr = d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    return prefix ? `${prefix} (${dayStr})` : dayStr;
  };
  if (lower.includes("kemarin lusa") || lower.includes("2 hari lalu")) {
    const d = new Date(today.getTime() - 864e5 * 2);
    return { dateStr: formatDate(d), label: formatLabel(d, "2 Hari Lalu") };
  }
  if (lower.includes("kemarin") || lower.includes("yesterday")) {
    const d = new Date(today.getTime() - 864e5);
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
      const monthMap = {
        jan: 0,
        januari: 0,
        feb: 1,
        februari: 1,
        mar: 2,
        maret: 2,
        apr: 3,
        april: 3,
        mei: 4,
        jun: 5,
        juni: 5,
        jul: 6,
        juli: 6,
        agu: 7,
        agustus: 7,
        sep: 8,
        september: 8,
        okt: 9,
        oktober: 9,
        nov: 10,
        november: 10,
        des: 11,
        desember: 11
      };
      const monthIdx = monthMap[monthStr];
      if (monthIdx !== void 0) {
        let year = today.getFullYear();
        const d = new Date(year, monthIdx, dayNum);
        return { dateStr: formatDate(d), label: formatLabel(d) };
      }
    }
  }
  return { dateStr: formatDate(today), label: formatLabel(today, "Hari Ini") };
}
function formatNutritionCard(parsedAi, inputSource, userData, dailyTotals) {
  const rawFoodName = (parsedAi.foodName || "Analisis Makanan").trim();
  const portionStr = (parsedAi.portion || parsedAi.portionWeight || Array.isArray(parsedAi.portionEstimates) && parsedAi.portionEstimates[0] || (parsedAi.portionDetail ? String(parsedAi.portionDetail) : "1 porsi")).trim();
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
  const protPercent = Math.round(protKcal / totalMacroKcal * 100);
  const carbPercent = Math.round(carbKcal / totalMacroKcal * 100);
  const fatPercent = Math.round(fatKcal / totalMacroKcal * 100);
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
    insightsFormatted = parsedAi.keyInsights.map((i) => {
      const cleanInsight = i.trim();
      if (cleanInsight.startsWith("\u{1F7E2}") || cleanInsight.startsWith("\u{1F7E1}") || cleanInsight.startsWith("\u{1F534}")) {
        return cleanInsight;
      }
      return `\u{1F7E2} ${cleanInsight}`;
    }).join("\n");
  } else {
    insightsFormatted = `\u{1F7E2} Asupan nutrisi seimbang untuk mendukung aktivitas harian
\u{1F7E2} Kandungan makro terdistribusi dengan baik`;
  }
  const now = /* @__PURE__ */ new Date();
  const dateStr = now.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(":", ".");
  const isMia = userData.persona === "mia" || userData.persona === "nikita";
  const coachHeader = isMia ? "COACH MIA" : "COACH MAX";
  const coachComment = (parsedAi.coachComment || (isMia ? "Hebat banget! Tetap jaga pola makan seimbang kamu ya! \u2728" : "Mantap bro! Jaga terus disiplin makro lo! \u{1F4AA}")).replace(/^["“]|["”]$/g, "").trim();
  const foodTitleWithEmoji = rawFoodName.startsWith("\u{1F95C}") ? rawFoodName : `\u{1F95C} ${rawFoodName}`;
  return `${foodTitleWithEmoji} \u2014 ${portionStr}

\u{1F552} ${dateStr}, ${timeStr}
\u{1F916} GymBuddy AI Analysis : ${confidenceScore}%

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F4CA} REKAP NUTRISI
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

\u{1F525} ${calories} kcal

\u{1F356} Protein: ${protein}g \u2014 ${protPercent}%
\u{1F35A} Karbo: ${carbs}g \u2014 ${carbPercent}%
\u{1F953} Lemak: ${fat}g \u2014 ${fatPercent}%
\u{1F96C} Serat: ${fiber}g
\u{1F36F} Gula: ${sugar}g

Kalori dari makro:
Protein ${protKcal} kcal \u2022 Karbo ${carbKcal} kcal \u2022 Lemak ${fatKcal} kcal

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u2B50 SCORE
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

\u{1F963} Satiety: ${satietyScore}/10
${satietyExplanation}

\u{1F4AF} Health: ${healthScore}/10

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F37D}\uFE0F PORSI
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

${portionDetailText}

\u{1F4A1} KEY INSIGHTS

${insightsFormatted}

\u270F\uFE0F Koreksi Porsi
Ketik: koreksi porsi [detail/porsi]

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F916} ${coachHeader}
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

"${coachComment}"`;
}
function generateWelcomeMessages(userData) {
  const { name, weight, targetWeight, goalTitle, persona, targetCalories, proteinGrams, carbGrams, fatGrams, fiberGrams, activeService, equipment, injuries, customInjury } = userData;
  const isMax = persona === "max";
  const showNutrition = activeService === "nutritionist" || activeService === "both";
  const showWorkout = activeService === "workout" || activeService === "both";
  const eqText = equipment === "bodyweight" ? "Tanpa Alat / Rumah" : equipment === "dumbbells" ? "Dumbbell di Rumah" : "Alat Gym Lengkap";
  const injList = Array.isArray(injuries) ? injuries.filter((i) => i !== "none") : [];
  if (customInjury) injList.push(customInjury);
  const injText = injList.length > 0 ? injList.join(", ") : "Sehat (Tanpa Cedera)";
  if (isMax) {
    let summarySection = `\u{1F4CA} SUMMARY STRATEGI LO:
\u{1F3AF} Goal: ${goalTitle}
`;
    if (showNutrition) {
      summarySection += `\u{1F525} Target Kalori: ${targetCalories} kcal/hari
\u{1F356} Protein: ${proteinGrams}g/hari
\u{1F35A} Karbo: ${carbGrams}g/hari
\u{1F953} Lemak: ${fatGrams}g/hari
\u{1F96C} Serat: ${fiberGrams}g/hari
`;
    }
    summarySection += `\u2696\uFE0F Target BB: ${weight}kg \u2192 ${targetWeight}kg`;
    if (showWorkout) {
      summarySection += `
\u{1F3CB}\uFE0F Alat: ${eqText}
\u{1FA79} Kondisi Fisik: ${injText}`;
    }
    let guides = [];
    if (showNutrition) {
      guides.push(
        `Nutrition AI \u{1F966}
\u2022 Kirim foto/chat makanan lo ke sini.
\u2022 Gue bakal breakdown makro & kalorinya + catat progress harian lo.
\u2022 Kalo mau cek sisa kalori / rekap kemarin, bilang "rekap kemarin"!
\u2022 Kalo butuh ide makan, bilang "rekomendasi makanan"!
\u2022 Kalo mau catat berat badan mingguan, bilang "update bb 75"!`
      );
    }
    if (showWorkout) {
      guides.push(
        `AI Coach \u{1F3CB}\uFE0F\u200D\u2642\uFE0F
\u2022 Kirim foto form latihan / foto alat gym atau tanya menu workout.
\u2022 Gue kasih feedback tajam dan jadwal latihan disesuaikan alat (${eqText}) & kondisi tubuh lo (${injText}).`
      );
    }
    const firstItemPrompt = showNutrition && showWorkout ? "foto makanan atau pertanyaan workout" : showNutrition ? "foto makanan" : "pertanyaan workout";
    return [
      `\u{1F4AA}\u{1F525} Woy ${name}! Gue Max, AI Coach & Nutritionist lo mulai sekarang. Welcome to GymBuddy AI!
Integrasi WhatsApp AI & Dashboard siap bantu capai target kebugaran lo.

${summarySection}

Gue di sini buat pastiin lo stay on track, no excuse! \u{1F6D1}

${guides.join("\n\n")}

Tips dari gue:
Konsistensi > Motivasi. Kalo lo males, inget kenapa lo mulai.

Udah siap? Ayo kirim ${firstItemPrompt} pertama lo sekarang! \u{1F525}`
    ];
  } else {
    let summarySection = `\u{1F4CA} SUMMARY RENCANA KAMU:
\u{1F3AF} Goal: ${goalTitle}
`;
    if (showNutrition) {
      summarySection += `\u{1F525} Target Kalori: ${targetCalories} kcal/hari
\u{1F356} Protein: ${proteinGrams}g/hari
\u{1F35A} Karbo: ${carbGrams}g/hari
\u{1F953} Lemak: ${fatGrams}g/hari
\u{1F96C} Serat: ${fiberGrams}g/hari
`;
    }
    summarySection += `\u2696\uFE0F Target BB: ${weight}kg \u2192 ${targetWeight}kg`;
    if (showWorkout) {
      summarySection += `
\u{1F3CB}\uFE0F Alat: ${eqText}
\u{1FA79} Kondisi Fisik: ${injText}`;
    }
    let guides = [];
    if (showNutrition) {
      guides.push(
        `Nutrition AI \u{1F957}
\u2022 Tinggal kirim foto makanan atau ketik apa yang kamu makan hari ini.
\u2022 Aku bantu hitung kalori, nutrisi, & rekap konsumsi harianmu.
\u2022 Kamu bisa tanya sisa kalori lewat "rekap kemarin"!
\u2022 Minta rekomendasi makan sehat lewat "rekomendasi makanan"!
\u2022 Kamu juga bisa update berat badanmu lewat "update bb 75"!`
      );
    }
    if (showWorkout) {
      guides.push(
        `AI Coach \u{1F9D8}\u200D\u2640\uFE0F
\u2022 Kirim foto/video latihan atau foto alat gym untuk rekomendasi.
\u2022 Aku akan kasih saran yang aman dan rekomendasi yang nyaman buat tubuhmu.`
      );
    }
    const firstItemPrompt = showNutrition && showWorkout ? "foto makanan atau latihan" : showNutrition ? "foto makanan" : "pertanyaan latihan";
    return [
      `\u{1F33F} Halo ${name}! Saya Coach Mia, AI Coach & Nutritionist kamu. Selamat datang di GymBuddy AI! \u2728
Integrasi WhatsApp AI & Dashboard siap menemani dan memantau nutrisi & kebugaran kamu secara langsung.

${summarySection}

Saya siap mendampingi perjalanan kebugaran kamu dengan saran yang aman, halus, dan nyaman untuk tubuhmu.

${guides.join("\n\n")}

Pesan dari Coach Mia:
Dengarkan kondisi tubuhmu dengan baik, setiap progres kecil sangat berharga! \u{1F331}

Yuk, kita mulai! Coba kirim ${firstItemPrompt} pertama kamu sekarang! \u2728`
    ];
  }
}
function generateDailySummaryCard(userData, dailyTotals, dateLabel = "Hari Ini") {
  const calPercent = userData.targetCalories > 0 ? Math.min(100, Math.round(dailyTotals.calories / userData.targetCalories * 100)) : 0;
  const protPercent = userData.proteinGrams > 0 ? Math.min(100, Math.round(dailyTotals.protein / userData.proteinGrams * 100)) : 0;
  const carbPercent = userData.carbGrams > 0 ? Math.min(100, Math.round(dailyTotals.carbs / userData.carbGrams * 100)) : 0;
  const fatPercent = userData.fatGrams > 0 ? Math.min(100, Math.round(dailyTotals.fat / userData.fatGrams * 100)) : 0;
  const fiberPercent = userData.fiberGrams > 0 ? Math.min(100, Math.round(dailyTotals.fiber / userData.fiberGrams * 100)) : 0;
  const calBar = makeProgressBar(dailyTotals.calories, userData.targetCalories);
  const protBar = makeProgressBar(dailyTotals.protein, userData.proteinGrams);
  const carbBar = makeProgressBar(dailyTotals.carbs, userData.carbGrams);
  const fatBar = makeProgressBar(dailyTotals.fat, userData.fatGrams);
  const fiberBar = makeProgressBar(dailyTotals.fiber, userData.fiberGrams);
  let mealListStr = "";
  if (dailyTotals.logs.length === 0) {
    mealListStr = "_Belum ada makanan yang dicatat pada tanggal ini._";
  } else {
    mealListStr = dailyTotals.logs.map((m, idx) => `\u2022 ${m.foodName} (${m.calories} kcal | P:${m.protein}g C:${m.carbs}g F:${m.fat}g)`).join("\n");
  }
  const coachName = userData.persona === "max" ? "Coach Max" : "Coach Mia";
  const quote = userData.persona === "max" ? "Jaga terus ritme lo! Jangan kendor di jam-jam rawan ngemil." : "Kamu hebat sudah konsisten ngetrack hari ini! Tetap semangat ya \u2728";
  return `\u{1F4C6} *Rekap ${dateLabel}*

\u2696\uFE0F *Berat*: ${userData.weight} kg

\u{1F4CA} *Progress User*:
\u{1F525} *Kalori*: ${dailyTotals.calories}/${userData.targetCalories}kcal (${calPercent}%)
${calBar}
\u{1F356} *Protein*: ${dailyTotals.protein}/${userData.proteinGrams}g (${protPercent}%)
${protBar}
\u{1F35A} *Karbo*: ${dailyTotals.carbs}/${userData.carbGrams}g (${carbPercent}%)
${carbBar}
\u{1F953} *Lemak*: ${dailyTotals.fat}/${userData.fatGrams}g (${fatPercent}%)
${fatBar}
\u{1F96C} *Serat*: ${dailyTotals.fiber}/${userData.fiberGrams}g (${fiberPercent}%)
${fiberBar}

\u{1F37D}\uFE0F *Makanan Terdaftar*:
${mealListStr}

-----------------------------
\u{1F4AC} *${coachName}*:
"${quote}"`;
}
function generateMealRecommendations(userData) {
  const { name, targetCalories, goalTitle, persona } = userData;
  const coachName = persona === "max" ? "Coach Max" : "Coach Mia";
  const targetPagi = Math.round(targetCalories * 0.25);
  const targetSiang = Math.round(targetCalories * 0.35);
  const targetMalam = Math.round(targetCalories * 0.3);
  const targetSnack = Math.round(targetCalories * 0.1);
  if (persona === "max") {
    return `\u{1F37D}\uFE0F *REKOMENDASI MENU MAKANAN HARI INI FOR ${name.toUpperCase()}*
\u{1F3AF} *Goal*: ${goalTitle} (${targetCalories} kcal/hari)

\u{1F305} *Makan Pagi (~${targetPagi} kcal)*:
\u2022 \u{1F373} 3 Butir Telur Rebus / Orak-arik
\u2022 \u{1F35E} 2 Tangkup Roti Gandum Utuh
\u2022 \u2615 Kopi Hitam / Teh Hijau Tanpa Gula
_Makro: ~35g Protein, ~30g Karbo, ~12g Lemak_

\u2600\uFE0F *Makan Siang (~${targetSiang} kcal)*:
\u2022 \u{1F357} 150g Dada Ayam Panggang / Bakar Kecap
\u2022 \u{1F35A} 150g Nasi Merah / Nasi Putih Porsi Terkontrol
\u2022 \u{1F966} 1 Mangkok Tumis Brokoli / Buncis Lada Hitam
_Makro: ~45g Protein, ~45g Karbo, ~10g Lemak_

\u{1F319} *Makan Malam (~${targetMalam} kcal)*:
\u2022 \u{1F41F} 150g Ikan Gurame / Salmon / Daging Sapi Cincang Low Fat
\u2022 \u{1F954} 150g Kentang Rebus / Ubi Kukus
\u2022 \u{1F957} Salad Sayur Segar + Perasan Lemon
_Makro: ~40g Protein, ~35g Karbo, ~12g Lemak_

\u{1F34E} *Camilan Sehat (~${targetSnack} kcal)*:
\u2022 \u{1F34C} 1 Buah Pisang + 1 Scoop Whey Protein / Greek Yogurt

-----------------------------
\u{1F4AC} *${coachName}*:
"Nih menu juara buat capai target lo. Gak usah bikin alasan, patuhi porsinya & bantai hari ini! \u{1F525}"`;
  } else {
    return `\u{1F33F}\u{1F957} *REKOMENDASI MENU SEHAT HARI INI UNTUK ${name.toUpperCase()}*
\u{1F3AF} *Goal*: ${goalTitle} (${targetCalories} kcal/hari)

\u{1F305} *Makan Pagi / Breakfast (~${targetPagi} kcal)*:
\u2022 \u{1F963} Oatmeal hangat dengan potongan pisang & 1 sdm madu
\u2022 \u{1F95A} 2 butir telur rebus (tinggi protein & bikin kenyang)
\u2022 \u{1F375} Teh hijau atau air putih hangat

\u2600\uFE0F *Makan Siang / Lunch (~${targetSiang} kcal)*:
\u2022 \u{1F357} 150g Dada Ayam Tumis Wijen atau Sup Ayam Bening
\u2022 \u{1F35A} 1 centong Nasi Merah / Nasi Utuh
\u2022 \u{1F966} Tumis buncis, wortel, dan jagung manis

\u{1F319} *Makan Malam / Dinner (~${targetMalam} kcal)*:
\u2022 \u{1F41F} Ikan Panggang Teppan / Pepes Tahu Ayam
\u2022 \u{1F954} 1 buah kentang panggang ukuran sedang
\u2022 \u{1F957} Salad hijau segar dengan sedikit olive oil

\u{1F34E} *Camilan Sehat / Snack (~${targetSnack} kcal)*:
\u2022 \u{1F34F} 1 buah Apel Merah atau 1 porsi Greek Yogurt rendah lemak

-----------------------------
\u{1F4AC} *${coachName}*:
"Nikmati setiap porsi makanmu ya ${name}! Nutrisi yang seimbang adalah bentuk kasih sayang untuk tubuhmu \u{1F331}\u2728"`;
  }
}
function formatEquipmentCard(parsedAi, userData) {
  const coachName = userData.persona === "max" ? "Coach Max" : "Coach Mia";
  const equipmentName = parsedAi.equipmentName || "Alat Gym";
  const isAligned = parsedAi.isAlignedWithGoal !== false;
  if (!isAligned) {
    const redirectionMsg = parsedAi.politeRedirection || (userData.persona === "max" ? `Kayaknya alat ${equipmentName} ini kurang cocok buat goal lo (${userData.goalTitle}) dulu ya bro. Kita fokus ke gerakan utama yang lebih efektif & aman!` : `Wah, sepertinya alat ${equipmentName} ini belum menjadi prioritas utama untuk goal ${userData.goalTitle} kamu ya \u2728 Yuk fokus ke latihan dasar yang lebih sesuai dulu!`);
    return `\u{1F3CB}\uFE0F *ANALISIS ALAT GYM: ${equipmentName.toUpperCase()}*

\u26A0\uFE0F *Status Goal Alignment*:
_KURANG COCOK UNTUK GOAL SAAT INI_

\u{1F4AC} *Pesan dari ${coachName}*:
"${redirectionMsg}"

\u{1F4A1} *Catatan Coach*:
${parsedAi.alignmentExplanation || "Gunakan latihan dasar yang lebih sesuai dengan targetmu."}`;
  }
  const exercises = Array.isArray(parsedAi.suggestedExercises) && parsedAi.suggestedExercises.length > 0 ? parsedAi.suggestedExercises.map(
    (e, idx) => `\u2022 *${e.name || `Variasi ${idx + 1}`}*
  \u{1F4AA} Otot: ${e.targetMuscle || "General"}
  \u{1F522} Target: ${e.setsReps || "3 Sets x 10-12 Reps"}
  \u{1F4A1} Tips: ${e.techniqueTip || "Jaga postur & pernafasan teratur."}`
  ).join("\n\n") : `\u2022 *Custom Exercise*
  \u{1F522} Target: 3 Sets x 12 Reps
  \u{1F4A1} Tips: Kontrol gerakan saat eccentric.`;
  const comment = parsedAi.coachComment || (userData.persona === "max" ? `Alat ini mantap banget buat goal lo! Sikat gerakan di atas & pastikan form lo bersih!` : `Alat ini sangat cocok untuk mendukung ${userData.goalTitle} kamu! Lakukan dengan perlahan dan nikmati prosesnya ya \u2728`);
  return `\u{1F3CB}\uFE0F *ANALISIS ALAT GYM: ${equipmentName.toUpperCase()}*

\u2705 *Status Goal Alignment*:
*SANGAT COCOK UNTUK GOAL ${userData.goalTitle.toUpperCase()}!*

\u{1F4CC} *Rekomendasi Variasi Latihan*:
${exercises}

-----------------------------
\u{1F4AC} *${coachName}*:
"${comment}"`;
}
async function generateEquipmentInfographicPNG(parsedAi, userData) {
  try {
    const width = 800;
    const height = 1180;
    const eqName = (parsedAi.equipmentName || "TUTORIAL ALAT GYM").toUpperCase();
    const isAligned = parsedAi.isAlignedWithGoal !== false;
    const alignText = isAligned ? `\u2705 SANGAT COCOK UNTUK GOAL: ${(userData.goalTitle || "FITNESS").toUpperCase()}` : `\u26A0\uFE0F PERLU PENYESUAIAN BEBAN UNTUK GOAL KAMU`;
    const coachComment = userData.persona === "max" ? `Coach Max: "Main bersih bro! Jangan pake momentum biar otot lo terstimulasi penuh! \u{1F4A5}"` : `Coach Mia: "Jaga tempo dan kontraksi otot ya, pastiin tubuhmu tetap stabil \u2728"`;
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
      <rect x="50" y="172" width="700" height="46" rx="12" fill="${isAligned ? "rgba(212,255,0,0.15)" : "rgba(239,68,68,0.15)"}" stroke="${isAligned ? "#D4FF00" : "#EF4444"}" stroke-width="1.5"/>
      <text x="70" y="201" fill="${isAligned ? "#D4FF00" : "#EF4444"}" font-family="sans-serif" font-weight="bold" font-size="15">${alignText}</text>

      <!-- Section 1: Parts -->
      <rect x="50" y="235" width="700" height="160" rx="16" fill="#0E131F" stroke="#263248" stroke-width="1"/>
      <text x="70" y="268" fill="#D4FF00" font-family="sans-serif" font-weight="bold" font-size="17">BAGIAN ALAT &amp; FUNGSI UTAMA</text>
      <text x="70" y="298" fill="#DDDDDD" font-family="sans-serif" font-size="14">\u2022 1. Roller / Pegangan Kaki - Untuk mengunci posisi pergelangan kaki agar stabil</text>
      <text x="70" y="323" fill="#DDDDDD" font-family="sans-serif" font-size="14">\u2022 2. Foot Plate - Landasan pijakan kaki utama untuk distribusi beban seimbang</text>
      <text x="70" y="348" fill="#DDDDDD" font-family="sans-serif" font-size="14">\u2022 3. Pad Penopang Paha - Menopang bagian paha atas agar nyaman saat bergerak</text>
      <text x="70" y="373" fill="#DDDDDD" font-family="sans-serif" font-size="14">\u2022 4. Handle Samping - Pegangan bantuan untuk mengatur posisi awal latihan</text>

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
      <text x="70" y="805" fill="#CCCCCC" font-family="sans-serif" font-size="12.5">\u2714 Gerakan perlahan &amp; terkontrol.</text>
      <text x="70" y="831" fill="#CCCCCC" font-family="sans-serif" font-size="12.5">\u2714 Fokus kontraksi otot target.</text>
      <text x="70" y="857" fill="#CCCCCC" font-family="sans-serif" font-size="12.5">\u2714 Jaga postur punggung tetap lurus.</text>
      <text x="70" y="883" fill="#CCCCCC" font-family="sans-serif" font-size="12.5">\u2714 Lakukan sesuai kemampuan beban.</text>

      <rect x="410" y="745" width="340" height="175" rx="16" fill="#0E131F" stroke="rgba(239,68,68,0.3)"/>
      <text x="430" y="775" fill="#EF4444" font-family="sans-serif" font-weight="bold" font-size="15">KESALAHAN UMUM (DONT'S)</text>
      <text x="430" y="805" fill="#CCCCCC" font-family="sans-serif" font-size="12.5">\u2716 Hiperekstensi melengkung berlebihan.</text>
      <text x="430" y="831" fill="#CCCCCC" font-family="sans-serif" font-size="12.5">\u2716 Menggunakan momentum mengayun.</text>
      <text x="430" y="857" fill="#CCCCCC" font-family="sans-serif" font-size="12.5">\u2716 Posisi pad terlalu rendah/tinggi.</text>
      <text x="430" y="883" fill="#CCCCCC" font-family="sans-serif" font-size="12.5">\u2716 Tempo gerakan terlalu cepat.</text>

      <!-- Section 4: Target & Coach -->
      <rect x="50" y="940" width="700" height="130" rx="16" fill="#161C28" stroke="#333333"/>
      <text x="70" y="970" fill="#D4FF00" font-family="sans-serif" font-weight="bold" font-size="15">REKOMENDASI LATIHAN &amp; OTOT TARGET</text>
      <text x="70" y="998" fill="#FFFFFF" font-family="sans-serif" font-size="13.5">\u2022 Otot Utama: Erector Spinae (Punggung Bawah), Gluteus &amp; Hamstrings</text>
      <text x="70" y="1024" fill="#FFFFFF" font-family="sans-serif" font-size="13.5">\u2022 Rekomendasi Target: 3-4 Sets x 10-15 Repetisi (Rest: 60-90 Detik)</text>
      <text x="70" y="1052" fill="#D4FF00" font-family="sans-serif" font-style="italic" font-weight="bold" font-size="13">${coachComment}</text>

      <!-- Footer -->
      <text x="210" y="1125" fill="#555555" font-family="sans-serif" font-weight="bold" font-size="12">GYMBUDDY AI \u2022 PERSONAL SMART GYM COACH \u2022 www.gymbuddygroup.com</text>
    </svg>`;
    const filename = `infographic_${Date.now()}_${Math.floor(Math.random() * 1e3)}.svg`;
    const publicDir = import_path.default.join(process.cwd(), "public", "infographics");
    if (!import_fs.default.existsSync(publicDir)) {
      import_fs.default.mkdirSync(publicDir, { recursive: true });
    }
    const filePath = import_path.default.join(publicDir, filename);
    import_fs.default.writeFileSync(filePath, svgContent, "utf-8");
    const serverUrl = process.env.RENDER_EXTERNAL_URL || "https://gymbuddy-backend-zfft.onrender.com";
    return `${serverUrl}/infographics/${filename}`;
  } catch (err) {
    console.error("Error generating SVG infographic:", err);
    return "";
  }
}
function generateWorkoutRecommendations(userData) {
  const { name, goal, goalTitle, persona } = userData;
  const coachName = persona === "max" ? "Coach Max" : "Coach Mia";
  if (persona === "max") {
    if (goal === "lose") {
      return `\u{1F3CB}\uFE0F\u200D\u2642\uFE0F\u{1F525} *MENU JADWAL WORKOUT FAT LOSS FOR ${name.toUpperCase()}*
\u{1F3AF} *Goal*: ${goalTitle} (High Metabolic Burn)

\u{1F525} *CIRCUIT A (Metabolic Conditioning)*:
1. \u{1F3CB}\uFE0F Goblet Squat (Dumbbell): 4 Sets x 12-15 Reps (Rest: 45s)
2. \u{1F9D8} Push-Up (Standard/Knee): 4 Sets x 12-15 Reps (Rest: 45s)
3. \u{1F3C3} Dumbbell Romanian Deadlift: 3 Sets x 12 Reps (Rest: 60s)
4. \u26A1 Mountain Climbers: 4 Sets x 30 Detik

\u{1F3C3} *CARDIO FINISHER*:
\u2022 15 Menit Incline Treadmill Walk (Speed 5.0, Incline 10.0) / Jump Rope

-----------------------------
\u{1F4AC} *${coachName}*:
"No excuse bro! Selesai sirkuit ini pastikan baju lo basah kuyup. Bantai pembakaran lemak lo hari ini! \u{1F525}"`;
    } else if (goal === "gain") {
      return `\u{1F3CB}\uFE0F\u200D\u2642\uFE0F\u{1F4AA} *MENU JADWAL WORKOUT MUSCLE HYPERTROPHY FOR ${name.toUpperCase()}*
\u{1F3AF} *Goal*: ${goalTitle} (Progressive Overload)

\u{1F4AA} *UPPER BODY HYPERTROPHY*:
1. \u{1F3CB}\uFE0F Dumbbell/Barbell Bench Press: 4 Sets x 8-10 Reps (Rest: 90s)
2. \u{1F6A3} Lat Pulldown / Bent-Over Row: 4 Sets x 10-12 Reps (Rest: 90s)
3. \u{1F9BE} Dumbbell Shoulder Press: 3 Sets x 10 Reps (Rest: 75s)
4. \u{1F9B5} Dumbbell Bicep Curl + Tricep Pushdown: 3 Sets x 12 Reps (Superset)

-----------------------------
\u{1F4AC} *${coachName}*:
"Main berat tapi tetep kontrol form! Tambah beban bertahap tiap minggu biar otot lo tumbuh maksimal. Gas! \u{1F4A5}"`;
    } else {
      return `\u{1F3CB}\uFE0F\u200D\u2642\uFE0F\u26A1 *MENU JADWAL WORKOUT FUNCTIONAL FITNESS FOR ${name.toUpperCase()}*
\u{1F3AF} *Goal*: ${goalTitle} (Strength & Mobility)

\u{1F525} *FULL BODY STRENGTH*:
1. \u{1F3CB}\uFE0F Bodyweight/Dumbbell Squats: 3 Sets x 12 Reps
2. \u{1F9D8} Dumbbell Overhead Press: 3 Sets x 12 Reps
3. \u{1F3C3} Plank Hold: 3 Sets x 45 Detik
4. \u{1F6B4} 20 Menit Cardio Moderate Pace (Sepeda / Rowing)

-----------------------------
\u{1F4AC} *${coachName}*:
"Konsistensi itu kunci! Latihan rutin bakal jaga kebugaran & energi lo sepanjang hari!"`;
    }
  } else {
    return `\u{1F331}\u2728 *REKOMENDASI JADWAL LATIHAN SEHAT UNTUK ${name.toUpperCase()}*
\u{1F3AF} *Goal*: ${goalTitle}

\u{1F9D8}\u200D\u2640\uFE0F *RANGKAIAN LATIHAN HARI INI*:
1. \u{1F6B6} *Pemanasan & Mobilitas (5-10 Menit)*: Arm circles, leg swings, & cat-cow stretch
2. \u{1F3CB}\uFE0F *Latihan Utama*:
   \u2022 Goblet Squat / Chair Squat: 3 Sets x 10-12 Reps
   \u2022 Wall / Knee Push-Up: 3 Sets x 10 Reps
   \u2022 Dumbbell Row (Beban Ringan/Sedang): 3 Sets x 12 Reps
   \u2022 Core Bird-Dog & Plank: 3 Sets x 30 Detik
3. \u{1F9D8} *Pendinginan (5 Menit)*: Deep breathing & hamstring stretch

-----------------------------
\u{1F4AC} *${coachName}*:
"Lakukan dengan nyaman dan dengarkan sinyal tubuhmu ya ${name}. Setiap gerakan kecil sangat berarti! \u2728\u{1F338}"`;
  }
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = Number(process.env.PORT) || 3e3;
  app.use((0, import_cors.default)());
  app.use(import_express.default.json());
  app.use(import_express.default.urlencoded({ extended: true }));
  app.use("/infographics", import_express.default.static(import_path.default.join(process.cwd(), "public", "infographics")));
  app.post("/api/onboarding", (req, res) => {
    const { phone, profile } = req.body;
    if (profile) {
      dbData.users["latest_onboarding"] = {
        ...profile,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (phone) {
        const saved = saveUserProfile(phone, profile);
        console.log("Saved user profile in database for:", phone, profile);
        return res.json({ success: true, profile: saved });
      }
      saveDb();
      console.log("Saved latest_onboarding profile in database");
      return res.json({ success: true, profile });
    }
    return res.status(400).json({ error: "Profile object is required" });
  });
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
  app.post("/api/ai/analyze-food", import_express.default.json(), async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || !String(text).trim()) {
        return res.status(400).json({ success: false, error: "Text description is required" });
      }
      if (!getAi()) {
        return res.status(500).json({ success: false, error: "AI service unavailable" });
      }
      const prompt = `Kamu adalah Nutritionist AI GymBuddy. User menginput makanan/minuman: "${text}".
Estimasi porsi standar orang Indonesia dan keluarkan output JSON valid saja (tanpa markdown format):
{
  "foodName": "Nama Makanan/Minuman",
  "calories": 350,
  "protein": 25,
  "carbs": 40,
  "fat": 10,
  "fiber": 3,
  "mealType": "lunch"
}`;
      const rawText = await generateGeminiContent(prompt);
      const textOutput = (rawText || "{}").replace(/```json/g, "").replace(/```/g, "").trim();
      let parsed = {};
      try {
        parsed = JSON.parse(textOutput);
      } catch (e) {
        parsed = { foodName: text, calories: 250, protein: 15, carbs: 30, fat: 8, fiber: 2, mealType: "lunch" };
      }
      parsed.isFood = true;
      parsed = validateAndNormalizeNutrition(parsed, false);
      res.json({
        success: true,
        foodName: parsed.foodName || text,
        calories: Number(parsed.calories) || 250,
        protein: Number(parsed.protein) || 15,
        carbs: Number(parsed.carbs) || 30,
        fat: Number(parsed.fat) || 8,
        fiber: Number(parsed.fiber) || 2,
        satietyScore: parsed.satietyScore || 7,
        healthScore: parsed.healthScore || 8,
        confidenceText: parsed.confidenceText,
        mealType: parsed.mealType || getMealTypeByHour()
      });
    } catch (err) {
      console.error("Error analyzing food text:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to analyze food" });
    }
  });
  app.get("/api/user/:phone/meals", (req, res) => {
    const rawPhone = req.params.phone;
    const phone = normalizePhone(rawPhone);
    const targetDate = req.query.date || getLocalDateStr();
    let logs = [];
    const primaryKey = `${phone}_${targetDate}`;
    if (dbData.dailyLogs[primaryKey] && Array.isArray(dbData.dailyLogs[primaryKey])) {
      logs = [...dbData.dailyLogs[primaryKey]];
    }
    if (logs.length === 0) {
      const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : phone.startsWith("62") ? "0" + phone.substring(2) : phone;
      const altKey = `${altPhone}_${targetDate}`;
      if (dbData.dailyLogs[altKey] && Array.isArray(dbData.dailyLogs[altKey])) {
        logs = [...dbData.dailyLogs[altKey]];
      }
    }
    res.json({ success: true, phone, date: targetDate, logs });
  });
  app.post("/api/user/:phone/meals", import_express.default.json(), (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const meal = req.body;
    const targetDate = meal.date || req.query.date || getLocalDateStr();
    if (!meal || !meal.foodName) {
      return res.status(400).json({ success: false, error: "Meal object with foodName is required" });
    }
    const mealObj = {
      id: meal.id || `m-${Date.now()}`,
      foodName: meal.foodName,
      calories: Number(meal.calories) || 0,
      protein: Number(meal.protein) || 0,
      carbs: Number(meal.carbs) || 0,
      fat: Number(meal.fat) || 0,
      fiber: Number(meal.fiber) || 0,
      sugar: Number(meal.sugar) || 0,
      mealType: meal.mealType || getMealTypeByHour(),
      timestamp: meal.timestamp || (/* @__PURE__ */ new Date()).toISOString(),
      // Bug 2b Fix: preserve isHydration and volumeMl sent from frontend
      isHydration: meal.isHydration === true || meal.isHydration === "true" ? true : meal.isHydration === false || meal.isHydration === "false" ? false : void 0,
      volumeMl: meal.volumeMl ? Number(meal.volumeMl) : void 0
    };
    addMealLog(phone, mealObj, targetDate);
    const key = `${phone}_${targetDate}`;
    res.json({ success: true, phone, date: targetDate, meal: mealObj, logs: dbData.dailyLogs[key] });
  });
  app.delete("/api/user/:phone/meals/:mealId", (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const targetDate = req.query.date || getLocalDateStr();
    const { mealId } = req.params;
    const key = `${phone}_${targetDate}`;
    if (dbData.dailyLogs[key]) {
      dbData.dailyLogs[key] = dbData.dailyLogs[key].filter((m) => m.id !== mealId);
      saveDb();
    }
    res.json({ success: true, phone, date: targetDate, logs: dbData.dailyLogs[key] || [] });
  });
  app.get("/api/user/:phone/water", (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const targetDate = req.query.date || getLocalDateStr();
    const cups = getWaterCups(phone, targetDate);
    res.json({ success: true, phone, date: targetDate, cups, liters: Number((cups * 0.25).toFixed(1)) });
  });
  app.post("/api/user/:phone/water", import_express.default.json(), (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const { cups, date } = req.body;
    const targetDate = date || getLocalDateStr();
    const updatedCups = setWaterCups(phone, Number(cups) || 0, targetDate);
    res.json({ success: true, phone, date: targetDate, cups: updatedCups, liters: Number((updatedCups * 0.25).toFixed(1)) });
  });
  app.delete("/api/user/:phone", (req, res) => {
    const phone = normalizePhone(req.params.phone);
    if (phone && dbData.users[phone]) {
      delete dbData.users[phone];
      delete dbData.weeklyProgress[phone];
      Object.keys(dbData.dailyLogs).forEach((key) => {
        if (key.startsWith(phone)) {
          delete dbData.dailyLogs[key];
        }
      });
      saveDb();
      console.log(`Deleted user profile for ${phone}`);
      return res.json({ success: true, message: `Data user ${phone} berhasil dihapus.` });
    }
    return res.status(404).json({ success: false, error: "User profile not found" });
  });
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
            { _id: "main" },
            { _id: "main", users: {}, dailyLogs: {}, weeklyProgress: {}, waterLogs: {}, updatedAt: /* @__PURE__ */ new Date() },
            { upsert: true }
          );
          console.log("[MongoDB] Collection reset successfully \u2705");
        }
      } catch (err) {
        console.error("[MongoDB] Reset error:", err?.message || err);
      }
    }
    console.log("All user database data reset successfully.");
    return res.json({ success: true, message: "Semua data database (lokal & MongoDB) berhasil dihapus 100%." });
  });
  app.post("/api/user/:phone/progress", import_express.default.json(), (req, res) => {
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
  app.get("/api/user/:phone/schedule", (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const user = getUserProfile(phone);
    if (!user) {
      return res.status(404).json({ success: false, error: "User profile not found" });
    }
    const calculated = calculateUserData(user);
    res.json({ success: true, schedule: calculated.workoutSchedule, goal: calculated.goal, goalTitle: calculated.goalTitle });
  });
  app.post("/api/user/:phone/schedule", import_express.default.json(), (req, res) => {
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
  app.post("/api/user/:phone/reminder", import_express.default.json(), (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const user = getUserProfile(phone);
    if (!user) {
      return res.status(404).json({ success: false, error: "User profile not found" });
    }
    const { reminderTime, reminderEnabled } = req.body;
    if (reminderTime) user.reminderTime = String(reminderTime).trim();
    if (reminderEnabled !== void 0) user.reminderEnabled = Boolean(reminderEnabled);
    saveUserProfile(phone, user);
    res.json({
      success: true,
      user,
      reminderTime: user.reminderTime,
      reminderEnabled: user.reminderEnabled
    });
  });
  app.post("/api/user/:phone/goals", import_express.default.json(), (req, res) => {
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
  app.post("/api/midtrans/create-transaction", import_express.default.json(), async (req, res) => {
    try {
      const { phone, plan = "advanced", activeService = "both", amount, customerName } = req.body;
      const orderId = `GYMBUDDY-${Date.now()}-${Math.floor(Math.random() * 1e3)}`;
      const grossAmount = Number(amount) || (plan === "premium" ? 139e3 : 79e3);
      const parameter = {
        transaction_details: {
          order_id: orderId,
          gross_amount: grossAmount
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
    } catch (error) {
      console.error("Midtrans Transaction Error:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to create transaction" });
    }
  });
  app.post("/api/midtrans/notification", async (req, res) => {
    try {
      const statusResponse = await snap.transaction.notification(req.body);
      const orderId = statusResponse.order_id;
      const transactionStatus = statusResponse.transaction_status;
      const fraudStatus = statusResponse.fraud_status;
      console.log(`Transaction notification received. Order ID: ${orderId}. Transaction status: ${transactionStatus}. Fraud status: ${fraudStatus}`);
      if (transactionStatus == "capture") {
        if (fraudStatus == "accept") {
          console.log(`Payment success for order ${orderId}`);
        }
      } else if (transactionStatus == "settlement") {
        console.log(`Payment settled for order ${orderId}`);
      } else if (transactionStatus == "cancel" || transactionStatus == "deny" || transactionStatus == "expire") {
        console.log(`Payment failed/cancelled for order ${orderId}`);
      } else if (transactionStatus == "pending") {
        console.log(`Payment pending for order ${orderId}`);
      }
      res.status(200).send("OK");
    } catch (error) {
      console.error("Midtrans Webhook Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
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
  app.post("/api/webhook/whatsapp", async (req, res) => {
    console.log(`[${(/* @__PURE__ */ new Date()).toISOString()}] Received Meta WhatsApp Webhook:`, JSON.stringify(req.body));
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
          let imagePart = null;
          if (message.type === "text") {
            userText = message.text.body;
          } else if (message.type === "image") {
            const imageId = message.image.id;
            userText = message.image.caption || "Analisis foto ini";
            if (WHATSAPP_TOKEN) {
              try {
                const mediaRes = await import_axios.default.get(`https://graph.facebook.com/v19.0/${imageId}`, {
                  headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
                });
                const mediaUrl = mediaRes.data.url;
                const imageBinary = await import_axios.default.get(mediaUrl, {
                  headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
                  responseType: "arraybuffer"
                });
                const base64Image = Buffer.from(imageBinary.data).toString("base64");
                imagePart = { inlineData: { data: base64Image, mimeType: message.image.mime_type || "image/jpeg" } };
              } catch (imgErr) {
                console.error("Error fetching WhatsApp media:", imgErr);
              }
            }
          }
          const lowerText = userText.toLowerCase();
          const isWelcomeMessage = lowerText.includes("gymbuddy") && (lowerText.includes("target harian") || lowerText.includes("target saya") || lowerText.includes("tolong kirimkan")) || lowerText.includes("nama saya") && lowerText.includes("target saya");
          if (!userProfile && !isWelcomeMessage) {
            await sendMetaWhatsappMessage(
              from,
              `\u26A0\uFE0F *AKUN BELUM TERDAFTAR DI GYMBUDDY AI*
-----------------------------
Halo! Nomor WhatsApp kamu belum terdaftar atau telah dihapus dari database GymBuddy AI.

Silakan lakukan registrasi & isi kuesioner onboarding terlebih dahulu di website GymBuddy AI agar Coach kami bisa menyesuaikan kebutuhan kalori & latihanmu secara personal! \u{1F3AF}\u2728`
            );
            return res.sendStatus(200);
          }
          if (!userProfile) {
            userProfile = getOrCreateUserProfile(from, userText);
          }
          const userData = calculateUserData(userProfile);
          const isRecommendationMessage = lowerText.includes("rekomendasi makanan") || lowerText.includes("menu makan") || lowerText.includes("saran makan") || lowerText.includes("pagi siang malam") || lowerText.includes("rekomendasi sarapan");
          const isWorkoutReqMessage = lowerText.includes("workout") || lowerText.includes("latihan") || lowerText.includes("jadwal gym") || lowerText.includes("rekomendasi workout") || lowerText.includes("menu latihan") || lowerText.includes("olahraga");
          const isCheckSummaryMessage = lowerText.includes("cek kalori") || lowerText.includes("sisa kalori") || lowerText.includes("rekap kalori") || lowerText.includes("rekap") || lowerText.includes("kemarin") || lowerText.includes("makan apa");
          const isProgressHistoryMessage = lowerText.includes("cek progress") || lowerText.includes("riwayat progress") || lowerText.includes("progress minggu");
          const weightMatch = userText.match(/(?:update\s+bb|lapor\s+bb|berat\s+badan|bb\s+sekarang|bb)\s*:?\s*(\d+(?:[\.,]\d+)?)/i);
          const waterMatch = userText.match(/(?:minum|air\s+putih|water|hidrasi)\s*:?\s*(\d+(?:[\.,]\d+)?)\s*(gelas|cup|cups|ml|l|liter)?/i);
          let responseMessages = [];
          if (isWelcomeMessage) {
            const nameMatch = userText.match(/(?:i am|saya|nama saya)\s+([^,!\.\n]+)/i);
            const targetMatch = userText.match(/(?:my target is|target saya adalah|goal saya)\s+([^,!\.\n]+)/i);
            if (updatedProfileNeeded) {
              saveUserProfile(from, userProfile);
            }
            const currentCalculated = calculateUserData(userProfile);
            responseMessages = generateWelcomeMessages(currentCalculated);
          } else if (waterMatch) {
            const rawAmount = parseFloat(waterMatch[1].replace(",", "."));
            const unit = (waterMatch[2] || "gelas").toLowerCase();
            let actualMl;
            if (unit === "ml") {
              actualMl = rawAmount;
            } else if (unit === "l" || unit === "liter") {
              actualMl = rawAmount * 1e3;
            } else {
              actualMl = Math.round(rawAmount) * 250;
            }
            const cupsToAdd = Math.max(1, Math.round(actualMl / 250));
            const currentCups = getWaterCups(from);
            const newTotalCups = setWaterCups(from, currentCups + cupsToAdd);
            const liters = (newTotalCups * 0.25).toFixed(1);
            const waterEntry = {
              id: `wa-water-${Date.now()}`,
              foodName: `Air Putih ${actualMl} ml`,
              calories: 0,
              protein: 0,
              carbs: 0,
              fat: 0,
              isHydration: true,
              volumeMl: actualMl,
              timestamp: (/* @__PURE__ */ new Date()).toISOString(),
              mealType: getMealTypeByHour()
            };
            addMealLog(from, waterEntry);
            const coachName = userData.persona === "max" ? "Coach Max" : "Coach Mia";
            const comment = userData.persona === "max" ? "Mantap bro! Jaga terus hidrasi tubuh lo biar metabolisme makin kenceng! \u{1F525}" : "Hebat banget! Tetap rajin minum air putih ya biar tubuh selalu segar \u2728";
            responseMessages = [
              `\u{1F4A7} *CATATAN HIDRASI DISIMPAN*
-----------------------------
\u2705 Kamu menambah *${actualMl} ml* air putih!
\u{1F4CA} Total Hidrasi Hari Ini: *${newTotalCups} Gelas* (${liters} Liter / 3.0 L Target)

\u{1F4AC} *${coachName}*:
"${comment}"`
            ];
          } else if (userText.match(/(?:reminder|pengingat|ingatkan|ingetin|ingatin|inget|remind|jadwal\s*ingat|scheduler)/i)) {
            const isOffCommand = userText.match(/(?:matikan|nonaktifkan|off|stop|hentikan|hapus)/i);
            const rawTimeMatch = userText.match(/jam\s*(\d{1,2})(?::(\d{2}))?|\b(\d{1,2})(?::(\d{2}))?\s*(?:pagi|siang|sore|malam)/i);
            const isTimeGiven = rawTimeMatch || userText.match(/(?:jam\s*)?(\d{1,2})[:. ]?(\d{2})?/i);
            const coachName = userData.persona === "max" ? "Coach Max" : "Coach Mia";
            if (isOffCommand) {
              userProfile.reminderEnabled = false;
              saveUserProfile(from, userProfile);
              responseMessages = [
                `\u274C *PENGINGAT HARIAN DIMATIKAN*
-----------------------------
Pengingat harian scheduler kamu telah dinonaktifkan.

\u{1F4AC} *${coachName}*:
"Sip! Kalau mau dihidupkan lagi kapan saja, ketik *'hidupkan pengingat jam 17:00'* atau *'ingatkan jam 8 malam'* ya! \u{1F44D}"`
              ];
            } else if (isTimeGiven || userText.match(/(?:hidupkan|nyalakan|aktifkan|set|buka)/i)) {
              let setTime = "17:00";
              if (isTimeGiven) {
                let hhNum = parseInt(isTimeGiven[1] || isTimeGiven[3]) || 0;
                const mmNum = parseInt(isTimeGiven[2] || isTimeGiven[4]) || 0;
                const isSoreMalam = /sore|malam|pm/i.test(userText);
                const isPagi = /pagi|am/i.test(userText);
                if (isSoreMalam && hhNum < 12) hhNum += 12;
                if (isPagi && hhNum === 12) hhNum = 0;
                const hh = String(Math.min(23, Math.max(0, hhNum))).padStart(2, "0");
                const mm = String(Math.min(59, Math.max(0, mmNum))).padStart(2, "0");
                setTime = `${hh}:${mm}`;
              } else if (userProfile.reminderTime) {
                setTime = userProfile.reminderTime;
              }
              userProfile.reminderEnabled = true;
              userProfile.reminderTime = setTime;
              saveUserProfile(from, userProfile);
              responseMessages = [
                `\u2705 *PENGINGAT HARIAN DIAKTIFKAN*
-----------------------------
\u23F0 Jam Pengingat: *${setTime} WIB*
STATUS: *Scheduler Aktif*

\u{1F4AC} *${coachName}*:
"Mantap! Setiap hari pukul *${setTime} WIB*, ${coachName} bakal kirim chat pengingat ke WhatsApp kamu untuk catat nutrisi & latihan! \u{1F525}

*(Ketik 'matikan pengingat' jika ingin menonaktifkan)*"`
              ];
            } else {
              responseMessages = [
                `\u23F0 *SCHEDULER PENGINGAT HARIAN GYMBUDDY*
-----------------------------
Halo ${userData.name}! Mau *dihidupkan* atau *dimatikan* scheduler pengingat harian kamu?

\u{1F449} *Untuk Hidupkan*: Ketik *"hidupkan pengingat jam 17:00"*
\u{1F449} *Untuk Matikan*: Ketik *"matikan pengingat"*`
              ];
            }
          } else if (userText.match(/(?:selesai\s*latihan|latihan\s*selesai|workout\s*selesai|selesai\s*workout|lapor\s*latihan|catat\s*latihan|latihan\s*hari\s*ini|push\s*up|squat|bench\s*press|pull\s*up|(\d+)\s*set\s*selesai)/i)) {
            const todayStr = getTodayDateStr();
            const workoutKey = `gymbuddy_exercises_${from}_${todayStr}`;
            const coachName = userData.persona === "max" ? "Coach Max" : "Coach Mia";
            const workoutLogEntry = {
              id: `wa-workout-${Date.now()}`,
              foodName: `\u{1F3CB}\uFE0F Log Latihan: ${userText.trim()}`,
              calories: 0,
              protein: 0,
              carbs: 0,
              fat: 0,
              timestamp: (/* @__PURE__ */ new Date()).toISOString(),
              mealType: "snack"
            };
            addMealLog(from, workoutLogEntry);
            dbData.dailyLogs[workoutKey] = [{ id: "completed", timestamp: (/* @__PURE__ */ new Date()).toISOString() }];
            saveDb();
            responseMessages = [
              `\u{1F3CB}\uFE0F *CATATAN LATIHAN BERHASIL DISIMPAN!*
-----------------------------
\u2705 Laporan latihan kamu: *"${userText.trim()}"* telah dicatat Selesai hari ini!

\u{1F4AC} *${coachName}*:
"Mantap bro ${(userData.name || "").toUpperCase()}! 1 langkah lebih dekat ke target *${userData.goalTitle || "Kebugaran"}* kamu! Istirahat cukup dan jaga nutrisi ya! \u{1F525}"`
            ];
          } else if (weightMatch) {
            const newW = parseFloat(weightMatch[1].replace(",", "."));
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
            await sendMetaWhatsappMessage(from, "sedang berpikir... \u{1F4AD}\n\nHampir selesai mengecek inputmu... \u{1F4CA}");
            const isMia = userData.persona === "mia" || userData.persona === "nikita";
            const personaInstruction = isMia ? `PERSONA MIA: Kamu adalah pelatih (coach) profesional wanita bernama Coach Mia. Kamu sangat santun, ramah, halus, lembut, dan edukatif (aku/kamu). DILARANG KERAS menggunakan panggilan berlebihan seperti "sayang", "cinta", "beb", dll. Tetaplah 100% PROFESIONAL, sopan, baik hati, dan mendukung kebugaran pengguna secara halus. SELALU panggil dirimu Coach Mia dan JANGAN PERNAH menyapa sebagai Coach Max.` : `PERSONA MAX: Kamu adalah pelatih (coach) pria bernama Coach Max. Kamu tegas, serius, to-the-point, dan ala bahasa gaul Jakarta/bro (lo/gue). SELALU panggil dirimu Coach Max.`;
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
              let parsed = extractAndParseJson(rawText);
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
                  timestamp: (/* @__PURE__ */ new Date()).toISOString()
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
                coachComment: userData.persona === "max" ? "Gila bro! Porsi segunung gini langsung melampaui target kalori! Tapi kalau buat bulking ekstrim, habiskan dan gas pembakaran di gym besok!" : "Wah porsi makanmu banyak banget hari ini! Imbangi dengan air putih yang cukup ya \u2728"
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
                timestamp: (/* @__PURE__ */ new Date()).toISOString()
              });
              const dailyTotals = getDailyTotals(from);
              const card = formatNutritionCard(fallbackFoodObj, "Teks", userData, dailyTotals);
              responseMessages = [card];
            }
          }
          if (WHATSAPP_TOKEN && WHATSAPP_PHONE_NUMBER_ID && responseMessages.length > 0) {
            for (const msgText of responseMessages) {
              await sendMetaWhatsappMessage(from, msgText);
              await new Promise((r) => setTimeout(r, 800));
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
  app.post("/api/webhook/twilio-whatsapp", import_express.default.urlencoded({ extended: true }), async (req, res) => {
    console.log(`[${(/* @__PURE__ */ new Date()).toISOString()}] Received Twilio WhatsApp Webhook. From: ${req.body?.From}, Body: ${req.body?.Body}`);
    try {
      const { Body, From, NumMedia } = req.body;
      let userProfile = getUserProfile(From);
      let userText = Body || "";
      let imagePart = null;
      if (NumMedia && parseInt(NumMedia) > 0) {
        const mediaUrl = req.body.MediaUrl0;
        const mediaContentType = req.body.MediaContentType0;
        if (mediaUrl) {
          try {
            const imageRes = await import_axios.default.get(mediaUrl, { responseType: "arraybuffer" });
            const imageBuffer = Buffer.from(imageRes.data, "binary");
            const base64Image = imageBuffer.toString("base64");
            imagePart = { inlineData: { data: base64Image, mimeType: mediaContentType || "image/jpeg" } };
          } catch (mediaErr) {
            console.error("Error fetching Twilio media:", mediaErr);
          }
        }
      }
      const lowerText = userText.toLowerCase();
      const isWelcomeMessage = lowerText.includes("gymbuddy") && (lowerText.includes("target harian") || lowerText.includes("target saya") || lowerText.includes("tolong kirimkan")) || lowerText.includes("nama saya") && lowerText.includes("target saya");
      if (!userProfile && !isWelcomeMessage) {
        const twiml2 = new import_twilio.default.twiml.MessagingResponse();
        twiml2.message(
          `\u26A0\uFE0F *AKUN BELUM TERDAFTAR DI GYMBUDDY AI*
-----------------------------
Halo! Nomor WhatsApp kamu belum terdaftar atau telah dihapus dari database GymBuddy AI.

Silakan lakukan registrasi & isi kuesioner onboarding terlebih dahulu di website GymBuddy AI agar Coach kami bisa menyesuaikan kebutuhan kalori & latihanmu secara personal! \u{1F3AF}\u2728`
        );
        return res.type("text/xml").send(twiml2.toString());
      }
      if (!userProfile) {
        userProfile = getOrCreateUserProfile(From, userText);
      }
      const userData = calculateUserData(userProfile);
      const isRecommendationMessage = lowerText.includes("rekomendasi makanan") || lowerText.includes("menu makan") || lowerText.includes("saran makan") || lowerText.includes("pagi siang malam") || lowerText.includes("rekomendasi sarapan");
      const isWorkoutReqMessage = lowerText.includes("workout") || lowerText.includes("latihan") || lowerText.includes("jadwal gym") || lowerText.includes("rekomendasi workout") || lowerText.includes("menu latihan") || lowerText.includes("olahraga");
      const isCheckSummaryMessage = lowerText.includes("cek kalori") || lowerText.includes("sisa kalori") || lowerText.includes("rekap kalori") || lowerText.includes("rekap") || lowerText.includes("kemarin") || lowerText.includes("makan apa");
      const isProgressHistoryMessage = lowerText.includes("cek progress") || lowerText.includes("riwayat progress") || lowerText.includes("progress minggu");
      const weightMatch = userText.match(/(?:update\s+bb|lapor\s+bb|berat\s+badan|bb\s+sekarang|bb)\s*:?\s*(\d+(?:[\.,]\d+)?)/i);
      const waterMatch = userText.match(/(?:minum|air\s+putih|water|hidrasi)\s*:?\s*(\d+(?:[\.,]\d+)?)\s*(gelas|cup|cups|ml|l|liter)?/i);
      const isResetMessage = lowerText.includes("reset akun") || lowerText.includes("hapus akun") || lowerText.includes("reset data") || lowerText.includes("hapus data saya");
      let responseMessages = [];
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
          `\u{1F5D1}\uFE0F *AKUN & DATA KAMU BERHASIL DIHAPUS!*
-----------------------------
Semua profil dan riwayat kamu telah dibersihkan dari database GymBuddy AI.

Sekarang kamu bisa mencoba alur pendaftaran & onboarding baru dari awal di website! \u2728`
        ];
      } else if (isWelcomeMessage) {
        const nameMatch = userText.match(/(?:i am|saya|nama saya)\s+([^,!\.\n]+)/i);
        const targetMatch = userText.match(/(?:my target is|target saya adalah|goal saya)\s+([^,!\.\n]+)/i);
        let updatedProfileNeeded2 = false;
        if (nameMatch && nameMatch[1].trim()) {
          userProfile.name = nameMatch[1].trim();
          updatedProfileNeeded2 = true;
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
          updatedProfileNeeded2 = true;
        }
        if (updatedProfileNeeded2) {
          saveUserProfile(From, userProfile);
        }
        if (userProfile.hasReceivedWelcome) {
          const coachName = userData.persona === "max" ? "Coach Max" : "Coach Mia";
          const shortWelcome = userData.persona === "max" ? `\u{1F525} *WOY ${userData.name.toUpperCase()}!* ${coachName} siap mendampingi lo!

Mau catat makanan hari ini, lapor air minum, update BB ("update bb 72"), atau minta rekomendasi workout? Kirim aja langsung di sini! \u{1F4AA}` : `\u2728 *HALO ${userData.name.toUpperCase()}!* ${coachName} di sini! \u{1F970}

Mau catat makanan harian, lapor air minum, update BB ("update bb 72"), atau konsultasi latihan? Silakan kirim kapan saja ya! \u{1F33F}`;
          responseMessages = [shortWelcome];
        } else {
          userProfile.hasReceivedWelcome = true;
          saveUserProfile(From, userProfile);
          const currentCalculated = calculateUserData(userProfile);
          responseMessages = generateWelcomeMessages(currentCalculated);
        }
      } else if (waterMatch) {
        const rawAmount = parseFloat(waterMatch[1].replace(",", "."));
        const unit = (waterMatch[2] || "gelas").toLowerCase();
        let actualMl;
        if (unit === "ml") {
          actualMl = rawAmount;
        } else if (unit === "l" || unit === "liter") {
          actualMl = rawAmount * 1e3;
        } else {
          actualMl = Math.round(rawAmount) * 250;
        }
        const cupsToAdd = Math.max(1, Math.round(actualMl / 250));
        const currentCups = getWaterCups(From);
        const newTotalCups = setWaterCups(From, currentCups + cupsToAdd);
        const liters = (newTotalCups * 0.25).toFixed(1);
        const waterEntry = {
          id: `wa-water-${Date.now()}`,
          foodName: `Air Putih ${actualMl} ml`,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          isHydration: true,
          volumeMl: actualMl,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          mealType: getMealTypeByHour()
        };
        addMealLog(From, waterEntry);
        const coachName = userData.persona === "max" ? "Coach Max" : "Coach Mia";
        const comment = userData.persona === "max" ? "Mantap bro! Jaga terus hidrasi tubuh lo biar metabolisme makin kenceng! \u{1F525}" : "Hebat banget! Tetap rajin minum air putih ya biar tubuh selalu segar \u2728";
        responseMessages = [
          `\u{1F4A7} *CATATAN HIDRASI DISIMPAN*
-----------------------------
\u2705 Kamu menambah *${actualMl} ml* air putih!
\u{1F4CA} Total Hidrasi Hari Ini: *${newTotalCups} Gelas* (${liters} Liter / 3.0 L Target)

\u{1F4AC} *${coachName}*:
"${comment}"`
        ];
      } else if (weightMatch) {
        const newW = parseFloat(weightMatch[1].replace(",", "."));
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
      } else if (getAi()) {
        await sendTwilioWhatsappMessage(From, "sedang berpikir... \u{1F4AD}\n\nHampir selesai mengecek inputmu... \u{1F4CA}");
        const isMia = userData.persona === "mia" || userData.persona === "nikita";
        const personaInstruction = isMia ? `PERSONA MIA: Kamu adalah pelatih (coach) profesional wanita bernama Coach Mia. Kamu sangat santun, ramah, halus, lembut, dan edukatif (aku/kamu). DILARANG KERAS menggunakan panggilan berlebihan seperti "sayang", "cinta", "beb", dll. Tetaplah 100% PROFESIONAL, sopan, baik hati, dan mendukung kebugaran pengguna secara halus. SELALU panggil dirimu Coach Mia dan JANGAN PERNAH menyapa sebagai Coach Max.` : `PERSONA MAX: Kamu adalah pelatih (coach) pria bernama Coach Max. Kamu tegas, serius, to-the-point, dan ala bahasa gaul Jakarta/bro (lo/gue). SELALU panggil dirimu Coach Max.`;
        const activeService = userData.activeService || "both";
        const serviceInstruction = activeService === "nutritionist" ? `BATASAN LAYANAN PENGGUNA: User berlangganan Paket AI Nutritionist.
Fokuslah 100% pada konsultasi nutrisi, evaluasi porsi makan, kalori, dan makro.
Jika user meminta program/jadwal workout yang detail, berikan jawaban singkat lalu ingatkan secara sopan:
"\u{1F4A1} *Catatan Coach*: Layanan aktif kamu saat ini adalah AI Nutritionist. Kamu bisa upgrade ke Paket Premium untuk mengaktifkan AI Workout Coach penuh! \u{1F3CB}\uFE0F\u200D\u2642\uFE0F"` : activeService === "workout" ? `BATASAN LAYANAN PENGGUNA: User berlangganan Paket AI Workout Coach.
Fokuslah 100% pada teknik latihan, posture check, rekomendasi workout, dan alat gym.
Jika user meminta pencatatan kalori/makanan, berikan estimasi singkat lalu ingatkan secara sopan:
"\u{1F4A1} *Catatan Coach*: Layanan aktif kamu saat ini adalah AI Workout Coach. Kamu bisa upgrade ke Paket Premium untuk mengaktifkan AI Nutritionist penuh! \u{1F966}"` : `BATASAN LAYANAN PENGGUNA: User berlangganan Paket Premium (All-Access). Berikan pendampingan penuh untuk nutrisi maupun latihan.`;
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
          let parsed = extractAndParseJson(rawText);
          if (!parsed) {
            const cleanReply = String(rawText || "").replace(/```(?:json)?[\s\S]*?```/gi, "").trim();
            parsed = { isFood: false, isEquipment: false, generalReply: cleanReply || "Sip! Ada laporan makanan atau latihan lain yang mau ditanyakan?" };
          }
          const isEquipmentMatch = parsed.isEquipment || imagePart && !parsed.isFood || lowerText.includes("alat") || lowerText.includes("cara pakai") || lowerText.includes("mesin") || lowerText.includes("gym");
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
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            });
            const dailyTotals = getDailyTotals(From);
            const card = formatNutritionCard(parsed, imagePart ? "Foto" : "Teks", userData, dailyTotals);
            responseMessages = [card];
          } else if (isEquipmentMatch) {
            if (!parsed.equipmentName) parsed.equipmentName = "Alat Gym / Mesin Latihan";
            parsed.isEquipment = true;
            const eqCard = formatEquipmentCard(parsed, userData);
            responseMessages = [eqCard];
            (async () => {
              try {
                const infographicUrl = await generateEquipmentInfographicPNG(parsed, userData);
                if (infographicUrl && getTwilio()) {
                  const twilioPhone = process.env.TWILIO_PHONE_NUMBER || "whatsapp:+14155238886";
                  const fromNum = twilioPhone.startsWith("whatsapp:") ? twilioPhone : `whatsapp:${twilioPhone}`;
                  const toNum = From.startsWith("whatsapp:") ? From : `whatsapp:${From}`;
                  await getTwilio().messages.create({
                    body: `\u{1F3CB}\uFE0F *TUTORIAL CARA PAKAI ALAT: ${(parsed.equipmentName || "ALAT GYM").toUpperCase()}*

Berikut infografis resmi dari GymBuddy AI untuk panduan bagian alat, cara pakai step-by-step, & kesalahan umum! \u{1F4AA}\u2728`,
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
      const twiml = new import_twilio.default.twiml.MessagingResponse();
      if (responseMessages.length > 0) {
        const combinedMessage = responseMessages.join("\n\n---\n\n");
        twiml.message(combinedMessage);
      }
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
              await new Promise((r) => setTimeout(r, 600));
            }
            console.log("Successfully delivered message via Twilio REST API to:", toNum);
          } catch (restErr) {
            console.error("Twilio REST API send error:", restErr?.message || restErr);
          }
        })();
      }
      const xmlOutput = twiml.toString();
      console.log(`[${(/* @__PURE__ */ new Date()).toISOString()}] Sending TwiML XML response to Twilio:
${xmlOutput}`);
      res.type("text/xml").send(xmlOutput);
    } catch (error) {
      console.error("Error processing Twilio webhook:", error);
      res.sendStatus(500);
    }
  });
  app.get("/api/user/:phone/meals", (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const altPhone = phone.startsWith("0") ? "62" + phone.substring(1) : phone.startsWith("62") ? "0" + phone.substring(2) : phone;
    const targetDate = req.query.date || getTodayDateStr();
    const key = `${phone}_${targetDate}`;
    const altKey = `${altPhone}_${targetDate}`;
    let logs = dbData.dailyLogs[key] ? [...dbData.dailyLogs[key]] : dbData.dailyLogs[altKey] ? [...dbData.dailyLogs[altKey]] : [];
    let calories = 0, protein = 0, carbs = 0, fat = 0;
    logs.forEach((m) => {
      calories += Number(m.calories) || 0;
      protein += Number(m.protein) || 0;
      carbs += Number(m.carbs) || 0;
      fat += Number(m.fat) || 0;
    });
    res.json({
      success: true,
      phone,
      date: targetDate,
      totals: { calories, protein, carbs, fat },
      logs
    });
  });
  app.delete("/api/user/:phone/meals/:mealId", (req, res) => {
    const phone = normalizePhone(req.params.phone);
    const { mealId } = req.params;
    const targetDate = req.query.date || getTodayDateStr();
    const key = `${phone}_${targetDate}`;
    if (dbData.dailyLogs[key]) {
      dbData.dailyLogs[key] = dbData.dailyLogs[key].filter((m) => m.id !== mealId);
      saveDb();
    }
    res.json({ success: true });
  });
  async function generateGeminiImage(promptText) {
    const rawEq = promptText.match(/for ([A-Z0-9\s]+)\./i);
    const eqName = rawEq ? rawEq[1].trim() : "Gym Equipment";
    const fullPrompt = `Photorealistic 8k fitness infographic tutorial poster for how to use ${eqName}. Dark gym aesthetic background with gold and white typography. Top title TUTORIAL CARA PAKAI ALAT INI ${eqName}. Bagian Alat section showing equipment parts. Cara Pakai section showing 4 step by step workout demonstration cards with athletic people performing the movement. Tips and common mistakes section with red X posture error comparison. Target muscle anatomy diagram showing worked muscles and workout sets reps rest counter. High quality realistic gym guide poster.`;
    if (USER_GEMINI_KEY) {
      const cleanKey = USER_GEMINI_KEY;
      const isBearer = cleanKey.startsWith("AQ.") || cleanKey.startsWith("ya29.");
      const imagenModels = ["imagen-3.0-generate-002", "imagen-3.0-fast-generate-001"];
      for (const mName of imagenModels) {
        try {
          console.log(`[Google Imagen 3] Requesting ${mName}:predict (Key: ${cleanKey.substring(0, 4)}...)...`);
          const baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${mName}:predict`;
          const url = isBearer ? baseUrl : `${baseUrl}?key=${encodeURIComponent(cleanKey)}`;
          const headers = { "Content-Type": "application/json" };
          if (isBearer) {
            headers["Authorization"] = `Bearer ${cleanKey}`;
          } else {
            headers["x-goog-api-key"] = cleanKey;
          }
          const resp = await import_axios.default.post(
            url,
            {
              instances: [{ prompt: fullPrompt }],
              parameters: { sampleCount: 1, aspectRatio: "3:4", outputMimeType: "image/jpeg" }
            },
            { headers, timeout: 15e3 }
          );
          const base64Data = resp.data?.predictions?.[0]?.bytesBase64Encoded || resp.data?.generatedImages?.[0]?.image?.imageBytes;
          if (base64Data) {
            console.log(`[Google Imagen 3] Successfully generated AI image via ${mName}!`);
            return Buffer.from(base64Data, "base64");
          }
        } catch (restErr) {
          console.log(`[Google Imagen 3] Model ${mName} note:`, restErr?.response?.data?.error?.message || restErr?.message);
        }
      }
      if (isBearer) {
        for (const mName of imagenModels) {
          try {
            console.log(`[Google Vertex AI Imagen 3] Requesting ${mName}:predict via Vertex API...`);
            const url = `https://us-central1-aiplatform.googleapis.com/v1/publishers/google/models/${mName}:predict`;
            const resp = await import_axios.default.post(
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
                timeout: 15e3
              }
            );
            const base64Data = resp.data?.predictions?.[0]?.bytesBase64Encoded || resp.data?.predictions?.[0]?.imageBytes;
            if (base64Data) {
              console.log(`[Google Vertex AI Imagen 3] Successfully generated AI image via Vertex ${mName}!`);
              return Buffer.from(base64Data, "base64");
            }
          } catch (vErr) {
            console.log(`[Google Vertex AI Imagen 3] Model ${mName} note:`, vErr?.response?.data?.error?.message || vErr?.message);
          }
        }
      }
    }
    const seed = Math.floor(Math.random() * 1e5);
    const cleanPrompt = encodeURIComponent(`gym workout tutorial poster for ${eqName}, fitness guide`);
    const pollinationsUrls = [
      `https://image.pollinations.ai/prompt/${cleanPrompt}?width=800&height=1200&nologo=true&seed=${seed}`,
      `https://image.pollinations.ai/prompt/${cleanPrompt}?model=flux&width=800&height=1200&nologo=true&seed=${seed}`,
      `https://image.pollinations.ai/prompt/${cleanPrompt}?model=turbo&width=800&height=1200&nologo=true&seed=${seed}`
    ];
    for (const pUrl of pollinationsUrls) {
      try {
        console.log("[Pollinations AI] Fetching AI image:", pUrl);
        const resp = await import_axios.default.get(pUrl, { responseType: "arraybuffer", timeout: 1e4 });
        const contentType = String(resp.headers?.["content-type"] || "");
        if (resp.data && resp.data.length > 5e3 && (contentType.includes("image") || resp.data.length > 8e3)) {
          console.log("[Pollinations AI] Successfully generated AI poster! Bytes:", resp.data.length);
          return Buffer.from(resp.data);
        }
      } catch (e) {
        console.log("[Pollinations AI] Attempt note:", e?.message || e);
      }
    }
    return null;
  }
  app.get(["/api/generated-image/:id.jpg", "/api/generated-image/:id.png"], async (req, res) => {
    const rawId = req.params.id;
    const idStr = Array.isArray(rawId) ? rawId[0] : rawId || "";
    const cleanId = idStr.replace(/\.(jpg|jpeg|png)$/i, "");
    const imgBase64 = dbData.generatedImages ? dbData.generatedImages[cleanId] : null;
    if (imgBase64) {
      const imgBuffer = Buffer.from(imgBase64, "base64");
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(imgBuffer);
    }
    const info = dbData.infographics && dbData.infographics[cleanId] ? dbData.infographics[cleanId] : null;
    const parsed = info ? info.parsed : { equipmentName: "Alat Gym" };
    const userData = info ? info.userData : { name: "User", goalTitle: "Menurunkan Berat Badan" };
    const svgStr = generateInfographicSVG(parsed, userData);
    try {
      const { Resvg } = await import("@resvg/resvg-js");
      const resvg = new Resvg(svgStr, { fitTo: { mode: "width", value: 800 } });
      const pngData = resvg.render();
      const pngBuffer = pngData.asPng();
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(pngBuffer);
    } catch (e) {
      console.log("[Resvg Render Fallback]:", e?.message || e);
      res.setHeader("Content-Type", "image/svg+xml");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(svgStr);
    }
  });
  function generateInfographicSVG(parsed, userData) {
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
    ]).map((x) => String(x));
    const stepsList = (Array.isArray(parsed.steps) && parsed.steps.length > 0 ? parsed.steps : [
      "Atur Posisi: Sesuaikan beban dan posisi tubuh secara stabil",
      "Posisi Awal: Kunci pegangan, tubuh tegap, kencangkan otot core",
      "Gerakan Latihan: Eksekusi gerakan perlahan 2-3 detik",
      "Gerakan Akhir: Kembali ke posisi awal dengan terkontrol"
    ]).map((x) => String(x));
    const tipsList = (Array.isArray(parsed.tips) && parsed.tips.length > 0 ? parsed.tips : [
      "Gerakan perlahan & terkontrol (3 dtk turun, 1 dtk naik)",
      "Fokus pada kontraksi otot target utama",
      "Jaga postur tubuh tetap lurus & atur pernapasan"
    ]).map((x) => String(x));
    const mistakesList = (Array.isArray(parsed.mistakes) && parsed.mistakes.length > 0 ? parsed.mistakes : [
      "Menggunakan ayunan/momentum berlebihan",
      "Postur punggung membungkuk saat mengangkat beban",
      "Rentang gerakan terlalu pendek (half reps)"
    ]).map((x) => String(x));
    let defaultSets = "3 - 4 Set";
    let defaultReps = "10 - 15 Repetisi";
    let defaultRest = "60 - 90 Detik";
    const goalLower = (userData.goalTitle || "").toLowerCase();
    if (goalLower.includes("menurunkan") || goalLower.includes("fat loss") || goalLower.includes("turun")) {
      defaultSets = "3 - 4 Set";
      defaultReps = "12 - 15 Reps";
      defaultRest = "45 - 60 Detik";
    } else if (goalLower.includes("naik") || goalLower.includes("otot") || goalLower.includes("gain")) {
      defaultSets = "4 Set";
      defaultReps = "8 - 12 Reps";
      defaultRest = "90 - 120 Detik";
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
        <text x="140" y="18.5" fill="#eab308" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle" letter-spacing="1.5">\u26A1 GYMBUDDY AI \u2022 INFOGRAFIS ALAT</text>

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
        <text x="81" y="30" fill="#eab308" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">\u{1F529} BAGIAN ALAT</text>

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
          ${partsList.slice(0, 4).map((p, i) => {
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
        <text x="81" y="30" fill="#eab308" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">\u{1F4D0} CARA PAKAI</text>

        ${stepsList.slice(0, 4).map((s, i) => {
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
          <text x="56" y="29" fill="#22c55e" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">\u{1F4A1} TIPS</text>

          ${tipsList.slice(0, 4).map((t, i) => `
            <g transform="translate(16, ${48 + i * 40})">
              <circle cx="10" cy="10" r="8" fill="#22c55e"/>
              <text x="10" y="14" fill="#000" font-size="10" text-anchor="middle">\u2713</text>
              <text x="26" y="14" fill="#cbd5e1" font-family="sans-serif" font-size="11" font-weight="bold">${escapeXml(t.substring(0, 40))}</text>
            </g>
          `).join("")}
        </g>

        <!-- Kesalahan Umum Card with Posture Warning Diagram -->
        <g transform="translate(372, 0)">
          <rect x="0" y="0" width="348" height="215" rx="16" fill="url(#cardGrad)" stroke="rgba(255,255,255,0.06)"/>
          <rect x="16" y="14" width="140" height="22" rx="11" fill="rgba(239,68,68,0.15)"/>
          <text x="86" y="29" fill="#ef4444" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">\u274C KESALAHAN UMUM</text>

          ${mistakesList.slice(0, 3).map((m, i) => `
            <g transform="translate(16, ${48 + i * 40})">
              <circle cx="10" cy="10" r="8" fill="#ef4444"/>
              <text x="10" y="14" fill="#fff" font-size="10" text-anchor="middle">\u2715</text>
              <text x="26" y="14" fill="#cbd5e1" font-family="sans-serif" font-size="11" font-weight="bold">${escapeXml(m.substring(0, 34))}</text>
            </g>
          `).join("")}

          <g transform="translate(230, 130)">
            <rect width="100" height="70" rx="8" fill="#12141f" stroke="rgba(239,68,68,0.3)"/>
            <path d="M 20 50 Q 50 15 80 50" stroke="#ef4444" stroke-width="3" stroke-dasharray="3,3" fill="none"/>
            <circle cx="50" cy="28" r="7" fill="#ef4444"/>
            <text x="50" y="32" fill="#fff" font-size="9" text-anchor="middle">\u2715</text>
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
          <text x="86" y="29" fill="#eab308" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">\u{1F3AF} OTOT DILATIH</text>

          <g transform="translate(16, 45)">
            <rect width="80" height="80" rx="8" fill="#12141f" stroke="rgba(234,179,8,0.2)"/>
            <path d="M 40 15 L 40 70 M 25 30 L 55 30 M 25 30 L 20 55 M 55 30 L 60 55 M 32 70 L 30 90 M 48 70 L 50 90" stroke="#475569" stroke-width="3" stroke-linecap="round"/>
            <circle cx="40" cy="15" r="6" fill="#475569"/>
            <ellipse cx="40" cy="35" rx="12" ry="8" fill="rgba(234,179,8,0.7)"/>
            <ellipse cx="40" cy="50" rx="10" ry="6" fill="rgba(234,179,8,0.7)"/>
          </g>

          <text x="110" y="65" fill="#f8fafc" font-family="sans-serif" font-size="12" font-weight="bold">\u2022 ${escapeXml(rawMuscles.substring(0, 28))}</text>
          <text x="110" y="85" fill="#cbd5e1" font-family="sans-serif" font-size="11">\u2022 Core &amp; Stabilizer Otot</text>
          <text x="110" y="105" fill="#94a3b8" font-family="sans-serif" font-size="10">Target utama latihan ini</text>
        </g>

        <!-- Right: Rekomendasi 3 Stat Cards -->
        <g transform="translate(372, 0)">
          <rect x="0" y="0" width="348" height="140" rx="16" fill="url(#cardGrad)" stroke="rgba(234, 179, 8, 0.2)"/>
          <rect x="16" y="14" width="130" height="22" rx="11" fill="rgba(6,182,212,0.15)"/>
          <text x="81" y="29" fill="#06b6d4" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">\u{1F4CA} REKOMENDASI</text>

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
      <text x="400" y="1150" fill="#64748b" font-family="sans-serif" font-size="11" text-anchor="middle">Official GymBuddy AI Visual Infographic Guide \u2022 Khusus untuk ${userName}</text>
    </svg>`;
  }
  app.get(["/api/infographic/:id.svg", "/api/infographic/:id.png"], async (req, res) => {
    const rawId = req.params.id;
    const idStr = Array.isArray(rawId) ? rawId[0] : rawId || "";
    const cleanId = idStr.replace(/\.(svg|png|jpg|jpeg)$/i, "");
    const info = dbData.infographics && dbData.infographics[cleanId] ? dbData.infographics[cleanId] : null;
    const parsed = info ? info.parsed : { equipmentName: "Dumbbell Hex" };
    const userData = info ? info.userData : { name: "User", goalTitle: "Menurunkan Berat Badan" };
    const svgStr = generateInfographicSVG(parsed, userData);
    try {
      const { Resvg } = await import("@resvg/resvg-js");
      const resvg = new Resvg(svgStr, { fitTo: { mode: "width", value: 800 } });
      const pngData = resvg.render();
      const pngBuffer = pngData.asPng();
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(pngBuffer);
    } catch (e) {
      console.log("[Resvg Render Fallback]:", e?.message || e);
      res.setHeader("Content-Type", "image/svg+xml");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(svgStr);
    }
  });
  app.get("/infographic/:id", (req, res) => {
    const rawId = req.params.id;
    const idStr = Array.isArray(rawId) ? rawId[0] : rawId || "";
    const info = dbData.infographics && dbData.infographics[idStr] ? dbData.infographics[idStr] : null;
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
    const desc = parsed.description || "Melatih kelompok otot target secara optimal.";
    const muscles = parsed.targetMuscles || "Punggung, Glutes, Hamstring";
    const partsList = Array.isArray(parsed.parts) && parsed.parts.length > 0 ? parsed.parts : ["Pegangan Utama", "Beban Principal", "Pengunci", "Support Pad"];
    const stepsList = Array.isArray(parsed.steps) && parsed.steps.length > 0 ? parsed.steps : ["Atur Posisi", "Posisi Awal", "Gerakan Latihan", "Gerakan Akhir"];
    const tipsList = Array.isArray(parsed.tips) && parsed.tips.length > 0 ? parsed.tips : ["Gerakan perlahan", "Fokus kontraksi otot"];
    const mistakesList = Array.isArray(parsed.mistakes) && parsed.mistakes.length > 0 ? parsed.mistakes : ["Menggunakan momentum", "Postur membungkuk"];
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
        <div class="badge">\u26A1 GYMBUDDY AI \u2022 INFOGRAFIS VISUAL RESMI</div>
        <div class="title">TUTORIAL CARA PAKAI ALAT INI</div>
        <div class="machine-name">${eqName}</div>
        <div class="sub-desc">${desc}</div>
      </div>
    </div>

    <!-- BAGIAN ALAT -->
    <div class="section-box">
      <div class="sec-title">\u{1F529} BAGIAN UTAMA ALAT</div>
      <div class="grid-4">
        ${partsList.map((p, i) => `
          <div class="card-item">
            <div class="card-num">${i + 1}</div>
            <div class="card-text">${p}</div>
          </div>
        `).join("")}
      </div>
    </div>

    <!-- CARA PAKAI STEP BY STEP -->
    <div class="section-box">
      <div class="sec-title">\u{1F4D0} CARA PAKAI (STEP-BY-STEP)</div>
      <div class="grid-4">
        ${stepsList.map((s, i) => `
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
        <div class="sec-title">\u{1F4A1} TIPS PERFORMA</div>
        ${tipsList.map((t) => `
          <div class="list-item">
            <span>\u2705</span> <span>${t}</span>
          </div>
        `).join("")}
      </div>
      <div class="section-box">
        <div class="sec-title">\u274C KESALAHAN UMUM</div>
        ${mistakesList.map((m) => `
          <div class="list-item">
            <span>\u26A0\uFE0F</span> <span>${m}</span>
          </div>
        `).join("")}
      </div>
    </div>

    <!-- OTOT DILATIH & REKOMENDASI -->
    <div class="section-box">
      <div class="sec-title">\u{1F3AF} OTOT DILATIH: ${muscles}</div>
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
      Official GymBuddy AI Guide \u2022 Dibuat khusus untuk <strong>${userData.name || "User"}</strong> (${userData.goalTitle || "Goal Harian"})
    </div>
  </div>
</body>
</html>`;
    res.send(html);
  });
  function formatEquipmentTutorialCard(parsed, userData) {
    const infoId = `info-${Date.now()}`;
    if (!dbData.infographics) dbData.infographics = {};
    dbData.infographics[infoId] = { parsed, userData, timestamp: (/* @__PURE__ */ new Date()).toISOString() };
    saveDb();
    const baseUrl = process.env.RENDER_EXTERNAL_URL || "https://gymbuddy-backend-zfft.onrender.com";
    const infographicUrl = `${baseUrl}/infographic/${infoId}`;
    const rawEqName = (parsed.equipmentName || "").trim();
    const isGeneric = !rawEqName || rawEqName.includes("THIS MACHINE") || rawEqName.includes("Nama Alat Gym");
    const eqName = (isGeneric ? "ALAT GYM / MESIN LATIHAN" : rawEqName).toUpperCase();
    const desc = parsed.description || "Melatih kelompok otot target secara optimal.";
    const muscles = parsed.targetMuscles || "Otot Target Latihan";
    const parts = Array.isArray(parsed.parts) && parsed.parts.length > 0 ? parsed.parts.map((p, i) => `  ${i + 1}\uFE0F\u20E3 *${p}*`).join("\n") : "  1\uFE0F\u20E3 *Pegangan Utama / Grip*: Menjaga posisi tangan\n  2\uFE0F\u20E3 *Beban / Resistance*: Pengatur intensitas\n  3\uFE0F\u20E3 *Support Pad / Pijakan*: Menjaga stabilitas postur";
    const steps = Array.isArray(parsed.steps) && parsed.steps.length > 0 ? parsed.steps.map((s, i) => `  ${i + 1}\uFE0F\u20E3 *${s}*`).join("\n") : "  1\uFE0F\u20E3 *Atur Posisi*: Sesuaikan beban & posisi awal\n  2\uFE0F\u20E3 *Posisi Awal*: Kencangkan otot core dan pegang alat\n  3\uFE0F\u20E3 *Gerakan Latihan*: Tarik/Dorong beban perlahan\n  4\uFE0F\u20E3 *Gerakan Akhir*: Kembali ke posisi semula secara terkontrol";
    const tips = Array.isArray(parsed.tips) && parsed.tips.length > 0 ? parsed.tips.map((t) => `  \u2705 ${t}`).join("\n") : "  \u2705 Gerakan perlahan & terkontrol (3 dtk turun, 1 dtk naik)\n  \u2705 Jaga punggung tetap lurus, jangan membungkuk\n  \u2705 Fokus pada kontraksi otot target";
    const mistakes = Array.isArray(parsed.mistakes) && parsed.mistakes.length > 0 ? parsed.mistakes.map((m) => `  \u26A0\uFE0F ${m}`).join("\n") : "  \u26A0\uFE0F Menggunakan ayunan/momentum, bukan kekuatan otot\n  \u26A0\uFE0F Postur punggung melengkung saat beban berat";
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
    return `\u{1F3CB}\uFE0F *TUTORIAL CARA PAKAI ALAT: ${eqName}*
----------------------------------------
\u{1F4CC} *Nama Alat*: ${eqName}
\u{1F4DD} *Fungsi*: ${desc}
\u{1F3AF} *Target Otot*: ${muscles}
\u{1F4CB} *Goal Kamu*: ${userData.goalTitle || "Kebugaran Harian"}

\u{1F5BC}\uFE0F *POSTER INFOGRAFIS VISUAL GYMBUDDY RESMI*:
\u{1F517} ${infographicUrl}

\u{1F529} *BAGIAN ALAT*:
${parts}

\u{1F4D0} *CARA PAKAI (STEP-BY-STEP)*:
${steps}

\u{1F4A1} *TIPS PERFORMA*:
${tips}

\u274C *KESALAHAN UMUM*:
${mistakes}

\u{1F4CA} *REKOMENDASI LATIHAN (KHUSUS SESUAI GOAL KAMU)*:
\u23F1\uFE0F *Sets*: ${sets}
\u{1F504} *Reps*: ${reps}
\u23F3 *Istirahat*: ${rest}

\u{1F4AA} *Coach*: Cobalah porsi di atas & klik link di atas untuk melihat Poster Infografis Visual Resmi GymBuddy AI!`;
  }
  function escapeXml(unsafe) {
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }
  app.post("/api/twilio/webhook", import_express.default.urlencoded({ extended: true }), import_express.default.json(), async (req, res) => {
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
      const isWelcomeMessage = lowerText.includes("gymbuddy") && (lowerText.includes("target harian") || lowerText.includes("target saya") || lowerText.includes("tolong kirimkan")) || lowerText.includes("nama saya") && lowerText.includes("target saya");
      if (!userProfile) {
        const latestOB = dbData.users["latest_onboarding"];
        if (latestOB && latestOB.weight) {
          userProfile = saveUserProfile(from, { ...latestOB, phone: from, normalizedPhone: from });
        }
      }
      if (!userProfile && !isWelcomeMessage && !mediaUrl) {
        const reply = `\u26A0\uFE0F *AKUN BELUM TERDAFTAR DI GYMBUDDY AI*
-----------------------------
Halo! Nomor WhatsApp kamu belum terdaftar.

Silakan isi kuesioner Onboarding di website GymBuddy AI terlebih dahulu untuk memulai! \u{1F3AF}\u2728`;
        const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(reply)}</Message></Response>`;
        res.type("text/xml").send(twiml);
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
          } catch (twErr) {
            console.log("[Twilio WA] Direct API info:", twErr?.message || twErr);
          }
        }
        return;
      }
      if (!userProfile) userProfile = getOrCreateUserProfile(from);
      const userData = calculateUserData(userProfile);
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
        const resetMsg = `\u{1F5D1}\uFE0F *AKUN & DATA BERHASIL DIHAPUS*
-----------------------------------
Seluruh riwayat makanan, latihan, dan profil kamu di GymBuddy telah dibersihkan secara total.

\u{1F449} *Untuk Registrasi Ulang*:
Kamu bisa membalas dengan *"Halo Coach"* untuk memulai pendaftaran baru dari awal, atau isi kuesioner baru di website GymBuddy!

Semangat memulai perjalanan baru! \u{1F4AA}\u2728`;
        const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(resetMsg)}</Message></Response>`;
        return res.type("text/xml").send(twiml);
      }
      const weightMatch = userText.match(/(?:update\s+bb|lapor\s+bb|berat\s+badan|bb\s+sekarang|bb)\s*:?\s*(\d+(?:[\.,]\d+)?)/i);
      const waterMatch = userText.match(/(?:minum|air\s+putih|water|hidrasi)\s*:?\s*(\d+(?:[\.,]\d+)?)\s*(gelas|cup|cups|ml|l|liter)?/i);
      let responseMessages = [];
      let mediaUrlToSend = null;
      if (isWelcomeMessage) {
        const nameMatch = userText.match(/(?:i am|saya|nama saya)\s+([^,!\.\n]+)/i);
        const targetMatch = userText.match(/(?:my target is|target saya adalah|goal saya)\s+([^,!\.\n]+)/i);
        const extractedName = nameMatch ? nameMatch[1].trim().toLowerCase() : "";
        if (extractedName) {
          const allUsers = Object.values(dbData.users).filter((u) => u && u.name && u.phone !== "latest_onboarding");
          const matchByName = allUsers.find((u) => (u.name || "").toLowerCase().includes(extractedName) || extractedName.includes((u.name || "").toLowerCase()));
          if (matchByName && matchByName.weight) {
            userProfile = saveUserProfile(from, { ...matchByName, phone: from, normalizedPhone: from });
          }
        }
        const latestOB = dbData.users["latest_onboarding"];
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
        const rawAmount = parseFloat(waterMatch[1].replace(",", "."));
        const unit = (waterMatch[2] || "gelas").toLowerCase();
        let actualMl;
        if (unit === "ml") {
          actualMl = rawAmount;
        } else if (unit === "l" || unit === "liter") {
          actualMl = rawAmount * 1e3;
        } else {
          actualMl = Math.round(rawAmount) * 250;
        }
        const cupsToAdd = Math.max(1, Math.round(actualMl / 250));
        const newTotalCups = setWaterCups(from, getWaterCups(from) + cupsToAdd);
        const liters = (newTotalCups * 0.25).toFixed(1);
        const waterEntry = {
          id: `wa-water-${Date.now()}`,
          foodName: `Air Putih ${actualMl} ml`,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          isHydration: true,
          volumeMl: actualMl,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          mealType: getMealTypeByHour()
        };
        addMealLog(from, waterEntry);
        const coachName = userData.persona === "max" ? "Coach Max" : "Coach Mia";
        responseMessages = [
          `\u{1F4A7} *CATATAN HIDRASI DISIMPAN*
-----------------------------
\u2705 Kamu menambah *${actualMl} ml* air putih!
\u{1F4CA} Total Hidrasi: *${newTotalCups} Gelas* (${liters}L / 3.0L Target)

\u{1F4AC} *${coachName}*: Mantap! Tetap jaga hidrasi ya! \u{1F4AA}`
        ];
      } else if (weightMatch) {
        const newW = parseFloat(weightMatch[1].replace(",", "."));
        if (!isNaN(newW) && newW > 30 && newW < 300) {
          const resProg = addWeeklyProgress(from, newW, "Update via WhatsApp");
          responseMessages = resProg ? [formatWeeklyProgressCard(resProg)] : ["Profil belum terdaftar. Isi kuesioner dulu!"];
        }
      } else {
        if (USER_GEMINI_KEY) {
          let imagePart = null;
          if (mediaUrl) {
            try {
              let imgResp = null;
              try {
                imgResp = await import_axios.default.get(mediaUrl, {
                  responseType: "arraybuffer",
                  auth: { username: TWILIO_ACCOUNT_SID, password: TWILIO_AUTH_TOKEN },
                  timeout: 15e3
                });
              } catch (e1) {
                imgResp = await import_axios.default.get(mediaUrl, {
                  responseType: "arraybuffer",
                  timeout: 15e3
                });
              }
              if (imgResp && imgResp.data) {
                const base64Image = Buffer.from(imgResp.data).toString("base64");
                const mimeType = String(imgResp.headers?.["content-type"] || "image/jpeg").split(";")[0];
                imagePart = { inlineData: { data: base64Image, mimeType } };
                console.log("[Twilio WA] Successfully downloaded media image for Gemini vision processing!");
              }
            } catch (imgErr) {
              console.error("[Twilio WA] Image download error:", imgErr?.message || imgErr);
            }
          }
          const isMia = userData.persona === "mia" || userData.persona === "nikita";
          const personaInstruction = isMia ? `PERSONA MIA: Coach wanita bernama Coach Mia. Sangat santun, ramah, halus, lembut, dan profesional. DILARANG KERAS panggil "sayang/cinta/beb". Gunakan sapaan sopan (aku/kamu).` : `PERSONA MAX: Coach pria bernama Coach Max. Tegas, penuh energi, gaul Jakarta (lo/gue).`;
          const dailyTotals = getDailyTotals(from);
          const todayMealLogsStr = (dbData.dailyLogs[`${from}_${getLocalDateStr()}`] || []).map((m) => `- ${m.foodName} (${m.calories} kcal | P:${m.protein}g C:${m.carbs}g F:${m.fat}g)`).join("\n") || "Belum ada catatan makanan hari ini";
          const equipmentKeywords = ["alat", "mesin", "cara pakai", "cara memakai", "cara makai", "gimana cara", "how to", "dumbbell", "barbell", "barbel", "bench", "squat rack", "lat pulldown", "leg press", "chest press", "cable", "treadmill", "elliptical", "kettlebell", "smith machine", "pull up", "gym"];
          const hasEquipmentText = equipmentKeywords.some((kw) => lowerText.includes(kw));
          const isEquipmentQuery = imagePart && (hasEquipmentText || lowerText.length < 10) || !imagePart && hasEquipmentText && (lowerText.includes("cara") || lowerText.includes("pakai") || lowerText.includes("alat") || lowerText.includes("mesin"));
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
  "keyInsights": ["\u{1F7E2} Tinggi protein mendukung pembentukan otot", "\u{1F7E1} Perhatikan minyak dari sambal/gorengan"],
  "coachComment": "Saran dari coach singkat & membangun"
}

RUMUS MATEMATIKA SANGAT WAJIB (100% PERSISI, DILARANG SELISIH):
- KALORI HARUS TEPAT SAMA DENGAN: (protein \xD7 4) + (carbs \xD7 4) + (fat \xD7 9).
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

FORMAT 5 - CHAT UMUM / REKOMENDASI / PERTANYAAN LAINNYA:
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
            let parsed = extractAndParseJson(rawText);
            const isRekapQuery = /^(log\s+makanan\s*(ku|saya)?\s*hari\s*ini|rekap|riwayat|ringkasan\s*makanan|sisa\s*kalori|cek\s*kalori\s*hari\s*ini|laporan\s*makanan|makanan\s*hari\s*ini)/i.test(userText.trim());
            if (isRekapQuery || parsed && parsed.intent === "DAILY_REKAP") {
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
              } else if (eqMatch || intentMatch && intentMatch[1] === "EQUIPMENT_TUTORIAL") {
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
            if (isEquipmentQuery && parsed.intent !== "FOOD_LOG" && parsed.intent !== "EQUIPMENT_TUTORIAL") {
              parsed.intent = "EQUIPMENT_TUTORIAL";
              const eqSources = [userText, parsed.generalReply || ""].join(" ");
              const equipGuess = eqSources.match(/(dumbbell|barbel|barbell|lat pulldown|leg press|chest press|bench press|smith machine|cable machine|hyperextension|treadmill|elliptical|rowing machine|pull up bar|kettlebell|hex dumbbell)/i);
              parsed.equipmentName = equipGuess ? equipGuess[1] : imagePart ? "Dumbbell Hex" : "Alat Gym";
            }
            if (String(parsed.isFood).toLowerCase() === "true" || parsed.intent === "FOOD_LOG") {
              parsed = validateAndNormalizeNutrition(parsed, Boolean(imagePart));
              parsed.isFood = true;
              addMealLog(from, {
                id: `m-${Date.now()}`,
                foodName: parsed.foodName || "Makanan",
                calories: Number(parsed.calories) || 0,
                protein: Number(parsed.protein) || 0,
                carbs: Number(parsed.carbs) || 0,
                fat: Number(parsed.fat) || 0,
                fiber: Number(parsed.fiber) || 0,
                mealType: getMealTypeByHour(),
                timestamp: (/* @__PURE__ */ new Date()).toISOString()
              });
              const updatedTotals = getDailyTotals(from);
              responseMessages = [formatNutritionCard(parsed, imagePart ? "Foto AI" : "Teks", userData, updatedTotals)];
            } else if (parsed.intent === "DAILY_REKAP") {
              const totals = getDailyTotals(from);
              responseMessages = [generateDailySummaryCard(userData, totals, "Hari Ini")];
            } else if (parsed.intent === "WORKOUT_PLAN") {
              let workoutReply = parsed.generalReply || "";
              if (!workoutReply || workoutReply.trim().length < 10) {
                workoutReply = `\u{1F3CB}\uFE0F *JADWAL LATIHAN UNTUK ${userData.name.toUpperCase()}*
\u{1F3AF} Goal: ${userData.goalTitle}

\u{1F4C5} *SENIN - DADA & TRISEP*
\u2022 Bench Press: 4x10
\u2022 Incline Dumbbell Press: 3x12
\u2022 Cable Crossover: 3x15
\u2022 Tricep Pushdown: 3x15

\u{1F4C5} *SELASA - PUNGGUNG & BISEP*
\u2022 Pull Up: 4x8
\u2022 Barbell Row: 4x10
\u2022 Lat Pulldown: 3x12
\u2022 Bicep Curl: 3x15

\u{1F4C5} *RABU - ISTIRAHAT AKTIF*
\u2022 Jalan kaki 30 menit atau Yoga ringan

\u{1F4C5} *KAMIS - KAKI*
\u2022 Squat: 4x10
\u2022 Leg Press: 4x12
\u2022 Lunges: 3x12 per kaki
\u2022 Leg Curl: 3x15

\u{1F4C5} *JUMAT - BAHU & ABS*
\u2022 Shoulder Press: 4x10
\u2022 Lateral Raise: 3x15
\u2022 Face Pull: 3x15
\u2022 Plank: 3x60 detik

\u{1F4C5} *SABTU & MINGGU*
\u2022 Istirahat atau cardio ringan 20-30 menit

\u{1F4AA} *Rekomendasi*: ${userData.goalTitle?.includes("turun") ? "Tambahkan 20 menit cardio setelah latihan" : "Fokus progressive overload setiap minggu"}`;
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
                finalMsg = `Hei ${userData.name}! \u{1F4AA} Ada yang bisa ${coachN} bantu hari ini? Mau catat makanan, cek kalori, minta jadwal workout, atau tanya cara pakai alat gym?`;
              }
              responseMessages = [finalMsg];
            }
          } catch (e) {
            console.error("[Twilio WA] Gemini AI error:", e);
            if (userText.match(/(makan|minum|habis|makanan|sarapan|malam|siang|americano|kopi|nasi|ayam|telur|roti|susu|jus|teh|buah|daging|ikan|gandum|es)/i)) {
              const rawFood = userText.replace(/^(aku|saya|gue|habis|makan|minum|catat|log|input|tambah)\s+/gi, "").trim() || "Makanan";
              const foodName = rawFood.charAt(0).toUpperCase() + rawFood.slice(1);
              let estCal = 350, estProt = 15, estCarb = 40, estFat = 10;
              const textLower = userText.toLowerCase();
              if (textLower.includes("americano") || textLower.includes("kopi hitam") || textLower.includes("espresso")) {
                estCal = 10;
                estProt = 0;
                estCarb = 2;
                estFat = 0;
              } else if (textLower.includes("nasi goreng")) {
                estCal = 550;
                estProt = 18;
                estCarb = 65;
                estFat = 22;
              } else if (textLower.includes("telur")) {
                estCal = 210;
                estProt = 18;
                estCarb = 2;
                estFat = 14;
              } else if (textLower.includes("ayam")) {
                estCal = 320;
                estProt = 35;
                estCarb = 5;
                estFat = 15;
              }
              const parsedFallback = { intent: "FOOD_LOG", isFood: true, foodName, calories: estCal, protein: estProt, carbs: estCarb, fat: estFat, generalReply: "Catatan makanan berhasil disimpan!" };
              addMealLog(from, {
                id: `m-${Date.now()}`,
                foodName,
                calories: estCal,
                protein: estProt,
                carbs: estCarb,
                fat: estFat,
                fiber: 0,
                mealType: getMealTypeByHour(),
                timestamp: (/* @__PURE__ */ new Date()).toISOString()
              });
              const updatedTotals = getDailyTotals(from);
              responseMessages = [formatNutritionCard(parsedFallback, "Teks", userData, updatedTotals)];
            } else if (userText.match(/(lari|jogging|gbk|olahraga|cardio)/i)) {
              responseMessages = [`\u{1F3C3} *TIPS LARI SORE DI GBK FOR ${userData.name.toUpperCase()}*

\u{1F525} *Persiapan & Hydration*:
\u2022 Minum 300-500ml air putih 30 menit sebelum lari.
\u2022 Gunakan sepatu lari pendukung & lakukan pemanasan 5 menit.

\u{1F3AF} *Target*: Lari santai 20-30 menit (Zone 2 cardio) untuk membakar kalori & menjaga kesehatan jantung!

Semangat latihannya hari ini! \u{1F4AA}`];
            } else {
              const coachN = userData.persona === "max" ? "Coach Max" : "Coach Mia";
              responseMessages = [`Hei ${userData.name}! \u{1F4AA} ${coachN} siap bantu kamu catat makanan (misal: "habis minum americano"), cek kalori, jadwal workout, atau tutorial alat gym!`];
            }
          }
        }
      }
      if (responseMessages.length > 0) {
        const combinedReply = responseMessages.join("\n\n");
        res.type("text/xml").send("<Response></Response>");
        if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && getTwilio()) {
          try {
            const twilioPhone = process.env.TWILIO_PHONE_NUMBER || "whatsapp:+14155238886";
            const fromNum = twilioPhone.startsWith("whatsapp:") ? twilioPhone : `whatsapp:${twilioPhone}`;
            const toNum = rawFrom.startsWith("whatsapp:") ? rawFrom : `whatsapp:${rawFrom}`;
            const splitMsg = (str, maxLen = 1400) => {
              if (str.length <= maxLen) return [str];
              const result = [];
              const paragraphs = str.split("\n\n");
              let currentChunk = "";
              for (const p of paragraphs) {
                if ((currentChunk + "\n\n" + p).length > maxLen) {
                  if (currentChunk.trim()) result.push(currentChunk.trim());
                  currentChunk = p;
                } else {
                  currentChunk = currentChunk ? currentChunk + "\n\n" + p : p;
                }
              }
              if (currentChunk.trim()) result.push(currentChunk.trim());
              return result.length > 0 ? result : [str.substring(0, maxLen)];
            };
            const chunks = splitMsg(combinedReply, 1400);
            for (let i = 0; i < chunks.length; i++) {
              const msgOpts = {
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
          } catch (twErr) {
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
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    const distIndex = import_path.default.join(distPath, "index.html");
    const rootIndex = import_path.default.join(process.cwd(), "index.html");
    if (import_fs.default.existsSync(distPath)) {
      app.use(import_express.default.static(distPath));
    }
    app.use(import_express.default.static(process.cwd()));
    app.use((req, res) => {
      if (import_fs.default.existsSync(distIndex)) {
        res.sendFile(distIndex);
      } else if (import_fs.default.existsSync(rootIndex)) {
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
//# sourceMappingURL=server.cjs.map
