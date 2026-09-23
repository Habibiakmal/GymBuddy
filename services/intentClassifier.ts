/**
 * GymBuddy AI Strict Intent Classification Gate
 * 
 * Ensures that AI actions and data mutations (workout logging, meal logging, weight logging)
 * are only executed when the user has expressed an explicit, verifiable intent.
 * 
 * Prevents conversational introductions, onboarding greetings, and program queries
 * from triggering accidental tracking actions.
 */

export type UserIntentType =
  | "ONBOARDING_GREETING"
  | "GREETING"
  | "GENERAL_CONVERSATION"
  | "PROGRAM_QUESTION"
  | "WORKOUT_QUESTION"
  | "WORKOUT_LOG"
  | "WORKOUT_ADAPTATION"
  | "VAGUE_WORKOUT_NEEDS_CLARIFICATION"
  | "EQUIPMENT_INQUIRY"
  | "EXERCISE_POSTURE_INQUIRY"
  | "MEAL_LOG"
  | "MEAL_CORRECTION"
  | "MEAL_DELETE"
  | "RECOMMENDATION_REJECTION"
  | "RECOMMENDATION_REFERENCE_MODIFICATION"
  | "PREFERENCE_UPDATE"
  | "MULTI_INTENT"
  | "WEIGHT_LOG"
  | "BODY_MEASUREMENT_LOG"
  | "GOAL_UPDATE"
  | "PROFILE_UPDATE"
  | "NUTRITION_QUESTION"
  | "HYDRATION_LOG"
  | "CANCEL"
  | "CONFIRMATION"
  | "UNKNOWN";

export type ResponseComplexityType =
  | "SIMPLE_ACTION"
  | "SIMPLE_CONFIRMATION"
  | "CORRECTION"
  | "RECOMMENDATION"
  | "INFORMATIONAL"
  | "MULTI_INTENT"
  | "SAFETY_WARNING"
  | "ERROR"
  | "ACCOUNT_ACTION";

export interface PreferenceInstructionResult {
  type: "PERSISTENT_DISLIKE" | "TEMPORARY_PREFERENCE" | "TEMPORAL_OVERRIDE" | "PERSISTENT_CHANGE";
  value: string;
  scope?: "tomorrow_only" | "tonight_only" | "meal_specific" | "today" | "specific_date";
  category?: "sarapan" | "siang" | "malam" | "snack";
  action?: "add_disliked" | "remove_disliked" | "add_temporary" | "add_override";
}

export interface WorkoutAdaptationDetails {
  isAdaptation: boolean;
  targetMinutes?: number;
  targetDurationMinutes?: number;
  effortSignal: "normal" | "intense" | "fatigued";
  isFatigued?: boolean;
  discomfortSignal?: string;
  discomfortArea?: string;
  equipmentConstraint?: string;
}

export type EquipmentIntentSubtype =
  | "WHAT_IS_IT"
  | "HOW_TO_USE"
  | "EXERCISES_FOR_EQUIPMENT"
  | "EXERCISE_POSTURE"
  | "GENERAL_EQUIPMENT";

export type MealCorrectionSubtype =
  | "MEAL_CORRECTION_ITEM"
  | "MEAL_CORRECTION_PORTION"
  | "MEAL_CORRECTION_QUANTITY"
  | "MEAL_CORRECTION_COMPONENT"
  | "MEAL_CORRECTION_METADATA"
  | "MEAL_CORRECTION_GENERAL";

export interface MealCorrectionDetails {
  subtype: MealCorrectionSubtype;
  action:
    | "replace_item"
    | "modify_portion"
    | "modify_quantity"
    | "remove_component"
    | "modify_metadata"
    | "set_composition"
    | "general_clarification";
  targetItem?: string;
  replacementItem?: string;
  portionText?: string;
  weightGrams?: number;
  quantity?: number;
  compositionItems?: string[];
  isAmbiguous?: boolean;
}

export interface IntentClassificationResult {
  intent: UserIntentType;
  equipmentSubtype?: EquipmentIntentSubtype;
  confidence: "high" | "medium" | "low";
  reason: string;
  extractedDetails?: {
    durationMinutes?: number;
    activityName?: string;
    weightKg?: number;
    mealDescription?: string;
    mealCorrection?: MealCorrectionDetails;
    equipmentName?: string;
    equipmentIntentSubtype?: EquipmentIntentSubtype;
    preferenceInstruction?: PreferenceInstructionResult;
    workoutAdaptation?: WorkoutAdaptationDetails;
    rejectionDetails?: { rejectedItem?: string };
    multiIntentDetails?: { logPart: string; recPart: string };
  };
}

/**
 * Strips brand names so that words like "gym" inside "GymBuddy" do not trigger activity detectors.
 */
export function sanitizeTextForIntent(text: string): string {
  return text
    .replace(/\bgym\s*buddy\b/gi, "")
    .replace(/\bgymbuddy\b/gi, "")
    .trim();
}

/**
 * Cleans a food term by stripping leading articles and trailing suffixes.
 */
export const NON_FOOD_TOKENS = new Set([
  "halo", "hai", "hi", "hello", "hei", "hey",
  "pagi", "siang", "sore", "malam",
  "mia", "max", "coach", "gymbuddy", "bot",
  "tes", "test", "ping", "oy", "woi", "bro", "sis",
  "ok", "oke", "sip", "siap", "iya", "ya", "tidak", "gak", "nggak",
  "makasih", "terima kasih", "thanks", "thx",
  "apa", "siapa", "gimana", "bagaimana", "kenapa", "mengapa", "kapan", "dimana",
  "bisa", "tolong", "bantu", "mau", "tanya", "dong", "saja", "aja", "doang",
  "latihan", "olahraga", "workout", "gym", "lari", "jalan", "renang"
]);

/**
 * Recognizes standalone greetings or coach callouts.
 */
export function isGreeting(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const clean = text.trim().toLowerCase().replace(/[?!.,;:~]/g, "");

  // Single word greetings
  const exactGreetings = new Set([
    "halo", "hai", "hi", "hello", "hei", "hey",
    "pagi", "siang", "sore", "malam",
    "mia", "max",
    "tes", "test", "ping", "assalamualaikum", "oy", "woi"
  ]);
  if (exactGreetings.has(clean)) return true;

  // Multi-word greetings
  return Boolean(
    clean.match(/^(?:halo|hai|hello|hi|hey|hei)\s+(?:gymbuddy|mia|max|coach(?:\s+(?:mia|max))?|kawan|teman|bro|sis)$/i) ||
    clean.match(/^(?:selamat\s+)?(?:pagi|siang|sore|malam)(?:\s+(?:mia|max|coach|gymbuddy))?$/i) ||
    clean.match(/^(?:halo|hai|hello|hi)\s+semua$/i) ||
    clean === "assalamu'alaikum" ||
    clean === "assalamualaikum wr wb" ||
    clean === "assalamu alaikum"
  );
}

