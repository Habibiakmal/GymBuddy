import React, { useState, useEffect, useRef } from "react";
import { notificationService } from "../services/notificationService";

interface WatchModeProps {
  user: any;
  onExit: () => void;
}

// Detect if we're on a small watch-like viewport
const isWatchScreen = () =>
  typeof window !== "undefined" && window.innerWidth <= 220;

export default function WatchMode({ user: initialUser, onExit }: WatchModeProps) {
  // ─── User Resolution ───────────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState<any>(() => {
    if (initialUser?.name) return initialUser;
    try {
      const stored = localStorage.getItem("gymbuddy_active_session");
      if (stored) return JSON.parse(stored);
    } catch {}
    try {
      const p = new URLSearchParams(window.location.search);
      const phone = p.get("phone") || p.get("u");
      const name = p.get("name") || p.get("n");
      if (phone || name) {
        const profile = { name: name ? decodeURIComponent(name) : "Member", phone: phone || "guest", goal: p.get("goal") || "muscle", persona: "max" };
        localStorage.setItem("gymbuddy_active_session", JSON.stringify(profile));
        return profile;
      }
    } catch {}
    return null;
  });

  // ─── Exercises ─────────────────────────────────────────────────────────────
  const defaultExercises = [
    { name: "Bench Press", targetSets: 4, completedSets: 0, reps: "8-10 reps", cue: "Tancepin kaki!" },
    { name: "Incline DB Press", targetSets: 4, completedSets: 0, reps: "10-12 reps", cue: "Busungin dada atas!" },
    { name: "Lat Pulldown", targetSets: 4, completedSets: 0, reps: "10-12 reps", cue: "Siku ke bawah!" },
    { name: "Tricep Pushdown", targetSets: 3, completedSets: 0, reps: "12-15 reps", cue: "Kunci siku!" },
  ];
  const [exercises, setExercises] = useState(defaultExercises);
  const [exIdx, setExIdx] = useState(0);

  // ─── Rest Timer ────────────────────────────────────────────────────────────
  const [restSecs, setRestSecs] = useState(60);
  const [initRest, setInitRest] = useState(60);
  const [timerOn, setTimerOn] = useState(false);
  const timerRef = useRef<any>(null);

  // ─── Metrics ───────────────────────────────────────────────────────────────
  const [water, setWater] = useState(1250);
  const [kcal, setKcal] = useState(245);
  const [bpm, setBpm] = useState(128);
  const [page, setPage] = useState<"workout" | "metrics">("workout");

  const ex = exercises[exIdx];
  const allDone = ex.completedSets >= ex.targetSets;
  const progress = Math.round((ex.completedSets / ex.targetSets) * 100);
  const timerProgress = ((initRest - restSecs) / initRest) * 100;

  // BPM simulation
  useEffect(() => {
    const iv = setInterval(() => setBpm(p => Math.min(165, Math.max(115, p + Math.floor(Math.random() * 5) - 2))), 3000);
    return () => clearInterval(iv);
  }, []);

  // Timer countdown
  useEffect(() => {
    if (timerOn && restSecs > 0) {
      timerRef.current = setTimeout(() => setRestSecs(s => s - 1), 1000);
    } else if (timerOn && restSecs === 0) {
      setTimerOn(false);
      notificationService.triggerHaptic([400, 100, 400, 100, 600]);
      notificationService.playAlertSound("timer");
    }
    return () => clearTimeout(timerRef.current);
  }, [timerOn, restSecs]);

  // Complete set handler
  const completeSet = () => {
    if (allDone) return;
    notificationService.triggerHaptic([80, 40, 120]);
    setExercises(prev => {
      const upd = [...prev];
      upd[exIdx] = { ...upd[exIdx], completedSets: upd[exIdx].completedSets + 1 };
      return upd;
    });
    setKcal(k => k + 14);
    setRestSecs(initRest);
    setTimerOn(true);
  };

  // Quick-start guest if no user
  if (!currentUser) {
    return (
      <div style={S.root}>
        <div style={{ ...S.card, textAlign: "center", padding: "24px 16px" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⌚</div>
          <div style={{ fontWeight: 900, fontSize: 14, color: "#fff", marginBottom: 6 }}>GymBuddy Watch</div>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 16, lineHeight: 1.4 }}>
            Mulai workout tanpa login
          </div>
          <button
            style={S.btnPrimary}
            onClick={() => {
              const g = { name: "Athlete", phone: "guest", goal: "muscle", persona: "max" };
              setCurrentUser(g);
              try { localStorage.setItem("gymbuddy_active_session", JSON.stringify(g)); } catch {}
            }}
          >
            ▶ Mulai Sekarang
          </button>
          <button style={{ ...S.btnGhost, marginTop: 8 }} onClick={onExit}>
            Kembali ke Web
          </button>
        </div>
      </div>
    );
  }

  // ─── TIMER FULLSCREEN (when timer is running) ─────────────────────────────
  if (timerOn) {
    const mins = Math.floor(restSecs / 60);
    const secs = restSecs % 60;
    const circ = 2 * Math.PI * 50; // r=50
    return (
      <div style={{ ...S.root, justifyContent: "space-between" }}>
        {/* Label */}
        <div style={{ textAlign: "center", paddingTop: 8 }}>
          <div style={{ fontSize: 10, color: "#888", letterSpacing: 2, fontWeight: 700, textTransform: "uppercase" }}>
            Istirahat
          </div>
          <div style={{ fontSize: 10, color: "#D4FF00", fontWeight: 700, marginTop: 2 }}>
            {ex.name}
          </div>
        </div>

        {/* Big circular timer */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
          <div style={{ position: "relative", width: 120, height: 120 }}>
            <svg width="120" height="120" style={{ position: "absolute", top: 0, left: 0, transform: "rotate(-90deg)" }}>
              <circle cx="60" cy="60" r="50" fill="none" stroke="#1a1a1a" strokeWidth="8" />
              <circle
                cx="60" cy="60" r="50" fill="none" stroke="#D4FF00" strokeWidth="8"
                strokeDasharray={circ}
                strokeDashoffset={circ - (circ * timerProgress / 100)}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#fff", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {mins > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : secs}
              </div>
              <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
                {mins > 0 ? "menit" : "detik"}
              </div>
            </div>
          </div>
        </div>

        {/* Skip rest button */}
        <div style={{ padding: "0 12px 12px" }}>
          <button
            style={{ ...S.btnPrimary, backgroundColor: "#1a1a1a", color: "#D4FF00", border: "1px solid #D4FF00" }}
            onClick={() => { setTimerOn(false); setRestSecs(initRest); }}
          >
            Skip Istirahat →
          </button>
        </div>
      </div>
    );
  }

  // ─── METRICS PAGE ─────────────────────────────────────────────────────────
  if (page === "metrics") {
    return (
      <div style={{ ...S.root, justifyContent: "space-between" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px 0" }}>
          <button style={S.iconBtn} onClick={() => setPage("workout")}>←</button>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#888", letterSpacing: 1.5, textTransform: "uppercase" }}>Stats</div>
          <div style={{ width: 28 }} />
        </div>

        {/* Metric blocks */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, padding: "12px" }}>
          {/* BPM */}
          <div style={S.metricBlock}>
            <div style={{ fontSize: 10, color: "#ff6b6b", fontWeight: 700, letterSpacing: 1 }}>❤ BPM</div>
            <div style={{ fontSize: 36, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{bpm}</div>
          </div>
          {/* Calories */}
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ ...S.metricBlock, flex: 1 }}>
              <div style={{ fontSize: 10, color: "#ff9500", fontWeight: 700, letterSpacing: 1 }}>🔥 KCAL</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{kcal}</div>
            </div>
            <div style={{ ...S.metricBlock, flex: 1 }}>
              <div style={{ fontSize: 10, color: "#30d158", fontWeight: 700, letterSpacing: 1 }}>💧 AIR</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{water}</div>
              <div style={{ fontSize: 9, color: "#888" }}>ml</div>
            </div>
          </div>
        </div>

        {/* Add water */}
        <div style={{ padding: "0 12px 12px" }}>
          <button
            style={{ ...S.btnPrimary, backgroundColor: "#0a3a4a", color: "#30d158", border: "1px solid #30d158" }}
            onClick={() => { setWater(w => w + 250); notificationService.triggerHaptic([60]); }}
          >
            + 250 ml Air
          </button>
        </div>
      </div>
    );
  }

  // ─── WORKOUT MAIN PAGE ────────────────────────────────────────────────────
  return (
    <div style={{ ...S.root, justifyContent: "space-between" }}>

      {/* ── TOP: Nav + Exercise name ── */}
      <div>
        {/* Exercise nav strip */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px 0" }}>
          <button
            style={S.iconBtn}
            onClick={() => setExIdx(i => (i > 0 ? i - 1 : exercises.length - 1))}
          >
            ‹
          </button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#888", letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase" }}>
              {exIdx + 1} / {exercises.length}
            </div>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", lineHeight: 1.2, maxWidth: 140, textAlign: "center" }}>
              {ex.name}
            </div>
            <div style={{ fontSize: 10, color: "#888", marginTop: 1 }}>{ex.reps}</div>
          </div>
          <button
            style={S.iconBtn}
            onClick={() => setExIdx(i => (i < exercises.length - 1 ? i + 1 : 0))}
          >
            ›
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ margin: "6px 12px 0", height: 3, backgroundColor: "#1a1a1a", borderRadius: 2 }}>
          <div style={{ height: 3, width: `${progress}%`, backgroundColor: allDone ? "#30d158" : "#D4FF00", borderRadius: 2, transition: "width 0.4s" }} />
        </div>
      </div>

      {/* ── MIDDLE: Set dots ── */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        {/* Set indicators */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          {Array.from({ length: ex.targetSets }).map((_, i) => {
            const done = i < ex.completedSets;
            return (
              <div
                key={i}
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  backgroundColor: done ? "#D4FF00" : "#1c1c1e",
                  border: done ? "none" : "1.5px solid #333",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: done ? 14 : 12,
                  fontWeight: 900,
                  color: done ? "#000" : "#555",
                  transition: "all 0.3s",
                }}
              >
                {done ? "✓" : i + 1}
              </div>
            );
          })}
        </div>

        {/* Coach cue */}
        <div style={{ fontSize: 10, color: "#666", fontStyle: "italic", textAlign: "center", padding: "0 16px" }}>
          "{ex.cue}"
        </div>
      </div>

      {/* ── BOTTOM: Actions ── */}
      <div style={{ padding: "0 10px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
        {/* Main CTA */}
        <button
          style={{
            ...S.btnPrimary,
            backgroundColor: allDone ? "#1a3a25" : "#D4FF00",
            color: allDone ? "#30d158" : "#000",
            border: allDone ? "1.5px solid #30d158" : "none",
            fontSize: 13,
            padding: "14px",
          }}
          onClick={completeSet}
          disabled={allDone}
        >
          {allDone ? "✓ Semua Set Selesai!" : `✓ Set ${ex.completedSets + 1} Selesai`}
        </button>

        {/* Quick actions row */}
        <div style={{ display: "flex", gap: 6 }}>
          {/* Rest timer quick launch */}
          <button
            style={{ ...S.btnGhost, flex: 1, fontSize: 11, padding: "8px 4px" }}
            onClick={() => { setRestSecs(initRest); setTimerOn(true); notificationService.triggerHaptic([40]); }}
          >
            ⏱ {initRest}s
          </button>
          {/* Switch to 90s */}
          <button
            style={{ ...S.btnGhost, flex: 1, fontSize: 11, padding: "8px 4px" }}
            onClick={() => { setInitRest(initRest === 60 ? 90 : 60); notificationService.triggerHaptic([30]); }}
          >
            {initRest === 60 ? "→ 90s" : "→ 60s"}
          </button>
          {/* Stats */}
          <button
            style={{ ...S.btnGhost, flex: 1, fontSize: 11, padding: "8px 4px" }}
            onClick={() => setPage("metrics")}
          >
            ♥ {bpm}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared styles (native watchOS feel) ─────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100dvh",
    backgroundColor: "#000",
    color: "#fff",
    fontFamily: "-apple-system, 'SF Pro Rounded', 'SF Pro Text', system-ui, sans-serif",
    display: "flex",
    flexDirection: "column",
    overscrollBehavior: "none",
    WebkitUserSelect: "none",
    userSelect: "none",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  },
  card: {
    backgroundColor: "#1c1c1e",
    borderRadius: 16,
    margin: 12,
    padding: "14px 12px",
  },
  metricBlock: {
    backgroundColor: "#1c1c1e",
    borderRadius: 14,
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  btnPrimary: {
    width: "100%",
    padding: "12px",
    borderRadius: 14,
    backgroundColor: "#D4FF00",
    color: "#000",
    fontWeight: 900,
    fontSize: 12,
    border: "none",
    cursor: "pointer",
    letterSpacing: 0.3,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  },
  btnGhost: {
    width: "100%",
    padding: "10px",
    borderRadius: 12,
    backgroundColor: "#1c1c1e",
    color: "#aaa",
    fontWeight: 700,
    fontSize: 12,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    backgroundColor: "#1c1c1e",
    color: "#fff",
    fontWeight: 900,
    fontSize: 16,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  },
};
