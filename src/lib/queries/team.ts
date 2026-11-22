import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { throwSafe } from "./safe-error";

// Every call below goes to a database function that checks "is the caller a super admin" inside
// itself (see migration 20261116110000). Nothing here is the security boundary: a request made
// by hand gets the same answer.

export type TeamStatus = "active" | "suspended" | "removed";

export type TeamMember = {
  userId: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
  /** False when the register says "active" but the admin role row is missing. */
  hasAdminRole: boolean;
  status: TeamStatus;
  addedAt: string;
  addedByName: string | null;
  note: string | null;
  lastSignInAt: string | null;
  lastActionAt: string | null;
};

export type TeamPerformance = {
  userId: string;
  totalActions: number;
  ordersHandled: number;
  returnsApproved: number;
  returnsRejected: number;
  returnsCompleted: number;
  /** Every return status change, so the areas add up to totalActions. */
  returnsActions: number;
  paymentActions: number;
  productActions: number;
  inventoryActions: number;
  promotionActions: number;
  reviewActions: number;
  teamActions: number;
  refundsCount: number;
  refundsValue: number;
  inventoryChanges: number;
  inventoryUnitsAdjusted: number;
  returnsFirstActions: number;
  avgReturnResponseHours: number | null;
  sensitiveActions: number;
};

export type FeedCategory =
  | "orders"
  | "returns"
  | "payments"
  | "products"
  | "inventory"
  | "promotions"
  | "reviews"
  | "team"
  | "sensitive";

export type FeedEntry = {
  id: string;
  userId: string;
  actorName: string | null;
  category: string;
  message: string;
  createdAt: string;
  sensitive: boolean;
};

export type DailyPoint = { day: string; actions: number };

/** Refunds at or above this are flagged. Keep in step with admin_large_refund_threshold() in the database. */
export const LARGE_REFUND_NGN = 100_000;

// ─── Periods ───────────────────────────────────────────────────────────
export type TeamRange = "7d" | "30d" | "90d";
export type TeamPeriod = { from: string; to: string };

export const TEAM_RANGES: { id: TeamRange; label: string; days: number }[] = [
  { id: "7d", label: "7 days", days: 7 },
  { id: "30d", label: "30 days", days: 30 },
  { id: "90d", label: "90 days", days: 90 },
];

/** Whole days ending at the next midnight (end exclusive), so the value is stable all day. */
export function rangeToPeriod(range: TeamRange): TeamPeriod {
  const days = TEAM_RANGES.find((r) => r.id === range)?.days ?? 30;
  const end = new Date();
  end.setHours(24, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return { from: start.toISOString(), to: end.toISOString() };
}

// Messages the team functions raise on purpose ("That account is already an admin") use the
// default error code P0001 and are written for the person using the screen, so they are shown.
// Anything else (permissions, network, unexpected) stays generic.
function teamFail(error: { code?: string; message: string }, fallback: string): never {
  if (error.code === "P0001") {
    console.error(error);
    throw new Error(error.message);
  }
  throwSafe(error, fallback);
}

// ─── Reads ─────────────────────────────────────────────────────────────
export const useTeam = () =>
  useQuery({
    queryKey: ["team", "members"],
    queryFn: async (): Promise<TeamMember[]> => {
      const { data, error } = await supabase.rpc("admin_team");
      if (error) teamFail(error, "Could not load the team.");
      return (data ?? []).map((m) => ({
        userId: m.user_id,
        email: m.email,
        name: m.full_name,
        isSuperAdmin: m.is_super_admin,
        hasAdminRole: m.has_admin_role,
        status: m.status as TeamStatus,
        addedAt: m.added_at,
        addedByName: m.added_by_name,
        note: m.note,
        lastSignInAt: m.last_sign_in_at,
        lastActionAt: m.last_action_at,
      }));
    },
    staleTime: 30_000,
  });

export const useTeamPerformance = (period: TeamPeriod) =>
  useQuery({
    queryKey: ["team", "performance", period.from, period.to],
    queryFn: async (): Promise<TeamPerformance[]> => {
      const { data, error } = await supabase.rpc("admin_performance", {
        p_from: period.from,
        p_to: period.to,
      });
      if (error) teamFail(error, "Could not load team performance.");
      return (data ?? []).map((r) => ({
        userId: r.user_id,
        totalActions: r.total_actions,
        ordersHandled: r.orders_handled,
        returnsApproved: r.returns_approved,
        returnsRejected: r.returns_rejected,
        returnsCompleted: r.returns_completed,
        returnsActions: r.returns_actions,
        paymentActions: r.payment_actions,
        productActions: r.product_actions,
        inventoryActions: r.inventory_actions,
        promotionActions: r.promotion_actions,
        reviewActions: r.review_actions,
        teamActions: r.team_actions,
        refundsCount: r.refunds_count,
        refundsValue: Number(r.refunds_value),
        inventoryChanges: r.inventory_changes,
        inventoryUnitsAdjusted: Number(r.inventory_units_adjusted),
        returnsFirstActions: r.returns_first_actions,
        avgReturnResponseHours:
          r.avg_return_response_hours == null ? null : Number(r.avg_return_response_hours),
        sensitiveActions: r.sensitive_actions,
      }));
    },
    staleTime: 30_000,
  });

export const useTeamDaily = (userId: string | null, period: TeamPeriod) =>
  useQuery({
    queryKey: ["team", "daily", userId, period.from, period.to],
    queryFn: async (): Promise<DailyPoint[]> => {
      const { data, error } = await supabase.rpc("admin_daily_activity", {
        p_user: userId,
        p_from: period.from,
        p_to: period.to,
      });
      if (error) teamFail(error, "Could not load the activity chart.");
      return (data ?? []).map((d) => ({ day: d.day, actions: d.actions }));
    },
    staleTime: 30_000,
  });

const FEED_PAGE = 30;

/** The audit feed, newest first. userId null means the whole team. */
export const useTeamFeed = (userId: string | null, category: FeedCategory | null) =>
  useInfiniteQuery({
    queryKey: ["team", "feed", userId, category],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<FeedEntry[]> => {
      const { data, error } = await supabase.rpc("admin_activity_feed", {
        p_user: userId,
        p_type: category,
        p_before: pageParam,
        p_limit: FEED_PAGE,
      });
      if (error) teamFail(error, "Could not load the activity feed.");
      return (data ?? []).map((e) => ({
        id: e.id,
        userId: e.user_id,
        actorName: e.actor_name,
        category: e.category,
        message: e.message,
        createdAt: e.created_at,
        sensitive: e.sensitive,
      }));
    },
    getNextPageParam: (last) =>
      last.length === FEED_PAGE ? last[last.length - 1].createdAt : undefined,
    staleTime: 15_000,
  });

// ─── Writes ────────────────────────────────────────────────────────────
export const useGrantAdmin = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.rpc("admin_grant", { p_email: email });
      if (error) teamFail(error, "Could not add that admin.");
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team"] }),
  });
};

export const useSetAdminStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; status: TeamStatus }) => {
      const { error } = await supabase.rpc("admin_set_status", {
        p_user: input.userId,
        p_status: input.status,
      });
      if (error) teamFail(error, "Could not change that admin's access.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team"] }),
  });
};

export const useSetAdminNote = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; note: string }) => {
      const { error } = await supabase.rpc("admin_set_note", {
        p_user: input.userId,
        p_note: input.note,
      });
      if (error) teamFail(error, "Could not save the note.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team", "members"] }),
  });
};
