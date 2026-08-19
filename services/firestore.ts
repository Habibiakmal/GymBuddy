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
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "gen-lang-client-0130714675";
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

    firestoreInstance = new Firestore();
    return firestoreInstance;
  } catch (err: any) {
    console.warn("[Firestore] Initialization warning:", err?.message || err);
    try {
      firestoreInstance = new Firestore();
      return firestoreInstance;
    } catch (e) {
      return null;
    }
  }
}

// ─── Helper for Comprehensive Phone Normalization Variations ──────────────────────
export function getPhoneVariations(input: string): string[] {
  if (!input) return [];
  const clean = input.replace(/[^\d+a-zA-Z_]/g, "");
  const digits = input.replace(/\D/g, "");
  const variations = new Set<string>([input, clean]);
  if (digits) {
    variations.add(digits);
    if (digits.startsWith("0")) {
      const w62 = "62" + digits.substring(1);
      variations.add(w62);
      variations.add("+" + w62);
      variations.add(`usr_${digits}`);
      variations.add(`usr_${w62}`);
    } else if (digits.startsWith("62")) {
      const w0 = "0" + digits.substring(2);
      variations.add(w0);
      variations.add("+" + digits);
      variations.add(`usr_${digits}`);
      variations.add(`usr_${w0}`);
    } else if (digits.startsWith("8")) {
      const w0 = "0" + digits;
      const w62 = "62" + digits;
      variations.add(w0);
      variations.add(w62);
      variations.add("+" + w62);
      variations.add(`usr_${w0}`);
      variations.add(`usr_${w62}`);
    }
  }
  return Array.from(variations).filter(Boolean);
}

// ─── Firestore Native CRUD Methods ──────────────────────────────────────────────

export async function findUserInFirestore(identifier: string): Promise<UserDocument | null> {
  try {
    const db = getFirestore();
    if (!db) return null;

    // 1. Direct document lookup by identifier (doc id might be usr_08... or 08...)
    const directDoc = await db.collection("users").doc(identifier).get();
    if (directDoc.exists) {
      return directDoc.data() as UserDocument;
    }

    const variations = getPhoneVariations(identifier);
    for (const v of variations) {
      if (v !== identifier) {
        const d = await db.collection("users").doc(v).get();
        if (d.exists) return d.data() as UserDocument;
      }
    }

    // 2. Query by phone in variations (Firestore IN operator supports up to 10 elements)
    const chunkedVariations = variations.slice(0, 10);
    const querySnap = await db.collection("users")
      .where("phone", "in", chunkedVariations)
      .limit(1)
      .get();

    if (!querySnap.empty) {
      return querySnap.docs[0].data() as UserDocument;
    }

    return null;
  } catch (e: any) {
    console.warn("[Firestore] findUser warning:", e?.message || e);
    return null;
  }
}

export async function saveUserToFirestore(doc: Partial<UserDocument> & { phone: string }): Promise<void> {
  try {
    const db = getFirestore();
    if (!db) return;
    const cleanPhone = doc.phone.replace(/\D/g, "");
    const normPhone = cleanPhone.startsWith("62") ? "0" + cleanPhone.substring(2) : (cleanPhone.startsWith("8") ? "0" + cleanPhone : cleanPhone);
    const userId = doc.userId || `usr_${normPhone}`;
    const now = new Date();

    const payload = {
      ...doc,
      phone: normPhone,
      userId,
      updatedAt: now,
      createdAt: doc.createdAt || now
    };

    await db.collection("users").doc(userId).set(payload, { merge: true });
    await db.collection("users").doc(normPhone).set(payload, { merge: true });
  } catch (e: any) {
    console.warn("[Firestore] saveUser warning:", e?.message || e);
  }
}

export async function getSubscriptionFromFirestore(userIdOrPhone: string): Promise<SubscriptionDocument | null> {
  try {
    const db = getFirestore();
    if (!db) return null;
    const variations = getPhoneVariations(userIdOrPhone);

    for (const v of variations) {
      const doc = await db.collection("subscriptions").doc(v).get();
      if (doc.exists) return doc.data() as SubscriptionDocument;
    }

    const snap = await db.collection("subscriptions")
      .where("phone", "in", variations.slice(0, 10))
      .limit(1)
      .get();

    if (!snap.empty) {
      return snap.docs[0].data() as SubscriptionDocument;
    }
    return null;
  } catch (e: any) {
    console.warn("[Firestore] getSubscription warning:", e?.message || e);
    return null;
  }
}

export async function saveSubscriptionToFirestore(doc: SubscriptionDocument): Promise<void> {
  try {
    const db = getFirestore();
    if (!db) return;
    const cleanPhone = doc.phone.replace(/\D/g, "");
    const normPhone = cleanPhone.startsWith("62") ? "0" + cleanPhone.substring(2) : (cleanPhone.startsWith("8") ? "0" + cleanPhone : cleanPhone);
    const docId = doc.userId || `usr_${normPhone}`;
    const payload = {
      ...doc,
      phone: normPhone,
      userId: docId,
      updatedAt: new Date()
    };
    await db.collection("subscriptions").doc(docId).set(payload, { merge: true });
    await db.collection("subscriptions").doc(normPhone).set(payload, { merge: true });
  } catch (e: any) {
    console.warn("[Firestore] saveSubscription warning:", e?.message || e);
  }
}

