import { createFileRoute } from "@tanstack/react-router";
import { Activity as ActivityIcon, RefreshCw } from "lucide-react";
import { useAdminActivity } from "@/lib/queries/activity";

export const Route = createFileRoute("/admin/activity")({
  head: () => ({ meta: [{ title: "Activity — Admin" }] }),
  component: ActivityPage,
});

function ActivityPage() {
  const { data: activity = [], isLoading, refetch, isFetching } = useAdminActivity();

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display font-black text-3xl md:text-4xl tracking-tighter">Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A record of admin actions and store events. Append-only — nothing here can be edited or
          cleared.
        </p>
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-lg flex items-center gap-2">
            <ActivityIcon className="h-4 w-4 text-primary" /> Log
          </h3>
          <button
            onClick={() => refetch()}
            className="h-8 w-8 grid place-items-center rounded-lg bg-surface-2 hover:text-primary"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing logged yet — orders and admin actions will show up here as they happen.
          </p>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {activity.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between text-sm border-b border-border/30 pb-3 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate">{a.message}</p>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mt-0.5">
                    {a.type} · {new Date(a.at).toLocaleString()}
                    {a.entityType && ` · ${a.entityType} ${a.entityId?.slice(0, 8)}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
