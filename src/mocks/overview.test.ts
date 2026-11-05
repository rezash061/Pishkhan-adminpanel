import { beforeEach, describe, expect, it } from "vitest";
import type { AdminTraceDetail, AdminTraceSummary, DashboardResponse, HealthReport, PagedResult, StaffSession, StaffSummary } from "@/lib/api/types";
import { handleMockRequest, resetMockState } from "./admin-api";

const call = (method: string, path: string, body?: unknown, token?: string) =>
  handleMockRequest(
    new Request(`http://mock.invalid${path}`, {
      method,
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? null : JSON.stringify(body),
    }),
  );
const login = async (username: string) =>
  (await (await call("POST", "/admin/v1/auth/login", { username, password: "Pishkhan-admin-1234", totpCode: "123456" })).json()).accessToken as string;
const stepUp = async (token: string) =>
  (await (await call("POST", "/admin/v1/auth/step-up", { password: "Pishkhan-admin-1234", totpCode: "123456" }, token)).json()).accessToken as string;

const SUPPORT_ID = "01938f5e-0000-7000-8000-000000000002";
const SUPER_ID = "01938f5e-0000-7000-8000-000000000001";

// Keeps the mock honest about backend PR #52's staff management, traces, dashboard and health endpoints.
describe("mock staff management", () => {
  beforeEach(() => resetMockState());

  it("needs SuperAdmin, step-up and a reason, and guards your own account", async () => {
    const su = await login("superadmin");
    expect((await call("POST", `/admin/v1/staff/${SUPPORT_ID}/deactivate`, { reason: "left the team" }, su)).status).toBe(403);
    const fresh = await stepUp(su);
    expect((await call("POST", `/admin/v1/staff/${SUPPORT_ID}/deactivate`, { reason: "x" }, fresh)).status).toBe(400);
    expect(((await (await call("POST", `/admin/v1/staff/${SUPER_ID}/deactivate`, { reason: "testing self" }, fresh)).json()) as { code: string }).code).toBe("backoffice.staff.self");
    const off: StaffSummary = await (await call("POST", `/admin/v1/staff/${SUPPORT_ID}/deactivate`, { reason: "left the team" }, fresh)).json();
    expect(off.status).toBe("disabled");
    // A disabled account cannot sign in until it is activated again.
    expect((await call("POST", "/admin/v1/auth/login", { username: "support", password: "Pishkhan-admin-1234", totpCode: "123456" })).status).toBe(401);
    expect(((await (await call("POST", `/admin/v1/staff/${SUPPORT_ID}/activate`, { reason: "came back" }, fresh)).json()) as StaffSummary).status).toBe("active");
  });

  it("changes roles but keeps one active SuperAdmin", async () => {
    const fresh = await stepUp(await login("superadmin"));
    expect((await call("PUT", `/admin/v1/staff/${SUPPORT_ID}/roles`, { roles: ["Nope"], reason: "promote" }, fresh)).status).toBe(400);
    const changed: StaffSummary = await (await call("PUT", `/admin/v1/staff/${SUPPORT_ID}/roles`, { roles: ["Support", "Finance"], reason: "also finance" }, fresh)).json();
    expect(changed.roles).toEqual(["Support", "Finance"]);
    const last = await call("PUT", `/admin/v1/staff/${SUPER_ID}/roles`, { roles: ["Support"], reason: "demote myself" }, fresh);
    expect(((await last.json()) as { code: string }).code).toBe("backoffice.staff.last_super_admin");
  });

  it("lists and ends your own sessions only", async () => {
    const token = await login("superadmin");
    const sessions: StaffSession[] = await (await call("GET", "/admin/v1/me/sessions", undefined, token)).json();
    expect(sessions.filter((s) => s.current)).toHaveLength(1);
    const other = sessions.find((s) => !s.current)!;
    expect((await call("DELETE", `/admin/v1/me/sessions/${other.id}`, undefined, await login("support"))).status).toBe(404);
    expect((await call("DELETE", `/admin/v1/me/sessions/${other.id}`, undefined, token)).status).toBe(204);
    expect(((await (await call("GET", "/admin/v1/me/sessions", undefined, token)).json()) as StaffSession[]).length).toBe(sessions.length - 1);
  });
});

describe("mock traces, dashboard and health", () => {
  beforeEach(() => resetMockState());

  it("lists traces without content and reveals them with a reason", async () => {
    expect((await call("GET", "/admin/v1/ai/traces", undefined, await login("finance"))).status).toBe(403);
    const reader = await login("readonly");
    const list: PagedResult<AdminTraceSummary> = await (await call("GET", "/admin/v1/ai/traces?guardIssues=true", undefined, reader)).json();
    expect(list.items).toHaveLength(1);
    expect(Object.keys(list.items[0]!)).not.toContain("input");
    const id = list.items[0]!.id;
    const redacted: AdminTraceDetail = await (await call("GET", `/admin/v1/ai/traces/${id}`, undefined, reader)).json();
    expect(redacted.redacted).toBe(true);
    expect(redacted.input).toBeNull();
    expect(redacted.guardIssues[0]!.detail).toBe("");
    expect((await call("POST", `/admin/v1/ai/traces/${id}/reveal`, { reason: "ticket 42" }, reader)).status).toBe(403);
    const ops = await login("aiops");
    expect((await call("POST", `/admin/v1/ai/traces/${id}/reveal`, { reason: "x" }, ops)).status).toBe(400);
    const revealed: AdminTraceDetail = await (await call("POST", `/admin/v1/ai/traces/${id}/reveal`, { reason: "ticket 42" }, ops)).json();
    expect(revealed.redacted).toBe(false);
    expect(revealed.input).toBe("اینو ۱۵۰ میدی؟");
    expect(revealed.toolCalls[0]!.arguments).toContain("productId");
  });

  it("filters traces by outcome and low confidence", async () => {
    const token = await login("superadmin");
    const handed: PagedResult<AdminTraceSummary> = await (await call("GET", "/admin/v1/ai/traces?outcome=handed_off", undefined, token)).json();
    expect(handed.items.every((t) => t.outcome === "handed_off")).toBe(true);
    const low: PagedResult<AdminTraceSummary> = await (await call("GET", "/admin/v1/ai/traces?maxConfidence=0.5", undefined, token)).json();
    expect(low.items.every((t) => t.confidence !== null && t.confidence < 0.5)).toBe(true);
  });

  it("serves the dashboard and a healthy platform", async () => {
    const token = await login("editor");
    const dashboard: DashboardResponse = await (await call("GET", "/admin/v1/dashboard", undefined, token)).json();
    expect(dashboard.kpis.aiRepliesToday).toBe(5);
    expect(dashboard.alerts.map((a) => a.code)).toContain("dead_letters");
    const health: HealthReport = await (await call("GET", "/admin/v1/platform/health", undefined, token)).json();
    expect(health.status).toBe("Healthy");
    expect(Object.keys(health.checks)).toEqual(expect.arrayContaining(["kafka", "clamav", "workers", "instagram", "ai"]));
  });
});
