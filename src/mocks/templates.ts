// Mock state and handlers for /admin/v1/industry-templates (backend PR #40, BE-2.9). Used by src/mocks/admin-api.ts.
// The fixtures are the backend's built-in templates (Seeds/*.json), copied into ./template-seeds.

import type { IndustryTemplate, TemplateContent, TemplateRequest } from "@/lib/api/types";
import beautyClinic from "./template-seeds/beauty_clinic.json";
import clothing from "./template-seeds/clothing.json";
import cosmetics from "./template-seeds/cosmetics.json";
import courses from "./template-seeds/courses.json";
import jewelry from "./template-seeds/jewelry.json";

const INDUSTRIES = ["clothing", "cosmetics", "jewelry", "beauty_clinic", "courses", "other"];
const STATUSES = ["draft", "published", "archived"];
const TONES = ["friendly", "formal", "playful"];
const KEY = /^[a-z][a-z0-9_.-]{1,99}$/;
const TRIGGERS = ["dm_keyword", "comment_keyword", "comment_any", "story_reply", "story_mention", "live_comment", "post_share", "new_conversation", "postback", "outside_business_hours"];
const KEYWORD_TRIGGERS = ["dm_keyword", "comment_keyword", "live_comment"];
const ACTIONS = ["send_message", "private_reply", "public_reply", "send_cards", "start_flow", "add_tag", "remove_tag", "set_field", "handoff", "pause_ai", "notify_team", "schedule_followup", "capture_phone"];
const NODE_TYPES = ["message", "question", "condition", "action", "ai", "delay", "cards", "end", "handoff", "form"];

interface Seed {
  industry: string;
  name: string;
  description: string | null;
  content: unknown;
}

export interface TemplatesMockState {
  templates: Omit<IndustryTemplate, "issues">[];
}

const json = (body: unknown, status = 200) => Response.json(body, { status });
type Problem = (status: number, code: string, errors?: Record<string, string[]>) => Response;

const SEEDS = [clothing, cosmetics, jewelry, beautyClinic, courses] as Seed[];

export function seedTemplates(): TemplatesMockState {
  const at = (iso: string) => new Date(iso).toISOString();
  const id = (n: number) => `01938fa0-0000-7000-8000-0000000000${String(n).padStart(2, "0")}`;
  const templates: TemplatesMockState["templates"] = SEEDS.map((s, i) => ({
    id: id(i + 1),
    industry: s.industry,
    version: 1,
    status: "published",
    name: s.name,
    description: s.description,
    content: structuredClone(s.content) as TemplateContent,
    createdAt: at("2026-11-03T06:00:00Z"),
    updatedAt: at("2026-11-03T06:00:00Z"),
    publishedAt: at("2026-11-03T06:00:00Z"),
  }));

  // Clothing has an open draft (version 2) with two issues: a rule naming a flow that does not exist and an empty FAQ answer.
  const draft = structuredClone(templates[0]!);
  draft.content.faqs.push({ key: "gift-wrap", question: "کادوپیچ هم دارید؟", answer: "" });
  draft.content.rules.push({
    key: "fabric-keyword",
    name: "سؤال جنس → راهنمای جنس",
    triggerKind: "dm_keyword",
    trigger: { match: "contains", keywords: ["جنسش", "پارچه"] },
    actions: [{ kind: "start_flow", flowKey: "fabric-help" }],
    priority: 60,
  });
  templates.push({ ...draft, id: id(6), version: 2, status: "draft", createdAt: at("2026-11-03T08:30:00Z"), updatedAt: at("2026-11-03T09:10:00Z"), publishedAt: null });

  // Cosmetics was published once before: version 1 archived, the seed is live as version 2.
  const cosmeticsLive = templates[1]!;
  templates.push({ ...structuredClone(cosmeticsLive), id: id(7), version: 1, status: "archived", name: "آرایشی (نسخهٔ آزمایشی)", createdAt: at("2026-10-20T06:00:00Z"), updatedAt: at("2026-11-03T06:00:00Z"), publishedAt: at("2026-10-20T06:00:00Z") });
  cosmeticsLive.version = 2;
  return { templates };
}

