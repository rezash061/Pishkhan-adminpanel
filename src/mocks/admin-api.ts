// In-process stand-in for the AdminApi host, used when ADMIN_API_URL=mock (local development without the
// .NET stack, and the Playwright suite). It mirrors backend/openapi/admin.v1.json: same paths, DTOs, status
// codes and problem codes.
// Fixtures are fake. Every mock password is "Pishkhan-admin-1234" and the TOTP code is always 123456.

import { handleAi, seedAi, type AiMockState } from "./ai";
import { auditFixtures, leadFixtures, planFixtures, userFixtures, workspaceFixtures, workspaceOwnerPhones } from "./fixtures";

type PlanRequestBody = Omit<(typeof planFixtures)[number], "id" | "code" | "version" | "status" | "createdAt" | "updatedAt" | "publishedAt">;

const PASSWORD = "Pishkhan-admin-1234";
const TOTP_CODE = "123456";
const MOCK_SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";

interface MockStaff {
  id: string;
  username: string;
  password: string;
  roles: string[];
  status: "active" | "disabled";
  totpEnabled: boolean;
  createdAt: string;
}

interface MockState {
  staff: MockStaff[];
  enrollments: Map<string, string>;
  revokedRefresh: Set<string>;
  /** Panel users changed by staff actions (status, sessions). */
  users: typeof userFixtures;
  plans: typeof planFixtures;
  subscriptions: MockSubscription[];
  ai: AiMockState;
}

interface MockSubscription {
  id: string;
  workspaceId: string;
  planId: string;
  planCode: string;
  planVersion: number;
  status: "active" | "ended";
  trial: boolean;
  startsAt: string;
  endsAt: string | null;
  endedAt: string | null;
  endReason: string | null;
}

const seed = (): MockState => ({
  staff: [
    staff("01938f5e-0000-7000-8000-000000000001", "superadmin", ["SuperAdmin"], true, "2026-10-01T08:00:00Z"),
    staff("01938f5e-0000-7000-8000-000000000002", "support", ["Support"], true, "2026-10-05T09:30:00Z"),
    staff("01938f5e-0000-7000-8000-000000000003", "finance", ["Finance"], true, "2026-10-06T10:00:00Z"),
    staff("01938f5e-0000-7000-8000-000000000004", "aiops", ["AIOps"], true, "2026-10-07T11:00:00Z"),
    staff("01938f5e-0000-7000-8000-000000000005", "readonly", ["ReadOnly"], true, "2026-10-08T12:00:00Z"),
    staff("01938f5e-0000-7000-8000-000000000006", "newbie", ["Support"], false, "2026-10-28T07:00:00Z"),
  ],
  enrollments: new Map(),
  revokedRefresh: new Set(),
  users: structuredClone(userFixtures),
  plans: structuredClone(planFixtures),
  subscriptions: seedSubscriptions(),
  ai: seedAi(),
});

const DAY = 86_400_000;

/** Workspace b001 has a pro subscription (after a trial); b003's trial ran out. Everyone else is on the free plan. */
function seedSubscriptions(): MockSubscription[] {
  const pro = planFixtures.find((p) => p.code === "pro" && p.status === "published")!;
  const now = Date.now();
  const iso = (offsetDays: number) => new Date(now + offsetDays * DAY).toISOString();
  const sub = (n: number, workspace: string, over: Partial<MockSubscription>): MockSubscription => ({
    id: `01938f70-0000-7000-8000-00000000e${String(n).padStart(3, "0")}`,
    workspaceId: `01938f61-0000-7000-8000-00000000b${workspace}`,
    planId: pro.id,
    planCode: pro.code,
    planVersion: pro.version,
    status: "active",
    trial: false,
    startsAt: iso(-10),
    endsAt: iso(20),
    endedAt: null,
    endReason: null,
    ...over,
  });
  return [
    sub(1, "001", { trial: true, status: "ended", startsAt: iso(-24), endsAt: iso(-10), endedAt: iso(-10), endReason: "replaced" }),
    sub(2, "001", {}),
    sub(3, "003", { trial: true, startsAt: iso(-16), endsAt: iso(-2) }),
  ];
}

