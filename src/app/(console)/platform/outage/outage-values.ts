import type { AdminOutage } from "@/lib/api/types";

/** The detector's thresholds (backend `Channels:Outage` defaults), shown next to the counts. */
export const DOWN_MIN_FAILURES = 20;
export const DOWN_MIN_SHARE = 0.5;

/** Share of failed calls (0..1), or null when nothing was called in the window. */
export function failureShare(o: Pick<AdminOutage, "ok" | "failed">): number | null {
  const total = o.ok + o.failed;
  return total === 0 ? null : o.failed / total;
}

/** Whether the counts alone would make the detector call Instagram down. */
export function detectorSaysDown(o: Pick<AdminOutage, "ok" | "failed">): boolean {
  const share = failureShare(o);
  return o.failed >= DOWN_MIN_FAILURES && share !== null && share >= DOWN_MIN_SHARE;
}

export const OUTAGE_QUERY_KEY = ["platform-outage"] as const;
export const OUTAGE_REFRESH_MS = 30_000;
