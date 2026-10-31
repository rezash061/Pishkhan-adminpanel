import type { AuditEntry, Lead } from "@/lib/api/types";

// Fake data only (overview section 8.7): fake workspaces, documentation IP ranges.
const actors = [
  { type: "staff", id: "01938f5e-0000-7000-8000-000000000001", name: "superadmin" },
  { type: "staff", id: "01938f5e-0000-7000-8000-000000000002", name: "support" },
  { type: "user", id: "01938f60-0000-7000-8000-00000000a001", name: "0912***0001" },
  { type: "system", id: null, name: "system" },
] as const;

const events: Array<Pick<AuditEntry, "action" | "entityType" | "reason"> & { before?: unknown; after?: unknown }> = [
  { action: "staff.login", entityType: "staff_session", reason: null },
  { action: "staff.create", entityType: "staff", reason: "عضو جدید تیم پشتیبانی", after: { username: "support2", roles: ["Support"] } },
  { action: "workspace.impersonate", entityType: "workspace", reason: "بررسی مشکل اتصال اینستاگرام طبق تیکت ۴۲" },
  { action: "workspace.suspend", entityType: "workspace", reason: "گزارش کلاهبرداری", before: { status: "active" }, after: { status: "suspended" } },
  { action: "channel.reauth_required", entityType: "channel_account", reason: null, before: { status: "connected" }, after: { status: "reauth_required" } },
  { action: "file.quarantined", entityType: "file", reason: null, after: { status: "infected", signature: "Eicar-Test-Signature" } },
  { action: "plan.update", entityType: "plan", reason: "افزایش سقف پیام پلن پایه", before: { messagesPerMonth: 1000 }, after: { messagesPerMonth: 1500 } },
];

const workspaces = ["01938f61-0000-7000-8000-00000000b001", "01938f61-0000-7000-8000-00000000b002", null];

export const auditFixtures: AuditEntry[] = Array.from({ length: 64 }, (_, i) => {
  const actor = actors[i % actors.length]!;
  const event = events[i % events.length]!;
  return {
    id: `01938f70-0000-7000-8000-${String(i + 1).padStart(12, "0")}`,
    occurredAt: new Date(Date.UTC(2026, 9, 28, 12, 0) - i * 47 * 60_000).toISOString(),
    actorType: actor.type,
    actorId: actor.id,
    actorName: actor.name,
    onBehalfOf: null,
    workspaceId: event.entityType === "staff" || event.entityType === "staff_session" ? null : (workspaces[i % workspaces.length] ?? null),
    action: event.action,
    entityType: event.entityType,
    entityId: `01938f80-0000-7000-8000-${String(i + 1).padStart(12, "0")}`,
    reason: event.reason,
    ip: actor.type === "system" ? null : `192.0.2.${(i % 200) + 1}`,
    before: event.before ?? null,
    after: event.after ?? null,
  };
});

const verticals = ["پوشاک", "آرایشی", "طلا و جواهر", "کلینیک زیبایی", "آموزش"];
const dms = ["کمتر از ۱۰۰", "۱۰۰ تا ۵۰۰", "۵۰۰ تا ۲۰۰۰", "بیش از ۲۰۰۰"];

export const leadFixtures: Lead[] = Array.from({ length: 37 }, (_, i) => {
  const waitlist = i % 3 !== 2;
  const at = new Date(Date.UTC(2026, 9, 30, 18, 0) - i * 3 * 3_600_000).toISOString();
  return {
    id: `01938f90-0000-7000-8000-${String(i + 1).padStart(12, "0")}`,
    type: waitlist ? "waitlist" : "contact",
    phone: `0912000${String(1000 + i).slice(-4)}`,
    name: i % 4 === 0 ? null : `فروشگاه نمونه ${i + 1}`,
    instagramHandle: waitlist ? `sample_shop_${i + 1}` : null,
    vertical: waitlist ? (verticals[i % verticals.length] ?? null) : null,
    monthlyDms: waitlist ? (dms[i % dms.length] ?? null) : null,
    message: waitlist ? null : "سلام، برای فروشگاه‌مان دمو می‌خواهیم. لطفاً تماس بگیرید.",
    utm: i % 2 === 0 ? { utm_source: "instagram", utm_campaign: "launch" } : ({} as Record<string, string>),
    submissions: i % 5 === 0 ? 2 : 1,
    createdAt: at,
    updatedAt: at,
  };
});
