"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { permissionsFor, type Permission } from "@/lib/permissions";

interface StaffContextValue {
  id: string;
  username: string;
  roles: string[];
  can: (permission: Permission) => boolean;
}

const StaffContext = createContext<StaffContextValue | null>(null);

export function StaffProvider({ staff, children }: { staff: { id: string; username: string; roles: string[] }; children: ReactNode }) {
  const value = useMemo(() => {
    const granted = permissionsFor(staff.roles);
    return { ...staff, can: (p: Permission) => granted.has(p) };
  }, [staff]);
  return <StaffContext.Provider value={value}>{children}</StaffContext.Provider>;
}

export function useStaff(): StaffContextValue {
  const value = useContext(StaffContext);
  if (!value) throw new Error("useStaff must be used inside the console layout");
  return value;
}
