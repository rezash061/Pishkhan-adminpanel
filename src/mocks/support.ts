// Mock state and handler for /admin/v1/support/tickets and /admin/v1/announcements (backend support tickets, AD-2.6). Used by src/mocks/admin-api.ts.

import type { AdminAnnouncement, AdminTicket, AdminTicketMessage, AnnouncementRequest } from "@/lib/api/types";
import { workspaceFixtures } from "./fixtures";

const READERS = ["SuperAdmin", "Support", "ReadOnly"];
const WRITERS = ["SuperAdmin", "Support"];
const STATUSES = ["open", "answered", "closed"];
const CATEGORIES = ["billing", "technical", "instagram", "ai", "other"];
const SEVERITIES = ["info", "warning", "critical"];
const HOUR = 3_600_000;

export interface SupportMockState {
  tickets: AdminTicket[];
  messages: Record<string, AdminTicketMessage[]>;
  announcements: AdminAnnouncement[];
}

export interface SupportCaller {
  id: string;
  username: string;
  roles: string[];
}

type Problem = (status: number, code: string, errors?: Record<string, string[]>) => Response;

const SUBJECTS: [string, string, string][] = [
  ["پرداخت اشتراک انجام شد ولی فعال نشد", "billing", "مبلغ از حسابم کم شد ولی هنوز طرح رایگان نشان می‌دهد."],
  ["پاسخ خودکار به کامنت‌ها کار نمی‌کند", "instagram", "از دیروز به کامنت‌های پست جدید جواب نمی‌دهد."],
  ["هوش مصنوعی قیمت اشتباه می‌گوید", "ai", "قیمت مانتو را قدیمی می‌گوید با اینکه کاتالوگ را به‌روز کرده‌ام."],
  ["ورود همکار با خطا روبه‌رو می‌شود", "technical", "همکارم کد ورود را می‌زند ولی خطا می‌گیرد."],
  ["فاکتور رسمی می‌خواهم", "billing", "برای خرید سالانه فاکتور رسمی با کد اقتصادی لازم دارم."],
  ["اتصال اینستاگرام قطع شد", "instagram", "پیام آمده که دوباره وصل کنید ولی دکمه کار نمی‌کند."],
  ["پیشنهاد: گزارش هفتگی", "other", "اگر گزارش فروش هفتگی پیامک شود عالی است."],
  ["پیام‌ها دیر می‌رسند", "technical", "گاهی پیام مشتری چند دقیقه بعد در صندوق دیده می‌شود."],
];

export function seedSupport(): SupportMockState {
  const now = Date.now();
  const tickets: AdminTicket[] = [];
  const messages: Record<string, AdminTicketMessage[]> = {};
  SUBJECTS.forEach(([subject, category, body], i) => {
    const ws = workspaceFixtures[i % 6]!;
    const owner = ws.members[0]!;
    const id = `01938f90-0000-7000-8000-${String(i + 1).padStart(12, "0")}`;
    const created = new Date(now - (i * 7 + 2) * HOUR).toISOString();
    const status = i === 1 || i === 4 ? "answered" : i === 6 ? "closed" : "open";
    const thread: AdminTicketMessage[] = [{ id: `${id}-m1`, authorKind: "seller", authorId: owner.userId, authorName: owner.displayName, body, createdAt: created }];
    if (status !== "open") {
      thread.push({ id: `${id}-m2`, authorKind: "staff", authorId: "01938f5e-0000-7000-8000-000000000002", authorName: "support", body: "سلام، بررسی کردیم و درست شد. لطفاً دوباره امتحان کنید.", createdAt: new Date(Date.parse(created) + HOUR).toISOString() });
    }
    messages[id] = thread;
    const last = thread[thread.length - 1]!;
    tickets.push({
      id,
      number: 1001 + i,
      workspaceId: ws.id,
      workspaceName: ws.name,
      subject,
      category,
      status,
      lastMessageBy: last.authorKind,
      messageCount: thread.length,
      assignedTo: status === "open" && i !== 0 && i !== 3 ? null : "01938f5e-0000-7000-8000-000000000002",
      assignedToName: status === "open" && i !== 0 && i !== 3 ? null : "support",
      createdBy: owner.userId,
      lastMessageAt: last.createdAt,
      createdAt: created,
      closedAt: status === "closed" ? last.createdAt : null,
    });
  });
  const iso = (offset: number) => new Date(now + offset).toISOString();
  const announcements: AdminAnnouncement[] = [
    { id: "01938f91-0000-7000-8000-000000000001", title: "به‌روزرسانی شبانه پنل", body: "پنل امشب از ساعت ۲ تا ۳ بامداد چند دقیقه در دسترس نیست.", severity: "warning", link: null, startsAt: iso(-2 * HOUR), endsAt: iso(20 * HOUR), state: "active", createdBy: "01938f5e-0000-7000-8000-000000000002", createdAt: iso(-3 * HOUR), updatedAt: iso(-3 * HOUR) },
    { id: "01938f91-0000-7000-8000-000000000002", title: "تخفیف نوروزی طرح‌های سالانه", body: "۲۰٪ تخفیف خرید سالانه تا پایان فروردین.", severity: "info", link: "/billing", startsAt: iso(48 * HOUR), endsAt: null, state: "scheduled", createdBy: "01938f5e-0000-7000-8000-000000000001", createdAt: iso(-HOUR), updatedAt: iso(-HOUR) },
    { id: "01938f91-0000-7000-8000-000000000003", title: "اختلال در اتصال اینستاگرام", body: null, severity: "critical", link: null, startsAt: iso(-72 * HOUR), endsAt: iso(-60 * HOUR), state: "ended", createdBy: "01938f5e-0000-7000-8000-000000000002", createdAt: iso(-72 * HOUR), updatedAt: iso(-60 * HOUR) },
  ];
  return { tickets, messages, announcements };
}

