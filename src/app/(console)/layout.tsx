import type { ReactNode } from "react";
import { ConsoleShell } from "@/components/console/console-shell";
import { requireStaff } from "@/lib/auth/session";
import { isMockApi } from "@/lib/config";

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const staff = await requireStaff();
  return (
    <ConsoleShell staff={{ id: staff.id, username: staff.username, roles: staff.roles }} mock={isMockApi()}>
      {children}
    </ConsoleShell>
  );
}
