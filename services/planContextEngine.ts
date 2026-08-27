import { getValidatedUserAddressing, validateAndFormatCoachNote } from "./nutritionEngine";

export type PlanCapability = "nutrition" | "workout";

export interface UserPlanCapabilities {
  activePlan: "nutritionist" | "workout" | "both";
  canNutrition: boolean;
  canWorkout: boolean;
  planDisplayName: string;
}

export type InputCategory =
  | "GREETING_OR_CASUAL"
  | "NUTRITION"
  | "WORKOUT"
  | "AMBIGUOUS"
  | "MIXED"
  | "OUT_OF_CONTEXT";

export type PlanContextDecision =
  | "PROCESS_NUTRITION"
  | "PROCESS_WORKOUT"
  | "PROCESS_CASUAL"
  | "REDIRECT_UNSUPPORTED_WORKOUT"
  | "REDIRECT_UNSUPPORTED_NUTRITION"
  | "REDIRECT_OUT_OF_CONTEXT"
  | "CLARIFY_AMBIGUOUS";

export interface PlanValidationResult {
  decision: PlanContextDecision;
  inputCategory: InputCategory;
  canProceed: boolean;
  redirectMessage?: string;
  sanitizedUserText?: string;
}

/**
 * Normalizes the user's active subscription / service plan into capabilities.
 */
export function getUserPlanCapabilities(userData: any): UserPlanCapabilities {
  const rawService = String(
    userData?.activeService ||
    userData?.subscription?.activeService ||
    userData?.selectedFeature ||
    userData?.plan ||
    "both"
  ).toLowerCase().trim();

  if (rawService === "nutritionist" || rawService === "nutrition") {
    return {
      activePlan: "nutritionist",
      canNutrition: true,
      canWorkout: false,
      planDisplayName: "AI Nutritionist"
    };
  }

  if (rawService === "workout" || rawService === "coach") {
    return {
      activePlan: "workout",
      canNutrition: false,
      canWorkout: true,
      planDisplayName: "AI Workout Coach"
    };
  }

  return {
    activePlan: "both",
    canNutrition: true,
    canWorkout: true,
    planDisplayName: "All-Access Premium"
  };
}

/**
 * Regular expressions and patterns for classifying user messages.
 */
