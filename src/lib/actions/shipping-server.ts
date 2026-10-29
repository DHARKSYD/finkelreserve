import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Split out of shipping.ts on purpose — see the comment on
// priceShippingServerSide below. Only checkout.ts imports this file.

// types.ts hasn't been regenerated against live Supabase to include
// shipping_zones/shipping_rates yet — same outstanding item already tracked
// for the inventory/refunds/coupons migrations (see the audit doc).
interface ShippingRateRow {
  id: string;
  price_ngn: number;
  min_order_ngn: number | null;
  free_shipping_threshold_ngn: number | null;
  active: boolean;
}

const db = supabaseAdmin as unknown as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- documented types.ts gap above
  from: (table: "shipping_rates") => any;
};

/**
 * The only place shipping price actually gets decided for an order. Re-derives
 * the price from the database from a rate ID — never trusts a number from the
 * client. Also re-checks the rate's zone still covers the delivery state and
 * the order still clears any minimum, since the cart's earlier
 * getShippingOptions call could be stale (rate deactivated, cart sat open)
 * by the time checkout actually runs.
 *
 * This is a plain function, not a createServerFn — deliberately kept out of
 * shipping.ts, which has createServerFn exports that client route components
 * import directly (product.$slug.tsx, cart.tsx, shipping-policy.tsx). A file
 * mixing a createServerFn export with a plain function that touches
 * supabaseAdmin is exactly the pattern that leaked service-role construction
 * logic into the client bundle once before (see the README's note on the
 * Paystack webhook) — confirmed by inspecting .output/public/ directly, this
 * same leak had recurred here and in coupons.ts. Only checkout.ts imports
 * this file; shipping.ts's own createServerFn handlers use their own copy of
 * the small `db` cast below rather than importing this one, so this file has
 * no import edge back into anything client-reachable.
 */
export async function priceShippingServerSide(
  rateId: string,
  state: string,
  subtotalNgn: number,
): Promise<number> {
  const { data: rate, error } = await db
    .from("shipping_rates")
    .select(
      "id, price_ngn, min_order_ngn, free_shipping_threshold_ngn, active, shipping_zones!inner(states, active)",
    )
    .eq("id", rateId)
    .eq("active", true)
    .single();

  if (error || !rate) {
    throw new Error("Selected shipping option is no longer available. Please choose another.");
  }

  const zone = rate.shipping_zones as unknown as { states: string[]; active: boolean };
  if (!zone.active || !zone.states.includes(state)) {
    throw new Error("Selected shipping option does not cover this delivery address.");
  }

  if (rate.min_order_ngn != null && subtotalNgn < rate.min_order_ngn) {
    throw new Error("This order doesn't meet the minimum for the selected shipping option.");
  }

  if (rate.free_shipping_threshold_ngn != null && subtotalNgn >= rate.free_shipping_threshold_ngn) {
    return 0;
  }

  return (rate as ShippingRateRow).price_ngn;
}
