/**
 * Test the exact scenario from user prompt:
 * Account X:
 * 1. Mobile saves "Nasi Putih, Cumi Sambal, Kremesan & Timun" (520 kcal)
 * 2. Mobile saves "Roti Panggang Mentega" (204 kcal)
 * 3. Desktop saves "Nasi Padang Rendang Daging & Telur Dadar" (833 kcal)
 *
 * Expected on BOTH Mobile and Desktop upon refresh:
 * - Nasi Putih, Cumi Sambal, Kremesan & Timun (520 kcal)
 * - Roti Panggang Mentega (204 kcal)
 * - Nasi Padang Rendang Daging & Telur Dadar (833 kcal)
 */

import https from "https";

const CLOUD_RUN_URL = "https://gymbuddy-backend-253242815083.asia-southeast2.run.app";

function api(method: string, path: string, body?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, CLOUD_RUN_URL);
    const payload = body ? JSON.stringify(body) : undefined;
    const req = https.request(
      url,
      {
        method,
        headers: {
          "Accept": "application/json",
          "Cache-Control": "no-cache",
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {})
        }
      },
      (res) => {
        let text = "";
        res.on("data", chunk => text += chunk);
        res.on("end", () => {
          try {
            resolve(JSON.parse(text));
          } catch (e) {
            resolve({ raw: text, status: res.statusCode });
          }
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  const phone = "081311223344";
  const date = "2026-09-04";

  console.log(`[SETUP] Resetting meals for user ${phone} on ${date}...`);
  await api("DELETE", `/api/user/${phone}/meals?date=${date}`);

  console.log("\n[STEP 1] Mobile saves: Nasi Putih, Cumi Sambal, Kremesan & Timun (520 kcal)");
  const m1 = await api("POST", `/api/user/${phone}/meals`, {
    foodName: "Nasi Putih, Cumi Sambal, Kremesan & Timun",
    calories: 520,
    protein: 24,
    carbs: 68,
    fat: 16,
    date
  });
  console.log("  Response:", m1.success ? "OK" : m1);

  console.log("\n[STEP 2] Mobile saves: Roti Panggang Mentega (204 kcal)");
  const m2 = await api("POST", `/api/user/${phone}/meals`, {
    foodName: "Roti Panggang Mentega",
    calories: 204,
    protein: 6,
    carbs: 28,
    fat: 8,
    date
  });
  console.log("  Response:", m2.success ? "OK" : m2);

  console.log("\n[STEP 3] Desktop saves: Nasi Padang Rendang Daging & Telur Dadar (833 kcal)");
  const m3 = await api("POST", `/api/user/${phone}/meals`, {
    foodName: "Nasi Padang Rendang Daging & Telur Dadar",
    calories: 833,
    protein: 42,
    carbs: 78,
    fat: 39,
    date
  });
  console.log("  Response:", m3.success ? "OK" : m3);

  console.log("\n[STEP 4] Mobile refreshes dashboard (GET /api/user/:phone/meals)...");
  const mobileFetch = await api("GET", `/api/user/${phone}/meals?date=${date}`);
  console.log(`  Mobile sees ${mobileFetch.logs?.length} meals:`);
  mobileFetch.logs?.forEach((m: any) => console.log(`   - ${m.foodName} (${m.calories} kcal)`));

  console.log("\n[STEP 5] Desktop refreshes dashboard (GET /api/user/:phone/meals)...");
  const desktopFetch = await api("GET", `/api/user/${phone}/meals?date=${date}`);
  console.log(`  Desktop sees ${desktopFetch.logs?.length} meals:`);
  desktopFetch.logs?.forEach((m: any) => console.log(`   - ${m.foodName} (${m.calories} kcal)`));

  const expectedNames = [
    "Nasi Putih, Cumi Sambal, Kremesan & Timun",
    "Roti Panggang Mentega",
    "Nasi Padang Rendang Daging & Telur Dadar"
  ];

  const mobileNames = mobileFetch.logs?.map((m: any) => m.foodName);
  const desktopNames = desktopFetch.logs?.map((m: any) => m.foodName);

  const allOnMobile = expectedNames.every(n => mobileNames?.includes(n));
  const allOnDesktop = expectedNames.every(n => desktopNames?.includes(n));

  if (allOnMobile && allOnDesktop && mobileNames?.length === 3 && desktopNames?.length === 3) {
    console.log("\n✅ SUCCESS: BOTH Mobile and Desktop see the EXACT SAME 3 MEALS!");
    process.exit(0);
  } else {
    console.error("\n❌ FAILED: Meal lists did not match expectations.");
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
