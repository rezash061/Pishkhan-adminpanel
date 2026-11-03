import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { TemplateContent, TemplateRequest } from "@/lib/api/types";
import messages from "@/messages/fa.json";
import clothing from "@/mocks/template-seeds/clothing.json";
import { TemplateForm } from "./template-form";
import { IssueChecklist } from "./template-issues";

const wrap = (ui: ReactNode) => render(<NextIntlClientProvider locale="fa" messages={messages}>{ui}</NextIntlClientProvider>);
const seed = { name: clothing.name, description: clothing.description, content: clothing.content as TemplateContent };

describe("IssueChecklist", () => {
  it("says the draft is ready when there are no issues", () => {
    wrap(<IssueChecklist issues={[]} />);
    expect(screen.getByText("ایرادی نیست؛ این پیش‌نویس آمادهٔ انتشار است.")).toBeTruthy();
  });

  it("explains each issue in Persian, grouped by section, with the raw issue kept", () => {
    wrap(
      <IssueChecklist
        issues={[
          "rules[fabric-keyword]: template.flow_key_unknown",
          "faqs[gift-wrap].answer: validation.text.length",
          "agentProfile.tone: templates.tone_invalid",
          "flows[size-help]: flow.start_missing",
          "rules[x]: automation.keywords_required",
          "rules[y]: template.workspace_reference",
          "faqs: templates.too_many",
          "flows[z]: flow.brand_new_code",
        ]}
      />,
    );
    expect(screen.getByText("۸ ایراد باید پیش از انتشار رفع شود.")).toBeTruthy();

    const faqs = screen.getByRole("region", { name: "پرسش‌های رایج" });
    expect(within(faqs).getByText("این متن خالی است یا از حد مجاز طولانی‌تر است.")).toBeTruthy();
    expect(within(faqs).getByText(/تعداد موارد این بخش بیش از حد مجاز است/)).toBeTruthy();
    expect(within(faqs).getByText("gift-wrap", { selector: "bdi" }).getAttribute("dir")).toBe("ltr");

    const rules = screen.getByRole("region", { name: "قانون‌ها" });
    expect(within(rules).getByText(/فلویی را با flowKey نام برده/)).toBeTruthy();
    expect(within(rules).getByText("این شروع‌کننده دست‌کم یک واژه لازم دارد.")).toBeTruthy();
    expect(within(rules).getByText(/فقط داخل یک فضای کاری وجود دارد/)).toBeTruthy();
    expect(within(rules).getByText("rules[fabric-keyword]: template.flow_key_unknown")).toBeTruthy();

    expect(within(screen.getByRole("region", { name: "پروفایل دستیار" })).getByText(/لحن باید یکی از friendly/)).toBeTruthy();
    const flows = screen.getByRole("region", { name: "فلوها" });
    expect(within(flows).getByText(/گره شروع \(start\) مشخص نیست/)).toBeTruthy();
    // An unknown code still shows, by its key.
    expect(within(flows).getByText("کد ایراد: flow.brand_new_code")).toBeTruthy();
  });
});

describe("TemplateForm", () => {
  it("shows the built-in template as forms plus a summary of its flows and rules", () => {
    wrap(<TemplateForm initial={seed} submitLabel="ذخیره" readOnly />);
    expect((screen.getByLabelText("نام قالب") as HTMLInputElement).value).toBe("پوشاک و کیف و کفش");
    expect(screen.getAllByLabelText("پرسش")).toHaveLength(8);
    expect((screen.getByLabelText("لحن") as HTMLInputElement).value).toBe("friendly");
    expect((screen.getByLabelText("واژه‌های واگذاری به کارشناس") as HTMLInputElement).value).toBe("شکایت\nمرجوعی\nپس بدم\nخراب");
    expect(screen.getByText("راهنمای انتخاب سایز")).toBeTruthy();
    expect(screen.getByText("۴ گره")).toBeTruthy();
    expect(screen.getByText("کامنت «قیمت» → جواب در دایرکت")).toBeTruthy();
    expect(screen.getAllByText("واژه در دایرکت")).toHaveLength(2);
    expect(screen.getByLabelText("فلوها (JSON)").getAttribute("dir")).toBe("ltr");
    expect(screen.queryByRole("button", { name: "ذخیره" })).toBeNull();
  });

  it("marks the items the server found issues in", () => {
    wrap(<TemplateForm initial={seed} issues={["faqs[shipping-cost].answer: validation.text.length"]} submitLabel="ذخیره" />);
    expect(screen.getByText(/پاسخ: این متن خالی است/)).toBeTruthy();
  });

  it("sends the edited template and refuses broken JSON before calling the server", async () => {
    const onSubmit = vi.fn<(r: TemplateRequest) => Promise<unknown>>().mockResolvedValue(undefined);
    wrap(<TemplateForm initial={seed} submitLabel="ذخیره" onSubmit={onSubmit} />);

    const rules = screen.getByLabelText("قانون‌ها (JSON)");
    await userEvent.clear(rules);
    await userEvent.click(rules);
    await userEvent.paste("[{");
    expect(screen.getByText("تا JSON درست نشود، خلاصه نمایش داده نمی‌شود.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "ذخیره" }));
    expect((await screen.findByRole("alert")).textContent).toContain("JSON نادرست است");
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.clear(rules);
    await userEvent.paste("[]");
    await userEvent.selectOptions(screen.getByLabelText("لحن"), "formal");
    await userEvent.click(screen.getByRole("button", { name: "حذف پرسش ۱" }));
    await userEvent.click(screen.getByRole("button", { name: "ذخیره" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const sent = onSubmit.mock.calls[0]![0];
    expect(sent.content.rules).toEqual([]);
    expect(sent.content.agentProfile?.tone).toBe("formal");
    expect(sent.content.faqs).toHaveLength(7);
    expect(sent.content.faqs[0]!.key).toBe("shipping-time");
    expect(sent.content.flows).toEqual(seed.content.flows);
  });

  it("checks item keys before saving", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    wrap(<TemplateForm initial={seed} submitLabel="ذخیره" onSubmit={onSubmit} />);
    const keys = screen.getAllByLabelText("کلید");
    await userEvent.clear(keys[0]!);
    await userEvent.type(keys[0]!, "Shipping Cost");
    await userEvent.clear(keys[1]!);
    await userEvent.type(keys[1]!, "payment_methods");
    await userEvent.click(screen.getByRole("button", { name: "ذخیره" }));
    expect(await screen.findByText(/کلید باید ۲ تا ۱۰۰ نویسه/)).toBeTruthy();
    expect(screen.getAllByText("این کلید در همین بخش تکراری است.").length).toBeGreaterThan(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
