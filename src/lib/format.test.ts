import { describe, expect, it } from "vitest";
import { formatJalaliDate, formatJalaliDateTime, formatToman, maskPhone, toLatinDigits, toPersianDigits } from "./format";

describe("format", () => {
  it("converts digits both ways", () => {
    expect(toPersianDigits("0912 345")).toBe("۰۹۱۲ ۳۴۵");
    expect(toLatinDigits("۱۲۳٤٥٦")).toBe("123456");
  });

  it("shows Rial amounts as Toman", () => {
    expect(formatToman(1_250_000)).toBe("۱۲۵٬۰۰۰ تومان");
  });

  it("formats in the Jalali calendar and Tehran time", () => {
    // 2026-10-28 20:45 UTC is 29 October 00:15 in Tehran (UTC+03:30), which is 7 Aban 1405.
    expect(formatJalaliDateTime("2026-10-28T20:45:00Z")).toContain("۱۴۰۵/۰۸/۰۷");
    expect(formatJalaliDateTime("2026-10-28T20:45:00Z")).toContain("۰۰:۱۵");
    expect(formatJalaliDate("2026-03-20T21:00:00Z")).toBe("۱ فروردین ۱۴۰۵");
  });

  it("masks phone numbers", () => {
    expect(maskPhone("09120001234")).toBe("0912***1234");
    expect(maskPhone("۰۹۱۲۰۰۰۱۲۳۴")).toBe("0912***1234");
  });
});
