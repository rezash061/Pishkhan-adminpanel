"use client";

import { ArrowDown, ArrowUp, Plus, Trash2, WandSparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useFieldArray, useForm, useWatch, type Control, type UseFormRegister } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { AGENT_TONES, type IndustryTemplate, type TemplateRequest } from "@/lib/api/types";
import { toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage, useFieldError } from "@/lib/use-error-message";
import { ItemIssues } from "./template-issues";
import { FlowsSummary, RulesSummary } from "./template-summary";
import { formatJson, isTone, issuesFor, issuesIn, jsonProblem, KEY_PATTERN, LIMITS, summariesFromText, TemplateJsonError, toFormValues, toTemplateRequest, type TemplateFormValues } from "./template-values";

interface Props {
  initial: Pick<IndustryTemplate, "name" | "description" | "content">;
  /** Issues of the saved version, shown next to their items. */
  issues?: readonly string[];
  readOnly?: boolean;
  submitLabel: string;
  /** New templates can be submitted untouched; drafts only when changed. */
  allowPristine?: boolean;
  /** Resolves `false` when nothing was saved (the form stays dirty). */
  onSubmit?: (request: TemplateRequest) => Promise<unknown>;
  onDirtyChange?: (dirty: boolean) => void;
  /** Extra fields above the basics (the industry picker of a new template). */
  header?: React.ReactNode;
}

const BLANKS = /\[[^\]\n]+\]/g;

/**
 * The industry template editor (admin plan 4.6): name and description, required facts and FAQs as rows, the agent profile
 * as fields, and flows and rules as JSON with a read-only summary. Content problems are not blocking here; the server
 * returns them as `issues`.
 */
