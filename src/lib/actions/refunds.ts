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
            // Shown to the customer by Paystack in their refund notification.
            customer_note: `Finkel Reserve refund — order ${order.id.slice(0, 8).toUpperCase()}`,
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

// ─── Refunds that Paystack can't finish on its own ─────────────────────────
//
// When a refund can't be sent back to wherever the money came from (typically a customer who
// paid by bank transfer or USSD, where Paystack was never given a bank account to return it to),
// Paystack parks it as "needs-attention" and sends a refund.needs-attention webhook. To finish it
// the merchant supplies ANY valid bank account belonging to the customer — via the "retry with
// customer details" endpoint, which only accepts this for a needs-attention refund. These two
// functions power that: a bank list to choose from, and the retry itself.

export type PaystackBank = { id: number; name: string };

type PaystackBankListResponse = {
  status: boolean;
  data?: {
    id: number;
    name: string;
    active?: boolean;
    is_deleted?: boolean;
    currency?: string;
    type?: string;
  }[];
  meta?: { next?: string | null };
};

// The bank list changes rarely; keep it for a few hours per server instance rather than asking
// Paystack every time an admin opens the form.
const BANK_CACHE_MS = 6 * 60 * 60 * 1000;
let bankCache: { banks: PaystackBank[]; at: number } | null = null;

export const listPaystackBanks = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({}).parse(data ?? {}))
  .handler(
    async (): Promise<{ ok: true; banks: PaystackBank[] } | { ok: false; error: string }> => {
      try {
        await requireAdmin();
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Unauthorized." };
      }
      if (bankCache && Date.now() - bankCache.at < BANK_CACHE_MS) {
        return { ok: true, banks: bankCache.banks };
      }

      // Cursor pagination, 100 per page (Paystack's maximum); a hard page cap guards against a loop.
      const banks: PaystackBank[] = [];
      let next: string | null = null;
      for (let page = 0; page < 10; page++) {
        const url = new URL(`${PAYSTACK_BASE}/bank`);
        url.searchParams.set("country", "nigeria");
        url.searchParams.set("currency", "NGN");
        url.searchParams.set("perPage", "100");
        url.searchParams.set("use_cursor", "true");
        if (next) url.searchParams.set("next", next);

        let res: Response;
        try {
          res = await fetch(url, { headers: { Authorization: `Bearer ${paystackSecretKey()}` } });
        } catch {
          return { ok: false, error: "Could not reach Paystack. Please try again shortly." };
        }
        const json = (await res.json().catch(() => null)) as PaystackBankListResponse | null;
        if (!res.ok || !json?.status || !json.data) {
          return { ok: false, error: "Paystack could not return its list of banks." };
        }
        for (const b of json.data) {
          const usable =
            b.active !== false &&
            !b.is_deleted &&
            (!b.currency || b.currency === "NGN") &&
            (!b.type || b.type === "nuban");
          if (usable) banks.push({ id: b.id, name: b.name });
        }
        next = json.meta?.next ?? null;
        if (!next) break;
      }

      banks.sort((a, b) => a.name.localeCompare(b.name));
      bankCache = { banks, at: Date.now() };
      return { ok: true, banks };
    },
  );

const retrySchema = z.object({
  refundId: z.string().uuid(), // OUR refunds.id (not Paystack's)
  bankId: z.number().int().positive(), // Paystack's bank id, from listPaystackBanks
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "A Nigerian account number is exactly 10 digits."),
});

export type RetryRefundResult = { ok: true } | { ok: false; error: string };

export const retryRefundWithBankDetails = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => retrySchema.parse(data))
  .handler(async ({ data }): Promise<RetryRefundResult> => {
    let actorId: string;
    try {
      actorId = await requireAdmin();
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Unauthorized." };
    }

    const rate = await checkRateLimit("admin-refund-retry", 10, 60_000);
    if (!rate.ok) return { ok: false, error: "Too many attempts — please wait a minute." };

    const { data: refund, error } = await supabaseAdmin
      .from("refunds")
      .select("id, order_id, method, status, gateway_reference, gateway_status")
      .eq("id", data.refundId)
      .maybeSingle();
    if (error || !refund) return { ok: false, error: "Refund not found." };

    // Paystack answers 422 for anything but a needs-attention refund; check first so the admin
    // gets a clear message instead of a gateway error.
    if (
      refund.method !== "paystack" ||
      refund.status !== "pending" ||
      refund.gateway_status !== "needs-attention" ||
      !refund.gateway_reference
    ) {
      return { ok: false, error: "This refund isn't waiting for the customer's bank details." };
    }

    let res: Response;
    try {
      res = await fetch(
        `${PAYSTACK_BASE}/refund/retry_with_customer_details/${encodeURIComponent(refund.gateway_reference)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${paystackSecretKey()}`,
            "Content-Type": "application/json",
          },
          // The account number goes straight to Paystack. We don't store it or write it to any log.
          body: JSON.stringify({
            refund_account_details: {
              currency: "NGN",
              account_number: data.accountNumber,
              bank_id: String(data.bankId),
            },
          }),
        },
      );
    } catch {
      return { ok: false, error: "Could not reach Paystack. Please try again shortly." };
    }

    const json = (await res.json().catch(() => null)) as {
      status?: boolean;
      message?: string;
      data?: { status?: string };
    } | null;
    if (!res.ok || !json?.status) {
      return { ok: false, error: json?.message || "Paystack could not retry this refund." };
    }

    // Paystack reports the new state (usually "processing"). It stays open here until the
    // refund.processed / refund.failed webhook settles it.
    await supabaseAdmin.rpc("update_refund_status", {
      p_gateway_reference: refund.gateway_reference,
      p_status: "pending",
      p_gateway_status: json.data?.status ?? "processing",
    });
    await supabaseAdmin.rpc("log_admin_activity", {
      p_type: "refund_retried",
      p_message: `Retried refund ${refund.id.slice(0, 8)} with the customer's bank details`,
      p_entity_type: "refund",
      p_entity_id: refund.id,
      p_metadata: { order_id: refund.order_id },
      p_actor_id: actorId,
    });

    return { ok: true };
  });
