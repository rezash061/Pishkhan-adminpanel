import { describe, expect, it } from "vitest";
import { lineDiff } from "./line-diff";

describe("lineDiff", () => {
  it("marks added and removed lines around common ones", () => {
    expect(lineDiff("a\nb\nc", "a\nx\nc\nd")).toEqual([
      { kind: "same", text: "a" },
      { kind: "removed", text: "b" },
      { kind: "added", text: "x" },
      { kind: "same", text: "c" },
      { kind: "added", text: "d" },
    ]);
  });

  it("returns only common lines for equal texts", () => {
    expect(lineDiff("سلام\n{{name}}", "سلام\n{{name}}").every((l) => l.kind === "same")).toBe(true);
  });
});
