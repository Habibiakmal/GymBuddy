const { MongoClient } = require("mongodb");

async function fixMongoAtlasDoc() {
  const mongoUri = "mongodb+srv://bibi:bibi123@gymbuddy.wb3i2.mongodb.net/gymbuddy?retryWrites=true&w=majority";
  const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db("gymbuddy");

  const bibiProfile = {
    name: "Bibi",
    phone: "085156919826",
    normalizedPhone: "085156919826",
    goal: "health",
    goalTitle: "Gaya Hidup Sehat & Fit",
    weight: 78,
    startWeight: 78,
    targetWeight: 78,
    height: 177,
    age: 24,
    gender: "pria",
    persona: "mia",
    activityLevel: "light",
    targetCalories: 2435,
    proteinGrams: 140,
    carbGrams: 316,
    fatGrams: 68,
    fiberGrams: 32,
    plan: "free_trial",
    selectedPlan: "free_trial",
    feature: "coach",
    activeService: "both",
    updatedAt: new Date().toISOString()
  };

  console.log("1. Updating collection users in MongoDB Atlas...");
  await db.collection("users").updateOne(
    { phone: "085156919826" },
    { $set: bibiProfile },
    { upsert: true }
  );
  await db.collection("users").updateOne(
    { phone: "6285156919826" },
    { $set: { ...bibiProfile, phone: "6285156919826" } },
    { upsert: true }
  );

  console.log("2. Updating collection appdata _id main in MongoDB Atlas...");
  await db.collection("appdata").updateOne(
    { _id: "main" },
    {
      $set: {
        "users.085156919826": bibiProfile,
        "users.6285156919826": { ...bibiProfile, phone: "6285156919826" }
      }
    },
    { upsert: true }
  );

  console.log("✅ Successfully updated MongoDB Atlas users and appdata.main!");
  await client.close();
}

fixMongoAtlasDoc().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
