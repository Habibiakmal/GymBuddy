/**
 * GymBuddy Smart Meal & Snack Classification Engine
 * 
 * Rules:
 * 1. Explicit User Intent Priority:
 *    - If user explicitly says "sarapan" / "breakfast" -> breakfast
 *    - If user explicitly says "makan siang" / "lunch" -> lunch
 *    - If user explicitly says "makan malam" / "dinner" -> dinner
 *    - If user explicitly says "snack" / "camilan" / "ngemil" -> snack
 * 
 * 2. Smart Food Context (Snack vs Main Meal):
 *    - Foods like chiki/chips, crackers, biscuits, cookies, chocolate, candy,
 *      bread/pastry, fruits, yogurt, 1-2 standalone eggs, nuts, or light snacks
 *      are classified as SNACK regardless of time (e.g. Chiki at 19:35 -> SNACK;
 *      two eggs at 19:35 -> SNACK; banana at 08:00 -> SNACK).
 * 
 * 3. Main Meal Time Windows (WIB UTC+7 / Logged Time):
 *    - Complete/heavy meals follow the 4 time windows:
 *      • 05:00–10:59 -> SARAPAN (breakfast)
 *      • 11:00–15:59 -> MAKAN SIANG (lunch)
 *      • 16:00–21:59 -> MAKAN MALAM (dinner)
 *      • 22:00–04:59 -> SNACK / LATE MEAL (snack)
 */

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface MealClassificationParams {
  foodName?: string;
  items?: Array<string | { foodName?: string; name?: string }>;
  timeOrDate?: string | Date;
  userText?: string;
  calories?: number;
}

// Regex for snacks, light foods, fruits, confectioneries, packaged snacks, and standalone eggs
const SNACK_KEYWORDS_REGEX = /(?:chiki|ciki|taro|cheetos|lays|lay's|doritos|pringles|chitato|potabee|piattos|kusuka|chips|crisps|keripik|kripik|kerupuk|krupuk|emping|peyek|rempeyek|crackers|malkist|biskuit|biscuits|biscuit|wafer|cookies|cookie|oreo|popcorn|pretzel|cokelat|coklat|chocolate|candy|permen|silverqueen|kitkat|beng-beng|beng beng|chunky bar|cadbury|toblerone|marshmallow|jelly|agar-agar|pudding|puding|es krim|ice cream|gelato|croissant|donat|donut|doughnut|muffin|cupcake|bakpao|pao|pastry|churros|pisang|banana|apel|apple|jeruk|orange|semangka|watermelon|melon|alpukat|avocado|pepaya|papaya|mangga|mango|nanas|pineapple|anggur|grape|strawberi|strawberry|berries|salak|rambutan|kelengkeng|kiwi|pear|pir|dragonfruit|buah naga|kurma|yogurt|yoghurt|yakult|kefir|kacang|almond|almonds|peanut|peanuts|cashew|mete|kuaci|edamame|walnut|pistachio|chia seed|protein bar|granola|energy bar|fitbar|soyjoy|snack|camilan|cemilan|ngemil)/i;

// Regex for heavy / complete meals that should definitely follow time windows
const COMPLETE_MEAL_REGEX = /(?:nasi padang|nasi uduk|nasi kuning|nasi goreng|nasi putih|nasi campur|mie goreng|mie ayam|mie kuah|ramen|spaghetti|carbonara|pasta|bubur ayam|soto|rawon|rendang|gulai|steak|ayam geprek|ayam bakar|ayam goreng|bebek goreng|ikan bakar|ikan goreng|gulai|kari|capcay|gado-gado|pecel|ketoprak|burger|sandwich|pizza)/i;

// Regex for standalone egg (without staple heavy meal components)
const STANDALONE_EGG_REGEX = /^(?:(?:\d+\s*(?:butir|biji|pcs)?\s*)?(?:telur|telor|egg|eggs)(?:\s*(?:rebus|ceplok|dadar|mata sapi|setengah matang|scrambled|boiled|fried|poached))?|telur\s*rebus|telur\s*ceplok|telur\s*dadar|boiled\s*egg|fried\s*egg|scrambled\s*egg|omelet|omelette)$/i;

/**
 * Check if the food is a snack / light food based on composition
 */
export function isSmartSnack(
  foodName?: string,
  items?: Array<string | { foodName?: string; name?: string }>,
  calories?: number
): boolean {
  const name = String(foodName || "").trim().toLowerCase();
  if (!name) return false;

  // 1. Check standalone egg patterns (e.g. "two eggs", "telur rebus", "2 butir telur ceplok")
  if (STANDALONE_EGG_REGEX.test(name)) {
    // If it has heavy items like rice, meat, it's not standalone egg
    const allText = [name, ...(items || []).map(it => (typeof it === "string" ? it : it.foodName || it.name || ""))].join(" ").toLowerCase();
    if (!/(?:nasi|rice|mie|noodle|pasta|ayam|chicken|daging|beef|soto|kari)/i.test(allText)) {
      return true;
    }
  }

  // 2. Check if explicitly matches complete meal (e.g. "nasi goreng", "nasi padang")
  if (COMPLETE_MEAL_REGEX.test(name)) {
    return false;
  }

  // 3. Check for specific snack patterns in food name
  if (SNACK_KEYWORDS_REGEX.test(name)) {
    // Make sure it's not a complete meal containing the keyword (e.g. "ayam saus cokelat")
    if (!/(?:nasi|mie|pasta|soto|rawon|rendang|steak)/i.test(name)) {
      return true;
    }
  }

  // 4. Check component items if provided
  if (Array.isArray(items) && items.length > 0) {
    const itemNames = items.map(it => (typeof it === "string" ? it : it.foodName || it.name || "").trim().toLowerCase());
    const hasCompleteMealComponent = itemNames.some(n => COMPLETE_MEAL_REGEX.test(n) || /(?:nasi|mie|pasta|steak|soto)/i.test(n));
    if (!hasCompleteMealComponent) {
      const hasSnackComponent = itemNames.every(n => SNACK_KEYWORDS_REGEX.test(n) || STANDALONE_EGG_REGEX.test(n) || /(?:telur|buah|kopi|teh|air)/i.test(n));
      if (hasSnackComponent) return true;
    }
  }

  // 5. If calories are small (< 200 kcal) and doesn't contain complete meal indicators
  if (calories && calories > 0 && calories <= 200) {
    if (!/(?:nasi|mie|pasta|soto|rawon|rendang|gulai|steak|burger)/i.test(name)) {
      // Light food with low calorie count without staple carb
      return true;
    }
  }

  return false;
}

/**
 * Extract hour (0-23) and minute (0-59) from time string, Date, or timestamp
 */
export function extractHourMinute(timeOrDate?: string | Date): { hour: number; minute: number } {
  if (!timeOrDate) {
    const now = new Date();
    // Default to WIB timezone (Asia/Jakarta)
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Jakarta",
        hour: "numeric",
        minute: "numeric",
        hour12: false
      }).formatToParts(now);
      const h = parseInt(parts.find(p => p.type === "hour")?.value || "12", 10);
      const m = parseInt(parts.find(p => p.type === "minute")?.value || "0", 10);
      return { hour: h, minute: m };
    } catch (e) {
      const utcHour = now.getUTCHours();
      const wibHour = (utcHour + 7) % 24;
      return { hour: wibHour, minute: now.getUTCMinutes() };
    }
  }

  if (timeOrDate instanceof Date) {
    return { hour: timeOrDate.getHours(), minute: timeOrDate.getMinutes() };
  }

  const str = String(timeOrDate).trim();

  // Try parsing "HH:mm" or "HH.mm"
  const matchTime = str.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (matchTime) {
    return { hour: parseInt(matchTime[1], 10), minute: parseInt(matchTime[2], 10) };
  }

  // Try parsing ISO string or Date string
  const parsedDate = new Date(str);
  if (!isNaN(parsedDate.getTime())) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Jakarta",
        hour: "numeric",
        minute: "numeric",
        hour12: false
      }).formatToParts(parsedDate);
      const h = parseInt(parts.find(p => p.type === "hour")?.value || String(parsedDate.getHours()), 10);
      const m = parseInt(parts.find(p => p.type === "minute")?.value || String(parsedDate.getMinutes()), 10);
      return { hour: h, minute: m };
    } catch (e) {
      return { hour: parsedDate.getHours(), minute: parsedDate.getMinutes() };
    }
  }

  // Fallback to current WIB time
  const now = new Date();
  return { hour: (now.getUTCHours() + 7) % 24, minute: now.getUTCMinutes() };
}

