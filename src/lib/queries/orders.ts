import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { throwSafe } from "./safe-error";
import {
  handOffOrder,
  resendOrderNotification,
  updateOrderStatus,
  type HandOffInput,
  type ResendInput,
} from "@/lib/actions/delivery";

export type OrderStatus = Tables<"orders">["status"];
export type PaymentMethod = Tables<"orders">["payment_method"];
export type PaymentStatus = Tables<"orders">["payment_status"];

export type OrderItem = {
  id: string;
  productId: string | null;
  name: string;
  image: string;
  size: string; // bottle size, e.g. "750ml"
  price: number; // per unit (one bottle, or one whole box)
  qty: number; // number of units
  unit: "bottle" | "box";
  bottlesPerUnit: number; // bottles taken from stock per unit
};

export type Order = {
  id: string;
  createdAt: number;
  deliveredAt: number | null;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    landmark: string;
  };
  /** Set when the order has been handed to an outside courier (Admin → Orders → Delivery). */
  courier: {
    provider: string | null;
    reference: string | null;
    trackingUrl: string | null;
    riderName: string | null;
    riderPhone: string | null;
    handedOffAt: number | null;
  };
  /** What the customer opted into at checkout. */
  notify: { email: boolean; sms: boolean };
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReference: string | null;
};

function mapItems(rows: Tables<"order_items">[]): OrderItem[] {
  return rows.map((r) => ({
    id: r.id,
    productId: r.product_id,
    name: r.name,
    image: r.image ?? "",
    size: r.size ?? "",
    price: Number(r.price),
    qty: r.qty,
    unit: r.unit === "box" ? "box" : "bottle",
    bottlesPerUnit: r.bottles_per_unit ?? 1,
  }));
}

function mapOrder(row: Tables<"orders">, items: Tables<"order_items">[]): Order {
  // delivered_at/shipping_city/shipping_landmark aren't in generated
  // types.ts yet — documented types.ts gap, same as every other recent
  // migration (see the audit doc).
  const deliveredAt = (row as unknown as { delivered_at: string | null }).delivered_at;
  const shippingCity = (row as unknown as { shipping_city: string | null }).shipping_city;
  const shippingLandmark = (row as unknown as { shipping_landmark: string | null })
    .shipping_landmark;
  // Newer columns (shipping_state, courier hand-off, notification consent) — same documented gap.
  const extra = row as unknown as {
    shipping_state: string | null;
    courier_provider: string | null;
    courier_reference: string | null;
    courier_tracking_url: string | null;
    courier_rider_name: string | null;
    courier_rider_phone: string | null;
    courier_handed_off_at: string | null;
    notify_email: boolean | null;
    notify_sms: boolean | null;
  };
  return {
    id: row.id,
    createdAt: new Date(row.created_at).getTime(),
    deliveredAt: deliveredAt ? new Date(deliveredAt).getTime() : null,
    items: mapItems(items),
    subtotal: Number(row.subtotal),
    shipping: Number(row.shipping),
    discount: Number(row.discount),
    total: Number(row.total),
    customer: {
      name: row.customer_name,
      email: row.customer_email,
      phone: row.customer_phone ?? "",
      address: row.shipping_address,
      // Pre-existing orders (before this migration) won't have these —
      // empty string, not a placeholder claim of "no city given".
      city: shippingCity ?? "",
      state: extra.shipping_state ?? "",
      landmark: shippingLandmark ?? "",
    },
    courier: {
      provider: extra.courier_provider,
      reference: extra.courier_reference,
      trackingUrl: extra.courier_tracking_url,
      riderName: extra.courier_rider_name,
      riderPhone: extra.courier_rider_phone,
      handedOffAt: extra.courier_handed_off_at
        ? new Date(extra.courier_handed_off_at).getTime()
        : null,
    },
    notify: { email: extra.notify_email !== false, sms: extra.notify_sms === true },
    status: row.status,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    paymentReference: row.payment_reference,
  };
}

