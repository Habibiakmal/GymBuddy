const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

// Load font buffers
const fontFiles = ['arial.ttf', 'arialbd.ttf', 'segoeui.ttf', 'seguisb.ttf'];
const fontBuffers = [];
for (const f of fontFiles) {
  const p = path.join(__dirname, '..', 'fonts', f);
  if (fs.existsSync(p)) {
    try {
      fontBuffers.push(fs.readFileSync(p));
    } catch (e) {}
  }
}

console.log(`Loaded ${fontBuffers.length} font buffers.`);

function escapeXml(unsafe) {
  return (unsafe || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateNutritionCardSvg(data) {
  const rawTitle = (data.foodName || "MAKANAN BERGIZI").trim().toUpperCase();

  const words = rawTitle.split(/\s+/);
  const titleLines = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + " " + word).trim().length <= 25) {
      currentLine = (currentLine + " " + word).trim();
    } else {
      if (currentLine) titleLines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) titleLines.push(currentLine);

  const displayTitleLines = titleLines.slice(0, 3);

  const protein = Math.round(Number(data.protein) || 0);
  const carbs = Math.round(Number(data.carbs) || 0);
  const fat = Math.round(Number(data.fat) || 0);

  const macroCalcCalories = (protein * 4) + (carbs * 4) + (fat * 9);
  const calories = macroCalcCalories > 0 ? macroCalcCalories : (Math.round(Number(data.calories)) || 0);

  const mealType = data.mealType || "Lunch";
  const dateStr = data.dateStr || "Kam, 20 Agu";

  const targetCal = Math.round(Number(data.dailyTargetCalories) || 2054);
  const consumedCal = Math.round(Number(data.consumedTodayCalories) || calories);
  const remainingCal = targetCal - consumedCal;

  const targetProt = Math.round(Number(data.dailyTargetProtein) || 150);
  const targetCarb = Math.round(Number(data.dailyTargetCarbs) || 275);
  const targetFat = Math.round(Number(data.dailyTargetFat) || 67);

  const calPercentage = Math.min(100, Math.max(0, Math.round((consumedCal / targetCal) * 100)));
  const isOver = remainingCal < 0;
  const statusPillText = isOver
    ? `over ${Math.abs(remainingCal).toLocaleString("id-ID")} kkal`
    : `sisa ${remainingCal.toLocaleString("id-ID")} kkal`;

  const protPercentage = Math.min(100, Math.max(0, Math.round((protein / targetProt) * 100)));
  const carbPercentage = Math.min(100, Math.max(0, Math.round((carbs / targetCarb) * 100)));
  const fatPercentage = Math.min(100, Math.max(0, Math.round((fat / targetFat) * 100)));

  let coachMessage = (data.insight || "").trim() || "Konsistensi kecil, hasil besar.";

  const canvasWidth = 720;
  const contentWidth = 640;
  const paddingX = 40;

  const titleLineHeight = 36;
  const titleTotalHeight = displayTitleLines.length * titleLineHeight;

  const headerY = 48;
  const titleY = headerY + 40;
  const badgeY = titleY + titleTotalHeight + 14;
  const photoY = badgeY + 44;
  const photoHeight = 440;

  const calorieCardY = photoY + photoHeight + 20;
  const calorieCardHeight = 145;

  const macroCardY = calorieCardY + calorieCardHeight + 16;
  const macroCardHeight = 100;

  const coachCardY = macroCardY + macroCardHeight + 16;
  const coachCardHeight = 88;

  const footerY = coachCardY + coachCardHeight + 24;
  const canvasHeight = footerY + 38;

  const photoHref = data.imageBufferOrBase64 || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=700&amp;auto=format&amp;fit=crop&amp;q=80";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">
  <defs>
    <clipPath id="foodPhotoClip">
      <rect x="${paddingX}" y="${photoY}" width="${contentWidth}" height="${photoHeight}" rx="20" ry="20"/>
    </clipPath>
  </defs>

  <!-- Canvas Background (Pure Pitch Black) -->
  <rect width="${canvasWidth}" height="${canvasHeight}" fill="#000000"/>

  <!-- 1. TOP HEADER: Official Logo + GYM BUDDY AI | Meal Type & Date -->
  <g id="topHeader" transform="translate(${paddingX}, ${headerY})">
    <!-- Official GymBuddy Logo Icon -->
    <g transform="translate(0, -10) scale(0.62)">
      <path d="M30.6 32.0694L34.2 27.7639H46.6L39.8 38.0972L26.6 44.9861L36.6 32.0694H30.6Z" fill="#D4FF00" />
      <path d="M51 17H27C25.9333 17 23.4 17.775 21.8 20.875C20.2 23.975 15.2667 34.5093 13 39.3889H25L21 48L23.4 46.7083L32.6 34.2222H22.6C22.0667 34.3657 21.24 34.1361 22.2 32.0694C23.16 30.0028 25 25.7546 25.8 23.8889C26.0667 23.3148 26.84 22.1667 27.8 22.1667H38.6L35.8 26.0417H43.4L51 17Z" fill="#FFFFFF" />
    </g>

    <!-- Brand Name -->
    <text x="42" y="11" fill="#FFFFFF" font-family="Arial" font-size="14" font-weight="bold" letter-spacing="1.5">GYM BUDDY AI</text>

    <!-- Right Header Metadata: Fork and Knife Icon + Meal Type | Date -->
    <g transform="translate(${contentWidth - 170}, 0)">
      <!-- Fork and Knife Icon in Lime -->
      <g transform="translate(0, -2) scale(0.75)">
        <path d="M4 2v7c0 1.5 1 2.5 2.5 2.5V20M8 2v7c0 1.5-1 2.5-2.5 2.5M6 2v7M16 2c-1.5 0-2.5 1-2.5 3v6c0 1.5 1 2.5 2.5 2.5V20" fill="none" stroke="#D4FF00" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      <text x="22" y="11" fill="#D4FF00" font-family="Arial" font-size="14" font-weight="bold">${escapeXml(mealType)}</text>
      <text x="76" y="11" fill="#3E4756" font-family="Arial" font-size="14">|</text>
      <text x="90" y="11" fill="#8E95A5" font-family="Arial" font-size="13" font-weight="bold">${escapeXml(dateStr)}</text>
    </g>
  </g>

  <!-- 2. BOLD ATHLETIC MEAL TITLE -->
  <g id="mealTitle" transform="translate(${paddingX}, ${titleY})">
    ${displayTitleLines.map((line, idx) => `
      <text x="0" y="${idx * titleLineHeight + 26}" fill="#FFFFFF" font-family="Arial" font-size="28" font-weight="bold" letter-spacing="0.5">${escapeXml(line)}</text>
    `).join("")}
  </g>

  <!-- 3. STATUS BADGE PILL ("On track | sisa 1.269 kkal") -->
  <g id="statusBadge" transform="translate(${paddingX}, ${badgeY})">
    <rect width="260" height="34" rx="17" fill="#121721" stroke="#222A38" stroke-width="1.2"/>
    <!-- Checkmark Circle -->
    <circle cx="20" cy="17" r="9" fill="#D4FF00"/>
    <path d="M16.5 17l2.5 2.5 4.5-5" fill="none" stroke="#000000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    
    <text x="36" y="22" fill="#D4FF00" font-family="Arial" font-size="13" font-weight="bold">On track</text>
    <text x="96" y="21" fill="#3A4454" font-family="Arial" font-size="13">|</text>
    <text x="108" y="22" fill="#8E95A5" font-family="Arial" font-size="12.5" font-weight="bold">${escapeXml(statusPillText)}</text>
  </g>

  <!-- 4. FOOD PHOTO CONTAINER -->
  <g id="foodPhotoContainer">
    <rect x="${paddingX}" y="${photoY}" width="${contentWidth}" height="${photoHeight}" rx="20" ry="20" fill="#0E121A" stroke="#1F2530" stroke-width="1.5"/>
    <image href="${photoHref}" xlink:href="${photoHref}" x="${paddingX}" y="${photoY}" width="${contentWidth}" height="${photoHeight}" preserveAspectRatio="xMidYMid slice" clip-path="url(#foodPhotoClip)"/>
  </g>

  <!-- 5. PRIMARY CALORIE CARD (2-COLUMN GRID) -->
  <g id="calorieCard" transform="translate(${paddingX}, ${calorieCardY})">
    <rect width="${contentWidth}" height="${calorieCardHeight}" rx="20" fill="#0C0E14" stroke="#1C2330" stroke-width="1.2"/>

    <!-- Left Column: Meal Calories -->
    <g transform="translate(24, 22)">
      <text x="0" y="8" fill="#717C91" font-family="Arial" font-size="11" font-weight="bold" letter-spacing="1.2">KALORI</text>
      
      <!-- Big Bold Calorie Number in Neon Lime Green -->
      <text x="0" y="58" fill="#D4FF00" font-family="Arial" font-size="48" font-weight="bold" letter-spacing="-0.5">${calories.toLocaleString("id-ID")}</text>
      <text x="${String(calories).length > 3 ? 120 : 96}" y="56" fill="#FFFFFF" font-family="Arial" font-size="20" font-weight="bold">kcal</text>

      <!-- Percentage subtext -->
      <text x="0" y="82" fill="#D4FF00" font-family="Arial" font-size="13" font-weight="bold">${calPercentage}%</text>
      <text x="34" y="82" fill="#717C91" font-family="Arial" font-size="13" font-weight="bold">dari target harian</text>

      <!-- Progress Bar (Left) -->
      <rect x="0" y="96" width="240" height="8" rx="4" fill="#1C2330"/>
      <rect x="0" y="96" width="${Math.round(240 * (calPercentage / 100))}" height="8" rx="4" fill="#D4FF00"/>
    </g>

    <!-- Center Vertical Divider -->
    <line x1="310" y1="20" x2="310" y2="${calorieCardHeight - 20}" stroke="#1B222E" stroke-width="1.2"/>

    <!-- Right Column: Daily Target -->
    <g transform="translate(334, 22)">
      <text x="0" y="8" fill="#717C91" font-family="Arial" font-size="11" font-weight="bold" letter-spacing="1.2">TARGET HARIAN</text>
      
      <!-- Target Calories Number -->
      <text x="0" y="56" fill="#FFFFFF" font-family="Arial" font-size="36" font-weight="bold" letter-spacing="-0.5">${targetCal.toLocaleString("id-ID")}</text>
      <text x="${String(targetCal).length > 4 ? 120 : 100}" y="54" fill="#8E95A5" font-family="Arial" font-size="18" font-weight="bold">kcal</text>

      <!-- Progress Bar (Right) + Percentage Label -->
      <g transform="translate(0, 84)">
        <rect x="0" y="10" width="220" height="8" rx="4" fill="#1C2330"/>
        <rect x="0" y="10" width="${Math.round(220 * (calPercentage / 100))}" height="8" rx="4" fill="#D4FF00"/>
        <text x="236" y="18" fill="#D4FF00" font-family="Arial" font-size="14" font-weight="bold">${calPercentage}%</text>
      </g>
    </g>
  </g>

  <!-- 6. MACRONUTRIENTS CARD (3 EQUAL COLUMNS) -->
  <g id="macroCard" transform="translate(${paddingX}, ${macroCardY})">
    <rect width="${contentWidth}" height="${macroCardHeight}" rx="18" fill="#0C0E14" stroke="#1C2330" stroke-width="1.2"/>

    <!-- Column 1: Protein -->
    <g transform="translate(20, 18)">
      <circle cx="18" cy="18" r="18" fill="#121721" stroke="#222B38" stroke-width="1.2"/>
      <g transform="translate(7, 7) scale(0.9)">
        <path d="M12 4a3 3 0 0 0-3 3c0 .8.3 1.5.8 2.1L8 11.5A3.5 3.5 0 0 0 5 15a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4c0-1.5-.9-2.8-2.2-3.4l-.8-2.5A3 3 0 0 0 18 7a3 3 0 0 0-3-3h-3z" fill="none" stroke="#D4FF00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      
      <g transform="translate(48, 0)">
        <text x="0" y="18" fill="#FFFFFF" font-family="Arial" font-size="20" font-weight="bold">${protein}</text>
        <text x="${String(protein).length > 2 ? 38 : 28}" y="18" fill="#8E95A5" font-family="Arial" font-size="14" font-weight="bold">g</text>
        <text x="0" y="32" fill="#717C91" font-family="Arial" font-size="10" font-weight="bold" letter-spacing="0.8">PROTEIN</text>
      </g>
      
      <text x="0" y="50" fill="#5A6578" font-family="Arial" font-size="10.5" font-weight="bold">Target ${targetProt}g</text>
      <rect x="0" y="56" width="160" height="5" rx="2.5" fill="#1C2330"/>
      <rect x="0" y="56" width="${Math.round(160 * (protPercentage / 100))}" height="5" rx="2.5" fill="#D4FF00"/>
    </g>

    <!-- Column 2: Karbo -->
    <g transform="translate(235, 18)">
      <circle cx="18" cy="18" r="18" fill="#121721" stroke="#222B38" stroke-width="1.2"/>
      <g transform="translate(7, 7) scale(0.9)">
        <path d="M12 2v20M8 6c2 1 3 1 4 0M16 8c-2 1-3 1-4 0M8 11c2 1 3 1 4 0M16 13c-2 1-3 1-4 0M8 16c2 1 3 1 4 0M16 18c-2 1-3 1-4 0" fill="none" stroke="#D4FF00" stroke-width="1.8" stroke-linecap="round"/>
      </g>

      <g transform="translate(48, 0)">
        <text x="0" y="18" fill="#FFFFFF" font-family="Arial" font-size="20" font-weight="bold">${carbs}</text>
        <text x="${String(carbs).length > 2 ? 38 : 28}" y="18" fill="#8E95A5" font-family="Arial" font-size="14" font-weight="bold">g</text>
        <text x="0" y="32" fill="#717C91" font-family="Arial" font-size="10" font-weight="bold" letter-spacing="0.8">KARBO</text>
      </g>

      <text x="0" y="50" fill="#5A6578" font-family="Arial" font-size="10.5" font-weight="bold">Target ${targetCarb}g</text>
      <rect x="0" y="56" width="160" height="5" rx="2.5" fill="#1C2330"/>
      <rect x="0" y="56" width="${Math.round(160 * (carbPercentage / 100))}" height="5" rx="2.5" fill="#D4FF00"/>
    </g>

    <!-- Column 3: Lemak -->
    <g transform="translate(450, 18)">
      <circle cx="18" cy="18" r="18" fill="#121721" stroke="#222B38" stroke-width="1.2"/>
      <g transform="translate(7, 7) scale(0.9)">
        <path d="M12 3c0 0-6 7.5-6 11.5a6 6 0 0 0 12 0c0-4-6-11.5-6-11.5z" fill="none" stroke="#D4FF00" stroke-width="1.8" stroke-linejoin="round"/>
      </g>

      <g transform="translate(48, 0)">
        <text x="0" y="18" fill="#FFFFFF" font-family="Arial" font-size="20" font-weight="bold">${fat}</text>
        <text x="${String(fat).length > 2 ? 38 : 28}" y="18" fill="#8E95A5" font-family="Arial" font-size="14" font-weight="bold">g</text>
        <text x="0" y="32" fill="#717C91" font-family="Arial" font-size="10" font-weight="bold" letter-spacing="0.8">LEMAK</text>
      </g>

      <text x="0" y="50" fill="#5A6578" font-family="Arial" font-size="10.5" font-weight="bold">Target ${targetFat}g</text>
      <rect x="0" y="56" width="160" height="5" rx="2.5" fill="#1C2330"/>
      <rect x="0" y="56" width="${Math.round(160 * (fatPercentage / 100))}" height="5" rx="2.5" fill="#D4FF00"/>
    </g>
  </g>

  <!-- 7. COACH GYM BUDDY AI INSIGHT SECTION -->
  <g id="coachCard" transform="translate(${paddingX}, ${coachCardY})">
    <rect width="${contentWidth}" height="${coachCardHeight}" rx="18" fill="#0C0E14" stroke="#1C2330" stroke-width="1.2"/>

    <g transform="translate(18, 16)">
      <rect width="54" height="54" rx="14" fill="#121721" stroke="#222B38" stroke-width="1.2"/>
      <g transform="translate(4, 0) scale(0.75)">
        <path d="M30.6 32.0694L34.2 27.7639H46.6L39.8 38.0972L26.6 44.9861L36.6 32.0694H30.6Z" fill="#D4FF00" />
        <path d="M51 17H27C25.9333 17 23.4 17.775 21.8 20.875C20.2 23.975 15.2667 34.5093 13 39.3889H25L21 48L23.4 46.7083L32.6 34.2222H22.6C22.0667 34.3657 21.24 34.1361 22.2 32.0694C23.16 30.0028 25 25.7546 25.8 23.8889C26.0667 23.3148 26.84 22.1667 27.8 22.1667H38.6L35.8 26.0417H43.4L51 17Z" fill="#FFFFFF" />
      </g>
      <rect x="34" y="38" width="18" height="12" rx="3" fill="#D4FF00"/>
      <text x="37" y="47" fill="#000000" font-family="Arial" font-size="8.5" font-weight="bold">AI</text>
    </g>

    <g transform="translate(86, 22)">
      <text x="0" y="8" fill="#D4FF00" font-family="Arial" font-size="11" font-weight="bold" letter-spacing="1">GYM BUDDY AI</text>
      <text x="0" y="28" fill="#FFFFFF" font-family="Arial" font-size="16" font-weight="bold">You&apos;re on track!</text>
      <text x="0" y="46" fill="#8E95A5" font-family="Arial" font-size="12.5">${escapeXml(coachMessage)}</text>
    </g>

    <g transform="translate(${contentWidth - 46}, 28)">
      <path d="M14 2l1.5 4 4 1.5-4 1.5L14 13l-1.5-4-4-1.5 4-1.5L14 2z" fill="#D4FF00"/>
      <path d="M6 14l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5z" fill="#D4FF00"/>
    </g>
  </g>

  <!-- 8. FOOTER DISCLAIMER -->
  <g id="footerDisclaimer" transform="translate(${canvasWidth / 2 - 170}, ${footerY})">
    <circle cx="8" cy="8" r="7" fill="none" stroke="#4A5568" stroke-width="1.2"/>
    <text x="8" y="11.5" text-anchor="middle" fill="#4A5568" font-family="Arial" font-size="9" font-weight="bold">i</text>
    <text x="22" y="12" fill="#5A6578" font-family="Arial" font-size="11.5">Nilai gizi merupakan estimasi berdasarkan analisis AI.</text>
  </g>
</svg>`;
}

const cardData = {
  foodName: "NASI KOTAK: AYAM SUWIR BUMBU KUNING, TUMIS BUNGA PEPAYA, DLL",
  calories: 785,
  protein: 38,
  carbs: 95,
  fat: 28,
  mealType: "Lunch",
  dateStr: "Kam, 20 Agu",
  dailyTargetCalories: 2054,
  consumedTodayCalories: 785,
  dailyTargetProtein: 150,
  dailyTargetCarbs: 275,
  dailyTargetFat: 67,
  insight: "Konsistensi kecil, hasil besar."
};

const svg = generateNutritionCardSvg(cardData);
const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: 720 },
  font: {
    fontBuffers,
    defaultFontFamily: "Arial",
    loadSystemFonts: false // ensure container always uses bundled fontBuffers!
  }
});
const png = resvg.render().asPng();
fs.writeFileSync('full_card_test.png', png);
console.log('FULL CARD GENERATED! PNG SIZE:', png.length);
