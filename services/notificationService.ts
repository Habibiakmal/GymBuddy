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
}

export class GymBuddyNotificationService {
  private static instance: GymBuddyNotificationService;

  private constructor() {}

  public static getInstance(): GymBuddyNotificationService {
    if (!GymBuddyNotificationService.instance) {
      GymBuddyNotificationService.instance = new GymBuddyNotificationService();
    }
    return GymBuddyNotificationService.instance;
  }

  // Check if browser/PWA supports notifications
  public isSupported(): boolean {
    return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
  }

  // Get current permission status
  public getPermission(): NotificationPermission {
    if (!this.isSupported()) return "denied";
    return Notification.permission;
  }

  // Request user permission
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

  // Trigger haptic vibration on devices/smartwatches that support it
  public triggerHaptic(pattern: number[] = [100, 50, 100]): void {
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(pattern);
      }
    } catch (e) {
      // Ignored if not supported
    }
  }

  // Play audio chime for timer / alerts
  public playAlertSound(type: "timer" | "complete" = "timer"): void {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === "timer") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.4);
      } else {
        // Success chord
        osc.type = "triangle";
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.5);
      }
    } catch (e) {
      // Audio context might be restricted before user interaction
    }
  }

  // Send a native notification (mirrored to Apple Watch / Galaxy Watch)
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
          actions: [
            { action: "open", title: "Buka GymBuddy" }
          ]
        });
        return true;
      }
    } catch (e) {
      // Fallback to standard window Notification
      try {
        new Notification(payload.title, {
          body: payload.body,
          icon: payload.icon || "/icon-192.png",
          tag: payload.tag
        });
        return true;
      } catch (err) {
        console.warn("Notification fallback failed:", err);
      }
    }

    return false;
  }

  // Schedule Rest Timer Alert
  public scheduleRestTimerAlert(seconds: number, exerciseName: string): void {
    setTimeout(() => {
      this.playAlertSound("timer");
      this.triggerHaptic([300, 150, 300, 150, 400]);

      this.sendNotification({
        title: `⏱️ Istirahat Selesai! (${exerciseName})`,
        body: `Waktu istirahat ${seconds} detik telah habis. Siap untuk set berikutnya? Semangat bro! 🔥`,
        tag: `rest-timer-${Date.now()}`,
        vibrate: [300, 150, 300, 150, 400]
      });
    }, seconds * 1000);
  }

  // Send Workout Reminder
  public sendWorkoutReminder(day: string, focus: string): void {
    this.sendNotification({
      title: `🏋️‍♂️ Jadwal Latihan Hari Ini: ${focus}`,
      body: `Hari ${day} adalah waktu untuk membakar kalori & membentuk otot. Yuk mulai sesi latihanmu sekarang!`,
      tag: "daily-workout-reminder",
      vibrate: [200, 100, 200]
    });
  }

  // Send Hydration Reminder
  public sendHydrationReminder(): void {
    this.sendNotification({
      title: "💧 Waktunya Minum Air!",
      body: "Jaga hidrasi tubuhmu agar performa latihan dan recovery otot tetap maksimal.",
      tag: "hydration-reminder",
      vibrate: [150, 100, 150]
    });
  }

  // Test Notification
  public async sendTestNotification(): Promise<boolean> {
    return this.sendNotification({
      title: "🔔 GymBuddy Smartwatch & PWA Aktif!",
      body: "Notifikasi berhasil terhubung! Pengingat workout & rest timer akan muncul langsung di HP & Apple Watch kamu. ✨",
      tag: "test-notification",
      vibrate: [150, 100, 150, 100, 200]
    });
  }
}

export const notificationService = GymBuddyNotificationService.getInstance();
