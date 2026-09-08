/**
 * Migration Script: Migrate all existing GymBuddy users to Lifetime Access.
 * Idempotent, safe, and non-destructive.
 */
import fs from "fs";
import path from "path";
import "dotenv/config";
import {
  migrateExistingUsersToLifetime
} from "../services/subscriptionEngine";
import {
  getFirestore,
  getAllUsersFromFirestore,
  saveUserToFirestore,
  loadAppDataFromFirestore,
  saveAppDataToFirestore
} from "../services/firestore";

async function run() {
  console.log("================================================================================");
  console.log("  GYMBUDDY: IDEMPOTENT CANONICAL SUBSCRIPTION MIGRATION -> LIFETIME ACCESS");
  console.log("================================================================================\n");

  const dataDir = path.join(process.cwd(), "data");
  const dbFile = path.join(dataDir, "db.json");

  let localDb: any = { users: {}, dailyLogs: {}, weeklyProgress: {}, waterLogs: {} };
  if (fs.existsSync(dbFile)) {
    try {
      localDb = JSON.parse(fs.readFileSync(dbFile, "utf8"));
    } catch (e: any) {
      console.warn("[Migration] Could not parse local db.json:", e?.message || e);
    }
  }

  const firestore = getFirestore();
  if (firestore) {
    console.log("✓ Connected to Google Cloud Firestore ✅");
  } else {
    console.log("ℹ Running on local database (Firestore not configured or local dev)");
  }

  const result = await migrateExistingUsersToLifetime(
    localDb.users || {},
    firestore ? getAllUsersFromFirestore : undefined,
    firestore ? saveUserToFirestore : undefined
  );

  // If local DB was updated, save back
  if (fs.existsSync(dbFile) && result.migratedCount > 0) {
    fs.writeFileSync(dbFile, JSON.stringify(localDb, null, 2), "utf8");
    console.log("✓ Saved updated users to local data/db.json ✅");
  }

  // If Firestore appdata snapshot exists, update it too
  if (firestore) {
    try {
      const appData = await loadAppDataFromFirestore();
      if (appData && appData.users) {
        let appDataMigrated = 0;
        for (const [k, u] of Object.entries(appData.users as Record<string, any>)) {
          if (u && typeof u === "object") {
            if (u.plan !== "lifetime" || u.planDuration !== "lifetime") {
              u.plan = "lifetime";
              u.planDuration = "lifetime";
              u.planExpiresAt = null;
              u.hasUsedTrial = true;
              u.updatedAt = new Date().toISOString();
              appDataMigrated++;
            }
          }
        }
        if (appDataMigrated > 0) {
          await saveAppDataToFirestore(appData);
          console.log(`✓ Updated ${appDataMigrated} users in Firestore appdata/main snapshot ✅`);
        }
      }
    } catch (e: any) {
      console.warn("[Migration] Firestore snapshot update note:", e?.message || e);
    }
  }

  console.log("\n--------------------------------------------------------------------------------");
  console.log("  MIGRATION REPORT:");
  console.log(`  • Total Users Scanned:       ${result.totalUsers}`);
  console.log(`  • Users Newly Migrated:      ${result.migratedCount}`);
  console.log(`  • Users Already Lifetime:    ${result.alreadyLifetimeCount}`);
  console.log("--------------------------------------------------------------------------------\n");
  console.log("🎉 Migration completed successfully!\n");
}

run().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
