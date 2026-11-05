// Mock state and handlers for the platform operations pages (backend BE-1.12 platform PR): file quarantine (/admin/v1/files),
// Kafka, dead letters and workers (/admin/v1/platform/*) and feature flags (/admin/v1/feature-flags). Used by src/mocks/admin-api.ts.

import type { DeadLetter, FeatureFlag, KafkaOverview, QuarantineFile, RecurringJob, WorkspaceFeatureFlag } from "@/lib/api/types";
import { workspaceFixtures } from "./fixtures";

type Problem = (status: number, code: string, errors?: Record<string, string[]>) => Response;

const QUARANTINE_READERS = ["SuperAdmin", "Support"];
const OPS_READERS = ["SuperAdmin", "Support", "AIOps", "ReadOnly"];
const FLAG_READERS = ["SuperAdmin", "Support", "AIOps", "Finance", "ReadOnly"];
const GROUPS = ["ingest", "engine", "ai", "outbound", "media", "commerce", "platform", "realtime"];
const MINUTE = 60_000;

interface MockOverride {
  key: string;
  workspaceId: string;
  enabled: boolean;
  reason: string;
  updatedAt: string;
  updatedBy: string;
}

export interface PlatformMockState {
  files: (QuarantineFile & { sha256: string })[];
  deadLetters: (DeadLetter & { envelope: unknown })[];
  jobs: RecurringJob[];
  flags: Omit<FeatureFlag, "overrides">[];
  overrides: MockOverride[];
  /** Tests turn the brokers off to see the "unavailable" state. */
  kafkaDown: boolean;
}

const ws = (n: number) => workspaceFixtures[n]!;

/** A copy of `o` without `key` (mock-only fields such as the stored envelope). */
function without<T extends object, K extends keyof T>(o: T, key: K): Omit<T, K> {
  const copy = { ...o };
  delete copy[key];
  return copy;
}

