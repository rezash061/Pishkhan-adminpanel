"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ReasonDialog } from "@/components/console/reason-dialog";
import { useStaff } from "@/components/console/staff-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import type { FeatureFlag, FeatureFlagRequest } from "@/lib/api/types";
import { formatJalaliDateTime, toLatinDigits, toPersianDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage, useFieldError } from "@/lib/use-error-message";

export const FLAG_KEY = /^[a-z][a-z0-9._-]{1,59}$/;

/** Plan codes typed with commas, Persian commas or new lines; trimmed and unique. */
export function parsePlans(text: string): string[] {
  return [...new Set(text.split(/[,،\n]/).map((p) => p.trim()).filter(Boolean))];
}

/** Global feature flags (AD-1.8): rollout share, plan list, switch. SuperAdmin edits; everyone else reads. */
export function FlagsManager() {
  const t = useTranslations("flags");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const staff = useStaff();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<FeatureFlag | "new" | null>(null);
  const [deleting, setDeleting] = useState<FeatureFlag | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { data, error, isPending } = useQuery({ queryKey: ["feature-flags"], queryFn: () => admin<FeatureFlag[]>("/feature-flags") });

  if (isPending && !error) return <p className="text-sm text-muted-foreground">{tc("loading")}</p>;
  if (error instanceof ApiError && error.status === 404) return <Alert tone="warning">{t("notAvailable")}</Alert>;
  if (error || !data) return <Alert tone="danger">{errorMessage(error)}</Alert>;

  const canManage = staff.can("flags.manage");

  return (
    <div className="flex flex-col gap-4">
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {canManage ? (
        <Button className="self-start" onClick={() => setEditing("new")}>
          {t("new")}
        </Button>
      ) : (
        <Alert tone="info">{t("readOnly")}</Alert>
      )}
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>{t("columns.key")}</Th>
              <Th>{t("columns.state")}</Th>
              <Th>{t("columns.rollout")}</Th>
              <Th>{t("columns.plans")}</Th>
              <Th>{t("columns.overrides")}</Th>
              <Th>{t("columns.updated")}</Th>
              {canManage ? <Th>{t("columns.actions")}</Th> : null}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <Td colSpan={7} className="py-8 text-center text-muted-foreground">
                  {t("empty")}
                </Td>
              </tr>
            ) : null}
            {data.map((f) => (
              <tr key={f.key} data-testid={`flag-${f.key}`}>
                <Td>
                  <div className="font-mono text-xs" dir="ltr">
                    {f.key}
                  </div>
                  {f.description ? <div className="text-xs text-muted-foreground">{f.description}</div> : null}
                </Td>
                <Td>
                  <Badge tone={f.enabled ? "success" : "neutral"}>{f.enabled ? t("on") : t("off")}</Badge>
                </Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-20 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <div className="h-full bg-primary" style={{ width: `${f.rolloutPercent}%` }} />
                    </div>
                    {t("percent", { n: toPersianDigits(f.rolloutPercent) })}
                  </div>
                </Td>
                <Td className="font-mono text-xs" dir={f.plans.length ? "ltr" : undefined}>
                  {f.plans.length ? f.plans.join(", ") : <span className="font-sans text-muted-foreground">{t("allPlans")}</span>}
                </Td>
                <Td>{toPersianDigits(f.overrides)}</Td>
                <Td className="whitespace-nowrap text-xs">{t("updatedBy", { date: formatJalaliDateTime(f.updatedAt), who: f.updatedBy ?? "—" })}</Td>
                {canManage ? (
                  <Td>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => setEditing(f)}>
                        {t("edit")}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setDeleting(f)}>
                        {t("delete")}
                      </Button>
                    </div>
                  </Td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <FlagDialog
        flag={editing}
        onClose={() => setEditing(null)}
        onSaved={async (flag, created) => {
          setNotice(created ? t("form.created", { key: flag.key }) : t("form.saved", { key: flag.key }));
          setEditing(null);
          await queryClient.invalidateQueries({ queryKey: ["feature-flags"] });
        }}
      />
      <ReasonDialog
        open={deleting !== null}
        title={deleting ? t("deleteDialog.title", { key: deleting.key }) : ""}
        description={t("deleteDialog.body")}
        confirmLabel={t("deleteDialog.confirm")}
        stepUp
        onSubmit={(reason) => admin<void>(`/feature-flags/${encodeURIComponent(deleting!.key)}/delete`, { method: "POST", body: { reason } })}
        onDone={async () => {
          setNotice(t("deleteDialog.done", { key: deleting!.key }));
          setDeleting(null);
          await queryClient.invalidateQueries({ queryKey: ["feature-flags"] });
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

interface FormValues {
  key: string;
  description: string;
  enabled: boolean;
  rolloutPercent: string;
  plans: string;
  reason: string;
}

function FlagDialog({ flag, onClose, onSaved }: { flag: FeatureFlag | "new" | null; onClose: () => void; onSaved: (flag: FeatureFlag, created: boolean) => void }) {
  const t = useTranslations("flags.form");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const [formError, setFormError] = useState<string | null>(null);
  const creating = flag === "new";
  const current = flag && flag !== "new" ? flag : null;
  const { register, handleSubmit, reset, setError, formState } = useForm<FormValues>({
    values: {
      key: current?.key ?? "",
      description: current?.description ?? "",
      enabled: current?.enabled ?? false,
      rolloutPercent: String(current?.rolloutPercent ?? 0),
      plans: current?.plans.join("\n") ?? "",
      reason: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (body: FeatureFlagRequest) =>
      creating ? admin<FeatureFlag>("/feature-flags", { method: "POST", body }) : admin<FeatureFlag>(`/feature-flags/${encodeURIComponent(current!.key)}`, { method: "PUT", body }),
    onSuccess: (result) => {
      reset();
      setFormError(null);
      onSaved(result, creating);
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        for (const field of ["key", "description", "rolloutPercent", "plans", "reason"] as const) {
          if (error.fieldErrors[field]) setError(field, { message: fieldError(error.fieldErrors[field]) });
        }
        if (error.code === "backoffice.flag_exists") setError("key", { message: errorMessage(error) });
      }
      setFormError(errorMessage(error));
    },
  });

  const close = () => {
    reset();
    setFormError(null);
    onClose();
  };

  return (
    <Dialog open={flag !== null} onOpenChange={(open) => !open && close()}>
      {flag !== null ? (
        <DialogContent title={creating ? t("createTitle") : t("editTitle", { key: current!.key })} closeLabel={tc("close")} className="max-w-lg">
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={handleSubmit((v) => {
              setFormError(null);
              mutation.mutate({
                ...(creating ? { key: v.key.trim() } : {}),
                description: v.description.trim() || null,
                enabled: v.enabled,
                rolloutPercent: Number(toLatinDigits(v.rolloutPercent)),
                plans: parsePlans(v.plans),
                reason: v.reason.trim(),
              });
            })}
          >
            {formError ? <Alert tone="danger">{formError}</Alert> : null}
            {creating ? (
              <Field label={t("key")} hint={t("keyHint")} error={formState.errors.key?.message}>
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    dir="ltr"
                    className="font-mono"
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                    {...register("key", { validate: (v) => (FLAG_KEY.test(v.trim()) ? true : te("validation.invalid")) })}
                  />
                )}
              </Field>
            ) : null}
            <Field label={t("description")} error={formState.errors.description?.message}>
              {({ id, describedBy, invalid }) => <Input id={id} maxLength={300} aria-describedby={describedBy} aria-invalid={invalid} {...register("description")} />}
            </Field>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" className="size-4 accent-primary" {...register("enabled")} />
              {t("enabled")}
            </label>
            <Field label={t("rollout")} hint={t("rolloutHint")} error={formState.errors.rolloutPercent?.message}>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  inputMode="numeric"
                  className="w-28"
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  {...register("rolloutPercent", {
                    validate: (v) => {
                      const n = Number(toLatinDigits(v.trim()));
                      return Number.isInteger(n) && n >= 0 && n <= 100 ? true : te("validation.out_of_range");
                    },
                  })}
                />
              )}
            </Field>
            <Field label={t("plans")} hint={t("plansHint")} error={formState.errors.plans?.message}>
              {({ id, describedBy, invalid }) => <Textarea id={id} dir="ltr" rows={2} className="font-mono" aria-describedby={describedBy} aria-invalid={invalid} {...register("plans")} />}
            </Field>
            <Field label={tc("reason")} error={formState.errors.reason?.message}>
              {({ id, describedBy, invalid }) => (
                <Textarea
                  id={id}
                  maxLength={300}
                  placeholder={tc("reasonPlaceholder")}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  {...register("reason", {
                    validate: (v) => {
                      const n = v.trim().length;
                      return n === 0 ? te("validation.required") : n < 5 ? te("validation.too_short") : true;
                    },
                  })}
                />
              )}
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={close}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {t("save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
