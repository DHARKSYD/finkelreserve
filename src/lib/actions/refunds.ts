import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "./auth";
import { checkRateLimit } from "./rate-limit";

const PAYSTACK_BASE = "https://api.paystack.co";

function paystackSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured on the server.");
  return key;
}

const refundSchema = z.object({
  orderId: z.string().uuid(),
  // Omit for "refund whatever is left" (a full refund on the first call,
  // or the remainder of a partially-refunded one).
  amount: z.number().positive().optional(),
  reason: z.string().trim().max(300).optional(),
});

export type RefundResult =
  | {
      ok: true;
      refundId: string;
      status: "pending" | "processed" | "failed";
      fullyRefunded: boolean;
    }
  | { ok: false; error: string };

type PaystackRefundResponse = {
  status: boolean;
  message: string;
  data?: { id: number; status: string; amount: number };
};

// Best-effort mitigation for a real gap: if Paystack successfully processes
// a refund but the DB write right after it fails, money has already left
// the merchant's Paystack balance with nothing recorded locally, and — since
// the local row is what update_refund_status matches a later webhook
// against — that gap can't self-heal from the webhook either, because
// there'd be no row for it to find. One retry catches most transient DB
// blips; if it still fails, the caller gets an explicit "this needs manual
// reconciliation" message rather than a generic error, and the details are
// logged server-side. A fully bulletproof version of this needs an outbox
// pattern, which is more machinery than this project's transaction volume
// currently justifies — flagged here rather than silently accepted.
async function recordRefundWithRetry(args: {
  orderId: string;
  amount: number;
  reason: string | null;
  method: "paystack" | "manual";
  gatewayReference: string | null;
  gatewayStatus: string | null;
  status: "pending" | "processed" | "failed";
  actorId: string;
}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabaseAdmin
      .rpc("record_refund", {
        p_order_id: args.orderId,
        p_amount: args.amount,
        p_reason: args.reason,
        p_method: args.method,
        p_gateway_reference: args.gatewayReference,
        p_gateway_status: args.gatewayStatus,
        p_status: args.status,
        p_actor_id: args.actorId,
      })
      .single();
    if (!error && data) return { data, error: null as null };
    if (attempt === 1) return { data: null, error };
  }
  return { data: null, error: new Error("unreachable") };
}

export const requestRefund = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => refundSchema.parse(data))
  .handler(async ({ data }): Promise<RefundResult> => {
    let actorId: string;
    try {
      actorId = await requireAdmin();
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Unauthorized." };
    }

    const rate = await checkRateLimit("admin-refund", 20, 60_000);
    if (!rate.ok) return { ok: false, error: "Too many refund attempts — please wait a minute." };

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, total, payment_method, payment_status, payment_reference")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error || !order) return { ok: false, error: "Order not found." };
    if (order.payment_status !== "paid") {
      return {
        ok: false,
        error: "This order isn't in a paid state, so there's nothing to refund.",
      };
    }

    // Re-derive "how much is actually refundable" from the DB, never from
    // whatever the client's UI happened to show — matches how checkout
    // never trusts a client-submitted total.
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("refunds")
      .select("amount")
      .eq("order_id", order.id)
      .in("status", ["pending", "processed"]);
    if (existingError)
      return { ok: false, error: "Could not check existing refunds for this order." };

    const alreadyCommitted = (existing ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
    const remaining = Number(order.total) - alreadyCommitted;
    const amount = data.amount ?? remaining;

    if (remaining <= 0.01)
      return { ok: false, error: "This order has already been fully refunded." };
    if (amount > remaining + 0.01) {
      return {
        ok: false,
        error: `That's more than what's left to refund (₦${remaining.toFixed(2)}).`,
      };
    }

    let method: "paystack" | "manual";
    let gatewayReference: string | null = null;
    let gatewayStatus: string | null = null;
    let status: "pending" | "processed" | "failed";

    if (order.payment_method === "paystack") {
      if (!order.payment_reference) {
        return { ok: false, error: "This order has no payment reference on file to refund." };
      }
      method = "paystack";

      let res: Response;
      try {
        res = await fetch(`${PAYSTACK_BASE}/refund`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${paystackSecretKey()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transaction: order.payment_reference,
            amount: Math.round(amount * 100), // kobo — see paystack.ts for the same conversion on the charge side
            currency: "NGN",
            merchant_note: data.reason || `Refund for order ${order.id}`,
          }),
        });
      } catch {
        return { ok: false, error: "Could not reach Paystack. Please try again shortly." };
      }

      const json = (await res.json().catch(() => null)) as PaystackRefundResponse | null;
      if (!res.ok || !json?.status || !json.data) {
        return { ok: false, error: json?.message || "Paystack could not process this refund." };
      }

      gatewayReference = String(json.data.id);
      gatewayStatus = json.data.status;
      status =
        json.data.status === "processed"
          ? "processed"
          : json.data.status === "failed"
            ? "failed"
            : "pending";
    } else {
      // Pay-on-delivery order — no gateway transaction exists to refund.
      // The admin is asserting a cash refund already happened outside the
      // system; there's no async confirmation to wait on.
      method = "manual";
      status = "processed";
    }

    const { data: result, error: rpcError } = await recordRefundWithRetry({
      orderId: order.id,
      amount,
      reason: data.reason ?? null,
      method,
      gatewayReference,
      gatewayStatus,
      status,
      actorId,
    });

    if (rpcError || !result) {
      if (method === "paystack") {
        console.error("[refunds] Paystack refund processed but record_refund failed", {
          orderId: order.id,
          paystackRefundId: gatewayReference,
          amount,
          error: rpcError,
        });
        return {
          ok: false,
          error: `Paystack accepted this refund (reference ${gatewayReference}), but saving it here failed. The money is moving regardless — note that reference and check Paystack's dashboard, then contact support so the record can be added manually.`,
        };
      }
      return { ok: false, error: "Could not record the refund. Please try again." };
    }

    return {
      ok: true,
      refundId: result.refund_id,
      status,
      fullyRefunded: result.order_fully_refunded,
    };
  });
