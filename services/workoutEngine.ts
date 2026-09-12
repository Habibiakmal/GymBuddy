/**
 * GYMBUDDY SHARED WORKOUT ENGINE (v2.1)
 * 
 * Single source of truth for:
 * - Workout generation & structure
 * - Safety validation & injury constraints
 * - Duration validation & dynamic shortening
 * - Session state machine & persistence
 * - Contextual coach rationales ("Why this workout?")
 * - Guarded adaptive progression
 * 
 * Shared across Web, Mobile, WhatsApp, and Apple Watch.
 */

// ─── 1. DATA MODELS & INTERFACES ─────────────────────────────────────────────

export type WorkoutDuration = 15 | 30 | 45 | 60 | 90 | 120;
export type FitnessLevel = "beginner" | "intermediate" | "advanced";
export type WorkoutFrequency = "1-2" | "3-4" | "5+";
export type EquipmentType =
  | "none"
  | "dumbbells"
  | "barbell"
  | "resistance_bands"
  | "machines"
  | "full_gym"
  | "bodyweight"
  | "other";

export type BodyArea =
  | "shoulder"
  | "back"
  | "knee"
  | "hip"
  | "ankle"
  | "wrist"
  | "neck"
  | "other";

export type LimitationSeverity = "mild" | "moderate" | "severe";

export interface InjuryConstraint {
  bodyArea: BodyArea;
  severity: LimitationSeverity;
  avoidMovements?: string[]; // e.g. ["deep_squat", "overhead_press", "jumping"]
  painTriggers?: string[];   // e.g. ["axial_load", "high_impact", "wrist_extension"]
  notes?: string;
}

export interface WorkoutPreferences {
  workoutDuration: WorkoutDuration;
  workoutFrequency: WorkoutFrequency;
  fitnessLevel: FitnessLevel;
  equipment: EquipmentType;
  primaryGoal: "lose" | "gain" | "maintain" | "health" | "strength" | "endurance" | "mobility" | string;
  injuryLimitations?: InjuryConstraint[];
  persona?: "max" | "mia";
}

export interface WorkoutStructurePhase {
  name: string;
  durationMinutes: number;
  instructions?: string;
}

export interface ExerciseItemPlan {
  exerciseId: string;
  name: string;
  indonesianName?: string;
  targetMuscles: string[];
  equipment: string;
  targetSets: number;
  targetReps: string; // Clean normalized string: "3 Sets × 12 Reps", "3 Sets × 45 Secs", "15–20 min · Incline 8%"
  restSeconds: number;
  coachCue: { max: string; mia: string };
  priority: "essential" | "secondary" | "accessory" | "finisher";
  bodyArea: "upper_body" | "lower_body" | "core" | "full_body" | "cardio";
  movementPattern: "squat" | "hinge" | "lunge" | "push" | "pull" | "core" | "cardio" | "mobility";
  jointLoad: Partial<Record<BodyArea, "none" | "low" | "moderate" | "high">>;
  contraindications?: string[];
  modificationNote?: string;
  isModifiedForSafety?: boolean;
  gifUrl?: string;
  imageFrames?: string[];
}

export interface WorkoutPlan {
  id: string;
  date: string;
  dayName: string;
  goal: string;
  focus: string;
  targetDuration: number;
  estimatedDuration: number;
  intensity: "low" | "moderate" | "high";
  warmup: WorkoutStructurePhase[];
  mainExercises: ExerciseItemPlan[];
  cardio?: ExerciseItemPlan;
  cooldown: WorkoutStructurePhase[];
  totalSets: number;
  totalExercises: number;
  rationale: string;
  coachInsight: string;
  safetyNotes: string[];
}

export type WorkoutStateMachineState =
  | "SCHEDULED"
  | "READY"
  | "IN_PROGRESS"
  | "EXERCISE_ACTIVE"
  | "SET_ACTIVE"
  | "SET_COMPLETED"
  | "REST"
  | "NEXT_SET"
  | "NEXT_EXERCISE"
  | "WORKOUT_COMPLETED"
  | "PAUSED"
  | "SKIPPED"
  | "ABANDONED"
  | "RESUMED";

export type PerceivedDifficulty = "easy" | "good" | "hard" | "very_hard";

export interface WorkoutSetLog {
  setNumber: number;
  targetReps: string;
  actualReps?: number;
  actualWeightKg?: number;
  completed: boolean;
  difficulty?: PerceivedDifficulty;
  timestamp: string;
}

export interface ExerciseSessionProgress {
  exerciseId: string;
  name: string;
  targetSets: number;
  completedSets: number;
  setsState: boolean[];
  setLogs: WorkoutSetLog[];
  skipped: boolean;
  skipReason?: string;
  replacedBy?: string;
  painReported?: boolean;
}

export interface WorkoutSessionState {
  sessionId: string;
  date: string;
  planId: string;
  status: WorkoutStateMachineState;
  activeExerciseIndex: number;
  activeSetIndex: number;
  restTimerSeconds: number;
  isRestTimerRunning: boolean;
  startTime: string | null;
  completedTime: string | null;
  actualDurationSeconds: number;
  exercises: ExerciseSessionProgress[];
  totalSets: number;
  completedSets: number;
  overallDifficulty?: PerceivedDifficulty;
  userFeedbackNote?: string;
  aiSummary?: string;
  painReportedDuringSession?: boolean;
  aiAdjustments?: Array<{ reason: string; originalValue: any; adjustedValue: any; timestamp: string }>;
}

export interface RecoveryContext {
  daysSinceLastWorkout: number;
  recentCompletedSessions: number;
  consecutiveWorkoutDays: number;
  recentTotalSets: number;
  recentAverageDifficulty?: PerceivedDifficulty;
  recentlyTrainedBodyAreas: string[];
  recoveryScore: "high" | "moderate" | "poor";
  recommendation: "push" | "maintain" | "deload" | "active_rest";
}

// ─── 2. STRING NORMALIZATION ─────────────────────────────────────────────────

/**
 * Normalizes sets and reps representation into a clean, professional string.
 * Never outputs duplicates like "3 Set x 3 Set x 20 Reps".
 */
export function normalizeSetsRepsString(targetSets: number, targetRepsOrDuration: string): string {
  const clean = (targetRepsOrDuration || "").trim();
  if (!clean) return `${targetSets} Sets`;

  // Check if it's cardio duration / timed format (e.g. "20 min · Incline 8%", "30 Mins", "15–20 min")
  if (/\b(?:min|mins|menit|detik|sec|secs)\b/i.test(clean) && !/\breps\b/i.test(clean)) {
    if (/^\d+(?:[–\-]\d+)?\s*(?:min|mins|menit)/i.test(clean) || targetSets <= 1) {
      return clean;
    }
    return `${targetSets} Sets × ${clean}`;
  }

  // Remove duplicate "X set x" prefixes
  let strippedReps = clean.replace(/^(?:\d+\s*sets?\s*[x×]\s*)+/i, "").trim();
  strippedReps = strippedReps.replace(/^set\s*\d+\s*[x×]\s*/i, "").trim();

  // Ensure reps has unit if numeric
  if (/^\d+(?:-\d+)?$/.test(strippedReps)) {
    strippedReps = `${strippedReps} Reps`;
  }

  return `${targetSets} Sets × ${strippedReps}`;
}

// ─── 3. SAFETY CONSTRAINT LAYER & VALIDATOR ──────────────────────────────────

export const MEDICAL_SAFETY_DISCLAIMER =
  "GymBuddy adalah asisten AI kebugaran dan TIDAK mendiagnosis cedera medis. Jika Anda mengalami nyeri hebat atau akut, segera konsultasikan dengan tenaga medis profesional.";

export const MEDICAL_SAFETY_DISCLAIMER_EN =
  "GymBuddy is an AI fitness coach and does NOT diagnose injuries or provide medical clearance. If you experience severe or acute pain, please consult a qualified healthcare professional.";

/**
 * Validates whether an exercise complies with all user injury and pain constraints.
 * Deterministic: AI cannot bypass this layer.
 */
