/**
 * Supabase's PostgrestError extends the native Error class, so
 * `error instanceof Error` is true for it and `.message` is the raw
 * internal Postgres/PostgREST text — not something meant for display.
 * `throw error` directly is how that text can end up shown to a user
 * anywhere the caught error's `.message` gets rendered. Use this instead:
 * logs the real error for debugging, throws a safe one for display.
 */
export function throwSafe(error: unknown, fallbackMessage: string): never {
  console.error(error);
  throw new Error(fallbackMessage);
}
