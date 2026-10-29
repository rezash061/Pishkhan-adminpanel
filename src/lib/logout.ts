"use client";

import { request } from "@/lib/api/client";

export async function logout(reason: "idle" | "loggedOut"): Promise<void> {
  try {
    await request("/api/auth/logout", { method: "POST" });
  } finally {
    // Full navigation on purpose: it drops every cached query of the ended session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/login?reason=${reason}`);
  }
}
