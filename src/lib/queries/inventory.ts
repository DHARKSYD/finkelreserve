import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { throwSafe } from "./safe-error";
import type { ParsedImportRow } from "@/lib/inventory-import-file";
import {
  validateInventoryImport,
  applyInventoryImport,
  type ImportMode,
  type ImportUnit,
  type ImportPreviewResult,
  type ApplyImportResult,
} from "@/lib/actions/inventory";

export type InventoryStatus = "healthy" | "low" | "out";

export function inventoryStatus(stock: number, lowStockThreshold: number): InventoryStatus {
  if (stock <= 0) return "out";
  if (stock <= lowStockThreshold) return "low";
  return "healthy";
}

// ─── Movement history (manual corrections + import batches) ────────────

export type InventoryMovement = {
  id: string;
  at: number;
  delta: number;
  previousStock: number;
  newStock: number;
  source: "manual" | "import";
  reason: string | null;
  importBatchId: string | null;
  productName: string | null;
  size: string | null;
  sku: string | null;
};

export const useInventoryMovements = (limit = 50) =>
  useQuery({
    queryKey: ["inventory", "movements", limit],
    queryFn: async (): Promise<InventoryMovement[]> => {
      const { data, error } = await supabase
        .from("inventory_movements")
        .select("*, products(name), product_variants(size, sku)")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throwSafe(error, "Could not load inventory history.");
      return (data ?? []).map((m) => ({
        id: m.id,
        at: new Date(m.created_at).getTime(),
        delta: m.delta,
        previousStock: m.previous_stock,
        newStock: m.new_stock,
        source: m.source as "manual" | "import",
        reason: m.reason,
        importBatchId: m.import_batch_id,
        productName: m.products?.name ?? null,
        size: m.product_variants?.size ?? null,
        sku: m.product_variants?.sku ?? null,
      }));
    },
    staleTime: 15_000,
  });

// ─── Import: validate (preview) ─────────────────────────────────────────

export const useValidateInventoryImport = () =>
  useMutation({
    mutationFn: (input: { mode: ImportMode; unit: ImportUnit; rows: ParsedImportRow[] }) =>
      validateInventoryImport({ data: input }) as Promise<ImportPreviewResult>,
  });

// ─── Import: apply ───────────────────────────────────────────────────────

export const useApplyInventoryImport = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      mode: ImportMode;
      rows: {
        variantId: string;
        value: number | null; // bottles (boxes were converted in the preview)
        skipStock: boolean;
        boxSize?: number; // only when the row changes its product's box size (0 = off)
        boxDiscount?: number; // only when the row changes its product's box discount
      }[];
      filename?: string;
    }) => applyInventoryImport({ data: input }) as Promise<ApplyImportResult>,
    onSuccess: (result) => {
      if (!result.ok) return;
      qc.invalidateQueries({ queryKey: ["variants"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
};
