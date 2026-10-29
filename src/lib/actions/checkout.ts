import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeNgMobile } from "@/lib/phone";
import { boxPricing } from "@/lib/box";
import { notificationCapabilities, notifyOrder } from "./notify-server";
import { getVerifiedUserId } from "./auth";
import { checkRateLimit } from "./rate-limit";
import { resolveCoupon } from "./coupons-server";
import { priceShippingServerSide } from "./shipping-server";

// Runtime validation, not just TypeScript types — a client can POST anything
// to this endpoint's URL directly, bypassing the UI entirely, so the types
// above the wire buy nothing on their own. Bounds here are generous (this
// rejects abuse, not legitimate edge cases) but real: unbounded strings and
// unchecked payment_method values were the actual gap (see the audit).
const checkoutLineSchema = z.object({
  productId: z.string().uuid(),
  size: z.string().trim().min(1).max(20), // bottle size, e.g. "750ml"
  // What qty counts. Boxes are only honoured if the product actually has a box size
  // (products.bottles_per_box) — checked below against the DB, never trusted from here.
  unit: z.enum(["bottle", "box"]).optional().default("bottle"),
  qty: z.number().int().min(1).max(20),
});

const checkoutSchema = z.object({
  items: z.array(checkoutLineSchema).min(1).max(50),
  customer: z.object({
    name: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(200),
    phone: z.string().trim().max(30).optional().default(""),
    addressLine: z.string().trim().min(1).max(300),
    city: z.string().trim().min(1).max(100),
    state: z.string().trim().min(1).max(60),
    deliveryInstructions: z.string().trim().max(300).optional().default(""),
  }),
  shippingRateId: z.string().uuid(),
  promoCode: z.string().trim().max(30).optional(),
  paymentMethod: z.enum(["delivery", "paystack"]),
  // What the customer ticked under "Order updates". Stored on the order as a consent
  // record; SMS is honoured only if this deployment can send it and the phone is a NG mobile.
  notifications: z
    .object({ email: z.boolean(), sms: z.boolean() })
    .optional()
    .default({ email: true, sms: false }),
});

export type CheckoutLineInput = z.infer<typeof checkoutLineSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export type CheckoutResult =
  | { ok: true; orderId: string; total: number; paymentMethod: "delivery" | "paystack" }
  | { ok: false; error: string };

// qty here is BOTTLES (units × bottles per unit) — that is what stock is counted in.
type Reserved = { productId: string; qty: number; variantId: string | null };

/** Undo any stock we already reserved before failing the whole checkout. */
async function releaseReserved(reserved: Reserved[]) {
  await Promise.allSettled(
    reserved.map((r) =>
      r.variantId
        ? supabaseAdmin.rpc("adjust_variant_stock", { p_variant_id: r.variantId, p_delta: r.qty })
        : supabaseAdmin.rpc("adjust_product_stock", { p_product_id: r.productId, p_delta: r.qty }),
    ),
  );
}

