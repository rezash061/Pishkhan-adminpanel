/** RFC 9457 problem details as returned by the AdminApi. `title` and `code` carry the machine-readable error key. */
export interface Problem {
  type?: string | null;
  title?: string | null;
  status?: number | null;
  detail?: string | null;
  code?: string | null;
  traceId?: string | null;
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: Problem,
  ) {
    super(problem.code ?? problem.title ?? `HTTP ${status}`);
    this.name = "ApiError";
  }

  /** The backend error key, for example `auth.login.invalid_credentials`. */
  get code(): string | undefined {
    return this.problem.code ?? this.problem.title ?? undefined;
  }

  get fieldErrors(): Record<string, string[]> {
    return this.problem.errors ?? {};
  }
}

export const STEP_UP_REQUIRED = "auth.step_up.required";

export function isStepUpRequired(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403 && error.code === STEP_UP_REQUIRED;
}

export async function readProblem(response: Response): Promise<Problem> {
  try {
    const body = (await response.json()) as Problem;
    return { status: response.status, ...body };
  } catch {
    return { status: response.status, title: `http.${response.status}` };
  }
}

export function problemResponse(status: number, code: string, init?: ResponseInit): Response {
  return Response.json(
    { type: `https://pishkhan.ir/problems/${status === 401 ? "unauthorized" : status === 403 ? "forbidden" : "bff"}`, title: code, status, code },
    { ...init, status, headers: { "content-type": "application/problem+json", ...init?.headers } },
  );
}
