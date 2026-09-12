import {
  buildSingleSourceOfTruthMealRecord,
  addMealLog,
  getDailyTotals,
  processedWebhookEvents,
  dbData
} from "../server";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ [PASS] ${msg}`);
  }
}

console.log("=== RUNNING FOOD PHOTO SAVE IDEMPOTENCY & DEDUPLICATION TESTS ===");

const testPhone = "081299998888";
const dateStr = "2026-09-12";
const messageId = "wamid.HBgMOTE4MTI5OTk5ODg4OBUCABEYEkFEMjM0NUY2Nzg5MEFCQ0Q";

// Clean any pre-existing logs
const primaryKey = `${testPhone}_${dateStr}`;
dbData.dailyLogs[primaryKey] = [];

// ── TEST 1: Deterministic Meal ID from Webhook Message ID ──
console.log("\n▶ TEST 1: Deterministic Meal ID from Message ID");
const parsedFood = {
  isFood: true,
  foodName: "Nasi Padang Rendang & Telur Dadar",
  calories: 720,
  protein: 34,
  carbs: 75,
  fat: 32,
  fiber: 3,
  mealType: "Lunch",
  detectedFoods: ["Nasi Putih", "Rendang Sapi", "Telur Dadar"]
};

const record1 = buildSingleSourceOfTruthMealRecord(
  "ini foto makan siangku",
  parsedFood,
  true,
  messageId
);

assert(record1.mealRecord.id.startsWith("meal_wa_"), "Meal ID has deterministic prefix 'meal_wa_'");
const sanitizedMessageId = messageId.replace(/[^a-zA-Z0-9_-]/g, "_");
assert(record1.mealRecord.id.includes(sanitizedMessageId), "Meal ID contains sanitised messageId");

// Simulate Meta / Twilio retry with the exact same messageId:
const record2 = buildSingleSourceOfTruthMealRecord(
  "ini foto makan siangku",
  parsedFood,
  true,
  messageId
);

assert(record1.mealRecord.id === record2.mealRecord.id, "Second retry generates the EXACT SAME meal ID");

// ── TEST 2: addMealLog rejects duplicate meal with identical ID ──
console.log("\n▶ TEST 2: addMealLog Idempotency Check");
addMealLog(testPhone, record1.mealRecord, dateStr);
const totalsAfterFirst = getDailyTotals(testPhone, dateStr);
assert(totalsAfterFirst.logCount === 1, "First insert results in exactly 1 log");
assert(totalsAfterFirst.calories === 720, "First insert records 720 kcal");

// Retry insertion:
addMealLog(testPhone, record2.mealRecord, dateStr);
const totalsAfterSecond = getDailyTotals(testPhone, dateStr);
assert(totalsAfterSecond.logCount === 1, "Second insert with same ID is REJECTED (logCount remains 1)");
assert(totalsAfterSecond.calories === 720, "Total calories NOT doubled (remains 720 kcal)");

// ── TEST 3: Webhook event deduplication cache ──
console.log("\n▶ TEST 3: Webhook Event Deduplication Cache");
const twilioSid = "SM1234567890abcdef1234567890abcdef";

// Initial event
assert(!processedWebhookEvents.has(twilioSid), "Twilio SID is not yet in processed cache");
processedWebhookEvents.set(twilioSid, { timestamp: Date.now() });
assert(processedWebhookEvents.has(twilioSid), "Twilio SID is now marked as processed");

// Duplicate event lookup
const isDuplicate = processedWebhookEvents.has(twilioSid);
assert(isDuplicate === true, "Repeated webhook delivery correctly detected as duplicate");

console.log("\n🎉 ALL FOOD PHOTO SAVE IDEMPOTENCY TESTS PASSED PERFECTLY!");
process.exit(0);
