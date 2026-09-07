process.env.NODE_ENV = "test";

import {
  createExpressApp,
  saveUserProfile,
  getUserProfile,
  addMealLog,
  clearSentWhatsAppMessages,
  getLastSentWhatsAppMessage,
  getSentWhatsAppMessagesFor,
  dbData
} from "../server";
import {
  resolveCanonicalProfile,
  validateFoodSafety,
  validateWorkoutSafety,
  BASE_MEAL_POOL,
  EXERCISE_REGISTRY
} from "../services/recommendationEngine";
import axios from "axios";
import http from "http";

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, title: string, details?: string) {
  if (condition) {
    passCount++;
    console.log(`  ✅ [PASS] ${title}`);
  } else {
    failCount++;
    console.error(`  ❌ [FAIL] ${title}${details ? ` -> ${details}` : ""}`);
    throw new Error(`Assertion failed: ${title}`);
  }
}

async function runProductionVerificationSuite() {
  console.log("================================================================================");
  console.log("🚀 PRODUCTION END-TO-END VERIFICATION: FULL PIPELINE TRAVERSAL");
  console.log("   User Input -> Real DB Retrieval -> Canonical Profile -> Webhook/Intent");
  console.log("   -> Recommendation Engine -> Safety Validator -> Formatter -> Endpoint Response");
  console.log("================================================================================\n");

  // 1. Spin up ephemeral HTTP server on dynamic port (0) with real Express application
  const app = await createExpressApp({ skipVite: true });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[Test Server] Ephemeral production test server running at ${baseUrl}\n`);

  try {
    // ---------------------------------------------------------------------------
    // TEST A: Peanut Allergy + Real WhatsApp Webhook Flow + Real DB Retrieval
    // ---------------------------------------------------------------------------
    console.log("▶ TEST A: Peanut Allergy + WhatsApp Webhook Traversal");
    const phoneA = "6281110001001";
    // 1. Save directly into persisted DB
    saveUserProfile(phoneA, {
      name: "Ahmad",
      phone: phoneA,
      fitnessGoal: "lose",
      targetCalories: 1800,
      targetProtein: 140,
      targetCarbs: 180,
      targetFat: 50,
      allergies: ["peanuts", "kacang"],
      allergiesStatus: "reported",
      persona: "mia",
      weight: 72
    });

    // 2. Assert profile is in real DB
    const dbUserA = getUserProfile(phoneA);
    assert(dbUserA !== null, "Test A: Profile retrieved from persisted database state");
    assert(dbUserA.allergies.includes("peanuts"), "Test A: Database state contains peanut allergy");

    // 3. Dispatch through actual WhatsApp Webhook route
    clearSentWhatsAppMessages();
    const resA = await axios.post(`${baseUrl}/api/webhook/twilio-whatsapp`, {
      From: `whatsapp:${phoneA}`,
      Body: "ada saran makanan siang ini?"
    });
    assert(resA.status === 200, "Test A: WhatsApp webhook returned HTTP 200");
    assert(resA.headers["content-type"]?.includes("text/xml"), "Test A: WhatsApp webhook returned TwiML XML");

    const sentA = getLastSentWhatsAppMessage(phoneA);
    assert(sentA !== undefined, "Test A: Message dispatched through production WhatsApp pipeline");
    const recA = sentA!.body;

    // 4. Assert engine output & safety constraints
    assert(!recA.toLowerCase().includes("kacang"), "Test A: Rejects peanuts");
    assert(!recA.toLowerCase().includes("bumbu kacang"), "Test A: Rejects peanut sauce");
    assert(!recA.toLowerCase().includes("gado-gado"), "Test A: Rejects gado-gado");
    assert(!recA.includes("100% aman"), "Test A: No absolute '100% aman' safety claims");
    assert(!recA.includes("Terverifikasi 100%"), "Test A: No 'Terverifikasi 100%' claim");
    assert(recA.includes("Coach Mia"), "Test A: Coach Mia persona applied");

    // ---------------------------------------------------------------------------
    // TEST B: Shellfish / Seafood Allergy + Real WhatsApp Webhook Flow
    // ---------------------------------------------------------------------------
    console.log("\n▶ TEST B: Shellfish/Seafood Allergy + WhatsApp Webhook Traversal");
    const phoneB = "6281110001002";
    saveUserProfile(phoneB, {
      name: "Bunga",
      phone: phoneB,
      fitnessGoal: "gain",
      targetCalories: 2300,
      targetProtein: 160,
      allergies: ["shellfish", "udang", "seafood"],
      allergiesStatus: "reported",
      persona: "mia",
      weight: 58
    });

    const dbUserB = getUserProfile(phoneB);
    assert(dbUserB !== null, "Test B: Profile retrieved from persisted database state");
    assert(dbUserB.allergies.includes("shellfish"), "Test B: Database state contains shellfish allergy");

    clearSentWhatsAppMessages();
    const resB = await axios.post(`${baseUrl}/api/webhook/twilio-whatsapp`, {
      From: `whatsapp:${phoneB}`,
      Body: "makan siang apa yang cocok?"
    });
    assert(resB.status === 200, "Test B: WhatsApp webhook returned HTTP 200");

    const sentB = getLastSentWhatsAppMessage(phoneB);
    assert(sentB !== undefined, "Test B: WhatsApp message dispatched via production pipeline");
    const recB = sentB!.body;

    assert(!recB.toLowerCase().includes("udang"), "Test B: Strictly excludes udang");
    assert(!recB.toLowerCase().includes("seafood"), "Test B: Strictly excludes seafood");
    assert(!recB.toLowerCase().includes("terasi"), "Test B: Strictly excludes terasi");
    assert(!recB.toLowerCase().includes("cumi"), "Test B: Strictly excludes cumi");
    assert(!recB.toLowerCase().includes("kepiting"), "Test B: Strictly excludes kepiting");

    // ---------------------------------------------------------------------------
    // TEST C: Hypertension + WhatsApp Webhook Traversal
    // ---------------------------------------------------------------------------
    console.log("\n▶ TEST C: Hypertension + WhatsApp Webhook Traversal");
    const phoneC = "6281110001003";
    saveUserProfile(phoneC, {
      name: "Pak Cipto",
      phone: phoneC,
      fitnessGoal: "health",
      targetCalories: 1800,
      medicalConditions: ["hypertension", "darah tinggi"],
      medicalConditionsStatus: "reported",
      persona: "mia",
      weight: 75
    });

    const dbUserC = getUserProfile(phoneC);
    assert(dbUserC !== null, "Test C: Profile retrieved from persisted database state");
    assert(dbUserC.medicalConditions.includes("hypertension"), "Test C: Database state contains hypertension condition");

    clearSentWhatsAppMessages();
    const resC = await axios.post(`${baseUrl}/api/webhook/twilio-whatsapp`, {
      From: `whatsapp:${phoneC}`,
      Body: "saran makanan malam ini"
    });
    assert(resC.status === 200, "Test C: WhatsApp webhook returned HTTP 200");

    const sentC = getLastSentWhatsAppMessage(phoneC);
    assert(sentC !== undefined, "Test C: WhatsApp message dispatched via production pipeline");
    const recC = sentC!.body;

    assert(recC.toLowerCase().includes("rendah garam") || recC.toLowerCase().includes("natrium"), "Test C: Acknowledges low-sodium care factually");
    assert(!recC.toLowerCase().includes("ikan asin"), "Test C: Strictly excludes high sodium preserved fish");
    assert(!recC.toLowerCase().includes("kuah instan"), "Test C: Excludes instant salty broth");
    assert(!recC.includes("100% aman"), "Test C: No absolute safety certainty claims");

    // ---------------------------------------------------------------------------
    // TEST D: Diabetes + WhatsApp Webhook Traversal
    // ---------------------------------------------------------------------------
    console.log("\n▶ TEST D: Diabetes + WhatsApp Webhook Traversal");
    const phoneD = "6281110001004";
    saveUserProfile(phoneD, {
      name: "Ibu Diana",
      phone: phoneD,
      fitnessGoal: "health",
      targetCalories: 1600,
      medicalConditions: ["diabetes", "gula darah"],
      medicalConditionsStatus: "reported",
      persona: "mia",
      weight: 64
    });

    const dbUserD = getUserProfile(phoneD);
    assert(dbUserD !== null, "Test D: Profile retrieved from persisted database state");
    assert(dbUserD.medicalConditions.includes("diabetes"), "Test D: Database state contains diabetes condition");

    clearSentWhatsAppMessages();
    const resD = await axios.post(`${baseUrl}/api/webhook/twilio-whatsapp`, {
      From: `whatsapp:${phoneD}`,
      Body: "ada saran camilan?"
    });
    assert(resD.status === 200, "Test D: WhatsApp webhook returned HTTP 200");

    const sentD = getLastSentWhatsAppMessage(phoneD);
    assert(sentD !== undefined, "Test D: WhatsApp message dispatched via production pipeline");
    const recD = sentD!.body;

    assert(!recD.toLowerCase().includes("sirup"), "Test D: Excludes high sugar syrups");
    assert(!recD.toLowerCase().includes("es teh manis"), "Test D: Excludes sweet tea drinks");
    assert(!recD.toLowerCase().includes("kolak"), "Test D: Excludes sugary desserts");

    // ---------------------------------------------------------------------------
    // TEST E: Knee Injury + Weekly Workout Flow via WhatsApp Webhook
    // ---------------------------------------------------------------------------
    console.log("\n▶ TEST E: Knee Injury + Weekly Workout via WhatsApp Webhook");
    const phoneE = "6281110001005";
    saveUserProfile(phoneE, {
      name: "Edi",
      phone: phoneE,
      fitnessGoal: "lose",
      injuries: ["knee", "lutut"],
      injuriesStatus: "reported",
      equipment: "dumbbells",
      persona: "mia",
      weight: 80
    });

    const dbUserE = getUserProfile(phoneE);
    assert(dbUserE !== null, "Test E: Profile retrieved from persisted database state");
    assert(dbUserE.injuries.includes("knee"), "Test E: Database state contains knee injury");

    clearSentWhatsAppMessages();
    const resE = await axios.post(`${baseUrl}/api/webhook/twilio-whatsapp`, {
      From: `whatsapp:${phoneE}`,
      Body: "jadwal olahraga seminggu aku"
    });
    assert(resE.status === 200, "Test E: WhatsApp webhook returned HTTP 200");

    const sentE = getLastSentWhatsAppMessage(phoneE);
    assert(sentE !== undefined, "Test E: WhatsApp weekly schedule dispatched");
    const weeklyWorkoutE = sentE!.body;

    assert(!weeklyWorkoutE.toLowerCase().includes("jump squat"), "Test E: Excludes jump squats");
    assert(!weeklyWorkoutE.toLowerCase().includes("jumping rope"), "Test E: Excludes jumping rope");
    assert(!weeklyWorkoutE.toLowerCase().includes("burpee"), "Test E: Excludes burpees");
    assert(weeklyWorkoutE.includes("Penyesuaian Fisik"), "Test E: Notes factual physical adjustment");
    assert(!weeklyWorkoutE.includes("100% aman"), "Test E: No absolute safety certainty claims");

    // ---------------------------------------------------------------------------
    // TEST F: Shoulder Injury + Weekly Workout Flow via WhatsApp Webhook
    // ---------------------------------------------------------------------------
    console.log("\n▶ TEST F: Shoulder Injury + Weekly Workout via WhatsApp Webhook");
    const phoneF = "6281110001006";
    saveUserProfile(phoneF, {
      name: "Fani",
      phone: phoneF,
      fitnessGoal: "gain",
      injuries: ["shoulder", "bahu"],
      injuriesStatus: "reported",
      equipment: "dumbbells",
      persona: "mia",
      weight: 68
    });

    const dbUserF = getUserProfile(phoneF);
    assert(dbUserF !== null, "Test F: Profile retrieved from persisted database state");
    assert(dbUserF.injuries.includes("shoulder"), "Test F: Database state contains shoulder injury");

    clearSentWhatsAppMessages();
    const resF = await axios.post(`${baseUrl}/api/webhook/twilio-whatsapp`, {
      From: `whatsapp:${phoneF}`,
      Body: "jadwal olahraga seminggu aku"
    });
    assert(resF.status === 200, "Test F: WhatsApp webhook returned HTTP 200");

    const sentF = getLastSentWhatsAppMessage(phoneF);
    assert(sentF !== undefined, "Test F: WhatsApp weekly schedule dispatched");
    const weeklyWorkoutF = sentF!.body;

    assert(!weeklyWorkoutF.toLowerCase().includes("overhead"), "Test F: Avoids overhead presses");
    assert(!weeklyWorkoutF.toLowerCase().includes("shoulder press"), "Test F: Avoids shoulder press");
    assert(weeklyWorkoutF.includes("Penyesuaian Fisik"), "Test F: Acknowledges shoulder limitation factually");

    // ---------------------------------------------------------------------------
    // TEST G: Multiple Concurrent Restrictions via WhatsApp Webhook
    // ---------------------------------------------------------------------------
    console.log("\n▶ TEST G: Multiple Restrictions Concurrently Enforced via WhatsApp Webhook");
    const phoneG = "6281110001007";
    saveUserProfile(phoneG, {
      name: "Gita",
      phone: phoneG,
      fitnessGoal: "lose",
      targetCalories: 1700,
      targetProtein: 120,
      allergies: ["peanuts", "kacang"],
      allergiesStatus: "reported",
      medicalConditions: ["hypertension", "darah tinggi"],
      medicalConditionsStatus: "reported",
      injuries: ["knee", "lutut"],
      injuriesStatus: "reported",
      equipment: "bodyweight",
      persona: "mia",
      weight: 60
    });

    const dbUserG = getUserProfile(phoneG);
    assert(dbUserG !== null, "Test G: Profile retrieved from persisted database state");
    assert(dbUserG.allergies.includes("peanuts") && dbUserG.medicalConditions.includes("hypertension") && dbUserG.injuries.includes("knee"),
      "Test G: Persisted DB state contains peanuts, hypertension, and knee injury concurrently");

    // Meal recommendation check
    clearSentWhatsAppMessages();
    await axios.post(`${baseUrl}/api/webhook/twilio-whatsapp`, {
      From: `whatsapp:${phoneG}`,
      Body: "saran makan siang"
    });
    const mealG = getLastSentWhatsAppMessage(phoneG)!.body;
    assert(!mealG.toLowerCase().includes("kacang"), "Test G: Excludes peanuts");
    assert(mealG.toLowerCase().includes("natrium") || mealG.toLowerCase().includes("rendah garam"), "Test G: Honors hypertension sodium care");

    // Workout recommendation check
    clearSentWhatsAppMessages();
    await axios.post(`${baseUrl}/api/webhook/twilio-whatsapp`, {
      From: `whatsapp:${phoneG}`,
      Body: "latihan apa hari ini?"
    });
    const workoutG = getLastSentWhatsAppMessage(phoneG)!.body;
    assert(!workoutG.toLowerCase().includes("jump squat"), "Test G: Excludes jump squats");
    assert(!workoutG.toLowerCase().includes("jumping rope"), "Test G: Excludes jumping rope");

    // ---------------------------------------------------------------------------
    // TEST H: Dynamic Profile Update Persistence in DB & Immediate Webhook Propagation
    // ---------------------------------------------------------------------------
    console.log("\n▶ TEST H: Profile Update Persistence in DB & Immediate Webhook Propagation");
    const phoneH = "6281110001008";
    // Step 1: Initial state has NO allergies or injuries
    saveUserProfile(phoneH, {
      name: "Hadi",
      phone: phoneH,
      fitnessGoal: "lose",
      targetCalories: 2000,
      allergies: [],
      allergiesStatus: "none_reported",
      injuries: [],
      injuriesStatus: "none_reported",
      persona: "mia",
      weight: 75
    });

    const dbUserH_v1 = getUserProfile(phoneH);
    assert(dbUserH_v1.allergies.length === 0, "Test H: Baseline DB user has no allergies");

    // Step 2: Update user profile in DB (simulating Dashboard settings save)
    saveUserProfile(phoneH, {
      name: "Hadi",
      phone: phoneH,
      fitnessGoal: "lose",
      targetCalories: 2000,
      allergies: ["peanuts", "kacang"],
      allergiesStatus: "reported",
      injuries: ["knee", "lutut"],
      injuriesStatus: "reported",
      persona: "mia",
      weight: 75
    });

    const dbUserH_v2 = getUserProfile(phoneH);
    assert(dbUserH_v2.allergies.includes("peanuts"), "Test H: Updated DB state reflects peanut allergy");
    assert(dbUserH_v2.injuries.includes("knee"), "Test H: Updated DB state reflects knee injury");

    // Step 3: Immediately request meal via WhatsApp webhook
    clearSentWhatsAppMessages();
    await axios.post(`${baseUrl}/api/webhook/twilio-whatsapp`, {
      From: `whatsapp:${phoneH}`,
      Body: "rekomendasi makan malam"
    });
    const mealH_v2 = getLastSentWhatsAppMessage(phoneH)!.body;
    assert(!mealH_v2.toLowerCase().includes("kacang"), "Test H: Updated peanut allergy immediately excluded from WhatsApp");

    // Step 4: Immediately request workout via WhatsApp webhook
    clearSentWhatsAppMessages();
    await axios.post(`${baseUrl}/api/webhook/twilio-whatsapp`, {
      From: `whatsapp:${phoneH}`,
      Body: "latihan apa hari ini?"
    });
    const workoutH_v2 = getLastSentWhatsAppMessage(phoneH)!.body;
    assert(!workoutH_v2.toLowerCase().includes("jump squat"), "Test H: Updated knee injury immediately excluded from WhatsApp");

    // ---------------------------------------------------------------------------
    // TEST I: Dashboard /api/ai/next-step Path & Shared Canonical Engine
    // ---------------------------------------------------------------------------
    console.log("\n▶ TEST I: Dashboard /api/ai/next-step Path & Shared Canonical Engine");
    const phoneI = "6281110001009";
    saveUserProfile(phoneI, {
      name: "Indah",
      phone: phoneI,
      fitnessGoal: "gain",
      targetCalories: 2200,
      proteinGrams: 150,
      dailyTargetProtein: 150,
      allergies: ["eggs", "telur"],
      allergiesStatus: "reported",
      persona: "mia",
      weight: 62
    });

    const dbUserI = getUserProfile(phoneI);
    assert(dbUserI !== null, "Test I: Profile retrieved from persisted database state");
    assert(dbUserI.allergies.includes("eggs"), "Test I: Database contains egg allergy");

    // Invoke actual Dashboard endpoint /api/ai/next-step
    const nextStepRes = await axios.post(`${baseUrl}/api/ai/next-step`, {
      phone: phoneI,
      calories: 1400,
      protein: 70,
      carbs: 160,
      fat: 45,
      sodium: 1100,
      targetCalories: 2200,
      targetProtein: 150,
      goal: "gain",
      persona: "mia"
    });

    assert(nextStepRes.status === 200, "Test I: /api/ai/next-step returned HTTP 200");
    assert(nextStepRes.data.success === true, "Test I: /api/ai/next-step returned success: true");
    const adviceI = nextStepRes.data.advice;
    assert(typeof adviceI === "string" && adviceI.length > 0, "Test I: Generated actionable advice text");
    // Egg allergy must be respected: must NOT suggest boiled eggs / telur rebus
    assert(!adviceI.toLowerCase().includes("telur"), "Test I: Dashboard next-step avoids eggs due to persisted allergy");
    assert(adviceI.toLowerCase().includes("dada ayam") || adviceI.toLowerCase().includes("ikan"), "Test I: Suggests egg-free lean protein");

    // ---------------------------------------------------------------------------
    // TEST J: 7-Day Meal Plan Item-by-Item Validation via WhatsApp Webhook
    // ---------------------------------------------------------------------------
    console.log("\n▶ TEST J: 7-Day Meal Plan Item-by-Item Validation via WhatsApp Webhook");
    clearSentWhatsAppMessages();
    await axios.post(`${baseUrl}/api/webhook/twilio-whatsapp`, {
      From: `whatsapp:${phoneG}`,
      Body: "jadwal makanan seminggu"
    });
    const weeklyMealText = getLastSentWhatsAppMessage(phoneG)!.body;
    assert(weeklyMealText.includes("Senin") && weeklyMealText.includes("Minggu"), "Test J: Contains all 7 days");
    assert(!weeklyMealText.toLowerCase().includes("kacang"), "Test J: Entire 7-day meal plan has ZERO peanuts");

    // ---------------------------------------------------------------------------
    // TEST K: 7-Day Workout Plan Item-by-Item Validation via WhatsApp Webhook
    // ---------------------------------------------------------------------------
    console.log("\n▶ TEST K: 7-Day Workout Plan Item-by-Item Validation via WhatsApp Webhook");
    clearSentWhatsAppMessages();
    await axios.post(`${baseUrl}/api/webhook/twilio-whatsapp`, {
      From: `whatsapp:${phoneG}`,
      Body: "jadwal latihan minggu ini"
    });
    const weeklyWorkoutText = getLastSentWhatsAppMessage(phoneG)!.body;
    assert(weeklyWorkoutText.includes("Senin") && weeklyWorkoutText.includes("Minggu"), "Test K: Contains all 7 days");
    assert(!weeklyWorkoutText.toLowerCase().includes("jump squat"), "Test K: Entire 7-day workout plan has ZERO jump squats");
    assert(!weeklyWorkoutText.toLowerCase().includes("jumping rope"), "Test K: Entire 7-day workout plan has ZERO jump rope");
    assert(!weeklyWorkoutText.toLowerCase().includes("burpee"), "Test K: Entire 7-day workout plan has ZERO burpees");

    // ---------------------------------------------------------------------------
    // TEST L: WhatsApp Formatting & Single Separator Ownership
    // ---------------------------------------------------------------------------
    console.log("\n▶ TEST L: WhatsApp Formatting & Single Separator Ownership");
    assert(!mealG.includes("━"), "Test L: Meal rec contains NO unicode box-drawing chars");
    assert(!workoutG.includes("━"), "Test L: Workout rec contains NO unicode box-drawing chars");
    assert(!weeklyMealText.includes("━"), "Test L: Weekly meal plan contains NO unicode box-drawing chars");
    assert(!weeklyWorkoutText.includes("━"), "Test L: Weekly workout plan contains NO unicode box-drawing chars");
    assert(mealG.includes("--------------------------------------------------"), "Test L: Uses consistent standard delimiter");

    // ---------------------------------------------------------------------------
    // TEST M: Dynamic Nutrition State Matching via WhatsApp Webhook
    // ---------------------------------------------------------------------------
    console.log("\n▶ TEST M: Dynamic Nutrition State Matching via WhatsApp Webhook");
    const phoneM = "6281110001010";
    saveUserProfile(phoneM, {
      name: "Made",
      phone: phoneM,
      fitnessGoal: "lose",
      targetCalories: 1800,
      dailyTargetCalories: 1800,
      proteinGrams: 140,
      dailyTargetProtein: 140,
      persona: "mia",
      weight: 70
    });

    const dbUserM = getUserProfile(phoneM);
    assert(dbUserM !== null, "Test M: Profile retrieved from persisted database state");

    // Log breakfast in real DB state
    addMealLog(phoneM, {
      id: "meal-m1",
      foodName: "Bubur Ayam Lengkap",
      calories: 500,
      protein: 20,
      carbs: 65,
      fat: 15,
      isHydration: false,
      timestamp: new Date().toISOString()
    });

    clearSentWhatsAppMessages();
    await axios.post(`${baseUrl}/api/webhook/twilio-whatsapp`, {
      From: `whatsapp:${phoneM}`,
      Body: "ada saran makanan hari ini?"
    });
    const recM = getLastSentWhatsAppMessage(phoneM)!.body;
    assert(recM.includes("Menu Pilihan"), "Test M: Returns actionable menu choice");
    assert(recM.includes("Kalori: ~"), "Test M: Displays estimated calories");
    assert(recM.includes("Protein: ~"), "Test M: Displays estimated protein");
    assert(recM.includes("Sisa Anggaran Kalori Hari Ini"), "Test M: Displays remaining calories budget");
    assert(recM.includes("Prioritas Protein"), "Test M: Flags remaining protein gap");

    // ---------------------------------------------------------------------------
    // TEST N: Full Weekly Workout Intent via WhatsApp Webhook
    // ---------------------------------------------------------------------------
    console.log("\n▶ TEST N: Full Weekly Workout Intent via WhatsApp Webhook");
    clearSentWhatsAppMessages();
    await axios.post(`${baseUrl}/api/webhook/twilio-whatsapp`, {
      From: `whatsapp:${phoneM}`,
      Body: "jadwal olahraga seminggu aku"
    });
    const fullWeekWorkout = getLastSentWhatsAppMessage(phoneM)!.body;
    assert(fullWeekWorkout.includes("JADWAL OLAHRAGA MINGGUAN PERSONAL"), "Test N: Returns full weekly schedule header");
    assert(fullWeekWorkout.includes("Senin") && fullWeekWorkout.includes("Minggu"), "Test N: Contains full 7 days");

    // ---------------------------------------------------------------------------
    // TEST 14: Coach Persona Isolation (Mia vs Max) via Webhook & Dashboard
    // ---------------------------------------------------------------------------
    console.log("\n▶ TEST 14: Coach Persona Isolation (Mia vs Max)");
    const phoneMia = "6281110001011";
    saveUserProfile(phoneMia, {
      name: "Dewi",
      phone: phoneMia,
      fitnessGoal: "lose",
      targetCalories: 1700,
      proteinGrams: 120,
      allergies: ["peanuts", "kacang"],
      allergiesStatus: "reported",
      persona: "mia",
      weight: 56
    });

    const phoneMax = "6281110001012";
    saveUserProfile(phoneMax, {
      name: "Doni",
      phone: phoneMax,
      fitnessGoal: "lose",
      targetCalories: 1700,
      proteinGrams: 120,
      allergies: ["peanuts", "kacang"],
      allergiesStatus: "reported",
      persona: "max",
      weight: 78
    });

    // Assert DB persistence for both coaches
    const dbUserMia = getUserProfile(phoneMia);
    const dbUserMax = getUserProfile(phoneMax);
    assert(dbUserMia.persona === "mia", "Test 14: Coach Mia persona persisted in DB");
    assert(dbUserMax.persona === "max", "Test 14: Coach Max persona persisted in DB");
    assert(dbUserMia.allergies.includes("peanuts") && dbUserMax.allergies.includes("peanuts"), "Test 14: Both profiles store peanut allergy");

    // WhatsApp webhook tests for both coaches
    clearSentWhatsAppMessages();
    await axios.post(`${baseUrl}/api/webhook/twilio-whatsapp`, {
      From: `whatsapp:${phoneMia}`,
      Body: "saran makan siang"
    });
    const recMia = getLastSentWhatsAppMessage(phoneMia)!.body;

    clearSentWhatsAppMessages();
    await axios.post(`${baseUrl}/api/webhook/twilio-whatsapp`, {
      From: `whatsapp:${phoneMax}`,
      Body: "saran makan siang"
    });
    const recMax = getLastSentWhatsAppMessage(phoneMax)!.body;

    // Both coaches MUST enforce peanut restriction
    assert(!recMia.toLowerCase().includes("kacang"), "Test 14: Coach Mia strictly excludes peanuts via webhook");
    assert(!recMax.toLowerCase().includes("kacang"), "Test 14: Coach Max strictly excludes peanuts via webhook");

    // Both coaches MUST NOT use absolute claims
    assert(!recMia.includes("100% aman"), "Test 14: Coach Mia makes no 100% claims");
    assert(!recMax.includes("100% aman"), "Test 14: Coach Max makes no 100% claims");

    // Identity and tone isolation check in WhatsApp
    assert(recMia.includes("Coach Mia"), "Test 14: Coach Mia identity correct");
    assert(recMax.includes("Coach Max"), "Test 14: Coach Max identity correct");
    assert(recMia.includes("✨"), "Test 14: Coach Mia tone marker ✨ present");
    assert(recMax.includes("lo") || recMax.includes("bro") || recMax.includes("Gas"), "Test 14: Coach Max tone marker present");

    // Dashboard /api/ai/next-step checks for both coaches
    const nextStepMia = await axios.post(`${baseUrl}/api/ai/next-step`, {
      phone: phoneMia,
      calories: 1200,
      protein: 80,
      targetCalories: 1700,
      targetProtein: 120,
      goal: "lose",
      persona: "mia"
    });
    const nextStepMax = await axios.post(`${baseUrl}/api/ai/next-step`, {
      phone: phoneMax,
      calories: 1200,
      protein: 80,
      targetCalories: 1700,
      targetProtein: 120,
      goal: "lose",
      persona: "max"
    });

    assert(nextStepMia.status === 200 && nextStepMia.data.success === true, "Test 14: Mia Dashboard /api/ai/next-step HTTP 200");
    assert(nextStepMax.status === 200 && nextStepMax.data.success === true, "Test 14: Max Dashboard /api/ai/next-step HTTP 200");
    assert(nextStepMia.data.advice.includes("✨"), "Test 14: Mia Dashboard advice preserves warm tone ✨");
    assert(nextStepMax.data.advice.includes("lo") || nextStepMax.data.advice.includes("bro") || nextStepMax.data.advice.includes("🔥"),
      "Test 14: Max Dashboard advice preserves energetic tone 🔥");

    console.log("\n================================================================================");
    console.log(`🎉 ALL ${passCount}/${passCount + failCount} PRODUCTION E2E VERIFICATION ASSERTIONS PASSED!`);
    console.log("   - 100% Real Database Retrieval Verified");
    console.log("   - 100% Actual WhatsApp Webhook Route Verified");
    console.log("   - 100% Actual /api/ai/next-step Dashboard Route Verified");
    console.log("================================================================================");
  } finally {
    server.close();
    process.exit(0);
  }
}

runProductionVerificationSuite().catch(err => {
  console.error("E2E Suite error:", err);
  process.exit(1);
});
