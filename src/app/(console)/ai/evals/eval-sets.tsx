"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useStaff } from "@/components/console/staff-context";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import type { EvalImportReport, EvalSet } from "@/lib/api/types";
import { formatJalaliDateTime, formatNumber } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage } from "@/lib/use-error-message";

const NAME_PATTERN = /^[a-z][a-z0-9_-]{1,39}$/;
const MAX_BYTES = 10 * 1024 * 1024;

/** Eval sets with their case counts, and (AIOps) importing anonymized cases as JSON Lines. */
export function EvalSets() {
  const t = useTranslations("ai.evals");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const staff = useStaff();
  const { data, error, isPending } = useQuery({ queryKey: ["ai-eval-sets"], queryFn: () => admin<EvalSet[]>("/ai/eval-sets") });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("sets")}</CardTitle>
      </CardHeader>
      {error instanceof ApiError && error.status === 404 ? (
        <CardContent>
          <Alert tone="warning">{t("notAvailable")}</Alert>
        </CardContent>
      ) : error ? (
        <CardContent>
          <Alert tone="danger">{errorMessage(error)}</Alert>
        </CardContent>
      ) : null}
      <Table>
        <thead>
          <tr>
            <Th>{t("columns.set")}</Th>
            <Th>{t("columns.description")}</Th>
            <Th>{t("columns.cases")}</Th>
            <Th>{t("columns.updatedAt")}</Th>
          </tr>
        </thead>
        <tbody>
          {isPending && !error ? (
            <tr>
              <Td colSpan={4} className="py-6 text-center text-muted-foreground">
                {tc("loading")}
              </Td>
            </tr>
          ) : null}
          {data && data.length === 0 ? (
            <tr>
              <Td colSpan={4} className="py-6 text-center text-muted-foreground">
                {t("noSets")}
              </Td>
            </tr>
          ) : null}
          {(data ?? []).map((s) => (
            <tr key={s.id}>
              <Td>
                <span dir="ltr" className="font-mono text-xs">
                  {s.name}
                </span>
              </Td>
              <Td>{s.description ?? "—"}</Td>
              <Td>{formatNumber(s.caseCount)}</Td>
              <Td className="whitespace-nowrap">{formatJalaliDateTime(s.updatedAt)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {staff.can("ai.manage") ? <ImportForm /> : null}
    </Card>
  );
}

function ImportForm() {
  const t = useTranslations("ai.evals");
  const te = useTranslations("errors");
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [fileError, setFileError] = useState<string | null>(null);
  const { register, handleSubmit, setValue, formState } = useForm<{ name: string; body: string }>({ defaultValues: { name: "", body: "" } });

  const mutation = useMutation({
    mutationFn: ({ name, body }: { name: string; body: string }) =>
      admin<EvalImportReport>(`/ai/eval-sets/${encodeURIComponent(name)}/import`, { method: "POST", text: body, contentType: "application/x-ndjson; charset=utf-8" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-eval-sets"] }),
  });
  const report = mutation.data;

  const readFile = async (file: File | undefined) => {
    setFileError(null);
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setFileError(t("import.tooBig"));
      return;
    }
    setValue("body", await file.text(), { shouldValidate: true });
  };

  return (
    <CardContent className="border-t border-border">
      <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate({ name: v.name.trim(), body: v.body }))}>
        <h3 className="text-sm font-semibold">{t("import.title")}</h3>
        <p className="text-xs text-muted-foreground">{t("import.body")}</p>
        {mutation.error ? <Alert tone="danger">{errorMessage(mutation.error)}</Alert> : null}
        {report ? (
          <Alert tone={report.errors.length > 0 ? "warning" : "success"}>
            <p>{t("import.report", { imported: formatNumber(report.imported), updated: formatNumber(report.updated), errors: formatNumber(report.errors.length) })}</p>
            {report.errors.length > 0 ? (
              <ul dir="ltr" className="mt-1 list-disc ps-5 text-start font-mono text-xs">
                {report.errors.slice(0, 20).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : null}
          </Alert>
        ) : null}
        <Field label={t("import.name")} hint={t("import.nameHint")} error={formState.errors.name?.message}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} dir="ltr" autoComplete="off" aria-describedby={describedBy} aria-invalid={invalid} {...register("name", { validate: (v) => (NAME_PATTERN.test(v.trim()) ? true : t("import.nameInvalid")) })} />
          )}
        </Field>
        <Field label={t("import.file")} error={fileError ?? undefined}>
          {({ id, describedBy, invalid }) => (
            <input id={id} type="file" accept=".jsonl,.ndjson,.txt,application/x-ndjson,text/plain" aria-describedby={describedBy} aria-invalid={invalid} className="text-sm" onChange={(e) => void readFile(e.target.files?.[0])} />
          )}
        </Field>
        <Field label={t("import.lines")} hint={t("import.linesHint")} error={formState.errors.body?.message}>
          {({ id, describedBy, invalid }) => (
            <Textarea
              id={id}
              dir="ltr"
              className="min-h-32 font-mono text-xs"
              placeholder='{"ref":"c1","input":"قیمت این مانتو چنده؟","expected":{"intent":"price"}}'
              aria-describedby={describedBy}
              aria-invalid={invalid}
              {...register("body", { validate: (v) => (!v.trim() ? te("validation.required") : new Blob([v]).size > MAX_BYTES ? t("import.tooBig") : true) })}
            />
          )}
        </Field>
        <Button type="submit" className="self-start" disabled={mutation.isPending}>
          {t("import.submit")}
        </Button>
      </form>
    </CardContent>
  );
}
