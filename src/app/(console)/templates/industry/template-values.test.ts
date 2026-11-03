import { describe, expect, it } from "vitest";
import clothing from "@/mocks/template-seeds/clothing.json";
import type { TemplateContent } from "@/lib/api/types";
import {
  formatJson,
  groupIssues,
  issuesFor,
  issuesIn,
  jsonProblem,
  KEY_PATTERN,
  parseIssue,
  problemIssues,
  publishBlocker,
  splitLines,
  summarizeFlows,
  summarizeRules,
  TemplateJsonError,
  toFormValues,
  toTemplateRequest,
} from "./template-values";

const seed = { name: clothing.name, description: clothing.description, content: clothing.content as TemplateContent };

describe("template form values", () => {
  it("round-trips a built-in template unchanged", () => {
    expect(toTemplateRequest(toFormValues(seed))).toEqual(seed);
  });

  it("trims text, drops blank phrase lines and sends an empty description as null", () => {
    const values = toFormValues(seed);
    values.name = "  پوشاک  ";
    values.description = "   ";
    values.profile.neverSay = "  تخفیف ویژه \n\n حتماً اندازه است\n";
    values.faqs[0]!.key = " shipping-cost ";
    const request = toTemplateRequest(values);
    expect(request.name).toBe("پوشاک");
    expect(request.description).toBeNull();
    expect(request.content.agentProfile?.neverSay).toEqual(["تخفیف ویژه", "حتماً اندازه است"]);
    expect(request.content.faqs[0]!.key).toBe("shipping-cost");
  });

  it("sends no agent profile when it is switched off, and keeps the brand voice null when empty", () => {
    const values = toFormValues(seed);
    values.profile.brandVoice = " ";
    expect(toTemplateRequest(values).content.agentProfile?.brandVoice).toBeNull();
    values.hasProfile = false;
    expect(toTemplateRequest(values).content.agentProfile).toBeNull();
  });

  it("starts a template without a profile with the friendly tone and empty JSON lists", () => {
    const values = toFormValues({ name: "", description: null, content: { requiredFacts: [], faqs: [], flows: [], rules: [], agentProfile: null } });
    expect(values.hasProfile).toBe(false);
    expect(values.profile.tone).toBe("friendly");
    expect(values.flowsJson).toBe("[]");
  });

  it("refuses JSON that does not parse or is not a list of objects, naming the field", () => {
    const values = toFormValues(seed);
    values.flowsJson = "[{";
    expect(() => toTemplateRequest(values)).toThrow(TemplateJsonError);
    try {
      toTemplateRequest(values);
    } catch (e) {
      expect((e as TemplateJsonError).field).toBe("flowsJson");
      expect((e as TemplateJsonError).reason).toBe("syntax");
    }
    expect(jsonProblem("rulesJson", '{"key":"x"}')).toBe("array");
    expect(jsonProblem("rulesJson", "[1, 2]")).toBe("array");
    expect(jsonProblem("rulesJson", "")).toBeNull();
    expect(jsonProblem("rulesJson", "[]")).toBeNull();
  });

  it("formats valid JSON and leaves broken text alone", () => {
    expect(formatJson('[{"a":1}]')).toBe('[\n  {\n    "a": 1\n  }\n]');
    expect(formatJson("[{")).toBe("[{");
  });

  it("splits phrase lists on new lines", () => {
    expect(splitLines("شکایت\r\n مرجوعی \n\n")).toEqual(["شکایت", "مرجوعی"]);
  });

  it("checks item keys like the backend", () => {
    expect(KEY_PATTERN.test("size-help")).toBe(true);
    expect(KEY_PATTERN.test("shipping_cost.v2")).toBe(true);
    expect(KEY_PATTERN.test("x")).toBe(false);
    expect(KEY_PATTERN.test("Size")).toBe(false);
    expect(KEY_PATTERN.test("1abc")).toBe(false);
    expect(KEY_PATTERN.test("سایز")).toBe(false);
  });
});

