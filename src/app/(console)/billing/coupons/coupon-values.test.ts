import { describe, expect, it } from "vitest";
import { dateToIso, EMPTY_COUPON, isoToDate, toCouponRequest } from "./coupon-form";

describe("coupon form values", () => {
  it("sends a fixed value in Rial, plan codes as a list and empty limits as none", () => {
    const body = toCouponRequest({ ...EMPTY_COUPON, code: " spring-5 ", kind: "fixed", value: "۵۰٬۰۰۰", planCodes: "basic, pro", maxRedemptions: "" }, true);
    expect(body).toMatchObject({ code: "SPRING-5", kind: "fixed", value: 500_000, planCodes: ["basic", "pro"], maxRedemptions: null, maxPerWorkspace: 1 });
    expect(toCouponRequest({ ...EMPTY_COUPON, value: "20" }, false)).not.toHaveProperty("code");
  });

  it("reads dates as Tehran days", () => {
    expect(dateToIso("2026-11-05")).toBe("2026-11-04T20:30:00.000Z");
    expect(isoToDate("2026-11-04T20:30:00.000Z")).toBe("2026-11-05");
    expect(dateToIso("")).toBeNull();
  });
});
