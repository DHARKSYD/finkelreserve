import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { throwSafe } from "./safe-error";
import { setVariantStock } from "@/lib/actions/inventory";

export type ProductVariant = {
  id: string;
  productId: string;
  size: string; // bottle size, e.g. "750ml"
  sku: string | null;
  priceOverride: number | null;
  stock: number; // always in bottles
  image: string | null;
  updatedAt: string;
};

function mapVariant(row: Tables<"product_variants">): ProductVariant {
  return {
    id: row.id,
    productId: row.product_id,
    size: row.size,
    sku: row.sku,
    priceOverride: row.price_override != null ? Number(row.price_override) : null,
    stock: row.stock,
    image: row.image,
    updatedAt: row.updated_at,
  };
}

// ─── Variants for one product (Products admin editor) ─────────────────
export const useProductVariants = (productId: string | undefined) =>
  useQuery({
    queryKey: ["variants", productId],
    queryFn: async (): Promise<ProductVariant[]> => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", productId!)
        .order("size", { ascending: true });
      if (error) throwSafe(error, "Could not load stock by size.");
      return (data ?? []).map(mapVariant);
    },
    enabled: !!productId,
    staleTime: 15_000,
  });

// ─── Every variant, with its product's name/slug/threshold attached —
// powers the Overview low-stock widget and the Inventory placeholder.
export type VariantWithProduct = ProductVariant & {
  productName: string;
  productSlug: string;
  productImage: string;
  lowStockThreshold: number;
  productCostPrice: number | null;
  // Box packaging lives on the product (see products.bottles_per_box):
  productBottlesPerBox: number | null;
  productBoxDiscountPercent: number;
};

export const useAdminVariantsWithProduct = () =>
  useQuery({
    queryKey: ["variants", "admin", "all"],
    queryFn: async (): Promise<VariantWithProduct[]> => {
      const { data, error } = await supabase
        .from("product_variants")
        .select(
          "*, products!inner(name, slug, images, low_stock_threshold, cost_price, active, bottles_per_box, box_discount_percent)",
        );
      if (error) throwSafe(error, "Could not load inventory.");
      return (data ?? []).map((row) => ({
        ...mapVariant(row),
        productName: row.products.name,
        productSlug: row.products.slug,
        productImage: row.products.images?.[0] ?? "",
        lowStockThreshold: row.products.low_stock_threshold,
        productCostPrice: row.products.cost_price != null ? Number(row.products.cost_price) : null,
        productBottlesPerBox: row.products.bottles_per_box ?? null,
        productBoxDiscountPercent: Number(row.products.box_discount_percent ?? 0),
      }));
    },
    staleTime: 15_000,
  });

const invalidateVariants = (qc: ReturnType<typeof useQueryClient>, productId?: string) => {
  if (productId) qc.invalidateQueries({ queryKey: ["variants", productId] });
  qc.invalidateQueries({ queryKey: ["variants", "admin", "all"] });
  qc.invalidateQueries({ queryKey: ["products"] }); // products.stock is a synced cache
};

// Admin corrections set an absolute new value, same pattern as the plain
// product-stock edit this replaces — not the delta RPC checkout/cancel use,
// since this isn't racing a concurrent sale, it's a deliberate overwrite.
// Goes through set_variant_stock (server function → RPC) rather than a
// direct table update now, so every manual correction gets an
// inventory_movements row and an activity_log entry — see the
// 20260813140000 migration for why this couldn't stay a plain RLS-gated
// client write.
//
// productId is optional: the Products page edits one product's variants
// at a time and passes it, to also invalidate that product's own variants
// query; Inventory edits variants across many products in one table, so
// it omits it and relies on the "admin all" + products invalidation below.
export const useUpdateVariantStock = (productId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, stock }: { id: string; stock: number }) => {
      const result = await setVariantStock({ data: { variantId: id, stock: Math.max(0, stock) } });
      // result.error is already a safe, curated message from the server
      // function (not a raw DB error), so it's fine to surface directly —
      // throwSafe's redaction is for the opposite case, an unexpected
      // PostgrestError.message leaking through.
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => {
      invalidateVariants(qc, productId);
      qc.invalidateQueries({ queryKey: ["inventory", "movements"] });
    },
  });
};

export const useCreateVariant = (productId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { size: string; stock: number }) => {
      const row: TablesInsert<"product_variants"> = {
        product_id: productId,
        size: input.size,
        stock: Math.max(0, input.stock),
      };
      const { error } = await supabase.from("product_variants").insert(row);
      if (error) throwSafe(error, "Could not add that bottle size.");
    },
    onSuccess: () => invalidateVariants(qc, productId),
  });
};

export const useDeleteVariant = (productId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_variants").delete().eq("id", id);
      if (error) throwSafe(error, "Could not remove that bottle size.");
    },
    onSuccess: () => invalidateVariants(qc, productId),
  });
};
