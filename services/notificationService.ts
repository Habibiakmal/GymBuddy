// GymBuddy PWA Notification Service
// Handles native push notifications, local reminders, rest timer alerts, and Apple Watch / Smartwatch mirroring

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  vibrate?: number[];
  data?: any;
  actions?: Array<{ action: string; title: string; icon?: string }>;
}

export class GymBuddyNotificationService {
  private static instance: GymBuddyNotificationService;
  private schedulerTimers: Map<string, ReturnType<typeof setTimeout | typeof setInterval>> = new Map();

  private constructor() {}

  public static getInstance(): GymBuddyNotificationService {
    if (!GymBuddyNotificationService.instance) {
      GymBuddyNotificationService.instance = new GymBuddyNotificationService();
    }
    return GymBuddyNotificationService.instance;
  }

  // ─── Permission & Support ──────────────────────────────────────────────────

  public isSupported(): boolean {
    return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
  }

  public getPermission(): NotificationPermission {
    if (!this.isSupported()) return "denied";
    return Notification.permission;
  }

  public async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      return false;
    }
  }

  // ─── Haptic & Audio ───────────────────────────────────────────────────────

  public triggerHaptic(pattern: number[] = [100, 50, 100]): void {
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(pattern);
      }
    } catch (e) {}
  }

  public playAlertSound(type: "timer" | "complete" | "reminder" = "timer"): void {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === "timer") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.5);
      } else if (type === "complete") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.5);
      } else {
        // gentle chime for reminders
        osc.type = "sine";
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.18); // E5
        osc.frequency.setValueAtTime(784, audioCtx.currentTime + 0.36); // G5
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.8);
      }
    } catch (e) {}
  }

  // ─── Core Notification Sender ─────────────────────────────────────────────

  public async sendNotification(payload: NotificationPayload): Promise<boolean> {
    if (!this.isSupported()) return false;
    if (this.getPermission() !== "granted") {
      const granted = await this.requestPermission();
      if (!granted) return false;
    }

    this.triggerHaptic(payload.vibrate || [100, 80, 100]);

    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration && "showNotification" in registration) {
        await registration.showNotification(payload.title, {
          body: payload.body,
          icon: payload.icon || "/icon-192.png",
          badge: payload.badge || "/favicon.png",
          tag: payload.tag || "gymbuddy-general",
          vibrate: payload.vibrate || [200, 100, 200, 100, 200],
          data: payload.data || { url: "/" },
          actions: payload.actions || [
            { action: "open", title: "Buka GymBuddy 💪" }
          ]
        } as any);
        return true;
      }
    } catch (e) {
      try {
        new Notification(payload.title, {
          body: payload.body,
          icon: payload.icon || "/icon-192.png",
          tag: payload.tag
        });
        return true;
      } catch (err) {}
    }
    return false;
  }

  // ─── REST TIMER ALERT ─────────────────────────────────────────────────────

  public scheduleRestTimerAlert(seconds: number, exerciseName: string): void {
    const id = `rest-${Date.now()}`;
    const timer = setTimeout(() => {
      this.playAlertSound("timer");
      this.triggerHaptic([300, 150, 300, 150, 400]);
      this.sendNotification({
        title: "⏱️ Istirahat Selesai!",
        body: `${seconds}s sudah habis. Lanjut ${exerciseName}? Siap set berikutnya! 🔥`,
        tag: "rest-timer",
        icon: "/icon-192.png",
        vibrate: [300, 150, 300, 150, 400],
        actions: [{ action: "open", title: "Buka GymBuddy 💪" }]
      });
      this.schedulerTimers.delete(id);
    }, seconds * 1000);
    this.schedulerTimers.set(id, timer as any);
  }

  // ─── DAILY WORKOUT SCHEDULER ──────────────────────────────────────────────
  // Schedules a workout reminder at a specific hour:minute each day.
  // Works as long as the PWA tab is open / background on Android.
  // On iOS, only fires if app is open (iOS limitation for web push).

  public startDailyWorkoutScheduler(
    userName: string = "Bro",
    workoutFocus: string = "Latihan Hari Ini",
    targetHour: number = 7,
    targetMinute: number = 0
  ): void {
    const key = "daily-workout";
    if (this.schedulerTimers.has(key)) return; // already running

    const scheduleNext = () => {
      const now = new Date();
      const next = new Date();
      next.setHours(targetHour, targetMinute, 0, 0);
      if (next <= now) {
        next.setDate(next.getDate() + 1); // schedule tomorrow
      }
      const msUntil = next.getTime() - now.getTime();

      const timer = setTimeout(async () => {
        this.playAlertSound("reminder");
        this.triggerHaptic([200, 100, 200, 100, 200]);
        await this.sendNotification({
          title: `🏋️ Selamat pagi, ${userName}!`,
          body: `Jadwal hari ini: ${workoutFocus}. Waktunya push batas kemampuanmu! 💪`,
          tag: "daily-workout-reminder",
          icon: "/icon-192.png",
          vibrate: [200, 100, 200, 100, 200],
          actions: [
            { action: "open", title: "Mulai Latihan 🔥" }
          ]
        });
        scheduleNext(); // reschedule for tomorrow
      }, msUntil);

      this.schedulerTimers.set(key, timer as any);
    };

    scheduleNext();
  }

  // ─── HYDRATION SCHEDULER ──────────────────────────────────────────────────
  // Sends a water reminder every N hours (default: every 2 hours, 8am-8pm).

  public startHydrationScheduler(intervalHours: number = 2): void {
    const key = "hydration";
    if (this.schedulerTimers.has(key)) return;

    const sendReminder = async () => {
      const hour = new Date().getHours();
      if (hour >= 8 && hour <= 20) { // only during waking hours
        this.triggerHaptic([80, 60, 80]);
        await this.sendNotification({
          title: "💧 Jangan Lupa Minum Air!",
          body: "Hidrasi yang cukup = performa latihan & recovery otot lebih cepat. Minum 250ml sekarang! 🥤",
          tag: "hydration-reminder",
          icon: "/icon-192.png",
          vibrate: [150, 80, 150],
          actions: [
            { action: "open", title: "Log Minum 💧" }
          ]
        });
      }
    };

    // First reminder after 30 minutes
    const firstTimer = setTimeout(() => {
      sendReminder();
      // Then every N hours
      const iv = setInterval(sendReminder, intervalHours * 60 * 60 * 1000);
      this.schedulerTimers.set(key, iv as any);
    }, 30 * 60 * 1000);

    this.schedulerTimers.set(`${key}-first`, firstTimer as any);
  }

  // ─── STREAK REMINDER ──────────────────────────────────────────────────────
  // Fires if the user hasn't logged anything by 8pm.

  public scheduleStreakReminder(userName: string = "Bro"): void {
    const key = "streak-reminder";
    if (this.schedulerTimers.has(key)) return;

    const now = new Date();
    const target = new Date();
    target.setHours(20, 0, 0, 0);
    if (target <= now) return; // past 8pm already

    const msUntil = target.getTime() - now.getTime();

    const timer = setTimeout(async () => {
      this.triggerHaptic([100, 80, 100, 80, 200]);
      await this.sendNotification({
        title: `🔥 Streak kamu terancam, ${userName}!`,
        body: "Belum ada catatan latihan hari ini. Masih ada waktu, yuk catat satu sesi cepat biar streak-mu aman! 💪",
        tag: "streak-reminder",
        icon: "/icon-192.png",
        vibrate: [100, 80, 100, 80, 200],
        actions: [
          { action: "open", title: "Catat Latihan 🏋️" }
        ]
      });
      this.schedulerTimers.delete(key);
    }, msUntil);

    this.schedulerTimers.set(key, timer as any);
  }

  // ─── STOP SCHEDULERS ──────────────────────────────────────────────────────

  public stopScheduler(key: string): void {
    const timer = this.schedulerTimers.get(key);
    if (timer) {
      clearTimeout(timer as any);
      clearInterval(timer as any);
      this.schedulerTimers.delete(key);
    }
  }

  public stopAllSchedulers(): void {
    this.schedulerTimers.forEach((timer) => {
      clearTimeout(timer as any);
      clearInterval(timer as any);
    });
    this.schedulerTimers.clear();
  }

  // ─── START ALL SCHEDULERS AT ONCE ─────────────────────────────────────────

  public startAllSchedulers(userName: string, workoutFocus: string, reminderHour: number = 7): void {
    this.startDailyWorkoutScheduler(userName, workoutFocus, reminderHour, 0);
    this.startHydrationScheduler(2);
    this.scheduleStreakReminder(userName);
  }

  // ─── TEST NOTIFICATION ────────────────────────────────────────────────────

  public async sendTestNotification(): Promise<boolean> {
    this.playAlertSound("reminder");
    return this.sendNotification({
      title: "🔔 GymBuddy Notifikasi Aktif!",
      body: "Pengingat workout harian, minum air, & rest timer akan muncul di HP & Apple Watch kamu. ✨",
      tag: "test-notification",
      icon: "/icon-192.png",
      vibrate: [150, 100, 150, 100, 200],
      actions: [
        { action: "open", title: "Buka GymBuddy 💪" }
      ]
    });
  }

  // ─── WORKOUT REMINDER (manual) ────────────────────────────────────────────

  public sendWorkoutReminder(day: string, focus: string): void {
    this.sendNotification({
      title: `🏋️ Jadwal Latihan Hari Ini: ${focus}`,
      body: `Hari ${day} adalah waktu membakar kalori & membentuk otot. Yuk mulai sesi latihanmu!`,
      tag: "daily-workout-reminder",
      vibrate: [200, 100, 200]
    });
  }

  public sendHydrationReminder(): void {
    this.sendNotification({
      title: "💧 Waktunya Minum Air!",
      body: "Jaga hidrasi tubuhmu agar performa latihan dan recovery otot tetap maksimal.",
      tag: "hydration-reminder",
      vibrate: [150, 100, 150]
    });
  }
}

export const notificationService = GymBuddyNotificationService.getInstance();
