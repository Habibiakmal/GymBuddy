/**
 * GymBuddy AI Nutrition Engine
 * 
 * Pipeline:
 * 1. Parse and split user input into individual food items
 * 2. Identify food type, cooking method, and context
 * 3. Estimate realistic portion sizes (prioritizing user-specified quantities)
 * 4. Obtain nutrition data per 100g / per serving from USDA & TKPI (Panganku)
 * 5. Calculate each food's nutrition = (portion / 100) * per100g
 * 6. Accumulate total meal calories, protein, carbs, fat, fiber, sugar
 * 7. Validate sanity & calorie consistency
 */

export interface FoodItemNutrition {
  food_name: string;
  normalized_food_name: string;
  cooking_method?: "fried" | "boiled" | "grilled" | "steamed" | "roasted" | "raw" | "creamy" | "standard";
  estimated_quantity: number;
  estimated_weight_grams: number;
  serving_unit: string;
  display_unit?: string;
  item_type?: "water" | "beverage" | "food";
  portion_type?: "estimated" | "user_provided";
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium?: number;
  is_hydration?: boolean;
  volume_ml?: number;
  data_source: "USDA" | "TKPI" | "verified_nutrition_database" | "ai_estimation";
  confidence: "high" | "medium" | "low";
  notes?: string;
}

export interface MealNutritionResult {
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium?: number;
  isHydration: boolean;
  volumeMl: number;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  portionNote: string;
  items: FoodItemNutrition[];
  calculatedFromItems: boolean;
  debugLog?: string[];
}

export interface FoodReference {
  keywords: string[];
  normalizedName: string;
  category: "grain" | "protein" | "vegetable" | "fruit" | "beverage" | "dairy" | "snack" | "fat";
  defaultServingGrams: number;
  perPieceGrams?: number;
  servingUnit: string;
  per100g: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
  };
  cookingVariants?: Record<string, {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
  }>;
  isHydration?: boolean;
  defaultVolumeMl?: number;
  source: "USDA" | "TKPI";
}

/**
 * Standard Serving Sizes & Nutrition Benchmarks (USDA FoodData Central + Indonesian TKPI)
 */
