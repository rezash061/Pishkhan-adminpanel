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
