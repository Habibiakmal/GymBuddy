/**
 * GymBuddy Canonical Food Identity & Nutrition Matching Engine
 * 
 * CORE PRINCIPLES:
 * 1. USER INPUT / IMAGE -> FOOD IDENTIFICATION -> FOOD IDENTITY VALIDATION ->
 *    PORTION ESTIMATION -> NUTRITION REFERENCE MATCHING -> NUTRITION ESTIMATION ->
 *    MEAL CATEGORY CLASSIFICATION -> CONFIDENCE EVALUATION -> USER REVIEW -> EXPLICIT SAVE.
 * 2. Food Identity is sacred: The user-specified dish/product name is preserved and NEVER replaced
 *    by generic catalog items (e.g. "Ayam Gulai" NEVER becomes "Chicken Meal", "Otak Sapi" NEVER
 *    becomes "Daging Sapi / Rendang", "SilverQueen" NEVER becomes "Susu Sapi / UHT").
 * 3. Database match is a reference for nutrient computation only, NOT the source of truth for identity.
 * 4. Indonesian culinary ontology & brand recognition are built-in first-class layers.
 * 5. Mass (g) ≠ Volume (ml); Caloric drinks are meals, ONLY pure water is hydration.
 * 6. Snack is a first-class category regardless of time; explicit user intent overrides time windows.
 * 7. Dual confidence scoring: Identity Confidence vs Nutrition Reference Confidence.
 */

export interface ResolvedFoodIdentity {
  originalInput: string;
  resolvedFoodName: string;
  canonicalConcept: string;
  semanticCategory: "meal" | "snack" | "beverage";
  recordType: "meal" | "hydration";
  isPureWater: boolean;
  brandName?: string;
  mainProtein?: string;
  cookingMethod?: string;
  identityScore: number; // 0.0 - 1.0
  portionGrams?: number;
  portionVolumeMl?: number;
  portionType: "explicit" | "estimated";
  portionUnit: string;
  displayServing: string;
  notes?: string;
}

export interface DatabaseMatchCandidate {
  referenceId: string;
  referenceSource: "TKPI" | "USDA" | "verified_nutrition_database" | "ai_estimation";
  referenceName: string;
  matchType: "exact" | "strong_semantic" | "approximate" | "category_estimate" | "no_match";
  nutritionScore: number; // 0.0 - 1.0
  criticalMismatch: boolean;
  mismatchReason?: string;
}

export interface DualConfidenceResult {
  identityScore: number; // 0.0 - 1.0
  nutritionScore: number; // 0.0 - 1.0
  overallScore: number; // 0.0 - 1.0
  level: "high" | "medium" | "low";
  criticalMismatch: boolean;
  requiresReview: boolean;
  warningMessage?: string;
}

export interface CanonicalMealRecordPayload {
  id: string;
  type: "meal" | "hydration";
  originalInput: string;
  resolvedFoodName: string;
  mealCategory: "SARAPAN" | "MAKAN SIANG" | "MAKAN MALAM" | "SNACK" | "AIR";
  portion: {
    value: number;
    unit: string;
    source: "explicit" | "estimated";
    display: string;
  };
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
    sodium: number;
  };
  confidence: DualConfidenceResult;
  databaseReference: {
    id: string;
    source: string;
    referenceName: string;
    matchType: string;
  };
  items?: any[];
  loggedAt: string;
  mealDate: string;
}

// ─── 1. INDONESIAN CULINARY ONTOLOGY ─────────────────────────────────────────

export interface IndonesianDishEntry {
  patterns: RegExp[];
  canonicalName: string;
  concept: string;
  protein?: string;
  cookingMethod?: string;
  category: "meal" | "snack" | "beverage";
  defaultServingGrams: number;
  servingUnit: string;
  fallbackNutrientPer100g: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
    sodium: number;
  };
}

