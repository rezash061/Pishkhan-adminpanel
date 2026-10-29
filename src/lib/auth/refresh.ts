import { backendFetch } from "@/lib/api/backend";
import type { SessionTokens } from "./cookies";

type RefreshOutcome = { ok: true; tokens: SessionTokens } | { ok: false; status: number };

// The backend rotates refresh tokens and revokes the whole session when a rotated token is reused, so
// concurrent requests carrying the same refresh cookie must share one refresh call (single flight).
// The settled outcome is kept briefly for requests that arrive just after.
const inflight = new Map<string, Promise<RefreshOutcome>>();
const SHARE_MS = 20_000;

export function refreshSession(refreshToken: string): Promise<RefreshOutcome> {
  const existing = inflight.get(refreshToken);
  if (existing) return existing;

  const promise = (async (): Promise<RefreshOutcome> => {
    try {
      const response = await backendFetch("/admin/v1/auth/refresh", { method: "POST", body: { refreshToken } });
      if (!response.ok) return { ok: false, status: response.status };
      const body = (await response.json()) as Partial<SessionTokens> & { status: string };
      if (body.status !== "ok" || !body.accessToken || !body.refreshToken) return { ok: false, status: 401 };
      return { ok: true, tokens: body as SessionTokens };
    } catch {
      return { ok: false, status: 503 };
    }
  })();

  inflight.set(refreshToken, promise);
  void promise.finally(() => setTimeout(() => inflight.delete(refreshToken), SHARE_MS));
  return promise;
}
