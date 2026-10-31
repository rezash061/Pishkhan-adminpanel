// Staff roles and the permissions the UI derives from them (admin plan section 3).
// The backend is the source of truth and enforces every check; this only decides what to show.

export const STAFF_ROLES = ["SuperAdmin", "Support", "Finance", "ContentEditor", "AIOps", "ReadOnly"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const PERMISSIONS = [
  "dashboard.read",
  "staff.read",
  "staff.manage",
  "audit.read",
  "platform.health.read",
  "workspaces.read",
  "workspaces.impersonate",
  "users.read",
  "leads.read",
  "billing.read",
  "billing.refund",
  "ai.read",
  "ai.manage",
  "content.manage",
  "files.quarantine",
  "export",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  SuperAdmin: PERMISSIONS,
  Support: [
    "dashboard.read",
    "audit.read",
    "platform.health.read",
    "workspaces.read",
    "workspaces.impersonate",
    "users.read",
    "leads.read",
    "files.quarantine",
  ],
  Finance: ["dashboard.read", "billing.read", "billing.refund", "workspaces.read", "export"],
  ContentEditor: ["dashboard.read", "content.manage"],
  AIOps: ["dashboard.read", "ai.read", "ai.manage", "platform.health.read"],
  ReadOnly: ["dashboard.read", "platform.health.read", "workspaces.read", "users.read", "billing.read", "ai.read"],
};

export function isStaffRole(value: string): value is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(value);
}

/** Unknown roles from the backend grant nothing. */
export function permissionsFor(roles: readonly string[]): Set<Permission> {
  const result = new Set<Permission>();
  for (const role of roles) {
    if (isStaffRole(role)) ROLE_PERMISSIONS[role].forEach((p) => result.add(p));
  }
  return result;
}

export function can(roles: readonly string[], permission: Permission): boolean {
  return permissionsFor(roles).has(permission);
}

export type NavIcon = "home" | "staff" | "audit" | "health" | "settings" | "leads" | "support";

export interface NavItem {
  href: string;
  /** Key under `nav` in messages/fa.json. */
  labelKey: string;
  icon: NavIcon;
  permission: Permission | null;
  section: "main" | "support" | "security" | "platform" | "account";
}

// Only pages that exist are listed. Workspaces, billing, AI and content join as their AdminApi endpoints land (BE-1.12).
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", labelKey: "home", icon: "home", permission: "dashboard.read", section: "main" },
  { href: "/leads", labelKey: "leads", icon: "leads", permission: "leads.read", section: "main" },
  { href: "/support/sessions", labelKey: "supportSessions", icon: "support", permission: "workspaces.impersonate", section: "support" },
  { href: "/security/audit-log", labelKey: "auditLog", icon: "audit", permission: "audit.read", section: "security" },
  { href: "/security/staff", labelKey: "staff", icon: "staff", permission: "staff.read", section: "security" },
  { href: "/platform/health", labelKey: "health", icon: "health", permission: "platform.health.read", section: "platform" },
  { href: "/settings", labelKey: "settings", icon: "settings", permission: null, section: "account" },
];

export function navFor(roles: readonly string[]): NavItem[] {
  const granted = permissionsFor(roles);
  return NAV_ITEMS.filter((item) => item.permission === null || granted.has(item.permission));
}
