import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "./auth";
import { isValidBottlesPerBox, isValidBoxDiscount } from "@/lib/box";
import {
  normalizeSku,
  planInventoryImport,
  type ImportRowPreview,
  type ImportVariantInfo,
} from "@/lib/inventory-import-plan";

// ─── Manual correction (Products page) ─────────────────────────────────

const setStockSchema = z.object({
  variantId: z.string().uuid(),
  stock: z.number().int().min(0),
  reason: z.string().trim().max(200).optional(),
});

export type SetStockResult = { ok: true; newStock: number } | { ok: false; error: string };

// Replaces the old direct-from-browser update: same (id, stock) call shape
// from ProductVariantsEditor, but now goes through set_variant_stock so the
// change is atomic with its inventory_movements + activity_log rows instead
// of being an unaudited write. See the migration for why this needs a
// service-role RPC rather than an RLS-gated client update.
export const setVariantStock = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => setStockSchema.parse(data))
  .handler(async ({ data }): Promise<SetStockResult> => {
    let actorId: string;
    try {
      actorId = await requireAdmin();
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Unauthorized." };
    }

    const { data: result, error } = await supabaseAdmin
      .rpc("set_variant_stock", {
        p_variant_id: data.variantId,
        p_new_stock: data.stock,
        p_actor_id: actorId,
        p_reason: data.reason ?? null,
      })
      .single();

    if (error || !result) return { ok: false, error: "Could not update stock." };
    if (!result.ok) return { ok: false, error: result.error_message ?? "Could not update stock." };
    return { ok: true, newStock: result.new_stock! };
  });

// ─── Import: step 1, validate + preview (no writes) ────────────────────

const importModeSchema = z.enum(["replace", "adjust"]);
export type ImportMode = z.infer<typeof importModeSchema>;

// What the stock column counts: single bottles, or boxes (× the product's bottles per box).
const importUnitSchema = z.enum(["bottles", "boxes"]);
export type ImportUnit = z.infer<typeof importUnitSchema>;

export type { ImportRowPreview } from "@/lib/inventory-import-plan";

// A spreadsheet cell: text, a number, or blank. The server (inventory-import-plan.ts) does all
// the parsing, so a blank cell can mean "leave alone" instead of being coerced to 0.
const cellSchema = z.union([z.string().max(40), z.number(), z.null()]).optional();

const rawRowSchema = z.object({
  sku: z.string().trim().max(100),
  value: cellSchema, // "New Stock" / "Adjustment" — in the unit the admin chose
  boxSize: cellSchema, // optional "Bottles per Box" column
  boxDiscount: cellSchema, // optional "Box Discount %" column
});

const validateSchema = z.object({
  mode: importModeSchema,
  unit: importUnitSchema.default("bottles"),
  rows: z
    .array(rawRowSchema)
    .min(1, "The file has no data rows.")
    .max(2000, "That's more rows than one import should handle — split it into smaller files."),
});

export type ImportPreviewResult = {
  rows: ImportRowPreview[];
  validCount: number;
  errorCount: number;
};

// Authoritative validation — re-checked here regardless of anything the
// browser already flagged while parsing the file, per "never trust an
// uploaded spreadsheet." Pure read: nothing in this step writes to the
// database, so re-running it (e.g. the admin tweaks the file and
// re-uploads) is always safe. What each cell means is decided in
// planInventoryImport (src/lib/inventory-import-plan.ts); this function only
// fetches the matching variants and their products' box settings for it.
export const validateInventoryImport = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => validateSchema.parse(data))
  .handler(async ({ data }): Promise<ImportPreviewResult> => {
    await requireAdmin();

    const skus = [...new Set(data.rows.map((r) => r.sku.trim()).filter(Boolean))];
    const { data: variants, error } = await supabaseAdmin
      .from("product_variants")
      .select(
        "id, sku, size, stock, product_id, products(name, bottles_per_box, box_discount_percent)",
      )
      .in("sku", skus);
    if (error) throw new Error("Could not look up products for this import.");

    const bySku = new Map<string, ImportVariantInfo>();
    for (const v of variants ?? []) {
      if (!v.sku) continue;
      bySku.set(normalizeSku(v.sku), {
        id: v.id,
        sku: v.sku,
        size: v.size,
        stock: v.stock,
        productId: v.product_id,
        productName: v.products?.name ?? null,
        boxSize: v.products?.bottles_per_box ?? null,
        boxDiscount: Number(v.products?.box_discount_percent ?? 0),
      });
    }

    const rows = planInventoryImport({
      mode: data.mode,
      unit: data.unit,
      rows: data.rows,
      lookup: (sku) => bySku.get(sku),
    });

    return {
      rows,
      validCount: rows.filter((r) => r.status === "valid").length,
      errorCount: rows.filter((r) => r.status === "error").length,
    };
  });

// ─── Import: step 2, apply atomically ───────────────────────────────────

const applyRowSchema = z
  .object({
    variantId: z.string().uuid(),
    // The replace/adjust figure, always in BOTTLES (boxes were converted in the preview step).
    value: z.number().int().nullable().optional(),
    skipStock: z.boolean().optional(),
    // Only present when the row changes its product's box settings.
    boxSize: z
      .number()
      .int()
      .refine((n) => n === 0 || isValidBottlesPerBox(n), "Bottles per box must be 0 or 2–48.")
      .optional(),
    boxDiscount: z
      .number()
      .refine(isValidBoxDiscount, "Box discount must be 0 to under 100.")
      .optional(),
  })
  .refine((r) => r.skipStock === true || (r.value !== null && r.value !== undefined), {
    message: "A row is missing its stock figure.",
  });

const applySchema = z.object({
  mode: importModeSchema,
  rows: z.array(applyRowSchema).min(1, "No valid rows to import."),
  filename: z.string().trim().max(200).optional(),
});

export type ApplyImportResult =
  { ok: true; batchId: string; rowsUpdated: number } | { ok: false; error: string };

// Only ever called with rows already narrowed to "valid" by the preview
// step (see InventoryImportDialog) — this function trusts variantId/value
// shape-wise but not correctness, because apply_inventory_import re-reads
// live stock under a row lock and can still fail a row here even though it
// looked fine in preview (e.g. a sale happened in between). See the
// migration: any failure rolls back the whole batch — stock AND box
// settings — nothing partial.
export const applyInventoryImport = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => applySchema.parse(data))
  .handler(async ({ data }): Promise<ApplyImportResult> => {
    let actorId: string;
    try {
      actorId = await requireAdmin();
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Unauthorized." };
    }

    const { data: result, error } = await supabaseAdmin
      .rpc("apply_inventory_import", {
        p_mode: data.mode,
        p_rows: data.rows.map((r) => ({
          variant_id: r.variantId,
          ...(r.skipStock ? { skip_stock: true } : { value: r.value }),
          ...(r.boxSize !== undefined ? { box_size: r.boxSize } : {}),
          ...(r.boxDiscount !== undefined ? { box_discount: r.boxDiscount } : {}),
        })),
        p_actor_id: actorId,
        p_filename: data.filename ?? null,
      })
      .single();

    // apply_inventory_import only ever raises exceptions we wrote
    // ourselves with an admin-facing message (negative stock, a variant
    // that vanished since preview) — safe to surface directly, unlike a
    // generic/unexpected DB error.
    if (error || !result) {
      return {
        ok: false,
        error: error?.message || "Could not complete the import. Nothing was changed.",
      };
    }
    return { ok: true, batchId: result.batch_id, rowsUpdated: result.rows_updated };
  });
