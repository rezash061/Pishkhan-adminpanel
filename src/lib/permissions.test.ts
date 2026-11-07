import { describe, expect, it } from "vitest";
import { can, navFor, permissionsFor, STAFF_ROLES } from "./permissions";

const hrefs = (roles: string[]) => navFor(roles).map((i) => i.href);

describe("navigation per role", () => {
  it.each([
    ["SuperAdmin", ["/", "/workspaces", "/users", "/leads", "/support/tickets", "/support/announcements", "/support/sessions", "/billing/payments", "/billing/subscriptions", "/billing/coupons", "/billing/plans", "/ai/providers", "/ai/routes", "/ai/prompts", "/ai/evals", "/ai/traces", "/templates/industry", "/content/entries", "/content/categories", "/content/redirects", "/security/audit-log", "/security/staff", "/security/quarantine", "/platform/health", "/platform/outage", "/platform/messaging", "/platform/sms-log", "/platform/kafka", "/platform/dead-letters", "/platform/workers", "/platform/feature-flags", "/settings"]],
    ["Support", ["/", "/workspaces", "/users", "/leads", "/support/tickets", "/support/announcements", "/support/sessions", "/billing/payments", "/billing/subscriptions", "/billing/coupons", "/billing/plans", "/ai/traces", "/templates/industry", "/content/entries", "/content/categories", "/content/redirects", "/security/audit-log", "/security/quarantine", "/platform/health", "/platform/outage", "/platform/messaging", "/platform/sms-log", "/platform/kafka", "/platform/dead-letters", "/platform/workers", "/platform/feature-flags", "/settings"]],
    ["Finance", ["/", "/workspaces", "/users", "/billing/payments", "/billing/subscriptions", "/billing/coupons", "/billing/plans", "/platform/outage", "/platform/feature-flags", "/settings"]],
    ["ContentEditor", ["/", "/content/entries", "/content/categories", "/content/redirects", "/settings"]],
    ["AIOps", ["/", "/ai/providers", "/ai/routes", "/ai/prompts", "/ai/evals", "/ai/traces", "/templates/industry", "/platform/health", "/platform/outage", "/platform/kafka", "/platform/dead-letters", "/platform/workers", "/platform/feature-flags", "/settings"]],
    ["ReadOnly", ["/", "/workspaces", "/users", "/support/tickets", "/support/announcements", "/billing/payments", "/billing/subscriptions", "/billing/coupons", "/billing/plans", "/ai/providers", "/ai/routes", "/ai/prompts", "/ai/evals", "/ai/traces", "/templates/industry", "/content/entries", "/content/categories", "/content/redirects", "/platform/health", "/platform/outage", "/platform/messaging", "/platform/sms-log", "/platform/kafka", "/platform/dead-letters", "/platform/workers", "/platform/feature-flags", "/settings"]],
  ])("%s sees %j", (role, expected) => {
    expect(hrefs([role])).toEqual(expected);
  });

  it("combines roles", () => {
    expect(hrefs(["Finance", "AIOps"])).toEqual(["/", "/workspaces", "/users", "/billing/payments", "/billing/subscriptions", "/billing/coupons", "/billing/plans", "/ai/providers", "/ai/routes", "/ai/prompts", "/ai/evals", "/ai/traces", "/templates/industry", "/platform/health", "/platform/outage", "/platform/kafka", "/platform/dead-letters", "/platform/workers", "/platform/feature-flags", "/settings"]);
  });

  it("support tickets: Support and SuperAdmin answer, ReadOnly reads; a test SMS is SuperAdmin only", () => {
    expect(STAFF_ROLES.filter((r) => can([r], "tickets.read"))).toEqual(["SuperAdmin", "Support", "ReadOnly"]);
    expect(STAFF_ROLES.filter((r) => can([r], "tickets.manage"))).toEqual(["SuperAdmin", "Support"]);
    expect(STAFF_ROLES.filter((r) => can([r], "announcements.manage"))).toEqual(["SuperAdmin", "Support"]);
    expect(STAFF_ROLES.filter((r) => can([r], "platform.sms.test"))).toEqual(["SuperAdmin"]);
    expect(STAFF_ROLES.filter((r) => can([r], "platform.bale.check"))).toEqual(["SuperAdmin", "Support"]);
  });

  it("grants nothing for unknown roles", () => {
    expect(permissionsFor(["Hacker"]).size).toBe(0);
    expect(hrefs(["Hacker"])).toEqual(["/settings"]);
  });

  it("reserves AI provider changes for SuperAdmin; AIOps manages routes and prompts", () => {
    for (const role of STAFF_ROLES) expect(can([role], "ai.providers.manage")).toBe(role === "SuperAdmin");
    expect(can(["AIOps"], "ai.manage")).toBe(true);
    expect(can(["ReadOnly"], "ai.manage")).toBe(false);
    // Traces: readers match the backend (SuperAdmin, AIOps, Support, ReadOnly); revealing content needs more than ReadOnly.
    expect(STAFF_ROLES.filter((r) => can([r], "ai.traces.read"))).toEqual(["SuperAdmin", "Support", "AIOps", "ReadOnly"]);
    expect(STAFF_ROLES.filter((r) => can([r], "ai.traces.reveal"))).toEqual(["SuperAdmin", "Support", "AIOps"]);
  });

  it("lets AIOps and SuperAdmin edit industry templates; Support and ReadOnly only read them", () => {
    for (const role of STAFF_ROLES) {
      expect(can([role], "templates.manage")).toBe(role === "SuperAdmin" || role === "AIOps");
      expect(can([role], "templates.read")).toBe(["SuperAdmin", "AIOps", "Support", "ReadOnly"].includes(role));
    }
  });

  it("lets Support and SuperAdmin change the outage mode; every role but ContentEditor sees it", () => {
    for (const role of STAFF_ROLES) {
      expect(can([role], "platform.outage.manage")).toBe(role === "SuperAdmin" || role === "Support");
      expect(can([role], "platform.outage.read")).toBe(role !== "ContentEditor");
    }
  });

  it("reserves staff management for SuperAdmin", () => {
    for (const role of STAFF_ROLES) expect(can([role], "staff.manage")).toBe(role === "SuperAdmin");
  });

  it("keeps quarantine with Support and SuperAdmin, and false positives, DLQ actions, jobs and flag edits with SuperAdmin", () => {
    for (const role of STAFF_ROLES) {
      expect(can([role], "files.quarantine")).toBe(role === "SuperAdmin" || role === "Support");
      for (const p of ["files.false_positive", "platform.dlq.manage", "platform.jobs.manage", "flags.manage"] as const) expect(can([role], p)).toBe(role === "SuperAdmin");
      expect(can([role], "platform.dlq.payload")).toBe(role === "SuperAdmin" || role === "Support");
      expect(can([role], "flags.override")).toBe(role === "SuperAdmin" || role === "Support");
    }
  });
});
