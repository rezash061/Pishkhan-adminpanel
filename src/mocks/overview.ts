// Mock state and handlers for AI traces (/admin/v1/ai/traces), the home dashboard (/admin/v1/dashboard) and the platform health page
// (/admin/v1/platform/health), as in backend PR #52. Used by src/mocks/admin-api.ts.

import type { AdminTraceDetail, AdminTraceSummary, DashboardResponse, PlatformHealthReport } from "@/lib/api/types";
import { workspaceFixtures } from "./fixtures";
import type { PlatformMockState } from "./platform";

type Problem = (status: number, code: string, errors?: Record<string, string[]>) => Response;

const TRACE_READERS = ["SuperAdmin", "AIOps", "Support", "ReadOnly"];
const TRACE_REVEALERS = ["SuperAdmin", "AIOps", "Support"];
const MINUTE = 60_000;

interface MockTrace extends AdminTraceDetail {
  /** What reveal returns; the stored detail is kept redacted. */
  content: Pick<AdminTraceDetail, "goal" | "input" | "reply" | "toolCalls" | "guardIssues">;
}

export interface OverviewMockState {
  traces: MockTrace[];
  /** Reveals, for tests: trace id and reason. */
  reveals: { id: string; reason: string }[];
}

export function seedOverview(): OverviewMockState {
  const now = Date.now();
  const at = (minutes: number) => new Date(now - minutes * MINUTE).toISOString();
  const ws = (n: number) => workspaceFixtures[n % workspaceFixtures.length]!.id;
  const trace = (
    n: number,
    over: Partial<AdminTraceSummary>,
    content: MockTrace["content"],
  ): MockTrace => {
    const summary: AdminTraceSummary = {
      id: `01938fa0-0000-7000-8000-0000000000${String(n).padStart(2, "0")}`,
      workspaceId: ws(n),
      conversationId: `01938fa1-0000-7000-8000-0000000000${String(n).padStart(2, "0")}`,
      intent: "price",
      language: "fa",
      outcome: "sent",
      handoffReason: null,
      confidence: 0.86,
      threshold: 0.6,
      prompts: "intent.classify@2 agent.reply@1",
      models: "avalai/gpt-4o-mini",
      inputTokens: 1_240,
      outputTokens: 96,
      costIrr: 3_200,
      latencyMs: 1_850,
      toolCallCount: content.toolCalls.length,
      guardIssueCount: content.guardIssues.length,
      createdAt: at(n * 7),
      ...over,
    };
    return {
      trace: summary,
      redacted: true,
      messageId: `01938fa2-0000-7000-8000-0000000000${String(n).padStart(2, "0")}`,
      flowRunId: null,
      goal: null,
      input: null,
      reply: null,
      sentiment: "neutral",
      classifierConfidence: 0.91,
      selfConfidence: summary.confidence,
      facts: [{ chunkId: "c1", sourceId: "s1", sourceKind: "product", title: "مانتو کتان تابستانی", score: 0.82, similarity: 0.79 }],
      toolCalls: content.toolCalls.map((c) => ({ ...c, arguments: null, result: null })),
      guardIssues: content.guardIssues.map((g) => ({ ...g, detail: "" })),
      content,
    };
  };
  const tool = { name: "get_product", arguments: '{"productId":"p-12"}', result: '{"price":1850000,"stock":3}', error: null };
  return {
    reveals: [],
    traces: [
      trace(1, {}, { goal: null, input: "سلام قیمت مانتو کتان چنده؟", reply: "سلام! مانتو کتان تابستانی ۱۸۵ هزار تومان است و ۳ عدد موجود داریم.", toolCalls: [tool], guardIssues: [] }),
      trace(
        2,
        { outcome: "handed_off", handoffReason: "guard_price", confidence: 0.42, intent: "price" },
        {
          goal: null,
          input: "اینو ۱۵۰ میدی؟",
          reply: "این سؤال را به همکارم می‌سپارم تا دربارهٔ تخفیف جواب بدهد.",
          toolCalls: [tool],
          guardIssues: [{ attempt: 1, kind: "price", detail: "پاسخ قیمت ۱۵۰ هزار تومان گفت که با کاتالوگ نمی‌خواند." }],
        },
      ),
      trace(3, { outcome: "failed", handoffReason: "ai_unavailable", confidence: null, intent: null, models: null, inputTokens: 0, outputTokens: 0, costIrr: 0 }, { goal: null, input: "ارسال به شیراز چند روزه؟", reply: null, toolCalls: [], guardIssues: [] }),
      trace(4, { intent: "shipping", confidence: 0.77, language: "finglish" }, { goal: "پیگیری سفارش", input: "salam sefaresh man kei mirese?", reply: "سلام! سفارش شما فردا تحویل پست می‌شود.", toolCalls: [], guardIssues: [] }),
      trace(5, { outcome: "handed_off", handoffReason: "human_request", intent: "human", confidence: 0.95 }, { goal: null, input: "میخوام با خود فروشنده صحبت کنم", reply: "حتماً، همکارم به‌زودی پاسخ می‌دهد.", toolCalls: [], guardIssues: [] }),
    ],
  };
}

const detailOf = (t: MockTrace, reveal: boolean): AdminTraceDetail => {
  const { content, ...rest } = t;
  return reveal ? { ...rest, ...content, redacted: false } : rest;
};

