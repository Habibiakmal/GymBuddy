import {
  classifyMealType,
  isSmartSnack,
  getMealTypeFromTimeWindow,
  getMealTypeLabel
} from "../services/mealClassifier";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ Passed: ${message}`);
  }
}

console.log("=== RUNNING MEAL TIME & SMART SNACK CLASSIFICATION TESTS ===");

// 1. Time window classifications for full meals
assert(getMealTypeFromTimeWindow("08:30") === "breakfast", "08:30 is breakfast window");
assert(getMealTypeFromTimeWindow("12:45") === "lunch", "12:45 is lunch window");
assert(getMealTypeFromTimeWindow("19:35") === "dinner", "19:35 is dinner window");
assert(getMealTypeFromTimeWindow("23:15") === "snack", "23:15 is snack/late meal window");
assert(getMealTypeFromTimeWindow("03:30") === "snack", "03:30 is snack/late meal window");

// 2. Labels
assert(getMealTypeLabel("breakfast", "ID") === "SARAPAN", "breakfast label ID is SARAPAN");
assert(getMealTypeLabel("lunch", "ID") === "MAKAN SIANG", "lunch label ID is MAKAN SIANG");
assert(getMealTypeLabel("dinner", "ID") === "MAKAN MALAM", "dinner label ID is MAKAN MALAM");
assert(getMealTypeLabel("snack", "ID", "23:30") === "SNACK / LATE MEAL", "late snack label ID is SNACK / LATE MEAL");
assert(getMealTypeLabel("snack", "ID", "15:30") === "SNACK", "daytime snack label ID is SNACK");

// 3. Full / heavy meals obey time windows
const nasiPadangEvening = classifyMealType({
  foodName: "Nasi Padang Rendang & Sayur Nangka",
  timeOrDate: "19:35",
  calories: 680
});
assert(nasiPadangEvening === "dinner", "Nasi Padang at 19:35 is classified as dinner");

const ayamBakarNoon = classifyMealType({
  foodName: "Ayam Bakar Dada & Nasi Merah",
  timeOrDate: "12:30",
  calories: 520
});
assert(ayamBakarNoon === "lunch", "Ayam bakar at 12:30 is classified as lunch");

const buburAyamMorning = classifyMealType({
  foodName: "Bubur Ayam Komplit",
  timeOrDate: "07:15",
  calories: 380
});
assert(buburAyamMorning === "breakfast", "Bubur ayam at 07:15 is classified as breakfast");

// 4. Smart Snack override (Rule 7: Chiki, chips, crackers, chocolate, standalone eggs at any time are SNACK)
const chikiEvening = classifyMealType({
  foodName: "Chiki Balls Keju",
  timeOrDate: "19:35",
  calories: 140
});
assert(chikiEvening === "snack", "Chiki Balls at 19:35 is SMART SNACK (not dinner)");

const telurRebusEvening = classifyMealType({
  foodName: "2 butir telur rebus",
  timeOrDate: "19:35",
  calories: 155
});
assert(telurRebusEvening === "snack", "2 butir telur rebus at 19:35 is SMART SNACK (not dinner)");

const keripikAfternoon = classifyMealType({
  foodName: "Keripik Singkong Balado",
  timeOrDate: "13:00",
  calories: 220
});
assert(keripikAfternoon === "snack", "Keripik singkong at 13:00 is SMART SNACK (not lunch)");

const apelMorning = classifyMealType({
  foodName: "1 buah apel fuji",
  timeOrDate: "09:00",
  calories: 80
});
assert(apelMorning === "snack", "Standalone fruit at 09:00 is SMART SNACK (not breakfast)");

// 5. User explicit intent override
const pisangSarapan = classifyMealType({
  foodName: "Pisang Cavendish",
  userText: "makan pisang untuk sarapan pagi",
  timeOrDate: "14:00"
});
assert(pisangSarapan === "breakfast", "Explicit intent 'sarapan' overrides snack/lunch to breakfast");

const saladDinner = classifyMealType({
  foodName: "Salad Buah",
  userText: "buat makan malam ya coach",
  timeOrDate: "11:00"
});
assert(saladDinner === "dinner", "Explicit intent 'makan malam' overrides to dinner");

console.log("🎉 ALL MEAL CLASSIFIER TESTS PASSED SUCCESSFULLY!");