export const NUTRITION_DATABASE: FoodReference[] = [
  // ── GRAINS & STARCHES ──────────────────────────────────────────
  {
    keywords: ["pasta", "spaghetti", "macaroni", "fettuccine", "penne", "mie pasta"],
    normalizedName: "Pasta (Cooked)",
    category: "grain",
    defaultServingGrams: 180, // Standard adult cooked portion
    servingUnit: "porsi sedang (cooked)",
    per100g: { calories: 158, protein: 5.8, carbs: 30.9, fat: 0.9, fiber: 1.8, sugar: 0.6 },
    cookingVariants: {
      creamy: { calories: 220, protein: 7.0, carbs: 28.0, fat: 9.5, fiber: 1.5, sugar: 1.2 },
      carbonara: { calories: 240, protein: 8.5, carbs: 27.0, fat: 11.0, fiber: 1.4, sugar: 1.0 },
      bolognese: { calories: 175, protein: 8.0, carbs: 26.0, fat: 4.5, fiber: 2.0, sugar: 2.5 },
      aglio: { calories: 180, protein: 5.8, carbs: 30.0, fat: 4.5, fiber: 1.8, sugar: 0.5 }
    },
    source: "USDA"
  },
  {
    keywords: ["kentang goreng", "french fries", "fries", "pommes frites"],
    normalizedName: "Kentang Goreng (French Fries)",
    category: "snack",
    defaultServingGrams: 100, // Regular serving
    servingUnit: "porsi regular",
    per100g: { calories: 312, protein: 3.4, carbs: 41.4, fat: 15.0, fiber: 3.8, sugar: 0.3 },
    cookingVariants: {
      rebus: { calories: 87, protein: 1.9, carbs: 20.1, fat: 0.1, fiber: 1.8, sugar: 0.9 },
      panggang: { calories: 93, protein: 2.5, carbs: 21.0, fat: 0.2, fiber: 2.2, sugar: 1.2 }
    },
    source: "USDA"
  },
  {
    keywords: ["kentang", "potato", "kentang rebus", "mashed potato"],
    normalizedName: "Kentang Rebus / Mashed",
    category: "grain",
    defaultServingGrams: 150,
    servingUnit: "1 butir sedang",
    per100g: { calories: 87, protein: 1.9, carbs: 20.1, fat: 0.1, fiber: 1.8, sugar: 0.9 },
    source: "USDA"
  },
  {
    keywords: ["roti", "roti tawar", "white bread", "bread", "toast", "roti gandum"],
    normalizedName: "Roti Tawar",
    category: "grain",
    defaultServingGrams: 60, // 2 slices ~60g
    perPieceGrams: 30, // 1 slice ~30g
    servingUnit: "2 lembar",
    per100g: { calories: 265, protein: 9.0, carbs: 49.0, fat: 3.2, fiber: 2.7, sugar: 5.0 },
    cookingVariants: {
      butter: { calories: 340, protein: 8.0, carbs: 46.0, fat: 14.0, fiber: 2.5, sugar: 5.5 },
      gandum: { calories: 247, protein: 13.0, carbs: 41.0, fat: 3.4, fiber: 6.0, sugar: 4.3 }
    },
    source: "USDA"
  },
  {
    keywords: ["oatmeal", "oats", "havermut", "quaker oats"],
    normalizedName: "Oatmeal (Cooked)",
    category: "grain",
    defaultServingGrams: 200, // 1 bowl cooked
    servingUnit: "1 mangkuk",
    per100g: { calories: 71, protein: 2.5, carbs: 12.0, fat: 1.5, fiber: 1.7, sugar: 0.3 },
    source: "USDA"
  },
  {
    keywords: ["nasi putih", "nasi", "rice", "white rice", "nasi liwet"],
    normalizedName: "Nasi Putih (Cooked)",
    category: "grain",
    defaultServingGrams: 180, // 1 piring / 1.5 centong
    servingUnit: "1 porsi / centong",
    per100g: { calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3, fiber: 0.4, sugar: 0.1 },
    source: "TKPI"
  },
  {
    keywords: ["nasi merah", "brown rice", "red rice"],
    normalizedName: "Nasi Merah (Cooked)",
    category: "grain",
    defaultServingGrams: 180,
    servingUnit: "1 porsi",
    per100g: { calories: 111, protein: 2.6, carbs: 23.0, fat: 0.9, fiber: 1.8, sugar: 0.2 },
    source: "TKPI"
  },
  {
    keywords: ["nasi goreng", "fried rice"],
    normalizedName: "Nasi Goreng Komplit",
    category: "grain",
    defaultServingGrams: 250,
    servingUnit: "1 piring komplit",
    per100g: { calories: 195, protein: 6.5, carbs: 25.0, fat: 7.8, fiber: 1.2, sugar: 1.5 },
    source: "TKPI"
  },
  {
    keywords: ["rice bowl ayam", "nasi bowl ayam", "chicken rice bowl", "ricebowl ayam", "nasi rice bowl ayam", "rice bowl chicken"],
    normalizedName: "Rice Bowl Ayam (Chicken Rice Bowl)",
    category: "grain",
    defaultServingGrams: 350,
    servingUnit: "1 rice bowl",
    per100g: { calories: 165, protein: 9.7, carbs: 19.4, fat: 5.1, fiber: 0.9, sugar: 0.8 },
    source: "USDA"
  },
  {
    keywords: ["rice bowl sapi", "nasi bowl sapi", "beef rice bowl", "ricebowl sapi", "nasi rice bowl sapi", "rice bowl beef", "gyudon"],
    normalizedName: "Rice Bowl Sapi (Beef Rice Bowl)",
    category: "grain",
    defaultServingGrams: 350,
    servingUnit: "1 rice bowl",
    per100g: { calories: 177, protein: 9.1, carbs: 18.5, fat: 6.8, fiber: 0.7, sugar: 1.1 },
    source: "USDA"
  },
  {
    keywords: ["rice bowl teriyaki", "nasi bowl teriyaki", "chicken teriyaki rice bowl"],
    normalizedName: "Rice Bowl Teriyaki",
    category: "grain",
    defaultServingGrams: 350,
    servingUnit: "1 rice bowl",
    per100g: { calories: 160, protein: 8.5, carbs: 20.0, fat: 4.8, fiber: 0.7, sugar: 2.2 },
    source: "USDA"
  },
  {
    keywords: ["rice bowl katsu", "nasi bowl katsu", "katsu rice bowl", "chicken katsu rice bowl"],
    normalizedName: "Rice Bowl Chicken Katsu",
    category: "grain",
    defaultServingGrams: 380,
    servingUnit: "1 rice bowl",
    per100g: { calories: 178, protein: 7.3, carbs: 20.0, fat: 7.3, fiber: 0.8, sugar: 1.3 },
    source: "USDA"
  },
  {
    keywords: ["rice bowl", "nasi bowl", "ricebowl", "donburi", "poke bowl", "pokebowl"],
    normalizedName: "Rice Bowl Combo",
    category: "grain",
    defaultServingGrams: 350,
    servingUnit: "1 rice bowl",
    per100g: { calories: 157, protein: 7.4, carbs: 18.5, fat: 5.1, fiber: 0.8, sugar: 0.9 },
    source: "USDA"
  },
  {
    keywords: ["nasi padang", "nasi ramas"],
    normalizedName: "Nasi Padang Komplit",
    category: "grain",
    defaultServingGrams: 300,
    servingUnit: "1 porsi bungkus/piring",
    per100g: { calories: 235, protein: 11.5, carbs: 22.0, fat: 11.5, fiber: 1.5, sugar: 1.0 },
    source: "TKPI"
  },
  {
    keywords: ["nasi uduk", "nasi kuning"],
    normalizedName: "Nasi Uduk / Kuning",
    category: "grain",
    defaultServingGrams: 180,
    servingUnit: "1 porsi",
    per100g: { calories: 165, protein: 3.2, carbs: 28.5, fat: 4.5, fiber: 0.6, sugar: 0.5 },
    source: "TKPI"
  },
  {
    keywords: ["mie goreng", "indomie goreng", "bihun goreng", "kwetiau goreng"],
    normalizedName: "Mie Goreng (1 Porsi)",
    category: "grain",
    defaultServingGrams: 180,
    servingUnit: "1 porsi",
    per100g: { calories: 215, protein: 5.5, carbs: 29.5, fat: 8.5, fiber: 1.5, sugar: 2.5 },
    source: "TKPI"
  },
  {
    keywords: ["mie kuah", "mie rebus", "indomie rebus", "ramen"],
    normalizedName: "Mie Kuah / Rebus",
    category: "grain",
    defaultServingGrams: 220,
    servingUnit: "1 mangkuk",
    per100g: { calories: 145, protein: 4.0, carbs: 22.0, fat: 4.5, fiber: 1.0, sugar: 1.2 },
    source: "TKPI"
  },

  // ── PROTEINS & MEATS ──────────────────────────────────────────
  {
    keywords: ["chicken meal", "chicken", "ayam", "olahan ayam", "daging ayam"],
    normalizedName: "Chicken Meal (Dada/Paha)",
    category: "protein",
    defaultServingGrams: 150,
    perPieceGrams: 150,
    servingUnit: "1 porsi (~150g)",
    per100g: { calories: 190, protein: 26.0, carbs: 0.0, fat: 9.0, fiber: 0.0, sugar: 0.0 },
    source: "USDA"
  },
  {
    keywords: ["ayam goreng", "fried chicken", "ayam kfc", "ayam crispy"],
    normalizedName: "Ayam Goreng (Dada/Paha + Kulit)",
    category: "protein",
    defaultServingGrams: 120, // 1 piece cooked
    perPieceGrams: 120,
    servingUnit: "1 potong sedang",
    per100g: { calories: 246, protein: 24.5, carbs: 3.5, fat: 14.8, fiber: 0.0, sugar: 0.0 },
    source: "USDA"
  },
  {
    keywords: ["dada ayam", "ayam rebus", "chicken breast", "ayam panggang", "ayam grill", "ayam kukus"],
    normalizedName: "Dada Ayam (Cooked/Grilled)",
    category: "protein",
    defaultServingGrams: 120,
    perPieceGrams: 120,
    servingUnit: "1 potong dada",
    per100g: { calories: 165, protein: 31.0, carbs: 0.0, fat: 3.6, fiber: 0.0, sugar: 0.0 },
    source: "USDA"
  },
  {
    keywords: ["ayam geprek"],
    normalizedName: "Ayam Geprek Crispy + Sambal",
    category: "protein",
    defaultServingGrams: 140,
    perPieceGrams: 140,
    servingUnit: "1 potong geprek",
    per100g: { calories: 265, protein: 22.0, carbs: 8.5, fat: 16.0, fiber: 0.8, sugar: 0.5 },
    source: "TKPI"
  },
  {
    keywords: ["bebek goreng", "bebek bakar", "duck"],
    normalizedName: "Bebek Goreng / Bakar",
    category: "protein",
    defaultServingGrams: 140,
    perPieceGrams: 140,
    servingUnit: "1 potong paha/dada",
    per100g: { calories: 337, protein: 19.0, carbs: 0.0, fat: 28.0, fiber: 0.0, sugar: 0.0 },
    source: "TKPI"
  },
  {
    keywords: ["kulit ayam", "kulit", "chicken skin"],
    normalizedName: "Kulit Ayam Goreng Crispy",
    category: "fat",
    defaultServingGrams: 40,
    servingUnit: "1 porsi kecil",
    per100g: { calories: 450, protein: 15.0, carbs: 4.0, fat: 42.0, fiber: 0.0, sugar: 0.0 },
    source: "TKPI"
  },
  {
    keywords: ["usus", "usus goreng", "jeroan"],
    normalizedName: "Usus Goreng",
    category: "protein",
    defaultServingGrams: 40,
    servingUnit: "1 tusuk / porsi",
    per100g: { calories: 310, protein: 22.0, carbs: 2.0, fat: 24.0, fiber: 0.0, sugar: 0.0 },
    source: "TKPI"
  },
  {
    keywords: ["nugget", "chicken nugget", "nugget ayam"],
    normalizedName: "Chicken Nugget",
    category: "protein",
    defaultServingGrams: 80, // 4 pcs
    perPieceGrams: 20,
    servingUnit: "4 pcs",
    per100g: { calories: 296, protein: 15.0, carbs: 14.0, fat: 20.0, fiber: 0.8, sugar: 0.5 },
    source: "USDA"
  },
  {
    keywords: ["sosis", "sausage", "bratwurst", "hot dog"],
    normalizedName: "Sosis (Cooked)",
    category: "protein",
    defaultServingGrams: 50, // 1 standard sausage
    perPieceGrams: 50,
    servingUnit: "1 buah sedang",
    per100g: { calories: 301, protein: 12.0, carbs: 3.0, fat: 27.0, fiber: 0.0, sugar: 1.2 },
    source: "USDA"
  },
  {
    keywords: ["telur", "telur rebus", "egg", "boiled egg", "telor"],
    normalizedName: "Telur Ayam Rebus",
    category: "protein",
    defaultServingGrams: 50, // 1 large egg
    perPieceGrams: 50,
    servingUnit: "1 butir",
    per100g: { calories: 155, protein: 12.6, carbs: 1.1, fat: 10.6, fiber: 0.0, sugar: 1.1 },
    cookingVariants: {
      goreng: { calories: 195, protein: 13.5, carbs: 1.2, fat: 15.0, fiber: 0.0, sugar: 1.0 },
      ceplok: { calories: 195, protein: 13.5, carbs: 1.2, fat: 15.0, fiber: 0.0, sugar: 1.0 },
      dadar: { calories: 200, protein: 13.0, carbs: 1.5, fat: 15.5, fiber: 0.0, sugar: 1.0 }
    },
    source: "USDA"
  },
  {
    keywords: ["telur goreng", "telur ceplok", "telur dadar", "omelet", "fried egg"],
    normalizedName: "Telur Goreng / Ceplok / Dadar",
    category: "protein",
    defaultServingGrams: 55,
    perPieceGrams: 55,
    servingUnit: "1 butir",
    per100g: { calories: 196, protein: 13.6, carbs: 0.8, fat: 15.3, fiber: 0.0, sugar: 0.8 },
    source: "USDA"
  },
  {
    keywords: ["udang", "shrimp", "prawn"],
    normalizedName: "Udang (Cooked)",
    category: "protein",
    defaultServingGrams: 60, // ~4-5 pieces
    perPieceGrams: 15, // 1 piece ~15g
    servingUnit: "4 buah (60g)",
    per100g: { calories: 99, protein: 24.0, carbs: 0.2, fat: 0.3, fiber: 0.0, sugar: 0.0 },
    cookingVariants: {
      goreng: { calories: 180, protein: 20.0, carbs: 6.0, fat: 8.5, fiber: 0.0, sugar: 0.0 }
    },
    source: "USDA"
  },
  {
    keywords: ["cumi", "squid", "calamari", "cumi goreng"],
    normalizedName: "Cumi-Cumi (Cooked)",
    category: "protein",
    defaultServingGrams: 80,
    servingUnit: "1 porsi",
    per100g: { calories: 140, protein: 25.0, carbs: 3.0, fat: 3.5, fiber: 0.0, sugar: 0.0 },
    source: "TKPI"
  },
  {
    keywords: ["daging sapi", "beef", "sapi", "rendang", "steak"],
    normalizedName: "Daging Sapi / Rendang",
    category: "protein",
    defaultServingGrams: 80,
    perPieceGrams: 80,
    servingUnit: "1 potong sedang",
    per100g: { calories: 250, protein: 26.0, carbs: 2.0, fat: 15.0, fiber: 0.0, sugar: 0.5 },
    source: "TKPI"
  },
  {
    keywords: ["kambing", "daging kambing", "gulai kambing"],
    normalizedName: "Daging Kambing (Cooked)",
    category: "protein",
    defaultServingGrams: 80,
    servingUnit: "1 porsi",
    per100g: { calories: 230, protein: 25.0, carbs: 0.0, fat: 14.0, fiber: 0.0, sugar: 0.0 },
    source: "TKPI"
  },
  {
    keywords: ["ikan", "fish", "salmon", "tuna", "ikan lele", "ikan bakar", "ikan goreng", "ikan gurame", "ikan kembung"],
    normalizedName: "Ikan (Cooked/Bakar)",
    category: "protein",
    defaultServingGrams: 100,
    perPieceGrams: 100,
    servingUnit: "1 ekor / potong",
    per100g: { calories: 160, protein: 22.0, carbs: 1.0, fat: 7.5, fiber: 0.0, sugar: 0.0 },
    source: "TKPI"
  },
  {
    keywords: ["tahu", "tofu", "tahu goreng", "tahu kukus"],
    normalizedName: "Tahu",
    category: "protein",
    defaultServingGrams: 80,
    perPieceGrams: 40,
    servingUnit: "2 potong",
    per100g: { calories: 110, protein: 9.5, carbs: 3.5, fat: 6.5, fiber: 1.2, sugar: 0.5 },
    source: "TKPI"
  },
  {
    keywords: ["tempe", "tempeh", "tempe goreng", "tempe bacem"],
    normalizedName: "Tempe",
    category: "protein",
    defaultServingGrams: 70,
    perPieceGrams: 35,
    servingUnit: "2 potong",
    per100g: { calories: 195, protein: 18.5, carbs: 9.0, fat: 10.5, fiber: 3.5, sugar: 1.0 },
    source: "TKPI"
  },

  // ── INDONESIAN DISHES & STREET FOOD ───────────────────────────
  {
    keywords: ["sate ayam", "satay"],
    normalizedName: "Sate Ayam + Bumbu Kacang (5 Tusuk)",
    category: "protein",
    defaultServingGrams: 150,
    servingUnit: "5 tusuk + bumbu",
    per100g: { calories: 230, protein: 18.0, carbs: 9.5, fat: 13.5, fiber: 1.2, sugar: 4.5 },
    source: "TKPI"
  },
  {
    keywords: ["bakso", "bakso sapi", "mie bakso"],
    normalizedName: "Bakso Sapi Kuah Komplit",
    category: "protein",
    defaultServingGrams: 350, // 1 mangkuk
    servingUnit: "1 mangkuk komplit",
    per100g: { calories: 120, protein: 7.5, carbs: 11.0, fat: 4.5, fiber: 0.8, sugar: 1.0 },
    source: "TKPI"
  },
  {
    keywords: ["soto", "soto ayam", "soto daging", "soto betawi"],
    normalizedName: "Soto Ayam / Sapi (1 Mangkuk)",
    category: "protein",
    defaultServingGrams: 300,
    servingUnit: "1 mangkuk",
    per100g: { calories: 105, protein: 6.5, carbs: 8.0, fat: 4.5, fiber: 0.6, sugar: 1.2 },
    source: "TKPI"
  },
  {
    keywords: ["batagor", "batagor bandung"],
    normalizedName: "Batagor Bandung (1 Porsi)",
    category: "snack",
    defaultServingGrams: 180,
    servingUnit: "1 porsi komplit",
    per100g: { calories: 255, protein: 11.0, carbs: 25.0, fat: 12.0, fiber: 1.5, sugar: 3.5 },
    source: "TKPI"
  },
  {
    keywords: ["siomay", "siomay bandung"],
    normalizedName: "Siomay Bandung (1 Porsi)",
    category: "snack",
    defaultServingGrams: 180,
    servingUnit: "1 porsi komplit",
    per100g: { calories: 210, protein: 12.0, carbs: 22.0, fat: 8.0, fiber: 1.8, sugar: 3.0 },
    source: "TKPI"
  },
  {
    keywords: ["pempek", "empek empek", "pempek kapal selam"],
    normalizedName: "Pempek Palembang + Cuko",
    category: "snack",
    defaultServingGrams: 200,
    servingUnit: "1 porsi",
    per100g: { calories: 190, protein: 9.5, carbs: 28.0, fat: 4.0, fiber: 0.5, sugar: 5.0 },
    source: "TKPI"
  },
  {
    keywords: ["gado gado", "gado-gado", "pecel", "lotek"],
    normalizedName: "Gado-Gado / Pecel Sayur",
    category: "vegetable",
    defaultServingGrams: 250,
    servingUnit: "1 porsi komplit",
    per100g: { calories: 135, protein: 5.5, carbs: 16.0, fat: 5.5, fiber: 3.2, sugar: 4.0 },
    source: "TKPI"
  },
  {
    keywords: ["martabak manis", "terang bulan"],
    normalizedName: "Martabak Manis (1 Potong)",
    category: "snack",
    defaultServingGrams: 75, // 1 slice
    servingUnit: "1 potong",
    per100g: { calories: 360, protein: 6.5, carbs: 48.0, fat: 16.0, fiber: 1.2, sugar: 26.0 },
    source: "TKPI"
  },
  {
    keywords: ["martabak telur", "martabak telor"],
    normalizedName: "Martabak Telur (2 Potong)",
    category: "snack",
    defaultServingGrams: 120,
    servingUnit: "2 potong",
    per100g: { calories: 260, protein: 12.0, carbs: 14.0, fat: 17.0, fiber: 0.8, sugar: 1.0 },
    source: "TKPI"
  },
  {
    keywords: ["pisang goreng"],
    normalizedName: "Pisang Goreng (2 Pcs)",
    category: "snack",
    defaultServingGrams: 100, // 2 pcs
    servingUnit: "2 buah",
    per100g: { calories: 252, protein: 2.0, carbs: 42.0, fat: 8.5, fiber: 2.5, sugar: 18.0 },
    source: "TKPI"
  },
  {
    keywords: ["gorengan", "bakwan", "bala-bala", "tahu isi", "cireng"],
    normalizedName: "Gorengan / Bakwan (2 Pcs)",
    category: "snack",
    defaultServingGrams: 90,
    servingUnit: "2 buah",
    per100g: { calories: 280, protein: 4.5, carbs: 30.0, fat: 16.0, fiber: 1.8, sugar: 1.5 },
    source: "TKPI"
  },
  {
    keywords: ["burger", "cheeseburger", "beef burger"],
    normalizedName: "Burger Daging Sapi",
    category: "grain",
    defaultServingGrams: 180, // 1 burger
    servingUnit: "1 buah burger",
    per100g: { calories: 260, protein: 13.0, carbs: 24.0, fat: 12.5, fiber: 1.2, sugar: 4.0 },
    source: "USDA"
  },
  {
    keywords: ["pizza"],
    normalizedName: "Pizza (1 Slice)",
    category: "grain",
    defaultServingGrams: 110, // 1 slice regular
    servingUnit: "1 potong (slice)",
    per100g: { calories: 266, protein: 11.5, carbs: 32.0, fat: 10.0, fiber: 2.3, sugar: 3.5 },
    source: "USDA"
  },

  // ── VEGETABLES & SPECIALTIES ──────────────────────────────────
  {
    keywords: ["jengkol", "semur jengkol", "jengkol goreng", "rendang jengkol"],
    normalizedName: "Jengkol (Cooked)",
    category: "vegetable",
    defaultServingGrams: 60, // ~4-5 keping
    servingUnit: "1 porsi (4-5 keping)",
    per100g: { calories: 192, protein: 5.4, carbs: 34.0, fat: 3.2, fiber: 5.8, sugar: 1.5 },
    source: "TKPI"
  },
  {
    keywords: ["petai", "pete"],
    normalizedName: "Petai / Pete (1 Papan)",
    category: "vegetable",
    defaultServingGrams: 50,
    servingUnit: "1 papan",
    per100g: { calories: 142, protein: 9.0, carbs: 22.0, fat: 1.5, fiber: 4.5, sugar: 2.0 },
    source: "TKPI"
  },
  {
    keywords: ["sayur asem", "sayur asam"],
    normalizedName: "Sayur Asem",
    category: "vegetable",
    defaultServingGrams: 150, // 1 mangkuk sedang
    servingUnit: "1 mangkuk",
    per100g: { calories: 43, protein: 1.5, carbs: 8.0, fat: 0.6, fiber: 2.0, sugar: 2.5 },
    source: "TKPI"
  },
  {
    keywords: ["sayur", "sop sayur", "tumis kangkung", "capcay", "bayam", "kangkung"],
    normalizedName: "Sayuran / Tumis / Sop",
    category: "vegetable",
    defaultServingGrams: 120,
    servingUnit: "1 mangkuk / porsi",
    per100g: { calories: 50, protein: 2.2, carbs: 6.5, fat: 1.8, fiber: 2.5, sugar: 2.0 },
    source: "TKPI"
  },
  {
    keywords: ["sambal", "sambel", "sambal terasi", "sambal bawang"],
    normalizedName: "Sambal",
    category: "snack",
    defaultServingGrams: 20, // 1 sendok makan
    servingUnit: "1 sdm",
    per100g: { calories: 120, protein: 2.0, carbs: 12.0, fat: 7.0, fiber: 2.5, sugar: 5.0 },
    source: "TKPI"
  },
  {
    keywords: ["kerupuk", "krupuk"],
    normalizedName: "Kerupuk (2 Pcs)",
    category: "snack",
    defaultServingGrams: 30,
    servingUnit: "2 keping",
    per100g: { calories: 480, protein: 3.5, carbs: 68.0, fat: 21.0, fiber: 1.0, sugar: 1.0 },
    source: "TKPI"
  },

  // ── FRUITS ────────────────────────────────────────────────────
  {
    keywords: ["pisang", "banana"],
    normalizedName: "Pisang (1 Buah Sedang)",
    category: "fruit",
    defaultServingGrams: 118,
    servingUnit: "1 buah sedang",
    per100g: { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6, sugar: 12.2 },
    source: "USDA"
  },
  {
    keywords: ["apel", "apple"],
    normalizedName: "Apel (1 Buah Sedang)",
    category: "fruit",
    defaultServingGrams: 180,
    servingUnit: "1 buah sedang",
    per100g: { calories: 52, protein: 0.3, carbs: 13.8, fat: 0.2, fiber: 2.4, sugar: 10.4 },
    source: "USDA"
  },
  {
    keywords: ["alpukat", "avocado"],
    normalizedName: "Alpukat (1/2 Buah)",
    category: "fruit",
    defaultServingGrams: 100,
    servingUnit: "1/2 buah",
    per100g: { calories: 160, protein: 2.0, carbs: 8.5, fat: 14.7, fiber: 6.7, sugar: 0.7 },
    source: "USDA"
  },
  {
    keywords: ["semangka", "watermelon"],
    normalizedName: "Semangka (1 Potong)",
    category: "fruit",
    defaultServingGrams: 200,
    servingUnit: "1 potong besar",
    per100g: { calories: 30, protein: 0.6, carbs: 7.6, fat: 0.2, fiber: 0.4, sugar: 6.2 },
    source: "USDA"
  },

  // ── DAIRY, NUTS & SPREADS ──────────────────────────────────────
  {
    keywords: ["susu", "milk", "susu uht", "fresh milk"],
    normalizedName: "Susu Sapi / UHT (1 Gelas)",
    category: "dairy",
    defaultServingGrams: 250,
    servingUnit: "1 gelas (250ml)",
    per100g: { calories: 60, protein: 3.2, carbs: 4.8, fat: 3.3, fiber: 0.0, sugar: 4.8 },
    isHydration: true,
    defaultVolumeMl: 250,
    source: "USDA"
  },
  {
    keywords: ["keju", "cheese", "cheddar"],
    normalizedName: "Keju (1 Slice)",
    category: "dairy",
    defaultServingGrams: 20,
    servingUnit: "1 lembar (20g)",
    per100g: { calories: 403, protein: 25.0, carbs: 1.3, fat: 33.0, fiber: 0.0, sugar: 0.5 },
    source: "USDA"
  },
  {
    keywords: ["almond", "kacang almond", "kacang tanah", "kacang"],
    normalizedName: "Kacang-kacangan (1 Genggam)",
    category: "snack",
    defaultServingGrams: 30,
    servingUnit: "1 genggam (30g)",
    per100g: { calories: 579, protein: 21.0, carbs: 21.5, fat: 49.9, fiber: 12.5, sugar: 4.3 },
    source: "USDA"
  },
  {
    keywords: ["selai kacang", "peanut butter"],
    normalizedName: "Selai Kacang (1 Sdm)",
    category: "fat",
    defaultServingGrams: 16,
    servingUnit: "1 sendok makan",
    per100g: { calories: 588, protein: 25.0, carbs: 20.0, fat: 50.0, fiber: 6.0, sugar: 9.0 },
    source: "USDA"
  },

  // ── BEVERAGES ──────────────────────────────────────────────────
  {
    keywords: ["mineral water 500ml", "mineral water", "air putih", "air mineral", "plain water", "aqua", "le minerale", "vit", "cleo", "air"],
    normalizedName: "Air Mineral (Water)",
    category: "beverage",
    defaultServingGrams: 500,
    servingUnit: "500 ml",
    per100g: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 },
    isHydration: true,
    defaultVolumeMl: 500,
    source: "USDA"
  },
  {
    keywords: ["americano / kopi hitam", "americano 500ml", "americano", "espresso", "kopi hitam", "black coffee", "kopi o", "long black", "kopi tubruk tawar", "kopi"],
    normalizedName: "Americano / Kopi Hitam",
    category: "beverage",
    defaultServingGrams: 250,
    servingUnit: "250 ml",
    per100g: { calories: 2, protein: 0.12, carbs: 0.4, fat: 0.0, fiber: 0.0, sugar: 0.0 },
    isHydration: false,
    defaultVolumeMl: 250,
    source: "USDA"
  },
  {
    keywords: ["orange juice 250ml", "orange juice", "jus jeruk", "es jeruk"],
    normalizedName: "Orange Juice",
    category: "beverage",
    defaultServingGrams: 250,
    servingUnit: "250 ml",
    per100g: { calories: 45, protein: 0.7, carbs: 10.4, fat: 0.2, fiber: 0.2, sugar: 8.4 },
    isHydration: false,
    defaultVolumeMl: 250,
    source: "USDA"
  },
  {
    keywords: ["kopi susu", "latte", "cappuccino", "flat white"],
    normalizedName: "Kopi Susu / Latte",
    category: "beverage",
    defaultServingGrams: 250,
    servingUnit: "250 ml",
    per100g: { calories: 60, protein: 2.0, carbs: 7.2, fat: 2.5, fiber: 0.0, sugar: 5.6 },
    isHydration: false,
    defaultVolumeMl: 250,
    source: "USDA"
  },
  {
    keywords: ["boba", "boba milk tea", "bubble tea"],
    normalizedName: "Boba Milk Tea (1 Cup)",
    category: "beverage",
    defaultServingGrams: 450,
    servingUnit: "450 ml",
    per100g: { calories: 75, protein: 1.0, carbs: 16.5, fat: 1.0, fiber: 0.2, sugar: 14.0 },
    isHydration: false,
    defaultVolumeMl: 450,
    source: "USDA"
  },
  {
    keywords: ["teh manis", "es teh manis", "teh kotak", "teh botol"],
    normalizedName: "Es Teh Manis",
    category: "beverage",
    defaultServingGrams: 300,
    servingUnit: "300 ml",
    per100g: { calories: 32, protein: 0.0, carbs: 8.0, fat: 0.0, fiber: 0.0, sugar: 7.5 },
    isHydration: false,
    defaultVolumeMl: 300,
    source: "TKPI"
  },
  {
    keywords: ["teh tawar", "green tea", "teh hijau", "ocha"],
    normalizedName: "Teh Tawar / Green Tea",
    category: "beverage",
    defaultServingGrams: 250,
    servingUnit: "250 ml",
    per100g: { calories: 1, protein: 0.0, carbs: 0.2, fat: 0.0, fiber: 0.0, sugar: 0.0 },
    isHydration: false,
    defaultVolumeMl: 250,
    source: "USDA"
  },
  {
    keywords: ["jus buah", "jus alpukat", "jus mangga", "juice"],
    normalizedName: "Jus Buah Segar",
    category: "beverage",
    defaultServingGrams: 300,
    servingUnit: "300 ml",
    per100g: { calories: 55, protein: 0.8, carbs: 13.0, fat: 0.5, fiber: 1.5, sugar: 11.0 },
    isHydration: false,
    defaultVolumeMl: 300,
    source: "TKPI"
  },
  {
    keywords: ["whey", "protein shake", "susu protein"],
    normalizedName: "Whey Protein Shake",
    category: "beverage",
    defaultServingGrams: 300,
    servingUnit: "300 ml",
    per100g: { calories: 45, protein: 8.0, carbs: 1.0, fat: 0.6, fiber: 0.2, sugar: 0.5 },
    isHydration: false,
    defaultVolumeMl: 300,
    source: "USDA"
  }
];

