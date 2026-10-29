import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { throwSafe } from "./safe-error";

// types.ts hasn't been regenerated against live Supabase to include these two
// tables yet (tracked in the audit doc, same as inventory/refunds/coupons
// were before their migrations landed). This cast is the only place that
// knowledge lives — everything below it is normally typed. Delete the cast
// and switch row types to `Tables<"shipping_zones">` / `Tables<"shipping_rates">`
// once `supabase gen types` has run for real.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- documented types.ts gap above
const db = supabase as unknown as { from: (table: "shipping_zones" | "shipping_rates") => any };

interface ShippingZoneRow {
  id: string;
  name: string;
  states: string[];
  active: boolean;
  created_at: string;
}

interface ShippingRateRow {
  id: string;
  zone_id: string;
  name: string;
  price_ngn: number;
  min_order_ngn: number | null;
  free_shipping_threshold_ngn: number | null;
  estimated_days_min: number;
  estimated_days_max: number;
  active: boolean;
  created_at: string;
}

/** Just the shape we read off a Postgrest/Postgres error — not the full type. */
interface PostgrestErrorLike {
  code?: string;
  message: string;
}

export type ShippingZone = {
  id: string;
  name: string;
  states: string[];
  active: boolean;
  createdAt: number;
};

export type ShippingRate = {
  id: string;
  zoneId: string;
  name: string;
  priceNgn: number;
  minOrderNgn: number | null;
  freeShippingThresholdNgn: number | null;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  active: boolean;
  createdAt: number;
};

/** min=0 means same-day, which "0 business days" reads oddly for — this
 * covers that case naturally instead of every call site special-casing it. */
export function formatDeliveryEstimate(min: number, max: number): string {
  if (min === 0 && max === 0) return "Same-day";
  if (min === 0 && max === 1) return "Same-day–next-day";
  if (min === 0) return `Same-day–${max} business days`;
  if (min === max) return `${min} business day${min === 1 ? "" : "s"}`;
  return `${min}–${max} business days`;
}

function mapZone(row: ShippingZoneRow): ShippingZone {
  return {
    id: row.id,
    name: row.name,
    states: row.states ?? [],
    active: row.active,
    createdAt: new Date(row.created_at).getTime(),
  };
}

function mapRate(row: ShippingRateRow): ShippingRate {
  return {
    id: row.id,
    zoneId: row.zone_id,
    name: row.name,
    priceNgn: Number(row.price_ngn),
    minOrderNgn: row.min_order_ngn != null ? Number(row.min_order_ngn) : null,
    freeShippingThresholdNgn:
      row.free_shipping_threshold_ngn != null ? Number(row.free_shipping_threshold_ngn) : null,
    estimatedDaysMin: row.estimated_days_min,
    estimatedDaysMax: row.estimated_days_max,
    active: row.active,
    createdAt: new Date(row.created_at).getTime(),
  };
}

const invalidateShipping = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ queryKey: ["shipping"] });

// ─── Zones ───────────────────────────────────────────────────────────────

export const useAdminShippingZones = () =>
  useQuery({
    queryKey: ["shipping", "zones", "admin"],
    queryFn: async (): Promise<ShippingZone[]> => {
      const { data, error } = await db
        .from("shipping_zones")
        .select("*")
        .order("name", { ascending: true });
      if (error) throwSafe(error, "Could not load shipping zones.");
      return (data ?? []).map(mapZone);
    },
    staleTime: 15_000,
  });

export type ShippingZoneInput = { name: string; states: string[]; active: boolean };

function zoneOverlapError(error: PostgrestErrorLike, fallback: string): never {
  // P0001 is our own check_no_overlapping_zone_states trigger — that message
  // is authored for display, unlike raw Postgres/PostgREST text elsewhere.
  if (error?.code === "P0001") throw new Error(error.message);
  throwSafe(error, fallback);
}

export const useCreateShippingZone = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ShippingZoneInput) => {
      const { error } = await db
        .from("shipping_zones")
        .insert({ name: input.name, states: input.states, active: input.active });
      if (error) zoneOverlapError(error, "Could not create the shipping zone.");
    },
    onSuccess: () => invalidateShipping(qc),
  });
};

export const useUpdateShippingZone = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ShippingZoneInput }) => {
      const { error } = await db
        .from("shipping_zones")
        .update({ name: input.name, states: input.states, active: input.active })
        .eq("id", id);
      if (error) zoneOverlapError(error, "Could not update the shipping zone.");
    },
    onSuccess: () => invalidateShipping(qc),
  });
};

export const useToggleShippingZoneActive = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await db.from("shipping_zones").update({ active }).eq("id", id);
      if (error) throwSafe(error, "Could not update the shipping zone.");
    },
    onSuccess: () => invalidateShipping(qc),
  });
};

export const useDeleteShippingZone = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Rates cascade (on delete cascade in the migration) — deleting a zone
      // silently deletes its rates too, so the confirm dialog for this needs
      // to say so explicitly rather than let that be a surprise.
      const { error } = await db.from("shipping_zones").delete().eq("id", id);
      if (error) throwSafe(error, "Could not delete the shipping zone.");
    },
    onSuccess: () => invalidateShipping(qc),
  });
};

// ─── Rates ───────────────────────────────────────────────────────────────

export const useAdminShippingRates = () =>
  useQuery({
    queryKey: ["shipping", "rates", "admin"],
    queryFn: async (): Promise<ShippingRate[]> => {
      const { data, error } = await db
        .from("shipping_rates")
        .select("*")
        .order("price_ngn", { ascending: true });
      if (error) throwSafe(error, "Could not load shipping rates.");
      return (data ?? []).map(mapRate);
    },
    staleTime: 15_000,
  });

export type ShippingRateInput = {
  zoneId: string;
  name: string;
  priceNgn: number;
  minOrderNgn: number | null;
  freeShippingThresholdNgn: number | null;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  active: boolean;
};

function toRateRow(input: ShippingRateInput) {
  return {
    zone_id: input.zoneId,
    name: input.name,
    price_ngn: input.priceNgn,
    min_order_ngn: input.minOrderNgn,
    free_shipping_threshold_ngn: input.freeShippingThresholdNgn,
    estimated_days_min: input.estimatedDaysMin,
    estimated_days_max: input.estimatedDaysMax,
    active: input.active,
  };
}

export const useCreateShippingRate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ShippingRateInput) => {
      const { error } = await db.from("shipping_rates").insert(toRateRow(input));
      if (error) throwSafe(error, "Could not create the shipping rate.");
    },
    onSuccess: () => invalidateShipping(qc),
  });
};

export const useUpdateShippingRate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ShippingRateInput }) => {
      const { error } = await db.from("shipping_rates").update(toRateRow(input)).eq("id", id);
      if (error) throwSafe(error, "Could not update the shipping rate.");
    },
    onSuccess: () => invalidateShipping(qc),
  });
};

export const useToggleShippingRateActive = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await db.from("shipping_rates").update({ active }).eq("id", id);
      if (error) throwSafe(error, "Could not update the shipping rate.");
    },
    onSuccess: () => invalidateShipping(qc),
  });
};

export const useDeleteShippingRate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("shipping_rates").delete().eq("id", id);
      if (error) throwSafe(error, "Could not delete the shipping rate.");
    },
    onSuccess: () => invalidateShipping(qc),
  });
};
