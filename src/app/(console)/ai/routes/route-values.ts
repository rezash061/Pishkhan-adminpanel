import type { AiRouteStep } from "@/lib/api/types";
import { toLatinDigits } from "@/lib/format";

/** Form values for one step: text fields, prices in Toman per million tokens. */
export interface StepValues {
  provider: string;
  model: string;
  temperature: string;
  maxOutputTokens: string;
  timeoutSeconds: string;
  inputPrice: string;
  outputPrice: string;
}

export const MAX_STEPS = 5;

export const EMPTY_STEP: StepValues = { provider: "", model: "", temperature: "", maxOutputTokens: "", timeoutSeconds: "30", inputPrice: "", outputPrice: "" };

/** Persian or Latin digits, thousands separators and «٫» as the decimal point. Empty is null; anything else unparsable is NaN. */
export function parseDecimal(text: string): number | null {
  const clean = toLatinDigits(text.trim()).replace(/[٬,\s]/g, "").replace("٫", ".");
  if (!clean) return null;
  return /^\d+(\.\d+)?$/.test(clean) ? Number(clean) : Number.NaN;
}

const show = (n: number | null) => (n == null ? "" : String(n));

export function toStepValues(step: AiRouteStep): StepValues {
  return {
    provider: step.provider,
    model: step.model,
    temperature: show(step.temperature),
    maxOutputTokens: show(step.maxOutputTokens),
    timeoutSeconds: String(step.timeoutSeconds),
    inputPrice: step.inputPricePerMillion == null ? "" : String(step.inputPricePerMillion / 10),
    outputPrice: step.outputPricePerMillion == null ? "" : String(step.outputPricePerMillion / 10),
  };
}

/** Rial for the API: Toman × 10. */
export function toRouteStep(v: StepValues): AiRouteStep {
  const toman = (text: string) => {
    const n = parseDecimal(text);
    return n == null ? null : Math.round(n * 10 * 100) / 100;
  };
  return {
    provider: v.provider,
    model: v.model.trim(),
    temperature: parseDecimal(v.temperature),
    maxOutputTokens: parseDecimal(v.maxOutputTokens),
    timeoutSeconds: parseDecimal(v.timeoutSeconds) ?? 30,
    inputPricePerMillion: toman(v.inputPrice),
    outputPricePerMillion: toman(v.outputPrice),
  };
}

/** Maps `routes[2].model` from the server to the form path `steps.2.model`; `price` lands on the input price. */
export function stepFieldPath(key: string): `steps.${number}.${keyof StepValues}` | null {
  const m = /^routes\[(\d+)\]\.(provider|model|temperature|maxOutputTokens|timeoutSeconds|price)$/.exec(key);
  if (!m) return null;
  const field = m[2] === "price" ? "inputPrice" : (m[2] as keyof StepValues);
  return `steps.${Number(m[1])}.${field}`;
}
