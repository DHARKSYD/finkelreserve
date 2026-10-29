import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Tag, Plus, Pencil, Trash2, Copy } from "lucide-react";
import {
  useAdminCoupons,
  useToggleCouponActive,
  useDeleteCoupon,
  type Coupon,
} from "@/lib/queries/coupons";
import { formatNGN } from "@/lib/currency";
import { StatCard } from "@/components/admin/StatCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { EmptyState } from "@/components/admin/EmptyState";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { CouponFormDialog } from "@/components/admin/CouponFormDialog";

export const Route = createFileRoute("/admin/promotions")({
  head: () => ({ meta: [{ title: "Promotions — Admin" }] }),
  component: PromotionsPage,
});

function describeCoupon(c: Coupon): string {
  const parts = [c.type === "percentage" ? `${c.value}% off` : `${formatNGN(c.value)} off`];
  if (c.freeShipping) parts.push("free shipping");
  return parts.join(" + ");
}

function couponStatus(c: Coupon): {
  label: string;
  tone: "success" | "warning" | "danger" | "neutral";
} {
  if (!c.active) return { label: "Inactive", tone: "neutral" };
  const now = Date.now();
  if (c.expiresAt && now > c.expiresAt) return { label: "Expired", tone: "danger" };
  if (c.startsAt && now < c.startsAt) return { label: "Scheduled", tone: "warning" };
  if (c.usageLimit != null && c.usageCount >= c.usageLimit)
    return { label: "Limit reached", tone: "warning" };
  return { label: "Active", tone: "success" };
}

function PromotionsPage() {
  const { data: coupons = [], isLoading } = useAdminCoupons();
  const toggleActive = useToggleCouponActive();
  const deleteCoupon = useDeleteCoupon();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);

  const stats = useMemo(() => {
    const active = coupons.filter((c) => couponStatus(c).label === "Active").length;
    const totalRedemptions = coupons.reduce((s, c) => s + c.usageCount, 0);
    return { total: coupons.length, active, totalRedemptions };
  }, [coupons]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (c: Coupon) => {
    setEditing(c);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="font-display font-black text-3xl md:text-4xl tracking-tighter">
            Promotions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Coupon codes customers can apply at checkout — validated server-side, every time.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold shrink-0"
        >
          <Plus className="h-4 w-4" /> New Coupon
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<Tag className="h-4 w-4" />}
          label="Total Coupons"
          value={String(stats.total)}
        />
        <StatCard
          icon={<Tag className="h-4 w-4" />}
          label="Currently Active"
          value={String(stats.active)}
        />
        <StatCard
          icon={<Tag className="h-4 w-4" />}
          label="Total Redemptions"
          value={String(stats.totalRedemptions)}
        />
      </div>

      {isLoading ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : coupons.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No coupons yet"
          description="Create a code for a launch discount, a first-order incentive, or free shipping."
          action={
            <button
              onClick={openCreate}
              className="rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold"
            >
              New Coupon
            </button>
          }
        />
      ) : (
        <div className="overflow-x-auto glass rounded-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Restrictions</th>
                <th className="px-4 py-3">Usage</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => {
                const status = couponStatus(c);
                return (
                  <tr key={c.id} className="border-t border-border/40">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(c.code);
                          toast.success(`Copied "${c.code}"`);
                        }}
                        className="inline-flex items-center gap-1.5 font-mono font-bold hover:text-primary"
                      >
                        {c.code} <Copy className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </td>
                    <td className="px-4 py-3">{describeCoupon(c)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {[
                        c.minOrderAmount != null && `Min ${formatNGN(c.minOrderAmount)}`,
                        c.firstOrderOnly && "First order only",
                        c.applicableCategories.length > 0 && c.applicableCategories.join(", "),
                      ]
                        .filter(Boolean)
                        .join(" · ") || "None"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {c.usageCount}
                      {c.usageLimit != null ? ` / ${c.usageLimit}` : ""}
                      {c.perCustomerLimit != null ? ` · ${c.perCustomerLimit}/customer` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActive.mutate({ id: c.id, active: !c.active })}>
                        <StatusBadge label={status.label} tone={status.tone} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openEdit(c)}
                          className="h-8 w-8 grid place-items-center rounded-full hover:bg-surface-2"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(c)}
                          className="h-8 w-8 grid place-items-center rounded-full hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CouponFormDialog coupon={editing} open={formOpen} onOpenChange={setFormOpen} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete coupon ${deleteTarget?.code ?? ""}?`}
        description="Past orders that used this code keep their discount — this only stops it from being used again."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteCoupon.mutate(deleteTarget.id, {
            onSuccess: () => toast.success("Coupon deleted."),
            onError: () => toast.error("Could not delete the coupon."),
          });
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
