/**
 * Safe error serialization for API responses.
 * Never leaks stack traces or internal messages in production.
 */
export function apiError(
  err: unknown,
  fallback = "Internal server error",
): { error: string } {
  if (process.env.NODE_ENV !== "production") {
    // Dev: return the real message to help debugging
    if (err instanceof Error) return { error: err.message };
    if (typeof err === "string") return { error: err };
  }
  return { error: fallback };
}

/**
 * Log an error to the console (with stack in dev, message-only in prod).
 */
export function logError(context: string, err: unknown): void {
  if (process.env.NODE_ENV === "production") {
    console.error(`[${context}]`, err instanceof Error ? err.message : String(err));
  } else {
    console.error(`[${context}]`, err);
  }
}
