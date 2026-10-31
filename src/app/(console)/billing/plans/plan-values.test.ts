import { describe, expect, it } from "vitest";
import { EMPTY_PLAN, formPath, parseWhole, toFormValues, toPlanRequest } from "./plan-values";

describe("plan form values", () => {
  it("parses Persian digits and separators", () => {
    expect(parseWhole("۲۹۹٬۰۰۰")).toBe(299000);
    expect(parseWhole(" 1,500 ")).toBe(1500);
    expect(parseWhole("")).toBeNull();
    expect(parseWhole("12a")).toBeNaN();
  });

  it("round-trips Toman in the form and Rial in the API", () => {
    const plan = { ...EMPTY_PLAN, name: "پایه", monthly: { amount: 2_990_000, currency: "IRR" as const }, limits: { seats: 3, sms: null } };
    const values = toFormValues(plan);
    expect(values.monthly).toBe("299000");
    expect(values.limits.seats).toBe("3");
    expect(values.limits.sms).toBe("");
    const back = toPlanRequest({ ...values, annual: "۲٬۹۹۰٬۰۰۰" });
    expect(back.monthly).toEqual({ amount: 2_990_000, currency: "IRR" });
    expect(back.annual).toEqual({ amount: 29_900_000, currency: "IRR" });
    expect(back.limits.seats).toBe(3);
    expect(back.limits.ai_conversations).toBeNull();
    expect(back.overagePerConversation).toBeNull();
  });

  it("maps backend field keys to form paths", () => {
    expect(formPath("plan.name")).toBe("name");
    expect(formPath("overagePerConversation")).toBe("overage");
    expect(formPath("limits.seats")).toBe("limits.seats");
    expect(formPath("features[2]")).toBe("features.2.label");
    expect(formPath("plan.unknown")).toBeNull();
  });
});
