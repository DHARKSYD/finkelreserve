import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeft,
  Banknote,
  Boxes,
  Clock,
  Flag,
  Package,
  RotateCcw,
  ShoppingBag,
  UserX,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/admin/EmptyState";
import { StatCard } from "@/components/admin/StatCard";
import { SuperAdminGate } from "@/components/admin/SuperAdminGate";
import { ActionMix } from "@/components/admin/team/ActionMix";
import { ActivityFeed } from "@/components/admin/team/ActivityFeed";
import { MemberActions } from "@/components/admin/team/MemberActions";
import { MemberNote } from "@/components/admin/team/MemberNote";
import { PeriodFilter } from "@/components/admin/team/PeriodFilter";
import { QueryError } from "@/components/admin/team/QueryError";
import { IdleBadge, MemberStatusBadge, RoleBadge } from "@/components/admin/team/TeamBadges";
import {
  dayLabel,
  dayLabelLong,
  responseTime,
  shortDate,
  timeAgo,
} from "@/components/admin/team/team-format";
import { formatNGN } from "@/lib/currency";
import {
  rangeToPeriod,
  useTeam,
  useTeamDaily,
  useTeamPerformance,
  type TeamRange,
} from "@/lib/queries/team";

export const Route = createFileRoute("/admin/team/$userId")({
  head: () => ({ meta: [{ title: "Team member | Admin" }] }),
  component: MemberPage,
});

function MemberPage() {
  return (
    <SuperAdminGate>
      <MemberDetail />
    </SuperAdminGate>
  );
}

function MemberDetail() {
  const { userId } = Route.useParams();
  const [range, setRange] = useState<TeamRange>("30d");
  const period = useMemo(() => rangeToPeriod(range), [range]);

  const team = useTeam();
  const performance = useTeamPerformance(period);
  const daily = useTeamDaily(userId, period);

  const member = team.data?.find((m) => m.userId === userId);
  const perf = performance.data?.find((p) => p.userId === userId);

  const back = (
    <Link
      to="/admin/team"
      className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Team
    </Link>
  );

  if (team.isLoading) {
    return (
      <div>
        {back}
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (team.isError) {
    return (
      <div>
        {back}
        <QueryError
          error={team.error}
          fallback="Could not load the team."
          onRetry={() => team.refetch()}
        />
      </div>
    );
  }

  if (!member) {
    return (
      <div>
        {back}
        <EmptyState
          icon={UserX}
          title="Not on the admin team"
          description="This person has never been an admin, or the link is wrong."
        />
      </div>
    );
  }

  const returnsDone = perf
    ? perf.returnsApproved + perf.returnsRejected + perf.returnsCompleted
    : 0;
  const loading = performance.isLoading;
  const dash = (value: string) => (loading || !perf ? "-" : value);

  return (
    <div>
      {back}

      <div className="mb-6">
        <h1 className="font-display font-black text-3xl md:text-4xl tracking-tighter break-words">
          {member.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground break-all">{member.email}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <RoleBadge isSuperAdmin={member.isSuperAdmin} />
          <MemberStatusBadge status={member.status} />
          <IdleBadge member={member} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Added {shortDate(member.addedAt)}
          {member.addedByName ? ` by ${member.addedByName}` : ""}. Last action{" "}
          {timeAgo(member.lastActionAt).toLowerCase()}. Last sign-in{" "}
          {timeAgo(member.lastSignInAt).toLowerCase()}.
        </p>
        {member.status === "active" && !member.hasAdminRole && (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            This account is marked active but has no admin role, so it cannot use the admin area.
            Suspend it and then reactivate it to repair that.
          </p>
        )}
      </div>

      <div className="mb-6">
        <PeriodFilter value={range} onChange={setRange} />
      </div>

      {performance.isError ? (
        <QueryError
          error={performance.error}
          fallback="Could not load this person's numbers."
          onRetry={() => performance.refetch()}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-3">
          <StatCard
            icon={<Activity className="h-4 w-4" />}
            label="Actions"
            value={dash(String(perf?.totalActions ?? 0))}
          />
          <StatCard
            icon={<ShoppingBag className="h-4 w-4" />}
            label="Orders handled"
            value={dash(String(perf?.ordersHandled ?? 0))}
          />
          <StatCard
            icon={<RotateCcw className="h-4 w-4" />}
            label="Returns processed"
            value={dash(String(returnsDone))}
          />
          <StatCard
            icon={<Banknote className="h-4 w-4" />}
            label={`Refunds issued (${perf?.refundsCount ?? 0})`}
            value={dash(formatNGN(perf?.refundsValue ?? 0))}
          />
          <StatCard
            icon={<Boxes className="h-4 w-4" />}
            label={`Stock changes (${perf?.inventoryChanges ?? 0})`}
            value={dash(`${(perf?.inventoryUnitsAdjusted ?? 0).toLocaleString()} units`)}
          />
          <StatCard
            icon={<Package className="h-4 w-4" />}
            label="Product changes"
            value={dash(String(perf?.productActions ?? 0))}
          />
          <StatCard
            icon={<Clock className="h-4 w-4" />}
            label={`Return response (${perf?.returnsFirstActions ?? 0})`}
            value={dash(responseTime(perf?.avgReturnResponseHours ?? null))}
          />
          <StatCard
            icon={<Flag className="h-4 w-4" />}
            label="Flagged for review"
            value={dash(String(perf?.sensitiveActions ?? 0))}
            accent={(perf?.sensitiveActions ?? 0) > 0}
          />
        </div>
      )}
      {perf && returnsDone > 0 && (
        <p className="mb-8 text-xs text-muted-foreground">
          Returns: {perf.returnsApproved} approved, {perf.returnsRejected} rejected,{" "}
          {perf.returnsCompleted} completed. Return response is the average time from a customer's
          request to this person's first action on it.
        </p>
      )}

      {perf && <ActionMix perf={perf} />}

      <section className="glass rounded-2xl p-5 mb-8">
        <h2 className="font-display font-bold text-lg">Activity over time</h2>
        {daily.isError ? (
          <QueryError
            error={daily.error}
            fallback="Could not load the chart."
            onRetry={() => daily.refetch()}
          />
        ) : (
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily.data ?? []} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                  tickFormatter={dayLabel}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--surface-2)" }}
                  labelFormatter={dayLabelLong}
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="actions" name="Actions" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-8">
        <section className="glass rounded-2xl p-5">
          <h2 className="font-display font-bold text-lg mb-3">Access</h2>
          <MemberActions member={member} />
        </section>
        {!member.isSuperAdmin && (
          <section className="glass rounded-2xl p-5">
            <h2 className="font-display font-bold text-lg mb-3">Note</h2>
            <MemberNote key={member.userId} member={member} />
          </section>
        )}
      </div>

      <h2 className="font-display font-bold text-lg mb-3">Recent activity</h2>
      <ActivityFeed userId={member.userId} />
    </div>
  );
}
