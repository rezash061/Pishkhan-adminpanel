import { describe, expect, it } from "vitest";
import { ipAllowed } from "./ip";

describe("ipAllowed", () => {
  it("matches exact addresses and IPv4 CIDR ranges", () => {
    expect(ipAllowed("10.8.3.4", ["10.8.0.0/16"])).toBe(true);
    expect(ipAllowed("10.9.0.1", ["10.8.0.0/16"])).toBe(false);
    expect(ipAllowed("::ffff:192.0.2.7", ["192.0.2.7"])).toBe(true);
    expect(ipAllowed("2001:db8::1", ["2001:db8::1"])).toBe(true);
  });

  it("rejects missing or malformed input", () => {
    expect(ipAllowed(null, ["10.0.0.0/8"])).toBe(false);
    expect(ipAllowed("10.0.0.1", ["10.0.0.0/40"])).toBe(false);
  });
});
