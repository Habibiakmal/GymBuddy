export interface NutritionCardData {
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealType?: string;
  dateStr?: string;
  dailyTargetCalories?: number;
  consumedTodayCalories?: number;
  imageBufferOrBase64?: string; // Data URI (data:image/jpeg;base64,...) or image URL
}

const GLYPH_PATHS: Record<string, string> = {
  // Numbers
  '0': 'M 20 0 L 80 0 Q 100 0 100 20 L 100 100 Q 100 120 80 120 L 20 120 Q 0 120 0 100 L 0 20 Q 0 0 20 0 Z M 28 24 L 28 96 Q 28 100 32 100 L 68 100 Q 72 100 72 96 L 72 24 Q 72 20 68 20 L 32 20 Q 28 20 28 24 Z',
  '1': 'M 35 0 L 65 0 L 65 120 L 35 120 Z M 15 30 L 35 0 L 65 0 L 15 30 Z',
  '2': 'M 0 20 Q 0 0 50 0 Q 100 0 100 35 Q 100 65 50 85 L 28 98 L 100 98 L 100 120 L 0 120 L 0 95 L 55 60 Q 75 45 75 32 Q 75 20 50 20 Q 28 20 28 32 L 0 32 Q 0 20 0 20 Z',
  '3': 'M 0 0 L 95 0 L 95 22 L 45 48 L 70 48 Q 100 48 100 84 Q 100 120 50 120 Q 0 120 0 85 L 28 85 Q 28 98 50 98 Q 72 98 72 84 Q 72 70 50 70 L 25 70 L 25 48 L 60 22 L 0 22 Z',
  '4': 'M 70 0 L 100 0 L 100 120 L 70 120 L 70 90 L 0 90 L 0 65 L 65 0 L 70 0 Z M 30 68 L 70 68 L 70 28 Z',
  '5': 'M 0 0 L 95 0 L 95 22 L 28 22 L 28 48 Q 45 45 65 45 Q 100 45 100 82 Q 100 120 50 120 Q 0 120 0 88 L 28 88 Q 28 98 50 98 Q 72 98 72 82 Q 72 66 50 66 Q 35 66 25 72 L 0 50 Z',
  '6': 'M 50 0 Q 100 0 95 32 L 68 32 Q 70 20 50 20 Q 28 20 28 45 Q 40 40 60 40 Q 100 40 100 80 Q 100 120 50 120 Q 0 120 0 60 Q 0 0 50 0 Z M 28 80 Q 28 98 50 98 Q 72 98 72 80 Q 72 62 50 62 Q 28 62 28 80 Z',
  '7': 'M 0 0 L 100 0 L 100 22 L 45 120 L 15 120 L 68 22 L 0 22 Z',
  '8': 'M 50 0 Q 95 0 95 32 Q 95 50 75 58 Q 100 68 100 88 Q 100 120 50 120 Q 0 120 0 88 Q 0 68 25 58 Q 5 50 5 32 Q 5 0 50 0 Z M 50 20 Q 28 20 28 32 Q 28 45 50 45 Q 72 45 72 32 Q 72 20 50 20 Z M 50 68 Q 28 68 28 88 Q 28 100 50 100 Q 72 100 72 88 Q 72 68 50 68 Z',
  '9': 'M 50 120 Q 0 120 5 88 L 32 88 Q 30 100 50 100 Q 72 100 72 75 Q 60 80 40 80 Q 0 80 0 40 Q 0 0 50 0 Q 100 0 100 60 Q 100 120 50 120 Z M 72 40 Q 72 22 50 22 Q 28 22 28 40 Q 28 58 50 58 Q 72 58 72 40 Z',
  
  // Letters
  'A': 'M 50 0 L 100 120 L 72 120 L 58 85 L 42 85 L 28 120 L 0 120 Z M 50 30 L 44 65 L 56 65 Z',
  'B': 'M 0 0 L 70 0 Q 100 0 100 30 Q 100 52 75 58 Q 100 65 100 90 Q 100 120 70 120 L 0 120 Z M 26 22 L 26 48 L 65 48 Q 74 48 74 35 Q 74 22 65 22 Z M 26 70 L 26 98 L 68 98 Q 74 98 74 84 Q 74 70 68 70 Z',
  'C': 'M 85 24 L 65 38 Q 60 22 45 22 Q 26 22 26 60 Q 26 98 45 98 Q 60 98 68 82 L 88 96 Q 75 120 45 120 Q 0 120 0 60 Q 0 0 45 0 Q 75 0 85 24 Z',
  'D': 'M 0 0 L 60 0 Q 100 0 100 60 Q 100 120 60 120 L 0 120 Z M 26 22 L 26 98 L 58 98 Q 74 98 74 60 Q 74 22 58 22 Z',
  'E': 'M 0 0 L 95 0 L 95 24 L 26 24 L 26 48 L 85 48 L 85 70 L 26 70 L 26 96 L 95 96 L 95 120 L 0 120 Z',
  'F': 'M 0 0 L 95 0 L 95 24 L 26 24 L 26 48 L 85 48 L 85 70 L 26 70 L 26 120 L 0 120 Z',
  'G': 'M 85 24 L 65 38 Q 60 22 45 22 Q 26 22 26 60 Q 26 98 45 98 Q 65 98 72 75 L 50 75 L 50 55 L 98 55 L 98 100 Q 75 120 45 120 Q 0 120 0 60 Q 0 0 45 0 Q 75 0 85 24 Z',
  'H': 'M 0 0 L 26 0 L 26 48 L 74 48 L 74 0 L 100 0 L 100 120 L 74 120 L 74 72 L 26 72 L 26 120 L 0 120 Z',
  'I': 'M 0 0 L 32 0 L 32 120 L 0 120 Z',
  'J': 'M 70 0 L 96 0 L 96 90 Q 96 120 50 120 Q 10 120 4 90 L 30 84 Q 34 98 50 98 Q 70 98 70 85 Z',
  'K': 'M 0 0 L 26 0 L 26 50 L 72 0 L 100 0 L 48 58 L 100 120 L 72 120 L 26 68 L 26 120 L 0 120 Z',
  'L': 'M 0 0 L 26 0 L 26 96 L 95 96 L 95 120 L 0 120 Z',
  'M': 'M 0 0 L 30 0 L 50 65 L 70 0 L 100 0 L 100 120 L 75 120 L 75 40 L 58 95 L 42 95 L 25 40 L 25 120 L 0 120 Z',
  'N': 'M 0 0 L 26 0 L 74 80 L 74 0 L 100 0 L 100 120 L 74 120 L 26 40 L 26 120 L 0 120 Z',
  'O': 'M 45 0 Q 100 0 100 60 Q 100 120 45 120 Q 0 120 0 60 Q 0 0 45 0 Z M 45 22 Q 26 22 26 60 Q 26 98 45 98 Q 74 98 74 60 Q 74 22 45 22 Z',
  'P': 'M 0 0 L 70 0 Q 100 0 100 40 Q 100 75 70 75 L 26 75 L 26 120 L 0 120 Z M 26 22 L 26 53 L 65 53 Q 74 53 74 38 Q 74 22 65 22 Z',
  'Q': 'M 45 0 Q 100 0 100 60 Q 100 120 45 120 Q 0 120 0 60 Q 0 0 45 0 Z M 45 22 Q 26 22 26 60 Q 26 98 45 98 Q 74 98 74 60 Q 74 22 45 22 Z M 65 85 L 90 120 L 105 105 L 80 75 Z',
  'R': 'M 0 0 L 70 0 Q 100 0 100 38 Q 100 65 75 68 L 100 120 L 72 120 L 52 70 L 26 70 L 26 120 L 0 120 Z M 26 22 L 26 48 L 65 48 Q 74 48 74 35 Q 74 22 65 22 Z',
  'S': 'M 85 24 L 65 38 Q 60 22 45 22 Q 26 22 26 35 Q 26 50 65 58 Q 100 65 100 90 Q 100 120 50 120 Q 15 120 0 95 L 22 80 Q 30 98 50 98 Q 74 98 74 85 Q 74 70 35 62 Q 0 55 0 32 Q 0 0 45 0 Q 75 0 85 24 Z',
  'T': 'M 0 0 L 100 0 L 100 24 L 63 24 L 63 120 L 37 120 L 37 24 L 0 24 Z',
  'U': 'M 0 0 L 26 0 L 26 80 Q 26 98 50 98 Q 74 98 74 80 L 74 0 L 100 0 L 100 80 Q 100 120 50 120 Q 0 120 0 80 Z',
  'V': 'M 0 0 L 28 0 L 50 85 L 72 0 L 100 0 L 64 120 L 36 120 Z',
  'W': 'M 0 0 L 24 0 L 38 75 L 50 20 L 62 75 L 76 0 L 100 0 L 80 120 L 58 120 L 50 65 L 42 120 L 20 120 Z',
  'X': 'M 0 0 L 30 0 L 50 45 L 70 0 L 100 0 L 68 60 L 100 120 L 70 120 L 50 75 L 30 120 L 0 120 L 32 60 Z',
  'Y': 'M 0 0 L 30 0 L 50 50 L 70 0 L 100 0 L 64 68 L 64 120 L 36 120 L 36 68 Z',
  'Z': 'M 0 0 L 95 0 L 95 24 L 35 96 L 95 96 L 95 120 L 0 120 L 0 96 L 60 24 L 0 24 Z',
  
  // Symbols
  '.': 'M 0 96 L 24 96 L 24 120 L 0 120 Z',
  ',': 'M 10 96 L 30 96 L 15 130 L 0 120 Z',
  ':': 'M 0 30 L 24 30 L 24 54 L 0 54 Z M 0 96 L 24 96 L 24 120 L 0 120 Z',
  '·': 'M 0 45 L 24 45 L 24 69 L 0 69 Z',
  '-': 'M 0 50 L 60 50 L 60 70 L 0 70 Z',
  '+': 'M 35 15 L 65 15 L 65 45 L 95 45 L 95 75 L 65 75 L 65 105 L 35 105 L 35 75 L 5 75 L 5 45 L 35 45 Z',
  '&': 'M 80 100 Q 55 120 35 120 Q 0 120 0 85 Q 0 60 30 45 Q 15 35 15 18 Q 15 0 40 0 Q 65 0 65 20 Q 65 38 40 50 L 70 85 L 90 65 L 105 80 L 80 100 Z M 35 98 Q 50 98 55 85 L 30 58 Q 22 68 22 80 Q 22 98 35 98 Z M 40 20 Q 30 20 30 25 Q 30 32 38 38 Q 45 32 45 25 Q 45 20 40 20 Z',
  '(': 'M 50 0 Q 15 60 50 120 L 25 120 Q -10 60 25 0 Z',
  ')': 'M 0 0 Q 35 60 0 120 L 25 120 Q 60 60 25 0 Z',
  '/': 'M 75 0 L 100 0 L 25 120 L 0 120 Z',
  ' ': ' '
};

