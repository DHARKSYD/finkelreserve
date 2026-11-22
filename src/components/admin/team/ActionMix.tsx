import type { TeamPerformance } from "@/lib/queries/team";

type AreaKey =
  | "ordersHandled"
  | "returnsActions"
  | "paymentActions"
  | "productActions"
  | "inventoryActions"
  | "promotionActions"
  | "reviewActions"
  | "teamActions";

const AREAS: { key: AreaKey; label: string }[] = [
  { key: "ordersHandled", label: "Orders" },
  { key: "returnsActions", label: "Returns" },
  { key: "paymentActions", label: "Payments and refunds" },
  { key: "productActions", label: "Products" },
  { key: "inventoryActions", label: "Inventory" },
  { key: "promotionActions", label: "Coupons" },
  { key: "reviewActions", label: "Reviews" },
  { key: "teamActions", label: "Team" },
];

// Explains the "Actions" total: how it splits across the areas of the admin. The areas add up to
// the total, because the database counts every action in exactly one of them.
export function ActionMix({ perf }: { perf: TeamPerformance }) {
  const rows = AREAS.map((a) => ({ label: a.label, n: perf[a.key] }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n);

  if (perf.totalActions === 0 || rows.length === 0) return null;

  return (
    <section className="glass rounded-2xl p-5 mb-8">
      <h2 className="font-display font-bold text-lg">Where the time went</h2>
      <ul className="mt-4 space-y-3">
        {rows.map((r) => {
          const share = (r.n / perf.totalActions) * 100;
          return (
            <li key={r.label}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span>{r.label}</span>
                <span className="font-semibold">
                  {r.n}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    ({Math.round(share)}%)
                  </span>
                </span>
              </div>
              <div
                role="presentation"
                className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2"
              >
                <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