/**
 * Natural Language Quantity & Unit Parser
 */
export function parseQuantityAndUnit(text: string): {
  quantity: number;
  explicitGrams?: number;
  explicitVolumeMl?: number;
  multiplier: number;
  cookingMethod?: "fried" | "boiled" | "grilled" | "steamed" | "roasted" | "raw" | "creamy" | "standard";
  cleanedText: string;
} {
  let cleaned = text.trim();
  let quantity = 1;
  let explicitGrams: number | undefined = undefined;
  let explicitVolumeMl: number | undefined = undefined;
  let multiplier = 1.0;
  let cookingMethod: FoodItemNutrition["cooking_method"] = "standard";

  // 1. Detect explicit volume in ml (e.g., "500ml", "500 ml", "250ml", "750 ml")
  const mlMatch = cleaned.match(/(\d+(?:[\.,]\d+)?)\s*(?:ml|milliliter|mililiter)\b/i);
  if (mlMatch) {
    explicitVolumeMl = parseFloat(mlMatch[1].replace(',', '.'));
    cleaned = cleaned.replace(mlMatch[0], "").trim();
  }

  // 2. Detect explicit liters (e.g., "1.5L", "1 liter", "2L", "1,5 liter")
  const literMatch = cleaned.match(/(\d+(?:[\.,]\d+)?)\s*(?:l|liter|litre)\b/i);
  if (literMatch) {
    explicitVolumeMl = parseFloat(literMatch[1].replace(',', '.')) * 1000;
    cleaned = cleaned.replace(literMatch[0], "").trim();
  }

  // 3. Detect explicit grams (e.g., "150g", "150 gram", "100gr")
  const gramMatch = cleaned.match(/(\d+(?:[\.,]\d+)?)\s*(?:g|gr|gram|grams)\b/i);
  if (gramMatch) {
    explicitGrams = parseFloat(gramMatch[1].replace(',', '.'));
    cleaned = cleaned.replace(gramMatch[0], "").trim();
  }

  // 4. Detect cup / gelas / bottle quantities (e.g. "2 cups", "2 gelas", "1 cup", "1 botol")
  const cupMatch = cleaned.match(/(\d+(?:[\.,]\d+)?)\s*(?:cup|cups|gelas|cangkir|can|kaleng|botol|bottle)\b/i);
  if (cupMatch) {
    quantity = parseFloat(cupMatch[1].replace(',', '.'));
    cleaned = cleaned.replace(cupMatch[0], "").trim();
  }

  // 5. Detect numeric pieces/slices/units (e.g., "2 telur", "2 slices", "3 buah", "2 potong", "1 piring", "1 centong")
  const qtyMatch = cleaned.match(/^(\d+(?:[\.,]\d+)?)\s*(?:buah|biji|butir|potong|lembar|slice|slices|pcs|porsi|mangkok|mangkuk|centong|piring|scoop)?\b/i);
  if (qtyMatch) {
    quantity = parseFloat(qtyMatch[1].replace(',', '.'));
    cleaned = cleaned.replace(qtyMatch[0], "").trim();
  }

  // 6. Detect suffix quantities (e.g., "udang 2 buah", "telur 2 butir")
  const suffixQtyMatch = cleaned.match(/\b(\d+(?:[\.,]\d+)?)\s*(?:buah|biji|butir|potong|lembar|slice|slices|pcs|porsi|mangkok|mangkuk|centong|piring|scoop)\b/i);
  if (suffixQtyMatch) {
    quantity = parseFloat(suffixQtyMatch[1].replace(',', '.'));
    cleaned = cleaned.replace(suffixQtyMatch[0], "").trim();
  }

  // Fractional portions ("setengah porsi" -> 0.5, "seperempat" -> 0.25)
  if (cleaned.match(/\bsetengah|1\/2|half\b/i)) {
    multiplier *= 0.5;
    cleaned = cleaned.replace(/\bsetengah|1\/2|half\b/i, "").trim();
  }
  if (cleaned.match(/\bseperempat|1\/4|quarter\b/i)) {
    multiplier *= 0.25;
    cleaned = cleaned.replace(/\bseperempat|1\/4|quarter\b/i, "").trim();
  }
  if (cleaned.match(/\b(sedikit|porsi kecil|small)\b/i)) {
    multiplier *= 0.65;
  }
  if (cleaned.match(/\b(banyak|porsi besar|large|double|jumbo)\b/i)) {
    multiplier *= 1.5;
  }

  // Detect cooking method
  if (cleaned.match(/\bgoreng|crispy|fried\b/i)) cookingMethod = "fried";
  else if (cleaned.match(/\brebus|kukus|boiled|steamed\b/i)) cookingMethod = "boiled";
  else if (cleaned.match(/\bbakar|panggang|grilled|roasted\b/i)) cookingMethod = "grilled";
  else if (cleaned.match(/\bcreamy|carbonara|keju\b/i)) cookingMethod = "creamy";
  else if (cleaned.match(/\bmentah|raw\b/i)) cookingMethod = "raw";

  return { quantity, explicitGrams, explicitVolumeMl, multiplier, cookingMethod, cleanedText: cleaned };
}

