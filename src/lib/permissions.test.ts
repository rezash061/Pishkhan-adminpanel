import { describe, expect, it } from "vitest";
import { can, navFor, permissionsFor, STAFF_ROLES } from "./permissions";

const hrefs = (roles: string[]) => navFor(roles).map((i) => i.href);

describe("navigation per role", () => {
  it.each([
    ["SuperAdmin", ["/", "/workspaces", "/users", "/leads", "/support/sessions", "/billing/plans", "/ai/providers", "/ai/routes", "/ai/prompts", "/ai/evals", "/content/entries", "/content/categories", "/content/redirects", "/security/audit-log", "/security/staff", "/platform/health", "/settings"]],
    ["Support", ["/", "/workspaces", "/users", "/leads", "/support/sessions", "/billing/plans", "/content/entries", "/content/categories", "/content/redirects", "/security/audit-log", "/platform/health", "/settings"]],
    ["Finance", ["/", "/workspaces", "/users", "/billing/plans", "/settings"]],
    ["ContentEditor", ["/", "/content/entries", "/content/categories", "/content/redirects", "/settings"]],
    ["AIOps", ["/", "/ai/providers", "/ai/routes", "/ai/prompts", "/ai/evals", "/platform/health", "/settings"]],
    ["ReadOnly", ["/", "/workspaces", "/users", "/billing/plans", "/ai/providers", "/ai/routes", "/ai/prompts", "/ai/evals", "/content/entries", "/content/categories", "/content/redirects", "/platform/health", "/settings"]],
  ])("%s sees %j", (role, expected) => {
    expect(hrefs([role])).toEqual(expected);
  });

  it("combines roles", () => {
    expect(hrefs(["Finance", "AIOps"])).toEqual(["/", "/workspaces", "/users", "/billing/plans", "/ai/providers", "/ai/routes", "/ai/prompts", "/ai/evals", "/platform/health", "/settings"]);
  });

  it("grants nothing for unknown roles", () => {
    expect(permissionsFor(["Hacker"]).size).toBe(0);
    expect(hrefs(["Hacker"])).toEqual(["/settings"]);
  });

  it("reserves AI provider changes for SuperAdmin; AIOps manages routes and prompts", () => {
    for (const role of STAFF_ROLES) expect(can([role], "ai.providers.manage")).toBe(role === "SuperAdmin");
    expect(can(["AIOps"], "ai.manage")).toBe(true);
    expect(can(["ReadOnly"], "ai.manage")).toBe(false);
  });

  it("reserves staff management for SuperAdmin", () => {
    for (const role of STAFF_ROLES) expect(can([role], "staff.manage")).toBe(role === "SuperAdmin");
  });
});