export function validateExerciseSafety(
  exercise: ExerciseItemPlan,
  constraints: InjuryConstraint[] = []
): { isSafe: boolean; reason?: string; suggestedModification?: string } {
  if (!constraints || constraints.length === 0) {
    return { isSafe: true };
  }

  for (const c of constraints) {
    const jointLoad = exercise.jointLoad[c.bodyArea];

    // Severe limitation: MUST eliminate any exercise placing moderate or high load on this joint
    if (c.severity === "severe") {
      if (jointLoad === "moderate" || jointLoad === "high") {
        return {
          isSafe: false,
          reason: `Area ${c.bodyArea.toUpperCase()} memiliki status pembatasan ketat (${c.severity}). Gerakan ini dieliminasi untuk menjaga keamanan sendi.`,
          suggestedModification: "Gunakan alternatif tanpa beban aksial atau isolasi area tubuh lain."
        };
      }
    }

    // Moderate limitation: eliminate high joint load and check prohibited movements
    if (c.severity === "moderate") {
      if (jointLoad === "high") {
        return {
          isSafe: false,
          reason: `Gerakan memiliki beban tinggi pada sendi ${c.bodyArea}. Disesuaikan karena adanya riwayat ketidaknyamanan.`,
          suggestedModification: "Gunakan variasi beban ringan, tumpuan bangku, atau gerakan isolasi terkontrol."
        };
      }
    }

    // Check specific pain triggers / avoid movements
    const contra = (exercise.contraindications || []).map(x => x.toLowerCase());
    if (c.avoidMovements && c.avoidMovements.length > 0) {
      for (const avoid of c.avoidMovements) {
        if (contra.includes(avoid.toLowerCase()) || exercise.name.toLowerCase().includes(avoid.toLowerCase())) {
          return {
            isSafe: false,
            reason: `Menghindari pola gerakan '${avoid}' sesuai laporan kenyamanan fisik Anda.`,
            suggestedModification: "Alternatif pola gerak yang lebih ramah sendi diterapkan."
          };
        }
      }
    }

    if (c.painTriggers && c.painTriggers.length > 0) {
      for (const trigger of c.painTriggers) {
        if (contra.includes(trigger.toLowerCase())) {
          return {
            isSafe: false,
            reason: `Pemicu nyeri '${trigger}' dihindari sesuai profil fisik Anda.`,
            suggestedModification: "Menggunakan gerakan dengan stabilitas lebih tinggi."
          };
        }
      }
    }
  }

  return { isSafe: true };
}

// ─── 4. RECOVERY CONTEXT EVALUATOR ───────────────────────────────────────────

/**
 * Calculates recovery context deterministically from workout history without asking intrusive questions.
 */
