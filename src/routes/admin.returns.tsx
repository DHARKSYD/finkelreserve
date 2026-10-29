import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { RotateCcw, Search, X, Video } from "lucide-react";
import {
  useAdminReturns,
  useUpdateReturnStatus,
  RETURN_STATUSES,
  type ReturnRequest,
  type ReturnStatus,
} from "@/lib/queries/returns";
import { useEvidenceUrls, isVideoPath } from "@/lib/queries/return-evidence";
import { useAdminOrders } from "@/lib/queries/orders";
import { formatNGN } from "@/lib/currency";
import { StatCard } from "@/components/admin/StatCard";
import { ReturnStatusBadge } from "@/components/admin/StatusBadge";
import { EmptyState } from "@/components/admin/EmptyState";

export const Route = createFileRoute("/admin/returns")({
  head: () => ({ meta: [{ title: "Returns — Admin" }] }),
  component: ReturnsPage,
});

const NEXT_STATUS: Partial<
  Record<ReturnStatus, { status: ReturnStatus; label: string; destructive?: boolean }[]>
> = {
  requested: [
    { status: "under_review", label: "Start Review" },
    { status: "rejected", label: "Reject", destructive: true },
  ],
  under_review: [
    { status: "approved", label: "Approve" },
    { status: "rejected", label: "Reject", destructive: true },
  ],
  approved: [
    { status: "item_received", label: "Mark Item Received" },
    { status: "rejected", label: "Reject", destructive: true },
  ],
  item_received: [{ status: "refund_initiated", label: "Initiate Refund" }],
  refund_initiated: [{ status: "completed", label: "Mark Completed" }],
};

