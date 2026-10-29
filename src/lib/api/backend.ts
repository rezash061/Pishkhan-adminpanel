import { adminApiUrl, isMockApi } from "@/lib/config";

export interface BackendInit {
  method?: string;
  body?: unknown;
  token?: string | null;
  headers?: Record<string, string>;
  /** Raw body passed through unchanged (BFF proxy). Takes precedence over `body`. */
  rawBody?: BodyInit | null;
  signal?: AbortSignal;
}

/**
 * Server-side call to the AdminApi host. Never import this into client components: it is the only place that
 * attaches staff bearer tokens. With ADMIN_API_URL=mock it is answered by the in-process mock instead.
 */
export async function backendFetch(path: string, init: BackendInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (init.token) headers.set("authorization", `Bearer ${init.token}`);
  let body: BodyInit | null | undefined = init.rawBody;
  if (body === undefined && init.body !== undefined) {
    body = JSON.stringify(init.body);
    headers.set("content-type", "application/json");
  }

  const mock = isMockApi();
  const request = new Request(`${mock ? "http://mock.invalid" : adminApiUrl()}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: body ?? null,
    signal: init.signal ?? AbortSignal.timeout(15_000),
    cache: "no-store",
  });

  if (mock) {
    const { handleMockRequest } = await import("@/mocks/admin-api");
    return handleMockRequest(request);
  }
  return fetch(request);
}
