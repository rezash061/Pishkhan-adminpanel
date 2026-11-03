import { AGENT_TONES, type IndustryTemplate, type TemplateContent, type TemplateFlow, type TemplateRequest, type TemplateRule } from "@/lib/api/types";

/** Template item keys (backend `TemplateContentValidator`): lower-case Latin, digits, `_ . -`, 2 to 100 characters. */
export const KEY_PATTERN = /^[a-z][a-z0-9_.-]{1,99}$/;

/** Server limits (BE-2.9), used for maxLength and the counters in the editor. */
export const LIMITS = {
  name: 100,
  description: 500,
  facts: 30,
  faqs: 100,
  flows: 20,
  rules: 30,
  label: 100,
  prompt: 300,
  question: 500,
  answer: 4_000,
  profileName: 60,
  brandVoice: 1_000,
  phrase: 100,
  phrases: 50,
} as const;

/** Form state. Flows and rules are edited as JSON text; phrase lists as one phrase per line. */
export interface TemplateFormValues {
  name: string;
  description: string;
  requiredFacts: { key: string; label: string; prompt: string }[];
  faqs: { key: string; question: string; answer: string }[];
  hasProfile: boolean;
  profile: { name: string; tone: string; brandVoice: string; neverSay: string; handoffKeywords: string };
  flowsJson: string;
  rulesJson: string;
}

export const EMPTY_CONTENT: TemplateContent = { requiredFacts: [], faqs: [], flows: [], rules: [], agentProfile: null };

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

export function toFormValues(template: Pick<IndustryTemplate, "name" | "description" | "content">): TemplateFormValues {
  const c = template.content ?? EMPTY_CONTENT;
  const p = c.agentProfile;
  return {
    name: template.name,
    description: template.description ?? "",
    requiredFacts: (c.requiredFacts ?? []).map((f) => ({ key: f.key ?? "", label: f.label ?? "", prompt: f.prompt ?? "" })),
    faqs: (c.faqs ?? []).map((f) => ({ key: f.key ?? "", question: f.question ?? "", answer: f.answer ?? "" })),
    hasProfile: p != null,
    profile: {
      name: p?.name ?? "",
      tone: p?.tone ?? "friendly",
      brandVoice: p?.brandVoice ?? "",
      neverSay: (p?.neverSay ?? []).join("\n"),
      handoffKeywords: (p?.handoffKeywords ?? []).join("\n"),
    },
    flowsJson: pretty(c.flows ?? []),
    rulesJson: pretty(c.rules ?? []),
  };
}

/** One phrase per line; blank lines dropped, spaces trimmed. */
export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Which JSON field could not be read, and why (`syntax`, or `array` when it is not a list of objects). */
export class TemplateJsonError extends Error {
  constructor(
    readonly field: "flowsJson" | "rulesJson",
    readonly reason: "syntax" | "array",
  ) {
    super(`${field}: ${reason}`);
    this.name = "TemplateJsonError";
  }
}

/** Parses the flows or rules JSON: it must be an array of objects. Throws TemplateJsonError. */
export function parseJsonList<T>(field: "flowsJson" | "rulesJson", text: string): T[] {
  let value: unknown;
  try {
    value = text.trim() === "" ? [] : JSON.parse(text);
  } catch {
    throw new TemplateJsonError(field, "syntax");
  }
  if (!Array.isArray(value) || value.some((v) => v === null || typeof v !== "object" || Array.isArray(v))) throw new TemplateJsonError(field, "array");
  return value as T[];
}

/** Returns the error reason of a JSON field, or null when it parses. Used for the live hint under the editor. */
export function jsonProblem(field: "flowsJson" | "rulesJson", text: string): TemplateJsonError["reason"] | null {
  try {
    parseJsonList(field, text);
    return null;
  } catch (e) {
    return e instanceof TemplateJsonError ? e.reason : "syntax";
  }
}

/** Builds the request body. Throws TemplateJsonError when the flows or rules JSON is not a list. */
export function toTemplateRequest(values: TemplateFormValues): TemplateRequest {
  const flows = parseJsonList<TemplateFlow>("flowsJson", values.flowsJson);
  const rules = parseJsonList<TemplateRule>("rulesJson", values.rulesJson);
  const description = values.description.trim();
  return {
    name: values.name.trim(),
    description: description || null,
    content: {
      requiredFacts: values.requiredFacts.map((f) => ({ key: f.key.trim(), label: f.label.trim(), prompt: f.prompt.trim() })),
      faqs: values.faqs.map((f) => ({ key: f.key.trim(), question: f.question.trim(), answer: f.answer.trim() })),
      flows,
      rules,
      agentProfile: values.hasProfile
        ? {
            name: values.profile.name.trim(),
            tone: values.profile.tone,
            brandVoice: values.profile.brandVoice.trim() || null,
            neverSay: splitLines(values.profile.neverSay),
            handoffKeywords: splitLines(values.profile.handoffKeywords),
          }
        : null,
    },
  };
}

/** Re-indents valid JSON; leaves broken text alone so nothing is lost. */
export function formatJson(text: string): string {
  try {
    return pretty(JSON.parse(text));
  } catch {
    return text;
  }
}

export function isTone(value: string): value is (typeof AGENT_TONES)[number] {
  return (AGENT_TONES as readonly string[]).includes(value);
}

// ---- Read-only summaries of the JSON parts ----

const record = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

