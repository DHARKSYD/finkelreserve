import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, ShoppingBag, DollarSign, Percent, RotateCcw } from "lucide-react";
import { useAnalyticsData } from "@/lib/queries/analytics";
import { StatCard } from "@/components/admin/StatCard";
import { formatNGN } from "@/lib/currency";

// Native date helpers — avoids the date-fns type-declaration gap in this install.
const subDays = (date: Date, n: number): Date => new Date(date.getTime() - n * 86_400_000);

const formatDay = (date: Date): string =>
  date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Admin" }] }),
  component: AnalyticsPage,
});

const STATUS_COLORS: Record<string, string> = {
  pending: "#eab308",
  processing: "#22c55e",
  shipped: "#3b82f6",
  delivered: "#10b981",
  cancelled: "#ef4444",
};

const CHART_COLORS = ["#22c55e", "#3b82f6", "#a855f7", "#f59e0b", "#ef4444"];

const RANGES = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "12 months", days: 365 },
];

function AnalyticsPage() {
  const [rangeDays, setRangeDays] = useState(30);
  const since = useMemo(() => subDays(new Date(), rangeDays).getTime(), [rangeDays]);
  const { data, isLoading } = useAnalyticsData(since);

  const metrics = useMemo(() => {
    const orders = data?.orders ?? [];
    const items = data?.items ?? [];
    const refunds = data?.refunds ?? [];
    const now = Date.now();
    const trendDays = Math.min(rangeDays, 30); // day-by-day trend stays readable at 30 points max even on a 12-month range

    // Revenue = payment_status 'paid', full stop — this used to also count
    // every payment_method='delivery' order regardless of payment_status,
    // which double-counted pay-on-delivery orders that hadn't been
    // delivered (and therefore paid) yet. Now that delivery correctly
    // flips POD orders to payment_status='paid' (see the Settings/Returns
    // session), a single unified check is both simpler and correct for
    // both payment methods.
    const paidOrders = orders.filter((o) => o.status !== "cancelled" && o.paymentStatus === "paid");
    const paidRevenue = paidOrders.reduce((s, o) => s + o.total, 0);
    const refundedAmount = refunds.reduce((s, r) => s + r.amount, 0);
    const netRevenue = paidRevenue - refundedAmount;

    const totalOrders = orders.length;
    const avgOrderValue = paidOrders.length ? paidRevenue / paidOrders.length : 0;
    const completionRate = totalOrders ? Math.round((paidOrders.length / totalOrders) * 100) : 0;

    const revenueByDay = new Map<string, number>();
    paidOrders
      .filter((o) => o.createdAt >= subDays(new Date(now), trendDays).getTime())
      .forEach((o) => {
        const key = formatDay(new Date(o.createdAt));
        revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + o.total);
      });

    const revenueChart: { date: string; revenue: number }[] = [];
    for (let i = trendDays - 1; i >= 0; i--) {
      const d = subDays(new Date(now), i);
      const key = formatDay(d);
      revenueChart.push({ date: key, revenue: revenueByDay.get(key) ?? 0 });
    }

    const statusCounts = orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1;
      return acc;
    }, {});
    const statusChart = Object.entries(statusCounts).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      status,
      value: count,
    }));

    // Top products — same paid-revenue definition as the headline metric,
    // not just "not cancelled". A chart titled "by revenue" should agree
    // with what the revenue KPI above it actually counts as revenue.
    const paidOrderIds = new Set(paidOrders.map((o) => o.id));
    const productRevenue = new Map<string, number>();
    items
      .filter((i) => paidOrderIds.has(i.orderId))
      .forEach((item) => {
        const rev = productRevenue.get(item.name) ?? 0;
        productRevenue.set(item.name, rev + item.price * item.qty);
      });

    const topProducts = [...productRevenue.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([name, revenue]) => ({
        name: name.length > 22 ? name.slice(0, 20) + "…" : name,
        fullName: name,
        revenue,
      }));

    const methodCounts: Record<string, number> = {};
    paidOrders.forEach((o) => {
      const key = o.paymentMethod === "delivery" ? "Pay on delivery" : "Online (Paystack)";
      methodCounts[key] = (methodCounts[key] ?? 0) + 1;
    });
    const paymentChart = Object.entries(methodCounts).map(([name, count]) => ({ name, count }));

    return {
      paidRevenue,
      refundedAmount,
      netRevenue,
      totalOrders,
      avgOrderValue,
      completionRate,
      revenueChart,
      statusChart,
      topProducts,
      paymentChart,
    };
  }, [data, rangeDays]);

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary font-mono">— Insights</p>
          <h1 className="mt-2 font-display font-black text-4xl md:text-5xl tracking-tighter">
            Analytics
          </h1>
          <p className="mt-2 text-muted-foreground">
            Revenue = paid orders only, refunds netted out. Cancelled orders excluded throughout.
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setRangeDays(r.days)}
              className={`px-3.5 py-2 rounded-full text-xs font-bold transition ${
                rangeDays === r.days
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-2 text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        <StatCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Net Revenue"
          value={isLoading ? "—" : formatNGN(metrics.netRevenue)}
        />
        <StatCard
          icon={<RotateCcw className="h-4 w-4" />}
          label="Refunded"
          value={isLoading ? "—" : formatNGN(metrics.refundedAmount)}
          accent={metrics.refundedAmount > 0}
        />
        <StatCard
          icon={<ShoppingBag className="h-4 w-4" />}
          label="Total Orders"
          value={isLoading ? "—" : String(metrics.totalOrders)}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Avg Order Value"
          value={isLoading ? "—" : formatNGN(metrics.avgOrderValue)}
        />
        <StatCard
          icon={<Percent className="h-4 w-4" />}
          label="Completion Rate"
          value={isLoading ? "—" : `${metrics.completionRate}%`}
        />
      </div>

      <div className="glass rounded-2xl p-5 mb-5">
        <h3 className="font-display font-bold text-lg mb-1">
          Revenue — last {Math.min(rangeDays, 30)} days
        </h3>
        <p className="text-xs text-muted-foreground mb-5">
          {rangeDays > 30
            ? `Daily trend caps at 30 points for readability, even though the range above covers ${rangeDays} days.`
            : "Paid orders only; cancelled excluded, refunds not yet netted out day-by-day (only in the total above)."}
        </p>
        {isLoading ? (
          <div className="h-52 grid place-items-center text-sm text-muted-foreground">Loading…</div>
        ) : metrics.revenueChart.every((d) => d.revenue === 0) ? (
          <div className="h-52 grid place-items-center text-sm text-muted-foreground">
            No revenue data for this period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart
              data={metrics.revenueChart}
              margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
            >
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                interval={6}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) =>
                  v >= 1_000_000
                    ? `₦${(v / 1_000_000).toFixed(1)}M`
                    : v >= 1_000
                      ? `₦${(v / 1_000).toFixed(0)}K`
                      : `₦${v}`
                }
                width={64}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.75rem",
                  fontSize: 12,
                }}
                formatter={(value: number) => [formatNGN(value), "Revenue"]}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#revenueGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "#22c55e" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <div className="glass rounded-2xl p-5">
          <h3 className="font-display font-bold text-lg mb-5">Order status</h3>
          {isLoading ? (
            <div className="h-52 grid place-items-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : metrics.statusChart.length === 0 ? (
            <div className="h-52 grid place-items-center text-sm text-muted-foreground">
              No orders in this period.
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie
                    data={metrics.statusChart}
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={72}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {metrics.statusChart.map((entry) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#6b7280"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.75rem",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <ul className="space-y-2 flex-1 min-w-0">
                {metrics.statusChart.map((entry) => (
                  <li key={entry.status} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ background: STATUS_COLORS[entry.status] ?? "#6b7280" }}
                      />
                      <span className="text-muted-foreground truncate">{entry.name}</span>
                    </div>
                    <span className="font-semibold ml-2 shrink-0">{entry.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-5">
          <h3 className="font-display font-bold text-lg mb-5">Payment methods</h3>
          {isLoading ? (
            <div className="h-52 grid place-items-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : metrics.paymentChart.length === 0 ? (
            <div className="h-52 grid place-items-center text-sm text-muted-foreground">
              No paid orders in this period.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={metrics.paymentChart}
                layout="vertical"
                margin={{ top: 0, right: 4, left: 4, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={110}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.75rem",
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [v, "Orders"]}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {metrics.paymentChart.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <h3 className="font-display font-bold text-lg mb-1">Top products by revenue</h3>
        <p className="text-xs text-muted-foreground mb-5">Paid orders only, this period.</p>
        {isLoading ? (
          <div className="h-52 grid place-items-center text-sm text-muted-foreground">Loading…</div>
        ) : metrics.topProducts.length === 0 ? (
          <div className="h-52 grid place-items-center text-sm text-muted-foreground">
            No paid orders in this period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={metrics.topProducts} margin={{ top: 0, right: 4, left: 4, bottom: 40 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-28}
                textAnchor="end"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) =>
                  v >= 1_000_000 ? `₦${(v / 1_000_000).toFixed(1)}M` : `₦${(v / 1_000).toFixed(0)}K`
                }
                width={56}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.75rem",
                  fontSize: 12,
                }}
                formatter={(v: number) => [formatNGN(v), "Revenue"]}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.fullName ?? payload?.[0]?.payload?.name ?? ""
                }
              />
              <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                {metrics.topProducts.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
