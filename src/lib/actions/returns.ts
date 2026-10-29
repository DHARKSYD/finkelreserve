import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getVerifiedUserId, requireAdmin } from "./auth";
import { requestRefund } from "./refunds";

// request_return/update_return_status (RPC) and return_requests/return_items
// (tables), plus refunds.return_request_id (a new column on an existing
// table), aren't in generated types.ts yet — documented types.ts gap, same
// as every other recent migration (see the audit doc).
const untypedAdmin = supabaseAdmin as unknown as {
  rpc: (
    fn: "request_return" | "update_return_status",
    args: Record<string, unknown>,
  ) => Promise<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- documented types.ts gap above
    data: any;
    error: { message: string } | null;
  }>;
  from: (table: "return_requests" | "return_items") => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- documented types.ts gap above
    select: (cols: string) => any;
  };
};

const requestReturnSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().trim().min(1).max(200),
  customerNote: z.string().trim().max(1000).optional().default(""),
  items: z
    .array(
      z.object({
        orderItemId: z.string().uuid(),
        quantity: z.number().int().positive().max(100),
      }),
    )
    .min(1)
    .max(50),
  // Storage paths already uploaded (see src/lib/queries/return-evidence.ts)
  // — this endpoint never receives file bytes directly, only references to
  // files the customer already put in their own folder of the private
  // return-evidence bucket.
  evidencePaths: z.array(z.string().trim().min(1).max(300)).max(4).optional().default([]),
});
export type RequestReturnInput = z.infer<typeof requestReturnSchema>;

/**
 * Every eligibility rule (ownership, delivered status, return window, valid
 * quantities, no duplicate active return) is enforced inside request_return()
 * itself, not here — this function's only job is verifying who's actually
 * asking before handing off to it. See the migration for why: those checks
 * need to run atomically against a locked order row, which isn't something
 * safely done as separate JS-side queries.
 */
export const requestReturn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => requestReturnSchema.parse(data))
  .handler(async ({ data }) => {
    const userId = await getVerifiedUserId();
    if (!userId) throw new Error("Sign in required.");

    const { data: returnId, error } = await untypedAdmin.rpc("request_return", {
      p_order_id: data.orderId,
      p_customer_id: userId,
      p_reason: data.reason,
      p_customer_note: data.customerNote,
      p_items: data.items.map((i) => ({ order_item_id: i.orderItemId, quantity: i.quantity })),
      p_evidence_paths: data.evidencePaths,
    });

    if (error) throw new Error(error.message);
    return { returnId: returnId as string };
  });

export const RETURN_STATUSES = [
  "requested",
  "under_review",
  "approved",
  "rejected",
  "item_received",
  "refund_initiated",
  "completed",
] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

const updateReturnStatusSchema = z.object({
  returnId: z.string().uuid(),
  newStatus: z.enum(RETURN_STATUSES),
  adminNote: z.string().trim().max(1000).optional(),
  // Only meaningful (and only checked server-side) when newStatus is
  // "approved" and the return includes a customized item — see
  // update_return_status. Ignored otherwise, so it's always safe to omit.
  customizationOverride: z.boolean().optional(),
});
export type UpdateReturnStatusInput = z.infer<typeof updateReturnStatusSchema>;

/**
 * Admin-only. The plain state transition (can't skip states, no way out of
 * a terminal one) happens in update_return_status(), same as before.
 *
 * Moving into 'refund_initiated' is different: it goes through the
 * *existing* requestRefund from src/lib/actions/refunds.ts — rate-limited,
 * re-derives the refundable amount from the DB, and calls Paystack's live
 * /refund API for card-paid orders — rather than a second, weaker refund
 * path. That call happens first; the Postgres transition only runs
 * afterward, and only on success, so a failed refund never leaves the
 * return showing as "refund initiated." requireAdmin() re-verifies the
 * caller server-side either way; nothing here trusts a role claim the
 * client might send.
 */
export const updateReturnStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateReturnStatusSchema.parse(data))
  .handler(async ({ data }) => {
    const adminId = await requireAdmin();

    if (data.newStatus === "refund_initiated") {
      const { data: returnRow, error: returnError } = (await untypedAdmin
        .from("return_requests")
        .select("order_id, status")
        .eq("id", data.returnId)
        .maybeSingle()) as { data: { order_id: string; status: string } | null; error: unknown };
      if (returnError || !returnRow) throw new Error("Return request not found.");
      // Mirrors what update_return_status's own state machine would reject
      // anyway — checked here first so a stale double-click can't trigger a
      // real Paystack call before failing.
      if (returnRow.status !== "item_received") {
        throw new Error(`Cannot initiate a refund from status "${returnRow.status}".`);
      }

      const { data: items, error: itemsError } = (await untypedAdmin
        .from("return_items")
        .select("refund_amount")
        .eq("return_request_id", data.returnId)) as {
        data: { refund_amount: number }[] | null;
        error: unknown;
      };
      if (itemsError) throw new Error("Could not calculate the refund amount for this return.");

      const amount = (items ?? []).reduce((sum, i) => sum + Number(i.refund_amount), 0);
      if (amount <= 0) throw new Error("This return has no refundable amount.");

      const refundResult = await requestRefund({
        data: {
          orderId: returnRow.order_id,
          amount,
          reason: `Return ${data.returnId.slice(0, 8)}`,
        },
      });
      if (!refundResult.ok) throw new Error(refundResult.error);

      // return_request_id isn't in generated types.ts yet — documented
      // types.ts gap, same as the rest of this file.
      const { error: linkError } = await (
        supabaseAdmin.from("refunds") as unknown as {
          update: (v: { return_request_id: string }) => {
            eq: (c: string, v: string) => Promise<{ error: unknown }>;
          };
        }
      )
        .update({ return_request_id: data.returnId })
        .eq("id", refundResult.refundId);
      if (linkError) {
        // Non-fatal: the refund itself succeeded and is correctly recorded
        // against the order either way — this only affects whether the
        // admin return-detail view can show it inline. Logged, not thrown.
        console.error("[returns] refund succeeded but linking to return failed", {
          returnId: data.returnId,
          refundId: refundResult.refundId,
          error: linkError,
        });
      }
    }

    const { error } = await untypedAdmin.rpc("update_return_status", {
      p_return_id: data.returnId,
      p_new_status: data.newStatus,
      p_actor_id: adminId,
      p_admin_note: data.adminNote ?? null,
      p_customization_override: data.customizationOverride ?? false,
    });

    if (error) throw new Error(error.message);
  });
