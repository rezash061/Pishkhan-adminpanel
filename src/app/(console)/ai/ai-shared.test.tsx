import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import type { EvalRun } from "@/lib/api/types";
import messages from "@/messages/fa.json";
import { FinglishSplit, formatPoints, GateChecks } from "./ai-shared";

const wrap = (ui: ReactNode) => render(<NextIntlClientProvider locale="fa" messages={messages}>{ui}</NextIntlClientProvider>);

const run = (over: Partial<EvalRun>): EvalRun => ({
  id: "r",
  setId: "s",
  setName: "mixed-fa",
  task: "classify",
  promptKey: "intent.classify",
  promptVersion: "1",
  route: null,
  status: "completed",
  caseCount: 20,
  errorCount: 0,
  intentAccuracy: 0.85,
  inputTokens: 0,
  outputTokens: 0,
  startedAt: "2026-11-03T08:00:00Z",
  finishedAt: "2026-11-03T08:01:00Z",
  gate: { passed: false, checks: [] },
  ...over,
});

describe("Finglish eval metrics", () => {
  it("labels the finglish_gap check in Persian, in points, with its explanation", () => {
    wrap(<GateChecks run={run({ gate: { passed: false, checks: [{ name: "finglish_gap", required: 0.05, actual: 0.1667, passed: false }] } })} />);
    expect(screen.getByText("فاصله دقت فینگلیش با فارسی")).toBeTruthy();
    expect(screen.getByText("حداکثر ۵ امتیاز؛ این اجرا: ۱۶٫۷ امتیاز")).toBeTruthy();
    expect(screen.getByText(/فقط وقتی بررسی می‌شود که مجموعه هر دو نوع نمونه را داشته باشد/)).toBeTruthy();
    expect(screen.getByText("رد")).toBeTruthy();
  });

  it("shows script and Finglish accuracy side by side with the Finglish case count", () => {
    const { container } = wrap(<FinglishSplit run={run({ finglishCaseCount: 8, scriptIntentAccuracy: 0.9167, finglishIntentAccuracy: 0.75 })} />);
    expect(container.textContent).toBe("فارسی: ۹۱٫۷٪فینگلیش: ۷۵٪ (۸ نمونه)");
  });

  it("shows «—» for a side without cases, and for older backends", () => {
    const { container, rerender } = wrap(<FinglishSplit run={run({ finglishCaseCount: 0, scriptIntentAccuracy: 0.8333, finglishIntentAccuracy: null })} />);
    expect(container.textContent).toBe("فارسی: ۸۳٫۳٪فینگلیش: — (۰ نمونه)");
    rerender(
      <NextIntlClientProvider locale="fa" messages={messages}>
        <FinglishSplit run={run({})} />
      </NextIntlClientProvider>,
    );
    expect(container.textContent).toBe("فارسی: —فینگلیش: — (—)");
  });

  it("formats gaps as points", () => {
    expect(formatPoints(0.05)).toBe("۵");
    expect(formatPoints(0.0417)).toBe("۴٫۲");
    expect(formatPoints(null)).toBe("—");
  });
});
