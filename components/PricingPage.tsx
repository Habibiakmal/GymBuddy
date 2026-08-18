import React, { useState } from "react";
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
} from "lucide-react";

interface PricingPageProps {
  language: "EN" | "ID";
  onBack: () => void;
  onSelectPlanAndStart: (plan: "advanced" | "premium", feature?: "nutrition" | "coach") => void;
  onLanguageChange: (lang: "EN" | "ID") => void;
}

export default function PricingPage({
  language,
  onBack,
  onSelectPlanAndStart,
  onLanguageChange,
}: PricingPageProps) {
  const [selectedDuration, setSelectedDuration] = useState<"1m" | "3m" | "6m" | "1y" | "lifetime">("1m");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const isEN = language === "EN";

  const durationConfig = {
    "1m": {
      label: isEN ? "1 Month" : "1 Bulan",
      singleIDR: "Rp 89rb", singleUSD: "$6",
      premiumIDR: "Rp 149rb", premiumUSD: "$10",
      periodText: isEN ? "/month" : "/bulan",
      subNote: isEN ? "Flexible monthly plan" : "Paket bulanan fleksibel",
      badge: null
    },
    "3m": {
      label: isEN ? "3 Months" : "3 Bulan",
      singleIDR: "Rp 249rb", singleUSD: "$16",
      premiumIDR: "Rp 399rb", premiumUSD: "$26",
      periodText: isEN ? "/3 months" : "/3 bulan",
      subNote: isEN ? "Save ~7% to 11% vs monthly" : "Hemat 7% - 11% dibanding bulanan",
      badge: isEN ? "Save ~11%" : "Hemat ~11%"
    },
    "6m": {
      label: isEN ? "6 Months" : "6 Bulan",
      singleIDR: "Rp 449rb", singleUSD: "$29",
      premiumIDR: "Rp 699rb", premiumUSD: "$45",
      periodText: isEN ? "/6 months" : "/6 bulan",
      subNote: isEN ? "Save ~16% to 22% vs monthly" : "Hemat 16% - 22% dibanding bulanan",
      badge: isEN ? "Save 22%" : "Hemat 22%"
    },
    "1y": {
      label: isEN ? "1 Year" : "1 Tahun",
      singleIDR: "Rp 749rb", singleUSD: "$49",
      premiumIDR: "Rp 1.199rb", premiumUSD: "$79",
      periodText: isEN ? "/year" : "/tahun",
      subNote: isEN ? "Save ~30% to 33% (Best Value)" : "Hemat 30% - 33% (Paling Laris)",
      badge: isEN ? "Best Value (Save ~33%)" : "Paling Hemat ~33%"
    },
    "lifetime": {
      label: isEN ? "Lifetime" : "Lifetime",
      singleIDR: "Rp 1.499rb", singleUSD: "$99",
      premiumIDR: "Rp 2.499rb", premiumUSD: "$160",
      periodText: isEN ? "one-time" : "1x bayar",
      subNote: isEN ? "Pay once, access forever (Fair Use)" : "Akses selamanya (Fair Use Policy)",
      badge: isEN ? "All-Time Access" : "Akses Selamanya"
    }
  };

  const currentPrice = durationConfig[selectedDuration];

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
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
          a: "We support major Credit/Debit Cards, E-Wallets (GoPay, OVO, ShopeePay, Dana), QRIS, and Virtual Account bank transfers.",
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
          a: "Kami mendukung Kartu Kredit/Debit, E-Wallet (GoPay, OVO, ShopeePay, DANA), QRIS, dan Transfer Bank Virtual Account.",
        },
      ];

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-neutral-900 font-sans selection:bg-[#D4FF00] selection:text-black pb-24">
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
            onClick={() => onSelectPlanAndStart("advanced")}
            className="hidden sm:block bg-black text-white text-xs sm:text-sm font-bold px-5 py-2.5 rounded-full hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            {isEN ? "Try for Free" : "Coba Gratis"}
          </button>
        </div>
      </header>

      {/* Hero Header Section */}
      <section className="max-w-4xl mx-auto text-center px-4 pt-12 md:pt-16 pb-6">
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
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase ${
                    isSelected ? "bg-[#D4FF00] text-black" : "bg-neutral-200 text-neutral-800"
                  }`}>
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
              <h3 className="text-xl font-['Archivo_Black'] text-black">
                {isEN ? "Advanced: Nutritionist" : "Advanced: AI Nutritionist"}
              </h3>
              <p className="text-xs text-neutral-500 font-medium mt-1">
                {isEN ? "Focused 100% on meal logging & macro coaching" : "Fokus 100% pada hitung kalori & nutrisi makanan"}
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
              onClick={() => onSelectPlanAndStart("advanced", "nutrition")}
              className="w-full py-3.5 rounded-full border border-neutral-300 hover:border-black text-black font-bold text-sm transition-all mb-8 cursor-pointer"
            >
              {isEN ? "Select Nutritionist Plan" : "Pilih AI Nutritionist"}
            </button>
          </div>

          {/* Features Box */}
          <div className="bg-[#ECEEF2] rounded-2xl p-5 space-y-3">
            {[
              isEN ? "Dedicated AI Nutritionist Persona" : "Persona Asisten AI Nutritionist",
              isEN ? "Photo Food Logging & Macro Breakdown" : "Pencatatan Makanan via Foto & Makro",
              isEN ? "BMR, TDEE & Deficit Calculator" : "Kalkulator BMR, TDEE & Target Defisit",
              isEN ? "Daily WhatsApp Nutrition Rekap" : "Rekap Nutrisi Harian di WhatsApp",
              isEN ? "Unlimited Daily Meal Logs" : "Unlimited Log Makanan Harian"
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
              <h3 className="text-xl font-['Archivo_Black'] text-black">
                {isEN ? "Advanced: Workout Coach" : "Advanced: AI Workout Coach"}
              </h3>
              <p className="text-xs text-neutral-500 font-medium mt-1">
                {isEN ? "Focused 100% on exercises & posture feedback" : "Fokus 100% pada variasi latihan & koreksi postur"}
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
              onClick={() => onSelectPlanAndStart("advanced", "coach")}
              className="w-full py-3.5 rounded-full border border-neutral-300 hover:border-black text-black font-bold text-sm transition-all mb-8 cursor-pointer"
            >
              {isEN ? "Select Workout Coach Plan" : "Pilih AI Workout Coach"}
            </button>
          </div>

          {/* Features Box */}
          <div className="bg-[#ECEEF2] rounded-2xl p-5 space-y-3">
            {[
              isEN ? "Dedicated AI Workout Coach Persona" : "Persona Asisten AI Workout Coach",
              isEN ? "Gym Equipment Form & Technique Check" : "Form & Technique Check Alat Gym",
              isEN ? "Custom Weekly Training Schedule" : "Jadwal Latihan Mingguan Custom",
              isEN ? "Interactive Dashboard Schedule Sync" : "Sync Jadwal Latihan ke Dashboard",
              isEN ? "Unlimited Workout Queries" : "Unlimited Tanya Jawab Latihan"
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
                <h3 className="text-xl font-['Archivo_Black'] text-white">
                  {isEN ? "Premium Plan (All-Access)" : "Paket Premium (All-Access)"}
                </h3>
                <p className="text-xs text-neutral-400 font-medium mt-1">
                  {isEN ? "Both AIs (Nutritionist + Workout Coach)" : "Dua AI Sekaligus: Nutrisi & Workout"}
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
              onClick={() => onSelectPlanAndStart("premium")}
              className="w-full py-3.5 rounded-full bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-extrabold text-sm transition-all mb-8 cursor-pointer shadow-lg shadow-[#D4FF00]/10"
            >
              {isEN ? "Select Premium Plan" : "Pilih Paket Premium (All-Access)"}
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
              isEN ? "Priority 24/7 Fast Response" : "Respon Prioritas Fast Track 24/7"
            ].map((feat, idx) => (
              <div key={idx} className="flex items-center gap-2.5 text-xs font-bold text-neutral-900">
                <Check className="w-4 h-4 text-black shrink-0" strokeWidth={2.5} />
                <span>{feat}</span>
              </div>
            ))}
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
    </div>
  );
}
