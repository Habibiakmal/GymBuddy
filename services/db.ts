import { MongoClient, Db, Collection } from "mongodb";

export interface UserDocument {
  userId: string;
  phone: string;
  email?: string;
  passwordHash?: string;
  name: string;
  gender?: string;
  age?: number;
  weight?: number;
  height?: number;
  targetWeight?: number;
  startWeight?: number;
  goal?: string;
  activityLevel?: string;
  dietPreference?: string;
  experienceLevel?: string;
  persona?: "mia" | "max" | "nikita" | "coach";
  selectedFeature?: "nutrition" | "coach" | "both";
  activeService?: "nutrition" | "coach" | "both";
  dailyTargetCalories?: number;
  dailyTargetProtein?: number;
  dailyTargetCarbs?: number;
  dailyTargetFat?: number;
  customSchedule?: any;
  customGoals?: any;
  reminderTime?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionDocument {
  userId: string;
  phone: string;
  plan: "free" | "advanced" | "premium";
  activeService: "nutrition" | "coach" | "both";
  status: "trial" | "active" | "expired" | "cancelled";
  billingDuration: "1m" | "3m" | "6m" | "1y" | "lifetime";
  startedAt: Date;
  expiresAt: Date;
  midtransOrderId?: string;
  midtransTransactionId?: string;
  grossAmount?: number;
  paymentType?: string;
  updatedAt: Date;
}

export interface FoodLogDocument {
  id: string;
  userId: string;
  phone: string;
  date: string; // YYYY-MM-DD
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  time?: string;
  isHydration?: boolean;
  volumeMl?: number;
  displayUnit?: string;
  portionType?: "estimated" | "user_provided";
  itemType?: "food" | "beverage" | "water";
  source?: string;
  items?: any[];
  imageUrl?: string;
  createdAt: Date;
}

export interface WaterLogDocument {
  userId: string;
  phone: string;
  date: string; // YYYY-MM-DD
  cups: number;
  totalMl: number;
  updatedAt: Date;
}

export interface WorkoutLogDocument {
  id: string;
  userId: string;
  phone: string;
  date: string; // YYYY-MM-DD
  workoutDay?: string;
  exercises: any[];
  completed: boolean;
  notes?: string;
  createdAt: Date;
}

export interface AiUsageDocument {
  userId: string;
  phone?: string;
  feature: "food_vision" | "nutrition_text" | "coach_mia" | "workout_generator" | "poster_generation";
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  imageInputCount?: number;
  latencyMs?: number;
  success: boolean;
  errorMessage?: string;
  timestamp: Date;
}

let client: MongoClient | null = null;
let database: Db | null = null;

export async function getDatabase(): Promise<Db | null> {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;

  if (!client) {
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });
  }

  try {
    if (!database) {
      await client.connect();
      database = client.db("gymbuddy");
      console.log("[MongoDB] Production Atlas connection established ✅");
      await initIndexes(database);
      await migrateLegacyAppData(database);
    }
    return database;
  } catch (err: any) {
    console.error("[MongoDB] Connection failure:", err?.message || err);
    client = null;
    database = null;
    return null;
  }
}

async function initIndexes(db: Db) {
  try {
    // 1. Users collection
    const usersCol = db.collection("users");
    await usersCol.createIndex({ userId: 1 }, { unique: true, sparse: true });
    await usersCol.createIndex({ phone: 1 });
    await usersCol.createIndex({ email: 1 }, { sparse: true });

    // 2. Subscriptions collection
    const subsCol = db.collection("subscriptions");
    await subsCol.createIndex({ userId: 1 });
    await subsCol.createIndex({ phone: 1 });
    await subsCol.createIndex({ status: 1 });
    await subsCol.createIndex({ expiresAt: 1 });

    // 3. Food logs collection
    const foodCol = db.collection("foodLogs");
    await foodCol.createIndex({ userId: 1, date: 1 });
    await foodCol.createIndex({ phone: 1, date: 1 });
    await foodCol.createIndex({ id: 1 });

    // 4. Water logs collection
    const waterCol = db.collection("waterLogs");
    await waterCol.createIndex({ userId: 1, date: 1 });
    await waterCol.createIndex({ phone: 1, date: 1 });

    // 5. Workout logs collection
    const workoutCol = db.collection("workoutLogs");
    await workoutCol.createIndex({ userId: 1, date: 1 });
    await workoutCol.createIndex({ phone: 1, date: 1 });

    // 6. AI Usage telemetry collection
    const aiCol = db.collection("aiUsage");
    await aiCol.createIndex({ userId: 1, timestamp: -1 });
    await aiCol.createIndex({ feature: 1, timestamp: -1 });

    console.log("[MongoDB] Production collection indexes verified ✅");
  } catch (e: any) {
    console.warn("[MongoDB] Index setup note:", e?.message || e);
  }
}