function renderVectorText(text: string, x: number, y: number, height: number, fill = '#FFFFFF', letterSpacing = 0.15): string {
  const str = String(text || "").toUpperCase();
  const scale = height / 120;
  const standardWidth = 100 * scale;
  let currentX = x;
  let paths = '';

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === ' ') {
      currentX += standardWidth * 0.45;
      continue;
    }

    const glyph = GLYPH_PATHS[char];
    let glyphWidth = standardWidth;
    if (char === 'I' || char === '.' || char === ':' || char === '·' || char === ',') {
      glyphWidth = 32 * scale;
    } else if (char === 'W' || char === 'M') {
      glyphWidth = 110 * scale;
    }

    if (glyph && glyph.trim()) {
      paths += `<path d="${glyph}" transform="translate(${currentX.toFixed(1)}, ${y.toFixed(1)}) scale(${scale.toFixed(4)})" fill="${fill}"/>\n`;
    }

    currentX += glyphWidth + (standardWidth * letterSpacing);
  }

  return paths;
}

function calculateVectorTextWidth(text: string, height: number, letterSpacing = 0.15): number {
  const str = String(text || "").toUpperCase();
  const scale = height / 120;
  const standardWidth = 100 * scale;
  let w = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === ' ') {
      w += standardWidth * 0.45;
      continue;
    }
    let glyphWidth = standardWidth;
    if (char === 'I' || char === '.' || char === ':' || char === '·' || char === ',') {
      glyphWidth = 32 * scale;
    } else if (char === 'W' || char === 'M') {
      glyphWidth = 110 * scale;
    }
    w += glyphWidth + (standardWidth * letterSpacing);
  }
  return w;
}