const rec = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const blank = (v: unknown, max: number) => typeof v !== "string" || !v.trim() || v.trim().length > max;

/** A simplified copy of the backend's `TemplateContentValidator` and `AutomationTemplates.Prepare`. */
export function validateTemplateContent(content: TemplateContent | null | undefined): string[] {
  if (!content) return ["content: validation.required"];
  const issues: string[] = [];
  const facts = content.requiredFacts ?? [];
  const faqs = content.faqs ?? [];
  const flows = content.flows ?? [];
  const rules = content.rules ?? [];
  for (const [field, n, max] of [["requiredFacts", facts.length, 30], ["faqs", faqs.length, 100], ["flows", flows.length, 20], ["rules", rules.length, 30]] as const) {
    if (n > max) issues.push(`${field}: templates.too_many`);
  }
  const key = (label: string, k: unknown, seen: Set<string>) => {
    if (typeof k !== "string" || !KEY.test(k) || seen.has(k)) issues.push(`${label}: template.key_invalid`);
    else seen.add(k);
  };
  let seen = new Set<string>();
  for (const f of facts) {
    const label = `requiredFacts[${f.key}]`;
    key(label, f.key, seen);
    if (blank(f.label, 100)) issues.push(`${label}.label: validation.text.length`);
    if (blank(f.prompt, 300)) issues.push(`${label}.prompt: validation.text.length`);
  }
  seen = new Set();
  for (const f of faqs) {
    const label = `faqs[${f.key}]`;
    key(label, f.key, seen);
    if (blank(f.question, 500)) issues.push(`${label}.question: validation.text.length`);
    if (blank(f.answer, 4000)) issues.push(`${label}.answer: validation.text.length`);
  }
  const p = content.agentProfile;
  if (p) {
    if (blank(p.name, 60)) issues.push("agentProfile.name: validation.text.length");
    if (!TONES.includes(p.tone)) issues.push("agentProfile.tone: templates.tone_invalid");
    if (p.brandVoice && p.brandVoice.length > 1000) issues.push("agentProfile.brandVoice: validation.text.length");
    for (const field of ["neverSay", "handoffKeywords"] as const) {
      const list = p[field] ?? [];
      if (list.length > 50 || list.some((x) => blank(x, 100))) issues.push(`agentProfile.${field}: validation.invalid`);
    }
  }

  const flowKeys = new Set<string>();
  for (const f of flows) {
    const label = `flows[${f.key}]`;
    if (typeof f.key !== "string" || !KEY.test(f.key) || flowKeys.has(f.key)) {
      issues.push(`${label}: template.key_invalid`);
      continue;
    }
    flowKeys.add(f.key);
    if (blank(f.name, 100)) {
      issues.push(`${label}: validation.name.length`);
      continue;
    }
    const graph = rec(f.graph);
    const nodes = Array.isArray(graph?.nodes) ? (graph.nodes as unknown[]).map(rec) : null;
    if (!nodes || !Array.isArray(graph?.edges) || nodes.length === 0) {
      issues.push(`${label}: flow.empty`);
      continue;
    }
    if (nodes.some((n) => n?.cardSetId != null || (Array.isArray(n?.actions) && n.actions.some((a) => rec(a)?.flowId != null || rec(a)?.cardSetId != null)))) {
      issues.push(`${label}: template.workspace_reference`);
      continue;
    }
    const ids = new Set(nodes.map((n) => n?.id).filter((x): x is string => typeof x === "string"));
    if (ids.size !== nodes.length) issues.push(`${label}: flow.node_duplicate`);
    if (nodes.some((n) => !NODE_TYPES.includes(String(n?.type)))) issues.push(`${label}: flow.node_type_unknown`);
    if (typeof graph.start !== "string" || !ids.has(graph.start)) issues.push(`${label}: flow.start_missing`);
    if ((graph.edges as unknown[]).some((e) => !ids.has(String(rec(e)?.from)) || !ids.has(String(rec(e)?.to)))) issues.push(`${label}: flow.edge_unknown_node`);
  }

  seen = new Set();
  for (const r of rules) {
    const label = `rules[${r.key}]`;
    if (typeof r.key !== "string" || !KEY.test(r.key) || seen.has(r.key)) {
      issues.push(`${label}: template.key_invalid`);
      continue;
    }
    seen.add(r.key);
    const actions = Array.isArray(r.actions) ? r.actions.map(rec) : null;
    if (!actions || actions.length === 0 || actions.some((a) => !a || typeof a.kind !== "string")) {
      issues.push(`${label}: template.actions_invalid`);
      continue;
    }
    const flowKey = actions.find((a) => a!.kind === "start_flow")?.flowKey;
    if (typeof flowKey === "string" && !flowKeys.has(flowKey)) {
      issues.push(`${label}: template.flow_key_unknown`);
      continue;
    }
    if (actions.some((a) => a!.cardSetId != null || a!.flowId != null)) {
      issues.push(`${label}: template.workspace_reference`);
      continue;
    }
    const trigger = r.trigger == null ? {} : rec(r.trigger);
    if (!trigger || trigger.postId != null) {
      issues.push(`${label}: template.trigger_invalid`);
      continue;
    }
    if (blank(r.name, 100)) issues.push(`${label}: validation.name.length`);
    if (!TRIGGERS.includes(r.triggerKind)) issues.push(`${label}: automation.trigger_unknown`);
    else if (KEYWORD_TRIGGERS.includes(r.triggerKind) && (!Array.isArray(trigger.keywords) || trigger.keywords.length === 0)) issues.push(`${label}: automation.keywords_required`);
    if (actions.some((a) => !ACTIONS.includes(String(a!.kind)))) issues.push(`${label}: automation.action_unknown`);
  }
  return issues;
}

