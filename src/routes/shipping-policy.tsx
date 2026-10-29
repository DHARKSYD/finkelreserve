import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { useSettings } from "@/lib/queries/settings";
import { getPublicShippingSummary } from "@/lib/actions/shipping";
import { formatDeliveryEstimate } from "@/lib/queries/shipping";
import { formatNGN } from "@/lib/currency";

export const Route = createFileRoute("/shipping-policy")({
  head: () => ({
    meta: [
      { title: "Shipping Policy — Finkel Reserve" },
      {
        name: "description",
        content: "Shipping rates, delivery areas, and timelines for Finkel Reserve orders.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: ShippingPolicyPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="font-display font-bold text-xl mb-4 text-foreground">{title}</h2>
      <div className="space-y-3 text-muted-foreground leading-relaxed text-sm">{children}</div>
    </div>
  );
}

function ShippingPolicyPage() {
  const { data: settings } = useSettings();
  const supportEmail = settings?.supportEmail ?? "hello@finkelreserve.com";

  const {
    data: zones,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["shipping", "public-summary"],
    queryFn: () => getPublicShippingSummary(),
    staleTime: 60_000,
  });

  return (
    <Layout>
      <div className="pt-32 pb-24">
        <div className="mx-auto max-w-3xl px-6 md:px-10">
          <div className="mb-12">
            <p className="text-xs uppercase tracking-[0.3em] text-primary font-mono mb-3">Legal</p>
            <h1 className="font-display font-black text-4xl md:text-5xl tracking-tighter text-foreground mb-4">
              Shipping Policy
            </h1>
            <p className="text-muted-foreground text-sm">Last updated: August 2026</p>
          </div>

          <div className="border-t border-border/60 pt-10">
            <Section title="1. Delivery Areas">
              <p>
                We currently deliver to locations within{" "}
                <strong className="text-foreground">Nigeria</strong>. We do not offer international
                shipping at this time.
              </p>
              <p>
                If your area is not covered by our standard delivery network, contact us at{" "}
                <a href={`mailto:${supportEmail}`} className="text-primary hover:underline">
                  {supportEmail}
                </a>{" "}
                and we will do our best to find a solution.
              </p>
            </Section>

            <Section title="2. Shipping Rates">
              {isLoading && (
                <div className="rounded-xl border border-border/60 px-5 py-6 text-sm text-muted-foreground">
                  Loading current rates…
                </div>
              )}

              {!isLoading && error && (
                <div className="rounded-xl border border-border/60 px-5 py-6 text-sm text-muted-foreground">
                  Rates couldn't be loaded right now — they're always shown accurately at checkout,
                  or contact us at{" "}
                  <a href={`mailto:${supportEmail}`} className="text-primary hover:underline">
                    {supportEmail}
                  </a>
                  .
                </div>
              )}

              {!isLoading && !error && (!zones || zones.length === 0) && (
                <div className="rounded-xl border border-border/60 px-5 py-6 text-sm text-muted-foreground">
                  Shipping rates are being finalized. Exact cost is always shown at checkout before
                  you pay.
                </div>
              )}

              {!isLoading && !error && zones && zones.length > 0 && (
                <div className="space-y-4">
                  {zones.map((zone) => (
                    <div
                      key={zone.zoneName}
                      className="rounded-xl border border-border/60 overflow-hidden"
                    >
                      <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground bg-surface-2 px-5 py-3">
                        {zone.zoneName}
                        {zone.states.length <= 3 && (
                          <span className="normal-case tracking-normal font-normal">
                            {" "}
                            · {zone.states.join(", ")}
                          </span>
                        )}
                      </div>
                      <div className="divide-y divide-border/60">
                        {zone.rates.map((rate) => (
                          <div key={rate.name} className="grid grid-cols-2 px-5 py-4 text-sm gap-1">
                            <span className="text-muted-foreground">
                              {rate.name}
                              <span className="block text-xs text-muted-foreground/70">
                                {formatDeliveryEstimate(
                                  rate.estimatedDaysMin,
                                  rate.estimatedDaysMax,
                                )}
                                {rate.freeShippingThresholdNgn != null &&
                                  ` · free above ${formatNGN(rate.freeShippingThresholdNgn)}`}
                              </span>
                            </span>
                            <span className="text-right font-semibold text-foreground self-start">
                              {formatNGN(rate.priceNgn)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground/70 mt-2">
                Shipping fees are calculated and displayed at checkout before payment.
              </p>
            </Section>

            <Section title="3. Processing Time">
              <p>
                Orders are typically processed and dispatched the same business day, for orders
                placed and confirmed (payment or pay-on-delivery) before end of business hours.
                Orders placed after hours, on weekends, or on public holidays are processed the next
                business day.
              </p>
            </Section>

            <Section title="4. Delivery Timelines">
              <p>
                Most orders arrive same-day to next-day after dispatch, depending on your location
                and when your order was placed. Exact estimates for your delivery area are shown
                above and at checkout. Once your order has been dispatched, you can track its status
                from your{" "}
                <a href="/account" className="text-primary hover:underline">
                  account
                </a>{" "}
                or via the order confirmation page sent to your email.
              </p>
              <p>
                Delivery timelines are estimates, not guarantees. We work with third-party logistics
                partners and cannot guarantee exact arrival times. Delays due to traffic, weather,
                public holidays, or other external factors are outside our control.
              </p>
            </Section>

            <Section title="5. Order Tracking">
              <p>
                Once your order is dispatched, its status will be updated in your order history. You
                can view your order at any time by signing into your account and visiting{" "}
                <a href="/account" className="text-primary hover:underline">
                  My Account
                </a>
                . If you checked out as a guest, use the order confirmation link sent to your email
                address.
              </p>
              <p>
                If you believe your order is significantly delayed or lost, contact us at{" "}
                <a href={`mailto:${supportEmail}`} className="text-primary hover:underline">
                  {supportEmail}
                </a>{" "}
                with your order number and we will investigate.
              </p>
            </Section>

            <Section title="6. Failed Delivery">
              <p>
                If a delivery attempt fails because no one was available to receive it, our
                logistics partner will attempt re-delivery or contact you to arrange a suitable
                time. Persistent failures may result in the order being returned to us.
              </p>
              <p>
                Please ensure your delivery address and phone number are correct when placing your
                order. We cannot be responsible for failed delivery due to incorrect address
                information provided by the customer.
              </p>
            </Section>

            <Section title="7. Damaged or Lost Parcels">
              <p>
                If your order arrives damaged or does not arrive within a reasonable period, please
                contact us immediately at{" "}
                <a href={`mailto:${supportEmail}`} className="text-primary hover:underline">
                  {supportEmail}
                </a>
                . Please include your order number, photos of any damage, and a description of the
                issue.
              </p>
              <p>
                We will work with you and our logistics partner to resolve the situation as quickly
                as possible.
              </p>
            </Section>
          </div>

          <div className="mt-10 pt-8 border-t border-border/60 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-primary">
              ← Home
            </Link>
            <a href="/returns-policy" className="hover:text-primary">
              Returns &amp; Refunds
            </a>
            <a href="/terms" className="hover:text-primary">
              Terms &amp; Conditions
            </a>
            <a href="/privacy" className="hover:text-primary">
              Privacy Policy
            </a>
          </div>
        </div>
      </div>
    </Layout>
  );
}
