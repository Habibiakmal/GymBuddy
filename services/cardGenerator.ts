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

function wrapTitleLines(text: string, maxLenPerLine: number = 32, maxLines: number = 2): string[] {
  const clean = text.trim().toUpperCase();
  if (clean.length <= maxLenPerLine) return [clean];
  
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const w of words) {
    if ((currentLine + " " + w).trim().length <= maxLenPerLine) {
      currentLine = (currentLine + " " + w).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = w;
      if (lines.length === maxLines - 1) break;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  // Add ellipsis to last line if truncated
  if (words.length > 0 && lines.length === maxLines) {
    const joined = lines.join(" ");
    if (joined.length < clean.length) {
      lines[lines.length - 1] = lines[lines.length - 1].replace(/\.?\s*$/, "") + "...";
    }
  }

  return lines;
}

export function generateNutritionCardSvg(data: NutritionCardData): string {
  const foodTitle = data.foodName || "MAKANAN BERGIZI";
  const titleLines = wrapTitleLines(foodTitle, 28, 2);

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
    ? `On track · sisa ${remainingCal.toLocaleString("id-ID")} kcal` 
    : `Melebihi target · +${Math.abs(remainingCal).toLocaleString("id-ID")} kcal`;
  
  const pillBg = isOntrack ? "#043927" : "#991B1B";
  const pillTextColor = "#FFFFFF";

  // Use provided base64/URL photo or fallback styled food placeholder pattern
  let imageHref = data.imageBufferOrBase64 || "";
  if (!imageHref) {
    // Generate a sleek food pattern SVG placeholder if no photo provided
    imageHref = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="520" height="420" viewBox="0 0 520 420"><rect width="520" height="420" fill="%231E293B"/><text x="50%25" y="50%25" font-family="sans-serif" font-weight="900" font-size="28" fill="%23D4FF00" text-anchor="middle" dominant-baseline="middle">GYMBUDDY FOOD PHOTO</text></svg>`;
  }

  const titleY = titleLines.length === 1 ? 140 : 125;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="980" viewBox="0 0 600 980">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&amp;family=Inter:wght@400;600;700;900&amp;display=swap');
      .brand-title { font-family: 'Archivo Black', 'Arial Black', sans-serif; font-weight: 900; }
      .header-sub { font-family: 'Inter', sans-serif; font-weight: 700; }
      .food-title { font-family: 'Archivo Black', 'Arial Black', sans-serif; font-weight: 900; }
      .cal-val { font-family: 'Archivo Black', 'Arial Black', sans-serif; font-weight: 900; }
      .macro-val { font-family: 'Archivo Black', 'Arial Black', sans-serif; font-weight: 900; }
      .macro-lbl { font-family: 'Inter', sans-serif; font-weight: 700; }
    </style>

    <clipPath id="imgClip">
      <rect x="40" y="190" width="520" height="410" rx="36" ry="36" />
    </clipPath>

    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.12" />
    </filter>
  </defs>

  <!-- Warm Off-White Cream Canvas Background -->
  <rect width="600" height="980" fill="#FAF6F0" />

  <!-- HEADER -->
  <g transform="translate(40, 55)">
    <!-- GYMBUDDY.AI Logo -->
    <text class="brand-title" font-size="34" fill="#0A0A0A" y="0">
      GYMBUDDY<tspan fill="#25D366">.AI</tspan>
    </text>
    <!-- Right Meal Type & Date -->
    <text class="header-sub" font-size="16" fill="#043927" x="520" y="-4" text-anchor="end">
      ${escapeXml(mealType)} · ${escapeXml(dateStr)}
    </text>
  </g>

  <!-- MULTI-LINE FOOD TITLE -->
  <g transform="translate(40, ${titleY})">
    ${titleLines
      .map(
        (line, idx) =>
          `<text class="food-title" font-size="26" fill="#043927" y="${idx * 34}">${escapeXml(line)}</text>`
      )
      .join("\n    ")}
  </g>

  <!-- FOOD PHOTO CONTAINER -->
  <g filter="url(#shadow)">
    <!-- Main Food Photo -->
    <image href="${escapeXml(imageHref)}" x="40" y="190" width="520" height="410" preserveAspectRatio="xMidYMid slice" clip-path="url(#imgClip)" />
    
    <!-- Top-Right Sparkle Star Overlay -->
    <path d="M545 180 L549 194 L563 198 L549 202 L545 216 L541 202 L527 198 L541 194 Z" fill="#FFC700" />

    <!-- Status Pill Overlay (Bottom-Left of Photo) -->
    <rect x="60" y="535" width="${pillText.length * 9.5 + 40}" height="44" rx="22" fill="${pillBg}" opacity="0.95" />
    <text class="header-sub" font-size="14" fill="${pillTextColor}" x="80" y="562">
      ${escapeXml(pillText)}
    </text>
  </g>

  <!-- CALORIE HERO SECTION -->
  <g transform="translate(40, 675)">
    <!-- Total Calories Value -->
    <text class="cal-val" font-size="76" fill="#FF4500" x="0" y="0">${calories.toLocaleString("id-ID")}</text>
    <text class="cal-val" font-size="28" fill="#FF4500" x="${String(calories).length * 46 + 10}" y="-18">KCAL</text>

    <!-- Daily Target Right-Aligned -->
    <text class="header-sub" font-size="15" fill="#666666" x="520" y="-35" text-anchor="end">Target harian</text>
    <text class="brand-title" font-size="34" fill="#043927" x="520" y="2" text-anchor="end">${targetCal.toLocaleString("id-ID")}</text>
  </g>

  <!-- 3 MACRO BADGES CIRCLES -->
  <g transform="translate(0, 830)">
    <!-- PROTEIN BADGE (Amber/Yellow Circle) -->
    <g transform="translate(120, 0)">
      <circle cx="0" cy="0" r="54" fill="#FFD000" />
      <text class="macro-val" font-size="26" fill="#0A0A0A" text-anchor="middle" y="9">${protein}G</text>
      <text class="macro-lbl" font-size="15" fill="#043927" text-anchor="middle" y="80">Protein</text>
    </g>

    <!-- KARBO BADGE (Soft Pink/Purple Circle) -->
    <g transform="translate(300, 0)">
      <circle cx="0" cy="0" r="54" fill="#FBCFE8" />
      <text class="macro-val" font-size="26" fill="#0A0A0A" text-anchor="middle" y="9">${carbs}G</text>
      <text class="macro-lbl" font-size="15" fill="#043927" text-anchor="middle" y="80">Karbo</text>
    </g>

    <!-- LEMAK BADGE (Light Cyan/Blue Circle) -->
    <g transform="translate(480, 0)">
      <circle cx="0" cy="0" r="54" fill="#BAE6FD" />
      <text class="macro-val" font-size="26" fill="#0A0A0A" text-anchor="middle" y="9">${fat}G</text>
      <text class="macro-lbl" font-size="15" fill="#043927" text-anchor="middle" y="80">Lemak</text>
    </g>
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
        value: 600
      }
    });
    return resvg.render().asPng();
  } catch (e) {
    console.warn("[Card Generator] Native resvg fallback note:", (e as any)?.message || e);
    return Buffer.from(svg);
  }
}
