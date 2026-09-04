import React, { useState, useEffect, useRef } from "react";
import GymBuddyLogo from "./Logo";
import { getApiBaseUrl } from "../utils/api";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronLeft,
  Dumbbell,
  Leaf,
  Activity,
  ShieldCheck,
  HeartPulse,
  Target,
  Flame,
  ArrowRight,
  Sparkles,
  Send,
  Camera,
  Phone,
  Video,
  MoreVertical,
  CheckCheck,
  X,
  Bot,
  Lock,
  Crown,
  Check,
  Zap,
  CreditCard,
  Star,
} from "lucide-react";

interface FeatureShowcaseProps {
  variant: "workout" | "nutrition";
  language: "EN" | "ID";
  onBack: () => void;
  onSwitchVariant: (variant: "workout" | "nutrition") => void;
  onOnboardingRequest: () => void;
  userPhone?: string; // Bug #9 fix: real user phone for Midtrans payment
}

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text?: string;
  imageUrl?: string;
  timestamp: string;
  status?: "sending" | "sent" | "error";
  structuredData?: {
    exercise?: string;
    foodName?: string;
    formScore?: number;
    calories?: string;
    protein?: string;
    carbs?: string;
    fat?: string;
    status?: string;
    feedback?: string;
    actionableAdjustment?: string;
    analysisText?: string;
  };
  paywallData?: {
    detectedItem: string;
    mode: "workout" | "nutrition";
  };
}

