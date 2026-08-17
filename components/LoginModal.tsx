import React, { useState } from "react";
import GymBuddyLogo from "./Logo";
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
  ChevronRight
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
  onStartOnboarding: () => void;
  onLoginSuccess?: (profile: any) => void;
  onResetData?: () => void;
}

export default function LoginModal({
  isOpen,
  onClose,
  language = "EN",
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

    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-zfft.onrender.com";

    let foundProfile: any = null;
    let foundProgress: any = null;

    // Helper to fetch profile from an API base
    const tryFetchProfile = async (baseUrl: string) => {
      try {
        const res = await fetch(`${baseUrl}/api/user-profile/${normPhone}`);
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data && data.success && data.profile) return data.profile;
        }
        const userRes = await fetch(`${baseUrl}/api/user/${normPhone}`);
        if (userRes.ok) {
          const uData = await userRes.json().catch(() => null);
          if (uData && (uData.user || uData.profile || uData.name)) {
            return uData.user || uData.profile || uData;
          }
        }
      } catch (e) {}
      return null;
    };

    // 1. Try local relative endpoint
    foundProfile = await tryFetchProfile("");

    // 2. Try configured environment API or external fallback URL
    if (!foundProfile) {
      const envUrl = (import.meta as any).env?.VITE_API_URL || "https://gymbuddy-backend-zfft.onrender.com";
      foundProfile = await tryFetchProfile(envUrl);
    }

    // 3. Try LocalStorage fallback
    if (!foundProfile) {
      try {
        const stored = localStorage.getItem(`gymbuddy_user_${normPhone}`) || localStorage.getItem("gymbuddy_last_user") || localStorage.getItem("gymbuddy_active_session");
        if (stored) {
          foundProfile = JSON.parse(stored);
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

    setUserProfile(foundProfile);
    if (foundProgress) setProgressData(foundProgress);
    if (onLoginSuccess) {
      onLoginSuccess(foundProfile);
    }
    onClose();
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
                      <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 space-y-2.5">
                        <div className="flex items-start gap-2.5">
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                          <span className="font-semibold leading-relaxed">{errorMsg}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onStartOnboarding();
                          }}
                          className="w-full py-2.5 px-4 bg-[#D4FF00] hover:bg-[#c4ec00] text-black font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all border-none"
                        >
                          <Sparkles size={14} />
                          <span>{isEN ? "Start Onboarding Now →" : "Daftar / Mulai Onboarding Sekarang →"}</span>
                        </button>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading || phone.trim().length < 8}
                      className={`w-full py-4 rounded-2xl font-extrabold text-base tracking-wide flex items-center justify-between px-6 transition-all cursor-pointer border-none ${
                        phone.trim().length >= 8 && !loading
                          ? "bg-[#D4FF00] text-black hover:bg-[#c4ec00]"
                          : "bg-[#161B22] text-neutral-600 cursor-not-allowed"
                      }`}
                    >
                      <span>{isEN ? "Log In to Dashboard" : "Masuk ke Dashboard"}</span>
                      {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ArrowRight size={20} />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setAuthMode("select")}
                      className="text-xs text-neutral-400 hover:text-white pt-2 block cursor-pointer"
                    >
                      ← {isEN ? "Choose another option" : "Pilih opsi login lain"}
                    </button>
                  </form>
                ) : (
                  /* EMAIL FORM MODE */
                  <form onSubmit={handleEmailLogin} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
                        {isEN ? "Email Address" : "Alamat Email"}
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
                      <div className="p-4 rounded-2xl bg-red-500/10 text-xs text-red-400 flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <span>{errorMsg}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full py-4 rounded-2xl bg-[#161B22] hover:bg-[#1f2630] text-white font-extrabold text-base tracking-wide flex items-center justify-between px-6 transition-all cursor-pointer border-none"
                    >
                      <span>{isEN ? "Continue with Email" : "Lanjut dengan Email"}</span>
                      <ArrowRight size={20} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setAuthMode("select")}
                      className="text-xs text-neutral-400 hover:text-white pt-2 block cursor-pointer"
                    >
                      ← {isEN ? "Choose another option" : "Pilih opsi login lain"}
                    </button>
                  </form>
                )
              ) : (
                /* USER LOGGED IN DASHBOARD */
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-[#161B22] space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                      <div>
                        <h4 className="text-lg font-['Archivo_Black'] text-white">{userProfile.name}</h4>
                        <span className="text-xs text-[#25D366] font-medium">{userProfile.phone}</span>
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
                      `Halo GymBuddy AI! 👋 Saya ${userProfile.name}, mau cek rekomendasi nutrisi dan konsultasi latihan hari ini.`
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