export const INDONESIAN_FOOD_ONTOLOGY: IndonesianDishEntry[] = [
  // Ayam Gulai / Gulai Ayam (Chicken Curry with rich spiced coconut gravy)
  {
    patterns: [/\b(?:ayam\s+gulai|gulai\s+ayam)\b/i],
    canonicalName: "Ayam Gulai",
    concept: "Indonesian chicken gulai / curry in spiced coconut gravy",
    protein: "chicken",
    cookingMethod: "gulai",
    category: "meal",
    defaultServingGrams: 150,
    servingUnit: "1 potong ayam gulai",
    fallbackNutrientPer100g: {
      calories: 185,
      protein: 16.5,
      carbs: 3.2,
      fat: 11.8,
      fiber: 0.8,
      sugar: 1.0,
      sodium: 380
    }
  },
  // Otak Sapi / Gulai Otak (Cow Brain / organ meat)
  {
    patterns: [/\b(?:otak\s+sapi|gulai\s+otak)\b/i],
    canonicalName: "Otak Sapi",
    concept: "Beef brain / organ meat",
    protein: "beef brain",
    cookingMethod: "standard",
    category: "meal",
    defaultServingGrams: 100,
    servingUnit: "1 porsi otak sapi (~100g)",
    fallbackNutrientPer100g: {
      calories: 143,
      protein: 10.5,
      carbs: 1.0,
      fat: 10.3,
      fiber: 0.0,
      sugar: 0.0,
      sodium: 180
    }
  },
  // Rendang (Beef Rendang slow-cooked in coconut milk and spices)
  {
    patterns: [/\b(?:rendang\s+daging|daging\s+rendang|rendang\s+sapi)\b/i, /^(?:rendang)$/i],
    canonicalName: "Rendang Daging Sapi",
    concept: "Slow-cooked beef caramelized in rich spices and coconut milk",
    protein: "beef",
    cookingMethod: "rendang",
    category: "meal",
    defaultServingGrams: 100,
    servingUnit: "1 potong (~100g)",
    fallbackNutrientPer100g: {
      calories: 195,
      protein: 22.0,
      carbs: 4.5,
      fat: 10.0,
      fiber: 1.2,
      sugar: 1.5,
      sodium: 360
    }
  },
  // Nasi Padang (Indonesian mixed rice meal with rich curries)
  {
    patterns: [/\b(?:nasi\s+padang(?:\s+rendang)?)\b/i],
    canonicalName: "Nasi Padang Rendang",
    concept: "Indonesian Padang style mixed rice platter with beef rendang and side dishes",
    protein: "beef",
    cookingMethod: "standard",
    category: "meal",
    defaultServingGrams: 350,
    servingUnit: "1 porsi nasi padang komplit",
    fallbackNutrientPer100g: {
      calories: 188,
      protein: 7.2,
      carbs: 23.5,
      fat: 7.4,
      fiber: 1.5,
      sugar: 1.2,
      sodium: 320
    }
  },
  // Cumi Goreng Tepung (Crispy Battered Fried Squid)
  {
    patterns: [/\b(?:cumi(?:\s+goreng)?\s+tepung|fried\s+(?:calamari|squid))\b/i],
    canonicalName: "Cumi Goreng Tepung",
    concept: "Crispy battered fried squid rings",
    protein: "squid",
    cookingMethod: "fried",
    category: "meal",
    defaultServingGrams: 120,
    servingUnit: "1 porsi cumi goreng tepung (~120g)",
    fallbackNutrientPer100g: {
      calories: 210,
      protein: 15.0,
      carbs: 14.5,
      fat: 10.2,
      fiber: 0.6,
      sugar: 0.4,
      sodium: 340
    }
  },
  // Kerang Rebus (Boiled Shellfish / Clams with dipping sauce)
  {
    patterns: [/\b(?:kerang\s+rebus|boiled\s+(?:clams|shellfish))\b/i],
    canonicalName: "Kerang Rebus",
    concept: "Boiled shellfish / clams",
    protein: "shellfish",
    cookingMethod: "boiled",
    category: "meal",
    defaultServingGrams: 100,
    servingUnit: "1 porsi daging kerang (~100g)",
    fallbackNutrientPer100g: {
      calories: 74,
      protein: 12.8,
      carbs: 2.6,
      fat: 1.0,
      fiber: 0.0,
      sugar: 0.0,
      sodium: 220
    }
  },
  // Tumis Kangkung (Stir-fried Water Spinach)
  {
    patterns: [/\b(?:tumis\s+kangkung|cah\s+kangkung|oseng\s+kangkung)\b/i],
    canonicalName: "Tumis Kangkung",
    concept: "Stir-fried water spinach with garlic and chili",
    cookingMethod: "tumis",
    category: "meal",
    defaultServingGrams: 100,
    servingUnit: "1 porsi sedang (~100g)",
    fallbackNutrientPer100g: {
      calories: 58,
      protein: 2.2,
      carbs: 4.8,
      fat: 3.5,
      fiber: 2.1,
      sugar: 1.0,
      sodium: 280
    }
  },
  // Roti Panggang Mentega (Butter Toast)
  {
    patterns: [/\b(?:roti\s+panggang\s+mentega|butter\s+toast|roti\s+bakar\s+mentega)\b/i],
    canonicalName: "Roti Panggang Mentega",
    concept: "Toasted white bread brushed with butter",
    cookingMethod: "panggang",
    category: "snack",
    defaultServingGrams: 60,
    servingUnit: "2 lembar roti panggang",
    fallbackNutrientPer100g: {
      calories: 340,
      protein: 8.0,
      carbs: 46.0,
      fat: 14.0,
      fiber: 2.5,
      sugar: 5.5,
      sodium: 520
    }
  },
  // Soto Ayam (Indonesian aromatic chicken soup with shredded chicken)
  {
    patterns: [/\b(?:soto\s+ayam)\b/i],
    canonicalName: "Soto Ayam",
    concept: "Indonesian spiced aromatic chicken soup",
    protein: "chicken",
    cookingMethod: "boiled",
    category: "meal",
    defaultServingGrams: 300,
    servingUnit: "1 mangkok soto ayam (~300g)",
    fallbackNutrientPer100g: {
      calories: 85,
      protein: 6.8,
      carbs: 5.2,
      fat: 4.0,
      fiber: 0.6,
      sugar: 0.5,
      sodium: 390
    }
  },
  // Bakso / Bakso Sapi (Indonesian beef meatball soup)
  {
    patterns: [/\b(?:bakso(?:\s+sapi)?|mie\s+bakso)\b/i],
    canonicalName: "Bakso Sapi",
    concept: "Indonesian beef meatballs served in clear beef broth",
    protein: "beef",
    cookingMethod: "boiled",
    category: "meal",
    defaultServingGrams: 250,
    servingUnit: "1 mangkok bakso (5 butir)",
    fallbackNutrientPer100g: {
      calories: 125,
      protein: 8.5,
      carbs: 9.0,
      fat: 5.8,
      fiber: 0.5,
      sugar: 0.8,
      sodium: 480
    }
  },
  // Rawon (Javanese black beef soup with kluwek)
  {
    patterns: [/\b(?:rawon(?:\s+daging)?)\b/i],
    canonicalName: "Rawon Daging Sapi",
    concept: "East Javanese aromatic black beef soup flavored with black kluwek nut",
    protein: "beef",
    cookingMethod: "boiled",
    category: "meal",
    defaultServingGrams: 280,
    servingUnit: "1 mangkok rawon (~280g)",
    fallbackNutrientPer100g: {
      calories: 110,
      protein: 9.8,
      carbs: 3.5,
      fat: 6.2,
      fiber: 0.8,
      sugar: 0.5,
      sodium: 420
    }
  },
  // Nasi Goreng (Indonesian Fried Rice)
  {
    patterns: [/\b(?:nasi\s+goreng|nasgor)\b/i],
    canonicalName: "Nasi Goreng",
    concept: "Indonesian wok-fried seasoned rice",
    cookingMethod: "fried",
    category: "meal",
    defaultServingGrams: 250,
    servingUnit: "1 piring nasi goreng (~250g)",
    fallbackNutrientPer100g: {
      calories: 172,
      protein: 4.5,
      carbs: 26.0,
      fat: 5.8,
      fiber: 1.2,
      sugar: 1.5,
      sodium: 360
    }
  }
];

