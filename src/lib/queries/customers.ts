import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { throwSafe } from "./safe-error";

// There's no dedicated customers table (and doesn't need to be one yet) —
// every fact the admin needs (order count, total spent, last order) is
// already sitting in `orders`, keyed by email. This aggregates that
// instead of duplicating it. A guest who orders twice with the same email
// correctly shows as one customer with 2 orders; a registered user who
// orders as a guest under a different email would show as two rows — a
// known limitation of aggregating by email rather than user_id, worth a
// user_id-aware version once accounts matter more than they do today.
export type AdminCustomer = {
  email: string;
  name: string;
  phone: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: number;
  firstOrderAt: number;
};

export const useAdminCustomers = () =>
  useQuery({
    queryKey: ["customers", "admin"],
    queryFn: async (): Promise<AdminCustomer[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select("customer_email, customer_name, customer_phone, total, status, created_at")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });
      if (error) throwSafe(error, "Could not load customers.");

      const byEmail = new Map<string, AdminCustomer>();
      for (const row of data ?? []) {
        const email = row.customer_email;
        const at = new Date(row.created_at).getTime();
        const existing = byEmail.get(email);
        if (!existing) {
          byEmail.set(email, {
            email,
            name: row.customer_name,
            phone: row.customer_phone ?? "",
            orderCount: 1,
            totalSpent: Number(row.total),
            lastOrderAt: at,
            firstOrderAt: at,
          });
        } else {
          existing.orderCount += 1;
          existing.totalSpent += Number(row.total);
          existing.lastOrderAt = Math.max(existing.lastOrderAt, at);
          existing.firstOrderAt = Math.min(existing.firstOrderAt, at);
        }
      }
      return [...byEmail.values()].sort((a, b) => b.totalSpent - a.totalSpent);
    },
    staleTime: 30_000,
  });
