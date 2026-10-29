import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { boxPricing } from "@/lib/box";

// Split out of coupons.ts on purpose — see the comment on resolveCoupon
// below and shipping-server.ts for the full reasoning. Only checkout.ts and
// coupons.ts's own validateCoupon handler import this file. CouponLine/
// CouponResult are defined here (not in coupons.ts) and re-exported from
// there, so coupons.ts importing them back doesn't create a circular
// dependency between the two files.

// qty = units (bottles or boxes). unitPrice = what one unit costs; when omitted the
// product's per-bottle price is used. Boxes pass their own (discounted) price here.
export type CouponLine = { productId: string; qty: number; unitPrice?: number };
type ResolvedLine = { productId: string; productType: string; price: number; qty: number };

export type CouponResult =
  | { valid: true; couponId: string; code: string; discount: number; freeShipping: boolean }
  | { valid: false; error: string };

// The one place discount math happens — validateCoupon (preview) and
// placeOrder (charge) both call resolveCoupon below against server-fetched
// prices, so what the customer is quoted in the cart and what they're
// actually charged can't drift apart from two copies of this logic.
function computeDiscount(
  coupon: {
    id: string;
    code: string;
    type: string;
    value: number;
    free_shipping: boolean;
    min_order_amount: number | null;
    max_discount_amount: number | null;
    usage_limit: number | null;
    usage_count: number;
    per_customer_limit: number | null;
    starts_at: string | null;
    expires_at: string | null;
    active: boolean;
    first_order_only: boolean;
    applicable_product_ids: string[] | null;
    applicable_categories: string[] | null;
  },
  lines: ResolvedLine[],
  customerRedemptionCount: number,
  hasPriorOrder: boolean,
): CouponResult {
  const fail = (error: string): CouponResult => ({ valid: false, error });

  if (!coupon.active) return fail("This code isn't active.");
  const now = Date.now();
  if (coupon.starts_at && now < new Date(coupon.starts_at).getTime()) {
    return fail("This code isn't active yet.");
  }
  if (coupon.expires_at && now > new Date(coupon.expires_at).getTime()) {
    return fail("This code has expired.");
  }
  if (coupon.usage_limit != null && coupon.usage_count >= coupon.usage_limit) {
    return fail("This code has reached its usage limit.");
  }
  if (coupon.per_customer_limit != null && customerRedemptionCount >= coupon.per_customer_limit) {
    return fail("You've already used this code the maximum number of times.");
  }
  if (coupon.first_order_only && hasPriorOrder) {
    return fail("This code is for first-time customers only.");
  }

  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  if (coupon.min_order_amount != null && subtotal < coupon.min_order_amount) {
    return fail(
      `This code needs an order of at least ₦${coupon.min_order_amount.toLocaleString("en-NG")}.`,
    );
  }

  const hasRestriction =
    (coupon.applicable_product_ids?.length ?? 0) > 0 ||
    (coupon.applicable_categories?.length ?? 0) > 0;
  const eligibleLines = hasRestriction
    ? lines.filter(
        (l) =>
          coupon.applicable_product_ids?.includes(l.productId) ||
          coupon.applicable_categories?.includes(l.productType),
      )
    : lines;
  const eligibleSubtotal = eligibleLines.reduce((s, l) => s + l.price * l.qty, 0);

  if (eligibleSubtotal <= 0) {
    return fail("This code doesn't apply to anything in your bag.");
  }

  const raw =
    coupon.type === "percentage"
      ? eligibleSubtotal * (coupon.value / 100)
      : Math.min(coupon.value, eligibleSubtotal);
  const capped =
    coupon.max_discount_amount != null ? Math.min(raw, coupon.max_discount_amount) : raw;

  return {
    valid: true,
    couponId: coupon.id,
    code: coupon.code,
    discount: Math.round(capped),
    freeShipping: coupon.free_shipping,
  };
}

/**
 * Fetches everything server-side — coupon row, current product prices and
 * categories, this customer's redemption count, whether they've ordered
 * before — rather than trusting anything the caller supplied about the
 * cart's contents, matching how placeOrder never trusts a client price.
 *
 * A plain function, not a createServerFn — deliberately kept out of
 * coupons.ts, which has a createServerFn export (validateCoupon) that
 * client code (queries/coupons.ts) imports directly. See the note on
 * priceShippingServerSide in shipping-server.ts for why mixing the two in
 * one file leaks service-role construction logic into the client bundle;
 * confirmed by inspecting .output/public/ directly, this exact leak had
 * recurred here too.
 */
export async function resolveCoupon(
  code: string,
  lines: CouponLine[],
  customerEmail?: string,
): Promise<CouponResult> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { valid: false, error: "Enter a code." };

  const { data: coupon, error } = await supabaseAdmin
    .from("coupons")
    .select("*")
    .eq("code", normalized)
    .maybeSingle();
  if (error) return { valid: false, error: "Could not check that code right now." };
  if (!coupon) return { valid: false, error: "That code isn't valid." };

  const productIds = [...new Set(lines.map((l) => l.productId))];
  const { data: products, error: productsError } = await supabaseAdmin
    .from("products")
    .select("id, price, wine_type")
    .in("id", productIds);
  if (productsError) return { valid: false, error: "Could not check that code right now." };
  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  const resolvedLines: ResolvedLine[] = lines
    .filter((l) => byId.has(l.productId))
    .map((l) => {
      const p = byId.get(l.productId)!;
      return {
        productId: l.productId,
        productType: p.wine_type,
        price: l.unitPrice ?? Number(p.price),
        qty: l.qty,
      };
    });

  let customerRedemptionCount = 0;
  let hasPriorOrder = false;
  if (customerEmail) {
    const normalizedEmail = customerEmail.trim().toLowerCase();
    const [{ count: redemptionCount }, { count: orderCount }] = await Promise.all([
      supabaseAdmin
        .from("coupon_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("coupon_id", coupon.id)
        .eq("customer_email", normalizedEmail),
      supabaseAdmin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .ilike("customer_email", normalizedEmail),
    ]);
    customerRedemptionCount = redemptionCount ?? 0;
    hasPriorOrder = (orderCount ?? 0) > 0;
  }

  return computeDiscount(coupon, resolvedLines, customerRedemptionCount, hasPriorOrder);
}

/**
 * Cart-preview pricing: turns client cart lines (product, size, unit, qty) into
 * CouponLines priced from the database — a box line gets the box price (bottle price ×
 * bottles per box, less the product's box discount) so the previewed discount matches what
 * placeOrder will actually charge. A box line for a product that isn't sold by the box is
 * dropped here; placeOrder rejects it properly at checkout.
 */
export async function priceCartLines(
  items: { productId: string; size: string; unit: "bottle" | "box"; qty: number }[],
): Promise<CouponLine[]> {
  const productIds = [...new Set(items.map((i) => i.productId))];
  const { data: products } = await supabaseAdmin
    .from("products")
    .select("id, price, bottles_per_box, box_discount_percent")
    .in("id", productIds);
  const byId = new Map((products ?? []).map((p) => [p.id, p]));
  const lines: CouponLine[] = [];
  for (const i of items) {
    const p = byId.get(i.productId);
    if (!p) continue;
    if (i.unit === "box") {
      if (!p.bottles_per_box) continue;
      lines.push({
        productId: i.productId,
        qty: i.qty,
        unitPrice: boxPricing(
          Number(p.price),
          p.bottles_per_box,
          Number(p.box_discount_percent ?? 0),
        ).price,
      });
    } else {
      lines.push({ productId: i.productId, qty: i.qty });
    }
  }
  return lines;
}