// ─── Single order (order confirmation page) ──────────────────────────
export const useOrder = (id: string | undefined) =>
  useQuery({
    queryKey: ["orders", id],
    queryFn: async (): Promise<Order | null> => {
      const { data: order, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throwSafe(error, "Could not load this order.");
      if (!order) return null;
      const { data: items, error: itemsError } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", id!);
      if (itemsError) throwSafe(itemsError, "Could not load this order's items.");
      return mapOrder(order, items ?? []);
    },
    enabled: !!id,
    // Payment confirmation can land a beat after redirect — keep this fresh.
    staleTime: 5_000,
  });

// ─── Customer: current user's own orders ─────────────────────────────
// RLS policy "users view own orders" filters to auth.uid() = user_id
// automatically — no explicit user_id filter is needed here.
export const useMyOrders = () =>
  useQuery({
    queryKey: ["orders", "my"],
    queryFn: async (): Promise<Order[]> => {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throwSafe(error, "Could not load your orders.");
      const orderIds = (orders ?? []).map((o) => o.id);
      const { data: items, error: itemsError } = orderIds.length
        ? await supabase.from("order_items").select("*").in("order_id", orderIds)
        : { data: [] as Tables<"order_items">[], error: null };
      if (itemsError) throwSafe(itemsError, "Could not load your order details.");
      const itemsByOrder = new Map<string, Tables<"order_items">[]>();
      for (const it of items ?? []) {
        const list = itemsByOrder.get(it.order_id) ?? [];
        list.push(it);
        itemsByOrder.set(it.order_id, list);
      }
      return (orders ?? []).map((o) => mapOrder(o, itemsByOrder.get(o.id) ?? []));
    },
    staleTime: 30_000,
  });

// ─── Admin: every order ───────────────────────────────────────────────
export const useAdminOrders = () =>
  useQuery({
    queryKey: ["orders", "admin"],
    queryFn: async (): Promise<Order[]> => {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throwSafe(error, "Could not load orders.");
      const orderIds = (orders ?? []).map((o) => o.id);
      const { data: items, error: itemsError } = orderIds.length
        ? await supabase.from("order_items").select("*").in("order_id", orderIds)
        : { data: [] as Tables<"order_items">[], error: null };
      if (itemsError) throwSafe(itemsError, "Could not load order items.");
      const itemsByOrder = new Map<string, Tables<"order_items">[]>();
      for (const it of items ?? []) {
        const list = itemsByOrder.get(it.order_id) ?? [];
        list.push(it);
        itemsByOrder.set(it.order_id, list);
      }
      return (orders ?? []).map((o) => mapOrder(o, itemsByOrder.get(o.id) ?? []));
    },
    staleTime: 15_000,
  });

const invalidateOrders = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["orders"] });
};

// Goes through a server function (not a direct update) so shipped / delivered can notify the
// customer. Cancelling is separate — see cancelOrder.
export const useUpdateOrderStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: Exclude<OrderStatus, "cancelled">;
    }) => {
      const res = await updateOrderStatus({ data: { orderId: id, status } });
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: () => {
      invalidateOrders(qc);
      qc.invalidateQueries({ queryKey: ["orders", "notifications"] });
    },
  });
};

/** Record the courier an order was handed to; optionally mark it out for delivery and tell the customer. */
export const useHandOffOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: HandOffInput) => {
      const res = await handOffOrder({ data: input });
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: () => {
      invalidateOrders(qc);
      qc.invalidateQueries({ queryKey: ["orders", "notifications"] });
    },
  });
};

export type NotificationLogEntry = {
  id: string;
  event: "order_placed" | "payment_received" | "out_for_delivery" | "delivered" | "cancelled";
  channel: "email" | "sms";
  recipient: string;
  status: "pending" | "sent" | "failed" | "skipped";
  error: string | null;
  createdAt: number;
};

/** Messages sent (or attempted) for one order — admin-only (RLS), loaded when the row is expanded. */
export const useOrderNotifications = (orderId: string, enabled: boolean) =>
  useQuery({
    queryKey: ["orders", "notifications", orderId],
    enabled,
    queryFn: async (): Promise<NotificationLogEntry[]> => {
      // notification_log isn't in generated types.ts yet (documented gap).
      const db = supabase as unknown as {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- documented types.ts gap above
        from: (table: string) => any;
      };
      const { data, error } = await db
        .from("notification_log")
        .select("id, event, channel, recipient, status, error, created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      if (error) throwSafe(error, "Could not load the message history.");
      return (
        (data ?? []) as Array<Omit<NotificationLogEntry, "createdAt"> & { created_at: string }>
      ).map(({ created_at, ...rest }) => ({ ...rest, createdAt: new Date(created_at).getTime() }));
    },
  });

export const useResendNotification = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ResendInput) => {
      const res = await resendOrderNotification({ data: input });
      if (!res.ok) throw new Error(res.error);
      return res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders", "notifications"] }),
  });
};

export const useUpdatePaymentStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, paymentStatus }: { id: string; paymentStatus: PaymentStatus }) => {
      const { error } = await supabase
        .from("orders")
        .update({ payment_status: paymentStatus })
        .eq("id", id);
      if (error) throwSafe(error, "Could not update the payment status.");
    },
    onSuccess: () => invalidateOrders(qc),
  });
};

// There is deliberately no useDeleteOrder. Orders are financial records —
// the previous "Delete order" admin button called `.delete()` directly,
// which has never actually worked (no RLS policy has ever permitted
// deleting a row from `orders`), and hard-deleting one is the wrong
// operation to have even if it did: cancellation (see cancelOrder in
// lib/actions/orders.ts) is the correct terminal state, since it keeps
// the record and its audit trail intact.
