// Box packaging — shared helpers (used by the server AND the browser).
//
// A product can be bought by the single bottle or by the box. Stock is always counted in
// BOTTLES; a box of N takes N bottles from stock. The box price is derived from the
// one-bottle price and an admin-set discount, so the bottle price stays the single source of
// truth:
//
//     box price = round( bottle price × bottles per box × (1 − discount / 100) )   [whole ₦]
//
// placeOrder (checkout.ts) is the only place that decides what is actually charged; the
// client uses the same functions below purely for display.

export type PurchaseUnit = "bottle" | "box";

/** Max units per order line. Mirrors the server schema in checkout.ts. */
export const MAX_LINE_QTY = 20;

/** Bottles per box: the form default, and the range the database enforces. */
export const DEFAULT_BOTTLES_PER_BOX = 6;
export const MIN_BOTTLES_PER_BOX = 2;
export const MAX_BOTTLES_PER_BOX = 48;

export type BoxPricing = {
  /** What N single bottles cost with no discount. */
  regular: number;
  /** What one box costs (after the discount, whole naira). */
  price: number;
  /** regular − price: how much the customer saves by buying the box. */
  saving: number;
  /** Effective price of one bottle inside the box. */
  perBottle: number;
  /** The admin's discount, echoed back for display. */
  percent: number;
};

export function boxPricing(
  bottlePrice: number,
  bottlesPerBox: number,
  discountPercent: number,
): BoxPricing {
  const percent = Math.min(Math.max(discountPercent || 0, 0), 99.99);
  const regular = bottlePrice * bottlesPerBox;
  const price = Math.round(regular * (1 - percent / 100));
  return { regular, price, saving: regular - price, perBottle: price / bottlesPerBox, percent };
}

/** Is a number a valid "bottles per box"? (whole number, 2–48) */
export const isValidBottlesPerBox = (n: number) =>
  Number.isInteger(n) && n >= MIN_BOTTLES_PER_BOX && n <= MAX_BOTTLES_PER_BOX;

/** Is a number a valid box discount? (0 up to, not including, 100) */
export const isValidBoxDiscount = (n: number) => Number.isFinite(n) && n >= 0 && n < 100;

/** "Box of 6" / "Bottle" */
export const unitLabel = (unit: PurchaseUnit, bottlesPerUnit: number) =>
  unit === "box" ? `Box of ${bottlesPerUnit}` : "Bottle";

/** Bottles a line actually takes from stock (qty × bottles per unit). */
export const bottlesIn = (line: { qty: number; bottlesPerUnit?: number | null }) =>
  line.qty * (line.bottlesPerUnit && line.bottlesPerUnit > 0 ? line.bottlesPerUnit : 1);

/** "2 boxes of 6 (12 bottles)" / "3 bottles" — for confirmations and messages. */
export function describeQty(line: {
  qty: number;
  unit?: PurchaseUnit | null;
  bottlesPerUnit?: number | null;
}): string {
  if (line.unit === "box") {
    const n = line.bottlesPerUnit ?? 1;
    return `${line.qty} ${line.qty === 1 ? "box" : "boxes"} of ${n} (${line.qty * n} bottles)`;
  }
  return `${line.qty} ${line.qty === 1 ? "bottle" : "bottles"}`;
}

/** "750ml · box of 6" / "750ml" — the size line under an item name. */
export function sizeWithUnit(
  size: string,
  unit?: PurchaseUnit | null,
  bottlesPerUnit?: number | null,
): string {
  const base = size || "—";
  return unit === "box" ? `${base} · box of ${bottlesPerUnit ?? 1}` : base;
}

/** "4 × 6 + 2 loose" — a bottle count expressed as whole boxes plus loose bottles. */
export function boxesAndLoose(bottles: number, bottlesPerBox: number): string {
  const boxes = Math.floor(bottles / bottlesPerBox);
  const loose = bottles % bottlesPerBox;
  return `${boxes} × ${bottlesPerBox}${loose ? ` + ${loose} loose` : ""}`;
}
