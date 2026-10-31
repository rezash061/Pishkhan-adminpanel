"use client";

import { ApiError, readProblem } from "@/lib/problem";

function csrfToken(): string {
  for (const part of document.cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === "__Host-admin_csrf" || name === "admin_csrf") return decodeURIComponent(value.join("="));
  }
  return "";
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** A raw text body sent as is (for example NDJSON), instead of `body`. */
  text?: string;
  contentType?: string;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

/** Calls the app's own routes (`/api/...`). Throws ApiError with the backend problem on failure. */
export async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { accept: "application/json" };
  if (method !== "GET") headers["x-csrf-token"] = csrfToken();
  if (options.text !== undefined) headers["content-type"] = options.contentType ?? "text/plain; charset=utf-8";
  else if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.idempotencyKey) headers["idempotency-key"] = options.idempotencyKey;

  const response = await fetch(url, {
    method,
    headers,
    body: options.text !== undefined ? options.text : options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: "same-origin",
    cache: "no-store",
    signal: options.signal,
  });

  if (!response.ok) {
    const error = new ApiError(response.status, await readProblem(response));
    // A dead session anywhere but the sign-in screen sends the user back to it.
    if (response.status === 401 && !url.startsWith("/api/auth/") && typeof window !== "undefined") {
      const next = `${window.location.pathname}${window.location.search}`;
      // Full navigation on purpose: it drops every cached query of the dead session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/login?reason=expired&next=${encodeURIComponent(next)}`);
    }
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** AdminApi call through the BFF proxy: `admin("/staff")` → `/admin/v1/staff`. */
export function admin<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>(`/api/bff${path.startsWith("/") ? path : `/${path}`}`, options);
}
