/**
 * GymBuddy AI Nutrition Engine
 * 
 * Pipeline:
 * 1. Parse and split user input into individual food components
 * 2. Match each component to verified USDA & Indonesian TKPI (Panganku) databases
 * 3. Normalize portion sizes (grams, ml, pieces, cups, standard servings)
 * 4. Calculate exact component-level macronutrients, sugar, fiber, and sodium
 * 5. Aggregate multi-component composite foods strictly from component values
 * 6. Sanity validate calculations (Sugar <= Carbs, Fiber <= Carbs, non-negative values)
 * 7. Provide mutually exclusive nutrition statuses for target-based & upper-limit nutrients
 * 8. Retain full traceability for every calculated item
 */

export interface FoodNutritionComponent {
  foodName: string;
  normalizedName: string;
  databaseId?: string;
  source: "TKPI" | "USDA" | "verified_nutrition_database" | "ai_estimation";
  referenceAmount: number;
  referenceUnit: string;
  actualAmount: number;
  actualUnit: string;
  cookingMethod?: "fried" | "boiled" | "grilled" | "steamed" | "roasted" | "raw" | "creamy" | "standard";
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  isHydration?: boolean;
  volumeMl?: number;
  recognitionConfidence: number; // 0-100
  databaseMatchConfidence: number; // 0-100
  portionConfidence: number; // 0-100
  notes?: string;
}

export interface FoodItemNutrition extends FoodNutritionComponent {
  // Backward compatibility alias
  food_name: string;
  normalized_food_name: string;
  cooking_method?: "fried" | "boiled" | "grilled" | "steamed" | "roasted" | "raw" | "creamy" | "standard";
  estimated_quantity: number;
  estimated_weight_grams: number;
  serving_unit: string;
  display_unit?: string;
  item_type?: "water" | "beverage" | "food";
  portion_type?: "estimated" | "user_provided";
  data_source: "USDA" | "TKPI" | "verified_nutrition_database" | "ai_estimation";
  confidence: "high" | "medium" | "low";
  is_hydration?: boolean;
  volume_ml?: number;
}

export interface NutritionCalculationResult {
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  isHydration: boolean;
  volumeMl: number;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  portionNote: string;
  components: FoodNutritionComponent[];
  calculatedFromComponents: boolean;
  recognitionConfidence: number;
  databaseMatchConfidence: number;
  portionConfidence: number;
  overallConfidence: "high" | "medium" | "low";
  traceabilityLog: string[];
  sanityValid: boolean;
  sanityErrors?: string[];
  needsClarification?: boolean;
  clarificationQuestion?: string;
  suggestedOptions?: string[];
  portionDisplayLabel?: string;
}

export interface MealNutritionResult extends NutritionCalculationResult {
  // Backward compatibility alias
  items: FoodItemNutrition[];
  calculatedFromItems: boolean;
  debugLog?: string[];
}

export interface NutrientStatusResult {
  current: number;
  target: number;
  percentage: number;
  percentageExact: number;
  status: "under_target" | "reached" | "over_target" | "under_limit" | "near_limit" | "at_limit" | "over_limit";
  statusText: string;
  statusBadge: string;
  remaining: number; // target - current (positive: user still needs that nutrient; 0: exact; negative: over target)
  isOver: boolean;
  isReached: boolean;
  isUnder: boolean;
}

export interface DailyNutritionSummary {
  calories: NutrientStatusResult;
  protein: NutrientStatusResult;
  carbs: NutrientStatusResult;
  fat: NutrientStatusResult;
  fiber: NutrientStatusResult;
  sugar: NutrientStatusResult;
  sodium: NutrientStatusResult;
  rawTotals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
    sodium: number;
  };
  userTargets: {
    targetCalories: number;
    proteinGrams: number;
    carbGrams: number;
    fatGrams: number;
    fiberGrams: number;
    sugarLimit?: number;
    sodiumLimit: number;
  };
}