export async function handleTemplates(request: Request, url: URL, s: TemplatesMockState, roles: string[], stepUpFresh: boolean, problem: Problem): Promise<Response | null> {
  const m = /^\/admin\/v1\/industry-templates(?:\/([0-9a-f-]{36})(?:\/(versions|publish|archive))?)?\/?$/i.exec(url.pathname);
  if (!m) return null;
  const reader = roles.some((r) => ["SuperAdmin", "AIOps", "Support", "ReadOnly"].includes(r));
  const writer = roles.some((r) => r === "SuperAdmin" || r === "AIOps");
  const body = async <T,>() => {
    try {
      return (await request.json()) as Partial<T>;
    } catch {
      return {} as Partial<T>;
    }
  };
  const out = (t: TemplatesMockState["templates"][number]): IndustryTemplate => ({ ...t, issues: validateTemplateContent(t.content) });
  const id = m[1]?.toLowerCase();
  const action = m[2];
  const method = request.method;

  if (method === "GET") {
    if (!reader) return problem(403, "auth.forbidden");
    if (id) {
      const t = s.templates.find((x) => x.id === id);
      return t ? json(out(t)) : problem(404, "not_found");
    }
    const industry = url.searchParams.get("industry") ?? "";
    const status = url.searchParams.get("status") ?? "";
    if (status && !STATUSES.includes(status)) return problem(400, "validation.failed", { status: ["validation.invalid"] });
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 50) || 50));
    const all = s.templates
      .filter((t) => (!industry || t.industry === industry) && (!status || t.status === status))
      .sort((a, b) => a.industry.localeCompare(b.industry) || b.version - a.version);
    return json({ items: all.slice((page - 1) * pageSize, page * pageSize).map(out), totalCount: all.length, page, pageSize });
  }

  if (!writer) return problem(403, "auth.forbidden");
  const validateRequest = (t: Partial<TemplateRequest> | undefined, prefix: string) => {
    const errors: Record<string, string[]> = {};
    if (!t) return { [prefix.replace(/\.$/, "") || "body"]: ["validation.required"] };
    if (!t.name?.trim() || t.name.trim().length > 100) errors[`${prefix}name`] = ["validation.name.length"];
    if (t.description && t.description.length > 500) errors[`${prefix}description`] = ["validation.text.length"];
    if (!t.content) errors[`${prefix}content`] = ["validation.required"];
    return errors;
  };
  const now = () => new Date().toISOString();

  if (method === "POST" && !id) {
    const b = await body<{ industry: string; template: TemplateRequest }>();
    const errors = validateRequest(b.template, "template.");
    if (!INDUSTRIES.includes(b.industry ?? "")) errors.industry = ["validation.industry.invalid"];
    if (Object.keys(errors).length) return problem(400, "validation.failed", errors);
    if (s.templates.some((t) => t.industry === b.industry)) return problem(409, "templates.industry_taken");
    const created = { id: crypto.randomUUID(), industry: b.industry!, version: 1, status: "draft", name: b.template!.name.trim(), description: b.template!.description ?? null, content: b.template!.content, createdAt: now(), updatedAt: now(), publishedAt: null };
    s.templates.push(created);
    return json(out(created), 201);
  }

  const template = s.templates.find((t) => t.id === id);
  if (method === "PUT" && !action) {
    const b = await body<TemplateRequest>();
    const errors = validateRequest(b, "");
    if (Object.keys(errors).length) return problem(400, "validation.failed", errors);
    if (!template) return problem(404, "not_found");
    if (template.status !== "draft") return problem(409, "templates.not_draft");
    Object.assign(template, { name: b.name!.trim(), description: b.description ?? null, content: b.content, updatedAt: now() });
    return json(out(template));
  }
  if (method === "POST" && action === "versions") {
    if (!template) return problem(404, "not_found");
    const same = s.templates.filter((t) => t.industry === template.industry);
    if (same.some((t) => t.status === "draft")) return problem(409, "templates.draft_exists");
    const next = { ...structuredClone(template), id: crypto.randomUUID(), version: Math.max(...same.map((t) => t.version)) + 1, status: "draft", createdAt: now(), updatedAt: now(), publishedAt: null };
    s.templates.push(next);
    return json(out(next), 201);
  }
  if (method === "POST" && (action === "publish" || action === "archive")) {
    // The step-up filter runs before the handler, as on the AdminApi.
    if (!stepUpFresh) return problem(403, "auth.step_up.required");
    const reason = ((await body<{ reason: string | null }>()).reason ?? "").trim();
    if ((action === "archive" || reason) && (reason.length < 5 || reason.length > 300)) return problem(400, "validation.failed", { reason: [reason.length < 5 ? "validation.too_short" : "validation.too_long"] });
    if (!template) return problem(404, "not_found");
    if (action === "archive") {
      Object.assign(template, { status: "archived", updatedAt: now() });
      return json(out(template));
    }
    if (template.status !== "draft") return problem(409, "templates.not_draft");
    const issues = validateTemplateContent(template.content);
    if (issues.length) {
      return Response.json(
        { type: "https://tools.ietf.org/html/rfc9110#section-15.5.21", title: "templates.invalid", status: 422, detail: issues.slice(0, 20).join("; "), code: "templates.invalid", issues },
        { status: 422, headers: { "content-type": "application/problem+json" } },
      );
    }
    for (const t of s.templates) if (t.industry === template.industry && t.status === "published") Object.assign(t, { status: "archived", updatedAt: now() });
    Object.assign(template, { status: "published", publishedAt: now(), updatedAt: now() });
    return json(out(template));
  }
  return null;
}
