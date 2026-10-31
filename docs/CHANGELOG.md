# Changelog

## Unreleased — plans

- Plans page (`/billing/plans`, SuperAdmin, Finance, Support, ReadOnly) from `GET /admin/v1/plans` (backend PR #22):
  each plan code with its version on sale, its open draft, flags and version count. New "Billing" sidebar section.
- Plan editor: name, tagline, description, prices in Toman (sent as Rial `Money`), monthly limits per meter (empty is
  unlimited), up to 20 pricing-card lines, public, free and highlighted flags and display order. Server field errors
  land on their fields.
- Drafts are saved with `PUT` and published with an optional reason and step-up (the previous version is archived).
  Published and archived versions are read-only; "new version" copies one into a draft. Archive needs a reason and
  step-up. Each plan page lists all versions of its code. Finance and SuperAdmin edit (`plans.manage`); the others read.
- Success badges use a darker text colour for WCAG AA contrast.

## Unreleased — users

- Users page (`/users`, SuperAdmin, Support, Finance, ReadOnly): search by full phone (any spelling), name or id,
  status filter in the URL, from `GET /admin/v1/users` (backend PR #21). Rows show masked phone, status, 2FA, signed-in
  devices and last sign-in.
- User detail (`/users/{id}`): overview, workspaces with role and status (linking to the workspace), signed-in devices.
  Support and SuperAdmin can sign the user out everywhere, block and unblock, each with a reason and step-up.
- Workspace members link to their user page. Finance now sees users, as the backend allows.

## Unreleased — workspaces

- Workspaces page (`/workspaces`, SuperAdmin, Support, Finance, ReadOnly): search by name, slug, owner phone (any
  spelling, Persian digits too), Instagram username or id, with status and industry filters in the URL, from
  `GET /admin/v1/workspaces` (backend PR #19). Rows show the owner (masked phone), member count and channel status.
- Workspace detail (`/workspaces/{id}`): overview, owner, members with roles, connected accounts with status, token
  expiry and reason, deletion notices, and links to the workspace's audit log and to a support session (per member).
- Support session page: the workspace is picked through the search instead of pasting an id, and the member is chosen
  from a list (owner by default). `?workspaceId=` and `?userId=` pre-fill it. Without the search API it falls back
  to typing ids.
- Danger badges use a darker text colour for WCAG AA contrast.

## Unreleased — leads and support sessions

- Leads page (`/leads`, SuperAdmin and Support): website waitlist and contact submissions from `GET /admin/v1/leads`,
  type filter in the URL, masked phones with reveal, detail with message and UTM.
- Support session page (`/support/sessions`, Support): reason + step-up, then the one-time user-panel link from
  `POST /admin/v1/workspaces/{id}/support-sessions` (backend PR #18), kept only in memory until used or expired.

## Unreleased — Phase 0 (AD-0.1 to AD-0.4)

- Next.js 16 admin app with `(auth)` and `(console)` route groups, Persian RTL UI, self-hosted Vazirmatn font,
  Jalali dates in Asia/Tehran, light and dark themes.
- Staff sign-in against the real AdminApi: password + TOTP, first-sign-in TOTP enrollment (QR rendered locally),
  refresh-token rotation with a single-flight refresh in `src/proxy.ts`, logout, 15-minute idle timeout with a
  2-minute warning shared across tabs, and a `useStepUp()` hook for dangerous actions.
- BFF: tokens live only in HttpOnly `SameSite=Strict` cookies (`__Host-` in production); `/api/bff/*` proxies to
  `/admin/v1/*` with Origin and double-submit CSRF checks. Nonce-based CSP, `frame-ancestors 'none'`, optional IP
  allowlist.
- Role-based navigation and page guards (`src/lib/permissions.ts`), 403/404/error pages, command palette (Ctrl+K).
- Pages: dashboard, staff list and create (step-up), system health (polls every 15 s), audit log viewer with
  deep-linkable filters and before/after detail (awaits `GET /admin/v1/audit`, see `docs/backend-requests.md`),
  account settings.
- In-process mock AdminApi (`ADMIN_API_URL=mock`) for local work and the Playwright suite.
- Tests: Vitest unit and component tests; Playwright end-to-end with axe accessibility checks. CI workflow and
  standalone Dockerfile.