export function calculateRecoveryContext(
  history: Array<{ date: string; completedSets: number; difficulty?: PerceivedDifficulty; bodyAreas?: string[] }>,
  currentDateStr: string
): RecoveryContext {
  if (!history || history.length === 0) {
    return {
      daysSinceLastWorkout: 99,
      recentCompletedSessions: 0,
      consecutiveWorkoutDays: 0,
      recentTotalSets: 0,
      recoveryScore: "high",
      recentlyTrainedBodyAreas: [],
      recommendation: "push"
    };
  }

  // Sort history newest first
  const sorted = [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const lastSession = sorted[0];

  const nowMs = new Date(currentDateStr).getTime();
  const lastMs = new Date(lastSession.date).getTime();
  const diffDays = Math.max(0, Math.floor((nowMs - lastMs) / (1000 * 60 * 60 * 24)));

  // Calculate consecutive days
  let consecutiveDays = 0;
  let checkMs = nowMs - (1000 * 60 * 60 * 24);
  for (const s of sorted) {
    const sMs = new Date(s.date).getTime();
    if (Math.abs(sMs - checkMs) < (1000 * 60 * 60 * 12)) {
      consecutiveDays++;
      checkMs -= (1000 * 60 * 60 * 24);
    } else {
      break;
    }
  }

  // Last 7 days volume
  const sevenDaysAgoMs = nowMs - (7 * 24 * 60 * 60 * 1000);
  const recentSessions = sorted.filter(s => new Date(s.date).getTime() >= sevenDaysAgoMs);
  const recentSets = recentSessions.reduce((sum, s) => sum + (s.completedSets || 0), 0);

  const recentlyTrained: string[] = [];
  recentSessions.slice(0, 2).forEach(s => {
    if (Array.isArray(s.bodyAreas)) {
      s.bodyAreas.forEach(a => { if (!recentlyTrained.includes(a)) recentlyTrained.push(a); });
    }
  });

  // Calculate average difficulty
  const difficulties = recentSessions.map(s => s.difficulty).filter(Boolean) as PerceivedDifficulty[];
  const hardCount = difficulties.filter(d => d === "hard" || d === "very_hard").length;

  let recoveryScore: "high" | "moderate" | "poor" = "high";
  let recommendation: "push" | "maintain" | "deload" | "active_rest" = "maintain";

  if (consecutiveDays >= 3 || hardCount >= 2 || recentSets >= 45) {
    recoveryScore = "poor";
    recommendation = "deload";
  } else if (consecutiveDays === 2 || hardCount === 1 || recentSets >= 30) {
    recoveryScore = "moderate";
    recommendation = "maintain";
  } else {
    recoveryScore = "high";
    recommendation = "push";
  }

  return {
    daysSinceLastWorkout: diffDays,
    recentCompletedSessions: recentSessions.length,
    consecutiveWorkoutDays: consecutiveDays,
    recentTotalSets: recentSets,
    recentlyTrainedBodyAreas: recentlyTrained,
    recoveryScore,
    recommendation
  };
}

// ─── 5. REALISTIC TIME CALCULATION ───────────────────────────────────────────

/**
 * Calculates realistic total session duration in minutes.
 * Factors: Warm-up + Cooldown + Sum(sets * (reps * rep_tempo + rest_time))
 */
export function calculateEstimatedWorkoutDuration(
  warmup: WorkoutStructurePhase[],
  exercises: ExerciseItemPlan[],
  cooldown: WorkoutStructurePhase[],
  cardio?: ExerciseItemPlan
): number {
  const warmupMins = warmup.reduce((sum, w) => sum + w.durationMinutes, 0);
  const cooldownMins = cooldown.reduce((sum, c) => sum + c.durationMinutes, 0);

  let exerciseSeconds = 0;
  for (const ex of exercises) {
    // Determine rep execution time
    let repCount = 10;
    const match = ex.targetReps.match(/(\d+)(?:-\d+)?\s*reps?/i);
    if (match) {
      repCount = parseInt(match[1], 10);
    } else if (ex.targetReps.includes("sec") || ex.targetReps.includes("detik")) {
      const secMatch = ex.targetReps.match(/(\d+)\s*(?:sec|detik)/i);
      repCount = secMatch ? parseInt(secMatch[1], 10) / 3 : 10;
    }

    // ~3 seconds per rep under control
    const executionPerSet = repCount * 3;
    const restPerSet = ex.restSeconds || 60;
    exerciseSeconds += ex.targetSets * (executionPerSet + restPerSet);
  }

  let cardioMins = 0;
  if (cardio) {
    const cMatch = cardio.targetReps.match(/(\d+)\s*(?:min|menit)/i);
    cardioMins = cMatch ? parseInt(cMatch[1], 10) : 15;
  }

  const totalMinutes = Math.round(warmupMins + (exerciseSeconds / 60) + cardioMins + cooldownMins);
  return Math.max(12, totalMinutes);
}

// ─── 6. WORKOUT EXERCISE KNOWLEDGE BASE ───────────────────────────────────────

export const MASTER_EXERCISE_CATALOG: ExerciseItemPlan[] = [
  // ── PUSH / UPPER BODY ──
  {
    exerciseId: "db-bench-press",
    name: "Dumbbell Bench Press",
    indonesianName: "Dumbbell Bench Press (Dada & Tricep)",
    targetMuscles: ["Chest (Pectoralis)", "Triceps", "Anterior Deltoids"],
    equipment: "dumbbells",
    targetSets: 3,
    targetReps: "3 Sets × 10–12 Reps",
    restSeconds: 60,
    coachCue: {
      max: "Tancepkan kaki, busungkan dada sedikit, dan dorong kuat dari dada! 🔥",
      mia: "Tarik napas saat menurunkan dumbbell, dan buang napas perlahan saat mendorong. ✨"
    },
    priority: "essential",
    bodyArea: "upper_body",
    movementPattern: "push",
    jointLoad: { shoulder: "low", wrist: "low", spine: "none", knee: "none" },
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Bench_Press/0.jpg",
    imageFrames: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Bench_Press/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Bench_Press/1.jpg"
    ]
  },
  {
    exerciseId: "push-up",
    name: "Push-Up",
    indonesianName: "Push-Up (Dada, Bahu & Core)",
    targetMuscles: ["Chest", "Core", "Triceps"],
    equipment: "bodyweight",
    targetSets: 3,
    targetReps: "3 Sets × 12–15 Reps",
    restSeconds: 45,
    coachCue: {
      max: "Kunci pantat dan perut, turun sampai dada hampir cium lantai! Gas!",
      mia: "Jaga tubuh tetap membentuk garis lurus dari kepala hingga tumit ya. ✨"
    },
    priority: "essential",
    bodyArea: "upper_body",
    movementPattern: "push",
    jointLoad: { wrist: "moderate", shoulder: "moderate", spine: "none", knee: "none" },
    contraindications: ["wrist_extension"],
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Pushups/0.jpg",
    imageFrames: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Pushups/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Pushups/1.jpg"
    ]
  },
  {
    exerciseId: "db-shoulder-press",
    name: "Seated Dumbbell Shoulder Press",
    indonesianName: "Dumbbell Shoulder Press Duduk (Bahu)",
    targetMuscles: ["Deltoids (Bahu)", "Triceps"],
    equipment: "dumbbells",
    targetSets: 3,
    targetReps: "3 Sets × 10–12 Reps",
    restSeconds: 60,
    coachCue: {
      max: "Sandaran punggung tegak, dorong tanpa membenturkan dumbbell di atas!",
      mia: "Dorong ke atas dengan stabil dan jaga pundak tidak terangkat ke telinga ya."
    },
    priority: "secondary",
    bodyArea: "upper_body",
    movementPattern: "push",
    jointLoad: { shoulder: "moderate", spine: "low", wrist: "low", knee: "none" },
    contraindications: ["overhead_press"],
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Dumbbell_Press/0.jpg",
    imageFrames: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Dumbbell_Press/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Dumbbell_Press/1.jpg"
    ]
  },

  // ── PULL / BACK ──
  {
    exerciseId: "lat-pulldown",
    name: "Wide-Grip Lat Pulldown",
    indonesianName: "Lat Pulldown (Sayap Punggung)",
    targetMuscles: ["Latissimus Dorsi", "Biceps", "Rhomboids"],
    equipment: "machines",
    targetSets: 3,
    targetReps: "3 Sets × 10–12 Reps",
    restSeconds: 60,
    coachCue: {
      max: "Tarik pakai siku lo ke bawah, squeeze sayap punggung sampai mentok!",
      mia: "Bawa stang ke arah dada atas perlahan sambil rasakan otot punggung bekerja."
    },
    priority: "essential",
    bodyArea: "upper_body",
    movementPattern: "pull",
    jointLoad: { spine: "none", shoulder: "low", knee: "none" },
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Wide-Grip_Lat_Pulldown/0.jpg",
    imageFrames: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Wide-Grip_Lat_Pulldown/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Wide-Grip_Lat_Pulldown/1.jpg"
    ]
  },
  {
    exerciseId: "db-row-supported",
    name: "Chest-Supported Dumbbell Row",
    indonesianName: "Dumbbell Row Tumpuan Dada (Punggung Ramah Pinggang)",
    targetMuscles: ["Upper Back", "Lats", "Rhomboids"],
    equipment: "dumbbells",
    targetSets: 3,
    targetReps: "3 Sets × 10–12 Reps",
    restSeconds: 60,
    coachCue: {
      max: "Dada nempel di bangku, pinggang aman total, tarik siku ke belakang!",
      mia: "Pilihan terbaik untuk melatih punggung tanpa memberi tekanan pada pinggang bawah."
    },
    priority: "essential",
    bodyArea: "upper_body",
    movementPattern: "pull",
    jointLoad: { spine: "none", shoulder: "low", knee: "none" },
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Incline_Dumbbell_Row/0.jpg",
    imageFrames: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Incline_Dumbbell_Row/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Incline_Dumbbell_Row/1.jpg"
    ]
  },
  {
    exerciseId: "seated-cable-row",
    name: "Seated Cable Row",
    indonesianName: "Seated Cable Row (Dayung Kabel Duduk)",
    targetMuscles: ["Rhomboids", "Middle Trapezius", "Lats"],
    equipment: "machines",
    targetSets: 3,
    targetReps: "3 Sets × 10–12 Reps",
    restSeconds: 60,
    coachCue: {
      max: "Tarik ke arah pusar, jepit belikat kuat-kuat selama 1 detik!",
      mia: "Tegakkan dada dan kontrol tarikan kabel tanpa mengayunkan tubuh."
    },
    priority: "secondary",
    bodyArea: "upper_body",
    movementPattern: "pull",
    jointLoad: { spine: "low", shoulder: "low", knee: "none" },
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Cable_Rows/0.jpg",
    imageFrames: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Cable_Rows/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Cable_Rows/1.jpg"
    ]
  },

  // ── LEGS / LOWER BODY ──
  {
    exerciseId: "db-rdl",
    name: "Dumbbell Romanian Deadlift",
    indonesianName: "Dumbbell Romanian Deadlift (Paha Belakang & Bokong)",
    targetMuscles: ["Hamstrings", "Glutes"],
    equipment: "dumbbells",
    targetSets: 3,
    targetReps: "3 Sets × 10–12 Reps",
    restSeconds: 60,
    coachCue: {
      max: "Dorong pantat ke belakang, lutut sedikit tekuk lembut, rasakan tarikan di paha belakang!",
      mia: "Jaga punggung tetap rata alami dan bawa dumbbell menyusuri tulang kering."
    },
    priority: "essential",
    bodyArea: "lower_body",
    movementPattern: "hinge",
    jointLoad: { knee: "low", spine: "low", shoulder: "none" },
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Romanian_Deadlift/0.jpg",
    imageFrames: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Romanian_Deadlift/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Romanian_Deadlift/1.jpg"
    ]
  },
  {
    exerciseId: "glute-bridge",
    name: "Glute Bridge & Hip Thrust",
    indonesianName: "Glute Bridge (Bokong Ramah Lutut)",
    targetMuscles: ["Gluteus Maximus", "Hamstrings"],
    equipment: "bodyweight",
    targetSets: 3,
    targetReps: "3 Sets × 15 Reps",
    restSeconds: 45,
    coachCue: {
      max: "Dorong dari tumit, kunci bokong di puncak gerakan 2 detik!",
      mia: "Gerakan ini sangat ramah untuk sendi lutut dan pinggang bawah. Lakukan perlahan."
    },
    priority: "essential",
    bodyArea: "lower_body",
    movementPattern: "hinge",
    jointLoad: { knee: "low", spine: "none", shoulder: "none" },
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Glute_Bridge/0.jpg",
    imageFrames: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Glute_Bridge/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Glute_Bridge/1.jpg"
    ]
  },
  {
    exerciseId: "leg-press",
    name: "Leg Press Machine",
    indonesianName: "Mesin Leg Press (Paha & Bokong)",
    targetMuscles: ["Quadriceps", "Glutes"],
    equipment: "machines",
    targetSets: 3,
    targetReps: "3 Sets × 10–12 Reps",
    restSeconds: 75,
    coachCue: {
      max: "AWAS: JANGAN kunci mati (lockout) lutut di atas! Sisakan tekukan sedikit!",
      mia: "Pastikan pinggul dan punggung selalu menempel rapat di bantalan kursi ya."
    },
    priority: "essential",
    bodyArea: "lower_body",
    movementPattern: "squat",
    jointLoad: { knee: "moderate", spine: "low", shoulder: "none" },
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Press/0.jpg",
    imageFrames: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Press/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Press/1.jpg"
    ]
  },
  {
    exerciseId: "bodyweight-squat",
    name: "Bodyweight Squat",
    indonesianName: "Squat Beban Tubuh",
    targetMuscles: ["Quadriceps", "Glutes"],
    equipment: "bodyweight",
    targetSets: 3,
    targetReps: "3 Sets × 12–15 Reps",
    restSeconds: 45,
    coachCue: {
      max: "Buka dada, turun sampai paha sejajar lantai, dorong pakai tumit!",
      mia: "Atur napas dengan tenang dan jaga lutut tetap sejajar dengan arah jari kaki."
    },
    priority: "essential",
    bodyArea: "lower_body",
    movementPattern: "squat",
    jointLoad: { knee: "moderate", spine: "low", shoulder: "none" },
    contraindications: ["deep_squat"],
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bodyweight_Squat/0.jpg",
    imageFrames: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bodyweight_Squat/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bodyweight_Squat/1.jpg"
    ]
  },

  // ── CORE & CONDITIONING ──
  {
    exerciseId: "russian-twist",
    name: "Russian Twist",
    indonesianName: "Russian Twist (Perut Samping & Core)",
    targetMuscles: ["Obliques", "Rectus Abdominis"],
    equipment: "bodyweight",
    targetSets: 3,
    targetReps: "3 Sets × 20 Reps",
    restSeconds: 45,
    coachCue: {
      max: "Kunci perut lo, rotasikan tubuh secara terkontrol tanpa mengayun liar!",
      mia: "Fokus pada putaran pinggang yang lembut dan terarah ya. Jaga pernapasan."
    },
    priority: "essential",
    bodyArea: "core",
    movementPattern: "core",
    jointLoad: { spine: "low", knee: "none", shoulder: "none" },
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Russian_Twist/0.jpg",
    imageFrames: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Russian_Twist/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Russian_Twist/1.jpg"
    ]
  },
  {
    exerciseId: "plank",
    name: "Plank Hold",
    indonesianName: "Plank Statis (Kekuatan Core Menyeluruh)",
    targetMuscles: ["Core", "Transverse Abdominis", "Shoulders"],
    equipment: "bodyweight",
    targetSets: 3,
    targetReps: "3 Sets × 45 Secs",
    restSeconds: 45,
    coachCue: {
      max: "Tahan! Jangan biarkan pinggang turun lemas! 45 detik solid!",
      mia: "Rapatkan otot perut dan bernapaslah secara teratur sepanjang waktu."
    },
    priority: "essential",
    bodyArea: "core",
    movementPattern: "core",
    jointLoad: { shoulder: "low", spine: "none", wrist: "none", knee: "none" },
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Plank/0.jpg",
    imageFrames: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Plank/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Plank/1.jpg"
    ]
  },
  {
    exerciseId: "incline-treadmill-walk",
    name: "Incline Treadmill Walk",
    indonesianName: "Jalan Incline Treadmill (Pembakar Lemak Ramah Sendi)",
    targetMuscles: ["Cardiovascular", "Calves", "Glutes"],
    equipment: "machines",
    targetSets: 1,
    targetReps: "15–20 min · Incline 8%",
    restSeconds: 0,
    coachCue: {
      max: "Jaga postur tegak, ayun lengan naturally. Zona kardio pembakar lemak optimal!",
      mia: "Kecepatan stabil dan elevasi nyaman membantu membakar kalori tanpa membebani lutut."
    },
    priority: "secondary",
    bodyArea: "cardio",
    movementPattern: "cardio",
    jointLoad: { knee: "low", spine: "none", shoulder: "none" },
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Walking/0.jpg",
    imageFrames: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Walking/0.jpg"
    ]
  },
  {
    exerciseId: "stationary-bike",
    name: "Stationary Bike",
    indonesianName: "Sepeda Statis (Kardio Zona 2)",
    targetMuscles: ["Cardiovascular", "Quadriceps"],
    equipment: "machines",
    targetSets: 1,
    targetReps: "20 min · Zona 2",
    restSeconds: 0,
    coachCue: {
      max: "Kayuh stabil di resistensi sedang, jaga napas tetap terkendali!",
      mia: "Kayuh santai namun berirama untuk menjaga kebugaran jantung dan membakar lemak."
    },
    priority: "secondary",
    bodyArea: "cardio",
    movementPattern: "cardio",
    jointLoad: { knee: "low", spine: "none", shoulder: "none" },
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Stationary_Bike/0.jpg",
    imageFrames: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Stationary_Bike/0.jpg"
    ]
  },

  // ── ACCESSORY & HIGH-VOLUME SCALING EXERCISES (For 60, 90, 120m) ──
  {
    exerciseId: "side-lateral-raise",
    name: "Side Lateral Raise",
    indonesianName: "Lateral Raise Bahu Samping",
    targetMuscles: ["Lateral Deltoids"],
    equipment: "dumbbells",
    targetSets: 3,
    targetReps: "3 Sets × 12-15 Reps",
    restSeconds: 45,
    coachCue: {
      max: "Angkat beban setinggi bahu dengan siku sedikit ditekuk, rasakan pembakaran di bahu samping!",
      mia: "Angkat perlahan seperti menuang air, jangan mengayunkan pinggang ya."
    },
    priority: "accessory",
    bodyArea: "upper_body",
    movementPattern: "push",
    jointLoad: { shoulder: "low", spine: "none" },
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Side_Lateral_Raise/0.jpg",
    imageFrames: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Side_Lateral_Raise/0.jpg"
    ]
  },
  {
    exerciseId: "db-bicep-curl",
    name: "Dumbbell Bicep Curl",
    indonesianName: "Bicep Curl Dumbbell",
    targetMuscles: ["Biceps Brachii"],
    equipment: "dumbbells",
    targetSets: 3,
    targetReps: "3 Sets × 10-12 Reps",
    restSeconds: 45,
    coachCue: {
      max: "Kunci siku di samping pinggang, squeeze bicep di puncak gerakan!",
      mia: "Putar pergelangan tangan secara terkontrol, jangan gunakan momentum tubuh."
    },
    priority: "accessory",
    bodyArea: "upper_body",
    movementPattern: "pull",
    jointLoad: { wrist: "low", shoulder: "none" },
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bicep_Curl/0.jpg",
    imageFrames: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bicep_Curl/0.jpg"
    ]
  },
  {
    exerciseId: "tricep-pushdown",
    name: "Triceps Pushdown",
    indonesianName: "Tricep Pushdown (Tali / V-Bar)",
    targetMuscles: ["Triceps"],
    equipment: "machines",
    targetSets: 3,
    targetReps: "3 Sets × 12-15 Reps",
    restSeconds: 45,
    coachCue: {
      max: "Kunci siku lo, dorong kabel lurus ke bawah dan kontraksikan tricep!",
      mia: "Jaga dada tetap tegak dan fokuskan kontraksi di belakang lengan."
    },
    priority: "accessory",
    bodyArea: "upper_body",
    movementPattern: "push",
    jointLoad: { shoulder: "none", spine: "none" },
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Tricep_Pushdown/0.jpg",
    imageFrames: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Tricep_Pushdown/0.jpg"
    ]
  },
  {
    exerciseId: "db-lunges",
    name: "Dumbbell Walking Lunges",
    indonesianName: "Dumbbell Lunges (Paha Depan & Bokong)",
    targetMuscles: ["Quadriceps", "Glutes", "Hamstrings"],
    equipment: "dumbbells",
    targetSets: 3,
    targetReps: "3 Sets × 10 Reps/kaki",
    restSeconds: 60,
    coachCue: {
      max: "Langkah tegap, turunkan lutut belakang hampir menyentuh lantai dengan kendali penuh!",
      mia: "Jaga lutut depan tidak melebihi ujung kaki dan tubuh tetap tegak."
    },
    priority: "secondary",
    bodyArea: "lower_body",
    movementPattern: "lunge",
    jointLoad: { knee: "moderate", hip: "low", spine: "none" },
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Lunge/0.jpg",
    imageFrames: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Lunge/0.jpg"
    ]
  },
  {
    exerciseId: "hanging-leg-raise",
    name: "Hanging Leg Raise",
    indonesianName: "Hanging Leg Raise (Perut Bawah)",
    targetMuscles: ["Lower Abs", "Hip Flexors"],
    equipment: "bodyweight",
    targetSets: 3,
    targetReps: "3 Sets × 12-15 Reps",
    restSeconds: 45,
    coachCue: {
      max: "Angkat kaki menggunakan kekuatan perut, jangan berayun liar!",
      mia: "Tarik napas saat kaki turun dan buang napas saat mengangkat lutut."
    },
    priority: "accessory",
    bodyArea: "core",
    movementPattern: "core",
    jointLoad: { shoulder: "low", spine: "none", knee: "none" },
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Hanging_Leg_Raise/0.jpg",
    imageFrames: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Hanging_Leg_Raise/0.jpg"
    ]
  },
  {
    exerciseId: "cable-face-pull",
    name: "Cable Face Pull",
    indonesianName: "Cable Face Pull (Bahu Belakang & Postur)",
    targetMuscles: ["Rear Deltoids", "Rhomboids"],
    equipment: "machines",
    targetSets: 3,
    targetReps: "3 Sets × 15 Reps",
    restSeconds: 45,
    coachCue: {
      max: "Tarik tali ke arah kening, buka siku ke samping belakang untuk postur baja!",
      mia: "Gerakan ini sangat baik untuk memperbaiki postur bahu agar tegap."
    },
    priority: "accessory",
    bodyArea: "upper_body",
    movementPattern: "pull",
    jointLoad: { shoulder: "low", spine: "none" },
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Face_Pull/0.jpg",
    imageFrames: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Face_Pull/0.jpg"
    ]
  },
  {
    exerciseId: "standing-calf-raise",
    name: "Standing Calf Raise",
    indonesianName: "Calf Raise Berdiri (Betis)",
    targetMuscles: ["Gastrocnemius", "Soleus"],
    equipment: "bodyweight",
    targetSets: 3,
    targetReps: "3 Sets × 15-20 Reps",
    restSeconds: 30,
    coachCue: {
      max: "Jinjit setinggi mungkin, tahan 1 detik di atas lalu turun perlahan!",
      mia: "Rasakan regangan lembut pada betis sebelum mendorong kembali ke atas."
    },
    priority: "finisher",
    bodyArea: "lower_body",
    movementPattern: "squat",
    jointLoad: { ankle: "low", knee: "none" },
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Calf_Raise/0.jpg",
    imageFrames: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Calf_Raise/0.jpg"
    ]
  },
  {
    exerciseId: "mountain-climbers",
    name: "Mountain Climbers",
    indonesianName: "Mountain Climbers (HIIT Core)",
    targetMuscles: ["Core", "Cardiovascular"],
    equipment: "bodyweight",
    targetSets: 3,
    targetReps: "3 Sets × 20 Reps",
    restSeconds: 45,
    coachCue: {
      max: "Pacu lutut ke arah dada dengan tempo cepat dan pinggul tetap stabil!",
      mia: "Pertahankan posisi plank yang kuat sambil mengayunkan kaki secara berirama."
    },
    priority: "finisher",
    bodyArea: "core",
    movementPattern: "core",
    jointLoad: { wrist: "low", shoulder: "low", knee: "low" },
    gifUrl: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Mountain_Climbers/0.jpg",
    imageFrames: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Mountain_Climbers/0.jpg"
    ]
  }
];

