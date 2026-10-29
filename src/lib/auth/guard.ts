import { can, type Permission } from "@/lib/permissions";
import { requireStaff, type StaffMe } from "./session";

/** Page-level permission check. Returns the staff member, or null when the page should render Forbidden. */
export async function staffWith(permission: Permission): Promise<StaffMe | null> {
  const staff = await requireStaff();
  return can(staff.roles, permission) ? staff : null;
}
