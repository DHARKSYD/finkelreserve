import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  useCreateShippingRate,
  useUpdateShippingRate,
  type ShippingRate,
  type ShippingZone,
} from "@/lib/queries/shipping";

type FormState = {
  zoneId: string;
  name: string;
  priceNgn: string;
  minOrderNgn: string;
  freeShippingThresholdNgn: string;
  estimatedDaysMin: string;
  estimatedDaysMax: string;
  active: boolean;
};

const emptyForm = (defaultZoneId: string): FormState => ({
  zoneId: defaultZoneId,
  name: "",
  priceNgn: "",
  minOrderNgn: "",
  freeShippingThresholdNgn: "",
  estimatedDaysMin: "2",
  estimatedDaysMax: "5",
  active: true,
});

// "" means "not set" for the optional fields — kept as strings in form state
// so an admin can clear a field back to empty without fighting a stuck 0.
const toNullableInt = (v: string): number | null =>
  v.trim() === "" ? null : Math.round(Number(v));

export function ShippingRateFormDialog({
  open,
  onOpenChange,
  editing,
  zones,
  defaultZoneId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: ShippingRate | null;
  zones: ShippingZone[];
  defaultZoneId: string;
}) {
  const [form, setForm] = useState<FormState>(emptyForm(defaultZoneId));
  const create = useCreateShippingRate();
  const update = useUpdateShippingRate();
  const saving = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;
    setForm(
      editing
        ? {
            zoneId: editing.zoneId,
            name: editing.name,
            priceNgn: String(editing.priceNgn),
            minOrderNgn: editing.minOrderNgn != null ? String(editing.minOrderNgn) : "",
            freeShippingThresholdNgn:
              editing.freeShippingThresholdNgn != null
                ? String(editing.freeShippingThresholdNgn)
                : "",
            estimatedDaysMin: String(editing.estimatedDaysMin),
            estimatedDaysMax: String(editing.estimatedDaysMax),
            active: editing.active,
          }
        : emptyForm(defaultZoneId),
    );
  }, [open, editing, defaultZoneId]);

  const handleSave = () => {
    const price = Number(form.priceNgn);
    const daysMin = Number(form.estimatedDaysMin);
    const daysMax = Number(form.estimatedDaysMax);

    if (!form.zoneId) return toast.error("Choose a zone.");
    if (!form.name.trim()) return toast.error("Rate name is required.");
    if (!Number.isFinite(price) || price < 0) return toast.error("Enter a valid price.");
    if (!Number.isFinite(daysMin) || !Number.isFinite(daysMax) || daysMin < 0 || daysMax < daysMin)
      return toast.error("Estimated delivery days must be a valid range.");

    const input = {
      zoneId: form.zoneId,
      name: form.name.trim(),
      priceNgn: Math.round(price),
      minOrderNgn: toNullableInt(form.minOrderNgn),
      freeShippingThresholdNgn: toNullableInt(form.freeShippingThresholdNgn),
      estimatedDaysMin: Math.round(daysMin),
      estimatedDaysMax: Math.round(daysMax),
      active: form.active,
    };

    const onSuccess = () => {
      toast.success(editing ? "Rate updated." : "Rate created.");
      onOpenChange(false);
    };
    const onError = (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Could not save the rate.");

    if (editing) {
      update.mutate({ id: editing.id, input }, { onSuccess, onError });
    } else {
      create.mutate(input, { onSuccess, onError });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-border max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display font-bold">
            {editing ? "Edit Rate" : "New Shipping Rate"}
          </DialogTitle>
          <DialogDescription>
            Checkout re-derives this price from the database by rate ID — nothing here is ever
            trusted from the browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Zone</label>
            <select
              value={form.zoneId}
              onChange={(e) => setForm((f) => ({ ...f, zoneId: e.target.value }))}
              className="w-full bg-input rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary"
            >
              <option value="">Select a zone…</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Rate name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Standard Delivery, Express"
              className="w-full bg-input rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Price (₦)</label>
              <input
                type="number"
                min={0}
                value={form.priceNgn}
                onChange={(e) => setForm((f) => ({ ...f, priceNgn: e.target.value }))}
                className="w-full bg-input rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Free shipping above (₦)
              </label>
              <input
                type="number"
                min={0}
                placeholder="Optional"
                value={form.freeShippingThresholdNgn}
                onChange={(e) =>
                  setForm((f) => ({ ...f, freeShippingThresholdNgn: e.target.value }))
                }
                className="w-full bg-input rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Min order (₦)</label>
              <input
                type="number"
                min={0}
                placeholder="Optional"
                value={form.minOrderNgn}
                onChange={(e) => setForm((f) => ({ ...f, minOrderNgn: e.target.value }))}
                className="w-full bg-input rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Days (min)</label>
              <input
                type="number"
                min={0}
                value={form.estimatedDaysMin}
                onChange={(e) => setForm((f) => ({ ...f, estimatedDaysMin: e.target.value }))}
                className="w-full bg-input rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Days (max)</label>
              <input
                type="number"
                min={0}
                value={form.estimatedDaysMax}
                onChange={(e) => setForm((f) => ({ ...f, estimatedDaysMax: e.target.value }))}
                className="w-full bg-input rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            Active
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="rounded-full bg-surface-2 px-5 py-2.5 text-sm font-bold"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Rate"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
