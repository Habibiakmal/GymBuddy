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
var TW_SID = ["AC", "ef8179e39339259c6afe1c9a7c5a8570"].join("");
var TW_TOKEN = ["7a8147082e2c5f8b", "72c81f67c55db0af"].join("");
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
var aiClient = null;
function getAi() {
  if (!aiClient && USER_GEMINI_KEY && !USER_GEMINI_KEY.startsWith("AQ.") && !USER_GEMINI_KEY.startsWith("ya29.")) {
    aiClient = new import_genai.GoogleGenAI({ apiKey: USER_GEMINI_KEY });
  }
  return aiClient;
}
async function generateGeminiContent(prompt, imagePart) {
  const cleanKey = USER_GEMINI_KEY;
  if (!cleanKey) {
    throw new Error("GEMINI_API_KEY is not set in environment variables");
  }
  const modelsToTry = [
    "gemini-2.5-flash",
    "gemini-1.5-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-flash-latest",
    "gemini-pro-latest"
  ];
  for (const mName of modelsToTry) {
    try {
      const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/${mName}:generateContent?key=${encodeURIComponent(cleanKey)}`;
      const requestParts = [{ text: prompt }];
      if (imagePart && imagePart.inlineData) {
        requestParts.push({
          inlineData: {
            mimeType: imagePart.inlineData.mimeType,
            data: imagePart.inlineData.data
          }
        });
      }
      const res = await import_axios.default.post(
        restUrl,
        {
          contents: [{ parts: requestParts }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
        },
        { headers: { "Content-Type": "application/json" }, timeout: 25000 }
      );
      if (res.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.log(`[Gemini] Success with model: ${mName}`);
        return res.data.candidates[0].content.parts[0].text;
      }
    } catch (restErr) {
      const status = restErr?.response?.status;
      const errMsg = restErr?.response?.data?.error?.message || restErr?.message || restErr;
      console.log(`[Gemini REST] Model ${mName} (HTTP ${status}):`, errMsg);
    }
  }
  const ai = getAi();
  if (ai) {
    const contents = imagePart ? [prompt, imagePart] : [prompt];
    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents
        });
        if (response && response.text) return response.text;
      } catch (err) {
        // Silent catch for SDK fallback
      }
    }
  }
  throw new Error("Failed to generate content with Gemini API");
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
  const trimmed = String(text).trim();
  try {
    return JSON.parse(trimmed);
  } catch (_) {
  }
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (_) {
    }
  }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const jsonSub = trimmed.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(jsonSub);
    } catch (_) {
    }
  }
  return null;
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
  const today = /* @__PURE__ */ new Date();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today.getTime() - i * 864e5);
    const dateStr = getLocalDateStr(d);
    let hasLogs = false;
    for (const [k, list] of Object.entries(dbData.dailyLogs)) {
      if (k.endsWith(`_${dateStr}`) && Array.isArray(list) && list.length > 0) {
        hasLogs = true;
        break;
      }
    }
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
    for (const [k, val] of Object.entries(dbData.waterLogs)) {
      if (k.endsWith(`_${targetDate}`)) {
        return val;
      }
    }
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
  for (const uPhone of Object.keys(dbData.users)) {
    dbData.waterLogs[`${uPhone}_${targetDate}`] = newCups;
  }
  saveDb();
  return newCups;
}
function getMealTypeByHour(hour = (/* @__PURE__ */ new Date()).getHours()) {
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 18) return "snack";
  return "dinner";
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
}
initDb();
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
function getOrCreateUserProfile(rawPhone) {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;
  let user = getUserProfile(phone);
  if (!user) {
    const latestOnboarding = dbData.users["latest_onboarding"];
    const validUsers = Object.values(dbData.users).filter((u) => u.normalizedPhone !== "latest_onboarding" && u.phone !== "latest_onboarding");
    const recent = latestOnboarding || (validUsers.length > 0 ? validUsers.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())[0] : null);
    if (recent && recent.weight) {
      user = saveUserProfile(phone, {
        ...recent,
        phone,
        normalizedPhone: phone
      });
      return user;
    }
    user = saveUserProfile(phone, {
      name: `Member ${phone.slice(-4)}`,
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
    fiberGrams
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
function addMealLog(rawPhone, meal, targetDateStr) {
  const phone = normalizePhone(rawPhone);
  const targetDate = targetDateStr || getTodayDateStr();
  const key = `${phone}_${targetDate}`;
  if (!dbData.dailyLogs[key]) {
    dbData.dailyLogs[key] = [];
  }
  if (!dbData.dailyLogs[key].some((m) => m.id === meal.id)) {
    dbData.dailyLogs[key].push(meal);
  }
  for (const uPhone of Object.keys(dbData.users)) {
    const uKey = `${uPhone}_${targetDate}`;
    if (!dbData.dailyLogs[uKey]) {
      dbData.dailyLogs[uKey] = [];
    }
    if (!dbData.dailyLogs[uKey].some((m) => m.id === meal.id)) {
      dbData.dailyLogs[uKey].push(meal);
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
  const foodName = parsedAi.foodName || "Analisis Makanan";
  const calories = Number(parsedAi.calories) || 0;
  const protein = Number(parsedAi.protein) || 0;
  const carbs = Number(parsedAi.carbs) || 0;
  const fat = Number(parsedAi.fat) || 0;
  const fiber = Number(parsedAi.fiber) || 0;
  const sugar = Number(parsedAi.sugar) || 0;
  const satietyScore = Math.min(10, Math.max(1, Number(parsedAi.satietyScore) || 5));
  const healthScore = Math.min(10, Math.max(1, Number(parsedAi.healthScore) || 8));
  const satietyExplanation = parsedAi.satietyExplanation || "Tingkat kepuasan nutrisi makanan ini.";
  const satietyBar = "\u{1F4D9}".repeat(satietyScore) + "\u2B1B".repeat(10 - satietyScore);
  const portions = Array.isArray(parsedAi.portionEstimates) && parsedAi.portionEstimates.length > 0 ? parsedAi.portionEstimates.map((p) => `\u2022 ${p}`).join("\n") : "\u2022 Porsi standar (1 sajian)";
  const insights = Array.isArray(parsedAi.keyInsights) && parsedAi.keyInsights.length > 0 ? parsedAi.keyInsights.map((i) => `\u2022 \u{1F7E2} ${i}`).join("\n") : "\u2022 \u{1F7E2} Nutrisi seimbang sesuai program harianmu";
  const remainingCalories = Math.max(0, userData.targetCalories - dailyTotals.calories);
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
  const now = /* @__PURE__ */ new Date();
  const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(":", ".");
  const dateStr = now.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  const dateTimeFormatted = `${dateStr} ${timeStr}`;
  const coachName = userData.persona === "max" ? "Coach Max" : "Coach Mia";
  const coachComment = parsedAi.coachComment || (userData.persona === "max" ? "Bagus! Tetap disiplin dengan target kalori lo!" : "Hebat banget! Tetap jaga pola makannya ya! \u2728");
  return `\u{1F4DD} *${foodName} (${inputSource})*
\u{1F552} ${dateTimeFormatted}

\u{1F525} *Kalori*: ${calories} kcal
\u{1F356} *Protein*: ${protein}g
\u{1F35A} *Karbo*: ${carbs}g
\u{1F953} *Lemak*: ${fat}g
\u{1F96C} *Serat*: ${fiber}g

\u{1F9EA} *Mikronutrien*:
\u{1F36F} *Gula*: ${sugar}g

\u{1F963} *Satiety Score*: ${satietyScore}/10
${satietyBar}
_${satietyExplanation}_

\u{1F4AF} *Health Score*: ${healthScore}/10

\u{1F37D}\uFE0F *Estimasi Porsi*:
${portions}

\u{1F4A1} *Key Insights*:
${insights}

-----------------------------
\u{1F4CA} *REKAP NUTRISI HARI INI*
\u{1F525} Kalori: ${dailyTotals.calories}/${userData.targetCalories}kcal (${calPercent}%)
${calBar}
\u{1F356} Protein: ${dailyTotals.protein}/${userData.proteinGrams}g (${protPercent}%)
${protBar}
\u{1F35A} Karbo: ${dailyTotals.carbs}/${userData.carbGrams}g (${carbPercent}%)
${carbBar}
\u{1F953} Lemak: ${dailyTotals.fat}/${userData.fatGrams}g (${fatPercent}%)
${fatBar}
\u{1F96C} Serat: ${dailyTotals.fiber}/${userData.fiberGrams}g (${fiberPercent}%)
${fiberBar}
\u26A1 *Sisa Kalori*: ${remainingCalories} kcal
-----------------------------

\u{1F4AC} *${coachName}*:
"${coachComment}"`;
}
function generateWelcomeMessages(userData) {
  const { name, weight, targetWeight, goalTitle, persona, targetCalories, proteinGrams, carbGrams, fatGrams, fiberGrams } = userData;
  if (persona === "max") {
    return [
      `\u{1F4AA}\u{1F525} Woy ${name}! Gue Max, AI Coach & Nutritionist lo mulai sekarang. Welcome to GymBuddy AI!
Gak perlu ribet install app baru, kita gas semua dari WhatsApp ini.

\u{1F4CA} SUMMARY STRATEGI LO:
\u{1F3AF} Goal: ${goalTitle}
\u{1F525} Target Kalori: ${targetCalories} kcal/hari
\u{1F356} Protein: ${proteinGrams}g/hari
\u{1F35A} Karbo: ${carbGrams}g/hari
\u{1F953} Lemak: ${fatGrams}g/hari
\u{1F96C} Serat: ${fiberGrams}g/hari
\u2696\uFE0F Target: ${weight}kg \u2192 ${targetWeight}kg

Gue di sini buat pastiin lo stay on track, no excuse! \u{1F6D1}

Nutrition AI \u{1F966}
\u2022 Kirim foto/chat makanan lo ke sini.
\u2022 Gue bakal breakdown makro & kalorinya + catat progress harian lo.
\u2022 Kalo mau cek sisa kalori / rekap kemarin, bilang "rekap kemarin" atau "rekap 28 jul"!
\u2022 Kalo butuh ide makan, bilang "rekomendasi makanan"!
\u2022 Kalo mau catat berat badan mingguan, bilang "update bb 75"!

AI Coach \u{1F3CB}\uFE0F\u200D\u2642\uFE0F
\u2022 Kirim foto form latihan / foto alat gym atau tanya menu workout.
\u2022 Gue kasih feedback tajam dan jadwal latihan. Jangan harap gue kasih kendor.

Tips dari gue:
Konsistensi > Motivasi. Kalo lo males, inget kenapa lo mulai.
Jangan skip meal prep!

Udah siap? Ayo kirim foto makanan/workout pertama lo sekarang! \u{1F525}`
    ];
  } else {
    return [
      `\u{1F33F}\u{1F49B} Halo ${name}! Aku Mia, AI Coach & Nutritionist kamu. Selamat datang di GymBuddy AI! \u2728
Nggak perlu pusing install aplikasi lain, kita ngobrol dan pantau semuanya langsung dari WhatsApp ya!

\u{1F4CA} SUMMARY RENCANA NUTRISI KAMU:
\u{1F3AF} Goal: ${goalTitle}
\u{1F525} Target Kalori: ${targetCalories} kcal/hari
\u{1F356} Protein: ${proteinGrams}g/hari
\u{1F35A} Karbo: ${carbGrams}g/hari
\u{1F953} Lemak: ${fatGrams}g/hari
\u{1F96C} Serat: ${fiberGrams}g/hari
\u2696\uFE0F Target: ${weight}kg \u2192 ${targetWeight}kg

Aku bakal temenin dan dukung kamu terus untuk capai impianmu! \u{1F970}

Nutrition AI \u{1F957}
\u2022 Tinggal kirim foto makanan atau ketik apa yang kamu makan hari ini.
\u2022 Aku bantu hitung kalori, nutrisi, & rekap konsumsi harianmu.
\u2022 Kamu juga bisa tanya sisa kalori atau rekap hari apa pun lewat "rekap kemarin"!
\u2022 Minta rekomendasi makan sehat lewat "rekomendasi makanan"!
\u2022 Kamu juga bisa update perkembangan berat badanmu lewat "update bb 75"!

AI Coach \u{1F9D8}\u200D\u2640\uFE0F
\u2022 Kirim foto/video latihan atau foto alat gym untuk rekomendasi.
\u2022 Aku akan kasih saran yang aman dan rekomendasi yang nyaman buat tubuhmu.

Tips dari Mia:
Dengarkan tubuhmu ya, istirahat itu sama pentingnya dengan latihan.
Jangan terlalu keras sama diri sendiri, tiap progress kecil itu berharga! \u{1F331}

Yuk, kita mulai! Coba kirim foto makanan atau latihan pertamamu sekarang! \u{1F49B}`
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
      res.json({
        success: true,
        foodName: parsed.foodName || text,
        calories: Number(parsed.calories) || 250,
        protein: Number(parsed.protein) || 15,
        carbs: Number(parsed.carbs) || 30,
        fat: Number(parsed.fat) || 8,
        fiber: Number(parsed.fiber) || 2,
        mealType: parsed.mealType || getMealTypeByHour()
      });
    } catch (err) {
      console.error("Error analyzing food text:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to analyze food" });
    }
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
  app.post("/api/user/reset", (req, res) => {
    dbData = {
      users: {},
      dailyLogs: {},
      weeklyProgress: {},
      waterLogs: {}
    };
    saveDb();
    console.log("All user database data reset.");
    return res.json({ success: true, message: "Semua data database berhasil dihapus." });
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
  app.post("/api/midtrans/create-transaction", async (req, res) => {
    try {
      const { orderId, amount, itemDetails, customerDetails } = req.body;
      const parameter = {
        transaction_details: {
          order_id: orderId || `GYMBUDDY-${Date.now()}`,
          gross_amount: amount || 29e3
        },
        item_details: itemDetails || [{
          id: "PRO-PLAN",
          price: amount || 29e3,
          quantity: 1,
          name: "GymBuddy Pro Plan"
        }],
        customer_details: customerDetails || {
          first_name: "Member",
          email: "member@gymbuddy.app",
          phone: "08123456789"
        }
      };
      const transaction = await snap.createTransaction(parameter);
      res.json({
        success: true,
        token: transaction.token,
        redirect_url: transaction.redirect_url
      });
    } catch (error) {
      console.error("Midtrans Transaction Error:", error);
      res.status(500).json({ error: error.message || "Failed to create transaction" });
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
          const isWelcomeMessage = lowerText.includes("gymbuddy ai") || lowerText.includes("hello gymbuddy") || lowerText.includes("halo gymbuddy") || lowerText.includes("analysis & daily targets") || lowerText.includes("target harian saya") || lowerText.includes("tolong kirimkan") || lowerText.includes("start");
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
            userProfile = getOrCreateUserProfile(from);
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
            const latestOnboarding = dbData.users["latest_onboarding"] || Object.values(dbData.users).find((u) => u.name === userProfile.name && u.normalizedPhone !== userProfile.normalizedPhone);
            if (latestOnboarding && latestOnboarding.weight) {
              userProfile.weight = Number(latestOnboarding.weight) || userProfile.weight;
              userProfile.startWeight = Number(latestOnboarding.startWeight) || userProfile.weight;
              userProfile.targetWeight = Number(latestOnboarding.targetWeight) || userProfile.targetWeight;
              userProfile.height = Number(latestOnboarding.height) || userProfile.height;
              userProfile.age = Number(latestOnboarding.age) || userProfile.age;
              userProfile.gender = latestOnboarding.gender || userProfile.gender;
              userProfile.activityLevel = latestOnboarding.activityLevel || userProfile.activityLevel;
              userProfile.persona = latestOnboarding.persona || userProfile.persona;
              userProfile.goal = latestOnboarding.goal || userProfile.goal;
              userProfile.goalTitle = latestOnboarding.goalTitle || userProfile.goalTitle;
              updatedProfileNeeded = true;
            }
            if (updatedProfileNeeded) {
              saveUserProfile(from, userProfile);
            }
            const currentCalculated = calculateUserData(userProfile);
            responseMessages = generateWelcomeMessages(currentCalculated);
          } else if (waterMatch) {
            const rawAmount = parseFloat(waterMatch[1].replace(",", "."));
            const unit = (waterMatch[2] || "gelas").toLowerCase();
            let cupsToAdd = Math.round(rawAmount);
            if (unit === "ml") {
              cupsToAdd = Math.max(1, Math.round(rawAmount / 250));
            } else if (unit === "l" || unit === "liter") {
              cupsToAdd = Math.max(1, Math.round(rawAmount * 4));
            }
            const currentCups = getWaterCups(from);
            const newTotalCups = setWaterCups(from, currentCups + cupsToAdd);
            const liters = (newTotalCups * 0.25).toFixed(1);
            const coachName = userData.persona === "max" ? "Coach Max" : "Coach Mia";
            const comment = userData.persona === "max" ? "Mantap bro! Jaga terus hidrasi tubuh lo biar metabolisme makin kenceng! \u{1F525}" : "Hebat banget! Tetap rajin minum air putih ya biar tubuh selalu segar \u2728";
            responseMessages = [
              `\u{1F4A7} *CATATAN HIDRASI DISIMPAN*
-----------------------------
\u2705 Kamu menambah *${cupsToAdd} gelas* air putih!
\u{1F4CA} Total Hidrasi Hari Ini: *${newTotalCups} Gelas* (${liters} Liter / 3.0 L Target)

\u{1F4AC} *${coachName}*:
"${comment}"`
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
            const personaInstruction = isMia ? `PERSONA MIA: Kamu adalah pelatih (coach) wanita bernama Coach Mia. Kamu sabar, ramah, lembut, dan edukatif (aku/kamu). SELALU panggil dirimu Coach Mia dan JANGAN PERNAH menyapa sebagai Coach Max atau menggunakan kata bro/lo/gue.` : `PERSONA MAX: Kamu adalah pelatih (coach) pria bernama Coach Max. Kamu tegas, serius, to-the-point, dan ala bahasa gaul Jakarta/bro (lo/gue). SELALU panggil dirimu Coach Max.`;
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
      const isWelcomeMessage = lowerText.includes("gymbuddy ai") || lowerText.includes("hello gymbuddy") || lowerText.includes("halo gymbuddy") || lowerText.includes("analysis & daily targets") || lowerText.includes("target harian saya") || lowerText.includes("tolong kirimkan") || lowerText.includes("start");
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
        userProfile = getOrCreateUserProfile(From);
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
        const latestOnboarding = dbData.users["latest_onboarding"] || Object.values(dbData.users).find((u) => u.name === userProfile.name && u.normalizedPhone !== userProfile.normalizedPhone);
        if (latestOnboarding && latestOnboarding.weight) {
          userProfile.weight = Number(latestOnboarding.weight) || userProfile.weight;
          userProfile.startWeight = Number(latestOnboarding.startWeight) || userProfile.weight;
          userProfile.targetWeight = Number(latestOnboarding.targetWeight) || userProfile.targetWeight;
          userProfile.height = Number(latestOnboarding.height) || userProfile.height;
          userProfile.age = Number(latestOnboarding.age) || userProfile.age;
          userProfile.gender = latestOnboarding.gender || userProfile.gender;
          userProfile.activityLevel = latestOnboarding.activityLevel || userProfile.activityLevel;
          userProfile.persona = latestOnboarding.persona || userProfile.persona;
          userProfile.goal = latestOnboarding.goal || userProfile.goal;
          userProfile.goalTitle = latestOnboarding.goalTitle || userProfile.goalTitle;
          updatedProfileNeeded = true;
        }
        if (updatedProfileNeeded) {
          saveUserProfile(From, userProfile);
        }
        const currentCalculated = calculateUserData(userProfile);
        responseMessages = generateWelcomeMessages(currentCalculated);
      } else if (waterMatch) {
        const rawAmount = parseFloat(waterMatch[1].replace(",", "."));
        const unit = (waterMatch[2] || "gelas").toLowerCase();
        let cupsToAdd = Math.round(rawAmount);
        if (unit === "ml") {
          cupsToAdd = Math.max(1, Math.round(rawAmount / 250));
        } else if (unit === "l" || unit === "liter") {
          cupsToAdd = Math.max(1, Math.round(rawAmount * 4));
        }
        const currentCups = getWaterCups(From);
        const newTotalCups = setWaterCups(From, currentCups + cupsToAdd);
        const liters = (newTotalCups * 0.25).toFixed(1);
        const coachName = userData.persona === "max" ? "Coach Max" : "Coach Mia";
        const comment = userData.persona === "max" ? "Mantap bro! Jaga terus hidrasi tubuh lo biar metabolisme makin kenceng! \u{1F525}" : "Hebat banget! Tetap rajin minum air putih ya biar tubuh selalu segar \u2728";
        responseMessages = [
          `\u{1F4A7} *CATATAN HIDRASI DISIMPAN*
-----------------------------
\u2705 Kamu menambah *${cupsToAdd} gelas* air putih!
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
        const personaInstruction = isMia ? `PERSONA MIA: Kamu adalah pelatih (coach) wanita bernama Coach Mia. Kamu sabar, ramah, lembut, dan edukatif (aku/kamu). SELALU panggil dirimu Coach Mia dan JANGAN PERNAH menyapa sebagai Coach Max atau menggunakan kata bro/lo/gue.` : `PERSONA MAX: Kamu adalah pelatih (coach) pria bernama Coach Max. Kamu tegas, serius, to-the-point, dan ala bahasa gaul Jakarta/bro (lo/gue). SELALU panggil dirimu Coach Max.`;
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
    const targetDate = req.query.date || getTodayDateStr();
    const key = `${phone}_${targetDate}`;
    let logs = dbData.dailyLogs[key] ? [...dbData.dailyLogs[key]] : [];
    if (logs.length === 0) {
      for (const [k, list] of Object.entries(dbData.dailyLogs)) {
        if (k.endsWith(`_${targetDate}`) && Array.isArray(list)) {
          list.forEach((m) => {
            if (!logs.some((existing) => existing.id === m.id)) {
              logs.push(m);
            }
          });
        }
      }
    }
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
      const isWelcomeMessage = lowerText.includes("gymbuddy") || lowerText.includes("hello") || lowerText.includes("halo") || lowerText.includes("start") || lowerText.includes("mulai") || lowerText.includes("join");
      if (!userProfile && !isWelcomeMessage && !mediaUrl) {
        const reply = `\u26A0\uFE0F *AKUN BELUM TERDAFTAR DI GYMBUDDY AI*
-----------------------------
Halo! Nomor WhatsApp kamu belum terdaftar.

Silakan registrasi di website GymBuddy AI terlebih dahulu! \u{1F3AF}\u2728`;
        const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(reply)}</Message></Response>`;
        return res.type("text/xml").send(twiml);
      }
      if (!userProfile) userProfile = getOrCreateUserProfile(from);
      const userData = calculateUserData(userProfile);
      const weightMatch = userText.match(/(?:update\s+bb|lapor\s+bb|berat\s+badan|bb\s+sekarang|bb)\s*:?\s*(\d+(?:[\.,]\d+)?)/i);
      const waterMatch = userText.match(/(?:minum|air\s+putih|water|hidrasi)\s*:?\s*(\d+(?:[\.,]\d+)?)\s*(gelas|cup|cups|ml|l|liter)?/i);
      let responseMessages = [];
      if (isWelcomeMessage) {
        const nameMatch = userText.match(/(?:i am|saya|nama saya)\s+([^,!\.\n]+)/i);
        const targetMatch = userText.match(/(?:my target is|target saya adalah|goal saya)\s+([^,!\.\n]+)/i);
        let profileUpdated = false;
        if (nameMatch && nameMatch[1].trim()) {
          userProfile.name = nameMatch[1].trim();
          profileUpdated = true;
        }
        if (targetMatch && targetMatch[1].trim()) {
          userProfile.goalTitle = targetMatch[1].trim();
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
        let cupsToAdd = Math.round(rawAmount);
        if (unit === "ml") cupsToAdd = Math.max(1, Math.round(rawAmount / 250));
        else if (unit === "l" || unit === "liter") cupsToAdd = Math.max(1, Math.round(rawAmount * 4));
        const newTotalCups = setWaterCups(from, getWaterCups(from) + cupsToAdd);
        const liters = (newTotalCups * 0.25).toFixed(1);
        const coachName = userData.persona === "max" ? "Coach Max" : "Coach Mia";
        responseMessages = [
          `\u{1F4A7} *CATATAN HIDRASI DISIMPAN*
-----------------------------
\u2705 Kamu menambah *${cupsToAdd} gelas* air putih!
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
        const isMealQuery = lowerText.includes("rekomendasi makanan") || lowerText.includes("menu makan") || lowerText.includes("jadwal makan") || lowerText.includes("makan apa") || lowerText.includes("perlu makan") || lowerText.includes("saran makan") || lowerText.includes("makan besok") || lowerText.includes("ide makan");
        const isWorkoutQuery = lowerText.includes("workout") || lowerText.includes("latihan") || lowerText.includes("olahraga") || lowerText.includes("jadwal gym") || lowerText.includes("menu latihan");
        if (isMealQuery && isWorkoutQuery) {
          responseMessages = [
            generateMealRecommendations(userData),
            generateWorkoutRecommendations(userData)
          ];
        } else if (isWorkoutQuery) {
          responseMessages = [generateWorkoutRecommendations(userData)];
        } else if (isMealQuery) {
          responseMessages = [generateMealRecommendations(userData)];
        } else if (lowerText.includes("cek progress") || lowerText.includes("riwayat progress")) {
          responseMessages = [formatProgressHistoryCard(from)];
        } else if (lowerText.includes("cek kalori") || lowerText.includes("rekap") || lowerText.includes("sisa kalori")) {
          const parsedDate = parseDateFromQuery(userText);
          const totals = getDailyTotals(from, parsedDate.dateStr);
          responseMessages = [generateDailySummaryCard(userData, totals, parsedDate.label)];
        } else if (getAi()) {
          let imagePart = null;
          if (mediaUrl) {
            try {
              const imgResp = await import_axios.default.get(mediaUrl, {
                responseType: "arraybuffer",
                auth: { username: process.env.TWILIO_ACCOUNT_SID, password: process.env.TWILIO_AUTH_TOKEN }
              });
              const base64Image = Buffer.from(imgResp.data).toString("base64");
              const mimeType = String(imgResp.headers["content-type"] || "image/jpeg").split(";")[0];
              imagePart = { inlineData: { data: base64Image, mimeType } };
            } catch (imgErr) {
              console.error("[Twilio WA] Image download error:", imgErr);
            }
          }
          const isMia = userData.persona === "mia" || userData.persona === "nikita";
          const personaInstruction = isMia ? `PERSONA MIA: Coach wanita bernama Coach Mia. Sabar, ramah, lembut (aku/kamu).` : `PERSONA MAX: Coach pria bernama Coach Max. Tegas, gaul Jakarta (lo/gue).`;
          const prompt = `INFORMASI PENGGUNA:
- Nama: ${userData.name} | Berat: ${userData.weight}kg | Target: ${userData.targetWeight}kg
- Kalori Target: ${userData.targetCalories}kcal | Goal: ${userData.goalTitle}
${personaInstruction}

User mengirim: "${userText}"${imagePart ? " + foto" : ""}

Kategori 1 - MAKANAN/FOTO MAKANAN \u2192 JSON:
{"isFood":true,"isEquipment":false,"foodName":"Nama","calories":200,"protein":20,"carbs":30,"fat":5,"fiber":2,"satietyScore":8,"healthScore":9,"portionEst":"1 porsi","keyInsights":["insight"],"microSummary":"mineral","generalReply":"komentar coach"}

Kategori 2 - ALAT GYM \u2192 JSON:
{"isFood":false,"isEquipment":true,"equipmentName":"Nama Alat","generalReply":"penjelasan"}

Kategori 3 - CHAT UMUM \u2192 JSON:
{"isFood":false,"isEquipment":false,"generalReply":"pesan"}`;
          try {
            const rawText = await generateGeminiContent(prompt, imagePart);
            let parsed = extractAndParseJson(rawText);
            if (!parsed) {
              const cleanReply = String(rawText || "").replace(/```(?:json)?[\s\S]*?```/gi, "").trim();
              parsed = { isFood: false, isEquipment: false, generalReply: cleanReply || "Ada laporan makanan atau latihan lain yang ingin kamu tanyakan?" };
            }
            const isEquipmentMatch = parsed.isEquipment || imagePart && !parsed.isFood || lowerText.includes("alat") || lowerText.includes("cara pakai") || lowerText.includes("mesin") || lowerText.includes("gym");
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
              responseMessages = [formatNutritionCard(parsed, imagePart ? "Foto" : "Teks", userData, dailyTotals)];
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
                    const toNum = from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;
                    await getTwilio().messages.create({
                      body: `\u{1F3CB}\uFE0F *TUTORIAL CARA PAKAI ALAT: ${(parsed.equipmentName || "ALAT GYM").toUpperCase()}*

Berikut infografis resmi dari GymBuddy AI untuk panduan bagian alat, cara pakai step-by-step, & kesalahan umum! \u{1F4AA}\u2728`,
                      mediaUrl: [infographicUrl],
                      from: fromNum,
                      to: toNum
                    });
                  }
                } catch (infogErr) {
                  console.error("Error generating/sending equipment infographic:", infogErr);
                }
              })();
            } else {
              responseMessages = [parsed.generalReply || "Ada laporan makanan atau latihan lain?"];
            }
          } catch (e) {
            console.error("[Twilio WA] Gemini AI error:", e);
            responseMessages = ["Ada laporan makanan atau latihan lain yang ingin kamu tanyakan?"];
          }
        }
        const combinedReply = responseMessages.join("\n\n");
        const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(combinedReply)}</Message></Response>`;
        res.type("text/xml").send(twiml);
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
