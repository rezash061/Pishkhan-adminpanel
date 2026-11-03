import { describe, expect, it } from "vitest";
import { latinShare, looksFinglish } from "./finglish";

describe("Finglish marker", () => {
  it("marks Persian written in Latin letters", () => {
    expect(looksFinglish("salam gheymatesh chande?")).toBe(true);
    expect(looksFinglish("in manto size 40 mojood dari?")).toBe(true);
    expect(looksFinglish("pool variz kardam, resid ro befrestam?")).toBe(true);
  });

  it("does not mark Persian script, digits or emoji alone", () => {
    expect(looksFinglish("قیمت این مانتو چنده؟")).toBe(false);
    expect(looksFinglish("۱۲۳ 456 🌸")).toBe(false);
    expect(looksFinglish("")).toBe(false);
    expect(looksFinglish(null)).toBe(false);
  });

  it("uses the backend's 70% Latin-letter threshold", () => {
    // 7 Latin letters, 3 Persian letters: exactly 70%.
    expect(latinShare("salamab سلا")).toBeCloseTo(0.7);
    expect(looksFinglish("salamab سلا")).toBe(true);
    // 6 Latin, 3 Persian: 66.7%.
    expect(looksFinglish("salama سلا")).toBe(false);
    expect(looksFinglish("in ﻗﯿﻤﺖ")).toBe(false);
  });
});