export function seedPlatform(): PlatformMockState {
  const now = Date.now();
  const iso = (minutesAgo: number) => new Date(now - minutesAgo * MINUTE).toISOString();
  const file = (n: number, over: Partial<QuarantineFile>): QuarantineFile & { sha256: string } => ({
    id: `01938f80-0000-7000-8000-00000000f${String(n).padStart(3, "0")}`,
    workspaceId: ws(0).id,
    workspaceName: ws(0).name,
    purpose: "product_image",
    status: "infected",
    contentType: "image/jpeg",
    size: 48_213,
    originalName: `photo-${n}.jpg`,
    signature: null,
    scanEngineVersion: "ClamAV 1.4.3/27450",
    rejectReason: null,
    scanAttempts: 1,
    createdAt: iso(60 * n),
    scannedAt: iso(60 * n - 1),
    falsePositiveAt: null,
    stuck: false,
    sha256: `sha-${n}`,
    ...over,
  });
  const envelope = (type: string, payload: object, group: string, consumer: string, message: string) => ({
    messageId: crypto.randomUUID(),
    type,
    occurredAt: iso(30),
    workspaceId: ws(0).id,
    correlationId: crypto.randomUUID(),
    schemaVersion: 1,
    payload,
    deadLetter: { originalTopic: `${type}.v1`, consumerGroup: group, consumer, exceptionType: "System.InvalidOperationException", exceptionMessage: message, attempts: 5, failedAt: iso(29) },
  });
  const letter = (n: number, type: string, group: string, consumer: string, message: string, payload: object, over: Partial<DeadLetter> = {}) => {
    const env = envelope(type, payload, group, consumer, message);
    return {
      id: `01938f81-0000-7000-8000-00000000d${String(n).padStart(3, "0")}`,
      messageId: env.messageId,
      topic: `${type}.v1`,
      group,
      consumer,
      key: ws(0).id,
      type,
      workspaceId: ws(0).id,
      exceptionType: "System.InvalidOperationException",
      exceptionMessage: message,
      attempts: 5,
      failedAt: iso(29 + n),
      status: "open",
      resolvedAt: null,
      resolvedBy: null,
      resolutionReason: null,
      replayMessageId: null,
      envelope: env,
      ...over,
    };
  };
  return {
    files: [
      file(1, { signature: "Win.Test.EICAR_HDB-1" }),
      file(2, { status: "scan_failed", purpose: "receipt", contentType: "image/png", rejectReason: "ClamAV: connection reset", scanAttempts: 5, signature: null, workspaceId: ws(1).id, workspaceName: ws(1).name }),
      file(3, { status: "pending_scan", purpose: "knowledge_document", contentType: "application/pdf", size: 2_400_000, scanAttempts: 0, scannedAt: null, stuck: true, createdAt: iso(25) }),
      file(4, { status: "rejected", rejectReason: "file.image.undecodable", purpose: "avatar" }),
      file(5, { signature: "Doc.Dropper.Agent-1", purpose: "knowledge_document", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 91_000, originalName: "قیمت‌ها.docx" }),
    ],
    deadLetters: [
      letter(1, "files.scan-requested", "media", "Pishkhan.Modules.Files.Services.FileScanHandler", "Scan error: ClamAV did not answer", { fileId: "01938f80-0000-7000-8000-00000000f002", workspaceId: ws(1).id }),
      letter(2, "orders.order-created", "commerce", "Pishkhan.Modules.Catalog.Services.StockReservationHandler", "Product 42 not found", { orderId: crypto.randomUUID(), total: 4_500_000 }),
      letter(3, "conversations.outbound-message-requested", "outbound", "Pishkhan.Modules.Channels.Services.OutboundSender", "Graph API 190: token expired", { conversationId: crypto.randomUUID(), text: "سلام، سفارش شما ارسال شد" }),
      letter(4, "billing.usage-recorded", "platform", "Pishkhan.Modules.Billing.Services.UsageHandler", "deadlock detected", { meter: "ai_conversations" }, {
        status: "replayed",
        resolvedAt: iso(5),
        resolvedBy: "superadmin",
        resolutionReason: "دوباره اجرا شد",
        replayMessageId: crypto.randomUUID(),
      }),
    ],
    jobs: [
      { name: "billing.daily", cron: "0 30 20 * * ?", state: "WAITING", nextFireAt: iso(-300), previousFireAt: iso(1140) },
      { name: "channels.instagram-outage", cron: "0 * * * * ?", state: "WAITING", nextFireAt: iso(-1), previousFireAt: iso(0) },
      { name: "channels.instagram-token-refresh", cron: "0 15 3 * * ?", state: "WAITING", nextFireAt: iso(-600), previousFireAt: iso(840) },
      { name: "content.scheduled-publish", cron: "0 * * * * ?", state: "BLOCKED", nextFireAt: iso(-1), previousFireAt: iso(0) },
      { name: "platform.outbox-cleanup", cron: "0 7 * * * ?", state: "WAITING", nextFireAt: iso(-40), previousFireAt: iso(20) },
      { name: "platform.partition-maintenance", cron: "0 30 0 * * ?", state: "WAITING", nextFireAt: iso(-900), previousFireAt: iso(540) },
    ],
    flags: [
      { key: "inbox.v2", description: "صندوق پیام جدید با پیش‌نمایش سفارش", enabled: true, rolloutPercent: 25, plans: [], createdAt: iso(10_000), updatedAt: iso(300), updatedBy: "superadmin" },
      { key: "receipts.auto_approve", description: "تأیید خودکار رسیدهای مطمئن", enabled: true, rolloutPercent: 100, plans: ["pro", "business"], createdAt: iso(5_000), updatedAt: iso(900), updatedBy: "superadmin" },
      { key: "voice.notes", description: null, enabled: false, rolloutPercent: 0, plans: [], createdAt: iso(2_000), updatedAt: iso(2_000), updatedBy: null },
    ],
    overrides: [{ key: "voice.notes", workspaceId: ws(0).id, enabled: true, reason: "مشتری آزمایشی پیام صوتی", updatedAt: iso(100), updatedBy: "support" }],
    kafkaDown: false,
  };
}