// ─── 2. BRAND AND PACKAGED PRODUCT REGISTRY ──────────────────────────────────

export interface BrandProductEntry {
  brand: string;
  patterns: RegExp[];
  canonicalDisplayName: string;
  category: "snack" | "meal" | "beverage";
  productType: "chocolate" | "chips" | "biscuit" | "instant_noodles" | "dairy_drink" | "tea_drink" | "probiotic_drink";
  defaultServingGrams: number;
  servingUnit: string;
  nutrientPer100g: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
    sodium: number;
  };
}

export const BRAND_PRODUCT_REGISTRY: BrandProductEntry[] = [
  // SilverQueen (Chocolate confectionery)
  {
    brand: "SilverQueen",
    patterns: [/\bsilverqueen\b/i, /\bsilver\s*queen\b/i],
    canonicalDisplayName: "SilverQueen Bites Milk Chocolate",
    category: "snack",
    productType: "chocolate",
    defaultServingGrams: 45, // Standard bites / bar
    servingUnit: "1 bungkus / bar (45g)",
    nutrientPer100g: {
      calories: 540,
      protein: 9.0,
      carbs: 56.0,
      fat: 31.0,
      fiber: 3.5,
      sugar: 48.0,
      sodium: 85
    }
  },
  // Oreo (Sandwich cookie)
  {
    brand: "Oreo",
    patterns: [/\boreo\b/i],
    canonicalDisplayName: "Oreo Cookies",
    category: "snack",
    productType: "biscuit",
    defaultServingGrams: 28, // 3 cookies
    servingUnit: "3 keping (28g)",
    nutrientPer100g: {
      calories: 480,
      protein: 4.8,
      carbs: 71.0,
      fat: 20.0,
      fiber: 2.8,
      sugar: 38.0,
      sodium: 380
    }
  },
  // Chitato (Potato chips snack)
  {
    brand: "Chitato",
    patterns: [/\bchitato\b/i],
    canonicalDisplayName: "Chitato Potato Chips",
    category: "snack",
    productType: "chips",
    defaultServingGrams: 68,
    servingUnit: "1 bungkus regular (68g)",
    nutrientPer100g: {
      calories: 520,
      protein: 6.5,
      carbs: 55.0,
      fat: 30.0,
      fiber: 3.2,
      sugar: 2.5,
      sodium: 480
    }
  },
  // Chiki (Savory puffed snack)
  {
    brand: "Chiki",
    patterns: [/\bchiki(?:\s*balls)?\b/i, /\biki\s*balls\b/i],
    canonicalDisplayName: "Chiki Balls",
    category: "snack",
    productType: "chips",
    defaultServingGrams: 40,
    servingUnit: "1 bungkus chiki (40g)",
    nutrientPer100g: {
      calories: 490,
      protein: 6.0,
      carbs: 62.0,
      fat: 24.0,
      fiber: 2.0,
      sugar: 4.0,
      sodium: 520
    }
  },
  // Indomie (Instant noodles)
  {
    brand: "Indomie",
    patterns: [/\bindomie(?:\s*goreng|\s*kuah|\s*rebus)?\b/i, /\bmie\s*indomie\b/i],
    canonicalDisplayName: "Indomie Goreng",
    category: "meal",
    productType: "instant_noodles",
    defaultServingGrams: 85,
    servingUnit: "1 bungkus (85g)",
    nutrientPer100g: {
      calories: 447, // ~380 kcal per 85g
      protein: 9.4,
      carbs: 63.5,
      fat: 17.6,
      fiber: 2.4,
      sugar: 4.7,
      sodium: 1040
    }
  },
  // Tango (Wafer)
  {
    brand: "Tango",
    patterns: [/\btango(?:\s*wafer)?\b/i, /\bwafer\s*tango\b/i],
    canonicalDisplayName: "Tango Wafer",
    category: "snack",
    productType: "biscuit",
    defaultServingGrams: 35,
    servingUnit: "1 bungkus wafer tango (35g)",
    nutrientPer100g: {
      calories: 505,
      protein: 5.5,
      carbs: 65.0,
      fat: 25.0,
      fiber: 1.8,
      sugar: 32.0,
      sodium: 160
    }
  },
  // Ultra Milk (Packaged dairy milk - drink, NOT pure water hydration)
  {
    brand: "Ultra Milk",
    patterns: [/\bultra\s*milk\b/i, /\bsusu\s*ultra\b/i],
    canonicalDisplayName: "Ultra Milk UHT",
    category: "beverage",
    productType: "dairy_drink",
    defaultServingGrams: 250,
    servingUnit: "1 kotak (250 ml)",
    nutrientPer100g: {
      calories: 62,
      protein: 3.2,
      carbs: 4.8,
      fat: 3.3,
      fiber: 0.0,
      sugar: 4.8,
      sodium: 45
    }
  },
  // Teh Botol Sosro (Sweet bottled tea - drink, NOT pure water hydration)
  {
    brand: "Teh Botol Sosro",
    patterns: [/\bteh\s*botol(?:\s*sosro)?\b/i, /\bsosro\b/i],
    canonicalDisplayName: "Teh Botol Sosro",
    category: "beverage",
    productType: "tea_drink",
    defaultServingGrams: 250,
    servingUnit: "1 botol / kotak (250 ml)",
    nutrientPer100g: {
      calories: 36, // ~90 kcal per 250ml
      protein: 0.0,
      carbs: 9.0,
      fat: 0.0,
      fiber: 0.0,
      sugar: 8.8,
      sodium: 15
    }
  },
  // Yakult (Probiotic fermented milk - drink, NOT pure water hydration)
  {
    brand: "Yakult",
    patterns: [/\byakult\b/i],
    canonicalDisplayName: "Yakult Probiotik",
    category: "beverage",
    productType: "probiotic_drink",
    defaultServingGrams: 65,
    servingUnit: "1 botol yakult (65 ml)",
    nutrientPer100g: {
      calories: 77, // ~50 kcal per 65ml
      protein: 1.2,
      carbs: 17.5,
      fat: 0.1,
      fiber: 0.0,
      sugar: 15.0,
      sodium: 25
    }
  }
];

