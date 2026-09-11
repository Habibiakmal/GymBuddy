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
  | "VAGUE_WORKOUT_NEEDS_CLARIFICATION"
  | "MEAL_LOG"
  | "MEAL_CORRECTION"
  | "MEAL_DELETE"
  | "WEIGHT_LOG"
  | "BODY_MEASUREMENT_LOG"
  | "GOAL_UPDATE"
  | "PROFILE_UPDATE"
  | "NUTRITION_QUESTION"
  | "HYDRATION_LOG"
  | "CANCEL"
  | "CONFIRMATION"
  | "UNKNOWN";

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
  confidence: "high" | "medium" | "low";
  reason: string;
  extractedDetails?: {
    durationMinutes?: number;
    activityName?: string;
    weightKg?: number;
    mealDescription?: string;
    mealCorrection?: MealCorrectionDetails;
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
  // "nasinya cuma 100 gram", "nasinya cuma setengah", "cuminya sekitar 150 gram"
  const portMatch = stripped.match(/^([a-zA-Z0-9\s]+?)(?:nya)?\s*(?:tadi\s*)?(?:cuma|hanya|sekitar|sebanyak|jadi)?\s*(\d+(?:[.,]\d+)?\s*(?:g|gr|gram)|setengah(?:nya)?|separuh|seperempat|tiga\s*perempat|1\/2|1\/4|3\/4)[.]?$/i);
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
  // e.g. "Tadi saya makan nasi ayam", "Makan siang ayam geprek", sends image
  const hasMealSignal =
    context.hasImage ||
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
