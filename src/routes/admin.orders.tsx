import { createFileRoute } from "@tanstack/react-router";
import { sizeWithUnit } from "@/lib/box";
import { Fragment, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban } from "lucide-react";
import {
  useAdminOrders,
  useUpdateOrderStatus,
  useUpdatePaymentStatus,
  type OrderStatus,
} from "@/lib/queries/orders";
import { cancelOrder } from "@/lib/actions/orders";
import { formatNGN } from "@/lib/currency";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { OrderStatusBadge } from "@/components/admin/StatusBadge";
import { DeliveryPanel } from "@/components/admin/DeliveryPanel";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({ meta: [{ title: "Orders — Admin" }] }),
  component: OrdersPage,
});

type EditableStatus = Exclude<OrderStatus, "cancelled">;
const STATUSES: EditableStatus[] = ["pending", "processing", "shipped", "delivered"];

function OrdersPage() {
  const { data: orders = [], isLoading } = useAdminOrders();
  const updateStatus = useUpdateOrderStatus();
  const updatePayment = useUpdatePaymentStatus();
  const qc = useQueryClient();
  const cancel = useMutation({
    mutationFn: (orderId: string) => cancelOrder({ data: { orderId } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Order cancelled and stock restored.");
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["variants"] });
      qc.invalidateQueries({ queryKey: ["activity"] });
    },
    onError: () => toast.error("Could not cancel the order."),
  });

  const [expanded, setExpanded] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display font-black text-3xl md:text-4xl tracking-tighter">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {orders.length} order{orders.length !== 1 && "s"}
        </p>
      </div>

      <div className="overflow-x-auto glass rounded-2xl">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-[0.15em] text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No orders yet.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <Fragment key={o.id}>
                  <tr
                    className="border-b border-border/40 cursor-pointer hover:bg-surface-2/40"
                    onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      {o.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{o.customer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(o.createdAt).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-semibold">{formatNGN(o.total)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (o.paymentStatus !== "paid")
                            updatePayment.mutate({ id: o.id, paymentStatus: "paid" });
                        }}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${o.paymentStatus === "paid" ? "bg-primary/10 text-primary" : "bg-surface-2 text-muted-foreground"}`}
                        title={o.paymentStatus === "paid" ? "Paid" : "Click to mark as paid"}
                      >
                        {o.paymentMethod === "paystack" ? "Online" : "On delivery"} ·{" "}
                        {o.paymentStatus}
                      </button>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {o.status === "cancelled" ? (
                        <OrderStatusBadge status={o.status} />
                      ) : (
                        <select
                          value={o.status}
                          onChange={(e) =>
                            updateStatus.mutate(
                              { id: o.id, status: e.target.value as EditableStatus },
                              {
                                onSuccess: () =>
                                  e.target.value === "shipped" || e.target.value === "delivered"
                                    ? toast.success(
                                        "Status updated — the customer has been notified",
                                      )
                                    : undefined,
                                onError: (err) =>
                                  toast.error(
                                    err instanceof Error ? err.message : "Could not update",
                                  ),
                              },
                            )
                          }
                          className="bg-input rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-2 ring-primary capitalize"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {o.status !== "cancelled" && (
                          <button
                            onClick={() => setCancelTarget(o.id)}
                            className="h-8 w-8 grid place-items-center rounded-lg bg-surface-2 hover:bg-destructive hover:text-destructive-foreground"
                            title="Cancel order (restores stock)"
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expanded === o.id && (
                    <tr className="border-b border-border/40 bg-surface-2/20">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="grid sm:grid-cols-2 gap-4 text-xs">
                          <div>
                            <p className="text-muted-foreground uppercase tracking-[0.15em] mb-1">
                              Deliver to
                            </p>
                            <p>
                              {o.customer.address}
                              {o.customer.city && `, ${o.customer.city}`}
                              {o.customer.state && `, ${o.customer.state}`}
                            </p>
                            {o.customer.landmark && (
                              <p className="text-muted-foreground">{o.customer.landmark}</p>
                            )}
                            <p className="text-muted-foreground">
                              {o.customer.email}
                              {o.customer.phone && ` · ${o.customer.phone}`}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground uppercase tracking-[0.15em] mb-1">
                              Items
                            </p>
                            {o.items.map((i) => (
                              <div key={i.id} className="mb-2 last:mb-0">
                                <p>
                                  {i.qty}× {i.name} (
                                  {sizeWithUnit(i.size, i.unit, i.bottlesPerUnit)}) ·{" "}
                                  {formatNGN(i.price * i.qty)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                        {o.status !== "cancelled" && <DeliveryPanel order={o} />}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(o) => !o && setCancelTarget(null)}
        title={`Cancel order ${cancelTarget ? cancelTarget.slice(0, 8).toUpperCase() : ""}?`}
        description="This restores the reserved inventory and marks the order cancelled. It can't be undone."
        confirmLabel="Cancel order"
        loading={cancel.isPending}
        onConfirm={() => {
          if (!cancelTarget) return;
          cancel.mutate(cancelTarget, { onSettled: () => setCancelTarget(null) });
        }}
      />
    </div>
  );
}
