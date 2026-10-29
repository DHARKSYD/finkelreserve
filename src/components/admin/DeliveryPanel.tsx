import { useState } from "react";
import { bottlesIn } from "@/lib/box";
import { toast } from "sonner";
import {
  Copy,
  ExternalLink,
  Mail,
  MessageCircle,
  MessageSquare,
  RotateCw,
  Truck,
} from "lucide-react";
import {
  useHandOffOrder,
  useOrderNotifications,
  useResendNotification,
  type NotificationLogEntry,
  type Order,
} from "@/lib/queries/orders";
import { useSettings } from "@/lib/queries/settings";
import {
  COURIERS,
  buildDispatchMessage,
  courierLabel,
  whatsAppShareUrl,
  type CourierId,
} from "@/lib/courier";

const INPUT = "w-full bg-input rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 ring-primary";
const LABEL = "block text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1";

const EVENT_LABEL: Record<NotificationLogEntry["event"], string> = {
  order_placed: "Order received",
  payment_received: "Payment received",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_STYLE: Record<NotificationLogEntry["status"], string> = {
  sent: "bg-primary/10 text-primary",
  pending: "bg-surface-2 text-muted-foreground",
  skipped: "bg-surface-2 text-muted-foreground",
  failed: "bg-destructive/10 text-destructive",
};

/**
 * Hand a delivery to a courier and see what the customer has been told.
 *
 * Booking the courier itself still happens in their own app — this gives the
 * admin the dispatch sheet to paste/send there, then records who has the
 * parcel so the customer gets the "on its way" message (with tracking link and
 * rider details) in one click. See README "Delivery hand-off" for why there's
 * no courier API call.
 */
export function DeliveryPanel({ order }: { order: Order }) {
  const { data: settings } = useSettings();
  const handOff = useHandOffOrder();

  const [provider, setProvider] = useState<CourierId>(
    (order.courier.provider as CourierId) || "glovo",
  );
  const [reference, setReference] = useState(order.courier.reference ?? "");
  const [trackingUrl, setTrackingUrl] = useState(order.courier.trackingUrl ?? "");
  const [riderName, setRiderName] = useState(order.courier.riderName ?? "");
  const [riderPhone, setRiderPhone] = useState(order.courier.riderPhone ?? "");

  const canHandOff =
    order.status === "pending" || order.status === "processing" || order.status === "shipped";
  const alreadyShipped = order.status === "shipped";

  const dispatchText = buildDispatchMessage({
    storeName: settings?.storeName ?? "Finkel Reserve",
    orderRef: order.id.slice(0, 8).toUpperCase(),
    pickupAddress: settings?.businessAddress ?? null,
    pickupPhone: settings?.supportPhone ?? null,
    customer: order.customer,
    bottleCount: order.items.reduce((n, i) => n + bottlesIn(i), 0), // boxes count as their bottles
    total: order.total,
    collectOnDelivery: order.paymentMethod === "delivery" && order.paymentStatus !== "paid",
  });
  const openUrl = COURIERS.find((c) => c.id === provider)?.openUrl ?? null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(dispatchText);
      toast.success("Dispatch details copied");
    } catch {
      toast.error("Couldn't copy — select the text below and copy it manually");
    }
  };

  const save = (markOutForDelivery: boolean) => {
    if (trackingUrl.trim() && !/^https?:\/\/\S+$/i.test(trackingUrl.trim())) {
      toast.error("The tracking link must start with http:// or https://");
      return;
    }
    handOff.mutate(
      {
        orderId: order.id,
        provider,
        reference,
        trackingUrl,
        riderName,
        riderPhone,
        markOutForDelivery,
      },
      {
        onSuccess: () =>
          toast.success(
            markOutForDelivery && !alreadyShipped
              ? "Marked out for delivery — the customer has been notified"
              : "Delivery details saved",
          ),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
      },
    );
  };

  return (
    <div className="mt-4 pt-4 border-t border-border/40 text-xs">
      <div className="flex items-center gap-2 mb-3">
        <Truck className="h-3.5 w-3.5 text-primary" />
        <p className="uppercase tracking-[0.15em] text-muted-foreground">Delivery &amp; courier</p>
        {order.courier.handedOffAt && (
          <span className="ml-auto text-muted-foreground">
            Handed to {courierLabel(order.courier.provider)} ·{" "}
            {new Date(order.courier.handedOffAt).toLocaleString()}
          </span>
        )}
      </div>

      {canHandOff && (
        <div className="grid lg:grid-cols-2 gap-5">
          {/* 1) the sheet to take to the courier app */}
          <div>
            <p className={LABEL}>1 · Dispatch details</p>
            <pre className="whitespace-pre-wrap rounded-lg bg-surface-2/60 p-3 text-[11px] leading-relaxed font-sans select-all">
              {dispatchText}
            </pre>
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-2 font-semibold hover:bg-surface-2/70"
              >
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
              <a
                href={whatsAppShareUrl(dispatchText)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-2 font-semibold hover:bg-surface-2/70"
              >
                <MessageCircle className="h-3.5 w-3.5" /> Send via WhatsApp
              </a>
              {openUrl && (
                <a
                  href={openUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-2 font-semibold hover:bg-surface-2/70"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open {courierLabel(provider)}
                </a>
              )}
            </div>
            {!settings?.businessAddress && (
              <p className="mt-2 text-destructive">
                Your pickup address isn't set — add it in Admin → Settings so couriers know where to
                collect.
              </p>
            )}
          </div>

          {/* 2) record who has it */}
          <div>
            <p className={LABEL}>2 · Who has it</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={LABEL} htmlFor={`courier-${order.id}`}>
                  Courier
                </label>
                <select
                  id={`courier-${order.id}`}
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as CourierId)}
                  className={INPUT}
                >
                  {COURIERS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor={`ref-${order.id}`}>
                  Their booking / order ID
                </label>
                <input
                  id={`ref-${order.id}`}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={120}
                  className={INPUT}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL} htmlFor={`track-${order.id}`}>
                  Tracking link (optional — sent to the customer)
                </label>
                <input
                  id={`track-${order.id}`}
                  value={trackingUrl}
                  onChange={(e) => setTrackingUrl(e.target.value)}
                  placeholder="https://…"
                  inputMode="url"
                  maxLength={500}
                  className={INPUT}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor={`rider-${order.id}`}>
                  Rider name
                </label>
                <input
                  id={`rider-${order.id}`}
                  value={riderName}
                  onChange={(e) => setRiderName(e.target.value)}
                  maxLength={120}
                  className={INPUT}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor={`riderphone-${order.id}`}>
                  Rider phone
                </label>
                <input
                  id={`riderphone-${order.id}`}
                  value={riderPhone}
                  onChange={(e) => setRiderPhone(e.target.value)}
                  inputMode="tel"
                  maxLength={40}
                  className={INPUT}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {!alreadyShipped && (
                <button
                  type="button"
                  onClick={() => save(true)}
                  disabled={handOff.isPending}
                  className="rounded-lg bg-primary text-primary-foreground px-4 py-2 font-bold disabled:opacity-60"
                >
                  Hand off &amp; mark out for delivery
                </button>
              )}
              <button
                type="button"
                onClick={() => save(false)}
                disabled={handOff.isPending}
                className="rounded-lg bg-surface-2 px-4 py-2 font-semibold disabled:opacity-60"
              >
                {alreadyShipped ? "Update details" : "Save without notifying"}
              </button>
            </div>
          </div>
        </div>
      )}

      {!canHandOff && order.courier.provider && (
        <p className="text-muted-foreground">
          {courierLabel(order.courier.provider)}
          {order.courier.reference && ` · ${order.courier.reference}`}
          {order.courier.riderName && ` · ${order.courier.riderName}`}
          {order.courier.riderPhone && ` · ${order.courier.riderPhone}`}
        </p>
      )}

      <Messages order={order} />
    </div>
  );
}

