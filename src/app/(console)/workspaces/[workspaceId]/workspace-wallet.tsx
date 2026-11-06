"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ReasonDialog } from "@/components/console/reason-dialog";
import { useStaff } from "@/components/console/staff-context";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Table, Td, Th } from "@/components/ui/table";
import { admin } from "@/lib/api/client";
import type { WalletInfo } from "@/lib/api/types";
import { formatJalaliDateTime, formatToman } from "@/lib/format";
import { ApiError } from "@/lib/problem";
import { useErrorMessage, useFieldError } from "@/lib/use-error-message";
import { parseWhole } from "../../billing/plans/plan-values";

/** Signed Toman for a wallet row: "+۱۰۰٬۰۰۰ تومان" or "−۵۰٬۰۰۰ تومان". */
export function signedToman(rial: number): string {
  return `${rial < 0 ? "−" : "+"}${formatToman(Math.abs(rial))}`;
}

/** The workspace's wallet (backend PR #55): balance, latest changes, and (Finance) credit added or taken off. */
export function WorkspaceWallet({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("billing.wallet");
  const errorMessage = useErrorMessage();
  const staff = useStaff();
  const queryClient = useQueryClient();
  const [adjusting, setAdjusting] = useState(false);
  const [done, setDone] = useState(false);
  const key = ["workspace-wallet", workspaceId];
  const { data, error } = useQuery({
    queryKey: key,
    queryFn: () => admin<WalletInfo>(`/workspaces/${workspaceId}/wallet`),
    enabled: staff.can("billing.read"),
  });

  if (!staff.can("billing.read")) return null;
  if (error instanceof ApiError && error.status === 404) return null;

  return (
    <Card data-testid="workspace-wallet">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle>{t("title")}</CardTitle>
          {data ? (
            <p className="mt-1 text-sm">
              {t("balance")}:{" "}
              <strong data-testid="wallet-balance">
                {formatToman(data.balance.amount)}
              </strong>
            </p>
          ) : null}
        </div>
        {data && staff.can("wallet.adjust") ? (
          <Button variant="secondary" onClick={() => setAdjusting(true)}>
            {t("adjust")}
          </Button>
        ) : null}
      </CardHeader>
      {done ? (
        <CardContent>
          <Alert tone="success">{t("done")}</Alert>
        </CardContent>
      ) : null}
      {error ? (
        <CardContent>
          <Alert tone="danger">{errorMessage(error)}</Alert>
        </CardContent>
      ) : !data ? null : data.entries.length === 0 ? (
        <CardContent className="text-sm text-muted-foreground">
          {t("empty")}
        </CardContent>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("columns.time")}</Th>
              <Th>{t("columns.kind")}</Th>
              <Th>{t("columns.amount")}</Th>
              <Th>{t("columns.after")}</Th>
              <Th>{t("columns.note")}</Th>
            </tr>
          </thead>
          <tbody>
            {data.entries.slice(0, 20).map((e) => (
              <tr key={e.id}>
                <Td className="whitespace-nowrap">
                  {formatJalaliDateTime(e.createdAt)}
                </Td>
                <Td>
                  {t.has(`kinds.${e.kind}`) ? t(`kinds.${e.kind}`) : e.kind}
                </Td>
                <Td
                  className={
                    e.amount.amount < 0
                      ? "whitespace-nowrap text-danger-foreground"
                      : "whitespace-nowrap text-success-foreground"
                  }
                >
                  {signedToman(e.amount.amount)}
                </Td>
                <Td className="whitespace-nowrap">
                  {formatToman(e.balanceAfter.amount)}
                </Td>
                <Td className="text-xs">
                  {e.reason ? (
                    <div>
                      {t.has(`reasons.${e.reason}`)
                        ? t(`reasons.${e.reason}`)
                        : e.reason}
                    </div>
                  ) : null}
                  {e.checkoutId ? (
                    <Link
                      href={`/billing/payments/${e.checkoutId}`}
                      className="text-primary hover:underline"
                    >
                      {t("payment")}
                    </Link>
                  ) : null}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {adjusting && data ? (
        <AdjustDialog
          workspaceId={workspaceId}
          balanceRial={data.balance.amount}
          onClose={() => setAdjusting(false)}
          onDone={(next) => {
            setAdjusting(false);
            setDone(true);
            queryClient.setQueryData(key, next);
          }}
        />
      ) : null}
    </Card>
  );
}

function AdjustDialog({
  workspaceId,
  balanceRial,
  onClose,
  onDone,
}: {
  workspaceId: string;
  balanceRial: number;
  onClose: () => void;
  onDone: (w: WalletInfo) => void;
}) {
  const t = useTranslations("billing.wallet");
  const fieldError = useFieldError();
  const [direction, setDirection] = useState<"add" | "subtract">("add");
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState<string | undefined>();

  return (
    <ReasonDialog<WalletInfo>
      open
      stepUp
      tone="primary"
      title={t("adjustTitle")}
      description={t("adjustDescription")}
      confirmLabel={t("adjust")}
      onClose={onClose}
      onDone={onDone}
      onSubmit={async (reason) => {
        setAmountError(undefined);
        const toman = parseWhole(amount);
        if (toman === null || !Number.isInteger(toman) || toman <= 0) {
          setAmountError(t("invalidAmount"));
          throw new ApiError(400, {
            code: "validation.failed",
            errors: { amount: ["validation.out_of_range"] },
          });
        }
        try {
          return await admin<WalletInfo>(
            `/workspaces/${workspaceId}/wallet/adjustments`,
            {
              method: "POST",
              body: {
                amount: (direction === "add" ? 1 : -1) * toman * 10,
                reason,
              },
            },
          );
        } catch (error) {
          if (error instanceof ApiError && error.fieldErrors.amount)
            setAmountError(fieldError(error.fieldErrors.amount));
          throw error;
        }
      }}
    >
      <p className="text-sm">
        {t("balance")}: {formatToman(balanceRial)}
      </p>
      <fieldset className="flex gap-4 text-sm">
        <legend className="mb-1.5 font-medium">{t("direction")}</legend>
        {(["add", "subtract"] as const).map((d) => (
          <label key={d} className="flex items-center gap-2">
            <input
              type="radio"
              name="wallet-direction"
              className="size-4 accent-primary"
              checked={direction === d}
              onChange={() => setDirection(d)}
            />
            {t(d)}
          </label>
        ))}
      </fieldset>
      <Field label={t("amount")} error={amountError}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            inputMode="numeric"
            dir="ltr"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-describedby={describedBy}
            aria-invalid={invalid}
          />
        )}
      </Field>
    </ReasonDialog>
  );
}