/**
 * Split compound food input by comma, plus, 'dan', '&', or line break
 * and smartly separate compound meals (e.g. "Nasi ayam goreng" -> ["Nasi", "Ayam goreng"])
 */
export function splitFoodItems(rawInput: string): string[] {
  if (!rawInput) return [];
  
  // Clean conversational prefixes
  const prefixRegex = /^(?:sore\s*ini|siang\s*ini|pagi\s*ini|malam\s*ini|tadi\s*pagi|tadi\s*siang|tadi\s*sore|tadi\s*malam|kemarin|barusan|tadi|lagi|sedang|habis|baru|aku|saya|gue|gw|kami|kita|pengen|mau|udah|sudah|sempat)?\s*(?:makan|minum|ngemil|sarapan|lunch|dinner|breakfast|snack|konsumsi|santap|pesan|order|habisin)?\s*(?:aku|saya|gue|gw)?\s*(?:makan|minum)?\s*/i;
  let cleaned = rawInput.trim().replace(prefixRegex, "").trim();

  // Split on delimiter tokens
  const rawParts = cleaned.split(/[,+&;\n]|\s+dan\s+|\s+plus\s+/i)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const finalItems: string[] = [];

  for (const part of rawParts) {
    const lowerPart = part.toLowerCase();
    
    // Comprehensive list of Indonesian rice dishes that are UNIFIED dishes (should NOT be split into "nasi putih + lauk")
    // This covers restaurant-style dishes, regional specialties, and named combo dishes
    const isUnifiedRiceDish = /^nasi\s+(goreng|uduk|kuning|liwet|padang|merah|putih|ayam|bebek|hainam|campur|kotak|box|gudeg|timbel|bakar|bungkus|soto|rawon|pecel|lemak|kapau|bali|palembang|grombyang|tempong|megono|jinggo|langgi|tutug|ampok|gila|mawut|gandul|bogana|tutug\s*oncom|cumi|lele|ikan|tongkol|teriyaki|geprek|rendang|semur|balado|sambal|telur|tahu|tempe|opor|bakmoy|ambeng|tutug|bowl)/i.test(lowerPart) || lowerPart.includes("rice bowl") || lowerPart.includes("donburi");

    // Also treat any "Nasi [Proper Brand/Place Name]" as a unified dish
    // e.g. "Nasi Ayam Pak Gembus", "Nasi Bebek Mas Wahid", "Nasi Hainam Abang", etc.
    // Heuristic: if the word after "nasi" is immediately followed by 2+ more words, it's a named dish
    const nasiWordCount = part.trim().split(/\s+/).length;
    const isNamedDish = /^nasi\s+/i.test(part) && nasiWordCount >= 3;

    if (/^nasi\s+/i.test(part) && !isUnifiedRiceDish && !isNamedDish) {
      // Only split simple 2-word "Nasi X" patterns when X is a lauk (single word), e.g. "Nasi Rendang"
      // Even then, keep original name intact to preserve user intent
      finalItems.push(part); // Preserve original name — never forcibly split
    } else {
      finalItems.push(part);
    }
  }

  return finalItems.length > 0 ? finalItems : [cleaned];
}

