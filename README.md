# Pishkhan admin panel

Internal back office for Pishkhan (پیشخوان), the AI Instagram automation platform for Persian-speaking sellers.
Staff only, private network only. Next.js 16 (App Router, route groups), React 19, TypeScript strict,
Tailwind CSS 4, Persian RTL UI with Jalali dates.

Backend: the `AdminApi` host in [`rezash061/pishkhan-backend`](https://github.com/rezash061/pishkhan-backend)
(`/admin/v1/*`, contract in `backend/openapi/admin.v1.json`). Plan: `02-admin-panel.md` in the project plans.

## Run

```bash
pnpm install
cp .env.example .env.local          # set ADMIN_API_URL
pnpm dev                            # http://localhost:3002
```

Without the .NET stack, run against the built-in mock AdminApi:

```bash
ADMIN_API_URL=mock pnpm dev
```

Mock accounts (fake data): `superadmin`, `support`, `finance`, `aiops`, `readonly` and `newbie` (first sign-in,
TOTP enrollment). Password `Pishkhan-admin-1234`, TOTP code `123456`.

Against the real backend, create the first account with the Migrator
(`dotnet run --project src/Hosts/Pishkhan.Migrator -- create-staff <username> <password> SuperAdmin`) and enroll
TOTP at first sign-in.

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm test   # Vitest unit and component tests
pnpm test:e2e                              # Playwright + axe, production build against the mock
```

## How it fits together

| Path | Role |
|---|---|
| `src/app/(auth)` | Sign-in and first-sign-in TOTP enrollment |
| `src/app/(console)` | Authenticated layout (sidebar, top bar, Ctrl+K palette, idle timeout, step-up) and pages |
| `src/app/api/auth/[action]` | BFF: login, totp-enroll, step-up, logout. Turns AdminApi tokens into HttpOnly cookies |
| `src/app/api/bff/[...path]` | BFF proxy `/api/bff/x` → `/admin/v1/x` with the bearer token, CSRF and Origin checks |
| `src/proxy.ts` | IP allowlist, nonce CSP, CSRF cookie, redirect to sign-in, single-flight token refresh |
| `src/lib/permissions.ts` | Roles → permissions → navigation (the backend still enforces everything) |
| `src/mocks/admin-api.ts` | In-process mock of the AdminApi used by `ADMIN_API_URL=mock` and the e2e suite |
| `src/messages/fa.json` | Every UI string and backend error key translation |

Security model: the browser never sees access or refresh tokens; cookies are `HttpOnly`, `SameSite=Strict` and
`__Host-` prefixed in production. Dangerous actions call `useStepUp()`, which asks for password + TOTP again when
the AdminApi answers `auth.step_up.required` and retries with a 5-minute step-up token.

What the panel still needs from the backend is in [`docs/backend-requests.md`](docs/backend-requests.md).

## Deploy

`docker build -t pishkhan-admin .` produces a standalone Node 22 image listening on port 3002. Serve it only on the
private host (for example `admin.internal.example.ir`) behind the VPN, with TLS terminated in front of it.
