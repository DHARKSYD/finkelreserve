import crypto from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyOrder } from "./notify-server";

// Paystack refund events → the status we store. needs-attention stays "pending" on purpose: the
// refund still reserves its amount against the order, and gateway_status records why it's stuck.
const REFUND_EVENTS: Record<string, "pending" | "processed" | "failed"> = {
  "refund.pending": "pending",
  "refund.processing": "pending",
  "refund.needs-attention": "pending",
  "refund.processed": "processed",
  "refund.failed": "failed",
};

/**
 * Raw HTTP handler for Paystack's webhook. Paystack POSTs here directly
 * over plain HTTP — this is NOT a TanStack Start server function, and it
 * must never be imported from a client-bundled route file (see src/server.ts,
 * the only importer, and the note above on why this lives in its own file).
 */
export async function handlePaystackWebhook(request: Request): Promise<Response> {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    console.error("[paystack-webhook] PAYSTACK_SECRET_KEY not configured");
    return new Response("Not configured", { status: 500 });
  }

  const raw = await request.text();
  const signature = request.headers.get("x-paystack-signature") ?? "";
  const expected = crypto.createHmac("sha512", secret).update(raw).digest("hex");

  // Timing-safe comparison of the two hex digests.
  const sigBuf = Buffer.from(signature, "hex");
  const expBuf = Buffer.from(expected, "hex");
  const validSignature = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
  if (!validSignature) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: {
    event?: string;
    data?: {
      reference?: string;
      metadata?: { order_id?: string };
      id?: number;
      status?: string;
      // Refund events (see below) identify the refund by its TRANSACTION, not by an id:
      transaction_reference?: string;
      refund_reference?: string | null;
      amount?: string | number; // KOBO, as a string — e.g. "10000" is ₦100
    };
  } | null = null;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  if (event?.event === "charge.success" && event.data?.reference) {
    const reference = event.data.reference;
    const orderId = event.data.metadata?.order_id;
    const update = supabaseAdmin
      .from("orders")
      .update({ payment_status: "paid" })
      .eq("payment_reference", reference);
    const { data: paidRows } = await (orderId ? update.eq("id", orderId) : update).select("id");
    // Confirm to the customer. The verify-on-return page can also reach this point for the
    // same payment; notifyOrder de-duplicates, so whichever lands first sends, once.
    for (const row of paidRows ?? []) await notifyOrder(row.id, "payment_received");
  }

  // Refund lifecycle events. Per Paystack's docs the payload is
  //   { event: "refund.processed", data: { status, transaction_reference, refund_reference
  //     (null until processed), amount ("10000" = ₦100, in kobo), currency, processor, customer… } }
  // — it has NO refund id, so we can't match on the id requestRefund stored. We match on what is
  // there: the transaction (orders.payment_reference) and the amount (see
  // update_refund_status_by_transaction). It only ever updates a refund this system already
  // recorded; a refund made from the Paystack dashboard simply doesn't match and is ignored.
  //
  //   refund.pending / .processing / .needs-attention → still open (needs-attention = Paystack
  //     needs the customer's bank account; the admin can supply it, see retryRefundWithBankDetails)
  //   refund.processed → money sent (the customer may still wait up to 10 business days)
  //   refund.failed    → money did not move
  const refundStatus = event?.event ? REFUND_EVENTS[event.event] : undefined;
  if (refundStatus && event?.data?.transaction_reference) {
    const kobo = Number(event.data.amount);
    const { data: outcome, error } = await supabaseAdmin.rpc(
      "update_refund_status_by_transaction",
      {
        p_transaction_reference: event.data.transaction_reference,
        p_amount: Number.isFinite(kobo) ? kobo / 100 : null,
        p_status: refundStatus,
        p_gateway_status: event.event!.slice("refund.".length), // processing | needs-attention | …
        p_gateway_reference: event.data.id != null ? String(event.data.id) : null,
      },
    );
    if (error) {
      // The update is idempotent, so ask Paystack to deliver this again rather than lose it.
      console.error("[paystack-webhook] refund update failed", error);
      return new Response("Refund update failed", { status: 500 });
    }
    if (outcome === "ambiguous") {
      console.warn(
        `[paystack-webhook] ${event.event} for ${event.data.transaction_reference}: several open refunds, none matched by amount — left unchanged`,
      );
    }
  }

  // Always 200 for anything we understood but didn't act on, so Paystack
  // doesn't keep retrying an event we're intentionally ignoring.
  return new Response("ok", { status: 200 });
}
