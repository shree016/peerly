/**
 * A typed, user-safe error. `message` is always safe to show to the caller —
 * never put personal data (emails, USNs, names) or internal details in it.
 */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public field?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export interface AppErrorBody {
  code: string;
  message: string;
  field?: string;
}

// Detected by shape rather than `instanceof`: client components import this
// file, and importing zod here would put it back into every page's bundle.
function validationErrorBody(error: unknown): AppErrorBody | null {
  if (!(error instanceof Error) || error.name !== "ZodError") return null;
  const issue = (
    error as Error & { issues?: { message: string; path: PropertyKey[] }[] }
  ).issues?.[0];
  if (!issue) return null;
  const field = issue.path.map(String).join(".");
  return {
    code: "VALIDATION_ERROR",
    message: issue.message,
    ...(field ? { field } : {}),
  };
}

export function appErrorBody(error: AppError): { error: AppErrorBody } {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.field ? { field: error.field } : {}),
    },
  };
}

/**
 * Result shape returned by server actions. Next.js masks thrown errors from
 * server actions in production, so actions return this instead of throwing.
 */
export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; error: AppErrorBody };

export async function runAction<T>(
  fn: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (isAppError(error)) return { ok: false, ...appErrorBody(error) };
    const invalid = validationErrorBody(error);
    if (invalid) return { ok: false, error: invalid };
    console.error("Unexpected server action error:", error);
    return {
      ok: false,
      error: {
        code: "INTERNAL",
        message: "Something went wrong. Please try again.",
      },
    };
  }
}

/** Client helper: unwraps an ActionResult or throws an Error with its message. */
export function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}