/**
 * Calculate nutrition for a single identified food item
 */
export function calculateSingleItemNutrition(rawItemText: string): FoodItemNutrition {
  const { quantity, explicitGrams, explicitVolumeMl, multiplier, cookingMethod, cleanedText } = parseQuantityAndUnit(rawItemText);
  const lower = cleanedText.toLowerCase();

  // Match against Nutrition Database
  let matchedRef: FoodReference | null = null;
  let bestScore = 0;

  for (const ref of NUTRITION_DATABASE) {
    for (const kw of ref.keywords) {
      if (lower.includes(kw)) {
        const score = kw.length;
        if (score > bestScore) {
          bestScore = score;
          matchedRef = ref;
        }
      }
    }
  }

  // Dual-component compound meal check: If matched reference is plain rice/grain and input also contains a protein keyword, combine both!
  let secondaryProteinRef: FoodReference | null = null;
  if (matchedRef && (matchedRef.normalizedName.includes("Nasi Putih") || matchedRef.normalizedName.includes("Nasi Merah"))) {
    const proteinKeywords = ["ayam", "chicken", "sapi", "beef", "daging", "telur", "egg", "katsu", "teriyaki", "ikan", "fish"];
    if (proteinKeywords.some(pk => lower.includes(pk))) {
      for (const ref of NUTRITION_DATABASE) {
        if (ref.category === "protein" || ref.normalizedName.includes("Ayam") || ref.normalizedName.includes("Sapi")) {
          for (const kw of ref.keywords) {
            if (lower.includes(kw)) {
              secondaryProteinRef = ref;
              break;
            }
          }
          if (secondaryProteinRef) break;
        }
      }
    }
  }

  if (matchedRef) {
    const isBeverage = matchedRef.category === "beverage";
    const isWater = isBeverage && (matchedRef.keywords.some(k => k.includes("air") || k.includes("water") || k.includes("mineral")));
    const itemType: "water" | "beverage" | "food" = isWater ? "water" : (isBeverage ? "beverage" : "food");

    let targetGrams = 0;
    let targetVolumeMl: number | undefined = undefined;
    let portionType: "estimated" | "user_provided" = "estimated";
    let displayUnit = "";

    if (isBeverage || isWater) {
      if (explicitVolumeMl !== undefined && explicitVolumeMl > 0) {
        targetVolumeMl = explicitVolumeMl;
        targetGrams = explicitVolumeMl;
        portionType = "user_provided";
        displayUnit = `${explicitVolumeMl} ml`;
      } else if (explicitGrams !== undefined && explicitGrams > 0) {
        targetVolumeMl = explicitGrams;
        targetGrams = explicitGrams;
        portionType = "user_provided";
        displayUnit = `${explicitGrams}g`;
      } else if (quantity > 1 || multiplier !== 1) {
        targetVolumeMl = Math.round((matchedRef.defaultVolumeMl || 250) * quantity * multiplier);
        targetGrams = targetVolumeMl;
        portionType = quantity > 1 ? "user_provided" : "estimated";
        displayUnit = `${targetVolumeMl} ml`;
      } else {
        targetVolumeMl = matchedRef.defaultVolumeMl || 250;
        targetGrams = matchedRef.defaultServingGrams || 250;
        portionType = "estimated";
        displayUnit = `${targetVolumeMl} ml`;
      }
    } else {
      // Solid Food
      if (explicitGrams !== undefined && explicitGrams > 0) {
        targetGrams = explicitGrams;
        portionType = "user_provided";
        displayUnit = `${explicitGrams}g`;
      } else if (matchedRef.perPieceGrams && quantity > 1) {
        targetGrams = matchedRef.perPieceGrams * quantity * multiplier;
        portionType = "user_provided";
        displayUnit = `${Math.round(targetGrams)}g`;
      } else {
        targetGrams = matchedRef.defaultServingGrams * (matchedRef.perPieceGrams ? 1 : quantity) * multiplier;
        portionType = quantity > 1 || explicitGrams !== undefined ? "user_provided" : "estimated";
        displayUnit = `${Math.round(targetGrams)}g`;
      }
    }

    // Determine per100g values based on cooking method variant
    let per100g = matchedRef.per100g;
    if (cookingMethod && matchedRef.cookingVariants && matchedRef.cookingVariants[cookingMethod]) {
      per100g = matchedRef.cookingVariants[cookingMethod];
    } else if (cookingMethod === "fried" && matchedRef.category === "protein" && !per100g.fat) {
      per100g = { ...per100g, fat: per100g.fat + 8, calories: per100g.calories + 72 };
    }

    let factor = targetGrams / 100.0;
    let protein = Math.round((per100g.protein * factor) * 10) / 10;
    let carbs = Math.round((per100g.carbs * factor) * 10) / 10;
    let fat = Math.round((per100g.fat * factor) * 10) / 10;
    let fiber = Math.round((per100g.fiber * factor) * 10) / 10;
    let sugar = Math.round((per100g.sugar * factor) * 10) / 10;
    
    // Add secondary protein component if detected (e.g. Rice + Ayam)
    if (secondaryProteinRef) {
      const pGrams = secondaryProteinRef.defaultServingGrams || 100;
      const pFactor = pGrams / 100.0;
      protein = Math.round((protein + secondaryProteinRef.per100g.protein * pFactor) * 10) / 10;
      carbs = Math.round((carbs + secondaryProteinRef.per100g.carbs * pFactor) * 10) / 10;
      fat = Math.round((fat + secondaryProteinRef.per100g.fat * pFactor) * 10) / 10;
      fiber = Math.round((fiber + secondaryProteinRef.per100g.fiber * pFactor) * 10) / 10;
      sugar = Math.round((sugar + secondaryProteinRef.per100g.sugar * pFactor) * 10) / 10;
      targetGrams += pGrams;
    }

    // Accurate calories derived from item macros
    const atwaterCal = Math.round((protein * 4) + (carbs * 4) + (fat * 9));
    const rawCal = Math.round(per100g.calories * factor + (secondaryProteinRef ? secondaryProteinRef.per100g.calories * (secondaryProteinRef.defaultServingGrams / 100) : 0));
    const calories = atwaterCal > 0 ? atwaterCal : rawCal;

    return {
      food_name: rawItemText.trim(),
      normalized_food_name: secondaryProteinRef ? `${matchedRef.normalizedName} + ${secondaryProteinRef.normalizedName}` : matchedRef.normalizedName,
      cooking_method: cookingMethod,
      estimated_quantity: quantity,
      estimated_weight_grams: Math.round(targetGrams),
      serving_unit: displayUnit,
      display_unit: displayUnit,
      item_type: itemType,
      portion_type: portionType,
      calories,
      protein,
      carbs,
      fat,
      fiber,
      sugar,
      is_hydration: isWater, // ONLY plain water is treated as is_hydration
      volume_ml: targetVolumeMl,
      data_source: matchedRef.source,
      confidence: portionType === "user_provided" ? "high" : "medium",
      notes: `${displayUnit} (${matchedRef.source})`
    };
  }

  // Check for non-food objects (electronics, furniture, vehicles, animals, clothes, etc.)
  const nonFoodPattern = /\b(?:laptop|notebook|macbook|komputer|computer|pc|mouse|keyboard|monitor|cpu|printer|gadget|hp|handphone|smartphone|iphone|android|samsung|xiaomi|oppo|vivo|ipad|tablet|charger|kabel|headphone|earphone|headset|powerbank|baterai|batre|tws|airpods|speaker|tv|televisi|kamera|camera|tripod|flashdisk|harddisk|ssd|ram|flashdrive|modem|router|meja|kursi|lemari|pintu|jendela|kasur|bantal|guling|selimut|karpet|lantai|tembok|dinding|atap|genteng|lampu|kipas|ac|kulkas|mesin\s*cuci|setrika|sapu|pel|ember|gayung|sikat|odol|pasta\s*gigi|sabun|shampoo|sampo|parfum|handuk|sisir|cermin|kaca|baju|kaos|kemeja|celana|rok|jaket|hoodie|sweater|jas|gamis|jilbab|hijab|topi|helm|sepatu|sandal|kaos\s*kaki|tas|ransel|dompet|koper|ikat\s*pinggang|sabuk|jam\s*tangan|gelang|kalung|cincin|anting|kacamata|mobil|motor|sepeda|skuter|truk|bus|angkot|becak|helm|kunci|gembok|buku|novel|komik|majalah|koran|pulpen|bolpoin|pensil|penghapus|penggaris|gunting|cutter|kertas|karton|kardus|plastik|besi|baja|kayu|batu|pasir|semen|tanah|kucing|anjing|kelinci|hamster|burung|ikan\s*cupang|hewan|binatang|manusia|orang|teman|pacar|anak|gedung|rumah|kantor|toko|jalan|jembatan|uang|duit|koin|kartu|atm|ktp|sim|paspor|rokok|vape|pod|liquid|korek)\b/i;

  if (nonFoodPattern.test(cleanedText)) {
    return {
      food_name: rawItemText.trim(),
      normalized_food_name: rawItemText.trim().charAt(0).toUpperCase() + rawItemText.trim().slice(1),
      cooking_method: undefined,
      estimated_quantity: quantity,
      estimated_weight_grams: 0,
      serving_unit: "-",
      display_unit: "-",
      item_type: "food",
      portion_type: "estimated",
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      is_hydration: false,
      volume_ml: 0,
      data_source: "verified_nutrition_database",
      confidence: "high",
      notes: "Objek ini bukan makanan atau minuman"
    };
  }

  // Fallback heuristic for unrecognized item (only if not a non-food item)
  const isBeverageGuess = /(?:kopi|coffee|tea|teh|jus|juice|susu|milk|drink|water|air|cola|soda|boba|latte)/i.test(cleanedText);
  const isWaterGuess = /(?:air putih|air mineral|mineral water|plain water|aqua)/i.test(cleanedText);
  const itemType: "water" | "beverage" | "food" = isWaterGuess ? "water" : (isBeverageGuess ? "beverage" : "food");

  let targetGrams = explicitGrams || explicitVolumeMl || Math.round((isBeverageGuess ? 250 : 100) * multiplier * quantity);
  let targetVolumeMl = isBeverageGuess ? targetGrams : undefined;
  let portionType: "estimated" | "user_provided" = explicitGrams || explicitVolumeMl ? "user_provided" : "estimated";
  let displayUnit = isBeverageGuess ? `${targetGrams} ml` : `${targetGrams}g`;

  const prot = Math.round((isBeverageGuess ? 0 : 4) * (targetGrams / 100) * 10) / 10;
  const carb = Math.round((isBeverageGuess ? 5 : 15) * (targetGrams / 100) * 10) / 10;
  const fat = Math.round((isBeverageGuess ? 0 : 3) * (targetGrams / 100) * 10) / 10;
  const cal = Math.round((prot * 4) + (carb * 4) + (fat * 9));

  return {
    food_name: rawItemText.trim(),
    normalized_food_name: rawItemText.trim().charAt(0).toUpperCase() + rawItemText.trim().slice(1),
    cooking_method: cookingMethod,
    estimated_quantity: quantity,
    estimated_weight_grams: targetGrams,
    serving_unit: displayUnit,
    display_unit: displayUnit,
    item_type: itemType,
    portion_type: portionType,
    calories: cal,
    protein: prot,
    carbs: carb,
    fat: fat,
    fiber: 0,
    sugar: isBeverageGuess ? 4 : 1,
    is_hydration: isWaterGuess,
    volume_ml: targetVolumeMl,
    data_source: "ai_estimation",
    confidence: "low",
    notes: "Estimasi generik"
  };
}

