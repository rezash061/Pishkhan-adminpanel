// In-process stand-in for the AdminApi host, used when ADMIN_API_URL=mock (local development without the
// .NET stack, and the Playwright suite). It mirrors backend/openapi/admin.v1.json: same paths, DTOs, status
// codes and problem codes. `/admin/v1/audit` is the proposed contract in docs/backend-requests.md.
// Fixtures are fake. Every mock password is "Pishkhan-admin-1234" and the TOTP code is always 123456.

import { auditFixtures } from "./fixtures";

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
});

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
      const q = url.searchParams;
      const text = (k: string) => q.get(k)?.trim().toLowerCase() || null;
      const [actor, action, entity, workspaceId] = [text("actor"), text("action"), text("entityType"), text("workspaceId")];
      const from = q.get("from") ? Date.parse(q.get("from")!) : null;
      const to = q.get("to") ? Date.parse(q.get("to")!) : null;
      const page = Math.max(1, Number(q.get("page") ?? 1));
      const pageSize = Math.min(100, Math.max(1, Number(q.get("pageSize") ?? 25)));
      const filtered = auditFixtures.filter(
        (e) =>
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

  return problem(404, "not_found");
}
