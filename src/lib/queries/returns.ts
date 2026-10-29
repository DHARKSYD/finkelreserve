import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { throwSafe } from "./safe-error";
import {
  requestReturn as requestReturnAction,
  updateReturnStatus as updateReturnStatusAction,
  RETURN_STATUSES,
  type ReturnStatus,
  type RequestReturnInput,
  type UpdateReturnStatusInput,
} from "@/lib/actions/returns";

export { RETURN_STATUSES, type ReturnStatus };

/** store_settings.return_window_days is day-granular; "24 hours" reads
 * better than "1 day" for the common case of a same-day window. */
export const formatReturnWindow = (days: number) => (days === 1 ? "24 hours" : `${days} days`);

// return_requests/return_items aren't in generated types.ts yet — documented
// types.ts gap, same as every other recent migration (see the audit doc).
// This cast is the only place that knowledge lives; everything below it
// (ReturnRequestRow, ReturnItemRow, mapReturn) is normally typed.
const db = supabase as unknown as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- documented types.ts gap above
  from: (table: "return_requests" | "return_items") => any;
};

interface ReturnRequestRow {
  id: string;
  order_id: string;
  customer_id: string;
  status: ReturnStatus;
  reason: string;
  customer_note: string | null;
  admin_note: string | null;
  evidence_paths: string[];
  created_at: string;
  updated_at: string;
}

interface ReturnItemRow {
  id: string;
  return_request_id: string;
  order_item_id: string;
  quantity: number;
  refund_amount: number;
  order_items: {
    name: string;
    size: string | null;
  } | null;
}

export type ReturnItem = {
  id: string;
  orderItemId: string;
  quantity: number;
  refundAmount: number;
  // Denormalized from order_items for display — not stored on return_items
  // itself, joined in at read time.
  productName: string;
  size: string | null;
};

export type ReturnRequest = {
  id: string;
  orderId: string;
  customerId: string;
  status: ReturnStatus;
  reason: string;
  customerNote: string | null;
  adminNote: string | null;
  evidencePaths: string[];
  createdAt: number;
  updatedAt: number;
  items: ReturnItem[];
  refundTotal: number;
};

function mapReturn(row: ReturnRequestRow, items: ReturnItemRow[]): ReturnRequest {
  const mappedItems = items.map((i) => ({
    id: i.id,
    orderItemId: i.order_item_id,
    quantity: i.quantity,
    refundAmount: Number(i.refund_amount),
    productName: i.order_items?.name ?? "Item",
    size: i.order_items?.size ?? null,
  }));
  return {
    id: row.id,
    orderId: row.order_id,
    customerId: row.customer_id,
    status: row.status,
    reason: row.reason,
    customerNote: row.customer_note,
    adminNote: row.admin_note,
    evidencePaths: row.evidence_paths ?? [],
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    items: mappedItems,
    refundTotal: items.reduce((sum, i) => sum + Number(i.refund_amount), 0),
  };
}

/**
 * `scopeFilter` only ever wraps the same return_requests query with
 * `.eq(...)` / left as-is (see useMyReturns vs useAdminReturns below) — the
 * loose signature here is scoped to that one internal use, not exported.
 */
async function fetchReturnsWithItems(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- internal helper, scoped to the two hooks below
  scopeFilter: (q: any) => Promise<{ data: ReturnRequestRow[] | null; error: unknown }>,
): Promise<ReturnRequest[]> {
  const { data: requests, error } = await scopeFilter(
    db.from("return_requests").select("*").order("created_at", { ascending: false }),
  );
  if (error) throwSafe(error, "Could not load returns.");

  const ids = (requests ?? []).map((r) => r.id);
  const { data: items, error: itemsError } = (
    ids.length
      ? await db
          .from("return_items")
          .select("*, order_items(name, size)")
          .in("return_request_id", ids)
      : { data: [] as ReturnItemRow[], error: null }
  ) as { data: ReturnItemRow[] | null; error: unknown };
  if (itemsError) throwSafe(itemsError, "Could not load return items.");

  const itemsByRequest = new Map<string, ReturnItemRow[]>();
  for (const it of items ?? []) {
    const list = itemsByRequest.get(it.return_request_id) ?? [];
    list.push(it);
    itemsByRequest.set(it.return_request_id, list);
  }
  return (requests ?? []).map((r) => mapReturn(r, itemsByRequest.get(r.id) ?? []));
}

// RLS ("customers view own returns") filters to customer_id = auth.uid()
// automatically — no explicit filter needed, same as useMyOrders.
export const useMyReturns = () =>
  useQuery({
    queryKey: ["returns", "my"],
    queryFn: () => fetchReturnsWithItems((q) => q),
    staleTime: 15_000,
  });

export const useAdminReturns = () =>
  useQuery({
    queryKey: ["returns", "admin"],
    queryFn: () => fetchReturnsWithItems((q) => q),
    staleTime: 10_000,
  });

export const useRequestReturn = () => {
  const qc = useQueryClient();
  return useMutation({
    // Server functions expect a { data } wrapper — wrapped here so callers
    // of .mutate() just pass the plain shape, matching how cart.tsx calls
    // placeOrder rather than leaking that convention to every call site.
    mutationFn: (input: RequestReturnInput) => requestReturnAction({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["returns"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
};

export const useUpdateReturnStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateReturnStatusInput) => updateReturnStatusAction({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["returns"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
};
