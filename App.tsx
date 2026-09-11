import React, { useState, MouseEvent } from "react";
import Onboarding from "./components/Onboarding";
import FeatureShowcase from "./components/FeatureShowcase";
import PricingPage from "./components/PricingPage";
import TestimonialCarousel from "./components/TestimonialCarousel";
import LoginModal from "./components/LoginModal";
import GymBuddyLogo from "./components/Logo";
import Dashboard from "./components/Dashboard";
import WatchMode from "./components/WatchMode";
import SplashScreen from "./components/SplashScreen";
import { getApiBaseUrl } from "./utils/api";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useMotionTemplate,
  AnimatePresence,
} from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  Wifi,
  Asterisk,
  Plus,
  Watch,
  Menu,
  Activity,
  Flame,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Target,
  Dumbbell,
  Leaf,
  HeartPulse,
  Sparkles,
  MessageSquare,
  CheckCircle2,
  Crown,
} from "lucide-react";

export default function App() {
  const [showSplash, setShowSplash] = useState<boolean>(false);
  const [language, setLanguage] = useState<"EN" | "ID">(() => {
    try {
      const saved = localStorage.getItem("gymbuddy_lang");
      if (saved === "EN" || saved === "ID") return saved;
    } catch (e) {}
    return "ID";
  });
  const [activePricing, setActivePricing] = useState("PREMIUM");
  const [specialization, setSpecialization] = useState<"nutrition" | "vision">(
    "nutrition",
  );
  const [activeStep, setActiveStep] = useState(2);
  const [isAppOnboarding, setIsAppOnboarding] = useState(false);
  const [showcaseVariant, setShowcaseVariant] = useState<"workout" | "nutrition" | null>(null);
  const [isPricingPage, setIsPricingPage] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [initialLoginPhone, setInitialLoginPhone] = useState<string>("");

  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      const stored = localStorage.getItem("gymbuddy_active_session");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch (e) {}
    return null;
  });

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem("gymbuddy_active_session");
    } catch (e) {
      return false;
    }
  });

  const [viewMode, setViewMode] = useState<"landing" | "dashboard">(() => {
    try {
      const stored = localStorage.getItem("gymbuddy_active_session");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object" && parsed.phone) return "dashboard";
      }
      return "landing";
    } catch (e) {
      return "landing";
    }
  });

  React.useEffect(() => {
    const splashTimer = setTimeout(() => setShowSplash(false), 1600);
    return () => clearTimeout(splashTimer);
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem("gymbuddy_lang", language);
    } catch (e) {}
  }, [language]);

  // Direct URL parameter login for testing (e.g. ?user=alex or ?user=mia)
  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const testParam = (params.get("user") || params.get("demo") || params.get("test") || "").toLowerCase();
      if (testParam === "alex") {
        const alexProfile = {
          userId: "usr_alex_demo",
          name: "Alex",
          phone: "08111111111",
          gender: "pria",
          age: 26,
          weight: 75,
          startWeight: 75,
          targetWeight: 70,
          height: 175,
          goal: "lose",
          goalTitle: "Menurunkan Berat Badan",
          persona: "max",
          activeService: "nutritionist",
          selectedFeature: "nutrition",
          plan: "nutrition",
          activityLevel: "moderate",
          targetCalories: 2100,
          dailyTargetCalories: 2100,
          proteinGrams: 155,
          dailyTargetProtein: 155,
          carbGrams: 210,
          dailyTargetCarbs: 210,
          fatGrams: 65,
          dailyTargetFat: 65,
          fiberGrams: 30
        };
        setCurrentUser(alexProfile);
        setIsLoggedIn(true);
        setViewMode("dashboard");
        localStorage.setItem("gymbuddy_active_session", JSON.stringify(alexProfile));
      } else if (testParam === "mia") {
        const miaProfile = {
          userId: "usr_mia_demo",
          name: "Mia",
          phone: "08222222222",
          gender: "wanita",
          age: 24,
          weight: 58,
          startWeight: 58,
          targetWeight: 54,
          height: 165,
          goal: "gain",
          goalTitle: "Membentuk Otot & Tone",
          persona: "mia",
          activeService: "workout",
          selectedFeature: "workout",
          plan: "workout",
          activityLevel: "moderate",
          targetCalories: 1850,
          dailyTargetCalories: 1850,
          proteinGrams: 120,
          dailyTargetProtein: 120,
          carbGrams: 200,
          dailyTargetCarbs: 200,
          fatGrams: 55,
          dailyTargetFat: 55,
          fiberGrams: 28
        };
        setCurrentUser(miaProfile);
        setIsLoggedIn(true);
        setViewMode("dashboard");
        localStorage.setItem("gymbuddy_active_session", JSON.stringify(miaProfile));
      }
    } catch (e) {}
  }, []);

  // Session verification: keep user logged in and sync profile in background
  React.useEffect(() => {
    const verifySession = async () => {
      const stored = localStorage.getItem("gymbuddy_active_session");
      if (!stored) {
        if (window.location.pathname.toLowerCase() === "/dashboard") {
          window.history.replaceState({}, "", "/");
          setViewMode("landing");
        }
        return;
      }
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.phone) {
          // Immediately keep session active (no logout on refresh)
          setCurrentUser(parsed);
          setIsLoggedIn(true);
          setViewMode("dashboard");

          // Skip background deletion check for test accounts
          if (parsed.phone === "08111111111" || parsed.phone === "08222222222" || parsed.userId === "usr_alex_demo" || parsed.userId === "usr_mia_demo") {
            return;
          }

          // Background sync with server database
          const norm = String(parsed.phone).replace(/\D/g, "").replace(/^62/, "0");
          const cleanPhone = norm.startsWith("8") ? "0" + norm : norm;
          const API_BASE_URL = getApiBaseUrl();

          try {
            const res = await fetch(`${API_BASE_URL}/api/user/${cleanPhone}`, {
              headers: { "Accept": "application/json" }
            }).catch(() => null);

            if (res && res.status === 404) {
              console.warn("[SessionGuard] User no longer exists on server database. Purging stale local session...");
              Object.keys(localStorage).forEach((key) => {
                if (key.startsWith("gymbuddy")) {
                  localStorage.removeItem(key);
                }
              });
              setCurrentUser(null);
              setIsLoggedIn(false);
              setViewMode("landing");
              return;
            }

            if (res && res.ok) {
              const data = await res.json().catch(() => null);
              if (data && (data.user || data.profile)) {
                const liveProfile = data.user || data.profile;
                setCurrentUser(liveProfile);
                localStorage.setItem("gymbuddy_active_session", JSON.stringify(liveProfile));
              }
            }
          } catch (e) {}
        }
      } catch (e) {}
    };
    verifySession();
  }, []);

  const handleLoginSuccess = (profile: any) => {
    setCurrentUser(profile);
    setIsLoggedIn(true);
    setViewMode("dashboard");
    try {
      localStorage.setItem("gymbuddy_active_session", JSON.stringify(profile));
    } catch (e) {}
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsLoggedIn(false);
    setViewMode("landing");
    try {
      localStorage.removeItem("gymbuddy_active_session");
      localStorage.removeItem("gymbuddy_last_user");
    } catch (e) {}
    if (typeof window !== "undefined" && window.location.pathname.toLowerCase() === "/dashboard") {
      window.history.replaceState({}, "", "/");
    }
  };

  const handleResetAllData = async () => {
    try {
      if (currentUser?.phone) {
        const norm = String(currentUser.phone).replace(/\D/g, '');
        await fetch(`/api/user/${norm}`, { method: "DELETE" }).catch(() => {});
      }
      await fetch(`/api/user/reset`, { method: "POST" }).catch(() => {});
      const API_BASE_URL = (import.meta as any).env?.VITE_API_URL;
      if (API_BASE_URL && API_BASE_URL !== "") {
        if (currentUser?.phone) {
          await fetch(`${API_BASE_URL}/api/user/${currentUser.phone}`, { method: "DELETE" }).catch(() => {});
        }
        await fetch(`${API_BASE_URL}/api/user/reset`, { method: "POST" }).catch(() => {});
      }
    } catch (e) {}

    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("gymbuddy")) {
          localStorage.removeItem(key);
        }
      });
      localStorage.clear();
    } catch (e) {}

    setCurrentUser(null);
    setIsLoggedIn(false);
    setViewMode("landing");
    setIsAppOnboarding(true);
  };

  React.useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase().replace(/\/$/, "");
      if (path === "/features") {
        setShowcaseVariant("nutrition");
        setIsPricingPage(false);
        setIsAppOnboarding(false);
      } else if (path === "/how-it-works" || path === "/howitworks" || path === "/how_it_works") {
        setShowcaseVariant("workout");
        setIsPricingPage(false);
        setIsAppOnboarding(false);
      } else if (path === "/pricing") {
        setIsPricingPage(true);
        setShowcaseVariant(null);
        setIsAppOnboarding(false);
      } else if (path === "/watch" || window.location.hash === "#watch") {
        setViewMode("watch");
        setIsPricingPage(false);
        setShowcaseVariant(null);
        setIsAppOnboarding(false);
      } else if (path === "/dashboard") {
        setViewMode("dashboard");
        setIsPricingPage(false);
        setShowcaseVariant(null);
        setIsAppOnboarding(false);
      } else if (path === "/onboarding") {
        setIsAppOnboarding(true);
        setIsPricingPage(false);
        setShowcaseVariant(null);
      } else {
        setIsPricingPage(false);
        setShowcaseVariant(null);
        setIsAppOnboarding(false);
      }
    };

    handlePopState();
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  React.useEffect(() => {
    let pageTitle = "GymBuddy AI | AI Personal Trainer & Nutrition Coach";
    let currentPath = "/";

    if (viewMode === "watch") {
      pageTitle = "Watch Companion Mode | GymBuddy AI";
      currentPath = "/watch";
    } else if (isAppOnboarding) {
      pageTitle = "Personalized Onboarding | GymBuddy AI";
      currentPath = "/onboarding";
    } else if (viewMode === "dashboard" && currentUser) {
      pageTitle = `${currentUser.name ? currentUser.name + " - " : ""}Member Dashboard | GymBuddy AI`;
      currentPath = "/dashboard";
    } else if (isPricingPage) {
      pageTitle = "Pricing & Membership Plans | GymBuddy AI";
      currentPath = "/pricing";
    } else if (showcaseVariant === "nutrition") {
      pageTitle = "Nutrition AI Features | GymBuddy AI";
      currentPath = "/features";
    } else if (showcaseVariant === "workout") {
      pageTitle = "Vision AI & Workout Guide - How It Works | GymBuddy AI";
      currentPath = "/how-it-works";
    }

    document.title = pageTitle;

    if (window.location.pathname !== currentPath) {
      try {
        window.history.pushState({}, "", currentPath);
      } catch (e) {}
    }
  }, [isAppOnboarding, viewMode, currentUser, isPricingPage, showcaseVariant]);


  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springConfig = { damping: 20, stiffness: 50 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  const parallaxX = useTransform(smoothX, [0, 1920], [16, -16]);
  const parallaxY = useTransform(smoothY, [0, 1080], [16, -16]);

  const spotlightMask = useMotionTemplate`radial-gradient(250px circle at ${smoothX}px ${smoothY}px, black 0%, transparent 100%)`;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  const faqsEN = [
    {
      question: "Is GymBuddy suitable for beginners who have never worked out?",
      answer:
        "Absolutely! GymBuddy is specifically designed to be beginner-friendly. Your plan starts with safe fundamental movements, accompanied by step-by-step guidance and form cues so you never feel intimidated or overwhelmed.",
    },
    {
      question: "Can GymBuddy be used without a gym or equipment?",
      answer:
        "Yes, completely! During onboarding, you can select 'bodyweight only' or choose whatever equipment you have at home (like dumbbells or resistance bands). The AI crafts an effective workout routine tailored exactly to what is available to you.",
    },
    {
      question: "How does GymBuddy determine my personalized workout plan?",
      answer:
        "GymBuddy designs your plan around your core goal (fat loss, muscle gain, stamina), current fitness level, schedule, available equipment, and any past injuries or physical constraints you share with us.",
    },
    {
      question: "Can I change my goal or workout schedule later?",
      answer:
        "Of course! Your life and goals evolve, and your coach adapts with you. You can update your target anytime via the web dashboard or by simply messaging your coach on WhatsApp. Your weekly workouts and macro targets will recalculate automatically.",
    },
    {
      question: "What happens if I miss a workout or overeat?",
      answer:
        "No guilt, and no harsh punishment. GymBuddy is not a rigid spreadsheet. The AI dynamically recalibrates your upcoming sessions and provides balancing nutrition suggestions to keep your momentum going without stress.",
    },
    {
      question: "How does GymBuddy help me with daily nutrition?",
      answer:
        "As simple as sending a WhatsApp chat! Just snap a photo of your meal or type a quick description. Your AI coach analyzes calories, protein, carbs, and fats instantly, and suggests your next meal to hit your daily targets.",
    },
    {
      question: "Is my personal health data and privacy safe?",
      answer:
        "Your privacy and data security are paramount. All profile information, workout logs, and health notes are securely encrypted, never sold to third parties, and used solely to personalize your coaching experience.",
    },
    {
      question: "How does the 2-day free trial work?",
      answer:
        "You get 48 hours of full, unrestricted access to both Workout and Nutrition AI directly on WhatsApp. No credit card required and zero commitment — try it out and experience the real coaching difference first-hand.",
    },
  ];

  const faqsID = [
    {
      question: "Apakah GymBuddy cocok untuk pemula yang belum pernah ke gym?",
      answer:
        "Sangat cocok! GymBuddy dirancang khusus agar ramah pemula. Program latihan dimulai dari gerakan dasar yang aman, disertai instruksi langkah demi langkah dan panduan postur visual sehingga kamu tidak akan merasa bingung atau kewalahan.",
    },
    {
      question: "Apakah GymBuddy bisa digunakan tanpa gym atau tanpa alat?",
      answer:
        "Bisa banget! Saat onboarding, kamu bisa memilih opsi 'hanya berat badan' (bodyweight) atau peralatan yang ada di rumah (seperti dumbbell). AI akan merancang program yang optimal sesuai fasilitas yang kamu miliki.",
    },
    {
      question: "Bagaimana GymBuddy menentukan rencana latihan saya?",
      answer:
        "GymBuddy menyusun rencana berdasarkan tujuan utamamu (fat loss, muscle gain, stamina), tingkat kebugaran saat ini, ketersediaan alat, jadwal harian, serta riwayat cedera atau kondisi fisik yang kamu laporkan.",
    },
    {
      question: "Apakah saya bisa mengubah target atau jadwal latihan di tengah jalan?",
      answer:
        "Tentu saja! Kebutuhan dan jadwalmu bisa berubah kapan saja. Kamu cukup perbarui tujuan melalui Dashboard atau beritahu Coach lewat chat WhatsApp, dan rencana latihan serta nutrisi akan otomatis menyesuaikan.",
    },
    {
      question: "Bagaimana jika saya melewatkan latihan atau makan berlebih?",
      answer:
        "Tidak perlu khawatir atau merasa bersalah! GymBuddy bukan sistem kaku. AI akan otomatis mengadaptasi target sesi berikutnya dan memberi saran nutrisi penyeimbang agar kamu tetap konsisten di jalur tujuan tanpa stres.",
    },
    {
      question: "Bagaimana GymBuddy membantu urusan nutrisi sehari-hari?",
      answer:
        "Semudah mengirim chat di WhatsApp! Kamu cukup kirimkan foto makanan atau sebutkan apa yang kamu makan. AI Coach langsung menganalisis estimasi kalori dan makronutrisi (protein, karbo, lemak), serta menyarankan menu berikutnya untuk mencukupi target harianmu.",
    },
    {
      question: "Apakah data dan riwayat kesehatan saya aman?",
      answer:
        "Keamanan dan privasi kamu adalah prioritas kami. Seluruh data profil, riwayat latihan, dan catatan kesehatan tersimpan secara terenkripsi, tidak pernah diperjualbelikan, dan hanya digunakan untuk mempersonalisasi pendampingan kebugaranmu.",
    },
    {
      question: "Bagaimana cara kerja uji coba gratis 2 hari?",
      answer:
        "Kamu mendapatkan akses penuh ke seluruh fitur Workout & Nutrition AI langsung di WhatsApp selama 48 jam. Tanpa kartu kredit dan tanpa komitmen, sehingga kamu bisa membuktikan manfaatnya secara nyata terlebih dahulu.",
    },
  ];

  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(null);
  const activeFaqs = language === "EN" ? faqsEN : faqsID;

  const [selectedPricingDuration, setSelectedPricingDuration] =
    useState<"1m" | "3m" | "6m" | "1y" | "lifetime">("1m");

  const durationPricingConfig = {
    "1m": {
      labelID: "1 Bulan",
      labelEN: "1 Month",
      singleIDR: "Rp 89rb",
      singleUSD: "$6",
      premiumIDR: "Rp 149rb",
      premiumUSD: "$10",
      periodID: "/bulan",
      periodEN: "/month",
      subNoteID: "Paket bulanan fleksibel",
      subNoteEN: "Flexible monthly plan",
      badge: null,
    },
    "3m": {
      labelID: "3 Bulan",
      labelEN: "3 Months",
      singleIDR: "Rp 249rb",
      singleUSD: "$16",
      premiumIDR: "Rp 399rb",
      premiumUSD: "$26",
      periodID: "/3 bulan",
      periodEN: "/3 months",
      subNoteID: "Hemat ~11% vs bulanan",
      subNoteEN: "Save ~11% vs monthly",
      badge: "Hemat ~11%",
    },
    "6m": {
      labelID: "6 Bulan",
      labelEN: "6 Months",
      singleIDR: "Rp 449rb",
      singleUSD: "$29",
      premiumIDR: "Rp 699rb",
      premiumUSD: "$45",
      periodID: "/6 bulan",
      periodEN: "/6 months",
      subNoteID: "Hemat 16% - 22% vs bulanan",
      subNoteEN: "Save 16% - 22% vs monthly",
      badge: "Hemat 22%",
    },
    "1y": {
      labelID: "1 Tahun",
      labelEN: "1 Year",
      singleIDR: "Rp 749rb",
      singleUSD: "$49",
      premiumIDR: "Rp 1.199rb",
      premiumUSD: "$79",
      periodID: "/tahun",
      periodEN: "/year",
      subNoteID: "Hemat ~33% (Paling Laris)",
      subNoteEN: "Best Value (Save ~33%)",
      badge: "Paling Hemat ~33%",
    },
    "lifetime": {
      labelID: "Lifetime",
      labelEN: "Lifetime",
      singleIDR: "Rp 1.499rb",
      singleUSD: "$99",
      premiumIDR: "Rp 2.499rb",
      premiumUSD: "$160",
      periodID: "1x bayar",
      periodEN: "one-time",
      subNoteID: "Akses selamanya (Fair Use)",
      subNoteEN: "Pay once, access forever",
      badge: "Akses Selamanya",
    },
  };

  const splashOverlay = (
    <AnimatePresence>
      {showSplash && (
        <SplashScreen onFinish={() => setShowSplash(false)} />
      )}
    </AnimatePresence>
  );

  if (isAppOnboarding) {
    return (
      <>
        {splashOverlay}
        <Onboarding
          language={language}
          onOpenLogin={(prefilledPhone) => {
            if (prefilledPhone) {
              setInitialLoginPhone(prefilledPhone);
            }
            setIsAppOnboarding(false);
            setIsLoginModalOpen(true);
          }}
          onComplete={() => {
            setIsAppOnboarding(false);
            try {
              const stored = localStorage.getItem("gymbuddy_active_session") || localStorage.getItem("gymbuddy_last_user");
              if (stored) {
                handleLoginSuccess(JSON.parse(stored));
              } else {
                setViewMode("dashboard");
              }
            } catch (e) {
              setViewMode("dashboard");
            }
          }}
        />
      </>
    );
  }

  if (viewMode === "watch") {
    return (
      <WatchMode
        user={currentUser}
        onExit={() => setViewMode(currentUser ? "dashboard" : "landing")}
      />
    );
  }

  if (viewMode === "dashboard" && currentUser) {
    return (
      <Dashboard
        user={currentUser}
        language={language}
        onLogout={handleLogout}
        onBackToHome={() => setViewMode("landing")}
        onResetData={handleResetAllData}
        onOpenWatchMode={() => setViewMode("watch")}
        onUpdateUser={(updatedUser) => {
          setCurrentUser(updatedUser);
          try {
            localStorage.setItem("gymbuddy_active_session", JSON.stringify(updatedUser));
          } catch (e) {}
        }}
      />
    );
  }

  if (isPricingPage) {
    return (
      <>
        {splashOverlay}
        <PricingPage
          language={language}
          currentUser={currentUser}
          userPhone={currentUser?.phone || ""}
          onBack={() => setIsPricingPage(false)}
          onLanguageChange={(lang) => setLanguage(lang)}
          onSelectPlanAndStart={(plan, feature) => {
            setIsPricingPage(false);
            setIsAppOnboarding(true);
          }}
        />
      </>
    );
  }

  if (showcaseVariant) {
    return (
      <>
        {splashOverlay}
        <FeatureShowcase
          variant={showcaseVariant}
          language={language}
          onBack={() => setShowcaseVariant(null)}
          onSwitchVariant={(v) => setShowcaseVariant(v)}
          onOnboardingRequest={() => {
            setShowcaseVariant(null);
            setIsAppOnboarding(true);
          }}
          userPhone={currentUser?.phone || currentUser?.normalizedPhone || ""} // Bug #9 fix
        />
      </>
    );
  }
  return (
    <div className="min-h-screen bg-white font-sans text-neutral-900 selection:bg-[#D4FF00] selection:text-black">
      {splashOverlay}
      <div className="pb-12">
        {/* HERO SECTION */}
        <div className="p-3 sm:p-4 lg:p-5 2xl:p-6 min-h-screen min-h-[100dvh] lg:h-screen lg:h-[100dvh] lg:max-h-screen lg:max-h-[100dvh] flex flex-col box-border">
          <div className="bg-[#111111] rounded-[2rem] text-white p-6 sm:p-8 md:p-10 lg:p-12 2xl:p-14 flex-1 flex flex-col relative overflow-hidden shadow-2xl">
            {/* Static Background Image Treatment */}
            <div
              className="absolute inset-0 z-0 bg-cover bg-no-repeat pointer-events-none transition-all duration-300"
              style={{
                backgroundImage: "url('/hero.png')",
                backgroundPosition: "right 6% 40%",
              }}
            />
            {/* Left Vignette for High Contrast & Text Legibility */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#111111] via-[#111111]/80 via-40% to-transparent lg:w-[54%] z-0 pointer-events-none" />
            <div className="absolute inset-0 bg-black/15 z-0 pointer-events-none" />

            {/* Header */}
            <header className="flex items-center justify-between z-10 relative shrink-0">
              <GymBuddyLogo size={36} showText textClassName="text-2xl md:text-3xl text-white" />

              <nav className="hidden lg:flex items-center gap-10 text-lg 2xl:text-xl font-medium text-neutral-400">
                <button
                  onClick={() => setShowcaseVariant("workout")}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  {language === "EN" ? "Features" : "Fitur"}
                </button>
                <button
                  onClick={() => {
                    const el = document.getElementById("ai-journey");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  {language === "EN" ? "How it works" : "Cara Kerja"}
                </button>
                <button
                  onClick={() => setIsPricingPage(true)}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  {language === "EN" ? "Pricing" : "Harga"}
                </button>
                <button
                  onClick={() => {
                    const el = document.getElementById("reviews-section");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  {language === "EN" ? "Reviews" : "Ulasan"}
                </button>
              </nav>

              <div className="flex items-center gap-6 text-base 2xl:text-lg font-semibold">
                <div
                  className="hidden lg:flex bg-neutral-800 rounded-full p-1 cursor-pointer relative"
                  onClick={() => setLanguage((l) => (l === "EN" ? "ID" : "EN"))}
                >
                  <motion.div
                    className="absolute top-1 bottom-1 bg-white rounded-full shadow-sm"
                    style={{ width: "calc(50% - 4px)" }}
                    initial={false}
                    animate={{ left: language === "EN" ? "4px" : "calc(50%)" }}
                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                  />
                  <div
                    className={`relative z-10 px-3 py-1 rounded-full transition-colors ${language === "EN" ? "text-black" : "text-neutral-400 hover:text-white"}`}
                  >
                    EN
                  </div>
                  <div
                    className={`relative z-10 px-3 py-1 rounded-full transition-colors ${language === "ID" ? "text-black" : "text-neutral-400 hover:text-white"}`}
                  >
                    ID
                  </div>
                </div>
                {isLoggedIn ? (
                  <>
                    <button
                      onClick={() => setViewMode(viewMode === "dashboard" ? "landing" : "dashboard")}
                      className="hidden lg:block text-[#D4FF00] hover:text-white font-extrabold cursor-pointer px-4 py-2 rounded-full hover:bg-neutral-800 transition-colors border border-[#D4FF00]/30"
                    >
                      {viewMode === "dashboard" ? (language === "EN" ? "Landing Page" : "Halaman Utama") : "Dashboard"}
                    </button>
                    <button
                      onClick={handleLogout}
                      className="hidden lg:block text-neutral-400 hover:text-red-400 font-semibold cursor-pointer px-3 py-2 rounded-full hover:bg-neutral-800 transition-colors"
                    >
                      {language === "EN" ? "Log Out" : "Keluar"}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsLoginModalOpen(true)}
                    className="hidden lg:block text-neutral-300 hover:text-white font-semibold cursor-pointer px-4 py-2 rounded-full hover:bg-neutral-800 transition-colors"
                  >
                    {language === "EN" ? "Log In" : "Masuk"}
                  </button>
                )}
                <motion.button
                  whileHover={{
                    scale: 1.03,
                    boxShadow: "0 0 24px rgba(212,255,0,0.4)",
                  }}
                  transition={{ duration: 0.2 }}
                  onClick={() => {
                    if (isLoggedIn) {
                      setViewMode("dashboard");
                    } else {
                      setIsAppOnboarding(true);
                    }
                  }}
                  className="hidden lg:block bg-[#D4FF00] text-black px-6 py-3 rounded-full hover:bg-[#c4ec00] transition-colors cursor-pointer font-bold"
                >
                  {isLoggedIn ? (language === "EN" ? "My Dashboard" : "Buka Dashboard") : (language === "EN" ? "Try for free" : "Coba Gratis")}
                </motion.button>
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="lg:hidden text-white p-2 cursor-pointer"
                >
                  <Menu size={28} />
                </button>
              </div>
            </header>

            {/* Mobile Dropdown Menu */}
            <AnimatePresence>
              {mobileMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="lg:hidden absolute top-20 left-6 right-6 z-50 bg-[#161C28] border border-neutral-800 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 text-white"
                >
                  <button
                    onClick={() => {
                      setShowcaseVariant("workout");
                      setMobileMenuOpen(false);
                    }}
                    className="text-left py-2 text-base font-bold text-neutral-200 hover:text-[#D4FF00]"
                  >
                    {language === "EN" ? "Features (Workout & Nutrition AI)" : "Fitur (Workout & Nutrition AI)"}
                  </button>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      const el = document.getElementById("ai-journey");
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="text-left py-2 text-base font-bold text-neutral-200 hover:text-[#D4FF00]"
                  >
                    {language === "EN" ? "How it works" : "Cara Kerja"}
                  </button>
                  <button
                    onClick={() => {
                      setIsPricingPage(true);
                      setMobileMenuOpen(false);
                    }}
                    className="text-left py-2 text-base font-bold text-neutral-200 hover:text-[#D4FF00]"
                  >
                    {language === "EN" ? "Pricing Plans" : "Pilihan Harga"}
                  </button>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      const el = document.getElementById("reviews-section");
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="text-left py-2 text-base font-bold text-neutral-200 hover:text-[#D4FF00]"
                  >
                    {language === "EN" ? "Reviews" : "Ulasan"}
                  </button>
                  <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
                    <span className="text-xs font-mono text-neutral-400">Language / Bahasa</span>
                    <button
                      onClick={() => setLanguage((l) => (l === "EN" ? "ID" : "EN"))}
                      className="px-3 py-1 rounded-full bg-[#D4FF00] text-black font-extrabold text-xs"
                    >
                      {language}
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setIsLoginModalOpen(true);
                      setMobileMenuOpen(false);
                    }}
                    className="w-full py-3 bg-[#182130] border border-neutral-700 text-white font-extrabold rounded-full text-center mt-2 cursor-pointer hover:border-[#D4FF00]"
                  >
                    {language === "EN" ? "Member Log In" : "Masuk ke Akun Member"}
                  </button>
                  <button
                    onClick={() => {
                      setIsAppOnboarding(true);
                      setMobileMenuOpen(false);
                    }}
                    className="w-full py-3 bg-[#D4FF00] text-black font-extrabold rounded-full text-center mt-1"
                  >
                    {language === "EN" ? "Try for Free" : "Coba Gratis"}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Hero Main Content (Two-Column Desktop: 55% Left, 45% Right) */}
            <div className="my-auto py-2 sm:py-4 lg:py-6 grid grid-cols-1 lg:grid-cols-12 items-center gap-6 lg:gap-8 xl:gap-12 z-10 relative">
              {/* Left Column (55%): Headline, Description, CTA */}
              <div className="lg:col-span-7 xl:col-span-7 2xl:col-span-6 flex flex-col justify-center">
                <h1
                  className="font-['Archivo_Black'] font-normal text-white"
                  style={{
                    fontSize: "clamp(2.75rem, 5.2vw, 5.25rem)",
                    lineHeight: 0.94,
                    letterSpacing: "-0.035em",
                  }}
                >
                  <div className="overflow-hidden">
                    <motion.div
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.6,
                        delay: 0.1,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      {language === "EN" ? "Be healthier." : "Lebih sehat."}
                    </motion.div>
                  </div>
                  <div className="overflow-hidden">
                    <motion.div
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.6,
                        delay: 0.2,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      {language === "EN" ? "Be stronger." : "Lebih kuat."}
                    </motion.div>
                  </div>
                  <div className="overflow-hidden">
                    <motion.div
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.6,
                        delay: 0.3,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      {language === "EN" ? "Be confident." : "Lebih pede."}
                    </motion.div>
                  </div>
                </h1>

                {/* Supporting Hero Messaging */}
                <p className="text-base sm:text-lg xl:text-xl text-neutral-300 font-medium leading-relaxed mt-4 md:mt-5 max-w-lg xl:max-w-xl">
                  {language === "EN"
                    ? "Your personal AI trainer and nutrition coach that adapts to your goals, fitness level, daily habits, and real progress — directly on WhatsApp & Web Dashboard."
                    : "Pelatih AI pribadi & ahli gizi yang beradaptasi dengan target, kemampuan, kebiasaan harian, dan perkembangan tubuhmu — langsung di WhatsApp & Web Dashboard."}
                </p>

                {/* Action Buttons & Microcopy */}
                <div className="flex flex-col items-start gap-3 mt-6 md:mt-7">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 md:gap-4 w-full sm:w-auto">
                    <motion.button
                      whileHover={{
                        scale: 1.03,
                        boxShadow: "0 0 24px rgba(212,255,0,0.4)",
                      }}
                      transition={{ duration: 0.2 }}
                      onClick={() => setIsAppOnboarding(true)}
                      className="bg-[#D4FF00] text-black px-7 py-3.5 2xl:px-9 2xl:py-4 rounded-full font-bold flex items-center justify-center sm:justify-start gap-3 hover:bg-[#c4ec00] transition-colors text-base md:text-lg 2xl:text-xl w-full sm:w-auto group cursor-pointer"
                    >
                      {language === "EN" ? "Start for Free" : "Mulai Gratis"}
                      <div className="bg-black text-white p-1.5 2xl:p-2 rounded-full shrink-0 relative overflow-hidden">
                        <ArrowUpRight
                          size={18}
                          strokeWidth={2.5}
                          className="md:w-5 md:h-5 2xl:w-6 2xl:h-6 transition-transform group-hover:translate-x-[2px] group-hover:-translate-y-[2px]"
                        />
                      </div>
                    </motion.button>

                    <button
                      onClick={() => {
                        const el = document.getElementById("ai-journey");
                        if (el) el.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="border border-white/30 text-white hover:bg-white/10 px-7 py-3.5 2xl:px-9 2xl:py-4 rounded-full font-bold flex items-center justify-center gap-2 transition-all text-base md:text-lg 2xl:text-xl w-full sm:w-auto cursor-pointer"
                    >
                      {language === "EN" ? "See How It Works" : "Lihat Cara Kerja"}
                    </button>
                  </div>

                  <span className="text-neutral-400 text-xs sm:text-sm md:text-base flex items-center gap-2 mt-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-[#D4FF00]"></span>
                    {language === "EN"
                      ? "2-day full free trial • No credit card needed • Active on WhatsApp"
                      : "Uji coba 2 hari penuh • Tanpa kartu kredit • Langsung aktif di WhatsApp"}
                  </span>
                </div>
              </div>

              {/* Right Column: 45% (Hero Visual Counterpart Space) */}
              <div
                className="hidden lg:block lg:col-span-5 xl:col-span-5 2xl:col-span-6 relative h-full min-h-[340px] xl:min-h-[400px] pointer-events-none select-none"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: REAL USP (PERSONAL TRAINER & NUTRITIONIST ON WHATSAPP) */}
        <div className="max-w-[1700px] mx-auto px-4 md:px-6 lg:px-8 pt-12 md:pt-16 lg:pt-20 pb-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-12 items-center">
            {/* Left Text Column: 4 cols */}
            <div className="lg:col-span-4 xl:col-span-4 flex flex-col justify-center">
              <div className="inline-block border-2 border-neutral-800 text-neutral-800 rounded-full px-5 py-2 2xl:px-6 2xl:py-3 text-sm 2xl:text-base font-bold mb-6 cursor-default self-start">
                {language === "EN"
                  ? "PERSONAL TRAINER ON WHATSAPP"
                  : "PELATIH PRIBADI DI WHATSAPP"}
              </div>
              <h2 className="font-['Archivo_Black'] font-normal text-3xl sm:text-4xl md:text-[2.75rem] xl:text-[3.25rem] 2xl:text-[4rem] font-bold tracking-tighter leading-[1.08] mb-6 md:mb-8 text-neutral-900">
                {language === "EN"
                  ? "Personal Trainer & Nutritionist 24/7 Directly in WhatsApp."
                  : "Pelatih Pribadi & Ahli Gizi 24/7 Langsung di WhatsApp."}
              </h2>
              <p className="text-base sm:text-lg xl:text-xl 2xl:text-2xl text-neutral-600 font-medium leading-relaxed max-w-xl">
                {language === "EN"
                  ? "No need to spend millions on gym personal trainers or install complex apps you rarely open. GymBuddy guides your workouts, checks your lifting posture via camera, and calculates meal calories from photos — directly in WhatsApp."
                  : "Gak perlu keluar jutaan rupiah sewa Personal Trainer gym atau ribet install aplikasi baru yang jarang dibuka. GymBuddy memandu program latihanmu (gym atau rumah), mengecek postur gerakan via kamera, dan menghitung kalori makanan lokal dari foto — langsung di chat WhatsApp."}
              </p>
            </div>

            {/* Right Feature Cards Container: 8 cols (4 cols Card 1, 4 cols Card 2) */}
            <div className="lg:col-span-8 xl:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6 xl:gap-8 items-stretch">
              {/* Feature 1 */}
              <div
                onClick={() => {
                  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
                  setShowcaseVariant("workout");
                }}
                className="w-full aspect-[4/5] bg-neutral-200 rounded-[2rem] 2xl:rounded-[3rem] relative overflow-hidden group cursor-pointer bg-cover bg-center hover:scale-[1.015] hover:brightness-105 transition-all duration-300 shadow-md"
                style={{
                  backgroundImage:
                    "url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1470&auto=format&fit=crop')",
                }}
              >
                <div className="absolute top-5 left-5 2xl:top-8 2xl:left-8 bg-white px-4 py-2 2xl:px-6 2xl:py-3 rounded-full font-bold text-xs sm:text-[15px] 2xl:text-lg z-10 shadow-sm text-black">
                  {language === "EN"
                    ? "TRAIN SMARTER"
                    : "LATIHAN LEBIH CERDAS"}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 group-hover:from-black/95 transition-colors z-0"></div>
                <div className="absolute bottom-6 left-6 right-6 2xl:bottom-10 2xl:left-10 2xl:right-10 flex justify-between items-end z-10 gap-3">
                  <div className="flex flex-col">
                    <h3 className="font-['Archivo_Black'] font-normal text-white text-xl sm:text-2xl xl:text-3xl font-bold leading-tight mb-2">
                      {language === "EN"
                        ? "Workouts Built Around Your Real Ability."
                        : "Latihan yang Menyesuaikan Kemampuanmu."}
                    </h3>
                    <p className="text-white/85 text-xs sm:text-sm xl:text-base font-medium leading-relaxed max-w-sm line-clamp-3 sm:line-clamp-none">
                      {language === "EN"
                        ? "No generic templates. Your sets, reps, weight loads, and movement variations automatically adapt to your equipment, schedule, and strength progression."
                        : "Bukan jadwal kaku. Beban, repetisi, dan variasi gerakan otomatis disesuaikan dengan alat yang kamu punya, waktu luang, dan perkembangan kekuatanmu."}
                    </p>
                  </div>
                  <button className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/30 group-hover:scale-110 transition-all shrink-0 mb-1 cursor-pointer">
                    <ArrowUpRight size={18} className="sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>

              {/* Feature 2 */}
              <div
                onClick={() => {
                  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
                  setShowcaseVariant("nutrition");
                }}
                className="w-full aspect-[4/5] bg-neutral-200 rounded-[2rem] 2xl:rounded-[3rem] relative overflow-hidden group cursor-pointer bg-cover bg-center hover:scale-[1.015] hover:brightness-105 transition-all duration-300 shadow-md"
                style={{
                  backgroundImage:
                    "url('https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=1453&auto=format&fit=crop')",
                }}
              >
                <div className="absolute top-5 left-5 2xl:top-8 2xl:left-8 bg-white px-4 py-2 2xl:px-6 2xl:py-3 rounded-full font-bold text-xs sm:text-[15px] 2xl:text-lg z-10 shadow-sm text-black">
                  {language === "EN" ? "EAT BETTER" : "NUTRISI LEBIH TEPAT"}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 group-hover:from-black/95 transition-colors z-0"></div>
                <div className="absolute bottom-6 left-6 right-6 2xl:bottom-10 2xl:left-10 2xl:right-10 flex justify-between items-end z-10 gap-3">
                  <div className="flex flex-col">
                    <h3 className="font-['Archivo_Black'] font-normal text-white text-xl sm:text-2xl xl:text-3xl font-bold leading-tight mb-2">
                      {language === "EN"
                        ? "Master Daily Nutrition Without Tedious Weighing."
                        : "Pahami Nutrisi Harian Tanpa Ribet Nimbang."}
                    </h3>
                    <p className="text-white/85 text-xs sm:text-sm xl:text-base font-medium leading-relaxed max-w-sm line-clamp-3 sm:line-clamp-none">
                      {language === "EN"
                        ? "Simply snap a meal photo on WhatsApp for instant calorie and macro estimates. Receive personalized meal suggestions to hit your daily protein targets without stress."
                        : "Cukup kirim foto makanan di WhatsApp untuk estimasi kalori dan makro instan. Dapatkan saran menu berikutnya agar target protein harianmu selalu tercapai."}
                    </p>
                  </div>
                  <button className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/30 group-hover:scale-110 transition-all shrink-0 mb-1 cursor-pointer">
                    <ArrowUpRight size={18} className="sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: REAL APP USP & CAPABILITIES (BENTO GRID) */}
        <div className="px-4 md:px-6 lg:px-8 py-8 md:py-12 lg:py-16">
          <div className="bg-[#151515] rounded-[2.5rem] 2xl:rounded-[3.5rem] p-6 md:p-10 lg:p-12 text-white shadow-2xl">
            
            {/* Section Header: Real USP */}
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 md:mb-10 gap-4">
              <div>
                <div className="inline-flex items-center gap-2 border border-neutral-700 bg-neutral-800/80 text-[#D4FF00] rounded-full px-4 py-1.5 text-xs md:text-sm font-bold mb-3 cursor-default">
                  {language === "EN" ? "WHY GYMBUDDY?" : "KENAPA GYMBUDDY?"}
                </div>
                <h3 className="font-['Archivo_Black'] font-normal text-2xl sm:text-3xl md:text-4xl 2xl:text-5xl text-white tracking-tight leading-tight">
                  {language === "EN"
                    ? "All Your Fitness Coaching, Right Inside WhatsApp."
                    : "Semua Kebutuhan Fitnesmu, Langsung di WhatsApp."}
                </h3>
              </div>
              <p className="text-neutral-400 text-sm md:text-base 2xl:text-lg max-w-md font-medium">
                {language === "EN"
                  ? "From Indonesian meal photo calorie tracking to lifting form check, your personal coach is on standby 24/7 without expensive personal trainers."
                  : "Dari hitung kalori masakan lokal hingga koreksi teknik gerakan, semua standby 24/7 tanpa perlu sewa Personal Trainer mahal."}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 grid-flow-row-dense gap-4 md:gap-5 2xl:gap-6 auto-rows-[160px] md:auto-rows-[180px] 2xl:auto-rows-[220px]">
              {/* Box 1: PHOTO FOOD TRACKING */}
              <div className="bg-[#222222] rounded-[2rem] 2xl:rounded-[2.5rem] p-8 2xl:p-10 flex flex-col justify-center col-span-1 md:col-span-2 lg:col-span-2 xl:col-span-2 hover:bg-[#2a2a2a] transition-colors">
                <div className="flex gap-6 items-center">
                  <Flame
                    size={52}
                    className="text-[#D4FF00] shrink-0 2xl:w-16 2xl:h-16"
                    strokeWidth={1.5}
                  />
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#D4FF00] block mb-1">
                      {language === "EN" ? "PHOTO FOOD TRACKING" : "HITUNG KALORI FOTO WA"}
                    </span>
                    <p className="text-lg sm:text-xl 2xl:text-2xl font-medium leading-snug">
                      {language === "EN"
                        ? "Snap any meal on WhatsApp. Instant calorie, protein & macro estimate without weighing."
                        : "Foto piring makanmu di WhatsApp. Kalori & protein terhitung instan tanpa timbang manual."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Center Image */}
              <div className="bg-[#222222] rounded-[2rem] 2xl:rounded-[2.5rem] col-span-1 md:col-span-2 lg:col-span-2 xl:col-span-2 row-span-2 lg:row-span-2 xl:row-span-3 relative overflow-hidden flex items-center justify-center group order-first md:order-none">
                <div
                  className="absolute inset-0 bg-neutral-800 transition-transform duration-700 group-hover:scale-105 bg-cover bg-center"
                  style={{
                    backgroundImage:
                      "url('https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=2000&auto=format&fit=crop')",
                  }}
                >
                  <div className="absolute inset-0 bg-black/40"></div>
                </div>
                <div className="z-10 flex items-center justify-center p-4">
                  <GymBuddyLogo size={160} transparentBg className="drop-shadow-[0_10px_35px_rgba(0,0,0,0.8)] md:scale-125 xl:scale-150" />
                </div>
              </div>

              {/* Box 3: COACH PERSONA */}
              <div className="bg-[#222222] rounded-[2rem] 2xl:rounded-[2.5rem] p-6 2xl:p-8 flex flex-col items-center justify-center gap-2 col-span-1 hover:bg-[#2a2a2a] transition-colors text-center">
                <Sparkles
                  size={40}
                  className="text-[#D4FF00] 2xl:w-12 2xl:h-12"
                  strokeWidth={1.5}
                />
                <span className="font-bold text-base 2xl:text-lg text-white">
                  Coach Mia & Max
                </span>
                <span className="text-[11px] text-neutral-400 font-medium leading-tight">
                  {language === "EN" ? "Choose supportive or disciplined style" : "Pilih ramah suportif atau tegas disiplin"}
                </span>
              </div>

              {/* Box 4: VISION AI FORM CHECK */}
              <div className="bg-[#222222] rounded-[2rem] 2xl:rounded-[2.5rem] p-6 2xl:p-8 flex flex-col items-center justify-center gap-2 col-span-1 hover:bg-[#2a2a2a] transition-colors text-center">
                <ShieldCheck
                  size={40}
                  className="text-[#D4FF00] 2xl:w-12 2xl:h-12"
                  strokeWidth={1.5}
                />
                <span className="text-xs font-bold uppercase tracking-wider text-[#D4FF00]">
                  VISION AI
                </span>
                <span className="font-medium text-base 2xl:text-lg text-neutral-200 leading-snug">
                  {language === "EN" ? "Camera Form Check" : "Koreksi Postur Kamera"}
                </span>
              </div>

              {/* Box 5: CUSTOM WORKOUTS */}
              <div className="bg-[#222222] rounded-[2rem] 2xl:rounded-[2.5rem] p-8 2xl:p-10 flex flex-col justify-center col-span-1 md:col-span-2 lg:col-span-2 xl:col-span-2 hover:bg-[#2a2a2a] transition-colors">
                <div className="flex gap-6 items-center">
                  <Dumbbell
                    size={52}
                    className="text-[#D4FF00] shrink-0 2xl:w-16 2xl:h-16"
                    strokeWidth={1.5}
                  />
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#D4FF00] block mb-1">
                      {language === "EN" ? "CUSTOM WORKOUTS" : "LATIHAN GYM & RUMAH"}
                    </span>
                    <p className="text-lg sm:text-xl 2xl:text-2xl font-medium leading-snug">
                      {language === "EN"
                        ? "Personalized training plans built around your equipment and injury limitations."
                        : "Program latihan personal yang disesuaikan dengan alat yang ada dan bebas cedera."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Box 6: 24/7 WHATSAPP ACCOUNTABILITY */}
              <div className="bg-[#222222] rounded-[2rem] 2xl:rounded-[2.5rem] p-8 2xl:p-10 flex flex-col justify-center col-span-1 md:col-span-2 lg:col-span-2 xl:col-span-2 hover:bg-[#2a2a2a] transition-colors">
                <div className="flex gap-6 items-center">
                  <MessageSquare
                    size={52}
                    className="text-[#D4FF00] 2xl:w-16 2xl:h-16 shrink-0"
                    strokeWidth={1.5}
                  />
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#D4FF00] block mb-1">
                      {language === "EN" ? "WHATSAPP ACCOUNTABILITY" : "AKUNTABILITAS DI WA"}
                    </span>
                    <p className="text-lg sm:text-xl 2xl:text-2xl font-medium leading-snug">
                      {language === "EN"
                        ? "Never forgotten. Your coach follows up on WhatsApp with hydration and workout reminders."
                        : "Bukan aplikasi yang dilupakan. Coach selalu mengingatkan jadwal latihan & target air di WA."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Box 7: COST SAVINGS */}
              <div className="bg-[#222222] rounded-[2rem] 2xl:rounded-[2.5rem] p-6 2xl:p-8 flex flex-col items-center justify-center gap-1 col-span-1 hover:bg-[#2a2a2a] transition-colors text-center">
                <span className="text-3xl sm:text-4xl 2xl:text-5xl font-['Archivo_Black'] tracking-tighter text-[#D4FF00]">
                  HEMAT 95%
                </span>
                <span className="text-xs 2xl:text-sm font-medium leading-tight text-neutral-300">
                  {language === "EN" ? "vs gym trainers (Rp 2-5M/mo)" : "vs PT gym (Rp 2-5jt/bln)"}
                </span>
              </div>

              {/* Box 8: WEB DASHBOARD SYNC */}
              <div className="bg-[#222222] rounded-[2rem] 2xl:rounded-[2.5rem] p-6 2xl:p-8 flex flex-col items-center justify-center col-span-1 hover:bg-[#2a2a2a] transition-colors text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1">
                  {language === "EN" ? "WEB DASHBOARD" : "WEB DASHBOARD"}
                </span>
                <p className="text-sm 2xl:text-base font-semibold leading-snug text-neutral-200">
                  {language === "EN"
                    ? "Live Sync with Web Dashboard"
                    : "Sync Real-Time ke Web Dashboard"}
                </p>
              </div>

              {/* Box 9: ZERO APP DOWNLOAD */}
              <div className="bg-[#222222] rounded-[2rem] 2xl:rounded-[2.5rem] p-6 2xl:p-8 flex flex-col items-center justify-center col-span-1 hover:bg-[#2a2a2a] transition-colors text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1">
                  {language === "EN" ? "NO NEW APP" : "PRAKTIS"}
                </span>
                <p className="text-sm 2xl:text-base font-semibold leading-snug text-neutral-200">
                  {language === "EN"
                    ? "100% Inside WhatsApp"
                    : "100% di WhatsApp"}
                </p>
              </div>

              {/* Box 10: 2-DAY FREE TRIAL */}
              <div className="bg-[#222222] rounded-[2rem] 2xl:rounded-[2.5rem] p-6 2xl:p-8 flex flex-col items-center justify-center col-span-1 hover:bg-[#2a2a2a] transition-colors text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-[#D4FF00] mb-1">
                  {language === "EN" ? "RISK FREE" : "FREE TRIAL"}
                </span>
                <span className="text-xl 2xl:text-2xl font-['Archivo_Black'] font-normal tracking-tight text-white leading-tight">
                  {language === "EN" ? "2-Day Free Trial" : "Coba Gratis 2 Hari"}
                </span>
              </div>
            </div>
          </div>
        </div>
        {/* SECTION 4: HOW IT WORKS (DYNAMIC ADAPTIVE JOURNEY) */}
        <div id="ai-journey" className="px-4 md:px-6 lg:px-8 py-0 w-full flex flex-col overflow-hidden relative">
          <div className="flex flex-col md:flex-row md:items-end justify-between text-left mb-8 2xl:mb-12 gap-6">
            <div>
              <div className="inline-flex items-center gap-2 border border-black bg-white text-neutral-800 rounded-full px-4 py-1.5 2xl:px-5 2xl:py-2 text-xs md:text-sm 2xl:text-base font-bold mb-4 cursor-default">
                {language === "EN" ? "HOW IT WORKS" : "CARA KERJA"}
              </div>
              <h2 className="font-['Archivo_Black'] font-normal text-3xl sm:text-4xl md:text-5xl 2xl:text-[4rem] tracking-tighter leading-[0.95] mb-3 text-neutral-900">
                {language === "EN"
                  ? "Your Plan Changes As You Change."
                  : "Rencanamu Berkembang Seiring Perkembanganmu."}
              </h2>
              <p className="text-base md:text-lg 2xl:text-xl text-neutral-600 font-medium max-w-xl">
                {language === "EN"
                  ? "GymBuddy is not a static PDF or rigid routine. Every workout and nutrition tip dynamically responds to your real daily progress."
                  : "GymBuddy bukan jadwal kaku. Setiap sesi latihan dan saran nutrisi merespons progres harian serta kebiasaan nyatamu."}
              </p>
            </div>
            <button
              onClick={() => setIsAppOnboarding(true)}
              className="inline-flex items-center justify-center gap-2 bg-neutral-900 text-white rounded-full px-6 py-3 md:px-8 md:py-4 font-bold text-sm 2xl:text-base hover:bg-black transition-colors self-start md:self-end cursor-pointer"
            >
              {language === "EN" ? "Start for Free" : "Mulai Gratis"}
              <div className="w-6 h-6 rounded-full bg-[#D4FF00] flex items-center justify-center text-black ml-2">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-4 h-[650px] md:h-[500px] xl:h-[600px] 2xl:h-[700px] min-[1920px]:h-[800px]">
            {[
              {
                id: 1,
                step: "01",
                title:
                  language === "EN" ? "Set Your Goal" : "Tentukan Tujuanmu",
                desc:
                  language === "EN"
                    ? "Share your fitness target (fat loss, muscle gain, stamina), current experience, equipment, and any physical limits. GymBuddy sets your baseline."
                    : "Tentukan tujuan kebugaran (turunkan lemak, bentuk otot, stamina), level saat ini, peralatan yang ada, dan riwayat cedera. GymBuddy menyusun profil unikmu.",
                image:
                  "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=2070&auto=format&fit=crop",
                Icon: Target,
              },
              {
                id: 2,
                step: "02",
                title:
                  language === "EN" ? "GymBuddy Builds Your Blueprint" : "GymBuddy Membuat Rencana",
                desc:
                  language === "EN"
                    ? "Our AI generates a realistic, personalized weekly workout plan and daily macro targets designed around your schedule."
                    : "Algoritma AI merancang jadwal latihan mingguan dan target makronutrisi harian yang realistis sesuai waktu luangmu.",
                image:
                  "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=2000&auto=format&fit=crop",
                Icon: Dumbbell,
              },
              {
                id: 3,
                step: "03",
                title:
                  language === "EN" ? "Execute Workouts & Nutrition" : "Jalankan Latihan & Nutrisi",
                desc:
                  language === "EN"
                    ? "Train with clear audio guidance, then log meals simply by sending a WhatsApp photo for instant calorie and macro breakdown."
                    : "Latihan dengan instruksi gerakan yang aman, lalu catat makanan semudah kirim foto di WhatsApp untuk estimasi kalori dan makro instan.",
                image:
                  "https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=1453&auto=format&fit=crop",
                Icon: Leaf,
              },
              {
                id: 4,
                step: "04",
                title:
                  language === "EN"
                    ? "Track Progress & Adapt Dynamically"
                    : "Pantau Progres & Adaptasi",
                desc:
                  language === "EN"
                    ? "As your strength builds or life happens, GymBuddy automatically recalculates exercise weights, reps, and next meal recommendations."
                    : "Saat kekuatanmu meningkat atau jadwalmu berubah, GymBuddy otomatis menyesuaikan beban latihan dan rekomendasi makanan berikutnya.",
                image:
                  "https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=2070&auto=format&fit=crop",
                Icon: HeartPulse,
              },
            ].map((item) => {
              const isActive = activeStep === item.id;

              return (
                <div
                  key={item.id}
                  className={`relative rounded-[1.5rem] md:rounded-[2rem] overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] cursor-pointer group flex flex-col ${isActive ? "md:flex-[3] flex-[4] bg-[#F0F0F0]" : "md:flex-1 flex-[0.8] bg-[#F0F0F0] hover:bg-[#EAEAEA] hover:ring-2 hover:ring-[#D4FF00]/50"}`}
                  onClick={() => setActiveStep(item.id)}
                >
                  {isActive ? (
                    // Expanded State
                    <div className="w-full h-full flex flex-col animate-in fade-in duration-500">
                      <div className="relative w-full h-[50%] md:h-[60%] shrink-0">
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-full h-full object-cover object-top"
                        />
                        <div className="absolute -bottom-5 left-6 bg-[#D4FF00] w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-black shadow-lg">
                          <item.Icon
                            className="w-5 h-5 md:w-6 md:h-6"
                            strokeWidth={2.5}
                          />
                        </div>
                      </div>
                      <div className="p-6 pt-10 md:p-8 md:pt-12 flex flex-col justify-start flex-grow">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-neutral-500 tracking-wider text-xs md:text-sm">
                            STEP {item.step}
                          </span>
                        </div>
                        <h3 className="font-['Archivo_Black'] font-normal text-2xl md:text-3xl text-black tracking-tight leading-none mb-3 md:mb-4">
                          {item.title}
                        </h3>
                        <p className="text-neutral-600 text-base md:text-lg 2xl:text-xl font-medium leading-relaxed max-w-2xl">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  ) : (
                    // Collapsed State
                    <div className="w-full h-full flex md:flex-col items-center justify-between py-6 px-4 md:py-10">
                      <span className="hidden md:block text-4xl md:text-5xl text-black/5 opacity-50 select-none">
                        {item.step}.
                      </span>

                      <div className="flex md:flex-col items-center gap-4 md:gap-6 w-full justify-between md:justify-end md:mt-auto">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-neutral-800 group-hover:border-[#D4FF00] group-hover:bg-[#D4FF00]/10 group-hover:text-black transition-colors shrink-0">
                          <item.Icon
                            className="w-4 h-4 md:w-5 md:h-5"
                            strokeWidth={2}
                          />
                        </div>
                        <h3 className="font-['Archivo_Black'] font-normal hidden md:block text-lg md:text-xl text-black tracking-tight [writing-mode:vertical-rl] rotate-180 text-center select-none whitespace-nowrap">
                          {item.title}
                        </h3>
                        <h3 className="font-['Archivo_Black'] font-normal md:hidden text-lg text-black tracking-tight text-center select-none truncate">
                          {item.step}. {item.title}
                        </h3>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 5: PRICING (DECISION ARCHITECTURE) */}
        <div className="px-4 md:px-6 lg:px-8 py-8 md:py-12 lg:py-16">
          <div className="w-full bg-[#0D0D0D] rounded-[2rem] 2xl:rounded-[3rem] py-16 md:py-24 lg:py-32 px-6 md:px-10 lg:px-12 relative overflow-hidden flex flex-col">
            <div className="w-full mb-10 md:mb-14">
              <div className="inline-flex items-center gap-2 border border-neutral-700 bg-neutral-800/80 text-neutral-300 rounded-full px-4 py-1.5 text-xs md:text-sm font-bold mb-4 cursor-default">
                {language === "EN" ? "TRANSPARENT PRICING" : "BIAYA TRANSPARAN"}
              </div>
              <h2 className="font-['Archivo_Black'] font-normal text-3xl md:text-5xl lg:text-6xl 2xl:text-7xl uppercase tracking-tighter leading-[1] md:leading-[0.95] text-white">
                {language === "EN" ? (
                  <>
                    MEMBERSHIP PLANS BUILT
                    <br /> FOR YOUR GOALS
                  </>
                ) : (
                  <>
                    PILIHAN PAKET SESUAI
                    <br /> TARGET DAN KEBUTUHANMU
                  </>
                )}
              </h2>
              <p className="text-neutral-400 text-base md:text-lg 2xl:text-xl font-medium mt-3 max-w-xl">
                {language === "EN"
                  ? "Clear pricing. No hidden costs. Start with a risk-free 2-day trial."
                  : "Biaya jelas tanpa biaya tersembunyi. Mulai gratis 2 hari tanpa risiko."}
              </p>
            </div>

            {/* DURATION SELECTION TABS */}
            <div className="flex flex-wrap items-center justify-center gap-2 bg-[#1A1A1A] p-2 rounded-2xl border border-neutral-800 max-w-2xl mx-auto mb-10">
              {(["1m", "3m", "6m", "1y", "lifetime"] as const).map((durKey) => {
                const isSelected = selectedPricingDuration === durKey;
                const cfg = durationPricingConfig[durKey];
                const label = language === "EN" ? cfg.labelEN : cfg.labelID;

                return (
                  <button
                    key={durKey}
                    onClick={() => setSelectedPricingDuration(durKey)}
                    className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer relative flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-[#D4FF00] text-black shadow-lg shadow-[#D4FF00]/20 scale-105"
                        : "text-neutral-400 hover:text-white hover:bg-neutral-800/80"
                    }`}
                  >
                    <span>{label}</span>
                    {cfg.badge && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                          isSelected
                            ? "bg-black text-[#D4FF00]"
                            : "bg-neutral-800 text-neutral-300"
                        }`}
                      >
                        {cfg.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 3 REAL PRICING PLANS GRID */}
            {(() => {
              const currentPrice = durationPricingConfig[selectedPricingDuration];
              const singlePrice = language === "EN" ? currentPrice.singleUSD : currentPrice.singleIDR;
              const premiumPrice = language === "EN" ? currentPrice.premiumUSD : currentPrice.premiumIDR;
              const periodText = language === "EN" ? currentPrice.periodEN : currentPrice.periodID;
              const subNoteText = language === "EN" ? currentPrice.subNoteEN : currentPrice.subNoteID;

              return (
                <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch mb-8">
                  {/* CARD 1: ADVANCED - AI NUTRITIONIST */}
                  <div className="bg-[#151515] rounded-3xl p-6 md:p-8 flex flex-col justify-between border border-neutral-800 hover:border-neutral-700 transition-all shadow-xl">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
                            🥗 {language === "EN" ? "NUTRITION SPECIALIST" : "SPESIALISASI NUTRISI"}
                          </span>
                          <h3 className="font-['Archivo_Black'] font-normal tracking-tighter text-2xl 2xl:text-3xl text-white">
                            Advanced: AI Nutritionist
                          </h3>
                        </div>
                      </div>

                      <p className="text-neutral-400 text-xs sm:text-sm font-medium mb-6">
                        {language === "EN"
                          ? "Focused 100% on meal photo tracking, daily macros & deficit coaching in WhatsApp."
                          : "Fokus 100% pada hitung kalori masakan harian via foto WhatsApp & bimbingan gizi."}
                      </p>

                      <div className="mb-6 pb-6 border-b border-neutral-800">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-['Archivo_Black'] font-normal tracking-tighter leading-none text-4xl 2xl:text-5xl text-white">
                            {singlePrice}
                          </span>
                          <span className="text-neutral-400 text-sm font-semibold">
                            {periodText}
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-400 font-bold mt-1.5">
                          {subNoteText}
                        </p>
                      </div>

                      <ul className="space-y-3.5 mb-8">
                        <li className="flex items-start gap-3">
                          <Check className="text-[#D4FF00] shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                          <span className="font-medium text-xs sm:text-sm text-neutral-200">
                            {language === "EN"
                              ? "Dedicated AI Nutritionist Persona (Coach Mia)"
                              : "Persona Coach Mia (Ahli Gizi AI Pribadi di WhatsApp)"}
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <Check className="text-[#D4FF00] shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                          <span className="font-medium text-xs sm:text-sm text-neutral-200">
                            {language === "EN"
                              ? "Photo Food Logging & Instant Macro Breakdown (Local Foods)"
                              : "Foto Makanan: Hitung Kalori & Makro Otomatis (Masakan Lokal)"}
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <Check className="text-[#D4FF00] shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                          <span className="font-medium text-xs sm:text-sm text-neutral-200">
                            {language === "EN"
                              ? "BMR, TDEE & Smart Deficit/Surplus Recommendations"
                              : "Kalkulator BMR, TDEE, & Rekomendasi Menu Defisit/Surplus"}
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <Check className="text-[#D4FF00] shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                          <span className="font-medium text-xs sm:text-sm text-neutral-200">
                            {language === "EN"
                              ? "Daily WhatsApp Nutrition Summary & Hydration Cues"
                              : "Rekap Nutrisi Harian & Pengingat Hidrasi di WhatsApp"}
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <Check className="text-[#D4FF00] shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                          <span className="font-medium text-xs sm:text-sm text-neutral-200">
                            {language === "EN"
                              ? "Unlimited Daily Meal Logs & 24/7 Nutrition Consultation"
                              : "Unlimited Log Makanan & Konsultasi Nutrisi 24/7"}
                          </span>
                        </li>
                      </ul>
                    </div>

                    <button
                      onClick={() => {
                        if (isLoggedIn) setViewMode("dashboard");
                        else setIsPricingPage(true);
                      }}
                      className="w-full py-3.5 2xl:py-4 rounded-full font-bold text-sm 2xl:text-base bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 hover:border-neutral-500 transition-all cursor-pointer"
                    >
                      {isLoggedIn
                        ? (language === "EN" ? "Open Dashboard" : "Buka Dashboard")
                        : (language === "EN" ? `Choose Nutritionist (${singlePrice})` : `Pilih AI Nutritionist (${singlePrice})`)}
                    </button>
                  </div>

                  {/* CARD 2: ADVANCED - AI WORKOUT COACH */}
                  <div className="bg-[#151515] rounded-3xl p-6 md:p-8 flex flex-col justify-between border border-neutral-800 hover:border-neutral-700 transition-all shadow-xl">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
                            ⚡ {language === "EN" ? "WORKOUT SPECIALIST" : "SPESIALISASI LATIHAN"}
                          </span>
                          <h3 className="font-['Archivo_Black'] font-normal tracking-tighter text-2xl 2xl:text-3xl text-white">
                            Advanced: AI Workout Coach
                          </h3>
                        </div>
                      </div>

                      <p className="text-neutral-400 text-xs sm:text-sm font-medium mb-6">
                        {language === "EN"
                          ? "Focused 100% on gym/home workouts, machine guides & camera form checks."
                          : "Fokus 100% pada program gym/rumah, cek postur kamera, & progressive overload."}
                      </p>

                      <div className="mb-6 pb-6 border-b border-neutral-800">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-['Archivo_Black'] font-normal tracking-tighter leading-none text-4xl 2xl:text-5xl text-white">
                            {singlePrice}
                          </span>
                          <span className="text-neutral-400 text-sm font-semibold">
                            {periodText}
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-400 font-bold mt-1.5">
                          {subNoteText}
                        </p>
                      </div>

                      <ul className="space-y-3.5 mb-8">
                        <li className="flex items-start gap-3">
                          <Check className="text-[#D4FF00] shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                          <span className="font-medium text-xs sm:text-sm text-neutral-200">
                            {language === "EN"
                              ? "Dedicated AI Workout Coach Persona (Coach Max)"
                              : "Persona Coach Max (Pelatih Kebugaran AI Pribadi di WA)"}
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <Check className="text-[#D4FF00] shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                          <span className="font-medium text-xs sm:text-sm text-neutral-200">
                            {language === "EN"
                              ? "Custom Gym & Home Workout Routine (Tailored to Equipment)"
                              : "Program Latihan Custom Gym & Rumah (Sesuai Alat)"}
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <Check className="text-[#D4FF00] shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                          <span className="font-medium text-xs sm:text-sm text-neutral-200">
                            {language === "EN"
                              ? "Camera Pose & Exercise Form Check (Vision AI)"
                              : "Form & Technique Check via Kamera HP (Vision AI Pose)"}
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <Check className="text-[#D4FF00] shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                          <span className="font-medium text-xs sm:text-sm text-neutral-200">
                            {language === "EN"
                              ? "Progressive Overload Tracking & Injury-Safe Adjustments"
                              : "Panduan Beban Progressive Overload & Batas Cedera"}
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <Check className="text-[#D4FF00] shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                          <span className="font-medium text-xs sm:text-sm text-neutral-200">
                            {language === "EN"
                              ? "Real-time Training Schedule Sync with Web Dashboard"
                              : "Sinkronisasi Jadwal Latihan Real-Time ke Web Dashboard"}
                          </span>
                        </li>
                      </ul>
                    </div>

                    <button
                      onClick={() => {
                        if (isLoggedIn) setViewMode("dashboard");
                        else setIsPricingPage(true);
                      }}
                      className="w-full py-3.5 2xl:py-4 rounded-full font-bold text-sm 2xl:text-base bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 hover:border-neutral-500 transition-all cursor-pointer"
                    >
                      {isLoggedIn
                        ? (language === "EN" ? "Open Dashboard" : "Buka Dashboard")
                        : (language === "EN" ? `Choose Workout Coach (${singlePrice})` : `Pilih AI Workout Coach (${singlePrice})`)}
                    </button>
                  </div>

                  {/* CARD 3: PREMIUM ALL-ACCESS (HERO CARD) */}
                  <div className="bg-[#181818] rounded-3xl p-6 md:p-8 flex flex-col justify-between border-2 border-[#D4FF00] shadow-2xl relative lg:-translate-y-2">
                    <div className="absolute top-0 right-8 -translate-y-1/2 bg-[#D4FF00] text-black text-[10px] md:text-xs font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full shadow-md flex items-center gap-1.5">
                      <Crown className="w-3.5 h-3.5" />
                      <span>{language === "EN" ? "Best Value • Most Popular" : "Paling Laris • Best Value"}</span>
                    </div>

                    <div>
                      <div className="flex justify-between items-start mb-4 mt-2">
                        <div>
                          <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#D4FF00] block mb-1">
                            👑 {language === "EN" ? "ALL-ACCESS BUNDLE" : "PAKET LENGKAP 2 AI"}
                          </span>
                          <h3 className="font-['Archivo_Black'] font-normal tracking-tighter text-2xl 2xl:text-3xl text-white">
                            {language === "EN" ? "Premium All-Access" : "Paket Premium All-Access"}
                          </h3>
                        </div>
                      </div>

                      <p className="text-neutral-300 text-xs sm:text-sm font-medium mb-6">
                        {language === "EN"
                          ? "Both AI coaches active simultaneously in WhatsApp for complete physique transformation."
                          : "Kedua AI aktif bersamaan di WhatsApp: Nutrisi + Workout Coach untuk hasil maksimal tanpa kompromi."}
                      </p>

                      <div className="mb-6 pb-6 border-b border-neutral-800">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-['Archivo_Black'] font-normal tracking-tighter leading-none text-4xl 2xl:text-5xl text-[#D4FF00]">
                            {premiumPrice}
                          </span>
                          <span className="text-neutral-300 text-sm font-semibold">
                            {periodText}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#D4FF00] font-bold mt-1.5">
                          {subNoteText}
                        </p>
                      </div>

                      <ul className="space-y-3.5 mb-8">
                        <li className="flex items-start gap-3">
                          <Check className="text-[#D4FF00] shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                          <span className="font-bold text-xs sm:text-sm text-white">
                            {language === "EN"
                              ? "Everything in Nutritionist & Workout Coach Included"
                              : "Semua Fitur di Paket AI Nutritionist & AI Workout Coach"}
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <Check className="text-[#D4FF00] shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                          <span className="font-medium text-xs sm:text-sm text-neutral-200">
                            {language === "EN"
                              ? "Both AI Coaches Active Simultaneously 24/7 on WhatsApp"
                              : "2 AI Coach Aktif Sekaligus 24/7 di Nomor WhatsApp Anda"}
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <Check className="text-[#D4FF00] shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                          <span className="font-medium text-xs sm:text-sm text-neutral-200">
                            {language === "EN"
                              ? "Gemini Pro Vision AI: Food Recognition & Camera Form Check"
                              : "Presisi Tinggi Gemini Pro Vision AI (Foto Makanan & Form Check)"}
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <Check className="text-[#D4FF00] shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                          <span className="font-medium text-xs sm:text-sm text-neutral-200">
                            {language === "EN"
                              ? "Visual Infographic Poster Generation & Workout Logs"
                              : "Generasi Poster Infografis Latihan & Rekap Nutrisi"}
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <Check className="text-[#D4FF00] shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                          <span className="font-medium text-xs sm:text-sm text-neutral-200">
                            {language === "EN"
                              ? "Recovery Intelligence & Weekly Fatigue Balance"
                              : "Kecerdasan Pemulihan & Evaluasi Beban Mingguan"}
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <Check className="text-[#D4FF00] shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                          <span className="font-medium text-xs sm:text-sm text-neutral-200">
                            {language === "EN"
                              ? "Priority Fast-Track Response 24/7 & Full Web Dashboard Sync"
                              : "Respon Cepat Prioritas 24/7 & Sync Real-Time Web Dashboard"}
                          </span>
                        </li>
                      </ul>
                    </div>

                    <button
                      onClick={() => {
                        if (isLoggedIn) setViewMode("dashboard");
                        else setIsPricingPage(true);
                      }}
                      className="w-full py-3.5 2xl:py-4 rounded-full font-black text-sm 2xl:text-base bg-[#D4FF00] text-black hover:bg-[#c4ec00] hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[#D4FF00] focus:ring-offset-2 focus:ring-offset-black transition-all cursor-pointer shadow-lg shadow-[#D4FF00]/20"
                    >
                      {isLoggedIn
                        ? (language === "EN" ? "Open Dashboard" : "Buka Dashboard")
                        : (language === "EN" ? `Choose Premium All-Access (${premiumPrice})` : `Pilih Paket Premium All-Access (${premiumPrice})`)}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* 2-DAY FREE TRIAL BANNER */}
            <div className="w-full bg-[#161616] border border-neutral-800 rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-5 mt-2">
              <div className="flex items-start sm:items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-[#D4FF00]/10 border border-[#D4FF00]/30 flex items-center justify-center text-[#D4FF00] shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#D4FF00] animate-pulse"></span>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#D4FF00]">
                      {language === "EN" ? "Risk-Free Trial" : "Uji Coba Gratis"}
                    </span>
                  </div>
                  <h4 className="text-base sm:text-lg font-bold text-white mt-0.5">
                    {language === "EN"
                      ? "Not ready to commit? Start with a 2-Day Full Access Free Trial."
                      : "Belum yakin ingin ambil paket apa? Mulai dulu 2 Hari Gratis Penuh."}
                  </h4>
                  <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-2xl">
                    {language === "EN"
                      ? "Experience photo meal tracking and WhatsApp AI coaching directly on your phone. No credit card required, instant setup."
                      : "Rasakan kemudahan foto makanan dan bimbingan coach AI langsung di nomor WhatsApp Anda. Tanpa kartu kredit, langsung aktif seketika."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
                <button
                  onClick={() => {
                    if (isLoggedIn) setViewMode("dashboard");
                    else setIsAppOnboarding(true);
                  }}
                  className="flex-1 md:flex-none px-6 py-3 rounded-full font-bold text-xs sm:text-sm bg-white text-black hover:bg-neutral-200 transition-colors cursor-pointer text-center whitespace-nowrap"
                >
                  {isLoggedIn
                    ? (language === "EN" ? "Open Dashboard" : "Buka Dashboard")
                    : (language === "EN" ? "Start Free Trial (2 Days)" : "Mulai Coba Gratis (2 Hari)")}
                </button>
                <button
                  onClick={() => setIsPricingPage(true)}
                  className="px-4 py-3 rounded-full font-bold text-xs sm:text-sm text-neutral-400 hover:text-white transition-colors cursor-pointer text-center whitespace-nowrap"
                >
                  {language === "EN" ? "View Full Pricing ->" : "Detail Semua Paket ->"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* FAQ SECTION */}
      <div className="w-full flex flex-col px-4 md:px-6 lg:px-8 py-0">
        <div className="w-full">
          <div className="inline-block border-2 border-neutral-800 text-neutral-800 rounded-full px-5 py-2 2xl:px-6 2xl:py-3 text-sm 2xl:text-base font-bold mb-6 cursor-default">
            FAQS
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-[#111111] mb-8 font-['Inter']">
            {language === "EN" ? "Common Questions" : "Pertanyaan Umum"}
          </h2>

          <div className="flex flex-col border-t border-gray-200">
            {activeFaqs.map((faq, index) => {
              const isOpen = openFaqIdx === index;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-10%" }}
                  transition={{
                    duration: 0.5,
                    delay: index * 0.06,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className={`flex flex-col border-b transition-colors duration-200 ${isOpen ? "border-[#D1D5DB]" : "border-gray-200"} hover:border-[#D1D5DB]`}
                >
                  <button
                    onClick={() => setOpenFaqIdx(isOpen ? null : index)}
                    className="flex justify-between items-center py-5 sm:py-6 w-full text-left group focus:outline-none cursor-pointer"
                  >
                    <span
                      className={`text-base sm:text-lg font-semibold font-['Inter'] transition-colors duration-200 pr-8 ${isOpen ? "text-black font-bold" : "text-[#222222] group-hover:text-black"}`}
                    >
                      {faq.question}
                    </span>
                    <motion.div
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xl shrink-0 transition-all duration-200 ${isOpen ? "bg-[#D4FF00] text-black" : "bg-neutral-100 text-neutral-800 group-hover:bg-[#D4FF00] group-hover:text-black"}`}
                    >
                      <Plus className="w-4 h-4" strokeWidth={2.5} />
                    </motion.div>
                  </button>
                  <motion.div
                    initial={false}
                    animate={{
                      height: isOpen ? "auto" : 0,
                      opacity: isOpen ? 1 : 0,
                    }}
                    transition={{
                      height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
                      opacity: {
                        duration: 0.3,
                        delay: isOpen ? 0.05 : 0,
                        ease: [0.4, 0, 0.2, 1],
                      },
                    }}
                    className="overflow-hidden"
                  >
                    <div className="pb-5 sm:pb-6 pt-2 text-sm sm:text-base font-['Inter'] text-neutral-600 leading-relaxed max-w-4xl">
                      {faq.answer}
                    </div>
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* REVIEWS SECTION: 5-CARD TESTIMONIAL CAROUSEL */}
      <div id="reviews-section" className="px-4 md:px-6 lg:px-8 py-8 md:py-12 lg:py-16">
        <TestimonialCarousel language={language} />
      </div>

      {/* SECTION 8: FINAL CONVERSION CLOSER */}
      <div className="px-4 md:px-6 lg:px-8 py-4 md:py-8">
        <div className="w-full bg-[#0D0D0D] rounded-[2rem] 2xl:rounded-[3rem] py-14 md:py-20 px-6 md:px-12 text-center text-white relative overflow-hidden flex flex-col items-center justify-center shadow-2xl border border-neutral-800">
          <div className="inline-flex items-center gap-2 border border-neutral-700 bg-neutral-800/80 text-[#D4FF00] rounded-full px-4 py-1.5 text-xs md:text-sm font-bold mb-6 cursor-default">
            {language === "EN" ? "READY TO START?" : "SIAP MEMULAI?"}
          </div>
          <h2 className="font-['Archivo_Black'] font-normal text-3xl sm:text-4xl md:text-5xl 2xl:text-6xl uppercase tracking-tighter leading-tight max-w-3xl mb-4">
            {language === "EN"
              ? "Transform Your Fitness Journey Today."
              : "Wujudkan Tubuh Idealmu Bersama GymBuddy."}
          </h2>
          <p className="text-neutral-400 text-base sm:text-lg 2xl:text-xl font-medium max-w-2xl mb-8 leading-relaxed">
            {language === "EN"
              ? "Join thousands of active members training smarter and eating right with a personal AI coach that adapts to you. Zero risk, 2-day free trial."
              : "Bergabung bersama ribuan anggota aktif yang berlatih lebih cerdas dan makan lebih tepat dengan pelatih AI pribadi di WhatsApp. Uji coba gratis 2 hari penuh."}
          </p>

          <div className="flex flex-col items-center gap-3 w-full sm:w-auto">
            <motion.button
              whileHover={{
                scale: 1.03,
                boxShadow: "0 0 24px rgba(212,255,0,0.4)",
              }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsAppOnboarding(true)}
              className="bg-[#D4FF00] text-black px-8 py-4 2xl:px-10 2xl:py-5 rounded-full font-bold flex items-center justify-center gap-3 hover:bg-[#c4ec00] transition-colors text-base md:text-lg 2xl:text-xl w-full sm:w-auto group cursor-pointer"
            >
              {language === "EN" ? "Start for Free Now" : "Mulai Gratis Sekarang"}
              <div className="bg-black text-white p-1.5 2xl:p-2 rounded-full shrink-0 relative overflow-hidden">
                <ArrowUpRight
                  size={18}
                  strokeWidth={2.5}
                  className="md:w-5 md:h-5 2xl:w-6 2xl:h-6 transition-transform group-hover:translate-x-[2px] group-hover:-translate-y-[2px]"
                />
              </div>
            </motion.button>
            <span className="text-neutral-400 text-xs sm:text-sm mt-1">
              {language === "EN"
                ? "2-day full trial • No credit card needed • Active instantly in WhatsApp"
                : "2 hari akses penuh • Tanpa kartu kredit • Langsung aktif di WhatsApp"}
            </span>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="w-full bg-white text-neutral-900 pt-16 md:pt-24 pb-8 px-4 md:px-6 lg:px-8">
        <div className="w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8 mb-16 md:mb-24">
            {/* Brand & Tagline */}
            <div className="lg:col-span-5 flex flex-col items-start">
              <div className="mb-4">
                <GymBuddyLogo size={32} showText textClassName="text-2xl text-neutral-900" />
              </div>
              <p className="text-neutral-600 text-sm md:text-base font-medium max-w-md">
                {language === "EN"
                  ? "Your AI Personal Trainer, Nutritionist & Fitness Companion — everything you need to train smarter in one app."
                  : "Pelatih Pribadi AI, Ahli Gizi & Teman Kebugaran Anda — semua yang Anda butuhkan untuk berlatih lebih cerdas dalam satu aplikasi."}
              </p>
            </div>

            {/* Product */}
            <div className="lg:col-span-2 lg:col-start-7 flex flex-col">
              <h4 className="font-['Archivo_Black'] font-normal font-bold text-neutral-900 mb-6 uppercase tracking-wider text-sm">
                {language === "EN" ? "Product" : "Produk"}
              </h4>
              <ul className="space-y-4">
                <li>
                  <button
                    onClick={() => setShowcaseVariant("workout")}
                    className="text-neutral-500 hover:text-black hover:underline decoration-[#D4FF00] underline-offset-4 transition-all text-sm font-medium cursor-pointer"
                  >
                    {language === "EN" ? "Features" : "Fitur"}
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setIsPricingPage(true)}
                    className="text-neutral-500 hover:text-black hover:underline decoration-[#D4FF00] underline-offset-4 transition-all text-sm font-medium cursor-pointer"
                  >
                    {language === "EN" ? "Pricing" : "Harga"}
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      const el = document.getElementById("ai-journey");
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="text-neutral-500 hover:text-black hover:underline decoration-[#D4FF00] underline-offset-4 transition-all text-sm font-medium cursor-pointer"
                  >
                    {language === "EN" ? "How it works" : "Cara Kerja"}
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      const el = document.getElementById("reviews-section");
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="text-neutral-500 hover:text-black hover:underline decoration-[#D4FF00] underline-offset-4 transition-all text-sm font-medium cursor-pointer"
                  >
                    {language === "EN" ? "Reviews" : "Ulasan"}
                  </button>
                </li>
              </ul>
            </div>

            {/* Resources */}
            <div className="lg:col-span-2 flex flex-col">
              <h4 className="font-['Archivo_Black'] font-normal font-bold text-neutral-900 mb-6 uppercase tracking-wider text-sm">
                {language === "EN" ? "Resources" : "Sumber Daya"}
              </h4>
              <ul className="space-y-4">
                <li>
                  <a
                    href="#"
                    className="text-neutral-500 hover:text-black hover:underline decoration-[#D4FF00] underline-offset-4 transition-all text-sm font-medium"
                  >
                    {language === "EN" ? "Documentation" : "Dokumentasi"}
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-neutral-500 hover:text-black hover:underline decoration-[#D4FF00] underline-offset-4 transition-all text-sm font-medium"
                  >
                    {language === "EN" ? "Guides" : "Panduan"}
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-neutral-500 hover:text-black hover:underline decoration-[#D4FF00] underline-offset-4 transition-all text-sm font-medium"
                  >
                    {language === "EN" ? "Blog" : "Blog"}
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-neutral-500 hover:text-black hover:underline decoration-[#D4FF00] underline-offset-4 transition-all text-sm font-medium"
                  >
                    {language === "EN" ? "Support" : "Dukungan"}
                  </a>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div className="lg:col-span-2 flex flex-col">
              <h4 className="font-['Archivo_Black'] font-normal font-bold text-neutral-900 mb-6 uppercase tracking-wider text-sm">
                {language === "EN" ? "Company" : "Perusahaan"}
              </h4>
              <ul className="space-y-4">
                <li>
                  <a
                    href="#"
                    className="text-neutral-500 hover:text-black hover:underline decoration-[#D4FF00] underline-offset-4 transition-all text-sm font-medium"
                  >
                    {language === "EN" ? "About" : "Tentang"}
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-neutral-500 hover:text-black hover:underline decoration-[#D4FF00] underline-offset-4 transition-all text-sm font-medium"
                  >
                    {language === "EN" ? "Careers" : "Karir"}
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-neutral-500 hover:text-black hover:underline decoration-[#D4FF00] underline-offset-4 transition-all text-sm font-medium"
                  >
                    {language === "EN" ? "Contact" : "Kontak"}
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-neutral-500 hover:text-black hover:underline decoration-[#D4FF00] underline-offset-4 transition-all text-sm font-medium"
                  >
                    {language === "EN" ? "Partners" : "Mitra"}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="w-full h-px bg-neutral-200 mb-8"></div>

          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-neutral-500 text-sm font-medium">
              © 2026 GymBuddy AI.{" "}
              {language === "EN"
                ? "All rights reserved."
                : "Hak Cipta Dilindungi."}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="flex items-center gap-6">
                <a
                  href="#"
                  className="text-neutral-500 hover:text-black hover:underline text-sm font-medium transition-all"
                >
                  {language === "EN" ? "Terms of Service" : "Syarat Ketentuan"}
                </a>
                <a
                  href="#"
                  className="text-neutral-500 hover:text-black hover:underline text-sm font-medium transition-all"
                >
                  {language === "EN" ? "Privacy Policy" : "Kebijakan Privasi"}
                </a>
              </div>

              <div className="hidden sm:block w-1 h-1 bg-neutral-300 rounded-full"></div>

              <a
                href="https://muhammad-habibi-akmal-senior-ui-ux-designer-portf.ai.studio"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-1.5 text-neutral-500 hover:text-black transition-colors"
              >
                <span className="text-sm font-medium transition-colors">
                  {language === "EN" ? "Made by" : "Dibuat oleh"}
                </span>
                <span className="font-mono text-sm font-bold group-hover:text-black transition-colors">
                  BIBI
                </span>
              </a>
            </div>
          </div>
        </div>
      </footer>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => {
          setIsLoginModalOpen(false);
          setInitialLoginPhone("");
        }}
        language={language}
        initialPhone={initialLoginPhone}
        onStartOnboarding={() => setIsAppOnboarding(true)}
        onLoginSuccess={handleLoginSuccess}
        onResetData={handleResetAllData}
      />

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `,
        }}
      />
    </div>
  );
}
