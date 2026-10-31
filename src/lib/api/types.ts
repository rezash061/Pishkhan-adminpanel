// DTOs of the AdminApi (backend/openapi/admin.v1.json in rezash061/pishkhan-backend).

export interface StaffSummary {
  id: string;
  username: string;
  roles: string[];
  status: string;
  totpEnabled: boolean;
  createdAt: string;
}

export interface CreateStaffRequest {
  username: string;
  password: string;
  roles: string[];
}

export interface HealthReport {
  status: string;
  checks: Record<string, { status: string; ms: number }>;
}

/** `GET /admin/v1/audit`. Support staff only receive workspace-scoped entries. */
export interface AuditEntry {
  id: string;
  occurredAt: string;
  actorType: "staff" | "user" | "system";
  actorId: string | null;
  actorName: string;
  /** Set when a staff member acted while impersonating this user. */
  onBehalfOf: string | null;
  workspaceId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  reason: string | null;
  ip: string | null;
  before: unknown;
  after: unknown;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** `GET /admin/v1/leads` (SuperAdmin, Support): website waitlist and contact-form submissions. */
export interface Lead {
  id: string;
  type: "waitlist" | "contact" | string;
  phone: string;
  name: string | null;
  instagramHandle: string | null;
  vertical: string | null;
  monthlyDms: string | null;
  message: string | null;
  utm: Record<string, string>;
  /** How many times the same phone submitted this form. */
  submissions: number;
  createdAt: string;
  updatedAt: string;
}

/** `POST /admin/v1/workspaces/{workspaceId}/support-sessions` (Support, step-up). */
export interface StartSupportSessionRequest {
  reason: string;
  userId: string | null;
}

/** A one-time user-panel link. Never stored by the admin panel. */
export interface SupportSessionLink {
  url: string;
  expiresAt: string;
}

/** Workspace status names of `GET /admin/v1/workspaces` (backend PR #19). */
export const WORKSPACE_STATUSES = ["active", "suspended", "pending_deletion", "deleted"] as const;
export const WORKSPACE_INDUSTRIES = ["clothing", "cosmetics", "jewelry", "beauty_clinic", "courses", "other"] as const;

export interface AdminWorkspaceOwner {
  id: string;
  displayName: string | null;
  maskedPhone: string;
}

/** A connected account. `status`: connecting, active, token_expiring, reauth_required, disconnected. */
export interface AdminWorkspaceChannel {
  id: string;
  kind: string;
  username: string | null;
  status: string;
  statusReason: string | null;
  statusChangedAt: string | null;
  tokenExpiresAt: string | null;
  connectedAt: string;
}

/** A row of `GET /admin/v1/workspaces` (SuperAdmin, Support, Finance, ReadOnly). */
export interface AdminWorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  industry: string;
  status: string;
  createdAt: string;
  deletionScheduledFor: string | null;
  owner: AdminWorkspaceOwner | null;
  memberCount: number;
  channels: AdminWorkspaceChannel[];
}

export interface AdminWorkspaceMember {
  userId: string;
  displayName: string | null;
  maskedPhone: string | null;
  /** owner, admin, agent or viewer. */
  role: string;
  joinedAt: string;
}

/** `GET /admin/v1/workspaces/{workspaceId}`. Deleted workspaces are still returned. */
export interface AdminWorkspaceDetail {
  id: string;
  name: string;
  slug: string;
  industry: string;
  timeZone: string;
  status: string;
  planId: string | null;
  createdAt: string;
  deletionRequestedAt: string | null;
  deletionScheduledFor: string | null;
  deletedAt: string | null;
  owner: AdminWorkspaceOwner | null;
  members: AdminWorkspaceMember[];
  channels: AdminWorkspaceChannel[];
  pendingInvitations: number;
}

export const USER_STATUSES = ["active", "suspended"] as const;

/** A row of `GET /admin/v1/users` (SuperAdmin, Support, Finance, ReadOnly). Also returned by the user actions. */
export interface AdminUserSummary {
  id: string;
  displayName: string | null;
  maskedPhone: string;
  /** active or suspended (blocked). */
  status: string;
  totpEnabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  /** Signed-in devices; support sessions are not counted. */
  activeSessions: number;
}

/** One signed-in device. `id` is the session family, stable across refreshes. */
export interface AdminUserSession {
  id: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  ip: string | null;
  userAgent: string | null;
  /** For example otp or otp+totp. */
  authMethods: string;
}

export interface UserMembership {
  workspaceId: string;
  workspaceName: string;
  workspaceStatus: string;
  role: string;
  joinedAt: string;
}

/** `GET /admin/v1/users/{userId}`. */
export interface AdminUserDetail {
  id: string;
  displayName: string | null;
  maskedPhone: string;
  status: string;
  totpEnabled: boolean;
  hasPassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  workspaces: UserMembership[];
  sessions: AdminUserSession[];
}

/** `POST /admin/v1/users/{id}/sessions/revoke`, `/block`, `/unblock` (Support, step-up). */
export interface AdminUserActionRequest {
  reason: string;
}

/** Money in Rial; staff see and type Toman (Rial ÷ 10). */
export interface Money {
  amount: number;
  currency: "IRR";
}

export const PLAN_STATUSES = ["draft", "published", "archived"] as const;
/** Limit meters of a plan; a missing or null limit is unlimited. */
export const BILLING_METERS = ["ai_conversations", "ai_messages", "channel_accounts", "seats", "receipt_verifications", "sms"] as const;

/** One line of the pricing card. */
export interface PlanFeature {
  key: string;
  label: string;
  included: boolean;
  limit: string | null;
}

/** The editable content of a plan version (`PUT /admin/v1/plans/{id}`, and `plan` in `POST /admin/v1/plans`). */
export interface PlanRequest {
  name: string;
  tagline: string | null;
  description: string | null;
  monthly: Money;
  annual: Money | null;
  overagePerConversation: Money | null;
  limits: Record<string, number | null>;
  features: PlanFeature[];
  isPublic: boolean;
  isFree: boolean;
  highlighted: boolean;
  sortOrder: number;
}

/** One version of a plan (backend PR #22). `status`: draft, published, archived. */
export interface Plan extends PlanRequest {
  id: string;
  code: string;
  version: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

/** A subscription. `state`: active, trialing, expired, ended. */
export interface SubscriptionInfo {
  id: string;
  planId: string;
  planCode: string;
  planVersion: number;
  state: string;
  trial: boolean;
  startsAt: string;
  endsAt: string | null;
  endedAt: string | null;
  endReason: string | null;
}

/** The workspace's plan now. `source`: subscription, free (the published free plan) or none (nothing limited). */
export interface CurrentPlan {
  source: string;
  planId: string | null;
  planCode: string | null;
  planName: string | null;
  planVersion: number | null;
  trial: boolean;
  endsAt: string | null;
  limits: Record<string, number | null>;
  subscription: SubscriptionInfo | null;
}

export interface UsageMeter {
  meter: string;
  used: number;
  limit: number | null;
}

/** `GET /admin/v1/workspaces/{id}/billing` (backend PR #23). History is newest first. */
export interface AdminWorkspaceBilling {
  current: CurrentPlan;
  usage: { periodStart: string; periodEnd: string; meters: UsageMeter[] };
  history: SubscriptionInfo[];
}

/** `POST /admin/v1/workspaces/{id}/subscription`: `endsAt` or `days` (1 to 1095) or neither (until cancelled; not for a trial). */
export interface GrantPlanRequest {
  planId: string;
  trial: boolean;
  endsAt: string | null;
  days: number | null;
  reason: string;
}