export function cleanFoodTerm(term: string): string {
  if (!term) return "";
  let res = term.trim().replace(/^[,\.\s:;"']+|[,\.\s:;"']+$/g, "");
  res = res.replace(/^(?:itu\s+|yang\s+tadi\s+|yang\s+|tadi\s+)/i, "");
  res = res.replace(/\s+(?:aja|saja|doang|cuma|hanya)$/i, "");
  if (res.toLowerCase().endsWith("nya") && res.length > 5) {
    res = res.slice(0, -3);
  }
  return res.trim();
}

/**
 * Parses user text for structured meal correction details across all supported subtypes:
 * - MEAL_CORRECTION_ITEM (replacing an ingredient e.g. "itu cumi, bukan daging")
 * - MEAL_CORRECTION_PORTION (portion/gram changes e.g. "nasinya cuma 100 gram")
 * - MEAL_CORRECTION_QUANTITY (unit counts e.g. "telurnya dua butir")
 * - MEAL_CORRECTION_COMPONENT (removing an item e.g. "telurnya nggak jadi")
 * - MEAL_CORRECTION_METADATA (modifiers e.g. "es tehnya tanpa gula")
 * - MEAL_CORRECTION_GENERAL (explicit composition e.g. "meal tadi isinya..." or ambiguous "koreksi meal tadi")
 */
export function parseMealCorrectionDetails(
  rawText: string,
  lastMeal?: any
): MealCorrectionDetails | null {
  if (!rawText || typeof rawText !== "string") return null;
  const cleanRaw = rawText.trim();
  const lower = cleanRaw.toLowerCase();

  // Strip leading correction commands
  const stripped = lower
    .replace(/^(?:koreksi(?:\s+lagi|\s+dong)?|ralat(?:\s+lagi|\s+dong)?|revisi(?:\s+lagi)?|edit\s+makanan|ganti\s+makanan)[:,\s]*/i, "")
    .trim();

  // Standalone cancellation / abort phrases must NEVER be treated as meal correction
  if (
    stripped.match(/^(?:batal|stop|cancel|nggak\s+jadi|gak\s+jadi|tidak\s+jadi|lupakan|lupain)[.!]?$/i)
  ) {
    return null;
  }

  // 1. Bare / Generic ambiguity: "koreksi", "ralat", "koreksi meal tadi", "yang tadi salah"
  if (
    !stripped ||
    stripped === "meal" ||
    stripped === "meal tadi" ||
    stripped === "meal tadi." ||
    stripped === "makanan" ||
    stripped === "makanan tadi" ||
    stripped === "porsi" ||
    stripped === "porsi tadi" ||
    stripped === "yang tadi salah" ||
    stripped === "yang tadi salah." ||
    stripped === "tadi salah" ||
    stripped === "salah semua" ||
    stripped === "salah" ||
    stripped === "menu tadi" ||
    stripped === "lagi" ||
    lower === "koreksi lagi" ||
    lower === "koreksi lagi." ||
    lower === "koreksi meal tadi." ||
    lower === "koreksi meal tadi" ||
    lower === "koreksi meal" ||
    lower === "yang tadi salah." ||
    lower === "yang tadi salah"
  ) {
    return {
      subtype: "MEAL_CORRECTION_GENERAL",
      action: "general_clarification",
      isAmbiguous: true
    };
  }

  // 2. Explicit Whole Composition:
  // "koreksi meal, itu nasi putih dan cumi sambal"
  // "Meal tadi isinya nasi putih sama cumi sambal."
  // "Yang ada di meal tadi cuma nasi putih dan cumi sambal."
  const compMatch =
    stripped.match(/^(?:meal,?\s*itu|meal\s+tadi\s+isinya|isinya\s+(?:cuma|hanya)?|yang\s+ada\s+di\s+meal\s+tadi\s+cuma|meal\s+tadi\s+cuma|sebenarnya\s+cuma)\s+(.+)$/i) ||
    lower.match(/(?:meal\s+tadi\s+isinya|yang\s+ada\s+di\s+meal\s+tadi\s+cuma|koreksi\s+meal,?\s*itu)\s+(.+)$/i);

  if (compMatch) {
    const rawItems = compMatch[1]
      .split(/\s*(?:dan|sama|serta|&|\+|,)\s*/i)
      .map(s => cleanFoodTerm(s))
      .filter(s => s.length >= 2 && !/^(?:dan|sama|cuma|hanya|aja|saja|doang|tanpa)$/i.test(s));

    if (rawItems.length >= 2) {
      return {
        subtype: "MEAL_CORRECTION_GENERAL",
        action: "set_composition",
        compositionItems: rawItems
      };
    }
  }

  // 3. Item Replacement (MEAL_CORRECTION_ITEM)
  // Pattern 3a: "itu cumi, bukan daging sambal" / "cumi, bukan daging"
  const p1 = stripped.match(/^(?:itu\s+|yang\s+tadi\s+)?([a-zA-Z0-9\s]+?)\s*,\s*bukan\s+([a-zA-Z0-9\s]+?)[.]?$/i);
  if (p1) {
    const replacement = cleanFoodTerm(p1[1]);
    const target = cleanFoodTerm(p1[2]);
    if (replacement && target) {
      return {
        subtype: "MEAL_CORRECTION_ITEM",
        action: "replace_item",
        targetItem: target,
        replacementItem: replacement
      };
    }
  }

  // Pattern 3b: "yang tadi bukan ayam, tapi cumi" / "bukan daging, itu cumi sambal" / "bukan daging tapi cumi"
  const p2 = stripped.match(/^(?:yang\s+tadi\s+)?bukan\s+([a-zA-Z0-9\s]+?)(?:,\s*|\s+)(?:tapi|melainkan|sebenarnya|harusnya|itu)\s+([a-zA-Z0-9\s]+?)[.]?$/i);
  if (p2) {
    const target = cleanFoodTerm(p2[1]);
    const replacement = cleanFoodTerm(p2[2]);
    if (target && replacement) {
      return {
        subtype: "MEAL_CORRECTION_ITEM",
        action: "replace_item",
        targetItem: target,
        replacementItem: replacement
      };
    }
  }

  // Pattern 3c: "bukan telur ceplok, telur orak-arik"
  const p3 = stripped.match(/^bukan\s+([a-zA-Z0-9\s]+?)\s*,\s*([a-zA-Z0-9\s]+?)[.]?$/i);
  if (p3) {
    const target = cleanFoodTerm(p3[1]);
    const replacement = cleanFoodTerm(p3[2]);
    if (target && replacement) {
      return {
        subtype: "MEAL_CORRECTION_ITEM",
        action: "replace_item",
        targetItem: target,
        replacementItem: replacement
      };
    }
  }

  // Pattern 3d: "ganti daging sambal jadi cumi sambal" / "ubah daging jadi cumi"
  const p4 = stripped.match(/^(?:ubah|ganti)\s+([a-zA-Z0-9\s]+?)\s+(?:jadi|menjadi|ke|sama|dengan)\s+([a-zA-Z0-9\s]+?)[.]?$/i);
  if (p4) {
    const target = cleanFoodTerm(p4[1]);
    const replacement = cleanFoodTerm(p4[2]);
    if (target && replacement) {
      return {
        subtype: "MEAL_CORRECTION_ITEM",
        action: "replace_item",
        targetItem: target,
        replacementItem: replacement
      };
    }
  }

  // Pattern 3e: "daging sambalnya salah, itu cumi" / "dagingnya sebenarnya ayam" / "yang tadi ayam ternyata cumi"
  const p5 = stripped.match(/^(?:yang\s+tadi\s+|tadi\s+)?([a-zA-Z0-9\s]+?)(?:nya)?\s+(?:salah|sebenarnya|sebetulnya|harusnya|harus\s*nya|ternyata)\s*(?:itu|jadi|,)?\s*([a-zA-Z0-9\s]+?)[.]?$/i);
  if (p5) {
    const target = cleanFoodTerm(p5[1]);
    const replacement = cleanFoodTerm(p5[2]);
    if (target && replacement) {
      return {
        subtype: "MEAL_CORRECTION_ITEM",
        action: "replace_item",
        targetItem: target,
        replacementItem: replacement
      };
    }
  }

  // Pattern 3f: "yang terakhir itu cumi sambal" / "yang tadi itu cumi"
  const p6 = stripped.match(/^(?:yang\s+(?:tadi|terakhir)\s+(?:itu\s+)?|terakhir(?:nya)?\s+(?:itu\s+)?)([a-zA-Z0-9\s]+?)[.]?$/i);
  if (p6 && !stripped.includes("bukan")) {
    const replacement = cleanFoodTerm(p6[1]);
    if (replacement && !/^(?:setengah|seperempat|sedikit|\d+)/i.test(replacement)) {
      return {
        subtype: "MEAL_CORRECTION_ITEM",
        action: "replace_item",
        targetItem: "last_item",
        replacementItem: replacement
      };
    }
  }

  // 4. Component Removal (MEAL_CORRECTION_COMPONENT)
  // "telurnya nggak jadi", "tanpa tahu", "nggak pake sambal", "hapus telur", "ternyata aku tidak makan tahunya"
  const r1 = stripped.match(/^(?:ternyata\s+)?(?:aku\s+|saya\s+|gue\s+)?(?:tidak\s+makan|nggak\s+makan|gak\s+makan|ngga\s+makan|tanpa|batal(?:\s+makan)?|hapus|dihapus|nggak\s+jadi|gak\s+jadi|tidak\s+jadi|nggak\s+pake|gak\s+pake)\s+([a-zA-Z0-9\s]+?)[.]?$/i);
  const r2 = stripped.match(/^([a-zA-Z0-9\s]+?)(?:nya)?\s*(?:(?:tidak|nggak|gak|ngga)\s*(?:jadi|dimakan|pake|pakai)|batal|dihapus)[.]?$/i);
  if (r1 || r2) {
    const target = cleanFoodTerm(r1 ? r1[1] : r2![1]);
    if (target && target.length > 2 && !NON_FOOD_TOKENS.has(target.toLowerCase())) {
      return {
        subtype: "MEAL_CORRECTION_COMPONENT",
        action: "remove_component",
        targetItem: target
      };
    }
  }

  // 5. Metadata (MEAL_CORRECTION_METADATA)
  // "es tehnya tanpa gula", "es teh tawar"
  if (/\b(?:tanpa\s+gula|tidak\s+pakai\s+gula|gak\s+pakai\s+gula|tawar|no\s+sugar|less\s+sugar|bebas\s+gula|kurang\s+manis)\b/i.test(stripped)) {
    const targetMatch = stripped.match(/^([a-zA-Z0-9\s]+?)(?:nya)?\s*(?:tanpa|tawar|no\s+sugar|less\s+sugar)/i);
    return {
      subtype: "MEAL_CORRECTION_METADATA",
      action: "modify_metadata",
      targetItem: targetMatch ? cleanFoodTerm(targetMatch[1]) : "minuman"
    };
  }

  // 6. Quantity (MEAL_CORRECTION_QUANTITY)
  // "telurnya dua butir", "ayamnya 2 potong", "ayamnya cuma setengah potong"
  const qtyMatch = stripped.match(/^([a-zA-Z0-9\s]+?)(?:nya)?\s*(?:cuma|hanya|sebanyak|jadi)?\s*(\d+|satu|dua|tiga|empat|lima|setengah|separuh|1\/2)\s*(butir|potong|buah|slice|biji|mangkok|piring)[.]?$/i);
  if (qtyMatch) {
    const numMap: Record<string, number> = { satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, setengah: 0.5, separuh: 0.5, "1/2": 0.5 };
    const rawVal = qtyMatch[2].toLowerCase();
    const qty = numMap[rawVal] || parseFloat(rawVal);
    const unit = qtyMatch[3];
    return {
      subtype: "MEAL_CORRECTION_QUANTITY",
      action: "modify_quantity",
      targetItem: cleanFoodTerm(qtyMatch[1]),
      quantity: qty,
      portionText: qty === 0.5 ? `1/2 ${unit}` : `${qty} ${unit}`
    };
  }

  // 7. Portion (MEAL_CORRECTION_PORTION)
  // "nasinya cuma 100 gram", "nasinya cuma setengah", "cuminya sekitar 150 gram", "kue talas 1"
  const portMatch = stripped.match(/^([a-zA-Z0-9\s]+?)(?:nya)?\s*(?:tadi\s*)?(?:cuma|hanya|sekitar|sebanyak|jadi)?\s*(\d+(?:[.,]\d+)?\s*(?:g|gr|gram|potong|buah|slice|porsi)?|setengah(?:nya)?|separuh|seperempat|tiga\s*perempat|1\/2|1\/4|3\/4|satu|dua|tiga)[.]?$/i);
  if (portMatch) {
    const target = cleanFoodTerm(portMatch[1]);
    const portionText = portMatch[2].trim();
    const gramMatch = portionText.match(/(\d+(?:[.,]\d+)?)\s*(?:g|gr|gram)/i);
    const weightGrams = gramMatch ? parseFloat(gramMatch[1].replace(",", ".")) : undefined;
    return {
      subtype: "MEAL_CORRECTION_PORTION",
      action: "modify_portion",
      targetItem: target,
      portionText,
      weightGrams
    };
  }

  // 7b. Multi-item or multi-clause correction:
  // e.g. "kue jeruk setengah, kue talas 1, pudding dessert juga setengah"
  // e.g. "aku cuma makan kue jeruk setengah, kue talas satu, pudding setengah"
  const cleanForMulti = stripped.replace(/^(?:aku\s+|saya\s+|gue\s+)?(?:cuma\s+|hanya\s+)?(?:makan\s+)?/i, "").trim();
  const multiParts = cleanForMulti.split(/\s*(?:,|dan|serta|\+)\s*/i).map(s => s.replace(/\bjuga\b/gi, "").trim()).filter(Boolean);
  if (multiParts.length >= 2) {
    const matchedClauses: Array<{ item: string; portion: string }> = [];
    for (const part of multiParts) {
      const m = part.match(/^([a-zA-Z0-9\s]+?)(?:nya)?\s*(?:cuma|hanya|sebanyak|jadi)?\s*(\d+(?:[.,]\d+)?\s*(?:g|gr|gram|potong|buah|slice|porsi)?|setengah(?:nya)?|separuh|seperempat|tiga\s*perempat|1\/2|1\/4|3\/4|satu|dua|tiga)$/i);
      if (m) {
        matchedClauses.push({ item: cleanFoodTerm(m[1]), portion: m[2].trim() });
      }
    }
    if (matchedClauses.length >= 2) {
      return {
        subtype: "MEAL_CORRECTION_PORTION",
        action: "modify_portion",
        targetItem: matchedClauses[0].item,
        portionText: matchedClauses.map(c => `${c.item}: ${c.portion}`).join(", ")
      };
    }
  }

  // 8. Ambiguous single food mention: ONLY if it's 1-2 words naming a component without portions or verbs (e.g. "koreksi ayamnya", "ayamnya", "nasi putih")
  if (!/\b(?:cuma|hanya|setengah|separuh|seperempat|tidak|nggak|gak|batal|makan|gram|g|gr|potong|buah|butir|dan|sama|kcal|kalori)\b/i.test(stripped)) {
    const words = stripped.split(/\s+/).filter(Boolean);
    if (words.length <= 2) {
      // Must not contain conversational non-food tokens (e.g. "halo", "mia", "hai", "gymbuddy", "tes")
      const hasNonFoodToken = words.some(w => NON_FOOD_TOKENS.has(w.toLowerCase().replace(/[?!.,;:~]/g, "")));
      if (!hasNonFoodToken) {
        const target = cleanFoodTerm(stripped);
        const hasExplicitCorrectionKeyword = /^(?:koreksi|ralat|revisi|edit\s+makanan|ganti\s+makanan)[:,\s]*/i.test(lower);
        
        // Either explicit keyword was used (e.g. "koreksi ayamnya"), OR target matches a known component in lastMeal
        let isConfirmedFood = hasExplicitCorrectionKeyword;
        if (!isConfirmedFood && lastMeal) {
          const comps = Array.isArray(lastMeal.components) ? lastMeal.components : [];
          const mealFoodName = String(lastMeal.foodName || "").toLowerCase();
          const targetLow = target.toLowerCase();
          isConfirmedFood = comps.some((c: any) => c.name.toLowerCase().includes(targetLow) || targetLow.includes(c.name.toLowerCase())) || mealFoodName.includes(targetLow);
        }

        if (target && isConfirmedFood) {
          return {
            subtype: "MEAL_CORRECTION_GENERAL",
            action: "general_clarification",
            targetItem: target,
            isAmbiguous: true
          };
        }
      }
    }
  }

  return null;
}

/**
 * Classifies the incoming message intent with high precision.
 */
export function classifyUserIntent(
  rawText: string,
  context: {
    hasImage?: boolean;
    hasRecentMeal?: boolean;
    userProfile?: any;
  } = {}
): IntentClassificationResult {
  const text = (rawText || "").trim();
  const lower = text.toLowerCase();
  const sanitized = sanitizeTextForIntent(lower);

  // ── 1. ONBOARDING GREETING / INITIAL BOT HANDSHAKE ─────────────────────────
  // Examples:
  // "Hello Coach Mia! Saya habibi, baru saja menyelesaikan onboarding di GymBuddy untuk program maintain. Saya siap mulai."
  // "Halo Coach Max! Saya Budi, baru selesai onboarding."
  // "Halo, saya baru daftar GymBuddy, siap mulai program."
  const isOnboardingHandshake =
    Boolean(
      lower.match(/(?:halo|hello|hai|hi)\s+coach\s+(?:mia|max)/i) &&
      lower.match(/(?:onboarding|baru\s+daftar|selesai\s+setup|akun\s+baru|siap\s+mulai)/i)
    ) ||
    Boolean(
      lower.match(/(?:baru\s+(?:saja\s+)?(?:menyelesaikan|selesai)\s+onboarding)/i)
    ) ||
    Boolean(
      lower.match(/(?:onboarding\s+di\s+gymbuddy)/i) &&
      lower.match(/(?:siap\s+mulai|mulai\s+program)/i)
    );

  if (isOnboardingHandshake) {
    return {
      intent: "ONBOARDING_GREETING",
      confidence: "high",
      reason: "User is introducing themselves after finishing onboarding"
    };
  }

  // ── 2. GENERAL GREETINGS / BOT CHECK ──────────────────────────────────────
  // Examples: "halo", "hai", "hi", "mia?", "max?", "halo gymbuddy", "halo mia", "pagi", "tes"
  if (isGreeting(text)) {
    return {
      intent: "GREETING",
      confidence: "high",
      reason: "User sent a conversational greeting or coach check"
    };
  }

  // ── 2b. CANCEL / ABORT TASK ──────────────────────────────────────────────
  // Examples: "batal", "stop", "cancel", "nggak jadi", "gak jadi", "tidak jadi", "lupakan"
  const isCancel = Boolean(
    lower.match(/^(?:batal|stop|cancel|nggak\s+jadi|gak\s+jadi|tidak\s+jadi|lupakan|lupain|kembali|exit|quit)[.!]?$/i) ||
    lower.match(/^(?:tolong\s+)?(?:batalkan|batalin|cancel\s+aja|batal\s+aja)[.!]?$/i)
  );

  if (isCancel) {
    return {
      intent: "CANCEL",
      confidence: "high",
      reason: "User explicitly requested cancellation or abort of current task"
    };
  }

  // ── 2c. CONFIRMATION ─────────────────────────────────────────────────────
  // Examples: "ya", "iya", "betul", "benar", "oke", "ok", "siap", "simpan"
  const isConfirmation = Boolean(
    lower.match(/^(?:ya|iya|betul|benar|oke|ok|siap|simpan|yes|yep|yup|lanjut)[.!]?$/i) ||
    lower.match(/^(?:sudah\s+benar|sudah\s+sesuai|udah\s+pas)[.!]?$/i)
  );

  if (isConfirmation) {
    return {
      intent: "CONFIRMATION",
      confidence: "high",
      reason: "User confirmed pending action"
    };
  }

  // ── 2e. COURTESY / GRATITUDE (GENERAL CONVERSATION) ──────────────────────
  // Examples: "makasih", "terima kasih", "thanks", "thank you", "mantap"
  const isCourtesy = Boolean(
    lower.match(/^(?:makasih|terima\s+kasih|makasi|mksh|thanks|thx|thank\s+you|arigato|nuhun|suwun)(?:\s+(?:mia|max|coach|gymbuddy|banyak|ya|bgt|banget))?[.!]?$/i) ||
    lower.match(/^(?:mantap|keren|top|good|nice|sip|oke\s+deh|ok\s+deh)[.!]?$/i)
  );

  if (isCourtesy) {
    return {
      intent: "GENERAL_CONVERSATION",
      confidence: "high",
      reason: "User expressed gratitude or courteous chit-chat"
    };
  }

  // ── MULTI-INTENT CHECK ───────────────────────────────────────────────────
  const multiIntent = detectMultiIntent(rawText);
  if (multiIntent && multiIntent.isMultiIntent) {
    return {
      intent: "MULTI_INTENT",
      confidence: "high",
      reason: "User combined meal logging and recommendation request",
      extractedDetails: {
        multiIntentDetails: {
          logPart: multiIntent.logPart || "",
          recPart: multiIntent.recPart || ""
        }
      }
    };
  }

  // ── WORKOUT ADAPTATION CHECK ─────────────────────────────────────────────
  // e.g. "Aku cuma punya waktu 15 menit", "Lututku lagi gak enak", "15 menit dan lagi capek"
  const workoutAdaptation = detectWorkoutAdaptation(rawText);
  if (workoutAdaptation && workoutAdaptation.isAdaptation && !lower.match(/\b(?:makan|menu|kalori|minum)\b/i)) {
    return {
      intent: "WORKOUT_ADAPTATION",
      confidence: "high",
      reason: "User requested workout adaptation for duration, fatigue, or discomfort",
      extractedDetails: {
        workoutAdaptation
      }
    };
  }

  // ── RECOMMENDATION REJECTION / PREFERENCE UPDATE CHECK ───────────────────
  const rejectionCheck = detectRecommendationRejection(rawText);
  const prefInstruction = parsePreferenceInstruction(rawText);

  if (rejectionCheck.isRejection) {
    return {
      intent: "RECOMMENDATION_REJECTION",
      confidence: "high",
      reason: rejectionCheck.rejectedItem
        ? `User rejected recommendation ingredient: ${rejectionCheck.rejectedItem}`
        : "User rejected recommendation",
      extractedDetails: {
        rejectionDetails: { rejectedItem: rejectionCheck.rejectedItem },
        preferenceInstruction: prefInstruction || (rejectionCheck.rejectedItem ? {
          type: "PERSISTENT_DISLIKE",
          value: rejectionCheck.rejectedItem,
          action: "add_disliked"
        } : undefined)
      }
    };
  }

  if (prefInstruction) {
    return {
      intent: "PREFERENCE_UPDATE",
      confidence: "high",
      reason: `User specified preference update (${prefInstruction.type}: ${prefInstruction.value})`,
      extractedDetails: {
        preferenceInstruction: prefInstruction
      }
    };
  }

  // ── RECOMMENDATION REFERENCE MODIFICATION CHECK ───────────────────────────
  // E.g. "yang tadi aja", "ganti ayamnya jadi tahu", "hapus nasinya", "tambahin buah"
  const isRefMod =
    lower.match(/^(?:yang\s+tadi(?:\s+aja)?|pilihan\s+yang\s+tadi)$/i) ||
    lower.match(/(?:hapus|hilangkan|tanpa)\s+(?:nasi|ayam|telur|sayur|tahu|tempe|daging)/i) ||
    lower.match(/(?:tambahin|tambah|ekstra)\s+(?:buah|sayur|telur)/i) ||
    lower.match(/(?:yang\s+)?([a-zA-Z\s]+?)(?:nya)?\s+ganti(?:\s+(?:jadi|ke|dengan)\s+([a-zA-Z\s]+))?/i) ||
    lower.match(/^(?:ganti\s+(?:yang\s+)?itu|bukan\s+(?:yang\s+)?itu)$/i);

  if (isRefMod && !context.hasRecentMeal) {
    return {
      intent: "RECOMMENDATION_REFERENCE_MODIFICATION",
      confidence: "high",
      reason: "User is modifying or referencing recent recommendation"
    };
  }

  // ── 2d. HYDRATION LOG (EXPLICIT) ─────────────────────────────────────────
  // Examples: "minum 500ml", "air 2 gelas", "minum 1 liter"
  const isHydration = Boolean(
    lower.match(/(?:minum|air(?:\s+putih)?|water)\s+(?:sebanyak\s+)?(\d+(?:[.,]\d+)?)\s*(?:ml|mili|liter|l|gelas|cup|botol)\b/i) ||
    lower.match(/(\d+(?:[.,]\d+)?)\s*(?:ml|mili|liter|l|gelas|cup|botol)\s*(?:air(?:\s+putih)?|water)\b/i)
  );

  if (isHydration) {
    return {
      intent: "HYDRATION_LOG",
      confidence: "high",
      reason: "User explicitly reported water / hydration intake"
    };
  }

  // ── 2. WEIGHT UPDATE (EXPLICIT) ───────────────────────────────────────────
  // Examples:
  // "Berat saya sekarang 72 kg, tolong update."
  // "Update bb 70 kg"
  // "BB sekarang 75"
  const weightRegex = /(?:update\s+bb|lapor\s+bb|berat\s*(?:badan)?(?:\s*(?:ku|mu|nya|saya|gue|gw|aku))?|bb(?:\s*(?:ku|mu|nya|saya|gue|gw|aku))?|timbangan(?:\s*(?:ku|mu|nya|saya|gue|gw|aku))?|tadi\s*nimbang|nimbang|weight)\s*(?:hari\s*ini|saat\s*ini|sekarang|skrg|terbaru|terkini|adalah|menjadi|jadi|di|=|:|udah|sudah)?\s*(\d{2,3}(?:[.,]\d{1,2})?)\s*(?:kg|kilo|kilogram)?\b/i;
  const weightMatch = lower.match(weightRegex) ||
                      lower.match(/(?:sekarang|skrg|hari\s*ini|saat\s*ini)\s*(?:berat\s*(?:badan)?(?:\s*(?:ku|mu|nya|saya|gue|gw|aku))?|bb(?:\s*(?:ku|mu|nya|saya|gue|gw|aku))?)\s*(?:adalah|di|=|:|udah|sudah)?\s*(\d{2,3}(?:[.,]\d{1,2})?)\s*(?:kg|kilo|kilogram)?\b/i);
  if (weightMatch) {
    const val = parseFloat(weightMatch[1].replace(",", "."));
    if (!isNaN(val) && val >= 30 && val <= 300) {
      return {
        intent: "WEIGHT_LOG",
        confidence: "high",
        reason: "User explicitly reported body weight update",
        extractedDetails: { weightKg: val }
      };
    }
  }

  // ── 3. PROGRAM QUESTION / CONVERSATION (NOT WORKOUT LOG) ───────────────────
  // Examples:
  // "Saya mau mulai program maintain."
  // "Program saya apa?"
  // "Mau mulai program hari ini."
  const isProgramConversation =
    Boolean(lower.match(/^(?:saya\s+)?(?:mau|ingin|siap)?\s*(?:mulai\s+)?program\s+(?:maintain|lose|gain|fat\s*loss|diet|bulking|sehat)/i)) ||
    Boolean(lower.match(/\bprogram\s+(?:saya|aku)\s+(?:apa|bagaimana|gimana)\b/i)) ||
    Boolean(lower.match(/^program\s+(?:saya|aku)\s+(?:maintain|lose|gain)/i));

  if (isProgramConversation) {
    return {
      intent: "PROGRAM_QUESTION",
      confidence: "high",
      reason: "User is inquiring or stating their program, not reporting completed exercise"
    };
  }

  // ── 3b. EQUIPMENT & EXERCISE POSTURE INQUIRY ─────────────────────────────
  // Handles demonstrative and direct questions about gym equipment or exercise form/posture
  // especially when accompanied by an image or referring to visual context ("alat ini", "ini apa?")
  const isEquipmentInquirySignal = Boolean(
    lower.match(/\b(?:alat\s*ini|mesin\s*ini|alat\s*gym|mesin\s*gym|alat\s*fitness)\b/i) ||
    lower.match(/\b(?:cara\s+(?:pakai|make|menggunakan)|gimana\s+(?:cara\s+)?(?:make|pakai|menggunakan)|bagaimana\s+(?:cara\s+)?(?:pakai|make|menggunakan))\s+(?:alat|mesin|ini)\b/i) ||
    lower.match(/\b(?:ini\s+alat\s+apa|alat\s+apa\s+ini|ini\s+mesin\s+apa|ini\s+buat\s+apa|alat\s+ini\s+buat\s+apa)\b/i) ||
    lower.match(/\b(?:latihan|workout|olahraga)\s+apa\s+(?:yang\s+)?bisa\s+(?:dilakukan\s+)?(?:dengan|pake|pakai)\s+(?:alat|mesin)\b/i) ||
    lower.match(/\b(?:bisa\s+buat\s+(?:latihan|workout|apa)\s+aja)\b/i) ||
    (context.hasImage && lower.match(/^(?:ini\s+apa|apa\s+ini|alat\s+ini|mesin\s+ini|cara\s+pakai(?:nya)?|cara\s+make(?:nya)?|gimana\s+make(?:nya)?|gimana\s+cara(?:nya)?|bisa\s+buat\s+latihan\s+apa\s*aja)[.?!]?$/i)) ||
    (Boolean(lower.match(/\b(?:dumbbell|barbell|kettlebell|resistance\s*band|treadmill|exercise\s*bike|workout\s*bench|cable\s*machine|yoga\s*mat|barbel|sepeda\s*statis|matras)\b/i)) &&
      Boolean(lower.match(/\b(?:cara|gimana|bagaimana|apa|fungsi|latihan|workout|buat)\b/i)))
  );

  const isExercisePostureSignal = Boolean(
    lower.match(/\b(?:ini\s+gerakan\s+apa|gerakan\s+apa\s+ini|nama\s+gerakan\s+ini|latihan\s+gerakan\s+ini|gerakan\s+ini\s+gimana)\b/i) ||
    lower.match(/\b(?:form\s+ini|postur\s+ini|teknik\s+gerakan\s+ini)\b/i) ||
    (context.hasImage && Boolean(lower.match(/\b(?:gerakan|form|postur)\s+(?:ini|apa)\b/i)))
  );

  if (isExercisePostureSignal) {
    return {
      intent: "EXERCISE_POSTURE_INQUIRY",
      equipmentSubtype: "EXERCISE_POSTURE",
      confidence: "high",
      reason: "User is inquiring about exercise movement or posture shown in visual context",
      extractedDetails: {
        equipmentIntentSubtype: "EXERCISE_POSTURE"
      }
    };
  }

  if (isEquipmentInquirySignal) {
    let eqSubtype: EquipmentIntentSubtype = "GENERAL_EQUIPMENT";
    if (lower.match(/\b(?:ini\s+apa|apa\s+ini|alat\s+apa|mesin\s+apa|nama\s+alat)\b/i)) {
      eqSubtype = "WHAT_IS_IT";
    } else if (lower.match(/\b(?:cara\s+(?:pakai|make|menggunakan)|gimana\s+(?:cara\s+)?(?:make|pakai|menggunakan)|bagaimana\s+cara|tutor(?:ial)?)\b/i)) {
      eqSubtype = "HOW_TO_USE";
    } else if (lower.match(/\b(?:latihan\s+apa|workout\s+apa|bisa\s+buat\s+latihan|buat\s+latihan\s+apa|variasi)\b/i)) {
      eqSubtype = "EXERCISES_FOR_EQUIPMENT";
    }

    return {
      intent: "EQUIPMENT_INQUIRY",
      equipmentSubtype: eqSubtype,
      confidence: "high",
      reason: `User is inquiring about gym equipment/tool (${eqSubtype})`,
      extractedDetails: {
        equipmentIntentSubtype: eqSubtype
      }
    };
  }

  // ── 4. WORKOUT QUESTION / SCHEDULE INQUIRY (NOT WORKOUT LOG) ───────────────
  // Examples:
  // "Jadwal workout hari ini apa?"
  // "Latihan apa hari ini?"
  // "Bagaimana cara bench press?"
  const isWorkoutQuestion =
    Boolean(lower.match(/\b(?:jadwal|schedule)\s+(?:workout|latihan|olahraga|hari\s*ini|besok)\b/i)) ||
    Boolean(lower.match(/\b(?:latihan|workout|olahraga)\s+(?:apa|hari\s*ini|besok)\b/i)) ||
    Boolean(lower.match(/\b(?:menu|program)\s+(?:latihan|workout)\b/i)) ||
    Boolean(lower.match(/\b(?:rekomendasi|saran)\s+(?:latihan|workout|olahraga)\b/i)) ||
    Boolean(lower.match(/\b(?:cara|bagaimana|gimana|tutorial|tips|panduan|tutor)\b/i) && lower.match(/\b(?:bench\s*press|squat|deadlift|push\s*up|pull\s*up|latihan)\b/i)) ||
    (lower.includes("?") && lower.match(/\b(?:latihan|workout|gym|olahraga)\b/i));

  if (isWorkoutQuestion) {
    return {
      intent: "WORKOUT_QUESTION",
      confidence: "high",
      reason: "User is asking about workouts or schedules without claiming completion"
    };
  }

  // ── 5. EXPLICIT WORKOUT LOGGING ───────────────────────────────────────────
  // Must have explicit completion signals and workout type/duration:
  // Examples:
  // "Catat workout saya: gym 45 menit."
  // "Saya baru selesai gym 45 menit."
  // "Barusan saya workout 45 menit."
  // "Saya latihan chest hari ini."
  // "Tadi aku berenang 45 menit."
  const hasExplicitLogCommand = Boolean(lower.match(/\b(?:catat|rekap|simpan|log|masukkan|tulis)\s+(?:workout|latihan|olahraga|sesi)/i));
  const hasCompletionSignal = Boolean(lower.match(/\b(?:sudah|udah|telah|selesai|beres|done|barusan|tadi|habis)\b/i));
  
  // Extract duration e.g. "45 menit", "1 jam", "30 mins"
  const durationMatch = sanitized.match(/(\d+)\s*(?:menit|mins|min|jam|hours|hour)/i);
  const durationMinutes = durationMatch ? (
    durationMatch[0].includes("jam") || durationMatch[0].includes("hour")
      ? parseInt(durationMatch[1], 10) * 60
      : parseInt(durationMatch[1], 10)
  ) : undefined;

  // Check workout keywords on SANITIZED text (so "gym" inside "GymBuddy" is NOT matched)
  const workoutKeywords = [
    "gym", "fitness", "fitnes", "angkat beban", "latihan beban",
    "berenang", "renang", "swimming",
    "lari", "running", "jogging", "joging", "sprint",
    "jalan kaki", "walking", "jalan santai",
    "sepeda", "bersepeda", "cycling", "gowes",
    "elliptical", "treadmill", "hiit", "plank",
    "push up", "push-up", "sit up", "sit-up", "squat",
    "badminton", "futsal", "sepak bola", "basket", "tenis",
    "yoga", "pilates", "stretching", "zumba", "skipping", "boxing"
  ];

  const matchedKeyword = workoutKeywords.find(kw => {
    const escaped = kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    return regex.test(sanitized);
  });

  // Future intent check: "aku mau gym nanti", "besok mau lari"
  const isFutureIntent =
    Boolean(lower.match(/\b(?:mau|akan|pengen|rencana|bakal|nanti|besok|lusa)\b/i)) &&
    !hasCompletionSignal &&
    !hasExplicitLogCommand;

  if (isFutureIntent) {
    return {
      intent: "WORKOUT_QUESTION",
      confidence: "medium",
      reason: "User expressed future workout plan, not past completed workout"
    };
  }

  // Explicit command to log workout
  if (hasExplicitLogCommand && (matchedKeyword || durationMinutes)) {
    return {
      intent: "WORKOUT_LOG",
      confidence: "high",
      reason: "User gave explicit command to log a workout",
      extractedDetails: { durationMinutes, activityName: matchedKeyword }
    };
  }

  // Completed workout with duration or specific activity
  if (hasCompletionSignal && matchedKeyword && durationMinutes) {
    return {
      intent: "WORKOUT_LOG",
      confidence: "high",
      reason: "User reported a completed workout with duration",
      extractedDetails: { durationMinutes, activityName: matchedKeyword }
    };
  }

  if (hasCompletionSignal && matchedKeyword) {
    return {
      intent: "WORKOUT_LOG",
      confidence: "medium",
      reason: "User reported a completed workout activity",
      extractedDetails: { activityName: matchedKeyword }
    };
  }

  // Vague workout mention without duration or activity:
  // e.g. "Saya baru latihan", "Saya baru olahraga"
  if (hasCompletionSignal && sanitized.match(/\b(?:latihan|olahraga|workout)\b/i) && !matchedKeyword && !durationMinutes) {
    return {
      intent: "VAGUE_WORKOUT_NEEDS_CLARIFICATION",
      confidence: "medium",
      reason: "User indicated working out but provided no activity or duration details"
    };
  }
  // ── 6. MEAL CORRECTION & LOGGING ──────────────────────────────────────────
  // Check for MEAL_CORRECTION first if recent meal exists or text has correction indicators
  const correctionDetails = parseMealCorrectionDetails(rawText);
  if (correctionDetails && (context.hasRecentMeal || lower.match(/^(?:koreksi|ralat|revisi|ganti\s+makanan|bukan\s+|itu\s+cumi)/i))) {
    return {
      intent: "MEAL_CORRECTION",
      confidence: "high",
      reason: `User requested meal correction (${correctionDetails.subtype}: ${correctionDetails.action})`,
      extractedDetails: {
        mealCorrection: correctionDetails
      }
    };
  }

  // ── 7. NUTRITION QUESTION ─────────────────────────────────────────────────
  // Examples: "berapa protein ayam?", "kalori telur berapa", "berapa gram protein tempe"
  const isNutritionQuestion =
    Boolean(lower.match(/\b(?:kalori|protein|karbo|lemak|gula|natrium|nutrisi|makanan|serat)\b/i) &&
            lower.match(/\b(?:apa|berapa|bagaimana|gimana|berapaan|bisa|kah|\?)\b/i)) ||
    Boolean(lower.match(/^(?:berapa\s+(?:kalori|protein|karbo|lemak|gula|natrium)|berapaan\s+(?:kalori|protein))\b/i)) ||
    Boolean(lower.match(/\b(?:rekomendasi|saran)\s+(?:makanan|menu|makan)\b/i));

  if (isNutritionQuestion) {
    return {
      intent: "NUTRITION_QUESTION",
      confidence: "high",
      reason: "User is asking for nutritional advice or food recommendations"
    };
  }

  // ── 8. MEAL LOGGING ───────────────────────────────────────────────────────
  // e.g. "Tadi saya makan nasi ayam", "Makan siang ayam geprek", sends food image
  const isNonFoodVisualQuery = isEquipmentInquirySignal || isExercisePostureSignal ||
    Boolean(lower.match(/\b(?:alat|mesin|dumbbell|barbell|treadmill|kettlebell|bench|kabel|sepeda|matras|gerakan|postur|form)\b/i));

  const hasMealSignal =
    (context.hasImage && !isNonFoodVisualQuery) ||
    Boolean(lower.match(/\b(?:tadi\s+)?(?:saya|aku)?\s*(?:makan|sarapan|lunch|dinner|nyemil|minum)\s+[a-z0-9]/i)) ||
    Boolean(lower.match(/\b(?:catat|rekap|log)\s+(?:makanan|menu|makan)\b/i));

  if (hasMealSignal) {
    return {
      intent: "MEAL_LOG",
      confidence: context.hasImage ? "high" : "medium",
      reason: "User reported food intake or provided food photo"
    };
  }

  // ── 9. GENERAL CHIT-CHAT FALLBACK ─────────────────────────────────────────
  const isGeneralGreeting = Boolean(
    lower.match(/^(?:halo|hai|hello|hi|pagi|selamat\s+pagi|siang|selamat\s+siang|malam|selamat\s+malam|tes|test|ping|assalamualaikum|oy|woi)\b/i)
  );

  if (isGeneralGreeting) {
    return {
      intent: "GREETING",
      confidence: "high",
      reason: "User is initiating standard conversational greeting"
    };
  }

  return {
    intent: "UNKNOWN",
    confidence: "low",
    reason: "General conversation or open query"
  };
}

// ============================================================================
// HUMAN BEHAVIOR INTELLIGENCE HELPER DETECTORS
// ============================================================================

/**
 * Detects compound user messages combining meal logging and recommendation requests.
 * E.g. "tadi aku makan nasi padang, catat ya, terus kasih rekomendasi makan malam yang rendah kalori dan tanpa ayam"
 */
export interface MultiIntentResult {
  isMultiIntent: boolean;
  intents: Array<{ type: "LOG_MEAL" | "RECOMMENDATION" | "WATER_LOG"; text: string }>;
  logPart?: string;
  recPart?: string;
}

export function detectMultiIntent(text: string): MultiIntentResult {
  if (!text) return { isMultiIntent: false, intents: [] };
  const lower = text.toLowerCase();
  const splitMatch = lower.match(/(.+?)(?:,\s*(?:lalu|terus|dan\s+terus|kemudian|sekalian|nanti)?\s+|\s+(?:lalu|terus|kemudian|sekalian)\s+)(.+)/i);
  if (splitMatch) {
    const part1 = splitMatch[1].trim();
    const part2 = splitMatch[2].trim();
    const isPart1Log = Boolean(part1.match(/\b(?:tadi\s+)?(?:aku|saya)?\s*(?:udah\s+)?makan\b/i) || part1.match(/\bcatat\b/i));
    const isPart2Rec = Boolean(part2.match(/\b(?:rekomendasi|saran|pilihan)\b/i) || part2.match(/\bmakan\s+(?:malam|siang|pagi)\s+apa\b/i));

    if (isPart1Log && isPart2Rec) {
      return {
        isMultiIntent: true,
        intents: [
          { type: "LOG_MEAL", text: part1 },
          { type: "RECOMMENDATION", text: part2 }
        ],
        logPart: part1,
        recPart: part2
      };
    }
  }
  return { isMultiIntent: false, intents: [] };
}

/**
 * Detects user rejection of a food recommendation.
 * E.g. "aku gak suka ikan", "nggak mau ayam", "bukan itu", "skip", "ganti yang lain"
 */
export function detectRecommendationRejection(text: string): { isRejection: boolean; rejectedItem?: string; isPersistent?: boolean } {
  if (!text) return { isRejection: false };
  const lower = text.toLowerCase().trim();

  // 1. Explicit item rejection: "aku gak suka X", "gak mau X", "jangan X", "benci X"
  const itemMatch = lower.match(/(?:aku\s+)?(?:gak|nggak|tidak)\s+suka\s+([a-zA-Z\s]+)/i) ||
                    lower.match(/(?:aku\s+)?(?:gak|nggak|tidak)\s+mau\s+([a-zA-Z\s]+)/i) ||
                    lower.match(/(?:aku\s+)?(?:gak\s+doyan|benci)\s+([a-zA-Z\s]+)/i) ||
                    lower.match(/^jangan\s+(?:kasih\s+)?([a-zA-Z\s]+)/i);

  if (itemMatch) {
    let item = itemMatch[1].replace(/nya$/, "").replace(/\s+(?:aja|dong|deh|ya)$/i, "").trim();
    if (item && !["itu", "yang itu", "tadi", "yang tadi"].includes(item)) {
      const isPersistent = lower.includes("suka") || lower.includes("doyan") || lower.includes("benci");
      return { isRejection: true, rejectedItem: item, isPersistent };
    }
    return { isRejection: true, rejectedItem: undefined };
  }

  // 2. General rejection: "bukan itu", "skip", "ganti yang lain", "yang lain dong", "nggak mau"
  if (/^(?:bukan\s+(?:yang\s+)?itu|skip|ganti\s+(?:yang\s+)?lain|yang\s+lain\s+dong|nggak\s+mau|gak\s+mau|jangan\s+yang\s+itu|menu\s+lain\s+dong|bosan)[.!]?$/i.test(lower)) {
    return { isRejection: true, rejectedItem: undefined };
  }

  return { isRejection: false };
}

/**
 * Parses explicit preference statements distinguishing persistent dislike,
 * temporary preference (today), temporal override (tomorrow / tonight),
 * and persistent preference changes.
 */
export function parsePreferenceInstruction(rawText: string): PreferenceInstructionResult | null {
  if (!rawText) return null;
  const lower = rawText.toLowerCase().trim();

  // 1. Persistent Change e.g. "Mulai sekarang aku gak masalah makan ikan", "aku sekarang udah suka ikan"
  const changeMatch = lower.match(/mulai\s+sekarang\s+(?:aku\s+)?(?:gak\s+masalah|bisa|boleh|mau|suka)\s+(?:makan\s+)?([a-zA-Z\s]+)/i) ||
                      lower.match(/(?:aku\s+)?(?:sekarang\s+)?udah\s+(?:suka|mau\s+makan|gak\s+masalah\s+makan)\s+([a-zA-Z\s]+)/i);
  if (changeMatch) {
    const val = changeMatch[1].replace(/nya$/, "").replace(/\s+(?:lagi|deh|ya)$/i, "").trim();
    if (val && !["makan", "menu"].includes(val)) {
      return {
        type: "PERSISTENT_CHANGE",
        value: val,
        action: "remove_disliked"
      };
    }
  }

  // 2. Meal-specific Temporal Override e.g. "Makan malam ini aku mau ikan", "malam ini pengen ikan"
  const mealSpecificMatch = lower.match(/(?:makan\s+malam(?:\s+ini)?|malam\s+ini|dinner)\s+(?:aku\s+)?(?:mau|pengen|ingin|boleh)?\s*(?:makan\s+)?([a-zA-Z\s]+)/i) ||
                            lower.match(/(?:sarapan(?:\s+ini)?|pagi\s+ini|breakfast)\s+(?:aku\s+)?(?:mau|pengen|ingin|boleh)?\s*(?:makan\s+)?([a-zA-Z\s]+)/i) ||
                            lower.match(/(?:makan\s+siang(?:\s+ini)?|siang\s+ini|lunch)\s+(?:aku\s+)?(?:mau|pengen|ingin|boleh)?\s*(?:makan\s+)?([a-zA-Z\s]+)/i);
  if (mealSpecificMatch) {
    let cat: "sarapan" | "siang" | "malam" | "snack" = "malam";
    if (lower.includes("sarapan") || lower.includes("pagi") || lower.includes("breakfast")) cat = "sarapan";
    else if (lower.includes("siang") || lower.includes("lunch")) cat = "siang";
    const val = mealSpecificMatch[1].replace(/nya$/, "").replace(/\s+(?:aja|dong|deh|ya)$/i, "").trim();
    if (val && !["makan", "menu"].includes(val)) {
      return {
        type: "TEMPORAL_OVERRIDE",
        value: val,
        scope: "tonight_only",
        category: cat,
        action: "add_override"
      };
    }
  }

  // 3. Tomorrow Temporal Override e.g. "Besok aku mau makan ikan", "besok pengen udang"
  const tomorrowMatch = lower.match(/besok\s+(?:aku\s+)?(?:mau|pengen|ingin|boleh)?\s*(?:makan\s+)?([a-zA-Z\s]+)/i);
  if (tomorrowMatch) {
    const val = tomorrowMatch[1].replace(/nya$/, "").replace(/\s+(?:aja|dong|deh|ya)$/i, "").trim();
    if (val && !["makan", "menu"].includes(val)) {
      return {
        type: "TEMPORAL_OVERRIDE",
        value: val,
        scope: "tomorrow_only",
        action: "add_override"
      };
    }
  }

  // 4. Temporary Preference Today e.g. "Hari ini aku gak mau ayam", "hari ini jangan ayam", "lagi gak pengen ayam hari ini"
  const tempMatch = lower.match(/(?:hari\s+ini\s+(?:aku\s+)?(?:gak\s+mau|jangan|gak\s+pengen|lagi\s+gak\s+mood)|(?:lagi\s+)?gak\s+pengen\s+([a-zA-Z\s]+?)\s+hari\s+ini)\s*([a-zA-Z\s]+)?/i);
  if (tempMatch) {
    const rawVal = tempMatch[2] || tempMatch[1];
    const val = (rawVal || "").replace(/nya$/, "").replace(/\s+(?:dulu|aja|deh|ya)$/i, "").trim();
    if (val && !["makan", "menu"].includes(val)) {
      return {
        type: "TEMPORARY_PREFERENCE",
        value: val,
        scope: "today",
        action: "add_temporary"
      };
    }
  }

  // 5. Persistent Dislike e.g. "Aku gak suka ikan", "nggak suka ikan", "benci ikan", "gak makan babi"
  const dislikeMatch = lower.match(/(?:aku\s+)?(?:gak|nggak|tidak)\s+(?:suka|doyan|makan)\s+([a-zA-Z\s]+)/i) ||
                       lower.match(/(?:aku\s+)?(?:benci|hindari)\s+([a-zA-Z\s]+)/i);
  if (dislikeMatch) {
    const val = dislikeMatch[1].replace(/nya$/, "").replace(/\s+(?:lagi|deh|ya)$/i, "").trim();
    if (val && !["makan", "menu", "itu", "yang itu"].includes(val)) {
      return {
        type: "PERSISTENT_DISLIKE",
        value: val,
        action: "add_disliked"
      };
    }
  }

  return null;
}

/**
 * Detects requests to adapt an existing workout plan for duration, fatigue, or discomfort.
 * Never converts to HIIT automatically or assumes intensity changes from duration alone.
 */
export function detectWorkoutAdaptation(text: string): WorkoutAdaptationDetails | null {
  if (!text) return null;
  const lower = text.toLowerCase().trim();

  // Duration match e.g. "cuma punya waktu 15 menit", "hari ini 15 menit", "cuma bisa 20 menit"
  const durMatch = lower.match(/(?:cuma|hanya|punya\s+waktu|bisa|waktuku|durasi)?\s*(\d{1,3})\s*(?:menit|mins|min)\b/i);
  const targetMinutes = durMatch ? parseInt(durMatch[1], 10) : undefined;

  // Fatigue match e.g. "lagi capek", "capek banget", "lemas", "lelah", "mager", "kurang tenaga", "recovery"
  const isFatigued = Boolean(lower.match(/\b(?:lagi\s+)?(?:capek|lelah|lemas|pegal|letih|kurang\s+tenaga|mager|pemulihan|recovery)\b/i));

  // High intensity match e.g. "pengen yang berat", "yang keras", "yang intens"
  const isIntense = Boolean(lower.match(/\b(?:pengen|mau|buat)\s+(?:yang\s+)?(?:berat|keras|intens|hard)\b/i));

  // Discomfort match e.g. "lututku lagi gak enak", "lutut sakit", "lutut nyeri", "cedera lutut", "gak bisa squat"
  const discomfortMatch = lower.match(/\b(lutut|knee|pinggang|bahu|engkel|sendi|punggung)\s*(?:ku|mu|nya)?\s*(?:lagi\s+)?(?:gak\s+enak|sakit|nyeri|linu|pegal|cedera)\b/i) ||
                          lower.match(/\b(?:gak\s+bisa|tidak\s+bisa)\s+(?:squat|lompat|jump)\b/i);
  let discomfortSignal: string | undefined = undefined;
  if (discomfortMatch) {
    const raw = (discomfortMatch[1] || "lutut").toLowerCase();
    discomfortSignal = (raw === "lutut" || raw === "knee") ? "knee" : raw;
  }

  // Equipment match e.g. "di rumah", "tanpa alat", "gak bisa ke gym"
  const equipMatch = lower.match(/\b(?:di\s+rumah|tanpa\s+alat|gak\s+bisa\s+ke\s+gym|bodyweight)\b/i);
  const equipmentConstraint = equipMatch ? equipMatch[0].toLowerCase() : undefined;

  if (targetMinutes || isFatigued || isIntense || discomfortSignal || equipmentConstraint) {
    return {
      isAdaptation: true,
      targetMinutes,
      targetDurationMinutes: targetMinutes,
      effortSignal: isFatigued ? "fatigued" : (isIntense ? "intense" : "normal"),
      isFatigued,
      discomfortSignal,
      discomfortArea: discomfortSignal,
      equipmentConstraint
    };
  }

  return null;
}

/**
 * Classifies response complexity model to ensure formatting matches user intent:
 * SIMPLE_ACTION: 1-line concise confirmation, zero dashboard dumping.
 * CORRECTION: Acknowledge + show only affected values.
 * RECOMMENDATION: Structured vertical card.
 * MULTI_INTENT: Clearly demarcated sequential actions.
 */
export function classifyResponseComplexity(
  intent: UserIntentType,
  text: string,
  context?: any
): ResponseComplexityType {
  if ((intent as string) === "SIMPLE_ACTION" || intent === "HYDRATION_LOG" || intent === "WEIGHT_LOG") {
    return "SIMPLE_ACTION";
  }
  if (intent === "CONFIRMATION") {
    return "SIMPLE_CONFIRMATION";
  }
  if (intent === "MEAL_CORRECTION") {
    return "CORRECTION";
  }
  if (intent === "RECOMMENDATION_REJECTION" || intent === "RECOMMENDATION_REFERENCE_MODIFICATION") {
    return "RECOMMENDATION";
  }
  if (intent === "MULTI_INTENT") {
    return "MULTI_INTENT";
  }
  return "INFORMATIONAL";
}
