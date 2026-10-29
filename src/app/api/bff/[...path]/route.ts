import { cookies } from "next/headers";
import { backendFetch } from "@/lib/api/backend";
import { cookieNames } from "@/lib/auth/cookies";
import { checkMutation } from "@/lib/auth/csrf";
import { problemResponse } from "@/lib/problem";

// Browser → AdminApi proxy: /api/bff/<path> → /admin/v1/<path> with the staff bearer token attached.
// A recent step-up token (5 minutes) is preferred so dangerous actions pass the backend's step-up filter.

const FORWARDED_HEADERS = ["content-type", "idempotency-key", "if-match"];

async function forward(request: Request, ctx: RouteContext<"/api/bff/[...path]">): Promise<Response> {
  const { path } = await ctx.params;
  if (path.length === 0 || path[0] === "auth" || path.some((s) => s === ".." || s === "." || s.includes("\\"))) {
    return problemResponse(404, "not_found");
  }

  const csrf = checkMutation(request);
  if (csrf) return problemResponse(403, csrf);

  const jar = await cookies();
  const names = cookieNames();
  const token = jar.get(names.stepUp)?.value ?? jar.get(names.access)?.value;
  if (!token) return problemResponse(401, "auth.unauthorized");

  const headers: Record<string, string> = {};
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers[name] = value;
  }

  const search = new URL(request.url).search;
  const hasBody = !["GET", "HEAD"].includes(request.method);
  let response: Response;
  try {
    response = await backendFetch(`/admin/v1/${path.map(encodeURIComponent).join("/")}${search}`, {
      method: request.method,
      token,
      headers,
      rawBody: hasBody ? await request.text() : null,
    });
  } catch {
    return problemResponse(502, "bff.upstream_unavailable");
  }

  const out = new Headers();
  for (const name of ["content-type", "content-disposition", "etag", "retry-after"]) {
    const value = response.headers.get(name);
    if (value) out.set(name, value);
  }
  out.set("cache-control", "no-store");
  return new Response(response.status === 204 ? null : await response.arrayBuffer(), { status: response.status, headers: out });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
