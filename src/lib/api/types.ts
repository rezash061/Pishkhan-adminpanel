// DTOs of the AdminApi (backend/openapi/admin.v1.json in rezash061/pishkhan-backend).
// Types marked "proposed" are not in the backend yet; see docs/backend-requests.md.

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

/** Proposed: `GET /admin/v1/audit`. */
export interface AuditEntry {
  id: string;
  occurredAt: string;
  actorType: "staff" | "user" | "system";
  actorId: string | null;
  actorName: string;
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
