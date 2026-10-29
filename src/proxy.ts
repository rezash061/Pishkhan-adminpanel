import { NextResponse, type NextRequest } from "next/server";
import { allowedIps } from "@/lib/config";
import { clearSessionCookies, cookieNames, cookieOptions, writeSessionCookies } from "@/lib/auth/cookies";
import { newCsrfToken } from "@/lib/auth/csrf";
import { refreshSession } from "@/lib/auth/refresh";
import { ipAllowed } from "@/lib/ip";

// Runs before every page and API route: IP allowlist, nonce CSP, CSRF cookie, and session refresh.
// Refreshing here (not in server components) is what lets rotated tokens be written back as cookies.

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/totp-enroll", "/api/mock/reset"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function contentSecurityPolicy(nonce: string): string {
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Radix positions popovers with style attributes, which nonces cannot cover.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

function clientIp(request: NextRequest): string | null {
  return request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  const allowlist = allowedIps();
  if (allowlist.length > 0 && !ipAllowed(clientIp(request), allowlist)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const names = cookieNames();
  const pending: Array<(res: NextResponse) => void> = [];

  // Session: an expired access cookie is renewed from the refresh cookie before the page renders.
  let signedIn = request.cookies.has(names.access);
  const refreshToken = request.cookies.get(names.refresh)?.value;
  if (!signedIn && refreshToken) {
    const outcome = await refreshSession(refreshToken);
    if (outcome.ok) {
      signedIn = true;
      writeSessionCookies({ set: (name, value) => request.cookies.set(name, value) }, outcome.tokens);
      pending.push((res) => writeSessionCookies(res.cookies, outcome.tokens));
    } else if (outcome.status === 401) {
      request.cookies.delete(names.refresh);
      pending.push((res) => clearSessionCookies(res.cookies));
    } else {
      // Backend unreachable: keep the refresh cookie and let the page show the error instead of logging out.
      signedIn = true;
    }
  }

  const finish = (res: NextResponse) => {
    pending.forEach((apply) => apply(res));
    return res;
  };

  if (!isPublic(pathname) && !signedIn) {
    if (isApi) {
      return finish(
        NextResponse.json(
          { type: "https://pishkhan.ir/problems/unauthorized", title: "auth.unauthorized", status: 401, code: "auth.unauthorized" },
          { status: 401, headers: { "content-type": "application/problem+json" } },
        ),
      );
    }
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
    return finish(NextResponse.redirect(login));
  }

  if (pathname === "/login" && signedIn) {
    return finish(NextResponse.redirect(new URL("/", request.url)));
  }

  if (!request.cookies.has(names.csrf)) {
    const token = newCsrfToken();
    request.cookies.set(names.csrf, token);
    pending.push((res) => res.cookies.set(names.csrf, token, cookieOptions(undefined, false)));
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("content-security-policy", csp);
  return finish(response);
}

export const config = {
  matcher: [
"/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
