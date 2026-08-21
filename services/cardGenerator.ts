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

function escapeXml(unsafe: string): string {
  return (unsafe || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function generateNutritionCardSvg(data: NutritionCardData): string {
  const foodTitle = (data.foodName || "MAKANAN BERGIZI").toUpperCase().trim();
  const calories = Math.round(Number(data.calories) || 0);
  const protein = Math.round(Number(data.protein) || 0);
  const carbs = Math.round(Number(data.carbs) || 0);
  const fat = Math.round(Number(data.fat) || 0);

  const mealType = data.mealType || "Makan Siang";
  const dateStr = data.dateStr || new Date().toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });

  const targetCal = Math.round(Number(data.dailyTargetCalories) || 2054);
  const consumedCal = Math.round(Number(data.consumedTodayCalories) || calories);
  const remainingCal = targetCal - consumedCal;

  const isOntrack = remainingCal >= 0;
  const pillText = isOntrack 
    ? `On Track · Sisa ${remainingCal.toLocaleString("id-ID")} kcal` 
    : `Over Target · +${Math.abs(remainingCal).toLocaleString("id-ID")} kcal`;
  
  const pillBg = isOntrack ? "#166534" : "#991B1B";
  const pillBorder = isOntrack ? "#22C55E" : "#EF4444";
  const pillTextColor = isOntrack ? "#86EFAC" : "#FCA5A5";

  // Split title if long
  const words = foodTitle.split(/\s+/);
  let line1 = "";
  let line2 = "";
  for (const w of words) {
    if ((line1 + " " + w).length <= 24 && !line2) {
      line1 = (line1 + " " + w).trim();
    } else {
      line2 = (line2 + " " + w).trim();
    }
  }
  if (!line1) line1 = foodTitle;
  if (line2.length > 26) line2 = line2.substring(0, 23) + "...";
  const hasLine2 = Boolean(line2);

  const photoHref = data.imageBufferOrBase64 || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80";
  const photoHeight = 440;
  const photoY = 160;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="720" height="1080" viewBox="0 0 720 1080">
  <defs>
    <!-- Gradients -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B0F17"/>
      <stop offset="50%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#030712"/>
    </linearGradient>

    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1F2937"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>

    <linearGradient id="calGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FF5722"/>
      <stop offset="100%" stop-color="#FFA116"/>
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

    <filter id="cardShadow" x="-5%" y="-5%" width="110%" height="115%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
  </defs>

  <!-- Deep Obsidian Bento Background -->
  <rect width="720" height="1080" fill="url(#bgGrad)"/>

  <!-- Top Header Bar -->
  <g id="header">
    <rect x="40" y="45" width="200" height="46" rx="23" fill="#1F2937" stroke="#374151" stroke-width="1.5"/>
    <circle cx="64" cy="68" r="8" fill="#22C55E"/>
    <text x="82" y="74" font-family="sans-serif" font-size="20" font-weight="900" fill="#FFFFFF">GYMBUDDY<tspan fill="#22C55E">.AI</tspan></text>

    <!-- Date & Meal Badge -->
    <rect x="450" y="45" width="230" height="46" rx="23" fill="#1F2937" stroke="#374151" stroke-width="1.5"/>
    <text x="565" y="74" font-family="sans-serif" font-size="16" font-weight="700" fill="#9CA3AF" text-anchor="middle">🍽️ ${escapeXml(mealType)} · ${escapeXml(dateStr)}</text>
  </g>

  <!-- Food Title Box -->
  <g id="titleBox">
    <text x="44" y="125" font-family="sans-serif" font-size="26" font-weight="900" fill="#F3F4F6">${escapeXml(line1)}</text>
    ${hasLine2 ? `<text x="44" y="152" font-family="sans-serif" font-size="22" font-weight="800" fill="#9CA3AF">${escapeXml(line2)}</text>` : ""}
  </g>

  <!-- Food Photo Card with Glow Border -->
  <g id="photoCard" filter="url(#cardShadow)">
    <rect x="40" y="${photoY}" width="640" height="${photoHeight}" rx="28" ry="28" fill="#1F2937" stroke="#374151" stroke-width="2"/>
    <image href="${escapeXml(photoHref)}" xlink:href="${escapeXml(photoHref)}" x="40" y="${photoY}" width="640" height="${photoHeight}" preserveAspectRatio="xMidYMid slice" clip-path="url(#foodPhotoClip)"/>

    <!-- Bottom Photo Dark Gradient Scrim -->
    <rect x="40" y="${photoY + photoHeight - 90}" width="640" height="90" fill="black" opacity="0.4" clip-path="url(#foodPhotoClip)"/>

    <!-- Floating Status Pill Badge -->
    <rect x="60" y="${photoY + photoHeight - 60}" width="${pillText.length * 10 + 40}" height="42" rx="21" ry="21" fill="${pillBg}" stroke="${pillBorder}" stroke-width="1.5"/>
    <circle cx="80" cy="${photoY + photoHeight - 39}" r="5" fill="${pillBorder}"/>
    <text x="94" y="${photoY + photoHeight - 33}" font-family="sans-serif" font-size="15" font-weight="800" fill="${pillTextColor}">${escapeXml(pillText)}</text>
  </g>

  <!-- Calorie Hero Bento Card -->
  <g id="calorieBento" transform="translate(40, 630)" filter="url(#cardShadow)">
    <rect x="0" y="0" width="640" height="135" rx="24" ry="24" fill="url(#cardGrad)" stroke="#374151" stroke-width="1.5"/>
    
    <!-- Left: Calorie Big Stat -->
    <text x="28" y="42" font-family="sans-serif" font-size="14" font-weight="800" fill="#9CA3AF" letter-spacing="1">ENERGI MAKANAN INI</text>
    <text x="26" y="102" font-family="sans-serif" font-size="58" font-weight="900" fill="url(#calGrad)">${calories.toLocaleString("id-ID")}</text>
    <text x="${String(calories).length * 36 + 42}" y="76" font-family="sans-serif" font-size="22" font-weight="900" fill="#FF5722">KCAL</text>

    <!-- Right: Daily Target & Progress -->
    <rect x="400" y="24" width="216" height="86" rx="16" ry="16" fill="#0B0F17" stroke="#374151" stroke-width="1"/>
    <text x="418" y="52" font-family="sans-serif" font-size="13" font-weight="700" fill="#9CA3AF">TARGET HARIAN</text>
    <text x="418" y="88" font-family="sans-serif" font-size="28" font-weight="900" fill="#F9FAFB">${targetCal.toLocaleString("id-ID")} <tspan font-size="14" font-weight="700" fill="#6B7280">kcal</tspan></text>
  </g>

  <!-- Macro Breakdown Bento Grid (3 Pillars) -->
  <g id="macroGrid" transform="translate(40, 790)" filter="url(#cardShadow)">
    <!-- 1. Protein Pillar -->
    <g transform="translate(0, 0)">
      <rect x="0" y="0" width="200" height="190" rx="22" ry="22" fill="url(#cardGrad)" stroke="#F59E0B" stroke-width="1.5" stroke-opacity="0.6"/>
      <circle cx="42" cy="42" r="18" fill="#78350F"/>
      <text x="42" y="48" font-family="sans-serif" font-size="18" text-anchor="middle">🍗</text>
      <text x="70" y="48" font-family="sans-serif" font-size="16" font-weight="800" fill="#F59E0B">PROTEIN</text>
      <text x="24" y="115" font-family="sans-serif" font-size="44" font-weight="900" fill="#FEF3C7">${protein}<tspan font-size="20" font-weight="700" fill="#F59E0B">g</tspan></text>
      <rect x="24" y="145" width="152" height="8" rx="4" fill="#374151"/>
      <rect x="24" y="145" width="${Math.min(152, Math.round((protein / 150) * 152))}" height="8" rx="4" fill="url(#protGrad)"/>
      <text x="24" y="172" font-family="sans-serif" font-size="12" font-weight="700" fill="#9CA3AF">Otot &amp; Pemulihan</text>
    </g>

    <!-- 2. Karbohidrat Pillar -->
    <g transform="translate(220, 0)">
      <rect x="0" y="0" width="200" height="190" rx="22" ry="22" fill="url(#cardGrad)" stroke="#EC4899" stroke-width="1.5" stroke-opacity="0.6"/>
      <circle cx="42" cy="42" r="18" fill="#831843"/>
      <text x="42" y="48" font-family="sans-serif" font-size="18" text-anchor="middle">🍚</text>
      <text x="70" y="48" font-family="sans-serif" font-size="16" font-weight="800" fill="#EC4899">KARBO</text>
      <text x="24" y="115" font-family="sans-serif" font-size="44" font-weight="900" fill="#FCE7F3">${carbs}<tspan font-size="20" font-weight="700" fill="#EC4899">g</tspan></text>
      <rect x="24" y="145" width="152" height="8" rx="4" fill="#374151"/>
      <rect x="24" y="145" width="${Math.min(152, Math.round((carbs / 250) * 152))}" height="8" rx="4" fill="url(#carbGrad)"/>
      <text x="24" y="172" font-family="sans-serif" font-size="12" font-weight="700" fill="#9CA3AF">Sumber Energi</text>
    </g>

    <!-- 3. Lemak Pillar -->
    <g transform="translate(440, 0)">
      <rect x="0" y="0" width="200" height="190" rx="22" ry="22" fill="url(#cardGrad)" stroke="#06B6D4" stroke-width="1.5" stroke-opacity="0.6"/>
      <circle cx="42" cy="42" r="18" fill="#164E63"/>
      <text x="42" y="48" font-family="sans-serif" font-size="18" text-anchor="middle">🥑</text>
      <text x="70" y="48" font-family="sans-serif" font-size="16" font-weight="800" fill="#06B6D4">LEMAK</text>
      <text x="24" y="115" font-family="sans-serif" font-size="44" font-weight="900" fill="#E0F2FE">${fat}<tspan font-size="20" font-weight="700" fill="#06B6D4">g</tspan></text>
      <rect x="24" y="145" width="152" height="8" rx="4" fill="#374151"/>
      <rect x="24" y="145" width="${Math.min(152, Math.round((fat / 80) * 152))}" height="8" rx="4" fill="url(#fatGrad)"/>
      <text x="24" y="172" font-family="sans-serif" font-size="12" font-weight="700" fill="#9CA3AF">Hormon &amp; Sendi</text>
    </g>
  </g>

  <!-- Bottom Brand Footer -->
  <text x="360" y="1035" font-family="sans-serif" font-size="14" font-weight="700" fill="#6B7280" text-anchor="middle">Powered by GymBuddy AI · Smart Nutrition &amp; Fitness</text>
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
