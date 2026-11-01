"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { admin } from "@/lib/api/client";
import { CONTENT_KINDS, type ContentCategory, type ContentEntry, type ContentEntryRequest } from "@/lib/api/types";
import { ApiError } from "@/lib/problem";
import { useErrorMessage, useFieldError } from "@/lib/use-error-message";
import { BlockEditor } from "./block-editor";
import { useKindLabel } from "./content-badges";
import { BlockError, categoryKindOf, dataFieldsOf, isLink, LIST_FIELDS, SLUG_PATTERN, slugify, splitList, toBlocks, toEditorBlocks, type EditorBlock } from "./content-values";

interface Values {
  kind: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  author: string;
  /** Shown data fields as text (lists comma-separated, metrics as JSON); consent separately. */
  fields: Record<string, string>;
  consent: boolean;
}

const LINK_DATA = ["canonical", "cover", "logo"];
const JSON_DATA = ["metrics"];

function initial(entry: ContentEntry | null): Values {
  const data = entry?.data ?? {};
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === "consent") continue;
    fields[k] = Array.isArray(v) && LIST_FIELDS.includes(k) ? v.join("، ") : typeof v === "string" ? v : JSON.stringify(v, null, 2);
  }
  return {
    kind: entry?.kind ?? "post",
    slug: entry?.slug ?? "",
    title: entry?.title ?? "",
    description: entry?.description ?? "",
    category: entry?.category ?? "",
    author: entry?.author ?? "",
    fields,
    consent: data.consent === true,
  };
}

type Errors = Partial<Record<"slug" | "title" | "description" | "author" | "category" | "body" | "data" | "kind" | string, string>>;

/** Builds the request, or the client-side errors (field name → message; `block.N` for blocks). */
function build(v: Values, blocks: EditorBlock[], original: Record<string, unknown>, msg: (code: string) => string): { request?: ContentEntryRequest; errors: Errors; blockErrors: Record<number, string> } {
  const errors: Errors = {};
  const blockErrors: Record<number, string> = {};
  const slug = v.slug.trim();
  if (!slug || slug.length > 120 || !SLUG_PATTERN.test(slug)) errors.slug = msg("validation.content.slug");
  if (!v.title.trim()) errors.title = msg("validation.required");
  else if (v.title.trim().length > 200) errors.title = msg("validation.too_long");
  if (v.description.length > 2000) errors.description = msg("validation.too_long");
  if (v.author.length > 100) errors.author = msg("validation.too_long");

  const data: Record<string, unknown> = {};
  const shown = dataFieldsOf(v.kind);
  for (const [k, value] of Object.entries(original)) if (!shown.includes(k)) data[k] = value;
  for (const k of shown) {
    if (k === "consent") {
      data.consent = v.consent;
      continue;
    }
    const text = (v.fields[k] ?? "").trim();
    if (!text) continue;
    if (LIST_FIELDS.includes(k)) data[k] = splitList(text);
    else if (JSON_DATA.includes(k)) {
      try {
        data[k] = JSON.parse(text);
      } catch {
        errors[`data.${k}`] = msg("content.json_invalid");
      }
    } else {
      if (LINK_DATA.includes(k) && !isLink(text)) errors[`data.${k}`] = msg("validation.content.link");
      data[k] = text;
    }
  }

  let body: ContentEntryRequest["body"] = [];
  blocks.forEach((b, i) => {
    if (b.type === "image" && !isLink(b.src.trim())) blockErrors[i] = msg("validation.content.link");
    if (["p", "h2", "h3", "quote", "callout"].includes(b.type) && !b.text.trim()) blockErrors[i] = msg("validation.required");
    if ((b.type === "ul" || b.type === "ol") && !b.items.trim()) blockErrors[i] = msg("validation.required");
  });
  try {
    body = toBlocks(blocks);
  } catch (e) {
    if (e instanceof BlockError) blockErrors[e.index] = msg("content.json_invalid");
  }
  if (Object.keys(errors).length || Object.keys(blockErrors).length) return { errors, blockErrors };
  return {
    errors,
    blockErrors,
    request: {
      slug,
      title: v.title.trim(),
      description: v.description.trim() || null,
      category: categoryKindOf(v.kind) ? v.category || null : null,
      author: v.kind === "post" ? v.author.trim() || null : null,
      body,
      data,
    },
  };
}

