import { beforeEach, describe, expect, it } from "vitest";
import { handleMockRequest, resetMockState } from "./admin-api";

const call = (method: string, path: string, body?: unknown, token?: string) =>
  handleMockRequest(
    new Request(`http://mock.invalid${path}`, {
      method,
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? null : JSON.stringify(body),
    }),
  );

// Keeps the mock honest about the real AdminApi behaviour the UI depends on.
describe("mock AdminApi", () => {
  beforeEach(() => resetMockState());

  it("asks for TOTP when it is missing and issues tokens when it is right", async () => {
    const missing = await call("POST", "/admin/v1/auth/login", { username: "superadmin", password: "Pishkhan-admin-1234" });
    expect(missing.status).toBe(401);
    expect((await missing.json()).title).toBe("auth.totp.required");
    const ok = await call("POST", "/admin/v1/auth/login", { username: "superadmin", password: "Pishkhan-admin-1234", totpCode: "123456" });
    expect((await ok.json()).status).toBe("ok");
  });

  it("requires a step-up token to create staff and detects refresh token reuse", async () => {
    const login = await (await call("POST", "/admin/v1/auth/login", { username: "superadmin", password: "Pishkhan-admin-1234", totpCode: "123456" })).json();
    const denied = await call("POST", "/admin/v1/staff", { username: "new.one", password: "x".repeat(14), roles: ["Support"] }, login.accessToken);
    expect(denied.status).toBe(403);
    expect((await denied.json()).title).toBe("auth.step_up.required");

    const stepUp = await (await call("POST", "/admin/v1/auth/step-up", { password: "Pishkhan-admin-1234", totpCode: "123456" }, login.accessToken)).json();
    const created = await call("POST", "/admin/v1/staff", { username: "new.one", password: "x".repeat(14), roles: ["Support"] }, stepUp.accessToken);
    expect(created.status).toBe(201);

    expect((await call("POST", "/admin/v1/auth/refresh", { refreshToken: login.refreshToken })).status).toBe(200);
    const reused = await call("POST", "/admin/v1/auth/refresh", { refreshToken: login.refreshToken });
    expect((await reused.json()).title).toBe("auth.refresh.reused");
  });
});