function stateAt(a: Pick<AdminAnnouncement, "startsAt" | "endsAt">, now = Date.now()) {
  return now < Date.parse(a.startsAt) ? "scheduled" : a.endsAt && now >= Date.parse(a.endsAt) ? "ended" : "active";
}

async function body<T>(request: Request): Promise<Partial<T>> {
  try {
    return (await request.json()) as Partial<T>;
  } catch {
    return {};
  }
}

function page<T>(items: T[], url: URL, defaultSize: number) {
  const p = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const size = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? defaultSize) || defaultSize));
  return { items: items.slice((p - 1) * size, p * size), totalCount: items.length, page: p, pageSize: size };
}

function announcementErrors(b: Partial<AnnouncementRequest>, startsAt: string): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  const title = b.title?.trim() ?? "";
  if (!title || title.length > 120) errors.title = ["validation.length"];
  if ((b.body?.trim().length ?? 0) > 1000) errors.body = ["validation.length"];
  if (!SEVERITIES.includes(b.severity ?? "")) errors.severity = ["validation.invalid"];
  const link = b.link?.trim();
  if (link && !((link.startsWith("/") && !link.startsWith("//")) || link.startsWith("https://"))) errors.link = ["validation.invalid"];
  if (b.endsAt && Date.parse(b.endsAt) <= Date.parse(startsAt)) errors.endsAt = ["validation.out_of_range"];
  return errors;
}

