import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  useProductVariants,
  useUpdateVariantStock,
  useCreateVariant,
  useDeleteVariant,
} from "@/lib/queries/variants";
import { ConfirmDialog } from "./ConfirmDialog";

export function ProductVariantsEditor({
  productId,
  bottlesPerBox,
}: {
  productId: string;
  // The product's box size (set on the product form), only to show boxes-in-stock here.
  bottlesPerBox: number | null;
}) {
  const { data: variants = [], isLoading } = useProductVariants(productId);
  const updateStock = useUpdateVariantStock(productId);
  const createVariant = useCreateVariant(productId);
  const deleteVariant = useDeleteVariant(productId);

  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});
  const [newSize, setNewSize] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);

  const commitStock = (id: string, current: number) => {
    const draft = stockDrafts[id];
    if (draft === undefined) return;
    const next = Math.max(0, Math.round(Number(draft)) || 0);
    if (next === current) return;
    updateStock.mutate(
      { id, stock: next },
      { onError: () => toast.error("Could not update stock for that bottle size.") },
    );
  };

  const addVariant = () => {
    const size = newSize.trim();
    if (!size) return;
    if (variants.some((v) => v.size === size)) {
      toast.error(`${size} is already tracked.`);
      return;
    }
    createVariant.mutate(
      { size, stock: 0 },
      {
        onSuccess: () => setNewSize(""),
        onError: () => toast.error("Could not add that bottle size."),
      },
    );
  };

  if (isLoading) return <p className="text-xs text-muted-foreground py-2">Loading bottle sizes…</p>;

  return (
    <div className="space-y-3">
      {variants.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No bottle sizes tracked yet — add one below.
        </p>
      ) : (
        <div className="grid gap-1.5">
          <div className="grid grid-cols-[4.5rem_1fr_2rem] gap-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground px-0.5">
            <span>Size</span>
            <span>Stock (bottles)</span>
            <span />
          </div>
          {variants.map((v) => (
            <div key={v.id} className="grid grid-cols-[4.5rem_1fr_2rem] gap-2 items-center text-xs">
              <span className="font-semibold">{v.size}</span>
              <input
                type="number"
                min={0}
                defaultValue={v.stock}
                onChange={(e) => setStockDrafts((d) => ({ ...d, [v.id]: e.target.value }))}
                onBlur={() => commitStock(v.id, v.stock)}
                className={`w-full bg-input rounded-md px-2 py-1 outline-none focus:ring-2 ring-primary ${
                  v.stock === 0 ? "text-destructive font-bold" : ""
                }`}
              />
              <button
                onClick={() => setDeleteTarget({ id: v.id, label: v.size })}
                className="h-7 w-7 grid place-items-center rounded-md bg-surface-2 hover:bg-destructive hover:text-destructive-foreground"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {variants.length > 0 && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Stock is always counted in bottles.
          {bottlesPerBox
            ? ` This product is sold by the box of ${bottlesPerBox} — whole boxes in stock: ` +
              variants.map((v) => `${v.size} → ${Math.floor(v.stock / bottlesPerBox)}`).join(", ") +
              ". Change the box size or discount in the product details above."
            : " Turn on “Also sell by the box” in the product details above to let customers buy a box."}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <input
          value={newSize}
          onChange={(e) => setNewSize(e.target.value)}
          placeholder="Bottle size (e.g. 750ml)"
          className="w-40 bg-input rounded-md px-2 py-1.5 text-xs outline-none focus:ring-2 ring-primary"
        />
        <button
          onClick={addVariant}
          disabled={!newSize.trim() || createVariant.isPending}
          className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2.5 py-1.5 text-xs font-bold disabled:opacity-50"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Remove ${deleteTarget?.label ?? "this size"}?`}
        description="This stops tracking stock for that bottle size. It won't affect past orders."
        confirmLabel="Remove"
        loading={deleteVariant.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteVariant.mutate(deleteTarget.id, {
            onError: () => toast.error("Could not remove that bottle size."),
            onSettled: () => setDeleteTarget(null),
          });
        }}
      />
    </div>
  );
}
