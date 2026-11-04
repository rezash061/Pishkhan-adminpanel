import { beforeEach, describe, expect, it } from "vitest";
import type { AdminOutage } from "@/lib/api/types";
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

const PATH = "/admin/v1/platform/outage";

// Keeps the mock honest about /admin/v1/platform/outage (backend PR #47).
describe("mock outage mode", () => {
  beforeEach(() => resetMockState());

  it("lets every staff role but ContentEditor read the status", async () => {
    const outage: AdminOutage = await (await call("GET", PATH, undefined, await login("finance"))).json();
    expect(outage).toMatchObject({ kind: "instagram", status: "up", mode: "auto", modeReason: null, windowMinutes: 5 });
    expect((await call("GET", PATH, undefined, await login("editor"))).status).toBe(403);
  });

  it("lets only Support and SuperAdmin set the mode, after step-up, with a reason", async () => {
    expect((await call("PUT", PATH, { mode: "forced_down", reason: "فیلترینگ گسترده" }, await stepUp(await login("aiops")))).status).toBe(403);
    const support = await login("support");
    const noStepUp = await call("PUT", PATH, { mode: "forced_down", reason: "فیلترینگ گسترده" }, support);
    expect((await noStepUp.json()).code).toBe("auth.step_up.required");
    const fresh = await stepUp(support);
    const bad = await call("PUT", PATH, { mode: "down", reason: "کم" }, fresh);
    expect((await bad.json()).errors).toEqual({ mode: ["validation.invalid"], reason: ["validation.too_short"] });

    const down: AdminOutage = await (await call("PUT", PATH, { mode: "forced_down", reason: "فیلترینگ گسترده" }, fresh)).json();
    expect(down).toMatchObject({ status: "down", mode: "forced_down", modeReason: "فیلترینگ گسترده" });
    const back: AdminOutage = await (await call("PUT", PATH, { mode: "auto", reason: "فیلترینگ برداشته شد" }, fresh)).json();
    expect(back).toMatchObject({ status: "up", mode: "auto" });
  });
});
