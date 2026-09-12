import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { getApiBaseUrl, canonicalApiFetch, getWhatsAppDestinationUrl, openWhatsAppSafely } from "../utils/api";
import {
  ArrowLeft,
  Dumbbell,
  Flame,
  HeartPulse,
  Leaf,
  Activity,
  Check,
  User,
  Scale,
  Ruler,
  Calendar,
  Target,
  Smile,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
  Zap,
  Clock,
  Utensils,
  TrendingUp,
  TrendingDown,
  Brain,
  CheckCircle2,
  Sliders,
  HelpCircle,
  Sparkles,
  Lock,
  RefreshCw
} from "lucide-react";
import { normalizePhoneToE164 } from "../services/phoneNormalizer";
import {
  PLAN_PRICING,
  DURATIONS,
  DURATION_LABELS,
  getPrice,
  type PlanKey,
  type DurationKey
} from "../services/pricingConfig";

// WhatsApp Icon component
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const OptionCard = ({
  children,
  className = "",
  onClick,
  selected = false,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
  key?: React.Key;
}) => {
  return (
    <motion.div
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.995 }}
      onClick={onClick}
      className={`relative cursor-pointer rounded-xl p-4 sm:p-5 transition-all duration-150 border ${
        selected
          ? "bg-[#182130] border-[#D4FF00] text-white"
          : "bg-[#111620] border-neutral-800/90 hover:border-neutral-700 hover:bg-[#151C28] text-neutral-300"
      } ${className}`}
    >
      {children}
    </motion.div>
  );
};

interface OnboardingProps {
  language?: "EN" | "ID";
  onComplete?: () => void;
  onOpenLogin?: (prefilledPhone?: string) => void;
}

