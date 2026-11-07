# Changelog

## Unreleased — Support tickets, announcements, SMS and Bale (AD-2.4, AD-2.6)

- Against backend PR (batch 4, see `docs/backend-requests.md` 1n):
  - **Support tickets** (`/support/tickets`, SuperAdmin, Support, ReadOnly): queue tabs (waiting, answered, mine, unassigned, closed,
    all) with counts, category and subject/number search in the URL. A ticket page shows the conversation; Support answers (the
    seller is notified and the ticket is taken if nobody had it), takes or releases it, closes and reopens it.
  - **Announcements** (`/support/announcements`): the banner every seller sees. Support writes them with severity, optional link and
    show window, ends or deletes them.
  - **SMS and Bale** (`/platform/messaging`): SMS provider, API key set or not, remaining credit and the last day's sent/failed by
    purpose; a test SMS (SuperAdmin, step-up); Bale webhook settings and sellers' bots, with a token check that registers the
    webhook again or marks the bot for reconnection (Support).
  - **SMS log** (`/platform/sms-log`): every SMS sent or failed for 90 days, masked phone, purpose, workspace and error; search by
    phone. Texts are never kept.
  - New permissions `tickets.read`, `tickets.manage`, `announcements.manage`, `platform.messaging.read`, `platform.sms.test`,
    `platform.bale.check`.

## Unreleased — Coupons and wallets (AD-1.4)

- Against backend PR #55 (see `docs/backend-requests.md` 1m):
  - **Coupons** (`/billing/coupons`): list with search and state, a page for each coupon with its redemptions, and (Finance) create and
    edit: percent or Toman off, plan codes, first purchase only, total and per-shop limits, dates, on/off. Code, kind and value are fixed
    after creation.
  - **Workspace wallet** on the workspace page: balance and latest changes, and (Finance, step-up, reason) credit added or taken off.
  - **Payments**: discount, coupon code and wallet part on the payment page. A refund can be paid into the wallet, and ending the
    subscription also gives back the wallet part (amount 0 allowed for that).
  - New permissions `coupons.manage` and `wallet.adjust` (Finance and SuperAdmin).

## Unreleased — Billing: subscriptions, payments and invoices, refunds (AD-1.4)

- Against backend PR #54 (see `docs/backend-requests.md` 1m):
  - **Payments and invoices** (`/billing/payments`, SuperAdmin, Finance, Support, ReadOnly): the last 30 days' paid, refunded and net
    totals; filters for status, kind and workspace in the URL; partly and fully refunded payments are marked.
  - **Payment page** (`/billing/payments/{id}`): the invoice, credit from the previous plan, Zarinpal reference and card, the
    subscription it bought and its refunds. Finance records a refund (amount in Toman up to what is left, optional Zarinpal
    reference, reason, step-up) and can end the subscription with it.
  - **Subscriptions** (`/billing/subscriptions`): every workspace's subscription by state, plan code and workspace, linked to the
    payment that bought it.
  - Support gains `billing.read`, as the backend allows. Workspace history shows the `refunded` end reason.

## Unreleased — Staff management, AI traces, home dashboard and full health page (AD-0.2, AD-0.4, AD-1.10)

- Against backend PR #52 (see `docs/backend-requests.md` 1l):
  - **Home dashboard**: KPI tiles (active workspaces, sign-ups today / 7 days, paying workspaces, MRR in Toman, AI replies and
    handoff rate today, quarantined files, open dead letters, Kafka lag, channels needing re-auth, Instagram) and the backend's
    alerts. Tiles and alerts link to the filtered page when the staff member can open it. Refreshes every minute.
  - **Staff**: last activity and lockout columns; SuperAdmin can deactivate or reactivate an account, reset its TOTP and change
    its roles (step-up and reason). Your own account cannot be deactivated or reset.
  - **Settings**: "active sessions" with device, IP and last activity; end any session other than the current one.
  - **AI traces** (`/ai/traces`, SuperAdmin, AIOps, Support, ReadOnly): stats for 24 hours, filters (outcome, workspace, low
    confidence, guard issues) in the URL, and a detail page. Customer content stays hidden until SuperAdmin, AIOps or Support
    gives a reason; the reveal is written to the workspace's audit log.
  - **Health**: reads `/admin/v1/platform/health` (Kafka, ClamAV, storage, workers, Instagram, AI) with a detail column, and falls
    back to `/health/ready` on an older backend.
- Fix: a request still in flight during sign-out (idle or explicit) no longer redirects to "session expired" over the sign-out page.
- New permissions `ai.traces.read` and `ai.traces.reveal`; mock handlers with the backend's rules; unit and Playwright tests.

