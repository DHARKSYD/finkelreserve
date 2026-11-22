import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Banknote, ChevronRight, Flag, UserPlus, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/admin/EmptyState";
import { StatCard } from "@/components/admin/StatCard";
import { SuperAdminGate } from "@/components/admin/SuperAdminGate";
import { AddAdminDialog } from "@/components/admin/team/AddAdminDialog";
import { ActivityFeed } from "@/components/admin/team/ActivityFeed";
import { PeriodFilter } from "@/components/admin/team/PeriodFilter";
import { QueryError } from "@/components/admin/team/QueryError";
import { IdleBadge, MemberStatusBadge, RoleBadge } from "@/components/admin/team/TeamBadges";
import { timeAgo } from "@/components/admin/team/team-format";
import { formatNGN } from "@/lib/currency";
import {
  LARGE_REFUND_NGN,
  rangeToPeriod,
  useTeam,
  useTeamPerformance,
  type TeamPerformance,
  type TeamRange,
} from "@/lib/queries/team";

export const Route = createFileRoute("/admin/team/")({
  head: () => ({ meta: [{ title: "Team | Admin" }] }),
  component: TeamPage,
});

function TeamPage() {
  return (
    <SuperAdminGate>
      <TeamOverview />
    </SuperAdminGate>
  );
}

const returnsProcessed = (p: TeamPerformance) =>
  p.returnsApproved + p.returnsRejected + p.returnsCompleted;