/** Same rule as the backend: a stable 0..99 bucket per flag and workspace (FNV-1a over "key:workspaceIdWithoutDashes"). */
export function bucket(key: string, workspaceId: string): number {
  let hash = 2166136261;
  for (const c of `${key}:${workspaceId.replaceAll("-", "")}`) {
    hash ^= c.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash % 100;
}

function planOf(workspaceId: string): string | null {
  const w = workspaceFixtures.find((x) => x.id === workspaceId) as { planCode?: string | null } | undefined;
  return w?.planCode ?? (workspaceId.endsWith("b001") ? "pro" : "free");
}

export function evaluate(flag: Omit<FeatureFlag, "overrides">, workspaceId: string, override: boolean | null): { effective: boolean; source: string } {
  if (override !== null) return { effective: override, source: "override" };
  if (!flag.enabled) return { effective: false, source: "off" };
  const plan = planOf(workspaceId);
  if (flag.plans.length > 0 && (!plan || !flag.plans.includes(plan))) return { effective: false, source: "plan" };
  return bucket(flag.key, workspaceId) < flag.rolloutPercent ? { effective: true, source: "rollout" } : { effective: false, source: "rollout_excluded" };
}

function reasonError(reason: unknown): string | null {
  const n = typeof reason === "string" ? reason.trim().length : 0;
  return n < 5 ? "validation.too_short" : n > 300 ? "validation.too_long" : null;
}

async function read<T>(request: Request): Promise<Partial<T>> {
  try {
    return (await request.json()) as Partial<T>;
  } catch {
    return {};
  }
}

function kafka(s: PlatformMockState): KafkaOverview {
  const topics = [
    ["channels.inbound-message-received.v1", 48, 14, "conversation id", 182_440],
    ["conversations.reply-requested.v1", 48, 7, "conversation id", 90_112],
    ["conversations.outbound-message-requested.v1", 48, 7, "conversation id", 88_903],
    ["files.scan-requested.v1", 12, 7, "file id", 4_311],
    ["orders.order-created.v1", 12, 7, "order id", 1_208],
    ["audit.entry-recorded.v1", 12, 7, "workspace id", 22_019],
    ...GROUPS.map((g) => [`${g}.dlq`, 6, 14, "original key", s.deadLetters.filter((d) => d.group === g).length] as const),
  ] as const;
  const lag: Record<string, [string, number][]> = {
    ingest: [["channels.inbound-message-received.v1", 3]],
    engine: [["conversations.reply-requested.v1", 0]],
    ai: [["conversations.reply-requested.v1", 1_840]],
    outbound: [["conversations.outbound-message-requested.v1", 12]],
    media: [["files.scan-requested.v1", 0]],
    commerce: [["orders.order-created.v1", 0]],
    platform: [["audit.entry-recorded.v1", 57]],
    realtime: [],
  };
  return {
    at: new Date().toISOString(),
    topics: topics.map(([name, partitions, retentionDays, keyDescription, messages]) => ({ name, exists: true, partitions, messages, retentionDays, keyDescription, isDlq: name.endsWith(".dlq") })),
    groups: GROUPS.map((group) => {
      const rows = (lag[group] ?? []).map(([topic, total]) => {
        const partitions = Array.from({ length: 3 }, (_, p) => {
          const share = p === 0 ? total - Math.floor(total / 3) * 2 : Math.floor(total / 3);
          return { partition: p, committed: 10_000 + p, end: 10_000 + p + share, lag: share };
        });
        return { topic, lag: total, partitions };
      });
      return { group, state: group === "realtime" ? "Empty" : "Stable", members: group === "realtime" ? 0 : 2, lag: rows.reduce((a, r) => a + r.lag, 0), topics: rows };
    }),
  };
}

const flagView = (s: PlatformMockState, f: Omit<FeatureFlag, "overrides">): FeatureFlag => ({ ...f, overrides: s.overrides.filter((o) => o.key === f.key).length });

function workspaceFlag(s: PlatformMockState, f: Omit<FeatureFlag, "overrides">, workspaceId: string): WorkspaceFeatureFlag {
  const o = s.overrides.find((x) => x.key === f.key && x.workspaceId === workspaceId) ?? null;
  const { effective, source } = evaluate(f, workspaceId, o?.enabled ?? null);
  return { key: f.key, description: f.description, effective, source, override: o?.enabled ?? null, overrideReason: o?.reason ?? null, overriddenAt: o?.updatedAt ?? null, overriddenBy: o?.updatedBy ?? null };
}

export async function handlePlatform(request: Request, url: URL, s: PlatformMockState, user: { username: string; roles: string[] }, stepUpFresh: boolean, problem: Problem): Promise<Response | null> {
  const roles = user.roles;
  const has = (list: string[]) => roles.some((r) => list.includes(r));
  const path = url.pathname;
  const method = request.method;
  const now = new Date().toISOString();

  // ---- quarantine ----
  if (method === "GET" && path === "/admin/v1/files/quarantine") {
    if (!has(QUARANTINE_READERS)) return problem(403, "auth.forbidden");
    const status = url.searchParams.get("status") ?? "";
    if (status && !["infected", "scan_failed", "rejected", "pending"].includes(status)) return problem(400, "validation.failed", { status: ["validation.invalid"] });
    const workspaceId = url.searchParams.get("workspaceId");
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 25) || 25));
    const items = s.files
      .filter((f) => (status === "" ? f.status === "infected" || f.status === "scan_failed" || (f.status === "pending_scan" && f.stuck) : status === "pending" ? f.status === "pending_scan" && f.stuck : f.status === status))
      .filter((f) => !workspaceId || f.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return Response.json({ items: items.slice((page - 1) * pageSize, page * pageSize).map((f) => without(f, "sha256")), totalCount: items.length, page, pageSize });
  }
  if (method === "GET" && path === "/admin/v1/files/quarantine/summary") {
    if (!has(QUARANTINE_READERS)) return problem(403, "auth.forbidden");
    const count = (st: string) => s.files.filter((f) => f.status === st && (st !== "pending_scan" || f.stuck)).length;
    return Response.json({ infected: count("infected"), scanFailed: count("scan_failed"), pending: count("pending_scan"), rejected: count("rejected") });
  }
  const fileAction = method === "POST" ? /^\/admin\/v1\/files\/([0-9a-f-]{36})\/(rescan|delete|false-positive)$/i.exec(path) : null;
  if (fileAction) {
    const [, id, action] = fileAction;
    if (action === "false-positive" ? !roles.includes("SuperAdmin") : !has(QUARANTINE_READERS)) return problem(403, "auth.forbidden");
    if (action !== "rescan" && !stepUpFresh) return problem(403, "auth.step_up.required");
    const b = await read<{ reason: string }>(request);
    const err = reasonError(b.reason);
    if (err) return problem(400, "validation.failed", { reason: [err] });
    const index = s.files.findIndex((f) => f.id === id);
    const file = s.files[index];
    if (!file) return problem(404, "common.not_found");
    if (action === "delete") {
      if (file.status === "clean") return problem(409, "files.clean");
      s.files.splice(index, 1);
      return new Response(null, { status: 204 });
    }
    if (action === "false-positive") {
      if (file.status !== "infected") return problem(409, "files.not_infected");
      file.falsePositiveAt = now;
    } else if (!["infected", "scan_failed", "pending_scan"].includes(file.status)) {
      return problem(409, "files.not_rescannable");
    }
    Object.assign(file, { status: "pending_scan", scanAttempts: 0, rejectReason: null, stuck: false });
    return Response.json(without(file, "sha256"));
  }

  // ---- Kafka, dead letters, workers ----
  if (method === "GET" && path === "/admin/v1/platform/kafka") {
    if (!has(OPS_READERS)) return problem(403, "auth.forbidden");
    if (s.kafkaDown) return problem(503, "platform.kafka_unavailable");
    return Response.json(kafka(s));
  }
  if (method === "GET" && path === "/admin/v1/platform/dead-letters") {
    if (!has(OPS_READERS)) return problem(403, "auth.forbidden");
    const status = url.searchParams.get("status") || "open";
    if (!["open", "replayed", "discarded", "all"].includes(status)) return problem(400, "validation.failed", { status: ["validation.invalid"] });
    const group = url.searchParams.get("group");
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 25) || 25));
    const items = s.deadLetters.filter((d) => (status === "all" || d.status === status) && (!group || d.group === group)).sort((a, b) => b.failedAt.localeCompare(a.failedAt));
    return Response.json({ items: items.slice((page - 1) * pageSize, page * pageSize).map((d) => without(d, "envelope")), totalCount: items.length, page, pageSize });
  }
  if (method === "GET" && path === "/admin/v1/platform/dead-letters/summary") {
    if (!has(OPS_READERS)) return problem(403, "auth.forbidden");
    return Response.json(
      GROUPS.map((group) => {
        const open = s.deadLetters.filter((d) => d.group === group && d.status === "open");
        return { group, open: open.length, oldestOpenAt: open.length ? open.map((d) => d.failedAt).sort()[0] : null };
      }),
    );
  }
  const letterRoute = method === "GET" ? /^\/admin\/v1\/platform\/dead-letters\/([0-9a-f-]{36})$/i.exec(path) : null;
  if (letterRoute) {
    if (!has(["SuperAdmin", "Support"])) return problem(403, "auth.forbidden");
    const found = s.deadLetters.find((d) => d.id === letterRoute[1]);
    if (!found) return problem(404, "common.not_found");
    const { envelope, ...deadLetter } = found;
    return Response.json({ deadLetter, envelope });
  }
  const resolve = method === "POST" ? /^\/admin\/v1\/platform\/dead-letters\/(replay|discard)$/.exec(path) : null;
  if (resolve) {
    if (!roles.includes("SuperAdmin")) return problem(403, "auth.forbidden");
    if (!stepUpFresh) return problem(403, "auth.step_up.required");
    const b = await read<{ ids: string[]; reason: string }>(request);
    const errors: Record<string, string[]> = {};
    const err = reasonError(b.reason);
    if (err) errors.reason = [err];
    const ids = [...new Set(b.ids ?? [])];
    if (ids.length === 0 || ids.length > 100) errors.ids = [ids.length === 0 ? "validation.required" : "validation.too_many"];
    if (Object.keys(errors).length) return problem(400, "validation.failed", errors);
    const rows = s.deadLetters.filter((d) => ids.includes(d.id) && d.status === "open");
    for (const row of rows) {
      Object.assign(row, { status: resolve[1] === "replay" ? "replayed" : "discarded", resolvedAt: now, resolvedBy: user.username, resolutionReason: b.reason!.trim() });
      if (resolve[1] === "replay") row.replayMessageId = crypto.randomUUID();
    }
    return Response.json({ done: rows.length, skipped: ids.filter((id) => !rows.some((r) => r.id === id)) });
  }
  if (method === "GET" && path === "/admin/v1/platform/workers") {
    if (!has(OPS_READERS)) return problem(403, "auth.forbidden");
    const at = (seconds: number) => new Date(Date.now() - seconds * 1000).toISOString();
    return Response.json({
      instances: [
        { instanceId: "workers-7c9f5-1793872203101", lastCheckinAt: at(4), checkinIntervalSeconds: 10, alive: true },
        { instanceId: "workers-7c9f5-1793872203877", lastCheckinAt: at(7), checkinIntervalSeconds: 10, alive: true },
        { instanceId: "workers-55d81-1793801113420", lastCheckinAt: at(5400), checkinIntervalSeconds: 10, alive: false },
      ],
      jobs: s.jobs,
      groups: s.kafkaDown ? [] : kafka(s).groups.map((g) => without(g, "topics")),
    });
  }
  const trigger = method === "POST" ? /^\/admin\/v1\/platform\/jobs\/([^/]+)\/trigger$/.exec(path) : null;
  if (trigger) {
    if (!roles.includes("SuperAdmin")) return problem(403, "auth.forbidden");
    if (!stepUpFresh) return problem(403, "auth.step_up.required");
    const b = await read<{ reason: string }>(request);
    const err = reasonError(b.reason);
    if (err) return problem(400, "validation.failed", { reason: [err] });
    const job = s.jobs.find((j) => j.name === decodeURIComponent(trigger[1]!));
    if (!job) return problem(404, "common.not_found");
    if (job.state !== "WAITING") return problem(409, "platform.job_busy");
    job.nextFireAt = now;
    return Response.json(job);
  }

  // ---- feature flags ----
  if (path === "/admin/v1/feature-flags" || path.startsWith("/admin/v1/feature-flags/")) {
    const key = decodeURIComponent(path.slice("/admin/v1/feature-flags/".length).replace(/\/delete$/, ""));
    if (method === "GET" && path === "/admin/v1/feature-flags") {
      if (!has(FLAG_READERS)) return problem(403, "auth.forbidden");
      return Response.json([...s.flags].sort((a, b) => a.key.localeCompare(b.key)).map((f) => flagView(s, f)));
    }
    if (!roles.includes("SuperAdmin")) return problem(403, "auth.forbidden");
    if (method === "POST" && path.endsWith("/delete")) {
      if (!stepUpFresh) return problem(403, "auth.step_up.required");
      const b = await read<{ reason: string }>(request);
      const err = reasonError(b.reason);
      if (err) return problem(400, "validation.failed", { reason: [err] });
      const index = s.flags.findIndex((f) => f.key === key);
      if (index < 0) return problem(404, "common.not_found");
      s.flags.splice(index, 1);
      s.overrides = s.overrides.filter((o) => o.key !== key);
      return new Response(null, { status: 204 });
    }
    if (method === "POST" || method === "PUT") {
      const b = await read<{ key: string; description: string | null; enabled: boolean; rolloutPercent: number; plans: string[]; reason: string }>(request);
      const errors: Record<string, string[]> = {};
      const err = reasonError(b.reason);
      if (err) errors.reason = [err];
      const rollout = b.rolloutPercent ?? 0;
      if (!Number.isInteger(rollout) || rollout < 0 || rollout > 100) errors.rolloutPercent = ["validation.out_of_range"];
      if ((b.description ?? "").length > 300) errors.description = ["validation.too_long"];
      const plans = [...new Set((b.plans ?? []).map((p) => p.trim()).filter(Boolean))];
      if (method === "POST" && !/^[a-z][a-z0-9._-]{1,59}$/.test(b.key ?? "")) errors.key = ["validation.invalid"];
      if (Object.keys(errors).length) return problem(400, "validation.failed", errors);
      const description = b.description?.trim() || null;
      if (method === "POST") {
        if (s.flags.some((f) => f.key === b.key)) return problem(409, "backoffice.flag_exists");
        const flag = { key: b.key!, description, enabled: !!b.enabled, rolloutPercent: rollout, plans, createdAt: now, updatedAt: now, updatedBy: user.username };
        s.flags.push(flag);
        return Response.json(flagView(s, flag), { status: 201 });
      }
      const flag = s.flags.find((f) => f.key === key);
      if (!flag) return problem(404, "common.not_found");
      Object.assign(flag, { description, enabled: !!b.enabled, rolloutPercent: rollout, plans, updatedAt: now, updatedBy: user.username });
      return Response.json(flagView(s, flag));
    }
  }
  const wsFlags = /^\/admin\/v1\/workspaces\/([0-9a-f-]{36})\/feature-flags(?:\/([^/]+))?$/i.exec(path);
  if (wsFlags) {
    const [, workspaceId, rawKey] = wsFlags;
    if (method === "GET" && !rawKey) {
      if (!has(FLAG_READERS)) return problem(403, "auth.forbidden");
      return Response.json([...s.flags].sort((a, b) => a.key.localeCompare(b.key)).map((f) => workspaceFlag(s, f, workspaceId!)));
    }
    if (method === "PUT" && rawKey) {
      if (!has(["SuperAdmin", "Support"])) return problem(403, "auth.forbidden");
      const b = await read<{ enabled: boolean | null; reason: string }>(request);
      const err = reasonError(b.reason);
      if (err) return problem(400, "validation.failed", { reason: [err] });
      const key = decodeURIComponent(rawKey);
      const flag = s.flags.find((f) => f.key === key);
      if (!flag || !workspaceFixtures.some((w) => w.id === workspaceId)) return problem(404, "common.not_found");
      s.overrides = s.overrides.filter((o) => !(o.key === key && o.workspaceId === workspaceId));
      if (typeof b.enabled === "boolean") s.overrides.push({ key, workspaceId: workspaceId!, enabled: b.enabled, reason: b.reason!.trim(), updatedAt: now, updatedBy: user.username });
      return Response.json(workspaceFlag(s, flag, workspaceId!));
    }
  }
  return null;
}
