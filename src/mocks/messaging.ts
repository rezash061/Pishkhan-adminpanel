// Mock state and handler for /admin/v1/platform/messaging, /platform/sms and /platform/bale (backend AD-2.4). Used by src/mocks/admin-api.ts.

import type { AdminBaleBot, MessagingOverview, MetaApp, SmsLogItem } from "@/lib/api/types";
import { workspaceFixtures } from "./fixtures";

const READERS = ["SuperAdmin", "Support", "ReadOnly"];
const PURPOSES = ["otp", "invitation", "notification", "campaign", "test", "other"];
const MINUTE = 60_000;

export interface MessagingMockState {
  log: (SmsLogItem & { e164: string })[];
  bots: AdminBaleBot[];
  /** Bot ids whose token Bale refuses (the check moves them to reauth_required). */
  badTokens: string[];
}

type Problem = (status: number, code: string, errors?: Record<string, string[]>) => Response;

/** 09121234567, +989121234567, 9121234567 or Persian digits to +989121234567, or null. */
export function toE164(input: string): string | null {
  const latin = input.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[\s-]/g, "");
  const m = /^(?:\+98|0098|98|0)?(9\d{9})$/.exec(latin);
  return m ? `+98${m[1]}` : null;
}

const mask = (e164: string) => `${e164.slice(0, 6)}***${e164.slice(-4)}`;

export function seedMessaging(): MessagingMockState {
  const now = Date.now();
  const log: MessagingMockState["log"] = [];
  for (let i = 0; i < 64; i++) {
    const purpose = i % 9 === 4 ? "invitation" : i % 7 === 3 ? "notification" : i % 11 === 5 ? "campaign" : "otp";
    const ws = purpose === "otp" ? null : workspaceFixtures[i % 8];
    const e164 = `+98912${String(1_000_000 + ((i * 7919) % 9_000_000)).padStart(7, "0")}`;
    const failed = i % 17 === 8;
    log.push({
      id: `01938f92-0000-7000-8000-${String(i + 1).padStart(12, "0")}`,
      createdAt: new Date(now - i * 37 * MINUTE).toISOString(),
      purpose,
      workspaceId: ws?.id ?? null,
      workspaceName: ws?.name ?? null,
      phone: mask(e164),
      e164,
      provider: "kavenegar",
      status: failed ? "failed" : "sent",
      error: failed ? "Kavenegar returned 418: اعتبار حساب کافی نیست" : null,
      segments: purpose === "otp" ? 1 : purpose === "campaign" ? 2 : 1,
      template: purpose === "otp" ? "pishkhan-otp" : null,
    });
  }
  log.push({ ...log[0]!, id: "01938f92-0000-7000-8000-0000000000ff", e164: "+989120001000", phone: mask("+989120001000"), createdAt: new Date(now - 5 * MINUTE).toISOString() });
  const bots: AdminBaleBot[] = [1, 2, 3, 5, 7].map((n, i) => ({
    id: `01938f93-0000-7000-8000-${String(n).padStart(12, "0")}`,
    workspaceId: workspaceFixtures[n - 1]!.id,
    workspaceName: workspaceFixtures[n - 1]!.name,
    botId: String(4_100_000 + n),
    username: `shop${n}_bot`,
    displayName: `ربات ${workspaceFixtures[n - 1]!.name}`,
    status: i === 3 ? "reauth_required" : i === 4 ? "disconnected" : "active",
    statusReason: i === 3 ? "bale.invalid_token" : i === 4 ? "owner_disconnected" : null,
    statusChangedAt: i >= 3 ? new Date(now - 30 * 60 * MINUTE).toISOString() : null,
    createdAt: new Date(now - (i + 2) * 24 * 60 * MINUTE).toISOString(),
  }));
  return { log: log.sort((a, b) => b.createdAt.localeCompare(a.createdAt)), bots, badTokens: [bots[2]!.id] };
}

function page<T>(items: T[], url: URL, defaultSize: number) {
  const p = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const size = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? defaultSize) || defaultSize));
  return { items: items.slice((p - 1) * size, p * size), totalCount: items.length, page: p, pageSize: size };
}

const view = (entry: MessagingMockState["log"][number]): SmsLogItem => {
  const item: Partial<MessagingMockState["log"][number]> = { ...entry };
  delete item.e164;
  return item as SmsLogItem;
};

