import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Package, ChevronRight, ShoppingBag } from "lucide-react";
import { useMyOrders, type Order } from "@/lib/queries/orders";
import { useMyReturns } from "@/lib/queries/returns";
import { useSettings } from "@/lib/queries/settings";
import { formatNGN } from "@/lib/currency";
import { ReturnStatusBadge } from "@/components/admin/StatusBadge";
import { RequestReturnDialog } from "@/components/RequestReturnDialog";

export const Route = createFileRoute("/account/orders")({
  head: () => ({ meta: [{ title: "Orders — My Account" }] }),
  component: OrdersPage,
});

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500",
  processing: "bg-primary/10 text-primary",
  shipped: "bg-blue-500/10 text-blue-400",
  delivered: "bg-green-500/10 text-green-500",
  cancelled: "bg-destructive/10 text-destructive",
};

function OrdersPage() {
  const { data: orders = [], isLoading, error } = useMyOrders();
  const { data: returns = [] } = useMyReturns();
  const { data: settings } = useSettings();
  const [returnDialogOrder, setReturnDialogOrder] = useState<Order | null>(null);

  const windowDays = settings?.returnWindowDays ?? 1;

  const activeReturnByOrder = useMemo(() => {
    const map = new Map<string, (typeof returns)[number]>();
    for (const r of returns) {
      if (r.status !== "rejected") map.set(r.orderId, r);
    }
    return map;
  }, [returns]);

  const returnedQtyByItem = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of returns) {
      if (r.status === "rejected") continue;
      for (const item of r.items) {
        map[item.orderItemId] = (map[item.orderItemId] ?? 0) + item.quantity;
      }
    }
    return map;
  }, [returns]);

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-muted-foreground text-sm">
        Loading orders…
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <p className="text-sm text-destructive mb-2 font-medium">Could not load your orders</p>
        <p className="text-xs text-muted-foreground">
          Try refreshing the page. If the issue persists, contact us.
        </p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="glass rounded-2xl p-12 text-center">
        <ShoppingBag className="h-10 w-10 text-muted-foreground/40 mx-auto mb-4" />
        <p className="font-semibold mb-1">No orders yet</p>
        <p className="text-sm text-muted-foreground mb-6">
          Your order history will appear here once you've made a purchase.
        </p>
        <Link
          to="/shop"
          className="inline-block rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm font-bold hover:shadow-glow transition"
        >
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Package className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-display font-bold text-lg">
          Orders{" "}
          <span className="text-muted-foreground font-normal text-sm">({orders.length})</span>
        </h2>
      </div>

      {orders.map((order) => {
        const statusLabel = STATUS_LABELS[order.status] ?? order.status;
        const statusColor = STATUS_COLORS[order.status] ?? "bg-surface-2 text-muted-foreground";
        const firstImage = order.items[0]?.image;
        const activeReturn = activeReturnByOrder.get(order.id);
        const withinWindow =
          order.deliveredAt != null &&
          Date.now() - order.deliveredAt <= windowDays * 24 * 60 * 60 * 1000;
        const returnEligible = order.status === "delivered" && withinWindow && !activeReturn;

        return (
          <div
            key={order.id}
            className="glass rounded-2xl p-5 hover:border-primary/30 transition group"
          >
            <Link
              to="/order-confirmation/$id"
              params={{ id: order.id }}
              className="flex items-center gap-4"
            >
              {firstImage ? (
                <div className="h-16 w-16 rounded-xl overflow-hidden shrink-0 bg-surface-2">
                  <img
                    src={firstImage}
                    alt={order.items[0]?.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-16 w-16 rounded-xl bg-surface-2 grid place-items-center shrink-0">
                  <Package className="h-6 w-6 text-muted-foreground/40" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-xs font-mono text-muted-foreground">
                    #{order.id.slice(0, 8).toUpperCase()}
                  </p>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusColor}`}
                  >
                    {statusLabel}
                  </span>
                </div>
                <p className="font-semibold text-sm truncate">
                  {order.items.length === 1
                    ? order.items[0].name
                    : `${order.items[0].name} + ${order.items.length - 1} more`}
                </p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span>{new Date(order.createdAt).toLocaleDateString("en-NG")}</span>
                  <span>·</span>
                  <span className="font-semibold text-foreground">{formatNGN(order.total)}</span>
                  <span>·</span>
                  <span>
                    {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 group-hover:text-primary transition" />
            </Link>

            {(activeReturn || returnEligible) && (
              <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between">
                {activeReturn ? (
                  <>
                    <span className="text-xs text-muted-foreground">Return status</span>
                    <ReturnStatusBadge status={activeReturn.status} />
                  </>
                ) : (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setReturnDialogOrder(order);
                    }}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Request Return
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {returnDialogOrder && (
        <RequestReturnDialog
          open={!!returnDialogOrder}
          onOpenChange={(open) => !open && setReturnDialogOrder(null)}
          order={returnDialogOrder}
          alreadyReturnedByItem={returnedQtyByItem}
          returnWindowDays={windowDays}
        />
      )}
    </div>
  );
}
