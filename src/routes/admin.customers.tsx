import { createFileRoute } from "@tanstack/react-router";
import { useAdminCustomers } from "@/lib/queries/customers";
import { formatNGN } from "@/lib/currency";
import { EmptyState } from "@/components/admin/EmptyState";
import { Users } from "lucide-react";

export const Route = createFileRoute("/admin/customers")({
  head: () => ({ meta: [{ title: "Customers — Admin" }] }),
  component: CustomersPage,
});

function CustomersPage() {
  const { data: customers = [], isLoading } = useAdminCustomers();

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display font-black text-3xl md:text-4xl tracking-tighter">Customers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {customers.length} customer{customers.length !== 1 && "s"} · derived from order history
          (guest checkouts included, grouped by email)
        </p>
      </div>

      {isLoading ? (
        <div className="glass rounded-2xl py-16 text-center text-muted-foreground">Loading…</div>
      ) : customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers yet"
          description="They'll show up here after the first order comes in."
        />
      ) : (
        <div className="overflow-x-auto glass rounded-2xl">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.15em] text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Total spent</th>
                <th className="px-4 py-3">Last order</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.email} className="border-b border-border/40">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.email}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.phone || "—"}</td>
                  <td className="px-4 py-3">{c.orderCount}</td>
                  <td className="px-4 py-3 font-semibold">{formatNGN(c.totalSpent)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(c.lastOrderAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
