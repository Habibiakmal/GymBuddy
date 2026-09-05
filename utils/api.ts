/**
 * Centralized API Client & Routing Helper for GymBuddy.
 * Enforces the canonical backend (Cloud Run + Database) as the single source of truth.
 */

export const CLOUD_RUN_BACKEND_URL = "https://gymbuddy-backend-253242815083.asia-southeast2.run.app";

/**
 * Resolves the API base URL for GymBuddy client requests.
 * - In local dev (localhost / 127.0.0.1): returns "" to route through Vite proxy / local server.
 * - In production browsers (Hostinger, custom domain, PWA): returns the canonical Cloud Run URL.
 * - In server / SSR environments: returns VITE_API_URL or CLOUD_RUN_BACKEND_URL.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const envUrl = (import.meta as any).env?.VITE_API_URL;
    if (envUrl && typeof envUrl === "string" && envUrl.trim() !== "") {
      return envUrl.trim().replace(/\/+$/, "");
    }
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0") {
      return "";
    }
    return CLOUD_RUN_BACKEND_URL;
  }
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  return envUrl && typeof envUrl === "string" && envUrl.trim() !== ""
    ? envUrl.trim().replace(/\/+$/, "")
    : CLOUD_RUN_BACKEND_URL;
}

/**
 * Computes canonical YYYY-MM-DD date string in Asia/Jakarta (WIB, UTC+7) timezone.
 * Used identically across all client devices and backend to prevent date misalignment.
 */
export function getJakartaDateStr(d: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    return formatter.format(d); // Formats as YYYY-MM-DD
  } catch (e) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}

export interface CanonicalApiOptions extends RequestInit {
  timeoutMs?: number;
}

/**
 * Robust fetch wrapper that guarantees requests reach the real backend.
 * Protects against Hostinger / Apache static hosts swallowing /api paths and
 * returning index.html with HTTP 200.
 */
export async function canonicalApiFetch<T = any>(
  endpoint: string,
  options: CanonicalApiOptions = {}
): Promise<T> {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const baseUrl = getApiBaseUrl();
  const primaryUrl = `${baseUrl}${cleanEndpoint}`;

  const headers: Record<string, string> = {
    "Accept": "application/json",
    "Cache-Control": "no-cache",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers as Record<string, string> || {})
  };

  const executeFetch = async (targetUrl: string): Promise<T> => {
    const res = await fetch(targetUrl, {
      ...options,
      headers
    });

    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");

    // If host returned HTML (e.g. Hostinger SPA rewrite rule returning 200 OK index.html),
    // treat this as an invalid response that missed the backend.
    if (!isJson) {
      const text = await res.text().catch(() => "");
      const isHtml = text.trim().startsWith("<!DOCTYPE") || text.includes("<html");
      if (isHtml) {
        throw new Error("SERVER_RETURNED_HTML_SPA_FALLBACK");
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 150)}`);
      }
      throw new Error(`Expected JSON but received ${contentType}`);
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
    }
    return data as T;
  };

  try {
    return await executeFetch(primaryUrl);
  } catch (err: any) {
    // If primary fetch was swallowed by SPA host or failed network, fallback directly to Cloud Run
    if (
      baseUrl !== CLOUD_RUN_BACKEND_URL &&
      (err?.message === "SERVER_RETURNED_HTML_SPA_FALLBACK" || err?.name === "TypeError" || !baseUrl)
    ) {
      const fallbackUrl = `${CLOUD_RUN_BACKEND_URL}${cleanEndpoint}`;
      return await executeFetch(fallbackUrl);
    }
    throw err;
  }
}

/**
 * Resolves the official WhatsApp destination URL for GymBuddy bot.
 * Strictly avoids Twilio sandbox (+14155238886).
 * Formats appropriate link with prefilled text.
 */
export function getWhatsAppDestinationUrl(prefilledText: string = "Halo GymBuddy 👋"): string {
  const envNum = (typeof window !== "undefined" ? (import.meta as any).env?.VITE_WHATSAPP_BOT_NUMBER : process.env.VITE_WHATSAPP_BOT_NUMBER) || "62822222222";
  const cleanNum = String(envNum).replace(/[^\d]/g, "");
  const encodedText = encodeURIComponent(prefilledText);
  return `https://wa.me/${cleanNum}?text=${encodedText}`;
}

/**
 * Safely opens WhatsApp URL across mobile browsers, desktop, and PWAs
 * without triggering popup blockers after async operations.
 */
export function openWhatsAppSafely(url: string): void {
  if (typeof window === "undefined") return;

  const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);
  if (isMobile) {
    // Mobile browsers reliably navigate via location.href
    window.location.href = url;
  } else {
    // Desktop: attempt window.open, fall back to window.location.href if blocked
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win || win.closed || typeof win.closed === "undefined") {
      window.location.href = url;
    }
  }
}
