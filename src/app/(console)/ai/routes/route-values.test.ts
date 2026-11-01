import { describe, expect, it } from "vitest";
import { parseDecimal, stepFieldPath, toRouteStep, toStepValues } from "./route-values";

describe("route step values", () => {
  it("parses Persian digits, separators and the Persian decimal point", () => {
    expect(parseDecimal("۰٫۷")).toBe(0.7);
    expect(parseDecimal("۱۲٬۵۰۰")).toBe(12500);
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("abc")).toBeNaN();
  });

  it("sends prices in Rial and reads them back in Toman", () => {
    const step = toRouteStep({ provider: "openai", model: " gpt-4o-mini ", temperature: "0.2", maxOutputTokens: "۵۱۲", timeoutSeconds: "۲۰", inputPrice: "۱۵۰٬۰۰۰", outputPrice: "" });
    expect(step).toEqual({ provider: "openai", model: "gpt-4o-mini", temperature: 0.2, maxOutputTokens: 512, timeoutSeconds: 20, inputPricePerMillion: 1_500_000, outputPricePerMillion: null });
    expect(toStepValues(step).inputPrice).toBe("150000");
  });

  it("maps server field keys to form paths", () => {
    expect(stepFieldPath("routes[1].model")).toBe("steps.1.model");
    expect(stepFieldPath("routes[0].price")).toBe("steps.0.inputPrice");
    expect(stepFieldPath("routes")).toBeNull();
  });
});
