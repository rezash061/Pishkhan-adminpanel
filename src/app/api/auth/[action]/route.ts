import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/api/backend";
import {
  clearSessionCookies,
  cookieNames,
  cookieOptions,
  secondsUntil,
  writeSessionCookies,
  type SessionTokens,
} from "@/lib/auth/cookies";
import { checkMutation } from "@/lib/auth/csrf";
import { problemResponse } from "@/lib/problem";

// BFF auth endpoints. Tokens from the AdminApi are turned into HttpOnly cookies here and never reach the browser.

interface LoginResponse extends Partial<SessionTokens> {
  status: "ok" | "totp_enrollment_required";
  enrollmentToken?: string | null;
  totpSecret?: string | null;
  otpAuthUri?: string | null;
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await request.json();
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Passes a backend problem response through unchanged. */
async function passThrough(response: Response): Promise<Response> {
  return new Response(await response.text(), {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/problem+json" },
  });
}

async function sessionStarted(response: Response): Promise<Response> {
  const body = (await response.json()) as LoginResponse;
  const jar = await cookies();
  if (body.status === "totp_enrollment_required" && body.enrollmentToken) {
    // The enrollment token stays server-side; the secret must be shown once so it can be added to an authenticator app.
    jar.set(cookieNames().enroll, body.enrollmentToken, cookieOptions(10 * 60));
    return NextResponse.json({ status: body.status, totpSecret: body.totpSecret, otpAuthUri: body.otpAuthUri });
  }
  writeSessionCookies(jar, body as SessionTokens);
  jar.delete(cookieNames().enroll);
  return NextResponse.json({ status: "ok" });
}

export async function POST(request: Request, ctx: RouteContext<"/api/auth/[action]">) {
  const { action } = await ctx.params;
  const csrf = checkMutation(request);
  if (csrf) return problemResponse(403, csrf);

  const jar = await cookies();
  const names = cookieNames();
  const input = await readJson(request);

  switch (action) {
    case "login": {
      const response = await backendFetch("/admin/v1/auth/login", {
        method: "POST",
        body: { username: str(input.username), password: str(input.password), totpCode: str(input.totpCode) || null },
      });
      return response.ok ? sessionStarted(response) : passThrough(response);
    }

    case "totp-enroll": {
      const enrollmentToken = jar.get(names.enroll)?.value;
      if (!enrollmentToken) return problemResponse(401, "auth.totp.enrollment_expired");
      const response = await backendFetch("/admin/v1/auth/totp/enroll", {
        method: "POST",
        body: { enrollmentToken, code: str(input.code) },
      });
      return response.ok ? sessionStarted(response) : passThrough(response);
    }

    case "step-up": {
      const token = jar.get(names.access)?.value;
      if (!token) return problemResponse(401, "auth.unauthorized");
      const response = await backendFetch("/admin/v1/auth/step-up", {
        method: "POST",
        token,
        body: { password: str(input.password), totpCode: str(input.totpCode) },
      });
      if (!response.ok) return passThrough(response);
      const body = (await response.json()) as { accessToken: string; accessTokenExpiresAt: string };
      jar.set(names.stepUp, body.accessToken, cookieOptions(secondsUntil(body.accessTokenExpiresAt, 5)));
      return NextResponse.json({ expiresAt: body.accessTokenExpiresAt });
    }

    case "logout": {
      const token = jar.get(names.access)?.value;
      if (token) await backendFetch("/admin/v1/auth/logout", { method: "POST", token }).catch(() => undefined);
      clearSessionCookies(jar);
      return new Response(null, { status: 204 });
    }

    default:
      return problemResponse(404, "not_found");
  }
}
