// Types + static reference taxonomy for the catalog.
//
// Product DATA lives in the `products` table (see supabase/migrations +
// supabase/seed.sql) and is fetched through the hooks in
// src/lib/queries/products.ts. What stays here is genuinely static:
// wine-type metadata (label/color for chips) rarely changes and isn't
// something a store admin needs a CRUD panel for.
//
// Unlike the old jersey model, `producer` and `region` are free text, not
// closed enums — wineries and regions are far too numerous to curate a
// static list the way club/brand were. Producer/region browsing pages
// should query DISTINCT values from `products` rather than a hardcoded
// array (see src/lib/queries/products.ts).

// What a product is. The DB column is still called `wine_type` (renaming a live
// column buys nothing and risks every policy/view/import that names it); it now
// holds any of the types below. Enforced in the app layer, like it always was.
export type ProductGroup = "wine" | "spirits" | "beverages";
export type ProductType =
  | "red"
  | "white"
  | "rose"
  | "sparkling"
  | "dessert"
  | "fortified"
  | "whiskey"
  | "cognac"
  | "gin"
  | "vodka"
  | "rum"
  | "tequila"
  | "liqueur"
  | "beer"
  | "non_alcoholic"
  | "mixers";
export type ProductBadge = "new" | "limited" | "hot" | "sale";

export type Product = {
  id: string;
  slug: string;
  name: string;
  producer: string;
  productType: ProductType;
  region: string | null;
  country: string | null;
  grapeVariety: string[];
  vintage: number | null; // harvest year; null = non-vintage (NV)
  abv: number | null; // alcohol by volume, percent — e.g. 13.5
  tastingNotes: string | null;
  foodPairing: string | null;
  appearance: string | null;
  nose: string | null;
  palate: string | null;
  finish: string | null;
  servingNotes: string | null;
  cellaringNotes: string | null;
  producerNotes: string | null;
  winemakingNotes: string | null;
  bottleSizes: string[]; // e.g. ["750ml", "1.5L"] — which sizes this wine is offered in
  price: number; // NGN, whole naira, per SINGLE bottle — the box price is derived from it (see box.ts)
  // Box packaging: bottlesPerBox null = not sold by the box; boxDiscountPercent is % off N single bottles.
  bottlesPerBox: number | null;
  boxDiscountPercent: number;
  oldPrice?: number; // compare-at price
  images: string[];
  badge?: ProductBadge;
  description: string;
  details?: string;
  highlights?: string[];
  rating: number;
  reviews: number;
  stock: number;
  createdAt: number; // ms — for sorting "new arrivals"
  active: boolean;
  sku?: string;
  costPrice?: number;
  lowStockThreshold: number;
  featured: boolean;
  tags: string[];
  seoTitle?: string;
  seoDescription?: string;
};

/** A product counts as a "new arrival" if it was added in the last N days. */
export const NEW_ARRIVAL_WINDOW_DAYS = 14;
export const isNewArrival = (p: Pick<Product, "createdAt">) =>
  Date.now() - p.createdAt < NEW_ARRIVAL_WINDOW_DAYS * 86400000;

export const PRODUCT_GROUPS: { key: ProductGroup; label: string }[] = [
  { key: "wine", label: "Wines" },
  { key: "spirits", label: "Whiskey & Spirits" },
  { key: "beverages", label: "Fine Beverages" },
];

export const PRODUCT_TYPES: {
  key: ProductType;
  label: string;
  color: string;
  group: ProductGroup;
}[] = [
  { key: "red", label: "Red", color: "#6b1f2a", group: "wine" },
  { key: "white", label: "White", color: "#d4b96a", group: "wine" },
  { key: "rose", label: "Rosé", color: "#e8a4a0", group: "wine" },
  { key: "sparkling", label: "Sparkling & Champagne", color: "#c9a84c", group: "wine" },
  { key: "dessert", label: "Dessert", color: "#8a5a2f", group: "wine" },
  { key: "fortified", label: "Fortified", color: "#5c1f1f", group: "wine" },
  { key: "whiskey", label: "Whiskey", color: "#b36b1c", group: "spirits" },
  { key: "cognac", label: "Cognac & Brandy", color: "#8f4a1a", group: "spirits" },
  { key: "gin", label: "Gin", color: "#7aa6a1", group: "spirits" },
  { key: "vodka", label: "Vodka", color: "#9aa7b0", group: "spirits" },
  { key: "rum", label: "Rum", color: "#6e3a1a", group: "spirits" },
  { key: "tequila", label: "Tequila", color: "#c9a24b", group: "spirits" },
  { key: "liqueur", label: "Liqueurs", color: "#7a2f4a", group: "spirits" },
  { key: "beer", label: "Beer & Cider", color: "#c98a1e", group: "beverages" },
  { key: "non_alcoholic", label: "Non-Alcoholic", color: "#5f7a4a", group: "beverages" },
  { key: "mixers", label: "Mixers & Premium Soft Drinks", color: "#4a6f8a", group: "beverages" },
];

export const productTypeLabel = (t: string): string =>
  PRODUCT_TYPES.find((w) => w.key === t)?.label ?? t;

export const productGroupOf = (t: string): ProductGroup =>
  PRODUCT_TYPES.find((w) => w.key === t)?.group ?? "wine";

/** Common bottle sizes offered as product_variants.size values (wine, spirits and beverages). */
export const BOTTLE_SIZES = [
  "200ml",
  "375ml",
  "500ml",
  "700ml",
  "750ml",
  "1L",
  "1.5L",
  "3L",
] as const;
export type BottleSize = (typeof BOTTLE_SIZES)[number];