// ─── 7. DETERMINISTIC WORKOUT GENERATOR ───────────────────────────────────────

/**
 * Generates a complete, personalized, duration-aware WorkoutPlan.
 * 
 * Order:
 * 1. Read user profile & preferences
 * 2. Calculate recovery context
 * 3. Filter safe exercises against injury constraints
 * 4. Determine session structure based on duration (15, 30, 45, 60+)
 * 5. Allocate exercises, sets, reps, and warm-up/cooldown
 * 6. Validate estimated time against duration constraint
 * 7. Generate concise "Why this workout?" rationale
 * 8. Return final verified WorkoutPlan
 */
export function generatePersonalizedWorkoutPlan(
  userPrefs: WorkoutPreferences,
  targetDateStr: string = new Date().toISOString().split("T")[0],
  history: any[] = [],
  dayIndexOverride?: number
): WorkoutPlan {
  const duration = userPrefs.workoutDuration || 45;
  const goal = (userPrefs.primaryGoal || "lose").toLowerCase();
  const fitness = userPrefs.fitnessLevel || "intermediate";
  const equipment = userPrefs.equipment || "full_gym";
  const constraints = userPrefs.injuryLimitations || [];
  const persona = userPrefs.persona || "max";

  const d = new Date(targetDateStr);
  const dayIndex = typeof dayIndexOverride === "number" ? dayIndexOverride : (d.getDay() + 6) % 7; // 0: Mon, 1: Tue ... 5: Sat, 6: Sun
  const dayNamesID = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
  const dayName = dayNamesID[dayIndex] || "Hari Ini";

  // Recovery evaluation
  const recovery = calculateRecoveryContext(history, targetDateStr);

  // Safety filter
  const safeCatalog = MASTER_EXERCISE_CATALOG.filter(ex => {
    // Check equipment compatibility
    if (equipment === "bodyweight" || equipment === "none") {
      if (ex.equipment !== "bodyweight") return false;
    } else if (equipment === "dumbbells") {
      if (ex.equipment !== "bodyweight" && ex.equipment !== "dumbbells") return false;
    }
    // Check joint & injury constraints
    const safety = validateExerciseSafety(ex, constraints);
    return safety.isSafe;
  });

  // Fallbacks if pool is depleted
  const safeUpper = safeCatalog.filter(e => e.bodyArea === "upper_body");
  const safeLower = safeCatalog.filter(e => e.bodyArea === "lower_body");
  const safeCore = safeCatalog.filter(e => e.bodyArea === "core");
  const safeCardio = safeCatalog.filter(e => e.bodyArea === "cardio");

  // Determine Daily Focus
  let focus = "Full Body Conditioning";
  let primaryMovements: ExerciseItemPlan[] = [];
  let secondaryMovements: ExerciseItemPlan[] = [];
  let cardioMovement: ExerciseItemPlan | undefined = undefined;

  // Saturday is specifically Core & Incline Walking / Aerobic conditioning
  if (dayIndex === 5) {
    focus = "Core & Incline Walking";
    primaryMovements = safeCore.slice(0, 2);
    cardioMovement = safeCatalog.find(e => e.exerciseId === "incline-treadmill-walk") || safeCardio[0];
  } else if (dayIndex === 0 || dayIndex === 3) {
    // Upper Body / Push & Pull
    focus = goal === "gain" ? "Upper Body Hypertrophy" : "Upper Body & Core";
    primaryMovements = safeUpper.slice(0, 2);
    secondaryMovements = [...safeUpper.slice(2, 4), ...safeCore.slice(0, 1)];
  } else if (dayIndex === 1 || dayIndex === 4) {
    // Lower Body
    focus = goal === "gain" ? "Lower Body Strength & Glutes" : "Lower Body & Fat Burn";
    primaryMovements = safeLower.slice(0, 2);
    secondaryMovements = [...safeLower.slice(2, 3), ...safeCore.slice(0, 1)];
  } else if (dayIndex === 2) {
    // Active Recovery / Midweek Stamina
    focus = "Midweek Active Recovery & Core";
    primaryMovements = safeCore.slice(0, 2);
    cardioMovement = safeCatalog.find(e => e.exerciseId === "stationary-bike") || safeCardio[0];
  } else {
    // Sunday: Rest & Mobility
    focus = "Rest & Active Recovery";
  }

  // Determine Structure & Exercise count based on DURATION constraint
  let warmupDuration = 5;
  let cooldownDuration = 5;
  let plannedExercises: ExerciseItemPlan[] = [];

  if (duration === 15) {
    warmupDuration = 2;
    cooldownDuration = 2;
    // 2 high-priority movements + short sets
    plannedExercises = (primaryMovements.length >= 2 ? primaryMovements.slice(0, 2) : safeCatalog.slice(0, 2))
      .map(ex => ({
        ...ex,
        targetSets: 2,
        targetReps: normalizeSetsRepsString(2, ex.targetReps)
      }));
    cardioMovement = undefined; // No time for separate 20m cardio in 15m session
  } else if (duration === 30) {
    warmupDuration = 4;
    cooldownDuration = 4;
    if (dayIndex === 5 && cardioMovement) {
      // Core + short incline walk
      plannedExercises = primaryMovements.slice(0, 2).map(ex => ({
        ...ex,
        targetSets: 3,
        targetReps: normalizeSetsRepsString(3, ex.targetReps)
      }));
      // Adjust cardio for 30m total session
      cardioMovement = {
        ...cardioMovement,
        targetReps: "10–12 min · Incline 6–8%"
      };
    } else {
      const candidates = [...primaryMovements, ...secondaryMovements].slice(0, 3);
      plannedExercises = (candidates.length >= 3 ? candidates : safeCatalog.slice(0, 3)).map(ex => ({
        ...ex,
        targetSets: 3,
        targetReps: normalizeSetsRepsString(3, ex.targetReps)
      }));
    }
  } else if (duration === 45) {
    warmupDuration = 5;
    cooldownDuration = 5;
    if (dayIndex === 5 && cardioMovement) {
      // Full Core & Incline Walking (Russian Twist, Plank, Incline Walk)
      plannedExercises = primaryMovements.slice(0, 2).map(ex => ({
        ...ex,
        targetSets: 3,
        targetReps: normalizeSetsRepsString(3, ex.targetReps)
      }));
      cardioMovement = {
        ...cardioMovement,
        targetReps: "15–20 min · Incline 8%"
      };
    } else {
      const candidates = [...primaryMovements, ...secondaryMovements].slice(0, 4);
      plannedExercises = (candidates.length >= 4 ? candidates : safeCatalog.slice(0, 4)).map(ex => ({
        ...ex,
        targetSets: 3,
        targetReps: normalizeSetsRepsString(3, ex.targetReps)
      }));
    }
  } else if (duration === 60) {
    warmupDuration = 6;
    cooldownDuration = 6;
    const candidates = [...primaryMovements, ...secondaryMovements].slice(0, 5);
    plannedExercises = (candidates.length >= 4 ? candidates : safeCatalog.slice(0, 5)).map(ex => ({
      ...ex,
      targetSets: fitness === "advanced" ? 4 : 3,
      targetReps: normalizeSetsRepsString(fitness === "advanced" ? 4 : 3, ex.targetReps)
    }));
  } else if (duration === 90) {
    // 90 minutes: High volume + accessory work + cardio
    warmupDuration = 8;
    cooldownDuration = 8;
    const pool = [...primaryMovements, ...secondaryMovements, ...safeCore, ...safeCatalog.filter(e => e.priority === "accessory")];
    const uniqueCandidates = Array.from(new Set(pool));
    plannedExercises = (uniqueCandidates.length >= 6 ? uniqueCandidates.slice(0, 7) : safeCatalog.slice(0, 7)).map(ex => ({
      ...ex,
      targetSets: 3,
      targetReps: normalizeSetsRepsString(3, ex.targetReps)
    }));
    if (!cardioMovement && safeCardio.length > 0) {
      cardioMovement = {
        ...safeCardio[0],
        targetReps: "15–20 min · Kardio Aerobik"
      };
    }
  } else {
    // 120 minutes: Dedicated Athlete / Maximum Volume (8-10 exercises + cardio)
    warmupDuration = 10;
    cooldownDuration = 10;
    const pool = [...primaryMovements, ...secondaryMovements, ...safeCore, ...safeCatalog.filter(e => e.priority === "accessory" || e.priority === "finisher")];
    const uniqueCandidates = Array.from(new Set(pool));
    plannedExercises = (uniqueCandidates.length >= 8 ? uniqueCandidates.slice(0, 9) : safeCatalog.slice(0, 9)).map(ex => ({
      ...ex,
      targetSets: fitness === "advanced" ? 4 : 3,
      targetReps: normalizeSetsRepsString(fitness === "advanced" ? 4 : 3, ex.targetReps)
    }));
    if (!cardioMovement && safeCardio.length > 0) {
      cardioMovement = {
        ...safeCardio[0],
        targetReps: "20–25 min · Zona Kardio Optimal"
      };
    }
  }

  // Combine cardio if present into total exercises
  const allSessionExercises = cardioMovement
    ? [...plannedExercises, cardioMovement]
    : plannedExercises;

  // Build Warmup and Cooldown phases
  const warmup: WorkoutStructurePhase[] = [
    { name: "Pemanasan Mobilitas Sendi", durationMinutes: Math.round(warmupDuration * 0.6), instructions: "Rotasi bahu, arm swings, cat-cow stretch." },
    { name: "Aktivasi Otot Target", durationMinutes: Math.max(1, Math.round(warmupDuration * 0.4)), instructions: "Gerakan beban tubuh ringan untuk menaikkan detak jantung." }
  ];

  const cooldown: WorkoutStructurePhase[] = [
    { name: "Peregangan Statis", durationMinutes: cooldownDuration, instructions: "Peregangan otot utama selama 30 detik tiap sisi untuk mempercepat pemulihan." }
  ];

  // Calculate estimated duration
  const estimatedDuration = calculateEstimatedWorkoutDuration(warmup, plannedExercises, cooldown, cardioMovement);

  // Calculate total sets
  const totalSets = allSessionExercises.reduce((sum, ex) => sum + (ex.targetSets || 1), 0);

  // Generate "Why This Workout?" Rationale
  let rationale = "";
  if (dayIndex === 5) {
    rationale = `Fokus latihan hari ini adalah stabilitas core dan dilanjutkan incline walk selama ${duration} menit untuk membakar lemak secara optimal tanpa membebani persendian.`;
  } else {
    const goalText = goal === "gain" ? "pembentukan massa otot" : (goal === "lose" ? "pembakaran kalori terstruktur" : "kebugaran fungsional");
    rationale = `Sesi ${duration} menit ini dirancang untuk ${goalText} pada area ${focus.toLowerCase()} dengan mempertimbangkan ketersediaan alat dan riwayat latihanmu.`;
  }

  // Safety notes
  const safetyNotes: string[] = [];
  if (constraints.length > 0) {
    const areas = constraints.map(c => c.bodyArea).join(", ");
    safetyNotes.push(`Sesi ini secara otomatis mengeliminasi gerakan berisiko pada area: ${areas}.`);
  }

  // Coach Insight based on Recovery
  let coachInsight = "";
  if (recovery.recoveryScore === "poor") {
    coachInsight = "Kamu telah berlatih intensif beberapa hari berturut-turut. Hari ini volume dijaga terkontrol agar otot pulih maksimal.";
  } else if (recovery.recoveryScore === "high") {
    coachInsight = "Kondisi pemulihanmu prima! Manfaatkan sesi ini untuk menjaga konsistensi repetisi dan teknik terbaik.";
  } else {
    coachInsight = "Jaga tempo gerakan yang terkontrol. Kualitas form setiap repetisi lebih utama dibanding kecepatan.";
  }

  return {
    id: `plan_${targetDateStr}_${duration}m`,
    date: targetDateStr,
    dayName,
    goal,
    focus,
    targetDuration: duration,
    estimatedDuration,
    intensity: duration >= 45 ? "high" : "moderate",
    warmup,
    mainExercises: plannedExercises,
    cardio: cardioMovement,
    cooldown,
    totalSets,
    totalExercises: allSessionExercises.length,
    rationale,
    coachInsight,
    safetyNotes
  };
}