/**
 * Get meal type strictly from time brackets:
 * • 05:00–10:59 -> SARAPAN (breakfast)
 * • 11:00–15:59 -> MAKAN SIANG (lunch)
 * • 16:00–21:59 -> MAKAN MALAM (dinner)
 * • 22:00–04:59 -> SNACK / LATE MEAL (snack)
 */
export function getMealTypeFromTimeWindow(timeOrDate?: string | Date): MealType {
  const { hour } = extractHourMinute(timeOrDate);
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 16) return "lunch";
  if (hour >= 16 && hour < 22) return "dinner";
  return "snack";
}

/**
 * Master Classifier: combines explicit user intent, smart food composition, and logged time
 */
export function classifyMealType(params: MealClassificationParams): MealType {
  const userText = String(params.userText || "").toLowerCase();
  const foodName = String(params.foodName || "").toLowerCase();
  const combinedText = `${userText} ${foodName}`.trim();

  // STEP 1: Explicit User Intent Override
  if (/(?:sarapan|breakfast|makan pagi|pagi-pagi|tadi pagi|\bpagi\b)/i.test(combinedText)) {
    return "breakfast";
  }
  if (/(?:makan siang|lunch|tadi siang)/i.test(combinedText)) {
    return "lunch";
  }
  if (/(?:makan malam|dinner|tadi malam)/i.test(combinedText)) {
    return "dinner";
  }
  if (/(?:snack|camilan|cemilan|ngemil)/i.test(combinedText)) {
    return "snack";
  }

  // STEP 2: Smart Snack Detection (Food Composition Override)
  // If the food is identified as a snack, light food, standalone egg, fruit, chips, etc.
  if (isSmartSnack(params.foodName, params.items, params.calories)) {
    return "snack";
  }

  // STEP 3: Complete / Main Meal Time Classification (4 Time Windows)
  return getMealTypeFromTimeWindow(params.timeOrDate);
}

/**
 * Format Meal Type display label
 */
export function getMealTypeLabel(
  mealType: MealType,
  language: "ID" | "EN" = "ID",
  timeOrDate?: string | Date
): string {
  const isEN = language === "EN";
  switch (mealType) {
    case "breakfast":
      return isEN ? "BREAKFAST" : "SARAPAN";
    case "lunch":
      return isEN ? "LUNCH" : "MAKAN SIANG";
    case "dinner":
      return isEN ? "DINNER" : "MAKAN MALAM";
    case "snack": {
      if (timeOrDate) {
        const { hour } = extractHourMinute(timeOrDate);
        if (hour >= 22 || hour < 5) {
          return "SNACK / LATE MEAL";
        }
      }
      return "SNACK";
    }
    default:
      return isEN ? "MEAL" : "MAKANAN";
  }
}
