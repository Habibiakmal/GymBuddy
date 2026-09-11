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
  | "GENERAL_CONVERSATION"
  | "PROGRAM_QUESTION"
  | "WORKOUT_QUESTION"
  | "WORKOUT_LOG"
  | "VAGUE_WORKOUT_NEEDS_CLARIFICATION"
  | "MEAL_LOG"
  | "WEIGHT_LOG"
  | "BODY_MEASUREMENT_LOG"
  | "GOAL_UPDATE"
  | "PROFILE_UPDATE"
  | "NUTRITION_QUESTION"
  | "UNKNOWN";

export interface IntentClassificationResult {
  intent: UserIntentType;
  confidence: "high" | "medium" | "low";
  reason: string;
  extractedDetails?: {
    durationMinutes?: number;
    activityName?: string;
    weightKg?: number;
    mealDescription?: string;
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

  // ── 6. MEAL LOGGING ───────────────────────────────────────────────────────
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

  // ── 7. NUTRITION QUESTION ─────────────────────────────────────────────────
  const isNutritionQuestion =
    Boolean(lower.match(/\b(?:kalori|protein|karbo|lemak|gula|natrium|nutrisi|makanan)\s+(?:apa|berapa|bagaimana|gimana)\b/i)) ||
    Boolean(lower.match(/\b(?:rekomendasi|saran)\s+(?:makanan|menu|makan)\b/i));

  if (isNutritionQuestion) {
    return {
      intent: "NUTRITION_QUESTION",
      confidence: "high",
      reason: "User is asking for nutritional advice or food recommendations"
    };
  }

  // ── 8. GENERAL GREETINGS / CHIT-CHAT ─────────────────────────────────────
  const isGeneralGreeting = Boolean(
    lower.match(/^(?:halo|hai|hello|hi|pagi|selamat\s+pagi|siang|selamat\s+siang|malam|selamat\s+malam|tes|test|ping|assalamualaikum|oy|woi)\b/i)
  );

  if (isGeneralGreeting) {
    return {
      intent: "GENERAL_CONVERSATION",
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