export default function Onboarding({ language = "EN", onComplete, onOpenLogin }: OnboardingProps) {
  const isEN = language === "EN";
  const [step, setStep] = useState(1);
  const totalSteps = 12;

  // Existing Account & Phone Verification States
  const [existingAccountDetected, setExistingAccountDetected] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [phoneCheckError, setPhoneCheckError] = useState<string | null>(null);
  const [isSubmittingFinalOnboarding, setIsSubmittingFinalOnboarding] = useState(false);
  const [finalOnboardingError, setFinalOnboardingError] = useState<string | null>(null);

  // Pending User ID, Order & Payment States
  const [pendingUserId, setPendingUserId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("gymbuddy_pending_profile");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.userId) return parsed.userId;
      }
    } catch (e) {}
    return `usr_ob_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  });
  const [orderId, setOrderId] = useState<string>("");
  const [snapToken, setSnapToken] = useState<string>("");
  const [snapRedirectUrl, setSnapRedirectUrl] = useState<string>("");
  const [backendBotNumber, setBackendBotNumber] = useState<string>("");
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isPaymentPaid, setIsPaymentPaid] = useState(false);
  const [isConnectingWhatsApp, setIsConnectingWhatsApp] = useState(false);
  const [connectWhatsAppError, setConnectWhatsAppError] = useState<string | null>(null);
  const [commitmentLevel, setCommitmentLevel] = useState("15min");

  // Restore pending onboarding progress from localStorage if available
  useEffect(() => {
    try {
      const savedProfileStr = localStorage.getItem("gymbuddy_pending_profile");
      if (savedProfileStr) {
        const p = JSON.parse(savedProfileStr);
        if (p.phone) setPhone(p.phone);
        if (p.name) setName(p.name);
        if (p.goal) setGoal(p.goal);
        if (p.gender) setGender(p.gender);
        if (p.weight) setWeight(String(p.weight));
        if (p.targetWeight) setUserTargetWeight(String(p.targetWeight));
        if (p.height) setHeight(String(p.height));
        if (p.age) setAge(String(p.age));
        if (p.dob) setDob(p.dob);
        if (p.injuries && Array.isArray(p.injuries)) setInjuries(p.injuries);
        if (p.allergies && Array.isArray(p.allergies)) setAllergies(p.allergies);
        if (p.equipment) setEquipment(p.equipment);
        if (p.workoutDuration) setWorkoutDuration(Number(p.workoutDuration) as any);
        if (p.workoutFrequency) setWorkoutFrequency(p.workoutFrequency);
        if (p.fitnessLevel) setFitnessLevel(p.fitnessLevel);
        if (p.hasInjury) setHasInjury(p.hasInjury);
        if (p.selectedBodyAreas && Array.isArray(p.selectedBodyAreas)) setSelectedBodyAreas(p.selectedBodyAreas);
        if (p.injurySeverity) setInjurySeverity(p.injurySeverity);
        if (p.selectedPainTriggers && Array.isArray(p.selectedPainTriggers)) setSelectedPainTriggers(p.selectedPainTriggers);
        if (p.persona) setPersona(p.persona);
        if (p.commitmentLevel) setCommitmentLevel(p.commitmentLevel);
        if (p.userId) setPendingUserId(p.userId);
      }
    } catch (e) {}
  }, []);

  // Form States
  const [name, setName] = useState("");

  // Load Midtrans Snap SDK on mount
  useEffect(() => {
    const clientKey =
      (import.meta as any).env?.VITE_MIDTRANS_CLIENT_KEY ||
      "SB-Mid-client-CAT2gMLueDV0amD7";
    const isSandboxKey = clientKey.startsWith("SB-");
    const isProduction =
      !isSandboxKey && (import.meta as any).env?.VITE_MIDTRANS_IS_PRODUCTION === "true";

    const snapSrc = isProduction
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";

    if (!document.querySelector(`script[src="${snapSrc}"]`)) {
      const script = document.createElement("script");
      script.src = snapSrc;
      script.setAttribute("data-client-key", clientKey);
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);
  const [goal, setGoal] = useState<"maintain" | "lose" | "gain" | "health">("maintain");
  const [goalEvent, setGoalEvent] = useState("daily");
  const [goalSecondary, setGoalSecondary] = useState<string[]>(["portion_control"]);
  const [emotionalVision, setEmotionalVision] = useState("confidence");

  // Personal & Biometrics
  const [gender, setGender] = useState<"pria" | "wanita">("pria");
  const [weight, setWeight] = useState("65");
  const [height, setHeight] = useState("170");
  const [dob, setDob] = useState("");
  const [dobError, setDobError] = useState(false);
  const [age, setAge] = useState("25");
  const [userTargetWeight, setUserTargetWeight] = useState("");
  const [allergies, setAllergies] = useState<string[]>(["none"]);

  // Health Profile State
  const [healthStatus, setHealthStatus] = useState<"no_condition" | "has_condition" | "prefer_not_to_say">("no_condition");
  const [healthConditions, setHealthConditions] = useState<string[]>([]);
  const [otherCondition, setOtherCondition] = useState("");

  const handleDobChange = (newDob: string) => {
    setDob(newDob);
    if (newDob && newDob.trim()) {
      setDobError(false);
    }
    if (newDob && /^\d{4}-\d{2}-\d{2}$/.test(newDob)) {
      const d = new Date(newDob);
      if (!isNaN(d.getTime())) {
        const today = new Date();
        let calculated = today.getFullYear() - d.getFullYear();
        const m = today.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
          calculated--;
        }
        if (calculated >= 10 && calculated <= 120) {
          setAge(String(calculated));
        }
      }
    }
  };

  const toggleHealthCondition = (conditionName: string) => {
    setHealthConditions((prev) => {
      if (prev.includes(conditionName)) {
        return prev.filter((c) => c !== conditionName);
      } else {
        return [...prev, conditionName];
      }
    });
  };

  const getAgeGroupLabel = (ageNum: number) => {
    if (ageNum < 13) return isEN ? "Child (<13 yrs)" : "Anak (<13 th)";
    if (ageNum <= 17) return isEN ? "Teen (13-17 yrs)" : "Remaja (13-17 th)";
    if (ageNum < 60) return isEN ? "Adult (18-59 yrs)" : "Dewasa (18-59 th)";
    return isEN ? "Older Adult (60+ yrs)" : "Lansia (60+ th)";
  };

  const toggleAllergy = (allergyId: string) => {
    setAllergies((prev) => {
      if (allergyId === "none") return ["none"];
      const filtered = prev.filter((a) => a !== "none");
      if (filtered.includes(allergyId)) {
        const next = filtered.filter((a) => a !== allergyId);
        return next.length === 0 ? ["none"] : next;
      } else {
        return [...filtered, allergyId];
      }
    });
  };

  // Lifestyle & Workout Constraints
  const [activityLevel, setActivityLevel] = useState("sedentary");
  const [experience, setExperience] = useState("beginner");
  const [satisfaction, setSatisfaction] = useState("medium");
  const [challenges, setChallenges] = useState<string[]>(["nyerah", "gorengan"]);

  // Physical Limitations / Injuries & Equipment
  const [injuries, setInjuries] = useState<string[]>(["none"]);
  const [customInjury, setCustomInjury] = useState("");
  const [equipment, setEquipment] = useState<"full_gym" | "dumbbells" | "barbell" | "resistance_bands" | "machines" | "bodyweight" | "other">("full_gym");
  const [workoutDuration, setWorkoutDuration] = useState<15 | 30 | 45 | 60>(45);
  const [workoutFrequency, setWorkoutFrequency] = useState<"1-2" | "3-4" | "5+">("3-4");
  const [fitnessLevel, setFitnessLevel] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [hasInjury, setHasInjury] = useState<"no" | "yes">("no");
  const [selectedBodyAreas, setSelectedBodyAreas] = useState<string[]>([]);
  const [injurySeverity, setInjurySeverity] = useState<"mild" | "moderate" | "severe">("mild");
  const [selectedPainTriggers, setSelectedPainTriggers] = useState<string[]>([]);

  // Persona Selection
  const [persona, setPersona] = useState<"max" | "mia">("max");

  // Plan Selection ('free_trial' | 'advanced' | 'premium')
  const [selectedPlan, setSelectedPlan] = useState<"free_trial" | "advanced" | "premium">("free_trial");
  const [selectedFeature, setSelectedFeature] = useState<"nutrition" | "coach" | null>("coach");
  const [selectedDuration, setSelectedDuration] = useState<DurationKey>("3_months");

  // Phone Delivery
  const [phone, setPhone] = useState("");

  // Loading Screen Messages
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const loadingMsgs = isEN
    ? [
        "Analyzing BMR & Body Metabolism...",
        "Calculating Daily Calorie & Macro Targets...",
        "Structuring Strategy Based on Your Challenges...",
        "Setting up GymBuddy WhatsApp Assistant Integration..."
      ]
    : [
        "Menganalisis BMR & Metabolisme Tubuh...",
        "Menghitung Target Kalori & Makro Harian...",
        "Menyiapkan Strategi Berdasarkan Tantangan...",
        "Menyiapkan Integrasi Asisten WhatsApp GymBuddy..."
      ];

  // Create Order for Free or Paid Plan
  const handleCreateOrder = async (
    targetPlan: "free_trial" | "advanced" | "premium",
    targetFeature: "coach" | "nutrition" | null,
    targetDuration: DurationKey = selectedDuration
  ) => {
    setIsCreatingOrder(true);
    setPaymentError(null);

    const cleanPhone = phone.replace(/\D/g, "");
    const canonicalPhone = cleanPhone.startsWith("62") ? cleanPhone : (cleanPhone.startsWith("0") ? "62" + cleanPhone.substring(1) : "62" + cleanPhone);

    const isFree = targetPlan === "free_trial";
    const canonicalPlan: PlanKey =
      isFree || targetPlan === "premium"
        ? "both"
        : targetFeature === "nutrition"
        ? "nutritionist"
        : "workout_coach";
    const planParam = isFree ? "free" : canonicalPlan;
    const serviceParam = isFree ? "both" : (targetPlan === "premium" ? "both" : (targetFeature || "coach"));
    const amountParam = isFree ? 0 : getPrice(canonicalPlan, targetDuration);

    try {
      const res = await canonicalApiFetch<{ success: boolean; order?: any; token?: string; redirectUrl?: string; error?: string; message?: string }>(
        "/api/orders/create",
        {
          method: "POST",
          body: JSON.stringify({
            userId: pendingUserId,
            phone: canonicalPhone,
            plan: planParam,
            activeService: serviceParam,
            amount: amountParam,
            billingPeriod: isFree ? "free_trial" : targetDuration,
            duration: targetDuration,
            customerName: name || "Member GymBuddy",
            isOnboarding: true
          })
        }
      );

      if (!res || !res.success || !res.order) {
        throw new Error(res?.message || res?.error || (isEN ? "Failed to process order. Please try again." : "Gagal memproses pesanan. Silakan coba kembali."));
      }

      setOrderId(res.order.orderId);
      if (res.token) setSnapToken(res.token);
      if (res.redirectUrl) setSnapRedirectUrl(res.redirectUrl);
      localStorage.setItem("gymbuddy_pending_order", JSON.stringify(res.order));

      setIsCreatingOrder(false);

      if (isFree) {
        await handleConnectWhatsApp();
      } else {
        setStep(15); // Direct to Order Summary / Checkout for Paid
      }
    } catch (err: any) {
      console.error("[Onboarding] Order creation failed:", err);
      setIsCreatingOrder(false);
      setPaymentError(err.message || "Gagal memproses pesanan. Silakan coba kembali.");
    }
  };

  // Launch Midtrans Snap Payment Gateway
  const triggerSnapPayment = (tokenOverride?: string) => {
    const token = tokenOverride || snapToken;
    setPaymentError(null);

    if (!token) {
      setPaymentError(isEN ? "Payment session expired. Please retry." : "Sesi pembayaran telah kedaluwarsa. Silakan klik coba bayar lagi.");
      return;
    }

    if ((window as any).snap && typeof (window as any).snap.pay === "function") {
      (window as any).snap.pay(token, {
        onSuccess: async (result: any) => {
          console.log("[Midtrans Snap] Payment success:", result);
          setIsPaymentPaid(true);
          await handleConnectWhatsApp();
        },
        onPending: (result: any) => {
          console.log("[Midtrans Snap] Payment pending:", result);
          setIsPaymentPaid(false);
          setPaymentError(isEN ? "Payment is pending. Please complete your payment (Virtual Account / QRIS / Bank Transfer) to activate your account." : "Pembayaran sedang menunggu penyelesaian. Silakan selesaikan pembayaran sesuai petunjuk (Virtual Account / QRIS / Transfer) untuk aktivasi akun.");
        },
        onError: (result: any) => {
          console.warn("[Midtrans Snap] Payment error:", result);
          setPaymentError(isEN ? "Payment was cancelled or failed. You can retry anytime." : "Pembayaran gagal atau dibatalkan. Kamu bisa mencoba bayar lagi kapan saja.");
        },
        onClose: () => {
          console.log("[Midtrans Snap] Closed by customer.");
        }
      });
    } else if (snapRedirectUrl) {
      window.location.href = snapRedirectUrl;
    } else {
      setPaymentError(isEN ? "Payment gateway is loading. Please wait a moment." : "Payment gateway sedang dimuat. Mohon tunggu beberapa saat...");
    }
  };

  // Retry failed/expired payment
  const handleRetryPayment = async () => {
    if (!orderId) return;
    setIsCreatingOrder(true);
    setPaymentError(null);
    try {
      const res = await canonicalApiFetch<{ success: boolean; order?: any; token?: string; redirectUrl?: string; error?: string }>(
        `/api/orders/${orderId}/retry`,
        { method: "POST" }
      );
      if (res && res.success && res.token) {
        setSnapToken(res.token);
        if (res.redirectUrl) setSnapRedirectUrl(res.redirectUrl);
        setIsCreatingOrder(false);
        triggerSnapPayment(res.token);
      } else {
        throw new Error(res?.error || "Gagal memperbarui transaksi.");
      }
    } catch (e: any) {
      setIsCreatingOrder(false);
      setPaymentError(e.message || "Gagal mengulang pembayaran.");
    }
  };

  // Save profile and advance to Step 13 (Plan Selection)
  const handleSaveProfileAndContinue = async () => {
    setIsCreatingOrder(true);
    const userW = Number(weight) || 65;
    const userH = Number(height) || 170;
    const userA = Number(age) || 25;
    const userG = gender || "pria";
    const userGoal = goal || "lose";
    const hM = userH / 100;
    const bmiIdealW = Math.round(22 * hM * hM * 2) / 2;
    const recW = Math.min(userW - 2, Math.max(45, bmiIdealW));
    let targetW = Number(userTargetWeight) || userW;
    if (userGoal === "lose" && !userTargetWeight) targetW = recW;
    else if (userGoal === "gain" && !userTargetWeight) targetW = userW + 5;

    const bmr = userG === "wanita"
      ? 10 * userW + 6.25 * userH - 5 * userA - 161
      : 10 * userW + 6.25 * userH - 5 * userA + 5;
    const actMultipliers: Record<string, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, heavy: 1.725 };
    const tdee = Math.round(bmr * (actMultipliers[activityLevel] || 1.375));
    let targetCal = tdee;
    if (userGoal === "lose") targetCal = Math.max(1200, Math.round(tdee - 500));
    else if (userGoal === "gain") targetCal = Math.round(tdee + 400);

    const proteinGram = Math.round((targetCal * 0.30) / 4);
    const carbsGram = Math.round((targetCal * 0.45) / 4);
    const fatGram = Math.round((targetCal * 0.25) / 9);

    const cleanPhone = phone.replace(/\D/g, "");
    const canonicalPhone = cleanPhone.startsWith("62") ? cleanPhone : (cleanPhone.startsWith("0") ? "62" + cleanPhone.substring(1) : "62" + cleanPhone);

    const profileObj = {
      userId: pendingUserId,
      phone: canonicalPhone,
      normalizedPhone: canonicalPhone,
      name: name || "Member",
      goal,
      goalTitle: goal === "lose" ? "Menurunkan Berat Badan" : (goal === "gain" ? "Menaikkan Berat Badan" : "Gaya Hidup Sehat & Fit"),
      goalEvent,
      goalSecondary,
      emotionalVision,
      gender,
      weight: userW,
      startWeight: userW,
      targetWeight: targetW,
      aiRecommendedTargetWeight: recW,
      height: userH,
      age: userA,
      dob: dob || "",
      healthStatus,
      healthConditions,
      otherCondition,
      activityLevel,
      experience,
      satisfaction,
      challenges,
      injuries,
      customInjury,
      allergies: allergies.length > 0 ? allergies : ["none"],
      equipment,
      workoutDuration,
      workoutFrequency,
      fitnessLevel,
      hasInjury,
      selectedBodyAreas,
      injurySeverity,
      selectedPainTriggers,
      injuryLimitations: hasInjury === "yes" && selectedBodyAreas.length > 0
        ? selectedBodyAreas.map(area => ({
            bodyArea: area,
            severity: injurySeverity,
            painTriggers: selectedPainTriggers,
            notes: customInjury
          }))
        : [],
      persona,
      commitmentLevel,
      targetCalories: targetCal,
      dailyTargetCalories: targetCal,
      proteinGrams: proteinGram,
      dailyTargetProtein: proteinGram,
      carbGrams: carbsGram,
      dailyTargetCarbs: carbsGram,
      fatGrams: fatGram,
      dailyTargetFat: fatGram,
      fiberGrams: Math.max(20, Math.min(38, Math.round(targetCal / 75))),
      selectedFeature: (selectedPlan === "premium" || selectedPlan === "both") ? "both" : (selectedFeature || "coach"),
      activeService: (selectedPlan === "premium" || selectedPlan === "both") ? "both" : (selectedFeature || "coach"),
      onboardingCompleted: true
    };

    try {
      localStorage.setItem("gymbuddy_pending_profile", JSON.stringify(profileObj));
      await canonicalApiFetch("/api/onboarding/profile", {
        method: "POST",
        body: JSON.stringify({ userId: pendingUserId, phone: canonicalPhone, profile: profileObj })
      });
    } catch (e) {
      console.warn("[Onboarding] Note saving profile:", e);
    } finally {
      setIsCreatingOrder(false);
      setStep(14);
    }
  };

  // Connect WhatsApp Number to Profile & Order
  const handleConnectWhatsApp = async () => {
    const rawToUse = phone.trim();
    const canonicalPhone = normalizePhoneToE164(rawToUse);

    if (!canonicalPhone) {
      setConnectWhatsAppError(isEN ? "Valid WhatsApp phone number is required." : "Nomor WhatsApp yang valid wajib diisi.");
      return;
    }

    setIsConnectingWhatsApp(true);
    setConnectWhatsAppError(null);

    const userW = Number(weight) || 65;
    const userH = Number(height) || 170;
    const userA = Number(age) || 25;
    const userG = gender || "pria";
    const userGoal = goal || "lose";
    const hM = userH / 100;
    const bmiIdealW = Math.round(22 * hM * hM * 2) / 2;
    const recW = Math.min(userW - 2, Math.max(45, bmiIdealW));
    let targetW = Number(userTargetWeight) || userW;
    if (userGoal === "lose" && !userTargetWeight) targetW = recW;
    else if (userGoal === "gain" && !userTargetWeight) targetW = userW + 5;

    const bmr = userG === "wanita"
      ? 10 * userW + 6.25 * userH - 5 * userA - 161
      : 10 * userW + 6.25 * userH - 5 * userA + 5;
    const actMultipliers: Record<string, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, heavy: 1.725 };
    const tdee = Math.round(bmr * (actMultipliers[activityLevel] || 1.375));
    let targetCal = tdee;
    if (userGoal === "lose") targetCal = Math.max(1200, Math.round(tdee - 500));
    else if (userGoal === "gain") targetCal = Math.round(tdee + 400);

    const proteinGram = Math.round((targetCal * 0.30) / 4);
    const carbsGram = Math.round((targetCal * 0.45) / 4);
    const fatGram = Math.round((targetCal * 0.25) / 9);

    const fullProfile = {
      userId: pendingUserId,
      name: name || "Member",
      goal,
      goalTitle: goal === "lose" ? "Menurunkan Berat Badan" : (goal === "gain" ? "Menaikkan Berat Badan" : "Gaya Hidup Sehat & Fit"),
      goalEvent,
      goalSecondary,
      emotionalVision,
      gender,
      weight: userW,
      startWeight: userW,
      targetWeight: targetW,
      aiRecommendedTargetWeight: recW,
      height: userH,
      age: userA,
      dob: dob || "",
      healthStatus,
      healthConditions,
      otherCondition,
      activityLevel,
      experience,
      satisfaction,
      challenges,
      injuries,
      customInjury,
      allergies: allergies.length > 0 ? allergies : ["none"],
      equipment,
      persona,
      commitmentLevel,
      selectedPlan,
      selectedFeature: (selectedPlan === "premium" || selectedPlan === "both") ? "both" : (selectedFeature || "coach"),
      targetCalories: targetCal,
      dailyTargetCalories: targetCal,
      proteinGrams: proteinGram,
      dailyTargetProtein: proteinGram,
      carbGrams: carbsGram,
      dailyTargetCarbs: carbsGram,
      fatGrams: fatGram,
      dailyTargetFat: fatGram,
      fiberGrams: Math.max(20, Math.min(38, Math.round(targetCal / 75))),
      activeService: (selectedPlan === "premium" || selectedPlan === "both") ? "both" : (selectedFeature || "coach"),
      onboardingCompleted: true
    };

    try {
      const res = await canonicalApiFetch<{ success: boolean; user?: any; order?: any; token?: string; error?: string }>(
        "/api/account/connect-whatsapp",
        {
          method: "POST",
          body: JSON.stringify({
            userId: pendingUserId,
            orderId: orderId || undefined,
            phone: canonicalPhone,
            profileFallback: fullProfile
          })
        }
      );

      if (!res || !res.success || !res.user) {
        if (res?.error === "account_already_exists") {
          setExistingAccountDetected(true);
          setIsConnectingWhatsApp(false);
          return;
        }
        throw new Error(res?.error || "Gagal menghubungkan nomor WhatsApp");
      }

      const activeUser = res.user;
      const cleaned = canonicalPhone.replace(/\D/g, "");
      const norm = cleaned.startsWith("62") ? "0" + cleaned.substring(2) : cleaned;

      localStorage.setItem(`gymbuddy_user_${norm}`, JSON.stringify(activeUser));
      localStorage.setItem(`gymbuddy_user_${canonicalPhone}`, JSON.stringify(activeUser));
      localStorage.setItem("gymbuddy_last_user", JSON.stringify(activeUser));
      localStorage.setItem("gymbuddy_active_session", JSON.stringify(activeUser));
      if (res.token) {
        localStorage.setItem("gymbuddy_auth_token", res.token);
      }
      if ((res as any)?.botNumber) {
        setBackendBotNumber((res as any).botNumber);
      }

      setIsConnectingWhatsApp(false);
      setStep(16);
    } catch (err: any) {
      console.error("[Onboarding] Connect WhatsApp error:", err);
      setIsConnectingWhatsApp(false);
      setConnectWhatsAppError(err.message || "Gagal menghubungkan WhatsApp. Silakan coba lagi.");
    }
  };

  const handleNext = async () => {
    if (step === 1) {
      const val = validateWhatsAppPhone(phone);
      if (!val.isValid) {
        setPhoneCheckError(val.message);
        return;
      }
      const clean = val.cleaned;
      const canonicalPhone = "62" + clean;

      setIsCheckingPhone(true);
      setPhoneCheckError(null);
      try {
        const res = await canonicalApiFetch<{
          exists: boolean;
          canOnboard?: boolean;
          userId?: string;
          canonicalPhone?: string;
          isDeleted?: boolean;
          error?: string;
        }>("/api/auth/check-phone", {
          method: "POST",
          body: JSON.stringify({ phone: canonicalPhone })
        });

        if (res && res.exists && !res.canOnboard) {
          setExistingAccountDetected(true);
          setIsCheckingPhone(false);
          return;
        }

        if (res?.userId) {
          setPendingUserId(res.userId);
        }
        setIsCheckingPhone(false);
        setStep(2);
      } catch (err: any) {
        console.warn("[Onboarding] Check phone error, proceeding:", err);
        setIsCheckingPhone(false);
        setStep(2);
      }
      return;
    }

    if (step === 7 && !dob.trim()) {
      setDobError(true);
      return;
    }
    setStep((p) => Math.min(p + 1, 16));
  };

  const handlePrev = () => {
    if (step === 15) {
      setStep(14);
      return;
    }
    if (step === 14) {
      setStep(13);
      return;
    }
    if (step === 13) {
      setStep(12);
      return;
    }
    setStep((p) => Math.max(p - 1, 1));
  };

  const toggleSecondaryGoal = (id: string) => {
    setGoalSecondary((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleChallenge = (id: string) => {
    setChallenges((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // WhatsApp Phone Number Validator (Indonesian mobile prefixes & lengths)
  const validateWhatsAppPhone = (raw: string) => {
    let clean = raw.replace(/\D/g, "");
    if (clean.startsWith("62")) clean = clean.substring(2);
    else if (clean.startsWith("0")) clean = clean.substring(1);

    if (clean.length === 0) {
      return {
        isValid: false,
        cleaned: "",
        operator: "",
        message: isEN ? "Enter your active WhatsApp number." : "Masukkan nomor WhatsApp aktif Anda.",
        status: "empty"
      };
    }

    if (!clean.startsWith("8")) {
      return {
        isValid: false,
        cleaned: clean,
        operator: "",
        message: isEN ? "Indonesian mobile numbers start with 8 (e.g. 812...)" : "Nomor HP Indonesia diawali angka 8 (misal: 812...)",
        status: "invalid_prefix"
      };
    }

    let operator = "WhatsApp";
    if (/^(811|812|813|821|822|823|851|852|853)/.test(clean)) operator = "Telkomsel / by.U";
    else if (/^(814|815|816|855|856|857|858)/.test(clean)) operator = "Indosat / IM3";
    else if (/^(817|818|819|859|877|878)/.test(clean)) operator = "XL / AXIS";
    else if (/^(895|896|897|898|899)/.test(clean)) operator = "Tri (3)";
    else if (/^(881|882|883|884|885|886|887|888|889)/.test(clean)) operator = "Smartfren";

    if (clean.length < 9) {
      return {
        isValid: false,
        cleaned: clean,
        operator,
        message: isEN ? `Number incomplete (${clean.length}/9-13 digits)` : `Nomor belum lengkap (${clean.length}/9-13 digit)`,
        status: "too_short"
      };
    }

    if (clean.length > 13) {
      return {
        isValid: false,
        cleaned: clean,
        operator,
        message: isEN ? "Number too long (max 13 digits)" : "Nomor terlalu panjang (maksimal 13 digit)",
        status: "too_long"
      };
    }

    return {
      isValid: true,
      cleaned: clean,
      operator,
      message: isEN ? `Valid WhatsApp number (${operator})` : `Format WhatsApp valid (${operator})`,
      status: "valid"
    };
  };

  const canProceed = () => {
    switch (step) {
      case 1: return validateWhatsAppPhone(phone).isValid;
      case 2: return name.trim().length > 0;
      case 3: return goal !== undefined;
      case 4: return goalEvent !== "" && goalSecondary.length > 0;
      case 5: return emotionalVision !== "";
      case 6: return true; // Analysis 1 screen
      case 7: return weight !== "" && height !== "" && age !== "" && dob.trim() !== "";
      case 8: return activityLevel !== "";
      case 9: return challenges.length > 0;
      case 10: return true; // Analysis 2 screen
      case 11: return persona !== "";
      case 12: return true; // Commitment screen has default
      case 13: return true; // Analysis summary roadmap
      case 14: return selectedPlan !== undefined;
      case 15: return true; // Order summary
      case 16: return true; // Account active
      default: return true;
    }
  };

  const handleGoalSelect = (newGoal: "maintain" | "lose" | "gain" | "health") => {
    setGoal(newGoal);
    setUserTargetWeight("");
    if (newGoal === "maintain") {
      setGoalEvent("daily");
      setGoalSecondary(["portion_control"]);
      setChallenges(["nyerah", "kalori"]);
    } else if (newGoal === "lose") {
      setGoalEvent("target_year");
      setGoalSecondary(["belly_fat"]);
      setChallenges(["gorengan", "malam"]);
    } else if (newGoal === "gain") {
      setGoalEvent("lean_bulk");
      setGoalSecondary(["muscle_definition"]);
      setChallenges(["kenyang", "protein_kurang"]);
    } else {
      setGoalEvent("metabolic");
      setGoalSecondary(["stamina"]);
      setChallenges(["skip_meals", "lemas"]);
    }
  };

  const getChallengesByGoal = () => {
    if (goal === "lose") {
      return [
        { id: "gorengan", icon: Utensils, title: isEN ? "Snacking & High-Calorie Foods" : "Ngemil & Makanan Tinggi Kalori", desc: isEN ? "Cravings for fried snacks, sweets, or processed food." : "Sering lapar mata dan sulit membatasi gorengan atau yang manis." },
        { id: "malam", icon: Clock, title: isEN ? "Late Night Cravings" : "Lapar Mata di Malam Hari", desc: isEN ? "Appetite spikes during evening or relaxation hours." : "Nafsu makan melonjak saat malam atau waktu santai." },
        { id: "kalori", icon: Scale, title: isEN ? "Uncertain Portions & Calorie Counting" : "Bingung Menakar Porsi & Kalori", desc: isEN ? "No time or tools to weigh food grams manually." : "Tidak punya waktu atau timbangan gramasi manual." },
        { id: "masak", icon: Flame, title: isEN ? "Limited Cooking Time" : "Waktu Masak Terbatas", desc: isEN ? "Frequently buying takeout or ordering online food." : "Sering membeli makanan luar atau memesan online." },
        { id: "nyerah", icon: Zap, title: isEN ? "Quitting on Minor Setbacks" : "Mudah Nyerah Saat Khilaf Makan", desc: isEN ? "One cheat meal leads to total diet breakdown." : "Khilaf satu kali membuat diet langsung berantakan." }
      ];
    } else if (goal === "gain") {
      return [
        { id: "kenyang", icon: Utensils, title: isEN ? "Feeling Full Quickly" : "Cepat Kenyang / Susah Makan Banyak", desc: isEN ? "Struggling to finish large calorie-dense meals." : "Sulit menghabiskan porsi makan besar untuk surplus kalori." },
        { id: "protein_kurang", icon: Dumbbell, title: isEN ? "Hard to Meet Daily Protein Target" : "Sulit Memenuhi Target Protein", desc: isEN ? "Unsure which high-protein food sources to choose." : "Bingung mencari sumber makanan tinggi protein yang praktis." },
        { id: "metabolisme_cepat", icon: Zap, title: isEN ? "Fast Metabolism / Hard Gainer" : "Metabolisme Terlalu Cepat (Hard Gainer)", desc: isEN ? "Body burns calories rapidly, hard to gain weight." : "Berat badan sulit naik meskipun merasa sudah makan banyak." },
        { id: "jadwal_latihan", icon: Clock, title: isEN ? "Inconsistent Gym Schedule" : "Jadwal Latihan Kurang Teratur", desc: isEN ? "Busy routines causing missed progressive overload sessions." : "Kesibukan harian membuat sesi latihan sering terlewat." },
        { id: "bingung_menu", icon: Flame, title: isEN ? "Unsure About High-Calorie Meal Prep" : "Bingung Menu Padat Kalori Bersih", desc: isEN ? "Fear of gaining excess belly fat instead of muscle." : "Takut salah makan malah buncit daripada berotot." }
      ];
    } else {
      return [
        { id: "skip_meals", icon: Clock, title: isEN ? "Irregular Meal Times" : "Jam Makan Tidak Teratur", desc: isEN ? "Work schedule causes skipped or delayed meals." : "Jadwal kerja padat sering membuat telat atau skip makan." },
        { id: "lemas", icon: Zap, title: isEN ? "Mid-Day Energy Crashes" : "Mudah Lemas di Siang Hari", desc: isEN ? "Post-lunch fatigue lowering productivity." : "Tubuh mudah mengantuk dan loyo setelah makan siang." },
        { id: "jajan_sembarangan", icon: Utensils, title: isEN ? "Frequent Random Snacking" : "Sering Jajan Sembarangan", desc: isEN ? "Eating without tracking nutritional balance." : "Makan sembarangan tanpa memperhatikan gizi seimbang." },
        { id: "stres_tidur", icon: HeartPulse, title: isEN ? "Stress & Poor Sleep" : "Stres Kerja & Kurang Tidur", desc: isEN ? "Affects metabolism and overall daily well-being." : "Mempengaruhi pemulihan tubuh dan nafsu makan." },
        { id: "konsistensi_olahraga", icon: Dumbbell, title: isEN ? "Maintaining Fitness Consistency" : "Konsistensi Olahraga Rutin", desc: isEN ? "Hard to maintain weekly physical activity routines." : "Sulit menyisihkan waktu rutin untuk aktif bergerak." }
      ];
    }
  };

  // Dynamic Options Map based on Goal
  const getGoalSpecificData = () => {
    switch (goal) {
      case "maintain":
        return {
          title: isEN ? "Maintain Weight" : "Menjaga Berat Badan",
          eventQuestion: isEN ? "Are you preparing for a specific event?" : "Apakah kamu sedang mempersiapkan momen tertentu?",
          events: [
            { id: "wedding", label: isEN ? "Wedding / Special Event" : "Pernikahan / Acara Spesial", desc: isEN ? "Look fit & radiant on your most important day" : "Tampil prima & fit di momen paling penting" },
            { id: "vacation", label: isEN ? "Vacation & Photoshoot" : "Liburan & Photoshoot", desc: isEN ? "Flat stomach & confident in front of camera" : "Perut rata & percaya diri di depan kamera" },
            { id: "reunion", label: isEN ? "Reunion / Work Event" : "Reuni / Acara Kerja", desc: isEN ? "Maintain a fresh & energetic appearance" : "Menjaga tampilan segar & bertenaga" },
            { id: "daily", label: isEN ? "Routine Healthy Lifestyle" : "Gaya Hidup Sehat Rutin", desc: isEN ? "Long-term metabolic consistency & balance" : "Konsistensi & kestabilan metabolisme jangka panjang" }
          ],
          secondaryQuestion: isEN ? "What other achievements do you want to realize?" : "Apa pencapaian lain yang ingin kamu wujudkan?",
          secondaryOptions: [
            { id: "food_joy", label: isEN ? "Enjoy delicious food without guilt or anxiety" : "Makan enak tanpa rasa bersalah atau cemas" },
            { id: "fit_clothes", label: isEN ? "Clothes always fit comfortably" : "Pakaian selalu pas dan nyaman dipakai" },
            { id: "stable_energy", label: isEN ? "Stable energy without afternoon crashes" : "Energi stabil tanpa lemas di jam kerja" },
            { id: "portion_control", label: isEN ? "Full control over meal portions" : "Memegang kendali penuh atas porsi makan" }
          ]
        };
      case "lose":
        return {
          title: isEN ? "Lose Weight" : "Menurunkan Berat Badan",
          eventQuestion: isEN ? "What target timeline or event are you aiming for?" : "Target waktu atau momen apa yang sedang kamu kejar?",
          events: [
            { id: "wedding", label: isEN ? "Important Event (< 3 Months)" : "Event Penting (< 3 Bulan)", desc: isEN ? "Safe & progressive measurable results" : "Hasil terukur secara aman & bertahap" },
            { id: "vacation", label: isEN ? "Vacation / Beach" : "Liburan / Pantai", desc: isEN ? "Reduce belly fat & look leaner" : "Kurangi lemak perut & tampil lebih ramping" },
            { id: "target_year", label: isEN ? "Ideal Weight Goal This Year" : "Target Berat Ideal Tahun Ini", desc: isEN ? "Consistent 2-4 kg weight loss per month" : "Penurunan konsisten 2-4 kg per bulan" },
            { id: "health_boost", label: isEN ? "Daily Health & Stamina" : "Kesehatan & Stamina Harian", desc: isEN ? "Lighten joint strain & feel nimble" : "Mengurangi beban sendi & tubuh lebih ringan" }
          ],
          secondaryQuestion: isEN ? "What else would you like to achieve?" : "Apa hal lain yang ingin kamu capai?",
          secondaryOptions: [
            { id: "belly_fat", label: isEN ? "Reduce waistline & belly fat" : "Lingkar pinggang & lemak perut berkurang" },
            { id: "lighter_body", label: isEN ? "Body feels lighter & fatigue-free" : "Tubuh terasa lebih ringan & bebas lelah" },
            { id: "old_clothes", label: isEN ? "Old fitting clothes fit comfortably again" : "Pakaian ukuran lama pas dipakai kembali" },
            { id: "no_binge", label: isEN ? "Free from excessive binge snacking" : "Bebas dari kebiasaan ngemil berlebih" }
          ]
        };
      case "gain":
        return {
          title: isEN ? "Gain Muscle Mass" : "Menaikkan Massa Otot",
          eventQuestion: isEN ? "What is your primary physique focus?" : "Apa fokus utama pembentukan tubuhmu?",
          events: [
            { id: "lean_bulk", label: isEN ? "Clean Bulk" : "Bulking Bersih (Clean Bulk)", desc: isEN ? "Add muscle mass without storing excess fat" : "Tambah massa otot tanpa menimbun banyak lemak" },
            { id: "photoshoot", label: isEN ? "Event / Photoshoot Preparation" : "Persiapan Event / Photoshoot", desc: isEN ? "Broader shoulders & defined muscles" : "Bahu tegap & definisi otot lebih jelas" },
            { id: "posture", label: isEN ? "Fuller Body Posture" : "Postur Tubuh Lebih Berisi", desc: isEN ? "Proportional look in fitted clothing" : "Tampil proposional saat berpakaian" },
            { id: "strength", label: isEN ? "Progressive Gym Strength" : "Peningkatan Kekuatan Latihan", desc: isEN ? "Increase training weights steadily" : "Beban angkatan terus meningkat secara bertahap" }
          ],
          secondaryQuestion: isEN ? "What else would you like to achieve?" : "Apa hal lain yang ingin kamu capai?",
          secondaryOptions: [
            { id: "confidence", label: isEN ? "Upright & confident appearance" : "Penampilan lebih tegap & percaya diri" },
            { id: "muscle_definition", label: isEN ? "Denser & well-proportioned muscle" : "Otot lebih padat & proporsional" },
            { id: "appetite", label: isEN ? "Structured appetite & meal schedule" : "Nafsu makan & jadwal porsi makan teratur" },
            { id: "no_plateau", label: isEN ? "Continuous lifting progression without plateaus" : "Progres latihan meningkat tanpa stagnan" }
          ]
        };
      case "health":
      default:
        return {
          title: isEN ? "Live Healthier" : "Hidup Lebih Sehat",
          eventQuestion: isEN ? "Which health focus matters most to you?" : "Fokus kesehatan apa yang paling penting untukmu?",
          events: [
            { id: "sleep_energy", label: isEN ? "Sleep Quality & Morning Energy" : "Kualitas Tidur & Energi Pagi", desc: isEN ? "Wake up feeling refreshed & sharp" : "Bangun tidur dengan tubuh segar & fokus" },
            { id: "digestion", label: isEN ? "Comfortable Digestion" : "Pencernaan Nyaman", desc: isEN ? "No bloating after daily meals" : "Perut tidak begah setelah makan" },
            { id: "metabolic", label: isEN ? "Balanced Nutrition Habits" : "Menjaga Nutrisi Seimbang", desc: isEN ? "Structured nutrient-dense eating pattern" : "Pola makan bergizi yang terstruktur" },
            { id: "active_life", label: isEN ? "Active Without Fatigue" : "Aktif Tanpa Kelelahan Ekstrim", desc: isEN ? "Free from mid-day energy slumps" : "Bebas dari lemas di pertengahan hari" }
          ],
          secondaryQuestion: isEN ? "What else would you like to achieve?" : "Apa hal lain yang ingin kamu capai?",
          secondaryOptions: [
            { id: "no_food_coma", label: isEN ? "Free from post-lunch food comas" : "Bebas kantuk berat setelah makan siang" },
            { id: "realistic_routine", label: isEN ? "Realistic meal & exercise routine" : "Rutinitas makan & olahraga yang realistis" },
            { id: "mental_clarity", label: isEN ? "Clearer mental focus all day long" : "Fokus pikiran lebih jernih seharian" },
            { id: "stamina", label: isEN ? "Enduring stamina throughout the day" : "Stamina tahan lama sepanjang hari" }
          ]
        };
    }
  };

  // Dynamic Community Insights based on Goal
  const getCommunityStats = () => {
    switch (goal) {
      case "lose":
        return {
          title: isEN
            ? "Accelerated Fat Loss through Daily Calorie & Macro Deficit"
            : "Menurunkan Berat Badan Lebih Efektif dengan Defisit Makro Terukur",
          metric1: {
            val: "91%",
            title: isEN ? "Consistent Calorie Deficit" : "Capai Defisit Kalori Konsisten",
            desc: isEN
              ? "Achieved within the first 7 days without extreme starvation"
              : "Tercapai dalam 7 hari pertama tanpa merasa lapar berlebih",
            trend: "up" as const,
          },
          metric2: {
            val: "84%",
            title: isEN ? "Waistline & Fat Reduction" : "Penurunan Lemak Perut & Pinggang",
            desc: isEN
              ? "After setting personalized daily meal & macro guidance"
              : "Setelah menerapkan target makro harian yang terukur",
            trend: "down" as const,
          },
        };
      case "gain":
        return {
          title: isEN
            ? "Clean Muscle Gain through Targeted Surplus & High Protein"
            : "Menaikkan Massa Otot Tanpa Penumpukan Lemak Berlebih",
          metric1: {
            val: "89%",
            title: isEN ? "Daily Surplus & Protein Met" : "Target Protein & Surplus Tercapai",
            desc: isEN
              ? "Achieved within the first 7 days with structured meal plans"
              : "Tercapai dalam 7 hari pertama dengan panduan nutrisi terstruktur",
            trend: "up" as const,
          },
          metric2: {
            val: "78%",
            title: isEN ? "Lifting & Strength Progression" : "Peningkatan Kekuatan Latihan",
            desc: isEN
              ? "Steady muscle growth without bloating or fat accumulation"
              : "Peningkatan beban angkatan & massa otot tanpa rasa begah",
            trend: "up" as const,
          },
        };
      case "health":
        return {
          title: isEN
            ? "Boosted Daily Energy & Sustainable Metabolic Balance"
            : "Meningkatkan Vitalitas & Kualitas Kesehatan Harian",
          metric1: {
            val: "94%",
            title: isEN ? "All-Day High Energy" : "Stamina Harian Lebih Stabil",
            desc: isEN
              ? "Eliminated mid-day energy crashes in the first 7 days"
              : "Bebas lemas dan kantuk di jam kerja setelah perbaikan nutrisi",
            trend: "up" as const,
          },
          metric2: {
            val: "81%",
            title: isEN ? "Better Digestion & Sleep" : "Pencernaan & Tidur Lebih Nyaman",
            desc: isEN
              ? "Reported significant improvement in daily physical wellbeing"
              : "Peningkatan signifikan pada kenyamanan perut & kualitas istirahat",
            trend: "up" as const,
          },
        };
      case "maintain":
      default:
        return {
          title: isEN
            ? "Improving Diet Control through Measured Macro Systems"
            : "Meningkatkan Kontrol Pola Makan dengan Sistem Makro Terukur",
          metric1: {
            val: "92%",
            title: isEN ? "Mindful Portion Control" : "Sadar Porsi Makan",
            desc: isEN
              ? "Achieved within the first 7 days with daily AI assistance"
              : "Tercapai dalam 7 hari pertama dengan pendampingan harian",
            trend: "up" as const,
          },
          metric2: {
            val: "76%",
            title: isEN ? "Reduction in Binge Eating" : "Penurunan Kalap Makan",
            desc: isEN
              ? "After setting measured daily macro targets"
              : "Setelah menetapkan target makro harian yang terukur",
            trend: "down" as const,
          },
        };
    }
  };

  const goalData = getGoalSpecificData();
  const communityStats = getCommunityStats();

  return (
    <div className="fixed inset-0 z-50 bg-white font-['Inter'] overflow-y-auto selection:bg-[#D4FF00] selection:text-black p-4 md:p-6 lg:p-8">
      <div className="bg-[#111111] text-white min-h-[calc(100vh-2rem)] md:min-h-[calc(100vh-3rem)] lg:min-h-[calc(100vh-4rem)] rounded-[2rem] flex flex-col relative overflow-hidden shadow-2xl w-full">
        <div className="relative z-10 flex flex-col flex-grow max-w-2xl mx-auto w-full px-4 sm:px-6 py-8 md:py-12">

        {/* Header Navigation & Progress Bar */}
        {step <= 11 ? (
          <header className="flex items-center justify-between mb-8 sm:mb-10 shrink-0">
            <button
              onClick={step === 1 ? onComplete : handlePrev}
              className="p-2 -ml-2 text-neutral-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-['Inter'] font-bold tracking-wider uppercase"
            >
              <ArrowLeft size={16} />
              <span>{isEN ? (step === 1 ? "Cancel" : "Back") : (step === 1 ? "Batal" : "Kembali")}</span>
            </button>

            {/* Step Progress Bar */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    i + 1 === step
                      ? "w-7 sm:w-8 bg-[#D4FF00]"
                      : i + 1 < step
                      ? "w-2.5 bg-[#D4FF00]/50"
                      : "w-2.5 bg-neutral-800"
                  }`}
                />
              ))}
            </div>

            <span className="text-xs font-['Inter'] font-bold text-neutral-500">
              {step}/{totalSteps}
            </span>
          </header>
        ) : (
          <header className="flex items-center justify-between mb-6 sm:mb-8 shrink-0">
            {step < 16 && (
              <button
                onClick={handlePrev}
                className="p-2 -ml-2 text-neutral-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-['Inter'] font-bold tracking-wider uppercase"
              >
                <ArrowLeft size={16} />
                <span>{isEN ? "Back" : "Kembali"}</span>
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <span className="px-2.5 py-1 rounded-full bg-[#161C28] border border-neutral-800 text-[11px] font-bold text-[#D4FF00]">
                {step === 13
                  ? (isEN ? "Step 1 of 3 • Analysis" : "Tahap 1/3 • Analisis AI")
                  : step === 14
                  ? (isEN ? "Step 2 of 3 • Plan Selection" : "Tahap 2/3 • Pilih Paket")
                  : step === 15
                  ? (isEN ? "Step 3 of 3 • Checkout" : "Tahap 3/3 • Pembayaran")
                  : (isEN ? "Account Active" : "Akun Aktif")}
              </span>
            </div>
          </header>
        )}

        {/* MAIN STEP CONTENT */}
        <main className="flex-grow flex flex-col justify-center pb-28">
          <AnimatePresence mode="wait">

            {/* STEP 1: PHONE NUMBER IDENTITY GATE */}
            {step === 1 && (() => {
              const phoneVal = validateWhatsAppPhone(phone);
              return (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6 sm:space-y-8 text-left"
                >
                  <div className="space-y-3">
                    <div className="text-xs font-['Inter'] font-bold text-[#D4FF00] uppercase tracking-widest flex items-center gap-1.5">
                      <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                      <span>{isEN ? "Step 1 — Identity Verification" : "Langkah 1 — Identitas WhatsApp"}</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-['Archivo_Black'] tracking-tight leading-tight text-white">
                      {isEN ? "What is your WhatsApp number?" : "Berapa nomor WhatsApp kamu?"}
                    </h1>
                    <p className="text-neutral-400 text-sm sm:text-base leading-relaxed">
                      {isEN
                        ? "Your AI Coach connects and delivers your workout & nutrition roadmap directly to your WhatsApp."
                        : "Pelatih AI GymBuddy akan terhubung langsung ke WhatsApp kamu untuk mendampingi nutrisi dan latihan harian."}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                        <WhatsAppIcon className="w-5 h-5 text-[#25D366]" />
                        <span className="text-base font-bold text-white border-r border-neutral-700 pr-3">+62</span>
                      </div>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => {
                          let val = e.target.value.replace(/\D/g, "");
                          if (val.startsWith("62")) val = val.substring(2);
                          else if (val.startsWith("0")) val = val.substring(1);
                          setPhone(val);
                          setPhoneCheckError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && phoneVal.isValid && !isCheckingPhone) {
                            e.preventDefault();
                            handleNext();
                          }
                        }}
                        placeholder="812 3456 7890"
                        autoFocus
                        className={`w-full bg-[#111620] border rounded-xl pl-24 pr-12 py-4 text-lg font-bold text-white placeholder:text-neutral-600 focus:outline-none transition-colors ${
                          phone.length === 0
                            ? "border-neutral-800 focus:border-[#25D366]"
                            : phoneVal.isValid
                            ? "border-[#25D366] bg-[#111620]"
                            : "border-amber-500/60 focus:border-amber-500"
                        }`}
                      />
                      {phone.length > 0 && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                          {phoneVal.isValid ? (
                            <div className="w-6 h-6 rounded-full bg-[#25D366]/20 border border-[#25D366] flex items-center justify-center">
                              <Check className="w-3.5 h-3.5 text-[#25D366]" strokeWidth={3} />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 text-xs font-bold">
                              !
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Realtime Phone Feedback */}
                    {phone.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`px-3.5 py-2.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 ${
                          phoneVal.isValid
                            ? "bg-[#25D366]/10 border-[#25D366]/30 text-[#25D366]"
                            : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{phoneVal.isValid ? "✅" : "⚠️"}</span>
                          <span>{phoneVal.message}</span>
                        </div>
                        {phoneVal.operator && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-white/10 border border-white/10 text-white shrink-0">
                            {phoneVal.operator}
                          </span>
                        )}
                      </motion.div>
                    )}

                    {/* Phone Check / Verification Error */}
                    {phoneCheckError && (
                      <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                        <AlertCircle size={16} className="shrink-0" />
                        <span>{phoneCheckError}</span>
                      </div>
                    )}

                    {/* Identity & Privacy Shield Guarantee */}
                    <div className="p-4 rounded-xl bg-[#111620] border border-neutral-800 flex items-start gap-3 text-xs text-neutral-400">
                      <ShieldCheck className="w-5 h-5 text-[#25D366] shrink-0 mt-0.5" />
                      <span>
                        {isEN
                          ? "Your number is securely verified. We never share your data or send spam. Pure 1-on-1 AI coaching."
                          : "Nomor diverifikasi aman & anti-spam. Pelatih AI GymBuddy hanya mengirimkan arahan nutrisi & workout harianmu."}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })()}

            {/* STEP 2: NAME INPUT */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 sm:space-y-8"
              >
                <div className="space-y-3">
                  <div className="text-xs font-['Inter'] font-bold text-[#D4FF00] uppercase tracking-widest">
                    {isEN ? "Step 2 — Introduction" : "Langkah 2 — Perkenalan"}
                  </div>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-['Archivo_Black'] tracking-tight leading-tight text-white">
                    {isEN ? "What is your nickname?" : "Siapa nama panggilan kamu?"}
                  </h1>
                  <p className="text-neutral-400 text-sm sm:text-base leading-relaxed">
                    {isEN
                      ? "GymBuddy AI will greet you and personalize daily recommendations just for you."
                      : "GymBuddy AI akan menyapa dan mempersonalisasi rekomendasi harian khusus untukmu."}
                  </p>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={isEN ? "Type your nickname here..." : "Ketik nama panggilan di sini..."}
                    autoFocus
                    className="w-full bg-[#111620] border border-neutral-800 rounded-xl px-5 py-4 sm:py-5 text-lg font-bold text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#D4FF00] transition-all"
                  />
                </div>
              </motion.div>
            )}

            {/* STEP 3: MAIN GOAL SELECTION */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 sm:space-y-8"
              >
                <div className="space-y-2">
                  <div className="text-xs font-['Inter'] font-bold text-[#D4FF00] uppercase tracking-widest">
                    {isEN ? "Step 3 — Primary Target" : "Langkah 3 — Target Utama"}
                  </div>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-['Archivo_Black'] tracking-tight leading-tight text-white">
                    {isEN ? `Hello ${name || "Friend"}! What is your primary goal right now?` : `Halo ${name || "Teman"}! Apa target utama kamu saat ini?`}
                  </h1>
                  <p className="text-neutral-400 text-sm">
                    {isEN ? "Choose one so nutrition & training calculations are precisely tailored." : "Pilih salah satu agar kalkulasi nutrisi disesuaikan secara presisi."}
                  </p>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      id: "maintain",
                      title: isEN ? "Maintain Weight" : "Menjaga Berat Badan",
                      desc: isEN ? "Stabilize ideal weight, manage portions & boost vitality." : "Stabilkan berat ideal, jaga porsi makan, & tingkatkan vitalitas.",
                      icon: HeartPulse
                    },
                    {
                      id: "lose",
                      title: isEN ? "Lose Weight" : "Menurunkan Berat Badan",
                      desc: isEN ? "Trim body fat sustainably in a measured, healthy way." : "Pangkas kadar lemak tubuh secara terukur & sustainable.",
                      icon: Flame
                    },
                    {
                      id: "gain",
                      title: isEN ? "Gain Muscle & Mass" : "Menaikkan Massa Otot & BB",
                      desc: isEN ? "Clean bulk, build muscle mass & improve posture." : "Bulking bersih, tingkatkan massa otot & postur tubuh.",
                      icon: Dumbbell
                    },
                    {
                      id: "health",
                      title: isEN ? "Live Healthier & Energized" : "Hidup Lebih Sehat & Bertenaga",
                      desc: isEN ? "Boost daily stamina, comfortable digestion, and eliminate fatigue." : "Tingkatkan stamina, pencernaan nyaman, & bebaskan tubuh dari lemas.",
                      icon: Leaf
                    },
                  ].map((item) => (
                    <OptionCard
                      key={item.id}
                      selected={goal === item.id}
                      onClick={() => handleGoalSelect(item.id as any)}
                      className="flex items-start gap-4"
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        goal === item.id ? "bg-[#D4FF00] text-black font-bold" : "bg-neutral-800 text-white"
                      }`}>
                        <item.icon size={20} />
                      </div>
                      <div className="flex-1">
                        <div className="text-base font-bold text-white mb-1">{item.title}</div>
                        <div className="text-xs sm:text-sm text-neutral-400 leading-relaxed">{item.desc}</div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                        goal === item.id ? "bg-[#D4FF00] border-[#D4FF00]" : "border-neutral-700"
                      }`}>
                        {goal === item.id && <Check size={12} className="text-black stroke-[3]" />}
                      </div>
                    </OptionCard>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 4: GOAL-SPECIFIC CONTEXT & EVENT SELECTION */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 sm:space-y-8"
              >
                <div className="space-y-2">
                  <div className="text-xs font-['Inter'] font-bold text-[#D4FF00] uppercase tracking-widest">
                    {isEN ? `Step 4 — Target Details: ${goalData.title}` : `Langkah 4 — Detail Target: ${goalData.title}`}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-['Archivo_Black'] tracking-tight leading-tight text-white">
                    {goalData.eventQuestion}
                  </h1>
                </div>

                {/* Sub-question 1: Event choice */}
                <div className="space-y-2.5">
                  {goalData.events.map((ev) => (
                    <OptionCard
                      key={ev.id}
                      selected={goalEvent === ev.id}
                      onClick={() => setGoalEvent(ev.id)}
                      className="flex items-start gap-3.5"
                    >
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                        goalEvent === ev.id ? "border-[#D4FF00] bg-[#D4FF00]" : "border-neutral-700"
                      }`}>
                        {goalEvent === ev.id && <Check size={12} className="text-black stroke-[3]" />}
                      </div>
                      <div>
                        <div className="text-sm sm:text-base font-bold text-white">{ev.label}</div>
                        <div className="text-xs text-neutral-400 mt-0.5">{ev.desc}</div>
                      </div>
                    </OptionCard>
                  ))}
                </div>

                {/* Sub-question 2: Secondary Objectives */}
                <div className="space-y-3 pt-4 border-t border-neutral-800">
                  <h2 className="text-base font-bold text-white">
                    {goalData.secondaryQuestion}
                  </h2>
                  <p className="text-xs text-neutral-400">{isEN ? "Select one or more that apply:" : "Pilih satu atau lebih yang relevan:"}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {goalData.secondaryOptions.map((opt) => (
                      <div
                        key={opt.id}
                        onClick={() => toggleSecondaryGoal(opt.id)}
                        className={`p-3.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2.5 ${
                          goalSecondary.includes(opt.id)
                            ? "bg-[#182130] border-[#D4FF00] text-white"
                            : "bg-[#111620] border-neutral-800 text-neutral-300 hover:border-neutral-700"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          goalSecondary.includes(opt.id) ? "bg-[#D4FF00] border-[#D4FF00]" : "border-neutral-700"
                        }`}>
                          {goalSecondary.includes(opt.id) && <Check size={10} className="text-black stroke-[3]" />}
                        </div>
                        <span>{opt.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 5: EMOTIONAL VISION */}
            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 sm:space-y-8"
              >
                <div className="space-y-2">
                  <div className="text-xs font-['Inter'] font-bold text-[#D4FF00] uppercase tracking-widest">
                    {isEN ? "Step 5 — Expected Outcome" : "Langkah 5 — Hasil yang Diharapkan"}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-['Archivo_Black'] tracking-tight leading-tight text-white">
                    {isEN ? "When your target is achieved, what change will be most meaningful?" : "Saat targetmu tercapai, perubahan apa yang paling bermakna?"}
                  </h1>
                </div>

                <div className="space-y-3">
                  {[
                    { id: "confidence", title: isEN ? "More Confident in Outfits & Socializing" : "Lebih Percaya Diri Saat Tampil", desc: isEN ? "Wear clothes you love and interact with complete confidence." : "Mengenakan pakaian pilihan & lebih percaya diri berinteraksi." },
                    { id: "energy", title: isEN ? "All-Day High Energy & Stamina" : "Bebas Lemas & Bertenaga Seharian", desc: isEN ? "Consistent physical energy from morning till night without burnout." : "Energi fisik stabil dari pagi hingga malam tanpa gampang lelah." },
                    { id: "pride", title: isEN ? "Proud of Personal Discipline" : "Bangga dengan Disiplin Diri", desc: isEN ? "Taking full control over nutrition and daily lifestyle habits." : "Memegang kendali penuh atas pola makan & kebiasaan hidup." },
                    { id: "peace", title: isEN ? "Peace of Mind Regarding Food" : "Bebas Cemas Soal Makanan", desc: isEN ? "Enjoying meals without guilt or fear of weight rebound." : "Menikmati hidangan tanpa rasa bersalah atau kekhawatiran berat naik." },
                  ].map((item) => (
                    <OptionCard
                      key={item.id}
                      selected={emotionalVision === item.id}
                      onClick={() => setEmotionalVision(item.id)}
                      className="flex items-center gap-4"
                    >
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                        emotionalVision === item.id ? "border-[#D4FF00] bg-[#D4FF00]" : "border-neutral-700"
                      }`}>
                        {emotionalVision === item.id && <Check size={12} className="text-black stroke-[3]" />}
                      </div>
                      <div>
                        <div className="text-base font-bold text-white mb-0.5">{item.title}</div>
                        <div className="text-xs sm:text-sm text-neutral-400">{item.desc}</div>
                      </div>
                    </OptionCard>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 6: FIRST REPORT SCREEN */}
            {step === 6 && (
              <motion.div
                key="step6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="bg-[#111620] border border-neutral-800 rounded-2xl p-6 sm:p-8">
                  <div className="text-xs font-['Inter'] font-bold text-[#D4FF00] uppercase tracking-widest mb-3">
                    {isEN ? "Community Insights" : "Statistik Komunitas"}
                  </div>

                  <h2 className="text-xl sm:text-2xl font-['Archivo_Black'] text-white leading-snug mb-6">
                    {communityStats.title}
                  </h2>

                  {/* METRIC GRID */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div className="bg-[#161C28] rounded-xl p-5 border border-neutral-800">
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-4xl sm:text-5xl font-['Archivo_Black'] text-[#D4FF00]">
                          {communityStats.metric1.val}
                        </span>
                        <TrendingUp className="text-[#D4FF00] w-5 h-5" />
                      </div>
                      <div className="font-bold text-white text-sm sm:text-base mb-1">
                        {communityStats.metric1.title}
                      </div>
                      <div className="text-xs text-neutral-400">
                        {communityStats.metric1.desc}
                      </div>
                    </div>

                    <div className="bg-[#161C28] rounded-xl p-5 border border-neutral-800">
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-4xl sm:text-5xl font-['Archivo_Black'] text-[#D4FF00]">
                          {communityStats.metric2.val}
                        </span>
                        {communityStats.metric2.trend === "down" ? (
                          <TrendingDown className="text-[#D4FF00] w-5 h-5" />
                        ) : (
                          <TrendingUp className="text-[#D4FF00] w-5 h-5" />
                        )}
                      </div>
                      <div className="font-bold text-white text-sm sm:text-base mb-1">
                        {communityStats.metric2.title}
                      </div>
                      <div className="text-xs text-neutral-400">
                        {communityStats.metric2.desc}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 7: PERSONAL DATA & BIOMETRICS */}
            {step === 7 && (
              <motion.div
                key="step7"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 sm:space-y-8"
              >
                <div className="space-y-2">
                  <div className="text-xs font-['Inter'] font-bold text-[#D4FF00] uppercase tracking-widest">
                    {isEN ? "Step 7 — Biometric Data & Allergies" : "Langkah 7 — Data Biometrik & Alergi"}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-['Archivo_Black'] tracking-tight leading-tight text-white">
                    {isEN ? "Physical & Metabolism Data" : "Data Fisik & Metabolisme"}
                  </h1>
                  <p className="text-neutral-400 text-sm">
                    {isEN ? "Used to calculate BMR (Basal Metabolic Rate) and customized daily meal plans." : "Digunakan untuk menghitung BMR dan rekomendasi nutrisi personal."}
                  </p>
                </div>

                <div className="space-y-5">
                  {/* Gender */}
                  <div>
                    <label className="block text-xs font-['Inter'] font-bold text-neutral-400 uppercase tracking-wider mb-2">
                      {isEN ? "Gender" : "Jenis Kelamin"}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setGender("pria")}
                        className={`py-3.5 px-4 rounded-xl font-bold text-sm border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                          gender === "pria"
                            ? "bg-[#D4FF00] text-black border-[#D4FF00]"
                            : "bg-[#111620] text-white border-neutral-800 hover:border-neutral-700"
                        }`}
                      >
                        {isEN ? "Male" : "Pria"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setGender("wanita")}
                        className={`py-3.5 px-4 rounded-xl font-bold text-sm border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                          gender === "wanita"
                            ? "bg-[#D4FF00] text-black border-[#D4FF00]"
                            : "bg-[#111620] text-white border-neutral-800 hover:border-neutral-700"
                        }`}
                      >
                        {isEN ? "Female" : "Wanita"}
                      </button>
                    </div>
                  </div>

                  {/* Weight & Height */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-['Inter'] font-bold text-neutral-400 uppercase tracking-wider mb-2">
                        {isEN ? "Body Weight (kg)" : "Berat Badan (kg)"}
                      </label>
                      <div className="relative">
                        <Scale className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                        <input
                          type="number"
                          min="1"
                          value={weight}
                          onChange={(e) => setWeight(e.target.value.replace(/-/g, ''))}
                          placeholder="65"
                          className="w-full bg-[#111620] border border-neutral-800 rounded-xl pl-11 pr-4 py-3.5 text-lg font-bold text-white focus:outline-none focus:border-[#D4FF00]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-['Inter'] font-bold text-neutral-400 uppercase tracking-wider mb-2">
                        {isEN ? "Height (cm)" : "Tinggi Badan (cm)"}
                      </label>
                      <div className="relative">
                        <Ruler className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                        <input
                          type="number"
                          min="1"
                          value={height}
                          onChange={(e) => setHeight(e.target.value.replace(/-/g, ''))}
                          placeholder="170"
                          className="w-full bg-[#111620] border border-neutral-800 rounded-xl pl-11 pr-4 py-3.5 text-lg font-bold text-white focus:outline-none focus:border-[#D4FF00]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Date of Birth & Age */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-['Inter'] font-bold text-neutral-300 uppercase tracking-wider">
                          {isEN ? "Date of Birth" : "Tanggal Lahir"} <span className="text-[#D4FF00] font-black">*</span>
                        </label>
                      </div>
                      <div className="relative">
                        <Calendar className={`absolute left-4 top-1/2 -translate-y-1/2 ${dobError ? "text-rose-400" : "text-neutral-500"}`} size={18} />
                        <input
                          type="date"
                          required
                          max={new Date().toISOString().split("T")[0]}
                          value={dob}
                          onChange={(e) => handleDobChange(e.target.value)}
                          className={`w-full bg-[#111620] border ${
                            dobError
                              ? "border-rose-500 focus:border-rose-400 ring-1 ring-rose-500/40"
                              : "border-neutral-800 focus:border-[#D4FF00]"
                          } rounded-xl pl-11 pr-4 py-3.5 text-sm sm:text-base font-bold text-white focus:outline-none transition-all`}
                        />
                      </div>
                      {dobError && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-xs text-rose-400 font-semibold mt-2 flex items-start gap-1.5 leading-snug"
                        >
                          <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-400" />
                          <span>
                            {isEN
                              ? "Date of birth is required to calculate your personalized health recommendations."
                              : "Tanggal lahir diperlukan untuk menghitung rekomendasi kesehatan kamu."}
                          </span>
                        </motion.div>
                      )}
                      <p className="text-[11px] text-neutral-400 font-medium mt-1.5 leading-relaxed">
                        {isEN
                          ? "Required for calculating your personalized BMR, TDEE, and nutrition recommendations."
                          : "Diperlukan untuk menghitung kebutuhan kalori dan rekomendasi kesehatan kamu."}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-['Inter'] font-bold text-neutral-400 uppercase tracking-wider">
                          {isEN ? "Age (Years)" : "Usia (Tahun)"}
                        </label>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-[#D4FF00]/15 text-[#D4FF00] border border-[#D4FF00]/30">
                          {getAgeGroupLabel(Number(age) || 25)}
                        </span>
                      </div>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                        <input
                          type="number"
                          min="10"
                          max="120"
                          value={age}
                          onChange={(e) => setAge(e.target.value.replace(/-/g, ''))}
                          placeholder="25"
                          className="w-full bg-[#111620] border border-neutral-800 rounded-xl pl-11 pr-4 py-3.5 text-lg font-bold text-white focus:outline-none focus:border-[#D4FF00]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Target Weight & AI Recommendation for Lose Weight */}
                  {goal === "lose" && (() => {
                    const hM = (Number(height) || 170) / 100;
                    const currW = Number(weight) || 65;
                    const bmiIdealW = Math.round(22 * hM * hM * 2) / 2;
                    const recW = Math.min(currW - 2, Math.max(45, bmiIdealW));
                    const lossKg = Math.round((currW - recW) * 10) / 10;

                    return (
                      <div className="pt-2 space-y-3 border-t border-neutral-800/80">
                        <label className="block text-xs font-['Inter'] font-bold text-[#D4FF00] uppercase tracking-wider">
                          {isEN ? "Target Weight Goal (kg)" : "Target Berat Badan Impian (kg)"}
                        </label>
                        <div className="relative">
                          <Target className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                          <input
                            type="number"
                            step="0.5"
                            min="1"
                            value={userTargetWeight}
                            onChange={(e) => setUserTargetWeight(e.target.value.replace(/-/g, ''))}
                            placeholder={String(recW)}
                            className="w-full bg-[#111620] border border-[#D4FF00]/40 rounded-xl pl-11 pr-4 py-3.5 text-lg font-bold text-white focus:outline-none focus:border-[#D4FF00]"
                          />
                        </div>

                        {/* AI Recommendation Card - HEAVILY HIGHLIGHTED DESIGN */}
                        <div className="bg-gradient-to-br from-[#1F2B14] via-[#182332] to-[#111620] border-2 border-[#D4FF00] shadow-[0_0_25px_rgba(212,255,0,0.2)] rounded-2xl p-4 sm:p-5 space-y-3 relative overflow-hidden">
                          <div className="flex items-center justify-between">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4FF00] text-black font-['Archivo_Black'] text-[11px] uppercase tracking-wider shadow-md">
                              <Sparkles className="w-3.5 h-3.5 fill-black" />
                              <span>{isEN ? "AI HEALTHY RECOMMENDATION" : "REKOMENDASI TARGET SEHAT AI"}</span>
                            </div>
                            <span className="text-[11px] font-extrabold text-[#D4FF00] bg-[#D4FF00]/10 px-2.5 py-1 rounded-lg border border-[#D4FF00]/30">
                              BMI Ideal ~22.0
                            </span>
                          </div>

                          <div className="flex items-baseline gap-2 pt-1">
                            <span className="text-3xl font-['Archivo_Black'] text-white">
                              {recW} <span className="text-base font-bold text-[#D4FF00]">kg</span>
                            </span>
                            <span className="text-xs text-neutral-300 font-medium">
                              ({isEN ? `Gradual loss ~${lossKg} kg` : `Proses bertahap turun ~${lossKg} kg`})
                            </span>
                          </div>

                          <p className="text-xs text-neutral-200 leading-relaxed font-medium">
                            {isEN
                              ? `Based on your height (${height || 170} cm), age (${age || 25} yrs), and current weight (${currW} kg), the healthiest long-term target is ${recW} kg.`
                              : `Berdasarkan tinggi (${height || 170} cm), usia (${age || 25} th), dan BB awal (${currW} kg), target paling aman & sehat jangka panjang adalah ${recW} kg.`}
                          </p>

                          {/* Warning if user inputs a very low weight */}
                          {userTargetWeight && Number(userTargetWeight) < recW - 4 && (
                            <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-2.5 flex items-center gap-2 text-[11px] text-amber-300">
                              <span>⚠️</span>
                              <span>
                                {isEN
                                  ? `Target ${userTargetWeight} kg is quite low for your height (${height} cm). We recommend using the AI target (${recW} kg).`
                                  : `Target ${userTargetWeight} kg cukup tergolong rendah untuk tinggi ${height} cm. Disarankan memakai rekomendasi AI (${recW} kg).`}
                              </span>
                            </div>
                          )}

                          {/* Action Button */}
                          <button
                            type="button"
                            onClick={() => setUserTargetWeight(String(recW))}
                            className="w-full py-2.5 px-4 bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer active:scale-98"
                          >
                            <Sparkles className="w-4 h-4 fill-black" />
                            <span>
                              {isEN
                                ? `Apply AI Recommended Target (${recW} kg)`
                                : `Gunakan Target Rekomendasi AI (${recW} kg)`}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Target Weight & AI Recommendation for Muscle Gain */}
                  {goal === "gain" && (() => {
                    const currW = Number(weight) || 65;
                    const recW = currW + 5;
                    const gainKg = 5;

                    return (
                      <div className="pt-2 space-y-3 border-t border-neutral-800/80">
                        <label className="block text-xs font-['Inter'] font-bold text-[#D4FF00] uppercase tracking-wider">
                          {isEN ? "Target Weight Goal (kg)" : "Target Berat Badan & Massa Otot (kg)"}
                        </label>
                        <div className="relative">
                          <Target className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                          <input
                            type="number"
                            step="0.5"
                            min="1"
                            value={userTargetWeight}
                            onChange={(e) => setUserTargetWeight(e.target.value.replace(/-/g, ''))}
                            placeholder={String(recW)}
                            className="w-full bg-[#111620] border border-[#D4FF00]/40 rounded-xl pl-11 pr-4 py-3.5 text-lg font-bold text-white focus:outline-none focus:border-[#D4FF00]"
                          />
                        </div>

                        {/* AI Clean Bulking Recommendation Card */}
                        <div className="bg-gradient-to-br from-[#1F2B14] via-[#182332] to-[#111620] border-2 border-[#D4FF00] shadow-[0_0_25px_rgba(212,255,0,0.2)] rounded-2xl p-4 sm:p-5 space-y-3 relative overflow-hidden">
                          <div className="flex items-center justify-between">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4FF00] text-black font-['Archivo_Black'] text-[11px] uppercase tracking-wider shadow-md">
                              <Sparkles className="w-3.5 h-3.5 fill-black" />
                              <span>{isEN ? "AI CLEAN BULK TARGET" : "TARGET BULKING BERSIH AI"}</span>
                            </div>
                            <span className="text-[11px] font-extrabold text-[#D4FF00] bg-[#D4FF00]/10 px-2.5 py-1 rounded-lg border border-[#D4FF00]/30">
                              Surplus ~+400 kcal
                            </span>
                          </div>

                          <div className="flex items-baseline gap-2 pt-1">
                            <span className="text-3xl font-['Archivo_Black'] text-white">
                              {recW} <span className="text-base font-bold text-[#D4FF00]">kg</span>
                            </span>
                            <span className="text-xs text-neutral-300 font-medium">
                              ({isEN ? `Gradual lean gain ~${gainKg} kg` : `Fokus kenaikan massa otot ~${gainKg} kg`})
                            </span>
                          </div>

                          <p className="text-xs text-neutral-200 leading-relaxed font-medium">
                            {isEN
                              ? `To build muscle without adding excess body fat, a controlled lean bulk target of ${recW} kg with optimal protein distribution is recommended.`
                              : `Untuk membangun massa otot tanpa menimbun lemak berlebih, target bulking bersih di ${recW} kg dengan asupan protein terukur sangat ideal.`}
                          </p>

                          <button
                            type="button"
                            onClick={() => setUserTargetWeight(String(recW))}
                            className="w-full py-2.5 px-4 bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer active:scale-98"
                          >
                            <Sparkles className="w-4 h-4 fill-black" />
                            <span>{isEN ? `Apply AI Recommended Target (${recW} kg)` : `Gunakan Target Rekomendasi AI (${recW} kg)`}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* AI Recommendation for Maintain Weight */}
                  {(goal === "maintain" || goal === "health") && (() => {
                    const currW = Number(weight) || 65;

                    return (
                      <div className="pt-2 space-y-3 border-t border-neutral-800/80">
                        <div className="bg-gradient-to-br from-[#161F2E] via-[#111620] to-[#161B22] border border-[#25D366]/40 rounded-2xl p-4 sm:p-5 space-y-2.5 shadow-md">
                          <div className="flex items-center justify-between">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#25D366]/20 text-[#25D366] font-['Archivo_Black'] text-[11px] uppercase tracking-wider border border-[#25D366]/30">
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>{isEN ? "BODY RECOMPOSITION & STABILITY" : "REKOMPOSISI TUBUH & STABILITAS"}</span>
                            </div>
                            <span className="text-xs font-black text-white bg-white/10 px-2.5 py-1 rounded-lg">
                              {currW} kg
                            </span>
                          </div>

                          <p className="text-xs text-neutral-300 leading-relaxed font-medium">
                            {isEN
                              ? `Your target weight is set to maintain your current ${currW} kg while optimizing fat-to-muscle ratio, daily energy, and metabolic health.`
                              : `Target berat badan dikunci stabil di ${currW} kg dengan fokus pembakaran lemak halus, peningkatan massa otot, dan kestabilan energi harian.`}
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Food Allergies Question */}
                  <div className="pt-4 space-y-3 border-t border-neutral-800">
                    <label className="block text-xs font-['Inter'] font-bold text-neutral-300 uppercase tracking-wider">
                      {isEN ? "Food Allergies & Dietary Restrictions" : "Alergi & Pantangan Makanan"}
                    </label>
                    <p className="text-xs text-neutral-400">
                      {isEN
                        ? "Select any foods you are allergic to so your personalized meal recommendations stay 100% safe."
                        : "Pilih makanan yang menyebabkan alergi agar rekomendasi nutrisi dari AI disesuaikan secara aman."}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {[
                        { id: "none", label: isEN ? "No Allergies" : "Tidak Ada Alergi", icon: "✨" },
                        { id: "peanuts", label: isEN ? "Peanuts & Nuts" : "Kacang-kacangan", icon: "🥜" },
                        { id: "seafood", label: isEN ? "Seafood & Fish" : "Seafood / Udang", icon: "🦐" },
                        { id: "dairy", label: isEN ? "Dairy & Lactose" : "Susu / Laktosa", icon: "🥛" },
                        { id: "eggs", label: isEN ? "Eggs" : "Telur", icon: "🥚" },
                        { id: "gluten", label: isEN ? "Gluten & Wheat" : "Gluten / Gandum", icon: "🌾" },
                        { id: "soy", label: isEN ? "Soy / Tofu" : "Kedelai / Tahu", icon: "🫛" }
                      ].map((opt) => {
                        const isSelected = allergies.includes(opt.id);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => toggleAllergy(opt.id)}
                            className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                              isSelected
                                ? "bg-[#D4FF00]/10 border-[#D4FF00] text-[#D4FF00]"
                                : "bg-[#111620] border-neutral-800 text-neutral-300 hover:border-neutral-700"
                            }`}
                          >
                            <span>{opt.icon}</span>
                            <span className="truncate">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Health Profile Personalization Question */}
                  <div className="pt-4 space-y-3.5 border-t border-neutral-800">
                    <div className="flex items-center gap-2">
                      <HeartPulse size={16} className="text-[#D4FF00]" />
                      <label className="block text-xs font-['Inter'] font-bold text-neutral-300 uppercase tracking-wider">
                        {isEN ? "Health Profile & Medical Considerations" : "Profil Kesehatan & Kondisi Khusus"}
                      </label>
                    </div>
                    <p className="text-xs text-neutral-400">
                      {isEN
                        ? "Do you have any health conditions we should consider when creating your nutrition and workout recommendations?"
                        : "Apakah kamu memiliki kondisi kesehatan yang perlu diperhatikan AI saat membuat rekomendasi nutrisi dan latihan?"}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {[
                        { id: "no_condition", label: isEN ? "No health conditions" : "Tidak ada kondisi khusus", icon: "✨" },
                        { id: "has_condition", label: isEN ? "Yes, I have conditions" : "Ya, ada kondisi kesehatan", icon: "🩺" },
                        { id: "prefer_not_to_say", label: isEN ? "Prefer not to say" : "Tidak ingin menyebutkan", icon: "🔒" }
                      ].map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setHealthStatus(st.id as any)}
                          className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                            healthStatus === st.id
                              ? "bg-[#D4FF00] text-black border-[#D4FF00] shadow-sm"
                              : "bg-[#111620] border-neutral-800 text-neutral-300 hover:border-neutral-700"
                          }`}
                        >
                          <span>{st.icon}</span>
                          <span className="truncate">{st.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Expandable condition checklist when "has_condition" is selected */}
                    {healthStatus === "has_condition" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="p-4 rounded-xl bg-[#0D121B] border border-neutral-800 space-y-3"
                      >
                        <span className="text-xs font-bold text-neutral-300 block">
                          {isEN ? "Select all applicable conditions:" : "Pilih semua kondisi yang sesuai:"}
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
                          {[
                            { id: "Diabetes", label: "Diabetes", icon: "🩸" },
                            { id: "High blood pressure", label: isEN ? "High blood pressure" : "Hipertensi / Tekanan Darah", icon: "🫀" },
                            { id: "High cholesterol", label: isEN ? "High cholesterol" : "Kolesterol Tinggi", icon: "🧈" },
                            { id: "Heart condition", label: isEN ? "Heart condition" : "Kondisi Jantung", icon: "❤️" },
                            { id: "Kidney condition", label: isEN ? "Kidney condition" : "Kondisi Ginjal", icon: "🫘" },
                            { id: "Liver condition", label: isEN ? "Liver condition" : "Kondisi Hati / Liver", icon: "🩺" },
                            { id: "Asthma", label: isEN ? "Asthma / Respiratory" : "Asma / Pernafasan", icon: "🫁" },
                            { id: "Arthritis", label: isEN ? "Arthritis / Joint Issue" : "Radang / Masalah Sendi", icon: "🦴" }
                          ].map((cond) => {
                            const isChecked = healthConditions.includes(cond.id);
                            return (
                              <button
                                key={cond.id}
                                type="button"
                                onClick={() => toggleHealthCondition(cond.id)}
                                className={`p-2.5 rounded-lg border text-xs font-medium text-left flex items-center gap-2 cursor-pointer transition-all ${
                                  isChecked
                                    ? "bg-[#D4FF00]/15 border-[#D4FF00] text-white"
                                    : "bg-[#111620] border-neutral-800 text-neutral-400 hover:border-neutral-700"
                                }`}
                              >
                                <span>{cond.icon}</span>
                                <span className="truncate flex-1">{cond.label}</span>
                                {isChecked && <Check size={14} className="text-[#D4FF00]" />}
                              </button>
                            );
                          })}
                        </div>

                        {/* Other Condition input */}
                        <div className="pt-2">
                          <input
                            type="text"
                            value={otherCondition}
                            onChange={(e) => setOtherCondition(e.target.value)}
                            placeholder={isEN ? "Other health condition (optional)..." : "Kondisi kesehatan lainnya (opsional)..."}
                            className="w-full bg-[#111620] border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#D4FF00]"
                          />
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 8: LIFESTYLE & EXPERIENCE */}
            {step === 8 && (
              <motion.div
                key="step8"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 sm:space-y-8"
              >
                <div className="space-y-2">
                  <div className="text-xs font-['Inter'] font-bold text-[#D4FF00] uppercase tracking-widest">
                    {isEN ? "Step 8 — Lifestyle" : "Langkah 8 — Gaya Hidup"}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-['Archivo_Black'] tracking-tight leading-tight text-white">
                    {isEN ? "Activity & Experience" : "Aktivitas & Pengalaman"}
                  </h1>
                </div>

                {/* Sub 1: Activity level */}
                <div className="space-y-3">
                  <label className="block text-xs font-['Inter'] font-bold text-neutral-400 uppercase tracking-wider">
                    {isEN ? "Physical Activity Intensity" : "Intensitas Aktivitas Fisik"}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[
                      { id: "sedentary", label: isEN ? "Sedentary (Rarely exercise)" : "Sedenter (Jarang olahraga)" },
                      { id: "light", label: isEN ? "Light (1-2x / week)" : "Ringan (1-2x / minggu)" },
                      { id: "moderate", label: isEN ? "Moderate (3-5x / week)" : "Moderat (3-5x / minggu)" },
                      { id: "heavy", label: isEN ? "Very Active (Every day)" : "Sangat Aktif (Setiap hari)" }
                    ].map((act) => (
                      <button
                        key={act.id}
                        type="button"
                        onClick={() => setActivityLevel(act.id)}
                        className={`p-3.5 rounded-xl border text-xs sm:text-sm font-bold text-left transition-all cursor-pointer ${
                          activityLevel === act.id
                            ? "bg-[#D4FF00] text-black border-[#D4FF00]"
                            : "bg-[#111620] text-white border-neutral-800 hover:border-neutral-700"
                        }`}
                      >
                        {act.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sub 2: Experience */}
                <div className="space-y-3 pt-2">
                  <label className="block text-xs font-['Inter'] font-bold text-neutral-400 uppercase tracking-wider">
                    {isEN ? "Nutrition Management Experience" : "Pengalaman Pengaturan Nutrisi"}
                  </label>
                  <div className="space-y-2">
                    {[
                      { id: "beginner", label: isEN ? "Beginner — Needs simple basic guidance" : "Pemula — Membutuhkan panduan dasar yang simpel" },
                      { id: "yoyo", label: isEN ? "Tried Before — Struggles with consistency" : "Pernah Mencoba — Sering mengalami kendala konsistensi" },
                      { id: "experienced", label: isEN ? "Experienced — Needs precise macro tracking system" : "Terbiasa — Membutuhkan sistem tracking makro presisi" }
                    ].map((exp) => (
                      <OptionCard
                        key={exp.id}
                        selected={experience === exp.id}
                        onClick={() => setExperience(exp.id)}
                        className="p-3.5"
                      >
                        <div className="text-xs sm:text-sm font-bold text-white">{exp.label}</div>
                      </OptionCard>
                    ))}
                  </div>
                </div>

                {/* Sub 3: Satisfaction */}
                <div className="space-y-3 pt-2">
                  <label className="block text-xs font-['Inter'] font-bold text-neutral-400 uppercase tracking-wider">
                    {isEN ? "Satisfaction with Current Condition" : "Tingkat Kepuasan Kondisi Fisik Saat Ini"}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "low", label: isEN ? "Needs Work" : "Perlu Peningkatan" },
                      { id: "medium", label: isEN ? "Fair" : "Cukup Baik" },
                      { id: "high", label: isEN ? "Want Optimal" : "Ingin Optimal" }
                    ].map((sat) => (
                      <button
                        key={sat.id}
                        type="button"
                        onClick={() => setSatisfaction(sat.id)}
                        className={`py-3 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          satisfaction === sat.id
                            ? "bg-[#D4FF00] text-black border-[#D4FF00]"
                            : "bg-[#111620] text-neutral-300 border-neutral-800"
                        }`}
                      >
                        {sat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sub 4: Workout Duration Preference */}
                <div className="space-y-3 pt-3 border-t border-neutral-800/80">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-['Inter'] font-bold text-[#D4FF00] uppercase tracking-wider">
                      {isEN ? "Typical Workout Duration" : "Durasi Latihan Harian"}
                    </label>
                    <span className="text-[10px] text-neutral-400 font-medium">
                      {isEN ? "Hard scheduling constraint" : "Menyesuaikan waktu luangmu"}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    {isEN
                      ? "How long do you usually work out? This helps your coach build workouts that fit your schedule."
                      : "Berapa lama kamu biasanya berolahraga? Ini membantu coach merancang sesi yang pas dengan jadwalmu."}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { val: 15, label: "15 min", desc: isEN ? "Express & High ROI" : "Singkat & Padat" },
                      { val: 30, label: "30 min", desc: isEN ? "Standard & Balanced" : "Seimbang & Efisien" },
                      { val: 45, label: "45 min", desc: isEN ? "Optimal Full Session" : "Menu Lengkap Ideal" },
                      { val: 60, label: "60+ min", desc: isEN ? "Dedicated Volume" : "Volume & Ekstra" }
                    ].map((dur) => (
                      <button
                        key={dur.val}
                        type="button"
                        onClick={() => setWorkoutDuration(dur.val as any)}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          workoutDuration === dur.val
                            ? "bg-[#D4FF00] text-black border-[#D4FF00] font-black shadow-sm"
                            : "bg-[#111620] text-neutral-300 border-neutral-800 hover:border-neutral-700"
                        }`}
                      >
                        <span className="text-sm font-black block">{dur.label}</span>
                        <span className={`text-[10px] block mt-0.5 ${workoutDuration === dur.val ? "text-black/80 font-bold" : "text-neutral-500"}`}>
                          {dur.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sub 5: Training Frequency */}
                <div className="space-y-3 pt-3 border-t border-neutral-800/80">
                  <label className="block text-xs font-['Inter'] font-bold text-[#D4FF00] uppercase tracking-wider">
                    {isEN ? "Training Frequency" : "Frekuensi Latihan Mingguan"}
                  </label>
                  <p className="text-[11px] text-neutral-400">
                    {isEN
                      ? "How often do you usually work out? This shapes weekly volume and recovery planning."
                      : "Berapa hari dalam seminggu kamu berolahraga? Ini menentukan volume mingguan dan jadwal pemulihanmu."}
                  </p>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { id: "1-2", label: "1–2 days/week", desc: isEN ? "Full-body focus" : "Fokus Full Body" },
                      { id: "3-4", label: "3–4 days/week", desc: isEN ? "Balanced Split" : "Split Seimbang" },
                      { id: "5+", label: "5+ days/week", desc: isEN ? "High frequency" : "Frekuensi Tinggi" }
                    ].map((freq) => (
                      <button
                        key={freq.id}
                        type="button"
                        onClick={() => setWorkoutFrequency(freq.id as any)}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          workoutFrequency === freq.id
                            ? "bg-[#D4FF00] text-black border-[#D4FF00] font-black"
                            : "bg-[#111620] text-neutral-300 border-neutral-800 hover:border-neutral-700"
                        }`}
                      >
                        <span className="text-xs sm:text-sm font-black block">{freq.label}</span>
                        <span className={`text-[10px] block mt-0.5 ${workoutFrequency === freq.id ? "text-black/80 font-bold" : "text-neutral-500"}`}>
                          {freq.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sub 6: Fitness Level */}
                <div className="space-y-3 pt-3 border-t border-neutral-800/80">
                  <label className="block text-xs font-['Inter'] font-bold text-[#D4FF00] uppercase tracking-wider">
                    {isEN ? "Training Experience / Fitness Level" : "Tingkat Kebugaran / Pengalaman Latihan"}
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { id: "beginner", label: isEN ? "Beginner" : "Pemula", desc: isEN ? "Learning core movement patterns" : "Mempelajari pola gerakan dasar" },
                      { id: "intermediate", label: isEN ? "Intermediate" : "Menengah", desc: isEN ? "Consistent with good technique" : "Terbiasa latihan & teknik aman" },
                      { id: "advanced", label: isEN ? "Advanced" : "Mahir", desc: isEN ? "Comfortable with heavy overload" : "Fokus intensitas & variasi beban" }
                    ].map((lvl) => (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => setFitnessLevel(lvl.id as any)}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          fitnessLevel === lvl.id
                            ? "bg-[#D4FF00] text-black border-[#D4FF00] font-black"
                            : "bg-[#111620] text-neutral-300 border-neutral-800 hover:border-neutral-700"
                        }`}
                      >
                        <span className="text-xs sm:text-sm font-black block">{lvl.label}</span>
                        <span className={`text-[10px] block mt-0.5 ${fitnessLevel === lvl.id ? "text-black/80 font-bold" : "text-neutral-500"}`}>
                          {lvl.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sub 7: Equipment Availability */}
                <div className="space-y-3 pt-3 border-t border-neutral-800/80">
                  <label className="block text-xs font-['Inter'] font-bold text-[#D4FF00] uppercase tracking-wider">
                    {isEN ? "Available Workout Equipment" : "Ketersediaan Alat Latihan (Equipment)"}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {[
                      { id: "full_gym", title: isEN ? "Full Gym" : "Alat Gym Lengkap", desc: isEN ? "Barbells, Cable, Machines" : "Fitness Center Komersial" },
                      { id: "dumbbells", title: isEN ? "Dumbbells" : "Dumbbell", desc: isEN ? "Home dumbbells & bench" : "Set Beban Rumah" },
                      { id: "bodyweight", title: isEN ? "Bodyweight" : "Tanpa Alat", desc: isEN ? "Calisthenics / Home" : "Beban Tubuh Sendiri" },
                      { id: "barbell", title: isEN ? "Barbell Setup" : "Barbell & Rack", desc: isEN ? "Olympic bar & plates" : "Barbel & Rak Beban" },
                      { id: "machines", title: isEN ? "Machines" : "Mesin Gym", desc: isEN ? "Guided weight stacks" : "Alat Pin Stack Mesin" },
                      { id: "resistance_bands", title: isEN ? "Bands" : "Resistance Band", desc: isEN ? "Elastic bands" : "Tali Karet Resistensi" }
                    ].map((eq) => (
                      <button
                        key={eq.id}
                        type="button"
                        onClick={() => setEquipment(eq.id as any)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          equipment === eq.id
                            ? "bg-[#D4FF00] text-black border-[#D4FF00]"
                            : "bg-[#111620] text-white border-neutral-800 hover:border-neutral-700"
                        }`}
                      >
                        <p className="font-extrabold text-xs sm:text-sm mb-0.5">{eq.title}</p>
                        <p className={`text-[10px] ${equipment === eq.id ? "text-black/80 font-bold" : "text-neutral-400"}`}>{eq.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sub 8: Physical Limitations / Injuries Flow */}
                <div className="space-y-3 pt-3 border-t border-neutral-800/80">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-['Inter'] font-bold text-[#D4FF00] uppercase tracking-wider">
                      {isEN ? "Pain, Injuries, or Physical Limitations" : "Cedera, Nyeri, atau Batasan Fisik"}
                    </label>
                    <span className="text-[10px] text-neutral-400 font-medium">
                      {isEN ? "Critical safety constraint" : "Prioritas keselamatan gerak"}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    {isEN
                      ? "Do you currently have any pain, injuries, or movements you need to avoid?"
                      : "Apakah saat ini kamu memiliki rasa nyeri, riwayat cedera, atau gerakan yang perlu dihindari?"}
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setHasInjury("no");
                        setSelectedBodyAreas([]);
                        setInjuries(["none"]);
                      }}
                      className={`py-2.5 px-3.5 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                        hasInjury === "no"
                          ? "bg-[#D4FF00] text-black border-[#D4FF00] font-black"
                          : "bg-[#111620] text-neutral-300 border-neutral-800"
                      }`}
                    >
                      {isEN ? "No, Healthy & Ready to Train" : "Tidak Ada (Sehat & Siap Latihan)"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasInjury("yes")}
                      className={`py-2.5 px-3.5 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                        hasInjury === "yes"
                          ? "bg-[#D4FF00] text-black border-[#D4FF00] font-black"
                          : "bg-[#111620] text-neutral-300 border-neutral-800"
                      }`}
                    >
                      {isEN ? "Yes, I have areas to protect" : "Ya, Ada Area yang Perlu Penyesuaian"}
                    </button>
                  </div>

                  {hasInjury === "yes" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-3 pt-2"
                    >
                      <div>
                        <label className="block text-[11px] font-bold text-neutral-300 mb-1.5">
                          {isEN ? "Select Affected Body Areas:" : "Pilih Area Tubuh yang Memerlukan Penyesuaian:"}
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { id: "knee", label: isEN ? "Knee" : "Lutut" },
                            { id: "back", label: isEN ? "Lower Back" : "Punggung Bawah" },
                            { id: "shoulder", label: isEN ? "Shoulder" : "Bahu" },
                            { id: "hip", label: isEN ? "Hip" : "Pinggul" },
                            { id: "ankle", label: isEN ? "Ankle" : "Pergelangan Kaki" },
                            { id: "wrist", label: isEN ? "Wrist" : "Pergelangan Tangan" },
                            { id: "neck", label: isEN ? "Neck" : "Leher" },
                            { id: "other", label: isEN ? "Other" : "Lainnya" }
                          ].map((area) => {
                            const isSel = selectedBodyAreas.includes(area.id);
                            return (
                              <button
                                key={area.id}
                                type="button"
                                onClick={() => {
                                  setSelectedBodyAreas((prev) =>
                                    prev.includes(area.id) ? prev.filter((a) => a !== area.id) : [...prev, area.id]
                                  );
                                  setInjuries((prev) => {
                                    const next = prev.filter((i) => i !== "none");
                                    return next.includes(area.id) ? next.filter((i) => i !== area.id) : [...next, area.id];
                                  });
                                }}
                                className={`py-2 px-2.5 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer ${
                                  isSel
                                    ? "bg-[#D4FF00]/15 border-[#D4FF00] text-[#D4FF00]"
                                    : "bg-[#111620] text-neutral-400 border-neutral-800 hover:border-neutral-700"
                                }`}
                              >
                                {area.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Severity Selection */}
                      <div className="space-y-1.5 pt-1">
                        <label className="block text-[11px] font-bold text-neutral-300">
                          {isEN ? "Severity / Training Impact:" : "Tingkat Dampak pada Latihan:"}
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {[
                            {
                              id: "mild",
                              label: isEN ? "Mild" : "Ringan",
                              desc: isEN
                                ? "I can usually train, but some movements may need adjustments."
                                : "Bisa latihan, tapi beberapa gerakan butuh penyesuaian."
                            },
                            {
                              id: "moderate",
                              label: isEN ? "Moderate" : "Sedang",
                              desc: isEN
                                ? "Some movements are uncomfortable or difficult."
                                : "Beberapa gerakan terasa tidak nyaman atau sulit."
                            },
                            {
                              id: "severe",
                              label: isEN ? "Severe" : "Perlu Hindari",
                              desc: isEN
                                ? "I currently need to avoid training that area."
                                : "Perlu menghindari melatih area tersebut saat ini."
                            }
                          ].map((sev) => (
                            <button
                              key={sev.id}
                              type="button"
                              onClick={() => setInjurySeverity(sev.id as any)}
                              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                injurySeverity === sev.id
                                  ? "bg-[#D4FF00] text-black border-[#D4FF00]"
                                  : "bg-[#111620] text-neutral-300 border-neutral-800"
                              }`}
                            >
                              <span className="text-xs font-black block">{sev.label}</span>
                              <span className={`text-[10px] block mt-0.5 leading-tight ${injurySeverity === sev.id ? "text-black/80 font-bold" : "text-neutral-500"}`}>
                                {sev.desc}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Avoid movements chips */}
                      <div className="space-y-1.5 pt-1">
                        <label className="block text-[11px] font-bold text-neutral-300">
                          {isEN ? "Specific Movements to Avoid (Optional):" : "Gerakan Tertentu yang Perlu Dihindari (Opsional):"}
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { id: "jumping", label: isEN ? "Jumping / Impact" : "Lompat / High Impact" },
                            { id: "deep_squat", label: isEN ? "Deep Squats" : "Squat Sangat Dalam" },
                            { id: "overhead_press", label: isEN ? "Overhead Press" : "Angkat Beban di Atas Kepala" },
                            { id: "axial_load", label: isEN ? "Heavy Spinal Load" : "Beban Aksial Tulang Belakang" },
                            { id: "wrist_extension", label: isEN ? "Heavy Wrist Flex" : "Tekukan Pergelangan Tangan" }
                          ].map((trigger) => {
                            const isT = selectedPainTriggers.includes(trigger.id);
                            return (
                              <button
                                key={trigger.id}
                                type="button"
                                onClick={() => {
                                  setSelectedPainTriggers((prev) =>
                                    prev.includes(trigger.id) ? prev.filter((t) => t !== trigger.id) : [...prev, trigger.id]
                                  );
                                }}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all cursor-pointer ${
                                  isT
                                    ? "bg-[#D4FF00]/20 text-[#D4FF00] border-[#D4FF00]"
                                    : "bg-[#181818] text-neutral-400 border-neutral-800"
                                }`}
                              >
                                {isT ? "✓ " : "+ "}
                                {trigger.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <input
                        type="text"
                        value={customInjury}
                        onChange={(e) => setCustomInjury(e.target.value)}
                        placeholder={isEN ? "Additional notes on your condition..." : "Catatan tambahan terkait kondisi fisikmu..."}
                        className="w-full bg-[#111620] border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#D4FF00]"
                      />

                      {/* Prominent Medical Safety Disclaimer Box */}
                      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-left space-y-1">
                        <div className="flex items-center gap-1.5 text-amber-400 font-extrabold text-[11px]">
                          <span>🛡️</span>
                          <span>{isEN ? "Safety & Medical Disclaimer" : "Pemberitahuan Keselamatan & Medis"}</span>
                        </div>
                        <p className="text-[10px] text-neutral-300 leading-relaxed">
                          {isEN
                            ? "GymBuddy is an AI coach and does not diagnose injuries or provide medical clearance. If you experience severe, sharp, or worsening pain, please stop exercising and consult a qualified healthcare professional."
                            : "GymBuddy adalah asisten AI kebugaran dan TIDAK mendiagnosis cedera medis. Informasi ini digunakan sebagai batasan latihan. Jika Anda mengalami nyeri hebat atau akut, hentikan latihan dan konsultasikan dengan tenaga medis profesional."}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 9: DIET & CHALLENGES */}
            {step === 9 && (
              <motion.div
                key="step9"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 sm:space-y-8"
              >
                <div className="space-y-2">
                  <div className="text-xs font-['Inter'] font-bold text-[#D4FF00] uppercase tracking-widest">
                    {isEN ? "Step 9 — Your Main Challenge" : "Langkah 9 — Tantangan Utamamu"}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-['Archivo_Black'] tracking-tight leading-tight text-white">
                    {isEN ? "Biggest Consistency Obstacle?" : "Tantangan Terbesar dalam Konsistensi?"}
                  </h1>
                  <p className="text-neutral-400 text-xs sm:text-sm">
                    {isEN ? "Choose the factors that most often block your daily progress:" : "Pilih faktor yang paling sering menjadi hambatan harianmu:"}
                  </p>
                </div>

                <div className="space-y-2.5">
                  {getChallengesByGoal().map((ch) => (
                    <OptionCard
                      key={ch.id}
                      selected={challenges.includes(ch.id)}
                      onClick={() => toggleChallenge(ch.id)}
                      className="flex items-start gap-3.5"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        challenges.includes(ch.id) ? "bg-[#D4FF00] text-black font-bold" : "bg-neutral-800 text-white"
                      }`}>
                        <ch.icon size={16} />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm sm:text-base font-bold text-white mb-0.5">{ch.title}</div>
                        <div className="text-xs text-neutral-400 leading-relaxed">{ch.desc}</div>
                      </div>
                      <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-1 ${
                        challenges.includes(ch.id) ? "bg-[#D4FF00] border-[#D4FF00]" : "border-neutral-700"
                      }`}>
                        {challenges.includes(ch.id) && <Check size={12} className="text-black stroke-[3]" />}
                      </div>
                    </OptionCard>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 10: SECOND REPORT SCREEN */}
            {step === 10 && (
              <motion.div
                key="step10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6 text-left"
              >
                <div className="bg-[#111620] border border-neutral-800 rounded-2xl p-6 sm:p-8">
                  
                  {/* HEADER */}
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-neutral-800">
                    <div className="w-10 h-10 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[#D4FF00] shrink-0">
                      <Brain size={20} />
                    </div>
                    <div>
                      <div className="text-xs font-['Inter'] font-bold text-[#D4FF00] uppercase tracking-wider">
                        {isEN ? "Personal Report" : "Laporan Personal"}
                      </div>
                      <h2 className="text-xl sm:text-2xl font-['Archivo_Black'] text-white">
                        {isEN ? "Challenge & Solution Analysis" : "Analisis Tantangan & Solusi"}
                      </h2>
                    </div>
                  </div>

                  {/* CHALLENGE ANALYSIS CARDS */}
                  <div className="space-y-3.5">
                    {challenges.includes("nyerah") && (
                      <div className="p-4 sm:p-5 rounded-xl bg-[#161C28] border border-neutral-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-bold text-white text-sm sm:text-base">
                            <Zap className="w-4 h-4 text-[#D4FF00]" />
                            <span>{isEN ? "Consistency Challenge" : "Tantangan Konsistensi"}</span>
                          </div>
                          <span className="text-[10px] font-['Inter'] uppercase px-2 py-0.5 rounded bg-neutral-800 text-[#D4FF00] border border-neutral-700">
                            {isEN ? "GymBuddy Strategy" : "Strategi GymBuddy"}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                          {isEN
                            ? "Adaptive macro adjustments ensure your next meal compensates naturally without guilt or dropping off program."
                            : "Penyesuaian makro adaptif memastikan porsi makan berikutnya dikompensasi secara alami tanpa perlu merasa bersalah atau menghentikan program."}
                        </p>
                      </div>
                    )}

                    {challenges.includes("gorengan") && (
                      <div className="p-4 sm:p-5 rounded-xl bg-[#161C28] border border-neutral-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-bold text-white text-sm sm:text-base">
                            <Utensils className="w-4 h-4 text-[#D4FF00]" />
                            <span>{isEN ? "Portion & Snack Control" : "Kontrol Makanan & Cemilan"}</span>
                          </div>
                          <span className="text-[10px] font-['Inter'] uppercase px-2 py-0.5 rounded bg-neutral-800 text-[#D4FF00] border border-neutral-700">
                            {isEN ? "GymBuddy Strategy" : "Strategi GymBuddy"}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                          {isEN
                            ? "The system provides fiber & protein timing recommendations in main meals to maintain fullness and suppress snack cravings."
                            : "Sistem memberikan rekomendasi serat & protein pada hidangan utama untuk menjaga rasa kenyang dan mengontrol nafsu ngemil berlebih."}
                        </p>
                      </div>
                    )}

                    {challenges.includes("kalori") && (
                      <div className="p-4 sm:p-5 rounded-xl bg-[#161C28] border border-neutral-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-bold text-white text-sm sm:text-base">
                            <Scale className="w-4 h-4 text-[#D4FF00]" />
                            <span>{isEN ? "Automated Portion Estimation" : "Estimasi Porsi Otomatis"}</span>
                          </div>
                          <span className="text-[10px] font-['Inter'] uppercase px-2 py-0.5 rounded bg-neutral-800 text-[#D4FF00] border border-neutral-700">
                            {isEN ? "GymBuddy Strategy" : "Strategi GymBuddy"}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                          {isEN
                            ? "Vision Photo Snap detects calories & estimates macros directly from meal photos without needing manual food scales."
                            : "Vision Photo Snap mendeteksi kalori & estimasi makro langsung dari foto makanan tanpa perlengkapan timbangan manual."}
                        </p>
                      </div>
                    )}

                    {(!challenges.includes("nyerah") && !challenges.includes("gorengan") && !challenges.includes("kalori")) && (
                      <div className="p-4 sm:p-5 rounded-xl bg-[#161C28] border border-neutral-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-bold text-white text-sm sm:text-base">
                            <CheckCircle2 className="w-4 h-4 text-[#D4FF00]" />
                            <span>{isEN ? "Routine Nutrition Guidance" : "Pendampingan Nutrisi Rutin"}</span>
                          </div>
                          <span className="text-[10px] font-['Inter'] uppercase px-2 py-0.5 rounded bg-neutral-800 text-[#D4FF00] border border-neutral-700">
                            {isEN ? "GymBuddy Strategy" : "Strategi GymBuddy"}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                          {isEN
                            ? "Mealtime reminders & instant portion correction tips sent via WhatsApp without disrupting your work day."
                            : "Pengingat jam makan & saran koreksi porsi instan dikirimkan via WhatsApp tanpa mengganggu aktivitas kerja harianmu."}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 11: PERSONA SELECTION */}
            {step === 11 && (
              <motion.div
                key="step11"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 sm:space-y-8"
              >
                <div className="space-y-2">
                  <div className="text-xs font-['Inter'] font-bold text-[#D4FF00] uppercase tracking-widest">
                    {isEN ? "Step 11 — AI Communication Style" : "Langkah 11 — Gaya Komunikasi AI"}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-['Archivo_Black'] tracking-tight leading-tight text-white">
                    {isEN ? "Choose Your Coach Style" : "Pilih Gaya Pelatihmu"}
                  </h1>
                  <p className="text-neutral-400 text-sm">
                    {isEN
                      ? "Select the AI persona that best matches your learning style. Both use identical nutrition & workout logic."
                      : "Pilih persona AI yang paling cocok dengan gaya belajarmu. Keduanya menggunakan logika nutrisi yang sama."}
                  </p>
                </div>

                <div className="space-y-3">
                  <OptionCard
                    selected={persona === "max"}
                    onClick={() => setPersona("max")}
                    className="flex items-start gap-4"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      persona === "max" ? "bg-[#D4FF00] text-black font-bold" : "bg-neutral-800 text-white"
                    }`}>
                      <Zap size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="text-base font-bold text-white mb-1">
                        {isEN ? "MAX — Firm & Direct" : "MAX — Tegas & To The Point"}
                      </div>
                      <div className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                        {isEN
                          ? "Serious, no fluff. Delivers concrete solutions and direct feedback when you drift off target."
                          : "Serius, tanpa basa-basi. Memberikan solusi konkret dan koreksi langsung saat kamu melenceng dari target."}
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                      persona === "max" ? "bg-[#D4FF00] border-[#D4FF00]" : "border-neutral-700"
                    }`}>
                      {persona === "max" && <Check size={12} className="text-black stroke-[3]" />}
                    </div>
                  </OptionCard>

                  <OptionCard
                    selected={persona === "mia"}
                    onClick={() => setPersona("mia")}
                    className="flex items-start gap-4"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      persona === "mia" ? "bg-[#D4FF00] text-black font-bold" : "bg-neutral-800 text-white"
                    }`}>
                      <Smile size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="text-base font-bold text-white mb-1">
                        {isEN ? "MIA — Patient & Supportive" : "MIA — Sabar & Suportif"}
                      </div>
                      <div className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                        {isEN
                          ? "Warm and patient. Explains 'why' behind each recommendation and keeps you motivated."
                          : "Ramah dan sabar. Menjelaskan 'kenapa' di balik setiap rekomendasi dan selalu memotivasi prosesmu."}
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                      persona === "mia" ? "bg-[#D4FF00] border-[#D4FF00]" : "border-neutral-700"
                    }`}>
                      {persona === "mia" && <Check size={12} className="text-black stroke-[3]" />}
                    </div>
                  </OptionCard>
                </div>

                {/* LIVE WHATSAPP CHAT COMPARISON SIMULATOR */}
                <div className="bg-[#0B141A] border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl mt-4">
                  {/* Simulated Chat Header */}
                  <div className="bg-[#1F2C34] px-4 py-3 flex items-center justify-between border-b border-white/[0.06]">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#D4FF00] text-black font-black flex items-center justify-center text-sm shadow-xs">
                        {persona === "max" ? "🏋️" : "✨"}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-white text-xs font-bold">
                            {persona === "max" ? "Coach MAX (Gym & Fitness)" : "Coach MIA (Nutrition & Support)"}
                          </h4>
                          <span className="w-1.5 h-1.5 rounded-full bg-[#25D366]" />
                        </div>
                        <p className="text-[10px] text-neutral-400 font-medium">
                          {isEN ? "WhatsApp AI Assistant • Online" : "Asisten AI WhatsApp • Online"}
                        </p>
                      </div>
                    </div>

                    <span className="text-[10px] uppercase font-extrabold text-[#D4FF00] bg-[#D4FF00]/10 px-2 py-0.5 rounded-md border border-[#D4FF00]/20">
                      {isEN ? "Live Response Preview" : "Simulasi Respon Chat"}
                    </span>
                  </div>

                  {/* Chat Bubbles Container */}
                  <div className="p-4 space-y-3 bg-[#0B141A]">
                    {/* User Bubble (Right) */}
                    <div className="flex justify-end">
                      <div className="bg-[#005C4B] text-white rounded-2xl rounded-tr-xs px-3.5 py-2.5 max-w-[85%] text-xs shadow-xs space-y-1">
                        <p className="leading-relaxed font-medium">
                          {isEN
                            ? "Coach, I just had a double bacon cheeseburger and large fries for lunch 🍔🍟. Is that okay?"
                            : "Coach, siang ini aku makan nasi padang lauk rendang + telor dadar 🍛. Aman gak ya?"}
                        </p>
                        <span className="text-[9px] text-white/60 block text-right">12:45 PM ✓✓</span>
                      </div>
                    </div>

                    {/* Coach AI Response Bubble (Left) */}
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={persona}
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.2 }}
                        className="flex justify-start"
                      >
                        <div className="bg-[#202C33] text-white rounded-2xl rounded-tl-xs px-3.5 py-2.5 max-w-[92%] text-xs shadow-xs space-y-2 border border-white/[0.04]">
                          {persona === "max" ? (
                            <p className="leading-relaxed text-neutral-200">
                              {isEN ? (
                                <>
                                  <strong className="text-[#D4FF00]">⚠️ ~950 kcal & 55g fat.</strong> That is almost half your daily budget in one meal.
                                  <br /><br />
                                  Tonight, keep dinner strictly <strong className="text-white">grilled chicken breast + steamed greens (sub-400 kcal)</strong> and do not skip your scheduled chest & cardio workout today. <strong>Stay disciplined! 🏋️</strong>
                                </>
                              ) : (
                                <>
                                  <strong className="text-[#D4FF00]">⚠️ Rendang + telor dadar ~850 kcal & 45g lemak.</strong> Nasi padang boleh sesekali, tapi jatah kalori makan malammu sisa <span className="underline font-bold">400 kcal</span>.
                                  <br /><br />
                                  Malam ini wajib makan <strong className="text-white">dada ayam rebus / tahu-tempe kukus</strong> tanpa santan/minyak, plus selesaikan target workout 4 set hari ini biar surplusnya terbakar! <strong>Disiplin, jangan kendor! 🏋️</strong>
                                </>
                              )}
                            </p>
                          ) : (
                            <p className="leading-relaxed text-neutral-200">
                              {isEN ? (
                                <>
                                  <strong className="text-emerald-400">✨ Sounds delicious!</strong> Do not feel guilty—the beef patty still provided great protein (~35g) for your muscles 💪.
                                  <br /><br />
                                  Since lunch was calorie-dense (~950 kcal), let us balance it tonight with a lighter meal like a <strong className="text-white">warm chicken soup or crisp salad</strong>. Proud of you for logging honestly! Keep it up 🥰
                                </>
                              ) : (
                                <>
                                  <strong className="text-emerald-400">✨ Enak banget!</strong> Nasi padang tetep ada protein bagusnya kok dari rendang (~25g protein) 💪.
                                  <br /><br />
                                  Karena santan dan minyaknya cukup padat kalori (~850 kcal), malam ini kita seimbangkan dengan makan malam yang lebih segar ya, misalnya <strong className="text-white">sup ayam bening atau sayur bayam</strong>. Kamu hebat banget udah jujur mencatat makananmu hari ini! Tetap semangat ya 🥰
                                </>
                              )}
                            </p>
                          )}
                          <span className="text-[9px] text-neutral-400 block text-right">12:46 PM</span>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 12: COACH COMMITMENT & TIME ALLOCATION */}
            {step === 12 && (
              <motion.div
                key="step12"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 sm:space-y-8 text-left"
              >
                <div className="space-y-2">
                  <div className="text-xs font-['Inter'] font-bold text-[#D4FF00] uppercase tracking-widest">
                    {isEN ? "Step 12 — Daily Commitment" : "Langkah 12 — Komitmen Waktu"}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-['Archivo_Black'] tracking-tight leading-tight text-white">
                    {isEN ? "How Much Time Can You Dedicate Daily?" : "Berapa Waktu Harian yang Bisa Kamu Luangkan?"}
                  </h1>
                  <p className="text-neutral-400 text-xs sm:text-sm">
                    {isEN
                      ? `Coach ${(persona || 'max').toLowerCase().includes('mia') ? 'Mia' : 'Max'} will calibrate meal tracking and workout intervals based on your actual availability.`
                      : `Coach ${(persona || 'max').toLowerCase().includes('mia') ? 'Mia' : 'Max'} akan menyesuaikan intensitas tracking nutrisi dan jadwal latihan sesuai waktu luangmu.`}
                  </p>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      id: "5min",
                      title: isEN ? "5 Minutes / day (Quick & Practical)" : "5 Menit / hari (Cepat & Praktis)",
                      desc: isEN ? "Snap meal photos, instant calorie tracking, no hassle" : "Foto makanan langsung beres, analisis kalori instan tanpa ribet"
                    },
                    {
                      id: "15min",
                      title: isEN ? "15 Minutes / day (Balanced — Recommended)" : "15 Menit / hari (Seimbang — Rekomendasi)",
                      desc: isEN ? "Optimal for consistent macro deficit/surplus & posture guidance" : "Optimal untuk konsistensi defisit/surplus kalori & panduan gerakan"
                    },
                    {
                      id: "30min",
                      title: isEN ? "30+ Minutes / day (Intensive & Proactive)" : "30+ Menit / hari (Intensif & Proaktif)",
                      desc: isEN ? "Structured gym workout split, weekly adjustments & ambitious targets" : "Jadwal workout gym terstruktur, evaluasi mingguan & target ambisius"
                    }
                  ].map((com) => (
                    <OptionCard
                      key={com.id}
                      selected={commitmentLevel === com.id}
                      onClick={() => setCommitmentLevel(com.id)}
                      className="flex items-center justify-between"
                    >
                      <div className="pr-2">
                        <div className="text-sm sm:text-base font-bold text-white mb-0.5">{com.title}</div>
                        <div className="text-xs text-neutral-400 leading-relaxed">{com.desc}</div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                        commitmentLevel === com.id ? "bg-[#D4FF00] border-[#D4FF00]" : "border-neutral-700"
                      }`}>
                        {commitmentLevel === com.id && <Check size={12} className="text-black stroke-[3]" />}
                      </div>
                    </OptionCard>
                  ))}
                </div>

                {/* Coach Selected Reassurance Card */}
                <div className="flex items-center gap-3 p-4 rounded-xl bg-[#161C28] border border-neutral-800">
                  <div className="w-10 h-10 rounded-full bg-[#D4FF00]/15 border border-[#D4FF00]/30 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-[#D4FF00]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">
                      {isEN ? `Coach ${(persona || 'max').toLowerCase().includes('mia') ? 'Mia' : 'Max'} is Ready` : `Didampingi oleh Coach ${(persona || 'max').toLowerCase().includes('mia') ? 'Mia' : 'Max'}`}
                    </p>
                    <p className="text-[11px] text-neutral-400">
                      {isEN ? "Profile questions completed. Next: review your AI calculated targets." : "Data kuesioner lengkap. Selanjutnya: lihat hasil analisis AI dan target tubuhmu."}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 13: AI ANALYSIS & TARGETS ROADMAP */}
            {step === 13 && (() => {
              const userW = Number(weight) || 65;
              const userH = Number(height) || 170;
              const userA = Number(age) || 25;
              const userG = gender || "pria";
              const userGoal = goal || "lose";
              const userAct = activityLevel || "light";

              const hM = userH / 100;
              const bmiIdealW = Math.round(22 * hM * hM * 2) / 2;
              const recW = Math.min(userW - 2, Math.max(45, bmiIdealW));

              let targetW = Number(userTargetWeight) || userW;
              if (userGoal === "lose" && !userTargetWeight) targetW = recW;
              else if (userGoal === "gain" && !userTargetWeight) targetW = userW + 5;

              const bmr = userG === "wanita"
                ? 10 * userW + 6.25 * userH - 5 * userA - 161
                : 10 * userW + 6.25 * userH - 5 * userA + 5;

              const actMultipliers: Record<string, number> = {
                sedentary: 1.2,
                light: 1.375,
                moderate: 1.55,
                heavy: 1.725
              };
              const tdee = Math.round(bmr * (actMultipliers[userAct] || 1.375));

              let targetCal = tdee;
              if (userGoal === "lose") targetCal = Math.max(1200, Math.round(tdee - 500));
              else if (userGoal === "gain") targetCal = Math.round(tdee + 400);

              const proteinGram = Math.round((targetCal * 0.30) / 4);
              const carbsGram = Math.round((targetCal * 0.45) / 4);
              const fatGram = Math.round((targetCal * 0.25) / 9);

              const weightDiffKg = Math.round(Math.abs(userW - targetW) * 10) / 10;
              const isWeightLoss = targetW < userW;
              const isWeightGain = targetW > userW;
              const isMaintain = targetW === userW || userGoal === "maintain" || userGoal === "health";
              const estWeeks = isMaintain ? 12 : (isWeightLoss ? Math.max(2, Math.ceil(weightDiffKg / 0.75)) : Math.max(4, Math.ceil(weightDiffKg / 0.35)));

              const targetDateObj = new Date(Date.now() + Math.max(8, estWeeks || 12) * 7 * 86400000);
              const targetDateFormatted = new Intl.DateTimeFormat(isEN ? "en-US" : "id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric"
              }).format(targetDateObj);

              return (
                <motion.div
                  key="step13"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="space-y-5 max-w-md mx-auto text-left pb-6"
                >
                  {/* Onboarding Completion Badge */}
                  <div className="flex items-center gap-3 bg-[#161C28] border border-[#25D366]/40 p-3.5 rounded-2xl shadow-md">
                    <div className="w-10 h-10 rounded-xl bg-[#25D366]/20 border border-[#25D366]/40 flex items-center justify-center shrink-0">
                      <Check className="w-5 h-5 text-[#25D366]" strokeWidth={3} />
                    </div>
                    <div>
                      <div className="text-[11px] font-['Archivo_Black'] text-[#25D366] uppercase tracking-wider">
                        {isEN ? "ONBOARDING COMPLETE" : "ONBOARDING SELESAI"}
                      </div>
                      <div className="text-xs font-bold text-white">
                        {isEN ? "Questionnaire Finished & Profile Configured" : "Kuesioner Selesai & Profil Berhasil Dibuat"}
                      </div>
                    </div>
                  </div>

                  {/* Headline */}
                  <div className="space-y-2 pt-1">
                    <h1 className="text-2xl sm:text-3xl font-['Archivo_Black'] tracking-tight leading-tight text-white">
                      {isEN ? "Let’s build your fitness roadmap!" : "Mari buat rencana nutrisi & latihanmu!"}
                    </h1>
                    <p className="text-neutral-300 text-xs sm:text-sm leading-relaxed">
                      {isEN
                        ? "Here are your daily calorie and macronutrient targets calculated by AI based on your body biometrics."
                        : "Berikut adalah estimasi target kalori dan makronutrisi harian hasil kalkulasi AI berdasarkan data tubuhmu."}
                    </p>
                  </div>

                  {/* Locked Calorie Target Summary */}
                  <div className="bg-gradient-to-br from-[#1F2B14] via-[#161B22] to-[#111620] border-2 border-[#D4FF00] rounded-2xl p-4 sm:p-5 space-y-3 relative overflow-hidden shadow-[0_0_30px_rgba(212,255,0,0.15)]">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                        <Flame className="w-4 h-4 text-[#D4FF00]" />
                        {isEN ? "Estimated Daily Calorie Target" : "Estimasi Target Kalori Harian"}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#D4FF00] text-black text-[10px] font-extrabold uppercase shadow-sm">
                        <Lock className="w-3 h-3 text-black" />
                        {isEN ? "LOCKED TARGET" : "TARGET TERKUNCI"}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2 pt-1">
                      <span className="text-3xl sm:text-4xl font-['Archivo_Black'] text-white">
                        {targetCal.toLocaleString()}
                      </span>
                      <span className="text-sm font-extrabold text-[#D4FF00]">kcal / {isEN ? "day" : "hari"}</span>
                    </div>

                    <p className="text-[11px] text-neutral-300 font-medium">
                      {isEN
                        ? `Personalized based on ${userW} kg, ${userH} cm, age ${userA}, and ${userG}.`
                        : `Dihitung khusus berdasarkan ${userW} kg, ${userH} cm, usia ${userA} th (${userG}).`}
                    </p>
                  </div>

                  {/* Progress Projection Graph Card */}
                  <div className="bg-[#111620] border border-neutral-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-md relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight font-['Archivo_Black']">
                        {isEN ? "Progress Projection" : "Proyeksi Progres"}
                      </h3>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30">
                        ~{estWeeks} {isEN ? "Weeks" : "Minggu"}
                      </span>
                    </div>

                    <div className="relative pt-8 pb-2">
                      <div
                        className="absolute left-2 px-2.5 py-1 rounded-lg bg-neutral-800/90 border border-neutral-700 text-white font-extrabold text-xs shadow-xs transition-all"
                        style={{ top: isMaintain ? "12px" : isWeightLoss ? "0px" : "36px" }}
                      >
                        {userW} kg
                      </div>

                      <div
                        className="absolute px-3.5 py-1 rounded-xl bg-[#25D366] text-white font-['Archivo_Black'] text-xs sm:text-sm shadow-lg shadow-[#25D366]/30 -translate-x-1/2 z-10 flex items-center gap-1 transition-all"
                        style={{
                          left: isMaintain ? "52%" : "68%",
                          top: isMaintain ? "12px" : isWeightLoss ? "36px" : "0px"
                        }}
                      >
                        <span>{targetW} kg</span>
                      </div>

                      <svg className="w-full h-24 overflow-visible" viewBox="0 0 340 75" fill="none">
                        <line x1="0" y1="18" x2="340" y2="18" stroke="#1C2433" strokeDasharray="4 4" strokeWidth="1" />
                        <line x1="0" y1="40" x2="340" y2="40" stroke="#1C2433" strokeDasharray="4 4" strokeWidth="1" />
                        <line x1="0" y1="62" x2="340" y2="62" stroke="#1C2433" strokeDasharray="4 4" strokeWidth="1" />

                        {isWeightGain ? (
                          <>
                            <path d="M 20,56 C 85,56 145,20 220,20 L 320,20" fill="none" stroke="#25D366" strokeWidth="5" strokeLinecap="round" />
                            <circle cx="20" cy="56" r="5" fill="#111620" stroke="#94A3B8" strokeWidth="3" />
                            <circle cx="220" cy="20" r="6" fill="#ffffff" stroke="#25D366" strokeWidth="4" />
                          </>
                        ) : isWeightLoss ? (
                          <>
                            <path d="M 20,20 C 85,20 145,56 220,56 L 320,56" fill="none" stroke="#25D366" strokeWidth="5" strokeLinecap="round" />
                            <circle cx="20" cy="20" r="5" fill="#111620" stroke="#94A3B8" strokeWidth="3" />
                            <circle cx="220" cy="56" r="6" fill="#ffffff" stroke="#25D366" strokeWidth="4" />
                          </>
                        ) : (
                          <>
                            <path d="M 20,40 L 320,40" fill="none" stroke="#25D366" strokeWidth="5" strokeLinecap="round" />
                            <circle cx="20" cy="40" r="5" fill="#111620" stroke="#94A3B8" strokeWidth="3" />
                            <circle cx="180" cy="40" r="6" fill="#ffffff" stroke="#25D366" strokeWidth="4" />
                          </>
                        )}
                      </svg>

                      <div className="text-right pr-3 pt-1">
                        <span className="text-xs sm:text-sm font-bold text-[#25D366]">
                          {isWeightLoss
                            ? (isEN ? `Weight Loss (-${weightDiffKg} kg)` : `Turun berat badan (-${weightDiffKg} kg)`)
                            : isWeightGain
                            ? (isEN ? `Muscle Gain (+${weightDiffKg} kg)` : `Naik massa otot (+${weightDiffKg} kg)`)
                            : (isEN ? `Maintain weight (Stable at ${userW} kg)` : `Jaga berat badan (Stabil di ${userW} kg)`)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs font-bold text-neutral-400 pt-2.5 border-t border-neutral-800/80">
                        <span className="pl-1 text-neutral-400">{isEN ? "Today" : "Hari ini"}</span>
                        <span className="pr-3 text-neutral-300 font-semibold">{targetDateFormatted}</span>
                      </div>
                    </div>
                  </div>

                  {/* Macro Summary */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                      {isEN ? "Estimated Daily Macros" : "Estimasi Makronutrisi Harian"}
                    </div>
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="bg-[#161C28] border border-purple-500/30 rounded-xl p-3 text-center">
                        <div className="text-[10px] font-bold text-purple-400 uppercase">Protein</div>
                        <div className="text-base sm:text-lg font-['Archivo_Black'] text-white">{proteinGram}g</div>
                        <div className="text-[10px] text-neutral-400">30% target</div>
                      </div>

                      <div className="bg-[#161C28] border border-cyan-500/30 rounded-xl p-3 text-center">
                        <div className="text-[10px] font-bold text-cyan-400 uppercase">Carbs</div>
                        <div className="text-base sm:text-lg font-['Archivo_Black'] text-white">{carbsGram}g</div>
                        <div className="text-[10px] text-neutral-400">45% target</div>
                      </div>

                      <div className="bg-[#161C28] border border-rose-500/30 rounded-xl p-3 text-center">
                        <div className="text-[10px] font-bold text-rose-400 uppercase">Fat</div>
                        <div className="text-base sm:text-lg font-['Archivo_Black'] text-white">{fatGram}g</div>
                        <div className="text-[10px] text-neutral-400">25% target</div>
                      </div>
                    </div>
                  </div>

                  {/* Primary Button to Advance to Plan Selection */}
                  <div className="pt-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSaveProfileAndContinue}
                      disabled={isCreatingOrder}
                      className="w-full py-4 rounded-xl bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-extrabold text-base uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-98"
                    >
                      {isCreatingOrder ? (
                        <>
                          <RefreshCw size={18} className="animate-spin" />
                          <span>{isEN ? "Preparing Plans..." : "Menyiapkan Pilihan Paket..."}</span>
                        </>
                      ) : (
                        <>
                          <span>{isEN ? "Continue: Select Coaching Plan →" : "Lanjut: Pilih Paket Coaching →"}</span>
                          <ChevronRight size={20} className="stroke-[3]" />
                        </>
                      )}
                    </motion.button>
                  </div>
                </motion.div>
              );
            })()}

            {/* STEP 14: PLAN SELECTION */}
            {step === 14 && (
              <motion.div
                key="step14"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-5 max-w-xl mx-auto text-left pb-6"
              >
                <div className="space-y-2">
                  <div className="text-xs font-['Inter'] font-bold text-[#D4FF00] uppercase tracking-widest">
                    {isEN ? "Step 2 of 3 — Plan Selection" : "Tahap 2/3 — Pilih Paket Coaching"}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-['Archivo_Black'] uppercase text-white">
                    {isEN ? "Select Your GymBuddy Plan" : "Pilih Paket Coaching Kamu"}
                  </h2>
                  <p className="text-sm text-neutral-400 max-w-lg">
                    {isEN
                      ? "Start with a 2-day free trial or select a full plan tailored to your fitness goals."
                      : "Mulai dengan uji coba gratis 2 hari atau pilih paket penuh untuk pendampingan maksimal."}
                  </p>
                </div>

                <div className="space-y-3.5 pt-1">
                  {/* OPTION 1: 2-DAY FREE TRIAL */}
                  <div
                    onClick={() => {
                      setSelectedPlan("free_trial");
                      setSelectedFeature(null);
                    }}
                    className={`w-full text-left p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
                      selectedPlan === "free_trial"
                        ? "bg-[#D4FF3D]/10 border-[#D4FF3D]"
                        : "bg-[#161B22] border-neutral-800 hover:border-neutral-700"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className={`font-['Archivo_Black'] text-base sm:text-lg uppercase ${
                            selectedPlan === "free_trial" ? "text-[#D4FF3D]" : "text-white"
                          }`}>
                            {isEN ? "2-Day Free Trial" : "Uji Coba Gratis 2 Hari"}
                          </h3>
                          <span className="px-2 py-0.5 rounded bg-[#D4FF00] text-black text-[10px] font-extrabold uppercase">
                            FREE Rp 0
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-neutral-300 mt-1 leading-relaxed">
                          {isEN
                            ? "Full access to both AI Workout Coach & Nutritionist for 48 hours. No credit card required."
                            : "Akses penuh 2 AI (Workout & Nutrisi) selama 48 jam tanpa bayar sama sekali. Tanpa kartu kredit."}
                        </p>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ml-2 ${
                        selectedPlan === "free_trial" ? "border-[#D4FF3D] bg-[#D4FF3D]" : "border-neutral-600"
                      }`}>
                        {selectedPlan === "free_trial" && <Check size={14} className="text-black stroke-[3]" />}
                      </div>
                    </div>
                  </div>

                  {/* OPTION 2: ADVANCED PLAN (1 SPESIALIS: Mulai Rp 249rb) */}
                  <div
                    className={`w-full text-left p-4 sm:p-5 rounded-2xl border transition-all ${
                      selectedPlan === "advanced"
                        ? "bg-[#161B22] border-[#D4FF3D]"
                        : "bg-[#161B22] border-neutral-800 hover:border-neutral-700"
                    }`}
                  >
                    <div
                      onClick={() => {
                        setSelectedPlan("advanced");
                        if (!selectedFeature) setSelectedFeature("coach");
                      }}
                      className="w-full flex items-start justify-between text-left cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className={`font-['Archivo_Black'] text-base sm:text-lg uppercase ${
                            selectedPlan === "advanced" ? "text-[#D4FF3D]" : "text-white"
                          }`}>
                            {isEN ? "AI Coach (Single Specialist)" : "AI Coach (1 Spesialis)"}
                          </h3>
                          <span className="px-2 py-0.5 rounded bg-neutral-800 text-white text-[11px] font-bold border border-neutral-700">
                            {isEN ? "From Rp 249k (3 Mos)" : "Mulai Rp 249rb (3 Bln)"}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-neutral-300 mt-1">
                          {isEN ? "Focus 100% on 1 feature of your choice:" : "Fokus 100% pada 1 fitur pilihan spesialisasi:"}
                        </p>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ml-2 ${
                        selectedPlan === "advanced" ? "border-[#D4FF3D] bg-[#D4FF3D]" : "border-neutral-600"
                      }`}>
                        {selectedPlan === "advanced" && <Check size={14} className="text-black stroke-[3]" />}
                      </div>
                    </div>

                    {/* Sub-selection for Advanced */}
                    {selectedPlan === "advanced" && (
                      <div className="mt-4 space-y-2 pt-3 border-t border-neutral-800">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFeature("coach");
                            }}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                              selectedFeature === "coach"
                                ? "bg-[#D4FF3D]/10 border-[#D4FF3D]"
                                : "bg-black/40 border-neutral-800 hover:border-neutral-700"
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                              selectedFeature === "coach" ? "bg-[#D4FF3D] text-black" : "bg-neutral-800 text-white"
                            }`}>
                              <Activity size={16} />
                            </div>
                            <div className="text-left">
                              <p className={`font-bold text-xs ${selectedFeature === "coach" ? "text-[#D4FF3D]" : "text-white"}`}>AI Workout Coach</p>
                              <p className="text-[10px] text-neutral-400">{isEN ? "Form check & gym split" : "Koreksi postur & jadwal gym"}</p>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFeature("nutrition");
                            }}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                              selectedFeature === "nutrition"
                                ? "bg-[#D4FF3D]/10 border-[#D4FF3D]"
                                : "bg-black/40 border-neutral-800 hover:border-neutral-700"
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                              selectedFeature === "nutrition" ? "bg-[#D4FF3D] text-black" : "bg-neutral-800 text-white"
                            }`}>
                              <Leaf size={16} />
                            </div>
                            <div className="text-left">
                              <p className={`font-bold text-xs ${selectedFeature === "nutrition" ? "text-[#D4FF3D]" : "text-white"}`}>AI Nutritionist</p>
                              <p className="text-[10px] text-neutral-400">{isEN ? "Meal photo calorie tracking" : "Hitung kalori & foto makanan"}</p>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* OPTION 3: BOTH (ALL-ACCESS: Mulai Rp 399rb) */}
                  <div
                    onClick={() => {
                      setSelectedPlan("premium");
                      setSelectedFeature("both" as any);
                    }}
                    className={`w-full text-left p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden ${
                      selectedPlan === "premium"
                        ? "bg-gradient-to-br from-[#1C2514] via-[#161B22] to-[#111620] border-[#D4FF00] shadow-[0_0_25px_rgba(212,255,0,0.15)]"
                        : "bg-[#161B22] border-neutral-800 hover:border-neutral-700"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={`font-['Archivo_Black'] text-base sm:text-lg uppercase ${
                            selectedPlan === "premium" ? "text-[#D4FF3D]" : "text-white"
                          }`}>
                            {isEN ? "Both: Nutritionist + Workout Coach" : "Both: Nutritionist + Workout Coach"}
                          </h3>
                          <span className="px-2 py-0.5 rounded bg-[#D4FF00] text-black text-[10px] font-extrabold uppercase">
                            {isEN ? "From Rp 399k • MOST POPULAR" : "Mulai Rp 399rb • PALING POPULER"}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-neutral-300 mt-1.5 leading-relaxed">
                          {isEN
                            ? "Both AIs simultaneously (Nutritionist + Workout Coach), Gemini Pro Vision & High Precision Visual Posters."
                            : "2 AI Sekaligus (Nutrisi + Workout Coach), Presisi Tinggi Gemini Pro & Generasi Poster Visual Kemajuan Gym."}
                        </p>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ml-2 ${
                        selectedPlan === "premium" ? "border-[#D4FF3D] bg-[#D4FF3D]" : "border-neutral-600"
                      }`}>
                        {selectedPlan === "premium" && <Check size={14} className="text-black stroke-[3]" />}
                      </div>
                    </div>
                  </div>

                  {/* DURATION SELECTOR (Shown when a paid plan is selected) */}
                  {selectedPlan !== "free_trial" && (
                    <div className="space-y-2.5 pt-2 border-t border-neutral-800">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-neutral-300">
                          {isEN ? "Choose Billing Period:" : "Pilih Periode Langganan:"}
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          {DURATION_LABELS[selectedDuration]?.[isEN ? "en" : "id"]}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {DURATIONS.map((dur) => {
                          const curPlanKey: PlanKey = selectedPlan === "premium"
                            ? "both"
                            : (selectedFeature === "nutrition" ? "nutritionist" : "workout_coach");
                          const entry = PLAN_PRICING[curPlanKey]?.[dur];
                          const isSelected = selectedDuration === dur;
                          return (
                            <button
                              key={dur}
                              type="button"
                              onClick={() => setSelectedDuration(dur)}
                              className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center relative ${
                                isSelected
                                  ? "bg-[#D4FF00]/15 border-[#D4FF00] text-white shadow-sm"
                                  : "bg-[#161B22] border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-white"
                              }`}
                            >
                              {entry?.savingLabel && (
                                <span className="absolute -top-2.5 px-2 py-0.5 rounded-full text-[9px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-xs">
                                  {entry.savingLabel}
                                </span>
                              )}
                              <span className="text-xs font-black">{DURATION_LABELS[dur]?.[isEN ? "en" : "id"]}</span>
                              <span className="text-xs font-bold text-white mt-0.5">{entry?.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Error Banner if Any */}
                {paymentError && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{paymentError}</span>
                  </div>
                )}

                {/* Action CTA Button */}
                <div className="pt-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleCreateOrder(selectedPlan, selectedFeature, selectedDuration)}
                    disabled={isCreatingOrder}
                    className="w-full py-4 rounded-xl bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-extrabold text-base uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-98"
                  >
                    {isCreatingOrder ? (
                      <>
                        <RefreshCw size={18} className="animate-spin" />
                        <span>{isEN ? "Processing Order..." : "Memproses Pesanan..."}</span>
                      </>
                    ) : (
                      <>
                        <span>
                          {selectedPlan === "free_trial"
                            ? (isEN ? "Start 2-Day Free Trial (Rp 0) →" : "Mulai Uji Coba Gratis 2 Hari (Rp 0) →")
                            : (() => {
                                const curPlanKey: PlanKey = selectedPlan === "premium"
                                  ? "both"
                                  : (selectedFeature === "nutrition" ? "nutritionist" : "workout_coach");
                                const curPrice = PLAN_PRICING[curPlanKey]?.[selectedDuration]?.label || "";
                                return isEN
                                  ? `Continue to Checkout (${curPrice}) →`
                                  : `Lanjut ke Pembayaran (${curPrice}) →`;
                              })()}
                        </span>
                        <ChevronRight size={20} className="stroke-[3]" />
                      </>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* STEP 15: ORDER SUMMARY & MIDTRANS SNAP CHECKOUT (PAID PLANS) */}
            {step === 15 && (() => {
              const curPlanKey: PlanKey = selectedPlan === "premium"
                ? "both"
                : (selectedFeature === "nutrition" ? "nutritionist" : "workout_coach");
              const planTitle = selectedPlan === "premium"
                ? "Both: Nutritionist + Workout Coach"
                : (selectedFeature === "nutrition" ? "AI Nutritionist Specialist" : "AI Workout Coach Specialist");
              const grossAmount = getPrice(curPlanKey, selectedDuration);
              const coachLabel = (persona || "max").toLowerCase().includes("mia") ? "Coach Mia" : "Coach Max";
              const durationLabel = DURATION_LABELS[selectedDuration]?.[isEN ? "en" : "id"] || "3 Bulan";

              return (
                <motion.div
                  key="step15"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-5 max-w-md mx-auto text-left pb-6"
                >
                  <div className="space-y-2">
                    <div className="text-xs font-['Inter'] font-bold text-[#D4FF00] uppercase tracking-widest">
                      {isEN ? "Step 3 of 3 — Order & Payment" : "Tahap 3/3 — Ringkasan & Pembayaran"}
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-['Archivo_Black'] uppercase text-white">
                      {isEN ? "Order Summary" : "Ringkasan Pesanan"}
                    </h2>
                    <p className="text-xs sm:text-sm text-neutral-400">
                      {isEN
                        ? "Please complete your payment via Midtrans to unlock full access to your personalized AI coach."
                        : "Selesaikan pembayaran melalui Midtrans untuk membuka akses penuh ke pelatih AI pribadimu."}
                    </p>
                  </div>

                  {/* Order Details Card */}
                  <div className="bg-[#111620] border border-neutral-800 rounded-2xl p-5 space-y-4 shadow-lg">
                    <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                      <span className="text-xs text-neutral-400 font-bold uppercase">{isEN ? "Member Name" : "Nama Member"}</span>
                      <span className="text-sm font-bold text-white">{name || "Member GymBuddy"}</span>
                    </div>

                    <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                      <span className="text-xs text-neutral-400 font-bold uppercase">{isEN ? "Selected Plan" : "Paket Terpilih"}</span>
                      <span className="text-xs sm:text-sm font-extrabold text-[#D4FF00] text-right">{planTitle}</span>
                    </div>

                    <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                      <span className="text-xs text-neutral-400 font-bold uppercase">{isEN ? "Dedicated Coach" : "Pelatih AI"}</span>
                      <span className="text-xs sm:text-sm font-bold text-white">{coachLabel}</span>
                    </div>

                    <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                      <span className="text-xs text-neutral-400 font-bold uppercase">{isEN ? "Billing Period" : "Periode Langganan"}</span>
                      <span className="text-xs sm:text-sm font-medium text-neutral-300">{durationLabel}</span>
                    </div>

                    {orderId && (
                      <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                        <span className="text-xs text-neutral-500 font-bold uppercase">Order ID</span>
                        <span className="text-[11px] font-mono text-neutral-400">{orderId}</span>
                      </div>
                    )}

                    <div className="pt-1 space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-neutral-400">
                        <span>{isEN ? "Subtotal" : "Harga Paket"}</span>
                        <span>Rp {grossAmount.toLocaleString("id-ID")}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-neutral-400">
                        <span>{isEN ? "Service Fee" : "Biaya Layanan"}</span>
                        <span className="text-[#25D366] font-bold">Rp 0 (FREE)</span>
                      </div>
                      <div className="flex items-center justify-between text-base font-['Archivo_Black'] text-white pt-2 border-t border-neutral-800">
                        <span>{isEN ? "Total Payment" : "Total Pembayaran"}</span>
                        <span className="text-[#D4FF00]">Rp {grossAmount.toLocaleString("id-ID")}</span>
                      </div>
                    </div>
                  </div>

                  {/* Included Features List */}
                  <div className="p-4 rounded-xl bg-[#161C28] border border-neutral-800/80 space-y-2 text-xs text-neutral-300">
                    <p className="font-bold text-white flex items-center gap-1.5 text-xs">
                      <CheckCircle2 size={15} className="text-[#D4FF00]" />
                      <span>{isEN ? "What's Included in Your Plan:" : "Fitur yang Langsung Kamu Dapatkan:"}</span>
                    </p>
                    <ul className="space-y-1.5 pl-5 list-disc text-neutral-400 text-[11px]">
                      <li>{isEN ? "Instant 24/7 AI chat via WhatsApp" : "Akses interaksi 24/7 via WhatsApp tanpa antri"}</li>
                      <li>{isEN ? "Vision AI meal analysis from photos" : "Foto makanan langsung terdeteksi kalori & makronya"}</li>
                      <li>{isEN ? "Personalized workout routine respecting your injuries" : "Jadwal workout menyesuaikan alat gym & catatan cedera"}</li>
                    </ul>
                  </div>

                  {/* Payment Error & Retry Notice */}
                  {paymentError && (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                      <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                        <AlertCircle size={16} className="shrink-0" />
                        <span>{paymentError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRetryPayment}
                        className="w-full py-2.5 rounded-xl bg-amber-500 text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer hover:bg-amber-400"
                      >
                        <RefreshCw size={14} />
                        <span>{isEN ? "Retry Payment" : "Coba Bayar Lagi"}</span>
                      </button>
                    </div>
                  )}

                  {/* Primary "Pay Now" Button */}
                  <div className="pt-2 space-y-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => triggerSnapPayment()}
                      className="w-full py-4 rounded-xl bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-extrabold text-base uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-98"
                    >
                      <Lock size={18} />
                      <span>{isEN ? "Pay Now via Midtrans Snap" : "Bayar Sekarang (Midtrans)"}</span>
                    </motion.button>

                    <button
                      type="button"
                      onClick={() => setStep(14)}
                      className="w-full py-2.5 text-xs text-neutral-400 hover:text-white font-bold transition-colors cursor-pointer text-center"
                    >
                      ← {isEN ? "Change Selected Plan" : "Ubah Pilihan Paket"}
                    </button>
                  </div>

                  {/* Midtrans Trust Badge */}
                  <div className="p-3 bg-[#111620] border border-neutral-800/60 rounded-xl text-center text-[10px] text-neutral-500 space-y-1">
                    <p className="font-bold text-neutral-400">🛡️ Pembayaran Resmi & Terverifikasi Otomatis</p>
                    <p>Mendukung GoPay, QRIS, BCA/Mandiri/BRI Virtual Account, dan Kartu Kredit.</p>
                  </div>
                </motion.div>
              );
            })()}

            {/* STEP 16: ACCOUNT ACTIVATED & DUAL LAUNCH */}
            {step === 16 && (() => {
              const coachLabel = (persona || "max").toLowerCase().includes("mia") ? "Coach Mia" : "Coach Max";
              const planTitle = selectedPlan === "premium"
                ? "Both: Nutritionist + Workout Coach"
                : (selectedPlan === "free_trial"
                    ? "Free Trial 2 Hari"
                    : (selectedFeature === "nutrition" ? "AI Nutritionist Specialist" : "AI Workout Coach Specialist"));

              // Generate official GymBuddy AI bot destination URL (USER -> GYMBUDDY BOT)
              const e164 = normalizePhoneToE164(phone);
              const botNumber = (
                backendBotNumber ||
                (typeof window !== "undefined" ? (import.meta as any).env?.VITE_WHATSAPP_BOT_NUMBER : "") ||
                "14155238886"
              ).replace(/[^\d]/g, "");

              const goalDisplayName = goal === "lose" ? "fat loss" : (goal === "gain" ? "muscle gain" : "maintain");
              const prefilledText = `Hello ${coachLabel}! Saya ${name || "Member"}, baru saja menyelesaikan onboarding di GymBuddy untuk program ${goalDisplayName}. Saya siap mulai.`;
              const customWaMsg = encodeURIComponent(prefilledText);
              const waBotUrl = `https://wa.me/${botNumber}?text=${customWaMsg}`;

              return (
                <motion.div
                  key="step16"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-6 max-w-md mx-auto text-center pb-6"
                >
                  {/* Glowing Success Badge */}
                  <div className="w-20 h-20 rounded-3xl bg-[#D4FF00]/20 border-2 border-[#D4FF00] flex items-center justify-center mx-auto text-[#D4FF00] shadow-[0_0_40px_rgba(212,255,0,0.25)]">
                    <Sparkles size={38} />
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-['Inter'] font-extrabold text-[#D4FF00] uppercase tracking-widest">
                      {isEN ? "ACCOUNT ACTIVATED" : "AKUN RESMI DIAKTIFKAN"}
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-['Archivo_Black'] text-white">
                      {isEN ? `Welcome, ${name || "Champion"}!` : `Selamat Bergabung, ${name || "Juara"}!`}
                    </h1>
                    <p className="text-neutral-300 text-xs sm:text-sm max-w-sm mx-auto leading-relaxed">
                      {isEN
                        ? `Your personalized program is active with ${coachLabel}. You can now start chatting on WhatsApp or explore your web dashboard!`
                        : `Program latihan & nutrisimu telah aktif bersama ${coachLabel}. Kamu bisa langsung chat di WhatsApp atau jelajahi web dashboard!`}
                    </p>
                  </div>

                  {/* Account Summary Card */}
                  <div className="bg-[#161C28] border border-neutral-800 rounded-2xl p-4 text-left space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">{isEN ? "Active Plan" : "Paket Aktif"}</span>
                      <span className="font-extrabold text-[#D4FF00]">{planTitle}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">{isEN ? "Dedicated AI Coach" : "Pelatih AI"}</span>
                      <span className="font-bold text-white">{coachLabel}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">{isEN ? "Connected WhatsApp" : "Nomor WhatsApp"}</span>
                      <span className="font-mono text-[#25D366] font-bold">+{e164 || phone}</span>
                    </div>
                    {orderId && (
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-400">Order ID</span>
                        <span className="font-mono text-neutral-400 text-[11px]">{orderId}</span>
                      </div>
                    )}
                  </div>

                  {/* Dual Launch Actions */}
                  <div className="space-y-3 pt-2">
                    {/* Primary Button: Open WhatsApp Bot */}
                    <motion.a
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      href={waBotUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-extrabold text-base uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_25px_rgba(37,211,102,0.3)] active:scale-98"
                    >
                      <WhatsAppIcon className="w-5 h-5 text-white" />
                      <span>{isEN ? "Start Chatting on WhatsApp →" : "Mulai Chat di WhatsApp →"}</span>
                    </motion.a>

                    {/* Secondary Button: Enter Web Dashboard */}
                    <button
                      type="button"
                      onClick={() => {
                        if (onComplete) {
                          onComplete();
                        }
                      }}
                      className="w-full py-3.5 rounded-xl bg-[#111620] hover:bg-neutral-800 border border-neutral-700 text-white font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span>{isEN ? "Open Web Dashboard" : "Buka Web Dashboard"}</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </motion.div>
              );
            })()}
          </AnimatePresence>
        </main>

        {/* EXISTING ACCOUNT DETECTED MODAL */}
        <AnimatePresence>
          {existingAccountDetected && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="max-w-md w-full bg-[#0d1117] border border-white/[0.12] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-white text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
                  <AlertCircle size={32} />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl sm:text-2xl font-['Archivo_Black'] tracking-tight">
                    {isEN ? "Account already exists" : "Akun Sudah Terdaftar"}
                  </h3>
                  <p className="text-neutral-400 text-sm leading-relaxed">
                    {isEN
                      ? "An account is already registered with this WhatsApp number."
                      : "Nomor WhatsApp ini sudah terdaftar di akun GymBuddy."}
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  {/* Primary Action: Log In */}
                  <button
                    type="button"
                    onClick={() => {
                      setExistingAccountDetected(false);
                      if (onOpenLogin) {
                        onOpenLogin(normalizePhoneToE164(phone) || phone);
                      }
                    }}
                    className="w-full py-4 rounded-xl bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-98"
                  >
                    <span>{isEN ? "Log in" : "Masuk ke Akun"}</span>
                    <ChevronRight size={18} className="stroke-[3]" />
                  </button>

                  {/* Secondary Action: Use another number */}
                  <button
                    type="button"
                    onClick={() => {
                      setExistingAccountDetected(false);
                      setPhone("");
                      setPhoneCheckError(null);
                    }}
                    className="w-full py-3.5 rounded-xl bg-[#161B22] hover:bg-neutral-800 border border-white/[0.1] text-neutral-300 hover:text-white font-bold text-sm transition-all cursor-pointer"
                  >
                    {isEN ? "Use another number" : "Gunakan nomor lain"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* FOOTER CTA BUTTON FOR PROGRESSION (STEPS 1 TO 12) */}
        {step <= 12 && (
          <div className="absolute bottom-0 inset-x-0 p-4 sm:p-6 bg-gradient-to-t from-[#111111] via-[#111111]/95 to-transparent pb-6 sm:pb-8 z-30 pointer-events-none">
            <div className="max-w-2xl mx-auto pointer-events-auto">
              <button
                onClick={handleNext}
                disabled={!canProceed() || isCheckingPhone}
                className={`w-full py-4 rounded-xl font-extrabold text-base tracking-wide transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer ${
                  canProceed() && !isCheckingPhone
                    ? "bg-[#D4FF00] text-black hover:bg-[#c4f000]"
                    : "bg-[#111620] text-neutral-600 border border-neutral-800 cursor-not-allowed"
                }`}
              >
                {isCheckingPhone ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    <span>{isEN ? "Verifying WhatsApp..." : "Memverifikasi WhatsApp..."}</span>
                  </>
                ) : (
                  <>
                    <span>
                      {step === 6 || step === 10
                        ? (isEN ? "Continue to Next Stage →" : "Lanjut ke Tahap Berikutnya →")
                        : step === 12
                        ? (isEN ? "Generate My Nutrition Plan →" : "Buat Rencana Nutrisi Saya →")
                        : (isEN ? "Continue" : "Lanjut")}
                    </span>
                    {canProceed() && step !== 6 && step !== 10 && (
                      <ChevronRight size={18} className="stroke-[3]" />
                    )}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        </div>
      </div>
    </div>
  );
}