/**
 * Generates a full 7-day personalized weekly schedule routine array,
 * perfectly compatible with GymBuddy's DailyWorkoutRoutine model.
 */
export function generatePersonalizedWeeklySchedule(
  userPrefs: WorkoutPreferences,
  lang: "ID" | "EN" = "ID"
): Array<{
  day: string;
  focus: string;
  exercises: Array<{
    id: string;
    name: string;
    targetSets: number;
    completedSets: number;
    setsState: boolean[];
    targetReps: string;
    status: "not_started" | "in_progress" | "completed";
  }>;
}> {
  const daysID = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
  const daysEN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const daysKey = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

  return daysKey.map((key, idx) => {
    // Generate plan for day index (0: Mon, 1: Tue ... 5: Sat, 6: Sun)
    const plan = generatePersonalizedWorkoutPlan(userPrefs, "2026-09-14", [], idx);
    const allEx = plan.cardio ? [...plan.mainExercises, plan.cardio] : plan.mainExercises;
    return {
      day: lang === "EN" ? daysEN[idx] : daysID[idx],
      focus: plan.focus,
      exercises: allEx.map((ex, exIdx) => ({
        id: `w-${key}-${exIdx + 1}`,
        name: ex.name,
        targetSets: ex.targetSets || 1,
        completedSets: 0,
        setsState: Array(ex.targetSets || 1).fill(false),
        targetReps: normalizeSetsRepsString(ex.targetSets || 1, ex.targetReps),
        status: "not_started" as const
      }))
    };
  });
}