export async function handleSupport(request: Request, url: URL, s: SupportMockState, caller: SupportCaller, staffName: (id: string) => string | null, problem: Problem): Promise<Response | null> {
  const path = url.pathname;
  if (!path.startsWith("/admin/v1/support/tickets") && !path.startsWith("/admin/v1/announcements")) return null;
  const canRead = caller.roles.some((r) => READERS.includes(r));
  const canWrite = caller.roles.some((r) => WRITERS.includes(r));
  if (request.method === "GET" ? !canRead : !canWrite) return problem(403, "auth.forbidden");
  const now = Date.now();

  if (path === "/admin/v1/support/tickets/counts" && request.method === "GET") {
    const notClosed = s.tickets.filter((t) => t.status !== "closed");
    const count = (status: string) => s.tickets.filter((t) => t.status === status).length;
    return Response.json({ open: count("open"), answered: count("answered"), closed: count("closed"), unassigned: notClosed.filter((t) => !t.assignedTo).length, mine: notClosed.filter((t) => t.assignedTo === caller.id).length });
  }

  if (path === "/admin/v1/support/tickets" && request.method === "GET") {
    const status = url.searchParams.get("status") ?? "";
    const category = url.searchParams.get("category") ?? "";
    const assigned = url.searchParams.get("assigned") ?? "";
    const workspaceId = url.searchParams.get("workspaceId") ?? "";
    const q = (url.searchParams.get("q") ?? "").trim();
    if (status && !STATUSES.includes(status)) return problem(400, "validation.failed", { status: ["validation.invalid"] });
    if (category && !CATEGORIES.includes(category)) return problem(400, "validation.failed", { category: ["validation.invalid"] });
    if (assigned && assigned !== "me" && assigned !== "none") return problem(400, "validation.failed", { assigned: ["validation.invalid"] });
    const latin = q.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
    const items = s.tickets
      .filter((t) => !status || t.status === status)
      .filter((t) => !category || t.category === category)
      .filter((t) => (assigned === "me" ? t.assignedTo === caller.id : assigned === "none" ? !t.assignedTo : true))
      .filter((t) => !workspaceId || t.workspaceId === workspaceId)
      .filter((t) => !q || t.subject.includes(q) || String(t.number) === latin)
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
    return Response.json(page(items, url, 25));
  }

  const ticketMatch = /^\/admin\/v1\/support\/tickets\/([0-9a-f-]{36})(?:\/(messages|assign|close|reopen))?$/i.exec(path);
  if (ticketMatch) {
    const ticket = s.tickets.find((t) => t.id === ticketMatch[1]);
    if (!ticket) return problem(404, "not_found");
    const action = ticketMatch[2];
    const detail = () => Response.json({ ticket, messages: s.messages[ticket.id] ?? [] });
    if (!action && request.method === "GET") return detail();
    if (request.method !== "POST") return null;
    const at = new Date(now).toISOString();
    if (action === "messages") {
      const b = await body<{ body: string }>(request);
      const text = b.body?.trim() ?? "";
      if (!text || text.length > 4000) return problem(400, "validation.failed", { body: ["validation.length"] });
      (s.messages[ticket.id] ??= []).push({ id: crypto.randomUUID(), authorKind: "staff", authorId: caller.id, authorName: caller.username, body: text, createdAt: at });
      Object.assign(ticket, { status: "answered", closedAt: null, lastMessageAt: at, lastMessageBy: "staff", messageCount: s.messages[ticket.id]!.length });
      if (!ticket.assignedTo) Object.assign(ticket, { assignedTo: caller.id, assignedToName: caller.username });
      return detail();
    }
    if (action === "assign") {
      const b = await body<{ staffId: string | null }>(request);
      const staffId = b.staffId ?? null;
      if (staffId && staffId !== caller.id && !staffName(staffId)) return problem(400, "validation.failed", { staffId: ["validation.not_found"] });
      Object.assign(ticket, { assignedTo: staffId, assignedToName: staffId ? staffName(staffId) : null });
      return Response.json(ticket);
    }
    if (action === "close" && ticket.status !== "closed") Object.assign(ticket, { status: "closed", closedAt: at });
    if (action === "reopen" && ticket.status === "closed") Object.assign(ticket, { status: "open", closedAt: null });
    return Response.json(ticket);
  }

  if (path === "/admin/v1/announcements") {
    if (request.method === "GET") {
      const state = url.searchParams.get("state") ?? "";
      if (state && !["scheduled", "active", "ended"].includes(state)) return problem(400, "validation.failed", { state: ["validation.invalid"] });
      const items = s.announcements
        .map((a) => ({ ...a, state: stateAt(a, now) }))
        .filter((a) => !state || a.state === state)
        .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
      return Response.json(page(items, url, 25));
    }
    if (request.method !== "POST") return null;
    const b = await body<AnnouncementRequest>(request);
    const startsAt = b.startsAt ?? new Date(now).toISOString();
    const errors = announcementErrors(b, startsAt);
    if (Object.keys(errors).length) return problem(400, "validation.failed", errors);
    const at = new Date(now).toISOString();
    const created: AdminAnnouncement = { id: crypto.randomUUID(), title: b.title!.trim(), body: b.body?.trim() || null, severity: b.severity!, link: b.link?.trim() || null, startsAt, endsAt: b.endsAt ?? null, state: "", createdBy: caller.id, createdAt: at, updatedAt: at };
    created.state = stateAt(created, now);
    s.announcements.push(created);
    return Response.json(created, { status: 201 });
  }

  const announcementMatch = /^\/admin\/v1\/announcements\/([0-9a-f-]{36})(\/end)?$/i.exec(path);
  if (announcementMatch) {
    const index = s.announcements.findIndex((a) => a.id === announcementMatch[1]);
    if (index < 0) return problem(404, "not_found");
    const a = s.announcements[index]!;
    const at = new Date(now).toISOString();
    if (announcementMatch[2] && request.method === "POST") {
      if (stateAt(a, now) !== "ended") Object.assign(a, { startsAt: Date.parse(a.startsAt) < now ? a.startsAt : new Date(now - 1000).toISOString(), endsAt: at, updatedAt: at });
      return Response.json({ ...a, state: stateAt(a, now) });
    }
    if (request.method === "DELETE") {
      s.announcements.splice(index, 1);
      return new Response(null, { status: 204 });
    }
    if (request.method === "PUT") {
      const b = await body<AnnouncementRequest>(request);
      const startsAt = b.startsAt ?? a.startsAt;
      const errors = announcementErrors(b, startsAt);
      if (Object.keys(errors).length) return problem(400, "validation.failed", errors);
      Object.assign(a, { title: b.title!.trim(), body: b.body?.trim() || null, severity: b.severity, link: b.link?.trim() || null, startsAt, endsAt: b.endsAt ?? null, updatedAt: at });
      return Response.json({ ...a, state: stateAt(a, now) });
    }
  }
  return null;
}
