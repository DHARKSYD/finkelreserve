import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { throwSafe } from "./safe-error";

export type Review = {
  id: string;
  productId: string;
  userId: string;
  name: string;
  rating: number;
  text: string;
  at: number;
};

async function attachNames(
  rows: {
    id: string;
    product_id: string;
    user_id: string;
    rating: number;
    text: string;
    created_at: string;
  }[],
): Promise<Review[]> {
  if (rows.length === 0) return [];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  // profiles itself is owner+admin-only now (see this session's privacy
  // migration) — public_profiles is the narrow view that exists
  // specifically for this: reviewer id+display_name, publicly readable,
  // with no phone number attached. Not in generated types.ts yet
  // (documented types.ts gap, same as every other recent migration).
  const db = supabase as unknown as {
    from: (table: "public_profiles") => {
      select: (cols: string) => {
        in: (
          col: string,
          vals: string[],
        ) => Promise<{ data: { id: string; display_name: string | null }[] | null }>;
      };
    };
  };
  const { data: profiles } = await db
    .from("public_profiles")
    .select("id, display_name")
    .in("id", userIds);
  const nameFor = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  return rows.map((r) => ({
    id: r.id,
    productId: r.product_id,
    userId: r.user_id,
    name: nameFor.get(r.user_id) || "Finkel Reserve customer",
    rating: r.rating,
    text: r.text,
    at: new Date(r.created_at).getTime(),
  }));
}

export const useProductReviews = (productId: string | undefined) =>
  useQuery({
    queryKey: ["reviews", "product", productId],
    queryFn: async (): Promise<Review[]> => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id, product_id, user_id, rating, text, created_at")
        .eq("product_id", productId!)
        .order("created_at", { ascending: false });
      if (error) throwSafe(error, "Could not load reviews.");
      return attachNames(data ?? []);
    },
    enabled: !!productId,
    staleTime: 30_000,
  });

/**
 * Mirrors the "users create review for delivered order" RLS policy on the
 * client, so the review form can show the right state (sign in / wait for
 * delivery / write a review) instead of showing a form that would just
 * fail on submit. This is a UX convenience only — the actual gate is the
 * RLS policy itself (see the migration); this check being wrong or
 * bypassed would only ever affect what the UI shows, never what the
 * database accepts.
 */
export const useCanReviewProduct = (productId: string | undefined, userId: string | undefined) =>
  useQuery({
    queryKey: ["reviews", "eligible", productId, userId],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("order_items")
        .select("id, orders!inner(user_id, status)")
        .eq("product_id", productId!)
        .eq("orders.user_id", userId!)
        .eq("orders.status", "delivered")
        .limit(1);
      if (error) throwSafe(error, "Could not check review eligibility.");
      return (data?.length ?? 0) > 0;
    },
    enabled: !!productId && !!userId,
    staleTime: 60_000,
  });

const invalidateReviews = (qc: ReturnType<typeof useQueryClient>, productId: string) => {
  qc.invalidateQueries({ queryKey: ["reviews", "product", productId] });
  // The rating trigger updates products.rating / reviews_count server-side.
  qc.invalidateQueries({ queryKey: ["products"] });
};

export const useSubmitReview = (productId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      rating,
      text,
    }: {
      userId: string;
      rating: number;
      text: string;
    }) => {
      const { error } = await supabase
        .from("reviews")
        .insert({ product_id: productId, user_id: userId, rating, text });
      if (error) {
        if (error.code === "23505") {
          throw new Error(
            "You've already reviewed this product. Edit your existing review instead.",
          );
        }
        // Never surface error.message here — Supabase's PostgrestError
        // extends Error, so it looks like a normal thrown Error, but its
        // .message is the raw internal Postgres/PostgREST text. Log it for
        // debugging, throw a generic one for display.
        console.error("[useSubmitReview]", error);
        throw new Error("Couldn't post your review. Please try again.");
      }
    },
    onSuccess: () => invalidateReviews(qc, productId),
  });
};

export const useUpdateReview = (productId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, rating, text }: { id: string; rating: number; text: string }) => {
      const { error } = await supabase.from("reviews").update({ rating, text }).eq("id", id);
      if (error) throwSafe(error, "Could not save your review changes.");
    },
    onSuccess: () => invalidateReviews(qc, productId),
  });
};

export const useDeleteReview = (productId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reviews").delete().eq("id", id);
      if (error) throwSafe(error, "Could not delete your review.");
    },
    onSuccess: () => invalidateReviews(qc, productId),
  });
};

// Admin: recent reviews across every product, for moderation.
export const useAdminReviews = () =>
  useQuery({
    queryKey: ["reviews", "admin"],
    queryFn: async (): Promise<(Review & { productName: string })[]> => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id, product_id, user_id, rating, text, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throwSafe(error, "Could not load reviews.");
      const rows = data ?? [];
      const named = await attachNames(rows);
      const productIds = [...new Set(rows.map((r) => r.product_id))];
      const { data: productRows } = productIds.length
        ? await supabase.from("products").select("id, name").in("id", productIds)
        : { data: [] as { id: string; name: string }[] };
      const nameForProduct = new Map((productRows ?? []).map((p) => [p.id, p.name]));
      return named.map((r) => ({
        ...r,
        productName: nameForProduct.get(r.productId) ?? "Deleted product",
      }));
    },
    staleTime: 15_000,
  });

export const useAdminDeleteReview = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reviews").delete().eq("id", id);
      if (error) throwSafe(error, "Could not delete this review.");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
};
