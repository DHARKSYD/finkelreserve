// A failed load, with a way to try again. Used wherever a Team query can fail.
export function QueryError({
  error,
  fallback,
  onRetry,
}: {
  error: unknown;
  fallback: string;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="py-8 text-center">
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : fallback}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-full bg-surface-2 px-5 py-2 text-sm font-bold"
      >
        Try again
      </button>
    </div>
  );
}
