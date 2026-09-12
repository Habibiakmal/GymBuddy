import { applyTargetedMealCorrection } from "../services/nutritionEngine";
import { parseMealCorrectionDetails } from "../services/intentClassifier";

const mockMeal = {
  id: "meal-kue-test",
  foodName: "Kue Jeruk, Kue Talas, Pudding Dessert",
  calories: 600,
  protein: 10,
  carbs: 80,
  fat: 20,
  fiber: 4,
  sugar: 30,
  sodium: 100,
  components: [
    {
      name: "Kue Jeruk",
      portion: "1 porsi (70g)",
      weightGrams: 70,
      calories: 200,
      protein: 3,
      carbs: 30,
      fat: 8,
      fiber: 1,
      sugar: 10,
      sodium: 30
    },
    {
      name: "Kue Talas",
      portion: "1 potong (35g)",
      weightGrams: 35,
      calories: 150,
      protein: 2,
      carbs: 20,
      fat: 5,
      fiber: 1,
      sugar: 8,
      sodium: 20
    },
    {
      name: "Pudding Dessert",
      portion: "1 porsi (80g)",
      weightGrams: 80,
      calories: 250,
      protein: 5,
      carbs: 30,
      fat: 7,
      fiber: 2,
      sugar: 12,
      sodium: 50
    }
  ]
};

const userText = "kue jeruk setengah, kue talas 1, pudding dessert juga setengah";
console.log("Input:", userText);

const details = parseMealCorrectionDetails(userText, mockMeal);
console.log("Parsed details:", details);

const res = applyTargetedMealCorrection(mockMeal, userText, { name: "Budi", persona: "mia" });
console.log("Correction result:");
console.log("- isAmbiguous:", res.isAmbiguous);
console.log("- isCorrection:", res.isCorrection);
console.log("- calories:", res.calories);
console.log("- coachComment:", res.coachComment);
console.log("- components:");
res.components.forEach(c => {
  console.log(`  * ${c.name}: ${c.portion} (~${c.calories} kcal) [isUpdated: ${c.isUpdated}]`);
});

// Assertions:
if (res.isAmbiguous) {
  console.error("FAIL: Result is ambiguous!");
  process.exit(1);
}
// Kue Jeruk: 200 * 0.5 = 100
// Kue Talas: 150 * 1.0 = 150
// Pudding Dessert: 250 * 0.5 = 125
// Total: 375 kcal
const expectedCalories = 100 + 150 + 125;
if (res.calories !== expectedCalories) {
  console.error(`FAIL: Calories expected ${expectedCalories}, got ${res.calories}`);
  process.exit(1);
}

console.log("SUCCESS! Multi-item correction passed with exact calorie calculation and no ambiguity.");
