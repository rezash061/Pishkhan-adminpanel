import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/api/backend";
import type { HealthReport } from "@/lib/api/types";
import { getAccessToken } from "@/lib/auth/session";
import { problemResponse } from "@/lib/problem";

// Prefers the full platform health (`/admin/v1/platform/health`: Kafka, ClamAV, storage, workers, Instagram, AI) and falls back to the
// AdminApi's own readiness probe (/health/ready, outside /admin/v1) on a backend without it. `full` tells the page which one answered.
export async function GET() {
  const token = await getAccessToken();
  if (!token) return problemResponse(401, "auth.unauthorized");
  const checkedAt = new Date().toISOString();
  const headers = { "cache-control": "no-store" };
  try {
    const platform = await backendFetch("/admin/v1/platform/health", { token, signal: AbortSignal.timeout(10_000) });
    if (platform.ok) return NextResponse.json({ reachable: true, full: true, checkedAt, ...((await platform.json()) as HealthReport) }, { headers });
    if (platform.status !== 404) throw new Error(`platform health ${platform.status}`);
  } catch {
    // Fall through to the readiness probe: it still says whether the AdminApi and its database answer.
  }
  try {
    const response = await backendFetch("/health/ready", { signal: AbortSignal.timeout(5_000) });
    const body = (await response.json()) as HealthReport;
    return NextResponse.json({ reachable: true, full: false, checkedAt, ...body }, { headers });
  } catch {
    return NextResponse.json({ reachable: false, full: false, checkedAt, status: "Unreachable", checks: {} }, { headers });
  }
}
