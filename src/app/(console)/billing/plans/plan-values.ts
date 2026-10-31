import { BILLING_METERS, type PlanRequest } from "@/lib/api/types";
import { toLatinDigits } from "@/lib/format";

/** Form state: money in Toman and limits as text, so empty means "none" or "unlimited". */
export interface PlanFormValues {
  code: string;
  name: string;
  tagline: string;
  description: string;
  monthly: string;
  annual: string;
  overage: string;
  limits: Record<string, string>;
  features: { key: string; label: string; included: boolean; limit: string }[];
  isPublic: boolean;
  isFree: boolean;
  highlighted: boolean;
  sortOrder: string;
}

export const CODE_PATTERN = /^[a-z][a-z0-9-]{1,29}$/;

/** Accepts Persian digits and thousands separators. Returns null for an empty field and NaN for garbage. */
export function parseWhole(text: string): number | null {
  const clean = toLatinDigits(text).replace(/[,،٬\s]/g, "");
  if (clean === "") return null;
  return /^\d+$/.test(clean) ? Number(clean) : Number.NaN;
}

const tomanText = (rial: number | undefined | null) => (rial == null ? "" : String(Math.round(rial / 10)));

export function toFormValues(plan: PlanRequest & { code?: string }): PlanFormValues {
  return {
    code: plan.code ?? "",
    name: plan.name,
    tagline: plan.tagline ?? "",
    description: plan.description ?? "",
    monthly: tomanText(plan.monthly.amount),
    annual: tomanText(plan.annual?.amount),
    overage: tomanText(plan.overagePerConversation?.amount),
    limits: Object.fromEntries(BILLING_METERS.map((m) => [m, plan.limits[m] == null ? "" : String(plan.limits[m])])),
    features: plan.features.map((f) => ({ key: f.key, label: f.label, included: f.included, limit: f.limit ?? "" })),
    isPublic: plan.isPublic,
    isFree: plan.isFree,
    highlighted: plan.highlighted,
    sortOrder: String(plan.sortOrder),
  };
}

export const EMPTY_PLAN: PlanRequest = {
  name: "",
  tagline: null,
  description: null,
  monthly: { amount: 0, currency: "IRR" },
  annual: null,
  overagePerConversation: null,
  limits: {},
  features: [],
  isPublic: true,
  isFree: false,
  highlighted: false,
  sortOrder: 0,
};

const rial = (toman: string) => {
  const value = parseWhole(toman);
  return value == null ? null : { amount: value * 10, currency: "IRR" as const };
};

/** Form values to the API body. Validation has already run, so numbers parse. */
export function toPlanRequest(v: PlanFormValues): PlanRequest {
  const limits: Record<string, number | null> = {};
  for (const meter of BILLING_METERS) limits[meter] = parseWhole(v.limits[meter] ?? "");
  return {
    name: v.name.trim(),
    tagline: v.tagline.trim() || null,
    description: v.description.trim() || null,
    monthly: rial(v.monthly) ?? { amount: 0, currency: "IRR" },
    annual: rial(v.annual),
    overagePerConversation: rial(v.overage),
    limits,
    features: v.features.map((f) => ({ key: f.key.trim(), label: f.label.trim(), included: f.included, limit: f.limit.trim() || null })),
    isPublic: v.isPublic,
    isFree: v.isFree,
    highlighted: v.highlighted,
    sortOrder: parseWhole(v.sortOrder) ?? 0,
  };
}

/** Backend field keys (`plan.name`, `limits.seats`, `features[2]`) to form paths. */
export function formPath(key: string): string | null {
  const k = key.replace(/^plan\./, "");
  if (k === "overagePerConversation") return "overage";
  if (/^(code|name|tagline|description|monthly|annual|sortOrder|features)$/.test(k)) return k;
  const limit = /^limits\.(.+)$/.exec(k);
  if (limit) return `limits.${limit[1]}`;
  const feature = /^features\[(\d+)\]$/.exec(k);
  if (feature) return `features.${feature[1]}.label`;
  return null;
}
