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
    ? `On track · sisa ${remainingCal.toLocaleString("id-ID")} kcal` 
    : `Melebihi target · +${Math.abs(remainingCal).toLocaleString("id-ID")} kcal`;
  
  const pillBg = isOntrack ? "#043927" : "#991B1B";
  const pillWidth = pillText.length * 9.5 + 36;

  // Split title into 2 clean lines if long
  const words = foodTitle.split(/\s+/);
  let line1 = "";
  let line2 = "";
  for (const w of words) {
    if ((line1 + " " + w).length <= 26 && !line2) {
      line1 = (line1 + " " + w).trim();
    } else {
      line2 = (line2 + " " + w).trim();
    }
  }
  if (!line1) line1 = foodTitle;
  if (line2.length > 28) line2 = line2.substring(0, 25) + "...";

  const hasLine2 = Boolean(line2);
  const photoY = hasLine2 ? 165 : 145;
  const pillY = hasLine2 ? 520 : 500;
  const starY = hasLine2 ? 155 : 135;
  const calY = hasLine2 ? 670 : 650;
  const macroBaseY = hasLine2 ? 790 : 770;

  // Food Photo
  let photoHref = data.imageBufferOrBase64 || "";
  if (!photoHref) {
    photoHref = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80";
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="640" height="960" viewBox="0 0 640 960">
  <!-- Warm Off-White Cream Background -->
  <rect width="640" height="960" fill="#FAF6F0"/>

  <!-- Top Header -->
  <text x="40" y="58" font-family="Arial Black, Impact, sans-serif" font-size="34" font-weight="900" fill="#0A0A0A">GYMBUDDY<tspan fill="#25D366">.AI</tspan></text>
  <text x="600" y="55" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700" fill="#043927" text-anchor="end">${escapeXml(mealType)} · ${escapeXml(dateStr)}</text>

  <!-- Main Food Title -->
  <text x="40" y="108" font-family="Arial Black, Impact, sans-serif" font-size="25" font-weight="900" fill="#043927">${escapeXml(line1)}</text>
  ${hasLine2 ? `<text x="40" y="140" font-family="Arial Black, Impact, sans-serif" font-size="25" font-weight="900" fill="#043927">${escapeXml(line2)}</text>` : ""}

  <!-- Clip Path for Rounded Food Photo -->
  <defs>
    <clipPath id="foodPhotoClip">
      <rect x="40" y="${photoY}" width="560" height="420" rx="32" ry="32"/>
    </clipPath>
  </defs>

  <!-- Photo Placeholder Box & Actual Image -->
  <rect x="40" y="${photoY}" width="560" height="420" rx="32" ry="32" fill="#E2E8F0"/>
  <image href="${escapeXml(photoHref)}" xlink:href="${escapeXml(photoHref)}" x="40" y="${photoY}" width="560" height="420" preserveAspectRatio="xMidYMid slice" clip-path="url(#foodPhotoClip)"/>

  <!-- Sparkle Star Top Right of Photo -->
  <path d="M 585 ${starY} L 589 ${starY + 13} L 602 ${starY + 17} L 589 ${starY + 21} L 585 ${starY + 34} L 581 ${starY + 21} L 568 ${starY + 17} L 581 ${starY + 13} Z" fill="#FFC700"/>

  <!-- Status Pill Overlay on Photo -->
  <rect x="65" y="${pillY}" width="${pillWidth}" height="42" rx="21" ry="21" fill="${pillBg}"/>
  <text x="${65 + pillWidth / 2}" y="${pillY + 27}" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="700" fill="#FFFFFF" text-anchor="middle">${escapeXml(pillText)}</text>

  <!-- Calorie Hero Section -->
  <g transform="translate(40, ${calY})">
    <text x="0" y="30" font-family="Arial Black, Impact, sans-serif" font-size="78" font-weight="900" fill="#FF4500">${calories.toLocaleString("id-ID")}</text>
    <text x="${String(calories).length * 48 + 12}" y="12" font-family="Arial Black, Impact, sans-serif" font-size="28" font-weight="900" fill="#FF4500">KCAL</text>

    <text x="560" y="-12" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" fill="#666666" text-anchor="end">Target harian</text>
    <text x="560" y="28" font-family="Arial Black, Impact, sans-serif" font-size="34" font-weight="900" fill="#043927" text-anchor="end">${targetCal.toLocaleString("id-ID")}</text>
  </g>

  <!-- 3 Circular Macro Badges -->
  <g transform="translate(0, ${macroBaseY})">
    <!-- Protein Badge (Yellow/Amber) -->
    <g transform="translate(130, 0)">
      <circle cx="0" cy="0" r="54" fill="#FFD000"/>
      <text x="0" y="10" font-family="Arial Black, Impact, sans-serif" font-size="26" font-weight="900" fill="#0A0A0A" text-anchor="middle">${protein}G</text>
      <text x="0" y="78" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700" fill="#043927" text-anchor="middle">Protein</text>
    </g>

    <!-- Karbo Badge (Pink/Purple) -->
    <g transform="translate(320, 0)">
      <circle cx="0" cy="0" r="54" fill="#FBCFE8"/>
      <text x="0" y="10" font-family="Arial Black, Impact, sans-serif" font-size="26" font-weight="900" fill="#0A0A0A" text-anchor="middle">${carbs}G</text>
      <text x="0" y="78" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700" fill="#043927" text-anchor="middle">Karbo</text>
    </g>

    <!-- Lemak Badge (Light Cyan/Blue) -->
    <g transform="translate(510, 0)">
      <circle cx="0" cy="0" r="54" fill="#BAE6FD"/>
      <text x="0" y="10" font-family="Arial Black, Impact, sans-serif" font-size="26" font-weight="900" fill="#0A0A0A" text-anchor="middle">${fat}G</text>
      <text x="0" y="78" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700" fill="#043927" text-anchor="middle">Lemak</text>
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
        value: 640
      }
    });
    return resvg.render().asPng();
  } catch (e) {
    return Buffer.from(svg);
  }
}
