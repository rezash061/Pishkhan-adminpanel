// Mock state and handlers for /admin/v1/ai (backend PR #24). Used by src/mocks/admin-api.ts.

import type { AiProvider, AiRouteStep, EvalResult, EvalRun, EvalSet, PromptVersion } from "@/lib/api/types";

const TASKS = ["classify", "generate_reply", "extract_receipt", "transcribe", "embed", "summarize", "content"];
const GATE = { minCases: 1, minAccuracy: 0.85, maxErrorRate: 0.05 };
const RUN_SECONDS = 1.5;

interface MockCase {
  id: string;
  ref: string;
  vertical: string | null;
  input: string;
  expectedIntent: string | null;
}

interface MockRun extends Omit<EvalRun, "gate" | "setName"> {
  /** Share of cases answered correctly once the run finishes. */
  targetAccuracy: number;
}

export interface AiMockState {
  providers: AiProvider[];
  dbRoutes: Record<string, AiRouteStep[]>;
  versions: (Omit<PromptVersion, "active" | "latestRun">)[];
  activations: Record<string, string>;
  sets: (Omit<EvalSet, "caseCount"> & { cases: MockCase[] })[];
  runs: MockRun[];
}

const step = (provider: string, model: string, over: Partial<AiRouteStep> = {}): AiRouteStep => ({
  provider,
  model,
  temperature: null,
  maxOutputTokens: null,
  timeoutSeconds: 30,
  inputPricePerMillion: null,
  outputPricePerMillion: null,
  ...over,
});

const CONFIG_ROUTES: Record<string, AiRouteStep[]> = {
  classify: [step("openai", "gpt-4o-mini", { temperature: 0, maxOutputTokens: 64, timeoutSeconds: 10 }), step("fake", "fake-classifier", { timeoutSeconds: 5 })],
  generate_reply: [step("openai", "gpt-4o-mini", { temperature: 0.4, maxOutputTokens: 600 })],
  extract_receipt: [step("openai", "gpt-4o-mini", { temperature: 0, timeoutSeconds: 60 })],
  embed: [step("openai", "text-embedding-3-small")],
  summarize: [step("openai", "gpt-4o-mini")],
  content: [step("openai", "gpt-4o")],
};

const INTENTS = ["price", "availability", "shipping", "order_status", "complaint", "greeting"];
const SAMPLE_INPUTS = ["قیمت این مانتو چنده؟", "سایز ۳۸ موجوده؟", "ارسال به شیراز چند روز طول می‌کشه؟", "سفارشم کی می‌رسه؟", "جنس پارچه خراب بود", "سلام وقت بخیر"];

function cases(prefix: string, count: number, vertical: string): MockCase[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `01938f80-0000-7000-8000-${prefix}${String(i + 1).padStart(10, "0")}`,
    ref: `${vertical}-${i + 1}`,
    vertical,
    input: SAMPLE_INPUTS[i % SAMPLE_INPUTS.length]!,
    expectedIntent: INTENTS[i % INTENTS.length]!,
  }));
}