async function migrateLegacyAppData(db: Db) {
  try {
    const legacyDoc = await db.collection("appdata").findOne({ _id: "main" as any });
    if (!legacyDoc) return;

    console.log("[MongoDB] Checking legacy appdata document for migration...");

    // Migrate users
    if (legacyDoc.users && typeof legacyDoc.users === "object") {
      const userEntries = Object.entries(legacyDoc.users);
      for (const [phoneKey, u] of userEntries) {
        const userObj: any = u;
        if (!userObj || typeof userObj !== "object") continue;
        const normalizedPhone = userObj.phone || phoneKey;
        const userId = userObj.id || `usr_${normalizedPhone}`;

        await db.collection("users").updateOne(
          { phone: normalizedPhone },
          {
            $set: {
              userId,
              phone: normalizedPhone,
              name: userObj.name || "User",
              gender: userObj.gender,
              age: userObj.age,
              weight: userObj.weight,
              height: userObj.height,
              targetWeight: userObj.targetWeight,
              startWeight: userObj.startWeight,
              goal: userObj.goal,
              activityLevel: userObj.activityLevel,
              dietPreference: userObj.dietPreference,
              experienceLevel: userObj.experienceLevel,
              persona: userObj.persona || "mia",
              selectedFeature: userObj.selectedFeature || userObj.activeService || "both",
              activeService: userObj.activeService || userObj.selectedFeature || "both",
              dailyTargetCalories: userObj.dailyTargetCalories || 2000,
              dailyTargetProtein: userObj.dailyTargetProtein || 120,
              dailyTargetCarbs: userObj.dailyTargetCarbs || 220,
              dailyTargetFat: userObj.dailyTargetFat || 50,
              customSchedule: userObj.customSchedule,
              customGoals: userObj.customGoals,
              reminderTime: userObj.reminderTime,
              updatedAt: new Date(),
            },
            $setOnInsert: { createdAt: new Date() }
          },
          { upsert: true }
        );

        // Migrate subscription
        if (userObj.subscription) {
          const sub = userObj.subscription;
          await db.collection("subscriptions").updateOne(
            { phone: normalizedPhone },
            {
              $set: {
                userId,
                phone: normalizedPhone,
                plan: sub.plan || "advanced",
                activeService: sub.activeService || userObj.activeService || "both",
                status: sub.status || "trial",
                billingDuration: sub.billingDuration || "1m",
                startedAt: sub.startedAt ? new Date(sub.startedAt) : new Date(),
                expiresAt: sub.expiresAt ? new Date(sub.expiresAt) : new Date(Date.now() + 48 * 3600 * 1000),
                updatedAt: new Date()
              }
            },
            { upsert: true }
          );
        }
      }
      console.log(`[MongoDB] Migrated ${userEntries.length} users into relational collections.`);
    }

    // Migrate daily food logs
    if (legacyDoc.dailyLogs && typeof legacyDoc.dailyLogs === "object") {
      let migratedMealCount = 0;
      for (const [key, meals] of Object.entries(legacyDoc.dailyLogs)) {
        if (!Array.isArray(meals)) continue;
        const [phone, date] = key.includes("_") ? key.split("_") : [key, new Date().toISOString().split("T")[0]];
        for (const meal of meals) {
          if (!meal || typeof meal !== "object") continue;
          const mealId = meal.id || `m_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          await db.collection("foodLogs").updateOne(
            { id: mealId },
            {
              $set: {
                id: mealId,
                userId: `usr_${phone}`,
                phone,
                date: date || new Date().toISOString().split("T")[0],
                foodName: meal.foodName || "Food Log",
                calories: Number(meal.calories) || 0,
                protein: Number(meal.protein) || 0,
                carbs: Number(meal.carbs) || 0,
                fat: Number(meal.fat) || 0,
                fiber: Number(meal.fiber) || 0,
                sugar: Number(meal.sugar) || 0,
                time: meal.time || "12:00",
                isHydration: Boolean(meal.isHydration),
                volumeMl: Number(meal.volumeMl) || undefined,
                displayUnit: meal.displayUnit || undefined,
                portionType: meal.portionType || "estimated",
                itemType: meal.itemType || (meal.isHydration ? "water" : "food"),
                source: meal.source || "USDA",
                items: meal.items || [],
                imageUrl: meal.imageUrl || undefined,
                createdAt: meal.createdAt ? new Date(meal.createdAt) : new Date()
              }
            },
            { upsert: true }
          );
          migratedMealCount++;
        }
      }
      console.log(`[MongoDB] Migrated ${migratedMealCount} food log items.`);
    }
  } catch (e: any) {
    console.warn("[MongoDB] Migration warning:", e?.message || e);
  }
}

// ─── Direct DB Access Methods (Firestore Primary + MongoDB Dual-Write + Local Cache) ────

import {
  findUserInFirestore,
  saveUserToFirestore,
  getSubscriptionFromFirestore,
  saveSubscriptionToFirestore,
  getFoodLogsFromFirestore,
  insertFoodLogToFirestore,
  deleteFoodLogFromFirestore,
  getWaterLogFromFirestore,
  saveWaterLogToFirestore,
  recordAiTelemetryToFirestore,
  getFirestore
} from "./firestore";

// Local development fallback cache
const memCache = {
  users: new Map<string, UserDocument>(),
  subscriptions: new Map<string, SubscriptionDocument>(),
  foodLogs: new Map<string, FoodLogDocument[]>(),
  waterLogs: new Map<string, WaterLogDocument>(),
};

export async function findUserByPhoneOrId(identifier: string): Promise<UserDocument | null> {
  const clean = identifier.replace(/[^\d+a-zA-Z_]/g, "");

  // 1. Try Firestore first if initialized
  try {
    if (getFirestore()) {
      const firestoreUser = await findUserInFirestore(identifier);
      if (firestoreUser) return firestoreUser;
    }
  } catch (e: any) {
    console.warn("[Firestore] findUser fallback note:", e?.message || e);
  }

  // 2. Fallback to MongoDB
  try {
    const db = await getDatabase();
    if (db) {
      const found = await db.collection<UserDocument>("users").findOne({
        $or: [{ userId: identifier }, { phone: identifier }, { phone: clean }]
      });
      if (found) return found;
    }
  } catch (e: any) {
    console.warn("[MongoDB] findUser fallback note:", e?.message || e);
  }

  // 3. Fallback to Memory Store
  return memCache.users.get(identifier) || memCache.users.get(clean) || memCache.users.get(`usr_${clean}`) || null;
}

export async function saveUserDocument(doc: Partial<UserDocument> & { phone: string }): Promise<void> {
  const userId = doc.userId || `usr_${doc.phone}`;
  const completeDoc = {
    ...doc,
    userId,
    updatedAt: new Date(),
    createdAt: doc.createdAt || new Date()
  } as UserDocument;

  // Store in memory cache
  memCache.users.set(doc.phone, completeDoc);
  memCache.users.set(userId, completeDoc);

  // 1. Save to Firestore (Primary)
  try {
    if (getFirestore()) {
      await saveUserToFirestore(doc);
    }
  } catch (e: any) {
    console.warn("[Firestore] saveUser warning:", e?.message || e);
  }

  // 2. Dual-write to MongoDB (Rollback Safety)
  try {
    const db = await getDatabase();
    if (db) {
      await db.collection("users").updateOne(
        { phone: doc.phone },
        {
          $set: {
            ...doc,
            userId,
            updatedAt: new Date()
          },
          $setOnInsert: { createdAt: new Date() }
        },
        { upsert: true }
      );
    }
  } catch (e: any) {
    console.warn("[MongoDB] saveUser warning:", e?.message || e);
  }
}

export async function getUserSubscription(userIdOrPhone: string): Promise<SubscriptionDocument | null> {
  const clean = userIdOrPhone.replace(/[^\d+a-zA-Z_]/g, "");

  // 1. Try Firestore
  try {
    if (getFirestore()) {
      const firestoreSub = await getSubscriptionFromFirestore(userIdOrPhone);
      if (firestoreSub) return firestoreSub;
    }
  } catch (e: any) {
    console.warn("[Firestore] getSubscription fallback note:", e?.message || e);
  }

  // 2. MongoDB Fallback
  try {
    const db = await getDatabase();
    if (db) {
      const found = await db.collection<SubscriptionDocument>("subscriptions").findOne({
        $or: [{ userId: userIdOrPhone }, { phone: userIdOrPhone }]
      });
      if (found) return found;
    }
  } catch (e: any) {
    console.warn("[MongoDB] getSubscription fallback note:", e?.message || e);
  }

  // 3. Memory Store
  return memCache.subscriptions.get(userIdOrPhone) || memCache.subscriptions.get(clean) || null;
}

export async function saveUserSubscription(doc: SubscriptionDocument): Promise<void> {
  memCache.subscriptions.set(doc.phone, doc);
  if (doc.userId) memCache.subscriptions.set(doc.userId, doc);

  // 1. Save to Firestore (Primary)
  try {
    if (getFirestore()) {
      await saveSubscriptionToFirestore(doc);
    }
  } catch (e: any) {
    console.warn("[Firestore] saveSubscription warning:", e?.message || e);
  }

  // 2. Dual-write to MongoDB
  try {
    const db = await getDatabase();
    if (db) {
      await db.collection("subscriptions").updateOne(
        { phone: doc.phone },
        {
          $set: {
            ...doc,
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );
    }
  } catch (e: any) {
    console.warn("[MongoDB] saveSubscription warning:", e?.message || e);
  }
}

export async function getFoodLogsForDate(phone: string, date: string): Promise<FoodLogDocument[]> {
  const clean = phone.replace(/[^\d+a-zA-Z_]/g, "");
  const cacheKey = `${clean}_${date}`;

  // 1. Try Firestore
  try {
    if (getFirestore()) {
      const firestoreLogs = await getFoodLogsFromFirestore(phone, date);
      if (firestoreLogs.length > 0) return firestoreLogs;
    }
  } catch (e: any) {
    console.warn("[Firestore] getFoodLogs fallback note:", e?.message || e);
  }

  // 2. MongoDB Fallback
  try {
    const db = await getDatabase();
    if (db) {
      const found = await db.collection<FoodLogDocument>("foodLogs").find({
        $or: [{ phone }, { userId: `usr_${phone}` }],
        date
      }).sort({ createdAt: 1 }).toArray();
      if (found.length > 0) return found;
    }
  } catch (e: any) {
    console.warn("[MongoDB] getFoodLogs fallback note:", e?.message || e);
  }

  // 3. Memory Store
  return memCache.foodLogs.get(cacheKey) || [];
}

export async function insertFoodLog(doc: FoodLogDocument): Promise<void> {
  const clean = doc.phone.replace(/[^\d+a-zA-Z_]/g, "");
  const cacheKey = `${clean}_${doc.date}`;
  const existing = memCache.foodLogs.get(cacheKey) || [];
  const idx = existing.findIndex(m => m.id === doc.id);
  if (idx >= 0) existing[idx] = doc;
  else existing.push(doc);
  memCache.foodLogs.set(cacheKey, existing);

  // 1. Firestore Primary
  try {
    if (getFirestore()) {
      await insertFoodLogToFirestore(doc);
    }
  } catch (e: any) {
    console.warn("[Firestore] insertFoodLog warning:", e?.message || e);
  }

  // 2. MongoDB Dual-Write
  try {
    const db = await getDatabase();
    if (db) {
      await db.collection("foodLogs").updateOne(
        { id: doc.id },
        { $set: doc },
        { upsert: true }
      );
    }
  } catch (e: any) {
    console.warn("[MongoDB] insertFoodLog warning:", e?.message || e);
  }
}

export async function deleteFoodLog(id: string): Promise<void> {
  try {
    if (getFirestore()) {
      await deleteFoodLogFromFirestore(id);
    }
  } catch (e: any) {
    console.warn("[Firestore] deleteFoodLog warning:", e?.message || e);
  }

  const db = await getDatabase();
  if (!db) return;
  await db.collection("foodLogs").deleteOne({ id });
}

export async function getWaterLog(phone: string, date: string): Promise<WaterLogDocument | null> {
  try {
    if (getFirestore()) {
      const firestoreWater = await getWaterLogFromFirestore(phone, date);
      if (firestoreWater) return firestoreWater;
    }
  } catch (e: any) {
    console.warn("[Firestore] getWaterLog fallback note:", e?.message || e);
  }

  const db = await getDatabase();
  if (!db) return null;
  return await db.collection<WaterLogDocument>("waterLogs").findOne({
    $or: [{ phone }, { userId: `usr_${phone}` }],
    date
  });
}

export async function saveWaterLog(doc: WaterLogDocument): Promise<void> {
  try {
    if (getFirestore()) {
      await saveWaterLogToFirestore(doc);
    }
  } catch (e: any) {
    console.warn("[Firestore] saveWaterLog warning:", e?.message || e);
  }

  const db = await getDatabase();
  if (!db) return;
  await db.collection("waterLogs").updateOne(
    { phone: doc.phone, date: doc.date },
    { $set: doc },
    { upsert: true }
  );
}

export async function recordAiTelemetry(entry: AiUsageDocument): Promise<void> {
  try {
    if (getFirestore()) {
      await recordAiTelemetryToFirestore(entry);
    }
  } catch (e: any) {
    console.warn("[Firestore] recordAiTelemetry warning:", e?.message || e);
  }

  try {
    const db = await getDatabase();
    if (!db) return;
    await db.collection("aiUsage").insertOne(entry);
  } catch (e: any) {
    console.warn("[Telemetry] MongoDB write note:", e?.message || e);
  }
}
