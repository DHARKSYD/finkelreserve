import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import type { Product, ProductBadge, ProductType } from "@/lib/products";
import { bottlePlaceholder } from "@/lib/placeholder";
import { throwSafe } from "./safe-error";

type ProductRow = Tables<"products">;

/** DB row (snake_case, nullable columns) → the Product shape the UI already knows. */
function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    producer: row.producer,
    productType: row.wine_type as ProductType,
    region: row.region ?? null,
    country: row.country ?? null,
    grapeVariety: row.grape_variety ?? [],
    vintage: row.vintage ?? null,
    abv: row.abv != null ? Number(row.abv) : null,
    tastingNotes: row.tasting_notes ?? null,
    foodPairing: row.food_pairing ?? null,
    appearance: row.appearance ?? null,
    nose: row.nose ?? null,
    palate: row.palate ?? null,
    finish: row.finish ?? null,
    servingNotes: row.serving_notes ?? null,
    cellaringNotes: row.cellaring_notes ?? null,
    producerNotes: row.producer_notes ?? null,
    winemakingNotes: row.winemaking_notes ?? null,
    bottleSizes: row.bottle_sizes ?? [],
    price: Number(row.price),
    bottlesPerBox: row.bottles_per_box ?? null,
    boxDiscountPercent: Number(row.box_discount_percent ?? 0),
    oldPrice: row.old_price != null ? Number(row.old_price) : undefined,
    // No photo yet → a bottle in the wine's colour (inline SVG), not a hotlinked stock shot of some other wine.
    images: row.images?.length ? row.images : [bottlePlaceholder(row.wine_type)],
    badge: (row.badge as ProductBadge | null) ?? undefined,
    description: row.description ?? "",
    details: row.details ?? undefined,
    highlights: row.highlights ?? undefined,
    rating: Number(row.rating),
    reviews: row.reviews_count,
    stock: row.stock,
    createdAt: new Date(row.created_at).getTime(),
    active: row.active,
    sku: row.sku ?? undefined,
    costPrice: row.cost_price != null ? Number(row.cost_price) : undefined,
    lowStockThreshold: row.low_stock_threshold,
    featured: row.featured,
    tags: row.tags ?? [],
    seoTitle: row.seo_title ?? undefined,
    seoDescription: row.seo_description ?? undefined,
  };
}

// ─── Storefront: active products only ────────────────────────────────
export const productsQuery = queryOptions({
  queryKey: ["products"],
  queryFn: async (): Promise<Product[]> => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false });
    if (error) throwSafe(error, "Could not load products.");
    return (data ?? []).map(mapProduct);
  },
  staleTime: 60_000,
});

export const useProducts = () => useQuery(productsQuery);

export const productBySlugQuery = (slug: string) =>
  queryOptions({
    queryKey: ["products", "slug", slug],
    queryFn: async (): Promise<Product | null> => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("slug", slug)
        .eq("active", true)
        .maybeSingle();
      if (error) throwSafe(error, "Could not load this product.");
      return data ? mapProduct(data) : null;
    },
    staleTime: 60_000,
  });

export const useProduct = (slug: string) => useQuery(productBySlugQuery(slug));

// ─── Admin: every product, active or not ─────────────────────────────
export const adminProductsQuery = queryOptions({
  queryKey: ["products", "admin"],
  queryFn: async (): Promise<Product[]> => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throwSafe(error, "Could not load products.");
    return (data ?? []).map(mapProduct);
  },
  staleTime: 15_000,
});

export const useAdminProducts = () => useQuery(adminProductsQuery);

const invalidateProducts = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["products"] });
};

export type NewProductInput = Omit<Product, "id" | "rating" | "reviews" | "createdAt"> & {
  rating?: number;
};