function Messages({ order }: { order: Order }) {
  const { data: log = [], isLoading } = useOrderNotifications(order.id, true);
  const resend = useResendNotification();

  return (
    <div className="mt-5">
      <p className={LABEL}>Customer messages</p>
      <p className="text-muted-foreground mb-2">
        Opted in to: email {order.notify.email ? "✓" : "✗"} · text {order.notify.sms ? "✓" : "✗"}
      </p>
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : log.length === 0 ? (
        <p className="text-muted-foreground">Nothing sent for this order yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {log.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {m.channel === "email" ? (
                <Mail className="h-3.5 w-3.5 text-muted-foreground" aria-label="Email" />
              ) : (
                <MessageSquare
                  className="h-3.5 w-3.5 text-muted-foreground"
                  aria-label="Text message"
                />
              )}
              <span className="font-semibold">{EVENT_LABEL[m.event]}</span>
              <span className="text-muted-foreground">{m.recipient}</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[m.status]}`}
              >
                {m.status}
              </span>
              <span className="text-muted-foreground">
                {new Date(m.createdAt).toLocaleString()}
              </span>
              {(m.status === "failed" || m.status === "skipped") && (
                <button
                  type="button"
                  disabled={resend.isPending}
                  onClick={() =>
                    resend.mutate(
                      { orderId: order.id, event: m.event, channel: m.channel },
                      {
                        onSuccess: (r) =>
                          r.status === "sent"
                            ? toast.success("Sent")
                            : toast.error(r.error ?? `Still ${r.status}`),
                        onError: (e) =>
                          toast.error(e instanceof Error ? e.message : "Could not resend"),
                      },
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 font-semibold"
                >
                  <RotateCw className="h-3 w-3" /> Resend
                </button>
              )}
              {m.error && <span className="basis-full text-destructive">{m.error}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
