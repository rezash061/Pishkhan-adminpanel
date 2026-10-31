import type { Plan, AdminUserDetail, AdminWorkspaceChannel, AdminWorkspaceDetail, AuditEntry, Lead } from "@/lib/api/types";

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

const shopNames = ["بوتیک نیلوفر", "آرایشی مهتاب", "گالری طلای آفتاب", "کلینیک پوست رز", "آموزشگاه هنر نو", "پوشاک سپید", "عطر و ادکلن بهار", "جواهری الماس"];
const industries = ["clothing", "cosmetics", "jewelry", "beauty_clinic", "courses", "clothing", "cosmetics", "jewelry"];
const channelStates = ["active", "active", "token_expiring", "reauth_required", "active", "disconnected"];

/** 30 fake workspaces. The first one (…b001) is active with an Instagram account and three members. */
export const workspaceFixtures: AdminWorkspaceDetail[] = Array.from({ length: 30 }, (_, i) => {
  const n = i + 1;
  const id = `01938f61-0000-7000-8000-00000000b${String(n).padStart(3, "0")}`;
  const createdAt = new Date(Date.UTC(2026, 9, 30, 9, 0) - i * 26 * 3_600_000).toISOString();
  const status = n % 10 === 0 ? "pending_deletion" : n % 13 === 0 ? "deleted" : n % 11 === 0 ? "suspended" : "active";
  const ownerId = `01938f60-0000-7000-8000-00000000a${String(n).padStart(3, "0")}`;
  const phone = `0912***${String(n).padStart(4, "0")}`;
  const members = [
    { userId: ownerId, displayName: `مالک ${n}`, maskedPhone: phone, role: "owner", joinedAt: createdAt },
    ...(n % 2 === 1
      ? [
          { userId: `01938f60-0000-7000-8000-00000000c${String(n).padStart(3, "0")}`, displayName: `همکار ${n}`, maskedPhone: `0935***${String(n).padStart(4, "0")}`, role: "agent", joinedAt: createdAt },
          { userId: `01938f60-0000-7000-8000-00000000d${String(n).padStart(3, "0")}`, displayName: null, maskedPhone: `0901***${String(n).padStart(4, "0")}`, role: "admin", joinedAt: createdAt },
        ]
      : []),
  ];
  const channels: AdminWorkspaceChannel[] =
    n % 4 === 0
      ? []
      : [
          {
            id: `01938f62-0000-7000-8000-00000000e${String(n).padStart(3, "0")}`,
            kind: "instagram",
            username: `shop_${n}`,
            status: channelStates[i % channelStates.length] ?? "active",
            statusReason: (channelStates[i % channelStates.length] ?? "") === "reauth_required" ? "token_revoked" : null,
            statusChangedAt: createdAt,
            tokenExpiresAt: new Date(Date.parse(createdAt) + 60 * 86_400_000).toISOString(),
            connectedAt: createdAt,
          },
        ];
  return {
    id,
    name: `${shopNames[i % shopNames.length] ?? "فروشگاه"} ${n}`,
    slug: `shop-${n}`,
    industry: industries[i % industries.length] ?? "other",
    timeZone: "Asia/Tehran",
    status,
    planId: null,
    createdAt,
    deletionRequestedAt: status === "pending_deletion" ? createdAt : null,
    deletionScheduledFor: status === "pending_deletion" ? new Date(Date.parse(createdAt) + 30 * 86_400_000).toISOString() : null,
    deletedAt: status === "deleted" ? createdAt : null,
    owner: { id: ownerId, displayName: `مالک ${n}`, maskedPhone: phone },
    members,
    channels,
    pendingInvitations: n % 3 === 0 ? 1 : 0,
  };
});

/** Unmasked owner phones the mock search matches (0912000NNNN). */
export const workspaceOwnerPhones: Record<string, string> = Object.fromEntries(
  workspaceFixtures.map((w, i) => [w.id, `0912000${String(i + 1).padStart(4, "0")}`]),
);