export async function handleOverview(request: Request, url: URL, s: OverviewMockState, platform: PlatformMockState, roles: string[], problem: Problem): Promise<Response | null> {
  const has = (list: string[]) => roles.some((r) => list.includes(r));
  const path = url.pathname;
  const method = request.method;

  if (method === "GET" && path === "/admin/v1/ai/traces") {
    if (!has(TRACE_READERS)) return problem(403, "auth.forbidden");
    const q = url.searchParams;
    const page = Math.max(1, Number(q.get("page") ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(q.get("pageSize") ?? 25) || 25));
    const max = q.get("maxConfidence") ? Number(q.get("maxConfidence")) : null;
    const items = s.traces
      .map((t) => t.trace)
      .filter((t) => !q.get("outcome") || t.outcome === q.get("outcome"))
      .filter((t) => !q.get("workspaceId") || t.workspaceId === q.get("workspaceId"))
      .filter((t) => max === null || (t.confidence !== null && t.confidence < max))
      .filter((t) => q.get("guardIssues") !== "true" || t.guardIssueCount > 0)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return Response.json({ items: items.slice((page - 1) * pageSize, page * pageSize), totalCount: items.length, page, pageSize });
  }

  if (method === "GET" && path === "/admin/v1/ai/traces/stats") {
    if (!has(TRACE_READERS)) return problem(403, "auth.forbidden");
    const outcomes: Record<string, number> = {};
    for (const t of s.traces) outcomes[t.trace.outcome] = (outcomes[t.trace.outcome] ?? 0) + 1;
    return Response.json({
      from: new Date(Date.now() - 24 * 60 * MINUTE).toISOString(),
      total: s.traces.length,
      outcomes,
      lowConfidence: s.traces.filter((t) => t.trace.confidence !== null && t.trace.confidence < t.trace.threshold).length,
      withGuardIssues: s.traces.filter((t) => t.trace.guardIssueCount > 0).length,
      costIrr: s.traces.reduce((sum, t) => sum + t.trace.costIrr, 0),
    });
  }

  const traceMatch = /^\/admin\/v1\/ai\/traces\/([^/]+)(\/reveal)?$/.exec(path);
  if (traceMatch) {
    const trace = s.traces.find((t) => t.trace.id === traceMatch[1]);
    if (method === "GET" && !traceMatch[2]) {
      if (!has(TRACE_READERS)) return problem(403, "auth.forbidden");
      return trace ? Response.json(detailOf(trace, false)) : problem(404, "common.not_found");
    }
    if (method === "POST" && traceMatch[2]) {
      if (!has(TRACE_REVEALERS)) return problem(403, "auth.forbidden");
      const b = (await request.json().catch(() => ({}))) as { reason?: string };
      const n = b.reason?.trim().length ?? 0;
      if (n < 5 || n > 300) return problem(400, "validation.failed", { reason: [n < 5 ? "validation.too_short" : "validation.too_long"] });
      if (!trace) return problem(404, "common.not_found");
      s.reveals.push({ id: trace.trace.id, reason: b.reason!.trim() });
      return Response.json(detailOf(trace, true));
    }
  }

  if (method === "GET" && path === "/admin/v1/dashboard") {
    const open = platform.deadLetters.filter((d) => d.status === "open").length;
    const quarantined = platform.files.filter((f) => f.status === "infected" || f.status === "scan_failed").length;
    const todays = s.traces.length;
    const body: DashboardResponse = {
      at: new Date().toISOString(),
      kpis: {
        activeWorkspaces: workspaceFixtures.filter((w) => w.status === "active").length,
        signupsToday: 2,
        signups7d: 11,
        payingWorkspaces: 3,
        mrrRial: 26_970_000,
        aiRepliesToday: todays,
        handoffRateToday: todays ? s.traces.filter((t) => t.trace.outcome === "handed_off").length / todays : null,
        quarantinedFiles: quarantined,
        openDeadLetters: open,
        maxConsumerLag: platform.kafkaDown ? null : 420,
        channelsNeedingReauth: 1,
        instagramStatus: "up",
      },
      alerts: [
        ...(platform.kafkaDown ? [{ code: "kafka_unavailable", severity: "danger" as const, count: null, subject: null }] : []),
        ...(open ? [{ code: "dead_letters", severity: "warning" as const, count: open, subject: null }] : []),
        { code: "channels_reauth", severity: "warning", count: 1, subject: null },
      ],
    };
    return Response.json(body);
  }

  if (method === "GET" && path === "/admin/v1/platform/health") {
    const checks: PlatformHealthReport["checks"] = {
      postgres: { status: "Healthy", ms: 3, detail: null },
      "redis-cache": { status: "Healthy", ms: 1, detail: "1 ms" },
      "redis-state": { status: "Healthy", ms: 1, detail: "1 ms" },
      kafka: platform.kafkaDown ? { status: "Unhealthy", ms: 5_000, detail: "timed out" } : { status: "Healthy", ms: 42, detail: "max lag 420" },
      workers: { status: "Healthy", ms: 6, detail: "2 replica(s)" },
      storage: { status: "Healthy", ms: 12, detail: null },
      clamav: { status: "Healthy", ms: 8, detail: "ClamAV 1.4.3/27450/Wed Nov  4 09:31:02 2026" },
      instagram: { status: "Healthy", ms: 4, detail: "auto" },
      ai: { status: "Healthy", ms: 9, detail: "0 of 5 replies failed in the last hour" },
    };
    const rank = (x: string) => (x === "Unhealthy" ? 2 : x === "Degraded" ? 1 : 0);
    const status = Object.values(checks).reduce((worst, c) => (rank(c.status) > rank(worst) ? c.status : worst), "Healthy");
    return Response.json({ status, checks });
  }

  return null;
}
