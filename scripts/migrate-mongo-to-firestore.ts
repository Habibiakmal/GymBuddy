import { MongoClient } from "mongodb";
import { getFirestore } from "../services/firestore";
import "dotenv/config";

async function runMigration() {
  console.log("==========================================================");
  console.log("GYMBUDDY: MONGODB ATLAS TO GOOGLE CLOUD FIRESTORE MIGRATION");
  console.log("==========================================================\n");

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("❌ MONGODB_URI environment variable is missing.");
    process.exit(1);
  }

  const mongoClient = new MongoClient(mongoUri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
  });

  await mongoClient.connect();
  const mongoDb = mongoClient.db("gymbuddy");
  console.log("✓ Connected to MongoDB Atlas (Source Database)");

  const firestore = getFirestore();
  if (!firestore) {
    console.error("❌ Could not initialize Google Cloud Firestore.");
    await mongoClient.close();
    process.exit(1);
  }
  console.log("✓ Connected to Google Cloud Firestore (Target Database)\n");

  const stats = {
    users: { mongo: 0, firestore: 0 },
    subscriptions: { mongo: 0, firestore: 0 },
    foodLogs: { mongo: 0, firestore: 0 },
    waterLogs: { mongo: 0, firestore: 0 },
    workoutLogs: { mongo: 0, firestore: 0 },
    aiUsage: { mongo: 0, firestore: 0 },
  };

  // 1. Migrate Users
  try {
    const users = await mongoDb.collection("users").find({}).toArray();
    stats.users.mongo = users.length;
    console.log(`[Users] Migrating ${users.length} user documents...`);

    for (const u of users) {
      const docId = u.userId || `usr_${u.phone}`;
      const { _id, ...userData } = u as any;
      await firestore.collection("users").doc(docId).set({
        ...userData,
        userId: docId,
        createdAt: userData.createdAt ? new Date(userData.createdAt) : new Date(),
        updatedAt: userData.updatedAt ? new Date(userData.updatedAt) : new Date()
      }, { merge: true });
      stats.users.firestore++;
    }
    console.log(`✓ [Users] Successfully migrated ${stats.users.firestore} / ${stats.users.mongo} documents.`);
  } catch (e: any) {
    console.error("❌ Error migrating users:", e.message);
  }

  // 2. Migrate Subscriptions
  try {
    const subscriptions = await mongoDb.collection("subscriptions").find({}).toArray();
    stats.subscriptions.mongo = subscriptions.length;
    console.log(`[Subscriptions] Migrating ${subscriptions.length} subscription documents...`);

    for (const s of subscriptions) {
      const docId = s.userId || `usr_${s.phone}`;
      const { _id, ...subData } = s as any;
      await firestore.collection("subscriptions").doc(docId).set({
        ...subData,
        startedAt: subData.startedAt ? new Date(subData.startedAt) : new Date(),
        expiresAt: subData.expiresAt ? new Date(subData.expiresAt) : new Date(Date.now() + 30 * 24 * 3600 * 1000),
        updatedAt: new Date()
      }, { merge: true });
      stats.subscriptions.firestore++;
    }
    console.log(`✓ [Subscriptions] Successfully migrated ${stats.subscriptions.firestore} / ${stats.subscriptions.mongo} documents.`);
  } catch (e: any) {
    console.error("❌ Error migrating subscriptions:", e.message);
  }

  // 3. Migrate Food Logs
  try {
    const foodLogs = await mongoDb.collection("foodLogs").find({}).toArray();
    stats.foodLogs.mongo = foodLogs.length;
    console.log(`[FoodLogs] Migrating ${foodLogs.length} meal log documents...`);

    for (const f of foodLogs) {
      const docId = f.id || `m_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const { _id, ...foodData } = f as any;
      await firestore.collection("foodLogs").doc(docId).set({
        ...foodData,
        id: docId,
        createdAt: foodData.createdAt ? new Date(foodData.createdAt) : new Date()
      }, { merge: true });
      stats.foodLogs.firestore++;
    }
    console.log(`✓ [FoodLogs] Successfully migrated ${stats.foodLogs.firestore} / ${stats.foodLogs.mongo} documents.`);
  } catch (e: any) {
    console.error("❌ Error migrating food logs:", e.message);
  }

  // 4. Migrate Water Logs
  try {
    const waterLogs = await mongoDb.collection("waterLogs").find({}).toArray();
    stats.waterLogs.mongo = waterLogs.length;
    console.log(`[WaterLogs] Migrating ${waterLogs.length} water log documents...`);

    for (const w of waterLogs) {
      const docId = `${w.phone}_${w.date}`;
      const { _id, ...waterData } = w as any;
      await firestore.collection("waterLogs").doc(docId).set({
        ...waterData,
        updatedAt: waterData.updatedAt ? new Date(waterData.updatedAt) : new Date()
      }, { merge: true });
      stats.waterLogs.firestore++;
    }
    console.log(`✓ [WaterLogs] Successfully migrated ${stats.waterLogs.firestore} / ${stats.waterLogs.mongo} documents.`);
  } catch (e: any) {
    console.error("❌ Error migrating water logs:", e.message);
  }

  // 5. Migrate Workout Logs
  try {
    const workoutLogs = await mongoDb.collection("workoutLogs").find({}).toArray();
    stats.workoutLogs.mongo = workoutLogs.length;
    console.log(`[WorkoutLogs] Migrating ${workoutLogs.length} workout log documents...`);

    for (const wl of workoutLogs) {
      const docId = wl.id || `${wl.phone}_${wl.date}`;
      const { _id, ...workoutData } = wl as any;
      await firestore.collection("workoutLogs").doc(docId).set({
        ...workoutData,
        createdAt: workoutData.createdAt ? new Date(workoutData.createdAt) : new Date()
      }, { merge: true });
      stats.workoutLogs.firestore++;
    }
    console.log(`✓ [WorkoutLogs] Successfully migrated ${stats.workoutLogs.firestore} / ${stats.workoutLogs.mongo} documents.`);
  } catch (e: any) {
    console.error("❌ Error migrating workout logs:", e.message);
  }

  // 6. Migrate AI Usage Telemetry
  try {
    const aiUsage = await mongoDb.collection("aiUsage").find({}).toArray();
    stats.aiUsage.mongo = aiUsage.length;
    console.log(`[AIUsage] Migrating ${aiUsage.length} telemetry records...`);

    for (const a of aiUsage) {
      const { _id, ...aiData } = a as any;
      await firestore.collection("aiUsage").add({
        ...aiData,
        timestamp: aiData.timestamp ? new Date(aiData.timestamp) : new Date()
      });
      stats.aiUsage.firestore++;
    }
    console.log(`✓ [AIUsage] Successfully migrated ${stats.aiUsage.firestore} / ${stats.aiUsage.mongo} records.`);
  } catch (e: any) {
    console.error("❌ Error migrating AI usage:", e.message);
  }

  console.log("\n==========================================================");
  console.log("MIGRATION SUMMARY & DATA PARITY VERIFICATION");
  console.log("==========================================================");
  console.table(stats);
  console.log("✓ MongoDB Atlas remains 100% untouched for full rollback safety.");
  console.log("==========================================================\n");

  await mongoClient.close();
}

runMigration().catch((err) => {
  console.error("Migration fatal error:", err);
  process.exit(1);
});
