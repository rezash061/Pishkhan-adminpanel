import { beforeEach, describe, expect, it } from "vitest";
import type { EvalRun, EvalRunDetail, PagedResult, PromptKey } from "@/lib/api/types";
import { looksFinglish } from "@/lib/finglish";
import { handleMockRequest, resetMockState } from "./admin-api";
import samples from "./eval-samples/finglish.json";

const call = (method: string, path: string, body?: unknown, token?: string) =>
  handleMockRequest(
    new Request(`http://mock.invalid${path}`, {
      method,
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? null : JSON.stringify(body),
    }),
  );
const login = async (username: string) =>
  (await (await call("POST", "/admin/v1/auth/login", { username, password: "Pishkhan-admin-1234", totpCode: "123456" })).json()).accessToken as string;

// Keeps the mock honest about the Finglish eval metrics of backend PR #44 (BE-2.3).
describe("mock AI evals: Finglish", () => {
  beforeEach(() => resetMockState());

  it("reads every backend Finglish sample as Finglish", () => {
    expect(samples).toHaveLength(30);
    expect(samples.filter((c) => !looksFinglish(c.input)).map((c) => c.ref)).toEqual([]);
  });

  it("splits accuracy by script and adds finglish_gap only when a set has both kinds", async () => {
    const token = await login("aiops");
    const runs: PagedResult<EvalRun> = await (await call("GET", "/admin/v1/ai/eval-runs?pageSize=100", undefined, token)).json();
    const by = (set: string, version: string) => runs.items.find((r) => r.setName === set && r.promptVersion === version)!;

    const failing = by("mixed-fa", "1");
    expect([failing.finglishCaseCount, failing.scriptIntentAccuracy, failing.finglishIntentAccuracy, failing.intentAccuracy]).toEqual([8, 0.9167, 0.75, 0.85]);
    expect(failing.gate.checks.find((c) => c.name === "finglish_gap")).toEqual({ name: "finglish_gap", required: 0.05, actual: 0.1667, passed: false });
    expect(failing.gate.passed).toBe(false);

    const passing = by("mixed-fa", "2");
    expect(passing.gate.checks.find((c) => c.name === "finglish_gap")).toMatchObject({ actual: 0.0417, passed: true });

    const fashion = by("fashion-fa", "1");
    expect([fashion.finglishCaseCount, fashion.finglishIntentAccuracy, fashion.scriptIntentAccuracy]).toEqual([0, null, 0.8333]);
    expect(fashion.gate.checks.map((c) => c.name)).not.toContain("finglish_gap");

    const finglishOnly = by("finglish", "2");
    expect([finglishOnly.finglishCaseCount, finglishOnly.scriptIntentAccuracy]).toEqual([30, null]);
    expect(finglishOnly.gate.checks.map((c) => c.name)).not.toContain("finglish_gap");
  });

  it("returns results that agree with the run's accuracies", async () => {
    const token = await login("aiops");
    const runs: PagedResult<EvalRun> = await (await call("GET", "/admin/v1/ai/eval-runs?pageSize=100", undefined, token)).json();
    const run = runs.items.find((r) => r.setName === "mixed-fa" && r.promptVersion === "1")!;
    const detail: EvalRunDetail = await (await call("GET", `/admin/v1/ai/eval-runs/${run.id}`, undefined, token)).json();
    const finglish = detail.results.filter((r) => looksFinglish(r.input));
    expect(finglish).toHaveLength(8);
    expect(finglish.filter((r) => r.correct).length / 8).toBe(0.75);
    expect(detail.results[0]!.correct).toBe(false);
  });

  it("lists the new prompts with the others, from data", async () => {
    const keys: PromptKey[] = await (await call("GET", "/admin/v1/ai/prompts", undefined, await login("readonly"))).json();
    expect(keys.map((k) => k.key)).toEqual(["intent.classify", "knowledge.onboarding", "reply.system", "text.transliterate"]);
    expect(keys.find((k) => k.key === "text.transliterate")).toMatchObject({ activeVersion: "1", activeSource: "configuration", versionCount: 1 });
  });
});
