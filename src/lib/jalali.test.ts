import { describe, expect, it } from "vitest";
import { parseJalaliDate } from "./jalali";

describe("parseJalaliDate", () => {
  it("returns Tehran midnight in UTC", () => {
    expect(parseJalaliDate("1405/08/07")?.toISOString()).toBe("2026-10-28T20:30:00.000Z");
    expect(parseJalaliDate("۱۴۰۵/۰۸/۰۷")?.toISOString()).toBe("2026-10-28T20:30:00.000Z");
    expect(parseJalaliDate("1405-1-1")?.toISOString()).toBe("2026-03-20T20:30:00.000Z");
  });

  it("can return the end of the day", () => {
    expect(parseJalaliDate("1405/08/07", true)?.toISOString()).toBe("2026-10-29T20:29:59.999Z");
  });

  it("rejects invalid dates", () => {
    expect(parseJalaliDate("1405/13/01")).toBeNull();
    expect(parseJalaliDate("1405/07/31")).toBeNull(); // Mehr has 30 days
    expect(parseJalaliDate("yesterday")).toBeNull();
  });
});