export function seedAi(): AiMockState {
  const at = (iso: string) => new Date(iso).toISOString();
  const run = (n: number, setId: string, version: string, accuracy: number, caseCount: number, startedAt: string): MockRun => ({
    id: `01938f81-0000-7000-8000-0000000000${String(n).padStart(2, "0")}`,
    setId,
    task: "classify",
    promptKey: "intent.classify",
    promptVersion: version,
    route: "openai/gpt-4o-mini",
    status: "completed",
    caseCount,
    errorCount: 0,
    intentAccuracy: accuracy,
    inputTokens: caseCount * 410,
    outputTokens: caseCount * 6,
    startedAt: at(startedAt),
    finishedAt: new Date(Date.parse(startedAt) + 40_000).toISOString(),
    targetAccuracy: accuracy,
  });
  const fashion = "01938f82-0000-7000-8000-000000000001";
  const clinic = "01938f82-0000-7000-8000-000000000002";
  return {
    providers: [
      { name: "avalai", kind: "openai", baseUrl: "https://api.avalai.ir/v1", hasApiKey: true, enabled: true, source: "database", lastTestError: null, lastTestedAt: at("2026-10-30T08:00:00Z") },
      { name: "fake", kind: "fake", baseUrl: null, hasApiKey: false, enabled: true, source: "configuration", lastTestError: null, lastTestedAt: null },
      { name: "openai", kind: "openai", baseUrl: null, hasApiKey: true, enabled: true, source: "configuration", lastTestError: null, lastTestedAt: null },
    ],
    dbRoutes: {
      generate_reply: [step("avalai", "gpt-4o", { temperature: 0.4, maxOutputTokens: 600, inputPricePerMillion: 1_500_000, outputPricePerMillion: 6_000_000 }), step("openai", "gpt-4o-mini", { temperature: 0.4 })],
    },
    versions: [
      { key: "intent.classify", version: "1", text: "You classify one Instagram DM for a Persian shop.\nReturn one intent: price, availability, shipping, order_status, complaint, greeting.\nMessage: {{message}}", source: "configuration", baseVersion: null, createdAt: null },
      { key: "intent.classify", version: "2", text: "You classify one Instagram DM for a Persian shop.\nReturn exactly one intent: price, availability, shipping, order_status, complaint, greeting.\nIf unsure, answer greeting.\nMessage: {{message}}", source: "database", baseVersion: "1", createdAt: at("2026-10-29T10:00:00Z") },
      { key: "intent.classify", version: "3", text: "Classify the DM.\nMessage: {{message}}", source: "database", baseVersion: "2", createdAt: at("2026-10-30T10:00:00Z") },
      { key: "reply.system", version: "1", text: "تو دستیار فروش {{shop}} هستی. کوتاه و مؤدبانه پاسخ بده.", source: "configuration", baseVersion: null, createdAt: null },
    ],
    activations: {},
    sets: [
      { id: fashion, name: "fashion-fa", description: "پیام‌های ناشناس‌شدهٔ فروشگاه‌های پوشاک", updatedAt: at("2026-10-28T09:00:00Z"), cases: cases("0001", 12, "clothing") },
      { id: clinic, name: "clinic-fa", description: null, updatedAt: at("2026-10-28T09:30:00Z"), cases: cases("0002", 6, "beauty_clinic") },
    ],
    runs: [run(1, fashion, "1", 0.8333, 12, "2026-10-28T10:00:00Z"), run(2, fashion, "2", 0.9167, 12, "2026-10-29T11:00:00Z"), run(3, fashion, "3", 0.75, 12, "2026-10-30T11:00:00Z")],
  };
}

const json = (body: unknown, status = 200) => Response.json(body, { status });

type Problem = (status: number, code: string, errors?: Record<string, string[]>) => Response;

function settle(r: MockRun) {
  if (r.status === "running" && Date.now() - Date.parse(r.startedAt) > RUN_SECONDS * 1000) {
    r.status = "completed";
    r.intentAccuracy = r.caseCount ? Math.round((Math.round(r.targetAccuracy * r.caseCount) / r.caseCount) * 10_000) / 10_000 : null;
    r.finishedAt = new Date().toISOString();
    r.inputTokens = r.caseCount * 410;
    r.outputTokens = r.caseCount * 6;
  }
}

function toRun(s: AiMockState, r: MockRun): EvalRun {
  settle(r);
  const errorRate = r.caseCount ? r.errorCount / r.caseCount : null;
  const checks = [
    { name: "completed", required: 1, actual: r.status === "completed" ? 1 : 0, passed: r.status === "completed" },
    { name: "cases", required: GATE.minCases, actual: r.caseCount, passed: r.caseCount >= GATE.minCases },
    { name: "intent_accuracy", required: GATE.minAccuracy, actual: r.intentAccuracy, passed: (r.intentAccuracy ?? -1) >= GATE.minAccuracy },
    { name: "error_rate", required: GATE.maxErrorRate, actual: errorRate, passed: errorRate != null && errorRate <= GATE.maxErrorRate },
  ];
  const { targetAccuracy: _t, ...rest } = r;
  void _t;
  return { ...rest, setName: s.sets.find((x) => x.id === r.setId)?.name ?? "", gate: { passed: r.status === "completed" && checks.every((c) => c.passed), checks } };
}

function activeVersion(s: AiMockState, key: string): string {
  if (s.activations[key]) return s.activations[key]!;
  const config = s.versions.filter((v) => v.key === key && v.source === "configuration").map((v) => v.version);
  return (config.length ? config : s.versions.filter((v) => v.key === key).map((v) => v.version)).sort((a, b) => Number(b) - Number(a))[0]!;
}

function routesFor(s: AiMockState, task: string) {
  const db = s.dbRoutes[task];
  const routes = db ?? CONFIG_ROUTES[task] ?? [];
  return { task, source: db ? "database" : routes.length ? "configuration" : "none", routes };
}

function reasonError(reason: unknown): Record<string, string[]> | null {
  const r = typeof reason === "string" ? reason.trim() : "";
  return r.length < 5 || r.length > 300 ? { reason: [r ? (r.length < 5 ? "validation.too_short" : "validation.too_long") : "validation.required"] } : null;
}