// ─── 3. RESOLVE CANONICAL FOOD IDENTITY ──────────────────────────────────────

/**
 * Pure helper to resolve the true canonical identity of user's food.
 * Preserves the exact dish/product concept given by the user.
 * NEVER substitutes the user food with generic USDA catalog items.
 */
export function resolveCanonicalFoodIdentity(rawText: string): ResolvedFoodIdentity {
  const clean = (rawText || "").trim();
  const lower = clean.toLowerCase();

  // 1. Detect pure water (The ONLY drink that is hydration)
  const cleanWaterText = lower
    .replace(/(?:\d+(?:[.,]\d+)?\s*(?:ml|liter|litre|l\b|gelas|cup|cups|botol)|\b(?:gelas|cup|cups|botol)\b)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const isPureWater = /^(?:air\s*putih|air\s*mineral|air\s*aqua|air\s*biasa|plain\s*water|mineral\s*water|water|air)$/i.test(cleanWaterText) &&
    !/(?:kopi|coffee|teh|tea|susu|milk|jus|juice|boba|cola|soda|sirup|syrup|lemon|jeruk|buah|manis)/i.test(lower);

  // Extract explicit quantity / grams / ml
  let explicitGrams: number | undefined;
  let explicitMl: number | undefined;

  const gMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:gram|gr|g)\b/i);
  if (gMatch) {
    explicitGrams = parseFloat(gMatch[1].replace(",", "."));
  }

  const mlMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:ml|mili|liter|l)\b/i);
  if (mlMatch) {
    let val = parseFloat(mlMatch[1].replace(",", "."));
    if (/liter|l\b/i.test(clean) && val < 10) val *= 1000;
    explicitMl = val;
  }

  // Check Brand Registry First
  for (const entry of BRAND_PRODUCT_REGISTRY) {
    for (const pat of entry.patterns) {
      if (pat.test(lower)) {
        // Build resolved name: keep user's specific flavor or product wording if richer
        let resolvedName = entry.canonicalDisplayName;
        if (clean.length > entry.brand.length) {
          // Capitalize user's full branded title cleanly
          const cleanUser = clean
            .replace(/^[🍽️🥜🥗🥘🍛🍗🥩🍳🥤🍪🥪🍞🍕🍔🌮🍜🍲✨\-\*•\d\.\s\(\)]+/, "")
            .replace(/\b\w/g, c => c.toUpperCase())
            .trim();
          if (entry.canonicalDisplayName.toLowerCase().includes("chips") && !cleanUser.toLowerCase().includes("chips")) {
            resolvedName = `${cleanUser} (Chips)`;
          } else {
            resolvedName = cleanUser;
          }
        }

        const targetGrams = explicitGrams || entry.defaultServingGrams;
        return {
          originalInput: clean,
          resolvedFoodName: resolvedName,
          canonicalConcept: entry.canonicalDisplayName,
          semanticCategory: entry.category,
          recordType: "meal", // Branded foods/drinks are NEVER hydration!
          isPureWater: false,
          brandName: entry.brand,
          identityScore: 0.98,
          portionGrams: targetGrams,
          portionVolumeMl: entry.category === "beverage" ? (explicitMl || targetGrams) : undefined,
          portionType: explicitGrams || explicitMl ? "explicit" : "estimated",
          portionUnit: explicitGrams ? "g" : (explicitMl ? "ml" : entry.servingUnit),
          displayServing: explicitGrams ? `${explicitGrams}g` : entry.servingUnit,
          notes: `Recognized product from ${entry.brand}`
        };
      }
    }
  }

  // Check Indonesian Culinary Ontology
  for (const entry of INDONESIAN_FOOD_ONTOLOGY) {
    for (const pat of entry.patterns) {
      if (pat.test(lower)) {
        let resolvedName = entry.canonicalName;
        // If user input has specific detail (e.g. "Ayam Gulai Paha" or "Ayam Gulai"), clean and capitalize
        if (clean.length > 3) {
          resolvedName = clean
            .replace(/^[🍽️🥜🥗🥘🍛🍗🥩🍳🥤🍪🥪🍞🍕🍔🌮🍜🍲✨\-\*•\d\.\s\(\)]+/, "")
            .replace(/\b\w/g, c => c.toUpperCase())
            .trim();
        }

        const targetGrams = explicitGrams || entry.defaultServingGrams;
        return {
          originalInput: clean,
          resolvedFoodName: resolvedName,
          canonicalConcept: entry.canonicalName,
          semanticCategory: entry.category,
          recordType: "meal",
          isPureWater: false,
          mainProtein: entry.protein,
          cookingMethod: entry.cookingMethod,
          identityScore: 0.95,
          portionGrams: targetGrams,
          portionType: explicitGrams ? "explicit" : "estimated",
          portionUnit: explicitGrams ? "g" : entry.servingUnit,
          displayServing: explicitGrams ? `${explicitGrams}g` : entry.servingUnit,
          notes: `Indonesian Culinary Concept: ${entry.concept}`
        };
      }
    }
  }

  // Check if beverage concept first (milk, coffee, tea, juices, drinks, smoothies, chocolate milk)
  const isBeverageCategory = /\b(?:susu|milk|latte|cappuccino|smoothie|shake|jus|juice|kopi|coffee|teh|tea|boba|soda|cola|drink|minuman)\b/i.test(lower);
  // Check if snack concept (cookies, chips, solid chocolates/candy, wafer, crackers, fruits, nuts, yogurt)
  const isSnackCategory = !isBeverageCategory && /\b(?:chocolate|cokelat|coklat|candy|permen|wafer|cookies|kukis|biskuit|chips|keripik|snack|crackers|krekers|popcorn|kacang|nuts|almond|yogurt|buah|fruit|pisang|apel)\b/i.test(lower);

  // Clean conversational noise and capitalize
  const cleanDisplay = clean
    .replace(/^[🍽️🥜🥗🥘🍛🍗🥩🍳🥤🍪🥪🍞🍕🍔🌮🍜🍲✨\-\*•\d\.\s\(\)]+/, "")
    .replace(/^(?:aku|saya|gue|gw)\s+(?:makan|santap|ngemil|minum|catat)?\s*/i, "")
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim() || "Estimasi Makanan";

  const semanticCategory: "meal" | "snack" | "beverage" = isSnackCategory ? "snack" : (isBeverageCategory ? "beverage" : (isPureWater ? "beverage" : "meal"));
  const recordType: "meal" | "hydration" = isPureWater ? "hydration" : "meal";

  const defaultGrams = isSnackCategory ? 40 : (isBeverageCategory ? 250 : 150);
  const targetGrams = explicitGrams || (isBeverageCategory && explicitMl ? explicitMl : defaultGrams);
  const targetMl = isPureWater || isBeverageCategory ? (explicitMl || targetGrams) : undefined;

  // Never invent unstated cuts or cooking styles:
  // "ayam" stays "Ayam", "daging sapi" stays "Daging Sapi"
  let canonicalName = cleanDisplay;
  if (lower === "ayam" || lower === "daging ayam") {
    canonicalName = "Ayam";
  } else if (lower === "daging sapi" || lower === "sapi") {
    canonicalName = "Daging Sapi";
  } else if (lower === "nasi" || lower === "nasi putih") {
    canonicalName = "Nasi Putih";
  } else if (lower === "telur" || lower === "telor") {
    canonicalName = "Telur";
  }

  return {
    originalInput: clean,
    resolvedFoodName: canonicalName,
    canonicalConcept: canonicalName,
    semanticCategory,
    recordType,
    isPureWater,
    identityScore: 0.85,
    portionGrams: targetGrams,
    portionVolumeMl: targetMl,
    portionType: explicitGrams || explicitMl ? "explicit" : "estimated",
    portionUnit: isPureWater || isBeverageCategory ? "ml" : "g",
    displayServing: explicitGrams ? `${explicitGrams}g` : (explicitMl ? `${explicitMl} ml` : `1 Porsi (~${targetGrams}g)`),
    notes: isPureWater ? "Pure water hydration" : "Standard food item"
  };
}

