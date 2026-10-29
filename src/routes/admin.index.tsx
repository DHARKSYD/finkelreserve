import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Package, ShoppingBag, TrendingUp, AlertTriangle } from "lucide-react";
import { useAdminProducts } from "@/lib/queries/products";
import { useAdminOrders } from "@/lib/queries/orders";
import { useAdminVariantsWithProduct } from "@/lib/queries/variants";
import { StatCard } from "@/components/admin/StatCard";
import { formatNGN } from "@/lib/currency";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Overview — Admin" }] }),
  component: OverviewPage,
});

function OverviewPage() {
  const { data: products = [] } = useAdminProducts();
  const { data: orders = [] } = useAdminOrders();
  const { data: variants = [] } = useAdminVariantsWithProduct();

  const stats = useMemo(() => {
    const revenue = orders
      .filter((o) => o.paymentStatus === "paid" || o.paymentMethod === "delivery")
      .reduce((s, o) => s + o.total, 0);
    // Low stock is counted per bottle-size variant, not per product — a
    // wine with 40 bottles in stock but 0 left in 750ml is a real
    // stockout even though the product-level total looks healthy.
    const lowStockCount = variants.filter((v) => v.stock < v.lowStockThreshold).length;
    return { products: products.length, orders: orders.length, revenue, lowStock: lowStockCount };
  }, [products, orders, variants]);

  const recentOrders = orders.slice(0, 6);
  const lowStock = [...variants]
    .filter((v) => v.stock < v.lowStockThreshold)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 6);

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-primary font-mono">— Control room</p>
        <h1 className="mt-2 font-display font-black text-4xl md:text-5xl tracking-tighter">
          Overview
        </h1>
        <p className="mt-2 text-muted-foreground">
          Manage products, watch orders & track everything that happens on the site.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard
          icon={<Package className="h-4 w-4" />}
          label="Products"
          value={String(stats.products)}
        />
        <StatCard
          icon={<ShoppingBag className="h-4 w-4" />}
          label="Orders"
          value={String(stats.orders)}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Revenue"
          value={formatNGN(stats.revenue)}
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Low stock"
          value={String(stats.lowStock)}
          accent={stats.lowStock > 0}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="glass rounded-2xl p-5">
          <h3 className="font-display font-bold text-lg mb-4">Recent orders</h3>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{o.customer.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.createdAt).toLocaleDateString()} · {o.items.length} item
                      {o.items.length !== 1 && "s"}
                    </p>
                  </div>
                  <p className="font-bold shrink-0 ml-3">{formatNGN(o.total)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="glass rounded-2xl p-5">
          <h3 className="font-display font-bold text-lg mb-4">Low stock</h3>
          {lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">Everything's well stocked.</p>
          ) : (
            <div className="space-y-3">
              {lowStock.map((v) => (
                <div key={v.id} className="flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{v.productName}</p>
                    <p className="text-xs text-muted-foreground">{v.size}</p>
                  </div>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ml-3 ${
                      v.stock === 0
                        ? "bg-destructive/15 text-destructive"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {v.stock} left
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
