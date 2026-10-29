import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { backendFetch } from "@/lib/api/backend";
import { cookieNames } from "./cookies";

export interface StaffMe {
  id: string;
  username: string;
  roles: string[];
}

/** Access token for server components. The proxy has already refreshed it if it was due. */
export async function getAccessToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(cookieNames().access)?.value ?? null;
}

/** The signed-in staff member, or a redirect to /login. Cached per request. */
export const requireStaff = cache(async (): Promise<StaffMe> => {
  const token = await getAccessToken();
  if (!token) redirect("/login");
  const response = await backendFetch("/admin/v1/me", { token });
  if (response.status === 401) redirect("/login?reason=expired");
  if (!response.ok) throw new Error(`AdminApi /me failed with ${response.status}`);
  return (await response.json()) as StaffMe;
});
