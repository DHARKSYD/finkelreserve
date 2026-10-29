import {
  MAX_BOTTLES_PER_BOX,
  MIN_BOTTLES_PER_BOX,
  isValidBottlesPerBox,
  isValidBoxDiscount,
} from "@/lib/box";

// Pure planning for the inventory import: raw spreadsheet rows + the matching database rows in,
// a per-row preview (and exactly what to apply) out. No database access lives here — the server
// function (actions/inventory.ts) looks the variants up and passes them in — so this file is the
// one place that defines what each cell MEANS, and it can be read (or tested) on its own.
//
// What a row can do:
//   · change a variant's stock — in BOTTLES, or in BOXES (× the product's bottles per box);
//   · set its product's box size ("Bottles per Box": 0 = stop selling by the box) and/or box
//     discount ("Box Discount %").
// A BLANK cell always means "leave this alone" — never zero.

export type ImportMode = "replace" | "adjust";
export type ImportUnit = "bottles" | "boxes";

/** A cell as read from the file: text, a number, or null when blank. */
export type ImportCell = string | number | null | undefined;

export type RawImportRow = {
  sku: string;
  value?: ImportCell; // stock figure, in the unit the admin chose
  boxSize?: ImportCell; // "Bottles per Box" column (optional)
  boxDiscount?: ImportCell; // "Box Discount %" column (optional)
};

/** What the database knows about a SKU. */
export type ImportVariantInfo = {
  id: string;
  sku: string;
  size: string;
  stock: number;
  productId: string;
  productName: string | null;
  boxSize: number | null; // products.bottles_per_box
  boxDiscount: number; // products.box_discount_percent
};

export type ImportRowPreview = {
  sku: string;
  productName: string | null;
  size: string | null;
  variantId: string | null;
  currentStock: number | null;
  newStock: number | null;
  /** newStock − currentStock, in bottles. */
  change: number | null;
  /** e.g. "2 boxes × 6 = 12 bottles" when the file counts in boxes. */
  stockNote: string | null;
  // What the apply step sends — always BOTTLES, never boxes:
  applyValue: number | null; // the replace/adjust figure; null when stock is not touched
  skipStock: boolean; // blank stock cell: leave stock alone
  boxSizeToApply?: number; // only when this row changes the product's box size (0 = turn off)
  boxDiscountToApply?: number; // only when this row changes the product's box discount
  // Box settings of the product, before → after this import:
  currentBoxSize: number | null;
  currentBoxDiscount: number;
  newBoxSize: number | null;
  newBoxDiscount: number;
  boxChanged: boolean;
  status: "valid" | "error";
  message: string | null;
};

// ─── Cell parsing ───────────────────────────────────────────────────────

type Parsed = { kind: "blank" } | { kind: "number"; n: number } | { kind: "bad" };

// Strict on purpose: "12", "12.5", "-3" only. No thousands separators ("1,200" and the
// European "6,5" would otherwise silently become wrong numbers) — a clear error is better.
const NUMBER_RE = /^-?\d+(\.\d+)?$/;

function parseCell(cell: ImportCell, { allowPercent = false } = {}): Parsed {
  if (cell === null || cell === undefined) return { kind: "blank" };
  if (typeof cell === "number")
    return Number.isFinite(cell) ? { kind: "number", n: cell } : { kind: "bad" };
  let t = cell.trim();
  if (allowPercent) t = t.replace(/\s*%$/, "");
  if (t === "") return { kind: "blank" };
  return NUMBER_RE.test(t) ? { kind: "number", n: Number(t) } : { kind: "bad" };
}

export const normalizeSku = (sku: string) => sku.trim().toUpperCase();

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ─── Planning ───────────────────────────────────────────────────────────

