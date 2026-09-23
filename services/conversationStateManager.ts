/**
 * Conversation State & Active Task Manager for GymBuddy AI WhatsApp Interface.
 * 
 * Separates persistent user memory (profile, goals, history) from temporary,
 * interruptible conversational task state (e.g., pending meal correction).
 */

import { UserIntentType } from "./intentClassifier";

export interface ActiveConversationTask {
  type: "MEAL_CORRECTION" | "MEAL_LOGGING" | "WORKOUT_LOGGING" | "EQUIPMENT_INQUIRY" | "NONE";
  targetId?: string; // ID of the meal or entity being acted upon
  pendingAction?: "WAITING_FOR_CORRECTION" | "WAITING_FOR_DURATION" | "NONE";
  targetItem?: string;
  createdAt: number;
  expiresAt: number; // TTL (e.g. 10 minutes)
  metadata?: Record<string, any>;
}

export interface RecentVisualContext {
  detectedEquipment?: string;
  equipmentCategory?: string;
  confidence?: "high" | "medium" | "low";
  suggestedExercises?: Array<{
    name: string;
    setsReps: string;
    targetMuscle: string;
    techniqueTip: string;
  }>;
  imageUrl?: string;
  imagePart?: any;
  timestamp: number;
  expiresAt: number;
}

export interface ConversationTurnLog {
  phone: string;
  userMessage: string;
  previousState: string;
  currentIntent: string;
  stateAction: "CLEAR_ACTIVE_TASK" | "CONTINUE_TASK" | "START_TASK" | "NO_CHANGE";
  databaseAction: "NONE" | "UPDATE_MEAL" | "ADD_MEAL" | "ADD_WORKOUT" | "UPDATE_WEIGHT";
  details?: string;
}

// In-memory active tasks keyed by normalized phone number
const activeTasks = new Map<string, ActiveConversationTask>();

// In-memory recent visual context keyed by normalized phone number
const recentVisualContexts = new Map<string, RecentVisualContext>();

// Default Task TTL: 10 minutes
const DEFAULT_TASK_TTL_MS = 10 * 60 * 1000;
// Default Visual Context TTL: 5 minutes
const DEFAULT_VISUAL_CONTEXT_TTL_MS = 5 * 60 * 1000;

/**
 * Retrieves the currently active conversation task for a user, if not expired.
 */
export function getActiveTask(phone: string): ActiveConversationTask | null {
  if (!phone) return null;
  const cleanPhone = phone.replace(/[^\d]/g, "");
  const task = activeTasks.get(cleanPhone);
  if (!task) return null;

  if (Date.now() > task.expiresAt) {
    activeTasks.delete(cleanPhone);
    return null;
  }

  return task;
}

/**
 * Sets or updates the active conversation task for a user.
 */
export function setActiveTask(
  phone: string,
  task: Omit<ActiveConversationTask, "createdAt" | "expiresAt">,
  ttlMs: number = DEFAULT_TASK_TTL_MS
): void {
  if (!phone) return;
  const cleanPhone = phone.replace(/[^\d]/g, "");
  const now = Date.now();
  activeTasks.set(cleanPhone, {
    ...task,
    createdAt: now,
    expiresAt: now + ttlMs
  });
}

/**
 * Explicitly clears the active conversation task for a user.
 */
export function clearActiveTask(phone: string, reason?: string): void {
  if (!phone) return;
  const cleanPhone = phone.replace(/[^\d]/g, "");
  if (activeTasks.has(cleanPhone)) {
    if (reason) {
      console.log(`[ConversationState] Cleared active task for ${cleanPhone}. Reason: ${reason}`);
    }
    activeTasks.delete(cleanPhone);
  }
}

/**
 * Retrieves recent visual context (e.g. uploaded equipment photo analysis) for a user.
 */
export function getRecentVisualContext(phone: string): RecentVisualContext | null {
  if (!phone) return null;
  const cleanPhone = phone.replace(/[^\d]/g, "");
  const ctx = recentVisualContexts.get(cleanPhone);
  if (!ctx) return null;

  if (Date.now() > ctx.expiresAt) {
    recentVisualContexts.delete(cleanPhone);
    return null;
  }

  return ctx;
}

