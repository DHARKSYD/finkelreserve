import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { NIGERIAN_STATES } from "@/lib/nigerian-states";
import {
  useCreateShippingZone,
  useUpdateShippingZone,
  type ShippingZone,
} from "@/lib/queries/shipping";

const EMPTY = { name: "", states: [] as string[], active: true };

export function ShippingZoneFormDialog({
  open,
  onOpenChange,
  editing,
  takenStates,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: ShippingZone | null;
  /** States already claimed by *other* zones — disabled here, since a state can only be in one zone. */
  takenStates: Set<string>;
}) {
  const [form, setForm] = useState(EMPTY);
  const create = useCreateShippingZone();
  const update = useUpdateShippingZone();
  const saving = create.isPending || update.isPending;

  useEffect(() => {
    if (open) {
      setForm(
        editing ? { name: editing.name, states: editing.states, active: editing.active } : EMPTY,
      );
    }
  }, [open, editing]);

  const toggleState = (state: string) => {
    setForm((f) => ({
      ...f,
      states: f.states.includes(state) ? f.states.filter((s) => s !== state) : [...f.states, state],
    }));
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error("Zone name is required.");
      return;
    }
    if (form.states.length === 0) {
      toast.error("Select at least one state.");
      return;
    }
    const input = { name: form.name.trim(), states: form.states, active: form.active };
    const onSuccess = () => {
      toast.success(editing ? "Zone updated." : "Zone created.");
      onOpenChange(false);
    };
    const onError = (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Could not save the zone.");

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
            {editing ? "Edit Zone" : "New Shipping Zone"}
          </DialogTitle>
          <DialogDescription>
            A zone is a group of states that share the same delivery rates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Zone name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Lagos, South-West, Nationwide"
              className="w-full bg-input rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted-foreground">
                States ({form.states.length} selected)
              </label>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    states: NIGERIAN_STATES.filter(
                      (s) => !takenStates.has(s) || f.states.includes(s),
                    ),
                  }))
                }
                className="text-xs text-primary hover:underline"
              >
                Select all available
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-64 overflow-y-auto rounded-lg border border-border/60 p-3">
              {NIGERIAN_STATES.map((state) => {
                const selected = form.states.includes(state);
                const takenByOther = takenStates.has(state) && !selected;
                return (
                  <button
                    key={state}
                    type="button"
                    disabled={takenByOther}
                    onClick={() => toggleState(state)}
                    title={takenByOther ? "Already assigned to another zone" : undefined}
                    className={`text-left text-xs px-2.5 py-1.5 rounded-md transition truncate ${
                      selected
                        ? "bg-primary text-primary-foreground font-semibold"
                        : takenByOther
                          ? "text-muted-foreground/40 cursor-not-allowed"
                          : "bg-surface-2 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {state}
                  </button>
                );
              })}
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
            {saving ? "Saving…" : "Save Zone"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
