import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "./products";
import { MAX_LINE_QTY, boxPricing, type PurchaseUnit } from "./box";

// Cart and wishlist are the two pieces of state that genuinely belong on
// the client: they're per-browser, pre-checkout, and don't need a server
// round-trip to feel instant. Everything else — catalog, orders, reviews,
// activity, taxonomy — is real data in Supabase (src/lib/queries/*,
// src/lib/actions/checkout.ts).

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  price: number; // NGN
  image: string;
  size: string; // bottle size, e.g. "750ml"
  // What `qty` counts. For a box, `price` is the price of the whole box (after the
  // box discount) and bottlesPerUnit is the bottles in it. Display only — placeOrder
  // recomputes both from the database.
  unit: PurchaseUnit;
  bottlesPerUnit: number;
  qty: number;
};

type CartState = {
  items: CartItem[];
  isOpen: boolean;
  open: () => void;
  close: () => void;
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  remove: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  totalCount: () => number;
  subtotal: () => number;
};

// Same product in a different bottle size — or bought as a box instead of single
// bottles — must not merge into one line. `unit` is optional so carts saved before
// boxes existed (no unit field) still resolve to "bottle".
export const cartKey = (i: { productId: string; size: string; unit?: PurchaseUnit }) =>
  `${i.productId}-${i.size}-${i.unit ?? "bottle"}`;

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      add: (item, qty = 1) => {
        const key = cartKey(item);
        const items = [...get().items];
        const existing = items.find((i) => cartKey(i) === key);
        if (existing) existing.qty = Math.min(MAX_LINE_QTY, existing.qty + qty);
        else items.push({ ...item, qty });
        set({ items, isOpen: true });
      },
      remove: (key) => set({ items: get().items.filter((i) => cartKey(i) !== key) }),
      setQty: (key, qty) =>
        set({
          items: get().items.map((i) =>
            cartKey(i) === key ? { ...i, qty: Math.min(MAX_LINE_QTY, Math.max(1, qty)) } : i,
          ),
        }),
      clear: () => set({ items: [] }),
      totalCount: () => get().items.reduce((s, i) => s + i.qty, 0),
      subtotal: () => get().items.reduce((s, i) => s + i.qty * i.price, 0),
    }),
    {
      name: "finkel-cart",
      // v1 added `unit`/`bottlesPerUnit` (carts before that are all single bottles);
      // v2 renamed the "carton" unit to "box". Fill in / rename rather than drop
      // customers' bags.
      version: 2,
      migrate: (persisted) => {
        const state = persisted as
          { items?: (Omit<Partial<CartItem>, "unit"> & { unit?: string })[] } | undefined;
        if (state?.items) {
          state.items = state.items.map((i) => ({
            ...i,
            unit: i.unit === "box" || i.unit === "carton" ? "box" : "bottle",
            bottlesPerUnit: i.bottlesPerUnit ?? 1,
          }));
        }
        return state as unknown as CartState;
      },
    },
  ),
);

type WishlistState = {
  ids: string[];
  toggle: (id: string) => void;
  has: (id: string) => boolean;
};

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) =>
        set({
          ids: get().ids.includes(id) ? get().ids.filter((x) => x !== id) : [...get().ids, id],
        }),
      has: (id) => get().ids.includes(id),
    }),
    { name: "finkel-wishlist" },
  ),
);

// `asBox` buys the product by the box (only honoured if the product has a box size).
export const productToCart = (p: Product, size: string, asBox = false): Omit<CartItem, "qty"> => {
  const box = asBox && p.bottlesPerBox ? p.bottlesPerBox : null;
  return {
    productId: p.id,
    slug: p.slug,
    name: p.name,
    // per unit: one bottle, or a whole box at its discounted price
    price: box ? boxPricing(p.price, box, p.boxDiscountPercent).price : p.price,
    image: p.images[0],
    size,
    unit: box ? "box" : "bottle",
    bottlesPerUnit: box ?? 1,
  };
};
