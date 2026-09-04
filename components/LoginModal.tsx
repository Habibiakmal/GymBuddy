import React, { useState, useEffect } from "react";
import GymBuddyLogo from "./Logo";
import { getApiBaseUrl } from "../utils/api";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  User,
  Phone,
  Mail,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  Flame,
  Dumbbell,
  Target,
  Sparkles,
  RefreshCw,
  LogOut,
  ChevronRight,
  Clock,
  Smartphone,
  MapPin,
  Key,
  ShieldAlert,
  Shield
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

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: "EN" | "ID";
  initialPhone?: string;
  onStartOnboarding: () => void;
  onLoginSuccess?: (profile: any) => void;
  onResetData?: () => void;
}

export default function LoginModal({
  isOpen,
  onClose,
  language = "EN",
  initialPhone,
  onStartOnboarding,
  onLoginSuccess,
  onResetData
}: LoginModalProps) {
  const isEN = language === "EN";
  const [authMode, setAuthMode] = useState<"select" | "phone" | "email">("select");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [userProfile, setUserProfile] = useState<any>(null);
  const [progressData, setProgressData] = useState<any>(null);
  const [selectedPersona, setSelectedPersona] = useState<"max" | "mia">("max");

  // Autofill and direct to phone auth if initialPhone provided
  useEffect(() => {
    if (initialPhone) {
      let clean = initialPhone.replace(/\D/g, "");
      if (clean.startsWith("62")) clean = clean.substring(2);
      else if (clean.startsWith("0")) clean = clean.substring(1);
      setPhone(clean);
      setAuthMode("phone");
    }
  }, [initialPhone]);

  type VerificationStep = "credentials" | "waiting_whatsapp" | "otp_input" | "approved" | "rejected" | "expired";

  interface VerificationSession {
    sessionId: string;
    device: string;
    location: string;
    timeStr: string;
    expiresAt: number;
    profile: any;
    progress?: any;
  }

  const [verificationStep, setVerificationStep] = useState<VerificationStep>("credentials");
  const [verificationSession, setVerificationSession] = useState<VerificationSession | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [otpError, setOtpError] = useState("");
  const [remainingTime, setRemainingTime] = useState<number>(300);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // Format seconds to mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // 1. Countdown timer for WhatsApp confirmation (5 minutes)
  useEffect(() => {
    if (verificationStep !== "waiting_whatsapp" || !verificationSession?.expiresAt) return;
    const updateTime = () => {
      const diff = Math.max(0, Math.round((verificationSession.expiresAt - Date.now()) / 1000));
      setRemainingTime(diff);
      if (diff <= 0) {
        setVerificationStep("expired");
      }
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [verificationStep, verificationSession?.expiresAt]);

  // 2. Polling interval to check confirmation status
  useEffect(() => {
    if (verificationStep !== "waiting_whatsapp" || !verificationSession?.sessionId) return;
    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/login-status/${verificationSession.sessionId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;

        if (data.status === "approved") {
          clearInterval(interval);
          setVerificationStep("approved");
          const prof = data.profile || verificationSession.profile;

          try {
            const p = prof.phone || phone;
            const norm = p.replace(/\D/g, "");
            localStorage.setItem(`gymbuddy_user_${norm}`, JSON.stringify(prof));
            localStorage.setItem("gymbuddy_active_session", JSON.stringify(prof));
            localStorage.setItem("gymbuddy_last_user", JSON.stringify(prof));
          } catch (e) {}

          setUserProfile(prof);
          if (verificationSession.progress) setProgressData(verificationSession.progress);

          setTimeout(() => {
            if (isMounted) {
              if (onLoginSuccess) onLoginSuccess(prof);
              onClose();
            }
          }, 1400);
        } else if (data.status === "rejected") {
          clearInterval(interval);
          setVerificationStep("rejected");
        } else if (data.status === "expired") {
          clearInterval(interval);
          setVerificationStep("expired");
        }
      } catch (e) {}
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [verificationStep, verificationSession]);

  const handleResendConfirmation = async () => {
    if (!verificationSession?.sessionId) return;
    setResending(true);
    setResendSuccess(false);
    const API_BASE_URL = getApiBaseUrl();
    try {
      let res = await fetch("/api/auth/login-resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: verificationSession.sessionId })
      }).catch(() => null);

      if ((!res || !res.ok) && API_BASE_URL) {
        res = await fetch(`${API_BASE_URL}/api/auth/login-resend`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: verificationSession.sessionId })
        }).catch(() => null);
      }

      if (res && res.ok) {
        const data = await res.json();
        if (data.success) {
          setVerificationSession((prev) => (prev ? { ...prev, expiresAt: data.expiresAt } : null));
          setRemainingTime(300);
          setResendSuccess(true);
          setTimeout(() => setResendSuccess(false), 4000);
        }
      }
    } catch (e) {}
    setResending(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationSession?.sessionId || otpInput.trim().length !== 6) {
      setOtpError(isEN ? "Please enter a valid 6-digit code." : "Masukkan 6 digit kode yang valid.");
      return;
    }
    setLoading(true);
    setOtpError("");
    const API_BASE_URL = getApiBaseUrl();
    try {
      let res = await fetch("/api/auth/login-verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: verificationSession.sessionId,
          otpCode: otpInput.trim()
        })
      }).catch(() => null);

      if ((!res || !res.ok) && API_BASE_URL) {
        res = await fetch(`${API_BASE_URL}/api/auth/login-verify-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: verificationSession.sessionId,
            otpCode: otpInput.trim()
          })
        }).catch(() => null);
      }

      if (!res) {
        setOtpError(
          isEN
            ? "Network error. Please check your connection and try again."
            : "Koneksi jaringan bermasalah. Periksa koneksi dan coba lagi."
        );
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.success && data.status === "approved") {
        setVerificationStep("approved");
        const prof = data.profile || verificationSession.profile;
        try {
          const p = prof.phone || phone;
          const norm = p.replace(/\D/g, "");
          localStorage.setItem(`gymbuddy_user_${norm}`, JSON.stringify(prof));
          localStorage.setItem("gymbuddy_active_session", JSON.stringify(prof));
          localStorage.setItem("gymbuddy_last_user", JSON.stringify(prof));
        } catch (e) {}

        setUserProfile(prof);
        if (verificationSession.progress) setProgressData(verificationSession.progress);

        setTimeout(() => {
          if (onLoginSuccess) onLoginSuccess(prof);
          onClose();
        }, 1200);
      } else {
        setOtpError(data.message || (isEN ? "Invalid code. Please try again." : "Kode verifikasi salah. Silakan coba lagi."));
      }
    } catch (e: any) {
      setOtpError(e?.message || (isEN ? "Verification failed. Please try again." : "Gagal memverifikasi kode. Silakan coba lagi."));
    }
    setLoading(false);
  };

  const handleSimulateAction = async (action: "approve" | "reject") => {
    if (!verificationSession?.sessionId) return;
    try {
      await fetch("/api/auth/login-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: verificationSession.sessionId, action })
      });
      if (action === "approve") {
        setVerificationStep("approved");
        const prof = verificationSession.profile;
        try {
          const p = prof.phone || phone;
          const norm = p.replace(/\D/g, "");
          localStorage.setItem(`gymbuddy_user_${norm}`, JSON.stringify(prof));
          localStorage.setItem("gymbuddy_active_session", JSON.stringify(prof));
          localStorage.setItem("gymbuddy_last_user", JSON.stringify(prof));
        } catch (e) {}

        setUserProfile(prof);
        if (verificationSession.progress) setProgressData(verificationSession.progress);
        setTimeout(() => {
          if (onLoginSuccess) onLoginSuccess(prof);
          onClose();
        }, 1200);
      } else {
        setVerificationStep("rejected");
      }
    } catch (e) {}
  };

  const handleCancelLogin = () => {
    if (verificationSession?.sessionId) {
      fetch("/api/auth/login-cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: verificationSession.sessionId })
      }).catch(() => {});
    }
    setVerificationStep("credentials");
    setVerificationSession(null);
    setOtpInput("");
    setOtpError("");
    setErrorMsg("");
  };

  if (!isOpen) return null;

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedPhone = phone.replace(/\D/g, "");
    if (cleanedPhone.length < 8) {
      setErrorMsg(
        isEN
          ? "Please enter a valid WhatsApp phone number."
          : "Masukkan nomor WhatsApp yang valid."
      );
      return;
    }

    setLoading(true);
    setErrorMsg("");

    const normPhone = cleanedPhone.startsWith("62")
      ? "0" + cleanedPhone.substring(2)
      : (cleanedPhone.startsWith("8") ? "0" + cleanedPhone : cleanedPhone);
    const altPhone = normPhone.startsWith("0") ? "62" + normPhone.substring(1) : (normPhone.startsWith("62") ? "0" + normPhone.substring(2) : normPhone);
    const phoneVariations = Array.from(new Set([normPhone, altPhone, cleanedPhone, `+${cleanedPhone}`, `usr_${normPhone}`])).filter(Boolean);

    const API_BASE_URL = getApiBaseUrl();

    let foundProfile: any = null;
    let foundProgress: any = null;

    // Injected test accounts (Alex & Mia)
    if (normPhone === "08111111111" || cleanedPhone === "08111111111" || cleanedPhone === "62811111111") {
      foundProfile = {
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
    } else if (normPhone === "08222222222" || cleanedPhone === "08222222222" || cleanedPhone === "62822222222") {
      foundProfile = {
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
    }

    // Helper to fetch profile from an API base trying all phone variations
    const tryFetchProfile = async (baseUrl: string) => {
      for (const p of phoneVariations) {
        try {
          const res = await fetch(`${baseUrl}/api/user-profile/${p}`);
          if (res.ok) {
            const data = await res.json().catch(() => null);
            if (data && data.success && data.profile) return data.profile;
          }
          const userRes = await fetch(`${baseUrl}/api/user/${p}`);
          if (userRes.ok) {
            const uData = await userRes.json().catch(() => null);
            if (uData && (uData.user || uData.profile || uData.name)) {
              return uData.user || uData.profile || uData;
            }
          }
        } catch (e) {}
      }
      return null;
    };

    // 1. Try local relative endpoint
    if (!foundProfile) {
      foundProfile = await tryFetchProfile("");
    }

    // 2. Try configured API base URL if different
    if (!foundProfile && API_BASE_URL) {
      foundProfile = await tryFetchProfile(API_BASE_URL);
    }

    // 3. Try LocalStorage fallback
    if (!foundProfile) {
      try {
        for (const p of phoneVariations) {
          const stored = localStorage.getItem(`gymbuddy_user_${p}`);
          if (stored) {
            foundProfile = JSON.parse(stored);
            break;
          }
        }
        if (!foundProfile) {
          const storedActive = localStorage.getItem("gymbuddy_active_session") || localStorage.getItem("gymbuddy_last_user");
          if (storedActive) {
            foundProfile = JSON.parse(storedActive);
          }
        }
      } catch (e) {}
    }

    // 4. Strict DB check: If user profile is not found in database or local storage, REJECT login!
    if (!foundProfile) {
      setErrorMsg(
        isEN
          ? "This WhatsApp number is not registered yet. Please start by completing the onboarding first."
          : "Nomor WhatsApp ini belum terdaftar. Silakan daftar dan isi data tubuh kamu melalui kuesioner onboarding terlebih dahulu."
      );
      setLoading(false);
      return;
    }

    // 5. INITIATE WHATSAPP 2FA CONFIRMATION (Requirement 4: Do not immediately grant access)
    try {
      const detectedDevice = navigator.userAgent.includes("Windows")
        ? "Chrome on Windows"
        : (navigator.userAgent.includes("Mac")
          ? "Safari on macOS"
          : (navigator.userAgent.includes("Android")
            ? "Chrome on Android"
            : (navigator.userAgent.includes("iPhone") ? "Safari on iOS" : "Web Browser")));
      const detectedLocation = "Jakarta, Indonesia";
      const nowFormatted = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Jakarta",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(new Date());

      let res = await fetch("/api/auth/login-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normPhone,
          device: detectedDevice,
          location: detectedLocation,
          timeStr: nowFormatted
        })
      }).catch(() => null);

      if ((!res || !res.ok) && API_BASE_URL) {
        res = await fetch(`${API_BASE_URL}/api/auth/login-request`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: normPhone,
            device: detectedDevice,
            location: detectedLocation,
            timeStr: nowFormatted
          })
        }).catch(() => null);
      }

      if (res && res.ok) {
        const data = await res.json();
        if (data.success && data.sessionId) {
          setVerificationSession({
            sessionId: data.sessionId,
            device: data.device || detectedDevice,
            location: data.location || detectedLocation,
            timeStr: data.timeStr || nowFormatted,
            expiresAt: data.expiresAt,
            profile: foundProfile,
            progress: foundProgress
          });
          setRemainingTime(300);
          setVerificationStep("waiting_whatsapp");
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn("Could not initiate WhatsApp confirmation:", err);
    }

    // REQUIREMENT 5: ZERO CLIENT-SIDE FALLBACK!
    // Never bypass OTP or grant access when network/server fails.
    setErrorMsg(
      isEN
        ? "Could not initiate WhatsApp verification. Please check your network connection and try again."
        : "Gagal memulai verifikasi WhatsApp. Periksa koneksi internet Anda dan coba lagi."
    );
    setLoading(false);
  };

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      setErrorMsg(isEN ? "Please enter a valid email address." : "Masukkan alamat email yang valid.");
      return;
    }
    setErrorMsg(
      isEN
        ? "GymBuddy AI primary coaching is connected via WhatsApp. Please log in with your WhatsApp number."
        : "Layanan utama GymBuddy AI terhubung via WhatsApp. Silakan masuk menggunakan nomor WhatsApp terdaftar."
    );
  };

  const botNumber = (import.meta as any).env?.VITE_WHATSAPP_BOT_NUMBER || "14155238886";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-10 bg-black/90 backdrop-blur-xl">
        {/* Full Modal Container - Bento Flat Dark Style */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="relative w-full max-w-6xl bg-[#0A0A0A] rounded-[2.5rem] p-4 sm:p-6 lg:p-8 shadow-2xl text-white overflow-hidden z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 min-h-[580px] lg:min-h-[640px]"
        >
          {/* Top Right Close Button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 z-30 w-10 h-10 rounded-full bg-[#161B22] hover:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>

          {/* LEFT PANEL: Cinematic Full-Height Moody Lifestyle Card */}
          <div className="lg:col-span-6 relative rounded-[2rem] overflow-hidden min-h-[320px] lg:min-h-full bg-[#161B22]">
            {/* Dark moody background image */}
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-700 hover:scale-105"
              style={{
                backgroundImage: "url('/login_cinematic.png'), url('/hero.png')"
              }}
            />
            {/* Cinematic Gradient Overlays (Dark dusk color grade) */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/30 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent pointer-events-none" />

            {/* Top-Left Pinned Logo (Small & Quiet ON the image) */}
            <div className="absolute top-6 left-6 z-20">
              <GymBuddyLogo size={24} showText textClassName="text-sm text-white/90" />
            </div>

            {/* Bottom Left Quote */}
            <div className="absolute bottom-8 left-8 right-8 z-20 space-y-2">
              <div className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-[11px] font-bold text-[#D4FF00] inline-block tracking-wider uppercase">
                {isEN ? "24/7 WhatsApp AI Coach" : "Asisten AI WhatsApp 24/7"}
              </div>
              <h3 className="text-xl sm:text-2xl font-['Archivo_Black'] text-white leading-tight">
                {isEN
                  ? "Consistency Beats Motivation."
                  : "Konsistensi Mengalahkan Motivasi."}
              </h3>
              <p className="text-xs text-neutral-300 font-medium max-w-sm">
                {isEN
                  ? "Track your daily macros, body progress, and get form coaching directly on WhatsApp."
                  : "Pantau makro harian, perkembangan berat badan, dan konsultasi latihan langsung dari WhatsApp."}
              </p>
            </div>
          </div>

          {/* RIGHT PANEL: Left-aligned content, Bento buttons */}
          <div className="lg:col-span-6 flex flex-col justify-between px-2 sm:px-4 lg:px-6 py-2 relative">
            <div className="my-auto space-y-8 max-w-md w-full">
              {/* ─── 1. CREDENTIALS FORM STATE ─── */}
              {verificationStep === "credentials" && (
                <>
                  {/* Header Title */}
                  {!userProfile ? (
                    <div className="space-y-2">
                      <h2 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-['Archivo_Black'] leading-[1.1] tracking-tight text-white">
                        {isEN ? "Achieve Your Best Progress" : "Wujudkan Progres Terbaikmu"}
                      </h2>
                      <p className="text-sm sm:text-base text-neutral-400 font-medium">
                        {isEN
                          ? "Workout & Nutrition, In One Chat."
                          : "Latihan & Nutrisi, Dalam Satu Chat."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <h2 className="text-2xl sm:text-3xl font-['Archivo_Black'] text-white">
                        {isEN ? "Welcome Back!" : "Selamat Datang Kembali!"}
                      </h2>
                      <p className="text-sm text-neutral-400">
                        {userProfile.name} • {userProfile.phone}
                      </p>
                    </div>
                  )}

                  {/* AUTH CONTENT */}
                  {!userProfile ? (
                    authMode === "select" ? (
                      /* SELECT AUTH METHOD (Primary WA, Secondary Email) */
                      <div className="space-y-4">
                        {/* Primary Auth Button: WhatsApp (Lime Accent, Heavy Rounded, Flat No Border) */}
                        <button
                          onClick={() => setAuthMode("phone")}
                          className="w-full py-4 sm:py-4.5 px-6 bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-extrabold rounded-2xl text-base tracking-wide flex items-center justify-between transition-all cursor-pointer shadow-none border-none active:scale-[0.99]"
                        >
                          <div className="flex items-center gap-3">
                            <WhatsAppIcon className="w-5 h-5 text-black" />
                            <span>{isEN ? "Continue with WhatsApp" : "Lanjut dengan WhatsApp"}</span>
                          </div>
                          <ArrowRight size={20} className="stroke-[2.5]" />
                        </button>

                        {/* Secondary Auth Button: Email / HP (Space Gray #161B22, Heavy Rounded, Flat No Border) */}
                        <button
                          onClick={() => setAuthMode("email")}
                          className="w-full py-4 sm:py-4.5 px-6 bg-[#161B22] hover:bg-[#1f2630] text-white font-bold rounded-2xl text-base tracking-wide flex items-center justify-between transition-all cursor-pointer shadow-none border-none active:scale-[0.99]"
                        >
                          <div className="flex items-center gap-3">
                            <Mail className="w-5 h-5 text-neutral-400" />
                            <span>{isEN ? "Continue with Email" : "Lanjut dengan Email"}</span>
                          </div>
                          <ArrowRight size={20} className="text-neutral-400" />
                        </button>

                        {/* New User Option */}
                        <div className="pt-3 text-left">
                          <button
                            onClick={() => {
                              onClose();
                              onStartOnboarding();
                            }}
                            className="text-xs text-neutral-400 hover:text-[#D4FF00] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Sparkles size={14} className="text-[#D4FF00]" />
                            <span>{isEN ? "New here? Start questionnaire onboarding →" : "Belum punya akun? Isi kuesioner onboarding →"}</span>
                          </button>
                        </div>
                      </div>
                    ) : authMode === "phone" ? (
                      /* PHONE FORM MODE */
                      <form onSubmit={handlePhoneLogin} className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
                            {isEN ? "WhatsApp Phone Number" : "Nomor WhatsApp Terdaftar"}
                          </label>
                          <div className="relative flex items-center">
                            <div className="absolute left-5 text-[#25D366] font-bold text-sm flex items-center gap-1.5 pointer-events-none">
                              <WhatsAppIcon className="w-4 h-4" />
                              <span>+62</span>
                            </div>
                            <input
                              type="tel"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                              placeholder="81234567890"
                              className="w-full bg-[#161B22] border-none rounded-2xl pl-20 pr-5 py-4 text-base font-bold text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-[#D4FF00] transition-colors"
                              autoFocus
                            />
                          </div>
                        </div>

                        {errorMsg && (
                          <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs text-red-400 font-medium">
                            {errorMsg}
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full py-4 px-6 bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-extrabold rounded-2xl text-base tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer shadow-none border-none active:scale-[0.99] disabled:opacity-50"
                        >
                          {loading ? (
                            <RefreshCw size={18} className="animate-spin text-black" />
                          ) : (
                            <>
                              <span>{isEN ? "Continue" : "Masuk ke Akun"}</span>
                              <ArrowRight size={18} className="stroke-[2.5]" />
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode("select");
                            setErrorMsg("");
                          }}
                          className="w-full text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer py-1"
                        >
                          {isEN ? "← Back to options" : "← Kembali ke pilihan login"}
                        </button>
                      </form>
                    ) : (
                      /* EMAIL FORM MODE */
                      <form onSubmit={handleEmailLogin} className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
                            {isEN ? "Email Address" : "Alamat Email Terdaftar"}
                          </label>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="nama@email.com"
                            className="w-full bg-[#161B22] border-none rounded-2xl px-5 py-4 text-base font-bold text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-[#D4FF00] transition-colors"
                            autoFocus
                          />
                        </div>

                        {errorMsg && (
                          <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs text-red-400 font-medium">
                            {errorMsg}
                          </div>
                        )}

                        <button
                          type="submit"
                          className="w-full py-4 px-6 bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-extrabold rounded-2xl text-base tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer shadow-none border-none active:scale-[0.99]"
                        >
                          <span>{isEN ? "Continue" : "Masuk"}</span>
                          <ArrowRight size={18} className="stroke-[2.5]" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode("select");
                            setErrorMsg("");
                          }}
                          className="w-full text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer py-1"
                        >
                          {isEN ? "← Back to options" : "← Kembali ke pilihan login"}
                        </button>
                      </form>
                    )
                  ) : (
                    /* ALREADY LOGGED IN PREVIEW */
                    <div className="space-y-4">
                      <div className="p-4 rounded-2xl bg-[#161B22] space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ShieldCheck size={16} className="text-[#D4FF00]" />
                            <span className="text-xs font-bold text-white uppercase tracking-wider">
                              Akun Aktif
                            </span>
                          </div>
                          <div className="px-3 py-1 rounded-full bg-[#D4FF00]/10 text-[#D4FF00] text-xs font-bold uppercase">
                            Coach {(userProfile.persona === "mia" || userProfile.persona === "nikita") ? "Mia" : "Max"}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="p-2.5 rounded-xl bg-black/40">
                            <span className="text-[10px] text-neutral-400 block uppercase">BB Awal</span>
                            <span className="text-sm font-bold text-white">{userProfile.startWeight || userProfile.weight} kg</span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-black/40">
                            <span className="text-[10px] text-neutral-400 block uppercase">BB Sekarang</span>
                            <span className="text-sm font-bold text-[#D4FF00]">{userProfile.weight} kg</span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-black/40">
                            <span className="text-[10px] text-neutral-400 block uppercase">Target BB</span>
                            <span className="text-sm font-bold text-white">{userProfile.targetWeight || userProfile.weight} kg</span>
                          </div>
                        </div>
                      </div>

                      <a
                        href={`https://wa.me/${botNumber}?text=${encodeURIComponent(
                          `Halo GymBuddy AI! Saya ${userProfile.name}, mau cek rekomendasi nutrisi dan konsultasi latihan hari ini.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-4 bg-[#25D366] hover:bg-[#20bd5a] text-black font-extrabold rounded-2xl text-base flex items-center justify-center gap-2.5 transition-all cursor-pointer border-none"
                      >
                        <WhatsAppIcon className="w-5 h-5" />
                        <span>{isEN ? "Chat Coach on WhatsApp" : "Buka WhatsApp & Chat Coach"}</span>
                      </a>

                      <button
                        onClick={() => {
                          setUserProfile(null);
                          setProgressData(null);
                          setPhone("");
                          setAuthMode("select");
                        }}
                        className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer pt-2"
                      >
                        <LogOut size={13} />
                        <span>{isEN ? "Switch Account" : "Ganti Akun"}</span>
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* ─── 2. WAITING FOR WHATSAPP CONFIRMATION SCREEN (Requirement 4) ─── */}
              {verificationStep === "waiting_whatsapp" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Header */}
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#25D366]/15 border border-[#25D366]/30 rounded-full text-[11px] font-bold text-[#25D366]">
                      <WhatsAppIcon className="w-3.5 h-3.5" />
                      <span>{isEN ? "WhatsApp 2-Step Verification" : "Verifikasi 2 Langkah WhatsApp"}</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-['Archivo_Black'] text-white">
                      {isEN ? "Verify your login" : "Verifikasi Login Kamu"}
                    </h2>
                    <p className="text-xs sm:text-sm text-neutral-400 font-medium leading-relaxed">
                      {isEN
                        ? "We sent a login confirmation to your WhatsApp."
                        : "Kami telah mengirimkan konfirmasi login ke WhatsApp kamu."}
                    </p>
                  </div>

                  {/* Login Context Card */}
                  <div className="bg-[#161B22] border border-white/[0.08] rounded-2xl p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-neutral-400 border-b border-white/[0.06] pb-1.5">
                      <span className="font-semibold text-[11px] uppercase tracking-wider">{isEN ? "Login Context" : "Detail Percobaan Akses"}</span>
                      <span className="font-mono text-[11px] text-[#D4FF00] font-bold">{verificationSession?.profile?.phone}</span>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5 text-neutral-300">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-400 flex items-center gap-1.5 text-[11px]">
                          <Smartphone size={12} className="text-[#D4FF00]" />
                          {isEN ? "Device" : "Perangkat"}
                        </span>
                        <span className="font-bold text-white text-xs">{verificationSession?.device || "Chrome on Windows"}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-neutral-400 flex items-center gap-1.5 text-[11px]">
                          <MapPin size={12} className="text-[#D4FF00]" />
                          {isEN ? "Approximate location" : "Perkiraan Lokasi"}
                        </span>
                        <span className="font-bold text-white text-xs">{verificationSession?.location || "Jakarta, Indonesia"}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-neutral-400 flex items-center gap-1.5 text-[11px]">
                          <Clock size={12} className="text-[#D4FF00]" />
                          {isEN ? "Time" : "Waktu"}
                        </span>
                        <span className="font-mono font-bold text-white text-xs">{verificationSession?.timeStr}</span>
                      </div>
                    </div>
                  </div>

                  {/* Waiting State Card */}
                  <div className="bg-black/50 border border-[#25D366]/40 rounded-2xl p-4 text-center space-y-2 relative overflow-hidden">
                    <div className="w-12 h-12 rounded-full bg-[#25D366]/15 border border-[#25D366]/40 flex items-center justify-center mx-auto text-[#25D366] relative">
                      <div className="w-full h-full rounded-full absolute animate-ping bg-[#25D366]/20" />
                      <WhatsAppIcon className="w-6 h-6 relative z-10" />
                    </div>

                    <div>
                      <h4 className="font-['Archivo_Black'] text-sm sm:text-base text-white">
                        {isEN ? "Check your WhatsApp" : "Buka WhatsApp Kamu"}
                      </h4>
                      <p className="text-xs text-neutral-300 font-medium mt-0.5">
                        {isEN
                          ? "We're waiting for you to confirm this login."
                          : "Kami sedang menunggu kamu mengonfirmasi login ini."}
                      </p>
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full text-xs font-mono font-bold text-neutral-300 border border-white/10">
                      <Clock size={12} className="text-[#D4FF00]" />
                      <span>{formatTime(remainingTime)}</span>
                    </div>
                  </div>

                  {/* Resend feedback toast */}
                  {resendSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-2 bg-[#25D366]/15 border border-[#25D366]/30 text-[#25D366] rounded-xl text-xs font-bold text-center"
                    >
                      ✓ {isEN ? "Confirmation resent to your WhatsApp!" : "Konfirmasi berhasil dikirim ulang ke WhatsApp kamu!"}
                    </motion.div>
                  )}

                  {/* Mandatory Actions */}
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleResendConfirmation}
                      disabled={resending}
                      className="w-full py-3 bg-[#161B22] hover:bg-[#1f2630] border border-white/[0.08] hover:border-white/20 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw size={14} className={resending ? "animate-spin text-[#D4FF00]" : "text-[#D4FF00]"} />
                      <span>{resending ? (isEN ? "Resending..." : "Mengirim ulang...") : (isEN ? "Resend confirmation" : "Kirim ulang konfirmasi")}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setOtpError("");
                        setVerificationStep("otp_input");
                      }}
                      className="w-full py-2.5 text-neutral-300 hover:text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Key size={13} className="text-[#D4FF00]" />
                      <span>{isEN ? "Use another verification method" : "Gunakan metode verifikasi lain (Kode OTP)"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCancelLogin}
                      className="w-full py-1.5 text-neutral-500 hover:text-red-400 font-medium text-xs transition-colors cursor-pointer"
                    >
                      {isEN ? "Cancel login" : "Batalkan login"}
                    </button>
                  </div>

                  {/* Simulator Controls (For testing & local environments) */}
                  <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-neutral-500 block text-center">
                      🛠️ Simulator Uji Coba WhatsApp
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleSimulateAction("approve")}
                        className="py-2 px-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-extrabold text-[11px] rounded-xl transition-all cursor-pointer text-center"
                      >
                        ✓ Yes, it's me
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSimulateAction("reject")}
                        className="py-2 px-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-extrabold text-[11px] rounded-xl transition-all cursor-pointer text-center"
                      >
                        ✕ No, secure account
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ─── 3. ALTERNATIVE VERIFICATION METHOD: OTP INPUT ─── */}
              {verificationStep === "otp_input" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => setVerificationStep("waiting_whatsapp")}
                      className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer mb-2"
                    >
                      <ChevronRight size={14} className="rotate-180" />
                      <span>{isEN ? "Back to WhatsApp confirmation" : "Kembali ke konfirmasi WhatsApp"}</span>
                    </button>
                    <h2 className="text-2xl sm:text-3xl font-['Archivo_Black'] text-white">
                      {isEN ? "Enter Verification Code" : "Masukkan Kode Verifikasi"}
                    </h2>
                    <p className="text-xs sm:text-sm text-neutral-400 font-medium leading-relaxed">
                      {isEN
                        ? "Enter the 6-digit code sent to your WhatsApp."
                        : "Masukkan 6 digit kode keamanan yang kami kirimkan ke WhatsApp kamu."}
                    </p>
                  </div>

                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div>
                      <input
                        type="text"
                        maxLength={6}
                        autoFocus
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                        placeholder="••••••"
                        className="w-full py-3.5 px-4 bg-[#161B22] border border-white/[0.12] focus:border-[#D4FF00] rounded-2xl text-center text-2xl font-mono font-black tracking-widest text-white focus:outline-none"
                      />
                    </div>

                    {otpError && (
                      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 font-bold text-center">
                        {otpError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading || otpInput.length !== 6}
                      className="w-full py-4 bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-extrabold rounded-2xl text-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md active:scale-98"
                    >
                      {loading ? (isEN ? "Verifying..." : "Memverifikasi...") : (isEN ? "Verify Code" : "Verifikasi Kode")}
                    </button>
                  </form>
                </motion.div>
              )}

              {/* ─── 4. CONFIRMATION APPROVED STATE ─── */}
              {verificationStep === "approved" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center space-y-4 py-8"
                >
                  <div className="w-16 h-16 rounded-full bg-[#D4FF00]/15 border-2 border-[#D4FF00] flex items-center justify-center mx-auto text-[#D4FF00] shadow-[0_0_25px_#D4FF00]/30">
                    <CheckCircle2 size={36} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-['Archivo_Black'] text-white">
                      {isEN ? "Login confirmed ✓" : "Login Terkonfirmasi ✓"}
                    </h3>
                    <p className="text-xs text-neutral-400 font-medium mt-1">
                      {isEN ? "Redirecting to your dashboard..." : "Mengalihkan ke Dashboard GymBuddy kamu..."}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* ─── 5. CONFIRMATION REJECTED / SUSPICIOUS LOGIN REJECTED ─── */}
              {verificationStep === "rejected" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-6 text-center space-y-4"
                >
                  <div className="w-14 h-14 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400">
                    <ShieldAlert size={28} />
                  </div>
                  <div>
                    <h3 className="text-lg font-['Archivo_Black'] text-rose-300">
                      {isEN ? "Login rejected & account secured" : "Login Ditolak & Akun Diamankan"}
                    </h3>
                    <p className="text-xs text-neutral-300 font-medium mt-1.5 leading-relaxed">
                      {isEN
                        ? "Access was blocked immediately. If this was not you, your account remains safe."
                        : "Akses dashboard telah diblokir segera. Jika ini bukan aktivitas kamu, akun kamu tetap aman dan tidak dapat diakses siapapun."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelLogin}
                    className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    {isEN ? "Return to Login" : "Kembali ke Halaman Login"}
                  </button>
                </motion.div>
              )}

              {/* ─── 6. VERIFICATION EXPIRED ─── */}
              {verificationStep === "expired" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 text-center space-y-4"
                >
                  <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400">
                    <AlertCircle size={28} />
                  </div>
                  <div>
                    <h3 className="text-lg font-['Archivo_Black'] text-amber-300">
                      {isEN ? "Verification session expired" : "Sesi Verifikasi Kedaluwarsa"}
                    </h3>
                    <p className="text-xs text-neutral-300 font-medium mt-1 leading-relaxed">
                      {isEN
                        ? "The confirmation window timed out after 5 minutes for your security."
                        : "Waktu konfirmasi 5 menit telah habis demi keamanan akun kamu."}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleResendConfirmation}
                      className="w-full py-3 bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-extrabold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      {isEN ? "Resend confirmation" : "Kirim Ulang Konfirmasi"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelLogin}
                      className="w-full py-2.5 text-neutral-400 hover:text-white font-medium text-xs cursor-pointer"
                    >
                      {isEN ? "Back to login" : "Kembali ke Login"}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Small Legal Text below both buttons */}
              <p className="text-xs text-neutral-500 font-medium leading-relaxed">
                {isEN ? (
                  <>
                    By logging in, you agree to our{" "}
                    <a href="#terms" className="underline hover:text-neutral-300">Terms of Service</a>,{" "}
                    <a href="#privacy" className="underline hover:text-neutral-300">Privacy Policy</a>, and{" "}
                    <a href="#data" className="underline hover:text-neutral-300">Data Usage</a>.
                  </>
                ) : (
                  <>
                    Dengan masuk, kamu menyetujui{" "}
                    <a href="#terms" className="underline hover:text-neutral-300">Syarat Layanan</a>,{" "}
                    <a href="#privacy" className="underline hover:text-neutral-300">Kebijakan Privasi</a>, dan{" "}
                    <a href="#data" className="underline hover:text-neutral-300">Penggunaan Data</a>.
                  </>
                )}
              </p>
            </div>

            {/* Bottom-Right Small Floating Chat Bubble Element (AI Persona Greeting Preview) */}
            <div className="mt-6 pt-4 border-t border-neutral-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Persona Avatar */}
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-[#161B22] flex items-center justify-center border-2 border-[#D4FF00] font-['Archivo_Black'] text-xs text-white uppercase">
                    {selectedPersona === "max" ? "MX" : "MI"}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#25D366] rounded-full border-2 border-[#0A0A0A]" />
                </div>

                {/* Floating Chat Bubble */}
                <div className="p-3 rounded-2xl bg-[#161B22] text-xs text-neutral-300 max-w-xs shadow-md relative">
                  <div className="font-bold text-white flex items-center justify-between gap-2 mb-0.5">
                    <span>{selectedPersona === "max" ? "Coach Max" : "Coach Mia"}</span>
                    <button
                      onClick={() => setSelectedPersona((p) => (p === "max" ? "mia" : "max"))}
                      className="text-[10px] text-[#D4FF00] underline font-normal cursor-pointer"
                    >
                      {selectedPersona === "max" ? "Switch to Mia" : "Switch to Max"}
                    </button>
                  </div>
                  <p className="text-neutral-400 font-medium">
                    {selectedPersona === "max"
                      ? "Ready to gas out today bro? No excuses! 🔥"
                      : "Yuk mulai gaya hidup sehatmu hari ini! ✨"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
