import { describe, expect, it } from "vitest";
import { BlockError, isLink, slugify, SLUG_PATTERN, splitList, toBlocks, toEditorBlocks } from "./content-values";

describe("content blocks", () => {
  it("round-trips every editor block type", () => {
    const blocks = [
      { type: "h2", text: "عنوان", id: "intro" },
      { type: "p", text: "متن" },
      { type: "ul", items: ["یک", "دو"] },
      { type: "callout", tone: "warning", text: "هشدار" },
      { type: "image", src: "/img/a.webp", alt: "تصویر" },
      { type: "cta", title: "شروع", href: "/signup" },
    ];
    expect(toBlocks(toEditorBlocks(blocks))).toEqual(blocks);
  });

  it("drops empty list lines and names the block with bad JSON", () => {
    const [list, bad] = toEditorBlocks([{ type: "ol", items: [] }, { type: "hero" }]);
    expect(toBlocks([{ ...list!, items: "اول\n\n دوم " }])).toEqual([{ type: "ol", items: ["اول", "دوم"] }]);
    expect(() => toBlocks([list!, { ...bad!, json: "[1]" }])).toThrow(BlockError);
  });
});

describe("slugs and links", () => {
  it("makes Persian-safe slugs", () => {
    expect(slugify("راهنمای پاسخ خودکار در اینستاگرام!")).toBe("راهنمای-پاسخ-خودکار-در-اینستاگرام");
    expect(slugify("Instagram DM ۲۰۲۶")).toBe("instagram-dm-2026");
    expect(SLUG_PATTERN.test(slugify("قیمت‌ها، طرح‌ها"))).toBe(true);
  });

  it("accepts site paths and https only", () => {
    expect(isLink("/blog/a")).toBe(true);
    expect(isLink("https://pishkhan.ir/x")).toBe(true);
    expect(isLink("http://a.ir")).toBe(false);
    expect(isLink("//evil.com")).toBe(false);
  });

  it("splits lists on Latin and Persian commas", () => {
    expect(splitList("دایرکت، پاسخ خودکار, instagram")).toEqual(["دایرکت", "پاسخ خودکار", "instagram"]);
  });
});