export async function getFoodLogsFromFirestore(phone: string, date: string): Promise<FoodLogDocument[]> {
  try {
    const db = getFirestore();
    if (!db) return [];
    const variations = getPhoneVariations(phone).slice(0, 10);

    const snap = await db.collection("foodLogs")
      .where("phone", "in", variations)
      .where("date", "==", date)
      .get();

    const results = snap.docs.map(d => d.data() as FoodLogDocument);
    return results.sort((a, b) => {
      const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tA - tB;
    });
  } catch (e: any) {
    console.warn("[Firestore] getFoodLogs warning:", e?.message || e);
    return [];
  }
}

export async function insertFoodLogToFirestore(doc: FoodLogDocument): Promise<void> {
  try {
    const db = getFirestore();
    if (!db) return;
    const cleanPhone = doc.phone.replace(/\D/g, "");
    const normPhone = cleanPhone.startsWith("62") ? "0" + cleanPhone.substring(2) : (cleanPhone.startsWith("8") ? "0" + cleanPhone : cleanPhone);
    const payload = {
      ...doc,
      phone: normPhone,
      userId: doc.userId || `usr_${normPhone}`
    };
    await db.collection("foodLogs").doc(doc.id).set(payload, { merge: true });
  } catch (e: any) {
    console.warn("[Firestore] insertFoodLog warning:", e?.message || e);
  }
}

export async function deleteFoodLogFromFirestore(id: string): Promise<void> {
  try {
    const db = getFirestore();
    if (!db) return;
    await db.collection("foodLogs").doc(id).delete();
  } catch (e: any) {
    console.warn("[Firestore] deleteFoodLog warning:", e?.message || e);
  }
}

export async function getWaterLogFromFirestore(phone: string, date: string): Promise<WaterLogDocument | null> {
  try {
    const db = getFirestore();
    if (!db) return null;
    const variations = getPhoneVariations(phone);
    for (const v of variations) {
      const doc = await db.collection("waterLogs").doc(`${v}_${date}`).get();
      if (doc.exists) return doc.data() as WaterLogDocument;
    }
    return null;
  } catch (e: any) {
    console.warn("[Firestore] getWaterLog warning:", e?.message || e);
    return null;
  }
}

export async function saveWaterLogToFirestore(doc: WaterLogDocument): Promise<void> {
  try {
    const db = getFirestore();
    if (!db) return;
    const cleanPhone = doc.phone.replace(/\D/g, "");
    const normPhone = cleanPhone.startsWith("62") ? "0" + cleanPhone.substring(2) : (cleanPhone.startsWith("8") ? "0" + cleanPhone : cleanPhone);
    const payload = {
      ...doc,
      phone: normPhone,
      userId: doc.userId || `usr_${normPhone}`
    };
    await db.collection("waterLogs").doc(`${normPhone}_${doc.date}`).set(payload, { merge: true });
    if (doc.phone !== normPhone) {
      await db.collection("waterLogs").doc(`${doc.phone}_${doc.date}`).set(payload, { merge: true });
    }
  } catch (e: any) {
    console.warn("[Firestore] saveWaterLog warning:", e?.message || e);
  }
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

// ─── App Data Global Snapshot Methods (Firestore Primary) ──────────────────────────

export async function saveAppDataToFirestore(appData: any): Promise<void> {
  const db = getFirestore();
  if (!db) return;
  try {
    const cleanData = JSON.parse(JSON.stringify(appData));
    await db.collection("appdata").doc("main").set({
      ...cleanData,
      updatedAt: new Date()
    }, { merge: true });
    console.log("[Firestore] Global appdata snapshot saved ✅");
  } catch (e: any) {
    console.error("[Firestore] saveAppData error:", e?.message || e);
  }
}

export async function loadAppDataFromFirestore(): Promise<any | null> {
  const db = getFirestore();
  if (!db) return null;
  try {
    const doc = await db.collection("appdata").doc("main").get();
    if (doc.exists) {
      console.log("[Firestore] Global appdata snapshot loaded ✅");
      return doc.data();
    }
    return null;
  } catch (e: any) {
    console.error("[Firestore] loadAppData error:", e?.message || e);
    return null;
  }
}

export async function getAllUsersFromFirestore(): Promise<UserDocument[]> {
  const db = getFirestore();
  if (!db) return [];
  try {
    const snap = await db.collection("users").get();
    return snap.docs.map(d => d.data() as UserDocument);
  } catch (e: any) {
    console.error("[Firestore] getAllUsers error:", e?.message || e);
    return [];
  }
}
