import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { throwSafe } from "./safe-error";
import { requestRefund, type RefundResult } from "@/lib/actions/refunds";

export type PaymentMethod = Tables<"orders">["payment_method"];
export type PaymentStatus = Tables<"orders">["payment_status"];
export type PaymentDisplayStatus =
  "pending" | "paid" | "failed" | "partially_refunded" | "refunded";

function deriveDisplayStatus(
  paymentStatus: PaymentStatus,
  refundedAmount: number,
): PaymentDisplayStatus {
  if (paymentStatus === "refunded") return "refunded";
  if (paymentStatus === "paid" && refundedAmount > 0) return "partially_refunded";
  return paymentStatus;
}

export type AdminPayment = {
  orderId: string;
  customerName: string;
  customerEmail: string;
  total: number;
  paymentMethod: PaymentMethod;
  paymentReference: string | null;
  createdAt: number;
  refundedAmount: number;
  refundable: number;
  displayStatus: PaymentDisplayStatus;
};

// "Transactions" here are orders with payment info, not a separate table —
// per the brief, this integrates with the existing payment data rather
// than standing up a parallel one. Refunded amount only counts *processed*
// refunds (pending ones are in flight, not yet actually back with the
// customer), computed here rather than stored, so it can't drift from the
// refunds table that's the source of truth for it.
export const useAdminPayments = () =>
  useQuery({
    queryKey: ["payments", "admin"],
    queryFn: async (): Promise<AdminPayment[]> => {
      const { data: orders, error } = await supabase
        .from("orders")
        .select(
          "id, customer_name, customer_email, total, payment_method, payment_status, payment_reference, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throwSafe(error, "Could not load payments.");

      const { data: refunds, error: refundsError } = await supabase
        .from("refunds")
        .select("order_id, amount")
        .eq("status", "processed");
      if (refundsError) throwSafe(refundsError, "Could not load refund history.");

      const refundedByOrder = new Map<string, number>();
      for (const r of refunds ?? []) {
        refundedByOrder.set(r.order_id, (refundedByOrder.get(r.order_id) ?? 0) + Number(r.amount));
      }

      return (orders ?? []).map((o) => {
        const total = Number(o.total);
        const refundedAmount = refundedByOrder.get(o.id) ?? 0;
        return {
          orderId: o.id,
          customerName: o.customer_name,
          customerEmail: o.customer_email,
          total,
          paymentMethod: o.payment_method,
          paymentReference: o.payment_reference,
          createdAt: new Date(o.created_at).getTime(),
          refundedAmount,
          refundable: Math.max(0, total - refundedAmount),
          displayStatus: deriveDisplayStatus(o.payment_status, refundedAmount),
        };
      });
    },
    staleTime: 15_000,
  });

export type RefundRecord = {
  id: string;
  amount: number;
  status: "pending" | "processed" | "failed";
  method: "paystack" | "manual";
  reason: string | null;
  gatewayReference: string | null;
  createdAt: number;
};

export const useOrderRefunds = (orderId: string | null) =>
  useQuery({
    queryKey: ["payments", "refunds", orderId],
    queryFn: async (): Promise<RefundRecord[]> => {
      const { data, error } = await supabase
        .from("refunds")
        .select("id, amount, status, method, reason, gateway_reference, created_at")
        .eq("order_id", orderId!)
        .order("created_at", { ascending: false });
      if (error) throwSafe(error, "Could not load refund history.");
      return (data ?? []).map((r) => ({
        id: r.id,
        amount: Number(r.amount),
        status: r.status as RefundRecord["status"],
        method: r.method as RefundRecord["method"],
        reason: r.reason,
        gatewayReference: r.gateway_reference,
        createdAt: new Date(r.created_at).getTime(),
      }));
    },
    enabled: !!orderId,
    staleTime: 5_000,
  });

export const useRequestRefund = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { orderId: string; amount?: number; reason?: string }) =>
      requestRefund({ data: input }) as Promise<RefundResult>,
    onSuccess: (result, variables) => {
      if (!result.ok) return;
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["payments", "refunds", variables.orderId] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["activity"] });
    },
  });
};
