import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyOrder } from "./notify-server";
import { getVerifiedUserId } from "./auth";
import { checkRateLimit } from "./rate-limit";

const PAYSTACK_BASE = "https://api.paystack.co";

function paystackSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured on the server.");
  return key;
}

/** Reject a callback URL that doesn't point back at this same site — a
 * mismatched origin here would mean sending the shopper to an attacker's
 * page after they pay. */
function isSameOriginCallback(callbackUrl: string): boolean {
  const requestOrigin = getRequest()?.headers?.get("origin");
  try {
    const target = new URL(callbackUrl);
    if (!requestOrigin) return true; // no Origin header (e.g. server-to-server call) — nothing to compare against
    return target.origin === new URL(requestOrigin).origin;
  } catch {
    return false;
  }
}

type PaystackInitializeResponse = {
  status: boolean;
  message: string;
  data?: { authorization_url: string; access_code: string; reference: string };
};

type PaystackVerifyResponse = {
  status: boolean;
  message: string;
  data?: { status: string; reference: string; amount: number; metadata?: { order_id?: string } };
};

export type InitializePaymentResult =
  { ok: true; authorizationUrl: string } | { ok: false; error: string };

const initializeSchema = z.object({
  orderId: z.string().uuid(),
  callbackUrl: z.string().url(),
});

// Called right after placeOrder() when the shopper chose "pay online".
// Creates a Paystack checkout session for the order's authoritative total
// (never a client-submitted amount) and stores the reference for the
// webhook/verify step to match back up.
export const initializePaystackPayment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => initializeSchema.parse(data))
  .handler(async ({ data }): Promise<InitializePaymentResult> => {
    const rate = await checkRateLimit("paystack-init", 10, 60_000);
    if (!rate.ok)
      return {
        ok: false,
        error: "Too many payment attempts — please wait a minute and try again.",
      };

    if (!isSameOriginCallback(data.callbackUrl)) {
      return { ok: false, error: "Invalid callback URL." };
    }

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, customer_email, total, payment_method, payment_status")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error || !order) return { ok: false, error: "Order not found." };

    // Ownership check: an authenticated order can only be paid by its owner.
    // Guest orders (user_id null) have no owner to check against — same
    // trade-off already accepted for viewing a guest order by id (the UUID
    // itself is the access control there).
    if (order.user_id) {
      const callerUserId = await getVerifiedUserId();
      if (callerUserId !== order.user_id) {
        return { ok: false, error: "This order doesn't belong to your account." };
      }
    }

    if (order.payment_method !== "paystack") {
      return { ok: false, error: "This order wasn't set up for online payment." };
    }
    if (order.payment_status === "paid") {
      return { ok: false, error: "This order has already been paid for." };
    }

    const reference = `finkel_${order.id.replace(/-/g, "").slice(0, 20)}_${Date.now().toString(36)}`;

    let res: Response;
    try {
      res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecretKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: order.customer_email,
          amount: Math.round(Number(order.total) * 100), // kobo
          reference,
          callback_url: data.callbackUrl,
          metadata: { order_id: order.id },
        }),
      });
    } catch {
      return {
        ok: false,
        error: "Could not reach Paystack. Please try again or choose pay on delivery.",
      };
    }

    const json = (await res.json().catch(() => null)) as PaystackInitializeResponse | null;
    if (!res.ok || !json?.status || !json.data) {
      return {
        ok: false,
        error:
          json?.message || "Could not start payment. Please try again or choose pay on delivery.",
      };
    }

    await supabaseAdmin
      .from("orders")
      .update({ payment_reference: json.data.reference })
      .eq("id", order.id);

    return { ok: true, authorizationUrl: json.data.authorization_url };
  });

export type VerifyPaymentResult =
  | { ok: true; status: "paid" | "failed" | "pending"; orderId: string | null }
  | { ok: false; error: string };

const verifySchema = z.object({
  reference: z.string().trim().min(1).max(200),
});

// Fallback path for the order-confirmation page: if the webhook hasn't
// landed yet (or isn't configured), verifying directly against Paystack on
// return from checkout still confirms payment without waiting on it.
export const verifyPaystackPayment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => verifySchema.parse(data))
  .handler(async ({ data }): Promise<VerifyPaymentResult> => {
    const rate = await checkRateLimit("paystack-verify", 20, 60_000);
    if (!rate.ok) return { ok: false, error: "Too many requests — please wait a moment." };

    let res: Response;
    try {
      res = await fetch(
        `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(data.reference)}`,
        {
          headers: { Authorization: `Bearer ${paystackSecretKey()}` },
        },
      );
    } catch {
      return { ok: false, error: "Could not reach Paystack to verify payment." };
    }

    const json = (await res.json().catch(() => null)) as PaystackVerifyResponse | null;
    if (!res.ok || !json?.status || !json.data) {
      return { ok: false, error: json?.message || "Could not verify payment." };
    }

    const orderId = json.data.metadata?.order_id ?? null;
    const paystackStatus =
      json.data.status === "success"
        ? "paid"
        : json.data.status === "failed"
          ? "failed"
          : "pending";

    if (orderId && (paystackStatus === "paid" || paystackStatus === "failed")) {
      const { data: updated } = await supabaseAdmin
        .from("orders")
        .update({ payment_status: paystackStatus })
        .eq("id", orderId)
        .eq("payment_reference", data.reference)
        .select("id");
      // Same confirmation the webhook sends; notifyOrder de-duplicates whichever arrives second.
      if (paystackStatus === "paid" && updated?.length)
        await notifyOrder(orderId, "payment_received");
    }

    return { ok: true, status: paystackStatus, orderId };
  });
