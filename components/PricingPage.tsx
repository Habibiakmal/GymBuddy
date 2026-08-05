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
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const isEN = language === "EN";

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
          q: "Can I switch plans later?",
          a: "Yes! You can upgrade or downgrade your subscription at any time directly through your WhatsApp AI assistant menu or account settings.",
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
          q: "Apakah saya bisa mengubah paket nanti?",
          a: "Tentu saja! Anda dapat meningkatkan (upgrade) atau mengubah paket kapan saja langsung melalui menu Asisten WhatsApp GymBuddy.",
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
          {isEN ? "Plans that fuel your growth." : "Paket yang Mendukung Progresmu."}
        </h1>
        <p className="text-neutral-600 text-base sm:text-lg max-w-xl mx-auto font-medium">
          {isEN
            ? "Unlock your physical potential with plans designed to fuel growth."
            : "Pilih paket terbaik untuk mendampingi dan memaksimalkan perjalanan fitnessmu."}
        </p>

        {/* Monthly / Yearly Toggle Control */}
        <div className="mt-8 inline-flex items-center gap-3 bg-white px-4 py-2 rounded-full shadow-sm border border-neutral-200">
          <span className={`text-xs sm:text-sm font-bold ${billingCycle === "monthly" ? "text-black" : "text-neutral-400"}`}>
            {isEN ? "Monthly" : "Bulanan"}
          </span>

          <div
            onClick={() => setBillingCycle(billingCycle === "monthly" ? "yearly" : "monthly")}
            className="w-12 h-6 bg-black rounded-full p-1 cursor-pointer relative flex items-center"
          >
            <motion.div
              className="w-4 h-4 bg-[#D4FF00] rounded-full shadow-md"
              animate={{ x: billingCycle === "monthly" ? 0 : 24 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </div>

          <span className={`text-xs sm:text-sm font-bold ${billingCycle === "yearly" ? "text-black" : "text-neutral-400"}`}>
            {isEN ? "Yearly" : "Tahunan"}
          </span>

          <span className="px-2.5 py-0.5 rounded-full bg-[#D4FF00] text-black font-extrabold text-[11px] tracking-wide">
            Save 20%
          </span>
        </div>
      </section>

      {/* 3 BENTO CARDS PRICING GRID (Matching requested design) */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
        
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
            <div className="flex items-baseline gap-1.5 mb-6">
              <span className="text-4xl sm:text-5xl font-['Archivo_Black'] text-black">
                {isEN ? "$5" : "Rp 79rb"}
              </span>
              <span className="text-neutral-500 text-sm font-medium">/{isEN ? "monthly" : "bulan"}</span>
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
            <div className="flex items-baseline gap-1.5 mb-6">
              <span className="text-4xl sm:text-5xl font-['Archivo_Black'] text-black">
                {isEN ? "$5" : "Rp 79rb"}
              </span>
              <span className="text-neutral-500 text-sm font-medium">/{isEN ? "monthly" : "bulan"}</span>
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
              <span className="px-3 py-1 bg-[#D4FF00] text-black text-[10px] font-extrabold uppercase rounded-full">
                BEST VALUE
              </span>
            </div>

            {/* Price in Lime Accent Color */}
            <div className="flex items-baseline gap-1.5 mb-6">
              <span className="text-4xl sm:text-5xl font-['Archivo_Black'] text-[#D4FF00]">
                {isEN ? "$8" : "Rp 139rb"}
              </span>
              <span className="text-neutral-400 text-sm font-medium">/{isEN ? "monthly" : "bulan"}</span>
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
