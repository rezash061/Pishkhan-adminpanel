"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { toPersianDigits } from "@/lib/format";
import { ALL_BLOCKS, emptyBlock, OTHER_BLOCKS, type EditorBlock } from "./content-values";

/** Structured body editor: one form per block, reordering, and JSON for the block types without a form. */
export function BlockEditor({ blocks, onChange, errors, readOnly }: { blocks: EditorBlock[]; onChange: (next: EditorBlock[]) => void; errors: Record<number, string>; readOnly: boolean }) {
  const t = useTranslations("content.blocks");
  const [adding, setAdding] = useState<string>("p");
  const addId = useId();
  const set = (i: number, patch: Partial<EditorBlock>) => onChange(blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const move = (i: number, to: number) => {
    const next = [...blocks];
    const [b] = next.splice(i, 1);
    next.splice(to, 0, b!);
    onChange(next);
  };
  const label = (type: string) => (t.has(`types.${type}`) ? t(`types.${type}`) : type);

  return (
    <div className="flex flex-col gap-3">
      {blocks.length === 0 ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : null}
      {blocks.map((b, i) => {
        const n = toPersianDigits(i + 1);
        return (
          <section key={b.key} aria-label={t("blockLabel", { n, type: label(b.type) })} className="flex flex-col gap-3 rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">{t("blockLabel", { n, type: label(b.type) })}</span>
              {readOnly ? null : (
                <div className="flex gap-1">
                  <Button size="icon" variant="secondary" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={t("moveUp", { n })}>
                    <ArrowUp className="size-4" aria-hidden />
                  </Button>
                  <Button size="icon" variant="secondary" disabled={i === blocks.length - 1} onClick={() => move(i, i + 1)} aria-label={t("moveDown", { n })}>
                    <ArrowDown className="size-4" aria-hidden />
                  </Button>
                  <Button size="icon" variant="secondary" onClick={() => onChange(blocks.filter((_, j) => j !== i))} aria-label={t("remove", { n })}>
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              )}
            </div>
            <BlockFields block={b} onChange={(patch) => set(i, patch)} error={errors[i]} readOnly={readOnly} n={n} />
          </section>
        );
      })}
      {readOnly ? null : (
        <div className="flex flex-wrap items-end gap-2">
          <label htmlFor={addId} className="flex flex-col gap-1 text-sm">
            <span>{t("addType")}</span>
            <select id={addId} value={adding} onChange={(e) => setAdding(e.target.value)} className="h-10 rounded-md border border-border bg-surface px-2 text-sm">
              {ALL_BLOCKS.map((type) => (
                <option key={type} value={type}>
                  {label(type)}
                </option>
              ))}
            </select>
          </label>
          <Button variant="secondary" onClick={() => onChange([...blocks, emptyBlock(adding)])}>
            <Plus className="size-4" aria-hidden />
            {t("add")}
          </Button>
        </div>
      )}
    </div>
  );
}

function BlockFields({ block: b, onChange, error, readOnly, n }: { block: EditorBlock; onChange: (patch: Partial<EditorBlock>) => void; error: string | undefined; readOnly: boolean; n: string }) {
  const t = useTranslations("content.blocks");
  const textField = (rows: boolean) => (
    <Field label={t("fields.text", { n })} error={error}>
      {({ id, describedBy, invalid }) =>
        rows ? (
          <Textarea id={id} dir="auto" readOnly={readOnly} value={b.text} aria-describedby={describedBy} aria-invalid={invalid} onChange={(e) => onChange({ text: e.target.value })} />
        ) : (
          <Input id={id} dir="auto" readOnly={readOnly} value={b.text} aria-describedby={describedBy} aria-invalid={invalid} onChange={(e) => onChange({ text: e.target.value })} />
        )
      }
    </Field>
  );
  switch (b.type) {
    case "p":
    case "quote":
      return textField(true);
    case "h3":
      return textField(false);
    case "h2":
      return (
        <div className="grid gap-3 md:grid-cols-[1fr_12rem]">
          {textField(false)}
          <Field label={t("fields.anchor", { n })} hint={t("fields.anchorHint")}>
            {({ id, describedBy }) => <Input id={id} dir="ltr" readOnly={readOnly} value={b.id} aria-describedby={describedBy} onChange={(e) => onChange({ id: e.target.value })} />}
          </Field>
        </div>
      );
    case "ul":
    case "ol":
      return (
        <Field label={t("fields.items", { n })} hint={t("fields.itemsHint")} error={error}>
          {({ id, describedBy, invalid }) => <Textarea id={id} dir="auto" readOnly={readOnly} value={b.items} aria-describedby={describedBy} aria-invalid={invalid} onChange={(e) => onChange({ items: e.target.value })} />}
        </Field>
      );
    case "callout":
      return (
        <div className="grid gap-3 md:grid-cols-[10rem_1fr]">
          <Field label={t("fields.tone", { n })}>
            {({ id }) => (
              <select id={id} disabled={readOnly} value={b.tone} onChange={(e) => onChange({ tone: e.target.value })} className="h-10 rounded-md border border-border bg-surface px-2 text-sm">
                <option value="info">{t("tones.info")}</option>
                <option value="warning">{t("tones.warning")}</option>
              </select>
            )}
          </Field>
          {textField(true)}
        </div>
      );
    case "image":
      return (
        <div className="grid gap-3 md:grid-cols-3">
          <Field label={t("fields.src", { n })} hint={t("fields.srcHint")} error={error}>
            {({ id, describedBy, invalid }) => <Input id={id} dir="ltr" readOnly={readOnly} value={b.src} aria-describedby={describedBy} aria-invalid={invalid} onChange={(e) => onChange({ src: e.target.value })} />}
          </Field>
          <Field label={t("fields.alt", { n })}>
            {({ id }) => <Input id={id} dir="auto" readOnly={readOnly} value={b.alt} onChange={(e) => onChange({ alt: e.target.value })} />}
          </Field>
          <Field label={t("fields.caption", { n })}>
            {({ id }) => <Input id={id} dir="auto" readOnly={readOnly} value={b.caption} onChange={(e) => onChange({ caption: e.target.value })} />}
          </Field>
        </div>
      );
    default:
      return (
        <Field label={t("fields.json", { n })} hint={(OTHER_BLOCKS as readonly string[]).includes(b.type) ? t("fields.jsonHint") : undefined} error={error}>
          {({ id, describedBy, invalid }) => (
            <Textarea id={id} dir="ltr" readOnly={readOnly} className="min-h-28 font-mono text-xs" value={b.json} aria-describedby={describedBy} aria-invalid={invalid} onChange={(e) => onChange({ json: e.target.value })} />
          )}
        </Field>
      );
  }
}