export async function handleMessaging(request: Request, url: URL, s: MessagingMockState, roles: string[], stepUpFresh: boolean, problem: Problem): Promise<Response | null> {
  const path = url.pathname;
  const read = roles.some((r) => READERS.includes(r));
  if (path === "/admin/v1/platform/messaging" && request.method === "GET") {
    if (!read) return problem(403, "auth.forbidden");
    const since = Date.now() - 24 * 60 * MINUTE;
    const recent = s.log.filter((l) => Date.parse(l.createdAt) >= since);
    const byPurpose: Record<string, number> = {};
    recent.forEach((l) => (byPurpose[l.purpose] = (byPurpose[l.purpose] ?? 0) + 1));
    const bots: Record<string, number> = {};
    s.bots.forEach((b) => (bots[b.status] = (bots[b.status] ?? 0) + 1));
    const overview: MessagingOverview = {
      sms: {
        provider: { provider: "kavenegar", configured: true, otpTemplate: "pishkhan-otp", credit: 18_450_000, error: null },
        last24Hours: { sent: recent.filter((l) => l.status === "sent").length, failed: recent.filter((l) => l.status === "failed").length, byPurpose },
      },
      bale: { apiBaseUrl: "https://tapi.bale.ai", webhookBaseUrl: "https://api.pishkhan.ir", webhookSecretSet: true, bots },
    };
    return Response.json(overview);
  }

  if (path === "/admin/v1/platform/meta-app" && request.method === "GET") {
    if (!read) return problem(403, "auth.forbidden");
    const ago = (m: number) => new Date(Date.now() - m * MINUTE).toISOString();
    const meta: MetaApp = {
      appId: "1234567890123456",
      apiVersion: "v23.0",
      graphBaseUrl: "https://graph.instagram.com",
      redirectUri: "https://app.pishkhan.ir/channels/instagram/callback",
      appSecretSet: true,
      webhookVerifyTokenSet: true,
      scopes: ["instagram_business_basic", "instagram_business_manage_messages", "instagram_business_manage_comments"],
      webhookFields: ["messages", "messaging_postbacks", "messaging_seen", "comments"],
      webhooks: { last24Hours: { accepted: 18_240, duplicate: 312, ignored: 95, bad_signature: 4 }, lastSeen: { accepted: ago(1), duplicate: ago(12), ignored: ago(40), bad_signature: ago(300) } },
      accounts: { active: 6, token_expiring: 1, reauth_required: 1 },
      tokensExpiringSoon: 2,
    };
    return Response.json(meta);
  }

  if (path === "/admin/v1/platform/sms/log" && request.method === "GET") {
    if (!read) return problem(403, "auth.forbidden");
    const phone = url.searchParams.get("phone")?.trim() ?? "";
    const purpose = url.searchParams.get("purpose") ?? "";
    const status = url.searchParams.get("status") ?? "";
    const workspaceId = url.searchParams.get("workspaceId") ?? "";
    const e164 = phone ? toE164(phone) : null;
    if (phone && !e164) return problem(400, "validation.failed", { phone: ["validation.phone.invalid"] });
    if (purpose && !PURPOSES.includes(purpose)) return problem(400, "validation.failed", { purpose: ["validation.invalid"] });
    if (status && status !== "sent" && status !== "failed") return problem(400, "validation.failed", { status: ["validation.invalid"] });
    const items = s.log
      .filter((l) => !e164 || l.e164 === e164)
      .filter((l) => !purpose || l.purpose === purpose)
      .filter((l) => !status || l.status === status)
      .filter((l) => !workspaceId || l.workspaceId === workspaceId)
      .map(view);
    return Response.json(page(items, url, 50));
  }

  if (path === "/admin/v1/platform/sms/test" && request.method === "POST") {
    if (!roles.includes("SuperAdmin")) return problem(403, "auth.forbidden");
    if (!stepUpFresh) return problem(403, "auth.step_up.required");
    let b: { phone?: string } = {};
    try {
      b = (await request.json()) as typeof b;
    } catch {
      // empty body
    }
    const e164 = toE164(b.phone ?? "");
    if (!e164) return problem(400, "validation.failed", { phone: ["validation.phone.invalid"] });
    const entry = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), purpose: "test", workspaceId: null, workspaceName: null, phone: mask(e164), e164, provider: "kavenegar", status: "sent", error: null, segments: 1, template: null };
    s.log.unshift(entry);
    return Response.json(view(entry));
  }

  if (path === "/admin/v1/platform/bale/bots" && request.method === "GET") {
    if (!read) return problem(403, "auth.forbidden");
    const status = url.searchParams.get("status") ?? "";
    const q = (url.searchParams.get("q") ?? "").trim().replace(/^@/, "").toLowerCase();
    const items = s.bots.filter((b) => !status || b.status === status).filter((b) => !q || (b.username ?? "").toLowerCase().includes(q));
    return Response.json(page(items, url, 25));
  }

  const check = request.method === "POST" ? /^\/admin\/v1\/platform\/bale\/bots\/([0-9a-f-]{36})\/check$/i.exec(path) : null;
  if (check) {
    if (!roles.some((r) => r === "SuperAdmin" || r === "Support")) return problem(403, "auth.forbidden");
    const bot = s.bots.find((b) => b.id === check[1]);
    if (!bot) return problem(404, "not_found");
    if (bot.status === "disconnected") return problem(409, "channels.bale_disconnected");
    if (s.badTokens.includes(bot.id)) {
      Object.assign(bot, { status: "reauth_required", statusReason: "bale.invalid_token", statusChangedAt: new Date().toISOString() });
      return Response.json({ bot, result: "invalid_token" });
    }
    return Response.json({ bot, result: "ok" });
  }
  return null;
}
