import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "./auth";
import { notifyOrder } from "./notify-server";

export type CancelOrderResult = { ok: true } | { ok: false; error: string };

const cancelOrderSchema = z.object({ orderId: z.string().uuid() });

// A plain status update (see useUpdateOrderStatus) is fine for
// processing/shipped/delivered. Cancelling is different: it needs to give
// the stock back, and that's now done inside a single database function
// (cancel_order_atomic — see the migration) so the restore and the status
// change either both happen or neither does. The previous version did this
// as separate JS-side steps with Promise.allSettled and never checked the
// results, so a failed stock restore was silently swallowed while the
// order still got marked cancelled — that inventory was gone for good.
export const cancelOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => cancelOrderSchema.parse(data))
  .handler(async ({ data }): Promise<CancelOrderResult> => {
    let actorId: string;
    try {
      actorId = await requireAdmin();
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Unauthorized." };
    }

    const { data: result, error } = await supabaseAdmin
      .rpc("cancel_order_atomic", { p_order_id: data.orderId, p_actor_id: actorId })
      .single();

    if (error || !result) return { ok: false, error: "Could not cancel the order." };
    if (!result.ok)
      return { ok: false, error: result.error_message ?? "Could not cancel the order." };
    await notifyOrder(data.orderId, "cancelled");
    return { ok: true };
  });