/** Panel users behind the workspace fixtures, with their unmasked phones for the mock search. */
export const userFixtures: (AdminUserDetail & { phone: string })[] = (() => {
  const users = new Map<string, AdminUserDetail & { phone: string }>();
  workspaceFixtures.forEach((w, i) => {
    for (const m of w.members) {
      const prefix = m.maskedPhone?.slice(0, 4) ?? "0912";
      const phone = `${prefix}000${String(i + 1).padStart(4, "0")}`;
      const user = users.get(m.userId) ?? {
        id: m.userId,
        displayName: m.displayName,
        maskedPhone: m.maskedPhone ?? "",
        phone,
        status: m.userId.endsWith("d011") ? "suspended" : "active",
        totpEnabled: i % 3 === 0,
        hasPassword: m.role === "owner",
        createdAt: m.joinedAt,
        lastLoginAt: m.role === "admin" ? null : m.joinedAt,
        workspaces: [],
        sessions:
          m.role === "admin"
            ? []
            : Array.from({ length: m.role === "owner" ? 2 : 1 }, (_, k) => ({
                id: `01938f63-0000-7000-8000-${m.userId.slice(-4)}0000000${k}`,
                createdAt: m.joinedAt,
                lastUsedAt: new Date(Date.parse(m.joinedAt) + (k + 1) * 3_600_000).toISOString(),
                expiresAt: new Date(Date.parse(m.joinedAt) + 30 * 86_400_000).toISOString(),
                ip: k === 0 ? "203.0.113.10" : "198.51.100.24",
                userAgent: k === 0 ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1" : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0",
                authMethods: i % 3 === 0 ? "otp+totp" : "otp",
              })),
      };
      user.workspaces.push({ workspaceId: w.id, workspaceName: w.name, workspaceStatus: w.status, role: m.role, joinedAt: m.joinedAt });
      users.set(m.userId, user);
    }
  });
  return [...users.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
})();

const planBase = (code: string, version: number, status: string, over: Partial<Plan>): Plan => ({
  id: `01938f64-0000-7000-8000-${code.padEnd(8, "0").slice(0, 8).replace(/[^0-9a-f]/g, "0")}000${version}`,
  code,
  version,
  status,
  name: code,
  tagline: null,
  description: null,
  monthly: { amount: 0, currency: "IRR" },
  annual: null,
  overagePerConversation: null,
  limits: {},
  features: [],
  isPublic: true,
  isFree: false,
  highlighted: false,
  sortOrder: 0,
  createdAt: "2026-10-01T08:00:00Z",
  updatedAt: "2026-10-01T08:00:00Z",
  publishedAt: status === "draft" ? null : "2026-10-01T09:00:00Z",
  ...over,
});

/** Fake plans: free; basic (v1 archived, v2 on sale); pro (v1 on sale, v2 draft); a private enterprise draft. */
export const planFixtures: Plan[] = [
  planBase("free", 1, "published", { name: "رایگان", isFree: true, sortOrder: 0, limits: { ai_conversations: 50, channel_accounts: 1, seats: 1 }, features: [{ key: "inbox", label: "صندوق پیام یکپارچه", included: true, limit: null }] }),
  planBase("basic", 1, "archived", { name: "پایه", sortOrder: 1, monthly: { amount: 2_490_000, currency: "IRR" }, limits: { ai_conversations: 400, channel_accounts: 1, seats: 2 } }),
  planBase("basic", 2, "published", {
    name: "پایه",
    tagline: "برای فروشگاه‌های تازه‌کار",
    sortOrder: 1,
    monthly: { amount: 2_990_000, currency: "IRR" },
    annual: { amount: 29_900_000, currency: "IRR" },
    limits: { ai_conversations: 500, channel_accounts: 1, seats: 3, receipt_verifications: 100 },
    features: [
      { key: "ai", label: "پاسخ خودکار هوش مصنوعی", included: true, limit: "۵۰۰ گفتگو" },
      { key: "receipts", label: "بررسی رسید کارت‌به‌کارت", included: true, limit: "۱۰۰ رسید" },
    ],
    publishedAt: "2026-10-20T09:00:00Z",
    updatedAt: "2026-10-20T09:00:00Z",
  }),
  planBase("pro", 1, "published", { name: "حرفه‌ای", highlighted: true, sortOrder: 2, monthly: { amount: 6_990_000, currency: "IRR" }, overagePerConversation: { amount: 15_000, currency: "IRR" }, limits: { ai_conversations: 2000, seats: 10 } }),
  planBase("pro", 2, "draft", { name: "حرفه‌ای", highlighted: true, sortOrder: 2, monthly: { amount: 7_490_000, currency: "IRR" }, overagePerConversation: { amount: 15_000, currency: "IRR" }, limits: { ai_conversations: 2500, seats: 10 }, updatedAt: "2026-10-30T10:00:00Z" }),
  planBase("enterprise", 1, "draft", { name: "سازمانی", isPublic: false, sortOrder: 3, monthly: { amount: 25_000_000, currency: "IRR" } }),
];
