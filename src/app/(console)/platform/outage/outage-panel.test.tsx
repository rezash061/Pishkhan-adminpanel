import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StaffProvider } from "@/components/console/staff-context";
import { StepUpProvider } from "@/components/console/step-up";
import type { AdminOutage } from "@/lib/api/types";
import messages from "@/messages/fa.json";
import { OutageHomeAlert, OutagePanel } from "./outage-panel";
import { detectorSaysDown, failureShare } from "./outage-values";

const base: AdminOutage = { kind: "instagram", status: "up", mode: "auto", since: new Date(Date.now() - 5 * 60_000).toISOString(), modeReason: null, ok: 30, failed: 10, windowMinutes: 5 };

function setup(outage: AdminOutage, roles: string[], ui: "panel" | "home" = "panel") {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => Response.json(init?.method === "PUT" ? { ...outage, ...JSON.parse(String(init.body)), status: "down" } : outage));
  vi.stubGlobal("fetch", fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <NextIntlClientProvider locale="fa" messages={messages}>
      <QueryClientProvider client={client}>
        <StaffProvider staff={{ id: "s", username: "u", roles }}>
          <StepUpProvider>{ui === "panel" ? <OutagePanel /> : <OutageHomeAlert />}</StepUpProvider>
        </StaffProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
  return fetchMock;
}

describe("outage values", () => {
  it("computes the failure share and the detector's down rule", () => {
    expect(failureShare({ ok: 30, failed: 10 })).toBe(0.25);
    expect(failureShare({ ok: 0, failed: 0 })).toBeNull();
    expect(detectorSaysDown({ ok: 20, failed: 20 })).toBe(true);
    expect(detectorSaysDown({ ok: 0, failed: 19 })).toBe(false);
    expect(detectorSaysDown({ ok: 30, failed: 25 })).toBe(false);
  });
});

describe("OutagePanel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows status, mode, counts with the failure share, and the reason", async () => {
    setup({ ...base, status: "down", mode: "forced_down", modeReason: "فیلترینگ گسترده" }, ["ReadOnly"]);
    const status = await screen.findByTestId("outage-status");
    expect(status.textContent).toContain("اینستاگرام قطع است");
    expect(status.textContent).toContain("۵ دقیقه پیش");
    expect(status.className).toContain("border-danger");
    expect(screen.getByTestId("outage-counts").textContent).toBe("موفق۳۰ناموفق۱۰سهم خطا۲۵٪");
    expect(screen.getByText("فیلترینگ گسترده")).toBeTruthy();
    expect(screen.getAllByText("اعلام قطعی دستی").length).toBeGreaterThan(0);
    // ReadOnly cannot change the mode.
    expect(screen.getByText("فقط پشتیبانی و مدیر کل می‌توانند حالت را تغییر دهند.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "اعمال حالت" })).toBeNull();
  });

  it("requires a reason of at least 5 characters, then sends the chosen mode", async () => {
    const fetchMock = setup(base, ["Support"]);
    await userEvent.click(await screen.findByRole("radio", { name: /اعلام قطعی دستی/ }));
    expect(screen.getByText(/به همهٔ فضاهای کاری که حساب اینستاگرام دارند اعلان فرستاده می‌شود/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "اعمال حالت" }));
    expect(await screen.findByText("این فیلد الزامی است.")).toBeTruthy();
    await userEvent.type(screen.getByLabelText("دلیل"), "کم");
    await userEvent.click(screen.getByRole("button", { name: "اعمال حالت" }));
    expect(await screen.findByText("این مقدار کوتاه است.")).toBeTruthy();
    await userEvent.type(screen.getByLabelText("دلیل"), " نیست، فیلترینگ است");
    await userEvent.click(screen.getByRole("button", { name: "اعمال حالت" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(true));
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT")!;
    expect(put[0]).toBe("/api/bff/platform/outage");
    expect(JSON.parse(String(put[1]!.body))).toEqual({ mode: "forced_down", reason: "کم نیست، فیلترینگ است" });
    expect(await screen.findByText(/حالت «اعلام قطعی دستی» اعمال شد/)).toBeTruthy();
  });

  it("puts a red alert on the home page only while Instagram is down", async () => {
    setup({ ...base, status: "down" }, ["Finance"], "home");
    const alert = await screen.findByTestId("outage-home-alert");
    expect(alert.getAttribute("role")).toBe("alert");
    expect(alert.textContent).toContain("اینستاگرام از ۵ دقیقه پیش قطع اعلام شده است");
  });
});