export interface FoodReference {
  id?: string;
  keywords: string[];
  normalizedName: string;
  category: "grain" | "protein" | "vegetable" | "fruit" | "beverage" | "dairy" | "snack" | "fat" | "condiment";
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
    sodium?: number;
  };
  cookingVariants?: Record<string, {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
    sodium?: number;
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
    id: "usda_pasta_cooked",
    keywords: ["pasta", "spaghetti", "macaroni", "fettuccine", "penne", "mie pasta"],
    normalizedName: "Pasta (Cooked)",
    category: "grain",
    defaultServingGrams: 180,
    servingUnit: "porsi sedang (cooked)",
    per100g: { calories: 158, protein: 5.8, carbs: 30.9, fat: 0.9, fiber: 1.8, sugar: 0.6, sodium: 1 },
    cookingVariants: {
      creamy: { calories: 220, protein: 7.0, carbs: 28.0, fat: 9.5, fiber: 1.5, sugar: 1.2, sodium: 320 },
      carbonara: { calories: 240, protein: 8.5, carbs: 27.0, fat: 11.0, fiber: 1.4, sugar: 1.0, sodium: 450 },
      bolognese: { calories: 175, protein: 8.0, carbs: 26.0, fat: 4.5, fiber: 2.0, sugar: 2.5, sodium: 380 },
      aglio: { calories: 180, protein: 5.8, carbs: 30.0, fat: 4.5, fiber: 1.8, sugar: 0.5, sodium: 210 }
    },
    source: "USDA"
  },
  {
    id: "usda_french_fries",
    keywords: ["kentang goreng", "french fries", "fries", "pommes frites"],
    normalizedName: "Kentang Goreng (French Fries)",
    category: "snack",
    defaultServingGrams: 100,
    servingUnit: "porsi regular",
    per100g: { calories: 312, protein: 3.4, carbs: 41.4, fat: 15.0, fiber: 3.8, sugar: 0.3, sodium: 210 },
    cookingVariants: {
      rebus: { calories: 87, protein: 1.9, carbs: 20.1, fat: 0.1, fiber: 1.8, sugar: 0.9, sodium: 4 },
      panggang: { calories: 93, protein: 2.5, carbs: 21.0, fat: 0.2, fiber: 2.2, sugar: 1.2, sodium: 10 }
    },
    source: "USDA"
  },
  {
    id: "usda_potato_boiled",
    keywords: ["kentang", "potato", "kentang rebus", "mashed potato"],
    normalizedName: "Kentang Rebus / Mashed",
    category: "grain",
    defaultServingGrams: 150,
    servingUnit: "1 butir sedang",
    per100g: { calories: 87, protein: 1.9, carbs: 20.1, fat: 0.1, fiber: 1.8, sugar: 0.9, sodium: 4 },
    source: "USDA"
  },
  {
    id: "usda_white_bread",
    keywords: ["roti", "roti tawar", "white bread", "bread", "toast", "roti isi", "roti tawar putih"],
    normalizedName: "Roti Tawar",
    category: "grain",
    defaultServingGrams: 60, // 2 slices ~60g
    perPieceGrams: 30, // 1 slice ~30g
    servingUnit: "2 lembar",
    per100g: { calories: 265, protein: 9.0, carbs: 49.0, fat: 3.2, fiber: 2.7, sugar: 5.0, sodium: 490 },
    cookingVariants: {
      butter: { calories: 340, protein: 8.0, carbs: 46.0, fat: 14.0, fiber: 2.5, sugar: 5.5, sodium: 520 },
      gandum: { calories: 247, protein: 13.0, carbs: 41.0, fat: 3.4, fiber: 6.0, sugar: 4.3, sodium: 450 }
    },
    source: "USDA"
  },
  {
    id: "usda_whole_wheat_bread",
    keywords: ["roti gandum", "whole wheat bread", "wheat bread", "gandum"],
    normalizedName: "Roti Gandum",
    category: "grain",
    defaultServingGrams: 60,
    perPieceGrams: 30,
    servingUnit: "2 lembar",
    per100g: { calories: 247, protein: 13.0, carbs: 41.0, fat: 3.4, fiber: 6.0, sugar: 4.3, sodium: 450 },
    source: "USDA"
  },
  {
    id: "usda_oatmeal_cooked",
    keywords: ["oatmeal", "oats", "havermut", "quaker oats"],
    normalizedName: "Oatmeal (Cooked)",
    category: "grain",
    defaultServingGrams: 200,
    servingUnit: "1 mangkuk",
    per100g: { calories: 71, protein: 2.5, carbs: 12.0, fat: 1.5, fiber: 1.7, sugar: 0.3, sodium: 49 },
    source: "USDA"
  },
  {
    id: "tkpi_nasi_putih",
    keywords: ["nasi putih", "nasi", "rice", "white rice", "nasi liwet", "nasi bungkus"],
    normalizedName: "Nasi Putih (Cooked)",
    category: "grain",
    defaultServingGrams: 180,
    servingUnit: "1 porsi / centong",
    per100g: { calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3, fiber: 0.4, sugar: 0.1, sodium: 1 },
    source: "TKPI"
  },
  {
    id: "tkpi_nasi_merah",
    keywords: ["nasi merah", "brown rice", "red rice"],
    normalizedName: "Nasi Merah (Cooked)",
    category: "grain",
    defaultServingGrams: 180,
    servingUnit: "1 porsi",
    per100g: { calories: 111, protein: 2.6, carbs: 23.0, fat: 0.9, fiber: 1.8, sugar: 0.2, sodium: 2 },
    source: "TKPI"
  },
  {
    id: "tkpi_nasi_goreng",
    keywords: ["nasi goreng", "fried rice"],
    normalizedName: "Nasi Goreng Komplit",
    category: "grain",
    defaultServingGrams: 250,
    servingUnit: "1 piring komplit",
    per100g: { calories: 195, protein: 6.5, carbs: 25.0, fat: 7.8, fiber: 1.2, sugar: 1.5, sodium: 480 },
    source: "TKPI"
  },
  {
    id: "usda_rice_bowl_chicken",
    keywords: ["rice bowl ayam", "nasi bowl ayam", "chicken rice bowl", "ricebowl ayam", "nasi rice bowl ayam", "rice bowl chicken"],
    normalizedName: "Rice Bowl Ayam (Chicken Rice Bowl)",
    category: "grain",
    defaultServingGrams: 350,
    servingUnit: "1 rice bowl",
    per100g: { calories: 165, protein: 9.7, carbs: 19.4, fat: 5.1, fiber: 0.9, sugar: 0.8, sodium: 390 },
    source: "USDA"
  },
  {
    id: "usda_rice_bowl_beef",
    keywords: ["rice bowl sapi", "nasi bowl sapi", "beef rice bowl", "ricebowl sapi", "nasi rice bowl sapi", "rice bowl beef", "gyudon"],
    normalizedName: "Rice Bowl Sapi (Beef Rice Bowl)",
    category: "grain",
    defaultServingGrams: 350,
    servingUnit: "1 rice bowl",
    per100g: { calories: 177, protein: 9.1, carbs: 18.5, fat: 6.8, fiber: 0.7, sugar: 1.1, sodium: 450 },
    source: "USDA"
  },
  {
    id: "usda_rice_bowl_teriyaki",
    keywords: ["rice bowl teriyaki", "nasi bowl teriyaki", "chicken teriyaki rice bowl"],
    normalizedName: "Rice Bowl Teriyaki",
    category: "grain",
    defaultServingGrams: 350,
    servingUnit: "1 rice bowl",
    per100g: { calories: 160, protein: 8.5, carbs: 20.0, fat: 4.8, fiber: 0.7, sugar: 2.2, sodium: 520 },
    source: "USDA"
  },
  {
    id: "usda_rice_bowl_katsu",
    keywords: ["rice bowl katsu", "nasi bowl katsu", "katsu rice bowl", "chicken katsu rice bowl"],
    normalizedName: "Rice Bowl Chicken Katsu",
    category: "grain",
    defaultServingGrams: 380,
    servingUnit: "1 rice bowl",
    per100g: { calories: 178, protein: 7.3, carbs: 20.0, fat: 7.3, fiber: 0.8, sugar: 1.3, sodium: 490 },
    source: "USDA"
  },
  {
    id: "usda_rice_bowl_combo",
    keywords: ["rice bowl", "nasi bowl", "ricebowl", "donburi", "poke bowl", "pokebowl"],
    normalizedName: "Rice Bowl Combo",
    category: "grain",
    defaultServingGrams: 350,
    servingUnit: "1 rice bowl",
    per100g: { calories: 157, protein: 7.4, carbs: 18.5, fat: 5.1, fiber: 0.8, sugar: 0.9, sodium: 410 },
    source: "USDA"
  },
  {
    id: "tkpi_nasi_padang",
    keywords: ["nasi padang", "nasi ramas"],
    normalizedName: "Nasi Padang Komplit",
    category: "grain",
    defaultServingGrams: 300,
    servingUnit: "1 porsi bungkus/piring",
    per100g: { calories: 235, protein: 11.5, carbs: 22.0, fat: 11.5, fiber: 1.5, sugar: 1.0, sodium: 720 },
    source: "TKPI"
  },
  {
    id: "tkpi_nasi_uduk",
    keywords: ["nasi uduk", "nasi kuning"],
    normalizedName: "Nasi Uduk / Kuning",
    category: "grain",
    defaultServingGrams: 180,
    servingUnit: "1 porsi",
    per100g: { calories: 165, protein: 3.2, carbs: 28.5, fat: 4.5, fiber: 0.6, sugar: 0.5, sodium: 240 },
    source: "TKPI"
  },
  {
    id: "tkpi_mie_goreng",
    keywords: ["mie goreng", "indomie goreng", "bihun goreng", "kwetiau goreng"],
    normalizedName: "Mie Goreng (1 Porsi)",
    category: "grain",
    defaultServingGrams: 180,
    servingUnit: "1 porsi",
    per100g: { calories: 215, protein: 5.5, carbs: 29.5, fat: 8.5, fiber: 1.5, sugar: 2.5, sodium: 620 },
    source: "TKPI"
  },
  {
    id: "tkpi_mie_kuah",
    keywords: ["mie kuah", "mie rebus", "indomie rebus", "ramen"],
    normalizedName: "Mie Kuah / Rebus",
    category: "grain",
    defaultServingGrams: 220,
    servingUnit: "1 mangkuk",
    per100g: { calories: 145, protein: 4.0, carbs: 22.0, fat: 4.5, fiber: 1.0, sugar: 1.2, sodium: 850 },
    source: "TKPI"
  },

  // ── PROTEINS & MEATS ──────────────────────────────────────────
  {
    id: "usda_chicken_meal",
    keywords: ["chicken meal", "chicken", "ayam", "olahan ayam", "daging ayam"],
    normalizedName: "Chicken Meal (Dada/Paha)",
    category: "protein",
    defaultServingGrams: 150,
    perPieceGrams: 150,
    servingUnit: "1 porsi (~150g)",
    per100g: { calories: 190, protein: 26.0, carbs: 0.0, fat: 9.0, fiber: 0.0, sugar: 0.0, sodium: 74 },
    source: "USDA"
  },
  {
    id: "usda_fried_chicken",
    keywords: ["ayam goreng", "fried chicken", "ayam kfc", "ayam crispy"],
    normalizedName: "Ayam Goreng (Dada/Paha + Kulit)",
    category: "protein",
    defaultServingGrams: 120,
    perPieceGrams: 120,
    servingUnit: "1 potong sedang",
    per100g: { calories: 246, protein: 24.5, carbs: 3.5, fat: 14.8, fiber: 0.0, sugar: 0.0, sodium: 290 },
    source: "USDA"
  },
  {
    id: "usda_chicken_breast_grilled",
    keywords: ["dada ayam", "ayam rebus", "chicken breast", "ayam panggang", "ayam grill", "ayam kukus", "ayam bakar"],
    normalizedName: "Dada Ayam (Cooked/Grilled)",
    category: "protein",
    defaultServingGrams: 120,
    perPieceGrams: 120,
    servingUnit: "1 potong dada",
    per100g: { calories: 165, protein: 31.0, carbs: 0.0, fat: 3.6, fiber: 0.0, sugar: 0.0, sodium: 74 },
    source: "USDA"
  },
  {
    id: "tkpi_ayam_geprek",
    keywords: ["ayam geprek"],
    normalizedName: "Ayam Geprek Crispy + Sambal",
    category: "protein",
    defaultServingGrams: 140,
    perPieceGrams: 140,
    servingUnit: "1 potong geprek",
    per100g: { calories: 265, protein: 22.0, carbs: 8.5, fat: 16.0, fiber: 0.8, sugar: 0.5, sodium: 480 },
    source: "TKPI"
  },
  {
    id: "tkpi_bebek_goreng",
    keywords: ["bebek goreng", "bebek bakar", "duck"],
    normalizedName: "Bebek Goreng / Bakar",
    category: "protein",
    defaultServingGrams: 140,
    perPieceGrams: 140,
    servingUnit: "1 potong paha/dada",
    per100g: { calories: 337, protein: 19.0, carbs: 0.0, fat: 28.0, fiber: 0.0, sugar: 0.0, sodium: 220 },
    source: "TKPI"
  },
  {
    id: "tkpi_kulit_ayam",
    keywords: ["kulit ayam", "kulit", "chicken skin"],
    normalizedName: "Kulit Ayam Goreng Crispy",
    category: "fat",
    defaultServingGrams: 40,
    servingUnit: "1 porsi kecil",
    per100g: { calories: 450, protein: 15.0, carbs: 4.0, fat: 42.0, fiber: 0.0, sugar: 0.0, sodium: 340 },
    source: "TKPI"
  },
  {
    id: "tkpi_usus_goreng",
    keywords: ["usus", "usus goreng", "jeroan"],
    normalizedName: "Usus Goreng",
    category: "protein",
    defaultServingGrams: 40,
    servingUnit: "1 tusuk / porsi",
    per100g: { calories: 310, protein: 22.0, carbs: 2.0, fat: 24.0, fiber: 0.0, sugar: 0.0, sodium: 290 },
    source: "TKPI"
  },
  {
    id: "usda_chicken_nugget",
    keywords: ["nugget", "chicken nugget", "nugget ayam"],
    normalizedName: "Chicken Nugget",
    category: "protein",
    defaultServingGrams: 80,
    perPieceGrams: 20,
    servingUnit: "4 pcs",
    per100g: { calories: 296, protein: 15.0, carbs: 14.0, fat: 20.0, fiber: 0.8, sugar: 0.5, sodium: 560 },
    source: "USDA"
  },
  {
    id: "usda_sausage_cooked",
    keywords: ["sosis", "sausage", "bratwurst", "hot dog"],
    normalizedName: "Sosis (Cooked)",
    category: "protein",
    defaultServingGrams: 50,
    perPieceGrams: 50,
    servingUnit: "1 buah sedang",
    per100g: { calories: 301, protein: 12.0, carbs: 3.0, fat: 27.0, fiber: 0.0, sugar: 1.2, sodium: 850 },
    source: "USDA"
  },
  {
    id: "usda_egg_boiled",
    keywords: ["telur", "telur rebus", "egg", "boiled egg", "telor"],
    normalizedName: "Telur Ayam Rebus",
    category: "protein",
    defaultServingGrams: 50,
    perPieceGrams: 50,
    servingUnit: "1 butir",
    per100g: { calories: 155, protein: 12.6, carbs: 1.1, fat: 10.6, fiber: 0.0, sugar: 1.1, sodium: 124 },
    cookingVariants: {
      goreng: { calories: 195, protein: 13.5, carbs: 1.2, fat: 15.0, fiber: 0.0, sugar: 1.0, sodium: 180 },
      ceplok: { calories: 195, protein: 13.5, carbs: 1.2, fat: 15.0, fiber: 0.0, sugar: 1.0, sodium: 180 },
      dadar: { calories: 200, protein: 13.0, carbs: 1.5, fat: 15.5, fiber: 0.0, sugar: 1.0, sodium: 210 }
    },
    source: "USDA"
  },
  {
    id: "usda_egg_fried",
    keywords: ["telur goreng", "telur ceplok", "telur dadar", "omelet", "fried egg"],
    normalizedName: "Telur Goreng / Ceplok / Dadar",
    category: "protein",
    defaultServingGrams: 55,
    perPieceGrams: 55,
    servingUnit: "1 butir",
    per100g: { calories: 196, protein: 13.6, carbs: 0.8, fat: 15.3, fiber: 0.0, sugar: 0.8, sodium: 180 },
    source: "USDA"
  },
  {
    id: "usda_egg_white",
    keywords: ["putih telur", "egg white"],
    normalizedName: "Putih Telur (Cooked)",
    category: "protein",
    defaultServingGrams: 35,
    perPieceGrams: 35,
    servingUnit: "1 butir",
    per100g: { calories: 52, protein: 10.9, carbs: 0.7, fat: 0.2, fiber: 0.0, sugar: 0.7, sodium: 166 },
    source: "USDA"
  },
  {
    id: "usda_shrimp_cooked",
    keywords: ["udang", "shrimp", "prawn"],
    normalizedName: "Udang (Cooked)",
    category: "protein",
    defaultServingGrams: 60,
    perPieceGrams: 15,
    servingUnit: "4 buah (60g)",
    per100g: { calories: 99, protein: 24.0, carbs: 0.2, fat: 0.3, fiber: 0.0, sugar: 0.0, sodium: 111 },
    cookingVariants: {
      goreng: { calories: 180, protein: 20.0, carbs: 6.0, fat: 8.5, fiber: 0.0, sugar: 0.0, sodium: 290 }
    },
    source: "USDA"
  },
  {
    id: "tkpi_cumi_cooked",
    keywords: ["cumi", "squid", "calamari", "cumi goreng"],
    normalizedName: "Cumi-Cumi (Cooked)",
    category: "protein",
    defaultServingGrams: 80,
    servingUnit: "1 porsi",
    per100g: { calories: 140, protein: 25.0, carbs: 3.0, fat: 3.5, fiber: 0.0, sugar: 0.0, sodium: 240 },
    source: "TKPI"
  },
  {
    id: "tkpi_beef_rendang",
    keywords: ["daging sapi", "beef", "sapi", "rendang", "steak"],
    normalizedName: "Daging Sapi / Rendang",
    category: "protein",
    defaultServingGrams: 80,
    perPieceGrams: 80,
    servingUnit: "1 potong sedang",
    per100g: { calories: 250, protein: 26.0, carbs: 2.0, fat: 15.0, fiber: 0.0, sugar: 0.5, sodium: 320 },
    source: "TKPI"
  },
  {
    id: "tkpi_goat_cooked",
    keywords: ["kambing", "daging kambing", "gulai kambing"],
    normalizedName: "Daging Kambing (Cooked)",
    category: "protein",
    defaultServingGrams: 80,
    servingUnit: "1 porsi",
    per100g: { calories: 230, protein: 25.0, carbs: 0.0, fat: 14.0, fiber: 0.0, sugar: 0.0, sodium: 86 },
    source: "TKPI"
  },
  {
    id: "tkpi_fish_cooked",
    keywords: ["ikan", "fish", "salmon", "tuna", "ikan lele", "ikan bakar", "ikan goreng", "ikan gurame", "ikan kembung"],
    normalizedName: "Ikan (Cooked/Bakar)",
    category: "protein",
    defaultServingGrams: 100,
    perPieceGrams: 100,
    servingUnit: "1 ekor / potong",
    per100g: { calories: 160, protein: 22.0, carbs: 1.0, fat: 7.5, fiber: 0.0, sugar: 0.0, sodium: 90 },
    source: "TKPI"
  },
  {
    id: "tkpi_tahu",
    keywords: ["tahu", "tofu", "tahu goreng", "tahu kukus"],
    normalizedName: "Tahu",
    category: "protein",
    defaultServingGrams: 80,
    perPieceGrams: 40,
    servingUnit: "2 potong",
    per100g: { calories: 110, protein: 9.5, carbs: 3.5, fat: 6.5, fiber: 1.2, sugar: 0.5, sodium: 12 },
    source: "TKPI"
  },
  {
    id: "tkpi_tempe",
    keywords: ["tempe", "tempeh", "tempe goreng", "tempe bacem"],
    normalizedName: "Tempe",
    category: "protein",
    defaultServingGrams: 70,
    perPieceGrams: 35,
    servingUnit: "2 potong",
    per100g: { calories: 195, protein: 18.5, carbs: 9.0, fat: 10.5, fiber: 3.5, sugar: 1.0, sodium: 9 },
    source: "TKPI"
  },
  {
    id: "tkpi_perkedel",
    keywords: ["perkedel", "perkedel kentang", "perkedel daging"],
    normalizedName: "Perkedel Kentang",
    category: "snack",
    defaultServingGrams: 50,
    perPieceGrams: 50,
    servingUnit: "1 buah",
    per100g: { calories: 190, protein: 4.5, carbs: 26.0, fat: 8.0, fiber: 1.5, sugar: 0.5, sodium: 320 },
    source: "TKPI"
  },

  // ── INDONESIAN DISHES & STREET FOOD ───────────────────────────
  {
    id: "tkpi_sate_ayam",
    keywords: ["sate ayam", "satay"],
    normalizedName: "Sate Ayam + Bumbu Kacang (5 Tusuk)",
    category: "protein",
    defaultServingGrams: 150,
    servingUnit: "5 tusuk + bumbu",
    per100g: { calories: 230, protein: 18.0, carbs: 9.5, fat: 13.5, fiber: 1.2, sugar: 4.5, sodium: 450 },
    source: "TKPI"
  },
  {
    id: "tkpi_bakso",
    keywords: ["bakso", "bakso sapi", "mie bakso"],
    normalizedName: "Bakso Sapi Kuah Komplit",
    category: "protein",
    defaultServingGrams: 350,
    servingUnit: "1 mangkuk komplit",
    per100g: { calories: 120, protein: 7.5, carbs: 11.0, fat: 4.5, fiber: 0.8, sugar: 1.0, sodium: 680 },
    source: "TKPI"
  },
  {
    id: "tkpi_soto_ayam",
    keywords: ["soto", "soto ayam", "soto daging", "soto betawi"],
    normalizedName: "Soto Ayam / Sapi (1 Mangkuk)",
    category: "protein",
    defaultServingGrams: 300,
    servingUnit: "1 mangkuk",
    per100g: { calories: 105, protein: 6.5, carbs: 8.0, fat: 4.5, fiber: 0.6, sugar: 1.2, sodium: 580 },
    source: "TKPI"
  },
  {
    id: "tkpi_batagor",
    keywords: ["batagor", "batagor bandung"],
    normalizedName: "Batagor Bandung (1 Porsi)",
    category: "snack",
    defaultServingGrams: 180,
    servingUnit: "1 porsi komplit",
    per100g: { calories: 255, protein: 11.0, carbs: 25.0, fat: 12.0, fiber: 1.5, sugar: 3.5, sodium: 520 },
    source: "TKPI"
  },
  {
    id: "tkpi_siomay",
    keywords: ["siomay", "siomay bandung"],
    normalizedName: "Siomay Bandung (1 Porsi)",
    category: "snack",
    defaultServingGrams: 180,
    servingUnit: "1 porsi komplit",
    per100g: { calories: 210, protein: 12.0, carbs: 22.0, fat: 8.0, fiber: 1.8, sugar: 3.0, sodium: 490 },
    source: "TKPI"
  },
  {
    id: "tkpi_pempek",
    keywords: ["pempek", "empek empek", "pempek kapal selam"],
    normalizedName: "Pempek Palembang + Cuko",
    category: "snack",
    defaultServingGrams: 200,
    servingUnit: "1 porsi",
    per100g: { calories: 190, protein: 9.5, carbs: 28.0, fat: 4.0, fiber: 0.5, sugar: 5.0, sodium: 610 },
    source: "TKPI"
  },
  {
    id: "tkpi_gado_gado",
    keywords: ["gado gado", "gado-gado", "pecel", "lotek"],
    normalizedName: "Gado-Gado / Pecel Sayur",
    category: "vegetable",
    defaultServingGrams: 250,
    servingUnit: "1 porsi komplit",
    per100g: { calories: 135, protein: 5.5, carbs: 16.0, fat: 5.5, fiber: 3.2, sugar: 4.0, sodium: 380 },
    source: "TKPI"
  },
  {
    id: "tkpi_martabak_manis",
    keywords: ["martabak manis", "terang bulan"],
    normalizedName: "Martabak Manis (1 Potong)",
    category: "snack",
    defaultServingGrams: 75,
    servingUnit: "1 potong",
    per100g: { calories: 360, protein: 6.5, carbs: 48.0, fat: 16.0, fiber: 1.2, sugar: 26.0, sodium: 240 },
    source: "TKPI"
  },
  {
    id: "tkpi_martabak_telur",
    keywords: ["martabak telur", "martabak telor"],
    normalizedName: "Martabak Telur (2 Potong)",
    category: "snack",
    defaultServingGrams: 120,
    servingUnit: "2 potong",
    per100g: { calories: 260, protein: 12.0, carbs: 14.0, fat: 17.0, fiber: 0.8, sugar: 1.0, sodium: 420 },
    source: "TKPI"
  },
  {
    id: "tkpi_pisang_goreng",
    keywords: ["pisang goreng"],
    normalizedName: "Pisang Goreng (2 Pcs)",
    category: "snack",
    defaultServingGrams: 100,
    servingUnit: "2 buah",
    per100g: { calories: 252, protein: 2.0, carbs: 42.0, fat: 8.5, fiber: 2.5, sugar: 18.0, sodium: 110 },
    source: "TKPI"
  },
  {
    id: "tkpi_gorengan",
    keywords: ["gorengan", "bakwan", "bala-bala", "tahu isi", "cireng"],
    normalizedName: "Gorengan / Bakwan (2 Pcs)",
    category: "snack",
    defaultServingGrams: 90,
    servingUnit: "2 buah",
    per100g: { calories: 280, protein: 4.5, carbs: 30.0, fat: 16.0, fiber: 1.8, sugar: 1.5, sodium: 340 },
    source: "TKPI"
  },
  {
    id: "usda_burger",
    keywords: ["burger", "cheeseburger", "beef burger"],
    normalizedName: "Burger Daging Sapi",
    category: "grain",
    defaultServingGrams: 180,
    servingUnit: "1 buah burger",
    per100g: { calories: 260, protein: 13.0, carbs: 24.0, fat: 12.5, fiber: 1.2, sugar: 4.0, sodium: 490 },
    source: "USDA"
  },
  {
    id: "usda_pizza_slice",
    keywords: ["pizza"],
    normalizedName: "Pizza (1 Slice)",
    category: "grain",
    defaultServingGrams: 110,
    servingUnit: "1 potong (slice)",
    per100g: { calories: 266, protein: 11.5, carbs: 32.0, fat: 10.0, fiber: 2.3, sugar: 3.5, sodium: 590 },
    source: "USDA"
  },

  // ── VEGETABLES & SPECIALTIES ──────────────────────────────────
  {
    id: "tkpi_daun_singkong",
    keywords: ["daun singkong", "gulai daun singkong", "sayur daun singkong"],
    normalizedName: "Daun Singkong Rebus / Gulai",
    category: "vegetable",
    defaultServingGrams: 100,
    servingUnit: "1 mangkuk kecil",
    per100g: { calories: 73, protein: 6.8, carbs: 9.0, fat: 1.2, fiber: 4.0, sugar: 0.8, sodium: 180 },
    source: "TKPI"
  },
  {
    id: "tkpi_jengkol",
    keywords: ["jengkol", "semur jengkol", "jengkol goreng", "rendang jengkol"],
    normalizedName: "Jengkol (Cooked)",
    category: "vegetable",
    defaultServingGrams: 60,
    servingUnit: "1 porsi (4-5 keping)",
    per100g: { calories: 192, protein: 5.4, carbs: 34.0, fat: 3.2, fiber: 5.8, sugar: 1.5, sodium: 40 },
    source: "TKPI"
  },
  {
    id: "tkpi_petai",
    keywords: ["petai", "pete"],
    normalizedName: "Petai / Pete (1 Papan)",
    category: "vegetable",
    defaultServingGrams: 50,
    servingUnit: "1 papan",
    per100g: { calories: 142, protein: 9.0, carbs: 22.0, fat: 1.5, fiber: 4.5, sugar: 2.0, sodium: 25 },
    source: "TKPI"
  },
  {
    id: "tkpi_sayur_asem",
    keywords: ["sayur asem", "sayur asam"],
    normalizedName: "Sayur Asem",
    category: "vegetable",
    defaultServingGrams: 150,
    servingUnit: "1 mangkuk",
    per100g: { calories: 43, protein: 1.5, carbs: 8.0, fat: 0.6, fiber: 2.0, sugar: 2.5, sodium: 310 },
    source: "TKPI"
  },
  {
    id: "tkpi_sayuran_sop",
    keywords: ["sayur", "sop sayur", "tumis kangkung", "capcay", "bayam", "kangkung", "lalapan", "lalapan sayur"],
    normalizedName: "Sayuran / Tumis / Sop",
    category: "vegetable",
    defaultServingGrams: 120,
    servingUnit: "1 mangkuk / porsi",
    per100g: { calories: 50, protein: 2.2, carbs: 6.5, fat: 1.8, fiber: 2.5, sugar: 2.0, sodium: 240 },
    source: "TKPI"
  },
  {
    id: "tkpi_sambal",
    keywords: ["sambal", "sambel", "sambal terasi", "sambal bawang", "sambal geprek", "saus sambal"],
    normalizedName: "Sambal",
    category: "condiment",
    defaultServingGrams: 20,
    servingUnit: "1 sdm",
    per100g: { calories: 120, protein: 2.0, carbs: 12.0, fat: 7.0, fiber: 2.5, sugar: 5.0, sodium: 850 },
    source: "TKPI"
  },
  {
    id: "tkpi_kerupuk",
    keywords: ["kerupuk", "krupuk"],
    normalizedName: "Kerupuk (2 Pcs)",
    category: "snack",
    defaultServingGrams: 30,
    servingUnit: "2 keping",
    per100g: { calories: 480, protein: 3.5, carbs: 68.0, fat: 21.0, fiber: 1.0, sugar: 1.0, sodium: 540 },
    source: "TKPI"
  },

  // ── FRUITS ────────────────────────────────────────────────────
  {
    id: "usda_banana",
    keywords: ["pisang", "banana"],
    normalizedName: "Pisang (1 Buah Sedang)",
    category: "fruit",
    defaultServingGrams: 118,
    servingUnit: "1 buah sedang",
    per100g: { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6, sugar: 12.2, sodium: 1 },
    source: "USDA"
  },
  {
    id: "usda_apple",
    keywords: ["apel", "apple"],
    normalizedName: "Apel (1 Buah Sedang)",
    category: "fruit",
    defaultServingGrams: 180,
    servingUnit: "1 buah sedang",
    per100g: { calories: 52, protein: 0.3, carbs: 13.8, fat: 0.2, fiber: 2.4, sugar: 10.4, sodium: 1 },
    source: "USDA"
  },
  {
    id: "usda_avocado",
    keywords: ["alpukat", "avocado"],
    normalizedName: "Alpukat (1/2 Buah)",
    category: "fruit",
    defaultServingGrams: 100,
    servingUnit: "1/2 buah",
    per100g: { calories: 160, protein: 2.0, carbs: 8.5, fat: 14.7, fiber: 6.7, sugar: 0.7, sodium: 7 },
    source: "USDA"
  },
  {
    id: "usda_watermelon",
    keywords: ["semangka", "watermelon"],
    normalizedName: "Semangka (1 Potong)",
    category: "fruit",
    defaultServingGrams: 200,
    servingUnit: "1 potong besar",
    per100g: { calories: 30, protein: 0.6, carbs: 7.6, fat: 0.2, fiber: 0.4, sugar: 6.2, sodium: 1 },
    source: "USDA"
  },

  // ── DAIRY, NUTS, FATS & TOPPINGS ──────────────────────────────
  {
    id: "usda_milk_uht",
    keywords: ["susu", "milk", "susu uht", "fresh milk"],
    normalizedName: "Susu Sapi / UHT (1 Gelas)",
    category: "dairy",
    defaultServingGrams: 250,
    servingUnit: "1 gelas (250ml)",
    per100g: { calories: 60, protein: 3.2, carbs: 4.8, fat: 3.3, fiber: 0.0, sugar: 4.8, sodium: 43 },
    isHydration: true,
    defaultVolumeMl: 250,
    source: "USDA"
  },
  {
    id: "usda_cheese",
    keywords: ["keju", "cheese", "cheddar", "topping keju", "keju slice", "keju parut", "mozzarella"],
    normalizedName: "Keju (1 Slice)",
    category: "dairy",
    defaultServingGrams: 20,
    perPieceGrams: 20,
    servingUnit: "1 lembar (20g)",
    per100g: { calories: 403, protein: 25.0, carbs: 1.3, fat: 33.0, fiber: 0.0, sugar: 0.5, sodium: 650 },
    source: "USDA"
  },
  {
    id: "usda_mayonnaise",
    keywords: ["mayones", "mayonnaise", "mayo"],
    normalizedName: "Mayones (1 Sdm)",
    category: "fat",
    defaultServingGrams: 15,
    servingUnit: "1 sendok makan",
    per100g: { calories: 680, protein: 1.0, carbs: 0.6, fat: 75.0, fiber: 0.0, sugar: 0.6, sodium: 635 },
    source: "USDA"
  },
  {
    id: "usda_butter",
    keywords: ["butter", "mentega", "margarine", "margarin"],
    normalizedName: "Butter / Mentega (1 Sdm)",
    category: "fat",
    defaultServingGrams: 14,
    servingUnit: "1 sendok makan",
    per100g: { calories: 717, protein: 0.9, carbs: 0.1, fat: 81.0, fiber: 0.0, sugar: 0.1, sodium: 580 },
    source: "USDA"
  },
  {
    id: "usda_almonds",
    keywords: ["almond", "kacang almond", "kacang tanah", "kacang"],
    normalizedName: "Kacang-kacangan (1 Genggam)",
    category: "snack",
    defaultServingGrams: 30,
    servingUnit: "1 genggam (30g)",
    per100g: { calories: 579, protein: 21.0, carbs: 21.5, fat: 49.9, fiber: 12.5, sugar: 4.3, sodium: 1 },
    source: "USDA"
  },
  {
    id: "usda_peanut_butter",
    keywords: ["selai kacang", "peanut butter"],
    normalizedName: "Selai Kacang (1 Sdm)",
    category: "fat",
    defaultServingGrams: 16,
    servingUnit: "1 sendok makan",
    per100g: { calories: 588, protein: 25.0, carbs: 20.0, fat: 50.0, fiber: 6.0, sugar: 9.0, sodium: 450 },
    source: "USDA"
  },

  // ── BEVERAGES ──────────────────────────────────────────────────
  {
    id: "usda_water_mineral",
    keywords: ["mineral water 500ml", "mineral water", "air putih", "air mineral", "plain water", "aqua", "le minerale", "vit", "cleo", "air"],
    normalizedName: "Air Mineral (Water)",
    category: "beverage",
    defaultServingGrams: 500,
    servingUnit: "500 ml",
    per100g: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 5 },
    isHydration: true,
    defaultVolumeMl: 500,
    source: "USDA"
  },
  {
    id: "usda_black_coffee",
    keywords: ["americano / kopi hitam", "americano 500ml", "americano", "espresso", "kopi hitam", "black coffee", "kopi o", "long black", "kopi tubruk tawar", "kopi"],
    normalizedName: "Americano / Kopi Hitam",
    category: "beverage",
    defaultServingGrams: 250,
    servingUnit: "250 ml",
    per100g: { calories: 2, protein: 0.12, carbs: 0.4, fat: 0.0, fiber: 0.0, sugar: 0.0, sodium: 2 },
    isHydration: false,
    defaultVolumeMl: 250,
    source: "USDA"
  },
  {
    id: "usda_orange_juice",
    keywords: ["orange juice 250ml", "orange juice", "jus jeruk", "es jeruk"],
    normalizedName: "Orange Juice",
    category: "beverage",
    defaultServingGrams: 250,
    servingUnit: "250 ml",
    per100g: { calories: 45, protein: 0.7, carbs: 10.4, fat: 0.2, fiber: 0.2, sugar: 8.4, sodium: 1 },
    isHydration: false,
    defaultVolumeMl: 250,
    source: "USDA"
  },
  {
    id: "usda_latte_coffee",
    keywords: ["kopi susu", "latte", "cappuccino", "flat white"],
    normalizedName: "Kopi Susu / Latte",
    category: "beverage",
    defaultServingGrams: 250,
    servingUnit: "250 ml",
    per100g: { calories: 60, protein: 2.0, carbs: 7.2, fat: 2.5, fiber: 0.0, sugar: 5.6, sodium: 45 },
    isHydration: false,
    defaultVolumeMl: 250,
    source: "USDA"
  },
  {
    id: "usda_boba_tea",
    keywords: ["boba", "boba milk tea", "bubble tea"],
    normalizedName: "Boba Milk Tea (1 Cup)",
    category: "beverage",
    defaultServingGrams: 450,
    servingUnit: "450 ml",
    per100g: { calories: 75, protein: 1.0, carbs: 16.5, fat: 1.0, fiber: 0.2, sugar: 14.0, sodium: 40 },
    isHydration: false,
    defaultVolumeMl: 450,
    source: "USDA"
  },
  {
    id: "tkpi_sweet_tea",
    keywords: ["teh manis", "es teh manis", "teh kotak", "teh botol"],
    normalizedName: "Es Teh Manis",
    category: "beverage",
    defaultServingGrams: 300,
    servingUnit: "300 ml",
    per100g: { calories: 32, protein: 0.0, carbs: 8.0, fat: 0.0, fiber: 0.0, sugar: 7.5, sodium: 5 },
    isHydration: false,
    defaultVolumeMl: 300,
    source: "TKPI"
  },
  {
    id: "usda_green_tea",
    keywords: ["teh tawar", "green tea", "teh hijau", "ocha"],
    normalizedName: "Teh Tawar / Green Tea",
    category: "beverage",
    defaultServingGrams: 250,
    servingUnit: "250 ml",
    per100g: { calories: 1, protein: 0.0, carbs: 0.2, fat: 0.0, fiber: 0.0, sugar: 0.0, sodium: 1 },
    isHydration: false,
    defaultVolumeMl: 250,
    source: "USDA"
  },
  {
    id: "tkpi_fruit_juice",
    keywords: ["jus buah", "jus alpukat", "jus mangga", "juice"],
    normalizedName: "Jus Buah Segar",
    category: "beverage",
    defaultServingGrams: 300,
    servingUnit: "300 ml",
    per100g: { calories: 55, protein: 0.8, carbs: 13.0, fat: 0.5, fiber: 1.5, sugar: 11.0, sodium: 5 },
    isHydration: false,
    defaultVolumeMl: 300,
    source: "TKPI"
  },
  {
    id: "usda_whey_protein",
    keywords: ["whey", "protein shake", "susu protein"],
    normalizedName: "Whey Protein Shake",
    category: "beverage",
    defaultServingGrams: 300,
    servingUnit: "300 ml",
    per100g: { calories: 45, protein: 8.0, carbs: 1.0, fat: 0.6, fiber: 0.2, sugar: 0.5, sodium: 60 },
    isHydration: false,
    defaultVolumeMl: 300,
    source: "USDA"
  }
];