/**
 * Fast helper to determine if an input represents pure water (air putih, air mineral)
 * Caloric beverages (milk, coffee, tea, juices) always return false.
 */
export function isPureWaterInput(rawText: string): boolean {
  if (!rawText) return false;
  return resolveCanonicalFoodIdentity(rawText).isPureWater;
}


// ─── 4. SEMANTIC DATABASE COMPATIBILITY VALIDATION ────────────────────────────

/**
 * Validates whether a candidate food reference from USDA/TKPI database is semantically compatible
 * with the user's food identity.
 * 
 * PREVENTS CRITICAL MISMATCHES:
 * - Solid chocolate/confectionery/snack MUST NOT match liquid cow milk or plain beverage.
 * - Savory chips with meat flavoring MUST NOT match actual whole meat/protein.
 * - Caloric drinks (coffee, tea, milk) MUST NOT match plain water.
 * - Organ meat (otak sapi, hati, paru) MUST NOT match muscle steak/rendang.
 * - Poultry (chicken) MUST NOT cross-match with beef.
 */
export function evaluateSemanticDatabaseMatch(
  identity: ResolvedFoodIdentity,
  candidateCategory: string,
  candidateKeywords: string[],
  candidateNormalizedName: string
): DatabaseMatchCandidate {
  const userLower = identity.resolvedFoodName.toLowerCase();
  const candNormLower = candidateNormalizedName.toLowerCase();
  const candCat = (candidateCategory || "").toLowerCase();

  // Rule 1: Solid Snack / Confectionery vs Liquid Dairy / Beverage
  // e.g. "SilverQueen Bites Milk Chocolate" -> MUST NOT match "Susu Sapi / UHT"
  const isSolidChocolateOrSnack = identity.semanticCategory === "snack" ||
    /(?:chocolate|cokelat|coklat|silverqueen|cadbury|candy|permen|wafer|cookies|kukis|biskuit|bites|chips|keripik|snack\s*bar)/i.test(userLower);
  const isLiquidDairyOrBeverageCandidate = candCat === "beverage" ||
    (candCat === "dairy" && (candNormLower.includes("susu sapi") || candNormLower.includes("uht") || candNormLower.includes("milk")));

  if (isSolidChocolateOrSnack && isLiquidDairyOrBeverageCandidate) {
    return {
      referenceId: "semantic_mismatch_dairy",
      referenceSource: "verified_nutrition_database",
      referenceName: candidateNormalizedName,
      matchType: "no_match",
      nutritionScore: 0.1,
      criticalMismatch: true,
      mismatchReason: "Solid confectionery snack must not be matched to liquid dairy milk."
    };
  }

  // Rule 2: Organ Meat vs Muscle Meat
  // e.g. "Otak Sapi" -> MUST NOT match "Daging Sapi / Rendang" or "Beef Steak"
  const isOrganMeat = /(?:otak\s+sapi|organ|hati|paru|babat|usus|ginjal)\b/i.test(userLower);
  const isMuscleMeatCandidate = (candNormLower.includes("rendang") || candNormLower.includes("steak") || candNormLower.includes("sirloin") || candNormLower.includes("dada ayam")) && !candNormLower.includes("otak");

  if (isOrganMeat && isMuscleMeatCandidate) {
    return {
      referenceId: "semantic_mismatch_organ_muscle",
      referenceSource: "verified_nutrition_database",
      referenceName: candidateNormalizedName,
      matchType: "no_match",
      nutritionScore: 0.15,
      criticalMismatch: true,
      mismatchReason: "Organ meat must not be replaced by muscle meat / steak / rendang."
    };
  }

  // Rule 3: Savory chips with meat flavoring vs actual meat
  // e.g. "Chitato Sapi Panggang" is chips, NOT beef meat
  const isChips = /(?:chips|keripik|chitato|lays|snack\s*balls|chiki)/i.test(userLower);
  if (isChips && (candCat === "protein" || candNormLower.includes("steak") || candNormLower.includes("rendang"))) {
    return {
      referenceId: "semantic_mismatch_chips_meat",
      referenceSource: "verified_nutrition_database",
      referenceName: candidateNormalizedName,
      matchType: "no_match",
      nutritionScore: 0.1,
      criticalMismatch: true,
      mismatchReason: "Flavored snack chips must not be matched to actual meat protein."
    };
  }

  // Rule 4: Beef vs Chicken dish
  if (userLower.includes("ayam") && (candNormLower.includes("beef") || candNormLower.includes("sapi"))) {
    return {
      referenceId: "semantic_mismatch_protein_type",
      referenceSource: "verified_nutrition_database",
      referenceName: candidateNormalizedName,
      matchType: "no_match",
      nutritionScore: 0.2,
      criticalMismatch: true,
      mismatchReason: "Chicken dish must not match beef reference."
    };
  }

  // Rule 5: Coffee / Tea vs Plain Water
  const isCaloricDrink = /(?:kopi|coffee|latte|teh|tea|jus|juice|boba|susu|milk)/i.test(userLower);
  if (isCaloricDrink && (candNormLower.includes("air putih") || candNormLower.includes("mineral water") || candNormLower.includes("plain water"))) {
    return {
      referenceId: "semantic_mismatch_drink_water",
      referenceSource: "verified_nutrition_database",
      referenceName: candidateNormalizedName,
      matchType: "no_match",
      nutritionScore: 0.1,
      criticalMismatch: true,
      mismatchReason: "Caloric drink must not match plain water hydration."
    };
  }

  // Compatibility verified
  let matchType: "exact" | "strong_semantic" | "approximate" = "approximate";
  if (candNormLower === userLower || candidateKeywords.some(k => k.toLowerCase() === userLower)) {
    matchType = "exact";
  } else if (candidateKeywords.some(k => userLower.includes(k.toLowerCase()) && k.length > 3)) {
    matchType = "strong_semantic";
  }

  const score = matchType === "exact" ? 0.98 : (matchType === "strong_semantic" ? 0.88 : 0.72);

  return {
    referenceId: candidateNormalizedName.toLowerCase().replace(/\s+/g, "_"),
    referenceSource: "verified_nutrition_database",
    referenceName: candidateNormalizedName,
    matchType,
    nutritionScore: score,
    criticalMismatch: false
  };
}

