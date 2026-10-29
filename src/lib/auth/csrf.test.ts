import { describe, expect, it } from "vitest";
import { checkMutation } from "./csrf";

const req = (method: string, headers: Record<string, string>) => new Request("http://admin.test/api/bff/staff", { method, headers });

describe("checkMutation", () => {
  const ok = { origin: "http://admin.test", host: "admin.test", cookie: "admin_csrf=abc; other=1", "x-csrf-token": "abc" };

  it("lets safe methods through", () => {
    expect(checkMutation(req("GET", {}))).toBeNull();
  });

  it("accepts a same-origin request that echoes the cookie", () => {
    expect(checkMutation(req("POST", ok))).toBeNull();
  });

  it("rejects cross-origin, missing origin and token mismatch", () => {
    expect(checkMutation(req("POST", { ...ok, origin: "http://evil.test" }))).toBe("csrf.origin_mismatch");
    const { origin: _origin, ...noOrigin } = ok;
    expect(checkMutation(req("POST", noOrigin))).toBe("csrf.origin_missing");
    expect(checkMutation(req("POST", { ...ok, "x-csrf-token": "abd" }))).toBe("csrf.token_mismatch");
  });
});
