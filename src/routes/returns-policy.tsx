import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { useSettings } from "@/lib/queries/settings";
import { formatReturnWindow } from "@/lib/queries/returns";

export const Route = createFileRoute("/returns-policy")({
  head: () => ({
    meta: [
      { title: "Returns & Refunds — Finkel Reserve" },
      {
        name: "description",
        content:
          "Finkel Reserve returns and refund policy — eligibility, how to request a return, and refund timelines.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: ReturnsPolicyPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="font-display font-bold text-xl mb-4 text-foreground">{title}</h2>
      <div className="space-y-3 text-muted-foreground leading-relaxed text-sm">{children}</div>
    </div>
  );
}

function ReturnsPolicyPage() {
  const { data: settings } = useSettings();
  const supportEmail = settings?.supportEmail ?? "hello@finkelreserve.com";

  return (
    <Layout>
      <div className="pt-32 pb-24">
        <div className="mx-auto max-w-3xl px-6 md:px-10">
          <div className="mb-12">
            <p className="text-xs uppercase tracking-[0.3em] text-primary font-mono mb-3">Legal</p>
            <h1 className="font-display font-black text-4xl md:text-5xl tracking-tighter text-foreground mb-4">
              Returns &amp; Refunds
            </h1>
            <p className="text-muted-foreground text-sm">Last updated: August 2026</p>
          </div>

          <div className="border-t border-border/60 pt-10">
            {/* Important callout */}
            <div className="mb-10 p-5 rounded-2xl bg-primary/5 border border-primary/20">
              <p className="text-sm font-semibold text-foreground mb-1">
                Opened bottles cannot be returned
              </p>
              <p className="text-sm text-muted-foreground">
                Once a bottle's seal is broken, it cannot be resold and is non-returnable and
                non-refundable, except in cases where the item is faulty or incorrect.
              </p>
            </div>

            <Section title="1. Eligibility for Returns">
              <p>
                Because opened bottles can't be resold, returns are limited to cases where something
                went wrong with delivery. You may return an item if:
              </p>
              <ul className="list-disc list-inside space-y-2 mt-2">
                <li>A bottle arrived broken, or the box/packaging arrived damaged</li>
                <li>You received the wrong item or vintage</li>
                <li>
                  You contact us within{" "}
                  <strong className="text-foreground">
                    {formatReturnWindow(settings?.returnWindowDays ?? 1)}
                  </strong>{" "}
                  of delivery
                </li>
              </ul>
              <p className="mt-3">
                A photo or short video of the damage isn't required, but it helps us process your
                request faster — you can attach one directly when requesting a return, or describe
                what happened in writing.
              </p>

              <p className="mt-3">
                Items that are <strong className="text-foreground">not</strong> eligible for return:
              </p>
              <ul className="list-disc list-inside space-y-2 mt-2">
                <li>Bottles that have been opened or have a broken seal, except for faults</li>
                <li>Items without original packaging</li>
                <li>Sale or clearance items (unless faulty)</li>
              </ul>
            </Section>

            <Section title="2. How to Request a Return">
              <p>
                Go to your{" "}
                <a href="/account" className="text-primary hover:underline">
                  account page
                </a>{" "}
                and find the order — eligible orders show a{" "}
                <strong className="text-foreground">Request Return</strong> button once they're
                marked delivered.
              </p>
              <ol className="list-decimal list-inside space-y-2 mt-2">
                <li>
                  Select the item(s), choose a reason, and optionally attach a photo or video and a
                  written explanation — this is available for{" "}
                  <strong className="text-foreground">
                    {formatReturnWindow(settings?.returnWindowDays ?? 1)}
                  </strong>{" "}
                  after delivery
                </li>
                <li>
                  We'll review your request in the app — you can check its status from the same
                  order at any time
                </li>
                <li>
                  Once approved, we'll confirm how to send the item back; refunds are issued after
                  we've received and checked it
                </li>
                <li>
                  Prefer email? You can also reach us at{" "}
                  <a href={`mailto:${supportEmail}`} className="text-primary hover:underline">
                    {supportEmail}
                  </a>
                </li>
              </ol>

              <p className="mt-3">
                Please do not send items back before receiving return instructions from us.
                Unauthorised returns may not be accepted.
              </p>
            </Section>

            <Section title="3. Return Shipping">
              <p>
                For faulty, damaged, or incorrect items, we will cover the cost of return shipping.
                For all other eligible returns, the customer is responsible for return shipping
                costs.
              </p>
              <p>
                Items must be returned using a trackable shipping method. We are not responsible for
                items lost or damaged in return transit.
              </p>
            </Section>

            <Section title="4. Refunds">
              <p>
                Once we receive and inspect your returned item, we will notify you of the outcome of
                the inspection. If approved:
              </p>
              <ul className="list-disc list-inside space-y-2 mt-2">
                <li>
                  <strong className="text-foreground">Online payments (Paystack):</strong> Refunds
                  are processed back to your original payment method via Paystack. Depending on your
                  bank or card provider, this typically takes 5–10 business days to appear in your
                  account.
                </li>
                <li>
                  <strong className="text-foreground">Pay-on-delivery orders:</strong> Refunds are
                  processed via bank transfer. You will be asked to provide your account details.
                  Transfers are processed within 5 business days.
                </li>
              </ul>
              <p className="mt-3">
                Shipping fees are non-refundable unless the return is due to our error (faulty or
                incorrect item).
              </p>
            </Section>

            <Section title="5. Exchanges">
              <p>
                We do not currently offer direct exchanges through the app. If you need a different
                vintage or bottle size, contact us to initiate a return (if eligible) and place a
                new order for the correct item.
              </p>
            </Section>

            <Section title="6. Order Cancellations">
              <p>
                Orders may be cancelled while they are in <em>Pending</em> status, before we begin
                processing them. Once an order moves to <em>Confirmed</em> or <em>Shipped</em>,
                cancellation may not be possible.
              </p>
              <p>
                To request a cancellation, contact us immediately at{" "}
                <a href={`mailto:${supportEmail}`} className="text-primary hover:underline">
                  {supportEmail}
                </a>{" "}
                with your order number.
              </p>
            </Section>

            <Section title="7. Contact">
              <p>For any returns, refunds, or cancellation enquiries:</p>
              <div className="mt-3 p-4 rounded-xl bg-surface-2 border border-border/60">
                <p className="font-semibold text-foreground">Finkel Reserve</p>
                <p>
                  Email:{" "}
                  <a href={`mailto:${supportEmail}`} className="text-primary hover:underline">
                    {supportEmail}
                  </a>
                </p>
                <p>
                  Instagram / X: <span className="text-foreground font-medium">@finkelreserve</span>
                </p>
              </div>
            </Section>
          </div>

          <div className="mt-10 pt-8 border-t border-border/60 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-primary">
              ← Home
            </Link>
            <a href="/shipping-policy" className="hover:text-primary">
              Shipping Policy
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
