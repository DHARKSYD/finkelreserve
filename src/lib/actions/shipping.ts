import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// This file exports two createServerFns, both imported directly by client
// route components (product.$slug.tsx, cart.tsx, shipping-policy.tsx) — so
// it must never also export a plain function that touches supabaseAdmin.
// See the note on priceShippingServerSide in shipping-server.ts for why
// that specific combination leaks service-role construction logic into the
// client bundle; that function lives there instead, imported only by
// checkout.ts.

// types.ts hasn't been regenerated against live Supabase to include
// shipping_zones/shipping_rates yet — same outstanding item already tracked
// for the inventory/refunds/coupons migrations (see the audit doc). These two
// interfaces stand in for the generated ones; once `supabase gen types` runs
// for real, delete them and use `Tables<"shipping_zones">` / `Tables<"shipping_rates">`
// like every other query file in this codebase does.
interface ShippingZoneRow {
  id: string;
  name: string;
  states: string[];
  active: boolean;
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
}

// supabaseAdmin is typed against the generated Database type, which is why
// the cast below is needed for these two tables specifically — every other
// query in this file's siblings (checkout.ts, coupons.ts) calls .from()
// untouched because their tables *are* in that generated type.
const db = supabaseAdmin as unknown as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- documented types.ts gap above
  from: (table: "shipping_zones" | "shipping_rates") => any;
};

export type ShippingOption = {
  rateId: string;
  name: string;
  /** Already resolved against the subtotal passed in — 0 here means genuinely free, not just cheap. */
  priceNgn: number;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
};

const optionsSchema = z.object({
  state: z.string().trim().min(1).max(60),
  subtotalNgn: z.number().nonnegative(),
});

/** What the checkout form shows: active rates whose zone covers the given state. */
export const getShippingOptions = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => optionsSchema.parse(data))
  .handler(async ({ data }): Promise<ShippingOption[]> => {
    const { data: zones, error: zonesError } = await db
      .from("shipping_zones")
      .select("id, name, states, active")
      .eq("active", true)
      .contains("states", [data.state]);
    if (zonesError) throw new Error("Could not load shipping options.");

    const zoneRows = (zones ?? []) as ShippingZoneRow[];
    if (zoneRows.length === 0) return [];

    const { data: rates, error: ratesError } = await db
      .from("shipping_rates")
      .select(
        "id, zone_id, name, price_ngn, min_order_ngn, free_shipping_threshold_ngn, estimated_days_min, estimated_days_max, active",
      )
      .in(
        "zone_id",
        zoneRows.map((z) => z.id),
      )
      .eq("active", true)
      .order("price_ngn", { ascending: true });
    if (ratesError) throw new Error("Could not load shipping options.");

    return ((rates ?? []) as ShippingRateRow[])
      .filter((r) => r.min_order_ngn == null || data.subtotalNgn >= r.min_order_ngn)
      .map((r) => ({
        rateId: r.id,
        name: r.name,
        priceNgn:
          r.free_shipping_threshold_ngn != null && data.subtotalNgn >= r.free_shipping_threshold_ngn
            ? 0
            : r.price_ngn,
        estimatedDaysMin: r.estimated_days_min,
        estimatedDaysMax: r.estimated_days_max,
      }));
  });

export type ShippingZoneSummary = {
  zoneName: string;
  states: string[];
  rates: Array<{
    name: string;
    priceNgn: number;
    freeShippingThresholdNgn: number | null;
    estimatedDaysMin: number;
    estimatedDaysMax: number;
  }>;
};

/**
 * Every active zone/rate, for public display (the Shipping Policy page and
 * the "free shipping over ₦X" trust badge) — not scoped to one delivery
 * state like getShippingOptions is. Keeping this as the single read path for
 * both consumers is the whole point: whatever an admin sets on /admin/shipping
 * is what the policy page and checkout both show, with nothing to fall out of sync.
 */
export const getPublicShippingSummary = createServerFn({ method: "GET" }).handler(
  async (): Promise<ShippingZoneSummary[]> => {
    const { data: zones, error: zonesError } = await db
      .from("shipping_zones")
      .select("id, name, states, active")
      .eq("active", true)
      .order("name", { ascending: true });
    if (zonesError) throw new Error("Could not load shipping info.");

    const zoneRows = (zones ?? []) as ShippingZoneRow[];
    if (zoneRows.length === 0) return [];

    const { data: rates, error: ratesError } = await db
      .from("shipping_rates")
      .select(
        "zone_id, name, price_ngn, free_shipping_threshold_ngn, estimated_days_min, estimated_days_max, active",
      )
      .in(
        "zone_id",
        zoneRows.map((z) => z.id),
      )
      .eq("active", true)
      .order("price_ngn", { ascending: true });
    if (ratesError) throw new Error("Could not load shipping info.");

    const rateRows = (rates ?? []) as ShippingRateRow[];

    return zoneRows
      .map((z) => ({
        zoneName: z.name,
        states: z.states,
        rates: rateRows
          .filter((r) => r.zone_id === z.id)
          .map((r) => ({
            name: r.name,
            priceNgn: r.price_ngn,
            freeShippingThresholdNgn: r.free_shipping_threshold_ngn,
            estimatedDaysMin: r.estimated_days_min,
            estimatedDaysMax: r.estimated_days_max,
          })),
      }))
      .filter((z) => z.rates.length > 0);
  },
);
