import crypto from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyOrder } from "./notify-server";

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

  // Refund lifecycle events — id is the same value requestRefund stored as
  // refunds.gateway_reference. update_refund_status only ever updates an
  // existing row by that reference; it can't create one, so a webhook for
  // a refund this system didn't initiate is a safe no-op, not a write.
  if (
    (event?.event === "refund.processed" || event?.event === "refund.failed") &&
    event.data?.id != null
  ) {
    const status = event.event === "refund.processed" ? "processed" : "failed";
    const { error } = await supabaseAdmin.rpc("update_refund_status", {
      p_gateway_reference: String(event.data.id),
      p_status: status,
      p_gateway_status: event.data.status ?? null,
    });
    if (error) console.error("[paystack-webhook] update_refund_status failed", error);
  }

  // Always 200 for anything we understood but didn't act on, so Paystack
  // doesn't keep retrying an event we're intentionally ignoring.
  return new Response("ok", { status: 200 });
}
