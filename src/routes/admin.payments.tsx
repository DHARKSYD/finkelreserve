import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Search, Undo2, Wallet, AlertTriangle } from "lucide-react";
import {
  useAdminPayments,
  type PaymentDisplayStatus,
  type AdminPayment,
} from "@/lib/queries/payments";
import { formatNGN } from "@/lib/currency";
import { StatCard } from "@/components/admin/StatCard";
import { PaymentStatusBadge } from "@/components/admin/StatusBadge";
import { EmptyState } from "@/components/admin/EmptyState";
import { RefundDialog } from "@/components/admin/RefundDialog";

export const Route = createFileRoute("/admin/payments")({
  head: () => ({ meta: [{ title: "Payments — Admin" }] }),
  component: PaymentsPage,
});

type Filter = "all" | PaymentDisplayStatus;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "partially_refunded", label: "Partial Refund" },
  { value: "refunded", label: "Refunded" },
  { value: "failed", label: "Failed" },
];

function PaymentsPage() {
  const { data: payments = [], isLoading } = useAdminPayments();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [refundTarget, setRefundTarget] = useState<AdminPayment | null>(null);

  const stats = useMemo(() => {
    const netCollected = payments.reduce(
      (sum, p) =>
        p.displayStatus === "paid" ||
        p.displayStatus === "partially_refunded" ||
        p.displayStatus === "refunded"
          ? sum + p.total - p.refundedAmount
          : sum,
      0,
    );
    const pending = payments.filter((p) => p.displayStatus === "pending").length;
    const failed = payments.filter((p) => p.displayStatus === "failed").length;
    const refunded = payments.reduce((sum, p) => sum + p.refundedAmount, 0);
    return { netCollected, pending, failed, refunded };
  }, [payments]);

  const filtered = useMemo(() => {
    let rows = payments;
    if (filter !== "all") rows = rows.filter((p) => p.displayStatus === filter);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (p) =>
          p.customerName.toLowerCase().includes(q) ||
          p.customerEmail.toLowerCase().includes(q) ||
          p.orderId.toLowerCase().includes(q) ||
          (p.paymentReference ?? "").toLowerCase().includes(q),
      );
    }
    return rows;
  }, [payments, filter, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-black text-3xl md:text-4xl tracking-tighter">Payments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every order's payment status, in sync with Paystack and refunds automatically.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<Wallet className="h-4 w-4" />}
          label="Net Collected"
          value={formatNGN(stats.netCollected)}
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Pending"
          value={String(stats.pending)}
          accent={stats.pending > 0}
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Failed"
          value={String(stats.failed)}
          accent={stats.failed > 0}
        />
        <StatCard
          icon={<Undo2 className="h-4 w-4" />}
          label="Refunded"
          value={formatNGN(stats.refunded)}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="inline-flex flex-wrap rounded-full bg-surface-2 p-1 text-xs font-bold w-fit gap-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-full transition whitespace-nowrap ${
                filter === f.value ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, order, reference…"
            className="w-full rounded-full bg-surface-2 pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No matching payments"
          description={
            payments.length === 0
              ? "Orders will show up here once placed."
              : "Try a different search or filter."
          }
        />
      ) : (
        <div className="overflow-x-auto glass rounded-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.orderId} className="border-t border-border/40">
                  <td className="px-4 py-3 font-mono text-xs">
                    {p.orderId.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold truncate max-w-[160px]">{p.customerName}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                      {p.customerEmail}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{formatNGN(p.total)}</p>
                    {p.refundedAmount > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {formatNGN(p.refundedAmount)} refunded
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.paymentMethod === "paystack" ? "Online" : "On delivery"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground truncate max-w-[140px]">
                    {p.paymentReference ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <PaymentStatusBadge status={p.displayStatus} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(p.createdAt).toLocaleDateString("en-NG", { dateStyle: "medium" })}
                  </td>
                  <td className="px-4 py-3">
                    {p.refundable > 0 &&
                      (p.displayStatus === "paid" || p.displayStatus === "partially_refunded") && (
                        <button
                          onClick={() => setRefundTarget(p)}
                          className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-bold hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Undo2 className="h-3 w-3" /> Refund
                        </button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RefundDialog
        payment={refundTarget}
        onOpenChange={(open) => !open && setRefundTarget(null)}
      />
    </div>
  );
}
