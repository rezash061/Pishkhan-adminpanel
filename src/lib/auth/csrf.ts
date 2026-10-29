import { CSRF_HEADER, cookieNames } from "./cookies";

/** Constant-time string comparison (edge and node safe). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

/**
 * Mutations must come from this origin and echo the CSRF cookie in a header (double-submit).
 * Returns an error code, or null when the request passes.
 */
export function checkMutation(request: Request): string | null {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return null;
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return "csrf.origin_missing";
  try {
    if (new URL(origin).host !== host) return "csrf.origin_mismatch";
  } catch {
    return "csrf.origin_mismatch";
  }
  const cookie = readCookie(request.headers.get("cookie"), cookieNames().csrf);
  const header = request.headers.get(CSRF_HEADER);
  if (!cookie || !header || !safeEqual(cookie, header)) return "csrf.token_mismatch";
  return null;
}

export function newCsrfToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
