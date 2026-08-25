/**
 * Resolves the API base URL for GymBuddy client requests.
 * In the browser environment:
 * - If VITE_API_URL is configured (e.g. custom remote backend), uses that trimmed without trailing slash.
 * - Otherwise returns "" (relative path) so requests seamlessly hit the current host (localhost in dev, Hostinger / domain in prod).
 */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const envUrl = (import.meta as any).env?.VITE_API_URL;
    if (envUrl && typeof envUrl === "string" && envUrl.trim() !== "") {
      return envUrl.trim().replace(/\/+$/, "");
    }
    return "";
  }
  return (import.meta as any).env?.VITE_API_URL ? String((import.meta as any).env.VITE_API_URL).trim().replace(/\/+$/, "") : "";
}
