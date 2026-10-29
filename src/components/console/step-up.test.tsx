import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/fa.json";
import { ApiError } from "@/lib/problem";
import { StepUpCancelled, StepUpProvider, useStepUp } from "./step-up";

function Harness({ action, onResult }: { action: () => Promise<string>; onResult: (r: unknown) => void }) {
  const withStepUp = useStepUp();
  return (
    <button type="button" onClick={() => withStepUp(action).then(onResult, onResult)}>
      run
    </button>
  );
}

function setup(action: () => Promise<string>) {
  const onResult = vi.fn();
  render(
    <NextIntlClientProvider locale="fa" messages={messages}>
      <StepUpProvider>
        <Harness action={action} onResult={onResult} />
      </StepUpProvider>
    </NextIntlClientProvider>,
  );
  return onResult;
}

const stepUpRequired = () => new ApiError(403, { title: "auth.step_up.required", code: "auth.step_up.required", status: 403 });

describe("useStepUp", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks for re-authentication on step_up.required and retries once", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ expiresAt: "2026-10-29T12:00:00Z" }));
    vi.stubGlobal("fetch", fetchMock);
    const action = vi.fn().mockRejectedValueOnce(stepUpRequired()).mockResolvedValueOnce("done");
    const onResult = setup(action);

    await userEvent.click(screen.getByText("run"));
    await userEvent.type(await screen.findByLabelText("رمز عبور"), "Pishkhan-admin-1234");
    await userEvent.type(screen.getByLabelText("کد دومرحله‌ای"), "۱۲۳۴۵۶");
    await userEvent.click(screen.getByRole("button", { name: "تأیید و ادامه" }));

    await waitFor(() => expect(onResult).toHaveBeenCalledWith("done"));
    expect(action).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/auth/step-up");
    expect(JSON.parse(init.body)).toEqual({ password: "Pishkhan-admin-1234", totpCode: "123456" });
  });

  it("rejects with StepUpCancelled when the dialog is dismissed", async () => {
    const onResult = setup(vi.fn().mockRejectedValue(stepUpRequired()));
    await userEvent.click(screen.getByText("run"));
    await userEvent.click(await screen.findByRole("button", { name: "انصراف" }));
    await waitFor(() => expect(onResult.mock.calls[0]?.[0]).toBeInstanceOf(StepUpCancelled));
  });

  it("passes other errors through without a dialog", async () => {
    const error = new ApiError(409, { code: "backoffice.staff.username_taken" });
    const onResult = setup(vi.fn().mockRejectedValue(error));
    await userEvent.click(screen.getByText("run"));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(error));
    expect(screen.queryByLabelText("رمز عبور")).toBeNull();
  });
});