function subscriptionState(s: MockSubscription, now = Date.now()): string {
  if (s.status === "ended") return "ended";
  if (s.endsAt && Date.parse(s.endsAt) <= now) return "expired";
  return s.trial ? "trialing" : "active";
}

function subscriptionInfo(s: MockSubscription) {
  return {
    id: s.id,
    planId: s.planId,
    planCode: s.planCode,
    planVersion: s.planVersion,
    state: subscriptionState(s),
    trial: s.trial,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    endedAt: s.endedAt,
    endReason: s.endReason,
  };
}

function staff(id: string, username: string, roles: string[], totpEnabled: boolean, createdAt: string): MockStaff {
  return { id, username, password: PASSWORD, roles, status: "active", totpEnabled, createdAt };
}

// Shared across the separately bundled route handlers and the proxy in one Node process.
const globalStore = globalThis as unknown as { __pishkhanAdminMock?: MockState };
function state(): MockState {
  return (globalStore.__pishkhanAdminMock ??= seed());
}

/** Test hook: restore the seeded state. */
export function resetMockState(): void {
  globalStore.__pishkhanAdminMock = seed();
}

const accessTtlSeconds = () => Number(process.env.MOCK_ACCESS_TTL_SECONDS ?? 600);
const IDLE_SECONDS = 15 * 60;

const json = (body: unknown, status = 200) => Response.json(body, { status });

function problem(status: number, code: string, errors?: Record<string, string[]>): Response {
  const type = { 400: "validation", 401: "unauthorized", 403: "forbidden", 404: "not-found", 409: "conflict" }[status] ?? "internal";
  return Response.json(
    { type: `https://pishkhan.ir/problems/${type}`, title: code, status, code, ...(errors ? { errors } : {}) },
    { status, headers: { "content-type": "application/problem+json" } },
  );
}

