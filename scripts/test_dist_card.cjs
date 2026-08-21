/**
 * Test the compiled dist/server.cjs card generator with embedded fonts
 * (simulates exactly what Cloud Run runs)
 */
const { generateNutritionCardPng } = require('../dist/server.cjs');
const fs = require('fs');
const path = require('path');

async function main() {
  try {
    console.log('Testing embedded-font card generation from dist/server.cjs...');
    const png = await generateNutritionCardPng({
      foodName: 'Bakso Sapi Kuah',
      calories: 450,
      protein: 22,
      carbs: 48,
      fat: 18,
      mealType: 'Makan Siang',
      dailyTargetCalories: 2054,
      consumedTodayCalories: 450,
      dailyTargetProtein: 150,
      dailyTargetCarbs: 250,
      dailyTargetFat: 65,
      insight: 'Makanan ini cukup bernutrisi. Bagus untuk otot!'
    });
    const outPath = path.join(__dirname, '..', 'dist_font_test.png');
    fs.writeFileSync(outPath, png);
    console.log(`SUCCESS! PNG size: ${png.length} bytes -> ${outPath}`);
  } catch (e) {
    console.error('ERROR:', e.message);
  }
}
main();