// ─── 5. DUAL CONFIDENCE SCORER ───────────────────────────────────────────────

/**
 * Calculates Dual Confidence (Identity Confidence vs Nutrition Reference Confidence)
 * and determines if user review is mandatory.
 */
export function calculateDualConfidence(
  identity: ResolvedFoodIdentity,
  dbMatch: DatabaseMatchCandidate | null
): DualConfidenceResult {
  const identityScore = identity.identityScore;
  const nutritionScore = dbMatch ? dbMatch.nutritionScore : 0.65;
  const criticalMismatch = Boolean(dbMatch?.criticalMismatch);

  const overallScore = criticalMismatch
    ? Math.min(identityScore, 0.4)
    : Math.round(((identityScore * 0.6) + (nutritionScore * 0.4)) * 100) / 100;

  let level: "high" | "medium" | "low" = "high";
  if (criticalMismatch || overallScore < 0.7 || identityScore < 0.7) {
    level = "low";
  } else if (overallScore < 0.85 || nutritionScore < 0.8) {
    level = "medium";
  }

  const requiresReview = level !== "high";
  let warningMessage: string | undefined = undefined;

  if (criticalMismatch) {
    warningMessage = "⚠️ Periksa hasil AI: AI mendeteksi ketidaksesuaian kategori makanan. Pastikan nama makanan dan porsinya sudah benar sebelum menyimpan.";
  } else if (requiresReview) {
    warningMessage = "⚠️ Periksa hasil AI: AI belum yakin sepenuhnya dengan porsi atau estimasi nutrisi. Pastikan data sudah sesuai sebelum menyimpan.";
  }

  return {
    identityScore,
    nutritionScore,
    overallScore,
    level,
    criticalMismatch,
    requiresReview,
    warningMessage
  };
}