/**
 * Helper to detect generic meal inputs (e.g. "rice bowl", "salad", "sandwich", "noodles")
 */
export function isGenericMealInput(text: string): {
  isGeneric: boolean;
  mealType: string;
  suggestedOptions: string[];
} {
  const lower = (text || "").trim().toLowerCase();
  
  const genericPatterns: { pattern: RegExp; mealType: string }[] = [
    { pattern: /^(?:rice\s*bowl|nasi\s*bowl|bowl|poke\s*bowl)$/i, mealType: "rice bowl" },
    { pattern: /^(?:salad|salad\s*sayur|salad\s*bowl)$/i, mealType: "salad" },
    { pattern: /^(?:sandwich|roti\s*isi)$/i, mealType: "sandwich" },
    { pattern: /^(?:noodles|mie|mi|ramen|pasta|spaghetti)$/i, mealType: "noodles" },
    { pattern: /^(?:soup|sup|soto)$/i, mealType: "soup" },
    { pattern: /^(?:smoothie|smoothie\s*bowl|jus)$/i, mealType: "smoothie" },
    { pattern: /^(?:wrap|burrito|taco)$/i, mealType: "wrap" }
  ];

  for (const { pattern, mealType } of genericPatterns) {
    if (pattern.test(lower)) {
      return {
        isGeneric: true,
        mealType,
        suggestedOptions: ["Chicken", "Beef", "Egg", "Vegetables", "Sauce", "Other"]
      };
    }
  }

  return { isGeneric: false, mealType: "", suggestedOptions: [] };
}

