import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { MapPin, Plus, Pencil, Trash2, Star } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  useMyAddresses,
  useSetDefaultAddress,
  useDeleteAddress,
  type Address,
} from "@/lib/queries/addresses";
import { AddressFormDialog } from "@/components/account/AddressFormDialog";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

export const Route = createFileRoute("/account/addresses")({
  head: () => ({ meta: [{ title: "Addresses — My Account" }] }),
  component: AddressesPage,
});

function AddressesPage() {
  const { user } = useAuth();
  const { data: addresses = [], isLoading } = useMyAddresses();
  const setDefault = useSetDefaultAddress();
  const deleteAddress = useDeleteAddress();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Address | null>(null);

  if (!user) return null;

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-lg">Addresses</h2>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-2 text-xs font-bold"
        >
          <Plus className="h-3.5 w-3.5" /> Add Address
        </button>
      </div>

      {isLoading && (
        <div className="glass rounded-2xl p-8 text-center text-muted-foreground text-sm">
          Loading…
        </div>
      )}

      {!isLoading && addresses.length === 0 && (
        <div className="glass rounded-2xl p-10 text-center">
          <MapPin className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-semibold mb-1">No saved addresses</p>
          <p className="text-sm text-muted-foreground mb-5">
            Save an address to skip retyping it at checkout.
          </p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold"
          >
            <Plus className="h-4 w-4" /> Add Address
          </button>
        </div>
      )}

      {!isLoading && addresses.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-3">
          {addresses.map((address) => (
            <div key={address.id} className="glass rounded-2xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold">{address.recipientName}</p>
                  {address.isDefault && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      <Star className="h-2.5 w-2.5 fill-current" /> Default
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      setEditing(address);
                      setFormOpen(true);
                    }}
                    className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-2 text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(address)}
                    className="h-7 w-7 grid place-items-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{address.phone}</p>
              <p className="text-sm">
                {address.addressLine}, {address.city}, {address.state}
              </p>
              {address.deliveryInstructions && (
                <p className="text-xs text-muted-foreground italic">
                  {address.deliveryInstructions}
                </p>
              )}
              {!address.isDefault && (
                <button
                  onClick={() =>
                    setDefault.mutate(address.id, {
                      onError: (e) =>
                        toast.error(e instanceof Error ? e.message : "Could not set as default."),
                    })
                  }
                  className="text-xs font-bold text-primary hover:underline pt-1"
                >
                  Set as default
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <AddressFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        customerId={user.id}
        hasAnyAddress={addresses.length > 0}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this address?"
        description={`This removes "${deleteTarget?.recipientName}" from your saved addresses. This can't be undone.`}
        confirmLabel="Delete"
        loading={deleteAddress.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteAddress.mutate(deleteTarget.id, {
            onSuccess: () => {
              toast.success("Address deleted.");
              setDeleteTarget(null);
            },
            onError: (e) =>
              toast.error(e instanceof Error ? e.message : "Could not delete this address."),
          });
        }}
      />
    </div>
  );
}
