import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { throwSafe } from "./safe-error";

export type AnalyticsOrder = {
  id: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  total: number;
  createdAt: number;
};

export type AnalyticsOrderItem = {
  orderId: string;
  name: string;
  price: number;
  qty: number;
};

export type AnalyticsRefund = {
  orderId: string;
  amount: number;
  status: string;
};

export type AnalyticsData = {
  orders: AnalyticsOrder[];
  items: AnalyticsOrderItem[];
  refunds: AnalyticsRefund[];
};

/**
 * Scoped to the selected date range and only the columns each chart
 * actually reads — narrower than useAdminOrders() (select *, every order
 * ever) in two ways, not just one. Still sums in JS rather than a real SQL
 * aggregate/RPC, so this bounds the data transferred without being the full
 * server-side-aggregation rewrite the brief describes — see the audit doc
 * for that distinction.
 */
export const useAnalyticsData = (sinceMs: number) =>
  useQuery({
    queryKey: ["analytics", sinceMs],
    queryFn: async (): Promise<AnalyticsData> => {
      const sinceIso = new Date(sinceMs).toISOString();

      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id, status, payment_status, payment_method, total, created_at")
        .gte("created_at", sinceIso);
      if (ordersError) throwSafe(ordersError, "Could not load analytics data.");

      const orderIds = (orders ?? []).map((o) => o.id);

      const [{ data: items, error: itemsError }, { data: refunds, error: refundsError }] =
        await Promise.all([
          orderIds.length
            ? supabase
                .from("order_items")
                .select("order_id, name, price, qty")
                .in("order_id", orderIds)
            : Promise.resolve({
                data: [] as { order_id: string; name: string; price: number; qty: number }[],
                error: null,
              }),
          orderIds.length
            ? supabase.from("refunds").select("order_id, amount, status").in("order_id", orderIds)
            : Promise.resolve({
                data: [] as { order_id: string; amount: number; status: string }[],
                error: null,
              }),
        ]);
      if (itemsError) throwSafe(itemsError, "Could not load order items.");
      if (refundsError) throwSafe(refundsError, "Could not load refund data.");

      return {
        orders: (orders ?? []).map((o) => ({
          id: o.id,
          status: o.status,
          paymentStatus: o.payment_status,
          paymentMethod: o.payment_method,
          total: Number(o.total),
          createdAt: new Date(o.created_at).getTime(),
        })),
        items: (items ?? []).map((i) => ({
          orderId: i.order_id,
          name: i.name,
          price: Number(i.price),
          qty: i.qty,
        })),
        refunds: (refunds ?? [])
          .filter((r) => r.status === "processed")
          .map((r) => ({ orderId: r.order_id, amount: Number(r.amount), status: r.status })),
      };
    },
    staleTime: 30_000,
  });