export function planInventoryImport(args: {
  mode: ImportMode;
  unit: ImportUnit;
  rows: RawImportRow[];
  /** Looks a SKU up (already normalised with normalizeSku). */
  lookup: (normalizedSku: string) => ImportVariantInfo | undefined;
}): ImportRowPreview[] {
  const { mode, unit, rows, lookup } = args;

  const occurrences = new Map<string, number>();
  for (const row of rows) {
    const key = normalizeSku(row.sku);
    if (key) occurrences.set(key, (occurrences.get(key) ?? 0) + 1);
  }

  // Pass 1 — per-row checks that don't depend on other rows.
  type Pass1 = {
    row: RawImportRow;
    variant?: ImportVariantInfo;
    error?: string;
    // null = not specified in the file (leave as is); 0 = turn box selling off
    boxSize: number | null;
    boxDiscount: number | null;
  };

  const pass1: Pass1[] = rows.map((row) => {
    const out: Pass1 = { row, boxSize: null, boxDiscount: null };
    const key = normalizeSku(row.sku);
    if (!key) return { ...out, error: "SKU is required." };
    if ((occurrences.get(key) ?? 0) > 1) {
      return { ...out, error: "SKU appears more than once in the uploaded file." };
    }
    const variant = lookup(key);
    if (!variant) return { ...out, error: `No product variant matches SKU "${row.sku}".` };
    out.variant = variant;

    const size = parseCell(row.boxSize);
    if (size.kind === "bad") {
      return {
        ...out,
        error: `Bottles per Box must be a whole number from ${MIN_BOTTLES_PER_BOX} to ${MAX_BOTTLES_PER_BOX} (or 0 to stop selling by the box).`,
      };
    }
    if (size.kind === "number") {
      if (size.n !== 0 && !isValidBottlesPerBox(size.n)) {
        return {
          ...out,
          error: `Bottles per Box must be a whole number from ${MIN_BOTTLES_PER_BOX} to ${MAX_BOTTLES_PER_BOX} (or 0 to stop selling by the box).`,
        };
      }
      out.boxSize = size.n;
    }

    const discount = parseCell(row.boxDiscount, { allowPercent: true });
    if (
      discount.kind === "bad" ||
      (discount.kind === "number" && !isValidBoxDiscount(discount.n))
    ) {
      return { ...out, error: "Box Discount % must be a number from 0 up to (not including) 100." };
    }
    if (discount.kind === "number") out.boxDiscount = discount.n;

    return out;
  });

  // Pass 2 — box settings belong to the PRODUCT, but rows are per SKU/size. Several rows of one
  // product may carry box settings; they must agree, or we can't know which one is meant.
  const sizesByProduct = new Map<string, Set<number>>();
  const discountsByProduct = new Map<string, Set<number>>();
  for (const p of pass1) {
    if (p.error || !p.variant) continue;
    const pid = p.variant.productId;
    if (p.boxSize !== null)
      sizesByProduct.set(pid, (sizesByProduct.get(pid) ?? new Set()).add(p.boxSize));
    if (p.boxDiscount !== null) {
      discountsByProduct.set(pid, (discountsByProduct.get(pid) ?? new Set()).add(p.boxDiscount));
    }
  }

  const previews = pass1.map((p): ImportRowPreview => {
    const v = p.variant;
    const blank: ImportRowPreview = {
      sku: p.row.sku,
      productName: v?.productName ?? null,
      size: v?.size ?? null,
      variantId: v?.id ?? null,
      currentStock: v?.stock ?? null,
      newStock: null,
      change: null,
      stockNote: null,
      applyValue: null,
      skipStock: false,
      currentBoxSize: v?.boxSize ?? null,
      currentBoxDiscount: v?.boxDiscount ?? 0,
      newBoxSize: v?.boxSize ?? null,
      newBoxDiscount: v?.boxDiscount ?? 0,
      boxChanged: false,
      status: "error",
      message: null,
    };
    const fail = (message: string): ImportRowPreview => ({ ...blank, status: "error", message });

    if (p.error || !v) return fail(p.error ?? "Row could not be matched.");

    if (p.boxSize !== null && (sizesByProduct.get(v.productId)?.size ?? 0) > 1) {
      return fail(
        "Rows for this product disagree on Bottles per Box — use the same value on every row.",
      );
    }
    if (p.boxDiscount !== null && (discountsByProduct.get(v.productId)?.size ?? 0) > 1) {
      return fail(
        "Rows for this product disagree on Box Discount % — use the same value on every row.",
      );
    }

    // Box settings this product will have after the import. The product-level value any row
    // of this product specified (they agree, checked above) — not just this row's own cell — so
    // a "boxes" stock figure on a sibling size converts with the same box size.
    const specifiedSize = [...(sizesByProduct.get(v.productId) ?? [])][0];
    const specifiedDiscount = [...(discountsByProduct.get(v.productId) ?? [])][0];
    const newBoxSize =
      specifiedSize === undefined ? v.boxSize : specifiedSize === 0 ? null : specifiedSize;
    const newBoxDiscount = specifiedDiscount === undefined ? v.boxDiscount : specifiedDiscount;

    if (newBoxSize === null && p.boxDiscount !== null && p.boxDiscount > 0) {
      return fail(
        "Set Bottles per Box too — this product isn't sold by the box, so a discount has no effect.",
      );
    }

    // Only ask the apply step to touch the box settings when this row actually changes them.
    const boxSizeToApply =
      p.boxSize !== null && (p.boxSize === 0 ? v.boxSize !== null : p.boxSize !== v.boxSize)
        ? p.boxSize
        : undefined;
    const boxDiscountToApply =
      p.boxDiscount !== null && p.boxDiscount !== v.boxDiscount ? p.boxDiscount : undefined;

    const withBox: ImportRowPreview = {
      ...blank,
      newBoxSize,
      newBoxDiscount,
      boxChanged: boxSizeToApply !== undefined || boxDiscountToApply !== undefined,
      boxSizeToApply,
      boxDiscountToApply,
    };

    // Stock. Blank = leave stock alone (so a row can update box settings only).
    const stock = parseCell(p.row.value);
    if (stock.kind === "bad") {
      return {
        ...withBox,
        status: "error",
        message: `Stock must be a number (whole ${unit}).`,
      };
    }

    if (stock.kind === "blank") {
      const changed = withBox.boxChanged;
      return {
        ...withBox,
        newStock: v.stock,
        change: 0,
        skipStock: true,
        status: "valid",
        message: changed ? "Box settings updated; stock unchanged." : "No change.",
      };
    }

    if (!Number.isInteger(stock.n)) {
      return { ...withBox, status: "error", message: `Stock must be a whole number of ${unit}.` };
    }

    let bottles = stock.n;
    let stockNote: string | null = null;
    if (unit === "boxes") {
      if (newBoxSize === null) {
        return {
          ...withBox,
          status: "error",
          message:
            "This product isn't sold by the box — add a Bottles per Box value on this row, or count this file in bottles.",
        };
      }
      bottles = stock.n * newBoxSize;
      stockNote = `${plural(stock.n, "box", "boxes")} × ${newBoxSize} = ${plural(bottles, "bottle", "bottles")}`;
    }

    if (mode === "replace" && bottles < 0) {
      return { ...withBox, status: "error", message: "Stock cannot be negative." };
    }

    const newStock = mode === "replace" ? bottles : v.stock + bottles;
    if (newStock < 0) {
      const shown = mode === "adjust" ? `${bottles >= 0 ? "+" : ""}${bottles}` : `→ ${bottles}`;
      return {
        ...withBox,
        status: "error",
        message: `Would result in negative stock (${v.stock} ${shown}).`,
      };
    }

    const stockChanged = newStock !== v.stock;
    return {
      ...withBox,
      newStock,
      change: newStock - v.stock,
      stockNote,
      applyValue: bottles,
      status: "valid",
      message: !stockChanged && !withBox.boxChanged ? "No change." : null,
    };
  });

  // Pass 3 — a product's box settings are applied by the row(s) that carry them, but sibling rows
  // of the same product were converted/previewed assuming those settings WILL be applied. If a
  // row that carries box settings failed, they won't be, and its siblings' previews would be
  // wrong. So block the whole product until the file is fixed, rather than apply a half-picture.
  const blockedProducts = new Set<string>();
  previews.forEach((preview, i) => {
    const v = pass1[i].variant;
    if (
      preview.status === "error" &&
      v &&
      (pass1[i].boxSize !== null || pass1[i].boxDiscount !== null)
    ) {
      blockedProducts.add(v.productId);
    }
  });
  if (blockedProducts.size === 0) return previews;

  return previews.map((preview, i) => {
    const v = pass1[i].variant;
    if (preview.status === "valid" && v && blockedProducts.has(v.productId)) {
      return {
        ...preview,
        status: "error" as const,
        message:
          "Another row for this product sets its box settings and has an error, so none of this product's rows are applied. Fix that row and re-upload.",
      };
    }
    return preview;
  });
}
