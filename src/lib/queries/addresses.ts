import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { throwSafe } from "./safe-error";

// customer_addresses isn't in generated types.ts yet — documented types.ts
// gap, same as every other recent migration (see the audit doc).
const db = supabase as unknown as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- documented types.ts gap above
  from: (table: "customer_addresses") => any;
};

export type Address = {
  id: string;
  recipientName: string;
  phone: string;
  addressLine: string;
  city: string;
  state: string;
  deliveryInstructions: string | null;
  isDefault: boolean;
};

interface AddressRow {
  id: string;
  recipient_name: string;
  phone: string;
  address_line: string;
  city: string;
  state: string;
  delivery_instructions: string | null;
  is_default: boolean;
}

function mapAddress(row: AddressRow): Address {
  return {
    id: row.id,
    recipientName: row.recipient_name,
    phone: row.phone,
    addressLine: row.address_line,
    city: row.city,
    state: row.state,
    deliveryInstructions: row.delivery_instructions,
    isDefault: row.is_default,
  };
}

// RLS ("customers manage own addresses") filters to customer_id = auth.uid()
// automatically — no explicit filter needed.
export const useMyAddresses = () =>
  useQuery({
    queryKey: ["addresses", "my"],
    queryFn: async (): Promise<Address[]> => {
      const { data, error } = await db
        .from("customer_addresses")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throwSafe(error, "Could not load your addresses.");
      return ((data ?? []) as AddressRow[]).map(mapAddress);
    },
    staleTime: 15_000,
  });

export type AddressInput = {
  recipientName: string;
  phone: string;
  addressLine: string;
  city: string;
  state: string;
  deliveryInstructions: string | null;
  isDefault: boolean;
};

function toRow(input: AddressInput, customerId: string) {
  return {
    customer_id: customerId,
    recipient_name: input.recipientName,
    phone: input.phone,
    address_line: input.addressLine,
    city: input.city,
    state: input.state,
    delivery_instructions: input.deliveryInstructions,
    is_default: input.isDefault,
  };
}

const invalidate = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ queryKey: ["addresses"] });

export const useCreateAddress = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ input, customerId }: { input: AddressInput; customerId: string }) => {
      const { error } = await db.from("customer_addresses").insert(toRow(input, customerId));
      if (error) throwSafe(error, "Could not save this address.");
    },
    onSuccess: () => invalidate(qc),
  });
};

export const useUpdateAddress = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
      customerId,
    }: {
      id: string;
      input: AddressInput;
      customerId: string;
    }) => {
      const { error } = await db
        .from("customer_addresses")
        .update(toRow(input, customerId))
        .eq("id", id);
      if (error) throwSafe(error, "Could not update this address.");
    },
    onSuccess: () => invalidate(qc),
  });
};

export const useSetDefaultAddress = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from("customer_addresses")
        .update({ is_default: true })
        .eq("id", id);
      if (error) throwSafe(error, "Could not set this as your default address.");
    },
    onSuccess: () => invalidate(qc),
  });
};

export const useDeleteAddress = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("customer_addresses").delete().eq("id", id);
      if (error) throwSafe(error, "Could not delete this address.");
    },
    onSuccess: () => invalidate(qc),
  });
};
