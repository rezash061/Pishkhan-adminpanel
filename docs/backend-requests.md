# AdminApi requests from the admin panel

The admin panel is built against the real AdminApi contract in
`rezash061/pishkhan-backend` (`backend/openapi/admin.v1.json`). It covers staff sign-in, TOTP enrollment, refresh,
logout, step-up, `/me`, staff list/create, the audit log (backend PR #10), website leads and support sessions
(backend PR #18). Everything else the admin plan
(`02-admin-panel.md`) needs is part of backend work package **BE-1.12 Backoffice APIs v1**.

This file lists what the panel needs next, in the order the pages are built. Where the panel already calls an
endpoint that does not exist yet, it is marked **called today**: the page shows a "not implemented yet" notice
on `404` and works against the mock (`ADMIN_API_URL=mock`, see `src/mocks/admin-api.ts`).

## 1. Audit log — done (backend PR #10)

`GET /admin/v1/audit` — roles: SuperAdmin, Support (Support limited to workspace-scoped entries). The backend
also returns `onBehalfOf` (the user a staff member was impersonating), which the detail view shows.

| Query | Meaning |
|---|---|
| `actor` | Substring of the actor's display name (staff username, masked user phone) |
| `action` | Substring of the action key, for example `staff.create` |
| `entityType` | Exact entity type: `staff`, `staff_session`, `workspace`, `membership`, `invitation`, `data_deletion_request`, … |
| `workspaceId` | Exact workspace id |
| `from`, `to` | ISO 8601 UTC instants (the panel converts Jalali input to Tehran day boundaries) |
| `page`, `pageSize` | 1-based page, page size ≤ 100 |

Response `200`:

```json
{
  "items": [
    {
      "id": "uuid",
      "occurredAt": "2026-10-28T12:00:00Z",
      "actorType": "staff | user | system",
      "actorId": "uuid | null",
      "actorName": "superadmin",
      "workspaceId": "uuid | null",
      "action": "workspace.suspend",
      "entityType": "workspace",
      "entityId": "uuid | null",
      "reason": "string | null",
      "ip": "string | null",
      "before": {},
      "after": {}
    }
  ],
  "totalCount": 64,
  "page": 1,
  "pageSize": 25
}
```

`before` and `after` are JSON snapshots (sensitive values already redacted by the backend), or null.

## 1b. Website leads — done

`GET /admin/v1/leads?type=&page=&pageSize=` (SuperAdmin, Support) backs the Leads page. The response carries the full
phone number; the panel masks it and reveals it on click. **Request:** an audited reveal (admin plan 2.3), for example
masked phones in the list plus `POST /admin/v1/leads/{id}/reveal`, so revealing is recorded.

## 1c. Support sessions — done (backend PR #18)

`POST /admin/v1/workspaces/{workspaceId}/support-sessions` with `{ reason, userId? }` (Support, step-up) backs the
Support session page, which shows the returned one-time link and drops it once used or expired. The workspace is
picked through the workspace search (1d). `Backoffice:UserPanelUrl` now defaults to port 3001 (backend PR #19).

## 1d. Workspace search and detail — backend PR #19

`GET /admin/v1/workspaces?q=&status=&industry=&page=&pageSize=` and `GET /admin/v1/workspaces/{workspaceId}`
(SuperAdmin, Support, Finance, ReadOnly) back the Workspaces list, the workspace detail page and the support-session
workspace picker. **Requests for the next round:** the owner's display name is often empty, so a sign-up date or last
sign-in on the owner would help support tell accounts apart; the plan name (not only `planId`) once Billing exists; and
the detail tabs of admin plan 4.2 (usage, billing, conversations count) as their modules land.

## 1e. Users — backend PR #21

`GET /admin/v1/users`, `GET /admin/v1/users/{userId}` and `POST /admin/v1/users/{userId}/sessions/revoke`, `/block`,
`/unblock` (reason + step-up) back the Users list and detail. **Requests for the next round:** an `entityId` filter on
`GET /admin/v1/audit`, so the user page can link to the staff actions taken on that user (today it links to the
user's own actions through `actor`); and revoking a single device (`DELETE /admin/v1/users/{userId}/sessions/{id}`).

## 1f. Plans — backend PR #22

`GET/POST /admin/v1/plans`, `GET/PUT /admin/v1/plans/{id}`, `POST /admin/v1/plans/{id}/versions`, `/publish` and
`/archive` back the Plans list, the plan editor and the version history. Prices are typed in Toman and sent in Rial.
**Found while testing:** on `feature/billing-plans` the public Api host does not start in Development, because
`PlanAudit` needs `IStaffDirectory`, which only the AdminApi registers (reported to the backend thread). **Requests:** how
many subscriptions sit on each version (to warn before archiving), and a plan-diff or "changed fields" in the
`plan.update` audit entry.

## 1g. Workspace billing — backend PR #23

`GET /admin/v1/workspaces/{id}/billing` and `POST .../subscription`, `/subscription/extend`, `/subscription/cancel` back
the "Subscription and usage" section on the workspace page. The panel sends `days` and never `endsAt`. The workspace
detail's `planId` stayed null while a subscription was active; backend PR #24 fills it and adds `plan`, which the
panel shows.

## 1h. AI operations — backend PR #24

Providers, routes, prompts and evals pages use `/admin/v1/ai`. The import sends the JSON Lines as
`application/x-ndjson` through the BFF. **Notes:** saving a route step with only an input price stores the output price
as 0 rather than null; the traces viewer waits for BE-1.4.

## 1i. Website content — backend PR #31

Entries, categories, redirects and preview use `/admin/v1/content`. **Notes:** there is no media library yet, so image
blocks take a URL (site path or https). After PR #31 the AdminApi host failed to start in Development
(`ReplyPipeline` needed Knowledge and Catalog); backend PR #32 fixes it.

## 1j. Industry templates — backend PR #40

`GET/POST /admin/v1/industry-templates`, `GET/PUT /{id}`, `POST /{id}/versions`, `/publish` and `/archive` back the
Industry templates list and editor (AD-2.2). The panel keeps hand-written DTOs in `src/lib/api/types.ts` (there is no
generated client or copy of `admin.v1.json` in this repo); they match the PR's `AdminTemplateResponse`,
`TemplateRequest` and `CreateTemplateRequest`. **Requests:**

- **Concurrency on `PUT`.** There is no revision or `If-Match`, so two staff saving the same draft silently overwrite
  each other. A `revision` like the CMS entries (409 on a stale save) would let the editor offer a reload.
- **Lighter list rows.** `GET /industry-templates` returns the full `content` (about 10 KB per version) and runs the
  validator for every row; the list only needs counts and the issue count. A summary shape (or `?fields=`) would help as
  versions accumulate.
- **Apply preview for staff.** Admin plan 4.6 asks for "preview apply to a sandbox workspace". There is no AdminApi
  endpoint for it; the panel's preview (`GET /workspaces/{id}/templates/{templateId}`) only serves published templates
  to workspace members.
- **Usage before archiving.** How many workspaces applied each version (`template_applications`), so the archive dialog
  can say what is affected.
- **Archive is not idempotent.** Archiving an already archived version succeeds and writes another audit entry; a 409
  `templates.not_published_or_draft` (or a no-op without audit) would be clearer.
- **Issue keys with duplicate or empty item keys.** Issues name items by key (`faqs[x]`), so two items with the same
  key, or an empty key (`flows[]`), cannot be pointed at individually. An index (`faqs[3]`) next to the key would let the
  editor mark the right row.
- **OpenAPI query names.** The list parameters are published as `Industry`, `Status`, `Page`, `PageSize` (PascalCase,
  from `[AsParameters]`); binding is case-insensitive so the panel sends lower case, but generated clients would not.
- **Storefront examples** (admin plan 4.6) are not part of `TemplateContent` yet.

## 1k. Platform operations — backend branch `claude/project-thread-bkd8n1` (BE-1.12 platform ops)

- File quarantine: `GET /admin/v1/files/quarantine` (+ `/summary`), `POST /files/{id}/rescan`, `/delete` (step-up),
  `/false-positive` (SuperAdmin, step-up). A false positive re-scans the file without reusing earlier verdicts.
- Kafka: `GET /admin/v1/platform/kafka` (15 s cache, `503 platform.kafka_unavailable` when the broker is down).
- Dead letters: `GET /admin/v1/platform/dead-letters` (+ `/summary`, `/{id}` with payload for SuperAdmin and Support),
  `POST /dead-letters/replay` and `/discard` (SuperAdmin, step-up, 1 to 100 ids, reason). Replay reaches only the
  failed handler.
- Workers: `GET /admin/v1/platform/workers` (Quartz instances and triggers, worker groups) and
  `POST /platform/jobs/{name}/trigger` (SuperAdmin, step-up, `409 platform.job_busy` unless `WAITING`).
- Feature flags: `GET/POST /admin/v1/feature-flags`, `PUT /feature-flags/{key}`, `POST /feature-flags/{key}/delete`
  (SuperAdmin; delete needs step-up), workspace overrides `GET /workspaces/{id}/feature-flags` and
  `PUT /workspaces/{id}/feature-flags/{key}` (Support, `{enabled: bool|null, reason}`).

## 1l. Staff, traces, dashboard, health — backend PR #52 (second commit)

- Staff: `POST /admin/v1/staff/{id}/deactivate`, `/activate`, `/totp-reset`, `PUT /staff/{id}/roles` (SuperAdmin, step-up, reason;
  409 `backoffice.staff.self` and `backoffice.staff.last_super_admin`); `GET /me/sessions`, `DELETE /me/sessions/{id}`; staff rows
  carry `lastActiveAt` and `lockedUntil`.
- AI traces: `GET /admin/v1/ai/traces` (+ `/stats`, `/{id}`) without content; `POST /ai/traces/{id}/reveal` with a reason.
- `GET /admin/v1/dashboard` (KPIs and alerts) and `GET /admin/v1/platform/health`.
- Still open: recovery codes at TOTP enrollment (admin plan 2.2), and the Meta app page (app mode, permissions, webhook health).

## 1m. Billing across workspaces — backend PR #54 (third commit)

- `GET /admin/v1/billing/subscriptions` (state current, trialing, scheduled, ended, all), `GET /billing/payments` (status paid, pending,
  failed, expired, all; kind; workspace), `GET /billing/payments/{id}` (refunds and the subscription), `GET /billing/summary?days=`.
- `POST /billing/payments/{id}/refunds` (Finance, step-up, reason): records a refund made in Zarinpal's panel, up to what is left;
  `endSubscription` ends what the payment bought (end reason `refunded`).
- Coupons and the seller wallet: backend PR #55 (`/admin/v1/billing/coupons`, `/admin/v1/workspaces/{id}/wallet` and `/wallet/adjustments`,
  refunds with `toWallet`).

## 1n. Support tickets, announcements, SMS and Bale — backend batch 4

- `GET /admin/v1/support/tickets` (status, category, assigned me|none, workspaceId, q), `/counts`, `/{id}`, `POST /{id}/messages`,
  `/assign` (`staffId` or null), `/close`, `/reopen`. Readers SuperAdmin, Support, ReadOnly; changes Support.
- `GET|POST /admin/v1/announcements`, `PUT|DELETE /{id}`, `POST /{id}/end`.
- `GET /admin/v1/platform/messaging`, `GET /platform/sms/log` (phone, purpose, status, workspaceId), `POST /platform/sms/test`
  (SuperAdmin, step-up), `GET /platform/bale/bots`, `POST /platform/bale/bots/{id}/check` (Support).
- Provider keys stay in deployment configuration; the panel only shows whether they are set.

## 2. Platform health

The health page reads the AdminApi's own `/health/ready`, which today reports PostgreSQL and the two Redis
instances. The plan's health page also needs Kafka (consumer lag), ClamAV (signature age), object storage,
AI providers and the Meta API. Either add them as `ready`-tagged checks on the AdminApi host, or (better, because
they belong to other hosts) add `GET /admin/v1/platform/health` returning the same `{ status, checks }` shape
with one entry per dependency. The panel already renders any check names it receives.

## 3. Staff management (completes AD-0.2 / AD-2.7) — done in 1l except recovery codes

- `POST /admin/v1/staff/{id}/deactivate` and `/activate` (SuperAdmin, step-up, `reason` in body).
- `POST /admin/v1/staff/{id}/totp-reset` (SuperAdmin, step-up, `reason`): clears TOTP so the next sign-in re-enrolls.
- `PUT /admin/v1/staff/{id}/roles` (SuperAdmin, step-up).
- `GET /admin/v1/me/sessions` and `DELETE /admin/v1/me/sessions/{id}` for the settings page.
- Recovery codes at enrollment (admin plan 2.2 "show recovery codes once"): return them in the `ok` response of
  `/auth/totp/enroll`, and accept one in place of `totpCode` at login.

## 4. Phase 1 pages (BE-1.12)

Workspace detail tabs beyond the overview, AI providers / routes / prompts / evals /
traces, Meta app, CMS (quarantine, Kafka, DLQ, workers and feature flags are done, see 1k) and the home dashboard KPIs and
alerts, as listed in `02-admin-panel.md` section 4. List endpoints should use `page`, `pageSize`,
`totalCount` (overview section 6) so the panel's tables can share one pagination component.

## Notes on current behaviour the panel relies on

- **Step-up** failures are `403` with `title`/`code` `auth.step_up.required` (the plan said `401`); the panel follows
  the backend. A step-up token is a full access token with a `step_up_at` claim, valid 5 minutes; the BFF keeps it
  in its own HttpOnly cookie and prefers it while it is valid.
- **Sign-in is one request** with username, password and TOTP code (empty only on first sign-in). Since backend
  PR #10 a sign-in with the right password and no code no longer counts as a failed attempt, so a two-step form
  would also be safe now; the single form stays because it needs one round trip.
- **Problem details** carry the error key in both `title` and the `code` extension; the panel translates keys via
  `src/messages/fa.json` (`errors.*`) and field errors via `errors` (`field → [keys]`).
