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
  MoveLeft,
  MoveRight,
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
          const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-253242815083.asia-southeast2.run.app";

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

  const testimonialsEN = [
    {
      text: "Your muscles grow while you sleep. Make 7-9 hours your secret weapon for maximum progress.",
      location: "New York, USA",
      date: "Nov.20",
    },
    {
      text: "Consistency beats intensity. Show up every day and the results will naturally follow.",
      location: "London, UK",
      date: "Oct.15",
    },
  ];
  const testimonialsID = [
    {
      text: "Otot Anda tumbuh saat tidur. Jadikan 7-9 jam tidur sebagai senjata rahasia Anda untuk progres maksimal.",
      location: "Jakarta, ID",
      date: "Nov.20",
    },
    {
      text: "Konsistensi mengalahkan intensitas. Hadirlah setiap hari dan hasil akan mengikuti secara alami.",
      location: "Bali, ID",
      date: "Okt.15",
    },
  ];
  const [testimonialIdx, setTestimonialIdx] = useState(0);
  const activeTestimonials =
    language === "EN" ? testimonialsEN : testimonialsID;
  const activeTestimonial =
    activeTestimonials[testimonialIdx % activeTestimonials.length];

  const nextTestimonial = () => setTestimonialIdx((prev) => prev + 1);
  const prevTestimonial = () =>
    setTestimonialIdx(
      (prev) =>
        (prev - 1 + activeTestimonials.length) % activeTestimonials.length,
    );

  const faqsEN = [
    {
      question:
        "Is Gym Buddy AI suitable for beginners who have never been to a gym?",
      answer:
        "Absolutely. The AI is designed to adapt to any experience level, providing step-by-step guidance, form correction, and beginner-friendly workout plans.",
    },
    {
      question: "How does the AI correct my workout form?",
      answer:
        "By using your smartphone's camera, our Vision AI analyzes your movements in real-time, tracking joint angles and posture to provide instant audio and visual feedback.",
    },
    {
      question: "Do I have to type all workout data manually?",
      answer:
        "No, Gym Buddy AI automatically tracks your reps, sets, and rest times during your session, so you can focus entirely on your workout.",
    },
    {
      question: "Can Gym Buddy AI help with nutrition as well?",
      answer:
        "Yes, our Nutrition AI generates personalized meal plans and macros based on your goals, integrating seamlessly with your training progress.",
    },
    {
      question: "I have an old injury, does the AI know its limits?",
      answer:
        "During onboarding, you can log any past injuries or physical limitations. The AI will avoid prescribing exercises that could aggravate them and suggest safe alternatives.",
    },
    {
      question:
        "Does Gym Buddy AI connect to Apple Watch or other smartwatches?",
      answer:
        "Yes, Gym Buddy AI integrates with Apple Health, Google Fit, and most major smartwatches to sync your heart rate, burned calories, and recovery data.",
    },
    {
      question: "How much does a Gym Buddy AI subscription cost?",
      answer:
        "We offer a flexible pricing model starting from $15/month for the basic plan, up to $30/month for the full Premium experience, including all advanced AI features.",
    },
    {
      question: "Can it be used in a gym that doesn't have complete equipment?",
      answer:
        "Definitely. You can input the equipment available to you, or select a 'bodyweight only' mode, and the AI will generate an optimal workout with what you have.",
    },
  ];

  const faqsID = [
    {
      question:
        "Apakah Gym Buddy AI cocok untuk pemula yang belum pernah ke gym?",
      answer:
        "Tentu saja. AI ini dirancang untuk beradaptasi dengan tingkat pengalaman apa pun, memberikan panduan langkah demi langkah, koreksi postur, dan rencana latihan yang ramah pemula.",
    },
    {
      question: "Bagaimana cara AI mengoreksi form latihan saya?",
      answer:
        "Dengan menggunakan kamera ponsel Anda, Vision AI kami menganalisis gerakan Anda secara real-time, melacak sudut sendi dan postur untuk memberikan umpan balik audio dan visual instan.",
    },
    {
      question: "Apakah saya harus mengetik semua data latihan secara manual?",
      answer:
        "Tidak, Gym Buddy AI secara otomatis melacak repetisi, set, dan waktu istirahat Anda selama sesi, sehingga Anda dapat fokus sepenuhnya pada latihan Anda.",
    },
    {
      question: "Apakah Gym Buddy AI bisa bantu urusan nutrisi juga?",
      answer:
        "Ya, Nutrition AI kami menghasilkan rencana makan dan makro yang dipersonalisasi berdasarkan tujuan Anda, terintegrasi secara mulus dengan kemajuan latihan Anda.",
    },
    {
      question: "Saya punya cedera lama, apakah AI tahu batasannya?",
      answer:
        "Selama pendaftaran, Anda dapat mencatat cedera masa lalu atau keterbatasan fisik. AI akan menghindari memberikan latihan yang dapat memperburuknya dan menyarankan alternatif yang aman.",
    },
    {
      question:
        "Apakah Gym Buddy AI terhubung ke Apple Watch atau smartwatch lain?",
      answer:
        "Ya, Gym Buddy AI terintegrasi dengan Apple Health, Google Fit, dan sebagian besar smartwatch utama untuk menyinkronkan detak jantung, kalori yang terbakar, dan data pemulihan Anda.",
    },
    {
      question: "Berapa biaya berlangganan Gym Buddy AI?",
      answer:
        "Kami menawarkan model harga yang fleksibel mulai dari $15/bulan untuk paket dasar, hingga $30/bulan untuk pengalaman Premium penuh, termasuk semua fitur AI canggih.",
    },
    {
      question:
        "Apakah bisa dipakai gym yang tidak punya perlengkapan lengkap?",
      answer:
        "Pasti. Anda dapat memasukkan peralatan yang tersedia untuk Anda, atau memilih mode 'hanya berat badan', dan AI akan menghasilkan latihan yang optimal dengan apa yang Anda miliki.",
    },
  ];

  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(null);
  const activeFaqs = language === "EN" ? faqsEN : faqsID;

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
      />
    );
  }

  if (isPricingPage) {
    return (
      <>
        {splashOverlay}
        <PricingPage
          language={language}
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
        <div className="px-4 md:px-6 lg:px-8 pt-4 md:pt-6 lg:pt-8">
          <div className="bg-[#111111] rounded-[2rem] text-white p-6 md:p-10 lg:p-12 flex flex-col min-h-[85vh] xl:min-h-[850px] 2xl:min-h-[920px] relative overflow-hidden shadow-2xl">
            {/* Static Background Image */}
            <div
              className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat pointer-events-none"
              style={{
                backgroundImage: "url('/hero.png')",
              }}
            />
            <div className="absolute inset-0 bg-black/40 z-0 pointer-events-none"></div>

            {/* Header */}
            <header className="flex items-center justify-between z-10 relative">
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

            {/* Hero Content */}
            <div className="mt-20 md:mt-32 2xl:mt-40 max-w-5xl z-10 relative">
              <h1 className="font-['Archivo_Black'] font-normal text-[3.5rem] leading-[1.05] tracking-tighter sm:text-6xl md:text-[5.5rem] lg:text-[6.5rem] xl:text-[7.5rem] 2xl:text-[8.5rem] font-bold">
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

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mt-8 md:mt-12 xl:mt-16">
                <div className="flex flex-col gap-3 items-start">
                  <motion.button
                    whileHover={{
                      scale: 1.03,
                      boxShadow: "0 0 24px rgba(212,255,0,0.4)",
                    }}
                    transition={{ duration: 0.2 }}
                    onClick={() => setIsAppOnboarding(true)}
                    className="bg-[#D4FF00] text-black px-6 py-3 md:px-8 md:py-4 2xl:px-10 2xl:py-5 rounded-full font-bold flex items-center justify-center sm:justify-start gap-3 hover:bg-[#c4ec00] transition-colors text-base md:text-lg 2xl:text-xl w-full sm:w-auto group"
                  >
                    {language === "EN" ? "Try for free" : "Coba Gratis"}
                    <div className="bg-black text-white p-1.5 2xl:p-2 rounded-full shrink-0 relative overflow-hidden">
                      <ArrowUpRight
                        size={18}
                        strokeWidth={2.5}
                        className="md:w-5 md:h-5 2xl:w-6 2xl:h-6 transition-transform group-hover:translate-x-[2px] group-hover:-translate-y-[2px]"
                      />
                    </div>
                  </motion.button>
                  <span className="text-neutral-400 text-sm md:text-base ml-2">
                    {language === "EN"
                      ? "Integrates with WhatsApp & Dashboard"
                      : "Terintegrasi WhatsApp & Dashboard"}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Cards in Hero */}
            <div className="mt-auto pt-16 md:pt-24 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 xl:gap-6 z-10 relative">
              {/* Card 1 */}
              <motion.div
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="bg-white text-black rounded-3xl p-6 md:p-8 xl:p-10 flex flex-col justify-between h-full"
              >
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-4">
                    {[
                      { id: 1, src: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80", alt: "Client Avatar 1" },
                      { id: 2, src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80", alt: "Client Avatar 2" },
                      { id: 3, src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80", alt: "Client Avatar 3" },
                    ].map((person, idx) => (
                      <motion.div
                        key={person.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, delay: 0.4 + idx * 0.06 }}
                        className="w-12 h-12 2xl:w-16 2xl:h-16 rounded-full border-[3px] border-white overflow-hidden shadow-sm bg-neutral-200"
                      >
                        <img
                          src={person.src}
                          alt={person.alt}
                          className="w-full h-full object-cover"
                        />
                      </motion.div>
                    ))}
                  </div>
                  <div>
                    <div className="text-3xl 2xl:text-4xl font-['Archivo_Black'] font-normal tracking-tight">
                      10,000+
                    </div>
                    <div className="text-[13px] 2xl:text-[15px] text-neutral-500 font-medium -mt-1">
                      {language === "EN" ? "satisfied clients" : "klien puas"}
                    </div>
                  </div>
                </div>
                <p className="text-base 2xl:text-lg text-neutral-600 mt-6 leading-relaxed font-medium">
                  {language === "EN"
                    ? "They arrive with different goals, yet they all find the support and motivation they need. Their success is the ultimate validation of our method."
                    : "Mereka datang dengan tujuan berbeda, namun menemukan dukungan dan motivasi yang mereka butuhkan. Kesuksesan mereka adalah validasi akhir dari metode kami."}
                </p>
              </motion.div>

              {/* Card 2 */}
              <motion.div
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.48 }}
                className="bg-white/20 backdrop-blur-md text-white rounded-3xl p-6 md:p-8 xl:p-10 flex flex-col justify-between border border-white/30 shadow-lg relative h-full overflow-hidden"
              >
                <div className="relative z-10 flex justify-between items-start mb-6">
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={prevTestimonial}
                    className="w-10 h-10 2xl:w-12 2xl:h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-colors border border-white/20"
                  >
                    <MoveLeft size={18} className="2xl:w-5 2xl:h-5" />
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={nextTestimonial}
                    className="w-10 h-10 2xl:w-12 2xl:h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-colors border border-white/20"
                  >
                    <MoveRight size={18} className="2xl:w-5 2xl:h-5" />
                  </motion.button>
                </div>
                <div className="relative z-10 px-2 md:px-6 flex-grow flex items-center justify-center">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div
                      key={testimonialIdx}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.35 }}
                      className="w-full"
                    >
                      <p className="font-semibold text-lg 2xl:text-xl leading-snug text-center text-white/90">
                        {activeTestimonial.text}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </div>
                <div className="relative z-10 flex justify-between items-end mt-8 text-sm 2xl:text-base text-neutral-400 font-medium px-2 md:px-4">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={`loc-${testimonialIdx}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {activeTestimonial.location}
                    </motion.span>
                  </AnimatePresence>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={`date-${testimonialIdx}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {activeTestimonial.date}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </motion.div>

              {/* Card 3 */}
              <motion.div
                onClick={() => setIsPricingPage(true)}
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.56 }}
                whileHover="hover"
                variants={{ hover: { filter: "brightness(1.05)" } }}
                className="bg-[#D4FF00] text-black rounded-3xl p-6 md:p-8 xl:p-10 flex flex-col justify-between h-full md:col-span-2 lg:col-span-1 cursor-pointer"
              >
                <div className="flex justify-end">
                  <motion.button
                    variants={{ hover: { rotate: 45 } }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="w-10 h-10 2xl:w-14 2xl:h-14 rounded-full bg-black text-white flex items-center justify-center hover:scale-105 transition-transform"
                  >
                    <ArrowUpRight size={18} className="2xl:w-6 2xl:h-6" />
                  </motion.button>
                </div>
                <div className="mt-8">
                  <h3 className="font-['Archivo_Black'] font-normal text-2xl md:text-[28px] 2xl:text-4xl font-bold tracking-tight leading-tight">
                    {language === "EN"
                      ? "Get 2 days free trial"
                      : "Dapatkan 2 hari uji coba gratis"}
                  </h3>
                  <p className="text-base md:text-lg 2xl:text-xl font-medium mt-2 text-black/70">
                    {language === "EN"
                      ? "Experience our premium fitness facilities for 48 hours completely free"
                      : "Nikmati fasilitas kebugaran premium kami selama 48 jam secara gratis"}
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
        {/* SECTION 2: AI FEATURES */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 2xl:gap-32 items-center px-4 md:px-6 lg:px-8 pt-8 md:pt-12 lg:pt-16 pb-0">
          <div className="lg:col-span-5">
            <div className="inline-block border-2 border-neutral-800 text-neutral-800 rounded-full px-5 py-2 2xl:px-6 2xl:py-3 text-sm 2xl:text-base font-bold mb-8 cursor-default">
              {language === "EN"
                ? "Intelligent Fitness Platform"
                : "Platform Kebugaran Cerdas"}
            </div>
            <h2 className="font-['Archivo_Black'] font-normal text-3xl sm:text-4xl md:text-[3.5rem] 2xl:text-[4.5rem] font-bold tracking-tighter leading-[1.05] mb-6 md:mb-8 2xl:mb-10 text-neutral-900">
              {language === "EN"
                ? "Meet GymBuddy AI, Your Personal Trainer That Never Sleeps."
                : "Temui GymBuddy AI, Pelatih Pribadi Anda yang Tak Pernah Tidur."}
            </h2>
            <p className="text-lg md:text-xl 2xl:text-2xl text-neutral-600 font-medium leading-relaxed mb-8 md:mb-10 2xl:mb-14 max-w-xl">
              {language === "EN"
                ? "Generate personalized workouts, analyze your form in real-time with computer vision, and track nutrition. Everything you need to build your best body, powered by advanced AI."
                : "Buat latihan yang dipersonalisasi, analisis postur Anda secara real-time dengan visi komputer, dan lacak nutrisi. Segala yang Anda butuhkan untuk membentuk tubuh terbaik Anda, ditenagai oleh AI canggih."}
            </p>
          </div>

          <div className="lg:col-span-7 w-full overflow-hidden">
            <div className="flex gap-4 sm:gap-6 2xl:gap-8 overflow-x-auto pb-6 pt-2 snap-x hide-scrollbar items-stretch justify-start lg:justify-end scroll-smooth max-w-full">
              {/* Feature 1 */}
              <div
                onClick={() => {
                  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
                  setShowcaseVariant("workout");
                }}
                className="w-[82vw] sm:w-[350px] md:w-[380px] lg:w-[360px] xl:w-[420px] 2xl:w-[480px] shrink-0 aspect-[4/5] bg-neutral-200 rounded-[2rem] 2xl:rounded-[3rem] relative overflow-hidden snap-start group cursor-pointer bg-cover bg-center hover:scale-[1.015] hover:brightness-105 transition-all duration-300"
                style={{
                  backgroundImage:
                    "url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1470&auto=format&fit=crop')",
                }}
              >
                <div className="absolute top-5 left-5 2xl:top-8 2xl:left-8 bg-white px-4 py-2 2xl:px-6 2xl:py-3 rounded-full font-bold text-xs sm:text-[15px] 2xl:text-lg z-10 shadow-sm">
                  {language === "EN"
                    ? "AI Workout Coach"
                    : "Pelatih Latihan AI"}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 group-hover:from-black/95 transition-colors z-0"></div>
                <div className="absolute bottom-6 left-6 right-6 2xl:bottom-10 2xl:left-10 2xl:right-10 flex justify-between items-end z-10 gap-3">
                  <div className="flex flex-col">
                    <h3 className="font-['Archivo_Black'] font-normal text-white text-2xl sm:text-3xl 2xl:text-4xl font-bold leading-tight mb-2 sm:mb-3">
                      {language === "EN"
                        ? "Workouts Built Around You."
                        : "Latihan yang Dibuat Khusus Untuk Anda."}
                    </h3>
                    <p className="text-white/80 text-xs sm:text-sm md:text-base 2xl:text-xl font-medium leading-relaxed max-w-sm 2xl:max-w-md line-clamp-4 sm:line-clamp-none">
                      {language === "EN"
                        ? "Personalized training plans generated from your goals, training experience, available equipment, workout history, and recovery status. Every session automatically adapts as your performance improves."
                        : "Rencana pelatihan personal yang dihasilkan dari tujuan, pengalaman, peralatan yang tersedia, riwayat latihan, dan status pemulihan Anda. Setiap sesi beradaptasi otomatis seiring peningkatan performa Anda."}
                    </p>
                  </div>
                  <button className="w-10 h-10 sm:w-12 sm:h-12 2xl:w-16 2xl:h-16 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/30 group-hover:scale-110 transition-all shrink-0 mb-1 cursor-pointer">
                    <ArrowUpRight size={18} className="sm:w-5 sm:h-5 2xl:w-7 2xl:h-7" />
                  </button>
                </div>
              </div>

              {/* Feature 2 */}
              <div
                onClick={() => {
                  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
                  setShowcaseVariant("nutrition");
                }}
                className="w-[82vw] sm:w-[350px] md:w-[380px] lg:w-[360px] xl:w-[420px] 2xl:w-[480px] shrink-0 aspect-[4/5] bg-neutral-200 rounded-[2rem] 2xl:rounded-[3rem] relative overflow-hidden snap-start group cursor-pointer bg-cover bg-center hover:scale-[1.015] hover:brightness-105 transition-all duration-300"
                style={{
                  backgroundImage:
                    "url('https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=1453&auto=format&fit=crop')",
                }}
              >
                <div className="absolute top-5 left-5 2xl:top-8 2xl:left-8 bg-white px-4 py-2 2xl:px-6 2xl:py-3 rounded-full font-bold text-xs sm:text-[15px] 2xl:text-lg z-10 shadow-sm">
                  {language === "EN" ? "Nutrition AI" : "AI Nutrisi"}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 group-hover:from-black/95 transition-colors z-0"></div>
                <div className="absolute bottom-6 left-6 right-6 2xl:bottom-10 2xl:left-10 2xl:right-10 flex justify-between items-end z-10 gap-3">
                  <div className="flex flex-col">
                    <h3 className="font-['Archivo_Black'] font-normal text-white text-2xl sm:text-3xl 2xl:text-4xl font-bold leading-tight mb-2 sm:mb-3">
                      {language === "EN"
                        ? "Fuel Every Workout Smarter."
                        : "Penuhi Nutrisi Latihan dengan Cerdas."}
                    </h3>
                    <p className="text-white/80 text-xs sm:text-sm md:text-base 2xl:text-xl font-medium leading-relaxed max-w-sm 2xl:max-w-md line-clamp-4 sm:line-clamp-none">
                      {language === "EN"
                        ? "Instantly track meals, analyze calories and macros, and receive personalized nutrition recommendations that support your training goals and recovery."
                        : "Lacak makanan secara instan, analisis kalori dan makro, dan terima rekomendasi nutrisi personal yang mendukung tujuan latihan dan pemulihan Anda."}
                    </p>
                  </div>
                  <button className="w-10 h-10 sm:w-12 sm:h-12 2xl:w-16 2xl:h-16 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/30 group-hover:scale-110 transition-all shrink-0 mb-1 cursor-pointer">
                    <ArrowUpRight size={18} className="sm:w-5 sm:h-5 2xl:w-7 2xl:h-7" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: BENTO GRID */}
        <div className="px-4 md:px-6 lg:px-8 py-8 md:py-12 lg:py-16">
          <div className="bg-[#151515] rounded-[2.5rem] 2xl:rounded-[3.5rem] p-6 md:p-10 lg:p-12 text-white shadow-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 grid-flow-row-dense gap-4 md:gap-5 2xl:gap-6 auto-rows-[160px] md:auto-rows-[180px] 2xl:auto-rows-[220px]">
              {/* Box 1: Professional coaches */}
              <div className="bg-[#222222] rounded-[2rem] 2xl:rounded-[2.5rem] p-8 2xl:p-10 flex flex-col justify-center col-span-1 md:col-span-2 lg:col-span-2 xl:col-span-2 hover:bg-[#2a2a2a] transition-colors">
                <div className="flex gap-6 items-center">
                  <Asterisk
                    size={56}
                    className="text-neutral-400 shrink-0 2xl:w-20 2xl:h-20"
                    strokeWidth={1}
                  />
                  <p className="text-xl 2xl:text-3xl font-medium leading-snug">
                    {language === "EN"
                      ? "AI Workout Generation adapted to your unique fitness goals."
                      : "Pembuatan Latihan AI yang disesuaikan dengan tujuan kebugaran unik Anda."}
                  </p>
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

              {/* Box 3: Wi-Fi */}
              <div className="bg-[#222222] rounded-[2rem] 2xl:rounded-[2.5rem] p-6 2xl:p-8 flex flex-col items-center justify-center gap-4 col-span-1 hover:bg-[#2a2a2a] transition-colors">
                <Wifi
                  size={48}
                  className="text-neutral-300 2xl:w-16 2xl:h-16"
                  strokeWidth={1.5}
                />
                <span className="font-medium text-lg 2xl:text-xl text-neutral-300">
                  {language === "EN" ? "AI Voice Coach" : "Pelatih Suara AI"}
                </span>
              </div>

              {/* Box 4: Tanning bed */}
              <div className="bg-[#222222] rounded-[2rem] 2xl:rounded-[2.5rem] p-6 2xl:p-8 flex items-center justify-center col-span-1 hover:bg-[#2a2a2a] transition-colors text-center">
                <span className="font-medium text-xl 2xl:text-2xl text-neutral-300">
                  {language === "EN" ? (
                    <>
                      Vision
                      <br />
                      Form Check
                    </>
                  ) : (
                    <>
                      Pemeriksaan
                      <br />
                      Postur Visi
                    </>
                  )}
                </span>
              </div>

              {/* Box 5: Medical */}
              <div className="bg-[#222222] rounded-[2rem] 2xl:rounded-[2.5rem] p-8 2xl:p-10 flex flex-col justify-center col-span-1 md:col-span-2 lg:col-span-2 xl:col-span-2 hover:bg-[#2a2a2a] transition-colors">
                <div className="flex gap-6 items-center">
                  <Activity
                    size={56}
                    className="text-neutral-400 shrink-0 2xl:w-20 2xl:h-20"
                    strokeWidth={1.5}
                  />
                  <p className="text-xl 2xl:text-3xl font-medium leading-snug">
                    {language === "EN" ? (
                      <>
                        Advanced AI
                        <br />
                        Recovery Intelligence
                      </>
                    ) : (
                      <>
                        Kecerdasan Pemulihan
                        <br />
                        AI Lanjutan
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Box 6: Fitness trackers */}
              <div className="bg-[#222222] rounded-[2rem] 2xl:rounded-[2.5rem] p-8 2xl:p-10 flex flex-col justify-center col-span-1 md:col-span-2 lg:col-span-2 xl:col-span-2 hover:bg-[#2a2a2a] transition-colors">
                <div className="flex gap-6 items-center">
                  <div className="shrink-0 flex items-center justify-center">
                    <Flame
                      size={56}
                      className="text-neutral-400 2xl:w-20 2xl:h-20"
                      strokeWidth={1.5}
                    />
                  </div>
                  <p className="text-xl 2xl:text-3xl font-medium leading-snug">
                    Smart Nutrition and AI data analysis.
                  </p>
                </div>
              </div>

              {/* Box 7: Sports zones */}
              <div className="bg-[#222222] rounded-[2rem] 2xl:rounded-[2.5rem] p-6 2xl:p-8 flex flex-col items-center justify-center gap-2 col-span-1 hover:bg-[#2a2a2a] transition-colors text-center">
                <span className="text-5xl 2xl:text-6xl font-bold tracking-tighter">
                  1200+
                </span>
                <span className="text-base 2xl:text-lg font-medium leading-tight text-neutral-400">
                  unique
                  <br />
                  exercises
                </span>
              </div>

              {/* Box 8: Bar */}
              <div className="bg-[#222222] rounded-[2rem] 2xl:rounded-[2.5rem] p-6 2xl:p-8 flex items-center justify-center col-span-1 hover:bg-[#2a2a2a] transition-colors text-center">
                <p className="text-lg 2xl:text-xl font-medium leading-snug text-neutral-300">
                  Adaptive AI
                  <br />
                  Progressive Overload.
                </p>
              </div>

              {/* Box 9: Massage */}
              <div className="bg-[#222222] rounded-[2rem] 2xl:rounded-[2.5rem] p-6 2xl:p-8 flex items-center justify-center col-span-1 hover:bg-[#2a2a2a] transition-colors text-center">
                <p className="text-lg 2xl:text-xl font-medium leading-snug text-neutral-300">
                  Personalized
                  <br />
                  Recovery Insights
                </p>
              </div>

              {/* Box 10: 500m2 */}
              <div className="bg-[#222222] rounded-[2rem] 2xl:rounded-[2.5rem] p-6 2xl:p-8 flex items-center justify-center col-span-1 hover:bg-[#2a2a2a] transition-colors">
                <span className="text-[2.5rem] 2xl:text-[3.25rem] font-['Archivo_Black'] font-normal tracking-tighter leading-tight text-center">
                  {language === "EN" ? (
                    <>
                      24/7 AI
                      <br />
                      Coaching
                    </>
                  ) : (
                    <>
                      Pelatihan
                      <br />
                      AI 24/7
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
        {/* SECTION 4: HOW IT WORKS */}
        <div id="ai-journey" className="px-4 md:px-6 lg:px-8 py-0 w-full flex flex-col overflow-hidden relative">
          <div className="flex flex-col md:flex-row md:items-end justify-between text-left mb-8 2xl:mb-12 gap-6">
            <div>
              <div className="inline-flex items-center gap-2 border border-black bg-white text-neutral-800 rounded-full px-4 py-1.5 2xl:px-5 2xl:py-2 text-xs md:text-sm 2xl:text-base font-bold mb-6 cursor-default">
                {language === "EN" ? "AI Journey" : "Perjalanan AI"}
              </div>
              <h2 className="font-['Archivo_Black'] font-normal text-3xl sm:text-4xl md:text-5xl 2xl:text-[4rem] tracking-tighter leading-[0.9] mb-4 text-neutral-900">
                {language === "EN"
                  ? "How GymBuddy Works"
                  : "Cara Kerja GymBuddy"}
              </h2>
              <p className="text-base md:text-lg 2xl:text-xl text-neutral-600 font-medium max-w-xl">
                {language === "EN"
                  ? "A complete AI-powered fitness experience from planning to recovery."
                  : "Pengalaman kebugaran lengkap dengan AI dari perencanaan hingga pemulihan."}
              </p>
            </div>
            <button className="inline-flex items-center justify-center gap-2 bg-neutral-900 text-white rounded-full px-6 py-3 md:px-8 md:py-4 font-bold text-sm 2xl:text-base hover:bg-black transition-colors self-start md:self-end">
              {language === "EN" ? "Explore More" : "Jelajahi Lebih Lanjut"}
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
                    ? "Choose your fitness objective, experience level, equipment, and preferences. GymBuddy creates a personalized foundation."
                    : "Pilih tujuan kebugaran, tingkat pengalaman, peralatan, dan preferensi Anda. GymBuddy membuat fondasi yang dipersonalisasi.",
                image:
                  "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=2070&auto=format&fit=crop",
                Icon: Target,
              },
              {
                id: 2,
                step: "02",
                title:
                  language === "EN" ? "Train With AI" : "Berlatih Bersama AI",
                desc:
                  language === "EN"
                    ? "Receive adaptive workouts, AI coaching, and real-time form guidance throughout every workout."
                    : "Terima latihan adaptif, pelatihan AI, dan panduan postur real-time di sepanjang setiap latihan.",
                image:
                  "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=2000&auto=format&fit=crop",
                Icon: Dumbbell,
              },
              {
                id: 3,
                step: "03",
                title: language === "EN" ? "Fuel Your Body" : "Nutrisi Tubuhmu",
                desc:
                  language === "EN"
                    ? "Track nutrition, monitor macros, and receive personalized meal recommendations powered by AI."
                    : "Lacak nutrisi, pantau makro, dan terima rekomendasi makanan yang dipersonalisasi yang didukung oleh AI.",
                image:
                  "https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=1453&auto=format&fit=crop",
                Icon: Leaf,
              },
              {
                id: 4,
                step: "04",
                title:
                  language === "EN"
                    ? "Recover & Improve"
                    : "Pulih & Berkembang",
                desc:
                  language === "EN"
                    ? "Analyze recovery metrics and automatically optimize your future training plan."
                    : "Analisis metrik pemulihan dan optimalkan rencana pelatihan Anda di masa depan secara otomatis.",
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

        {/* SECTION 5: PRICING */}
        <div className="px-4 md:px-6 lg:px-8 py-8 md:py-12 lg:py-16">
          <div className="w-full bg-[#0D0D0D] rounded-[2rem] 2xl:rounded-[3rem] py-16 md:py-24 lg:py-32 px-6 md:px-10 lg:px-12 relative overflow-hidden flex flex-col">
            <div className="w-full mb-12 md:mb-16">
              <h2 className="font-['Archivo_Black'] font-normal text-3xl md:text-5xl lg:text-6xl 2xl:text-7xl uppercase tracking-tighter leading-[1] md:leading-[0.95] text-white">
                {language === "EN" ? (
                  <>
                    MEMBERSHIP PLANS THAT SUIT
                    <br /> YOUR LIFESTYLE
                  </>
                ) : (
                  <>
                    PAKET KEANGGOTAAN YANG SESUAI
                    <br /> DENGAN GAYA HIDUP ANDA
                  </>
                )}
              </h2>
            </div>

            <div className="w-full flex flex-col md:flex-row gap-4 md:gap-6 items-stretch">
              {/* FREE TIER */}
              <div className="w-full md:w-1/3 bg-[#F5F5F5] rounded-3xl p-6 md:p-8 flex flex-col min-h-[460px] 2xl:min-h-[500px]">
                <div className="flex-grow">
                  <div className="flex justify-between items-start mb-6">
                    <h3 className="font-['Archivo_Black'] font-normal tracking-tighter text-2xl 2xl:text-3xl text-neutral-900">
                      {language === "EN" ? "Free" : "Gratis"}
                    </h3>
                    <div className="flex flex-col items-end">
                      <div className="flex items-start">
                        <span className="text-lg font-bold mt-1 mr-1 text-neutral-900">
                          {language === "EN" ? "$" : "Rp "}
                        </span>
                        <span className="font-['Archivo_Black'] font-normal tracking-tighter leading-none text-4xl 2xl:text-5xl text-neutral-900">
                          0
                        </span>
                      </div>
                      <span className="text-xs font-bold mt-1 text-neutral-500">
                        {language === "EN" ? "/month" : "/bulan"}
                      </span>
                    </div>
                  </div>
                  <p className="text-neutral-600 text-sm md:text-base font-medium mb-8">
                    {language === "EN"
                      ? "Perfect for getting started with GymBuddy AI (2-Day Free Trial)."
                      : "Sempurna untuk mencoba uji coba gratis 2 hari GymBuddy AI."}
                  </p>
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <Check className="text-neutral-500 shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                      <span className="font-medium text-sm 2xl:text-base text-neutral-600">
                        {language === "EN"
                          ? "AI Personalized Workout Plans"
                          : "Rencana Latihan Personal dengan AI"}
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="text-neutral-500 shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                      <span className="font-medium text-sm 2xl:text-base text-neutral-600">
                        {language === "EN"
                          ? "Exercise & Progress Tracking"
                          : "Pelacakan Latihan & Kemajuan"}
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="text-neutral-500 shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                      <span className="font-medium text-sm 2xl:text-base text-neutral-600">
                        {language === "EN"
                          ? "2-Day Full Access Trial to Workout & Nutrition AI"
                          : "2 Hari Akses Penuh AI Workout & Nutrisi"}
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="text-neutral-500 shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                      <span className="font-medium text-sm 2xl:text-base text-neutral-600">
                        {language === "EN"
                          ? "WhatsApp AI Integration"
                          : "Integrasi WhatsApp AI"}
                      </span>
                    </li>
                  </ul>
                </div>
                <button
                  onClick={() => {
                    if (isLoggedIn) setViewMode("dashboard");
                    else setIsAppOnboarding(true);
                  }}
                  className="w-full py-3.5 2xl:py-4 rounded-full font-bold text-sm 2xl:text-base bg-[#111111] text-white hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-600 transition-colors mt-8 cursor-pointer"
                >
                  {isLoggedIn
                    ? (language === "EN" ? "Open Dashboard" : "Buka Dashboard")
                    : (language === "EN" ? "Get Started Free" : "Mulai Coba Gratis")}
                </button>
              </div>

              {/* ADVANCED TIER */}
              <div className="w-full md:w-1/3 bg-white rounded-3xl p-6 md:p-8 flex flex-col min-h-[460px] 2xl:min-h-[500px] border border-[#D4FF00] relative">
                <div className="absolute top-0 right-8 -translate-y-1/2 bg-[#D4FF00] text-black text-[10px] md:text-xs font-bold uppercase tracking-wider px-3 py-1 md:px-4 md:py-1.5 rounded-full">
                  {language === "EN" ? "Recommended" : "Rekomendasi"}
                </div>
                <div className="flex-grow">
                  <div className="flex justify-between items-start mb-6">
                    <h3 className="font-['Archivo_Black'] font-normal tracking-tighter text-3xl 2xl:text-4xl text-black">
                      {language === "EN" ? "Advanced" : "Lanjutan"}
                    </h3>
                    <div className="flex flex-col items-end">
                      <div className="flex items-start">
                        <span className="text-xl font-bold mt-1 mr-1 text-black">
                          {language === "EN" ? "$" : "Rp "}
                        </span>
                        <span className="font-['Archivo_Black'] font-normal tracking-tighter leading-none text-4xl 2xl:text-5xl text-black">
                          {language === "EN" ? "5" : "79rb"}
                        </span>
                      </div>
                      <span className="text-xs font-bold mt-1 text-neutral-500">
                        {language === "EN" ? "/month" : "/bulan"}
                      </span>
                    </div>
                  </div>
                  <p className="text-neutral-700 text-sm md:text-base font-medium mb-6">
                    {language === "EN"
                      ? "Choose the AI feature that matches your fitness journey."
                      : "Pilih fitur AI yang sesuai dengan perjalanan kebugaran Anda."}
                  </p>

                  <div className="mb-4">
                    <div className="text-xs font-bold text-neutral-500 uppercase mb-2 tracking-wide">
                      {language === "EN"
                        ? "Choose One AI Specialization"
                        : "Pilih Satu Spesialisasi AI"}
                    </div>
                    <div className="bg-neutral-100 p-1.5 rounded-xl flex gap-1 mb-4">
                      <button
                        onClick={() => setSpecialization("nutrition")}
                        className={`flex-1 font-bold text-xs py-3 px-3 rounded-lg transition-all focus:outline-none ${specialization === "nutrition" ? "bg-[#D4FF00] text-black" : "bg-transparent text-neutral-500 hover:text-black hover:bg-neutral-200"}`}
                      >
                        Nutrition AI
                      </button>
                      <button
                        onClick={() => setSpecialization("vision")}
                        className={`flex-1 font-bold text-xs py-3 px-3 rounded-lg transition-all focus:outline-none ${specialization === "vision" ? "bg-[#D4FF00] text-black" : "bg-transparent text-neutral-500 hover:text-black hover:bg-neutral-200"}`}
                      >
                        Vision AI
                      </button>
                    </div>

                    {specialization === "nutrition" ? (
                      <ul className="space-y-3 mb-4">
                        <li className="flex items-start gap-3">
                          <Check className="text-black shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                          <span className="font-medium text-sm 2xl:text-base text-neutral-800">
                            {language === "EN"
                              ? "Unlimited AI Meal Recognition"
                              : "Pengenalan Makanan AI Tanpa Batas"}
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <Check className="text-black shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                          <span className="font-medium text-sm 2xl:text-base text-neutral-800">
                            {language === "EN"
                              ? "Personalized Nutrition Insights"
                              : "Wawasan Nutrisi Personal"}
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <Check className="text-black shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                          <span className="font-medium text-sm 2xl:text-base text-neutral-800">
                            {language === "EN"
                              ? "Macro & Calorie Analysis"
                              : "Analisis Makro & Kalori"}
                          </span>
                        </li>
                      </ul>
                    ) : (
                      <ul className="space-y-3 mb-4">
                        <li className="flex items-start gap-3">
                          <Check className="text-black shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                          <span className="font-medium text-sm 2xl:text-base text-neutral-800">
                            {language === "EN"
                              ? "Unlimited AI Form Analysis"
                              : "Analisis Postur AI Tanpa Batas"}
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <Check className="text-black shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                          <span className="font-medium text-sm 2xl:text-base text-neutral-800">
                            {language === "EN"
                              ? "Real-Time Technique Feedback"
                              : "Umpan Balik Teknik Real-Time"}
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <Check className="text-black shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                          <span className="font-medium text-sm 2xl:text-base text-neutral-800">
                            {language === "EN"
                              ? "Exercise Performance Insights"
                              : "Wawasan Performa Latihan"}
                          </span>
                        </li>
                      </ul>
                    )}

                    <div className="text-[11px] text-neutral-500 font-medium">
                      {language === "EN"
                        ? "You can switch your AI specialization anytime."
                        : "Anda dapat mengganti spesialisasi AI Anda kapan saja."}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (isLoggedIn) setViewMode("dashboard");
                    else setIsAppOnboarding(true);
                  }}
                  className="w-full py-3.5 2xl:py-4 rounded-full font-bold text-sm 2xl:text-base bg-[#D4FF00] text-black hover:brightness-105 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all mt-auto cursor-pointer"
                >
                  {isLoggedIn
                    ? (language === "EN" ? "Open Dashboard" : "Buka Dashboard")
                    : (language === "EN" ? "Pesan Advanced ($5)" : "Pesan Advanced (Rp 79rb)")}
                </button>
              </div>

              {/* PREMIUM TIER */}
              <div className="w-full md:w-1/3 bg-[#F5F5F5] rounded-3xl p-6 md:p-8 flex flex-col min-h-[460px] 2xl:min-h-[500px]">
                <div className="flex-grow">
                  <div className="flex justify-between items-start mb-6">
                    <h3 className="font-['Archivo_Black'] font-normal tracking-tighter text-2xl 2xl:text-3xl text-neutral-900">
                      {language === "EN" ? "Premium" : "Premium"}
                    </h3>
                    <div className="flex flex-col items-end">
                      <div className="flex items-start">
                        <span className="text-lg font-bold mt-1 mr-1 text-neutral-900">
                          {language === "EN" ? "$" : "Rp "}
                        </span>
                        <span className="font-['Archivo_Black'] font-normal tracking-tighter leading-none text-4xl 2xl:text-5xl text-neutral-900">
                          {language === "EN" ? "8" : "139rb"}
                        </span>
                      </div>
                      <span className="text-xs font-bold mt-1 text-neutral-500">
                        {language === "EN" ? "/month" : "/bulan"}
                      </span>
                    </div>
                  </div>
                  <p className="text-neutral-600 text-sm md:text-base font-medium mb-8">
                    {language === "EN"
                      ? "The complete GymBuddy AI experience with both AIs."
                      : "Pengalaman GymBuddy AI yang lengkap dengan 2 AI sekaligus."}
                  </p>
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <Check className="text-neutral-900 shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                      <span className="font-bold text-sm 2xl:text-base text-neutral-900">
                        {language === "EN"
                          ? "Everything in Advanced"
                          : "Semua yang ada di Advanced"}
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="text-neutral-500 shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                      <span className="font-medium text-sm 2xl:text-base text-neutral-600">
                        {language === "EN"
                          ? "Nutrition AI + Vision Workout AI"
                          : "Nutrition AI + Vision Workout AI"}
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="text-neutral-500 shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                      <span className="font-medium text-sm 2xl:text-base text-neutral-600">
                        Recovery Intelligence & Visual Posters
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="text-neutral-500 shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                      <span className="font-medium text-sm 2xl:text-base text-neutral-600">
                        {language === "EN"
                          ? "Full WhatsApp & Dashboard Sync"
                          : "Sync Real-Time WhatsApp & Dashboard"}
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="text-neutral-500 shrink-0 w-4 h-4 md:w-5 md:h-5 mt-0.5" />
                      <span className="font-medium text-sm 2xl:text-base text-neutral-600">
                        {language === "EN"
                          ? "Priority Gemini Pro AI Processing"
                          : "Pemrosesan AI Prioritas Gemini Pro"}
                      </span>
                    </li>
                  </ul>
                </div>
                <button
                  onClick={() => {
                    if (isLoggedIn) setViewMode("dashboard");
                    else setIsAppOnboarding(true);
                  }}
                  className="w-full py-3.5 2xl:py-4 rounded-full font-bold text-sm 2xl:text-base bg-[#111111] text-white hover:bg-neutral-800 border border-transparent hover:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-600 transition-colors mt-8 cursor-pointer"
                >
                  {isLoggedIn
                    ? (language === "EN" ? "Open Dashboard" : "Buka Dashboard")
                    : (language === "EN" ? "Pesan Premium ($8)" : "Pesan Premium (Rp 139rb)")}
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
                    className="flex justify-between items-center py-5 sm:py-6 w-full text-left group focus:outline-none"
                  >
                    <span
                      className={`text-base sm:text-lg font-semibold font-['Inter'] transition-colors duration-200 pr-8 ${isOpen ? "text-[#D4FF00]" : "text-[#111111] group-hover:text-[#D4FF00]"}`}
                    >
                      {faq.question}
                    </span>
                    <motion.div
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                      className={`text-xl shrink-0 transition-colors duration-200 ${isOpen ? "text-[#D4FF00]" : "text-emerald-600 group-hover:text-[#D4FF00]"}`}
                    >
                      <Plus className="w-5 h-5" strokeWidth={2} />
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
                    <div className="pb-5 sm:pb-6 pt-3 text-sm sm:text-base font-['Inter'] text-[#6B7280] leading-relaxed">
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
        onClose={() => setIsLoginModalOpen(false)}
        language={language}
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
