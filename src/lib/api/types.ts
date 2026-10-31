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
