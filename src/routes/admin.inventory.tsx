import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Boxes,
  Search,
  Upload,
  AlertTriangle,
  PackageX,
  Wallet,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAdminVariantsWithProduct, useUpdateVariantStock } from "@/lib/queries/variants";
import {
  useInventoryMovements,
  inventoryStatus,
  type InventoryStatus,
} from "@/lib/queries/inventory";
import { formatNGN } from "@/lib/currency";
import { boxesAndLoose } from "@/lib/box";
import { StatCard } from "@/components/admin/StatCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { EmptyState } from "@/components/admin/EmptyState";
import { InventoryImportDialog } from "@/components/admin/InventoryImportDialog";

export const Route = createFileRoute("/admin/inventory")({
  head: () => ({ meta: [{ title: "Inventory — Admin" }] }),
  component: InventoryPage,
});

const PAGE_SIZE = 25;
type Filter = "all" | "low" | "out";

const STATUS_LABEL: Record<InventoryStatus, string> = {
  healthy: "Healthy",
  low: "Low Stock",
  out: "Out of Stock",
};
const STATUS_TONE = { healthy: "success", low: "warning", out: "danger" } as const;

function InventoryPage() {
  const { data: variants = [], isLoading } = useAdminVariantsWithProduct();
  const { data: movements = [] } = useInventoryMovements(20);
  const updateStock = useUpdateVariantStock();

  const [importOpen, setImportOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const withStatus = useMemo(
    () => variants.map((v) => ({ ...v, status: inventoryStatus(v.stock, v.lowStockThreshold) })),
    [variants],
  );

  const stats = useMemo(() => {
    const low = withStatus.filter((v) => v.status === "low").length;
    const out = withStatus.filter((v) => v.status === "out").length;
    const value = withStatus.reduce((sum, v) => sum + v.stock * (v.productCostPrice ?? 0), 0);
    return { total: withStatus.length, low, out, value };
  }, [withStatus]);

  const filtered = useMemo(() => {
    let rows = withStatus;
    if (filter !== "all") rows = rows.filter((v) => v.status === filter);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (v) =>
          v.productName.toLowerCase().includes(q) ||
          (v.sku ?? "").toLowerCase().includes(q) ||
          v.size.toLowerCase().includes(q),
      );
    }
    return [...rows].sort((a, b) => a.stock - b.stock);
  }, [withStatus, filter, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const setFilterAndResetPage = (f: Filter) => {
    setFilter(f);
    setPage(1);
  };

  const commitStock = (variantId: string, raw: string) => {
    const value = Number(raw);
    setDraft((d) => {
      const next = { ...d };
      delete next[variantId];
      return next;
    });
    if (!Number.isFinite(value) || value < 0) return;
    const current = variants.find((v) => v.id === variantId)?.stock;
    if (current === value) return;
    updateStock.mutate({ id: variantId, stock: value });
  };

  const templateVariants = variants.map((v) => ({
    sku: v.sku,
    productName: v.productName,
    size: v.size,
    stock: v.stock,
    bottlesPerBox: v.productBottlesPerBox,
    boxDiscountPercent: v.productBoxDiscountPercent,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="font-display font-black text-3xl md:text-4xl tracking-tighter">
            Inventory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Stock is counted in bottles for every size, kept in sync with orders automatically.
            Products sold by the box also show how many whole boxes that makes (e.g. "4 × 6 + 2
            loose").
          </p>
        </div>
        <button
          onClick={() => setImportOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold shrink-0"
        >
          <Upload className="h-4 w-4" /> Import Inventory
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<Boxes className="h-4 w-4" />}
          label="Total Variants"
          value={String(stats.total)}
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Low Stock"
          value={String(stats.low)}
          accent={stats.low > 0}
        />
        <StatCard
          icon={<PackageX className="h-4 w-4" />}
          label="Out of Stock"
          value={String(stats.out)}
          accent={stats.out > 0}
        />
        <StatCard
          icon={<Wallet className="h-4 w-4" />}
          label="Stock Value (cost)"
          value={formatNGN(stats.value)}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="inline-flex rounded-full bg-surface-2 p-1 text-xs font-bold w-fit">
          {(["all", "low", "out"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilterAndResetPage(f)}
              className={`px-3.5 py-1.5 rounded-full transition ${
                filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {f === "all" ? "All" : f === "low" ? "Low Stock" : "Out of Stock"}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search product, SKU, size…"
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
          icon={Boxes}
          title="No matching variants"
          description={
            variants.length === 0
              ? "Add bottle sizes from a product's editor to start tracking stock here."
              : "Try a different search or filter."
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto glass rounded-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Stock (bottles)</th>
                  <th className="px-4 py-3">Boxes</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((v) => (
                  <tr key={v.id} className="border-t border-border/40">
                    <td className="px-4 py-3">
                      <p className="font-semibold truncate max-w-[180px]">{v.productName}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {v.sku ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{v.size}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        value={draft[v.id] ?? v.stock}
                        onChange={(e) => setDraft((d) => ({ ...d, [v.id]: e.target.value }))}
                        onBlur={(e) => commitStock(v.id, e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && (e.target as HTMLInputElement).blur()
                        }
                        className="w-20 rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {v.productBottlesPerBox
                        ? boxesAndLoose(v.stock, v.productBottlesPerBox)
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge label={STATUS_LABEL[v.status]} tone={STATUS_TONE[v.status]} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(v.updatedAt).toLocaleDateString("en-NG", { dateStyle: "medium" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {filtered.length} variant{filtered.length === 1 ? "" : "s"} · page {currentPage} of{" "}
                {pageCount}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5 font-bold disabled:opacity-40"
                >
                  <ChevronLeft className="h-3 w-3" /> Prev
                </button>
                <button
                  disabled={currentPage >= pageCount}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5 font-bold disabled:opacity-40"
                >
                  Next <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <div>
        <h2 className="font-display font-bold text-sm uppercase tracking-[0.15em] text-muted-foreground mb-3">
          Recent Inventory Changes
        </h2>
        {movements.length === 0 ? (
          <div className="glass rounded-2xl p-6 text-sm text-muted-foreground text-center">
            Manual corrections and imports will show up here.
          </div>
        ) : (
          <div className="glass rounded-2xl divide-y divide-border/40">
            {movements.map((m) => (
              <div key={m.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold truncate">
                    {m.productName ?? "Deleted product"}{" "}
                    <span className="text-muted-foreground font-normal">
                      {m.size} {m.sku ? `· ${m.sku}` : ""}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m.previousStock} → {m.newStock} ·{" "}
                    {m.source === "import" ? "Import" : (m.reason ?? "Manual")} ·{" "}
                    {new Date(m.at).toLocaleString("en-NG", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <span
                  className={`font-bold text-sm shrink-0 ${m.delta > 0 ? "text-primary" : "text-destructive"}`}
                >
                  {m.delta > 0 ? "+" : ""}
                  {m.delta}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <InventoryImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        variants={templateVariants}
      />
    </div>
  );
}
