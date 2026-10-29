// Server-side configuration. Read lazily so tests and the proxy see the current environment.

/** Base URL of the AdminApi host, or "mock" to use the in-process mock (development and end-to-end tests). */
export function adminApiUrl(): string {
  return (process.env.ADMIN_API_URL ?? "http://localhost:5081").replace(/\/+$/, "");
}

export function isMockApi(): boolean {
  if (adminApiUrl() !== "mock") return false;
  if (process.env.NODE_ENV === "production" && process.env.ADMIN_ALLOW_MOCK !== "1") {
    throw new Error("ADMIN_API_URL=mock is refused in production unless ADMIN_ALLOW_MOCK=1 is set.");
  }
  return true;
}

/** Secure (`__Host-`) cookies everywhere except local development over plain HTTP. */
export function secureCookies(): boolean {
  const flag = process.env.ADMIN_COOKIE_SECURE;
  if (flag === "true") return true;
  if (flag === "false") return false;
  return process.env.NODE_ENV === "production";
}

/** Optional comma-separated list of client IPs or IPv4 CIDR ranges allowed to reach the panel (second layer behind the VPN). */
export function allowedIps(): string[] {
  return (process.env.ADMIN_ALLOWED_IPS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
