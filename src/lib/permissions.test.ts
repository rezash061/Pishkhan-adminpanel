import { describe, expect, it } from "vitest";
import { can, navFor, permissionsFor, STAFF_ROLES } from "./permissions";

const hrefs = (roles: string[]) => navFor(roles).map((i) => i.href);

describe("navigation per role", () => {
  it.each([
    ["SuperAdmin", ["/", "/leads", "/support/sessions", "/security/audit-log", "/security/staff", "/platform/health", "/settings"]],
    ["Support", ["/", "/leads", "/support/sessions", "/security/audit-log", "/platform/health", "/settings"]],
    ["Finance", ["/", "/settings"]],
    ["ContentEditor", ["/", "/settings"]],
    ["AIOps", ["/", "/platform/health", "/settings"]],
    ["ReadOnly", ["/", "/platform/health", "/settings"]],
  ])("%s sees %j", (role, expected) => {
    expect(hrefs([role])).toEqual(expected);
  });

  it("combines roles", () => {
    expect(hrefs(["Finance", "AIOps"])).toEqual(["/", "/platform/health", "/settings"]);
  });

  it("grants nothing for unknown roles", () => {
    expect(permissionsFor(["Hacker"]).size).toBe(0);
    expect(hrefs(["Hacker"])).toEqual(["/settings"]);
  });

  it("reserves staff management for SuperAdmin", () => {
    for (const role of STAFF_ROLES) expect(can([role], "staff.manage")).toBe(role === "SuperAdmin");
  });
});
