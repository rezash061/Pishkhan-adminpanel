import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/api/backend";
import { getAccessToken } from "@/lib/auth/session";
import { problemResponse } from "@/lib/problem";

// The AdminApi readiness probe (/health/ready) lives outside /admin/v1, so it gets its own staff-only route.
export async function GET() {
  if (!(await getAccessToken())) return problemResponse(401, "auth.unauthorized");
  const checkedAt = new Date().toISOString();
  try {
    const response = await backendFetch("/health/ready", { signal: AbortSignal.timeout(5_000) });
    const body = (await response.json()) as { status: string; checks: Record<string, { status: string; ms: number }> };
    return NextResponse.json({ reachable: true, checkedAt, ...body }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ reachable: false, checkedAt, status: "Unreachable", checks: {} }, { headers: { "cache-control": "no-store" } });
  }
}
