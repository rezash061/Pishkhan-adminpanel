import { beforeEach, describe, expect, it } from "vitest";
import type { AdminAnnouncement, AdminTicketDetail, MessagingOverview, PagedResult, SmsLogItem, AdminTicket } from "@/lib/api/types";
import { handleMockRequest, resetMockState } from "./admin-api";

const call = (method: string, path: string, body?: unknown, token?: string) =>
  handleMockRequest(
    new Request(`http://mock.invalid${path}`, {
      method,
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? null : JSON.stringify(body),
    }),
  );
const login = async (username: string) =>
  (await (await call("POST", "/admin/v1/auth/login", { username, password: "Pishkhan-admin-1234", totpCode: "123456" })).json()).accessToken as string;
const stepUp = async (token: string) =>
  (await (await call("POST", "/admin/v1/auth/step-up", { password: "Pishkhan-admin-1234", totpCode: "123456" }, token)).json()).accessToken as string;

// Keeps the mock honest about /admin/v1/support/tickets, /announcements and /platform/messaging (AD-2.4, AD-2.6).
describe("mock support tickets and announcements", () => {
  beforeEach(() => resetMockState());

  it("lets Support answer a ticket (taking it) and ReadOnly only read; Finance sees nothing", async () => {
    const support = await login("support");
    expect((await call("GET", "/admin/v1/support/tickets", undefined, await login("finance"))).status).toBe(403);
    const open: PagedResult<AdminTicket> = await (await call("GET", "/admin/v1/support/tickets?status=open&assigned=none", undefined, support)).json();
    expect(open.items.length).toBeGreaterThan(0);
    const ticket = open.items[0]!;
    const readOnly = await login("readonly");
    expect((await call("GET", `/admin/v1/support/tickets/${ticket.id}`, undefined, readOnly)).status).toBe(200);
    expect((await call("POST", `/admin/v1/support/tickets/${ticket.id}/messages`, { body: "سلام" }, readOnly)).status).toBe(403);

    expect((await call("POST", `/admin/v1/support/tickets/${ticket.id}/messages`, { body: " " }, support)).status).toBe(400);
    const answered: AdminTicketDetail = await (await call("POST", `/admin/v1/support/tickets/${ticket.id}/messages`, { body: "درست شد." }, support)).json();
    expect(answered.ticket).toMatchObject({ status: "answered", assignedToName: "support", lastMessageBy: "staff" });
    expect(answered.messages.at(-1)).toMatchObject({ authorKind: "staff", body: "درست شد." });
    const counts = await (await call("GET", "/admin/v1/support/tickets/counts", undefined, support)).json();
    expect(counts.mine).toBeGreaterThan(0);

    const closed: AdminTicket = await (await call("POST", `/admin/v1/support/tickets/${ticket.id}/close`, {}, support)).json();
    expect(closed.status).toBe("closed");
    const byNumber: PagedResult<AdminTicket> = await (await call("GET", `/admin/v1/support/tickets?q=${ticket.number}`, undefined, support)).json();
    expect(byNumber.items.map((t) => t.id)).toEqual([ticket.id]);
  });

  it("validates announcements and ends them", async () => {
    const support = await login("support");
    expect((await call("POST", "/admin/v1/announcements", { title: "x", severity: "loud" }, support)).status).toBe(400);
    expect((await call("POST", "/admin/v1/announcements", { title: "x", severity: "info", link: "javascript:alert(1)" }, support)).status).toBe(400);
    const created = await call("POST", "/admin/v1/announcements", { title: "به‌روزرسانی", body: null, severity: "warning", link: "/billing", startsAt: null, endsAt: null }, support);
    expect(created.status).toBe(201);
    const a: AdminAnnouncement = await created.json();
    expect(a.state).toBe("active");
    const ended: AdminAnnouncement = await (await call("POST", `/admin/v1/announcements/${a.id}/end`, {}, support)).json();
    expect(ended.state).toBe("ended");
    expect((await call("DELETE", `/admin/v1/announcements/${a.id}`, undefined, support)).status).toBe(204);
  });

  it("serves the SMS log by phone and a test SMS only to SuperAdmin with step-up", async () => {
    const support = await login("support");
    const overview: MessagingOverview = await (await call("GET", "/admin/v1/platform/messaging", undefined, support)).json();
    expect(overview.sms.provider.provider).toBe("kavenegar");
    const byPhone: PagedResult<SmsLogItem> = await (await call("GET", "/admin/v1/platform/sms/log?phone=09120001000", undefined, support)).json();
    expect(byPhone.totalCount).toBe(1);
    expect(byPhone.items[0]!.phone).toBe("+98912***1000");
    expect(byPhone.items[0]).not.toHaveProperty("e164");
    expect((await call("GET", "/admin/v1/platform/sms/log?phone=12", undefined, support)).status).toBe(400);

    expect((await call("POST", "/admin/v1/platform/sms/test", { phone: "09121112233" }, support)).status).toBe(403);
    const admin = await login("superadmin");
    expect((await call("POST", "/admin/v1/platform/sms/test", { phone: "09121112233" }, admin)).status).toBe(403);
    const sent = await call("POST", "/admin/v1/platform/sms/test", { phone: "09121112233" }, await stepUp(admin));
    expect(sent.status).toBe(200);
    expect((await sent.json()).purpose).toBe("test");
  });
});