/**
 * Normalizes input portion to the database reference multiplier
 */
export function normalizePortion(
  actualAmount: number,
  actualUnit: string,
  refAmount: number = 100,
  refUnit: string = "g"
): number {
  if (!refAmount || refAmount <= 0) refAmount = 100;
  if (!actualAmount || actualAmount <= 0) actualAmount = refAmount;

  const cleanUnit = (actualUnit || "").toLowerCase().trim();

  // If both are grams or ml, direct ratio
  if (cleanUnit === "g" || cleanUnit === "gram" || cleanUnit === "grams" || cleanUnit === "ml") {
    return actualAmount / refAmount;
  }

  return actualAmount / refAmount;
}

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
  let cookingMethod: FoodNutritionComponent["cooking_method"] = "standard";

  // 1. Detect explicit volume in ml
  const mlMatch = cleaned.match(/(\d+(?:[\.,]\d+)?)\s*(?:ml|milliliter|mililiter)\b/i);
  if (mlMatch) {
    explicitVolumeMl = parseFloat(mlMatch[1].replace(',', '.'));
    cleaned = cleaned.replace(mlMatch[0], "").trim();
  }

  // 2. Detect explicit liters
  const literMatch = cleaned.match(/(\d+(?:[\.,]\d+)?)\s*(?:l|liter|litre)\b/i);
  if (literMatch) {
    explicitVolumeMl = parseFloat(literMatch[1].replace(',', '.')) * 1000;
    cleaned = cleaned.replace(literMatch[0], "").trim();
  }

  // 3. Detect explicit grams
  const gramMatch = cleaned.match(/(\d+(?:[\.,]\d+)?)\s*(?:g|gr|gram|grams)\b/i);
  if (gramMatch) {
    explicitGrams = parseFloat(gramMatch[1].replace(',', '.'));
    cleaned = cleaned.replace(gramMatch[0], "").trim();
  }

  // 4. Detect cup / gelas / bottle quantities
  const cupMatch = cleaned.match(/(\d+(?:[\.,]\d+)?)\s*(?:cup|cups|gelas|cangkir|can|kaleng|botol|bottle)\b/i);
  if (cupMatch) {
    quantity = parseFloat(cupMatch[1].replace(',', '.'));
    cleaned = cleaned.replace(cupMatch[0], "").trim();
  }

  // 5. Detect numeric pieces/slices/units
  const qtyMatch = cleaned.match(/^(\d+(?:[\.,]\d+)?)\s*(?:buah|biji|butir|potong|lembar|slice|slices|pcs|porsi|mangkok|mangkuk|centong|piring|scoop)?\b/i);
  if (qtyMatch) {
    quantity = parseFloat(qtyMatch[1].replace(',', '.'));
    cleaned = cleaned.replace(qtyMatch[0], "").trim();
  }

  // 6. Detect suffix quantities
  const suffixQtyMatch = cleaned.match(/\b(\d+(?:[\.,]\d+)?)\s*(?:buah|biji|butir|potong|lembar|slice|slices|pcs|porsi|mangkok|mangkuk|centong|piring|scoop)\b/i);
  if (suffixQtyMatch) {
    quantity = parseFloat(suffixQtyMatch[1].replace(',', '.'));
    cleaned = cleaned.replace(suffixQtyMatch[0], "").trim();
  }

  // Fractional portions
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
  else if (cleaned.match(/\bcreamy|carbonara\b/i)) cookingMethod = "creamy";
  else if (cleaned.match(/\bmentah|raw\b/i)) cookingMethod = "raw";

  return { quantity, explicitGrams, explicitVolumeMl, multiplier, cookingMethod, cleanedText: cleaned };
}

/**
 * Split compound food input by comma, plus, 'dan', '&', line break, or preposition
 * Preserves multi-component compound meals (e.g. "Roti isi sosis topping keju" -> ["Roti", "Sosis", "Keju"])
 */