function ReturnsPage() {
  const { data: returns = [], isLoading } = useAdminReturns();
  const { data: orders = [] } = useAdminOrders();
  const updateStatus = useUpdateReturnStatus();

  const [statusFilter, setStatusFilter] = useState<ReturnStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ReturnRequest | null>(null);
  const [adminNote, setAdminNote] = useState("");

  const ordersById = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return returns.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      const order = ordersById.get(r.orderId);
      return (
        r.id.toLowerCase().includes(q) ||
        r.orderId.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q) ||
        order?.customer.email.toLowerCase().includes(q) ||
        order?.customer.name.toLowerCase().includes(q)
      );
    });
  }, [returns, statusFilter, search, ordersById]);

  const stats = useMemo(
    () => ({
      total: returns.length,
      needsAction: returns.filter((r) =>
        ["requested", "under_review", "item_received", "refund_initiated"].includes(r.status),
      ).length,
      completed: returns.filter((r) => r.status === "completed").length,
      refundedTotal: returns
        .filter((r) => ["refund_initiated", "completed"].includes(r.status))
        .reduce((sum, r) => sum + r.refundTotal, 0),
    }),
    [returns],
  );

  const openDetail = (r: ReturnRequest) => {
    setSelected(r);
    setAdminNote(r.adminNote ?? "");
  };

  const handleTransition = (newStatus: ReturnStatus) => {
    if (!selected) return;
    updateStatus.mutate(
      { returnId: selected.id, newStatus, adminNote },
      {
        onSuccess: () => {
          toast.success(`Return moved to "${newStatus.replace("_", " ")}".`);
          setSelected((prev) => (prev ? { ...prev, status: newStatus } : prev));
        },
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : "Could not update this return."),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-black text-3xl md:text-4xl tracking-tighter">Returns</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Requested → Under Review → Approved → Item Received → Refund Initiated → Completed.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<RotateCcw className="h-4 w-4" />}
          label="Total Returns"
          value={String(stats.total)}
        />
        <StatCard
          icon={<RotateCcw className="h-4 w-4" />}
          label="Needs Action"
          value={String(stats.needsAction)}
        />
        <StatCard
          icon={<RotateCcw className="h-4 w-4" />}
          label="Completed"
          value={String(stats.completed)}
        />
        <StatCard
          icon={<RotateCcw className="h-4 w-4" />}
          label="Refunded (from returns)"
          value={formatNGN(stats.refundedTotal)}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer, order, or reason…"
            className="w-full bg-input rounded-lg pl-9 pr-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ReturnStatus | "all")}
          className="bg-input rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary"
        >
          <option value="all">All statuses</option>
          {RETURN_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="glass rounded-2xl py-16 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <EmptyState
          icon={RotateCcw}
          title={returns.length === 0 ? "No return requests yet" : "No returns match your filters"}
          description={
            returns.length === 0
              ? "Requests customers make from their order history will show up here."
              : "Try a different search or status filter."
          }
        />
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="divide-y divide-border/60">
            {filtered.map((r) => {
              const order = ordersById.get(r.orderId);
              return (
                <button
                  key={r.id}
                  onClick={() => openDetail(r)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-surface-2/60 transition"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">Order #{r.orderId.slice(0, 8)}</p>
                      <ReturnStatusBadge status={r.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {order?.customer.name ?? "Unknown customer"} · {r.reason}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">{formatNGN(r.refundTotal)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString("en-NG")}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
          <div className="glass w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto border-border">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 sticky top-0 bg-background/95 backdrop-blur">
              <div>
                <p className="font-display font-bold">Return #{selected.id.slice(0, 8)}</p>
                <ReturnStatusBadge status={selected.status} />
              </div>
              <button
                onClick={() => setSelected(null)}
                className="h-8 w-8 grid place-items-center rounded-lg hover:bg-surface-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Customer</p>
                <p className="text-sm">{ordersById.get(selected.orderId)?.customer.name}</p>
                <p className="text-xs text-muted-foreground">
                  {ordersById.get(selected.orderId)?.customer.email}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Order</p>
                <p className="text-sm">#{selected.orderId.slice(0, 8)}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Items</p>
                <div className="space-y-2">
                  {selected.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between text-sm rounded-lg bg-surface-2 px-3 py-2"
                    >
                      <div>
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.size || "—"} · Qty {item.quantity}
                        </p>
                      </div>
                      <p className="font-semibold">{formatNGN(item.refundAmount)}</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-sm font-bold mt-2 pt-2 border-t border-border/60">
                  <span>Refund total</span>
                  <span>{formatNGN(selected.refundTotal)}</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Reason</p>
                <p className="text-sm">{selected.reason}</p>
                {selected.customerNote && (
                  <p className="text-xs text-muted-foreground mt-1">"{selected.customerNote}"</p>
                )}
              </div>

              {selected.evidencePaths.length > 0 && (
                <EvidenceGallery paths={selected.evidencePaths} />
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Admin note</label>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={2}
                  placeholder="Optional — visible to other admins"
                  className="w-full bg-input rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-primary resize-none"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {(NEXT_STATUS[selected.status] ?? []).map((action) => {
                  return (
                    <button
                      key={action.status}
                      onClick={() => handleTransition(action.status)}
                      disabled={updateStatus.isPending}
                      className={`rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-60 ${
                        action.destructive
                          ? "bg-destructive/10 text-destructive"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      {updateStatus.isPending ? "Working…" : action.label}
                    </button>
                  );
                })}
                {(NEXT_STATUS[selected.status] ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    This return is in a final state — no further action available.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EvidenceGallery({ paths }: { paths: string[] }) {
  const { data: urls = {}, isLoading } = useEvidenceUrls(paths);

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground mb-2">Evidence ({paths.length})</p>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {paths.map((path) => {
            const url = urls[path];
            if (!url) return null;
            return isVideoPath(path) ? (
              <a
                key={path}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="aspect-square rounded-lg bg-surface-2 grid place-items-center hover:bg-surface-2/70"
              >
                <Video className="h-5 w-5 text-muted-foreground" />
              </a>
            ) : (
              <a
                key={path}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="aspect-square rounded-lg overflow-hidden bg-surface-2"
              >
                <img src={url} alt="Return evidence" className="h-full w-full object-cover" />
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
