import { createFileRoute, Link } from "@tanstack/react-router";
import { sizeWithUnit } from "@/lib/box";
import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { useOrder } from "@/lib/queries/orders";
import { verifyPaystackPayment, initializePaystackPayment } from "@/lib/actions/paystack";
import { formatNGN } from "@/lib/currency";
import { CheckCircle2, Package, AlertCircle, CreditCard } from "lucide-react";

export const Route = createFileRoute("/order-confirmation/$id")({
  head: () => ({ meta: [{ title: "Order confirmed — Finkel Reserve" }] }),
  component: OrderConfirmationPage,
});

function OrderConfirmationPage() {
  const { id } = Route.useParams();
  const { data: order, isLoading, refetch } = useOrder(id);
  const [verifying, setVerifying] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  // Paystack redirects back here with ?reference=... — verify server-side
  // in case the webhook hasn't landed yet (or isn't configured at all).
  useEffect(() => {
    const reference = new URLSearchParams(window.location.search).get("reference");
    if (!reference || !order || order.paymentStatus !== "pending") return;
    setVerifying(true);
    verifyPaystackPayment({ data: { reference } })
      .then(() => refetch())
      .finally(() => setVerifying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, order?.paymentStatus]);

  const retryPayment = async () => {
    if (!order) return;
    setRetrying(true);
    setRetryError(null);
    try {
      const init = await initializePaystackPayment({
        data: { orderId: order.id, callbackUrl: window.location.href.split("?")[0] },
      });
      if (init.ok) window.location.href = init.authorizationUrl;
      else setRetryError(init.error);
    } finally {
      setRetrying(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="pt-40 text-center text-muted-foreground">Loading your order…</div>
      </Layout>
    );
  }

  if (!order) {
    return (
      <Layout>
        <div className="pt-40 text-center px-6">
          <h1 className="font-display font-black text-5xl">Order not found</h1>
          <p className="mt-3 text-muted-foreground">
            Double-check the link, or reach out if you think this is a mistake.
          </p>
          <Link
            to="/shop"
            className="mt-6 inline-block rounded-full bg-primary text-primary-foreground px-6 py-3 font-bold"
          >
            Keep shopping
          </Link>
        </div>
      </Layout>
    );
  }

  const needsPayment =
    order.paymentMethod === "paystack" &&
    order.paymentStatus !== "paid" &&
    order.paymentStatus !== "refunded";

  return (
    <Layout>
      <div className="pt-32" />
      <div className="mx-auto max-w-3xl px-6 md:px-10">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/15 text-primary grid place-items-center mb-5">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary font-mono">
            — Order placed
          </p>
          <h1 className="mt-2 font-display font-black text-4xl md:text-5xl tracking-tighter">
            Thanks, {order.customer.name.split(" ")[0]}!
          </h1>
          <p className="mt-3 text-muted-foreground">
            Order{" "}
            <span className="font-mono text-foreground">{order.id.slice(0, 8).toUpperCase()}</span>{" "}
            · placed {new Date(order.createdAt).toLocaleDateString()}
          </p>
          {order.notify.email && (
            <p className="mt-2 text-xs text-muted-foreground">
              We'll email order updates to {order.customer.email}
              {order.notify.sms ? " and text them to your phone" : ""}.
            </p>
          )}
          {order.courier.trackingUrl && order.status !== "delivered" && (
            <p className="mt-3">
              <a
                href={order.courier.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-primary underline underline-offset-4"
              >
                Track your delivery →
              </a>
            </p>
          )}
        </div>

        {verifying && (
          <div className="mt-8 flex items-center gap-2 justify-center text-sm text-muted-foreground">
            <span className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />{" "}
            Confirming your payment…
          </div>
        )}

        {needsPayment && !verifying && (
          <div className="mt-8 glass rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-4 justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Payment not completed yet</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your items are on hold — finish payment to lock in your order.
                </p>
              </div>
            </div>
            <button
              onClick={retryPayment}
              disabled={retrying}
              className="shrink-0 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold disabled:opacity-60"
            >
              <CreditCard className="h-4 w-4" /> {retrying ? "Redirecting…" : "Complete payment"}
            </button>
          </div>
        )}
        {retryError && <p className="mt-2 text-xs text-destructive text-center">{retryError}</p>}

        <div className="mt-10 glass rounded-2xl p-6">
          <div className="flex items-center gap-2 text-sm font-semibold mb-4">
            <Package className="h-4 w-4 text-primary" /> Order status:{" "}
            <span className="capitalize text-primary">{order.status}</span>
            <span className="text-muted-foreground font-normal">
              · {order.paymentMethod === "paystack" ? "Paid online" : "Pay on delivery"} ·{" "}
              {order.paymentStatus}
            </span>
          </div>
          <div className="space-y-3">
            {order.items.map((i, idx) => (
              <div key={i.id ?? idx} className="flex gap-4 items-center">
                <img src={i.image} alt={i.name} className="h-16 w-14 object-cover rounded-lg" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{i.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {sizeWithUnit(i.size, i.unit, i.bottlesPerUnit)} · Qty {i.qty}
                  </p>
                </div>
                <p className="text-sm font-bold">{formatNGN(i.price * i.qty)}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-5 border-t border-border space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatNGN(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-primary">
                <span>Discount</span>
                <span>-{formatNGN(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>Shipping</span>
              <span>{order.shipping === 0 ? "Free" : formatNGN(order.shipping)}</span>
            </div>
            <div className="flex justify-between font-display font-black text-lg pt-2">
              <span>Total</span>
              <span>{formatNGN(order.total)}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 glass rounded-2xl p-6 text-sm">
          <p className="font-semibold mb-2">Delivering to</p>
          <p className="text-muted-foreground">{order.customer.name}</p>
          <p className="text-muted-foreground">
            {order.customer.address}
            {order.customer.city && `, ${order.customer.city}`}
          </p>
          {order.customer.landmark && (
            <p className="text-muted-foreground">{order.customer.landmark}</p>
          )}
          <p className="text-muted-foreground">
            {order.customer.email}
            {order.customer.phone && ` · ${order.customer.phone}`}
          </p>
        </div>

        <div className="mt-10 text-center pb-24">
          <Link
            to="/shop"
            className="inline-block rounded-full bg-primary text-primary-foreground px-7 py-3 font-bold"
          >
            Keep shopping
          </Link>
        </div>
      </div>
    </Layout>
  );
}