// ─── 6. CANONICAL MEAL CATEGORY EVALUATOR ────────────────────────────────────

/**
 * Evaluates canonical meal category adhering to:
 * 1. Explicit user intent (HIGHEST PRIORITY): "buat sarapan" -> SARAPAN, "ngemil" -> SNACK
 * 2. First-class SNACK category: Cookies, chocolate, chips, fruit, yogurt -> SNACK regardless of time!
 * 3. Logged time windows:
 *    05:00–10:59 -> SARAPAN
 *    11:00–15:59 -> MAKAN SIANG
 *    16:00–21:59 -> MAKAN MALAM
 *    22:00–04:59 -> SNACK
 */
export function determineCanonicalMealCategory(
  userText: string,
  foodIdentity: ResolvedFoodIdentity,
  timeOrDate?: string | Date
): "SARAPAN" | "MAKAN SIANG" | "MAKAN MALAM" | "SNACK" | "AIR" {
  if (foodIdentity.isPureWater) {
    return "AIR";
  }

  const lowerText = (userText || "").toLowerCase();

  // 1. Explicit user intent
  if (/(?:sarapan|breakfast|pagi|buat\s*sarapan|untuk\s*sarapan)/i.test(lowerText)) {
    return "SARAPAN";
  }
  if (/(?:makan\s*siang|lunch|siang|buat\s*lunch|untuk\s*lunch)/i.test(lowerText)) {
    return "MAKAN SIANG";
  }
  if (/(?:makan\s*malam|dinner|malam|buat\s*dinner|untuk\s*dinner)/i.test(lowerText)) {
    return "MAKAN MALAM";
  }
  if (/(?:ngemil|camilan|cemilan|snack|kudapan|aku\s*ngemil|buat\s*snack|untuk\s*snack)/i.test(lowerText)) {
    return "SNACK";
  }

  // 2. First-class SNACK: If food concept is inherently a snack or packaged confectionery
  if (foodIdentity.semanticCategory === "snack") {
    return "SNACK";
  }

  // 3. Time Window Evaluation
  let hour = 12; // default noon
  if (timeOrDate) {
    const d = new Date(timeOrDate);
    if (!isNaN(d.getTime())) {
      // Offset to WIB (UTC+7)
      const wibHours = (d.getUTCHours() + 7) % 24;
      hour = wibHours;
    }
  } else {
    const now = new Date();
    hour = (now.getUTCHours() + 7) % 24;
  }

  if (hour >= 5 && hour < 11) {
    return "SARAPAN";
  } else if (hour >= 11 && hour < 16) {
    return "MAKAN SIANG";
  } else if (hour >= 16 && hour < 22) {
    return "MAKAN MALAM";
  } else {
    return "SNACK";
  }
}
