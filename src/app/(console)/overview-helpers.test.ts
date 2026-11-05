import { describe, expect, it } from "vitest";
import { confidence } from "./ai/traces/traces-list";
import { percent } from "./dashboard-panel";
import { deviceName } from "./settings/sessions-card";

describe("dashboard and traces formatting", () => {
  it("shows rates as Persian percentages with one decimal", () => {
    expect(percent(0.4)).toBe("۴۰٪");
    expect(percent(0.1234)).toBe("۱۲٫۳٪");
  });

  it("shows confidences with two Persian decimals, or a dash", () => {
    expect(confidence(0.86)).toBe("۰٫۸۶");
    expect(confidence(null)).toBe("—");
  });

  it("names a device from its user agent", () => {
    expect(deviceName("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36")).toBe("Chrome · Windows");
    expect(deviceName("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15")).toBe("Safari · macOS");
    expect(deviceName(null)).toBe("—");
  });
});