function random(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Tokens are self-describing so any bundle can validate them: mock.at.<username>.<expiresAt>[.su.<stepUpAt>]
function issue(user: MockStaff) {
  const now = Date.now();
  const accessExp = now + accessTtlSeconds() * 1000;
  const refreshExp = now + IDLE_SECONDS * 1000;
  return {
    status: "ok",
    accessToken: `mock.at.${user.username}.${accessExp}`,
    accessTokenExpiresAt: new Date(accessExp).toISOString(),
    refreshToken: `mock.rt.${user.username}.${refreshExp}.${random()}`,
    refreshTokenExpiresAt: new Date(refreshExp).toISOString(),
  };
}

interface Caller {
  user: MockStaff;
  stepUpAt: number | null;
}

function authenticate(request: Request): Caller | null {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  const parts = token?.split(".") ?? [];
  if (parts[0] !== "mock" || parts[1] !== "at" || Number(parts[3]) < Date.now()) return null;
  const user = state().staff.find((s) => s.username === parts[2] && s.status === "active");
  if (!user) return null;
  return { user, stepUpAt: parts[4] === "su" ? Number(parts[5]) : null };
}

const isSuperAdmin = (c: Caller) => c.user.roles.includes("SuperAdmin");

function userSummary(u: (typeof userFixtures)[number]) {
  return {
    id: u.id,
    displayName: u.displayName,
    maskedPhone: u.maskedPhone,
    status: u.status,
    totpEnabled: u.totpEnabled,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
    activeSessions: u.sessions.length,
  };
}

function summary(s: MockStaff) {
  return { id: s.id, username: s.username, roles: s.roles, status: s.status, totpEnabled: s.totpEnabled, createdAt: s.createdAt };
}

async function body<T>(request: Request): Promise<Partial<T>> {
  try {
    return (await request.json()) as Partial<T>;
  } catch {
    return {};
  }
}

const ROLES = ["SuperAdmin", "Support", "Finance", "ContentEditor", "AIOps", "ReadOnly"];

export async function handleMockRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const route = `${request.method} ${url.pathname}`;
  const db = state();

  switch (route) {
    case "GET /health/ready":
      return json({ status: "Healthy", checks: { postgres: { status: "Healthy", ms: 3 }, "redis-cache": { status: "Healthy", ms: 1 }, "redis-state": { status: "Healthy", ms: 1 } } });

    case "POST /admin/v1/auth/login": {
      const b = await body<{ username: string; password: string; totpCode: string }>(request);
      if (!b.username || !b.password) return problem(400, "validation.failed", { ...(!b.username && { username: ["validation.required"] }), ...(!b.password && { password: ["validation.required"] }) });
      const user = db.staff.find((s) => s.username === b.username!.trim().toLowerCase());
      if (!user || user.password !== b.password) return problem(401, "auth.login.invalid_credentials");
      if (user.status !== "active") return problem(401, "auth.login.locked");
      if (!user.totpEnabled) {
        const enrollmentToken = random();
        db.enrollments.set(enrollmentToken, user.username);
        return json({ status: "totp_enrollment_required", enrollmentToken, totpSecret: MOCK_SECRET, otpAuthUri: `otpauth://totp/Pishkhan%20Admin:${user.username}?secret=${MOCK_SECRET}&issuer=Pishkhan%20Admin` });
      }
      if (!b.totpCode) return problem(401, "auth.totp.required");
      if (b.totpCode !== TOTP_CODE) return problem(401, "auth.totp.invalid");
      return json(issue(user));
    }

    case "POST /admin/v1/auth/totp/enroll": {
      const b = await body<{ enrollmentToken: string; code: string }>(request);
      const username = b.enrollmentToken ? db.enrollments.get(b.enrollmentToken) : undefined;
      if (!username) return problem(401, "auth.totp.enrollment_expired");
      if (b.code !== TOTP_CODE) return problem(401, "auth.totp.invalid");
      db.enrollments.delete(b.enrollmentToken!);
      const user = db.staff.find((s) => s.username === username)!;
      user.totpEnabled = true;
      return json(issue(user));
    }

    case "POST /admin/v1/auth/refresh": {
      const b = await body<{ refreshToken: string }>(request);
      const parts = b.refreshToken?.split(".") ?? [];
      if (parts[0] !== "mock" || parts[1] !== "rt") return problem(401, "auth.refresh.invalid");
      if (db.revokedRefresh.has(b.refreshToken!)) return problem(401, "auth.refresh.reused");
      if (Number(parts[3]) < Date.now()) return problem(401, "auth.refresh.expired");
      const user = db.staff.find((s) => s.username === parts[2] && s.status === "active");
      if (!user) return problem(401, "auth.login.locked");
      db.revokedRefresh.add(b.refreshToken!);
      return json(issue(user));
    }
  }

  const caller = authenticate(request);
  if (!caller) return problem(401, "auth.unauthorized");

  switch (route) {
    case "POST /admin/v1/auth/logout":
      return new Response(null, { status: 204 });

    case "POST /admin/v1/auth/step-up": {
      const b = await body<{ password: string; totpCode: string }>(request);
      if (b.password !== caller.user.password || b.totpCode !== TOTP_CODE) return problem(401, "auth.step_up.invalid");
      const exp = Date.now() + 5 * 60_000;
      return json({ accessToken: `mock.at.${caller.user.username}.${exp}.su.${Date.now()}`, accessTokenExpiresAt: new Date(exp).toISOString() });
    }

    case "GET /admin/v1/me":
      return json({ id: caller.user.id, username: caller.user.username, roles: caller.user.roles });

    case "GET /admin/v1/staff":
      if (!isSuperAdmin(caller)) return problem(403, "auth.forbidden");
      return json([...db.staff].sort((a, b) => a.username.localeCompare(b.username)).map(summary));

    case "POST /admin/v1/staff": {
      if (!isSuperAdmin(caller)) return problem(403, "auth.forbidden");
      if (!caller.stepUpAt || Date.now() - caller.stepUpAt > 300_000) return problem(403, "auth.step_up.required");
      const b = await body<{ username: string; password: string; roles: string[] }>(request);
      const errors: Record<string, string[]> = {};
      if (!/^[a-z][a-z0-9._-]{2,63}$/.test(b.username ?? "")) errors.username = ["validation.username.invalid"];
      if ((b.password ?? "").length < 14) errors.password = ["validation.password.too_short"];
      if (!b.roles?.length) errors.roles = ["validation.required"];
      else if (!b.roles.every((r) => ROLES.includes(r))) errors.roles = ["validation.role.invalid"];
      if (Object.keys(errors).length) return problem(400, "validation.failed", errors);
      if (db.staff.some((s) => s.username === b.username)) return problem(409, "backoffice.staff.username_taken");
      const created = { ...staff(crypto.randomUUID(), b.username!, b.roles!, false, new Date().toISOString()), password: b.password! };
      db.staff.push(created);
      return json(summary(created), 201);
    }

    case "GET /admin/v1/audit": {
      if (!caller.user.roles.some((r) => r === "SuperAdmin" || r === "Support")) return problem(403, "auth.forbidden");
      // Like the backend, Support only sees entries that belong to a workspace.
      const supportOnly = !isSuperAdmin(caller);
      const q = url.searchParams;
      const text = (k: string) => q.get(k)?.trim().toLowerCase() || null;
      const [actor, action, entity, workspaceId] = [text("actor"), text("action"), text("entityType"), text("workspaceId")];
      const from = q.get("from") ? Date.parse(q.get("from")!) : null;
      const to = q.get("to") ? Date.parse(q.get("to")!) : null;
      const page = Math.max(1, Number(q.get("page") ?? 1));
      const pageSize = Math.min(100, Math.max(1, Number(q.get("pageSize") ?? 25)));
      const filtered = auditFixtures.filter(
        (e) =>
          (!supportOnly || e.workspaceId !== null) &&
          (!actor || e.actorName.toLowerCase().includes(actor)) &&
          (!action || e.action.toLowerCase().includes(action)) &&
          (!entity || e.entityType.toLowerCase() === entity) &&
          (!workspaceId || e.workspaceId === workspaceId) &&
          (from === null || Date.parse(e.occurredAt) >= from) &&
          (to === null || Date.parse(e.occurredAt) <= to),
      );
      return json({ items: filtered.slice((page - 1) * pageSize, page * pageSize), totalCount: filtered.length, page, pageSize });
    }
  }

  if (route === "GET /admin/v1/leads") {
    if (!caller.user.roles.some((r) => r === "SuperAdmin" || r === "Support")) return problem(403, "auth.forbidden");
    const q = url.searchParams;
    const type = q.get("type");
    if (type && type !== "waitlist" && type !== "contact") return problem(400, "validation.failed", { type: ["validation.invalid"] });
    const page = Math.max(1, Number(q.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(q.get("pageSize") ?? 25)));
    const filtered = leadFixtures.filter((l) => !type || l.type === type);
    return json({ items: filtered.slice((page - 1) * pageSize, page * pageSize), totalCount: filtered.length, page, pageSize });
  }

  const workspaceReaders = ["SuperAdmin", "Support", "Finance", "ReadOnly"];
  if (route === "GET /admin/v1/workspaces") {
    if (!caller.user.roles.some((r) => workspaceReaders.includes(r))) return problem(403, "auth.forbidden");
    const q = url.searchParams;
    const text = (q.get("q") ?? "").trim();
    if (text.length > 100) return problem(400, "validation.failed", { q: ["validation.too_long"] });
    const status = q.get("status");
    if (status && !["active", "suspended", "pending_deletion", "deleted"].includes(status)) return problem(400, "validation.failed", { status: ["validation.invalid"] });
    const industry = q.get("industry");
    const digits = text.replace(/^\+98/, "0").replace(/\D/g, "");
    const needle = text.replace(/^@/, "").toLowerCase();
    const matches = (w: (typeof workspaceFixtures)[number]) => {
      if (!text) return true;
      if (/^[0-9a-f-]{36}$/i.test(text)) return w.id === text.toLowerCase();
      if (/^0?9\d{9}$/.test(digits)) return workspaceOwnerPhones[w.id] === (digits.startsWith("0") ? digits : `0${digits}`);
      return w.name.toLowerCase().includes(needle) || w.slug.includes(needle) || w.channels.some((c) => c.username?.toLowerCase().includes(needle));
    };
    const filtered = workspaceFixtures.filter((w) => matches(w) && (!status || w.status === status) && (!industry || w.industry === industry));
    const page = Math.max(1, Number(q.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(q.get("pageSize") ?? 25)));
    const items = filtered.slice((page - 1) * pageSize, page * pageSize).map((w) => ({
      id: w.id,
      name: w.name,
      slug: w.slug,
      industry: w.industry,
      status: w.status,
      createdAt: w.createdAt,
      deletionScheduledFor: w.deletionScheduledFor,
      owner: w.owner,
      memberCount: w.members.length,
      channels: w.channels,
    }));
    return json({ items, totalCount: filtered.length, page, pageSize });
  }

  const workspace = request.method === "GET" ? /^\/admin\/v1\/workspaces\/([0-9a-f-]{36})$/i.exec(url.pathname) : null;
  if (workspace) {
    if (!caller.user.roles.some((r) => workspaceReaders.includes(r))) return problem(403, "auth.forbidden");
    const found = workspaceFixtures.find((w) => w.id === workspace[1]?.toLowerCase());
    if (!found) return problem(404, "not_found");
    const sub = db.subscriptions.find((x) => x.workspaceId === found.id && x.status === "active" && subscriptionState(x) !== "expired");
    const plan = sub ? db.plans.find((p) => p.id === sub.planId) : db.plans.find((p) => p.isFree && p.status === "published");
    return json({
      ...found,
      planId: plan?.id ?? null,
      plan: { source: sub ? "subscription" : plan ? "free" : "none", planId: plan?.id ?? null, code: plan?.code ?? null, name: plan?.name ?? null, version: plan?.version ?? null, trial: sub?.trial ?? false, endsAt: sub?.endsAt ?? null },
    });
  }

  if (route === "GET /admin/v1/users") {
    if (!caller.user.roles.some((r) => workspaceReaders.includes(r))) return problem(403, "auth.forbidden");
    const q = url.searchParams;
    const text = (q.get("q") ?? "").trim();
    if (text.length > 100) return problem(400, "validation.failed", { q: ["validation.too_long"] });
    const status = q.get("status");
    if (status && status !== "active" && status !== "suspended") return problem(400, "validation.failed", { status: ["validation.invalid"] });
    const digits = text.replace(/^\+98/, "0").replace(/\D/g, "");
    const matches = (u: (typeof userFixtures)[number]) => {
      if (!text) return true;
      if (/^[0-9a-f-]{36}$/i.test(text)) return u.id === text.toLowerCase();
      if (/^0?9\d{9}$/.test(digits)) return u.phone === (digits.startsWith("0") ? digits : `0${digits}`);
      return (u.displayName ?? "").toLowerCase().includes(text.toLowerCase());
    };
    const filtered = state().users.filter((u) => matches(u) && (!status || u.status === status));
    const page = Math.max(1, Number(q.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(q.get("pageSize") ?? 25)));
    return json({ items: filtered.slice((page - 1) * pageSize, page * pageSize).map(userSummary), totalCount: filtered.length, page, pageSize });
  }

  const userRoute = /^\/admin\/v1\/users\/([0-9a-f-]{36})(?:\/(sessions\/revoke|block|unblock))?$/i.exec(url.pathname);
  if (userRoute) {
    const found = state().users.find((u) => u.id === userRoute[1]?.toLowerCase());
    const act = userRoute[2];
    if (request.method === "GET" && !act) {
      if (!caller.user.roles.some((r) => workspaceReaders.includes(r))) return problem(403, "auth.forbidden");
      if (!found) return problem(404, "not_found");
      return json({ ...found, phone: undefined });
    }
    if (request.method === "POST" && act) {
      if (!caller.user.roles.some((r) => r === "SuperAdmin" || r === "Support")) return problem(403, "auth.forbidden");
      if (!caller.stepUpAt || Date.now() - caller.stepUpAt > 300_000) return problem(403, "auth.step_up.required");
      const reason = ((await body<{ reason: string }>(request)).reason ?? "").trim();
      if (reason.length < 5 || reason.length > 300) return problem(400, "validation.failed", { reason: [reason.length < 5 ? "validation.too_short" : "validation.too_long"] });
      if (!found) return problem(404, "not_found");
      if (act === "block") found.status = "suspended";
      if (act === "unblock") found.status = "active";
      else found.sessions = [];
      return json(userSummary(found));
    }
  }

  if (url.pathname === "/admin/v1/plans" || url.pathname.startsWith("/admin/v1/plans/")) {
    const readers = ["SuperAdmin", "Finance", "Support", "ReadOnly"];
    const writer = caller.user.roles.some((r) => r === "SuperAdmin" || r === "Finance");
    const plans = state().plans;
    const ordered = () => [...plans].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code) || b.version - a.version);
    const stepUp = () => !caller.stepUpAt || Date.now() - caller.stepUpAt > 300_000;
    const validate = (p: Partial<PlanRequestBody> | undefined, prefix: string) => {
      const errors: Record<string, string[]> = {};
      if (!p?.name?.trim()) errors[`${prefix}name`] = ["validation.required"];
      if (p?.isFree && (p.monthly?.amount ?? 0) !== 0) errors[`${prefix}monthly`] = ["billing.plan.free_has_price"];
      return errors;
    };
    const touch = (p: (typeof plans)[number], body: PlanRequestBody) => Object.assign(p, body, { updatedAt: new Date().toISOString() });
    const m = /^\/admin\/v1\/plans(?:\/([0-9a-f-]{36})(?:\/(versions|publish|archive))?)?$/i.exec(url.pathname);
    const plan = m?.[1] ? plans.find((p) => p.id === m[1]) : undefined;

    if (request.method === "GET") {
      if (!caller.user.roles.some((r) => readers.includes(r))) return problem(403, "auth.forbidden");
      if (m?.[1]) return plan ? json(plan) : problem(404, "not_found");
      const code = url.searchParams.get("code");
      const status = url.searchParams.get("status");
      const items = ordered().filter((p) => (!code || p.code === code) && (!status || p.status === status));
      return json({ items, totalCount: items.length, page: 1, pageSize: 100 });
    }
    if (!writer) return problem(403, "auth.forbidden");
    if (request.method === "POST" && !m?.[1]) {
      const b = await body<{ code: string; plan: PlanRequestBody }>(request);
      const errors = validate(b.plan, "plan.");
      if (!/^[a-z][a-z0-9-]{1,29}$/.test(b.code ?? "")) errors.code = ["validation.invalid"];
      if (Object.keys(errors).length) return problem(400, "validation.failed", errors);
      if (plans.some((p) => p.code === b.code)) return problem(409, "billing.plan.code_taken");
      const now = new Date().toISOString();
      const created = { ...b.plan!, id: crypto.randomUUID(), code: b.code!, version: 1, status: "draft", createdAt: now, updatedAt: now, publishedAt: null };
      plans.push(created);
      return json(created, 201);
    }
    if (!plan) return problem(404, "not_found");
    if (request.method === "PUT" && !m?.[2]) {
      const b = await body<PlanRequestBody>(request);
      const errors = validate(b, "");
      if (Object.keys(errors).length) return problem(400, "validation.failed", errors);
      if (plan.status !== "draft") return problem(409, "billing.plan.not_draft");
      return json(touch(plan, b as PlanRequestBody));
    }
    if (request.method === "POST" && m?.[2] === "versions") {
      if (plans.some((p) => p.code === plan.code && p.status === "draft")) return problem(409, "billing.plan.draft_exists");
      const now = new Date().toISOString();
      const next = { ...structuredClone(plan), id: crypto.randomUUID(), version: Math.max(...plans.filter((p) => p.code === plan.code).map((p) => p.version)) + 1, status: "draft", createdAt: now, updatedAt: now, publishedAt: null };
      plans.push(next);
      return json(next, 201);
    }
    if (request.method === "POST" && (m?.[2] === "publish" || m?.[2] === "archive")) {
      if (stepUp()) return problem(403, "auth.step_up.required");
      const reason = ((await body<{ reason: string | null }>(request)).reason ?? "").trim();
      if ((m[2] === "archive" || reason) && (reason.length < 5 || reason.length > 300)) return problem(400, "validation.failed", { reason: [reason.length < 5 ? (reason ? "validation.too_short" : "validation.required") : "validation.too_long"] });
      if (m[2] === "publish") {
        if (plan.status !== "draft") return problem(409, "billing.plan.not_draft");
        for (const p of plans) if (p.code === plan.code && p.status === "published") p.status = "archived";
        plan.status = "published";
        plan.publishedAt = new Date().toISOString();
      } else plan.status = "archived";
      plan.updatedAt = new Date().toISOString();
      return json(plan);
    }
  }

  const billing = /^\/admin\/v1\/workspaces\/([0-9a-f-]{36})\/(billing|subscription(?:\/extend|\/cancel)?)$/i.exec(url.pathname);
  if (billing) {
    const workspaceId = billing[1]!.toLowerCase();
    const found = workspaceFixtures.find((w) => w.id === workspaceId);
    const subs = db.subscriptions;
    const active = subs.find((s) => s.workspaceId === workspaceId && s.status === "active");
    if (request.method === "GET" && billing[2] === "billing") {
      if (!caller.user.roles.some((r) => workspaceReaders.includes(r))) return problem(403, "auth.forbidden");
      if (!found) return problem(404, "not_found");
      const live = active && subscriptionState(active) !== "expired" ? active : null;
      const plan = live ? db.plans.find((p) => p.id === live.planId) : db.plans.find((p) => p.isFree && p.status === "published");
      const limits = plan?.limits ?? {};
      const now = new Date();
      const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 3.5 * 3_600_000);
      const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) - 3.5 * 3_600_000);
      const seed = Number.parseInt(workspaceId.slice(-3), 10) || 1;
      const used: Record<string, number> = {
        ai_conversations: (seed * 37) % 60,
        ai_messages: (seed * 211) % 900,
        channel_accounts: found.channels.length,
        seats: found.members.length,
        receipt_verifications: (seed * 7) % 20,
        sms: (seed * 3) % 15,
      };
      return json({
        current: {
          source: live ? "subscription" : plan ? "free" : "none",
          planId: plan?.id ?? null,
          planCode: plan?.code ?? null,
          planName: plan?.name ?? null,
          planVersion: plan?.version ?? null,
          trial: live?.trial ?? false,
          endsAt: live?.endsAt ?? null,
          limits,
          subscription: active ? subscriptionInfo(active) : null,
        },
        usage: {
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
          meters: Object.entries(used).map(([meter, n]) => ({ meter, used: n, limit: (limits as Record<string, number | null | undefined>)[meter] ?? null })),
        },
        history: subs.filter((s) => s.workspaceId === workspaceId).sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt)).map(subscriptionInfo),
      });
    }
    if (request.method === "POST" && billing[2] !== "billing") {
      if (!caller.user.roles.some((r) => r === "SuperAdmin" || r === "Finance")) return problem(403, "auth.forbidden");
      if (!caller.stepUpAt || Date.now() - caller.stepUpAt > 300_000) return problem(403, "auth.step_up.required");
      const b = await body<{ planId: string; trial: boolean; endsAt: string | null; days: number | null; reason: string }>(request);
      const reason = (b.reason ?? "").trim();
      if (reason.length < 5 || reason.length > 300) return problem(400, "validation.failed", { reason: [reason ? (reason.length < 5 ? "validation.too_short" : "validation.too_long") : "validation.required"] });
      const now = Date.now();
      const kind = billing[2]!.toLowerCase();
      if (kind === "subscription") {
        if (b.endsAt != null && b.days != null) return problem(400, "validation.failed", { days: ["billing.subscription.end_twice"] });
        if (b.days != null && (!Number.isInteger(b.days) || b.days < 1 || b.days > 1095)) return problem(400, "validation.failed", { days: ["validation.range"] });
        const end = b.endsAt ?? (b.days != null ? new Date(now + b.days * DAY).toISOString() : null);
        if (b.trial && !end) return problem(400, "validation.failed", { days: ["billing.subscription.trial_needs_end"] });
        if (!found) return problem(404, "not_found");
        const plan = db.plans.find((p) => p.id === b.planId);
        if (!plan) return problem(404, "billing.plan.not_found");
        if (plan.status !== "published") return problem(409, "billing.plan.not_published");
        if (active) Object.assign(active, { status: "ended", endedAt: new Date(now).toISOString(), endReason: "replaced" });
        const granted: MockSubscription = { id: crypto.randomUUID(), workspaceId, planId: plan.id, planCode: plan.code, planVersion: plan.version, status: "active", trial: !!b.trial, startsAt: new Date(now).toISOString(), endsAt: end, endedAt: null, endReason: null };
        subs.push(granted);
        return json(subscriptionInfo(granted));
      }
      if (kind === "subscription/extend") {
        if (!Number.isInteger(b.days) || b.days! < 1 || b.days! > 365) return problem(400, "validation.failed", { days: ["validation.range"] });
        if (!active) return problem(409, "billing.subscription.none");
        if (!active.endsAt) return problem(409, "billing.subscription.not_extendable");
        active.endsAt = new Date(Math.max(Date.parse(active.endsAt), now) + b.days! * DAY).toISOString();
        return json(subscriptionInfo(active));
      }
      if (!active) return problem(409, "billing.subscription.none");
      Object.assign(active, { status: "ended", endedAt: new Date(now).toISOString(), endReason: "cancelled" });
      return json(subscriptionInfo(active));
    }
  }

  if (url.pathname.startsWith("/admin/v1/ai/")) {
    const fresh = !!caller.stepUpAt && Date.now() - caller.stepUpAt <= 300_000;
    const handled = await handleAi(request, url, db.ai, caller.user.roles, fresh, problem);
    if (handled) return handled;
  }

  const support = request.method === "POST" ? /^\/admin\/v1\/workspaces\/([0-9a-f-]{36})\/support-sessions$/i.exec(url.pathname) : null;
  if (support) {
    if (!caller.user.roles.some((r) => r === "SuperAdmin" || r === "Support")) return problem(403, "auth.forbidden");
    if (!caller.stepUpAt || Date.now() - caller.stepUpAt > 300_000) return problem(403, "auth.step_up.required");
    const b = await body<{ reason: string; userId: string | null }>(request);
    const reason = (b.reason ?? "").trim();
    if (reason.length < 5 || reason.length > 300) return problem(400, "validation.failed", { "request.reason": [reason ? (reason.length < 5 ? "validation.too_short" : "validation.too_long") : "validation.required"] });
    return json({ url: `http://localhost:3001/api/auth/impersonation?token=mock-${random()}`, expiresAt: new Date(Date.now() + 120_000).toISOString() });
  }

  return problem(404, "not_found");
}