// ─── 8. DYNAMIC SESSION SHORTENING ───────────────────────────────────────────

/**
 * Dynamically shortens an existing workout plan when user reports having less time.
 * Preserves primary goal, essential movements, and safety constraints.
 */
export function shortenWorkoutPlan(
  originalPlan: WorkoutPlan,
  newTargetDuration: WorkoutDuration
): WorkoutPlan {
  if (newTargetDuration === originalPlan.targetDuration) {
    return originalPlan;
  }

  // If user increases duration (e.g. from 15m back to 30, 45, 60, 90, 120m)
  if (newTargetDuration > originalPlan.targetDuration) {
    const regenerated = generatePersonalizedWorkoutPlan(
      {
        workoutDuration: newTargetDuration,
        workoutFrequency: "3-4",
        fitnessLevel: "intermediate",
        equipment: "full_gym",
        primaryGoal: originalPlan.goal || "lose"
      },
      originalPlan.date
    );
    return {
      ...regenerated,
      id: `${originalPlan.id}_scaled_${newTargetDuration}m`,
      targetDuration: newTargetDuration,
      rationale: `Sesi telah disesuaikan menjadi ${newTargetDuration} menit dengan menu latihan yang lebih lengkap dan volume yang seimbang.`,
      coachInsight: `Durasi latihan disesuaikan menjadi ${newTargetDuration} menit. Fokus pada setiap gerakan dan nikmati prosesnya.`
    };
  }

  // 1. Keep only essential movements for short durations
  let shortenedExercises = originalPlan.mainExercises.filter(ex => ex.priority === "essential");
  if (shortenedExercises.length === 0) {
    shortenedExercises = originalPlan.mainExercises.slice(0, 2);
  }

  // 2. Adjust sets if 15 minutes
  if (newTargetDuration === 15) {
    shortenedExercises = shortenedExercises.slice(0, 2).map(ex => ({
      ...ex,
      targetSets: 2,
      targetReps: normalizeSetsRepsString(2, ex.targetReps)
    }));
  } else if (newTargetDuration === 30) {
    shortenedExercises = shortenedExercises.slice(0, 3).map(ex => ({
      ...ex,
      targetSets: 3,
      targetReps: normalizeSetsRepsString(3, ex.targetReps)
    }));
  }

  // 3. Scale warmup and cooldown
  const warmup = [
    { name: "Pemanasan Cepat", durationMinutes: 2, instructions: "Mobilitas sendi utama." }
  ];
  const cooldown = [
    { name: "Pendinginan Singkat", durationMinutes: 2, instructions: "Peregangan otot target." }
  ];

  // 4. Cardio adjustment
  let adjustedCardio: ExerciseItemPlan | undefined = undefined;
  if (originalPlan.cardio && newTargetDuration >= 30) {
    adjustedCardio = {
      ...originalPlan.cardio,
      targetReps: "10 min · Incline 6%"
    };
  }

  const allExercises = adjustedCardio ? [...shortenedExercises, adjustedCardio] : shortenedExercises;
  const estimatedDuration = calculateEstimatedWorkoutDuration(warmup, shortenedExercises, cooldown, adjustedCardio);
  const totalSets = allExercises.reduce((sum, ex) => sum + (ex.targetSets || 1), 0);

  const cleanBaseId = originalPlan.id.replace(/_(?:shortened|scaled)_\d+m/g, "");

  return {
    ...originalPlan,
    id: `${cleanBaseId}_shortened_${newTargetDuration}m`,
    targetDuration: newTargetDuration,
    estimatedDuration,
    warmup,
    mainExercises: shortenedExercises,
    cardio: adjustedCardio,
    cooldown,
    totalSets,
    totalExercises: allExercises.length,
    rationale: `Sesi telah disesuaikan menjadi ${newTargetDuration} menit. Gerakan inti (${shortenedExercises.map(e => e.name).join(", ")}) diprioritaskan agar target latihan tetap tercapai.`,
    coachInsight: `Saya telah memangkas gerakan pelengkap dan memfokuskan energimu pada gerakan utama dalam waktu ${newTargetDuration} menit.`
  };
}

/**
 * Bidirectionally adjusts workout duration (both shortening and lengthening),
 * scaling the menu and exercises appropriately.
 */