export const useCreateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewProductInput) => {
      const row: TablesInsert<"products"> = {
        slug: input.slug,
        name: input.name,
        description: input.description,
        details: input.details,
        price: input.price,
        bottles_per_box: input.bottlesPerBox,
        box_discount_percent: input.boxDiscountPercent,
        old_price: input.oldPrice ?? null,
        producer: input.producer,
        wine_type: input.productType,
        region: input.region,
        country: input.country,
        grape_variety: input.grapeVariety,
        vintage: input.vintage,
        abv: input.abv,
        tasting_notes: input.tastingNotes,
        food_pairing: input.foodPairing,
        appearance: input.appearance,
        nose: input.nose,
        palate: input.palate,
        finish: input.finish,
        serving_notes: input.servingNotes,
        cellaring_notes: input.cellaringNotes,
        producer_notes: input.producerNotes,
        winemaking_notes: input.winemakingNotes,
        bottle_sizes: input.bottleSizes,
        images: input.images,
        badge: input.badge ?? null,
        highlights: input.highlights ?? null,
        stock: input.stock,
        active: input.active,
        rating: input.rating ?? 4.8,
        sku: input.sku || null,
        cost_price: input.costPrice ?? null,
        low_stock_threshold: input.lowStockThreshold,
        featured: input.featured,
        tags: input.tags,
        seo_title: input.seoTitle || null,
        seo_description: input.seoDescription || null,
      };
      const { error } = await supabase.from("products").insert(row);
      if (error) throwSafe(error, "Could not create the product.");
    },
    onSuccess: () => invalidateProducts(qc),
  });
};

export const useUpdateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<NewProductInput> }) => {
      const row: Partial<TablesInsert<"products">> = {};
      if (patch.slug !== undefined) row.slug = patch.slug;
      if (patch.name !== undefined) row.name = patch.name;
      if (patch.description !== undefined) row.description = patch.description;
      if (patch.details !== undefined) row.details = patch.details;
      if (patch.price !== undefined) row.price = patch.price;
      if (patch.bottlesPerBox !== undefined) row.bottles_per_box = patch.bottlesPerBox;
      if (patch.boxDiscountPercent !== undefined)
        row.box_discount_percent = patch.boxDiscountPercent;
      if (patch.oldPrice !== undefined) row.old_price = patch.oldPrice ?? null;
      if (patch.producer !== undefined) row.producer = patch.producer;
      if (patch.productType !== undefined) row.wine_type = patch.productType;
      if (patch.region !== undefined) row.region = patch.region;
      if (patch.country !== undefined) row.country = patch.country;
      if (patch.grapeVariety !== undefined) row.grape_variety = patch.grapeVariety;
      if (patch.vintage !== undefined) row.vintage = patch.vintage;
      if (patch.abv !== undefined) row.abv = patch.abv;
      if (patch.tastingNotes !== undefined) row.tasting_notes = patch.tastingNotes;
      if (patch.foodPairing !== undefined) row.food_pairing = patch.foodPairing;
      if (patch.appearance !== undefined) row.appearance = patch.appearance;
      if (patch.nose !== undefined) row.nose = patch.nose;
      if (patch.palate !== undefined) row.palate = patch.palate;
      if (patch.finish !== undefined) row.finish = patch.finish;
      if (patch.servingNotes !== undefined) row.serving_notes = patch.servingNotes;
      if (patch.cellaringNotes !== undefined) row.cellaring_notes = patch.cellaringNotes;
      if (patch.producerNotes !== undefined) row.producer_notes = patch.producerNotes;
      if (patch.winemakingNotes !== undefined) row.winemaking_notes = patch.winemakingNotes;
      if (patch.bottleSizes !== undefined) row.bottle_sizes = patch.bottleSizes;
      if (patch.images !== undefined) row.images = patch.images;
      if (patch.badge !== undefined) row.badge = patch.badge ?? null;
      if (patch.highlights !== undefined) row.highlights = patch.highlights ?? null;
      if (patch.stock !== undefined) row.stock = patch.stock;
      if (patch.active !== undefined) row.active = patch.active;
      if (patch.sku !== undefined) row.sku = patch.sku || null;
      if (patch.costPrice !== undefined) row.cost_price = patch.costPrice ?? null;
      if (patch.lowStockThreshold !== undefined) row.low_stock_threshold = patch.lowStockThreshold;
      if (patch.featured !== undefined) row.featured = patch.featured;
      if (patch.tags !== undefined) row.tags = patch.tags;
      if (patch.seoTitle !== undefined) row.seo_title = patch.seoTitle || null;
      if (patch.seoDescription !== undefined) row.seo_description = patch.seoDescription || null;
      const { error } = await supabase.from("products").update(row).eq("id", id);
      if (error) throwSafe(error, "Could not save the product changes.");
    },
    onSuccess: () => invalidateProducts(qc),
  });
};

export const useDeleteProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throwSafe(error, "Could not delete the product.");
    },
    onSuccess: () => invalidateProducts(qc),
  });
};