/**
 * Sets recent visual context when a user uploads an equipment/exercise photo.
 */
export function setRecentVisualContext(
  phone: string,
  ctx: Omit<RecentVisualContext, "timestamp" | "expiresAt">,
  ttlMs: number = DEFAULT_VISUAL_CONTEXT_TTL_MS
): void {
  if (!phone) return;
  const cleanPhone = phone.replace(/[^\d]/g, "");
  const now = Date.now();
  recentVisualContexts.set(cleanPhone, {
    ...ctx,
    timestamp: now,
    expiresAt: now + ttlMs
  });
}

/**
 * Clears recent visual context for a user.
 */
export function clearRecentVisualContext(phone: string): void {
  if (!phone) return;
  const cleanPhone = phone.replace(/[^\d]/g, "");
  recentVisualContexts.delete(cleanPhone);
}

/**
 * Clears all active tasks across all users (useful for testing).
 */
export function clearAllActiveTasks(): void {
  activeTasks.clear();
  recentVisualContexts.clear();
  recentRecommendations.clear();
}

// ============================================================================
// RECENT RECOMMENDATION CONTEXT & TEMPORAL OVERRIDES
// ============================================================================

export type TemporalOverrideType =
  | "preference_override"
  | "ingredient_inclusion"
  | "ingredient_exclusion"
  | "food_preference"
  | "workout";

export interface TemporalOverride {
  type?: TemporalOverrideType | string;
  value: string;
  scope: "tomorrow_only" | "tonight_only" | "meal_specific" | "today" | "specific_date";
  category?: "sarapan" | "siang" | "malam" | "snack";
  dateStr?: string;
  createdAt: number;
  expiresAt: number;
}

