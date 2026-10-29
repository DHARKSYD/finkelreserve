import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { throwSafe } from "./safe-error";

export type ActivityEntry = {
  id: string;
  at: number;
  type: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
};

// This used to only ever contain customer-side events (orders placed) —
// there was no delete policy for a "clear" action that used to sit here
// (it silently failed), and no admin action anywhere wrote to this table.
// The migration adds triggers so product create/delete/publish, order
// status/payment changes, order cancellation, and review moderation all
// land here too, with an actor — this is a real admin audit trail now,
// not just an order-events feed, so there's deliberately no way to clear
// it from ordinary admin access.
export const useAdminActivity = () =>
  useQuery({
    queryKey: ["activity", "admin"],
    queryFn: async (): Promise<ActivityEntry[]> => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("id, type, message, created_at, entity_type, entity_id")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throwSafe(error, "Could not load activity.");
      return (data ?? []).map((a) => ({
        id: a.id,
        at: new Date(a.created_at).getTime(),
        type: a.type,
        message: a.message,
        entityType: a.entity_type,
        entityId: a.entity_id,
      }));
    },
    staleTime: 15_000,
  });
