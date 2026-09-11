/**
 * Conversation State & Active Task Manager for GymBuddy AI WhatsApp Interface.
 * 
 * Separates persistent user memory (profile, goals, history) from temporary,
 * interruptible conversational task state (e.g., pending meal correction).
 */

import { UserIntentType } from "./intentClassifier";

export interface ActiveConversationTask {
  type: "MEAL_CORRECTION" | "MEAL_LOGGING" | "WORKOUT_LOGGING" | "NONE";
  targetId?: string; // ID of the meal or entity being acted upon
  pendingAction?: "WAITING_FOR_CORRECTION" | "WAITING_FOR_DURATION" | "NONE";
  targetItem?: string;
  createdAt: number;
  expiresAt: number; // TTL (e.g. 10 minutes)
  metadata?: Record<string, any>;
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

// Default Task TTL: 10 minutes
const DEFAULT_TASK_TTL_MS = 10 * 60 * 1000;

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
 * Clears all active tasks across all users (useful for testing).
 */
export function clearAllActiveTasks(): void {
  activeTasks.clear();
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
    case "NUTRITION_QUESTION":
    case "WORKOUT_QUESTION":
    case "WORKOUT_LOG":
    case "WEIGHT_LOG":
    case "MEAL_LOG":
    case "PROGRAM_QUESTION":
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