## Unreleased — Platform operations: quarantine, Kafka, dead letters, workers, feature flags (AD-1.6 to AD-1.8)

- New pages, against the backend's platform operations endpoints (see `docs/backend-requests.md` 1k):
  - `/security/quarantine`: infected, failed, rejected and pending files with counts per status; re-scan, delete
    (step-up) and "false positive" (SuperAdmin, step-up), each with a reason.
  - `/platform/kafka`: consumer groups with lag (per topic and partition on click) and topics; refreshes every 15 s.
  - `/platform/dead-letters` and `/platform/dead-letters/{id}`: open counts per group, a status filter, bulk replay or
    discard (SuperAdmin, step-up, reason), and the payload and stack trace on the detail page.
  - `/platform/workers`: Quartz instances, recurring jobs with "run now" (SuperAdmin, step-up) and worker groups.
  - `/platform/feature-flags`: create, edit and delete global flags (rollout share, plans, switch); everyone else reads.
- Workspace detail: a feature flags card with each flag's effective value and a per-workspace override
  (Support and SuperAdmin, reason).
- Shared `ReasonDialog` (reason plus optional step-up) and `Pager` components; `formatBytes`.
- New permissions and nav items for the pages; mock AdminApi handlers with the backend's rules; unit and Playwright tests.

## Unreleased — Instagram outage mode (BE-2.7 part 1)

- New "قطعی اینستاگرام" page in the Platform section (`/platform/outage`), from `GET/PUT /admin/v1/platform/outage`
  (backend PR #47). SuperAdmin, Support, ReadOnly, AIOps and Finance can read it; Support and SuperAdmin can change the
  mode (`platform.outage.read`, `platform.outage.manage`).
- The page shows:
  - the status (up or down) on a green or red banner, with `since` in Jalali and as a relative time;
  - the mode;
  - the detector's `ok` and `failed` counts over `windowMinutes`, with the failure share («—» when nothing was called);
  - the reason for the last mode change.
  It refreshes every 30 seconds.
- Changing the mode: three options with Persian explanations (auto «تشخیص خودکار», forced_down «اعلام قطعی دستی», forced_up
  «لغو هشدار»), a required reason of 5 to 300 characters and step-up. A warning says that a status change notifies
  every workspace with an Instagram account. Server field errors land on their fields.
- Home dashboard: a red alert with a link to the page while Instagram is down, for staff who can read the outage
  status.
- `formatRelative` in `src/lib/format.ts` for Persian relative times.
- Mock AdminApi: outage status (up, auto, with a few failures) with the backend's role, step-up and validation rules,
  and the detector's down rule. Unit, component and Playwright tests.

## Unreleased — Finglish eval metrics (BE-2.3)

- Eval runs from backend PR #44 (BE-2.3) carry `finglishCaseCount`, `finglishIntentAccuracy` and `scriptIntentAccuracy`.
  The runs table has a "فارسی / فینگلیش" column, and the run page a "دقت به تفکیک خط" row. Both show Persian-script and
  Finglish intent accuracy side by side, with the number of Finglish cases. A side without cases, or a backend without
  the fields, shows «—».
- The eval gate checklist names the `finglish_gap` check «فاصله دقت فینگلیش با فارسی». It shows the allowed gap and the
  run's gap in points, for example «حداکثر ۵ امتیاز؛ این اجرا: ۱۶٫۷ امتیاز», and explains the check. The backend adds the
  check only when a set has both kinds of case, and the panel shows whatever checks it gets.
- Per-case results mark Finglish inputs with a «فینگلیش» badge (`src/lib/finglish.ts`). This uses the backend's
  Latin-letter test, at least 70% of the letters Latin. The backend's word lists are not used, so plain English input
  is marked too.
- The prompt registry lists keys from the API. The new `text.transliterate` and `knowledge.onboarding` show up like the
  others, and the mock has both. Only the eval runner is limited to `intent.classify`, which matches the backend.
- Mock AdminApi: a `finglish` set made of the 30 cases of the backend's `samples/finglish.jsonl`, and a `mixed-fa` set
  (12 script and 8 Finglish cases) with one run that fails the gap check and one that passes. Accuracies are computed
  per case, so the split, the gate and the results list agree.
## Unreleased — industry templates (AD-2.2)

- New "Templates" sidebar section with "Industry templates" (`/templates/industry`) from backend PR #40 (BE-2.9,
  `/admin/v1/industry-templates`). SuperAdmin, AIOps, Support and ReadOnly read; AIOps and SuperAdmin edit
  (`templates.read`, `templates.manage`).
