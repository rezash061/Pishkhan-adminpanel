import { secureCookies } from "@/lib/config";

export interface CookieNames {
  access: string;
  refresh: string;
  stepUp: string;
  enroll: string;
  csrf: string;
}

/** `__Host-` names need Secure, so plain names are used only in local development over HTTP. */
export function cookieNames(): CookieNames {
  const p = secureCookies() ? "__Host-" : "";
  return {
    access: `${p}admin_at`,
    refresh: `${p}admin_rt`,
    stepUp: `${p}admin_su`,
    enroll: `${p}admin_enroll`,
    csrf: `${p}admin_csrf`,
  };
}

/** Header the browser echoes the CSRF cookie in (double-submit). */
export const CSRF_HEADER = "x-csrf-token";

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict";
  path: "/";
  maxAge?: number;
}

export function cookieOptions(maxAgeSeconds?: number, httpOnly = true): CookieOptions {
  return {
    httpOnly,
    secure: secureCookies(),
    sameSite: "strict",
    path: "/",
    ...(maxAgeSeconds === undefined ? {} : { maxAge: Math.max(0, Math.floor(maxAgeSeconds)) }),
  };
}

/** Seconds until `iso`, minus a safety margin so a cookie never outlives its token. */
export function secondsUntil(iso: string | null | undefined, marginSeconds = 15): number {
  if (!iso) return 0;
  return Math.max(0, (new Date(iso).getTime() - Date.now()) / 1000 - marginSeconds);
}

/** Minimal cookie writer shared by NextResponse cookies and the next/headers cookie store. */
export interface CookieWriter {
  set(name: string, value: string, options: CookieOptions): unknown;
}

export interface SessionTokens {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export function writeSessionCookies(jar: CookieWriter, tokens: SessionTokens): void {
  const names = cookieNames();
  jar.set(names.access, tokens.accessToken, cookieOptions(secondsUntil(tokens.accessTokenExpiresAt)));
  jar.set(names.refresh, tokens.refreshToken, cookieOptions(secondsUntil(tokens.refreshTokenExpiresAt, 0)));
}

export function clearSessionCookies(jar: CookieWriter): void {
  const names = cookieNames();
  for (const name of [names.access, names.refresh, names.stepUp, names.enroll]) jar.set(name, "", cookieOptions(0));
}