/** Creates an entry (no `entry`) or edits its draft. The site keeps the published copy until the next publish. */
export function EntryEditor({ entry, canManage, onSaved, onDirty }: { entry: ContentEntry | null; canManage: boolean; onSaved?: (e: ContentEntry) => void; onDirty?: (dirty: boolean) => void }) {
  const t = useTranslations("content.editor");
  const tk = useTranslations("content");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const kindLabel = useKindLabel();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Values>(() => initial(entry));
  const [blocks, setBlocks] = useState<EditorBlock[]>(() => toEditorBlocks(entry?.body ?? []));
  const [slugTouched, setSlugTouched] = useState(Boolean(entry));
  const [errors, setErrors] = useState<Errors>({});
  const [blockErrors, setBlockErrors] = useState<Record<number, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [saved, setSaved] = useState(false);
  const readOnly = !canManage || entry?.status === "archived";
  const slugLocked = Boolean(entry?.firstPublishedAt);
  const msg = (code: string) => (te.has(code) ? te(code) : te("validation.failed"));
  const categoryKind = categoryKindOf(values.kind);

  const categories = useQuery({
    queryKey: ["content-categories", categoryKind],
    queryFn: () => admin<ContentCategory[]>(`/content/categories?kind=${categoryKind}`),
    enabled: categoryKind !== null,
  });

  const original = entry?.data ?? {};
  const baseline = JSON.stringify(build(initial(entry), toEditorBlocks(entry?.body ?? []), original, msg).request ?? null);
  const current = build(values, blocks, original, msg);
  const dirty = !entry || JSON.stringify(current.request ?? "invalid") !== baseline;
  useEffect(() => onDirty?.(dirty), [dirty, onDirty]);

  const mutation = useMutation({
    mutationFn: (request: ContentEntryRequest) =>
      entry
        ? admin<ContentEntry>(`/content/entries/${entry.id}`, { method: "PUT", body: { ...request, revision: entry.revision } })
        : admin<ContentEntry>("/content/entries", { method: "POST", body: { ...request, kind: values.kind } }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["content-entries"] });
      if (!entry) {
        router.replace(`/content/entries/${result.id}?created=1`);
        return;
      }
      queryClient.setQueryData(["content-entry", result.id], result);
      setSaved(true);
      onSaved?.(result);
    },
    onError: (error) => {
      setSaved(false);
      if (error instanceof ApiError) {
        if (error.code === "content.stale") setStale(true);
        const next: Errors = {};
        for (const [k, codes] of Object.entries(error.fieldErrors)) next[k] = fieldError(codes);
        if (error.code === "content.slug_taken" || error.code === "content.slug_locked") next.slug = errorMessage(error);
        setErrors(next);
      }
      setFormError(errorMessage(error));
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaved(false);
    setErrors(current.errors);
    setBlockErrors(current.blockErrors);
    if (current.request) mutation.mutate(current.request);
  };

  const set = (patch: Partial<Values>) => {
    setSaved(false);
    setValues((v) => {
      const next = { ...v, ...patch };
      if (!slugTouched && patch.title !== undefined) next.slug = slugify(patch.title);
      return next;
    });
  };
  const setField = (k: string, value: string) => set({ fields: { ...values.fields, [k]: value } });
  const select = "h-10 rounded-md border border-border bg-surface px-2 text-sm";

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      {stale ? (
        <Alert tone="warning">
          <p>{t("stale")}</p>
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => window.location.reload()}>
            {t("reload")}
          </Button>
        </Alert>
      ) : formError ? (
        <Alert tone="danger">{formError}</Alert>
      ) : null}
      {saved ? <Alert tone="success">{entry?.status === "published" ? t("savedPublished") : t("saved")}</Alert> : null}
      <Card>
        <CardHeader>
          <CardTitle>{t("details")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {entry ? null : (
            <Field label={t("kind")} error={errors.kind}>
              {({ id }) => (
                <select id={id} className={select} value={values.kind} onChange={(e) => set({ kind: e.target.value, category: "" })}>
                  {CONTENT_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {kindLabel(k)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
          <Field label={values.kind === "faq" ? t("question") : t("title")} error={errors.title} className="md:col-span-2">
            {({ id, describedBy, invalid }) => <Input id={id} dir="auto" readOnly={readOnly} maxLength={200} value={values.title} aria-describedby={describedBy} aria-invalid={invalid} onChange={(e) => set({ title: e.target.value })} />}
          </Field>
          <Field label={t("slug")} hint={slugLocked ? t("slugLocked") : t("slugHint")} error={errors.slug}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                dir="auto"
                readOnly={readOnly || slugLocked}
                maxLength={120}
                value={values.slug}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                onChange={(e) => {
                  setSlugTouched(true);
                  set({ slug: e.target.value });
                }}
              />
            )}
          </Field>
          {categoryKind ? (
            <Field label={t("category")} hint={t("categoryHint")} error={errors.category}>
              {({ id, describedBy, invalid }) => (
                <select id={id} className={select} disabled={readOnly} aria-describedby={describedBy} aria-invalid={invalid} value={values.category} onChange={(e) => set({ category: e.target.value })}>
                  <option value="">{categories.isPending ? tc("loading") : t("noCategory")}</option>
                  {(categories.data ?? []).map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.title}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          ) : null}
          {values.kind === "post" ? (
            <Field label={t("author")} error={errors.author}>
              {({ id, describedBy, invalid }) => <Input id={id} dir="auto" readOnly={readOnly} maxLength={100} value={values.author} aria-describedby={describedBy} aria-invalid={invalid} onChange={(e) => set({ author: e.target.value })} />}
            </Field>
          ) : null}
          <Field label={values.kind === "faq" ? t("answerSummary") : t("description")} hint={t("descriptionHint")} error={errors.description} className="md:col-span-2">
            {({ id, describedBy, invalid }) => <Textarea id={id} dir="auto" readOnly={readOnly} maxLength={2000} value={values.description} aria-describedby={describedBy} aria-invalid={invalid} onChange={(e) => set({ description: e.target.value })} />}
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("seo")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {dataFieldsOf(values.kind).map((k) =>
            k === "consent" ? (
              <label key={k} className="flex items-center gap-2 text-sm md:col-span-2">
                <input type="checkbox" className="size-4 accent-primary" disabled={readOnly} checked={values.consent} onChange={(e) => set({ consent: e.target.checked })} />
                {t("data.consent")}
              </label>
            ) : (
              <Field key={k} label={t(`data.${k}`)} hint={t.has(`dataHints.${k}`) ? t(`dataHints.${k}`) : undefined} error={errors[`data.${k}`]} className={JSON_DATA.includes(k) ? "md:col-span-2" : undefined}>
                {({ id, describedBy, invalid }) =>
                  JSON_DATA.includes(k) ? (
                    <Textarea id={id} dir="ltr" readOnly={readOnly} className="font-mono text-xs" value={values.fields[k] ?? ""} aria-describedby={describedBy} aria-invalid={invalid} onChange={(e) => setField(k, e.target.value)} />
                  ) : (
                    <Input id={id} dir={LINK_DATA.includes(k) || k === "version" ? "ltr" : "auto"} readOnly={readOnly} value={values.fields[k] ?? ""} aria-describedby={describedBy} aria-invalid={invalid} onChange={(e) => setField(k, e.target.value)} />
                  )
                }
              </Field>
            ),
          )}
          {errors.data ? <p className="text-xs text-danger md:col-span-2">{errors.data}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{values.kind === "faq" ? t("answer") : t("body")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {errors.body ? <Alert tone="danger">{errors.body}</Alert> : null}
          <BlockEditor
            blocks={blocks}
            readOnly={readOnly}
            errors={blockErrors}
            onChange={(next) => {
              setSaved(false);
              setBlocks(next);
            }}
          />
        </CardContent>
      </Card>

      {readOnly ? null : (
        <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-border bg-background/95 py-3">
          {entry && dirty ? <span className="text-sm text-warning-foreground">{t("unsaved")}</span> : null}
          <Button type="submit" disabled={mutation.isPending || (Boolean(entry) && !dirty)}>
            {entry ? t("saveDraft") : tk("create")}
          </Button>
        </div>
      )}
    </form>
  );
}
