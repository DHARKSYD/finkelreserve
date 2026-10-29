import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getVerifiedUserId } from "./auth";

export type DeleteAccountResult = { ok: true } | { ok: false; error: string };

// Matches order_status minus the two terminal values.
const NON_TERMINAL_ORDER_STATUSES = ["pending", "processing", "shipped"] as const;
// Matches return_requests.status minus its two terminal values (rejected/completed).
const NON_TERMINAL_RETURN_STATUSES = [
  "requested",
  "under_review",
  "approved",
  "item_received",
  "refund_initiated",
] as const;

// return_requests isn't in generated types.ts yet — documented types.ts gap,
// same as every other recent migration (see the audit doc / returns.ts).
const untypedAdmin = supabaseAdmin as unknown as {
  from: (table: "return_requests") => {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        in: (
          col: string,
          vals: readonly string[],
        ) => Promise<{ data: { id: string }[] | null; error: { message: string } | null }>;
      };
    };
  };
};

/**
 * Self-service account deletion. Re-verifies identity from the caller's own
 * JWT (never a client-supplied id — see getVerifiedUserId) and re-checks
 * every eligibility rule server-side, even though the Security page also
 * checks these before ever showing the confirm dialog: that client check is
 * UX, this one is the actual boundary — same split this codebase uses
 * everywhere else (admin gating, return eligibility, etc.).
 *
 * What this does NOT do: hard-delete the customer's order history. Orders
 * (and the return requests / refunds tied to them) are financial records —
 * they stay, with orders.user_id / return_requests.customer_id set to null
 * by the FK (see this session's migration for return_requests; orders and
 * refunds.actor_id were already `on delete set null`). Reviews follow the
 * same pattern as of the reviews_anonymize_on_deletion migration — kept,
 * detached, not destroyed (a business decision, not a default). Only the
 * *account* itself — profile, saved addresses, auth identity, roles — is
 * removed via Supabase's admin deleteUser, which cascades those through
 * the FKs that are genuinely `on delete cascade` (profiles,
 * customer_addresses, user_roles).
 */
export const deleteMyAccount = createServerFn({ method: "POST" }).handler(
  async (): Promise<DeleteAccountResult> => {
    const userId = await getVerifiedUserId();
    if (!userId) return { ok: false, error: "Sign in required." };

    const { data: authUser, error: authUserError } =
      await supabaseAdmin.auth.admin.getUserById(userId);
    if (authUserError || !authUser?.user) {
      return { ok: false, error: "Could not verify your account. Please try again." };
    }
    const email = authUser.user.email ?? null;

    // Admin accounts can't self-delete through this flow — losing the only
    // admin is a much worse failure mode than the small inconvenience of
    // requiring the role be removed first (by another admin, or directly in
    // Supabase).
    const { data: adminRole, error: adminRoleError } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (adminRoleError) {
      return { ok: false, error: "Could not verify your account. Please try again." };
    }
    if (adminRole) {
      return {
        ok: false,
        error:
          "Admin accounts can't be self-deleted. Remove the admin role first, or ask another admin.",
      };
    }

    const { data: openOrders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("user_id", userId)
      .in("status", NON_TERMINAL_ORDER_STATUSES);
    if (ordersError) {
      return { ok: false, error: "Could not check your orders. Please try again." };
    }
    if (openOrders && openOrders.length > 0) {
      return {
        ok: false,
        error: `You have ${openOrders.length} order${openOrders.length === 1 ? "" : "s"} still in progress. Please wait until ${openOrders.length === 1 ? "it's" : "they're"} delivered, or contact us, before deleting your account.`,
      };
    }

    const { data: openReturns, error: returnsError } = await untypedAdmin
      .from("return_requests")
      .select("id")
      .eq("customer_id", userId)
      .in("status", NON_TERMINAL_RETURN_STATUSES);
    if (returnsError) {
      return { ok: false, error: "Could not check your returns. Please try again." };
    }
    if (openReturns && openReturns.length > 0) {
      return {
        ok: false,
        error: `You have ${openReturns.length} return${openReturns.length === 1 ? "" : "s"} still in progress. Please wait until it's resolved before deleting your account.`,
      };
    }

    // Best-effort courtesy: newsletter_subscribers is email-keyed with no
    // link to auth.users at all (see the account-redesign audit), so this
    // is never load-bearing for the deletion itself — just makes sure
    // "delete my account" also actually stops the emails.
    if (email) {
      await supabaseAdmin.from("newsletter_subscribers").delete().eq("email", email);
    }

    // Logged before the delete, not after: activity_log.user_id is
    // `on delete set null` (same as everywhere else), so writing this first
    // is the only way the entry still says *who*, in the message text
    // itself, once the row's own FK is gone.
    await supabaseAdmin.from("activity_log").insert({
      type: "account",
      message: `Customer account deleted: ${email ?? userId}`,
      user_id: userId,
    });

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      return { ok: false, error: "Could not delete your account. Please try again or contact us." };
    }

    return { ok: true };
  },
);