export function TemplateForm({ initial, issues = [], readOnly, submitLabel, allowPristine, onSubmit, onDirtyChange, header }: Props) {
  const t = useTranslations("templates.form");
  const te = useTranslations("errors");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, control, setError, setValue, reset, formState } = useForm<TemplateFormValues>({ defaultValues: toFormValues(initial) });
  const isDirty = formState.isDirty;
  useEffect(() => onDirtyChange?.(isDirty), [isDirty, onDirtyChange]);

  const facts = useFieldArray({ control, name: "requiredFacts" });
  const faqs = useFieldArray({ control, name: "faqs" });
  const hasProfile = useWatch({ control, name: "hasProfile" });
  const tone = useWatch({ control, name: "profile.tone" });
  const flowsJson = useWatch({ control, name: "flowsJson" });
  const rulesJson = useWatch({ control, name: "rulesJson" });
  const factValues = useWatch({ control, name: "requiredFacts" });
  const faqValues = useWatch({ control, name: "faqs" });
  const summaries = summariesFromText({ flowsJson, rulesJson });

  const keyRule = (list: () => { key: string }[]) => ({
    validate: (v: string) => {
      const k = v.trim();
      if (!KEY_PATTERN.test(k)) return t("keyInvalid");
      return list().filter((x) => x.key.trim() === k).length > 1 ? t("keyDuplicate") : true;
    },
  });
  const required = { validate: (v: string) => v.trim().length > 0 || te("validation.required") };
  const json = (field: "flowsJson" | "rulesJson") => ({
    validate: (v: string) => {
      const problem = jsonProblem(field, v);
      return problem === null ? true : problem === "syntax" ? t("jsonSyntax") : t("jsonArray");
    },
  });

  const submit = handleSubmit(async (values) => {
    if (!onSubmit) return;
    setFormError(null);
    try {
      if ((await onSubmit(toTemplateRequest(values))) !== false) reset(values);
    } catch (error) {
      if (error instanceof TemplateJsonError) {
        setError(error.field, { message: error.reason === "syntax" ? t("jsonSyntax") : t("jsonArray") });
        return;
      }
      if (error instanceof ApiError) {
        for (const [key, codes] of Object.entries(error.fieldErrors)) {
          const path = key.replace(/^template\./, "");
          if (path === "name" || path === "description") setError(path, { message: fieldError(codes) });
        }
      }
      setFormError(errorMessage(error));
    }
  });

  const err = (path: string) => {
    let node: unknown = formState.errors;
    for (const part of path.split(".")) node = (node as Record<string, unknown> | undefined)?.[part];
    return (node as { message?: string } | undefined)?.message;
  };
  const counter = (n: number, max: number) => t("countOf", { count: toPersianDigits(n), max: toPersianDigits(max) });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <fieldset disabled={readOnly || formState.isSubmitting} className="flex min-w-0 flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("basics")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {header}
            <Field label={t("name")} hint={t("nameHint")} error={err("name")}>
              {({ id, describedBy, invalid }) => <Input id={id} maxLength={LIMITS.name} aria-describedby={describedBy} aria-invalid={invalid} {...register("name", required)} />}
            </Field>
            <Field label={t("descriptionField")} hint={t("descriptionHint")} error={err("description")} className="md:col-span-2">
              {({ id, describedBy, invalid }) => <Textarea id={id} maxLength={LIMITS.description} aria-describedby={describedBy} aria-invalid={invalid} {...register("description")} />}
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {t("facts")} <span className="text-sm font-normal text-muted-foreground">({counter(facts.fields.length, LIMITS.facts)})</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">{t("factsHint")}</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {facts.fields.map((field, i) => (
              <fieldset key={field.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
                <legend className="sr-only">{t("factN", { n: toPersianDigits(i + 1) })}</legend>
                <div className="grid items-end gap-3 md:grid-cols-[1fr_1.5fr_2.5fr_auto]">
                  <Field label={t("key")} error={err(`requiredFacts.${i}.key`)}>
                    {({ id, describedBy, invalid }) => (
                      <Input id={id} dir="ltr" className="font-mono" maxLength={100} autoComplete="off" spellCheck={false} aria-describedby={describedBy} aria-invalid={invalid} {...register(`requiredFacts.${i}.key`, keyRule(() => factValues ?? []))} />
                    )}
                  </Field>
                  <Field label={t("factLabel")} error={err(`requiredFacts.${i}.label`)}>
                    {({ id, describedBy, invalid }) => <Input id={id} maxLength={LIMITS.label} aria-describedby={describedBy} aria-invalid={invalid} {...register(`requiredFacts.${i}.label`, required)} />}
                  </Field>
                  <Field label={t("factPrompt")} error={err(`requiredFacts.${i}.prompt`)}>
                    {({ id, describedBy, invalid }) => <Input id={id} maxLength={LIMITS.prompt} aria-describedby={describedBy} aria-invalid={invalid} {...register(`requiredFacts.${i}.prompt`, required)} />}
                  </Field>
                  <RowButtons readOnly={readOnly} item={t("factN", { n: toPersianDigits(i + 1) })} n={i + 1} count={facts.fields.length} onMove={(to) => facts.move(i, to)} onRemove={() => facts.remove(i)} />
                </div>
                <ItemIssues issues={issuesFor(issues, "requiredFacts", factValues?.[i]?.key ?? field.key)} />
              </fieldset>
            ))}
            {readOnly ? null : (
              <Button variant="secondary" size="sm" className="self-start" disabled={facts.fields.length >= LIMITS.facts} onClick={() => facts.append({ key: "", label: "", prompt: "" })}>
                <Plus className="size-4" aria-hidden />
                {t("addFact")}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {t("faqs")} <span className="text-sm font-normal text-muted-foreground">({counter(faqs.fields.length, LIMITS.faqs)})</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">{t("faqsHint")}</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {faqs.fields.map((field, i) => {
              const blanks = (faqValues?.[i]?.answer ?? "").match(BLANKS)?.length ?? 0;
              return (
                <fieldset key={field.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
                  <legend className="sr-only">{t("faqN", { n: toPersianDigits(i + 1) })}</legend>
                  <div className="grid items-end gap-3 md:grid-cols-[1fr_3fr_auto]">
                    <Field label={t("key")} error={err(`faqs.${i}.key`)}>
                      {({ id, describedBy, invalid }) => (
                        <Input id={id} dir="ltr" className="font-mono" maxLength={100} autoComplete="off" spellCheck={false} aria-describedby={describedBy} aria-invalid={invalid} {...register(`faqs.${i}.key`, keyRule(() => faqValues ?? []))} />
                      )}
                    </Field>
                    <Field label={t("question")} error={err(`faqs.${i}.question`)}>
                      {({ id, describedBy, invalid }) => <Input id={id} maxLength={LIMITS.question} aria-describedby={describedBy} aria-invalid={invalid} {...register(`faqs.${i}.question`, required)} />}
                    </Field>
                    <RowButtons readOnly={readOnly} item={t("faqN", { n: toPersianDigits(i + 1) })} n={i + 1} count={faqs.fields.length} onMove={(to) => faqs.move(i, to)} onRemove={() => faqs.remove(i)} />
                  </div>
                  <Field label={t("answer")} hint={blanks ? t("blanks", { count: blanks }) : undefined} error={err(`faqs.${i}.answer`)}>
                    {({ id, describedBy, invalid }) => <Textarea id={id} maxLength={LIMITS.answer} aria-describedby={describedBy} aria-invalid={invalid} {...register(`faqs.${i}.answer`)} />}
                  </Field>
                  <ItemIssues issues={issuesFor(issues, "faqs", faqValues?.[i]?.key ?? field.key)} />
                </fieldset>
              );
            })}
            {readOnly ? null : (
              <Button variant="secondary" size="sm" className="self-start" disabled={faqs.fields.length >= LIMITS.faqs} onClick={() => faqs.append({ key: "", question: "", answer: "" })}>
                <Plus className="size-4" aria-hidden />
                {t("addFaq")}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("profile")}</CardTitle>
            <p className="text-xs text-muted-foreground">{t("profileHint")}</p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" className="size-4 accent-primary" {...register("hasProfile")} />
              {t("hasProfile")}
            </label>
            {hasProfile ? (
              <>
                <Field label={t("profileName")} error={err("profile.name")}>
                  {({ id, describedBy, invalid }) => <Input id={id} maxLength={LIMITS.profileName} aria-describedby={describedBy} aria-invalid={invalid} {...register("profile.name", required)} />}
                </Field>
                <Field label={t("tone")} error={err("profile.tone")}>
                  {({ id, describedBy, invalid }) => (
                    <select id={id} aria-describedby={describedBy} aria-invalid={invalid} className="h-10 rounded-md border border-border bg-surface px-2 text-sm" {...register("profile.tone")}>
                      {AGENT_TONES.map((x) => (
                        <option key={x} value={x}>
                          {t(`tones.${x}`)}
                        </option>
                      ))}
                      {tone && !isTone(tone) ? <option value={tone}>{t("toneUnknown", { tone })}</option> : null}
                    </select>
                  )}
                </Field>
                <Field label={t("brandVoice")} hint={t("brandVoiceHint")} error={err("profile.brandVoice")} className="md:col-span-2">
                  {({ id, describedBy, invalid }) => <Textarea id={id} maxLength={LIMITS.brandVoice} aria-describedby={describedBy} aria-invalid={invalid} {...register("profile.brandVoice")} />}
                </Field>
                <Field label={t("neverSay")} hint={t("linesHint")} error={err("profile.neverSay")}>
                  {({ id, describedBy, invalid }) => <Textarea id={id} className="min-h-28" aria-describedby={describedBy} aria-invalid={invalid} {...register("profile.neverSay")} />}
                </Field>
                <Field label={t("handoffKeywords")} hint={t("linesHint")} error={err("profile.handoffKeywords")}>
                  {({ id, describedBy, invalid }) => <Textarea id={id} className="min-h-28" aria-describedby={describedBy} aria-invalid={invalid} {...register("profile.handoffKeywords")} />}
                </Field>
                <div className="md:col-span-2">
                  <ItemIssues issues={issuesIn(issues, "agentProfile")} />
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <JsonCard
          title={t("flows")}
          hint={t("flowsHint")}
          field="flowsJson"
          count={summaries.flows?.length ?? null}
          max={LIMITS.flows}
          register={register}
          rules={json("flowsJson")}
          error={err("flowsJson")}
          readOnly={readOnly}
          control={control}
          onFormat={() => setValue("flowsJson", formatJson(flowsJson), { shouldDirty: true })}
        >
          <FlowsSummary flows={summaries.flows} />
        </JsonCard>

        <JsonCard
          title={t("rules")}
          hint={t("rulesHint")}
          field="rulesJson"
          count={summaries.rules?.length ?? null}
          max={LIMITS.rules}
          register={register}
          rules={json("rulesJson")}
          error={err("rulesJson")}
          readOnly={readOnly}
          control={control}
          onFormat={() => setValue("rulesJson", formatJson(rulesJson), { shouldDirty: true })}
        >
          <RulesSummary rules={summaries.rules} />
        </JsonCard>
      </fieldset>
      {readOnly || !onSubmit ? null : (
        <Button type="submit" className="self-start" disabled={formState.isSubmitting || (!allowPristine && !isDirty)}>
          {submitLabel}
        </Button>
      )}
    </form>
  );
}

function RowButtons({ readOnly, item, n, count, onMove, onRemove }: { readOnly?: boolean; item: string; n: number; count: number; onMove: (to: number) => void; onRemove: () => void }) {
  const t = useTranslations("templates.form");
  if (readOnly) return <span />;
  return (
    <div className="flex gap-1">
      <Button variant="ghost" size="icon" aria-label={t("moveUp", { item })} disabled={n === 1} onClick={() => onMove(n - 2)}>
        <ArrowUp className="size-4" aria-hidden />
      </Button>
      <Button variant="ghost" size="icon" aria-label={t("moveDown", { item })} disabled={n === count} onClick={() => onMove(n)}>
        <ArrowDown className="size-4" aria-hidden />
      </Button>
      <Button variant="ghost" size="icon" aria-label={t("remove", { item })} onClick={onRemove}>
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

interface JsonCardProps {
  title: string;
  hint: string;
  field: "flowsJson" | "rulesJson";
  count: number | null;
  max: number;
  register: UseFormRegister<TemplateFormValues>;
  rules: { validate: (v: string) => true | string };
  error: string | undefined;
  readOnly?: boolean;
  control: Control<TemplateFormValues>;
  onFormat: () => void;
  children: React.ReactNode;
}

/** A JSON editor (left-to-right, monospaced) with a live parse check and a read-only summary beside it. */
function JsonCard({ title, hint, field, count, max, register, rules, error, readOnly, control, onFormat, children }: JsonCardProps) {
  const t = useTranslations("templates.form");
  const value = useWatch({ control, name: field });
  const problem = jsonProblem(field, value);
  const live = problem === null ? t("jsonOk") : problem === "syntax" ? t("jsonSyntax") : t("jsonArray");
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {title}
          {count !== null ? <span className="text-sm font-normal text-muted-foreground"> ({t("countOf", { count: toPersianDigits(count), max: toPersianDigits(max) })})</span> : null}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="flex min-w-0 flex-col gap-2">
          <Field label={title} hint={error ? undefined : live} error={error}>
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                dir="ltr"
                spellCheck={false}
                autoComplete="off"
                readOnly={readOnly}
                className="min-h-96 whitespace-pre font-mono text-xs leading-5"
                aria-describedby={describedBy}
                aria-invalid={invalid || problem !== null}
                {...register(field, rules)}
              />
            )}
          </Field>
          {readOnly ? null : (
            <Button variant="secondary" size="sm" className="self-start" disabled={problem === "syntax"} onClick={onFormat}>
              <WandSparkles className="size-4" aria-hidden />
              {t("formatJson")}
            </Button>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <h3 className="text-sm font-medium">{t("summary")}</h3>
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