const CASUAL_GREETING_REGEX = /^(?:halo|hai|hey|hei|pagi|selamat\s+(?:pagi|siang|sore|malam)|assalamu['’]?alaikum|salam|terima\s*kasih|makasih|thanks|thank\s*you|ok|oke|siap|sip|baik|iya|yoi|yo|mantap|keren|paham|mengerti|nice|good)(?:\s+(?:coach|max|mia|min|gymbuddy|bro|kak))?[\s!.]*$/i;

const NUTRITION_KEYWORDS = [
  "makan", "sarapan", "lunch", "dinner", "minum", "kalori", "protein", "karbo",
  "lemak", "gula", "natrium", "sodium", "air putih", "nasi", "ayam", "telur",
  "daging", "ikan", "sayur", "buah", "susu", "kopi", "teh", "snack", "camilan",
  "boba", "mie", "roti", "keju", "porsi", "rekap nutrisi", "rekap makan", "cek kalori",
  "rekomendasi makanan", "menu diet", "resep", "kurang garam", "tinggi protein",
  "update bb", "berat badan", "timbang"
];

const WORKOUT_KEYWORDS = [
  "workout", "latihan", "olahraga", "gym", "angkat beban", "push up", "pull up",
  "sit up", "squat", "bench press", "deadlift", "dumbbell", "barbell", "treadmill",
  "lari", "running", "jogging", "joging", "sepeda", "cycling", "berenang", "swimming",
  "futsal", "basket", "badminton", "yoga", "pilates", "set", "sets", "reps",
  "repetisi", "jadwal workout", "jadwal latihan", "program latihan", "split",
  "alat gym", "cara pakai", "mesin latihan", "postur", "form latihan", "recovery",
  "kardio", "cardio", "stretching", "otot dada", "otot punggung", "otot kaki"
];

const AMBIGUOUS_KEYWORDS = [
  "capek", "capek banget", "lelah", "pegal", "pegel", "lemas", "lemes", "kurang fit",
  "drop", "kurang tenaga", "butuh tips", "bingung", "sakit badan"
];

const UNRELATED_OFFTOPIC_REGEX = /\b(?:cuaca|hujan|panas\s+hari\s+ini|presiden|politik|pemilu|menteri|partai|koding|coding|javascript|typescript|python|html|css|bug|syntax|error\s+code|film|movie|bioskop|netflix|sinopsis|lagu|chord|lirik|resep\s+racun|crypto|bitcoin|saham|investasi|trading|forex|jodoh|pacar|mantan|zodiak|ramalan|prancis|amerika|indonesia\s+merdeka|sejarah\s+dunia|matematika|rumus\s+excel)\b/i;

/**
 * Classifies an incoming message based on its semantic content and whether an image is attached.
 */
export function classifyUserInput(userText: string, hasImage: boolean): InputCategory {
  const trimmed = userText.trim();
  const lower = trimmed.toLowerCase();

  // If user sent a photo without text or with a simple photo caption, it is almost always Food or Equipment/Workout
  if (hasImage) {
    // If the text explicitly mentions workout equipment
    if (lower.includes("alat") || lower.includes("mesin") || lower.includes("gym")) {
      return "WORKOUT";
    }
    return "NUTRITION";
  }

  if (!trimmed) {
    return "GREETING_OR_CASUAL";
  }

  if (CASUAL_GREETING_REGEX.test(trimmed)) {
    return "GREETING_OR_CASUAL";
  }

  // Check for Ambiguous complaint of fatigue/energy
  const isAmbiguousOnly = AMBIGUOUS_KEYWORDS.some(k => lower.includes(k)) &&
    !NUTRITION_KEYWORDS.some(k => lower.includes(k)) &&
    !WORKOUT_KEYWORDS.some(k => lower.includes(k));

  if (isAmbiguousOnly && trimmed.split(/\s+/).length <= 6) {
    return "AMBIGUOUS";
  }

  const hasNutrition = NUTRITION_KEYWORDS.some(k => lower.includes(k));
  const hasWorkout = WORKOUT_KEYWORDS.some(k => lower.includes(k));
  const hasUnrelated = UNRELATED_OFFTOPIC_REGEX.test(lower);

  // Mixed message: Contains unrelated content BUT also contains clear nutrition or workout logging
  if (hasUnrelated && (hasNutrition || hasWorkout)) {
    return "MIXED";
  }

  if (hasUnrelated && !hasNutrition && !hasWorkout) {
    return "OUT_OF_CONTEXT";
  }

  if (hasNutrition && !hasWorkout) {
    return "NUTRITION";
  }

  if (hasWorkout && !hasNutrition) {
    return "WORKOUT";
  }

  if (hasNutrition && hasWorkout) {
    // If user text discusses both (e.g. "setelah lari tadi aku makan pisang")
    return "MIXED";
  }

  // Check general out-of-context queries (e.g. general knowledge, electronics, coding, etc.)
  if (
    /^(?:apa\s+itu|apaan\s+itu|apa\s+artinya|siapa|kapan|dimana|kenapa|mengapa|bagaimana\s+cara|jelaskan\s+tentang)\b/i.test(lower) ||
    /\b(?:laptop|komputer|gadget|handphone|hp|smartphone|mobil|motor|pesawat|coding|koding|javascript|typescript|python|html|css|bug|syntax|crypto|bitcoin|saham|politik|pemilu|presiden|menteri|sinopsis|lirik|chord)\b/i.test(lower)
  ) {
    if (!hasNutrition && !hasWorkout) {
      return "OUT_OF_CONTEXT";
    }
  }

  return "GREETING_OR_CASUAL";
}

/**
 * Validates user input against active plan capabilities and returns action + persona-aligned message if redirecting.
 */
export function validatePlanContext(
  userText: string,
  hasImage: boolean,
  userData: any
): PlanValidationResult {
  const capabilities = getUserPlanCapabilities(userData);
  const addressing = getValidatedUserAddressing(userData);
  const validatedAddr = addressing.validatedAddress;
  const isLansia = addressing.ageGroup === "Lansia";
  const isMax = (userData?.persona || "mia").toLowerCase() === "max";

  const category = classifyUserInput(userText, hasImage);

  // 1. CASUAL CONVERSATION (Always allowed regardless of plan)
  if (category === "GREETING_OR_CASUAL") {
    return {
      decision: "PROCESS_CASUAL",
      inputCategory: category,
      canProceed: true
    };
  }

  // 2. MIXED INPUT
  if (category === "MIXED") {
    // Determine which portion is supported by the active plan
    const lower = userText.toLowerCase();
    const hasNutrition = hasImage || NUTRITION_KEYWORDS.some(k => lower.includes(k));
    const hasWorkout = WORKOUT_KEYWORDS.some(k => lower.includes(k));

    if (capabilities.canNutrition && hasNutrition) {
      return {
        decision: "PROCESS_NUTRITION",
        inputCategory: "MIXED",
        canProceed: true
      };
    }

    if (capabilities.canWorkout && hasWorkout) {
      return {
        decision: "PROCESS_WORKOUT",
        inputCategory: "MIXED",
        canProceed: true
      };
    }

    // If user's plan supports neither of the detected parts:
    if (!capabilities.canNutrition && hasNutrition) {
      return buildUnsupportedRedirect("workout", isMax, isLansia, validatedAddr, userData);
    }
    if (!capabilities.canWorkout && hasWorkout) {
      return buildUnsupportedRedirect("nutrition", isMax, isLansia, validatedAddr, userData);
    }
  }

  // 3. AMBIGUOUS INPUT (e.g. "Aku capek banget")
  if (category === "AMBIGUOUS") {
    let clarifyMsg = "";
    if (capabilities.canWorkout && capabilities.canNutrition) {
      clarifyMsg = isMax
        ? (isLansia
            ? `Apakah rasa lelah ini setelah berolahraga atau karena aktivitas fisik harian, ${validatedAddr}? Ceritakan sedikit agar Saya dapat membantu meninjau pemulihan Anda. 💪`
            : `Capeknya setelah workout atau aktivitas tertentu, ${validatedAddr}? Ceritain sedikit, nanti gue bantu cek recovery atau asupan energi lo! 💪`)
        : (isLansia
            ? `Apakah Anda merasa lelah setelah beraktivitas atau berolahraga, ${validatedAddr}? Boleh ceritakan sedikit agar aku dapat membantu memeriksa asupan dan pemulihan Anda ✨`
            : `Capeknya setelah workout atau aktivitas tertentu, ${validatedAddr}? Ceritain sedikit ya, nanti aku bantu cek recovery dan istirahat kamu ✨`);
    } else if (capabilities.canWorkout) {
      clarifyMsg = isMax
        ? `Capeknya setelah sesi workout apa nih, ${validatedAddr}? Ceritain latihan lo hari ini biar gue bantu evaluasi pemulihan otot lo! 💪`
        : `Capeknya setelah workout atau latihan tertentu, ${validatedAddr}? Ceritakan sedikit ya, nanti aku bantu cek panduan recovery kamu ✨`;
    } else {
      // Nutrition only: Do NOT assume it is a workout request!
      clarifyMsg = isMax
        ? `Lagi kurang bertenaga ya, ${validatedAddr}? Coba cek apakah sudah cukup minum air dan makan teratur hari ini? Ceritain asupan lo biar gue cek energinya! 💪`
        : `Lagi merasa lelah atau kurang bertenaga ya, ${validatedAddr}? Apakah sudah cukup makan dan minum air putih hari ini? Ceritakan sedikit asupanmu hari ini ya ✨`;
    }

    return {
      decision: "CLARIFY_AMBIGUOUS",
      inputCategory: "AMBIGUOUS",
      canProceed: false,
      redirectMessage: validateAndFormatCoachNote(clarifyMsg, userData)
    };
  }

  // 4. OUT OF CONTEXT INPUT (Completely unrelated to fitness/nutrition)
  if (category === "OUT_OF_CONTEXT") {
    let redirectMsg = "";
    if (capabilities.canNutrition && capabilities.canWorkout) {
      redirectMsg = isMax
        ? (isLansia
            ? `Topik tersebut di luar bidang kesehatan dan kebugaran, ${validatedAddr}. Saya siap mendampingi Anda untuk pencatatan menu makan, nutrisi, hidrasi, maupun panduan latihan fisik harian Anda. 🌿`
            : `Sorry ya, ${validatedAddr}! Gue fokus bantu seputar nutrisi, makanan, dan latihan di GymBuddy. Kalau ada yang mau kamu tanyakan soal makanan, nutrisi, atau workout, gue siap bantu! 💪`)
        : (isLansia
            ? `Topik tersebut berada di luar ruang lingkup kesehatan dan nutrisi ya, ${validatedAddr} ✨ Aku siap membantu Anda untuk pencatatan makanan, cek kalori, maupun program latihan fisik yang aman. 🌿`
            : `Maaf ya 😊 Aku fokus membantu kamu seputar nutrisi, makanan, dan latihan di GymBuddy. Kalau ada yang ingin kamu tanyakan tentang makanan, nutrisi, atau workout, aku siap bantu.`);
    } else if (capabilities.canNutrition) {
      redirectMsg = isMax
        ? `Sorry ya, ${validatedAddr}! Gue fokus bantu seputar nutrisi dan makanan di GymBuddy. Kalau ada yang mau kamu tanyakan soal makanan atau nutrisi, gue siap bantu! 💪`
        : `Maaf ya 😊 Aku fokus membantu kamu seputar nutrisi dan makanan di GymBuddy. Kalau ada yang ingin kamu tanyakan tentang makanan atau nutrisi, aku siap bantu ✨`;
    } else {
      // Workout only
      redirectMsg = isMax
        ? `Sorry ya, ${validatedAddr}! Gue fokus mendampingi kamu seputar latihan dan workout di GymBuddy. Kalau ada yang mau kamu tanyakan soal latihan atau alat gym, gue siap bantu! 💪`
        : `Maaf ya 😊 Aku fokus mendampingi kamu seputar latihan dan workout di GymBuddy. Kalau ada yang ingin kamu tanyakan tentang olahraga atau jadwal workout, aku siap bantu 🏋️‍♀️✨`;
    }

    return {
      decision: "REDIRECT_OUT_OF_CONTEXT",
      inputCategory: "OUT_OF_CONTEXT",
      canProceed: false,
      redirectMessage: validateAndFormatCoachNote(redirectMsg, userData)
    };
  }

  // 5. NUTRITION REQUEST ON WORKOUT-ONLY PLAN
  if (category === "NUTRITION" && !capabilities.canNutrition) {
    return buildUnsupportedRedirect("workout", isMax, isLansia, validatedAddr, userData);
  }

  // 6. WORKOUT REQUEST ON NUTRITION-ONLY PLAN
  if (category === "WORKOUT" && !capabilities.canWorkout) {
    return buildUnsupportedRedirect("nutrition", isMax, isLansia, validatedAddr, userData);
  }

  // 7. SUPPORTED REQUESTS
  if (category === "NUTRITION") {
    return {
      decision: "PROCESS_NUTRITION",
      inputCategory: "NUTRITION",
      canProceed: true
    };
  }

  return {
    decision: "PROCESS_WORKOUT",
    inputCategory: "WORKOUT",
    canProceed: true
  };
}

/**
 * Builds friendly, respectful plan-aware redirect message when a user requests an unsupported capability.
 */
function buildUnsupportedRedirect(
  currentFocus: "nutrition" | "workout",
  isMax: boolean,
  isLansia: boolean,
  validatedAddr: string,
  userData: any
): PlanValidationResult {
  let msg = "";

  if (currentFocus === "nutrition") {
    // Active plan is Nutrition Only, user asked for Workout
    msg = isMax
      ? (isLansia
          ? `Untuk plan Anda saat ini, Saya berfokus mendampingi asupan nutrisi dan pola makan sehat, ${validatedAddr}. Anda dapat mengirimkan menu makanan, asupan air minum, atau konsultasi kebutuhan nutrisi harian Anda. Apabila Anda membutuhkan panduan latihan fisik, Anda dapat melakukan upgrade ke Paket Workout atau Premium ya. 🌿`
          : `Untuk plan kamu saat ini, fokus gue adalah mendampingi nutrisi dan manajemen kalori lo, ${validatedAddr}. Lo bisa kirim laporan makan, minuman, cek makro, atau target nutrisi lo ya. Kalau lo mau program latihan & panduan alat gym, lo bisa upgrade ke Paket Workout atau Premium! 💪`)
      : (isLansia
          ? `Untuk plan Anda saat ini, aku berfokus mendampingi pola makan dan nutrisi sehat ya, ${validatedAddr} ✨ Anda bisa berkonsultasi seputar makanan, hidrasi, atau target gizi harian. Jika membutuhkan panduan olahraga, Anda dapat beralih ke Paket Workout atau Premium 🌿`
          : `Untuk plan kamu saat ini, aku fokus bantu soal nutrisi ya, ${validatedAddr} ✨ Kamu bisa cerita tentang makanan, minuman, kalori, atau target nutrisi kamu. Kalau butuh panduan latihan dan jadwal workout, kamu bisa upgrade ke Paket Workout atau Premium ya! 🥦`);

    return {
      decision: "REDIRECT_UNSUPPORTED_WORKOUT",
      inputCategory: "WORKOUT",
      canProceed: false,
      redirectMessage: validateAndFormatCoachNote(msg, userData)
    };
  } else {
    // Active plan is Workout Only, user asked for Nutrition
    msg = isMax
      ? (isLansia
          ? `Untuk plan Anda saat ini, Saya berfokus mendampingi program latihan fisik dan kebugaran, ${validatedAddr}. Anda dapat menanyakan panduan gerakan, mencatat aktivitas fisik harian, atau konsultasi pemulihan aktif Anda. Untuk pencatatan nutrisi lengkap, Anda dapat beralih ke Paket Nutritionist atau Premium ya. 🌿`
          : `Untuk plan kamu saat ini, fokus gue adalah mendampingi jadwal workout, form latihan, dan progres fisik lo, ${validatedAddr}! Lo bisa lapor set latihan, tanya panduan alat gym, atau jadwal harian lo. Buat tracking kalori & nutrisi lengkap, lo bisa upgrade ke Paket Nutritionist atau Premium! 🔥`)
      : (isLansia
          ? `Untuk plan Anda saat ini, aku berfokus mendampingi latihan fisik dan kebugaran ya, ${validatedAddr} ✨ Anda dapat menanyakan gerakan, jadwal olahraga, atau teknik alat gym. Untuk pencatatan menu makanan dan kalori, Anda dapat mengaktifkan Paket Nutritionist atau Premium 🌿`
          : `Untuk plan kamu saat ini, aku fokus mendampingi program latihan dan teknik workout kamu ya, ${validatedAddr} ✨ Kamu bisa lapor hasil latihan, tanya gerakan, panduan alat gym, atau jadwal latihan harian. Untuk pencatatan kalori & nutrisi lengkap, kamu bisa upgrade ke Paket Nutritionist atau Premium ya! 🏋️‍♀️`);

    return {
      decision: "REDIRECT_UNSUPPORTED_NUTRITION",
      inputCategory: "NUTRITION",
      canProceed: false,
      redirectMessage: validateAndFormatCoachNote(msg, userData)
    };
  }
}
