import React, { useState, useEffect } from "react";
import GymBuddyLogo from "./Logo";
import { motion, AnimatePresence } from "motion/react";
import {
  Check,
  X,
  Zap,
  Leaf,
  Activity,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  HelpCircle,
  Crown,
  Lock,
  MessageCircle,
  Loader2,
  ExternalLink,
  PhoneCall
} from "lucide-react";
import { canonicalApiFetch, getApiBaseUrl, getWhatsAppDestinationUrl, openWhatsAppSafely } from "../utils/api";

interface PricingPageProps {
  language: "EN" | "ID";
  onBack: () => void;
  onSelectPlanAndStart?: (plan: "advanced" | "premium" | "lifetime", feature?: "nutrition" | "coach") => void;
  onLanguageChange: (lang: "EN" | "ID") => void;
  currentUser?: any;
  userPhone?: string;
}

export default function PricingPage({
  language,
  onBack,
  onSelectPlanAndStart,
  onLanguageChange,
  currentUser,
  userPhone,
}: PricingPageProps) {
  const [selectedDuration, setSelectedDuration] = useState<"1m" | "3m" | "6m" | "1y" | "lifetime">("1m");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Midtrans Payment States
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [phoneInputModalOpen, setPhoneInputModalOpen] = useState(false);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<{
    plan: "advanced" | "premium" | "lifetime";
    service: "nutrition" | "coach" | "both";
    amount: number;
    title: string;
  } | null>(null);
  const [inputPhone, setInputPhone] = useState(userPhone || currentUser?.phone || "");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [paymentSuccessData, setPaymentSuccessData] = useState<{
    plan: string;
    service: string;
    duration: string;
    orderId: string;
    phone: string;
    amount: number;
  } | null>(null);

  const isEN = language === "EN";

  // Load Midtrans Snap.js script on mount
  useEffect(() => {
    const clientKey =
      (import.meta as any).env?.VITE_MIDTRANS_CLIENT_KEY ||
      "SB-Mid-client-CAT2gMLueDV0amD7";
    const isProduction =
      (import.meta as any).env?.VITE_MIDTRANS_IS_PRODUCTION === "true";

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

  const durationConfig = {
    "1m": {
      label: isEN ? "1 Month" : "1 Bulan",
      singleIDR: "Rp 89rb", singleUSD: "$6",
      premiumIDR: "Rp 149rb", premiumUSD: "$10",
      singleAmount: 89000,
      premiumAmount: 149000,
      periodText: isEN ? "/month" : "/bulan",
      subNote: isEN ? "Flexible monthly plan" : "Paket bulanan fleksibel",
      badge: null
    },
    "3m": {
      label: isEN ? "3 Months" : "3 Bulan",
      singleIDR: "Rp 249rb", singleUSD: "$16",
      premiumIDR: "Rp 399rb", premiumUSD: "$26",
      singleAmount: 249000,
      premiumAmount: 399000,
      periodText: isEN ? "/3 months" : "/3 bulan",
      subNote: isEN ? "Save ~7% to 11% vs monthly" : "Hemat 7% - 11% dibanding bulanan",
      badge: isEN ? "Save ~11%" : "Hemat ~11%"
    },
    "6m": {
      label: isEN ? "6 Months" : "6 Bulan",
      singleIDR: "Rp 449rb", singleUSD: "$29",
      premiumIDR: "Rp 699rb", premiumUSD: "$45",
      singleAmount: 449000,
      premiumAmount: 699000,
      periodText: isEN ? "/6 months" : "/6 bulan",
      subNote: isEN ? "Save ~16% to 22% vs monthly" : "Hemat 16% - 22% dibanding bulanan",
      badge: isEN ? "Save 22%" : "Hemat 22%"
    },
    "1y": {
      label: isEN ? "1 Year" : "1 Tahun",
      singleIDR: "Rp 749rb", singleUSD: "$49",
      premiumIDR: "Rp 1.199rb", premiumUSD: "$79",
      singleAmount: 749000,
      premiumAmount: 1199000,
      periodText: isEN ? "/year" : "/tahun",
      subNote: isEN ? "Save ~30% to 33% (Best Value)" : "Hemat 30% - 33% (Paling Laris)",
      badge: isEN ? "Best Value (Save ~33%)" : "Paling Hemat ~33%"
    },
    "lifetime": {
      label: isEN ? "Lifetime" : "Lifetime",
      singleIDR: "Rp 1.499rb", singleUSD: "$99",
      premiumIDR: "Rp 2.499rb", premiumUSD: "$160",
      singleAmount: 1499000,
      premiumAmount: 2499000,
      periodText: isEN ? "one-time" : "1x bayar",
      subNote: isEN ? "Pay once, access forever (Fair Use)" : "Akses selamanya (Fair Use Policy)",
      badge: isEN ? "All-Time Access" : "Akses Selamanya"
    }
  };

  const currentPrice = durationConfig[selectedDuration];

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const normalizePhoneNumber = (raw: string): string => {
    let digits = raw.replace(/\D/g, "");
    if (digits.startsWith("0")) digits = "62" + digits.slice(1);
    else if (digits.startsWith("8")) digits = "628" + digits.slice(1);
    return digits;
  };

  const resolveExistingPhone = (): string => {
    if (userPhone && userPhone.trim()) return userPhone.trim();
    if (currentUser?.phone && currentUser.phone.trim()) return currentUser.phone.trim();
    try {
      const stored = localStorage.getItem("gymbuddy_active_session");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.phone) return parsed.phone.trim();
      }
    } catch (e) {}
    return "";
  };

  const handleSelectPlan = (
    plan: "advanced" | "premium" | "lifetime",
    service: "nutrition" | "coach" | "both"
  ) => {
    const isSingle = service === "nutrition" || service === "coach";
    const amount = isSingle ? currentPrice.singleAmount : currentPrice.premiumAmount;
    const title =
      service === "nutrition"
        ? (isEN ? "AI Nutritionist" : "AI Nutritionist")
        : service === "coach"
        ? (isEN ? "AI Workout Coach" : "AI Workout Coach")
        : selectedDuration === "lifetime"
        ? (isEN ? "Lifetime Plan (All-Access)" : "Paket Lifetime (All-Access)")
        : (isEN ? "Premium Plan (All-Access)" : "Paket Premium (All-Access)");

    const existingPhone = resolveExistingPhone();

    if (existingPhone) {
      executeCheckout(existingPhone, plan, service, amount, title);
    } else {
      setSelectedPlanForCheckout({ plan, service, amount, title });
      setPhoneInputModalOpen(true);
      setPhoneError(null);
    }
  };

  const executeCheckout = async (
    phone: string,
    plan: "advanced" | "premium" | "lifetime",
    service: "nutrition" | "coach" | "both",
    amount: number,
    title: string
  ) => {
    const normPhone = normalizePhoneNumber(phone);
    if (!normPhone || normPhone.length < 9) {
      setPhoneError(
        isEN
          ? "Please enter a valid WhatsApp number (e.g. 08123456789)"
          : "Mohon masukkan nomor WhatsApp yang valid (contoh: 08123456789)"
      );
      return;
    }

    try {
      setIsProcessingPayment(true);
      setPhoneError(null);

      const res = await canonicalApiFetch<{ success: boolean; token?: string; orderId?: string; error?: string }>(
        "/api/midtrans/create-transaction",
        {
          method: "POST",
          body: JSON.stringify({
            phone: normPhone,
            plan: selectedDuration === "lifetime" ? "lifetime" : plan,
            activeService: service,
            amount: amount,
            duration: selectedDuration,
            customerName: currentUser?.name || "Member GymBuddy"
          })
        }
      );

      if (res && res.success && res.token) {
        setPhoneInputModalOpen(false);

        if ((window as any).snap && typeof (window as any).snap.pay === "function") {
          (window as any).snap.pay(res.token, {
            onSuccess: (result: any) => {
              console.log("[Midtrans] Payment Success:", result);
              setPaymentSuccessData({
                plan,
                service,
                duration: durationConfig[selectedDuration].label,
                orderId: res.orderId || `ORDER-${Date.now()}`,
                phone: normPhone,
                amount
              });
            },
            onPending: (result: any) => {
              console.log("[Midtrans] Payment Pending:", result);
              alert(
                isEN
                  ? "Your payment is pending. Please complete payment using your chosen method (QRIS / Virtual Account)."
                  : "Pembayaran Anda sedang diproses. Silakan selesaikan pembayaran sesuai instruksi QRIS / Virtual Account yang dipilih."
              );
            },
            onError: (result: any) => {
              console.error("[Midtrans] Payment Error:", result);
              alert(
                isEN ? "Payment failed. Please try again." : "Pembayaran gagal. Silakan coba kembali."
              );
            },
            onClose: () => {
              console.log("[Midtrans] Customer closed the payment modal.");
            }
          });
        } else if (res.redirect_url) {
          window.location.href = res.redirect_url;
        } else {
          window.location.href = `https://app.sandbox.midtrans.com/snap/v4/redirection/${res.token}`;
        }
      } else {
        throw new Error(res?.error || "Gagal membuat transaksi pembayaran");
      }
    } catch (err: any) {
      console.error("[Midtrans Checkout Error]", err);
      setPhoneError(
        err.message ||
          (isEN ? "Failed to start payment. Please try again." : "Gagal memulai pembayaran. Silakan coba kembali.")
      );
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const pricingFaqs = isEN
    ? [
        {
          q: "How does the 2-day free trial work?",
          a: "You get full 48-hour unrestricted access to GymBuddy AI on WhatsApp. You can analyze meals, generate custom workout plans, and test form analysis before making any commitment.",
        },
        {
          q: "What durations are available for membership?",
          a: "We offer flexible membership durations: 1 Month, 3 Months, 6 Months, 1 Year, and Lifetime (All-Time One-Time Payment) with increasing discounts up to 40%.",
        },
        {
          q: "Can I switch plans later?",
          a: "Yes! You can upgrade or extend your subscription at any time directly through your WhatsApp AI assistant menu or account settings.",
        },
        {
          q: "What is the difference between AI Workout Coach and Nutrition AI?",
          a: "AI Workout Coach focuses on custom exercise programming, set/rep tracking, and vision pose analysis. Nutrition AI handles meal photo logging, BMR/calorie calculations, and daily macro coaching.",
        },
        {
          q: "Do I need to install an extra app to use GymBuddy?",
          a: "No extra app installation is needed! GymBuddy AI runs directly inside WhatsApp so you receive real-time guidance right where you communicate every day.",
        },
        {
          q: "What payment methods are supported?",
          a: "We support major Credit/Debit Cards, E-Wallets (GoPay, OVO, ShopeePay, Dana), QRIS, and Virtual Account bank transfers (BCA, Mandiri, BRI, BNI, Permata).",
        },
      ]
    : [
        {
          q: "Bagaimana cara kerja 2 hari uji coba gratis?",
          a: "Anda mendapatkan akses penuh tanpa batas selama 48 jam ke GymBuddy AI di WhatsApp. Anda dapat menganalisis makanan, membuat jadwal latihan, dan menguji koreksi postur sebelum berlangganan.",
        },
        {
          q: "Pilihan durasi berlangganan apa saja yang tersedia?",
          a: "Kami menyediakan pilihan durasi 1 Bulan, 3 Bulan, 6 Bulan, 1 Tahun, dan Lifetime (Bayar 1x Akses Selamanya) dengan diskon hemat hingga 40%.",
        },
        {
          q: "Apakah saya bisa mengubah atau memperpanjang paket nanti?",
          a: "Tentu saja! Anda dapat meningkatkan (upgrade) atau memperpanjang paket kapan saja langsung melalui WhatsApp GymBuddy atau menu Dashboard.",
        },
        {
          q: "Apa perbedaan antara AI Workout Coach dan Nutrition AI?",
          a: "AI Workout Coach berfokus pada pembuat jadwal latihan, pelacak repetisi, dan analisis postur video/foto. Nutrition AI menangani pencatatan makanan dari foto, kalkulasi BMR/kalori, dan panduan makro harian.",
        },
        {
          q: "Apakah saya perlu menginstal aplikasi tambahan?",
          a: "Tidak perlu menginstal aplikasi baru! GymBuddy AI beroperasi langsung di WhatsApp sehingga Anda dapat menerima panduan di mana pun Anda berada.",
        },
        {
          q: "Metode pembayaran apa saja yang didukung?",
          a: "Kami mendukung QRIS (GoPay, OVO, ShopeePay, DANA), Transfer Bank Virtual Account (BCA, Mandiri, BRI, BNI, Permata), dan Kartu Kredit/Debit via Midtrans.",
        },
      ];

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-neutral-900 font-sans selection:bg-[#D4FF00] selection:text-black pb-24 relative">
      {/* Header Bar */}
      <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4 flex items-center justify-between border-b border-neutral-300/60">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-neutral-600 hover:text-black transition-colors text-sm font-bold uppercase tracking-wider cursor-pointer"
        >
          <ArrowLeft size={18} />
          <span>{isEN ? "Back to Home" : "Kembali ke Beranda"}</span>
        </button>

        <div>
          <GymBuddyLogo size={28} showText textClassName="text-xl sm:text-2xl text-black" />
        </div>

        <div className="flex items-center gap-4">
          <div
            className="bg-neutral-200 rounded-full p-1 cursor-pointer flex relative text-xs font-bold"
            onClick={() => onLanguageChange(isEN ? "ID" : "EN")}
          >
            <div
              className={`px-3 py-1 rounded-full transition-colors ${
                isEN ? "bg-black text-white" : "text-neutral-600"
              }`}
            >
              EN
            </div>
            <div
              className={`px-3 py-1 rounded-full transition-colors ${
                !isEN ? "bg-black text-white" : "text-neutral-600"
              }`}
            >
              ID
            </div>
          </div>

          <button
            onClick={() => {
              if (onSelectPlanAndStart) onSelectPlanAndStart("advanced");
              else onBack();
            }}
            className="hidden sm:block bg-black text-white text-xs sm:text-sm font-bold px-5 py-2.5 rounded-full hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            {isEN ? "Try for Free" : "Coba Gratis"}
          </button>
        </div>
      </header>

      {/* Hero Header Section */}
      <section className="max-w-4xl mx-auto text-center px-4 pt-12 md:pt-16 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black text-white text-xs font-bold mb-4 shadow-sm">
          <ShieldCheck className="w-3.5 h-3.5 text-[#D4FF00]" />
          <span>{isEN ? "Instant Activation via Midtrans Gateway" : "Aktivasi Instan Otomatis via Midtrans"}</span>
        </div>

        <h1 className="text-3xl sm:text-5xl md:text-6xl font-['Archivo_Black'] tracking-tight leading-tight mb-3 text-black">
          {isEN ? "Plans that fuel your growth." : "Paket Membership GymBuddy AI"}
        </h1>
        <p className="text-neutral-600 text-base sm:text-lg max-w-xl mx-auto font-medium">
          {isEN
            ? "Choose your subscription duration: 1 month, 3 months, 6 months, 1 year, or lifetime access."
            : "Pilih durasi berlangganan: 1 bulan, 3 bulan, 6 bulan, 1 tahun, atau akses selamanya (Lifetime)."}
        </p>

        {/* Duration Selection Tabs (1m, 3m, 6m, 1y, Lifetime) */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2 bg-white p-2 rounded-2xl shadow-sm border border-neutral-200 max-w-2xl mx-auto">
          {(["1m", "3m", "6m", "1y", "lifetime"] as const).map((durKey) => {
            const isSelected = selectedDuration === durKey;
            const cfg = durationConfig[durKey];

            return (
              <button
                key={durKey}
                onClick={() => setSelectedDuration(durKey)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer relative ${
                  isSelected
                    ? "bg-black text-white shadow-md"
                    : "text-neutral-600 hover:text-black hover:bg-neutral-100"
                }`}
              >
                <span>{cfg.label}</span>
                {cfg.badge && (
                  <span
                    className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase ${
                      isSelected ? "bg-[#D4FF00] text-black" : "bg-neutral-200 text-neutral-800"
                    }`}
                  >
                    {cfg.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* 3 BENTO CARDS PRICING GRID */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
        {/* CARD 1: ADVANCED PLAN - NUTRITIONIST */}
        <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-all border border-neutral-200">
          <div>
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                  <Leaf className="w-4 h-4" />
                </span>
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">
                  {isEN ? "Meal & Macros" : "Nutrisi & Makro"}
                </span>
              </div>
              <h3 className="text-xl font-['Archivo_Black'] text-black">
                {isEN ? "Advanced: Nutritionist" : "Advanced: AI Nutritionist"}
              </h3>
              <p className="text-xs text-neutral-500 font-medium mt-1">
                {isEN
                  ? "Focused 100% on meal logging & macro coaching"
                  : "Fokus 100% pada hitung kalori & nutrisi makanan"}
              </p>
            </div>

            {/* Price */}
            <div className="mb-6">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-['Archivo_Black'] text-black">
                  {isEN ? currentPrice.singleUSD : currentPrice.singleIDR}
                </span>
                <span className="text-neutral-500 text-sm font-medium">{currentPrice.periodText}</span>
              </div>
              <p className="text-[11px] text-emerald-600 font-bold mt-1">{currentPrice.subNote}</p>
            </div>

            {/* Select Plan Button */}
            <button
              onClick={() => handleSelectPlan("advanced", "nutrition")}
              disabled={isProcessingPayment}
              className="w-full py-3.5 rounded-full border-2 border-black hover:bg-black hover:text-white text-black font-bold text-sm transition-all mb-8 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isProcessingPayment ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isEN ? "Loading..." : "Menyiapkan..."}</span>
                </>
              ) : (
                <>
                  <span>{isEN ? "Select Nutritionist Plan" : "Pilih AI Nutritionist"}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* Features Box */}
          <div className="bg-[#ECEEF2] rounded-2xl p-5 space-y-3">
            {[
              isEN ? "Dedicated AI Nutritionist Persona" : "Persona Asisten AI Nutritionist",
              isEN ? "Photo Food Logging & Macro Breakdown" : "Pencatatan Makanan via Foto & Makro",
              isEN ? "BMR, TDEE & Deficit Calculator" : "Kalkulator BMR, TDEE & Target Defisit",
              isEN ? "Daily WhatsApp Nutrition Rekap" : "Rekap Nutrisi Harian di WhatsApp",
              isEN ? "Unlimited Daily Meal Logs" : "Unlimited Log Makanan Harian",
            ].map((feat, idx) => (
              <div key={idx} className="flex items-center gap-2.5 text-xs font-semibold text-neutral-800">
                <Check className="w-4 h-4 text-black shrink-0" strokeWidth={2.5} />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CARD 2: ADVANCED PLAN - WORKOUT COACH */}
        <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-all border border-neutral-200">
          <div>
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="p-1.5 bg-blue-100 text-blue-800 rounded-lg">
                  <Dumbbell className="w-4 h-4" />
                </span>
                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wide">
                  {isEN ? "Training & Form" : "Latihan & Postur"}
                </span>
              </div>
              <h3 className="text-xl font-['Archivo_Black'] text-black">
                {isEN ? "Advanced: Workout Coach" : "Advanced: AI Workout Coach"}
              </h3>
              <p className="text-xs text-neutral-500 font-medium mt-1">
                {isEN
                  ? "Focused 100% on exercises & posture feedback"
                  : "Fokus 100% pada variasi latihan & koreksi postur"}
              </p>
            </div>

            {/* Price */}
            <div className="mb-6">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-['Archivo_Black'] text-black">
                  {isEN ? currentPrice.singleUSD : currentPrice.singleIDR}
                </span>
                <span className="text-neutral-500 text-sm font-medium">{currentPrice.periodText}</span>
              </div>
              <p className="text-[11px] text-emerald-600 font-bold mt-1">{currentPrice.subNote}</p>
            </div>

            {/* Select Plan Button */}
            <button
              onClick={() => handleSelectPlan("advanced", "coach")}
              disabled={isProcessingPayment}
              className="w-full py-3.5 rounded-full border-2 border-black hover:bg-black hover:text-white text-black font-bold text-sm transition-all mb-8 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isProcessingPayment ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isEN ? "Loading..." : "Menyiapkan..."}</span>
                </>
              ) : (
                <>
                  <span>{isEN ? "Select Workout Coach Plan" : "Pilih AI Workout Coach"}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* Features Box */}
          <div className="bg-[#ECEEF2] rounded-2xl p-5 space-y-3">
            {[
              isEN ? "Dedicated AI Workout Coach Persona" : "Persona Asisten AI Workout Coach",
              isEN ? "Gym Equipment Form & Technique Check" : "Form & Technique Check Alat Gym",
              isEN ? "Custom Weekly Training Schedule" : "Jadwal Latihan Mingguan Custom",
              isEN ? "Interactive Dashboard Schedule Sync" : "Sync Jadwal Latihan ke Dashboard",
              isEN ? "Unlimited Workout Queries" : "Unlimited Tanya Jawab Latihan",
            ].map((feat, idx) => (
              <div key={idx} className="flex items-center gap-2.5 text-xs font-semibold text-neutral-800">
                <Check className="w-4 h-4 text-black shrink-0" strokeWidth={2.5} />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CARD 3: PREMIUM PLAN (ALL-ACCESS 2 AIs - FEATURED CARD) */}
        <div className="bg-[#0A0A0A] text-white rounded-[2.5rem] p-6 sm:p-8 flex flex-col justify-between shadow-xl relative overflow-hidden transform md:-translate-y-2 border border-neutral-800">
          <div>
            <div className="mb-6 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="p-1.5 bg-[#D4FF00]/20 text-[#D4FF00] rounded-lg">
                    <Crown className="w-4 h-4" />
                  </span>
                  <span className="text-[11px] font-extrabold text-[#D4FF00] uppercase tracking-wide">
                    {isEN ? "All-In-One AI" : "2 AI Sekaligus"}
                  </span>
                </div>
                <h3 className="text-xl font-['Archivo_Black'] text-white">
                  {selectedDuration === "lifetime"
                    ? (isEN ? "Lifetime Plan (All-Access)" : "Paket Lifetime (All-Access)")
                    : (isEN ? "Premium Plan (All-Access)" : "Paket Premium (All-Access)")}
                </h3>
                <p className="text-xs text-neutral-400 font-medium mt-1">
                  {isEN
                    ? "Both AIs (Nutritionist + Workout Coach)"
                    : "Dua AI Sekaligus: Nutrisi & Workout"}
                </p>
              </div>
              <span className="px-3 py-1 bg-[#D4FF00] text-black text-[10px] font-extrabold uppercase rounded-full shrink-0">
                BEST VALUE
              </span>
            </div>

            {/* Price in Lime Accent Color */}
            <div className="mb-6">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-['Archivo_Black'] text-[#D4FF00]">
                  {isEN ? currentPrice.premiumUSD : currentPrice.premiumIDR}
                </span>
                <span className="text-neutral-400 text-sm font-medium">{currentPrice.periodText}</span>
              </div>
              <p className="text-[11px] text-[#D4FF00] font-bold mt-1">{currentPrice.subNote}</p>
            </div>

            {/* Select Plan Button */}
            <button
              onClick={() =>
                handleSelectPlan(
                  selectedDuration === "lifetime" ? "lifetime" : "premium",
                  "both"
                )
              }
              disabled={isProcessingPayment}
              className="w-full py-3.5 rounded-full bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-extrabold text-sm transition-all mb-8 cursor-pointer shadow-lg shadow-[#D4FF00]/10 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isProcessingPayment ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>{isEN ? "Loading Midtrans..." : "Menyiapkan Midtrans..."}</span>
                </>
              ) : (
                <>
                  <span>
                    {selectedDuration === "lifetime"
                      ? (isEN ? "Select Lifetime Plan" : "Pilih Paket Lifetime (All-Access)")
                      : (isEN ? "Select Premium Plan" : "Pilih Paket Premium (All-Access)")}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* Features Box */}
          <div className="bg-white text-black rounded-2xl p-5 space-y-3">
            {[
              isEN ? "2 AI Personas: Nutritionist + Workout Coach" : "2 Asisten AI: Nutritionist + Workout Coach",
              isEN ? "Gemini Pro High-Precision Vision AI" : "Presisi Tinggi Gemini Pro Vision AI",
              isEN ? "Visual Infographic Poster Generation" : "Generasi Infografis Poster Visual Gym",
              isEN ? "Unlimited Daily Meal & Workout Logs" : "Unlimited Log Makanan & Latihan",
              isEN ? "Full Real-time WhatsApp & Dashboard Sync" : "Sync Real-Time WhatsApp & Dashboard",
              isEN ? "Priority 24/7 Fast Response" : "Respon Prioritas Fast Track 24/7",
            ].map((feat, idx) => (
              <div key={idx} className="flex items-center gap-2.5 text-xs font-bold text-neutral-900">
                <Check className="w-4 h-4 text-black shrink-0" strokeWidth={2.5} />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust & Guarantee Banner */}
      <section className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white border border-neutral-200 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-black">
                {isEN ? "Official Midtrans Secure Payment" : "Pembayaran Aman Resmi Midtrans"}
              </h4>
              <p className="text-xs text-neutral-600 mt-0.5 max-w-md">
                {isEN
                  ? "Encrypted payment gateway supporting QRIS (GoPay/OVO/ShopeePay), BCA/Mandiri/BRI Virtual Account & Credit Cards."
                  : "Mendukung QRIS (GoPay, OVO, ShopeePay, DANA), Virtual Account (BCA, Mandiri, BRI, BNI) & Kartu Kredit. Langsung aktif seketika."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-neutral-500 uppercase tracking-wider shrink-0">
            <Lock className="w-4 h-4 text-neutral-400" />
            <span>256-Bit SSL Secured</span>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="max-w-4xl mx-auto px-4 pt-12">
        <h2 className="text-2xl sm:text-3xl font-['Archivo_Black'] text-center text-black mb-8">
          {isEN ? "Frequently Asked Questions" : "Pertanyaan Yang Sering Diajukan"}
        </h2>

        <div className="space-y-4">
          {pricingFaqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl border border-neutral-200 overflow-hidden transition-all"
            >
              <button
                onClick={() => toggleFaq(index)}
                className="w-full p-5 text-left flex justify-between items-center font-bold text-sm sm:text-base text-black cursor-pointer"
              >
                <span>{faq.q}</span>
                {openFaq === index ? (
                  <ChevronUp className="w-5 h-5 text-black shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-neutral-400 shrink-0" />
                )}
              </button>

              {openFaq === index && (
                <div className="px-5 pb-5 text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed border-t border-neutral-100 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* PHONE INPUT MODAL FOR UNREGISTERED USERS */}
      <AnimatePresence>
        {phoneInputModalOpen && selectedPlanForCheckout && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-white relative"
            >
              <button
                onClick={() => setPhoneInputModalOpen(false)}
                className="absolute top-5 right-5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-[#D4FF00]/10 border border-[#D4FF00]/30 flex items-center justify-center text-[#D4FF00]">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-['Archivo_Black'] text-white">
                    {isEN ? "Activate Subscription" : "Aktivasi Langganan"}
                  </h3>
                  <p className="text-xs text-neutral-400 font-medium">
                    {isEN ? "Connect your WhatsApp AI Coach" : "Hubungkan akun WhatsApp AI Anda"}
                  </p>
                </div>
              </div>

              {/* Selected Plan Summary Box */}
              <div className="bg-neutral-800/80 border border-neutral-700/60 rounded-2xl p-4 mb-5">
                <div className="flex justify-between items-center text-xs text-neutral-400 mb-1">
                  <span>{isEN ? "Plan Selected:" : "Paket Dipilih:"}</span>
                  <span className="font-bold text-[#D4FF00] uppercase">
                    {durationConfig[selectedDuration].label}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="font-bold text-white text-sm sm:text-base">
                    {selectedPlanForCheckout.title}
                  </span>
                  <span className="font-['Archivo_Black'] text-base text-white">
                    Rp {selectedPlanForCheckout.amount.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>

              {/* Phone Input */}
              <div className="space-y-2 mb-4">
                <label className="text-xs font-bold text-neutral-300 block">
                  {isEN ? "WhatsApp Number" : "Nomor WhatsApp"}
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-4 text-xs font-bold text-neutral-400 select-none">
                    +62
                  </span>
                  <input
                    type="tel"
                    value={inputPhone.startsWith("62") ? inputPhone.slice(2) : inputPhone.startsWith("0") ? inputPhone.slice(1) : inputPhone}
                    onChange={(e) => {
                      setInputPhone(e.target.value);
                      if (phoneError) setPhoneError(null);
                    }}
                    placeholder="812-3456-7890"
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl pl-12 pr-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#D4FF00] transition-colors"
                  />
                </div>
                <p className="text-[11px] text-neutral-400">
                  {isEN
                    ? "This number will be connected to your AI Coach & will receive the payment confirmation."
                    : "Nomor WhatsApp ini digunakan untuk berinteraksi dengan AI Coach dan menerima konfirmasi pembayaran."}
                </p>
                {phoneError && (
                  <p className="text-xs font-semibold text-red-400 bg-red-950/40 border border-red-800/50 rounded-lg p-2 mt-2">
                    {phoneError}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                onClick={() =>
                  executeCheckout(
                    inputPhone,
                    selectedPlanForCheckout.plan,
                    selectedPlanForCheckout.service,
                    selectedPlanForCheckout.amount,
                    selectedPlanForCheckout.title
                  )
                }
                disabled={isProcessingPayment || !inputPhone.trim()}
                className="w-full py-3.5 rounded-full bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-extrabold text-sm transition-all shadow-lg shadow-[#D4FF00]/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isProcessingPayment ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>{isEN ? "Opening Payment Gateway..." : "Membuka Gateway Pembayaran..."}</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>{isEN ? "Proceed to Midtrans Payment" : "Lanjut ke Pembayaran Midtrans"}</span>
                  </>
                )}
              </button>

              <div className="mt-4 pt-4 border-t border-neutral-800 flex items-center justify-center gap-2 text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>QRIS • GoPay • Virtual Account BCA/Mandiri/BRI</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PAYMENT SUCCESS MODAL */}
      <AnimatePresence>
        {paymentSuccessData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-white text-center relative"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/20">
                <Check className="w-8 h-8" strokeWidth={3} />
              </div>

              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold uppercase tracking-wider inline-block mb-3">
                {isEN ? "Payment Verified" : "Pembayaran Berhasil"}
              </span>

              <h3 className="text-2xl font-['Archivo_Black'] text-white mb-2">
                {isEN ? "Welcome to GymBuddy AI!" : "Selamat Datang di GymBuddy AI!"}
              </h3>

              <p className="text-neutral-300 text-xs sm:text-sm font-medium leading-relaxed mb-6">
                {isEN
                  ? `Your subscription for ${paymentSuccessData.duration} has been successfully activated for WhatsApp ${paymentSuccessData.phone}. Your AI Coach is ready!`
                  : `Langganan paket (${paymentSuccessData.duration}) telah aktif untuk nomor WhatsApp ${paymentSuccessData.phone}. AI Coach Anda siap mendampingi sekarang!`}
              </p>

              <div className="bg-neutral-800/70 border border-neutral-700/60 rounded-2xl p-4 mb-6 text-left text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-neutral-400">{isEN ? "Order ID" : "ID Pesanan"}</span>
                  <span className="font-mono text-white font-semibold">{paymentSuccessData.orderId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">{isEN ? "Duration" : "Durasi Paket"}</span>
                  <span className="font-bold text-[#D4FF00]">{paymentSuccessData.duration}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">{isEN ? "Status" : "Status"}</span>
                  <span className="font-bold text-emerald-400">{isEN ? "ACTIVE" : "AKTIF"}</span>
                </div>
              </div>

              <div className="space-y-3">
                <a
                  href={getWhatsAppDestinationUrl(
                    "Halo Coach! Saya sudah menyelesaikan pembayaran langganan GymBuddy AI. Yuk mulai pandu perjalanan fitness dan nutrisi saya!"
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 rounded-full bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-extrabold text-sm transition-all shadow-lg shadow-[#D4FF00]/10 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MessageCircle className="w-5 h-5 fill-current" />
                  <span>{isEN ? "Open WhatsApp Coach Now" : "Buka WhatsApp Coach Sekarang"}</span>
                </a>

                <button
                  onClick={() => {
                    setPaymentSuccessData(null);
                    onBack();
                  }}
                  className="w-full py-3 rounded-full border border-neutral-700 hover:border-neutral-500 text-neutral-300 font-bold text-xs transition-colors cursor-pointer"
                >
                  {isEN ? "Back to Home / Dashboard" : "Kembali ke Beranda / Dashboard"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