export function adjustWorkoutPlanDuration(
  originalPlan: WorkoutPlan,
  newTargetDuration: WorkoutDuration,
  userPrefs?: Partial<WorkoutPreferences>
): WorkoutPlan {
  if (newTargetDuration === originalPlan.targetDuration) {
    return originalPlan;
  }
  const cleanBaseId = originalPlan.id.replace(/_(?:shortened|scaled)_\d+m/g, "");

  if (newTargetDuration > originalPlan.targetDuration) {
    const d = new Date(originalPlan.date);
    const dayIndex = (d.getDay() + 6) % 7;
    const regenerated = generatePersonalizedWorkoutPlan(
      {
        workoutDuration: newTargetDuration,
        workoutFrequency: (userPrefs?.workoutFrequency || "3-4") as any,
        fitnessLevel: (userPrefs?.fitnessLevel || "intermediate") as any,
        equipment: (userPrefs?.equipment || "full_gym") as any,
        primaryGoal: userPrefs?.primaryGoal || originalPlan.goal || "lose",
        injuryLimitations: userPrefs?.injuryLimitations || [],
        persona: userPrefs?.persona || "max"
      },
      originalPlan.date,
      [],
      dayIndex
    );
    return {
      ...regenerated,
      id: `${cleanBaseId}_scaled_${newTargetDuration}m`,
      targetDuration: newTargetDuration,
      rationale: `Sesi telah disesuaikan menjadi ${newTargetDuration} menit dengan menambahkan variasi gerakan dan volume latihan yang seimbang.`,
      coachInsight: `Durasi latihan ditingkatkan menjadi ${newTargetDuration} menit. Manfaatkan waktu ini untuk fokus pada form dan volume latihan.`
    };
  }
  return shortenWorkoutPlan(originalPlan, newTargetDuration);
}

// ─── 9. WORKOUT SESSION STATE MACHINE ────────────────────────────────────────

/**
 * Initializes a new workout execution session state from a WorkoutPlan.
 */
export function initializeSessionState(plan: WorkoutPlan): WorkoutSessionState {
  const allExercises = plan.cardio
    ? [...plan.mainExercises, plan.cardio]
    : plan.mainExercises;

  const exerciseProgress: ExerciseSessionProgress[] = allExercises.map(ex => ({
    exerciseId: ex.exerciseId,
    name: ex.name,
    targetSets: ex.targetSets || 1,
    completedSets: 0,
    setsState: Array(ex.targetSets || 1).fill(false),
    setLogs: [],
    skipped: false
  }));

  const totalSets = exerciseProgress.reduce((sum, ex) => sum + ex.targetSets, 0);

  return {
    sessionId: `sess_${plan.date}_${Date.now()}`,
    date: plan.date,
    planId: plan.id,
    status: "SCHEDULED",
    activeExerciseIndex: 0,
    activeSetIndex: 0,
    restTimerSeconds: 60,
    isRestTimerRunning: false,
    startTime: null,
    completedTime: null,
    actualDurationSeconds: 0,
    exercises: exerciseProgress,
    totalSets,
    completedSets: 0
  };
}

export type SessionAction =
  | { type: "START_WORKOUT" }
  | { type: "COMPLETE_SET"; actualReps?: number; actualWeightKg?: number; difficulty?: PerceivedDifficulty }
  | { type: "SKIP_REST" }
  | { type: "ADD_REST_TIME"; seconds: number }
  | { type: "SKIP_SET"; reason?: string }
  | { type: "SKIP_EXERCISE"; reason?: string }
  | { type: "PAUSE_WORKOUT" }
  | { type: "RESUME_WORKOUT" }
  | { type: "REPORT_PAIN"; bodyArea: BodyArea; note?: string }
  | { type: "ABANDON_WORKOUT" }
  | { type: "FINISH_WORKOUT"; overallDifficulty: PerceivedDifficulty; feedbackNote?: string };

/**
 * Deterministic State Machine Transition Function.
 * Protects against duplicate set events and handles all edge cases.
 */
export function transitionWorkoutSession(
  state: WorkoutSessionState,
  action: SessionAction,
  plan?: WorkoutPlan
): WorkoutSessionState {
  const now = new Date().toISOString();
  const allPlanExercises = plan ? (plan.cardio ? [...plan.mainExercises, plan.cardio] : plan.mainExercises) : [];

  switch (action.type) {
    case "START_WORKOUT": {
      if (state.status !== "SCHEDULED" && state.status !== "READY") return state;
      return {
        ...state,
        status: "SET_ACTIVE",
        startTime: state.startTime || now
      };
    }

    case "COMPLETE_SET": {
      if (state.status !== "SET_ACTIVE" && state.status !== "IN_PROGRESS" && state.status !== "EXERCISE_ACTIVE") {
        return state;
      }

      const curExIdx = state.activeExerciseIndex;
      const curSetIdx = state.activeSetIndex;
      const curEx = state.exercises[curExIdx];
      if (!curEx) return state;

      // Prevent duplicate completion of the same set
      if (curEx.setsState[curSetIdx]) return state;

      const updatedSetsState = [...curEx.setsState];
      updatedSetsState[curSetIdx] = true;

      const newSetLog: WorkoutSetLog = {
        setNumber: curSetIdx + 1,
        targetReps: allPlanExercises[curExIdx]?.targetReps || "",
        actualReps: action.actualReps,
        actualWeightKg: action.actualWeightKg,
        completed: true,
        difficulty: action.difficulty,
        timestamp: now
      };

      const updatedExercises = [...state.exercises];
      updatedExercises[curExIdx] = {
        ...curEx,
        completedSets: curEx.completedSets + 1,
        setsState: updatedSetsState,
        setLogs: [...curEx.setLogs, newSetLog]
      };

      const newCompletedSets = state.completedSets + 1;
      const isLastSetOfExercise = curSetIdx + 1 >= curEx.targetSets;
      const isLastExercise = curExIdx + 1 >= state.exercises.length;

      // Check if entire workout is complete
      if (isLastSetOfExercise && isLastExercise) {
        return {
          ...state,
          exercises: updatedExercises,
          completedSets: newCompletedSets,
          status: "WORKOUT_COMPLETED",
          completedTime: now,
          isRestTimerRunning: false
        };
      }

      // Rest period before next set or next exercise
      const restSec = allPlanExercises[curExIdx]?.restSeconds || 60;
      return {
        ...state,
        exercises: updatedExercises,
        completedSets: newCompletedSets,
        status: "REST",
        restTimerSeconds: restSec,
        isRestTimerRunning: true
      };
    }

    case "SKIP_REST": {
      if (state.status !== "REST") return state;
      const curEx = state.exercises[state.activeExerciseIndex];
      const nextSetIdx = state.activeSetIndex + 1;

      if (curEx && nextSetIdx < curEx.targetSets) {
        return {
          ...state,
          status: "SET_ACTIVE",
          activeSetIndex: nextSetIdx,
          isRestTimerRunning: false
        };
      }

      // Move to next exercise
      const nextExIdx = state.activeExerciseIndex + 1;
      if (nextExIdx < state.exercises.length) {
        return {
          ...state,
          status: "SET_ACTIVE",
          activeExerciseIndex: nextExIdx,
          activeSetIndex: 0,
          isRestTimerRunning: false
        };
      }

      return {
        ...state,
        status: "WORKOUT_COMPLETED",
        completedTime: now,
        isRestTimerRunning: false
      };
    }

    case "ADD_REST_TIME": {
      return {
        ...state,
        restTimerSeconds: state.restTimerSeconds + action.seconds
      };
    }

    case "SKIP_SET": {
      const curExIdx = state.activeExerciseIndex;
      const curEx = state.exercises[curExIdx];
      if (!curEx) return state;

      const nextSetIdx = state.activeSetIndex + 1;
      if (nextSetIdx < curEx.targetSets) {
        return {
          ...state,
          activeSetIndex: nextSetIdx,
          status: "SET_ACTIVE"
        };
      }

      // Skip to next exercise
      const nextExIdx = curExIdx + 1;
      if (nextExIdx < state.exercises.length) {
        return {
          ...state,
          activeExerciseIndex: nextExIdx,
          activeSetIndex: 0,
          status: "SET_ACTIVE"
        };
      }

      return {
        ...state,
        status: "WORKOUT_COMPLETED",
        completedTime: now
      };
    }

    case "SKIP_EXERCISE": {
      const curExIdx = state.activeExerciseIndex;
      const updatedExercises = [...state.exercises];
      if (updatedExercises[curExIdx]) {
        updatedExercises[curExIdx] = {
          ...updatedExercises[curExIdx],
          skipped: true,
          skipReason: action.reason || "Skipped by user"
        };
      }

      const nextExIdx = curExIdx + 1;
      if (nextExIdx < state.exercises.length) {
        return {
          ...state,
          exercises: updatedExercises,
          activeExerciseIndex: nextExIdx,
          activeSetIndex: 0,
          status: "SET_ACTIVE"
        };
      }

      return {
        ...state,
        exercises: updatedExercises,
        status: "WORKOUT_COMPLETED",
        completedTime: now
      };
    }

    case "PAUSE_WORKOUT": {
      if (state.status === "WORKOUT_COMPLETED" || state.status === "ABANDONED") return state;
      return {
        ...state,
        status: "PAUSED",
        isRestTimerRunning: false
      };
    }

    case "RESUME_WORKOUT": {
      if (state.status !== "PAUSED") return state;
      return {
        ...state,
        status: "SET_ACTIVE"
      };
    }

    case "REPORT_PAIN": {
      // In-workout safety priority: Mark current exercise as interrupted due to pain
      const curExIdx = state.activeExerciseIndex;
      const updatedExercises = [...state.exercises];
      if (updatedExercises[curExIdx]) {
        updatedExercises[curExIdx] = {
          ...updatedExercises[curExIdx],
          skipped: true,
          painReported: true,
          skipReason: `Dihentikan karena rasa tidak nyaman pada ${action.bodyArea}: ${action.note || ""}`
        };
      }

      const nextExIdx = curExIdx + 1;
      return {
        ...state,
        exercises: updatedExercises,
        painReportedDuringSession: true,
        activeExerciseIndex: Math.min(nextExIdx, state.exercises.length - 1),
        activeSetIndex: 0,
        status: nextExIdx < state.exercises.length ? "SET_ACTIVE" : "WORKOUT_COMPLETED",
        aiAdjustments: [
          ...(state.aiAdjustments || []),
          {
            reason: `Nyeri dilaporkan pada area ${action.bodyArea}`,
            originalValue: state.exercises[curExIdx]?.name,
            adjustedValue: "Gerakan dihentikan demi keamanan sendi",
            timestamp: now
          }
        ]
      };
    }

    case "ABANDON_WORKOUT": {
      return {
        ...state,
        status: "ABANDONED",
        completedTime: now,
        isRestTimerRunning: false
      };
    }

    case "FINISH_WORKOUT": {
      return {
        ...state,
        status: "WORKOUT_COMPLETED",
        overallDifficulty: action.overallDifficulty,
        userFeedbackNote: action.feedbackNote,
        completedTime: now,
        isRestTimerRunning: false
      };
    }

    default:
      return state;
  }
}

