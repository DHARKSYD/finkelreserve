import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { COURIER_IDS } from "@/lib/courier";
import { requireAdmin } from "./auth";
import { notificationCapabilities, notifyOrder } from "./notify-server";

export type DeliveryActionResult = { ok: true } | { ok: false; error: string };

// types.ts doesn't know the courier columns yet (documented gap).
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- documented types.ts gap above
const db = supabaseAdmin as unknown as { from: (table: string) => any };

const fail = (e: unknown): DeliveryActionResult => ({
  ok: false,
  error: e instanceof Error ? e.message : "Unauthorized.",
});

/**
 * Which notification channels this deployment can send on — the checkout uses
 * it so a customer is only offered "text me" when a text will really go out.
 * Public on purpose: it exposes two booleans, never any configuration.
 */
export const getNotificationOptions = createServerFn({ method: "GET" }).handler(async () =>
  notificationCapabilities(),
);

// ---- status changes ------------------------------------------------------------------------
// Admin status changes used to be a direct browser → Supabase update. They go through the
// server now so the customer can be told: shipped → "on its way", delivered → "delivered".
// (Cancelling is separate — see cancelOrder.)
const statusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(["pending", "processing", "shipped", "delivered"]),
});

export const updateOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => statusSchema.parse(data))
  .handler(async ({ data }): Promise<DeliveryActionResult> => {
    try {
      await requireAdmin();
    } catch (e) {
      return fail(e);
    }

    const { data: before } = await supabaseAdmin
      .from("orders")
      .select("status")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!before) return { ok: false, error: "Order not found." };
    if (before.status === "cancelled")
      return { ok: false, error: "A cancelled order can't change status." };

    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status: data.status })
      .eq("id", data.orderId);
    if (error) return { ok: false, error: "Could not update the order." };

    if (before.status !== data.status) {
      if (data.status === "shipped") await notifyOrder(data.orderId, "out_for_delivery");
      if (data.status === "delivered") await notifyOrder(data.orderId, "delivered");
    }
    return { ok: true };
  });

// ---- courier hand-off ----------------------------------------------------------------------
const handOffSchema = z.object({
  orderId: z.string().uuid(),
  provider: z.enum(COURIER_IDS),
  reference: z.string().trim().max(120).optional().default(""),
  // Rendered as a link for the customer, so only ever http(s) (the database enforces it too).
  trackingUrl: z
    .string()
    .trim()
    .max(500)
    .refine(
      (v) => v === "" || /^https?:\/\/\S+$/i.test(v),
      "Tracking link must start with http:// or https://",
    )
    .optional()
    .default(""),
  riderName: z.string().trim().max(120).optional().default(""),
  riderPhone: z.string().trim().max(40).optional().default(""),
  /** Also move the order to "shipped" (out for delivery) and tell the customer. */
  markOutForDelivery: z.boolean(),
});

export type HandOffInput = z.output<typeof handOffSchema>;

export const handOffOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => handOffSchema.parse(data))
  .handler(async ({ data }): Promise<DeliveryActionResult> => {
    try {
      await requireAdmin();
    } catch (e) {
      return fail(e);
    }

    const { data: before } = await supabaseAdmin
      .from("orders")
      .select("status")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!before) return { ok: false, error: "Order not found." };
    if (before.status === "cancelled") return { ok: false, error: "This order was cancelled." };
    if (before.status === "delivered")
      return { ok: false, error: "This order is already delivered." };

    const patch: Record<string, unknown> = {
      courier_provider: data.provider,
      courier_reference: data.reference || null,
      courier_tracking_url: data.trackingUrl || null,
      courier_rider_name: data.riderName || null,
      courier_rider_phone: data.riderPhone || null,
      courier_handed_off_at: new Date().toISOString(),
    };
    const markShipped = data.markOutForDelivery && before.status !== "shipped";
    if (markShipped) patch.status = "shipped";

    const { error } = await db.from("orders").update(patch).eq("id", data.orderId);
    if (error) return { ok: false, error: "Could not save the hand-off." };

    if (markShipped) await notifyOrder(data.orderId, "out_for_delivery");
    return { ok: true };
  });

// ---- resend ---------------------------------------------------------------------------------
const resendSchema = z.object({
  orderId: z.string().uuid(),
  event: z.enum(["order_placed", "payment_received", "out_for_delivery", "delivered", "cancelled"]),
  channel: z.enum(["email", "sms"]),
});

export type ResendInput = z.output<typeof resendSchema>;

export type ResendResult =
  { ok: true; status: string; error: string | null } | { ok: false; error: string };

export const resendOrderNotification = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => resendSchema.parse(data))
  .handler(async ({ data }): Promise<ResendResult> => {
    try {
      await requireAdmin();
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Unauthorized." };
    }

    // An admin-initiated resend: mark whatever's there as retryable so notifyOrder's
    // claim() lets this one through (a never-sent event just inserts fresh).
    await db
      .from("notification_log")
      .update({ status: "failed", error: "Resent by an admin" })
      .eq("order_id", data.orderId)
      .eq("event", data.event)
      .eq("channel", data.channel);

    await notifyOrder(data.orderId, data.event, { channels: [data.channel] });

    const { data: row } = await db
      .from("notification_log")
      .select("status, error")
      .eq("order_id", data.orderId)
      .eq("event", data.event)
      .eq("channel", data.channel)
      .maybeSingle();
    return {
      ok: true,
      status: (row?.status as string) ?? "unknown",
      error: (row?.error as string) ?? null,
    };
  });