const FeatureShowcase: React.FC<FeatureShowcaseProps> = ({ 
  variant, 
  language, 
  onBack, 
  onSwitchVariant, 
  onOnboardingRequest, 
  userPhone 
}) => {
  const [activeHoverCallout, setActiveHoverCallout] = useState<number | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("monthly");
  const [subscriptionSuccess, setSubscriptionSuccess] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isWorkout = variant === "workout";

  // Initial Chat History per Mode (Starts with 1 completed example analysis; new user inputs trigger paywall)
  const [workoutMessages, setWorkoutMessages] = useState<ChatMessage[]>([
    {
      id: "w-1",
      sender: "bot",
      text:
        language === "EN"
          ? "Welcome to GymBuddy AI Workout Coach! 👋 Upload a video/photo or type your exercise set to start biomechanical form analysis."
          : "Selamat datang di GymBuddy AI Workout Coach! 👋 Unggah foto/video atau ketik gerakan latihan Anda untuk mulai analisis.",
      timestamp: "09:41 AM",
    },
    {
      id: "w-2",
      sender: "user",
      text: language === "EN" ? "Analisis Barbell Back Squat (85kg x 8 reps)" : "Analisis Barbell Back Squat (85kg x 8 reps)",
      timestamp: "09:41 AM",
      status: "sent",
    },
    {
      id: "w-3",
      sender: "bot",
      text:
        language === "EN"
          ? "Biomechanical analysis completed for Barbell Back Squat:"
          : "Analisis biomekanik selesai untuk Barbell Back Squat:",
      timestamp: "09:42 AM",
      structuredData: {
        exercise: "Barbell Back Squat (85kg)",
        formScore: 94,
        status: language === "EN" ? "Optimal Form" : "Postur Optimal",
        feedback:
          language === "EN"
            ? "Full hip depth achieved on all 8 reps. Bar velocity consistent at 0.48 m/s. Great core tightness throughout."
            : "Kedalaman panggul penuh di 8 repetisi. Kecepatan stang stabil di 0.48 m/s. Kontrol otot inti sangat baik.",
        actionableAdjustment:
          language === "EN"
            ? "Keep knees pushed outwards on the concentric drive."
            : "Dorong lutut ke luar saat fase naik stang.",
      },
    },
  ]);

  const [nutritionMessages, setNutritionMessages] = useState<ChatMessage[]>([
    {
      id: "n-1",
      sender: "bot",
      text:
        language === "EN"
          ? "Hi! I'm GymBuddy Nutrition AI. 🥗 Type what you ate (e.g. 'I ate an apple') or upload a photo to instantly calculate calories and macros."
          : "Halo! Saya GymBuddy AI Nutrisi. 🥗 Ketik makanan Anda (contoh: 'makan nasi uduk') atau unggah foto untuk hitung kalori & makro.",
      timestamp: "12:15 PM",
    },
    {
      id: "n-2",
      sender: "user",
      text: language === "EN" ? "I ate egg fried rice" : "makan nasi goreng telor",
      timestamp: "12:15 PM",
      status: "sent",
    },
    {
      id: "n-3",
      sender: "bot",
      text:
        language === "EN"
          ? "Analysis complete for Nasi Goreng Telor! Here is the nutritional breakdown:"
          : "Analisis selesai untuk Nasi Goreng Telor! Berikut rincian nutrisinya:",
      timestamp: "12:16 PM",
      structuredData: {
        foodName: "Nasi Goreng Telor",
        calories: "510 kcal",
        protein: "18g",
        carbs: "62g",
        fat: "20g",
        status: language === "EN" ? "Balanced Meal" : "Nutrisi Seimbang",
        analysisText:
          language === "EN"
            ? "High-carb energy source with quality protein from fried egg. Ideal for post-workout muscle recovery."
            : "Sumber energi karbohidrat tinggi dengan protein dari telur ciplok. Ideal untuk pemulihan energi setelah latihan.",
      },
    },
  ]);

  const currentMessages = isWorkout ? workoutMessages : nutritionMessages;

  // Reset scroll to top on mount and tab switch
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [variant]);

  // Scroll chat box to bottom when new message arrives
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [currentMessages, isAnalyzing]);

  // Handle message send / image analysis -> ALWAYS triggers "Choose Plan" / Subscription Teaser
  const handleSendMessage = async (imageFile?: File) => {
    if (!inputMessage.trim() && !imageFile) return;

    const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsgId = `u-${Date.now()}`;
    const userText = inputMessage.trim() || (imageFile ? (language === "EN" ? "Uploaded meal / workout photo" : "Mengunggah foto makanan / latihan") : "");

    let imageUrl = "";
    if (imageFile) {
      imageUrl = URL.createObjectURL(imageFile);
    }

    const newUserMessage: ChatMessage = {
      id: userMsgId,
      sender: "user",
      text: userText,
      imageUrl: imageUrl || undefined,
      timestamp: currentTime,
      status: "sending",
    };

    if (isWorkout) {
      setWorkoutMessages((prev) => [...prev, newUserMessage]);
    } else {
      setNutritionMessages((prev) => [...prev, newUserMessage]);
    }

    setInputMessage("");
    setIsAnalyzing(true);

    // Simulate 1 second AI thinking time then show Paywall Choose Plan response
    setTimeout(() => {
      if (isWorkout) {
        setWorkoutMessages((prev) =>
          prev.map((m) => (m.id === userMsgId ? { ...m, status: "sent" } : m))
        );
      } else {
        setNutritionMessages((prev) =>
          prev.map((m) => (m.id === userMsgId ? { ...m, status: "sent" } : m))
        );
      }

      const botPaywallMsg: ChatMessage = {
        id: `b-paywall-${Date.now()}`,
        sender: "bot",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        paywallData: {
          detectedItem: userText || (isWorkout ? "Workout Video/Photo" : "Nutritional Dish"),
          mode: variant,
        },
      };

      if (isWorkout) {
        setWorkoutMessages((prev) => [...prev, botPaywallMsg]);
      } else {
        setNutritionMessages((prev) => [...prev, botPaywallMsg]);
      }

      setIsAnalyzing(false);
    }, 1100);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleSendMessage(file);
    }
  };

  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    const clientKey = (import.meta as any).env.VITE_MIDTRANS_CLIENT_KEY;
    // Bug #10 fix: Use production URL when VITE_MIDTRANS_IS_PRODUCTION is 'true'
    const isProduction = (import.meta as any).env.VITE_MIDTRANS_IS_PRODUCTION === "true";
    if (clientKey) {
      const script = document.createElement("script");
      script.src = isProduction
        ? "https://app.midtrans.com/snap/snap.js"       // Production
        : "https://app.sandbox.midtrans.com/snap/snap.js"; // Sandbox
      script.setAttribute("data-client-key", clientKey);
      script.async = true;
      document.body.appendChild(script);
      return () => {
        document.body.removeChild(script);
      };
    }
  }, []);

  const handleSubscribe = async () => {
    try {
      setIsProcessingPayment(true);

      // Bug #9 fix: Use real user phone (passed as prop) — never hardcoded dummy
      const paymentPhone = userPhone || "";
      if (!paymentPhone) {
        alert(language === "EN"
          ? "Please complete your profile registration before subscribing."
          : "Silakan lengkapi pendaftaran profil Anda terlebih dahulu sebelum berlangganan."
        );
        setIsProcessingPayment(false);
        return;
      }

      const amount = selectedPlan === "monthly" ? 49000 : 380000;
      const plan = selectedPlan === "monthly" ? "premium" : "advanced";
      
      const API_BASE_URL = getApiBaseUrl();
      const txUrl = API_BASE_URL ? `${API_BASE_URL}/api/midtrans/create-transaction` : "/api/midtrans/create-transaction";
      const res = await fetch(txUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          phone: paymentPhone, // Bug #9 fix: real user phone
          planId: selectedPlan,
          plan,
          activeService: "both",
          amount: amount,
          customerName: "GymBuddy Member"
        })
      });
      
      const data = await res.json();
      
      if (data.success && data.token) {
        if ((window as any).snap) {
          (window as any).snap.pay(data.token, {
            onSuccess: function() {
              setSubscriptionSuccess(true);
            },
            onPending: function() {
              alert(language === "EN" ? "Payment pending." : "Pembayaran tertunda.");
            },
            onError: function() {
              alert(language === "EN" ? "Payment failed!" : "Pembayaran gagal!");
            }
          });
        } else {
           alert("Payment system initializing, please wait.");
        }
      } else {
        // Fallback to simulator if Midtrans isn't configured in backend
        setSubscriptionSuccess(true);
      }
    } catch (err) {
      console.error(err);
      // Fallback
      setSubscriptionSuccess(true);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Content configuration per mode
  const content = {
    workout: {
      badge: language === "EN" ? "AI Workout Coach" : "Pelatih Latihan AI",
      headline:
        language === "EN"
          ? "Computer Vision & Real-Time Biomechanical Coaching."
          : "Visi Komputer & Pelatihan Biomekanik Real-Time.",
      description:
        language === "EN"
          ? "GymBuddy AI tracks 32 skeletal joints through your camera to auto-count reps, analyze velocity, and adjust weights dynamically in real time."
          : "GymBuddy AI melacak 32 sendi tubuh melalui kamera untuk menghitung repetisi, kecepatan, dan menyesuaikan beban secara dinamis.",
      callouts: [
        {
          id: 1,
          label: language === "EN" ? "Real-time Form Analysis" : "Analisis Postur Real-time",
          desc: language === "EN" ? "Tracks 32 joints to correct posture instantly." : "Melacak 32 sendi tubuh untuk koreksi gerakan seketika.",
          icon: Activity,
        },
        {
          id: 2,
          label: language === "EN" ? "Adaptive Weight Adjustments" : "Penyesuaian Beban Adaptif",
          desc: language === "EN" ? "Scales load based on bar velocity & fatigue." : "Meningkatkan beban otomatis berdasarkan kecepatan gerakan.",
          icon: Dumbbell,
        },
        {
          id: 3,
          label: language === "EN" ? "Smart Recovery Tracking" : "Pelacakan Pemulihan Cerdas",
          desc: language === "EN" ? "Monitors heart rate, velocity & rest duration." : "Memantau detak jantung & durasi istirahat antardua set.",
          icon: HeartPulse,
        },
        {
          id: 4,
          label: language === "EN" ? "Auto Rep & Set Counting" : "Auto Hitung Repetisi & Set",
          desc: language === "EN" ? "Automatically counts reps and sets from video — no manual input needed." : "Menghitung repetisi dan set otomatis dari video — tanpa input manual.",
          icon: Camera,
        },
      ],
      capabilities: [
        {
          title: language === "EN" ? "32-Point Skeletal Vision" : "Visi Skeleton 32-Titik",
          desc: language === "EN" ? "Zero wearables required — utilizes your smartphone camera for precision pose estimation." : "Tanpa sensor tubuh tambahan — memanfaatkan kamera ponsel untuk deteksi pose presisi.",
          icon: Target,
        },
        {
          title: language === "EN" ? "Bar Velocity & Tempo" : "Kecepatan & Tempo Stang",
          desc: language === "EN" ? "Measures eccentric/concentric phase velocity to prevent premature muscle fatigue." : "Mengukur kecepatan fase pendorongan & penurunan beban untuk cegah kelelahan.",
          icon: Flame,
        },
        {
          title: language === "EN" ? "Universal Equipment Adaptation" : "Adaptasi Semua Peralatan",
          desc: language === "EN" ? "Works seamlessly with barbells, dumbbells, cables, resistance bands, or bodyweight." : "Bekerja mulus dengan barbell, dumbbell, kabel, karet beban, atau berat badan.",
          icon: ShieldCheck,
        },
      ],
    },
    nutrition: {
      badge: language === "EN" ? "Nutrition AI" : "AI Nutrisi",
      headline:
        language === "EN"
          ? "Instant Snap & Log Meal Intelligence for High Performance."
          : "Seketika Foto & Lacak Nutrisi Makanan untuk Performa Tinggi.",
      description:
        language === "EN"
          ? "Fuel your fitness without tedious manual searching. Snap any meal to instantly calculate macros, flag allergens, and balance your daily energy budget."
          : "Penuhi nutrisi tanpa mengetik manual. Cukup foto atau ketik makanan Anda untuk menghitung makro, deteksi alergen, dan menjaga kalori harian.",
      callouts: [
        {
          id: 1,
          label: language === "EN" ? "Multi-Item Macro Breakdown" : "Rincian Makro Multi-Bahan",
          desc: language === "EN" ? "Calculates calories, protein, carbs & fats in under 1s." : "Menghitung kalori, protein, karbohidrat, dan lemak dalam < 1s.",
          icon: Leaf,
        },
        {
          id: 2,
          label: language === "EN" ? "Goal-Oriented Advice" : "Saran Berbasis Target",
          desc: language === "EN" ? "Adjusts calories based on today's workout burn." : "Menyesuaikan target kalori sesuai intensitas latihan hari ini.",
          icon: Target,
        },
        {
          id: 3,
          label: language === "EN" ? "Dietary & Allergen Guard" : "Peringatan Alergi & Diet",
          desc: language === "EN" ? "Flags conflicting ingredients with custom limits." : "Peringatan otomatis bahan makanan yang bertentangan dengan diet.",
          icon: ShieldCheck,
        },
        {
          id: 4,
          label: language === "EN" ? "Photo Food Recognition" : "Pengenalan Foto Makanan",
          desc: language === "EN" ? "Snap a photo of your meal — AI identifies items and portions instantly." : "Ambil foto makanan — AI mengenali porsi dan menu seketika.",
          icon: Camera,
        },
      ],
      capabilities: [
        {
          title: language === "EN" ? "100k+ Dish Vision Engine" : "Mesin Visi 100rb+ Makanan",
          desc: language === "EN" ? "Instant deep-learning recognition for home-cooked recipes, Asian dishes, and dining out." : "Pengenalan resep olahan rumah, masakan Asia, hingga restoran secara presisi.",
          icon: Sparkles,
        },
        {
          title: language === "EN" ? "Dynamic Energy Budget" : "Anggaran Energi Dinamis",
          desc: language === "EN" ? "Auto-balances calorie target based on active energy burned during workout sessions." : "Menghitung ulang target kalori berdasarkan kalori terbakar saat latihan.",
          icon: Activity,
        },
        {
          title: language === "EN" ? "Micronutrient Intelligence" : "Intelijen Mikronutrisi",
          desc: language === "EN" ? "Tracks essential fiber, sodium levels, hydration index, and vitamin distribution." : "Memantau asupan serat, tingkat natrium, hidrasi, dan konsentrasi vitamin.",
          icon: HeartPulse,
        },
      ],
    },
  };

  const activeContent = content[variant];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-white font-sans px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8 overflow-x-hidden relative selection:bg-[#D4FF3D] selection:text-black"
    >
      <div className="bg-[#111111] text-white min-h-[calc(100vh-2rem)] md:min-h-[calc(100vh-3rem)] lg:min-h-[calc(100vh-4rem)] rounded-[2rem] w-full relative overflow-hidden shadow-2xl p-6 sm:p-8 md:p-10 lg:p-12 flex flex-col">
        {/* INNER ROUNDED GLOW */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D4FF3D]/[0.1] rounded-full blur-[140px] pointer-events-none"></div>

      {/* TOP NAVIGATION BAR */}
      <div className="w-full flex items-center justify-between mb-8 sm:mb-12 relative z-20">
        {/* BACK BUTTON WITH ROUNDED PILL STYLE */}
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full border border-neutral-800 bg-neutral-900 text-white font-bold text-sm md:text-base hover:border-neutral-600 hover:bg-neutral-800 transition-all group cursor-pointer shadow-sm"
          id="back-to-landing-btn"
        >
          <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-[#D4FF3D] transition-all">
            <ChevronLeft size={18} />
          </div>
          <span>{language === "EN" ? "Back to Overview" : "Kembali"}</span>
        </button>

        {/* ROUNDED TAB SWITCHER */}
        <div className="flex items-center gap-1.5 bg-black p-1.5 rounded-full border border-neutral-800 hidden md:flex">
          <button
            onClick={() => onSwitchVariant("workout")}
            className={`px-5 py-2 rounded-full text-xs md:text-sm font-extrabold transition-all cursor-pointer ${
              isWorkout
                ? "bg-[#D4FF3D] text-black scale-105"
                : "text-neutral-400 hover:text-white hover:bg-neutral-900"
            }`}
          >
            {language === "EN" ? "AI Workout Coach" : "Pelatih Latihan AI"}
          </button>
          <button
            onClick={() => onSwitchVariant("nutrition")}
            className={`px-5 py-2 rounded-full text-xs md:text-sm font-extrabold transition-all cursor-pointer ${
              !isWorkout
                ? "bg-[#D4FF3D] text-black scale-105"
                : "text-neutral-400 hover:text-white hover:bg-neutral-900"
            }`}
          >
            {language === "EN" ? "Nutrition AI" : "AI Nutrisi"}
          </button>
        </div>
      </div>

      {/* SLEEK FULL WIDTH BLACK CONTAINER (NO SHADOWS, FULL LAYOUT) */}
      <div className="w-full relative z-10 flex-grow">
        
        {/* HERO SHOWCASE SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch mb-12 relative z-10">

          
          {/* LEFT COLUMN: HEADLINE, SUBTITLE & FEATURE HIGHLIGHTS */}
          <motion.div
            key={`headline-${variant}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="lg:col-span-5 xl:col-span-6 flex flex-col justify-center relative p-6 sm:p-8 md:p-10"
          >
            <div className="relative z-10">
              {/* HEADLINE */}
              <h1 className="font-['Archivo_Black'] font-extrabold text-3xl sm:text-4xl md:text-5xl lg:text-[2.75rem] xl:text-5xl tracking-tight leading-[1.05] text-white mb-4">
                {activeContent.headline}
              </h1>

              {/* PARAGRAPH */}
              <p className="text-sm sm:text-base text-neutral-400 font-normal leading-relaxed mb-6">
                {activeContent.description}
              </p>

              {/* FEATURE HIGHLIGHTS LIST */}
              <div className="space-y-2.5 mb-8 p-4 rounded-xl bg-black/40 border border-neutral-800/80 shadow-inner">
                <div className="flex items-center gap-3 text-xs sm:text-sm font-semibold text-neutral-300">
                  <div className="w-5 h-5 rounded-full bg-[#D4FF3D]/10 text-[#D4FF3D] flex items-center justify-center shrink-0 border border-[#D4FF3D]/20">
                    <Check size={12} className="stroke-[3]" />
                  </div>
                  <span>
                    {isWorkout
                      ? (language === "EN" ? "Real-time 32-point joint form correction" : "Koreksi gerakan 32 sendi tubuh secara real-time")
                      : (language === "EN" ? "Instant photo & text macro calculation" : "Hitung otomatis kalori & makro dari foto/teks")}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs sm:text-sm font-semibold text-neutral-300">
                  <div className="w-5 h-5 rounded-full bg-[#D4FF3D]/10 text-[#D4FF3D] flex items-center justify-center shrink-0 border border-[#D4FF3D]/20">
                    <Check size={12} className="stroke-[3]" />
                  </div>
                  <span>
                    {isWorkout
                      ? (language === "EN" ? "Adaptive weight load & velocity analysis" : "Penyesuaian beban adaptif & analisis kecepatan")
                      : (language === "EN" ? "Custom calorie budget linked to daily active burn" : "Target kalori fleksibel sesuai energi terbakar")}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs sm:text-sm font-semibold text-neutral-300">
                  <div className="w-5 h-5 rounded-full bg-[#D4FF3D]/10 text-[#D4FF3D] flex items-center justify-center shrink-0 border border-[#D4FF3D]/20">
                    <Check size={12} className="stroke-[3]" />
                  </div>
                  <span>
                    {isWorkout
                      ? (language === "EN" ? "Fatigue detection & smart recovery advice" : "Deteksi kelelahan & rekomendasi istirahat")
                      : (language === "EN" ? "Allergen guard & clinical nutritionist insights" : "Peringatan alergi & saran nutrisi klinis")}
                  </span>
                </div>
              </div>

              {/* CTA ACTION BUTTON */}
              <div className="w-full">
                <button
                  onClick={onOnboardingRequest}
                  className="w-full sm:w-auto inline-flex items-center justify-between gap-4 pl-6 pr-2 py-2 rounded-full bg-[#D4FF3D] text-black font-extrabold text-sm sm:text-base hover:bg-white transition-colors cursor-pointer group"
                >
                  <span className="uppercase tracking-wide">{language === "EN" ? "Unlock AI Coach Pro" : "Langganan AI Coach Pro"}</span>
                  <div className="w-8 h-8 rounded-full bg-black text-[#D4FF3D] flex items-center justify-center group-hover:text-white transition-colors">
                    <ArrowRight size={16} />
                  </div>
                </button>
              </div>
            </div>
          </motion.div>

          {/* RIGHT COLUMN: CLEAN SAAS PHONE MOCKUP */}
          <div className="lg:col-span-7 xl:col-span-6 relative flex items-center justify-center p-4 sm:p-6 md:p-8">
            
            {/* SUBTLE GLOW BEHIND PHONE */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-[#D4FF3D]/5 rounded-full blur-[100px] pointer-events-none"></div>

            {/* PHONE & CALLOUTS WRAPPER TO KEEP FLOATING CARDS PROPORTIONAL */}
            <div className="relative flex items-center justify-center w-full max-w-[380px] sm:max-w-[420px]">

            {/* FLOATING CALLOUT CARDS */}
            {[
              { 
                index: 0, xOffset: -20, 
                positionClasses: "-left-4 sm:-left-10 lg:-left-14 top-[15%] sm:top-[18%]",
                shapeClasses: "rounded-3xl rounded-br-md p-3 sm:p-3.5 max-w-[130px] sm:max-w-[150px]",
                inner: (callout: any, Icon: any) => (
                  <div className="flex flex-col gap-1.5 relative">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#D4FF3D] flex items-center justify-center text-black shadow-sm mb-0.5">
                      <Icon size={14} strokeWidth={2.5} />
                    </div>
                    <p className="font-['Archivo_Black'] text-[10px] sm:text-[11px] text-neutral-900 leading-tight">
                      {callout.label}
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-neutral-500 font-normal leading-snug">
                      {callout.desc}
                    </p>
                  </div>
                )
              },
              { 
                index: 1, xOffset: 20, 
                positionClasses: "-right-4 sm:-right-10 lg:-right-14 top-[22%] sm:top-[25%]",
                shapeClasses: "rounded-full p-2 pr-3.5 sm:pr-4 max-w-[150px] sm:max-w-[180px]",
                inner: (callout: any, Icon: any) => (
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-neutral-100 flex items-center justify-center text-black shrink-0 border border-neutral-200">
                      <Icon size={14} strokeWidth={2.5} />
                    </div>
                    <p className="font-['Archivo_Black'] text-[9px] sm:text-[10px] text-neutral-900 leading-tight">
                      {callout.label}
                    </p>
                  </div>
                )
              },
              { 
                index: 2, xOffset: -20, 
                positionClasses: "-left-4 sm:-left-10 lg:-left-14 bottom-[22%] sm:bottom-[25%]",
                shapeClasses: "rounded-3xl rounded-tl-md p-3 sm:p-3.5 max-w-[135px] sm:max-w-[155px]",
                inner: (callout: any, Icon: any) => (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-start justify-between mb-0.5 gap-2">
                       <p className="font-['Archivo_Black'] text-[10px] sm:text-[11px] text-neutral-900 leading-tight">
                        {callout.label}
                      </p>
                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-black flex items-center justify-center text-[#D4FF3D] shrink-0 mt-0.5">
                        <Icon size={12} strokeWidth={2.5} />
                      </div>
                    </div>
                    <p className="text-[9px] sm:text-[10px] text-neutral-500 font-normal leading-snug">
                      {callout.desc}
                    </p>
                  </div>
                )
              },
              { 
                index: 3, xOffset: 20, 
                positionClasses: "-right-4 sm:-right-10 lg:-right-14 bottom-[12%] sm:bottom-[15%]",
                shapeClasses: "rounded-2xl p-2.5 sm:p-3 border-l-4 border-l-[#D4FF3D] max-w-[135px] sm:max-w-[155px]",
                inner: (callout: any, Icon: any) => (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <Icon size={12} strokeWidth={2.5} className="text-black shrink-0" />
                      <p className="font-['Archivo_Black'] text-[10px] sm:text-[11px] text-neutral-900 leading-tight">
                        {callout.label}
                      </p>
                    </div>
                    <p className="text-[9px] sm:text-[10px] text-neutral-500 font-normal leading-snug">
                      {callout.desc}
                    </p>
                  </div>
                )
              }
            ].map((config) => {
              const callout = activeContent.callouts[config.index];
              if (!callout) return null;
              const Icon = callout.icon;

              return (
                <motion.div
                  key={config.index}
                  initial={{ opacity: 0, x: config.xOffset, y: config.index % 2 === 0 ? 10 : -10 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 + config.index * 0.15, type: "spring", stiffness: 100 }}
                  onMouseEnter={() => setActiveHoverCallout(config.index)}
                  onMouseLeave={() => setActiveHoverCallout(null)}
                  className={`absolute ${config.positionClasses} ${config.shapeClasses} z-20 bg-white border border-neutral-200/90 transition-all duration-300 cursor-pointer ${
                    activeHoverCallout === config.index ? "scale-105 border-[#D4FF3D]" : "hover:scale-105"
                  }`}
                >
                  {config.inner(callout, Icon)}
                </motion.div>
              );
            })}

            {/* PHONE MOCKUP (MODERN SLIM DARK BEZEL) */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="relative z-10 w-[290px] sm:w-[330px] md:w-[350px] aspect-[9/19] bg-[#1C1C1E] rounded-[2.5rem] sm:rounded-[3rem] p-1.5 sm:p-2 border border-neutral-700/50 flex flex-col justify-between"
            >
              {/* Inner phone black border to frame the screen */}
              <div className="absolute inset-0 m-1.5 sm:m-2 rounded-[2.25rem] sm:rounded-[2.75rem] bg-black pointer-events-none ring-1 ring-black/50"></div>

              {/* SLIM NOTCH / PUNCH HOLE */}
              <div className="absolute top-4 sm:top-5 left-1/2 -translate-x-1/2 w-16 h-4 bg-black rounded-full z-40 flex items-center justify-center gap-2 shadow-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-[#111]"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-[#111] border border-white/10"></div>
              </div>

              {/* PHONE SCREEN AREA — WHATSAPP UI */}
              <div className="w-full h-full bg-[#0B0E13] rounded-[2.25rem] sm:rounded-[2.75rem] overflow-hidden relative flex flex-col font-sans z-10">
                
                {/* STATUS BAR */}
                <div className="pt-3 px-5 pb-1 flex justify-between items-center text-[10px] text-neutral-400 bg-neutral-900/90 border-b border-neutral-800/60 z-20 shrink-0">
                  <span className="font-bold text-white">9:41</span>
                  <div className="flex items-center gap-1.5">
                    <Activity size={10} className="text-[#D4FF3D]" />
                    <span>5G</span>
                    <div className="w-3.5 h-2 rounded-[2px] border border-neutral-400 p-[1px]">
                      <div className="w-full h-full bg-[#D4FF3D] rounded-[1px]"></div>
                    </div>
                  </div>
                </div>

                {/* WHATSAPP HEADER */}
                <div className="px-3 py-2 bg-[#161B22] border-b border-neutral-800/80 flex items-center justify-between z-20 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <GymBuddyLogo size={32} />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#D4FF3D] border-2 border-[#161B22] absolute bottom-0 right-0"></div>
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white leading-tight">
                        GymBuddy AI
                      </h3>
                      <p className="text-[9.5px] text-[#D4FF3D] font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D4FF3D] inline-block animate-pulse"></span>
                        <span>{isWorkout ? "Workout Coach • online" : "Nutrition AI • online"}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-neutral-400">
                    <Video size={14} className="hover:text-white cursor-pointer" />
                    <Phone size={14} className="hover:text-white cursor-pointer" />
                    <MoreVertical size={14} className="hover:text-white cursor-pointer" />
                  </div>
                </div>

                {/* CHAT MESSAGES AREA WITH WHATSAPP PATTERN BACKGROUND */}
                <div
                  ref={chatContainerRef}
                  className="flex-1 p-3 overflow-y-auto space-y-3 relative text-xs scroll-smooth bg-[radial-gradient(#1c232d_1px,transparent_1px)] [background-size:12px_12px]"
                >
                  {/* DATE BADGE */}
                  <div className="text-center my-1">
                    <span className="px-2.5 py-0.5 rounded-full bg-neutral-900/80 text-[9px] font-semibold text-neutral-400 border border-neutral-800">
                      TODAY
                    </span>
                  </div>

                  {/* MESSAGES LIST */}
                  {currentMessages.map((msg) => {
                    const isUser = msg.sender === "user";
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[88%] p-2.5 rounded-2xl ${
                            isUser
                              ? "bg-[#D4FF3D] text-black font-medium rounded-tr-none"
                              : "bg-[#1C2128] text-white border border-neutral-800 rounded-tl-none"
                          }`}
                        >
                          {/* IMAGE ATTACHMENT */}
                          {msg.imageUrl && (
                            <div className="mb-2 rounded-xl overflow-hidden border border-black/10 max-h-40">
                              <img
                                src={msg.imageUrl}
                                alt="Attached"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}

                          {/* TEXT MESSAGE */}
                          {msg.text && (
                            <p className={`text-[11.5px] leading-relaxed ${isUser ? "text-black font-semibold" : "text-neutral-200"}`}>
                              {msg.text}
                            </p>
                          )}

                          {/* STRUCTURED ANALYSIS DATA */}
                          {msg.structuredData && (
                            <div className="mt-2 p-2.5 rounded-xl bg-[#12161F] border border-neutral-700/80 space-y-2 text-[10.5px]">
                              <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
                                <span className="font-extrabold text-[#D4FF3D] text-[11px] flex items-center gap-1">
                                  <Sparkles size={11} />
                                  {msg.structuredData.foodName || msg.structuredData.exercise}
                                </span>
                                {msg.structuredData.formScore !== undefined && (
                                  <span className="px-2 py-0.5 rounded-full bg-[#D4FF3D] text-black font-extrabold text-[9px]">
                                    Score: {msg.structuredData.formScore}/100
                                  </span>
                                )}
                                {msg.structuredData.calories && (
                                  <span className="px-2 py-0.5 rounded-full bg-[#D4FF3D] text-black font-extrabold text-[9px]">
                                    {msg.structuredData.calories}
                                  </span>
                                )}
                              </div>

                              {/* MACRO BREAKDOWN FOR FOOD */}
                              {msg.structuredData.calories && (
                                <div className="grid grid-cols-3 gap-1 text-center py-0.5">
                                  <div className="p-1 rounded bg-neutral-900 border border-neutral-800">
                                    <p className="text-[8.5px] text-neutral-400">Protein</p>
                                    <p className="font-extrabold text-white text-[10.5px]">{msg.structuredData.protein}</p>
                                  </div>
                                  <div className="p-1 rounded bg-neutral-900 border border-neutral-800">
                                    <p className="text-[8.5px] text-neutral-400">Karbo</p>
                                    <p className="font-extrabold text-white text-[10.5px]">{msg.structuredData.carbs}</p>
                                  </div>
                                  <div className="p-1 rounded bg-neutral-900 border border-neutral-800">
                                    <p className="text-[8.5px] text-neutral-400">Lemak</p>
                                    <p className="font-extrabold text-white text-[10.5px]">{msg.structuredData.fat}</p>
                                  </div>
                                </div>
                              )}

                              {/* ANALYSIS / FEEDBACK TEXT */}
                              {(msg.structuredData.feedback || msg.structuredData.analysisText) && (
                                <p className="text-neutral-300 text-[10px] leading-snug pt-1 border-t border-neutral-800">
                                  {msg.structuredData.feedback || msg.structuredData.analysisText}
                                </p>
                              )}

                              {/* ACTIONABLE ADJUSTMENT */}
                              {msg.structuredData.actionableAdjustment && (
                                <p className="text-[#D4FF3D] font-semibold text-[9.5px] leading-tight">
                                  💡 {msg.structuredData.actionableAdjustment}
                                </p>
                              )}
                            </div>
                          )}

                          {/* PAYWALL / CHOOSE PLAN BUBBLE */}
                          {msg.paywallData && (
                            <div className="mt-1 space-y-2">
                              <div className="p-3 rounded-2xl bg-[#12161F] border-2 border-[#D4FF3D] space-y-2.5 text-[10.5px]">
                                {/* PAYWALL HEADER BADGE */}
                                <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#D4FF3D] text-black font-extrabold text-[9px] uppercase tracking-wide">
                                    <Lock size={10} />
                                    <span>{language === "EN" ? "AI Premium Locked" : "AI Premium Terkunci"}</span>
                                  </div>
                                  <Crown size={14} className="text-[#D4FF3D]" />
                                </div>

                                {/* FRIENDLY EXPLANATION TEXT */}
                                <p className="text-neutral-200 text-[11px] leading-snug">
                                  {language === "EN" ? (
                                    <>
                                      Great choice! AI detected your entry: <strong className="text-[#D4FF3D]">"{msg.paywallData.detectedItem}"</strong>. Subscribe to unlock full calorie calculation, macro breakdown, and personalized portion advice!
                                    </>
                                  ) : (
                                    <>
                                      Wah, pilihan yang mantap! AI kami sudah mendeteksi input kamu: <strong className="text-[#D4FF3D]">"{msg.paywallData.detectedItem}"</strong>. Berlangganan paket GymBuddy Premium untuk buka rincian kalori & rekomendasi AI Coach!
                                    </>
                                  )}
                                </p>

                                {/* MINI PLAN CARD INSIDE BUBBLE */}
                                <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-700 space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="font-extrabold text-white text-[11px]">Pro AI Coach Pass</span>
                                    <span className="text-[#D4FF3D] font-extrabold text-[11px]">
                                      {language === "EN" ? "$4.99/mo" : "Rp 49rb/bln"}
                                    </span>
                                  </div>

                                  <div className="space-y-1 pt-1 border-t border-neutral-800 text-[9.5px] text-neutral-300">
                                    <div className="flex items-center gap-1.5">
                                      <Zap size={11} className="text-[#D4FF3D] shrink-0" />
                                      <span>{language === "EN" ? "Unlimited AI Macro & Form Calculator" : "Kalkulator AI Nutrisi & Postur Tanpa Batas"}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <Bot size={11} className="text-[#D4FF3D] shrink-0" />
                                      <span>{language === "EN" ? "24/7 Personal WhatsApp AI Coach" : "Asisten WhatsApp AI Coach 24/7"}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* NEON CTA BUTTON */}
                                <button
                                  onClick={onOnboardingRequest}
                                  className="w-full py-2.5 px-3 rounded-xl bg-[#D4FF3D] text-black font-extrabold text-[11px] hover:bg-[#c3f22b] hover:scale-[1.02] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <Sparkles size={12} />
                                  <span>{language === "EN" ? "CHOOSE PLAN & UNLOCK 🚀" : "PILIH PAKET & BUKA ANALISIS 🚀"}</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* TIMESTAMP & READ RECEIPTS */}
                          <div className="flex justify-end items-center gap-1 mt-1 text-[8.5px] text-neutral-500">
                            <span className={isUser ? "text-neutral-900 font-semibold" : "text-neutral-400"}>
                              {msg.timestamp}
                            </span>
                            {isUser && <CheckCheck size={11} className="text-neutral-900" />}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}

                  {/* TYPING / LOADING INDICATOR */}
                  {isAnalyzing && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 p-2.5 rounded-2xl bg-[#1C2128] border border-neutral-800 text-neutral-300 max-w-[80%] rounded-tl-none"
                    >
                      <div className="w-5 h-5 rounded-full bg-[#D4FF3D] text-black flex items-center justify-center font-bold">
                        <Bot size={12} />
                      </div>
                      <span className="text-[10px] text-neutral-300 font-medium animate-pulse">
                        {language === "EN" ? "GymBuddy AI is detecting item..." : "GymBuddy AI sedang mendeteksi..."}
                      </span>
                    </motion.div>
                  )}
                </div>

                {/* INPUT BAR */}
                <div className="p-2 bg-[#161B22] border-t border-neutral-800 flex items-center gap-1.5 z-20 shrink-0">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-neutral-400 hover:text-[#D4FF3D] hover:bg-neutral-800 rounded-full transition-colors cursor-pointer"
                    title="Upload photo to analyze"
                  >
                    <Camera size={16} />
                  </button>

                  <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-full px-3 py-1.5 flex items-center">
                    <input
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                      placeholder={
                        variant === "workout"
                          ? language === "EN"
                            ? "Ask a question or upload a photo..."
                            : "Tanya AI Coach atau unggah foto..."
                          : language === "EN"
                            ? "Type your meal or upload a photo..."
                            : "Ketik 'makan nasi uduk' atau unggah foto..."
                      }
                      className="w-full bg-transparent text-white text-[11px] focus:outline-none placeholder:text-neutral-500"
                    />
                  </div>

                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!inputMessage.trim() && isAnalyzing}
                    className="w-8 h-8 rounded-full bg-[#D4FF3D] text-black font-bold flex items-center justify-center hover:bg-[#c2ed2e] transition-all cursor-pointer disabled:opacity-40 shrink-0"
                  >
                    <Send size={14} className="ml-0.5" />
                  </button>
                </div>

                {/* HOME INDICATOR */}
                <div className="w-28 h-1 bg-neutral-800 rounded-full mx-auto my-1 shrink-0"></div>
              </div>
            </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* SUBSCRIPTION / CHOOSE PLAN MODAL */}
      <AnimatePresence>
        {showPlanModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#12161F] border-2 border-[#D4FF3D] rounded-[2.5rem] p-6 sm:p-8 max-w-lg w-full shadow-[0_0_80px_rgba(212,255,61,0.25)] relative text-white"
            >
              <button
                onClick={() => {
                  setShowPlanModal(false);
                  setSubscriptionSuccess(false);
                }}
                className="absolute top-5 right-5 text-neutral-400 hover:text-white p-2 rounded-full hover:bg-neutral-800"
              >
                <X size={20} />
              </button>

              {!subscriptionSuccess ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#D4FF3D] text-black flex items-center justify-center font-bold shadow-lg shadow-[#D4FF3D]/30">
                      <Crown size={24} />
                    </div>
                    <div>
                      <h3 className="font-['Archivo_Black'] font-extrabold text-xl text-white">
                        {language === "EN" ? "Choose Your GymBuddy Plan" : "Pilih Paket GymBuddy Premium"}
                      </h3>
                      <p className="text-xs text-[#D4FF3D] font-bold">
                        {language === "EN" ? "Unlock Instant AI Analysis & Portion Advice" : "Buka Analisis AI Tanpa Batas & Saran Nutrisi Presisi"}
                      </p>
                    </div>
                  </div>

                  {/* BILLING TOGGLE */}
                  <div className="flex justify-center my-5">
                    <div className="bg-neutral-900 p-1 rounded-full border border-neutral-800 inline-flex items-center gap-1">
                      <button
                        onClick={() => setSelectedPlan("monthly")}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                          selectedPlan === "monthly"
                            ? "bg-[#D4FF3D] text-black shadow-md"
                            : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        {language === "EN" ? "Monthly Billing" : "Paket Bulanan"}
                      </button>
                      <button
                        onClick={() => setSelectedPlan("yearly")}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${
                          selectedPlan === "yearly"
                            ? "bg-[#D4FF3D] text-black shadow-md"
                            : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        <span>{language === "EN" ? "Yearly (Save 35%)" : "Tahunan (Hemat 35%)"}</span>
                        <Star size={12} className="fill-current" />
                      </button>
                    </div>
                  </div>

                  {/* PLAN CARDS */}
                  <div className="space-y-3 mb-6">
                    {/* PLAN 1: PRO COACH */}
                    <div
                      onClick={() => setSelectedPlan("monthly")}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        selectedPlan === "monthly"
                          ? "bg-[#18202E] border-[#D4FF3D] ring-1 ring-[#D4FF3D] shadow-lg"
                          : "bg-neutral-900 border-neutral-800 hover:border-neutral-700"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-white">Pro AI Coach Pass</span>
                          <span className="px-2 py-0.5 rounded bg-[#D4FF3D] text-black text-[9px] font-extrabold">POPULAR</span>
                        </div>
                        <p className="text-[11px] text-neutral-400">
                          {language === "EN" ? "Full access to AI Nutrition & Workout Vision" : "Akses penuh AI Nutrisi & Postur Olahraga"}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-lg text-[#D4FF3D]">
                          {selectedPlan === "monthly" ? "Rp 49.000" : "Rp 32.000"}
                        </span>
                        <span className="text-[10px] text-neutral-400 block">/bulan</span>
                      </div>
                    </div>

                    {/* PLAN 2: ULTIMATE VIP */}
                    <div
                      onClick={() => setSelectedPlan("yearly")}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        selectedPlan === "yearly"
                          ? "bg-[#18202E] border-[#D4FF3D] ring-1 ring-[#D4FF3D] shadow-lg"
                          : "bg-neutral-900 border-neutral-800 hover:border-neutral-700"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-white">VIP Unlimited Annual Pass</span>
                          <span className="px-2 py-0.5 rounded bg-amber-400 text-black text-[9px] font-extrabold">BEST VALUE</span>
                        </div>
                        <p className="text-[11px] text-neutral-400">
                          {language === "EN" ? "Includes Human Nutritionist Review + WhatsApp 24/7" : "Termasuk Review Ahli Gizi + WhatsApp 24/7"}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-lg text-[#D4FF3D]">Rp 380.000</span>
                        <span className="text-[10px] text-neutral-400 block">/tahun</span>
                      </div>
                    </div>
                  </div>

                  {/* BENEFIT CHECKLIST */}
                  <div className="space-y-2 mb-6 text-xs text-neutral-300 bg-neutral-900 p-3.5 rounded-2xl border border-neutral-800">
                    <div className="flex items-center gap-2">
                      <Check size={14} className="text-[#D4FF3D]" />
                      <span>{language === "EN" ? "Unlimited instant food photo & text macro calculation" : "Hitung kalori & makro foto makanan tanpa batas"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check size={14} className="text-[#D4FF3D]" />
                      <span>{language === "EN" ? "32-point skeletal pose tracking for squats, deadlifts & bench" : "Pelacakan 32-titik postur squat, deadlift & bench press"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check size={14} className="text-[#D4FF3D]" />
                      <span>{language === "EN" ? "Custom calorie budget adjusted to daily active burn" : "Target kalori otomatis disesuaikan energi terbakar"}</span>
                    </div>
                  </div>

                  {/* SUBSCRIBE BUTTON */}
                  <button
                    onClick={handleSubscribe}
                    disabled={isProcessingPayment}
                    className="w-full py-3.5 px-4 rounded-full bg-[#D4FF3D] text-black font-extrabold text-sm hover:bg-[#c3f22b] hover:scale-[1.02] transition-all flex items-center justify-center gap-2 shadow-xl shadow-[#D4FF3D]/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessingPayment ? (
                       <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                       <CreditCard size={18} />
                    )}
                    <span>
                      {isProcessingPayment 
                        ? (language === "EN" ? "PROCESSING..." : "MEMPROSES...") 
                        : (language === "EN" ? "SUBSCRIBE NOW & UNLOCK INSTANTLY 🚀" : "BERLANGGANAN SEKARANG & BUKA FITUR 🚀")
                      }
                    </span>
                  </button>
                </>
              ) : (
                <div className="text-center py-6 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-[#D4FF3D] text-black flex items-center justify-center mx-auto shadow-xl shadow-[#D4FF3D]/40">
                    <Check size={36} className="stroke-[3]" />
                  </div>
                  <h3 className="font-['Archivo_Black'] font-extrabold text-2xl text-white">
                    {language === "EN" ? "Welcome to GymBuddy Premium! 🎉" : "Selamat! Akun Anda Telah Aktif! 🎉"}
                  </h3>
                  <p className="text-xs text-neutral-300 leading-relaxed max-w-sm mx-auto">
                    {language === "EN"
                      ? "Your subscription is now active. All AI Workout Coach & Nutrition AI features are completely unlocked."
                      : "Paket berlangganan Anda telah aktif. Seluruh fitur AI Workout Coach & AI Nutrisi sekarang siap digunakan."}
                  </p>
                  <button
                    onClick={() => {
                      setShowPlanModal(false);
                      setSubscriptionSuccess(false);
                    }}
                    className="mt-4 px-8 py-3 rounded-full bg-[#D4FF3D] text-black font-extrabold text-xs hover:bg-[#c2ed2e] transition-all shadow-md"
                  >
                    {language === "EN" ? "Continue to AI Coach" : "Lanjutkan ke AI Coach"}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default FeatureShowcase;
