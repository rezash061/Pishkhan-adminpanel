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

## 2. Platform health

The health page reads the AdminApi's own `/health/ready`, which today reports PostgreSQL and the two Redis
instances. The plan's health page also needs Kafka (consumer lag), ClamAV (signature age), object storage,
AI providers and the Meta API. Either add them as `ready`-tagged checks on the AdminApi host, or (better, because
they belong to other hosts) add `GET /admin/v1/platform/health` returning the same `{ status, checks }` shape
with one entry per dependency. The panel already renders any check names it receives.

## 3. Staff management (completes AD-0.2 / AD-2.7)

- `POST /admin/v1/staff/{id}/deactivate` and `/activate` (SuperAdmin, step-up, `reason` in body).
- `POST /admin/v1/staff/{id}/totp-reset` (SuperAdmin, step-up, `reason`): clears TOTP so the next sign-in re-enrolls.
- `PUT /admin/v1/staff/{id}/roles` (SuperAdmin, step-up).
- `GET /admin/v1/me/sessions` and `DELETE /admin/v1/me/sessions/{id}` for the settings page.
- Recovery codes at enrollment (admin plan 2.2 "show recovery codes once"): return them in the `ok` response of
  `/auth/totp/enroll`, and accept one in place of `totpCode` at login.

## 4. Phase 1 pages (BE-1.12)

Workspace detail tabs beyond the overview, plans editor, AI providers / routes / prompts / evals /
traces, file quarantine, Kafka / DLQ / workers / Meta app, feature flags, CMS and the home dashboard KPIs and
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
