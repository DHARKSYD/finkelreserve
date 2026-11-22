import { useState } from "react";
import { Activity } from "lucide-react";
import { EmptyState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { useTeamFeed, type FeedCategory } from "@/lib/queries/team";
import { QueryError } from "./QueryError";
import { CATEGORY_LABEL, dateTime } from "./team-format";

const FILTERS: FeedCategory[] = [
  "orders",
  "returns",
  "payments",
  "products",
  "inventory",
  "promotions",
  "reviews",
  "team",
  "sensitive",
];

// The audit feed for one person (userId) or for the whole team (userId null).
export function ActivityFeed({ userId }: { userId: string | null }) {
  const [category, setCategory] = useState<FeedCategory | null>(null);
  const feed = useTeamFeed(userId, category);
  const entries = feed.data?.pages.flat() ?? [];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filter activity">
        {[null, ...FILTERS].map((f) => (
          <button
            key={f ?? "all"}
            type="button"
            aria-pressed={category === f}
            onClick={() => setCategory(f)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              category === f
                ? "bg-primary text-primary-foreground"
                : "bg-surface-2 text-muted-foreground hover:text-foreground"
            }`}
          >
            {f ? CATEGORY_LABEL[f] : "All"}
          </button>
        ))}
      </div>

      {feed.isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading activity…</p>
      ) : feed.isError ? (
        <QueryError
          error={feed.error}
          fallback="Could not load the activity feed."
          onRetry={() => feed.refetch()}
        />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Nothing here yet"
          description="Actions taken in the admin area will appear here as they happen."
        />
      ) : (
        <>
          <ul className="glass divide-y divide-border/40 rounded-2xl px-4">
            {entries.map((e) => (
              <li key={e.id} className="flex items-start gap-3 py-3">
                <span
                  aria-hidden="true"
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    e.sensitive ? "bg-amber-400" : "bg-primary/50"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm break-words">{e.message}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {userId === null && e.actorName ? `${e.actorName} · ` : ""}
                    {CATEGORY_LABEL[e.category] ?? e.category} · {dateTime(e.createdAt)}
                  </p>
                </div>
                {e.sensitive && <StatusBadge label="Flagged" tone="warning" />}
              </li>
            ))}
          </ul>
          {feed.hasNextPage && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => feed.fetchNextPage()}
                disabled={feed.isFetchingNextPage}
                className="rounded-full bg-surface-2 px-5 py-2.5 text-sm font-bold disabled:opacity-60"
              >
                {feed.isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
