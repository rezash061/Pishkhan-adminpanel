import { describe, expect, it } from "vitest";
import { refundableToman } from "./payments/[id]/payment-detail";
import { refundState } from "./payments/payments-list";

describe("billing helpers", () => {
  it("says whether a payment was refunded", () => {
    expect(refundState({ amount: 100, refunded: 0 })).toBe("none");
    expect(refundState({ amount: 100, refunded: 40 })).toBe("partly");
    expect(refundState({ amount: 100, refunded: 100 })).toBe("fully");
  });

  it("offers what is left in whole Toman", () => {
    expect(refundableToman({ amount: 6_990_000, refunded: 990_000 })).toBe(600_000);
    expect(refundableToman({ amount: 100, refunded: 100 })).toBe(0);
  });
});
