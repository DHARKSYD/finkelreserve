import { formatNGN } from "@/lib/currency";

/**
 * Couriers an order can be handed to. This is deliberately a hand-off
 * (record + dispatch sheet), not an API integration: Glovo's business API
 * and the others need account credentials this project doesn't have, and
 * their docs weren't available to build against. When one is connected,
 * it plugs in where the admin "Hand off" action is saved — the order fields
 * and the customer messages already carry everything it would need.
 */
export const COURIERS = [
  { id: "glovo", label: "Glovo", openUrl: "https://business.glovoapp.com/" },
  { id: "kwik", label: "Kwik Delivery", openUrl: "https://kwik.delivery/" },
  { id: "gig", label: "GIG Logistics", openUrl: null },
  { id: "own_rider", label: "Our own rider", openUrl: null },
  { id: "other", label: "Other courier", openUrl: null },
] as const;

export type CourierId = (typeof COURIERS)[number]["id"];
export const COURIER_IDS = COURIERS.map((c) => c.id) as [CourierId, ...CourierId[]];

export function courierLabel(id: string | null | undefined): string {
  return COURIERS.find((c) => c.id === id)?.label ?? (id ? id : "Courier");
}

export type DispatchInput = {
  storeName: string;
  orderRef: string;
  pickupAddress: string | null;
  pickupPhone: string | null;
  customer: {
    name: string;
    phone: string;
    address: string;
    city: string;
    state?: string;
    landmark: string;
  };
  bottleCount: number;
  total: number;
  /** true when the customer still has to pay the rider (pay-on-delivery, not yet marked paid). */
  collectOnDelivery: boolean;
};

/** The plain-text "delivery request" an admin pastes/sends into a courier app or chat. */
export function buildDispatchMessage(d: DispatchInput): string {
  const dropOff = [d.customer.address, d.customer.city, d.customer.state]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(", ");
  const lines = [
    `DELIVERY REQUEST — ${d.storeName}`,
    `Order #${d.orderRef}`,
    "",
    "PICK UP",
    d.pickupAddress?.trim() || "(add your pickup address in Admin → Settings)",
    ...(d.pickupPhone ? [`Contact: ${d.pickupPhone}`] : []),
    "",
    "DROP OFF",
    `${d.customer.name}${d.customer.phone ? ` — ${d.customer.phone}` : ""}`,
    dropOff,
    ...(d.customer.landmark.trim()
      ? [`Landmark / instructions: ${d.customer.landmark.trim()}`]
      : []),
    "",
    "PARCEL",
    `${d.bottleCount} bottle${d.bottleCount === 1 ? "" : "s"} of wine/spirits — glass, fragile. Keep upright. Alcohol: 18+ only, ID on delivery.`,
    "Contains alcohol: hand over to an adult (18+) only, and ask for ID if unsure.",
    "",
    "PAYMENT",
    d.collectOnDelivery
      ? `COLLECT ${formatNGN(d.total)} from the customer on delivery.`
      : "Already paid — nothing to collect.",
  ];
  return lines.join("\n");
}

/** Opens WhatsApp with the message pre-filled; the sender picks the contact (rider / dispatcher). */
export function whatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
