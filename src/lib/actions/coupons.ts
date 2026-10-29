import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { checkRateLimit } from "./rate-limit";
import {
  priceCartLines,
  resolveCoupon,
  type CouponLine,
  type CouponResult,
} from "./coupons-server";

// This file's only export besides types is a createServerFn, imported
// directly by client code (queries/coupons.ts) — so it must never also
// export a plain function that touches supabaseAdmin. See the note on
// resolveCoupon in coupons-server.ts for why that combination leaks
// service-role construction logic into the client bundle; the actual
// discount logic lives there instead, imported only by checkout.ts and the
// handler below.
export type { CouponLine, CouponResult };

const validateCouponSchema = z.object({
  code: z.string().trim().min(1).max(30),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        size: z.string().trim().min(1).max(20),
        unit: z.enum(["bottle", "box"]).optional().default("bottle"),
        qty: z.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(50),
  customerEmail: z.string().trim().email().max(200).optional(),
});

// Cart-page preview, called when the customer clicks "Apply" — same
// resolveCoupon placeOrder uses for the real charge, just called earlier
// and without an order to attach a redemption to yet. If the customer
// hasn't typed an email yet, per-customer-limit/first-order checks are
// skipped here and re-checked authoritatively in placeOrder — see the
// note there.
export const validateCoupon = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => validateCouponSchema.parse(data))
  .handler(async ({ data }): Promise<CouponResult> => {
    const rate = await checkRateLimit("validate-coupon", 20, 60_000);
    if (!rate.ok) return { valid: false, error: "Too many attempts — please wait a moment." };
    const lines = await priceCartLines(data.items);
    if (lines.length === 0) return { valid: false, error: "Your bag is empty." };
    return resolveCoupon(data.code, lines, data.customerEmail);
  });
