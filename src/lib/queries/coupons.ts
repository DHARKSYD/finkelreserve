import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { throwSafe } from "./safe-error";
import { validateCoupon, type CouponResult } from "@/lib/actions/coupons";
import type { PurchaseUnit } from "@/lib/box";

export type Coupon = {
  id: string;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  freeShipping: boolean;
  minOrderAmount: number | null;
  maxDiscountAmount: number | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  usageCount: number;
  startsAt: number | null;
  expiresAt: number | null;
  active: boolean;
  firstOrderOnly: boolean;
  applicableCategories: string[];
  createdAt: number;
};

function mapCoupon(row: Tables<"coupons">): Coupon {
  return {
    id: row.id,
    code: row.code,
    type: row.type as "percentage" | "fixed",
    value: Number(row.value),
    freeShipping: row.free_shipping,
    minOrderAmount: row.min_order_amount != null ? Number(row.min_order_amount) : null,
    maxDiscountAmount: row.max_discount_amount != null ? Number(row.max_discount_amount) : null,
    usageLimit: row.usage_limit,
    perCustomerLimit: row.per_customer_limit,
    usageCount: row.usage_count,
    startsAt: row.starts_at ? new Date(row.starts_at).getTime() : null,
    expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : null,
    active: row.active,
    firstOrderOnly: row.first_order_only,
    applicableCategories: row.applicable_categories ?? [],
    createdAt: new Date(row.created_at).getTime(),
  };
}

export const useAdminCoupons = () =>
  useQuery({
    queryKey: ["coupons", "admin"],
    queryFn: async (): Promise<Coupon[]> => {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throwSafe(error, "Could not load coupons.");
      return (data ?? []).map(mapCoupon);
    },
    staleTime: 15_000,
  });

export type CouponInput = {
  code: string;
  type: "percentage" | "fixed";
  value: number;
  freeShipping: boolean;
  minOrderAmount: number | null;
  maxDiscountAmount: number | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  startsAt: string | null; // datetime-local input value
  expiresAt: string | null;
  active: boolean;
  firstOrderOnly: boolean;
  applicableCategories: string[];
};

function toInsertRow(input: CouponInput): TablesInsert<"coupons"> {
  return {
    code: input.code.trim().toUpperCase(),
    type: input.type,
    value: input.value,
    free_shipping: input.freeShipping,
    min_order_amount: input.minOrderAmount,
    max_discount_amount: input.maxDiscountAmount,
    usage_limit: input.usageLimit,
    per_customer_limit: input.perCustomerLimit,
    starts_at: input.startsAt ? new Date(input.startsAt).toISOString() : null,
    expires_at: input.expiresAt ? new Date(input.expiresAt).toISOString() : null,
    active: input.active,
    first_order_only: input.firstOrderOnly,
    applicable_categories: input.applicableCategories.length ? input.applicableCategories : null,
  };
}

const invalidateCoupons = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ queryKey: ["coupons"] });

export const useCreateCoupon = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CouponInput) => {
      const { error } = await supabase.from("coupons").insert(toInsertRow(input));
      if (error) {
        throwSafe(
          error,
          error.code === "23505"
            ? "A coupon with that code already exists."
            : "Could not create the coupon.",
        );
      }
    },
    onSuccess: () => invalidateCoupons(qc),
  });
};

export const useUpdateCoupon = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: CouponInput }) => {
      const { error } = await supabase.from("coupons").update(toInsertRow(input)).eq("id", id);
      if (error) {
        throwSafe(
          error,
          error.code === "23505"
            ? "A coupon with that code already exists."
            : "Could not update the coupon.",
        );
      }
    },
    onSuccess: () => invalidateCoupons(qc),
  });
};

export const useToggleCouponActive = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("coupons").update({ active }).eq("id", id);
      if (error) throwSafe(error, "Could not update the coupon.");
    },
    onSuccess: () => invalidateCoupons(qc),
  });
};

export const useDeleteCoupon = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coupons").delete().eq("id", id);
      if (error) throwSafe(error, "Could not delete the coupon.");
    },
    onSuccess: () => invalidateCoupons(qc),
  });
};

// ─── Cart-side: check a code before checkout ────────────────────────────

export const useValidateCoupon = () =>
  useMutation({
    mutationFn: (input: {
      code: string;
      items: { productId: string; size: string; unit: PurchaseUnit; qty: number }[];
      customerEmail?: string;
    }) => validateCoupon({ data: input }) as Promise<CouponResult>,
  });