describe("flow and rule summaries", () => {
  it("counts nodes and node types of each flow", () => {
    const [flow] = summarizeFlows(seed.content.flows);
    expect(flow).toEqual({
      key: "size-help",
      name: "راهنمای انتخاب سایز",
      nodeCount: 4,
      edgeCount: 3,
      nodeTypes: [
        { type: "question", count: 3 },
        { type: "ai", count: 1 },
      ],
      start: "height",
    });
  });

  it("lists each rule's trigger, keywords, actions and started flow", () => {
    const rules = summarizeRules(seed.content.rules);
    expect(rules.map((r) => [r.key, r.triggerKind, r.flowKey])).toEqual([
      ["comment-price", "comment_keyword", null],
      ["size-keyword", "dm_keyword", "size-help"],
      ["ask-human", "dm_keyword", null],
    ]);
    expect(rules[0]!.actions).toEqual(["private_reply", "public_reply"]);
    expect(rules[1]!.keywords).toContain("سایز");
    expect(rules[1]!.priority).toBe(50);
  });

  it("survives malformed items", () => {
    expect(summarizeFlows([{}, { key: "a", graph: { nodes: "x" } }])).toEqual([
      { key: "#1", name: "", nodeCount: 0, edgeCount: 0, nodeTypes: [], start: null },
      { key: "a", name: "", nodeCount: 0, edgeCount: 0, nodeTypes: [], start: null },
    ]);
    expect(summarizeRules([{ key: "r", actions: [null, { kind: 5 }] }])[0]!.actions).toEqual(["?", "?"]);
  });
});

describe("issues", () => {
  it("parses the backend's issue strings", () => {
    expect(parseIssue("faqs[shipping-cost].answer: validation.text.length")).toEqual({
      raw: "faqs[shipping-cost].answer: validation.text.length",
      section: "faqs",
      item: "shipping-cost",
      field: "answer",
      code: "validation.text.length",
    });
    expect(parseIssue("rules[size-keyword]: template.flow_key_unknown")).toMatchObject({ section: "rules", item: "size-keyword", field: null, code: "template.flow_key_unknown" });
    expect(parseIssue("agentProfile.tone: templates.tone_invalid")).toMatchObject({ section: "agentProfile", item: null, field: "tone", code: "templates.tone_invalid" });
    expect(parseIssue("faqs: templates.too_many")).toMatchObject({ section: "faqs", item: null, field: null, code: "templates.too_many" });
    expect(parseIssue("content: validation.required")).toMatchObject({ section: "content", code: "validation.required" });
    expect(parseIssue("flows[]: template.key_invalid")).toMatchObject({ section: "flows", item: "", code: "template.key_invalid" });
    expect(parseIssue("something odd")).toMatchObject({ section: "other", code: "something odd" });
  });

  it("groups issues in the editor's order and finds an item's issues", () => {
    const issues = ["rules[a]: automation.keywords_required", "faqs[b].answer: validation.text.length", "flows[c]: flow.start_missing", "faqs[b].question: validation.text.length", "agentProfile.tone: templates.tone_invalid"];
    expect(groupIssues(issues).map((g) => [g.section, g.issues.length])).toEqual([
      ["faqs", 2],
      ["flows", 1],
      ["rules", 1],
      ["agentProfile", 1],
    ]);
    expect(issuesFor(issues, "faqs", "b").map((i) => i.field)).toEqual(["answer", "question"]);
    expect(issuesIn(issues, "agentProfile")).toHaveLength(1);
  });

  it("blocks publishing while there are issues, unsaved changes or the version is not a draft", () => {
    expect(publishBlocker({ status: "draft", issues: [] }, false)).toBeNull();
    expect(publishBlocker({ status: "draft", issues: ["faqs: templates.too_many"] }, false)).toBe("issues");
    expect(publishBlocker({ status: "draft", issues: [] }, true)).toBe("unsaved");
    expect(publishBlocker({ status: "published", issues: [] }, false)).toBe("notDraft");
  });

  it("reads the issues of a 422 templates.invalid problem", () => {
    expect(problemIssues({ title: "templates.invalid", issues: ["flows[a]: flow.empty", 3] })).toEqual(["flows[a]: flow.empty"]);
    expect(problemIssues({ title: "x" })).toEqual([]);
    expect(problemIssues(null)).toEqual([]);
  });
});