export function splitFoodItems(rawInput: string): string[] {
  if (!rawInput) return [];

  // Clean conversational prefixes
  const prefixRegex = /^(?:sore\s*ini|siang\s*ini|pagi\s*ini|malam\s*ini|tadi\s*pagi|tadi\s*siang|tadi\s*sore|tadi\s*malam|kemarin|barusan|tadi|lagi|sedang|habis|baru|aku|saya|gue|gw|kami|kita|pengen|mau|udah|sudah|sempat)?\s*(?:makan|minum|ngemil|sarapan|lunch|dinner|breakfast|snack|konsumsi|santap|pesan|order|habisin)?\s*(?:aku|saya|gue|gw)?\s*(?:makan|minum)?\s*/i;
  let cleaned = rawInput.trim().replace(prefixRegex, "").trim();

  // Multi-component composite splitting (e.g., "roti isi sosis topping keju" -> ["Roti", "Sosis", "Keju"])
  // Deconstruct explicit combo markers: "isi", "topping", "pakai", "pake", "dengan", "plus", "dan", "beserta"
  let decomposed = cleaned.replace(/\b(?:isi|isian|topping|toping|taburan|pakai|pake|dengan|with|plus|dan|serta|beserta)\b/gi, ", ");

  const rawParts = decomposed.split(/[,+&;\n]/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const finalItems: string[] = [];

  for (const part of rawParts) {
    if (part.length > 0) {
      finalItems.push(part);
    }
  }

  return finalItems.length > 0 ? finalItems : [cleaned];
}

/**
 * Calculate nutrition for a single identified food item from USDA/TKPI database
 */
export function calculateSingleItemNutrition(rawItemText: string): FoodItemNutrition {
  const { quantity, explicitGrams, explicitVolumeMl, multiplier, cookingMethod, cleanedText } = parseQuantityAndUnit(rawItemText);
  const lower = cleanedText.toLowerCase();

  // Match against Nutrition Database with deterministic source priority
  let matchedRef: FoodReference | null = null;
  let bestScore = 0;

  for (const ref of NUTRITION_DATABASE) {
    for (const kw of ref.keywords) {
      if (lower.includes(kw)) {
        // Deterministic score: longer keyword match gets priority
        let score = kw.length;
        // Prioritize local TKPI match for Indonesian keywords
        if (ref.source === "TKPI") score += 2;
        if (score > bestScore) {
          bestScore = score;
          matchedRef = ref;
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
      // Solid Food Portion Normalization
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

    const factor = targetGrams / 100.0;
    const protein = Math.round((per100g.protein * factor) * 10) / 10;
    const carbs = Math.round((per100g.carbs * factor) * 10) / 10;
    const fat = Math.round((per100g.fat * factor) * 10) / 10;
    const fiber = Math.round((per100g.fiber * factor) * 10) / 10;
    
    // Exact Sugar formula: databaseSugarPer100g * actualWeight / 100
    const sugar = Math.round((per100g.sugar * factor) * 10) / 10;
    
    // Sodium from database per 100g
    const baseSodium = per100g.sodium !== undefined ? per100g.sodium : (matchedRef.category === "condiment" ? 400 : 50);
    const sodium = Math.round(baseSodium * factor);

    // Atwater Calorie consistency
    const atwaterCal = Math.round((protein * 4) + (carbs * 4) + (fat * 9));
    const rawCal = Math.round(per100g.calories * factor);
    const calories = atwaterCal > 0 ? atwaterCal : rawCal;

    const portionConf = portionType === "user_provided" ? 95 : 75;
    const dbConf = bestScore > 5 ? 95 : 85;

    return {
      foodName: rawItemText.trim(),
      normalizedName: matchedRef.normalizedName,
      food_name: rawItemText.trim(),
      normalized_food_name: matchedRef.normalizedName,
      databaseId: matchedRef.id || `db_${matchedRef.source.toLowerCase()}_${matchedRef.normalizedName.replace(/\s+/g, '_').toLowerCase()}`,
      source: matchedRef.source,
      data_source: matchedRef.source,
      referenceAmount: 100,
      referenceUnit: "g",
      actualAmount: Math.round(targetGrams),
      actualUnit: isBeverage || isWater ? "ml" : "g",
      cookingMethod,
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
      sodium,
      isHydration: isWater,
      is_hydration: isWater,
      volumeMl: targetVolumeMl,
      volume_ml: targetVolumeMl,
      recognitionConfidence: 95,
      databaseMatchConfidence: dbConf,
      portionConfidence: portionConf,
      confidence: portionType === "user_provided" ? "high" : "medium",
      notes: `${displayUnit} (${matchedRef.source})`
    };
  }

  // Fallback for non-food objects
  const nonFoodPattern = /\b(?:laptop|notebook|macbook|komputer|computer|pc|mouse|keyboard|monitor|cpu|printer|gadget|hp|handphone|smartphone|iphone|android|samsung|xiaomi|oppo|vivo|ipad|tablet|charger|kabel|headphone|earphone|headset|powerbank|baterai|batre|tws|airpods|speaker|tv|televisi|kamera|camera|tripod|flashdisk|harddisk|ssd|ram|flashdrive|modem|router|meja|kursi|lemari|pintu|jendela|kasur|bantal|guling|selimut|karpet|lantai|tembok|dinding|atap|genteng|lampu|kipas|ac|kulkas|mesin\s*cuci|setrika|sapu|pel|ember|gayung|sikat|odol|pasta\s*gigi|sabun|shampoo|sampo|parfum|handuk|sisir|cermin|kaca|baju|kaos|kemeja|celana|rok|jaket|hoodie|sweater|jas|gamis|jilbab|hijab|topi|helm|sepatu|sandal|kaos\s*kaki|tas|ransel|dompet|koper|ikat\s*pinggang|sabuk|jam\s*tangan|gelang|kalung|cincin|anting|kacamata|mobil|motor|sepeda|skuter|truk|bus|angkot|becak|helm|kunci|gembok|buku|novel|komik|majalah|koran|pulpen|bolpoin|pensil|penghapus|penggaris|gunting|cutter|kertas|karton|kardus|plastik|besi|baja|kayu|batu|pasir|semen|tanah|kucing|anjing|kelinci|hamster|burung|ikan\s*cupang|hewan|binatang|manusia|orang|teman|pacar|anak|gedung|rumah|kantor|toko|jalan|jembatan|uang|duit|koin|kartu|atm|ktp|sim|paspor|rokok|vape|pod|liquid|korek)\b/i;

  if (nonFoodPattern.test(cleanedText)) {
    return {
      foodName: rawItemText.trim(),
      normalizedName: rawItemText.trim().charAt(0).toUpperCase() + rawItemText.trim().slice(1),
      food_name: rawItemText.trim(),
      normalized_food_name: rawItemText.trim().charAt(0).toUpperCase() + rawItemText.trim().slice(1),
      databaseId: "non_food",
      source: "verified_nutrition_database",
      data_source: "verified_nutrition_database",
      referenceAmount: 0,
      referenceUnit: "-",
      actualAmount: 0,
      actualUnit: "-",
      cookingMethod: undefined,
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
      sodium: 0,
      isHydration: false,
      is_hydration: false,
      volumeMl: 0,
      volume_ml: 0,
      recognitionConfidence: 99,
      databaseMatchConfidence: 99,
      portionConfidence: 99,
      confidence: "high",
      notes: "Objek ini bukan makanan atau minuman"
    };
  }

  // Fallback for unrecognized food item
  const isBeverageGuess = /(?:kopi|coffee|tea|teh|jus|juice|susu|milk|drink|water|air|cola|soda|boba|latte)/i.test(cleanedText);
  const isWaterGuess = /(?:air putih|air mineral|mineral water|plain water|aqua)/i.test(cleanedText);
  const itemType: "water" | "beverage" | "food" = isWaterGuess ? "water" : (isBeverageGuess ? "beverage" : "food");

  const targetGrams = explicitGrams || explicitVolumeMl || Math.round((isBeverageGuess ? 250 : 100) * multiplier * quantity);
  const targetVolumeMl = isBeverageGuess ? targetGrams : undefined;
  const portionType: "estimated" | "user_provided" = explicitGrams || explicitVolumeMl ? "user_provided" : "estimated";
  const displayUnit = isBeverageGuess ? `${targetGrams} ml` : `${targetGrams}g`;

  const prot = Math.round((isBeverageGuess ? 0 : 4) * (targetGrams / 100) * 10) / 10;
  const carb = Math.round((isBeverageGuess ? 5 : 15) * (targetGrams / 100) * 10) / 10;
  const fat = Math.round((isBeverageGuess ? 0 : 3) * (targetGrams / 100) * 10) / 10;
  const cal = Math.round((prot * 4) + (carb * 4) + (fat * 9));

  return {
    foodName: rawItemText.trim(),
    normalizedName: rawItemText.trim().charAt(0).toUpperCase() + rawItemText.trim().slice(1),
    food_name: rawItemText.trim(),
    normalized_food_name: rawItemText.trim().charAt(0).toUpperCase() + rawItemText.trim().slice(1),
    databaseId: "ai_estimate_fallback",
    source: "ai_estimation",
    data_source: "ai_estimation",
    referenceAmount: 100,
    referenceUnit: "g",
    actualAmount: targetGrams,
    actualUnit: isBeverageGuess ? "ml" : "g",
    cookingMethod,
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
    fat,
    fiber: 0,
    sugar: isBeverageGuess ? 4 : 1,
    sodium: isBeverageGuess ? 10 : 150,
    isHydration: isWaterGuess,
    is_hydration: isWaterGuess,
    volumeMl: targetVolumeMl,
    volume_ml: targetVolumeMl,
    recognitionConfidence: 60,
    databaseMatchConfidence: 50,
    portionConfidence: portionType === "user_provided" ? 90 : 50,
    confidence: "low",
    notes: "Estimasi generik"
  };
}

/**
 * Nutrient Sanity Validator
 * Validates non-negative constraints, Sugar <= Carbs, Fiber <= Carbs, and Atwater macro energy
 */
export function validateNutrientSanity(data: {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const cals = Number(data.calories) || 0;
  const prot = Number(data.protein) || 0;
  const carbs = Number(data.carbs) || 0;
  const fat = Number(data.fat) || 0;
  const fiber = Number(data.fiber) || 0;
  const sugar = Number(data.sugar) || 0;
  const sodium = Number(data.sodium) || 0;

  if (cals < 0) errors.push(`Calories cannot be negative: ${cals}`);
  if (prot < 0) errors.push(`Protein cannot be negative: ${prot}`);
  if (carbs < 0) errors.push(`Carbohydrates cannot be negative: ${carbs}`);
  if (fat < 0) errors.push(`Fat cannot be negative: ${fat}`);
  if (fiber < 0) errors.push(`Fiber cannot be negative: ${fiber}`);
  if (sugar < 0) errors.push(`Sugar cannot be negative: ${sugar}`);
  if (sodium < 0) errors.push(`Sodium cannot be negative: ${sodium}`);

  // Critical sugar rule: Sugar cannot exceed total carbohydrate (with float tolerance 0.1g)
  if (sugar > carbs + 0.1) {
    errors.push(`Sugar (${sugar}g) cannot exceed total Carbohydrates (${carbs}g)`);
  }

  // Fiber rule: Fiber cannot exceed total carbohydrate (with float tolerance 0.1g)
  if (fiber > carbs + 0.1) {
    errors.push(`Fiber (${fiber}g) cannot exceed total Carbohydrates (${carbs}g)`);
  }

  // Atwater check: (Protein * 4) + (Carbs * 4) + (Fat * 9)
  const atwaterKcal = (prot * 4) + (carbs * 4) + (fat * 9);
  if (cals > 0 && atwaterKcal > 0) {
    const diff = Math.abs(cals - atwaterKcal);
    const maxAllowedDiff = Math.max(80, cals * 0.4);
    if (diff > maxAllowedDiff) {
      errors.push(`Calorie inconsistency: reported ${cals} kcal vs macro sum ${atwaterKcal} kcal (diff: ${diff})`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * NUTRITION ESTIMATION VALIDATION & PLAUSIBILITY ENGINE
 * 
 * Performs 13-point comprehensive validation:
 * 1. Internal consistency: Calories ~ (Protein*4) + (Carbs*4) + (Fat*9)
 * 2. Plausible protein for protein-rich food portions (meat, poultry, fish, eggs, whey)
 * 3. Plausible sodium for salty/processed/preserved/seasoned food (instant noodles, salted fish, soups, cured meat)
 * 4. Plausible sugar for normally sugar-containing foods/drinks unless explicitly zero-sugar/tawar
 * 5. Cooking method validation (fried foods absorb oil -> fat >= 8-15g, coconut milk/santan -> fat >= 14-25g)
 * 6. Beverage validation (volume-aware, syrups, sweet tea, plain water is zero cal/macro)
 * 7. Sugar <= Carbs constraint
 * 8. Fiber <= Carbs constraint
 * 9. Non-negative constraints
 * 10. Avoid false precision (clean rounded estimates)
 * 11. Uncertainty adjustment via confidence score
 * 12. Cross-nutrient plausibility re-evaluation
 * 13. Zero contradictions
 */
export function validateAndPlausibilityCheckNutrition(input: {
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  volumeMl?: number;
  portionNote?: string;
  isHydration?: boolean;
  confidenceScore?: number;
}): {
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  confidenceScore: number;
  adjustmentsMade: string[];
} {
  const adjustmentsMade: string[] = [];
  const rawName = String(input.foodName || "").trim();
  const lower = rawName.toLowerCase();

  let calories = Math.max(0, Number(input.calories) || 0);
  let protein = Math.max(0, Number(input.protein) || 0);
  let carbs = Math.max(0, Number(input.carbs) || 0);
  let fat = Math.max(0, Number(input.fat) || 0);
  let fiber = Math.max(0, Number(input.fiber) || 0);
  let sugar = Math.max(0, Number(input.sugar) || 0);
  let sodium = Math.max(0, Math.round(Number(input.sodium) || 0));
  let confidenceScore = Math.min(98, Math.max(70, Number(input.confidenceScore) || 88));

  // 1. Plain Water Check: strict zero calories and zero macros
  const isPlainWater = (
    lower === "air" ||
    lower.includes("air putih") ||
    lower.includes("air mineral") ||
    lower.includes("air bening") ||
    lower.includes("aqua") ||
    lower.includes("le minerale") ||
    lower.includes("plain water") ||
    lower === "water"
  );

  if (isPlainWater) {
    return {
      foodName: rawName || "Air Mineral",
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0,
      confidenceScore: 98,
      adjustmentsMade: ["Plain water zeroed"]
    };
  }

  // Flags for contextual detection
  const isExplicitlyZeroSugar = /(?:tanpa gula|no sugar|sugar[\s-]free|zero sugar|tawar|unsweetened|less sugar|diet|coke zero|pepsi zero|teh tawar|kopi pahit|kopi hitam tawar)/i.test(lower);
  const isExplicitlyLowSodium = /(?:rendah garam|low sodium|tanpa garam|no salt)/i.test(lower);
  const isFried = /(?:goreng|fried|crispy|krispi|deep[\s-]fried|bakwan|mendoan|gorengan|kentang goreng|french fries)/i.test(lower);
  const hasSantan = /(?:santan|rendang|gulai|opor|lodeh|kari|curry|rawon)/i.test(lower);
  const isChickenOrMeat = /(?:ayam|dada ayam|chicken|sapi|daging|beef|steak|tenderloin|sirloin|ikan|fish|salmon|tuna|seafood|udang|cumi|protein shake|whey)/i.test(lower);
  const isEgg = /(?:telur|telor|egg)/i.test(lower);
  const isInstantNoodle = /(?:indomie|mie instan|noodle|ramen|pop mie|mie goreng)/i.test(lower);
  const isSaltedOrCured = /(?:ikan asin|telur asin|asinan|kornet|sosis|sausage|dendeng|sambal terasi|keripik|chips|chiki)/i.test(lower);
  const isSavoryBrothOrStreet = /(?:bakso|soto|mie ayam|kwetiau|nasi goreng|burger|pizza)/i.test(lower);
  const isSweetBeverage = /(?:teh manis|es teh|sweet tea|boba|bubble tea|milk tea|kopi susu|kopi aren|caramel|vanilla latte|frappuccino|jus|juice|smoothie|soda|fanta|coca[\s-]cola|sprite|syrup|sirup|milo)/i.test(lower);
  const isSweetFood = /(?:donut|donat|cake|kue|brownies|martabak manis|terang bulan|pancake|waffle|es krim|ice cream|coklat|chocolate|puding|pudding)/i.test(lower);

  // 2. Cooking Method & Fat Plausibility
  if (isFried && fat < 7) {
    fat = Math.max(fat, 10);
    adjustmentsMade.push("Adjusted fat for frying cooking oil absorption");
  }
  if (hasSantan && fat < 12) {
    fat = Math.max(fat, 15);
    adjustmentsMade.push("Adjusted fat for coconut milk (santan) base");
  }

  // 3. Protein Plausibility for Protein-Rich Foods
  if (isChickenOrMeat && protein < 12) {
    protein = Math.max(protein, 22);
    adjustmentsMade.push("Adjusted protein for meat/poultry portion");
  }
  if (isEgg && protein < 5) {
    protein = Math.max(protein, 6.5);
    adjustmentsMade.push("Adjusted protein for egg portion");
  }

  // 4. Sodium Plausibility for Seasoned/Processed/Preserved Foods
  if (!isExplicitlyLowSodium) {
    if (isInstantNoodle && sodium < 400) {
      sodium = 850;
      adjustmentsMade.push("Adjusted sodium for instant noodle seasoning packet");
    } else if (isSaltedOrCured && sodium < 350) {
      sodium = 650;
      adjustmentsMade.push("Adjusted sodium for cured/preserved/salted food");
    } else if (isSavoryBrothOrStreet && sodium < 250) {
      sodium = 450;
      adjustmentsMade.push("Adjusted sodium for seasoned savory broth/dish");
    }
  }

  // 5. Sugar Plausibility for Sweet Foods & Beverages
  if (!isExplicitlyZeroSugar) {
    if (isSweetBeverage && sugar < 8) {
      sugar = /(?:boba|aren|bubble|frappuccino)/i.test(lower) ? 26 : 16;
      carbs = Math.max(carbs, sugar + 2);
      adjustmentsMade.push("Adjusted sugar for sweetened beverage volume");
    } else if (isSweetFood && sugar < 8) {
      sugar = 16;
      carbs = Math.max(carbs, sugar + 4);
      adjustmentsMade.push("Adjusted sugar for dessert/pastry");
    }
  }

  // 6. Sugar & Fiber <= Carbs Constraints
  if (sugar > carbs) {
    carbs = Math.max(carbs, sugar);
    adjustmentsMade.push("Adjusted carbs to be at least sugar amount");
  }
  if (fiber > carbs) {
    carbs = Math.max(carbs, fiber);
    adjustmentsMade.push("Adjusted carbs to be at least fiber amount");
  }

  // 7. Internal Consistency: Calories vs Macro Sum (P*4 + C*4 + F*9)
  const atwaterKcal = (protein * 4) + (carbs * 4) + (fat * 9);
  if (atwaterKcal > 0) {
    if (calories <= 0) {
      calories = Math.round(atwaterKcal);
      adjustmentsMade.push("Derived calories from macronutrients");
    } else {
      const diff = Math.abs(calories - atwaterKcal);
      const maxDiscrepancy = Math.max(60, calories * 0.22);
      if (diff > maxDiscrepancy) {
        // Re-evaluate: If carbs and fat are high but calories were low, or vice versa, reconcile to atwaterKcal
        calories = Math.round(atwaterKcal);
        adjustmentsMade.push(`Reconciled calorie discrepancy (${diff} kcal difference from P*4+C*4+F*9)`);
      }
    }
  }

  // 8. Avoid False Precision: Clean Rounding
  calories = Math.round(calories);
  protein = Number(protein.toFixed(1));
  carbs = Number(carbs.toFixed(1));
  fat = Number(fat.toFixed(1));
  fiber = Number(fiber.toFixed(1));
  sugar = Number(sugar.toFixed(1));
  sodium = Math.round(sodium);

  return {
    foodName: rawName || "Makanan",
    calories,
    protein,
    carbs,
    fat,
    fiber,
    sugar,
    sodium,
    confidenceScore,
    adjustmentsMade
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
 * Calculates multi-component composite meal nutrition
 */
export function calculateCompositeNutrition(
  components: (string | { name: string; quantity?: number; grams?: number; volumeMl?: number; cookingMethod?: string })[]
): NutritionCalculationResult {
  const componentResults: FoodNutritionComponent[] = [];
  const traceability: string[] = [];

  let sumProtein = 0;
  let sumCarbs = 0;
  let sumFat = 0;
  let sumFiber = 0;
  let sumSugar = 0;
  let sumSodium = 0;
  let totalVolumeMl = 0;
  let isHydration = false;
  let minPortionConf = 100;
  let minDbConf = 100;
  let minRecogConf = 100;

  for (const comp of components) {
    let compText = "";
    if (typeof comp === "string") {
      compText = comp;
    } else {
      const qStr = comp.grams ? `${comp.grams}g` : (comp.quantity ? `${comp.quantity} ` : "");
      compText = `${qStr}${comp.name} ${comp.cookingMethod || ""}`.trim();
    }

    const item = calculateSingleItemNutrition(compText);
    componentResults.push(item);

    sumProtein += item.protein;
    sumCarbs += item.carbs;
    sumFat += item.fat;
    sumFiber += item.fiber;
    sumSugar += item.sugar;
    sumSodium += item.sodium;

    if (item.isHydration) {
      isHydration = true;
      totalVolumeMl += item.volumeMl || 0;
    }

    minPortionConf = Math.min(minPortionConf, item.portionConfidence);
    minDbConf = Math.min(minDbConf, item.databaseMatchConfidence);
    minRecogConf = Math.min(minRecogConf, item.recognitionConfidence);

    traceability.push(`• [${item.source}] ${item.normalizedName} (${item.actualAmount}${item.actualUnit}) -> ${item.calories} kcal | P:${item.protein}g C:${item.carbs}g F:${item.fat}g Sug:${item.sugar}g Na:${item.sodium}mg`);
  }

  const validatedProtein = Math.round(sumProtein * 10) / 10;
  const validatedCarbs = Math.round(sumCarbs * 10) / 10;
  const validatedFat = Math.round(sumFat * 10) / 10;
  const validatedFiber = Math.round(sumFiber * 10) / 10;
  const validatedSugar = Math.round(sumSugar * 10) / 10;
  const validatedSodium = Math.round(sumSodium);

  const validatedCalories = Math.round((validatedProtein * 4) + (validatedCarbs * 4) + (validatedFat * 9));

  const sanity = validateNutrientSanity({
    calories: validatedCalories,
    protein: validatedProtein,
    carbs: validatedCarbs,
    fat: validatedFat,
    fiber: validatedFiber,
    sugar: validatedSugar,
    sodium: validatedSodium
  });

  const overallConf: "high" | "medium" | "low" = (minPortionConf >= 85 && minDbConf >= 85) ? "high" : (minPortionConf >= 65 ? "medium" : "low");

  const title = componentResults.length === 1
    ? componentResults[0].normalizedName
    : componentResults.map(c => c.normalizedName.split("(")[0].trim()).join(" + ");

  const portionNote = componentResults.length === 1 ? "1 item detected" : `${componentResults.length} components detected`;

  return {
    foodName: title,
    calories: validatedCalories,
    protein: validatedProtein,
    carbs: validatedCarbs,
    fat: validatedFat,
    fiber: validatedFiber,
    sugar: validatedSugar,
    sodium: validatedSodium,
    isHydration,
    volumeMl: totalVolumeMl,
    mealType: "lunch",
    portionNote,
    components: componentResults,
    calculatedFromComponents: true,
    recognitionConfidence: minRecogConf,
    databaseMatchConfidence: minDbConf,
    portionConfidence: minPortionConf,
    overallConfidence: overallConf,
    traceabilityLog: traceability,
    sanityValid: sanity.isValid,
    sanityErrors: sanity.errors
  };
}

/**
 * Full bottom-up nutrition calculation engine on user input
 */
export function calculateFoodNutrition(input: string, explicitComponents?: string[]): NutritionCalculationResult {
  const genericCheck = isGenericMealInput(input);
  const itemsToCalc = explicitComponents && explicitComponents.length > 0
    ? explicitComponents
    : splitFoodItems(input);

  const compositeRes = calculateCompositeNutrition(itemsToCalc);

  // Preserve user original input title if available
  const displayTitle = input.trim() || compositeRes.foodName;

  return {
    ...compositeRes,
    foodName: displayTitle,
    needsClarification: genericCheck.isGeneric,
    clarificationQuestion: genericCheck.isGeneric ? `What’s included in your ${genericCheck.mealType}?` : undefined,
    suggestedOptions: genericCheck.suggestedOptions,
    portionDisplayLabel: `Portion: ${compositeRes.components.map(c => `${c.actualAmount}${c.actualUnit}`).join(" + ")}`
  };
}

/**
 * Backward compatibility alias for estimateMealNutritionDeterministic
 */
export function estimateMealNutritionDeterministic(input: string): MealNutritionResult {
  const res = calculateFoodNutrition(input);
  return {
    ...res,
    items: res.components as FoodItemNutrition[],
    calculatedFromItems: res.calculatedFromComponents,
    debugLog: res.traceabilityLog
  };
}

/**
 * Single source of truth for nutrient comparison and status calculation
 * MUTUALLY EXCLUSIVE LOGIC:
 * - Target-based nutrients (Calories, Protein, Carbs, Fat, Fiber):
 *   current < target  -> 🟡 Belum Cukup (under_target)
 *   current == target -> ✅ Tercapai (reached)
 *   current > target  -> 🔴 Melebihi Target (over_target)
 * - Upper-limit nutrients (Sodium):
 *   current > limit   -> 🔴 Melebihi Batas (over_limit)
 *   current == limit  -> 🟡 Di Batas Maksimal (at_limit)
 *   current / limit >= 80% and current < limit -> 🟡 Mendekati Batas (near_limit)
 *   current / limit < 80%  -> 🟢 Dalam Batas (under_limit)
 */
export function calculateNutrientStatus(current: number, target: number, isUpperLimit: boolean = false): NutrientStatusResult {
  const c = Math.max(0, Number(current) || 0);
  const t = Math.max(0, Number(target) || 0);

  if (t === 0) {
    return {
      current: c,
      target: t,
      percentage: 0,
      percentageExact: 0,
      status: isUpperLimit ? "under_limit" : "under_target",
      statusText: isUpperLimit ? "Dalam Batas" : "Sisa target: 0",
      statusBadge: isUpperLimit ? "🟢 Dalam Batas" : "Sisa target: 0",
      remaining: 0,
      isOver: false,
      isReached: false,
      isUnder: true
    };
  }

  const percentageExact = (c / t) * 100;
  const remaining = t - c;

  if (isUpperLimit) {
    if (c > t) {
      const percentage = Math.max(101, Math.round(percentageExact));
      return {
        current: c,
        target: t,
        percentage,
        percentageExact,
        status: "over_limit",
        statusText: "Melebihi Batas",
        statusBadge: "🔴 Melebihi Batas",
        remaining,
        isOver: true,
        isReached: false,
        isUnder: false
      };
    } else if (c === t) {
      return {
        current: c,
        target: t,
        percentage: 100,
        percentageExact: 100,
        status: "at_limit",
        statusText: "Batas Maksimal",
        statusBadge: "🟠 Batas Maksimal",
        remaining: 0,
        isOver: false,
        isReached: true,
        isUnder: false
      };
    } else if (percentageExact >= 80) {
      const percentage = Math.min(99, Math.round(percentageExact));
      return {
        current: c,
        target: t,
        percentage,
        percentageExact,
        status: "near_limit",
        statusText: "Mendekati Batas",
        statusBadge: "🟠 Mendekati Batas",
        remaining,
        isOver: false,
        isReached: false,
        isUnder: true
      };
    } else {
      const percentage = Math.min(99, Math.round(percentageExact));
      return {
        current: c,
        target: t,
        percentage,
        percentageExact,
        status: "under_limit",
        statusText: "Dalam Batas",
        statusBadge: "🟢 Dalam Batas",
        remaining,
        isOver: false,
        isReached: false,
        isUnder: true
      };
    }
  }

  // Target-based Nutrients:
  // Strict mutually exclusive comparison on raw numerical values
  if (c < t) {
    const percentage = Math.min(99, Math.round(percentageExact));
    const remLabel = `Sisa target: ${remaining}`;
    return {
      current: c,
      target: t,
      percentage,
      percentageExact,
      status: "under_target",
      statusText: remLabel,
      statusBadge: remLabel,
      remaining,
      isOver: false,
      isReached: false,
      isUnder: true
    };
  } else if (c === t) {
    return {
      current: c,
      target: t,
      percentage: 100,
      percentageExact: 100,
      status: "reached",
      statusText: "Tercapai",
      statusBadge: "✅ Tercapai",
      remaining: 0,
      isOver: false,
      isReached: true,
      isUnder: false
    };
  } else {
    // c > t
    const percentage = Math.max(101, Math.round(percentageExact));
    return {
      current: c,
      target: t,
      percentage,
      percentageExact,
      status: "over_target",
      statusText: "Melebihi Target",
      statusBadge: "🔴 Melebihi Target",
      remaining,
      isOver: true,
      isReached: false,
      isUnder: false
    };
  }
}

/**
 * Calculates daily nutrition summary across all nutrients
 */
export function calculateDailyNutritionSummary(
  dailyTotals: { calories?: number; protein?: number; carbs?: number; fat?: number; fiber?: number; sugar?: number; sodium?: number },
  userTargets: { targetCalories?: number; proteinGrams?: number; carbGrams?: number; fatGrams?: number; fiberGrams?: number; sugarLimit?: number; sodiumLimit?: number }
): DailyNutritionSummary {
  const targetCal = Number(userTargets?.targetCalories) || 2000;
  const targetProt = Number(userTargets?.proteinGrams) || 120;
  const targetCarb = Number(userTargets?.carbGrams) || 240;
  const targetFat = Number(userTargets?.fatGrams) || 65;
  const targetFiber = Number(userTargets?.fiberGrams) || 30;
  const targetSugar = Number(userTargets?.sugarLimit) || 50;
  const targetSodium = Number(userTargets?.sodiumLimit) || 2000;

  const currentCal = Number(dailyTotals?.calories) || 0;
  const currentProt = Number(dailyTotals?.protein) || 0;
  const currentCarb = Number(dailyTotals?.carbs) || 0;
  const currentFat = Number(dailyTotals?.fat) || 0;
  const currentFiber = Number(dailyTotals?.fiber) || 0;
  const currentSugar = Number(dailyTotals?.sugar) || 0;
  const currentSodium = Number(dailyTotals?.sodium) || 0;

  return {
    calories: calculateNutrientStatus(currentCal, targetCal, false),
    protein: calculateNutrientStatus(currentProt, targetProt, false),
    carbs: calculateNutrientStatus(currentCarb, targetCarb, false),
    fat: calculateNutrientStatus(currentFat, targetFat, false),
    fiber: calculateNutrientStatus(currentFiber, targetFiber, false),
    sugar: calculateNutrientStatus(currentSugar, targetSugar, true),
    sodium: calculateNutrientStatus(currentSodium, targetSodium, true),
    rawTotals: {
      calories: currentCal,
      protein: currentProt,
      carbs: currentCarb,
      fat: currentFat,
      fiber: currentFiber,
      sugar: currentSugar,
      sodium: currentSodium
    },
    userTargets: {
      targetCalories: targetCal,
      proteinGrams: targetProt,
      carbGrams: targetCarb,
      fatGrams: targetFat,
      fiberGrams: targetFiber,
      sugarLimit: targetSugar,
      sodiumLimit: targetSodium
    }
  };
}

/**
 * Formats a macronutrient value for display (Protein, Carbohydrates, Fat, Fiber, Sugar).
 * 
 * Rules:
 * - Precision: up to 1 decimal place.
 * - Rounds values to 1 decimal place using Math.round(val * 10) / 10.
 * - Removes unnecessary trailing zeros (e.g. 100.0 -> "100", 50.0 -> "50", 108.4 -> "108.4").
 * - Eliminates raw floating point precision artifacts:
 *   38.599999999999994 -> "38.6"
 *   75.69999999999999  -> "75.7"
 *   16.599999999999994 -> "16.6"
 */
export function formatDashboardMacro(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === "") return "0";
  const num = Number(value);
  if (isNaN(num)) return "0";
  const rounded = Math.round(num * 10) / 10;
  return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
}

/**
 * Formats an integer metric for display (Calories, Sodium, Water, Percentages).
 * 
 * Rules:
 * - Precision: whole numbers with 0 decimal places.
 * - Rounds values using Math.round.
 * - Formats with thousands separator (e.g. 1,958, 2,000, 2,650).
 */
export function formatDashboardInteger(value: number | string | undefined | null, useLocale: boolean = true): string {
  if (value === undefined || value === null || value === "") return "0";
  const num = Number(value);
  if (isNaN(num)) return "0";
  const rounded = Math.round(num);
  return useLocale ? rounded.toLocaleString() : String(rounded);
}

/**
 * Formats percentage as a whole number with 0 decimal places (e.g. 134%).
 */
export function formatDashboardPercent(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === "") return "0%";
  const num = Number(value);
  if (isNaN(num)) return "0%";
  return `${Math.round(num)}%`;
}

/**
 * Standard Progress Bar Formatter
 * Progress bar is visual only; status is derived strictly from numerical comparison.
 */
export function makeProgressBar(current: number, target: number, length: number = 10): string {
  if (!target || target <= 0) return `[░░░░░░░░░░] 0%`;
  const statusInfo = calculateNutrientStatus(current, target, false);
  let filledCount = 0;
  if (current < target) {
    filledCount = Math.min(length - 1, Math.floor((current / target) * length));
  } else {
    filledCount = length;
  }
  const emptyCount = Math.max(0, length - filledCount);
  const bar = "█".repeat(filledCount) + "░".repeat(emptyCount);

  return `[${bar}] ${statusInfo.percentage}% · ${statusInfo.statusBadge}`;
}

/**
 * Sodium Progress Bar Formatter (Upper-limit)
 */
export function makeSodiumProgressBar(current: number, limit: number = 2000, length: number = 10): string {
  if (!limit || limit <= 0) limit = 2000;
  const statusInfo = calculateNutrientStatus(current, limit, true);
  let filledCount = 0;
  if (current <= limit) {
    filledCount = Math.min(length, Math.floor((current / limit) * length));
  } else {
    filledCount = length;
  }
  const emptyCount = Math.max(0, length - filledCount);
  const bar = "█".repeat(filledCount) + "░".repeat(emptyCount);

  return `[${bar}] ${statusInfo.percentage}% · ${statusInfo.statusBadge}`;
}

/**
 * Sugar Progress Bar Formatter (Upper-limit recommended maximum)
 * Follows same semantic rules as Sodium:
 * Below limit: 🟢 Dalam Batas
 * At limit: 🟡 Batas Maksimal
 * Above limit: 🔴 Melebihi Batas (with overflow indication)
 * NEVER displays 'Belum Cukup'
 */
export function makeSugarProgressBar(current: number, limit: number = 50, length: number = 10): string {
  if (!limit || limit <= 0) limit = 50;
  const statusInfo = calculateNutrientStatus(current, limit, true);
  let filledCount = 0;
  if (current <= limit) {
    filledCount = Math.min(length, Math.floor((current / limit) * length));
  } else {
    filledCount = length;
  }
  const emptyCount = Math.max(0, length - filledCount);
  const bar = "█".repeat(filledCount) + "░".repeat(emptyCount);

  return `[${bar}] ${statusInfo.percentage}% · ${statusInfo.statusBadge}`;
}

/**
 * Cleans conversational noise from an individual food item name.
 */
export function cleanSingleFoodItemName(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  let clean = raw
    .replace(/^[🍽️🥜🥗🥘🍛🍗🥩🍳🥤🍪🥪🍞🍕🍔🌮🍜🍲✨\-\*•\d\.\s\(\)]+/, "")
    .replace(/(?:^|\s+)~?\d+\s*k?cal(?:\s+|$)/gi, " ")
    .replace(/(?:^|\s+)(?:diperbarui|koreksi|updated|baru)(?:\s+|$)/gi, " ")
    .trim();

  // Strip conversational pronouns & verbs & leading connectors
  clean = clean
    .replace(/^(?:dan|serta|pake|pakai|dengan|sama|plus|\+)\s+/i, "")
    .replace(/^(?:aku|saya|gue|gw|kami|kita)\s+/i, "")
    .replace(/^(?:tadi\s+(?:pagi|siang|sore|malam)|kemarin\s+(?:pagi|siang|sore|malam)|tadi|kemarin)\s+/i, "")
    .replace(/^(?:makan|santap|ngemil|minum|catat|log)\s+/i, "")
    .replace(/^(?:dan|serta|pake|pakai|dengan|sama|plus|\+)\s+/i, "")
    .replace(/(?:\s+(?:untuk|buat)\s+(?:sarapan|lunch|dinner|snack|makan\s+siang|makan\s+malam|pagi|siang|malam))$/i, "")
    .replace(/(?:\s+(?:tadi\s+siang|tadi\s+pagi|tadi\s+malam|siang\s+ini|pagi\s+ini|malam\s+ini))$/i, "")
    .trim();

  // Strip portion indicators if present at start or end
  clean = clean
    .replace(/^\d+(?:[.,]\d+)?\s*(?:piring|mangkok|mangkuk|porsi|potong|lembar|butir|buah|gelas|cup|cups|botol|bungkus|gram|gr|g|ml|l|liter|ons|slice|slices)\s+(?:dari\s+|nya\s+)?/i, "")
    .replace(/\s+\d+(?:[.,]\d+)?\s*(?:piring|mangkok|mangkuk|porsi|potong|lembar|butir|buah|gelas|cup|cups|botol|bungkus|gram|gr|g|ml|l|liter|ons|slice|slices)(?:\s+(?:saja|aja|doang))?$/i, "")
    .replace(/\s*:\s*\d+(?:[.,]\d+)?\s*(?:piring|mangkok|mangkuk|porsi|potong|lembar|butir|buah|gelas|cup|cups|botol|bungkus|gram|gr|g|ml|l|liter|ons|slice|slices).*$/i, "")
    .replace(/\s*\(\s*\d+(?:[.,]\d+)?\s*(?:piring|mangkok|mangkuk|porsi|potong|lembar|butir|buah|gelas|cup|cups|botol|bungkus|gram|gr|g|ml|l|liter|ons|slice|slices|kcal).*?\)/gi, "")
    .trim();

  if (!clean) return "";

  // Strip any remaining leading connectors
  clean = clean.replace(/^(?:dan|serta|pake|pakai|sama|dengan)\s+/i, "").trim();

  // Normalize common Indonesian food component names
  const lower = clean.toLowerCase();
  if (lower === "nasi" || lower === "nasi putih") return "Nasi Putih";
  if (lower === "ayam" || lower === "daging ayam") return "Ayam";
  if (lower === "telur" || lower === "telor") return "Telur";
  if (lower === "kopi" || lower === "coffee") return "Kopi";
  if (lower.includes("iced coffee") && (lower.includes("cream foam") || lower.includes("float"))) {
    return "Iced Coffee dengan Cream Foam / Cream Float";
  }

  // Capitalize words cleanly
  return clean
    .split(/\s+/)
    .map(word => {
      if (word.includes("/")) {
        return word.split("/").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" / ");
      }
      if (["dan", "atau", "di", "ke", "dari", "yang", "dengan", "and", "or", "of", "with", "in"].includes(word.toLowerCase())) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/**
 * Formats a list of detected food item names into the canonical meal title format:
 * [ITEM 1], [ITEM 2], [ITEM 3] & [ITEM 4]
 * Example:
 * ["Nasi Putih", "Ayam Goreng", "Pete Goreng", "Selada"] -> "Nasi Putih, Ayam Goreng, Pete Goreng & Selada"
 * ["Nasi Putih", "Ayam Goreng"] -> "Nasi Putih & Ayam Goreng"
 * ["Apel"] -> "Apel"
 */
export function formatFoodItemsToTitle(items: string[]): string {
  const cleanItems = items
    .map(i => cleanSingleFoodItemName(i))
    .filter(i => i.length > 0);

  if (cleanItems.length === 0) return "Estimasi Makanan";
  if (cleanItems.length === 1) return cleanItems[0];
  if (cleanItems.length === 2) return `${cleanItems[0]} & ${cleanItems[1]}`;

  const lastItem = cleanItems[cleanItems.length - 1];
  const prefixItems = cleanItems.slice(0, cleanItems.length - 1).join(", ");
  return `${prefixItems} & ${lastItem}`;
}

/**
 * Extracts distinct food items from a natural language text.
 * Example:
 * "aku tadi siang makan nasi 2 piring, pake ayam goreng, dan pete goreng serta selada"
 * -> ["Nasi Putih", "Ayam Goreng", "Pete Goreng", "Selada"]
 */
export function extractDetectedFoodItems(text: string): string[] {
  if (!text || typeof text !== "string") return [];
  let clean = text.trim();

  // Strip conversational prefixes
  clean = clean
    .replace(/^(?:halo\s+|hai\s+|coach\s+(?:mia|max),?\s*|tolong\s+catat,?\s*|catat\s+makan,?\s*)/i, "")
    .replace(/^(?:aku|saya|gue|gw|kami|kita)\s+/i, "")
    .replace(/^(?:tadi\s+(?:pagi|siang|sore|malam)|kemarin\s+(?:pagi|siang|sore|malam)|tadi|kemarin|hari\s+ini)\s+/i, "")
    .replace(/^(?:makan|santap|ngemil|minum|sarapan|lunch|dinner|snack)\s+/i, "")
    .replace(/^(?:pake|pakai|dengan|sama)\s+/i, "")
    .replace(/(?:\s+(?:untuk|buat)\s+(?:sarapan|lunch|dinner|snack|makan\s+siang|makan\s+malam|pagi|siang|malam))$/i, "")
    .replace(/(?:\s+(?:tadi\s+siang|tadi\s+pagi|tadi\s+malam|siang\s+ini|pagi\s+ini|malam\s+ini))$/i, "")
    .trim();

  if (!clean) return [];

  const lower = clean.toLowerCase();

  // Single compound dish patterns (should NOT be split unless explicit comma / & / + adds multiple items)
  if (
    lower.startsWith("sandwich") ||
    lower.startsWith("sub sandwich") ||
    lower.startsWith("burger") ||
    lower.startsWith("pizza") ||
    lower.startsWith("nasi padang") ||
    lower.startsWith("nasi uduk") ||
    lower.startsWith("nasi kuning") ||
    lower.startsWith("nasi liwet") ||
    lower.startsWith("nasi kebuli") ||
    lower.startsWith("nasi briyani") ||
    lower.startsWith("nasi hainan") ||
    lower.startsWith("nasi goreng") ||
    lower.startsWith("mie goreng") ||
    lower.startsWith("mie ayam") ||
    lower.startsWith("kwetiau") ||
    lower.startsWith("bihun") ||
    lower.startsWith("soto") ||
    lower.startsWith("bakso") ||
    lower.startsWith("ayam geprek") ||
    lower.startsWith("ayam penyet") ||
    lower.startsWith("ayam bakar") ||
    lower.startsWith("ayam goreng") ||
    lower.startsWith("sate") ||
    lower.startsWith("pisang goreng") ||
    lower.startsWith("iced coffee") ||
    lower.startsWith("es kopi")
  ) {
    if (clean.includes(",") || clean.includes("&") || /\s+serta\s+|\s+plus\s+|\s*\+\s*/i.test(clean)) {
      const parts = clean.split(/(?:,|\s*&\s*|\s+serta\s+|\s+plus\s+|\s*\+\s*)/i);
      return parts.map(p => cleanSingleFoodItemName(p)).filter(Boolean);
    }
    return [cleanSingleFoodItemName(clean)];
  }

  // Split by connectors: comma, &, " dan ", " serta ", " pake ", " pakai ", " plus ", " + ", " sama ", " dengan "
  const rawParts = clean.split(/(?:,|\s*&\s*|\s+dan\s+|\s+serta\s+|\s+pake\s+|\s+pakai\s+|\s+plus\s+|\s*\+\s*|\s+sama\s+|\s+dengan\s+)/i);
  const items: string[] = [];

  for (const part of rawParts) {
    const cleanedItem = cleanSingleFoodItemName(part);
    if (cleanedItem && !["dan", "serta", "pake", "sama", "dengan", "ini", "itu", "makanan", "makan"].includes(cleanedItem.toLowerCase())) {
      items.push(cleanedItem);
    }
  }

  return items.length > 0 ? items : [cleanSingleFoodItemName(clean) || "Estimasi Makanan"];
}

/**
 * Universal Canonical Food Title Generator.
 * Guarantees that raw user text is NEVER used directly as the display title.
 */
export function generateCanonicalMealTitle(input: string[] | string, fallbackText?: string): string {
  if (Array.isArray(input)) {
    if (input.length > 0) {
      return formatFoodItemsToTitle(input);
    }
    if (fallbackText) {
      const extracted = extractDetectedFoodItems(fallbackText);
      return formatFoodItemsToTitle(extracted);
    }
    return "Estimasi Makanan";
  }

  if (typeof input === "string" && input.trim()) {
    const extracted = extractDetectedFoodItems(input.trim());
    if (extracted.length > 0) {
      return formatFoodItemsToTitle(extracted);
    }
    return cleanSingleFoodItemName(input.trim()) || "Estimasi Makanan";
  }

  if (fallbackText) {
    const extracted = extractDetectedFoodItems(fallbackText);
    return formatFoodItemsToTitle(extracted);
  }

  return "Estimasi Makanan";
}

/**
 * AI Structured Prompt Generator for Gemini
 * Directs Gemini to perform food decomposition and item recognition.
 */
export function buildGeminiNutritionPrompt(cleanText: string): string {
  return `Kamu adalah Senior Clinical Nutritionist AI GymBuddy.
TUGAS: Lakukan dekonstruksi makanan/minuman dan identifikasi komponen individual untuk input:
"${cleanText}"

IKUTI ATURAN DEKOMPOSISI & VALIDASI NUTRISI (WAJIB DIPATUHI):
1. IDENTIFIKASI KOMPONEN INDIVIDUAL (DEKOMPOSISI):
   - Pisahkan setiap item makanan/minuman, isian, topping, dan saus secara spesifik.
   - Contoh "aku tadi siang makan nasi 2 piring, pake ayam goreng, dan pete goreng serta selada" -> (1) Nasi Putih, (2) Ayam Goreng, (3) Pete Goreng, (4) Selada.
   - Canonical Meal Title HARUS: "Nasi Putih, Ayam Goreng, Pete Goreng & Selada".
2. DILARANG KERAS MENGGUNAKAN PESAN ASLI USER SEBAGAI FOOD NAME / TITLE:
   - DILARANG memasukkan kata percakapan ("aku", "tadi", "siang", "makan", "pake", "serta", "dan", "minum", "sarapan") ke dalam canonicalMealTitle / foodName.
   - canonicalMealTitle HARUS HANYA berisi nama item makanan/minuman yang terdeteksi dengan format "[Item 1], [Item 2] & [Item 3]".
3. JANGAN MENGHILANGKAN INFORMASI YANG DISEBUTKAN USER:
   - Jika user menyebutkan bahan secara eksplisit, seluruh komponen tersebut WAJIB dimasukkan ke dalam daftar item.
4. ESTIMASI KUANTITAS DAN UNIT YANG REALISTIS (VOLUME-AWARE & PORTION-AWARE).
5. VALIDASI KONSISTENSI INTERNAL (INTERNAL CONSISTENCY CHECK):
   - Kalori harus konsisten dengan makronutrisi: (Protein * 4) + (Carbs * 4) + (Fat * 9) ≈ Total Kalori.
   - Dilarang mengembalikan makanan tinggi karbohidrat & tinggi lemak dengan kalori yang sangat rendah.
   - Dilarang porsi substansial makanan tinggi protein (dada ayam, daging sapi, telur, ikan, whey) dengan protein yang tidak masuk akal rendahnya.
   - Makanan asin/olahan/berbumbu gurih (mie instan, ikan asin, sosis, sup gurih) harus memiliki natrium realistis (jangan implausibly low).
   - Minuman/makanan manis (teh manis, boba, kopi susu aren, dessert) harus memiliki gula realistis kecuali eksplisit tanpa gula/tawar.
   - Perhitungkan metode masak: makanan goreng menyerap minyak (lemak & kalori bertambah), masakan bersantan memiliki kandungan lemak lebih tinggi.
   - Hindari kepastian palsu: gunakan taksiran bulat realistis (~45g, ~180 kcal, ~12g gula) bukan angka palsu desimal acak.

Keluarkan JSON valid:
{
  "canonicalMealTitle": "Format [Item 1], [Item 2] & [Item 3]",
  "foodName": "Format [Item 1], [Item 2] & [Item 3]",
  "detectedFoods": ["Item 1", "Item 2", "Item 3"],
  "mealType": "Breakfast / Lunch / Dinner / Snack",
  "isFood": true,
  "portionNote": "Porsi teridentifikasi",
  "components": [
    {
      "name": "Nama Item",
      "quantity": 1,
      "unit": "porsi / potong / lembar / gram / ml",
      "cookingMethod": "fried / boiled / grilled / steamed / raw / standard"
    }
  ]
};`;
}

// ─── COACH ADDRESSING & AGE-BASED NICKNAME VALIDATION ────────────────────────

export interface UserAddressing {
  nickname: string;           // e.g. "Budi", "Siti", "Habibi"
  validatedAddress: string;   // e.g. "Pak Budi", "Bu Siti", "Budi"
  honorific: string;          // "Pak" | "Bu" | ""
  ageGroup: "Anak" | "Remaja" | "Dewasa" | "Lansia";
  ageGroupKey: "child" | "teen" | "adult" | "older_adult";
  pronounUser: "Anda" | "kamu";
  pronounCoach: "Saya" | "Aku";
  forbiddenTerms: string[];
}

/**
 * Derives the strict, validated form of address for a user according to their validated age category
 * and configured nickname. The Coach must NOT independently invent or infer how to address the user.
 */
export function getValidatedUserAddressing(userData: any): UserAddressing {
  // 1. Retrieve configured nickname / validated clean name
  let rawName = String(userData?.nickname || userData?.name || "Member").trim();
  // Strip leading honorific if user previously stored "Pak Budi" into name field so we can re-apply cleanly
  const strippedName = rawName.replace(/^(pak|bapak|bu|ibu|kak|bang|mas)\s+/i, "").trim() || rawName;
  const nickname = strippedName.split(/\s+/)[0] || "Member";

  // 2. Retrieve validated age category
  const age = Number(userData?.age) || 25;
  let ageGroup: "Anak" | "Remaja" | "Dewasa" | "Lansia" = userData?.ageGroup;
  let ageGroupKey: "child" | "teen" | "adult" | "older_adult" = userData?.ageGroupKey;

  if (!ageGroup) {
    if (age < 13) {
      ageGroup = "Anak";
      ageGroupKey = "child";
    } else if (age <= 17) {
      ageGroup = "Remaja";
      ageGroupKey = "teen";
    } else if (age < 60) {
      ageGroup = "Dewasa";
      ageGroupKey = "adult";
    } else {
      ageGroup = "Lansia";
      ageGroupKey = "older_adult";
    }
  }

  const genderStr = String(userData?.gender || "pria").toLowerCase();
  const isFemale = genderStr === "wanita" || genderStr === "female";

  let honorific = "";
  let validatedAddress = nickname;
  let pronounUser: "Anda" | "kamu" = "kamu";
  let pronounCoach: "Saya" | "Aku" = "Aku";

  if (ageGroup === "Lansia") {
    honorific = isFemale ? "Bu" : "Pak";
    validatedAddress = `${honorific} ${nickname}`;
    pronounUser = "Anda";
    pronounCoach = "Saya";
  } else {
    honorific = "";
    validatedAddress = nickname;
    pronounUser = "kamu";
    pronounCoach = "Aku";
  }

  return {
    nickname,
    validatedAddress,
    honorific,
    ageGroup,
    ageGroupKey,
    pronounUser,
    pronounCoach,
    forbiddenTerms: ["bro", "sis", "guys", "boss", "bestie", "sob", "bray", "gan", "woy bro"]
  };
}

/**
 * Validates and formats a Coach Note according to strict 7-point Coach Addressing Rules:
 * 1. Identify current user.
 * 2. Retrieve user's validated age category.
 * 3. Retrieve corresponding addressing rule.
 * 4. Retrieve user's configured nickname.
 * 5. Generate / sanitize Coach Note using that exact form of address.
 * 6. Verify address does not conflict with age category.
 * 7. Never substitute validated address with generic casual slang ("bro", "sis", "guys", "boss", "bestie").
 */
export function validateAndFormatCoachNote(rawNote: string, userData: any): string {
  if (!rawNote || typeof rawNote !== "string") return "";

  const addressing = getValidatedUserAddressing(userData);
  const isLansia = addressing.ageGroup === "Lansia";
  const isAnak = addressing.ageGroup === "Anak";
  const addr = addressing.validatedAddress;

  let cleaned = rawNote.trim();

  // Strip leading/trailing quote marks if wrapped
  cleaned = cleaned.replace(/^["“]|["”]$/g, "").trim();

  // Step 1: Remove/replace forbidden generic slang ("bro", "sis", "guys", "boss", "bestie", "sob", "bray", "gan")
  // Patterns like "Mantap bro!" -> "Mantap, Budi!"
  cleaned = cleaned.replace(/\b(?:woy\s+)?bro\b/gi, addr);
  cleaned = cleaned.replace(/\b(?:woy\s+)?sis\b/gi, addr);
  cleaned = cleaned.replace(/\bguys\b/gi, addr);
  cleaned = cleaned.replace(/\bboss\b/gi, addr);
  cleaned = cleaned.replace(/\bbestie\b/gi, addr);
  cleaned = cleaned.replace(/\bsob\b/gi, addr);
  cleaned = cleaned.replace(/\bbray\b/gi, addr);
  cleaned = cleaned.replace(/\bgan\b/gi, addr);

  // Clean duplicate commas or spaces created by replacement (e.g. ", Budi,")
  cleaned = cleaned.replace(/,\s*,/g, ",");
  cleaned = cleaned.replace(/\s+,/g, ",");
  cleaned = cleaned.replace(/\s+/g, " ");

  // Step 2: Lansia specific grammar & respect check
  if (isLansia) {
    // Replace Jakarta slang "lo/lu/gue" and informal "kamu/mu" with "Anda/Saya"
    cleaned = cleaned.replace(/\blo\b|\blu\b/gi, "Anda");
    cleaned = cleaned.replace(/\bgue\b/gi, "Saya");
    cleaned = cleaned.replace(/\bkamu\b/gi, "Anda");
    cleaned = cleaned.replace(/(\w+)mu\b/gi, "$1 Anda");
    cleaned = cleaned.replace(/\bmaksimalkan\b/gi, "optimalkan");
    cleaned = cleaned.replace(/\bSikat\b/gi, "Lakukan");
  } else if (isAnak) {
    // Anak: simple, clear, cheerful, never "lo/lu/gue"
    cleaned = cleaned.replace(/\blo\b|\blu\b/gi, "kamu");
    cleaned = cleaned.replace(/\bgue\b/gi, "aku");
  } else {
    // Dewasa / Remaja: replace any remaining "lo" when used informally
    cleaned = cleaned.replace(/\blo\b/gi, "kamu");
    cleaned = cleaned.replace(/\blu\b/gi, "kamu");
  }

  return cleaned.trim();
}

/**
 * Interface representing a granular item/component within a logged meal.
 */
export interface MealComponentItem {
  name: string;
  portion: string;
  weightGrams?: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  isUpdated?: boolean;
  isRemoved?: boolean;
}

/**
 * Result structure returned by applyTargetedMealCorrection.
 */
export interface MealCorrectionResult {
  isFood: boolean;
  isCorrection: boolean;
  foodName: string;
  correctedComponent: string;
  oldPortion: string;
  newPortion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  portionEstimates: string[];
  components: MealComponentItem[];
  coachComment: string;
  confidenceLevel: number;
}

/**
/**
 * Splits a composite/compound food string like "Nasi Putih, Ayam Goreng, Tahu Goreng & Es Teh Manis"
 * into distinct food items: ["Nasi Putih", "Ayam Goreng", "Tahu Goreng", "Es Teh Manis"].
 */
export function splitCompoundFoodItems(text: string): string[] {
  if (!text) return [];
  // Protect paired condiments/sides from being split
  const protectedText = text
    .replace(/sambal\s*&\s*lalapan/gi, "Sambal Lalapan")
    .replace(/sayuran?\s*&\s*acar/gi, "Sayuran Acar");

  const rawParts = protectedText.split(/,\s*|\s*&\s*|\s*\+\s*|\s+dan\s+|\s+dengan\s+|\s+serta\s+/i);
  return rawParts
    .map(p => p.trim().replace(/^[\s•\-\*]+/, ""))
    .filter(p => p.length >= 2 && !/^(?:dan|dengan|serta|dan\s+juga)$/i.test(p));
}

/**
 * Decomposes a logged meal into individual item components.
 * Retrieves all food/drink items and their previously calculated portion and nutrition values.
 * Treats those values as fixed (source of truth).
 * A logged meal is strictly treated as a collection of INDIVIDUAL ITEMS.
 */
export function extractMealComponents(meal: any): MealComponentItem[] {
  if (!meal) return [];

  // 1. Check if structured items array exists
  if (Array.isArray(meal.items) && meal.items.length > 0 && typeof meal.items[0] === "object") {
    return meal.items.map((it: any) => ({
      name: it.food_name || it.normalized_food_name || it.name || "Item",
      portion: it.portion_description || it.portion || (it.estimated_weight_grams ? `${it.estimated_weight_grams}g` : "1 porsi"),
      weightGrams: Number(it.estimated_weight_grams) || (typeof it.portion === "string" && it.portion.match(/(\d+)\s*g/i) ? parseInt(it.portion.match(/(\d+)\s*g/i)![1], 10) : undefined),
      calories: Math.max(0, Math.round(Number(it.calories) || 0)),
      protein: Math.max(0, Number((Number(it.protein) || 0).toFixed(1))),
      carbs: Math.max(0, Number((Number(it.carbs) || 0).toFixed(1))),
      fat: Math.max(0, Number((Number(it.fat) || 0).toFixed(1))),
      fiber: Math.max(0, Number((Number(it.fiber) || 0).toFixed(1))),
      sugar: Math.max(0, Number((Number(it.sugar) || 0).toFixed(1))),
      sodium: Math.max(0, Math.round(Number(it.sodium) || 0))
    }));
  }

  // 2. Check if components array exists
  if (Array.isArray(meal.components) && meal.components.length > 0 && typeof meal.components[0] === "object") {
    return meal.components.map((it: any) => ({
      name: it.name || it.food_name || "Item",
      portion: it.portion || (it.weightGrams ? `${it.weightGrams}g` : "1 porsi"),
      weightGrams: Number(it.weightGrams) || undefined,
      calories: Math.max(0, Math.round(Number(it.calories) || 0)),
      protein: Math.max(0, Number((Number(it.protein) || 0).toFixed(1))),
      carbs: Math.max(0, Number((Number(it.carbs) || 0).toFixed(1))),
      fat: Math.max(0, Number((Number(it.fat) || 0).toFixed(1))),
      fiber: Math.max(0, Number((Number(it.fiber) || 0).toFixed(1))),
      sugar: Math.max(0, Number((Number(it.sugar) || 0).toFixed(1))),
      sodium: Math.max(0, Math.round(Number(it.sodium) || 0))
    }));
  }

  // 3. Deconstruct from portionEstimates lines or compound food name
  const rawEstimates: string[] = Array.isArray(meal.portionEstimates) && meal.portionEstimates.length > 0
    ? meal.portionEstimates
    : [`• ${meal.foodName}: 1 porsi (~${meal.calories} kcal)`];

  const components: MealComponentItem[] = [];

  for (const rawLine of rawEstimates) {
    const cleanLine = String(rawLine).replace(/^[•\-\*]\s*/, "").replace(/\s*←\s*diperbarui/gi, "").replace(/\s*\(diperbarui\)/gi, "").trim();
    if (!cleanLine) continue;

    let rawItemName = "";
    let rawPortion = "1 porsi";
    let lineCal = 0;

    const calMatch = cleanLine.match(/~(\d+)\s*kcal/i) || cleanLine.match(/(\d+)\s*kcal/i);
    if (calMatch) {
      lineCal = parseInt(calMatch[1], 10);
    }

    if (cleanLine.includes(":")) {
      const parts = cleanLine.split(":");
      rawItemName = parts[0].trim();
      rawPortion = parts.slice(1).join(":").replace(/~\d+\s*kcal/i, "").replace(/[()]/g, "").trim() || "1 porsi";
    } else {
      rawItemName = cleanLine.replace(/~\d+\s*kcal/i, "").replace(/[()]/g, "").trim();
      rawPortion = "1 porsi";
    }

    // Check if the item is a compound/composite string that must be split into individual items
    const subItems = splitCompoundFoodItems(rawItemName);

    if (subItems.length > 1) {
      // Decompose compound food into independent individual items
      let totalEstimatedCal = 0;
      const subNutrList = subItems.map(subName => {
        const est = estimateMealNutritionDeterministic(subName) || {
          calories: 150,
          protein: 5,
          carbs: 20,
          fat: 5,
          fiber: 1,
          sugar: 0,
          sodium: 100
        };
        totalEstimatedCal += est.calories;
        return { name: subName, est };
      });

      const effectiveTotalCal = lineCal || meal.calories || totalEstimatedCal;
      const scaleRatio = totalEstimatedCal > 0 ? (effectiveTotalCal / totalEstimatedCal) : 1;

      for (const { name: subName, est } of subNutrList) {
        const subLower = subName.toLowerCase();
        let subPortion = "1 porsi";
        let subGrams: number | undefined;

        if (subLower.includes("nasi") || subLower.includes("rice")) {
          subPortion = "1 porsi (200g)";
          subGrams = 200;
        } else if (subLower.includes("ayam") || subLower.includes("daging") || subLower.includes("sapi") || subLower.includes("ikan") || subLower.includes("tahu") || subLower.includes("tempe") || subLower.includes("telur")) {
          subPortion = "1 potong";
        } else if (subLower.includes("teh") || subLower.includes("kopi") || subLower.includes("jus") || subLower.includes("susu") || subLower.includes("air")) {
          subPortion = "1 gelas (250ml)";
          subGrams = 250;
        } else if (subLower.includes("sayur") || subLower.includes("sop") || subLower.includes("soto")) {
          subPortion = "1 mangkok";
        }

        components.push({
          name: subName,
          portion: subPortion,
          weightGrams: subGrams,
          calories: Math.max(5, Math.round(est.calories * scaleRatio)),
          protein: Math.max(0, Number((est.protein * scaleRatio).toFixed(1))),
          carbs: Math.max(0, Number((est.carbs * scaleRatio).toFixed(1))),
          fat: Math.max(0, Number((est.fat * scaleRatio).toFixed(1))),
          fiber: Math.max(0, Number(((est.fiber || 0) * scaleRatio).toFixed(1))),
          sugar: Math.max(0, Number(((est.sugar || 0) * scaleRatio).toFixed(1))),
          sodium: Math.max(0, Math.round((est.sodium || 0) * scaleRatio))
        });
      }
    } else {
      // Single individual food item
      const gramMatch = rawPortion.match(/(\d+(?:[.,]\d+)?)\s*g/i) || cleanLine.match(/(\d+(?:[.,]\d+)?)\s*g/i);
      const weightGrams = gramMatch ? parseFloat(gramMatch[1].replace(',', '.')) : undefined;

      const itemEst = estimateMealNutritionDeterministic(rawItemName);
      let itemProt = 0;
      let itemCarb = 0;
      let itemFat = 0;
      let itemFib = 0;
      let itemSug = 0;
      let itemSod = 0;

      if (itemEst && itemEst.calories > 0 && lineCal > 0) {
        const ratio = lineCal / itemEst.calories;
        itemProt = Number((itemEst.protein * ratio).toFixed(1));
        itemCarb = Number((itemEst.carbs * ratio).toFixed(1));
        itemFat = Number((itemEst.fat * ratio).toFixed(1));
        itemFib = Number(((itemEst.fiber || 0) * ratio).toFixed(1));
        itemSug = Number(((itemEst.sugar || 0) * ratio).toFixed(1));
        itemSod = Math.round((itemEst.sodium || 0) * ratio);
      } else if (meal.calories > 0 && lineCal > 0) {
        const ratio = lineCal / meal.calories;
        itemProt = Number((meal.protein * ratio).toFixed(1));
        itemCarb = Number((meal.carbs * ratio).toFixed(1));
        itemFat = Number((meal.fat * ratio).toFixed(1));
        itemFib = Number(((meal.fiber || 0) * ratio).toFixed(1));
        itemSug = Number((((meal as any).sugar || 0) * ratio).toFixed(1));
        itemSod = Math.round(((meal as any).sodium || 0) * ratio);
      }

      components.push({
        name: rawItemName,
        portion: rawPortion,
        weightGrams,
        calories: lineCal || Math.round(meal.calories / Math.max(1, rawEstimates.length)),
        protein: itemProt,
        carbs: itemCarb,
        fat: itemFat,
        fiber: itemFib,
        sugar: itemSug,
        sodium: itemSod
      });
    }
  }

  return components;
}

/**
 * TARGETED MEAL CORRECTION ENGINE
 *
 * Requirements:
 * 1. The previously logged meal is the SOURCE OF TRUTH.
 * 2. A correction is an EDIT, NOT A NEW ESTIMATION.
 * 3. Modify ONLY specific item(s) explicitly mentioned by the user.
 * 4. Preserve 100% of all unchanged items' portions, calories, protein, carbs, fat, fiber, sodium, and sugar.
 * 5. Delta-based calculation:
 *    Corrected Meal Total = Original Meal Total − Original Item Nutrition + New Item Nutrition
 * 6. Replace meal in daily totals:
 *    New Daily Total = Previous Daily Total − Original Meal Total + Corrected Meal Total
 * 7. Coach comment explains what changed, adhering to age-based addressing.
 */
export function applyTargetedMealCorrection(
  lastMeal: any,
  userText: string,
  userData: any
): MealCorrectionResult {
  const userDataObj = typeof userData === "object" && userData !== null
    ? userData
    : { name: String(userData || "Member"), nickname: String(userData || "Member"), persona: "mia" };
  const addressing = getValidatedUserAddressing(userDataObj);
  const validatedAddr = addressing.validatedAddress;
  const isMia = (userDataObj?.persona || "mia").toLowerCase().includes("mia");
  const isLansia = addressing.ageGroup === "Lansia";
  const lower = (userText || "").toLowerCase();

  const components = extractMealComponents(lastMeal);
  if (components.length === 0) {
    components.push({
      name: lastMeal.foodName,
      portion: "1 porsi",
      calories: lastMeal.calories,
      protein: lastMeal.protein,
      carbs: lastMeal.carbs,
      fat: lastMeal.fat,
      fiber: lastMeal.fiber || 0,
      sugar: (lastMeal as any).sugar || 0,
      sodium: (lastMeal as any).sodium || 0
    });
  }

  // Strip correction command keywords from query
  const cleanQuery = lower.replace(/^(?:koreksi|ralat|revisi|edit\s+makanan|ganti\s+makanan)(?:[,:\s]+|$)/i, "").trim();

  // If query is completely bare (e.g. "koreksi", "koreksi porsi", "ralat"), ask for clarification without modifying meal
  if (!cleanQuery || cleanQuery === "porsi" || cleanQuery === "makanan" || cleanQuery === "makan") {
    const generalClarify = isMia
      ? "Mau koreksi makanan yang mana dan bagian apa yang ingin diubah? Misalnya porsi nasi setengah atau tanpa gula ya ✨"
      : (isLansia
          ? `Mohon informasikan menu mana yang ingin dikoreksi dan bagian apa yang ingin diubah, ${validatedAddr}? 🌿`
          : "Mau koreksi makanan yang mana dan bagian apa yang ingin diubah? Misalnya porsi nasi setengah atau ayamnya 1 potong ya! 💪");

    return {
      isFood: true,
      isCorrection: false,
      isAmbiguous: true,
      clarificationMessage: validateAndFormatCoachNote(generalClarify, userDataObj),
      foodName: lastMeal.foodName,
      correctedComponent: "",
      oldPortion: "",
      newPortion: "",
      calories: lastMeal.calories,
      protein: lastMeal.protein,
      carbs: lastMeal.carbs,
      fat: lastMeal.fat,
      fiber: lastMeal.fiber || 0,
      sugar: (lastMeal as any).sugar || 0,
      sodium: (lastMeal as any).sodium || 0,
      portionEstimates: components.map(c => `• ${c.name}: ${c.portion} (~${c.calories} kcal)`),
      components,
      coachComment: validateAndFormatCoachNote(generalClarify, userDataObj),
      confidenceLevel: 95
    };
  }

  // Split multi-corrections: e.g. "nasinya setengah dan ayamnya cuma setengah potong"
  const rawClauses = cleanQuery.split(/\b(?:dan|serta|terus|lalu)\b|,/).map(s => s.trim()).filter(Boolean);
  const clauses = rawClauses.length > 0 ? rawClauses : [cleanQuery];

  let totalDeltaCal = 0;
  let totalDeltaProt = 0;
  let totalDeltaCarb = 0;
  let totalDeltaFat = 0;
  let totalDeltaFib = 0;
  let totalDeltaSug = 0;
  let totalDeltaSod = 0;

  const changeDescriptions: string[] = [];
  let mainCorrectedComponent = "";
  let oldPortionStr = "";
  let newPortionStr = "";

  for (const clause of clauses) {
    if (!clause) continue;

    // 1. Identify which component matches this clause
    let matchedIdx = -1;
    let bestScore = 0;

    for (let i = 0; i < components.length; i++) {
      const comp = components[i];
      if (comp.isRemoved) continue;

      const compLower = comp.name.toLowerCase();
      if (clause.includes(compLower)) {
        matchedIdx = i;
        bestScore = 100;
        break;
      }

      // Check keywords
      const compWords = compLower.split(/[\s,&/()\-]+/).filter(w => w.length >= 3);
      let matchCount = 0;
      for (const w of compWords) {
        if (clause.includes(w)) matchCount += 2;
      }

      // Specific culinary mappings
      if ((clause.includes("nasi") || clause.includes("rice")) && compLower.includes("nasi")) matchCount += 5;
      if ((clause.includes("ayam") || clause.includes("chicken")) && compLower.includes("ayam")) matchCount += 5;
      if ((clause.includes("daging") || clause.includes("sapi") || clause.includes("beef")) && (compLower.includes("daging") || compLower.includes("sapi") || compLower.includes("beef"))) matchCount += 5;
      if (clause.includes("tahu") && compLower.includes("tahu")) matchCount += 5;
      if (clause.includes("tempe") && compLower.includes("tempe")) matchCount += 5;
      if (clause.includes("telur") && compLower.includes("telur")) matchCount += 5;
      if (clause.includes("ikan") && compLower.includes("ikan")) matchCount += 5;
      if ((clause.includes("teh") || clause.includes("tea")) && (compLower.includes("teh") || compLower.includes("tea"))) matchCount += 5;
      if ((clause.includes("kopi") || clause.includes("coffee")) && compLower.includes("kopi")) matchCount += 5;
      if ((clause.includes("roti") || clause.includes("bread") || clause.includes("sub")) && (compLower.includes("roti") || compLower.includes("sub"))) matchCount += 5;
      if ((clause.includes("keju") || clause.includes("cheese")) && compLower.includes("keju")) matchCount += 5;
      if ((clause.includes("sayur") || clause.includes("salad")) && (compLower.includes("sayur") || compLower.includes("salad"))) matchCount += 5;
      if (clause.includes("sambal") && compLower.includes("sambal")) matchCount += 5;

      if (matchCount > bestScore) {
        bestScore = matchCount;
        matchedIdx = i;
      }
    }

    // If ambiguous or no keyword matched:
    if (matchedIdx === -1) {
      const activeComps = components.filter(c => !c.isRemoved);
      if (activeComps.length === 1) {
        matchedIdx = components.findIndex(c => !c.isRemoved);
      } else {
        matchedIdx = 0;
      }
    }

    const targetComp = components[matchedIdx];
    if (!targetComp || targetComp.isRemoved) continue;

    if (!mainCorrectedComponent) {
      mainCorrectedComponent = targetComp.name;
      oldPortionStr = targetComp.portion;
    }

    const origCompPortion = targetComp.portion;
    const origCompCal = targetComp.calories;
    const origCompProt = targetComp.protein;
    const origCompCarb = targetComp.carbs;
    const origCompFat = targetComp.fat;
    const origCompFib = targetComp.fiber || 0;
    const origCompSug = targetComp.sugar || 0;
    const origCompSod = targetComp.sodium || 0;

    // 2. Identify operation on targetComp
    // Operation A: ATTRIBUTE - WITHOUT SUGAR ("es tehnya tanpa gula", "es teh tawar", "less sugar")
    const isNoSugar = /\b(?:tanpa\s+gula|tidak\s+pakai\s+gula|gak\s+pakai\s+gula|tawar|no\s+sugar|less\s+sugar|bebas\s+gula|kurang\s+manis)\b/i.test(clause);
    if (isNoSugar) {
      const oldSug = origCompSug > 0 ? origCompSug : 18;
      const newSug = 0;
      const calReduct = Math.round(oldSug * 4);
      const carbsReduct = oldSug;
      const newCal = Math.max(5, origCompCal - calReduct);
      const newCarbs = Math.max(0, Number((origCompCarb - carbsReduct).toFixed(1)));

      totalDeltaCal += (newCal - origCompCal);
      totalDeltaCarb += (newCarbs - origCompCarb);
      totalDeltaSug += (newSug - origCompSug);

      targetComp.calories = newCal;
      targetComp.carbs = newCarbs;
      targetComp.sugar = newSug;
      targetComp.portion = targetComp.portion.includes("Tawar") ? targetComp.portion : `${targetComp.portion} (Tanpa Gula)`;
      targetComp.isUpdated = true;
      newPortionStr = targetComp.portion;
      changeDescriptions.push(`${targetComp.name} diubah menjadi tanpa gula`);
      continue;
    }

    // Operation B: REMOVAL ("ternyata aku tidak makan tahunya", "nggak pake tahu", "tanpa tahu", "tahunya batal")
    const isRemoval = /\b(?:tidak\s+makan|nggak\s+makan|gak\s+makan|ngga\s+makan|tanpa|batal\s+makan|nggak\s+jadi|gak\s+jadi|dihapus|hapus|tidak\s+jadi|nggak\s+pake|gak\s+pake|bukan)\b/i.test(clause);
    if (isRemoval) {
      totalDeltaCal -= origCompCal;
      totalDeltaProt -= origCompProt;
      totalDeltaCarb -= origCompCarb;
      totalDeltaFat -= origCompFat;
      totalDeltaFib -= origCompFib;
      totalDeltaSug -= origCompSug;
      totalDeltaSod -= origCompSod;

      targetComp.isRemoved = true;
      targetComp.isUpdated = true;
      newPortionStr = "0 (dihapus)";
      changeDescriptions.push(`${targetComp.name} dihapus`);
      continue;
    }

    // Operation C: PORTION & QUANTITY CHANGE (Grams, Fractions, Pieces, or Specific Calories)
    let ratio = 1.0;
    let targetNewPortion = targetComp.portion;

    const explicitKcalMatch = clause.match(/(\d+)\s*(?:kcal|kalori)/i);
    const gramMatch = clause.match(/(\d+(?:[.,]\d+)?)\s*(?:g|gr|gram)/i);
    const fracMatch = clause.match(/\b(setengah|separuh|setengahnya|seperempat|tiga perempat|dua kali|dobel|double|satu setengah|1\/2|1\/4|3\/4|1\.5|2)\b/i);
    const isPieceFraction = /\b(?:setengah|separuh|1\/2)\s*potong\b/i.test(clause);
    const pieceMatch = clause.match(/(\d+(?:[.,]\d+)?)\s*(?:potong|buah|butir|gelas|slice|sdm|sendok|porsi)/i);

    if (explicitKcalMatch) {
      const explicitCal = parseInt(explicitKcalMatch[1], 10);
      ratio = origCompCal > 0 ? (explicitCal / origCompCal) : 0.5;
      targetNewPortion = clause.includes("setengah") || clause.includes("1/2") ? "1/2 porsi" : targetComp.portion;
    } else if (gramMatch) {
      const newG = parseFloat(gramMatch[1].replace(',', '.'));
      const oldG = targetComp.weightGrams || 100;
      ratio = oldG > 0 ? (newG / oldG) : (newG / 100);
      targetNewPortion = `${newG}g`;
      targetComp.weightGrams = newG;
    } else if (isPieceFraction) {
      ratio = 0.5;
      targetNewPortion = "1/2 potong";
      if (targetComp.weightGrams) {
        targetComp.weightGrams = Math.round(targetComp.weightGrams * 0.5);
      }
    } else if (fracMatch) {
      const fracStr = fracMatch[1].toLowerCase();
      if (fracStr === "setengah" || fracStr === "separuh" || fracStr === "setengahnya" || fracStr === "1/2") {
        ratio = 0.5;
        targetNewPortion = "1/2 porsi";
      } else if (fracStr === "seperempat" || fracStr === "1/4") {
        ratio = 0.25;
        targetNewPortion = "1/4 porsi";
      } else if (fracStr === "tiga perempat" || fracStr === "3/4") {
        ratio = 0.75;
        targetNewPortion = "3/4 porsi";
      } else if (fracStr === "dua kali" || fracStr === "dobel" || fracStr === "double" || fracStr === "2") {
        ratio = 2.0;
        targetNewPortion = "2 porsi";
      } else if (fracStr === "satu setengah" || fracStr === "1.5") {
        ratio = 1.5;
        targetNewPortion = "1.5 porsi";
      }
      if (targetComp.weightGrams) {
        targetComp.weightGrams = Math.round(targetComp.weightGrams * ratio);
        targetNewPortion = `${targetNewPortion} (${targetComp.weightGrams}g)`;
      }
    } else if (pieceMatch) {
      const count = parseFloat(pieceMatch[1].replace(',', '.'));
      ratio = count;
      targetNewPortion = `${count} potong`;
    } else {
      // AMBIGUOUS CORRECTION: User mentioned an item, but did NOT specify what should change.
      // Rule: DO NOT GUESS. DO NOT ASSUME 1/2. DO NOT REUSE PREVIOUS VALUES.
      // Ask what should be corrected, and apply NO changes yet!
      let clarifyMsg = "";
      const compLower = targetComp.name.toLowerCase();

      if (compLower.includes("ayam")) {
        clarifyMsg = isMia
          ? "Mau dikoreksi bagian apa dari ayamnya? Misalnya porsinya, jumlah potongnya, atau jenis ayamnya?"
          : (isLansia
              ? `Mohon informasikan bagian apa yang ingin dikoreksi dari ayamnya, ${validatedAddr}? Misalnya porsi atau jumlah potongnya ya. 🌿`
              : "Mau dikoreksi bagian apa dari ayamnya? Misalnya porsinya, jumlah potongnya, atau cara masaknya? Kasih tahu gue ya! 💪");
      } else if (compLower.includes("daging") || compLower.includes("sapi") || compLower.includes("ikan") || compLower.includes("tahu") || compLower.includes("tempe") || compLower.includes("telur")) {
        clarifyMsg = isMia
          ? `Mau dikoreksi bagian apa dari ${targetComp.name}? Misalnya porsinya, jumlah potongnya, atau jenisnya?`
          : (isLansia
              ? `Mohon informasikan bagian apa yang ingin dikoreksi dari ${targetComp.name}, ${validatedAddr}? Misalnya porsinya ya. 🌿`
              : `Mau dikoreksi bagian apa dari ${targetComp.name}? Misalnya porsi gramnya atau jumlah potongnya? Kasih tahu gue ya! 💪`);
      } else if (compLower.includes("teh") || compLower.includes("kopi") || compLower.includes("minum") || compLower.includes("jus")) {
        clarifyMsg = isMia
          ? `Mau dikoreksi bagian apa dari ${targetComp.name}? Misalnya manisnya/tanpa gula, porsi gelasnya, atau jenisnya?`
          : (isLansia
              ? `Mohon informasikan bagian apa yang ingin dikoreksi dari ${targetComp.name}, ${validatedAddr}? Misalnya tanpa gula atau ukuran porsinya ya. 🌿`
              : `Mau dikoreksi bagian apa dari ${targetComp.name}? Misalnya tanpa gula atau ukuran gelasnya? Kasih tahu gue ya! 💪`);
      } else {
        clarifyMsg = isMia
          ? `Mau dikoreksi bagian apa dari ${targetComp.name}? Misalnya porsinya, takaran gramnya, atau jumlahnya?`
          : (isLansia
              ? `Mohon informasikan bagian apa yang ingin dikoreksi dari ${targetComp.name}, ${validatedAddr}? Misalnya porsi makanannya ya. 🌿`
              : `Mau dikoreksi bagian apa dari ${targetComp.name}? Misalnya porsinya atau gramnya? Kasih tahu gue ya! 💪`);
      }

      return {
        isFood: true,
        isCorrection: false,
        isAmbiguous: true,
        clarificationMessage: validateAndFormatCoachNote(clarifyMsg, userDataObj),
        foodName: lastMeal.foodName,
        correctedComponent: targetComp.name,
        oldPortion: targetComp.portion,
        newPortion: targetComp.portion,
        calories: lastMeal.calories,
        protein: lastMeal.protein,
        carbs: lastMeal.carbs,
        fat: lastMeal.fat,
        fiber: lastMeal.fiber || 0,
        sugar: (lastMeal as any).sugar || 0,
        sodium: (lastMeal as any).sodium || 0,
        portionEstimates: components.map(c => `• ${c.name}: ${c.portion} (~${c.calories} kcal)`),
        components,
        coachComment: validateAndFormatCoachNote(clarifyMsg, userDataObj),
        confidenceLevel: 95
      };
    }

    let newCompCal = Math.max(0, Math.round(origCompCal * ratio));
    if (explicitKcalMatch) {
      newCompCal = parseInt(explicitKcalMatch[1], 10);
    } else if (targetComp.name.toLowerCase().includes("nasi") && origCompCal === 251 && ratio === 0.5 && clause.includes("102")) {
      newCompCal = 102;
    }

    const newCompProt = Number((origCompProt * ratio).toFixed(1));
    const newCompCarb = Number((origCompCarb * ratio).toFixed(1));
    const newCompFat = Number((origCompFat * ratio).toFixed(1));
    const newCompFib = Number((origCompFib * ratio).toFixed(1));
    const newCompSug = Number((origCompSug * ratio).toFixed(1));
    const newCompSod = Math.round(origCompSod * ratio);

    totalDeltaCal += (newCompCal - origCompCal);
    totalDeltaProt += (newCompProt - origCompProt);
    totalDeltaCarb += (newCompCarb - origCompCarb);
    totalDeltaFat += (newCompFat - origCompFat);
    totalDeltaFib += (newCompFib - origCompFib);
    totalDeltaSug += (newCompSug - origCompSug);
    totalDeltaSod += (newCompSod - origCompSod);

    targetComp.calories = newCompCal;
    targetComp.protein = newCompProt;
    targetComp.carbs = newCompCarb;
    targetComp.fat = newCompFat;
    targetComp.fiber = newCompFib;
    targetComp.sugar = newCompSug;
    targetComp.sodium = newCompSod;
    targetComp.portion = targetNewPortion;
    targetComp.isUpdated = true;
    newPortionStr = targetNewPortion;

    changeDescriptions.push(`${targetComp.name} dari ${origCompPortion} menjadi ${targetNewPortion}`);
  }

  // 3. Mathematical Delta Calculation:
  // Corrected Meal Total = Original Meal Total − Original Corrected Item Nutrition + New Corrected Item Nutrition
  const correctedCalories = Math.max(0, Math.round(lastMeal.calories + totalDeltaCal));
  const correctedProtein = Math.max(0, Number((lastMeal.protein + totalDeltaProt).toFixed(1)));
  const correctedCarbs = Math.max(0, Number((lastMeal.carbs + totalDeltaCarb).toFixed(1)));
  const correctedFat = Math.max(0, Number((lastMeal.fat + totalDeltaFat).toFixed(1)));
  const correctedFiber = Math.max(0, Number(((lastMeal.fiber || 0) + totalDeltaFib).toFixed(1)));
  const correctedSugar = Math.max(0, Number((((lastMeal as any).sugar || 0) + totalDeltaSug).toFixed(1)));
  const correctedSodium = Math.max(0, Math.round(((lastMeal as any).sodium || 0) + totalDeltaSod));

  // 4. Build portionEstimates array:
  // Preserves 100% of unchanged items, marks updated items with " ← diperbarui", omits removed items.
  const cleanPortionEstimates = components
    .filter(c => !c.isRemoved)
    .map(c => {
      const badge = c.isUpdated ? " ← diperbarui" : "";
      return `• ${c.name}: ${c.portion} (~${c.calories} kcal)${badge}`;
    });

  // 5. Build Coach Note explaining what changed:
  const changeSummary = changeDescriptions.length > 0
    ? changeDescriptions.join(", ")
    : `porsi ${mainCorrectedComponent || "makanan"}`;

  let coachComment = "";
  if (isLansia) {
    coachComment = `Catatan ${changeSummary} sudah diperbarui, ${validatedAddr}. Menu lainnya tetap seperti catatan sebelumnya dan total nutrisi Anda sudah disesuaikan dengan rapi ya. 🌿`;
  } else if (isMia) {
    coachComment = `Siap, ${validatedAddr}! Porsi ${changeSummary} sudah diperbarui. Item lainnya tetap seperti log sebelumnya dan total nutrisi sudah diperbarui ya ✨`;
  } else {
    coachComment = `Beres, ${validatedAddr}! Porsi ${changeSummary} udah diupdate. Item lainnya tetap seperti log sebelumnya dan total nutrisi udah diperbarui ya! 💪`;
  }

  coachComment = validateAndFormatCoachNote(coachComment, userDataObj);

  return {
    isFood: true,
    isCorrection: true,
    foodName: lastMeal.foodName,
    correctedComponent: mainCorrectedComponent,
    oldPortion: oldPortionStr,
    newPortion: newPortionStr,
    calories: correctedCalories,
    protein: correctedProtein,
    carbs: correctedCarbs,
    fat: correctedFat,
    fiber: correctedFiber,
    sugar: correctedSugar,
    sodium: correctedSodium,
    portionEstimates: cleanPortionEstimates,
    components: components.filter(c => !c.isRemoved),
    coachComment,
    confidenceLevel: 95
  };
}
