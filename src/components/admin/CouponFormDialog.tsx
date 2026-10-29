import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useCreateCoupon,
  useUpdateCoupon,
  type Coupon,
  type CouponInput,
} from "@/lib/queries/coupons";
import { useAdminProducts } from "@/lib/queries/products";

const EMPTY: CouponInput = {
  code: "",
  type: "percentage",
  value: 10,
  freeShipping: false,
  minOrderAmount: null,
  maxDiscountAmount: null,
  usageLimit: null,
  perCustomerLimit: null,
  startsAt: null,
  expiresAt: null,
  active: true,
  firstOrderOnly: false,
  applicableCategories: [],
};

function toFormState(c: Coupon): CouponInput {
  return {
    code: c.code,
    type: c.type,
    value: c.value,
    freeShipping: c.freeShipping,
    minOrderAmount: c.minOrderAmount,
    maxDiscountAmount: c.maxDiscountAmount,
    usageLimit: c.usageLimit,
    perCustomerLimit: c.perCustomerLimit,
    startsAt: c.startsAt ? new Date(c.startsAt).toISOString().slice(0, 16) : null,
    expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString().slice(0, 16) : null,
    active: c.active,
    firstOrderOnly: c.firstOrderOnly,
    applicableCategories: c.applicableCategories,
  };
}

export function CouponFormDialog({
  coupon,
  open,
  onOpenChange,
}: {
  coupon: Coupon | null; // null = create new
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState<CouponInput>(EMPTY);
  const { data: products = [] } = useAdminProducts();
  const categories = [...new Set(products.map((p) => p.productType))].sort();

  const create = useCreateCoupon();
  const update = useUpdateCoupon();
  const saving = create.isPending || update.isPending;

  useEffect(() => {
    if (open) setForm(coupon ? toFormState(coupon) : EMPTY);
  }, [open, coupon]);

  const set = <K extends keyof CouponInput>(key: K, value: CouponInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const isValid = form.code.trim().length > 0 && form.value > 0;

  const handleSave = () => {
    if (!isValid) return;
    const onDone = {
      onSuccess: () => {
        toast.success(coupon ? "Coupon updated." : "Coupon created.");
        onOpenChange(false);
      },
      onError: (e: unknown) =>
        toast.error(e instanceof Error ? e.message : "Could not save the coupon."),
    };
    if (coupon) update.mutate({ id: coupon.id, input: form }, onDone);
    else create.mutate(form, onDone);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-border max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display font-bold">
            {coupon ? "Edit coupon" : "New coupon"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code">
              <input
                value={form.code}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                placeholder="SAVE10"
                className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 font-mono uppercase"
              />
            </Field>
            <Field label="Status">
              <select
                value={form.active ? "active" : "inactive"}
                onChange={(e) => set("active", e.target.value === "active")}
                className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Discount type">
              <select
                value={form.type}
                onChange={(e) => set("type", e.target.value as CouponInput["type"])}
                className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount (₦)</option>
              </select>
            </Field>
            <Field label={form.type === "percentage" ? "Percent off" : "Amount off (₦)"}>
              <input
                type="number"
                min={0}
                value={form.value}
                onChange={(e) => set("value", Number(e.target.value))}
                className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.freeShipping}
              onChange={(e) => set("freeShipping", e.target.checked)}
              className="rounded"
            />
            Also gives free shipping
          </label>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Min. order (₦, optional)">
              <input
                type="number"
                min={0}
                value={form.minOrderAmount ?? ""}
                onChange={(e) =>
                  set("minOrderAmount", e.target.value ? Number(e.target.value) : null)
                }
                className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </Field>
            {form.type === "percentage" && (
              <Field label="Max discount (₦, optional)">
                <input
                  type="number"
                  min={0}
                  value={form.maxDiscountAmount ?? ""}
                  onChange={(e) =>
                    set("maxDiscountAmount", e.target.value ? Number(e.target.value) : null)
                  }
                  className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </Field>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Total uses (optional)">
              <input
                type="number"
                min={1}
                value={form.usageLimit ?? ""}
                onChange={(e) => set("usageLimit", e.target.value ? Number(e.target.value) : null)}
                placeholder="Unlimited"
                className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </Field>
            <Field label="Uses per customer (optional)">
              <input
                type="number"
                min={1}
                value={form.perCustomerLimit ?? ""}
                onChange={(e) =>
                  set("perCustomerLimit", e.target.value ? Number(e.target.value) : null)
                }
                placeholder="Unlimited"
                className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts (optional)">
              <input
                type="datetime-local"
                value={form.startsAt ?? ""}
                onChange={(e) => set("startsAt", e.target.value || null)}
                className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </Field>
            <Field label="Expires (optional)">
              <input
                type="datetime-local"
                value={form.expiresAt ?? ""}
                onChange={(e) => set("expiresAt", e.target.value || null)}
                className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.firstOrderOnly}
              onChange={(e) => set("firstOrderOnly", e.target.checked)}
              className="rounded"
            />
            First-time customers only
          </label>

          {categories.length > 0 && (
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-1.5">
                Applies to categories (none selected = entire store)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => {
                  const selected = form.applicableCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() =>
                        set(
                          "applicableCategories",
                          selected
                            ? form.applicableCategories.filter((c) => c !== cat)
                            : [...form.applicableCategories, cat],
                        )
                      }
                      className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-surface-2 text-muted-foreground"
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            className="rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold w-full disabled:opacity-50"
          >
            {saving ? "Saving…" : coupon ? "Save changes" : "Create coupon"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