/**
 * Execute the entire bottom-up nutrition pipeline on any food text
 * NOTE: TOTAL CALORIES ARE DERIVED STRICTLY FROM (PROTEIN * 4 + CARBS * 4 + FAT * 9)
 */
export function estimateMealNutritionDeterministic(input: string): MealNutritionResult & {
  confidence?: "high" | "medium" | "low";
  needsClarification?: boolean;
  clarificationQuestion?: string;
  suggestedOptions?: string[];
  portionDisplayLabel?: string;
} {
  const debugLogs: string[] = [];
  debugLogs.push(`[NutritionEngine] Raw input: "${input}"`);

  const genericCheck = isGenericMealInput(input);
  const rawItems = splitFoodItems(input);
  debugLogs.push(`[NutritionEngine] Parsed ${rawItems.length} items: [${rawItems.join(" | ")}]`);

  const items: FoodItemNutrition[] = [];
  let sumProtein = 0;
  let sumCarbs = 0;
  let sumFat = 0;
  let sumFiber = 0;
  let sumSugar = 0;
  let totalVolumeMl = 0;
  let isHydration = false;
  let hasUserProvidedPortion = false;

  for (const rawItem of rawItems) {
    const itemNutr = calculateSingleItemNutrition(rawItem);
    items.push(itemNutr);

    if (itemNutr.portion_type === "user_provided") {
      hasUserProvidedPortion = true;
    }

    sumProtein += Number(itemNutr.protein) || 0;
    sumCarbs += Number(itemNutr.carbs) || 0;
    sumFat += Number(itemNutr.fat) || 0;
    sumFiber += Number(itemNutr.fiber) || 0;
    sumSugar += Number(itemNutr.sugar) || 0;

    if (itemNutr.is_hydration) {
      isHydration = true;
      totalVolumeMl += itemNutr.volume_ml || 0;
    }

    debugLogs.push(
      `  -> Item: "${itemNutr.normalized_food_name}" | Portion: ${itemNutr.display_unit || itemNutr.estimated_weight_grams + 'g'} | ` +
      `Cal: ${itemNutr.calories} kcal (P:${itemNutr.protein}g, C:${itemNutr.carbs}g, F:${itemNutr.fat}g, Fib:${itemNutr.fiber}g, Sug:${itemNutr.sugar}g) [${itemNutr.data_source}]`
    );
  }

  // TOTAL MACROS
  const validatedProtein = Math.round(sumProtein * 10) / 10;
  const validatedCarbs = Math.round(sumCarbs * 10) / 10;
  const validatedFat = Math.round(sumFat * 10) / 10;
  const validatedFiber = Math.round(sumFiber * 10) / 10;
  const validatedSugar = Math.round(sumSugar * 10) / 10;

  // Internal Consistency Rule: Calories are calculated strictly from macronutrients
  // Protein × 4 + Carbs × 4 + Fat × 9 (Sodium & Minerals contribute 0 kcal)
  const validatedCalories = Math.round((validatedProtein * 4) + (validatedCarbs * 4) + (validatedFat * 9));

  debugLogs.push(
    `[NutritionEngine] ATWATER SUM TOTAL: ${validatedCalories} kcal | Protein: ${validatedProtein}g | Carbs: ${validatedCarbs}g | Fat: ${validatedFat}g | Fiber: ${validatedFiber}g | Sugar: ${validatedSugar}g`
  );

  const cleanTitle = items.length === 1 
    ? items[0].normalized_food_name 
    : items.map(i => i.normalized_food_name.split("(")[0].trim()).slice(0, 3).join(" + ") + (items.length > 3 ? ` + ${items.length - 3} lainnya` : "");

  // Terminology: "1 meal detected" when 1 complete meal is identified, "X food items detected" only when multiple individual items exist
  const dynamicPortionNote = items.length === 1 ? "1 meal detected" : `${items.length} food items detected`;

  // Explicit user portion detection (e.g. "350g rice bowl" or "350 g rice bowl")
  const explicitGramMatch = input.match(/(\d+(?:[\.,]\d+)?)\s*(?:g|gr|gram|grams)\b/i);
  const portionDisplayLabel = explicitGramMatch ? `Portion: ${parseFloat(explicitGramMatch[1].replace(',', '.'))} g` : (hasUserProvidedPortion ? "Portion: User provided" : "Portion: Estimated");

  const confidence: "high" | "medium" | "low" = genericCheck.isGeneric ? "low" : (hasUserProvidedPortion || items.some(i => i.confidence === "high") ? "high" : "medium");

  return {
    foodName: input.trim() || cleanTitle,
    calories: validatedCalories,
    protein: validatedProtein,
    carbs: validatedCarbs,
    fat: validatedFat,
    fiber: validatedFiber,
    sugar: validatedSugar,
    sodium: undefined, // Unknown sodium is kept as undefined (rendered as "Not estimated" in UI)
    isHydration,
    volumeMl: totalVolumeMl,
    mealType: "lunch",
    portionNote: dynamicPortionNote,
    items,
    calculatedFromItems: true,
    confidence,
    needsClarification: genericCheck.isGeneric,
    clarificationQuestion: genericCheck.isGeneric ? `What’s included in your ${genericCheck.mealType}?` : undefined,
    suggestedOptions: genericCheck.suggestedOptions,
    portionDisplayLabel,
    debugLog: debugLogs
  };
}

