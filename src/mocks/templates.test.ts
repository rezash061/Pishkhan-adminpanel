import { beforeEach, describe, expect, it } from "vitest";
import type { IndustryTemplate, PagedResult } from "@/lib/api/types";
import { handleMockRequest, resetMockState } from "./admin-api";
import beautyClinic from "./template-seeds/beauty_clinic.json";
import clothing from "./template-seeds/clothing.json";
import cosmetics from "./template-seeds/cosmetics.json";
import courses from "./template-seeds/courses.json";
import jewelry from "./template-seeds/jewelry.json";
import { validateTemplateContent } from "./templates";

const call = (method: string, path: string, body?: unknown, token?: string) =>
  handleMockRequest(
    new Request(`http://mock.invalid${path}`, {
      method,
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? null : JSON.stringify(body),
    }),
  );

async function login(username: string) {
  return (await (await call("POST", "/admin/v1/auth/login", { username, password: "Pishkhan-admin-1234", totpCode: "123456" })).json()).accessToken as string;
}
async function stepUp(token: string) {
  return (await (await call("POST", "/admin/v1/auth/step-up", { password: "Pishkhan-admin-1234", totpCode: "123456" }, token)).json()).accessToken as string;
}

const BASE = "/admin/v1/industry-templates";

// Keeps the mock honest about the AdminApi contract of backend PR #40.
describe("mock industry templates", () => {
  beforeEach(() => resetMockState());

  it("finds no issues in the backend's built-in templates", () => {
    for (const seed of [clothing, cosmetics, jewelry, beautyClinic, courses]) expect(validateTemplateContent(seed.content as IndustryTemplate["content"])).toEqual([]);
  });

  it("lists versions by industry, newest first, with filters and pages", async () => {
    const token = await login("readonly");
    const all: PagedResult<IndustryTemplate> = await (await call("GET", `${BASE}?pageSize=100`, undefined, token)).json();
    expect(all.totalCount).toBe(7);
    expect(all.items.map((t) => `${t.industry}:${t.version}`).slice(0, 4)).toEqual(["beauty_clinic:1", "clothing:2", "clothing:1", "cosmetics:2"]);
    const drafts: PagedResult<IndustryTemplate> = await (await call("GET", `${BASE}?status=draft`, undefined, token)).json();
    expect(drafts.items).toHaveLength(1);
    expect(drafts.items[0]!.issues).toEqual(["faqs[gift-wrap].answer: validation.text.length", "rules[fabric-keyword]: template.flow_key_unknown"]);
    const page2: PagedResult<IndustryTemplate> = await (await call("GET", `${BASE}?pageSize=5&page=2`, undefined, token)).json();
    expect(page2.items).toHaveLength(2);
    expect((await call("GET", `${BASE}?status=live`, undefined, token)).status).toBe(400);
    expect((await call("GET", BASE, undefined, await login("finance"))).status).toBe(403);
  });

  it("lets only AIOps and SuperAdmin write; Support reads", async () => {
    const support = await login("support");
    expect((await call("GET", BASE, undefined, support)).status).toBe(200);
    expect((await call("POST", BASE, { industry: "other", template: { name: "x", description: null, content: {} } }, support)).status).toBe(403);
  });

  it("creates the first draft only for an industry without a template", async () => {
    const token = await login("aiops");
    const content = { requiredFacts: [], faqs: [], flows: [], rules: [], agentProfile: null };
    const taken = await call("POST", BASE, { industry: "clothing", template: { name: "پوشاک ۲", description: null, content } }, token);
    expect(taken.status).toBe(409);
    expect((await taken.json()).code).toBe("templates.industry_taken");
    const bad = await call("POST", BASE, { industry: "cars", template: { name: "", description: null, content } }, token);
    expect((await bad.json()).errors).toEqual({ "template.name": ["validation.name.length"], industry: ["validation.industry.invalid"] });
    const created = await call("POST", BASE, { industry: "other", template: { name: "سایر کسب‌وکارها", description: null, content } }, token);
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ industry: "other", version: 1, status: "draft", issues: [] });
  });

  it("saves a draft with issues, refuses to publish it with 422, and publishes once fixed", async () => {
    const token = await login("aiops");
    const drafts: PagedResult<IndustryTemplate> = await (await call("GET", `${BASE}?status=draft`, undefined, token)).json();
    const draft = drafts.items[0]!;

    const refused = await call("POST", `${BASE}/${draft.id}/publish`, { reason: null }, await stepUp(token));
    expect(refused.status).toBe(422);
    expect((await refused.json()).issues).toHaveLength(2);

    const content = structuredClone(draft.content);
    content.faqs.find((f) => f.key === "gift-wrap")!.answer = "بله، کادوپیچ [رایگان / با هزینهٔ [مبلغ] تومان] است.";
    content.rules = content.rules.filter((r) => r.key !== "fabric-keyword");
    content.agentProfile!.tone = "sarcastic";
    const saved: IndustryTemplate = await (await call("PUT", `${BASE}/${draft.id}`, { name: draft.name, description: draft.description, content }, token)).json();
    expect(saved.issues).toEqual(["agentProfile.tone: templates.tone_invalid"]);

    content.agentProfile!.tone = "friendly";
    expect((await (await call("PUT", `${BASE}/${draft.id}`, { name: draft.name, description: draft.description, content }, token)).json()).issues).toEqual([]);
    expect((await call("POST", `${BASE}/${draft.id}/publish`, {}, token)).status).toBe(403);
    const published = await call("POST", `${BASE}/${draft.id}/publish`, { reason: "راهنمای کادوپیچ" }, await stepUp(token));
    expect(published.status).toBe(200);
    const versions: PagedResult<IndustryTemplate> = await (await call("GET", `${BASE}?industry=clothing`, undefined, token)).json();
    expect(versions.items.map((v) => `${v.version}:${v.status}`)).toEqual(["2:published", "1:archived"]);
    expect((await call("PUT", `${BASE}/${draft.id}`, { name: draft.name, description: null, content }, token)).status).toBe(409);
  });

  it("starts one draft at a time and archives with a required reason", async () => {
    const token = await login("superadmin");
    const list: PagedResult<IndustryTemplate> = await (await call("GET", `${BASE}?industry=jewelry`, undefined, token)).json();
    const live = list.items[0]!;
    const next = await call("POST", `${BASE}/${live.id}/versions`, undefined, token);
    expect(next.status).toBe(201);
    expect(await next.json()).toMatchObject({ version: 2, status: "draft" });
    const again = await call("POST", `${BASE}/${live.id}/versions`, undefined, token);
    expect((await again.json()).code).toBe("templates.draft_exists");

    const fresh = await stepUp(token);
    const noReason = await call("POST", `${BASE}/${live.id}/archive`, { reason: "کم" }, fresh);
    expect((await noReason.json()).errors).toEqual({ reason: ["validation.too_short"] });
    const archived = await call("POST", `${BASE}/${live.id}/archive`, { reason: "قیمت طلا عوض شد" }, fresh);
    expect((await archived.json()).status).toBe("archived");
  });

  it("reports the template-specific and automation issues the editor explains", () => {
    const issues = validateTemplateContent({
      requiredFacts: [{ key: "Hours", label: "ساعت", prompt: "چه ساعتی؟" }],
      faqs: [],
      flows: [
        { key: "a", name: "x", graph: { nodes: [], edges: [] } },
        { key: "ok-flow", name: "x", graph: { start: "n9", nodes: [{ id: "n1", type: "message", cardSetId: "x" }], edges: [] } },
        { key: "bad-start", name: "x", graph: { start: "n9", nodes: [{ id: "n1", type: "message" }], edges: [{ from: "n1", to: "n2" }] } },
      ],
      rules: [
        { key: "r1", name: "x", triggerKind: "dm_keyword", trigger: { keywords: ["a"] }, actions: "nope", priority: 1 },
        { key: "r2", name: "x", triggerKind: "dm_keyword", trigger: { keywords: ["a"], postId: "1" }, actions: [{ kind: "handoff" }], priority: 1 },
        { key: "r3", name: "x", triggerKind: "dm_keyword", trigger: {}, actions: [{ kind: "teleport" }], priority: 1 },
      ],
      agentProfile: null,
    });
    expect(issues).toEqual([
      "requiredFacts[Hours]: template.key_invalid",
      "flows[a]: template.key_invalid",
      "flows[ok-flow]: template.workspace_reference",
      "flows[bad-start]: flow.start_missing",
      "flows[bad-start]: flow.edge_unknown_node",
      "rules[r1]: template.actions_invalid",
      "rules[r2]: template.trigger_invalid",
      "rules[r3]: automation.keywords_required",
      "rules[r3]: automation.action_unknown",
    ]);
  });
});
