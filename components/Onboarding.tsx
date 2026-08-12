import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
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
  Sparkles
} from "lucide-react";

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
}

export default function Onboarding({ language = "EN", onComplete }: OnboardingProps) {
  const isEN = language === "EN";
  const [step, setStep] = useState(1);
  const totalSteps = 12;

  // Form States
  const [name, setName] = useState("");
  const [goal, setGoal] = useState<"maintain" | "lose" | "gain" | "health">("maintain");
  const [goalEvent, setGoalEvent] = useState("daily");
  const [goalSecondary, setGoalSecondary] = useState<string[]>(["portion_control"]);
  const [emotionalVision, setEmotionalVision] = useState("confidence");

  // Personal & Biometrics
  const [gender, setGender] = useState<"pria" | "wanita">("pria");
  const [weight, setWeight] = useState("65");
  const [height, setHeight] = useState("170");
  const [age, setAge] = useState("25");
  const [userTargetWeight, setUserTargetWeight] = useState("");

  // Lifestyle & Workout Constraints
  const [activityLevel, setActivityLevel] = useState("sedentary");
  const [experience, setExperience] = useState("beginner");
  const [satisfaction, setSatisfaction] = useState("medium");
  const [challenges, setChallenges] = useState<string[]>(["nyerah", "gorengan"]);

  // Physical Limitations / Injuries & Equipment
  const [injuries, setInjuries] = useState<string[]>(["none"]);
  const [customInjury, setCustomInjury] = useState("");
  const [equipment, setEquipment] = useState<"full_gym" | "dumbbells" | "bodyweight">("full_gym");

  // Persona Selection
  const [persona, setPersona] = useState<"max" | "mia">("max");

  // Plan Selection ('free_trial' | 'advanced' | 'premium')
  const [selectedPlan, setSelectedPlan] = useState<"free_trial" | "advanced" | "premium">("free_trial");
  const [selectedFeature, setSelectedFeature] = useState<"nutrition" | "coach" | null>("coach");

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

  // Auto progression on step 13 (Loading) to step 14 (Success)
  useEffect(() => {
    if (step === 13) {
      const saveProfile = async () => {
        let computedGoalTitle = "Gaya Hidup Sehat & Fit";
        
        const hM = (Number(height) || 170) / 100;
        const currentW = Number(weight) || 65;
        const bmiIdealW = Math.round(22 * hM * hM * 2) / 2;
        const aiRecommendedW = Math.min(currentW - 2, Math.max(45, bmiIdealW));

        let computedTargetWeight = Number(userTargetWeight) || currentW;
        if (goal === "lose") {
          computedGoalTitle = "Menurunkan Berat Badan";
          if (!userTargetWeight) computedTargetWeight = aiRecommendedW;
        } else if (goal === "gain") {
          computedGoalTitle = "Menaikkan Berat Badan";
          if (!userTargetWeight) computedTargetWeight = currentW + 5;
        } else if (goal === "health" || goal === "maintain") {
          computedGoalTitle = "Gaya Hidup Sehat & Fit";
          computedTargetWeight = currentW;
        }

        const activeService = (selectedPlan === "premium" || selectedPlan === "free_trial") 
          ? "both" 
          : (selectedFeature === "coach" ? "workout" : "nutritionist");

        const userObj = {
          name,
          goal,
          goalTitle: computedGoalTitle,
          goalEvent,
          goalSecondary,
          emotionalVision,
          gender,
          weight: Number(weight) || 65,
          startWeight: Number(weight) || 65,
          targetWeight: computedTargetWeight,
          aiRecommendedTargetWeight: aiRecommendedW,
          height: Number(height) || 165,
          age: Number(age) || 25,
          activityLevel,
          experience,
          satisfaction,
          challenges,
          injuries,
          customInjury,
          equipment,
          persona,
          plan: selectedPlan,
          feature: selectedFeature,
          activeService,
          phone
        };

        try {
          const cleaned = phone.replace(/\D/g, '');
          const norm = cleaned.startsWith('62') ? '0' + cleaned.substring(2) : (cleaned.startsWith('8') ? '0' + cleaned : cleaned);
          localStorage.setItem(`gymbuddy_user_${norm}`, JSON.stringify(userObj));
          localStorage.setItem("gymbuddy_last_user", JSON.stringify(userObj));
        } catch (e) {}

        try {
          const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "";
          await fetch(`${API_BASE_URL}/api/onboarding`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone,
              profile: userObj
            }),
          });
        } catch (e) {
          console.error("Failed to save profile", e);
        }
      };
      saveProfile();

      const interval = setInterval(() => {
        setLoadingMsgIdx((prev) => (prev + 1) % loadingMsgs.length);
      }, 1400);

      const timeout = setTimeout(() => {
        setStep(14);
      }, 5000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [step, phone, name, goal, goalEvent, goalSecondary, emotionalVision, gender, weight, height, age, activityLevel, experience, satisfaction, challenges, persona, selectedPlan, selectedFeature]);

  const handleNext = () => setStep((p) => Math.min(p + 1, 14));
  const handlePrev = () => setStep((p) => Math.max(p - 1, 1));

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

  const canProceed = () => {
    switch (step) {
      case 1: return name.trim().length > 0;
      case 2: return goal !== undefined;
      case 3: return goalEvent !== "" && goalSecondary.length > 0;
      case 4: return emotionalVision !== "";
      case 5: return true; // Analysis 1 screen
      case 6: return weight !== "" && height !== "" && age !== "";
      case 7: return activityLevel !== "" && experience !== "" && satisfaction !== "";
      case 8: return challenges.length > 0;
      case 9: return true; // Analysis 2 screen
      case 10: return true; // Persona selection has defaults
      case 11: return selectedPlan === "free_trial" || selectedPlan === "premium" || (selectedPlan === "advanced" && selectedFeature !== null);
      case 12: return phone.trim().length >= 8;
      default: return true;
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
        {step <= 12 && (
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
        )}

        {/* MAIN STEP CONTENT */}
        <main className="flex-grow flex flex-col justify-center pb-28">
          <AnimatePresence mode="wait">

            {/* STEP 1: NAME INPUT */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 sm:space-y-8"
              >
                <div className="space-y-3">
                  <div className="text-xs font-['Inter'] font-bold text-[#D4FF00] uppercase tracking-widest">
                    {isEN ? "Step 1 — Introduction" : "Langkah 1 — Perkenalan"}
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

            {/* STEP 2: MAIN GOAL SELECTION */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 sm:space-y-8"
              >
                <div className="space-y-2">
                  <div className="text-xs font-['Inter'] font-bold text-[#D4FF00] uppercase tracking-widest">
                    {isEN ? "Step 2 — Primary Target" : "Langkah 2 — Target Utama"}
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
                      onClick={() => setGoal(item.id as any)}
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

            {/* STEP 3: GOAL-SPECIFIC CONTEXT & EVENT SELECTION */}
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
                    {isEN ? `Step 3 — Target Details: ${goalData.title}` : `Langkah 3 — Detail Target: ${goalData.title}`}
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

            {/* STEP 4: EMOTIONAL VISION */}
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
                    {isEN ? "Step 4 — Expected Outcome" : "Langkah 4 — Hasil yang Diharapkan"}
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

            {/* STEP 5: FIRST REPORT SCREEN */}
            {step === 5 && (
              <motion.div
                key="step5"
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

                  <div className="p-4 rounded-xl bg-[#161C28] border border-neutral-800 text-xs text-neutral-400 flex items-center gap-3">
                    <Activity className="w-4 h-4 text-[#D4FF00] shrink-0" />
                    <span>
                      {isEN
                        ? "Based on aggregated analysis of 12,400+ active GymBuddy users."
                        : "Berdasarkan analisis teragregasi dari 12,400+ pengguna aktif GymBuddy."}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 6: PERSONAL DATA & BIOMETRICS */}
            {step === 6 && (
              <motion.div
                key="step6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 sm:space-y-8"
              >
                <div className="space-y-2">
                  <div className="text-xs font-['Inter'] font-bold text-[#D4FF00] uppercase tracking-widest">
                    {isEN ? "Step 5 — Biometric Data" : "Langkah 5 — Data Biometrik"}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-['Archivo_Black'] tracking-tight leading-tight text-white">
                    {isEN ? "Physical & Metabolism Data" : "Data Fisik & Metabolisme"}
                  </h1>
                  <p className="text-neutral-400 text-sm">
                    {isEN ? "Used to calculate BMR (Basal Metabolic Rate) and daily calorie needs." : "Digunakan untuk menghitung BMR (Basal Metabolic Rate) dan kebutuhan kalori harian."}
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
                          value={weight}
                          onChange={(e) => setWeight(e.target.value)}
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
                          value={height}
                          onChange={(e) => setHeight(e.target.value)}
                          placeholder="170"
                          className="w-full bg-[#111620] border border-neutral-800 rounded-xl pl-11 pr-4 py-3.5 text-lg font-bold text-white focus:outline-none focus:border-[#D4FF00]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Age */}
                  <div>
                    <label className="block text-xs font-['Inter'] font-bold text-neutral-400 uppercase tracking-wider mb-2">
                      {isEN ? "Age (Years)" : "Usia (Tahun)"}
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                      <input
                        type="number"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        placeholder="25"
                        className="w-full bg-[#111620] border border-neutral-800 rounded-xl pl-11 pr-4 py-3.5 text-lg font-bold text-white focus:outline-none focus:border-[#D4FF00]"
                      />
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
                            value={userTargetWeight || recW}
                            onChange={(e) => setUserTargetWeight(e.target.value)}
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
                </div>
              </motion.div>
            )}

            {/* STEP 7: LIFESTYLE & EXPERIENCE */}
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
                    {isEN ? "Step 6 — Lifestyle" : "Langkah 6 — Gaya Hidup"}
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

                {/* Sub 4: Equipment Availability for Workout Coach */}
                <div className="space-y-3 pt-3 border-t border-neutral-800/80">
                  <label className="block text-xs font-['Inter'] font-bold text-[#D4FF00] uppercase tracking-wider">
                    {isEN ? "Available Workout Equipment" : "Ketersediaan Alat Latihan (Equipment)"}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {[
                      { id: "full_gym", title: isEN ? "Full Gym Equipment" : "Alat Gym Lengkap", desc: isEN ? "Barbells, Cable, Machines" : "Gym Commercial / Fitness Center" },
                      { id: "dumbbells", title: isEN ? "Dumbbells Only" : "Dumbbell di Rumah", desc: isEN ? "Home dumbbells & bench" : "Set Dumbbell / Beban Rumah" },
                      { id: "bodyweight", title: isEN ? "Bodyweight (No Equipment)" : "Tanpa Alat / Rumah", desc: isEN ? "Calisthenics & Home Workouts" : "Latihan Pakai Beban Tubuh" }
                    ].map((eq) => (
                      <button
                        key={eq.id}
                        type="button"
                        onClick={() => setEquipment(eq.id as any)}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                          equipment === eq.id
                            ? "bg-[#D4FF00] text-black border-[#D4FF00]"
                            : "bg-[#111620] text-white border-neutral-800 hover:border-neutral-700"
                        }`}
                      >
                        <p className="font-extrabold text-xs sm:text-sm mb-0.5">{eq.title}</p>
                        <p className={`text-[11px] ${equipment === eq.id ? "text-black/80 font-medium" : "text-neutral-400"}`}>{eq.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sub 5: Physical Limitations / Injuries */}
                <div className="space-y-3 pt-3 border-t border-neutral-800/80">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-['Inter'] font-bold text-[#D4FF00] uppercase tracking-wider">
                      {isEN ? "Injuries or Physical Limitations (Optional)" : "Cedera atau Keterbatasan Fisik (Opsional)"}
                    </label>
                    <span className="text-[10px] text-neutral-400 font-medium">
                      {isEN ? "AI Coach will adapt exercises" : "AI akan menyesuaikan gerakan"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: "none", label: isEN ? "None (Fully Healthy)" : "Sehat (Tanpa Cedera)" },
                      { id: "knee", label: isEN ? "Knee Pain" : "Nyeri Lutut" },
                      { id: "lower_back", label: isEN ? "Lower Back Pain" : "Nyeri Punggung Bawah" },
                      { id: "shoulder", label: isEN ? "Shoulder Injury" : "Cedera Bahu" },
                      { id: "hypertension", label: isEN ? "Vertigo / High BP" : "Vertigo / Darah Tinggi" }
                    ].map((inj) => {
                      const isSel = injuries.includes(inj.id);
                      return (
                        <button
                          key={inj.id}
                          type="button"
                          onClick={() => {
                            if (inj.id === "none") {
                              setInjuries(["none"]);
                            } else {
                              setInjuries((prev) => {
                                const filter = prev.filter((i) => i !== "none");
                                return filter.includes(inj.id) ? filter.filter((i) => i !== inj.id) : [...filter, inj.id];
                              });
                            }
                          }}
                          className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all text-left flex items-center justify-between cursor-pointer ${
                            isSel
                              ? "bg-[#D4FF00]/10 border-[#D4FF00] text-[#D4FF00]"
                              : "bg-[#111620] text-neutral-300 border-neutral-800 hover:border-neutral-700"
                          }`}
                        >
                          <span>{inj.label}</span>
                          {isSel && <Check size={14} className="text-[#D4FF00] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="text"
                    value={customInjury}
                    onChange={(e) => setCustomInjury(e.target.value)}
                    placeholder={isEN ? "Other specific condition (e.g. wrist pain, asthma...)" : "Catatan khusus lain (misal: nyeri pergelangan tangan, asma...)"}
                    className="w-full bg-[#111620] border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#D4FF00]"
                  />
                </div>
              </motion.div>
            )}

            {/* STEP 8: DIET & CHALLENGES */}
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
                    {isEN ? "Step 7 — Your Main Challenge" : "Langkah 7 — Tantangan Utamamu"}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-['Archivo_Black'] tracking-tight leading-tight text-white">
                    {isEN ? "Biggest Consistency Obstacle?" : "Tantangan Terbesar dalam Konsistensi?"}
                  </h1>
                  <p className="text-neutral-400 text-xs sm:text-sm">
                    {isEN ? "Choose the factors that most often block your daily progress:" : "Pilih faktor yang paling sering menjadi hambatan harianmu:"}
                  </p>
                </div>

                <div className="space-y-2.5">
                  {[
                    { id: "nyerah", icon: Zap, title: isEN ? "Maintaining Consistency" : "Kesulitan Menjaga Konsistensi", desc: isEN ? "Minor mistakes lead to frustration and quitting mid-way." : "Kesalahan kecil memicu rasa kecewa sehingga berhenti di tengah jalan." },
                    { id: "gorengan", icon: Utensils, title: isEN ? "Snacking & Processed Foods" : "Ngemil & Makanan Olahan", desc: isEN ? "Cravings make it difficult to control snack portions." : "Sering lapar mata dan sulit membatasi porsi cemilan." },
                    { id: "kalori", icon: Scale, title: isEN ? "Hesitation Counting Portions" : "Keraguan Menghitung Porsi", desc: isEN ? "Lacking time or tools for manual gram scales." : "Tidak memiliki waktu atau timbangan gramasi manual." },
                    { id: "malam", icon: Clock, title: isEN ? "Late Night Cravings" : "Keinginan Makan di Malam Hari", desc: isEN ? "Appetite spikes during evening or resting hours." : "Nafsu makan meningkat saat malam atau waktu istirahat." },
                    { id: "masak", icon: Flame, title: isEN ? "Limited Cooking Time" : "Keterbatasan Waktu Memasak", desc: isEN ? "Frequently buying takeout or ordering online food." : "Sering membeli makanan luar atau memesan secara online." }
                  ].map((ch) => (
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

            {/* STEP 9: SECOND REPORT SCREEN */}
            {step === 9 && (
              <motion.div
                key="step9"
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

            {/* STEP 10: PERSONA SELECTION */}
            {step === 10 && (
              <motion.div
                key="step10"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 sm:space-y-8"
              >
                <div className="space-y-2">
                  <div className="text-xs font-['Inter'] font-bold text-[#D4FF00] uppercase tracking-widest">
                    {isEN ? "Step 9 — AI Communication Style" : "Langkah 9 — Gaya Komunikasi AI"}
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
              </motion.div>
            )}

            {/* STEP 11: PLAN SELECTION */}
            {step === 11 && (
              <motion.div
                key="step11"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col h-full"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-[#161B22] flex items-center justify-center text-[#D4FF3D] border border-neutral-800">
                    <Check size={20} />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-['Archivo_Black'] uppercase text-white">
                    {isEN ? "Select Your Plan" : "Pilih Paket Kamu"}
                  </h2>
                </div>
                <p className="text-sm sm:text-base text-neutral-400 mb-6 max-w-lg">
                  {isEN
                    ? "Start with a 2-day free trial or select a full plan tailored to your fitness goals."
                    : "Mulai dengan uji coba gratis 2 hari atau pilih paket penuh sesuai kebutuhan kebugaranmu."}
                </p>

                <div className="space-y-3.5 max-w-2xl flex-grow">
                  {/* Option 1: 2-Day Free Trial */}
                  <button
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
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className={`font-['Archivo_Black'] text-base sm:text-lg uppercase ${
                            selectedPlan === "free_trial" ? "text-[#D4FF3D]" : "text-white"
                          }`}>
                            {isEN ? "2-Day Free Trial" : "Uji Coba Gratis 2 Hari"}
                          </h3>
                          <span className="px-2 py-0.5 rounded bg-[#D4FF00] text-black text-[10px] font-extrabold uppercase">
                            FREE $0
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                          {isEN
                            ? "Full access to both AI Workout Coach & Nutritionist for 48 hours. No credit card required."
                            : "Akses penuh 2 AI (Workout & Nutrisi) selama 48 jam tanpa bayar sama sekali."}
                        </p>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selectedPlan === "free_trial" ? "border-[#D4FF3D] bg-[#D4FF3D]" : "border-neutral-600"
                      }`}>
                        {selectedPlan === "free_trial" && <Check size={14} className="text-black stroke-[3]" />}
                      </div>
                    </div>
                  </button>

                  {/* Option 2: Advanced Plan ($5 / Rp 79.000) */}
                  <div
                    className={`w-full text-left p-4 sm:p-5 rounded-2xl border transition-all ${
                      selectedPlan === "advanced"
                        ? "bg-[#161B22] border-[#D4FF3D]"
                        : "bg-[#161B22] border-neutral-800 hover:border-neutral-700"
                    }`}
                  >
                    <button
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
                            Advanced Plan
                          </h3>
                          <span className="px-2 py-0.5 rounded bg-neutral-800 text-white text-[11px] font-bold border border-neutral-700">
                            {isEN ? "$5 / mo" : "Rp 79rb / bln"}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                          {isEN ? "Focus 100% on 1 feature of your choice" : "Fokus 100% pada 1 fitur pilihanmu"}
                        </p>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selectedPlan === "advanced" ? "border-[#D4FF3D] bg-[#D4FF3D]" : "border-neutral-600"
                      }`}>
                        {selectedPlan === "advanced" && <Check size={14} className="text-black stroke-[3]" />}
                      </div>
                    </button>

                    {/* Sub-selection for Advanced */}
                    {selectedPlan === "advanced" && (
                      <div className="mt-4 space-y-2 pt-3 border-t border-neutral-800">
                        <p className="text-xs font-bold text-neutral-300">
                          {isEN ? "Select 1 feature to activate:" : "Pilih 1 fitur spesialisasi yang diaktifkan:"}
                        </p>
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
                                : "bg-black/40 border-transparent hover:border-neutral-700"
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                              selectedFeature === "coach" ? "bg-[#D4FF3D] text-black" : "bg-neutral-800 text-white"
                            }`}>
                              <Activity size={16} />
                            </div>
                            <div className="text-left">
                              <p className={`font-bold text-xs ${selectedFeature === "coach" ? "text-[#D4FF3D]" : "text-white"}`}>AI Workout Coach</p>
                              <p className="text-[10px] text-neutral-500">{isEN ? "Form check & workout split" : "Koreksi postur & jadwal gym"}</p>
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
                                : "bg-black/40 border-transparent hover:border-neutral-700"
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                              selectedFeature === "nutrition" ? "bg-[#D4FF3D] text-black" : "bg-neutral-800 text-white"
                            }`}>
                              <Leaf size={16} />
                            </div>
                            <div className="text-left">
                              <p className={`font-bold text-xs ${selectedFeature === "nutrition" ? "text-[#D4FF3D]" : "text-white"}`}>AI Nutritionist</p>
                              <p className="text-[10px] text-neutral-500">{isEN ? "Meal logging & macro targets" : "Hitung kalori & foto makanan"}</p>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Option 3: Premium Plan ($8 / Rp 139.000) */}
                  <button
                    onClick={() => {
                      setSelectedPlan("premium");
                      setSelectedFeature(null);
                    }}
                    className={`w-full text-left p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
                      selectedPlan === "premium"
                        ? "bg-[#D4FF3D]/10 border-[#D4FF3D]"
                        : "bg-[#161B22] border-neutral-800 hover:border-neutral-700"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className={`font-['Archivo_Black'] text-base sm:text-lg uppercase ${
                            selectedPlan === "premium" ? "text-[#D4FF3D]" : "text-white"
                          }`}>
                            {isEN ? "Premium Plan (All-Access)" : "Paket Premium (All-Access)"}
                          </h3>
                          <span className="px-2 py-0.5 rounded bg-[#D4FF00] text-black text-[10px] font-extrabold uppercase">
                            {isEN ? "$8 / mo" : "Rp 139rb / bln"}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                          {isEN
                            ? "Both AIs (Nutritionist + Workout Coach), Gemini Pro Vision & Visual Infographic Poster Generation."
                            : "2 AI Sekaligus (Nutrisi + Workout Coach), Presisi Tinggi Gemini Pro & Generasi Poster Visual Gym."}
                        </p>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selectedPlan === "premium" ? "border-[#D4FF3D] bg-[#D4FF3D]" : "border-neutral-600"
                      }`}>
                        {selectedPlan === "premium" && <Check size={14} className="text-black stroke-[3]" />}
                      </div>
                    </div>
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 12: PHONE NUMBER & WHATSAPP DELIVERY */}
            {step === 12 && (
              <motion.div
                key="step12"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 sm:space-y-8"
              >
                <div className="space-y-2">
                  <div className="text-xs font-['Inter'] font-bold text-[#25D366] uppercase tracking-widest flex items-center gap-1.5">
                    <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                    <span>{isEN ? "Final Step" : "Langkah Terakhir"}</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-['Archivo_Black'] tracking-tight leading-tight text-white">
                    {isEN ? "WhatsApp Plan Delivery Number" : "Nomor WhatsApp Pengiriman Rencana"}
                  </h1>
                  <p className="text-neutral-400 text-sm">
                    {isEN
                      ? "Your nutrition targets & personal analysis plan will be sent directly by the GymBuddy Assistant to your WhatsApp."
                      : "Rencana target nutrisi & analisis personal akan dikirimkan langsung oleh Asisten GymBuddy ke WhatsApp Anda."}
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <WhatsAppIcon className="w-5 h-5 text-[#25D366]" />
                    <span className="text-base font-bold text-white border-r border-neutral-700 pr-3">+62</span>
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="81234567890"
                    autoFocus
                    className="w-full bg-[#111620] border border-neutral-800 rounded-xl pl-24 pr-5 py-4 text-lg font-bold text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#25D366]"
                  />
                </div>

                <div className="p-4 rounded-xl bg-[#111620] border border-neutral-800 flex items-start gap-3 text-xs text-neutral-400">
                  <ShieldCheck className="w-5 h-5 text-[#25D366] shrink-0 mt-0.5" />
                  <span>
                    {isEN
                      ? "Privacy guaranteed. Your number is only used for personal report delivery & nutrition guidance."
                      : "Kerahasiaan terjamin. Nomor Anda hanya digunakan untuk pengiriman laporan personal & panduan nutrisi."}
                  </span>
                </div>
              </motion.div>
            )}

            {/* STEP 13: PLAN GENERATION LOADER */}
            {step === 13 && (
              <motion.div
                key="step13"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center text-center space-y-8 min-h-[45vh]"
              >
                <div className="w-16 h-16 border-4 border-neutral-800 border-t-[#D4FF00] rounded-full animate-spin"></div>

                <div className="space-y-3 max-w-sm">
                  <h2 className="text-2xl font-['Archivo_Black'] text-white">
                    {isEN ? "Crafting Your Personal Plan" : "Menyusun Rencana Personal"}
                  </h2>
                  <div className="h-6">
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={loadingMsgIdx}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="text-neutral-400 font-medium text-xs sm:text-sm"
                      >
                        {loadingMsgs[loadingMsgIdx]}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 14: SUCCESS & OPEN WHATSAPP */}
            {step === 14 && (
              <motion.div
                key="step14"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center text-center space-y-6 min-h-[45vh]"
              >
                <div className="w-16 h-16 bg-[#25D366]/10 rounded-full flex items-center justify-center border border-[#25D366]/30">
                  <Check className="w-8 h-8 text-[#25D366]" strokeWidth={3} />
                </div>

                <div className="space-y-2 max-w-sm">
                  <h2 className="text-2xl sm:text-3xl font-['Archivo_Black'] text-white">
                    {isEN ? "Plan Ready to Send!" : "Rencana Siap Dikirim!"}
                  </h2>
                  <p className="text-neutral-400 text-sm">
                    {isEN
                      ? `Hello ${name}! GymBuddy AI has calculated your BMR and constructed a custom daily nutrition guide for you.`
                      : `Halo ${name}! GymBuddy AI telah menghitung BMR dan menyusun panduan nutrisi harian khusus untukmu.`}
                  </p>
                </div>

                <motion.a
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  href={`https://wa.me/${(import.meta as any).env?.VITE_WHATSAPP_BOT_NUMBER || "14155238886"}?text=${encodeURIComponent(
                    `Halo GymBuddy AI! Saya ${name || "Member"}, target saya adalah ${goalData.title}. Tolong kirimkan analisis & target harian saya ya.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onComplete}
                  className="mt-4 px-8 py-4 bg-[#25D366] text-black font-extrabold rounded-full text-base hover:bg-[#20bd5a] transition-all flex items-center gap-2.5 cursor-pointer"
                >
                  <WhatsAppIcon className="w-5 h-5" />
                  <span>{isEN ? "Open WhatsApp & Get Plan" : "Buka WhatsApp & Terima Rencana"}</span>
                </motion.a>
              </motion.div>
            )}

          </AnimatePresence>
        </main>

        {/* FOOTER CTA BUTTON FOR PROGRESSION */}
        {step <= 12 && (
          <div className="absolute bottom-0 inset-x-0 p-4 sm:p-6 bg-gradient-to-t from-[#111111] via-[#111111]/95 to-transparent pb-6 sm:pb-8 z-30 pointer-events-none">
            <div className="max-w-2xl mx-auto pointer-events-auto">
              <button
                onClick={handleNext}
                disabled={!canProceed()}
                className={`w-full py-4 rounded-xl font-extrabold text-base tracking-wide transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer ${
                  canProceed()
                    ? "bg-[#D4FF00] text-black hover:bg-[#c4f000]"
                    : "bg-[#111620] text-neutral-600 border border-neutral-800 cursor-not-allowed"
                }`}
              >
                <span>
                  {step === 5 || step === 9
                    ? (isEN ? "Continue to Next Stage →" : "Lanjut ke Tahap Berikutnya →")
                    : step === 12
                    ? (isEN ? "Send Plan to WhatsApp" : "Kirim Rencana ke WhatsApp")
                    : (isEN ? "Continue" : "Lanjut")}
                </span>
                {canProceed() && step !== 5 && step !== 9 && step !== 12 && (
                  <ChevronRight size={18} className="stroke-[3]" />
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