/**
 * AI Structured Prompt Generator for Gemini
 */
export function buildGeminiNutritionPrompt(cleanText: string): string {
  return `Kamu adalah Senior Clinical Nutritionist AI GymBuddy.
TUGAS WAJIB: Lakukan analisis Bottom-Up Nutrition Estimation untuk input makanan/minuman berikut:
"${cleanText}"

IKUTI 7 LANGKAH PIPELINE WAJIB (JANGAN DILEWATI):
0. PERIKSA APAKAH INI MAKANAN/MINUMAN:
   - Jika input adalah barang elektronik (laptop, komputer, hp, mouse), perabotan (meja, kursi), kendaraan, pakaian, atau hal lain yang BUKAN MAKANAN/MINUMAN:
     Keluarkan JSON:
     {
       "isFood": false,
       "foodName": "${cleanText}",
       "calories": 0,
       "protein": 0,
       "carbs": 0,
       "fat": 0,
       "fiber": 0,
       "sugar": 0,
       "isHydration": false,
       "volumeMl": 0,
       "mealType": "snack",
       "portionNote": "Bukan makanan atau minuman",
       "items": []
     }
1. PARSE & SPLIT & DEKONSTRUKSI: Pisahkan setiap item makanan/minuman individu secara spesifik.
   - Untuk makanan komposit / kombo (misal "roti isi sosis keju" atau "nasi ayam sambal lalapan"):
     Pecah menjadi komponen individual: (1) Roti/Nasi, (2) Isian/Filling (sosis/ayam), (3) Topping/Keju, (4) Sambal/Saus, (5) Sayur/Lalapan.
2. METODE MASAK: Pahami cara memasak (rebus vs goreng vs panggang vs creamy).
   - JANGAN mengasumsikan mentega/krim/minyak/dressing berlebih kecuali ada indikasi jelas.
   - Jika ada saus/dressing yang tidak diketahui jumlahnya, catat pada portionNote: "Estimasi ini belum memasukkan saus/dressing tambahan".
3. ESTIMASI PORSI REALISTIS (HINDARI KEPASTIAN PALSU):
   - Gunakan porsi standar wajar (misal: "sekitar 60g", bukan angka desimal palsu "63.7g").
   - Pasta: ~180g porsi matang / cooked (bukan mentah).
   - Kentang goreng: ~100g porsi saji sedang.
   - Roti: ~60g (2 lembar roti tawar standar).
   - Telur: ~50g per 1 butir besar.
   - Sosis: ~50g per 1 buah sosis masak.
   - Nasi putih piring standar: ~180g (1 piring / 1.5 centong).
   - Nasi bungkus (kertas/daun padang/warteg): ±250–300g.
   - Ayam goreng: ~120g (1 potong paha/dada).
   - Jika user menyebutkan kuantitas eksplisit (misal "2 telur", "150g chicken", "sosis 2 buah"), GUNAKAN KUANTITAS TERSEBUT!
4. HITUNG NUTRISI PER-ITEM berdasarkan standar USDA / TKPI:
   - Hitung gram berat, calories, protein, carbs, fat, fiber, sugar per-item.
5. AKUMULASIKAN TOTAL: Jumlahkan seluruh nutrisi dari tiap-tiap item.
   - Total Calories = Sum(Calories tiap item)
   - Total Protein = Sum(Protein tiap item)
   - Total Carbs = Sum(Carbs tiap item)
   - Total Fat = Sum(Fat tiap item)
   - Total Fiber = Sum(Fiber tiap item)
   - Total Sugar = Sum(Sugar tiap item)
6. VERIFIKASI KALORI: (Protein * 4) + (Carbs * 4) + (Fat * 9) harus konsisten dengan total kalori.

KEMBALIKAN HANYA JSON VALID (TANPA MARKDOWN):
{
  "foodName": "Nama Lengkap Makanan / Kombo",
  "calories": 755,
  "protein": 19,
  "carbs": 126,
  "fat": 19,
  "fiber": 9,
  "sugar": 5,
  "isHydration": false,
  "volumeMl": 0,
  "mealType": "lunch",
  "portionNote": "Porsi standar komplit",
  "items": [
    {
      "food_name": "Pasta",
      "normalized_food_name": "Pasta (Cooked)",
      "estimated_quantity": 1,
      "estimated_weight_grams": 180,
      "serving_unit": "porsi sedang (cooked)",
      "calories": 284,
      "protein": 10,
      "carbs": 56,
      "fat": 2,
      "fiber": 3,
      "sugar": 1,
      "data_source": "USDA",
      "confidence": "high"
    },
    {
      "food_name": "Kentang goreng",
      "normalized_food_name": "Kentang Goreng (French Fries)",
      "estimated_quantity": 1,
      "estimated_weight_grams": 100,
      "serving_unit": "porsi regular",
      "calories": 312,
      "protein": 3,
      "carbs": 41,
      "fat": 15,
      "fiber": 4,
      "sugar": 0,
      "data_source": "USDA",
      "confidence": "high"
    },
    {
      "food_name": "Roti",
      "normalized_food_name": "Roti Tawar (2 Lembar)",
      "estimated_quantity": 2,
      "estimated_weight_grams": 60,
      "serving_unit": "2 lembar",
      "calories": 159,
      "protein": 5,
      "carbs": 29,
      "fat": 2,
      "fiber": 2,
      "sugar": 3,
      "data_source": "USDA",
      "confidence": "high"
    }
  ]
}`;
}
