"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { useStaff } from "@/components/console/staff-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import type { ContentRedirect } from "@/lib/api/types";
import { formatJalaliDateTime } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage, useFieldError } from "@/lib/use-error-message";
import { isLink } from "../content-values";

interface Values {
  from: string;
  to: string;
  permanent: boolean;
}

/** Website redirects: from a site path to a site path or an https URL; permanent is a 308, otherwise 307. */
export function RedirectsManager() {
  const t = useTranslations("content.redirects");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const staff = useStaff();
  const canManage = staff.can("content.manage");
  const queryClient = useQueryClient();
  const { data, error, isPending } = useQuery({ queryKey: ["content-redirects"], queryFn: () => admin<ContentRedirect[]>("/content/redirects") });
  const { register, handleSubmit, reset, setError, formState } = useForm<Values>({ defaultValues: { from: "", to: "", permanent: true } });

  const create = useMutation({
    mutationFn: (v: Values) => admin<ContentRedirect>("/content/redirects", { method: "POST", body: { from: v.from.trim(), to: v.to.trim(), permanent: v.permanent } }),
    onSuccess: async () => {
      reset();
      await queryClient.invalidateQueries({ queryKey: ["content-redirects"] });
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        for (const f of ["from", "to"] as const) if (e.fieldErrors[f]) setError(f, { message: fieldError(e.fieldErrors[f]) });
        if (e.code === "content.redirect_exists") setError("from", { message: errorMessage(e) });
      }
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => admin<void>(`/content/redirects/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["content-redirects"] }),
  });
  const path = (v: string) => /^\/[^\s?#]{0,299}$/.test(v.trim()) && !v.trim().startsWith("//");

  return (
    <div className="flex flex-col gap-4">
      {error instanceof ApiError && error.status === 404 ? <Alert tone="warning">{t("notAvailable")}</Alert> : error ? <Alert tone="danger">{errorMessage(error)}</Alert> : null}
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("create")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form noValidate className="grid items-start gap-4 md:grid-cols-[1fr_1fr_auto_auto]" onSubmit={handleSubmit((v) => create.mutate(v))}>
              {create.error && !(create.error instanceof ApiError && (create.error.code === "content.redirect_exists" || Object.keys(create.error.fieldErrors).length)) ? (
                <Alert tone="danger" className="md:col-span-4">
                  {errorMessage(create.error)}
                </Alert>
              ) : null}
              <Field label={t("from")} hint={t("fromHint")} error={formState.errors.from?.message}>
                {({ id, describedBy, invalid }) => <Input id={id} dir="ltr" placeholder="/old-page" aria-describedby={describedBy} aria-invalid={invalid} {...register("from", { validate: (v) => (path(v) ? true : te("validation.content.path")) })} />}
              </Field>
              <Field label={t("to")} hint={t("toHint")} error={formState.errors.to?.message}>
                {({ id, describedBy, invalid }) => <Input id={id} dir="ltr" placeholder="/new-page" aria-describedby={describedBy} aria-invalid={invalid} {...register("to", { validate: (v) => (isLink(v.trim()) ? true : te("validation.content.path")) })} />}
              </Field>
              <label className="flex items-center gap-2 pt-8 text-sm">
                <input type="checkbox" className="size-4 accent-primary" {...register("permanent")} />
                {t("permanent")}
              </label>
              <Button type="submit" className="mt-7" disabled={create.isPending}>
                {t("add")}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
      {remove.error ? <Alert tone="danger">{errorMessage(remove.error)}</Alert> : null}
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>{t("from")}</Th>
              <Th>{t("to")}</Th>
              <Th>{t("type")}</Th>
              <Th>{t("createdAt")}</Th>
              {canManage ? <Th>{t("actions")}</Th> : null}
            </tr>
          </thead>
          <tbody>
            {isPending && !error ? (
              <tr>
                <Td colSpan={5} className="py-6 text-center text-muted-foreground">
                  {tc("loading")}
                </Td>
              </tr>
            ) : null}
            {data && data.length === 0 ? (
              <tr>
                <Td colSpan={5} className="py-6 text-center text-muted-foreground">
                  {t("empty")}
                </Td>
              </tr>
            ) : null}
            {(data ?? []).map((r) => (
              <tr key={r.id}>
                <Td>
                  <span dir="ltr" className="font-mono text-xs">
                    {r.from}
                  </span>
                </Td>
                <Td>
                  <span dir="ltr" className="font-mono text-xs break-all">
                    {r.to}
                  </span>
                </Td>
                <Td>{r.permanent ? <Badge tone="info">{t("permanentShort")}</Badge> : <Badge>{t("temporaryShort")}</Badge>}</Td>
                <Td className="whitespace-nowrap">{formatJalaliDateTime(r.createdAt)}</Td>
                {canManage ? (
                  <Td>
                    <Button size="sm" variant="secondary" aria-label={t("deleteLabel", { from: r.from })} disabled={remove.isPending} onClick={() => remove.mutate(r.id)}>
                      {t("delete")}
                    </Button>
                  </Td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
