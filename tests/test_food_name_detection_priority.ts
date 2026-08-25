import { resolveCleanFoodNameAndMealType } from "../server";

console.log("=== RUNNING FOOD DETECTION NAME PRIORITY TEST SUITE ===\n");

const testCases = [
  {
    desc: "Photo + caption 'aku makan snack ini' with detection 'Cookie Cafe'",
    userText: "aku makan snack ini",
    detectedName: "Cookie Cafe",
    hasImage: true,
    expectedFoodName: "Cookie Cafe",
    expectedMealType: "Snack"
  },
  {
    desc: "Photo + caption 'aku makan ini untuk sarapan' with detection 'Sub Sandwich with Pastrami, Cheese & Vegetables'",
    userText: "aku makan ini untuk sarapan",
    detectedName: "Sub Sandwich with Pastrami, Cheese & Vegetables",
    hasImage: true,
    expectedFoodName: "Sub Sandwich with Pastrami, Cheese & Vegetables",
    expectedMealType: "Breakfast"
  },
  {
    desc: "Photo + caption 'ini makanan saya' with detection 'Nasi Padang Ayam Bakar'",
    userText: "ini makanan saya",
    detectedName: "Nasi Padang Ayam Bakar",
    hasImage: true,
    expectedFoodName: "Nasi Padang Ayam Bakar",
    expectedMealTypeCheck: (t: string) => ["Breakfast", "Lunch", "Dinner", "Snack"].includes(t)
  },
  {
    desc: "Photo + caption 'aku makan ini' with detection 'Ayam Geprek Sambal Bawang'",
    userText: "aku makan ini",
    detectedName: "Ayam Geprek Sambal Bawang",
    hasImage: true,
    expectedFoodName: "Ayam Geprek Sambal Bawang",
    expectedMealTypeCheck: (t: string) => ["Breakfast", "Lunch", "Dinner", "Snack"].includes(t)
  },
  {
    desc: "Text-only 'aku makan nasi goreng untuk sarapan'",
    userText: "aku makan nasi goreng untuk sarapan",
    detectedName: "",
    hasImage: false,
    expectedFoodName: "nasi goreng",
    expectedMealType: "Breakfast"
  },
  {
    desc: "Text-only 'ngemil pisang goreng'",
    userText: "ngemil pisang goreng",
    detectedName: "",
    hasImage: false,
    expectedFoodName: "pisang goreng",
    expectedMealType: "Snack"
  },
  {
    desc: "Photo with generic caption 'aku makan ini' and empty detection",
    userText: "aku makan ini",
    detectedName: "",
    hasImage: true,
    expectedFoodName: "Estimasi Makanan",
    expectedMealTypeCheck: (t: string) => Boolean(t)
  }
];

let allPassed = true;

testCases.forEach((tc, idx) => {
  const result = resolveCleanFoodNameAndMealType(tc.userText, tc.detectedName, tc.hasImage);
  console.log(`[TEST ${idx + 1}] ${tc.desc}`);
  console.log(`  - Input userText: "${tc.userText}"`);
  console.log(`  - Detected name: "${tc.detectedName}"`);
  console.log(`  - Result foodName: "${result.foodName}"`);
  console.log(`  - Result mealType: "${result.mealType}"`);

  let namePass = false;
  if (tc.expectedFoodName) {
    namePass = result.foodName.toLowerCase() === tc.expectedFoodName.toLowerCase();
  }
  if (!namePass) {
    console.error(`  ❌ FAILED: Expected foodName "${tc.expectedFoodName}", got "${result.foodName}"`);
    allPassed = false;
  } else {
    console.log(`  ✅ foodName correctly resolved!`);
  }

  let mealTypePass = false;
  if (tc.expectedMealType) {
    mealTypePass = result.mealType.toLowerCase() === tc.expectedMealType.toLowerCase();
  } else if (tc.expectedMealTypeCheck) {
    mealTypePass = tc.expectedMealTypeCheck(result.mealType);
  }
  if (!mealTypePass) {
    console.error(`  ❌ FAILED: Expected mealType "${tc.expectedMealType}", got "${result.mealType}"`);
    allPassed = false;
  } else {
    console.log(`  ✅ mealType correctly resolved!`);
  }

  // Strict check: User raw conversational caption MUST NEVER be the foodName
  const forbiddenCaptions = ["aku makan ini untuk sarapan", "aku makan snack ini", "aku makan ini", "ini makanan saya"];
  if (forbiddenCaptions.includes(result.foodName.toLowerCase())) {
    console.error(`  ❌ CRITICAL FAILURE: Raw user caption leaked into foodName!`);
    allPassed = false;
  }

  console.log("");
});

if (!allPassed) {
  console.error("❌ SOME TESTS FAILED!");
  process.exit(1);
} else {
  console.log("🎉 ALL FOOD DETECTION NAME PRIORITY TESTS PASSED 100%!");
}