export interface RecommendationComponent {
  name: string;
  portion?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface RecentRecommendationContext {
  type: "meal" | "workout";
  mealData?: {
    id?: string;
    name: string;
    category: "sarapan" | "siang" | "malam" | "snack";
    ingredients: string[];
    components?: RecommendationComponent[];
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    rationale?: string;
  };
  workoutData?: {
    title: string;
    targetMuscles: string[];
    durationMinutes: number;
    exercises: any[];
  };
  excludedIngredients: string[];         // temporary session exclusions
  temporalOverrides: TemporalOverride[]; // scoped temporal overrides
  timestamp: number;
  expiresAt: number;
}

// In-memory recent recommendation context keyed by normalized phone number
const recentRecommendations = new Map<string, RecentRecommendationContext>();
const DEFAULT_REC_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Retrieves the recent recommendation context for a user, if not expired.
 */
export function getRecentRecommendation(phone: string): RecentRecommendationContext | null {
  if (!phone) return null;
  const cleanPhone = phone.replace(/[^\d]/g, "");
  const ctx = recentRecommendations.get(cleanPhone);
  if (!ctx) return null;

  if (Date.now() > ctx.expiresAt) {
    recentRecommendations.delete(cleanPhone);
    return null;
  }

  return ctx;
}

/**
 * Sets recent recommendation context for a user.
 */
export function setRecentRecommendation(
  phone: string,
  ctx: Omit<RecentRecommendationContext, "timestamp" | "expiresAt">,
  ttlMs: number = DEFAULT_REC_TTL_MS
): void {
  if (!phone) return;
  const cleanPhone = phone.replace(/[^\d]/g, "");
  const now = Date.now();
  const existing = recentRecommendations.get(cleanPhone);

  recentRecommendations.set(cleanPhone, {
    ...ctx,
    excludedIngredients: ctx.excludedIngredients || existing?.excludedIngredients || [],
    temporalOverrides: ctx.temporalOverrides || existing?.temporalOverrides || [],
    timestamp: now,
    expiresAt: now + ttlMs
  });
}

/**
 * Adds a session-level temporary excluded ingredient for the user.
 */
export function addSessionExcludedIngredient(phone: string, ingredient: string): void {
  if (!phone || !ingredient) return;
  const cleanPhone = phone.replace(/[^\d]/g, "");
  const cleanItem = ingredient.trim().toLowerCase();
  const existing = getRecentRecommendation(cleanPhone);

  if (existing) {
    if (!existing.excludedIngredients.includes(cleanItem)) {
      existing.excludedIngredients.push(cleanItem);
    }
  } else {
    recentRecommendations.set(cleanPhone, {
      type: "meal",
      excludedIngredients: [cleanItem],
      temporalOverrides: [],
      timestamp: Date.now(),
      expiresAt: Date.now() + DEFAULT_REC_TTL_MS
    });
  }
}

/**
 * Adds a scoped temporal override for a preference.
 */
export function addTemporalOverride(phone: string, override: Omit<TemporalOverride, "createdAt" | "expiresAt">): void {
  if (!phone || !override.value) return;
  const cleanPhone = phone.replace(/[^\d]/g, "");
  const now = Date.now();
  const newOverride: TemporalOverride = {
    type: override.type || "preference_override",
    ...override,
    value: override.value.trim().toLowerCase(),
    createdAt: now,
    expiresAt: now + (24 * 60 * 60 * 1000) // 24 hours TTL for daily/temporal overrides
  };

  const existing = getRecentRecommendation(cleanPhone);
  if (existing) {
    existing.temporalOverrides = (existing.temporalOverrides || []).filter(o => Date.now() <= o.expiresAt);
    existing.temporalOverrides.push(newOverride);
  } else {
    recentRecommendations.set(cleanPhone, {
      type: "meal",
      excludedIngredients: [],
      temporalOverrides: [newOverride],
      timestamp: now,
      expiresAt: now + DEFAULT_REC_TTL_MS
    });
  }
}

/**
 * Retrieves valid matching temporal overrides for a given context and scope.
 */
export function getMatchingTemporalOverrides(
  phone: string,
  targetScope: "tomorrow_only" | "tonight_only" | "meal_specific" | "today" | "specific_date",
  category?: "sarapan" | "siang" | "malam" | "snack",
  dateStr?: string
): TemporalOverride[] {
  const ctx = getRecentRecommendation(phone);
  if (!ctx || !ctx.temporalOverrides) return [];

  const now = Date.now();
  return ctx.temporalOverrides.filter(o => {
    if (now > o.expiresAt) return false;
    if (o.scope === targetScope) {
      if (category && o.category && o.category !== category) return false;
      if (dateStr && o.dateStr && o.dateStr !== dateStr) return false;
      return true;
    }
    return false;
  });
}

/**
 * Clears recent recommendation context for a user.
 */
export function clearRecentRecommendation(phone: string): void {
  if (!phone) return;
  const cleanPhone = phone.replace(/[^\d]/g, "");
  recentRecommendations.delete(cleanPhone);
}

export interface ReferenceResolutionResult {
  isResolved: boolean;
  isAmbiguous: boolean;
  target?: string;
  matchedComponent?: RecommendationComponent;
  candidates?: string[];
  action?: "replace" | "remove" | "add" | "recall";
  replacement?: string;
  clarificationPrompt?: string;
}

/**
 * Resolves conversational references such as "yang tadi", "yang ayamnya", "hapus nasinya",
 * "tambahin buah", "ganti yang itu" against the most recent recommendation.
 * 
 * Follows the strict rule:
 * - Exactly one plausible target -> resolve automatically.
 * - Multiple plausible targets -> mark isAmbiguous: true with candidates list (ask concise clarification).
 * - Zero matches -> isResolved: false.
 */
export function resolveRecommendationReference(
  phone: string,
  userText: string
): ReferenceResolutionResult {
  const ctx = getRecentRecommendation(phone);
  if (!ctx || !ctx.mealData) {
    return { isResolved: false, isAmbiguous: false };
  }

  const meal = ctx.mealData;
  const lower = userText.toLowerCase().trim();
  const components = meal.components || (meal.ingredients || []).map(ing => ({
    name: ing,
    portion: "1 porsi",
    calories: Math.round(meal.calories / Math.max(1, meal.ingredients.length)),
    protein: Math.round(meal.protein / Math.max(1, meal.ingredients.length)),
    carbs: Math.round(meal.carbs / Math.max(1, meal.ingredients.length)),
    fat: Math.round(meal.fat / Math.max(1, meal.ingredients.length))
  }));

  // 1. Recall "yang tadi" / "yang tadi aja" / "seperti tadi" / "yang itu" (affirmation of recent entity)
  if (/^(?:yang\s+tadi(?:\s+aja)?|pilihan\s+yang\s+tadi|menu\s+yang\s+tadi|seperti\s+(?:yang\s+)?sebelumnya|yang\s+itu(?:\s+aja)?|itu\s+aja)$/i.test(lower)) {
    return {
      isResolved: true,
      isAmbiguous: false,
      action: "recall",
      target: meal.name
    };
  }

  // 2. "ganti yang tadi" / "ganti menu yang tadi" / "ubah yang tadi"
  if (/^(?:ganti|ubah|tukar)\s+(?:yang\s+tadi|menu\s+yang\s+tadi|pilihan\s+yang\s+tadi)(?:\s+(?:dong|deh|ya|aja))?$/i.test(lower)) {
    return {
      isResolved: true,
      isAmbiguous: false,
      action: "replace",
      target: meal.name
    };
  }

  // 3. Specific component reference by itself e.g. "yang ayamnya", "bagian ayamnya"
  const compRefMatch = lower.match(/^(?:yang|bagian)?\s*([a-zA-Z\s]+?)(?:nya)?$/i);
  if (compRefMatch) {
    const rawWord = compRefMatch[1].trim().toLowerCase();
    if (!["tadi", "itu", "ini", "dong", "deh", "ya", "aja", "mau", "oke", "siap"].includes(rawWord)) {
      const matching = components.filter(c => c.name.toLowerCase().includes(rawWord));
      if (matching.length === 1) {
        return {
          isResolved: true,
          isAmbiguous: false,
          target: matching[0].name,
          matchedComponent: matching[0]
        };
      } else if (matching.length > 1) {
        return {
          isResolved: false,
          isAmbiguous: true,
          candidates: matching.map(c => c.name),
          clarificationPrompt: `Mau yang ${matching.map(c => c.name).join(" atau ")}?`
        };
      }
    }
  }

  // 4. Remove component e.g. "hapus nasinya", "tanpa nasi", "jangan pakai nasi"
  const removeMatch = lower.match(/(?:hapus|hilangkan|tanpa|jangan\s+pakai|buang)\s+([a-zA-Z\s]+)/i);
  if (removeMatch) {
    const rawTarget = removeMatch[1].replace(/nya$/, "").trim().toLowerCase();
    const matching = components.filter(c => c.name.toLowerCase().includes(rawTarget));
    if (matching.length === 1) {
      return {
        isResolved: true,
        isAmbiguous: false,
        action: "remove",
        target: matching[0].name,
        matchedComponent: matching[0]
      };
    } else if (matching.length > 1) {
      return {
        isResolved: false,
        isAmbiguous: true,
        candidates: matching.map(c => c.name),
        action: "remove",
        clarificationPrompt: `Mau hapus bagian ${matching.map(c => c.name).join(" atau ")}?`
      };
    }
  }

  // 5. Add component e.g. "tambahin buah", "tambah telur", "ekstra sayur"
  const addMatch = lower.match(/(?:tambah(?:in)?|ekstra|tambahkan|plus)\s+([a-zA-Z\s]+)/i);
  if (addMatch) {
    const addTarget = addMatch[1].replace(/nya$/, "").trim();
    return {
      isResolved: true,
      isAmbiguous: false,
      action: "add",
      replacement: addTarget
    };
  }

  // 6. Component replacement e.g. "ganti ayamnya jadi tahu", "yang ayamnya ganti tahu", "ayamnya ganti"
  const replaceMatch = lower.match(/(?:ganti\s+([a-zA-Z\s]+?)\s+(?:jadi|ke|dengan)\s+([a-zA-Z\s]+)|(?:yang\s+)?([a-zA-Z\s]+?)(?:nya)?\s+ganti(?:\s+(?:jadi|ke|dengan)\s+([a-zA-Z\s]+))?)/i);
  if (replaceMatch) {
    const targetWord = (replaceMatch[1] || replaceMatch[3] || "").replace(/nya$/, "").replace(/^yang\s+/, "").trim().toLowerCase();
    const replWord = (replaceMatch[2] || replaceMatch[4] || "").trim();

    // Check if targetWord is ambiguous like "itu" or "yang itu"
    if (targetWord === "itu" || targetWord === "yang itu" || targetWord === "tadi" || targetWord === "yang tadi") {
      if (components.length > 1) {
        return {
          isResolved: false,
          isAmbiguous: true,
          candidates: components.map(c => c.name),
          action: "replace",
          replacement: replWord || undefined,
          clarificationPrompt: `Mau ganti bagian ${components.map(c => c.name).join(", ")}?`
        };
      } else if (components.length === 1) {
        return {
          isResolved: true,
          isAmbiguous: false,
          action: "replace",
          target: components[0].name,
          matchedComponent: components[0],
          replacement: replWord || undefined
        };
      }
    }

    const matching = components.filter(c => c.name.toLowerCase().includes(targetWord));
    if (matching.length === 1) {
      return {
        isResolved: true,
        isAmbiguous: false,
        action: "replace",
        target: matching[0].name,
        matchedComponent: matching[0],
        replacement: replWord || undefined
      };
    } else if (matching.length > 1) {
      return {
        isResolved: false,
        isAmbiguous: true,
        candidates: matching.map(c => c.name),
        action: "replace",
        replacement: replWord || undefined,
        clarificationPrompt: `Mau ganti bagian ${matching.map(c => c.name).join(" atau ")}?`
      };
    }
  }

  // 7. Ambiguous "ganti yang itu" or "bukan yang itu" without target
  if (/^(?:ganti\s+(?:yang\s+)?itu|bukan\s+(?:yang\s+)?itu|ganti\s+dong)$/i.test(lower)) {
    if (components.length > 1) {
      return {
        isResolved: false,
        isAmbiguous: true,
        candidates: components.map(c => c.name),
        action: "replace",
        clarificationPrompt: `Mau ganti bagian ${components.map(c => c.name).join(", ")}?`
      };
    }
  }

  return { isResolved: false, isAmbiguous: false };
}

/**
 * Modifies an active recommendation's components in-place (replace, remove, add)
 * and recalculates the updated nutrition values.
 */
export function modifyActiveRecommendation(
  phone: string,
  resolution: ReferenceResolutionResult
): RecentRecommendationContext | null {
  const ctx = getRecentRecommendation(phone);
  if (!ctx || !ctx.mealData) return null;

  const meal = ctx.mealData;
  let components: RecommendationComponent[] = meal.components || (meal.ingredients || []).map(ing => ({
    name: ing,
    portion: "1 porsi",
    calories: Math.round(meal.calories / Math.max(1, meal.ingredients.length)),
    protein: Math.round(meal.protein / Math.max(1, meal.ingredients.length)),
    carbs: Math.round(meal.carbs / Math.max(1, meal.ingredients.length)),
    fat: Math.round(meal.fat / Math.max(1, meal.ingredients.length))
  }));

  if (resolution.action === "remove" && resolution.target) {
    components = components.filter(c => c.name !== resolution.target && !c.name.toLowerCase().includes(resolution.target!.toLowerCase()));
  } else if (resolution.action === "replace" && resolution.target && resolution.replacement) {
    const replName = resolution.replacement.charAt(0).toUpperCase() + resolution.replacement.slice(1);
    // Approximate nutrition substitution
    let replCal = 120, replProt = 14, replCarbs = 4, replFat = 5;
    const lowerRepl = replName.toLowerCase();
    if (lowerRepl.includes("tahu") || lowerRepl.includes("tofu")) {
      replCal = 110; replProt = 12; replCarbs = 3; replFat = 6;
    } else if (lowerRepl.includes("tempe")) {
      replCal = 160; replProt = 16; replCarbs = 9; replFat = 8;
    } else if (lowerRepl.includes("telur")) {
      replCal = 95; replProt = 8; replCarbs = 1; replFat = 7;
    } else if (lowerRepl.includes("dada ayam") || lowerRepl.includes("ayam")) {
      replCal = 165; replProt = 31; replCarbs = 0; replFat = 3.6;
    } else if (lowerRepl.includes("sapi")) {
      replCal = 180; replProt = 24; replCarbs = 0; replFat = 9;
    }

    components = components.map(c => {
      if (c.name === resolution.target || c.name.toLowerCase().includes(resolution.target!.toLowerCase())) {
        return {
          name: replName,
          portion: "1 porsi",
          calories: replCal,
          protein: replProt,
          carbs: replCarbs,
          fat: replFat
        };
      }
      return c;
    });
  } else if (resolution.action === "add" && resolution.replacement) {
    const addName = resolution.replacement.charAt(0).toUpperCase() + resolution.replacement.slice(1);
    let addCal = 70, addProt = 2, addCarbs = 14, addFat = 0.5;
    const lowerAdd = addName.toLowerCase();
    if (lowerAdd.includes("buah") || lowerAdd.includes("pisang") || lowerAdd.includes("apel")) {
      addCal = 80; addProt = 1; addCarbs = 20; addFat = 0.2;
    } else if (lowerAdd.includes("sayur") || lowerAdd.includes("salad")) {
      addCal = 45; addProt = 2.5; addCarbs = 7; addFat = 0.5;
    } else if (lowerAdd.includes("telur")) {
      addCal = 95; addProt = 8; addCarbs = 1; addFat = 7;
    }
    components.push({
      name: addName,
      portion: "1 porsi",
      calories: addCal,
      protein: addProt,
      carbs: addCarbs,
      fat: addFat
    });
  }

  // Recalculate totals
  const totalCal = components.reduce((acc, c) => acc + c.calories, 0);
  const totalProt = Math.round(components.reduce((acc, c) => acc + c.protein, 0) * 10) / 10;
  const totalCarbs = Math.round(components.reduce((acc, c) => acc + c.carbs, 0) * 10) / 10;
  const totalFat = Math.round(components.reduce((acc, c) => acc + c.fat, 0) * 10) / 10;

  meal.components = components;
  meal.ingredients = components.map(c => c.name);
  meal.name = components.map(c => c.name).join(" + ");
  meal.calories = totalCal;
  meal.protein = totalProt;
  meal.carbs = totalCarbs;
  meal.fat = totalFat;

  ctx.timestamp = Date.now();
  setRecentRecommendation(phone, ctx);
  return ctx;
}

/**
 * Determines whether an incoming user intent should interrupt and clear
 * the current active task (e.g. greetings, new questions, workout logs).
 */
export function isTaskInterruptingIntent(intent: UserIntentType): boolean {
  switch (intent) {
    case "GREETING":
    case "ONBOARDING_GREETING":
    case "GENERAL_CONVERSATION":
    case "CANCEL":
    case "CONFIRMATION":
    case "NUTRITION_QUESTION":
    case "WORKOUT_QUESTION":
    case "WORKOUT_LOG":
    case "WEIGHT_LOG":
    case "MEAL_LOG":
    case "HYDRATION_LOG":
    case "PROGRAM_QUESTION":
    case "EQUIPMENT_INQUIRY":
    case "EXERCISE_POSTURE_INQUIRY":
      return true;
    default:
      return false;
  }
}

/**
 * Structured internal logger for conversation turns to trace state transitions
 * without exposing internal logs to end users.
 */
export function logConversationTurn(log: ConversationTurnLog): void {
  const border = "─".repeat(60);
  console.log(`\n[CONVERSATION TURN] ${border}`);
  console.log(`PHONE:           ${log.phone}`);
  console.log(`USER MESSAGE:    "${log.userMessage}"`);
  console.log(`PREVIOUS STATE:  ${log.previousState || "NONE"}`);
  console.log(`CURRENT INTENT:  ${log.currentIntent}`);
  console.log(`STATE ACTION:    ${log.stateAction}`);
  console.log(`DATABASE ACTION: ${log.databaseAction}`);
  if (log.details) {
    console.log(`DETAILS:         ${log.details}`);
  }
  console.log(`[END TURN] ${border}\n`);
}