export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => checkoutSchema.parse(data))
  .handler(async ({ data }): Promise<CheckoutResult> => {
    const rate = await checkRateLimit("checkout", 5, 60_000);
    if (!rate.ok)
      return {
        ok: false,
        error: "Too many checkout attempts — please wait a minute and try again.",
      };

    const items = data.items.filter((i) => i.qty > 0);
    if (items.length === 0) return { ok: false, error: "Your bag is empty." };

    // Derived from the caller's verified JWT, never trusted from the request
    // body — see getVerifiedUserId for why.
    const userId = await getVerifiedUserId();

    const name = data.customer.name;
    const email = data.customer.email;

    const productIds = [...new Set(items.map((i) => i.productId))];
    const { data: products, error: productsError } = await supabaseAdmin
      .from("products")
      .select(
        "id, name, price, images, active, bottle_sizes, bottles_per_box, box_discount_percent",
      )
      .in("id", productIds);
    if (productsError) {
      return { ok: false, error: "Could not load product data. Please try again." };
    }
    const byId = new Map((products ?? []).map((p) => [p.id, p]));

    // Stock is tracked per bottle-size variant (see product_variants in the
    // migration), not as one number per product. Products with no variant
    // rows at all — shouldn't normally happen, but defensively supported —
    // still work via the old product-level counter.
    const { data: variants, error: variantsError } = await supabaseAdmin
      .from("product_variants")
      .select("id, product_id, size")
      .in("product_id", productIds);
    if (variantsError) {
      return { ok: false, error: "Could not load stock data. Please try again." };
    }
    const variantKey = (productId: string, size: string) => `${productId}::${size}`;
    const variantByKey = new Map(
      (variants ?? []).map((v) => [variantKey(v.product_id, v.size), v]),
    );
    const productsWithVariants = new Set((variants ?? []).map((v) => v.product_id));

    // Cross-check bottle size against what the product actually offers — the
    // schema above only bounds length, it can't know valid options without
    // the product row, so that check has to happen here.
    for (const line of items) {
      const product = byId.get(line.productId);
      if (!product || !product.active) {
        return { ok: false, error: "One of the items in your bag is no longer available." };
      }
      if (product.bottle_sizes?.length && !product.bottle_sizes.includes(line.size)) {
        return {
          ok: false,
          error: `"${line.size}" isn't a valid bottle size for "${product.name}".`,
        };
      }
      // A product with tracked variants must resolve to one exactly, or
      // per-size stock isn't actually being enforced. (A product with no
      // variant rows at all falls back to the product-level counter below
      // instead.)
      if (
        productsWithVariants.has(line.productId) &&
        !variantByKey.get(variantKey(line.productId, line.size))
      ) {
        return {
          ok: false,
          error: `"${line.size}" isn't currently trackable for "${product.name}". Please choose a different option.`,
        };
      }
    }

    // Resolve how many bottles each unit of each line is, and what one unit costs, from
    // the DB. A box line is only valid if the product is sold by the box; the client's idea
    // of "box of 6" or its price is never used. unitPrice is the ONLY price used for the
    // order and for coupons: a single bottle, or a whole box at its discount.
    const lines: ((typeof items)[number] & { bottlesPerUnit: number; unitPrice: number })[] = [];
    for (const line of items) {
      const product = byId.get(line.productId)!;
      const bottlePrice = Number(product.price);
      if (line.unit === "box") {
        const perBox = product.bottles_per_box;
        if (!perBox) {
          return {
            ok: false,
            error: `"${product.name}" isn't sold by the box. Please adjust your bag.`,
          };
        }
        lines.push({
          ...line,
          bottlesPerUnit: perBox,
          unitPrice: boxPricing(bottlePrice, perBox, Number(product.box_discount_percent ?? 0))
            .price,
        });
      } else {
        lines.push({ ...line, bottlesPerUnit: 1, unitPrice: bottlePrice });
      }
    }

    // Reserve stock first (atomic, race-safe — see adjust_variant_stock /
    // adjust_product_stock in the migration). If anything fails partway,
    // release what we already took. Stock moves in bottles: a box of 6
    // reserves 6.
    const reserved: Reserved[] = [];
    for (const line of lines) {
      const product = byId.get(line.productId)!;
      const bottles = line.qty * line.bottlesPerUnit;
      const variant = variantByKey.get(variantKey(line.productId, line.size));
      const { data: newStock, error: stockError } = variant
        ? await supabaseAdmin.rpc("adjust_variant_stock", {
            p_variant_id: variant.id,
            p_delta: -bottles,
          })
        : await supabaseAdmin.rpc("adjust_product_stock", {
            p_product_id: line.productId,
            p_delta: -bottles,
          });
      if (stockError || newStock === null) {
        await releaseReserved(reserved);
        return {
          ok: false,
          error: `"${product.name}" doesn't have enough stock for that quantity. Please adjust your bag.`,
        };
      }
      reserved.push({ productId: line.productId, qty: bottles, variantId: variant?.id ?? null });
    }

    // Build order items with server-side prices — customer-submitted prices
    // are never trusted, only product.price from the row fetched above. A box is priced at
    // bottles × bottle price less the product's box discount, and unit/bottles_per_unit are
    // snapshotted so cancel/restock stay correct if the box size is edited later.
    const orderItemRows = lines.map((line) => {
      const product = byId.get(line.productId)!;
      return {
        product_id: product.id,
        name: product.name,
        image: product.images?.[0] ?? "",
        size: line.size,
        price: line.unitPrice,
        qty: line.qty,
        unit: line.unit,
        bottles_per_unit: line.bottlesPerUnit,
      };
    });

    const subtotal = orderItemRows.reduce((s, r) => s + r.price * r.qty, 0);

    let discount = 0;
    let freeShipping = false;
    let appliedCoupon: { couponId: string; amountOff: number } | null = null;
    if (data.promoCode) {
      const couponResult = await resolveCoupon(
        data.promoCode,
        lines.map((i) => ({ productId: i.productId, qty: i.qty, unitPrice: i.unitPrice })),
        email,
      );
      if (!couponResult.valid) {
        // The cart's earlier preview call could be stale (code expired,
        // limit hit, since the customer typed it) — the backend stays
        // authoritative, so an invalid code fails the order rather than
        // silently charging full price.
        await releaseReserved(reserved);
        return { ok: false, error: couponResult.error };
      }
      discount = couponResult.discount;
      freeShipping = couponResult.freeShipping;
      appliedCoupon = { couponId: couponResult.couponId, amountOff: couponResult.discount };
    }

    let shipping: number;
    if (freeShipping) {
      shipping = 0;
    } else {
      try {
        shipping = await priceShippingServerSide(
          data.shippingRateId,
          data.customer.state,
          subtotal,
        );
      } catch (err) {
        await releaseReserved(reserved);
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Could not calculate shipping.",
        };
      }
    }
    const total = subtotal - discount + shipping;

    // shipping_state/shipping_rate_id/shipping_city/shipping_landmark are
    // real columns (see the shipping and account-deletion/address
    // migrations) but aren't in generated types.ts yet — same outstanding
    // "regenerate types against live Supabase" item noted throughout this
    // project. Typed `as any` here only; every other field below is still
    // checked normally against the Insert<"orders"> shape.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- documented types.ts gap above
    const orderInsert: any = {
      user_id: userId,
      customer_name: name,
      customer_email: email,
      customer_phone: data.customer.phone || null,
      shipping_address: data.customer.addressLine,
      shipping_city: data.customer.city,
      shipping_landmark: data.customer.deliveryInstructions || null,
      shipping_state: data.customer.state,
      shipping_rate_id: data.shippingRateId,
      subtotal,
      shipping,
      discount,
      total,
      payment_method: data.paymentMethod,
      payment_status: "pending",
      notify_email: data.notifications.email,
      notify_sms:
        data.notifications.sms &&
        notificationCapabilities().sms &&
        normalizeNgMobile(data.customer.phone) !== null,
      notify_consent_at:
        data.notifications.email || data.notifications.sms ? new Date().toISOString() : null,
    };

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert(orderInsert)
      .select("id")
      .single();

    if (orderError || !order) {
      await releaseReserved(reserved);
      return { ok: false, error: "Could not place your order. Please try again." };
    }

    // No `as any` needed here (unlike orderInsert above) — order_items in
    // types.ts is fully up to date with this schema, and orderItemRows'
    // shape matches Insert<"order_items"> exactly.
    const { error: itemsError } = await supabaseAdmin
      .from("order_items")
      .insert(orderItemRows.map((r) => ({ ...r, order_id: order.id })));

    if (itemsError) {
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      await releaseReserved(reserved);
      return { ok: false, error: "Could not save your order items. Please try again." };
    }

    if (appliedCoupon) {
      const { error: redeemError } = await supabaseAdmin.rpc("record_coupon_redemption", {
        p_coupon_id: appliedCoupon.couponId,
        p_order_id: order.id,
        p_customer_email: email,
        p_amount_off: appliedCoupon.amountOff,
      });
      // A failed redemption record does NOT undo the order — the discount
      // is already reflected in `total` above, and the customer was
      // already quoted and charged accordingly. This only means the
      // coupon's own usage counter/audit trail didn't get this one
      // recorded; see record_coupon_redemption for why that's an accepted
      // tradeoff rather than a bug.
      if (redeemError) console.error("[checkout] record_coupon_redemption failed", redeemError);
    }

    await supabaseAdmin.from("activity_log").insert({
      type: "order",
      message: `New order ${order.id.slice(0, 8)} · ₦${total.toLocaleString("en-NG")} · ${items.length} item${items.length === 1 ? "" : "s"}`,
      user_id: userId,
    });

    // Pay-on-delivery orders are confirmed right now; Paystack orders are confirmed when the
    // payment lands (webhook / verify-on-return both call notifyOrder — it de-duplicates).
    if (data.paymentMethod === "delivery") await notifyOrder(order.id, "order_placed");

    return { ok: true, orderId: order.id, total, paymentMethod: data.paymentMethod };
  });
