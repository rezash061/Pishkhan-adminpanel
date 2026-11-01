"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useStaff } from "@/components/console/staff-context";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import type { ContentCategory } from "@/lib/api/types";
import { formatNumber, toLatinDigits } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage, useFieldError } from "@/lib/use-error-message";
import { SLUG_PATTERN, slugify } from "../content-values";

const KINDS = ["blog", "help"] as const;

/** Blog and help categories: create, rename and reorder, delete when no entry uses one. */
export function CategoriesManager() {
  const t = useTranslations("content.categories");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const staff = useStaff();
  const canManage = staff.can("content.manage");
  const [editing, setEditing] = useState<{ kind: string; category: ContentCategory | null } | null>(null);
  const [deleting, setDeleting] = useState<ContentCategory | null>(null);
  const { data, error, isPending } = useQuery({ queryKey: ["content-categories", "all"], queryFn: () => admin<ContentCategory[]>("/content/categories") });

  return (
    <div className="flex flex-col gap-4">
      {error instanceof ApiError && error.status === 404 ? <Alert tone="warning">{t("notAvailable")}</Alert> : error ? <Alert tone="danger">{errorMessage(error)}</Alert> : null}
      {KINDS.map((kind) => {
        const rows = (data ?? []).filter((c) => c.kind === kind);
        return (
          <Card key={kind}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle>{t(`kinds.${kind}`)}</CardTitle>
              {canManage ? (
                <Button size="sm" onClick={() => setEditing({ kind, category: null })}>
                  <Plus className="size-4" aria-hidden />
                  {t(`create.${kind}`)}
                </Button>
              ) : null}
            </CardHeader>
            <Table>
              <thead>
                <tr>
                  <Th>{t("columns.title")}</Th>
                  <Th>{t("columns.slug")}</Th>
                  <Th>{t("columns.description")}</Th>
                  <Th>{t("columns.order")}</Th>
                  {canManage ? <Th>{t("columns.actions")}</Th> : null}
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
                {data && rows.length === 0 ? (
                  <tr>
                    <Td colSpan={5} className="py-6 text-center text-muted-foreground">
                      {t("empty")}
                    </Td>
                  </tr>
                ) : null}
                {rows.map((c) => (
                  <tr key={c.id}>
                    <Td className="font-medium">{c.title}</Td>
                    <Td>
                      <span dir="auto" className="text-xs">
                        {c.slug}
                      </span>
                    </Td>
                    <Td className="text-muted-foreground">{c.description ?? "—"}</Td>
                    <Td>{formatNumber(c.sortOrder)}</Td>
                    {canManage ? (
                      <Td>
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" aria-label={t("editLabel", { title: c.title })} onClick={() => setEditing({ kind, category: c })}>
                            {t("edit")}
                          </Button>
                          <Button size="sm" variant="secondary" aria-label={t("deleteLabel", { title: c.title })} onClick={() => setDeleting(c)}>
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
        );
      })}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing ? <CategoryForm key={editing.category?.id ?? `new-${editing.kind}`} kind={editing.kind} category={editing.category} onClose={() => setEditing(null)} /> : null}
      </Dialog>
      <DeleteCategory category={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

interface Values {
  title: string;
  slug: string;
  description: string;
  sortOrder: string;
}

function CategoryForm({ kind, category, onClose }: { kind: string; category: ContentCategory | null; onClose: () => void }) {
  const t = useTranslations("content.categories");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const queryClient = useQueryClient();
  const [slugTouched, setSlugTouched] = useState(Boolean(category));
  const { register, handleSubmit, setValue, setError, formState } = useForm<Values>({
    defaultValues: { title: category?.title ?? "", slug: category?.slug ?? "", description: category?.description ?? "", sortOrder: String(category?.sortOrder ?? 0) },
  });

  const mutation = useMutation({
    mutationFn: (v: Values) => {
      const body = { kind, slug: v.slug.trim(), title: v.title.trim(), description: v.description.trim() || null, sortOrder: Number(toLatinDigits(v.sortOrder.trim() || "0")) };
      return category ? admin<ContentCategory>(`/content/categories/${category.id}`, { method: "PUT", body }) : admin<ContentCategory>("/content/categories", { method: "POST", body });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["content-categories"] });
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        for (const f of ["title", "slug", "description"] as const) if (error.fieldErrors[f]) setError(f, { message: fieldError(error.fieldErrors[f]) });
        if (error.code === "content.slug_taken") setError("slug", { message: errorMessage(error) });
      }
    },
  });
  const title = register("title", { validate: (v) => (!v.trim() ? te("validation.required") : v.trim().length > 100 ? te("validation.too_long") : true) });

  return (
    <DialogContent title={category ? t("editTitle", { title: category.title }) : t(`create.${kind}`)} closeLabel={tc("close")}>
      <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
        {mutation.error ? <Alert tone="danger">{errorMessage(mutation.error)}</Alert> : null}
        <Field label={t("columns.title")} error={formState.errors.title?.message}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              dir="auto"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              {...title}
              onChange={(e) => {
                void title.onChange(e);
                if (!slugTouched) setValue("slug", slugify(e.target.value));
              }}
            />
          )}
        </Field>
        <Field label={t("columns.slug")} hint={category ? t("slugFixed") : t("slugHint")} error={formState.errors.slug?.message}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              dir="auto"
              readOnly={Boolean(category)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              {...register("slug", {
                validate: (v) => (SLUG_PATTERN.test(v.trim()) ? true : te("validation.content.slug")),
                onChange: () => setSlugTouched(true),
              })}
            />
          )}
        </Field>
        <Field label={t("columns.description")} error={formState.errors.description?.message}>
          {({ id, describedBy, invalid }) => <Textarea id={id} dir="auto" maxLength={500} aria-describedby={describedBy} aria-invalid={invalid} {...register("description")} />}
        </Field>
        <Field label={t("columns.order")} hint={t("orderHint")} error={formState.errors.sortOrder?.message}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} dir="ltr" inputMode="numeric" aria-describedby={describedBy} aria-invalid={invalid} {...register("sortOrder", { validate: (v) => (/^-?\d{1,6}$/.test(toLatinDigits(v.trim() || "0")) ? true : te("validation.invalid")) })} />
          )}
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {tc("save")}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}

function DeleteCategory({ category, onClose }: { category: ContentCategory | null; onClose: () => void }) {
  const t = useTranslations("content.categories");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (id: string) => admin<void>(`/content/categories/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["content-categories"] });
      onClose();
    },
  });
  const close = () => {
    mutation.reset();
    onClose();
  };
  return (
    <Dialog open={category !== null} onOpenChange={(o) => !o && close()}>
      {category ? (
        <DialogContent title={t("deleteTitle", { title: category.title })} description={t("deleteBody")} closeLabel={tc("close")}>
          <div className="flex flex-col gap-4">
            {mutation.error ? <Alert tone="danger">{errorMessage(mutation.error)}</Alert> : null}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close}>
                {tc("cancel")}
              </Button>
              <Button variant="danger" disabled={mutation.isPending} onClick={() => mutation.mutate(category.id)}>
                {t("delete")}
              </Button>
            </div>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