export function generateNutritionCardSvg(data: NutritionCardData): string {
  const foodTitle = (data.foodName || "MAKANAN BERGIZI").toUpperCase().trim();
  const calories = Math.round(Number(data.calories) || 0);
  const protein = Math.round(Number(data.protein) || 0);
  const carbs = Math.round(Number(data.carbs) || 0);
  const fat = Math.round(Number(data.fat) || 0);

  const mealType = (data.mealType || "MAKAN SIANG").toUpperCase();
  const dateStr = (data.dateStr || new Date().toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })).toUpperCase();

  const targetCal = Math.round(Number(data.dailyTargetCalories) || 2054);
  const consumedCal = Math.round(Number(data.consumedTodayCalories) || calories);
  const remainingCal = targetCal - consumedCal;

  const isOntrack = remainingCal >= 0;
  const pillText = isOntrack 
    ? `ON TRACK · SISA ${remainingCal.toLocaleString("id-ID")} KCAL` 
    : `OVER TARGET +${Math.abs(remainingCal).toLocaleString("id-ID")} KCAL`;
  
  const pillBg = isOntrack ? "#14532D" : "#7F1D1D";
  const pillBorder = isOntrack ? "#22C55E" : "#EF4444";
  const pillTextColor = isOntrack ? "#86EFAC" : "#FCA5A5";

  // Split food title if long
  const words = foodTitle.split(/\s+/);
  let line1 = "";
  let line2 = "";
  for (const w of words) {
    if ((line1 + " " + w).length <= 22 && !line2) {
      line1 = (line1 + " " + w).trim();
    } else {
      line2 = (line2 + " " + w).trim();
    }
  }
  if (!line1) line1 = foodTitle;
  if (line2.length > 24) line2 = line2.substring(0, 21) + "...";
  const hasLine2 = Boolean(line2);

  const photoHref = data.imageBufferOrBase64 || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80";
  const photoHeight = 440;
  const photoY = 160;

  const pillWidth = calculateVectorTextWidth(pillText, 14, 0.15) + 48;
  const headerRightText = `${mealType} · ${dateStr}`;
  const headerRightWidth = calculateVectorTextWidth(headerRightText, 13, 0.15) + 36;
  const headerRightX = 680 - headerRightWidth;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="720" height="1080" viewBox="0 0 720 1080">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#070A0F"/>
      <stop offset="50%" stop-color="#0F172A"/>
      <stop offset="100%" stop-color="#030712"/>
    </linearGradient>

    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1E293B"/>
      <stop offset="100%" stop-color="#0F172A"/>
    </linearGradient>

    <linearGradient id="calGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FF5722"/>
      <stop offset="100%" stop-color="#F59E0B"/>
    </linearGradient>

    <linearGradient id="protGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#D97706"/>
    </linearGradient>

    <linearGradient id="carbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#EC4899"/>
      <stop offset="100%" stop-color="#BE185D"/>
    </linearGradient>

    <linearGradient id="fatGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06B6D4"/>
      <stop offset="100%" stop-color="#0284C7"/>
    </linearGradient>

    <clipPath id="foodPhotoClip">
      <rect x="40" y="${photoY}" width="640" height="${photoHeight}" rx="28" ry="28"/>
    </clipPath>
  </defs>

  <!-- Deep Obsidian Bento Background -->
  <rect width="720" height="1080" fill="url(#bgGrad)"/>

  <!-- Top Header Bar -->
  <g id="header">
    <rect x="40" y="45" width="220" height="46" rx="23" fill="#1E293B" stroke="#334155" stroke-width="1.5"/>
    <circle cx="64" cy="68" r="8" fill="#22C55E"/>
    ${renderVectorText("GYMBUDDY", 82, 58, 20, "#FFFFFF")}
    ${renderVectorText(".AI", 188, 58, 20, "#22C55E")}

    <!-- Date & Meal Badge -->
    <rect x="${headerRightX}" y="45" width="${headerRightWidth}" height="46" rx="23" fill="#1E293B" stroke="#334155" stroke-width="1.5"/>
    ${renderVectorText(headerRightText, headerRightX + 18, 62, 13, "#94A3B8")}
  </g>

  <!-- Food Title Box -->
  <g id="titleBox">
    ${renderVectorText(line1, 44, 115, 25, "#F8FAFC")}
    ${hasLine2 ? renderVectorText(line2, 44, 145, 20, "#94A3B8") : ""}
  </g>

  <!-- Food Photo Card with Border -->
  <g id="photoCard">
    <rect x="40" y="${photoY}" width="640" height="${photoHeight}" rx="28" ry="28" fill="#1E293B" stroke="#334155" stroke-width="2"/>
    <image href="${photoHref}" xlink:href="${photoHref}" x="40" y="${photoY}" width="640" height="${photoHeight}" preserveAspectRatio="xMidYMid slice" clip-path="url(#foodPhotoClip)"/>

    <!-- Bottom Photo Dark Gradient Scrim -->
    <rect x="40" y="${photoY + photoHeight - 90}" width="640" height="90" fill="#000000" opacity="0.5" clip-path="url(#foodPhotoClip)"/>

    <!-- Floating Status Pill Badge -->
    <rect x="60" y="${photoY + photoHeight - 60}" width="${pillWidth}" height="42" rx="21" ry="21" fill="${pillBg}" stroke="${pillBorder}" stroke-width="1.5"/>
    <circle cx="80" cy="${photoY + photoHeight - 39}" r="5" fill="${pillBorder}"/>
    ${renderVectorText(pillText, 94, photoY + photoHeight - 47, 14, pillTextColor)}
  </g>

  <!-- Calorie Hero Bento Card -->
  <g id="calorieBento" transform="translate(40, 630)">
    <rect x="0" y="0" width="640" height="135" rx="24" ry="24" fill="url(#cardGrad)" stroke="#334155" stroke-width="1.5"/>
    
    <!-- Left: Calorie Stat -->
    ${renderVectorText("ENERGI MAKANAN INI", 28, 22, 13, "#94A3B8")}
    ${renderVectorText(calories.toLocaleString("id-ID"), 26, 52, 54, "#FF5722")}
    ${renderVectorText("KCAL", 26 + calculateVectorTextWidth(calories.toLocaleString("id-ID"), 54, 0.15) + 14, 66, 26, "#FF5722")}

    <!-- Right: Daily Target Box -->
    <rect x="390" y="24" width="226" height="86" rx="16" ry="16" fill="#0B0F17" stroke="#334155" stroke-width="1"/>
    ${renderVectorText("TARGET HARIAN", 410, 38, 12, "#94A3B8")}
    ${renderVectorText(`${targetCal.toLocaleString("id-ID")} KCAL`, 410, 62, 24, "#F8FAFC")}
  </g>

  <!-- Macro Breakdown Bento Grid (3 Pillars) -->
  <g id="macroGrid" transform="translate(40, 790)">
    <!-- 1. Protein Pillar -->
    <g transform="translate(0, 0)">
      <rect x="0" y="0" width="200" height="190" rx="22" ry="22" fill="url(#cardGrad)" stroke="#F59E0B" stroke-width="1.5" stroke-opacity="0.6"/>
      <circle cx="34" cy="36" r="14" fill="#78350F"/>
      ${renderVectorText("P", 29, 27, 18, "#F59E0B")}
      ${renderVectorText("PROTEIN", 58, 28, 15, "#F59E0B")}
      ${renderVectorText(`${protein}G`, 24, 75, 42, "#FEF3C7")}
      <rect x="24" y="138" width="152" height="8" rx="4" fill="#334155"/>
      <rect x="24" y="138" width="${Math.min(152, Math.max(8, Math.round((protein / 150) * 152)))}" height="8" rx="4" fill="url(#protGrad)"/>
      ${renderVectorText("OTOT & PEMULIHAN", 24, 158, 11, "#94A3B8")}
    </g>

    <!-- 2. Karbohidrat Pillar -->
    <g transform="translate(220, 0)">
      <rect x="0" y="0" width="200" height="190" rx="22" ry="22" fill="url(#cardGrad)" stroke="#EC4899" stroke-width="1.5" stroke-opacity="0.6"/>
      <circle cx="34" cy="36" r="14" fill="#831843"/>
      ${renderVectorText("C", 29, 27, 18, "#EC4899")}
      ${renderVectorText("KARBO", 58, 28, 15, "#EC4899")}
      ${renderVectorText(`${carbs}G`, 24, 75, 42, "#FCE7F3")}
      <rect x="24" y="138" width="152" height="8" rx="4" fill="#334155"/>
      <rect x="24" y="138" width="${Math.min(152, Math.max(8, Math.round((carbs / 250) * 152)))}" height="8" rx="4" fill="url(#carbGrad)"/>
      ${renderVectorText("SUMBER ENERGI", 24, 158, 11, "#94A3B8")}
    </g>

    <!-- 3. Lemak Pillar -->
    <g transform="translate(440, 0)">
      <rect x="0" y="0" width="200" height="190" rx="22" ry="22" fill="url(#cardGrad)" stroke="#06B6D4" stroke-width="1.5" stroke-opacity="0.6"/>
      <circle cx="34" cy="36" r="14" fill="#164E63"/>
      ${renderVectorText("F", 29, 27, 18, "#06B6D4")}
      ${renderVectorText("LEMAK", 58, 28, 15, "#06B6D4")}
      ${renderVectorText(`${fat}G`, 24, 75, 42, "#E0F2FE")}
      <rect x="24" y="138" width="152" height="8" rx="4" fill="#334155"/>
      <rect x="24" y="138" width="${Math.min(152, Math.max(8, Math.round((fat / 80) * 152)))}" height="8" rx="4" fill="url(#fatGrad)"/>
      ${renderVectorText("HORMON & SENDI", 24, 158, 11, "#94A3B8")}
    </g>
  </g>

  <!-- Bottom Brand Footer -->
  <g transform="translate(190, 1030)">
    ${renderVectorText("POWERED BY GYMBUDDY AI", 0, 0, 13, "#64748B")}
  </g>
</svg>`;
}

export async function generateNutritionCardPng(data: NutritionCardData): Promise<Buffer> {
  const svg = generateNutritionCardSvg(data);
  try {
    const { Resvg } = await import("@resvg/resvg-js");
    const resvg = new Resvg(svg, {
      fitTo: {
        mode: "width",
        value: 720
      }
    });
    return resvg.render().asPng();
  } catch (e) {
    return Buffer.from(svg);
  }
}
