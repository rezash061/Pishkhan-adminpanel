import { beforeEach, describe, expect, it } from "vitest";
import type { DeadLetter, FeatureFlag, PagedResult, QuarantineFile, WorkspaceFeatureFlag } from "@/lib/api/types";
import { handleMockRequest, resetMockState } from "./admin-api";
import { bucket } from "./platform";

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

// Keeps the mock honest about the platform operations endpoints (quarantine, DLQ, Kafka, workers, feature flags).
describe("mock platform operations", () => {
  beforeEach(() => resetMockState());

  it("lists quarantine for Support only, and never a download link", async () => {
    expect((await call("GET", "/admin/v1/files/quarantine", undefined, await login("finance"))).status).toBe(403);
    const list: PagedResult<QuarantineFile> = await (await call("GET", "/admin/v1/files/quarantine", undefined, await login("support"))).json();
    expect(list.items.map((f) => f.status).sort()).toEqual(["infected", "infected", "pending_scan", "scan_failed"]);
    expect(list.items.every((f) => !("url" in f) && !("sha256" in f))).toBe(true);
  });

  it("requires step-up to delete and SuperAdmin for a false positive", async () => {
    const support = await login("support");
    const id = "01938f80-0000-7000-8000-00000000f001";
    expect((await call("POST", `/admin/v1/files/${id}/delete`, { reason: "remove it now" }, support)).status).toBe(403);
    expect((await call("POST", `/admin/v1/files/${id}/false-positive`, { reason: "known sample" }, await stepUp(support))).status).toBe(403);
    const cleared = await call("POST", `/admin/v1/files/${id}/false-positive`, { reason: "known sample" }, await stepUp(await login("superadmin")));
    expect(((await cleared.json()) as QuarantineFile).status).toBe("pending_scan");
    expect((await call("POST", `/admin/v1/files/${id}/delete`, { reason: "remove it now" }, await stepUp(support))).status).toBe(204);
  });

  it("replays only open dead letters and reports the rest as skipped", async () => {
    const admin = await stepUp(await login("superadmin"));
    const open: PagedResult<DeadLetter> = await (await call("GET", "/admin/v1/platform/dead-letters", undefined, admin)).json();
    const ids = [...open.items.map((d) => d.id), "01938f81-0000-7000-8000-00000000d004"];
    const result = await (await call("POST", "/admin/v1/platform/dead-letters/replay", { ids, reason: "bug fixed" }, admin)).json();
    expect(result).toEqual({ done: open.items.length, skipped: ["01938f81-0000-7000-8000-00000000d004"] });
    expect((await call("GET", `/admin/v1/platform/dead-letters/${ids[0]}`, undefined, await login("readonly"))).status).toBe(403);
  });

  it("evaluates flags like the backend: override, switch, plan, then a stable rollout bucket", async () => {
    const ws = "01938f61-0000-7000-8000-00000000b001";
    const flags: WorkspaceFeatureFlag[] = await (await call("GET", `/admin/v1/workspaces/${ws}/feature-flags`, undefined, await login("readonly"))).json();
    expect(flags.find((f) => f.key === "voice.notes")).toMatchObject({ effective: true, source: "override", override: true });
    expect(flags.find((f) => f.key === "receipts.auto_approve")).toMatchObject({ effective: true, source: "rollout" });
    const inbox = flags.find((f) => f.key === "inbox.v2")!;
    expect(inbox.source).toBe(bucket("inbox.v2", ws) < 25 ? "rollout" : "rollout_excluded");
  });

  it("lets only SuperAdmin create flags and rejects bad keys and duplicates", async () => {
    const body = { key: "new.thing", description: null, enabled: true, rolloutPercent: 10, plans: [], reason: "start rollout" };
    expect((await call("POST", "/admin/v1/feature-flags", body, await login("support"))).status).toBe(403);
    const admin = await login("superadmin");
    expect((await call("POST", "/admin/v1/feature-flags", { ...body, key: "Bad Key", rolloutPercent: 120 }, admin)).status).toBe(400);
    const created: FeatureFlag = await (await call("POST", "/admin/v1/feature-flags", body, admin)).json();
    expect(created).toMatchObject({ key: "new.thing", overrides: 0, updatedBy: "superadmin" });
    expect((await call("POST", "/admin/v1/feature-flags", body, admin)).status).toBe(409);
  });

  it("matches the backend's bucket for a known flag and workspace", () => {
    // FeatureFlagEvaluator.Bucket("new_inbox", 11111111-...) in the backend is 68.
    expect(bucket("new_inbox", "11111111-1111-1111-1111-111111111111")).toBe(68);
  });
});