// ─── 10. ADAPTIVE PROGRESSION LOOP ───────────────────────────────────────────

/**
 * Computes progressive overload or deload recommendations for the NEXT workout.
 * Guardrails: Never blind-progress on "Easy"; never fabricate load; consider recovery.
 */
export function calculateNextWorkoutAdaptation(
  sessionState: WorkoutSessionState,
  recovery: RecoveryContext
): {
  recommendation: "increase_reps" | "increase_sets" | "maintain" | "deload" | "safety_modify";
  adjustmentSummary: string;
  rationale: string;
} {
  // If pain was reported, safety layer forces modification
  if (sessionState.painReportedDuringSession) {
    return {
      recommendation: "safety_modify",
      adjustmentSummary: "Penyesuaian gerakan ramah sendi untuk sesi berikutnya",
      rationale: "Karena kamu merasakan ketidaknyamanan saat sesi tadi, sesi berikutnya otomatis menggunakan variasi gerakan yang tidak membebani area tersebut."
    };
  }

  const completionRate = sessionState.totalSets > 0
    ? sessionState.completedSets / sessionState.totalSets
    : 0;

  const difficulty = sessionState.overallDifficulty || "good";

  // Incomplete workout: hold steady
  if (completionRate < 0.75) {
    return {
      recommendation: "maintain",
      adjustmentSummary: "Pertahankan target repetisi saat ini",
      rationale: "Kamu menyelesaikan sebagian sesi tadi. Kita pertahankan target saat ini agar tubuh beradaptasi secara bertahap."
    };
  }

  // Poor recovery: force deload/maintain regardless of perceived difficulty
  if (recovery.recoveryScore === "poor") {
    return {
      recommendation: "deload",
      adjustmentSummary: "Jaga beban dan volume tetap terkontrol",
      rationale: "Volume latihanmu dalam beberapa hari terakhir sudah tinggi. Kita jaga sesi berikutnya tetap terkontrol untuk memfasilitasi pemulihan otot."
    };
  }

  // Easy + 100% completion + adequate recovery -> Consider small rep progression
  if (difficulty === "easy" && completionRate >= 0.95 && recovery.recoveryScore === "high") {
    return {
      recommendation: "increase_reps",
      adjustmentSummary: "Sedikit tingkatkan target repetisi (+1–2 reps)",
      rationale: "Kamu menyelesaikan seluruh set tadi dengan mudah dan kondisi pemulihanmu sangat baik. Di sesi depan, kita coba naikkan target repetisi secara terukur."
    };
  }

  // Very Hard -> Reduce volume / hold steady
  if (difficulty === "very_hard") {
    return {
      recommendation: "deload",
      adjustmentSummary: "Sedikit turunkan volume agar form gerakan tetap presisi",
      rationale: "Sesi tadi terasa sangat berat. Sesi berikutnya akan disesuaikan agar kamu bisa fokus pada kualitas form tanpa risiko kelelahan berlebih."
    };
  }

  // Default / Good -> Maintain
  return {
    recommendation: "maintain",
    adjustmentSummary: "Pertahankan ritme dan intensitas saat ini",
    rationale: "Konsistensimu sangat baik! Pertahankan pola latihan dan eksekusi teknik ini di sesi berikutnya."
  };
}

// ─── 11. IMMUTABLE COMPLETED WORKOUT ACTIVITY MODEL ─────────────────────────

export interface CompletedExerciseRecord {
  id: string;
  name: string;
  targetSets: number;
  completedSets: number;
  targetReps: string;
  status: "completed" | "partial" | "skipped";
}

export interface CompletedWorkoutActivity {
  activityId: string;
  workoutId: string; // matches plan.id
  completedAt: string; // ISO 8601 string
  date: string; // YYYY-MM-DD
  dayName: string;
  workoutTitle: string;
  plannedDuration: number;
  actualDurationSeconds: number;
  actualDurationMinutes: number;
  completedSets: number;
  totalSets: number;
  completionPercentage: number;
  difficultyFeedback: PerceivedDifficulty;
  difficultyLabel?: string;
  exercises: CompletedExerciseRecord[];
  nextAdaptation?: {
    recommendation: string;
    adjustmentSummary: string;
    rationale: string;
  };
  phone?: string;
}

/**
 * Creates a stable, idempotent CompletedWorkoutActivity record.
 */
export function createCompletedWorkoutRecord(
  session: WorkoutSessionState,
  plan: WorkoutPlan,
  actualDurationSeconds: number,
  difficulty: PerceivedDifficulty,
  nextAdaptation?: any,
  phone?: string
): CompletedWorkoutActivity {
  let normPhone = "anonymous";
  if (phone) {
    let cleaned = String(phone).replace(/\D/g, "");
    if (cleaned.startsWith("62")) cleaned = "0" + cleaned.substring(2);
    else if (cleaned.startsWith("8")) cleaned = "0" + cleaned;
    normPhone = cleaned || "anonymous";
  }
  const now = new Date();
  const dateStr = plan.date || now.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const allPlanExercises = plan.cardio ? [...plan.mainExercises, plan.cardio] : plan.mainExercises;

  // Build stable exercise records
  const exercises: CompletedExerciseRecord[] = allPlanExercises.map((pEx, idx) => {
    const sEx = (session.exercises || []).find(
      e => e.exerciseId === pEx.exerciseId || e.name.toLowerCase() === pEx.name.toLowerCase()
    );
    const completedSets = sEx ? sEx.completedSets : (pEx.targetSets || 1);
    const targetSets = pEx.targetSets || 1;
    let status: "completed" | "partial" | "skipped" = "completed";
    if (completedSets === 0) status = "skipped";
    else if (completedSets < targetSets) status = "partial";

    return {
      id: pEx.exerciseId || `ex-${idx + 1}`,
      name: pEx.name,
      targetSets,
      completedSets,
      targetReps: pEx.targetReps || "10-12 Reps",
      status
    };
  });

  const completedSets = session.completedSets > 0 
    ? session.completedSets 
    : exercises.reduce((sum, e) => sum + e.completedSets, 0);
  const totalSets = session.totalSets > 0 
    ? session.totalSets 
    : exercises.reduce((sum, e) => sum + e.targetSets, 0);
  const completionPercentage = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 100;

  // Stable activity ID based on date, phone, planId (deterministic, prevents duplicate entries)
  const activityId = `act_${normPhone}_${dateStr}_${plan.id}`;

  return {
    activityId,
    workoutId: plan.id,
    completedAt: now.toISOString(),
    date: dateStr,
    dayName: plan.dayName || "Hari Ini",
    workoutTitle: plan.focus || "Latihan Harian",
    plannedDuration: plan.targetDuration,
    actualDurationSeconds,
    actualDurationMinutes: Math.max(1, Math.round(actualDurationSeconds / 60)),
    completedSets,
    totalSets,
    completionPercentage,
    difficultyFeedback: difficulty,
    difficultyLabel: difficulty === "easy" ? "Mudah" : difficulty === "hard" ? "Berat" : difficulty === "very_hard" ? "Sangat Berat" : "Pas / Optimal",
    exercises,
    nextAdaptation,
    phone: normPhone
  };
}

