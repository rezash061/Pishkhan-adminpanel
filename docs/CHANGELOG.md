# Changelog

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
