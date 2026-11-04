// Mock state and handler for /admin/v1/platform/outage (backend PR #47, BE-2.7 part 1). Used by src/mocks/admin-api.ts.

import type { AdminOutage } from "@/lib/api/types";

const MODES = ["auto", "forced_down", "forced_up"];
const READERS = ["SuperAdmin", "Support", "ReadOnly", "AIOps", "Finance"];
const WRITERS = ["SuperAdmin", "Support"];
/** Backend `Channels:Outage` defaults. */
const WINDOW_MINUTES = 5;
const DOWN_FAILURES = 20;
const DOWN_SHARE = 0.5;

export interface OutageMockState {
  status: "up" | "down";
  mode: string;
  since: string;
  modeReason: string | null;
  /** The detector's counts over the window; tests change them to simulate an outage. */
  ok: number;
  failed: number;
}

type Problem = (status: number, code: string, errors?: Record<string, string[]>) => Response;

export function seedOutage(): OutageMockState {
  // Up for two hours, with a few failures that are not enough to call it down.
  return { status: "up", mode: "auto", since: new Date(Date.now() - 2 * 3_600_000).toISOString(), modeReason: null, ok: 1284, failed: 7 };
}

/** What the status is under the current mode and counts (the detector's "down" rule; "up" again once it no longer holds). */
function evaluate(s: OutageMockState): "up" | "down" {
  if (s.mode === "forced_down") return "down";
  if (s.mode === "forced_up") return "up";
  const total = s.ok + s.failed;
  return s.failed >= DOWN_FAILURES && total > 0 && s.failed / total >= DOWN_SHARE ? "down" : "up";
}

const view = (s: OutageMockState): AdminOutage => ({ kind: "instagram", status: s.status, mode: s.mode, since: s.since, modeReason: s.modeReason, ok: s.ok, failed: s.failed, windowMinutes: WINDOW_MINUTES });

export async function handleOutage(request: Request, url: URL, s: OutageMockState, roles: string[], stepUpFresh: boolean, problem: Problem): Promise<Response | null> {
  if (url.pathname !== "/admin/v1/platform/outage") return null;
  if (request.method === "GET") {
    if (!roles.some((r) => READERS.includes(r))) return problem(403, "auth.forbidden");
    return Response.json(view(s));
  }
  if (request.method !== "PUT") return null;
  if (!roles.some((r) => WRITERS.includes(r))) return problem(403, "auth.forbidden");
  if (!stepUpFresh) return problem(403, "auth.step_up.required");
  let b: { mode?: string; reason?: string } = {};
  try {
    b = (await request.json()) as typeof b;
  } catch {
    // empty body
  }
  const errors: Record<string, string[]> = {};
  if (!MODES.includes(b.mode ?? "")) errors.mode = ["validation.invalid"];
  const n = b.reason?.trim().length ?? 0;
  if (n < 5 || n > 300) errors.reason = [n < 5 ? "validation.too_short" : "validation.too_long"];
  if (Object.keys(errors).length) return problem(400, "validation.failed", errors);
  s.mode = b.mode!;
  s.modeReason = b.reason!.trim();
  const next = evaluate(s);
  if (next !== s.status) {
    s.status = next;
    s.since = new Date().toISOString();
  }
  return Response.json(view(s));
}
