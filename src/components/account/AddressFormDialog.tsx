import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NIGERIAN_STATES } from "@/lib/nigerian-states";
import { useCreateAddress, useUpdateAddress, type Address } from "@/lib/queries/addresses";

const EMPTY = {
  recipientName: "",
  phone: "",
  addressLine: "",
  city: "",
  state: "",
  deliveryInstructions: "",
  isDefault: false,
};

export function AddressFormDialog({
  open,
  onOpenChange,
  editing,
  customerId,
  hasAnyAddress,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Address | null;
  customerId: string;
  /** First address ever saved defaults to "default" automatically — no reason to make someone tick a box for their only address. */
  hasAnyAddress: boolean;
}) {
  const [form, setForm] = useState(EMPTY);
  const create = useCreateAddress();
  const update = useUpdateAddress();
  const saving = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;
    setForm(
      editing
        ? {
            recipientName: editing.recipientName,
            phone: editing.phone,
            addressLine: editing.addressLine,
            city: editing.city,
            state: editing.state,
            deliveryInstructions: editing.deliveryInstructions ?? "",
            isDefault: editing.isDefault,
          }
        : { ...EMPTY, isDefault: !hasAnyAddress },
    );
  }, [open, editing, hasAnyAddress]);

  const handleSave = () => {
    if (!form.recipientName.trim()) return toast.error("Recipient name is required.");
    if (!form.phone.trim()) return toast.error("Phone number is required.");
    if (!form.addressLine.trim()) return toast.error("Address is required.");
    if (!form.city.trim()) return toast.error("City is required.");
    if (!form.state) return toast.error("Select a state.");

    const input = {
      recipientName: form.recipientName.trim(),
      phone: form.phone.trim(),
      addressLine: form.addressLine.trim(),
      city: form.city.trim(),
      state: form.state,
      deliveryInstructions: form.deliveryInstructions.trim() || null,
      isDefault: form.isDefault,
    };
    const onSuccess = () => {
      toast.success(editing ? "Address updated." : "Address saved.");
      onOpenChange(false);
    };
    const onError = (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Could not save this address.");

    if (editing) {
      update.mutate({ id: editing.id, input, customerId }, { onSuccess, onError });
    } else {
      create.mutate({ input, customerId }, { onSuccess, onError });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-border max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display font-bold">
            {editing ? "Edit Address" : "New Address"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field
              label="Recipient name"
              value={form.recipientName}
              onChange={(v) => setForm((f) => ({ ...f, recipientName: v }))}
            />
            <Field
              label="Phone"
              value={form.phone}
              onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
            />
          </div>

          <Field
            label="Address"
            value={form.addressLine}
            onChange={(v) => setForm((f) => ({ ...f, addressLine: v }))}
          />

          <div className="grid sm:grid-cols-2 gap-3">
            <Field
              label="City"
              value={form.city}
              onChange={(v) => setForm((f) => ({ ...f, city: v }))}
            />
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">State</label>
              <select
                value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                className="w-full bg-input rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary"
              >
                <option value="">Select state</option>
                {NIGERIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Delivery instructions (optional)
            </label>
            <textarea
              value={form.deliveryInstructions}
              onChange={(e) => setForm((f) => ({ ...f, deliveryInstructions: e.target.value }))}
              rows={2}
              placeholder="Gate code, landmark, etc."
              className="w-full bg-input rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary resize-none"
            />
          </div>

          <label className={`flex items-center gap-2 text-sm ${hasAnyAddress ? "" : "opacity-60"}`}>
            <input
              type="checkbox"
              checked={form.isDefault}
              disabled={!hasAnyAddress}
              onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
            />
            Set as default address
            {!hasAnyAddress && (
              <span className="text-xs text-muted-foreground">(automatic — first address)</span>
            )}
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
            {saving ? "Saving…" : "Save Address"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-input rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary"
      />
    </div>
  );
}