export async function handleAi(request: Request, url: URL, s: AiMockState, roles: string[], stepUpFresh: boolean, problem: Problem): Promise<Response | null> {
  const path = url.pathname.replace(/^\/admin\/v1\/ai/, "");
  const reader = roles.some((r) => r === "SuperAdmin" || r === "AIOps" || r === "ReadOnly");
  const ops = roles.some((r) => r === "SuperAdmin" || r === "AIOps");
  const superAdmin = roles.includes("SuperAdmin");
  const body = async <T,>() => {
    try {
      return (await request.json()) as Partial<T>;
    } catch {
      return {} as Partial<T>;
    }
  };
  const method = request.method;
  if (method === "GET" && !reader) return problem(403, "auth.forbidden");

  if (method === "GET" && path === "/providers") return json([...s.providers].sort((a, b) => a.name.localeCompare(b.name)));
  let m = /^\/providers\/([^/]+)(\/test)?$/.exec(path);
  if (m) {
    const name = decodeURIComponent(m[1]!);
    if (!superAdmin) return problem(403, "auth.forbidden");
    if (m[2] && method === "POST") {
      const b = await body<{ model: string }>();
      const model = (b.model ?? "").trim();
      if (!model || model.length > 200) return problem(400, "validation.failed", { model: ["validation.invalid"] });
      const p = s.providers.find((x) => x.name === name && x.enabled);
      if (!p) return problem(404, "ai.provider.not_found");
      const ok = p.kind === "fake" || (p.hasApiKey && !model.includes("missing"));
      const error = ok ? null : p.hasApiKey ? `model '${model}' not found (404)` : "401 Unauthorized: no API key";
      if (p.source === "database") Object.assign(p, { lastTestedAt: new Date().toISOString(), lastTestError: error });
      return json({ ok, error, latencyMs: ok ? 420 : 180 });
    }
    if (!m[2] && method === "PUT") {
      if (!stepUpFresh) return problem(403, "auth.step_up.required");
      const b = await body<{ kind: string; baseUrl: string | null; apiKey: string | null; clearApiKey: boolean; enabled: boolean; reason: string }>();
      const errors: Record<string, string[]> = {};
      if (!/^[a-z][a-z0-9_-]{1,39}$/.test(name)) errors.name = ["validation.invalid"];
      if (b.kind !== "openai" && b.kind !== "fake") errors.kind = ["validation.invalid"];
      if (b.baseUrl && !/^https?:\/\/\S+$/.test(b.baseUrl)) errors.baseUrl = ["validation.invalid"];
      Object.assign(errors, reasonError(b.reason));
      if (Object.keys(errors).length) return problem(400, "validation.failed", errors);
      let p = s.providers.find((x) => x.name === name);
      const hadKey = p?.hasApiKey ?? false;
      if (!p) {
        p = { name, kind: b.kind!, baseUrl: null, hasApiKey: false, enabled: true, source: "database", lastTestError: null, lastTestedAt: null };
        s.providers.push(p);
      }
      Object.assign(p, { kind: b.kind, baseUrl: b.baseUrl?.trim() || null, enabled: !!b.enabled, source: "database", hasApiKey: b.clearApiKey ? false : b.apiKey ? true : hadKey });
      return json(p);
    }
  }

  if (method === "GET" && path === "/routes") return json(TASKS.map((t) => routesFor(s, t)));
  m = /^\/routes\/([^/]+)$/.exec(path);
  if (m && method === "PUT") {
    if (!ops) return problem(403, "auth.forbidden");
    const task = decodeURIComponent(m[1]!);
    if (!TASKS.includes(task)) return problem(404, "ai.task.not_found");
    const b = await body<{ routes: AiRouteStep[]; reason: string }>();
    const steps = b.routes ?? [];
    const errors: Record<string, string[]> = { ...reasonError(b.reason) };
    if (steps.length > 5) errors.routes = ["validation.too_many"];
    steps.forEach((st, i) => {
      const at = `routes[${i}].`;
      if (!s.providers.some((p) => p.name === st.provider && p.enabled)) errors[`${at}provider`] = ["ai.provider.not_found"];
      if (!st.model?.trim() || st.model.length > 200) errors[`${at}model`] = ["validation.invalid"];
      if (st.temperature != null && (st.temperature < 0 || st.temperature > 2)) errors[`${at}temperature`] = ["validation.range"];
      if (st.maxOutputTokens != null && (st.maxOutputTokens < 1 || st.maxOutputTokens > 32_000)) errors[`${at}maxOutputTokens`] = ["validation.range"];
      if (st.timeoutSeconds < 1 || st.timeoutSeconds > 300) errors[`${at}timeoutSeconds`] = ["validation.range"];
    });
    if (new Set(steps.map((x) => `${x.provider}/${x.model}`)).size !== steps.length) errors.routes = ["ai.routes.duplicate"];
    if (Object.keys(errors).length) return problem(400, "validation.failed", errors);
    if (steps.length) s.dbRoutes[task] = steps;
    else delete s.dbRoutes[task];
    return json(routesFor(s, task));
  }

  const keys = [...new Set(s.versions.map((v) => v.key))].sort();
  const keyInfo = (key: string) => {
    const active = activeVersion(s, key);
    return { key, activeVersion: active, activeSource: s.versions.find((v) => v.key === key && v.version === active)!.source, versionCount: s.versions.filter((v) => v.key === key).length };
  };
  if (method === "GET" && path === "/prompts") return json(keys.map(keyInfo));
  m = /^\/prompts\/([^/]+)(?:\/versions(?:\/([^/]+)\/(activate))?)?$/.exec(path);
  if (m) {
    const key = decodeURIComponent(m[1]!);
    const isVersions = path.endsWith("/versions");
    if (method === "GET" && !isVersions && !m[3]) {
      if (!keys.includes(key)) return problem(404, "not_found");
      const active = activeVersion(s, key);
      const list = s.versions.filter((v) => v.key === key).sort((a, b) => Number(b.version) - Number(a.version));
      return json(
        list.map((v) => {
          const latest = s.runs.filter((r) => r.promptKey === key && r.promptVersion === v.version).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0];
          return { ...v, active: v.version === active, latestRun: latest ? toRun(s, latest) : null };
        }),
      );
    }
    if (method === "POST" && isVersions) {
      if (!ops) return problem(403, "auth.forbidden");
      const b = await body<{ text: string; baseVersion: string | null }>();
      const errors: Record<string, string[]> = {};
      if (!b.text?.trim()) errors.text = ["validation.required"];
      else if (b.text.length > 20_000) errors.text = ["validation.too_long"];
      if (b.baseVersion && !s.versions.some((v) => v.key === key && v.version === b.baseVersion)) errors.baseVersion = ["validation.invalid"];
      if (Object.keys(errors).length) return problem(400, "validation.failed", errors);
      const next = String(Math.max(0, ...s.versions.filter((v) => v.key === key).map((v) => Number(v.version))) + 1);
      const created = { key, version: next, text: b.text!, source: "database", baseVersion: b.baseVersion ?? null, createdAt: new Date().toISOString() };
      s.versions.push(created);
      return json({ ...created, active: false, latestRun: null }, 201);
    }
    if (method === "POST" && m[3] === "activate") {
      if (!ops) return problem(403, "auth.forbidden");
      const version = decodeURIComponent(m[2]!);
      const b = await body<{ evalRunId: string; reason: string }>();
      const errors = reasonError(b.reason);
      if (errors) return problem(400, "validation.failed", errors);
      if (!s.versions.some((v) => v.key === key && v.version === version)) return problem(404, "ai.prompt.not_found");
      const run = s.runs.find((r) => r.id === b.evalRunId);
      if (!run) return problem(404, "ai.eval_run.not_found");
      const result = toRun(s, run);
      if (run.promptKey !== key || run.promptVersion !== version || !result.gate.passed) {
        const reasons: Record<string, string[]> = {};
        if (run.promptKey !== key || run.promptVersion !== version) reasons.evalRunId = ["ai.eval_run.other_version"];
        for (const c of result.gate.checks.filter((x) => !x.passed)) reasons[`gate.${c.name}`] = [`required ${c.required}, actual ${c.actual ?? "none"}`];
        return problem(409, "ai.prompt.eval_gate", reasons);
      }
      s.activations[key] = version;
      return json(keyInfo(key));
    }
  }

  if (method === "GET" && path === "/eval-sets") return json(s.sets.map(({ cases: c, ...rest }) => ({ ...rest, caseCount: c.length })).sort((a, b) => a.name.localeCompare(b.name)));
  m = /^\/eval-sets\/([^/]+)\/import$/.exec(path);
  if (m && method === "POST") {
    if (!ops) return problem(403, "auth.forbidden");
    const name = decodeURIComponent(m[1]!);
    if (!/^[a-z][a-z0-9_-]{1,39}$/.test(name)) return problem(400, "validation.failed", { name: ["validation.invalid"] });
    let set = s.sets.find((x) => x.name === name);
    if (!set) {
      set = { id: crypto.randomUUID(), name, description: null, updatedAt: new Date().toISOString(), cases: [] };
      s.sets.push(set);
    }
    let imported = 0;
    let updated = 0;
    const errors: string[] = [];
    (await request.text()).split("\n").forEach((raw, i) => {
      if (!raw.trim()) return;
      let line: { ref?: string; input?: string; vertical?: string; messages?: { role: string; text: string }[]; expected?: { intent?: string } };
      try {
        line = JSON.parse(raw);
      } catch (e) {
        errors.push(`line ${i + 1}: ${(e as Error).message}`);
        return;
      }
      const input = line.input ?? line.messages?.filter((x) => x.role === "customer").at(-1)?.text;
      if (!input?.trim()) {
        errors.push(`line ${i + 1}: no input or customer message`);
        return;
      }
      const ref = line.ref ?? `line-${i + 1}`;
      const existing = set.cases.find((c) => c.ref === ref);
      const fields = { input, vertical: line.vertical ?? null, expectedIntent: line.expected?.intent ?? null };
      if (existing) {
        Object.assign(existing, fields);
        updated++;
      } else {
        set.cases.push({ id: crypto.randomUUID(), ref, ...fields });
        imported++;
      }
    });
    set.updatedAt = new Date().toISOString();
    return json({ imported, updated, errors });
  }

  if (method === "GET" && path === "/eval-runs") {
    const q = url.searchParams;
    const page = Math.max(1, Number(q.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(q.get("pageSize") ?? 25)));
    const list = s.runs
      .filter((r) => (!q.get("promptKey") || r.promptKey === q.get("promptKey")) && (!q.get("promptVersion") || r.promptVersion === q.get("promptVersion")) && (!q.get("setId") || r.setId === q.get("setId")))
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
    return json({ items: list.slice((page - 1) * pageSize, page * pageSize).map((r) => toRun(s, r)), totalCount: list.length, page, pageSize });
  }
  m = /^\/eval-runs\/([0-9a-f-]{36})$/i.exec(path);
  if (m && method === "GET") {
    const run = s.runs.find((r) => r.id === m![1]!.toLowerCase());
    if (!run) return problem(404, "not_found");
    const detail = toRun(s, run);
    const set = s.sets.find((x) => x.id === run.setId);
    const wrong = run.status === "completed" ? run.caseCount - Math.round((run.intentAccuracy ?? 0) * run.caseCount) : 0;
    const results: EvalResult[] =
      run.status === "completed"
        ? (set?.cases ?? []).map((c, i) => ({
            caseId: c.id,
            ref: c.ref,
            vertical: c.vertical,
            input: c.input,
            expectedIntent: c.expectedIntent,
            predictedIntent: i < wrong ? (c.expectedIntent === "greeting" ? "price" : "greeting") : c.expectedIntent,
            correct: c.expectedIntent ? i >= wrong : null,
            route: run.route,
            latencyMs: 300 + ((i * 37) % 200),
            error: null,
          }))
        : [];
    results.sort((a, b) => Number(a.correct !== false) - Number(b.correct !== false) || a.ref.localeCompare(b.ref));
    return json({ run: detail, results });
  }
  if (method === "POST" && path === "/eval-runs") {
    if (!ops) return problem(403, "auth.forbidden");
    const b = await body<{ setId: string; promptKey: string; promptVersion: string }>();
    if (b.promptKey !== "intent.classify") return problem(400, "validation.failed", { promptKey: ["ai.eval.unsupported_prompt"] });
    const set = s.sets.find((x) => x.id === b.setId);
    if (!set) return problem(404, "ai.eval_set.not_found");
    if (!s.versions.some((v) => v.key === b.promptKey && v.version === b.promptVersion)) return problem(404, "ai.prompt.not_found");
    // New versions score 90% so the gate passes, except text containing "WEAK", which scores 50%.
    const text = s.versions.find((v) => v.key === b.promptKey && v.version === b.promptVersion)!.text;
    const run: MockRun = {
      id: crypto.randomUUID(),
      setId: set.id,
      task: "classify",
      promptKey: b.promptKey,
      promptVersion: b.promptVersion!,
      route: routesFor(s, "classify").routes[0] ? `${routesFor(s, "classify").routes[0]!.provider}/${routesFor(s, "classify").routes[0]!.model}` : null,
      status: "running",
      caseCount: set.cases.length,
      errorCount: 0,
      intentAccuracy: null,
      inputTokens: 0,
      outputTokens: 0,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      targetAccuracy: text.includes("WEAK") ? 0.5 : 0.9,
    };
    s.runs.push(run);
    return json(toRun(s, run), 202);
  }

  return null;
}