- List: every version with industry, version, status badge (draft, published, archived), content counts and issue
  count; industry and status filters and the page kept in the URL; `page`, `pageSize`, `totalCount` pagination.
- Editor (`/templates/industry/{id}`): name and description; required facts and FAQs as rows (key checked like the
  backend, reorder, add, remove, a count of «[...]» blanks in answers); the agent profile (name, tone
  friendly/formal/playful, brand voice, never-say and handoff keyword lists, one phrase per line) or none; flows and rules
  as left-to-right JSON with a live parse check, "format JSON", and a read-only summary (flow name, key, node and edge
  count, node types, start node; rule name, trigger kind, keywords, actions and the `flowKey` it starts).
- Saving a draft (`PUT`) shows the returned `issues` as a pre-publish checklist grouped by section, with Persian
  explanations for the template, `templates.*`, `flow.*`, `automation.*` and `validation.*` codes and the raw issue
  kept. Items with issues are also marked in the form. Publish stays disabled while there are issues or unsaved changes.
- Actions: first draft for an industry without a template (industries that have one are disabled; 409
  `templates.industry_taken` lands on the industry field), new version from any version (409 `templates.draft_exists`),
  publish with step-up and an optional reason (a 422 `templates.invalid` shows the server's issues), archive with
  step-up and a required reason of 5 to 300 characters.
- Mock AdminApi: `/admin/v1/industry-templates` with the backend's five built-in templates (`src/mocks/template-seeds`,
  copied from `Seeds/*.json`), a clothing draft with two issues and an archived cosmetics version, and a simplified copy
  of the backend's content validator. Unit tests for the editor logic, issue rendering and the mock; Playwright tests
  for fixing and publishing a draft, new version and archive, creating a first draft and read-only roles.

## Unreleased — website content

- New "Website content" sidebar section from backend PR #31 (`/admin/v1/content`). ContentEditor and SuperAdmin edit;
  Support and ReadOnly read.
- Entries (`/content/entries`): search, kind and status filters kept in the URL, paged. The editor
  (`/content/entries/new`, `/content/entries/{id}`) has title, a Persian-safe slug made from the title (fixed once the
  entry was published), description, category (blog and help), a block editor (paragraph, headings, lists, callout,
  quote and image as fields; the other blocks as JSON) and the fields of each kind (SEO, cover, keywords, tags,
  version, the case study's consent and metrics). Saving sends the revision; a stale save shows a reload button.
- Publishing: publish now or at a time, cancel a schedule, archive with an optional reason, delete an entry that was
  never published, and preview the draft on the website (`NEXT_PUBLIC_WEBSITE_URL`). The page says when the draft
  differs from the live version.
- Categories (`/content/categories`) and redirects (`/content/redirects`). A category in use cannot be deleted.

## Unreleased — AI operations

- New "AI" sidebar section from backend PR #24 (`/admin/v1/ai`), readable by SuperAdmin, AIOps and ReadOnly.
- Providers (`/ai/providers`): the providers in effect with kind, URL, whether a key is set, source and last test.
  SuperAdmin adds or edits one (kind, URL, write-only key or clearing it, enabled) with a reason and step-up, and sends
  a test request with a model name.
- Model routes (`/ai/routes`): every task's fallback chain and its source. AIOps edits a chain on `/ai/routes/{task}`
  (up to 5 steps; temperature, max output tokens, timeout, prices typed in Toman per million tokens and sent in Rial),
  or goes back to the server configuration. Server field errors land on their step.
- Prompts (`/ai/prompts`, `/ai/prompts/{key}`): versions newest first with the active one, a line diff against the base
  version, writing a new version, starting an eval run (intent.classify) and activating a version with its latest run
  and a reason. A refused activation names the failed gate checks.
- Evals (`/ai/evals`): eval sets, importing JSON Lines (file or pasted) with the import report, runs filtered by set,
  and a run page with totals, the gate and every case (failures first). Running runs refresh on their own.
- The workspace page shows the plan again, from the detail's new `plan` field.

## Unreleased — workspace billing

- "Subscription and usage" section on the workspace page, from `GET /admin/v1/workspaces/{id}/billing` (backend
  PR #23): the current plan and where it comes from (subscription, free plan or no limits), its state and end, usage per
  meter this Jalali month against the plan's limits, and the subscription history with end reasons.
- Finance and SuperAdmin (`subscriptions.manage`) can grant a published plan or a trial (trial needs a length in days),
  extend the end by 1 to 365 days and cancel, each with a reason and step-up. Hidden for deleted workspaces.

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
