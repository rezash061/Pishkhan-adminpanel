import { isMockApi } from "@/lib/config";
import { problemResponse } from "@/lib/problem";

// Test hook for the Playwright suite. Exists only when the in-process mock AdminApi is active.
export async function POST() {
  if (!isMockApi()) return problemResponse(404, "not_found");
  const { resetMockState } = await import("@/mocks/admin-api");
  resetMockState();
  return new Response(null, { status: 204 });
}
