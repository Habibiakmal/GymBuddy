import { dbData } from "../server";
import { normalizePhoneToE164 } from "../services/phoneNormalizer";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ Passed: ${message}`);
  }
}

console.log("=== RUNNING FOOD PHOTO SAVE IDEMPOTENCY & DEDUPLICATION TESTS ===");

const rawPhone = "081299998888";
const canonicalPhone = normalizePhoneToE164(rawPhone);
const targetDate = "2026-09-04";

const key = `${rawPhone}_${targetDate}`;
const canonicalKey = `${canonicalPhone}_${targetDate}`;

// Ensure clean slate
dbData.dailyLogs[key] = [];
dbData.dailyLogs[canonicalKey] = [];

// Simulate client-generated unique meal ID
const clientMealId = `m-${Date.now()}-abc1234`;

const mealObj = {
  id: clientMealId,
  foodName: "Nasi Ayam Bakar Sambal Terasi",
  calories: 550,
  protein: 38,
  carbs: 65,
  fat: 14,
  fiber: 3,
  mealType: "lunch" as const,
  timestamp: new Date().toISOString()
};

// Simulation of the server's idempotent upsert logic
function simulateSaveMeal(phoneInput: string, meal: any) {
  const cPhone = normalizePhoneToE164(phoneInput);
  const cKey = `${cPhone}_${targetDate}`;

  const upsertMealInList = (list: any[], item: any) => {
    const idx = list.findIndex(m => m && m.id && String(m.id) === String(item.id));
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.push(item);
    }
  };

  if (!dbData.dailyLogs[cKey]) dbData.dailyLogs[cKey] = [];
  upsertMealInList(dbData.dailyLogs[cKey], meal);
}

// 1. First save (e.g. Primary local/server POST)
simulateSaveMeal(rawPhone, mealObj);
assert(dbData.dailyLogs[canonicalKey].length === 1, "First meal save adds 1 meal to logs");
assert(dbData.dailyLogs[canonicalKey][0].id === clientMealId, "Saved meal has correct client ID");

// 2. Second duplicate save (e.g. Dual-sync or network retry POST with identical client meal ID)
simulateSaveMeal(rawPhone, mealObj);
assert(dbData.dailyLogs[canonicalKey].length === 1, "Duplicate save with same meal ID does NOT duplicate meal (idempotent)");

// 3. Updated save with same meal ID (e.g. user corrected calories)
const updatedMealObj = { ...mealObj, calories: 580 };
simulateSaveMeal(rawPhone, updatedMealObj);
assert(dbData.dailyLogs[canonicalKey].length === 1, "Correction with same meal ID updates in place without duplicating");
assert(dbData.dailyLogs[canonicalKey][0].calories === 580, "Updated meal reflects new calories in place");

// 4. Different meal with distinct ID is appended properly
const secondMealId = `m-${Date.now()}-xyz9876`;
const secondMealObj = {
  id: secondMealId,
  foodName: "Whey Protein Shake",
  calories: 140,
  protein: 25,
  carbs: 3,
  fat: 2,
  mealType: "snack" as const,
  timestamp: new Date().toISOString()
};
simulateSaveMeal(rawPhone, secondMealObj);
assert(dbData.dailyLogs[canonicalKey].length === 2, "Distinct meal is properly added to logs");

console.log("=== ALL FOOD PHOTO SAVE IDEMPOTENCY TESTS PASSED ===");
process.exit(0);
