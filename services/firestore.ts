import { Firestore, Timestamp } from "@google-cloud/firestore";
import admin from "firebase-admin";
import {
  UserDocument,
  SubscriptionDocument,
  FoodLogDocument,
  WaterLogDocument,
  WorkoutLogDocument,
  AiUsageDocument
} from "./db";

let firestoreInstance: Firestore | null = null;
let isFirebaseInitialized = false;

export function getFirestore(): Firestore | null {
  if (firestoreInstance) return firestoreInstance;

  try {
    const firebaseAdmin: any = typeof admin === "function" ? admin : (admin as any)?.default || admin;
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

    if (serviceAccountJson) {
      const parsedCredentials = typeof serviceAccountJson === "string" && serviceAccountJson.startsWith("{")
        ? JSON.parse(serviceAccountJson)
        : serviceAccountJson;

      if (!isFirebaseInitialized && firebaseAdmin?.apps && firebaseAdmin.apps.length === 0) {
        firebaseAdmin.initializeApp({
          credential: firebaseAdmin.credential.cert(parsedCredentials),
          projectId: projectId || parsedCredentials.project_id
        });
        isFirebaseInitialized = true;
      }
      firestoreInstance = (firebaseAdmin.firestore() || new Firestore({ projectId: projectId || parsedCredentials.project_id })) as unknown as Firestore;
      console.log("[Firestore] Initialized via Service Account credentials ✅");
      return firestoreInstance;
    }

    if (projectId) {
      if (!isFirebaseInitialized && firebaseAdmin?.apps && firebaseAdmin.apps.length === 0) {
        try {
          firebaseAdmin.initializeApp({ projectId });
          isFirebaseInitialized = true;
        } catch (e) {
          // Ignore if already initialized
        }
      }
      firestoreInstance = new Firestore({ projectId });
      console.log(`[Firestore] Initialized for Google Cloud Project: ${projectId} ✅`);
      return firestoreInstance;
    }

    return null;
  } catch (err: any) {
    return null;
  }
}

// ─── Firestore Native CRUD Methods ──────────────────────────────────────────────

export async function findUserInFirestore(identifier: string): Promise<UserDocument | null> {
  const db = getFirestore();
  if (!db) return null;
  const cleanPhone = identifier.replace(/[^\d+a-zA-Z_]/g, "");

  // 1. Direct document lookup by userId
  const directDoc = await db.collection("users").doc(identifier).get();
  if (directDoc.exists) {
    return directDoc.data() as UserDocument;
  }

  // 2. Query by phone or cleanPhone
  const querySnap = await db.collection("users")
    .where("phone", "in", [identifier, cleanPhone, `usr_${cleanPhone}`])
    .limit(1)
    .get();

  if (!querySnap.empty) {
    return querySnap.docs[0].data() as UserDocument;
  }

  return null;
}

export async function saveUserToFirestore(doc: Partial<UserDocument> & { phone: string }): Promise<void> {
  const db = getFirestore();
  if (!db) return;
  const userId = doc.userId || `usr_${doc.phone}`;
  const now = new Date();

  await db.collection("users").doc(userId).set({
    ...doc,
    userId,
    updatedAt: now,
    createdAt: doc.createdAt || now
  }, { merge: true });
}

export async function getSubscriptionFromFirestore(userIdOrPhone: string): Promise<SubscriptionDocument | null> {
  const db = getFirestore();
  if (!db) return null;
  const clean = userIdOrPhone.replace(/[^\d+a-zA-Z_]/g, "");

  // 1. Direct lookup
  const doc = await db.collection("subscriptions").doc(userIdOrPhone).get();
  if (doc.exists) return doc.data() as SubscriptionDocument;

  // 2. Query by phone
  const snap = await db.collection("subscriptions")
    .where("phone", "in", [userIdOrPhone, clean])
    .limit(1)
    .get();

  if (!snap.empty) {
    return snap.docs[0].data() as SubscriptionDocument;
  }
  return null;
}

export async function saveSubscriptionToFirestore(doc: SubscriptionDocument): Promise<void> {
  const db = getFirestore();
  if (!db) return;
  const docId = doc.userId || `usr_${doc.phone}`;
  await db.collection("subscriptions").doc(docId).set({
    ...doc,
    updatedAt: new Date()
  }, { merge: true });
}

export async function getFoodLogsFromFirestore(phone: string, date: string): Promise<FoodLogDocument[]> {
  const db = getFirestore();
  if (!db) return [];
  const clean = phone.replace(/[^\d+a-zA-Z_]/g, "");

  const snap = await db.collection("foodLogs")
    .where("phone", "in", [phone, clean])
    .where("date", "==", date)
    .get();

  const results = snap.docs.map(d => d.data() as FoodLogDocument);
  return results.sort((a, b) => {
    const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tA - tB;
  });
}

export async function insertFoodLogToFirestore(doc: FoodLogDocument): Promise<void> {
  const db = getFirestore();
  if (!db) return;
  await db.collection("foodLogs").doc(doc.id).set(doc, { merge: true });
}

export async function deleteFoodLogFromFirestore(id: string): Promise<void> {
  const db = getFirestore();
  if (!db) return;
  await db.collection("foodLogs").doc(id).delete();
}

export async function getWaterLogFromFirestore(phone: string, date: string): Promise<WaterLogDocument | null> {
  const db = getFirestore();
  if (!db) return null;
  const docId = `${phone}_${date}`;
  const doc = await db.collection("waterLogs").doc(docId).get();
  if (doc.exists) return doc.data() as WaterLogDocument;
  return null;
}

export async function saveWaterLogToFirestore(doc: WaterLogDocument): Promise<void> {
  const db = getFirestore();
  if (!db) return;
  const docId = `${doc.phone}_${doc.date}`;
  await db.collection("waterLogs").doc(docId).set(doc, { merge: true });
}

export async function recordAiTelemetryToFirestore(entry: AiUsageDocument): Promise<void> {
  try {
    const db = getFirestore();
    if (!db) return;
    await db.collection("aiUsage").add({
      ...entry,
      timestamp: entry.timestamp || new Date()
    });
  } catch (e: any) {
    console.warn("[Telemetry] Firestore write note:", e?.message || e);
  }
}