function TeamOverview() {
  const [range, setRange] = useState<TeamRange>("30d");
  const [addOpen, setAddOpen] = useState(false);
  const period = useMemo(() => rangeToPeriod(range), [range]);

  const team = useTeam();
  const performance = useTeamPerformance(period);

  const members = useMemo(() => team.data ?? [], [team.data]);
  const perfById = useMemo(
    () => new Map((performance.data ?? []).map((p) => [p.userId, p])),
    [performance.data],
  );

  const rows = performance.data ?? [];
  const totalActions = rows.reduce((n, p) => n + p.totalActions, 0);
  const refundCount = rows.reduce((n, p) => n + p.refundsCount, 0);
  const refundValue = rows.reduce((n, p) => n + p.refundsValue, 0);
  const flagged = rows.reduce((n, p) => n + p.sensitiveActions, 0);
  const activeCount = members.filter((m) => m.status === "active").length;

  const chartData = members
    .map((m) => ({ label: m.name, actions: perfById.get(m.userId)?.totalActions ?? 0 }))
    .sort((a, b) => b.actions - a.actions)
    .slice(0, 12);

  return (
    <div className="min-w-0">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary font-mono">Team</p>
          <h1 className="font-display font-black text-3xl md:text-4xl tracking-tighter">
            Admin team
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Who has access, what they have been doing, and what needs a second look.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold"
        >
          <UserPlus className="h-4 w-4" />
          Add admin
        </button>
      </div>

      <div className="mb-6">
        <PeriodFilter value={range} onChange={setRange} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-8">
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Active admins"
          value={team.isLoading ? "-" : String(activeCount)}
        />
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          label="Actions in period"
          value={performance.isLoading ? "-" : totalActions.toLocaleString()}
        />
        <StatCard
          icon={<Banknote className="h-4 w-4" />}
          label={`Refunds issued (${refundCount})`}
          value={performance.isLoading ? "-" : formatNGN(refundValue)}
        />
        <StatCard
          icon={<Flag className="h-4 w-4" />}
          label="Flagged for review"
          value={performance.isLoading ? "-" : String(flagged)}
          accent={flagged > 0}
        />
      </div>

      <section className="glass rounded-2xl p-5 mb-8">
        <h2 className="font-display font-bold text-lg">Actions by person</h2>
        {performance.isError ? (
          <QueryError
            error={performance.error}
            fallback="Could not load team performance."
            onRetry={() => performance.refetch()}
          />
        ) : totalActions === 0 && !performance.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No admin actions were recorded in this period.
          </p>
        ) : (
          <div className="mt-4" style={{ height: Math.max(160, chartData.length * 44 + 32) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={112}
                  interval={0}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)}
                />
                <Tooltip
                  cursor={{ fill: "var(--surface-2)" }}
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar
                  dataKey="actions"
                  name="Actions"
                  fill="var(--primary)"
                  radius={[0, 6, 6, 0]}
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <h2 className="font-display font-bold text-lg mb-3">People</h2>
      {team.isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading the team…</p>
      ) : team.isError ? (
        <QueryError
          error={team.error}
          fallback="Could not load the team."
          onRetry={() => team.refetch()}
        />
      ) : members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No admins yet"
          description="Add the first person with the button above."
        />
      ) : (
        <>
          {/* Phones: one card per person. */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {members.map((m) => {
              const p = perfById.get(m.userId);
              return (
                <Link
                  key={m.userId}
                  to="/admin/team/$userId"
                  params={{ userId: m.userId }}
                  className={`glass block rounded-2xl p-4 ${m.status === "active" ? "" : "opacity-70"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground mt-1" />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <RoleBadge isSuperAdmin={m.isSuperAdmin} />
                    <MemberStatusBadge status={m.status} />
                    <IdleBadge member={m} />
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <dd className="font-display font-black text-lg">
                        {p ? p.totalActions : "-"}
                      </dd>
                      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Actions
                      </dt>
                    </div>
                    <div>
                      <dd className="font-display font-black text-lg">
                        {p ? p.ordersHandled : "-"}
                      </dd>
                      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Orders
                      </dt>
                    </div>
                    <div>
                      <dd className="font-display font-black text-lg">
                        {p ? p.refundsCount : "-"}
                      </dd>
                      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Refunds
                      </dt>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Last action {timeAgo(m.lastActionAt).toLowerCase()}
                  </p>
                </Link>
              );
            })}
          </div>

          {/* Tablets and up: a table. */}
          <div className="hidden md:block max-w-full overflow-x-auto glass rounded-2xl">
            <table className="w-full min-w-[960px] text-sm">
              <caption className="sr-only">
                Admin team members and their numbers for the selected period
              </caption>
              <thead className="text-left text-xs uppercase tracking-[0.15em] text-muted-foreground border-b border-border">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Person
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Actions
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Orders
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Returns
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Refunds
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Last action
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Last sign-in
                  </th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const p = perfById.get(m.userId);
                  return (
                    <tr
                      key={m.userId}
                      className={`border-b border-border/40 ${m.status === "active" ? "" : "opacity-70"}`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold">{m.name}</p>
                        <p className="break-all text-xs text-muted-foreground">{m.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <RoleBadge isSuperAdmin={m.isSuperAdmin} />
                          <MemberStatusBadge status={m.status} />
                          <IdleBadge member={m} />
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold">{p ? p.totalActions : "-"}</td>
                      <td className="px-4 py-3">{p ? p.ordersHandled : "-"}</td>
                      <td className="px-4 py-3">{p ? returnsProcessed(p) : "-"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {p ? `${p.refundsCount} (${formatNGN(p.refundsValue)})` : "-"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{timeAgo(m.lastActionAt)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{timeAgo(m.lastSignInAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to="/admin/team/$userId"
                          params={{ userId: m.userId }}
                          className="inline-flex items-center gap-1 text-primary font-semibold hover:underline"
                        >
                          View
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="mt-6 text-xs text-muted-foreground max-w-2xl">
        Numbers come from the audit trail plus the refund and stock records. Deletions, new coupons,
        team changes and refunds of {formatNGN(LARGE_REFUND_NGN)} or more are flagged for review.
      </p>

      <h2 className="font-display font-bold text-lg mt-10 mb-3">Recent team activity</h2>
      <ActivityFeed userId={null} />

      <AddAdminDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