export interface FlowSummary {
  key: string;
  name: string;
  nodeCount: number;
  edgeCount: number;
  /** Node types in order of first appearance, with counts: `question ×3`. */
  nodeTypes: { type: string; count: number }[];
  start: string | null;
}

export function summarizeFlows(flows: readonly unknown[]): FlowSummary[] {
  return flows.map((raw, i) => {
    const f = record(raw) ?? {};
    const graph = record(f.graph) ?? {};
    const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
    const types = new Map<string, number>();
    for (const n of nodes) {
      const type = text(record(n)?.type) ?? "?";
      types.set(type, (types.get(type) ?? 0) + 1);
    }
    return {
      key: text(f.key) ?? `#${i + 1}`,
      name: text(f.name) ?? "",
      nodeCount: nodes.length,
      edgeCount: Array.isArray(graph.edges) ? graph.edges.length : 0,
      nodeTypes: [...types].map(([type, count]) => ({ type, count })),
      start: text(graph.start),
    };
  });
}

export interface RuleSummary {
  key: string;
  name: string;
  triggerKind: string;
  keywords: string[];
  actions: string[];
  /** The template flow a `start_flow` action names. */
  flowKey: string | null;
  priority: number | null;
}

export function summarizeRules(rules: readonly unknown[]): RuleSummary[] {
  return rules.map((raw, i) => {
    const r = record(raw) ?? {};
    const trigger = record(r.trigger) ?? {};
    const actions = Array.isArray(r.actions) ? r.actions.map(record) : [];
    const flowAction = actions.find((a) => a?.kind === "start_flow");
    return {
      key: text(r.key) ?? `#${i + 1}`,
      name: text(r.name) ?? "",
      triggerKind: text(r.triggerKind) ?? "",
      keywords: Array.isArray(trigger.keywords) ? trigger.keywords.filter((k): k is string => typeof k === "string") : [],
      actions: actions.map((a) => text(a?.kind) ?? "?"),
      flowKey: text(flowAction?.flowKey),
      priority: typeof r.priority === "number" ? r.priority : null,
    };
  });
}

/** Summaries from the editor's JSON text; empty when the text does not parse. */
export function summariesFromText(values: Pick<TemplateFormValues, "flowsJson" | "rulesJson">): { flows: FlowSummary[] | null; rules: RuleSummary[] | null } {
  const read = <T,>(field: "flowsJson" | "rulesJson", s: string, map: (items: unknown[]) => T) => {
    try {
      return map(parseJsonList(field, s));
    } catch {
      return null;
    }
  };
  return { flows: read("flowsJson", values.flowsJson, summarizeFlows), rules: read("rulesJson", values.rulesJson, summarizeRules) };
}

// ---- Issues ----

export const ISSUE_SECTIONS = ["content", "requiredFacts", "faqs", "flows", "rules", "agentProfile"] as const;
export type IssueSection = (typeof ISSUE_SECTIONS)[number] | "other";

export interface TemplateIssue {
  /** The raw issue string, for example `rules[size-keyword]: template.flow_key_unknown`. */
  raw: string;
  section: IssueSection;
  /** The item key in brackets, when the issue is about one item. */
  item: string | null;
  /** The field after the item, for example `answer` or `tone`. */
  field: string | null;
  /** The error key, for example `template.flow_key_unknown`. */
  code: string;
}

const ISSUE = /^([A-Za-z]+)(?:\[([^\]]*)\])?(?:\.([A-Za-z.]+))?:\s*(\S+)\s*$/;

/** Splits `faqs[shipping-cost].answer: validation.text.length` into its parts. Unknown shapes keep the raw text as code. */
export function parseIssue(raw: string): TemplateIssue {
  const m = ISSUE.exec(raw.trim());
  if (!m) return { raw, section: "other", item: null, field: null, code: raw.trim() };
  const [, head, item, field, code] = m;
  const section = (ISSUE_SECTIONS as readonly string[]).includes(head!) ? (head as IssueSection) : "other";
  return { raw, section, item: item ?? null, field: field ?? null, code: code! };
}

/** Issues grouped by section, in the editor's order. */
export function groupIssues(issues: readonly string[]): { section: IssueSection; issues: TemplateIssue[] }[] {
  const parsed = issues.map(parseIssue);
  const order: IssueSection[] = [...ISSUE_SECTIONS, "other"];
  return order.map((section) => ({ section, issues: parsed.filter((i) => i.section === section) })).filter((g) => g.issues.length > 0);
}

/** Issues of one item (`faqs`, `shipping-cost`), for the marker on its row. */
export function issuesFor(issues: readonly string[], section: IssueSection, item: string): TemplateIssue[] {
  return issues.map(parseIssue).filter((i) => i.section === section && i.item === item);
}

/** Every issue of a section (the agent profile has no item keys). */
export function issuesIn(issues: readonly string[], section: IssueSection): TemplateIssue[] {
  return issues.map(parseIssue).filter((i) => i.section === section);
}

/** Publishing needs a saved draft with no issues and the right to manage templates. */
export function publishBlocker(template: Pick<IndustryTemplate, "status" | "issues">, dirty: boolean): "notDraft" | "unsaved" | "issues" | null {
  if (template.status !== "draft") return "notDraft";
  if (dirty) return "unsaved";
  if (template.issues.length > 0) return "issues";
  return null;
}

/** The `issues` extension of a 422 `templates.invalid` problem. */
export function problemIssues(problem: unknown): string[] {
  const issues = record(problem)?.issues;
  return Array.isArray(issues) ? issues.filter((i): i is string => typeof i === "string") : [];
}
