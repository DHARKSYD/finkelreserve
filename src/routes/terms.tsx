import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { useSettings } from "@/lib/queries/settings";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Finkel Reserve" },
      {
        name: "description",
        content:
          "Terms and conditions for shopping at Finkel Reserve — orders, payments, shipping, and returns.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: TermsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="font-display font-bold text-xl mb-4 text-foreground">{title}</h2>
      <div className="space-y-3 text-muted-foreground leading-relaxed text-sm">{children}</div>
    </div>
  );
}

function TermsPage() {
  const { data: settings } = useSettings();
  const supportEmail = settings?.supportEmail ?? "hello@finkelreserve.com";

  return (
    <Layout>
      <div className="pt-32 pb-24">
        <div className="mx-auto max-w-3xl px-6 md:px-10">
          <div className="mb-12">
            <p className="text-xs uppercase tracking-[0.3em] text-primary font-mono mb-3">Legal</p>
            <h1 className="font-display font-black text-4xl md:text-5xl tracking-tighter text-foreground mb-4">
              Terms &amp; Conditions
            </h1>
            <p className="text-muted-foreground text-sm">Last updated: August 2026</p>
          </div>

          <div className="border-t border-border/60 pt-10">
            <Section title="1. Acceptance of Terms">
              <p>
                By accessing and using finkelreserve.com or placing an order with us, you agree to
                these Terms &amp; Conditions in full. If you do not agree, please do not use this
                site.
              </p>
              <p>
                We reserve the right to update these terms at any time. Changes are effective
                immediately upon posting. Continued use of the site after changes are posted
                constitutes acceptance.
              </p>
            </Section>

            <Section title="2. Eligibility &amp; Responsible Purchase">
              <p>
                We sell alcoholic beverages. Our store is open only to customers in Nigeria aged 18
                or over. By placing an order, you confirm that you are at least 18 years old and
                have the legal capacity to enter into a binding agreement.
              </p>
              <p>
                We may require age verification at checkout or on delivery, and reserve the right to
                refuse or cancel any order where we cannot reasonably confirm the purchaser meets
                this requirement. Please enjoy our products responsibly.
              </p>
            </Section>

            <Section title="3. Products">
              <p>
                We sell wines, whiskeys and other fine beverages. Product images, descriptions,
                region, vintage, and grape-variety information are provided in good faith and are as
                accurate as we can make them at time of listing, but vintages and exact labels may
                vary as stock is replenished. Colours and details may appear slightly different on
                different screens.
              </p>
              <p>
                Availability is managed per bottle-size variant. If the size you ordered becomes
                unavailable after your order is placed, we will contact you with alternatives or
                issue a full refund.
              </p>
            </Section>

            <Section title="4. Pricing">
              <p>
                All prices are in <strong className="text-foreground">Nigerian Naira (₦)</strong>.
                We reserve the right to correct pricing errors; if an order is placed at an
                incorrect price, we will notify you and give you the option to proceed at the
                correct price or cancel.
              </p>
            </Section>

            <Section title="5. Orders and Payment">
              <p>
                Placing an order is an offer to purchase; we confirm acceptance by moving your order
                to <em>Confirmed</em> status.
              </p>
              <p>We accept payment by:</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>
                  <strong className="text-foreground">Online payment</strong> — processed securely
                  by Paystack (cards, bank transfer, USSD, and other Paystack-supported methods)
                </li>
                <li>
                  <strong className="text-foreground">Pay on delivery</strong> — cash on delivery at
                  the time your order arrives, subject to age verification (see Section 2)
                </li>
              </ul>
              <p>
                For online payments, your order is only confirmed after payment has been verified.
                We do not store your card details — all payment information is handled directly by
                Paystack.
              </p>
            </Section>

            <Section title="6. Promotions and Coupon Codes">
              <p>
                Coupon codes may be offered from time to time. Each code has specific conditions
                (minimum order amount, expiry date, usage limits, eligible products, etc.) which are
                applied automatically at checkout. Codes cannot be combined unless explicitly
                stated.
              </p>
              <p>
                We reserve the right to deactivate or modify promotional codes at any time without
                notice.
              </p>
            </Section>

            <Section title="7. Shipping">
              <p>We currently deliver within Nigeria. Shipping rates are:</p>
              <div className="mt-3 p-4 rounded-xl bg-surface-2 border border-border/60 space-y-2">
                <div className="flex justify-between">
                  <span>Orders below ₦180,000</span>
                  <span className="font-semibold text-foreground">₦5,000 flat rate</span>
                </div>
                <div className="flex justify-between">
                  <span>Orders of ₦180,000 and above</span>
                  <span className="font-semibold text-foreground">Free shipping</span>
                </div>
              </div>
              <p className="mt-3">
                As an alcohol retailer, a valid ID showing proof of age may be required from the
                recipient at the point of delivery. Delivery timelines and available locations
                depend on your area. See our{" "}
                <a href="/shipping-policy" className="text-primary hover:underline">
                  Shipping Policy
                </a>{" "}
                for full details. We are not responsible for delays caused by logistics partners or
                circumstances beyond our control.
              </p>
            </Section>

            <Section title="8. Order Cancellation">
              <p>
                Orders can be cancelled by the customer while in <em>Pending</em> status. Once an
                order moves to <em>Confirmed</em> or <em>Shipped</em>, cancellation may not be
                possible. Contact us at{" "}
                <a href={`mailto:${supportEmail}`} className="text-primary hover:underline">
                  {supportEmail}
                </a>{" "}
                as soon as possible if you need to cancel.
              </p>
            </Section>

            <Section title="9. Returns and Refunds">
              <p>
                Please read our{" "}
                <a href="/returns-policy" className="text-primary hover:underline">
                  Returns &amp; Refunds Policy
                </a>{" "}
                for full details. Key points:
              </p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>
                  Returns must be initiated by contacting us within the stated return window. Items
                  must be unopened and in original condition.
                </li>
                <li>
                  Refunds for online payments are processed via Paystack. Refunds for
                  pay-on-delivery orders are processed via bank transfer.
                </li>
              </ul>
            </Section>

            <Section title="10. Intellectual Property">
              <p>
                All content on this site — including product photographs, text, logos, and designs —
                is the property of Finkel Reserve or our licensors and is protected by applicable
                copyright and trademark law. You may not copy, reproduce, or use any content without
                our prior written permission.
              </p>
              <p>
                Winery, distillery and producer names, labels, and brand marks belong to their
                respective owners. Our resale of these products is conducted in accordance with
                applicable distribution agreements.
              </p>
            </Section>

            <Section title="11. Limitation of Liability">
              <p>
                To the fullest extent permitted by applicable law, Finkel Reserve shall not be
                liable for any indirect, incidental, or consequential damages arising from your use
                of this site or from any order placed with us. Our liability in any case shall not
                exceed the amount you paid for the relevant order.
              </p>
            </Section>

            <Section title="12. Governing Law">
              <p>
                These Terms &amp; Conditions are governed by the laws of the Federal Republic of
                Nigeria. Any dispute arising from these terms or your use of this site shall be
                subject to the exclusive jurisdiction of the courts of Nigeria.
              </p>
            </Section>

            <Section title="13. Contact">
              <p>For questions about these terms, contact us at:</p>
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
            <a href="/privacy" className="hover:text-primary">
              Privacy Policy
            </a>
            <a href="/shipping-policy" className="hover:text-primary">
              Shipping Policy
            </a>
            <a href="/returns-policy" className="hover:text-primary">
              Returns &amp; Refunds
            </a>
          </div>
        </div>
      </div>
    </Layout>
  );
}
