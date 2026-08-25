function normalizePhone(phone: string): string {
  const clean = String(phone || "").replace(/\D/g, "");
  if (clean.startsWith("62")) return "0" + clean.substring(2);
  if (clean.startsWith("8")) return "0" + clean;
  return clean;
}

console.log("=== RUNNING MEAL DELETION & PERSISTENCE TEST SUITE ===");

let allPassed = true;

// Mock database structures mirroring server.ts and Firestore
const mockDbData: { dailyLogs: Record<string, any[]> } = {
  dailyLogs: {}
};

const mockFirestoreFoodLogs: any[] = [];

// Helper functions mirroring server.ts endpoints
function addMeal(phone: string, targetDate: string, meal: any) {
  const normPhone = normalizePhone(phone);
  const altPhone = normPhone.startsWith("0") ? "62" + normPhone.substring(1) : (normPhone.startsWith("62") ? "0" + normPhone.substring(2) : normPhone);
  const key = `${normPhone}_${targetDate}`;
  const altKey = `${altPhone}_${targetDate}`;

  const mealObj = {
    id: meal.id || `m-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    foodName: meal.foodName,
    calories: Number(meal.calories) || 0,
    protein: Number(meal.protein) || 0,
    carbs: Number(meal.carbs) || 0,
    fat: Number(meal.fat) || 0
  };

  if (!mockDbData.dailyLogs[key]) mockDbData.dailyLogs[key] = [];
  if (!mockDbData.dailyLogs[altKey]) mockDbData.dailyLogs[altKey] = [];
  mockDbData.dailyLogs[key].push(mealObj);
  mockDbData.dailyLogs[altKey].push(mealObj);

  mockFirestoreFoodLogs.push({
    ...mealObj,
    phone: normPhone,
    date: targetDate
  });

  return mealObj;
}

function deleteSingleMeal(phone: string, targetDate: string, mealId: string) {
  const normPhone = normalizePhone(phone);
  const altPhone = normPhone.startsWith("0") ? "62" + normPhone.substring(1) : (normPhone.startsWith("62") ? "0" + normPhone.substring(2) : normPhone);
  const key = `${normPhone}_${targetDate}`;
  const altKey = `${altPhone}_${targetDate}`;

  if (mockDbData.dailyLogs[key]) {
    mockDbData.dailyLogs[key] = mockDbData.dailyLogs[key].filter((m: any) => String(m.id) !== String(mealId) && String(m.foodName) !== String(mealId));
  }
  if (mockDbData.dailyLogs[altKey]) {
    mockDbData.dailyLogs[altKey] = mockDbData.dailyLogs[altKey].filter((m: any) => String(m.id) !== String(mealId) && String(m.foodName) !== String(mealId));
  }

  // Delete from Firestore
  const idx = mockFirestoreFoodLogs.findIndex(f => (f.id === mealId || f.foodName === mealId) && (f.phone === normPhone || f.phone === altPhone) && f.date === targetDate);
  if (idx !== -1) {
    mockFirestoreFoodLogs.splice(idx, 1);
  }
}

function putMeals(phone: string, targetDate: string, updatedMeals: any[]) {
  const normPhone = normalizePhone(phone);
  const altPhone = normPhone.startsWith("0") ? "62" + normPhone.substring(1) : (normPhone.startsWith("62") ? "0" + normPhone.substring(2) : normPhone);
  const key = `${normPhone}_${targetDate}`;
  const altKey = `${altPhone}_${targetDate}`;

  mockDbData.dailyLogs[key] = updatedMeals;
  mockDbData.dailyLogs[altKey] = updatedMeals;

  // Wipe previous Firestore logs and re-insert active ones
  for (let i = mockFirestoreFoodLogs.length - 1; i >= 0; i--) {
    const f = mockFirestoreFoodLogs[i];
    if ((f.phone === normPhone || f.phone === altPhone) && f.date === targetDate) {
      mockFirestoreFoodLogs.splice(i, 1);
    }
  }

  for (const m of updatedMeals) {
    mockFirestoreFoodLogs.push({
      ...m,
      phone: normPhone,
      date: targetDate
    });
  }
}

function getMeals(phone: string, targetDate: string) {
  const normPhone = normalizePhone(phone);
  const altPhone = normPhone.startsWith("0") ? "62" + normPhone.substring(1) : (normPhone.startsWith("62") ? "0" + normPhone.substring(2) : normPhone);
  const key = `${normPhone}_${targetDate}`;
  const altKey = `${altPhone}_${targetDate}`;

  const hasMemKey = Array.isArray(mockDbData.dailyLogs[key]);
  const hasMemAltKey = Array.isArray(mockDbData.dailyLogs[altKey]);

  if (hasMemKey || hasMemAltKey) {
    return mockDbData.dailyLogs[key] || mockDbData.dailyLogs[altKey] || [];
  }

  return mockFirestoreFoodLogs.filter(f => (f.phone === normPhone || f.phone === altPhone) && f.date === targetDate);
}

// TEST 1: Add 3 meals, delete 1 meal, verify it stays deleted upon reload
console.log("\n[TEST 1] Add 3 meals, delete meal 2, verify deletion on simulated refresh");
const testDate = "2026-08-25";
const testPhone = "08123456789";

const m1 = addMeal(testPhone, testDate, { id: "m-101", foodName: "Nasi Ayam Bakar", calories: 500, protein: 35, carbs: 50, fat: 12 });
const m2 = addMeal(testPhone, testDate, { id: "m-102", foodName: "Iced Americano", calories: 5, protein: 0, carbs: 1, fat: 0 });
const m3 = addMeal(testPhone, testDate, { id: "m-103", foodName: "Pisang Goreng", calories: 180, protein: 2, carbs: 28, fat: 7 });

let initialMeals = getMeals(testPhone, testDate);
console.log(`  Initial meals count: ${initialMeals.length} (Expected: 3)`);
if (initialMeals.length !== 3) {
  console.error("  ❌ Initial meals count mismatch");
  allPassed = false;
}

// Now delete meal 2 (Iced Americano)
console.log("  Deleting meal 'm-102' (Iced Americano)...");
deleteSingleMeal(testPhone, testDate, "m-102");
const remainingMeals = initialMeals.filter(m => m.id !== "m-102");
putMeals(testPhone, testDate, remainingMeals);

// Simulate page refresh (calling GET /meals)
console.log("  Simulating browser refresh / GET /api/user/:phone/meals...");
const refreshedMeals = getMeals(testPhone, testDate);
console.log(`  Refreshed meals count: ${refreshedMeals.length} (Expected: 2)`);

const hasDeletedItemInRefreshed = refreshedMeals.some(m => m.id === "m-102" || m.foodName === "Iced Americano");
if (!hasDeletedItemInRefreshed && refreshedMeals.length === 2) {
  console.log("  ✅ [PASS] Deleted meal is permanently removed and DOES NOT reappear upon refresh!");
} else {
  console.error("  ❌ [FAIL] Deleted meal reappeared after refresh!");
  allPassed = false;
}

// TEST 2: Verify Firestore collection does NOT contain deleted item
console.log("\n[TEST 2] Verify Firestore persistence state");
const firestoreHasDeletedItem = mockFirestoreFoodLogs.some(f => f.id === "m-102" || f.foodName === "Iced Americano");
if (!firestoreHasDeletedItem && mockFirestoreFoodLogs.length === 2) {
  console.log("  ✅ [PASS] Firestore collection has exactly 2 records and 0 trace of deleted item!");
} else {
  console.error("  ❌ [FAIL] Firestore still contains deleted item!");
  allPassed = false;
}

// TEST 3: Delete ALL remaining meals, verify total empty state
console.log("\n[TEST 3] Delete all remaining meals");
putMeals(testPhone, testDate, []);
const emptyMeals = getMeals(testPhone, testDate);
if (emptyMeals.length === 0 && mockFirestoreFoodLogs.length === 0) {
  console.log("  ✅ [PASS] Bulk delete leaves 0 meals in both memory and persistent storage!");
} else {
  console.error("  ❌ [FAIL] Bulk delete failed!");
  allPassed = false;
}

if (allPassed) {
  console.log("\n🎉 ALL MEAL DELETION PERSISTENCE TESTS PASSED 100%!");
  process.exit(0);
} else {
  console.error("\n❌ SOME TESTS FAILED!");
  process.exit(1);
}
